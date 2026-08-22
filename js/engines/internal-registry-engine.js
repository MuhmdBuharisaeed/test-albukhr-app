/* =========================================================
   ALBUKHR INTERNAL REGISTRY ENGINE
   PRODUCTION ARCHITECTURE v2
   Network-aware + Supabase source-of-truth
   ENGINE CORE + ACCESS + SESSION + SUBMISSION + ADMIN + UI
========================================================= */

(function () {
  "use strict";

  if (window.__ALBUKHR_INTERNAL_REGISTRY_ENGINE_LOADED__) {
    console.warn("ALBUKHR Internal Registry Engine already loaded.");
    return;
  }

  window.__ALBUKHR_INTERNAL_REGISTRY_ENGINE_LOADED__ = true;

  const InternalRegistryEngine = {};
  window.AlbukhrInternalRegistryEngine = InternalRegistryEngine;

  const ENGINE_NAME = "ALBUKHR Internal Registry Engine";
  const VERSION = "2.0.0";
  const BUILD = "SUPABASE-NETWORK-AWARE";

  /* =========================================================
     NETWORK
     Hostname is the source of truth.
     environment-switcher.js must be loaded before this engine.
  ========================================================= */
  function getNetwork() {
    if (typeof window.requireAlbukhrNetwork === "function") {
      return window.requireAlbukhrNetwork();
    }

    if (typeof window.getAlbukhrNetwork === "function") {
      return window.getAlbukhrNetwork();
    }

    const host = String(window.location.hostname || "").trim().toLowerCase();

    if (host === "test.albukhr.com" || host.startsWith("test.")) {
      return "testnet";
    }

    if (host === "app.albukhr.com" || host.startsWith("app.")) {
      return "mainnet";
    }

    /* Development/local pages are intentionally resolved as mainnet
       for compatibility with the existing ALBUKHR environment policy. */
    return "mainnet";
  }

  function getNetworkConfig() {
    const network = getNetwork();
    return {
      network,
      name: network === "testnet" ? "TESTNET" : "MAINNET"
    };
  }

  function addNetworkFilter(query, column = "network") {
    return query.eq(column, getNetwork());
  }

  /* =========================================================
     SUPABASE
  ========================================================= */
  function getSupabaseClient() {
    if (window.albukhrSupabase &&
        typeof window.albukhrSupabase.from === "function") {
      return window.albukhrSupabase;
    }

    if (typeof window.getAlbukhrSupabaseClient === "function") {
      const client = window.getAlbukhrSupabaseClient();
      if (client && typeof client.from === "function") return client;
    }

    if (window.supabaseClient &&
        typeof window.supabaseClient.from === "function") {
      return window.supabaseClient;
    }

    throw new Error("ALBUKHR: Supabase client not initialized.");
  }

  async function getAuthenticatedUser() {
    const supabase = getSupabaseClient();

    if (!supabase.auth || typeof supabase.auth.getUser !== "function") {
      return null;
    }

    const { data, error } = await supabase.auth.getUser();

    if (error) {
      console.warn(ENGINE_NAME + ": Supabase auth lookup failed.", error);
      return null;
    }

    return data?.user || null;
  }

  /* =========================================================
     CONTRIBUTOR ENGINE
  ========================================================= */
  function getContributorEngine() {
    if (!window.AlbukhrContributorEngine) {
      throw new Error(
        ENGINE_NAME + ": contributor-engine.js must be loaded first."
      );
    }
    return window.AlbukhrContributorEngine;
  }

  /* =========================================================
     HELPERS
  ========================================================= */
  function safeString(value, fallback = "") {
    if (value === null || value === undefined) return fallback;
    return String(value);
  }

  function safeBool(value) {
    return value === true;
  }

  function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function trimOrNull(value) {
    const v = safeString(value).trim();
    return v ? v : null;
  }

  function normalizeEmail(value) {
    return safeString(value).trim().toLowerCase();
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function normalizeInternalStatus(status) {
    const s = safeString(status).trim().toLowerCase();

    switch (s) {
      case "pending": return "internal_pending";
      case "approved": return "internal_approved";
      case "rejected": return "internal_rejected";
      default: return s || "internal_pending";
    }
  }

  function isNetworkColumnError(error) {
    const message = safeString(error?.message).toLowerCase();
    return (
      message.includes("column") &&
      message.includes("network") &&
      (
        message.includes("does not exist") ||
        message.includes("schema cache")
      )
    );
  }

  /* =========================================================
     INTERNAL SESSION
     IMPORTANT:
     - No LocalStorage auth/session.
     - The generated token is NOT an authentication credential.
     - Supabase Auth + contributor access are authoritative.
     - sessionStorage is only a short-lived navigation marker.
  ========================================================= */
  const SESSION_KEYS = Object.freeze({
    internalEmail: "albukhr_internal_email"
  });

  function getInternalSessionEmail() {
    try {
      return normalizeEmail(
        sessionStorage.getItem(SESSION_KEYS.internalEmail) || ""
      );
    } catch (_) {
      return "";
    }
  }

  async function setInternalSession(email) {
    const user = await getAuthenticatedUser();
    const authEmail = normalizeEmail(user?.email || "");

    const cleanEmail = normalizeEmail(email || authEmail);

    if (!cleanEmail) {
      throw new Error("Authenticated contributor email is required.");
    }

    if (authEmail && cleanEmail !== authEmail) {
      throw new Error("Internal session email does not match the authenticated user.");
    }

    try {
      sessionStorage.setItem(SESSION_KEYS.internalEmail, cleanEmail);
    } catch (_) {}

    return {
      email: cleanEmail,
      authenticated: !!authEmail,
      network: getNetwork()
    };
  }

  function clearInternalSession() {
    try {
      sessionStorage.removeItem(SESSION_KEYS.internalEmail);
    } catch (_) {}
  }

  async function hasInternalSession() {
    const user = await getAuthenticatedUser();
    return !!normalizeEmail(user?.email);
  }

  async function getInternalSession() {
    const user = await getAuthenticatedUser();
    const authEmail = normalizeEmail(user?.email || "");

    return {
      email: authEmail || getInternalSessionEmail(),
      authenticated: !!authEmail,
      network: getNetwork()
    };
  }

  async function getCurrentContributorEmail() {
    const user = await getAuthenticatedUser();
    return normalizeEmail(
      user?.email ||
      getInternalSessionEmail() ||
      ""
    );
  }

  /* =========================================================
     NORMALIZERS
  ========================================================= */
  function normalizeContributor(raw = {}) {
    return {
      id: raw.id || null,
      full_name: raw.full_name || raw.fullName || "",
      email: normalizeEmail(raw.email || ""),
      phone: raw.phone || "",
      country: raw.country || "",
      albukhr_id: raw.albukhr_id || raw.albukhrId || "",
      status: safeString(raw.status || "").trim().toLowerCase(),
      telegram_unlocked: safeBool(raw.telegram_unlocked),
      internal_unlocked: safeBool(raw.internal_unlocked),
      project_creation_unlocked: safeBool(raw.project_creation_unlocked),
      network: raw.network || getNetwork()
    };
  }

  function normalizeInternalProjectRecord(raw = {}) {
    return {
      id: raw.id || null,
      project_name: raw.project_name || raw.projectName || "",
      project_code: raw.project_code || "",
      category: raw.category || "",
      stage: raw.stage || "",
      creator_name: raw.creator_name || raw.creatorName || "",
      creator_role: raw.creator_role || raw.role || "",
      internal_id: raw.internal_id || raw.albukhr_id || raw.albukhrId || "",
      creator_email: normalizeEmail(raw.creator_email || raw.email || ""),
      creator_phone: raw.creator_phone || raw.phone || "",
      summary: raw.summary || "",
      problem: raw.problem || "",
      solution: raw.solution || "",
      impact: raw.impact || "",
      funding: raw.funding || "",
      risk: raw.risk || "",
      confidentiality: raw.confidentiality || "",
      roi: safeNumber(raw.roi, 0),
      initial_liquidity: safeNumber(raw.initial_liquidity ?? raw.liquidity, 0),
      status: raw.status || "internal_pending",
      project_approved: raw.project_approved ?? null,
      network: raw.network || getNetwork(),
      created_at: raw.created_at || null,
      updated_at: raw.updated_at || null,
      approved_at: raw.approved_at || null,
      rejected_at: raw.rejected_at || null,
      reviewed_at: raw.reviewed_at || null,
      approved_by_email: raw.approved_by_email || "",
      approved_by_name: raw.approved_by_name || "",
      rejected_by_email: raw.rejected_by_email || "",
      rejected_by_name: raw.rejected_by_name || "",
      reviewed_by_email: raw.reviewed_by_email || "",
      reviewed_by_name: raw.reviewed_by_name || "",
      rejection_reason: raw.rejection_reason || raw.review_reason || raw.review_note || ""
    };
  }

  function normalizeAdminInternalProject(raw = {}) {
    return normalizeInternalProjectRecord(raw);
  }

  /* =========================================================
     RPC
     Network is passed explicitly. The database RPCs should
     accept p_network and enforce it server-side.
  ========================================================= */
  async function callRpc(fnName, payload = {}) {
    const supabase = getSupabaseClient();

    const rpcPayload = {
      ...payload,
      p_network: getNetwork()
    };

    const { data, error } = await supabase.rpc(fnName, rpcPayload);

    if (error) {
      throw new Error(error.message || ("RPC failed: " + fnName));
    }

    return data;
  }

  /* =========================================================
     CONTRIBUTOR LOOKUP
  ========================================================= */
  async function findContributorByEmail(email) {
    const supabase = getSupabaseClient();
    const cleanEmail = normalizeEmail(email);

    if (!cleanEmail) return null;

    let query = supabase
      .from("albukhr_contributors")
      .select("*")
      .ilike("email", cleanEmail)
      .limit(1);

    query = addNetworkFilter(query);

    let result = await query.maybeSingle();

    if (result.error && isNetworkColumnError(result.error)) {
      throw new Error(
        "ALBUKHR network isolation is not configured on albukhr_contributors. Add the network column before using this engine."
      );
    }

    if (result.error) {
      throw new Error(result.error.message || "Unable to load contributor.");
    }

    return result.data ? normalizeContributor(result.data) : null;
  }

  /* =========================================================
     ACCESS
  ========================================================= */
  async function checkInternalAccess(email = "") {
    const engine = getContributorEngine();
    const user = await getAuthenticatedUser();

    const authEmail = normalizeEmail(user?.email || "");
    const requestedEmail = normalizeEmail(email);
    const contributorEmail = authEmail || requestedEmail || getInternalSessionEmail();

    if (!contributorEmail) {
      return {
        ok: false, allowed: false, reason: "missing_session",
        contributor: null, access: null
      };
    }

    if (authEmail && requestedEmail && authEmail !== requestedEmail) {
      return {
        ok: false, allowed: false, reason: "authenticated_email_mismatch",
        contributor: null, access: null
      };
    }

    const access = await engine.getContributorAccess(contributorEmail);
    const contributor = normalizeContributor(access?.contributor || {});

    if (!contributor.email) {
      return {
        ok: false, allowed: false, reason: "contributor_not_found",
        contributor: null, access: access || null
      };
    }

    if (contributor.network && contributor.network !== getNetwork()) {
      return {
        ok: false, allowed: false, reason: "network_mismatch",
        contributor, access: access || null
      };
    }

    if (contributor.status !== "approved") {
      return {
        ok: false, allowed: false, reason: "not_approved",
        contributor, access: access || null
      };
    }

    if (!(access?.internal_unlocked || access?.has_internal_access)) {
      return {
        ok: false, allowed: false, reason: "internal_locked",
        contributor, access: access || null
      };
    }

    return {
      ok: true, allowed: true, reason: "",
      contributor, access: access || {}
    };
  }

  /* =========================================================
     ENTRY GATE
  ========================================================= */
  async function validateInternalEntryGate() {
    const user = await getAuthenticatedUser();
    const authEmail = normalizeEmail(user?.email || "");

    if (!authEmail) {
      return {
        ok: false, allowed: false, reason: "missing_internal_session",
        contributor: null, access: null
      };
    }

    const access = await checkInternalAccess(authEmail);

    if (!access.allowed) {
      return {
        ok: false, allowed: false,
        reason: access.reason || "access_denied",
        contributor: access.contributor || null,
        access: access.access || null
      };
    }

    await setInternalSession(authEmail);

    return {
      ok: true, allowed: true, reason: "",
      contributor: access.contributor,
      access: access.access || {},
      session: {
        email: authEmail,
        authenticated: true,
        network: getNetwork()
      }
    };
  }

  async function validateInternalEntry() {
    return validateInternalEntryGate();
  }

  /* =========================================================
     PROJECT READS
  ========================================================= */
  async function getLatestInternalProjectByEmail(email) {
    const supabase = getSupabaseClient();
    const contributorEmail = normalizeEmail(email);

    if (!contributorEmail) return null;

    let query = supabase
      .from("albukhr_internal_projects")
      .select("*")
      .ilike("creator_email", contributorEmail)
      .order("created_at", { ascending: false })
      .limit(1);

    query = addNetworkFilter(query);

    const { data, error } = await query.maybeSingle();

    if (error && isNetworkColumnError(error)) {
      throw new Error(
        "ALBUKHR network isolation is not configured on albukhr_internal_projects. Add the network column before using this engine."
      );
    }

    if (error) {
      throw new Error(
        error.message || "Unable to load contributor internal projects."
      );
    }

    return data ? normalizeInternalProjectRecord(data) : null;
  }

  /* =========================================================
     SUBMISSION LOCK
  ========================================================= */
  async function checkInternalSubmissionLock(email = "") {
    const contributorEmail =
      normalizeEmail(email) ||
      await getCurrentContributorEmail();

    if (!contributorEmail) {
      return {
        ok: false, locked: true,
        reason: "missing_email",
        message: "Authenticated contributor email not found."
      };
    }

    const latest = await getLatestInternalProjectByEmail(contributorEmail);

    if (!latest) {
      return { ok: true, locked: false, reason: "", message: "", project: null };
    }

    const status = safeString(latest.status).trim().toLowerCase();

    if (status === "internal_pending" || status === "pending") {
      return {
        ok: true, locked: true,
        reason: "internal_pending_exists",
        message: "Your previous internal project is still under review.",
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
        const unlockTime = approvedTime + (7 * 24 * 60 * 60 * 1000);

        if (Number.isFinite(unlockTime) && Date.now() < unlockTime) {
          return {
            ok: true, locked: true,
            reason: "approval_cooldown_active",
            unlock_at: new Date(unlockTime).toISOString(),
            message: "You can submit another internal project after the cooldown period.",
            project: latest
          };
        }
      }
    }

    return { ok: true, locked: false, reason: "", message: "", project: latest };
  }

  /* =========================================================
     VALIDATION
  ========================================================= */
  function validateInternalProjectPayload(payload = {}) {
    const errors = [];

    if (!trimOrNull(payload.projectName)) errors.push("Project name is required.");
    if (!trimOrNull(payload.category)) errors.push("Project category is required.");
    if (!trimOrNull(payload.stage)) errors.push("Project stage is required.");
    if (!trimOrNull(payload.creatorName)) errors.push("Creator name is required.");
    if (!trimOrNull(payload.creatorRole)) errors.push("Creator role is required.");
    if (!trimOrNull(payload.internalId)) errors.push("Albukhr Internal ID is required.");
    if (!normalizeEmail(payload.creatorEmail)) errors.push("Creator email is required.");
    if (!trimOrNull(payload.summary)) errors.push("Project summary is required.");
    if (!trimOrNull(payload.problem)) errors.push("Problem statement is required.");
    if (!trimOrNull(payload.solution)) errors.push("Solution is required.");

    if (payload.roi !== undefined && !Number.isFinite(Number(payload.roi))) {
      errors.push("ROI must be a valid number.");
    }

    if (payload.initialLiquidity !== undefined) {
      const liquidity = Number(payload.initialLiquidity);
      if (!Number.isFinite(liquidity)) errors.push("Initial liquidity must be a valid number.");
      if (liquidity < 0) errors.push("Initial liquidity cannot be negative.");
    }

    return {
      ok: errors.length === 0,
      errors,
      firstError: errors.length ? errors[0] : ""
    };
  }

  /* =========================================================
     SUBMIT
  ========================================================= */
  async function submitInternalProject(payload = {}) {
    const authUser = await getAuthenticatedUser();
    const authEmail = normalizeEmail(authUser?.email || "");

    if (!authEmail) {
      throw new Error("Authenticated contributor session is required.");
    }

    const requestedEmail = normalizeEmail(payload.creatorEmail);

    if (requestedEmail && requestedEmail !== authEmail) {
      throw new Error("Creator email must match the authenticated contributor.");
    }

    const access = await checkInternalAccess(authEmail);

    if (!access.allowed) {
      throw new Error(access.reason || "Internal registry access denied.");
    }

    const cleanPayload = {
      projectName: trimOrNull(payload.projectName),
      category: trimOrNull(payload.category),
      stage: trimOrNull(payload.stage),
      creatorName: trimOrNull(payload.creatorName),
      creatorRole: trimOrNull(payload.creatorRole),
      internalId: trimOrNull(payload.internalId),
      creatorEmail: authEmail,
      creatorPhone: trimOrNull(payload.creatorPhone),
      summary: trimOrNull(payload.summary),
      problem: trimOrNull(payload.problem),
      solution: trimOrNull(payload.solution),
      impact: trimOrNull(payload.impact),
      funding: trimOrNull(payload.funding),
      risk: trimOrNull(payload.risk),
      confidentiality: trimOrNull(payload.confidentiality),
      roi: safeNumber(payload.roi, 0),
      initialLiquidity: safeNumber(payload.initialLiquidity, 0)
    };

    const validation = validateInternalProjectPayload(cleanPayload);
    if (!validation.ok) throw new Error(validation.firstError);

    const lockState = await checkInternalSubmissionLock(authEmail);
    if (lockState.locked) throw new Error(lockState.message);

    const result = await callRpc("albukhr_submit_internal_project", {
      p_project_name: cleanPayload.projectName,
      p_category: cleanPayload.category,
      p_stage: cleanPayload.stage,
      p_creator_name: cleanPayload.creatorName,
      p_creator_role: cleanPayload.creatorRole,
      p_internal_id: cleanPayload.internalId,
      p_creator_email: cleanPayload.creatorEmail,
      p_creator_phone: cleanPayload.creatorPhone,
      p_summary: cleanPayload.summary,
      p_problem: cleanPayload.problem,
      p_solution: cleanPayload.solution,
      p_impact: cleanPayload.impact,
      p_funding: cleanPayload.funding,
      p_risk: cleanPayload.risk,
      p_confidentiality: cleanPayload.confidentiality,
      p_roi: cleanPayload.roi,
      p_initial_liquidity: cleanPayload.initialLiquidity
    });

    return {
      ok: true,
      message: result?.message || "Internal project submitted successfully.",
      project: normalizeInternalProjectRecord(result?.project || result || {})
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
    const user = await getAuthenticatedUser();

    return {
      email: normalizeEmail(user?.email || ""),
      name: safeString(user?.user_metadata?.full_name || user?.user_metadata?.name || "ALBUKHR Admin").trim(),
      role: safeString(user?.user_metadata?.role || "admin").trim(),
      network: getNetwork()
    };
  }

  async function adminListInternalProjects({ status = "", limit = 500 } = {}) {
    const supabase = getSupabaseClient();
    const normalizedStatus = status ? normalizeInternalStatus(status) : "";

    try {
      const result = await callRpc("albukhr_admin_list_internal_projects", {
        p_status: normalizedStatus || null,
        p_limit: safeNumber(limit, 500)
      });

      const rows = Array.isArray(result)
        ? result
        : Array.isArray(result?.projects)
          ? result.projects
          : [];

      return rows
        .filter(row => !row.network || row.network === getNetwork())
        .map(normalizeAdminInternalProject);
    } catch (err) {
      console.warn(
        "ALBUKHR admin list RPC unavailable; using network-filtered table read.",
        err
      );
    }

    let query = supabase
      .from("albukhr_internal_projects")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(safeNumber(limit, 500));

    query = addNetworkFilter(query);

    if (normalizedStatus) query = query.eq("status", normalizedStatus);

    const { data, error } = await query;

    if (error && isNetworkColumnError(error)) {
      throw new Error(
        "ALBUKHR network isolation is not configured on albukhr_internal_projects. Admin listing is blocked until the network column exists."
      );
    }

    if (error) throw new Error(error.message || "Unable to load internal projects.");

    return (Array.isArray(data) ? data : []).map(normalizeAdminInternalProject);
  }

  async function adminApproveInternalProject(input = {}) {
    let projectId = "";
    let approvedByEmail = "";
    let approvedByName = "";
    let approvedByRole = "";

    if (typeof input === "string") {
      projectId = input.trim();
    } else {
      projectId = safeString(input.projectId || input.id).trim();
      approvedByEmail = normalizeEmail(input.approvedBy || input.approvedByEmail || "");
      approvedByName = safeString(input.approvedByName).trim();
      approvedByRole = safeString(input.approvedByRole).trim();
    }

    if (!projectId) throw new Error("Internal project ID is required.");

    const actor = await getInternalAdminMeta();
    approvedByEmail = approvedByEmail || actor.email;
    approvedByName = approvedByName || actor.name || "ALBUKHR Admin";
    approvedByRole = approvedByRole || actor.role || "admin";

    const result = await callRpc("albukhr_admin_approve_internal_project", {
      p_project_id: projectId,
      p_approved_by_email: approvedByEmail,
      p_approved_by_name: approvedByName,
      p_approved_by_role: approvedByRole
    });

    return {
      ok: true,
      project: normalizeAdminInternalProject(result?.project || result || {})
    };
  }

  async function adminRejectInternalProject(input = {}) {
    let projectId = "";
    let reason = "";
    let rejectedByEmail = "";
    let rejectedByName = "";
    let rejectedByRole = "";

    if (typeof input === "string") {
      projectId = input.trim();
    } else {
      projectId = safeString(input.projectId || input.id).trim();
      reason = safeString(input.reason).trim();
      rejectedByEmail = normalizeEmail(input.rejectedBy || input.rejectedByEmail || "");
      rejectedByName = safeString(input.rejectedByName).trim();
      rejectedByRole = safeString(input.rejectedByRole).trim();
    }

    if (!projectId) throw new Error("Internal project ID is required.");

    const actor = await getInternalAdminMeta();
    rejectedByEmail = rejectedByEmail || actor.email;
    rejectedByName = rejectedByName || actor.name || "ALBUKHR Admin";
    rejectedByRole = rejectedByRole || actor.role || "admin";

    const result = await callRpc("albukhr_admin_reject_internal_project", {
      p_project_id: projectId,
      p_rejected_by_email: rejectedByEmail,
      p_rejected_by_name: rejectedByName,
      p_rejected_by_role: rejectedByRole,
      p_reason: reason || null
    });

    return {
      ok: true,
      project: normalizeAdminInternalProject(result?.project || result || {})
    };
  }

  /* =========================================================
     UI / FORM HELPERS
  ========================================================= */
  function disableButton(button, text = "Please wait...") {
    if (!button) return;
    if (!button.dataset.originalText) button.dataset.originalText = button.innerHTML;
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
    if (button.dataset.originalText) button.innerHTML = button.dataset.originalText;
  }

  function fillContributorFieldsIfNeeded(contributor = {}, fields = {}) {
    if (!contributor || !fields) return contributor;

    const mapping = {
      creatorName: contributor.full_name || contributor.creator_name || "",
      internalId: contributor.albukhr_id || contributor.internal_id || "",
      email: contributor.email || contributor.creator_email || "",
      phone: contributor.phone || contributor.creator_phone || ""
    };

    Object.keys(mapping).forEach(key => {
      const element = fields[key];
      if (!element || typeof element.value === "undefined") return;
      if (!safeString(element.value).trim()) element.value = safeString(mapping[key]);
    });

    return contributor;
  }

  async function bootstrapInternalRegistryPage() {
    const gate = await validateInternalEntryGate();

    if (!gate.allowed) {
      return {
        allowed: false,
        reason: gate.reason || "access_denied",
        contributor: null,
        lock: null,
        access: gate.access || null,
        session: gate.session || null,
        network: getNetwork()
      };
    }

    const contributor = gate.contributor || {};
    let lock = { ok: true, locked: false, reason: "" };

    try {
      lock = await checkInternalSubmissionLock(contributor.email);
    } catch (err) {
      console.warn(ENGINE_NAME + ": Unable to determine submission lock.", err);
    }

    return {
      allowed: true,
      reason: "",
      contributor,
      access: gate.access || {},
      session: gate.session || {},
      lock,
      network: getNetwork()
    };
  }

  function redirectToContributorPage() {
    window.location.href = "submit-albukhrecosystem-form.html";
  }

  function clearInternalRegistrySession() {
    clearInternalSession();
  }

  /* =========================================================
     PUBLIC API
  ========================================================= */
  InternalRegistryEngine.VERSION = VERSION;
  InternalRegistryEngine.BUILD = BUILD;
  InternalRegistryEngine.ENGINE_NAME = ENGINE_NAME;

  InternalRegistryEngine.getNetwork = getNetwork;
  InternalRegistryEngine.getNetworkConfig = getNetworkConfig;
  InternalRegistryEngine.getSupabaseClient = getSupabaseClient;
  InternalRegistryEngine.getAuthenticatedUser = getAuthenticatedUser;

  InternalRegistryEngine.setInternalSession = setInternalSession;
  InternalRegistryEngine.clearInternalSession = clearInternalSession;
  InternalRegistryEngine.getInternalSessionEmail = getInternalSessionEmail;
  InternalRegistryEngine.getCurrentContributorEmail = getCurrentContributorEmail;
  InternalRegistryEngine.hasInternalSession = hasInternalSession;
  InternalRegistryEngine.getInternalSession = getInternalSession;

  InternalRegistryEngine.findContributorByEmail = findContributorByEmail;
  InternalRegistryEngine.checkInternalAccess = checkInternalAccess;
  InternalRegistryEngine.validateInternalEntryGate = validateInternalEntryGate;
  InternalRegistryEngine.validateInternalEntry = validateInternalEntry;

  InternalRegistryEngine.getLatestInternalProjectByEmail = getLatestInternalProjectByEmail;
  InternalRegistryEngine.checkInternalSubmissionLock = checkInternalSubmissionLock;
  InternalRegistryEngine.validateInternalProjectPayload = validateInternalProjectPayload;

  InternalRegistryEngine.submitInternalProject = submitInternalProject;
  InternalRegistryEngine.submitInternalProjectFromForm = submitInternalProjectFromForm;
  InternalRegistryEngine.bootstrapInternalRegistryPage = bootstrapInternalRegistryPage;

  InternalRegistryEngine.fillContributorFieldsIfNeeded = fillContributorFieldsIfNeeded;
  InternalRegistryEngine.disableButton = disableButton;
  InternalRegistryEngine.enableButton = enableButton;

  InternalRegistryEngine.getInternalAdminMeta = getInternalAdminMeta;
  InternalRegistryEngine.adminListInternalProjects = adminListInternalProjects;
  InternalRegistryEngine.adminApproveInternalProject = adminApproveInternalProject;
  InternalRegistryEngine.adminRejectInternalProject = adminRejectInternalProject;

  InternalRegistryEngine.redirectToContributorPage = redirectToContributorPage;
  InternalRegistryEngine.clearInternalRegistrySession = clearInternalRegistrySession;

  /* =========================================================
     LEGACY GLOBAL WRAPPERS
     Kept for compatibility, but all security decisions are
     now based on Supabase Auth + Supabase contributor access.
  ========================================================= */
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

  try {
    Object.freeze(InternalRegistryEngine);
  } catch (err) {
    console.warn("Unable to freeze InternalRegistryEngine.", err);
  }

  console.info(
    "%cALBUKHR Internal Registry Engine Ready",
    "color:#0f7a3d;font-weight:bold"
  );
  console.info({
    version: VERSION,
    build: BUILD,
    network: getNetwork()
  });
})();
