/* =========================================================
   ALBUKHR INTERNAL REGISTRY ENGINE
   PRODUCTION ARCHITECTURE v3
   CORE-FOUNDATION ALIGNED / NETWORK-AWARE
   Canonical: js/engines/internal-registry-engine.js

   Foundation:
   - js/core/environment-switcher.js
   - js/core/supabase-core.js
   - js/core/pi-auth-core.js
   - js/core/pi-payment.js
   - js/core/pi-project-treasury-payment.js

   Domain dependency:
   - js/engines/contributor-engine.js

   Rules:
   - No LocalStorage.
   - No duplicate Supabase client.
   - No duplicate Pi authentication.
   - Network comes from Environment Core.
   - Supabase comes from Supabase Core.
   - Pi identity comes from Pi Auth Core.
   - Contributor authorization comes from Contributor Engine.
   - sessionStorage is only a navigation/session marker, never a credential.
   - Direct reads and RPCs are network isolated.
========================================================= */

(function (window) {
  "use strict";

  const ENGINE_NAME = "ALBUKHR Internal Registry Engine";
  const VERSION = "3.0.0";
  const BUILD = "CORE-FOUNDATION-ALIGNED";
  const TABLE = "albukhr_internal_projects";
  const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

  if (window.__ALBUKHR_INTERNAL_REGISTRY_ENGINE_LOADED__) {
    console.warn(ENGINE_NAME + " already loaded.");
    return;
  }
  window.__ALBUKHR_INTERNAL_REGISTRY_ENGINE_LOADED__ = true;

  const API = {};
  window.AlbukhrInternalRegistryEngine = API;

  const SESSION_KEY = "albukhr_internal_email";

  /* =========================================================
     FOUNDATION DEPENDENCIES
  ========================================================= */

  function requireNetwork() {
    if (typeof window.requireAlbukhrNetwork !== "function") {
      throw new Error(
        ENGINE_NAME +
        ": load js/core/environment-switcher.js first."
      );
    }
    const network = window.requireAlbukhrNetwork();
    if (network !== "mainnet" && network !== "testnet") {
      throw new Error(ENGINE_NAME + ": invalid ALBUKHR network.");
    }
    return network;
  }

  function requireSupabase() {
    if (typeof window.requireAlbukhrSupabaseClient !== "function") {
      throw new Error(
        ENGINE_NAME +
        ": load js/core/supabase-core.js first."
      );
    }
    const client = window.requireAlbukhrSupabaseClient();
    if (!client || typeof client.from !== "function") {
      throw new Error(ENGINE_NAME + ": invalid Supabase Core client.");
    }
    return client;
  }

  async function requirePiUser() {
    let user = null;

    if (typeof window.requireAuth === "function") {
      try {
        user = await window.requireAuth({ redirect: false });
      } catch (_) {}
    }

    if (!user && typeof window.ensurePiAuth === "function") {
      user = await window.ensurePiAuth();
    }

    if (!user && window.AlbukhrPiAuth) {
      if (typeof window.AlbukhrPiAuth.ensurePiAuth === "function") {
        user = await window.AlbukhrPiAuth.ensurePiAuth();
      }
      if (!user && typeof window.AlbukhrPiAuth.requireAuth === "function") {
        user = await window.AlbukhrPiAuth.requireAuth({ redirect: false });
      }
    }

    if (!user?.uid) {
      throw new Error(
        ENGINE_NAME +
        ": authenticated Pi user is required. Load js/core/pi-auth-core.js."
      );
    }

    return user;
  }

  function getContributorEngine() {
    const engine = window.AlbukhrContributorEngine;
    if (!engine || typeof engine.getContributorAccess !== "function") {
      throw new Error(
        ENGINE_NAME +
        ": contributor-engine.js must be loaded before this engine."
      );
    }
    return engine;
  }

  /* =========================================================
     HELPERS
  ========================================================= */

  const str = (v, f = "") => v == null ? f : String(v);
  const bool = v => v === true;
  const num = (v, f = 0) => Number.isFinite(Number(v)) ? Number(v) : f;
  const email = v => str(v).trim().toLowerCase();
  const trim = v => str(v).trim() || null;
  const iso = () => new Date().toISOString();

  function normalizeStatus(status) {
    const s = str(status).trim().toLowerCase();
    if (s === "pending") return "internal_pending";
    if (s === "approved") return "internal_approved";
    if (s === "rejected") return "internal_rejected";
    return s || "internal_pending";
  }

  function networkFilter(query) {
    if (typeof window.applyAlbukhrNetworkFilter === "function") {
      return window.applyAlbukhrNetworkFilter(query);
    }
    return query.eq("network", requireNetwork());
  }

  function rpcPayload(payload = {}) {
    return { ...payload, p_network: requireNetwork() };
  }

  async function callRpc(name, payload = {}) {
    const { data, error } =
      await requireSupabase().rpc(name, rpcPayload(payload));
    if (error) {
      throw new Error(error.message || `RPC failed: ${name}`);
    }
    return data;
  }

  function rpcRows(result) {
    if (Array.isArray(result)) return result;
    if (Array.isArray(result?.projects)) return result.projects;
    if (Array.isArray(result?.records)) return result.records;
    if (Array.isArray(result?.data)) return result.data;
    return [];
  }

  function rpcProject(result) {
    return result?.project || result?.record || result?.data || result || {};
  }

  function isNetworkColumnError(error) {
    const m = str(error?.message).toLowerCase();
    return m.includes("network") &&
      m.includes("column") &&
      (m.includes("does not exist") || m.includes("schema cache"));
  }

  /* =========================================================
     SESSION MARKER
     ========================================================= */

  function sessionStorageSafe() {
    try { return window.sessionStorage || null; } catch (_) { return null; }
  }

  function getInternalSessionEmail() {
    const s = sessionStorageSafe();
    if (!s) return "";
    try { return email(s.getItem(SESSION_KEY) || ""); } catch (_) { return ""; }
  }

  async function setInternalSession(value) {
    const clean = email(value);
    if (!clean) throw new Error("Contributor email is required.");

    const piUser = await requirePiUser();
    const s = sessionStorageSafe();

    if (s) {
      try { s.setItem(SESSION_KEY, clean); } catch (_) {}
    }

    return {
      email: clean,
      authenticated: true,
      pi_uid: piUser.uid,
      username: piUser.username || "",
      network: requireNetwork()
    };
  }

  function clearInternalSession() {
    const s = sessionStorageSafe();
    if (!s) return;
    try { s.removeItem(SESSION_KEY); } catch (_) {}
  }

  async function hasInternalSession() {
    try {
      return !!(await requirePiUser())?.uid;
    } catch (_) {
      return false;
    }
  }

  async function getCurrentContributorEmail() {
    const sessionEmail = getInternalSessionEmail();
    if (sessionEmail) return sessionEmail;

    const engine = getContributorEngine();
    if (typeof engine.getMyContributorAccess === "function") {
      try {
        const access = await engine.getMyContributorAccess();
        return email(access?.contributor?.email || "");
      } catch (_) {}
    }
    return "";
  }

  async function getInternalSession() {
    let user = null;
    try { user = await requirePiUser(); } catch (_) {}
    return {
      email: getInternalSessionEmail(),
      authenticated: !!user?.uid,
      pi_uid: user?.uid || "",
      username: user?.username || "",
      network: requireNetwork()
    };
  }

  /* =========================================================
     NORMALIZERS
  ========================================================= */

  function normalizeContributor(raw = {}) {
    return {
      id: raw.id || null,
      full_name: raw.full_name || raw.fullName || "",
      email: email(raw.email || ""),
      phone: raw.phone || "",
      country: raw.country || "",
      albukhr_id: raw.albukhr_id || raw.albukhrId || "",
      status: str(raw.status || "").trim().toLowerCase(),
      telegram_unlocked: bool(raw.telegram_unlocked),
      internal_unlocked: bool(raw.internal_unlocked),
      project_creation_unlocked: bool(raw.project_creation_unlocked),
      network: raw.network || requireNetwork()
    };
  }

  function normalizeProject(raw = {}) {
    return {
      id: raw.id || null,
      project_name: raw.project_name || raw.projectName || "",
      project_code: raw.project_code || "",
      category: raw.category || "",
      stage: raw.stage || "",
      creator_name: raw.creator_name || raw.creatorName || "",
      creator_role: raw.creator_role || raw.role || "",
      internal_id: raw.internal_id || raw.albukhr_id || raw.albukhrId || "",
      creator_email: email(raw.creator_email || raw.email || ""),
      creator_phone: raw.creator_phone || raw.phone || "",
      summary: raw.summary || "",
      problem: raw.problem || "",
      solution: raw.solution || "",
      impact: raw.impact || "",
      funding: raw.funding || "",
      risk: raw.risk || "",
      confidentiality: raw.confidentiality || "",
      roi: num(raw.roi, 0),
      initial_liquidity: num(raw.initial_liquidity ?? raw.liquidity, 0),
      status: normalizeStatus(raw.status),
      project_approved: raw.project_approved ?? null,
      network: raw.network || requireNetwork(),
      created_at: raw.created_at || null,
      updated_at: raw.updated_at || null,
      approved_at: raw.approved_at || null,
      rejected_at: raw.rejected_at || null,
      reviewed_at: raw.reviewed_at || null,
      approved_by_email: email(raw.approved_by_email || ""),
      approved_by_name: raw.approved_by_name || "",
      rejected_by_email: email(raw.rejected_by_email || ""),
      rejected_by_name: raw.rejected_by_name || "",
      reviewed_by_email: email(raw.reviewed_by_email || ""),
      reviewed_by_name: raw.reviewed_by_name || "",
      rejection_reason:
        raw.rejection_reason ||
        raw.review_reason ||
        raw.review_note ||
        ""
    };
  }

  /* =========================================================
     CONTRIBUTOR LOOKUP / ACCESS
  ========================================================= */

  async function findContributorByEmail(value) {
    const clean = email(value);
    if (!clean) return null;

    let query = requireSupabase()
      .from("albukhr_contributors")
      .select("*")
      .ilike("email", clean)
      .limit(1);

    query = networkFilter(query);

    const { data, error } = await query.maybeSingle();

    if (error && isNetworkColumnError(error)) {
      throw new Error(
        "Network isolation is not configured on albukhr_contributors."
      );
    }
    if (error) {
      throw new Error(error.message || "Unable to load contributor.");
    }

    return data ? normalizeContributor(data) : null;
  }

  async function checkInternalAccess(value = "") {
    let piUser = null;
    try {
      piUser = await requirePiUser();
    } catch (_) {
      return {
        ok: false,
        allowed: false,
        reason: "missing_pi_authentication",
        contributor: null,
        access: null,
        pi_user: null
      };
    }

    const requested = email(value);
    const sessionEmail = getInternalSessionEmail();
    const contributorEmail =
      requested || sessionEmail || await getCurrentContributorEmail();

    if (!contributorEmail) {
      return {
        ok: false,
        allowed: false,
        reason: "missing_contributor_identity",
        contributor: null,
        access: null,
        pi_user: piUser
      };
    }

    let access;
    try {
      access = await getContributorEngine()
        .getContributorAccess(contributorEmail);
    } catch (error) {
      return {
        ok: false,
        allowed: false,
        reason: "contributor_access_lookup_failed",
        contributor: null,
        access: null,
        pi_user: piUser,
        error: error?.message || String(error)
      };
    }

    const contributor =
      normalizeContributor(access?.contributor || {});

    if (!contributor.email) {
      return {
        ok: false,
        allowed: false,
        reason: "contributor_not_found",
        contributor: null,
        access: access || null,
        pi_user: piUser
      };
    }

    if (contributor.network !== requireNetwork()) {
      return {
        ok: false,
        allowed: false,
        reason: "network_mismatch",
        contributor,
        access: access || null,
        pi_user: piUser
      };
    }

    if (contributor.status !== "approved") {
      return {
        ok: false,
        allowed: false,
        reason: "not_approved",
        contributor,
        access: access || null,
        pi_user: piUser
      };
    }

    const unlocked =
      access?.internal_unlocked ||
      access?.has_internal_access ||
      contributor.internal_unlocked;

    if (!unlocked) {
      return {
        ok: false,
        allowed: false,
        reason: "internal_locked",
        contributor,
        access: access || null,
        pi_user: piUser
      };
    }

    return {
      ok: true,
      allowed: true,
      reason: "",
      contributor,
      access: access || {},
      pi_user: piUser
    };
  }

  async function validateInternalEntryGate() {
    const result = await checkInternalAccess();

    if (!result.allowed) {
      return {
        ok: false,
        allowed: false,
        reason: result.reason || "access_denied",
        contributor: result.contributor || null,
        access: result.access || null,
        pi_user: result.pi_user || null,
        session: null
      };
    }

    const session =
      await setInternalSession(result.contributor.email);

    return {
      ok: true,
      allowed: true,
      reason: "",
      contributor: result.contributor,
      access: result.access || {},
      pi_user: result.pi_user || null,
      session
    };
  }

  async function validateInternalEntry() {
    return validateInternalEntryGate();
  }

  /* =========================================================
     PROJECT READS / LOCK
  ========================================================= */

  async function getLatestInternalProjectByEmail(value) {
    const clean = email(value);
    if (!clean) return null;

    let query = requireSupabase()
      .from(TABLE)
      .select("*")
      .ilike("creator_email", clean)
      .order("created_at", { ascending: false })
      .limit(1);

    query = networkFilter(query);

    const { data, error } = await query.maybeSingle();

    if (error && isNetworkColumnError(error)) {
      throw new Error(
        "Network isolation is not configured on albukhr_internal_projects."
      );
    }
    if (error) {
      throw new Error(
        error.message || "Unable to load internal project history."
      );
    }

    return data ? normalizeProject(data) : null;
  }

  async function checkInternalSubmissionLock(value = "") {
    const contributorEmail =
      email(value) || await getCurrentContributorEmail();

    if (!contributorEmail) {
      return {
        ok: false,
        locked: true,
        reason: "missing_email",
        message: "Authenticated contributor identity not found."
      };
    }

    const latest =
      await getLatestInternalProjectByEmail(contributorEmail);

    if (!latest) {
      return {
        ok: true,
        locked: false,
        reason: "",
        message: "",
        project: null
      };
    }

    const status = str(latest.status).trim().toLowerCase();

    if (status === "internal_pending" || status === "pending") {
      return {
        ok: true,
        locked: true,
        reason: "internal_pending_exists",
        message:
          "Your previous internal project is still under review.",
        project: latest
      };
    }

    if (status === "internal_approved" || status === "approved") {
      const approvedDate =
        latest.approved_at ||
        latest.reviewed_at ||
        latest.updated_at ||
        latest.created_at;

      if (approvedDate) {
        const approvedTime = new Date(approvedDate).getTime();
        const unlockTime = approvedTime + COOLDOWN_MS;

        if (Number.isFinite(unlockTime) && Date.now() < unlockTime) {
          return {
            ok: true,
            locked: true,
            reason: "approval_cooldown_active",
            unlock_at: new Date(unlockTime).toISOString(),
            message:
              "You can submit another internal project after the cooldown period.",
            project: latest
          };
        }
      }
    }

    return {
      ok: true,
      locked: false,
      reason: "",
      message: "",
      project: latest
    };
  }

  /* =========================================================
     VALIDATION / SUBMISSION
  ========================================================= */

  function validateInternalProjectPayload(payload = {}) {
    const errors = [];

    if (!trim(payload.projectName))
      errors.push("Project name is required.");
    if (!trim(payload.category))
      errors.push("Project category is required.");
    if (!trim(payload.stage))
      errors.push("Project stage is required.");
    if (!trim(payload.creatorName))
      errors.push("Creator name is required.");
    if (!trim(payload.creatorRole))
      errors.push("Creator role is required.");
    if (!trim(payload.internalId))
      errors.push("Albukhr Internal ID is required.");
    if (!email(payload.creatorEmail))
      errors.push("Creator email is required.");
    if (!trim(payload.summary))
      errors.push("Project summary is required.");
    if (!trim(payload.problem))
      errors.push("Problem statement is required.");
    if (!trim(payload.solution))
      errors.push("Solution is required.");

    if (
      payload.roi !== undefined &&
      !Number.isFinite(Number(payload.roi))
    ) {
      errors.push("ROI must be a valid number.");
    }

    if (payload.initialLiquidity !== undefined) {
      const liquidity = Number(payload.initialLiquidity);
      if (!Number.isFinite(liquidity))
        errors.push("Initial liquidity must be a valid number.");
      if (liquidity < 0)
        errors.push("Initial liquidity cannot be negative.");
    }

    return {
      ok: errors.length === 0,
      errors,
      firstError: errors[0] || ""
    };
  }

  async function submitInternalProject(payload = {}) {
    const access =
      await checkInternalAccess(payload.creatorEmail);

    if (!access.allowed) {
      throw new Error(
        access.reason || "Internal registry access denied."
      );
    }

    const authEmail = email(access.contributor?.email);
    const requestedEmail = email(payload.creatorEmail);

    if (requestedEmail && requestedEmail !== authEmail) {
      throw new Error(
        "Creator email must match the approved contributor."
      );
    }

    const clean = {
      projectName: trim(payload.projectName),
      category: trim(payload.category),
      stage: trim(payload.stage),
      creatorName: trim(payload.creatorName),
      creatorRole: trim(payload.creatorRole),
      internalId: trim(payload.internalId),
      creatorEmail: authEmail,
      creatorPhone: trim(payload.creatorPhone),
      summary: trim(payload.summary),
      problem: trim(payload.problem),
      solution: trim(payload.solution),
      impact: trim(payload.impact),
      funding: trim(payload.funding),
      risk: trim(payload.risk),
      confidentiality: trim(payload.confidentiality),
      roi: num(payload.roi, 0),
      initialLiquidity: num(payload.initialLiquidity, 0)
    };

    const validation = validateInternalProjectPayload(clean);
    if (!validation.ok) throw new Error(validation.firstError);

    const lock = await checkInternalSubmissionLock(authEmail);
    if (lock.locked) throw new Error(lock.message);

    const result = await callRpc(
      "albukhr_submit_internal_project",
      {
        p_project_name: clean.projectName,
        p_category: clean.category,
        p_stage: clean.stage,
        p_creator_name: clean.creatorName,
        p_creator_role: clean.creatorRole,
        p_internal_id: clean.internalId,
        p_creator_email: clean.creatorEmail,
        p_creator_phone: clean.creatorPhone,
        p_summary: clean.summary,
        p_problem: clean.problem,
        p_solution: clean.solution,
        p_impact: clean.impact,
        p_funding: clean.funding,
        p_risk: clean.risk,
        p_confidentiality: clean.confidentiality,
        p_roi: clean.roi,
        p_initial_liquidity: clean.initialLiquidity
      }
    );

    return {
      ok: true,
      network: requireNetwork(),
      message:
        result?.message ||
        "Internal project submitted successfully.",
      project: normalizeProject(rpcProject(result))
    };
  }

  async function submitInternalProjectFromForm(form = {}) {
    return submitInternalProject({
      projectName: form.projectName?.value,
      category: form.category?.value,
      stage: form.stage?.value,
      creatorName: form.creatorName?.value,
      creatorRole: form.role?.value,
      internalId: form.internalId?.value,
      creatorEmail: form.email?.value,
      creatorPhone: form.phone?.value,
      summary: form.summary?.value,
      problem: form.problem?.value,
      solution: form.solution?.value,
      impact: form.impact?.value,
      funding: form.funding?.value,
      risk: form.risk?.value,
      confidentiality: form.confidentiality?.value,
      roi: form.roi?.value,
      initialLiquidity: form.liquidity?.value
    });
  }

  /* =========================================================
     ADMIN
  ========================================================= */

  async function getInternalAdminMeta() {
    let meta = { email: "", name: "", role: "" };

    try {
      if (typeof window.getAlbukhrAdminAuthUser === "function") {
        const user = await window.getAlbukhrAdminAuthUser();
        if (user) {
          meta = {
            email: email(user.email || ""),
            name: str(
              user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              ""
            ).trim(),
            role: str(user.user_metadata?.role || "").trim()
          };
        }
      }
    } catch (_) {}

    return {
      email: meta.email,
      name: meta.name || "ALBUKHR Admin",
      role: meta.role || "admin",
      network: requireNetwork()
    };
  }

  async function adminListInternalProjects({
    status = "",
    limit = 500
  } = {}) {
    const normalized = status ? normalizeStatus(status) : "";

    try {
      const result = await callRpc(
        "albukhr_admin_list_internal_projects",
        {
          p_status: normalized || null,
          p_limit: num(limit, 500)
        }
      );

      return rpcRows(result)
        .filter(r => !r.network || r.network === requireNetwork())
        .map(normalizeProject);
    } catch (error) {
      console.warn(
        ENGINE_NAME +
        ": admin list RPC unavailable; falling back to table read.",
        error
      );
    }

    let query = requireSupabase()
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(num(limit, 500));

    query = networkFilter(query);
    if (normalized) query = query.eq("status", normalized);

    const { data, error } = await query;

    if (error && isNetworkColumnError(error)) {
      throw new Error(
        "Network isolation is not configured on albukhr_internal_projects."
      );
    }
    if (error) throw new Error(error.message || "Unable to load internal projects.");

    return (Array.isArray(data) ? data : []).map(normalizeProject);
  }

  async function adminApproveInternalProject(input = {}) {
    const object = typeof input === "string" ? { projectId: input } : input;
    const projectId = str(object.projectId || object.id).trim();

    if (!projectId)
      throw new Error("Internal project ID is required.");

    const actor = await getInternalAdminMeta();

    const result = await callRpc(
      "albukhr_admin_approve_internal_project",
      {
        p_project_id: projectId,
        p_approved_by_email:
          email(object.approvedBy || object.approvedByEmail || actor.email),
        p_approved_by_name:
          str(object.approvedByName || actor.name).trim(),
        p_approved_by_role:
          str(object.approvedByRole || actor.role).trim()
      }
    );

    return {
      ok: true,
      network: requireNetwork(),
      project: normalizeProject(rpcProject(result))
    };
  }

  async function adminRejectInternalProject(input = {}) {
    const object = typeof input === "string" ? { projectId: input } : input;
    const projectId = str(object.projectId || object.id).trim();

    if (!projectId)
      throw new Error("Internal project ID is required.");

    const actor = await getInternalAdminMeta();

    const result = await callRpc(
      "albukhr_admin_reject_internal_project",
      {
        p_project_id: projectId,
        p_rejected_by_email:
          email(object.rejectedBy || object.rejectedByEmail || actor.email),
        p_rejected_by_name:
          str(object.rejectedByName || actor.name).trim(),
        p_rejected_by_role:
          str(object.rejectedByRole || actor.role).trim(),
        p_reason: trim(object.reason)
      }
    );

    return {
      ok: true,
      network: requireNetwork(),
      project: normalizeProject(rpcProject(result))
    };
  }

  /* =========================================================
     UI / PAGE HELPERS
  ========================================================= */

  function disableButton(button, text = "Please wait...") {
    if (!button) return;
    if (!button.dataset.originalText)
      button.dataset.originalText = button.innerHTML;
    button.disabled = true;
    button.setAttribute("aria-disabled", "true");
    button.classList.add("is-disabled");
    if (text) button.innerHTML = text;
  }

  function enableButton(button) {
    if (!button) return;
    button.disabled = false;
    button.removeAttribute("aria-disabled");
    button.classList.remove("is-disabled");
    if (button.dataset.originalText)
      button.innerHTML = button.dataset.originalText;
  }

  function fillContributorFieldsIfNeeded(contributor = {}, fields = {}) {
    const mapping = {
      creatorName:
        contributor.full_name || contributor.creator_name || "",
      internalId:
        contributor.albukhr_id || contributor.internal_id || "",
      email:
        contributor.email || contributor.creator_email || "",
      phone:
        contributor.phone || contributor.creator_phone || ""
    };

    Object.keys(mapping).forEach(key => {
      const element = fields[key];
      if (!element || typeof element.value === "undefined") return;
      if (!str(element.value).trim())
        element.value = str(mapping[key]);
    });

    return contributor;
  }

  async function bootstrapInternalRegistryPage() {
    const gate = await validateInternalEntryGate();

    if (!gate.allowed) {
      return {
        allowed: false,
        reason: gate.reason || "access_denied",
        contributor: gate.contributor || null,
        access: gate.access || null,
        session: null,
        lock: null,
        pi_user: gate.pi_user || null,
        network: requireNetwork()
      };
    }

    let lock = { ok: true, locked: false, reason: "" };
    try {
      lock = await checkInternalSubmissionLock(
        gate.contributor.email
      );
    } catch (error) {
      console.warn(
        ENGINE_NAME + ": submission lock lookup failed.",
        error
      );
    }

    return {
      allowed: true,
      reason: "",
      contributor: gate.contributor,
      access: gate.access || {},
      session: gate.session || {},
      lock,
      pi_user: gate.pi_user || null,
      network: requireNetwork()
    };
  }

  function redirectToContributorPage() {
    window.location.href =
      "submit-albukhrecosystem-form.html";
  }

  function clearInternalRegistrySession() {
    clearInternalSession();
  }

  /* =========================================================
     EXPORTS / COMPATIBILITY
  ========================================================= */

  Object.assign(API, {
    ENGINE_NAME,
    VERSION,
    BUILD,
    getNetwork: requireNetwork,
    getNetworkConfig: () => {
      const network = requireNetwork();
      return {
        network,
        name: network === "testnet" ? "TESTNET" : "MAINNET"
      };
    },
    getSupabaseClient: requireSupabase,
    getPiUser: requirePiUser,
    getContributorEngine,
    setInternalSession,
    clearInternalSession,
    getInternalSessionEmail,
    getCurrentContributorEmail,
    hasInternalSession,
    getInternalSession,
    findContributorByEmail,
    checkInternalAccess,
    validateInternalEntryGate,
    validateInternalEntry,
    getLatestInternalProjectByEmail,
    checkInternalSubmissionLock,
    validateInternalProjectPayload,
    submitInternalProject,
    submitInternalProjectFromForm,
    bootstrapInternalRegistryPage,
    fillContributorFieldsIfNeeded,
    disableButton,
    enableButton,
    getInternalAdminMeta,
    adminListInternalProjects,
    adminApproveInternalProject,
    adminRejectInternalProject,
    redirectToContributorPage,
    clearInternalRegistrySession
  });

  /* Legacy global wrappers retained for existing pages. */
  window.setInternalSession = setInternalSession;
  window.clearInternalSession = clearInternalSession;
  window.getInternalSessionEmail = getInternalSessionEmail;
  window.getCurrentContributorEmail = getCurrentContributorEmail;
  window.hasInternalSession = hasInternalSession;
  window.getInternalSession = getInternalSession;
  window.findContributorByEmail = findContributorByEmail;
  window.checkInternalAccess = checkInternalAccess;
  window.validateInternalEntryGate = validateInternalEntryGate;
  window.validateInternalEntry = validateInternalEntry;
  window.checkInternalSubmissionLock = checkInternalSubmissionLock;
  window.getLatestInternalProjectByEmail = getLatestInternalProjectByEmail;
  window.submitInternalProject = submitInternalProject;
  window.submitInternalProjectFromForm = submitInternalProjectFromForm;
  window.validateInternalProjectPayload = validateInternalProjectPayload;
  window.bootstrapInternalRegistryPage = bootstrapInternalRegistryPage;
  window.fillContributorFieldsIfNeeded = fillContributorFieldsIfNeeded;
  window.disableInternalButton = disableButton;
  window.enableInternalButton = enableButton;
  window.getInternalAdminMeta = getInternalAdminMeta;
  window.adminListInternalProjects = adminListInternalProjects;
  window.adminApproveInternalProject = adminApproveInternalProject;
  window.adminRejectInternalProject = adminRejectInternalProject;
  window.redirectToContributorPage = redirectToContributorPage;
  window.clearInternalRegistrySession = clearInternalRegistrySession;

  console.info(
    "%c" + ENGINE_NAME + " v" + VERSION + " Ready",
    "color:#0f7a3d;font-weight:bold"
  );
  console.info({
    version: VERSION,
    build: BUILD,
    network: requireNetwork()
  });

})(window);
