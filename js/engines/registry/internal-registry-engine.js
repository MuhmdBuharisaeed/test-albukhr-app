/* =========================================================
   ALBUKHR INTERNAL REGISTRY ENGINE
   ARCHITECTURE-ALIGNED PRODUCTION VERSION
   ---------------------------------------------------------
   Responsibility:
   - Internal contributor access
   - Internal project submission
   - Submission cooldown/lock
   - Admin project listing / approval / rejection
   - Supabase source-of-truth integration
   - Mainnet/Testnet network isolation
   - Backward-compatible public API where safe

   Architecture location:
   js/engines/registry/internal-registry-engine.js

   Required before this engine:
   1. js/supabase-core.js
   2. js/environment-switcher.js
   3. contributor-engine.js (where contributor access is required)

   IMPORTANT:
   - No LocalStorage is used.
   - No fake client-side authentication token is generated.
   - Network is resolved from the authoritative ALBUKHR hostname.
   - Supabase remains the source of truth.
========================================================= */

(function () {
  "use strict";

  if (window.__ALBUKHR_INTERNAL_REGISTRY_ENGINE_LOADED__) {
    console.warn("ALBUKHR Internal Registry Engine already loaded.");
    return;
  }

  window.__ALBUKHR_INTERNAL_REGISTRY_ENGINE_LOADED__ = true;

  const ENGINE_NAME = "ALBUKHR Internal Registry Engine";
  const VERSION = "2.0.0";
  const BUILD = "SUPABASE-NETWORK-ISOLATED";

  const InternalRegistryEngine = {};
  window.AlbukhrInternalRegistryEngine = InternalRegistryEngine;

  /* =========================================================
     CORE RESOLVERS
  ========================================================= */

  function getNetwork() {
    if (typeof window.requireAlbukhrNetwork === "function") {
      return window.requireAlbukhrNetwork();
    }

    if (typeof window.getAlbukhrNetwork === "function") {
      return window.getAlbukhrNetwork();
    }

    throw new Error(
      ENGINE_NAME + ": environment-switcher.js must be loaded first."
    );
  }

  function getSupabaseClient() {
    if (
      window.albukhrSupabase &&
      typeof window.albukhrSupabase.from === "function"
    ) {
      return window.albukhrSupabase;
    }

    if (typeof window.getAlbukhrSupabaseClient === "function") {
      const client = window.getAlbukhrSupabaseClient();
      if (client && typeof client.from === "function") return client;
    }

    if (
      window.supabaseClient &&
      typeof window.supabaseClient.from === "function"
    ) {
      return window.supabaseClient;
    }

    throw new Error("ALBUKHR: Supabase client not initialized.");
  }

  function getContributorEngine() {
    if (!window.AlbukhrContributorEngine) {
      throw new Error(
        ENGINE_NAME + ": contributor-engine.js must be loaded first."
      );
    }
    return window.AlbukhrContributorEngine;
  }

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
    const valueString = safeString(value).trim();
    return valueString ? valueString : null;
  }

  function normalizeEmail(value) {
    return safeString(value).trim().toLowerCase();
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function getCurrentUserEmailFromSupabase() {
    const supabase = getSupabaseClient();

    if (
      !supabase.auth ||
      typeof supabase.auth.getUser !== "function"
    ) {
      return "";
    }

    return supabase.auth.getUser()
      .then(({ data, error }) => {
        if (error) return "";
        return normalizeEmail(data?.user?.email || "");
      });
  }

  /* =========================================================
     EPHEMERAL INTERNAL SESSION
     ---------------------------------------------------------
     This is deliberately NOT an authentication mechanism.
     Supabase Auth + contributor access is authoritative.
     The session object is memory-only and disappears on reload.
  ========================================================= */

  let internalSession = Object.freeze({
    email: "",
    token: ""
  });

  function setInternalSession(email) {
    const cleanEmail = normalizeEmail(email);

    internalSession = Object.freeze({
      email: cleanEmail,
      token: cleanEmail
        ? "supabase-auth"
        : ""
    });

    return getInternalSession();
  }

  function clearInternalSession() {
    internalSession = Object.freeze({
      email: "",
      token: ""
    });
  }

  function getInternalSessionEmail() {
    return internalSession.email;
  }

  function getInternalSessionToken() {
    return internalSession.token;
  }

  function hasInternalSession() {
    return !!internalSession.email;
  }

  function getInternalSession() {
    return {
      email: internalSession.email,
      token: internalSession.token
    };
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
      project_creation_unlocked: safeBool(raw.project_creation_unlocked)
    };
  }

  function normalizeInternalProjectRecord(raw = {}) {
    return {
      id: raw.id || null,
      network: raw.network || getNetwork(),
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
      initial_liquidity: safeNumber(
        raw.initial_liquidity ?? raw.liquidity,
        0
      ),
      status: raw.status || "internal_pending",
      project_approved: raw.project_approved ?? null,
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
      rejection_reason:
        raw.rejection_reason ||
        raw.review_reason ||
        raw.review_note ||
        ""
    };
  }

  function normalizeAdminInternalProject(raw = {}) {
    return normalizeInternalProjectRecord(raw);
  }

  function normalizeInternalStatus(status) {
    const s = safeString(status).trim().toLowerCase();

    switch (s) {
      case "pending":
        return "internal_pending";
      case "approved":
        return "internal_approved";
      case "rejected":
        return "internal_rejected";
      default:
        return s || "internal_pending";
    }
  }

  /* =========================================================
     NETWORK-SAFE QUERY HELPERS
     ---------------------------------------------------------
     All direct table reads/writes are scoped to the current
     ALBUKHR network. This prevents mainnet/testnet crossover.
  ========================================================= */

  function applyNetworkFilter(query) {
    return query.eq("network", getNetwork());
  }

  function addNetworkPayload(payload = {}) {
    return {
      ...payload,
      p_network: getNetwork()
    };
  }

  /* =========================================================
     RPC
     ---------------------------------------------------------
     RPCs are expected to accept p_network in the new schema.
     No silent cross-network fallback is permitted.
  ========================================================= */

  async function callRpc(fnName, payload = {}) {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.rpc(
      fnName,
      addNetworkPayload(payload)
    );

    if (error) {
      throw new Error(
        error.message || ("RPC failed: " + fnName)
      );
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

    /*
      Contributor registry is network-aware in the new architecture.
      If the table has a network column, the filter is mandatory.
    */
    query = applyNetworkFilter(query);

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new Error(
        error.message || "Unable to load contributor."
      );
    }

    return data ? normalizeContributor(data) : null;
  }

  /* =========================================================
     ACCESS CHECK
  ========================================================= */

  async function checkInternalAccess(email = "") {
    const engine = getContributorEngine();

    let contributorEmail = normalizeEmail(email);

    if (!contributorEmail) {
      contributorEmail = getInternalSessionEmail();
    }

    if (!contributorEmail) {
      contributorEmail = await getCurrentUserEmailFromSupabase();
    }

    if (!contributorEmail) {
      return {
        ok: false,
        allowed: false,
        reason: "missing_supabase_session",
        contributor: null,
        access: null
      };
    }

    const access = await engine.getContributorAccess(contributorEmail);
    const contributor = normalizeContributor(access?.contributor || {});

    if (!contributor.email) {
      return {
        ok: false,
        allowed: false,
        reason: "contributor_not_found",
        contributor: null,
        access: access || null
      };
    }

    if (contributor.status !== "approved") {
      return {
        ok: false,
        allowed: false,
        reason: "not_approved",
        contributor,
        access: access || null
      };
    }

    if (
      !(
        access?.internal_unlocked ||
        access?.has_internal_access
      )
    ) {
      return {
        ok: false,
        allowed: false,
        reason: "internal_locked",
        contributor,
        access: access || null
      };
    }

    return {
      ok: true,
      allowed: true,
      reason: "",
      contributor,
      access: access || {}
    };
  }

  /* =========================================================
     ENTRY GATE
  ========================================================= */

  async function validateInternalEntryGate() {
    const access = await checkInternalAccess();

    if (!access.allowed) {
      clearInternalSession();

      return {
        ok: false,
        allowed: false,
        reason: access.reason || "access_denied",
        contributor: access.contributor || null,
        access: access.access || null
      };
    }

    setInternalSession(access.contributor.email);

    return {
      ok: true,
      allowed: true,
      reason: "",
      contributor: access.contributor,
      access: access.access || {},
      session: getInternalSession()
    };
  }

  async function validateInternalEntry() {
    return validateInternalEntryGate();
  }

  /* =========================================================
     LATEST INTERNAL PROJECT
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

    query = applyNetworkFilter(query);

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new Error(
        error.message ||
        "Unable to load contributor internal projects."
      );
    }

    return data ? normalizeInternalProjectRecord(data) : null;
  }

  /* =========================================================
     SUBMISSION LOCK
  ========================================================= */

  async function checkInternalSubmissionLock(email = "") {
    let contributorEmail = normalizeEmail(email);

    if (!contributorEmail) {
      contributorEmail = getInternalSessionEmail();
    }

    if (!contributorEmail) {
      contributorEmail = await getCurrentUserEmailFromSupabase();
    }

    if (!contributorEmail) {
      return {
        ok: false,
        locked: true,
        reason: "missing_email",
        message: "Contributor email not found."
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

    const status = safeString(latest.status).trim().toLowerCase();

    if (
      status === "internal_pending" ||
      status === "pending"
    ) {
      return {
        ok: true,
        locked: true,
        reason: "internal_pending_exists",
        message:
          "Your previous internal project is still under review.",
        project: latest
      };
    }

    if (
      status === "internal_approved" ||
      status === "approved"
    ) {
      const approvedDate =
        latest.approved_at ||
        latest.reviewed_at ||
        latest.updated_at ||
        latest.created_at;

      if (approvedDate) {
        const approvedTime = new Date(approvedDate).getTime();
        const unlockTime =
          approvedTime + (7 * 24 * 60 * 60 * 1000);

        if (
          Number.isFinite(unlockTime) &&
          Date.now() < unlockTime
        ) {
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
     PROJECT VALIDATION
  ========================================================= */

  function validateInternalProjectPayload(payload = {}) {
    const errors = [];

    if (!trimOrNull(payload.projectName))
      errors.push("Project name is required.");

    if (!trimOrNull(payload.category))
      errors.push("Project category is required.");

    if (!trimOrNull(payload.stage))
      errors.push("Project stage is required.");

    if (!trimOrNull(payload.creatorName))
      errors.push("Creator name is required.");

    if (!trimOrNull(payload.creatorRole))
      errors.push("Creator role is required.");

    if (!trimOrNull(payload.internalId))
      errors.push("Albukhr Internal ID is required.");

    if (!normalizeEmail(payload.creatorEmail))
      errors.push("Creator email is required.");

    if (!trimOrNull(payload.summary))
      errors.push("Project summary is required.");

    if (!trimOrNull(payload.problem))
      errors.push("Problem statement is required.");

    if (!trimOrNull(payload.solution))
      errors.push("Solution is required.");

    if (payload.roi !== undefined) {
      const roi = Number(payload.roi);
      if (!Number.isFinite(roi))
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
      firstError: errors.length ? errors[0] : ""
    };
  }

  /* =========================================================
     SUBMIT INTERNAL PROJECT
  ========================================================= */

  async function submitInternalProject(payload = {}) {
    const access =
      await checkInternalAccess(payload.creatorEmail);

    if (!access.allowed) {
      throw new Error(
        access.reason || "Internal registry access denied."
      );
    }

    const cleanPayload = {
      projectName: trimOrNull(payload.projectName),
      category: trimOrNull(payload.category),
      stage: trimOrNull(payload.stage),
      creatorName: trimOrNull(payload.creatorName),
      creatorRole: trimOrNull(payload.creatorRole),
      internalId: trimOrNull(payload.internalId),
      creatorEmail: normalizeEmail(
        payload.creatorEmail || access.contributor.email
      ),
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

    const validation =
      validateInternalProjectPayload(cleanPayload);

    if (!validation.ok) {
      throw new Error(validation.firstError);
    }

    const lockState =
      await checkInternalSubmissionLock(
        cleanPayload.creatorEmail
      );

    if (lockState.locked) {
      throw new Error(lockState.message);
    }

    const result = await callRpc(
      "albukhr_submit_internal_project",
      {
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
      }
    );

    return {
      ok: true,
      message:
        result?.message ||
        "Internal project submitted successfully.",
      project: normalizeInternalProjectRecord(
        result?.project || result || {}
      )
    };
  }

  /* =========================================================
     FORM HELPER
  ========================================================= */

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
     ADMIN ACTOR
     ---------------------------------------------------------
     No LocalStorage. Admin identity must come from Supabase
     Auth or an explicitly supplied actor.
  ========================================================= */

  async function getInternalAdminMeta(input = {}) {
    const supplied = input || {};

    let email = normalizeEmail(
      supplied.email ||
      supplied.approvedByEmail ||
      supplied.rejectedByEmail ||
      ""
    );

    if (!email) {
      email = await getCurrentUserEmailFromSupabase();
    }

    return {
      email,
      name:
        safeString(
          supplied.name ||
          supplied.approvedByName ||
          supplied.rejectedByName ||
          "ALBUKHR Admin"
        ).trim(),
      role:
        safeString(
          supplied.role ||
          supplied.approvedByRole ||
          supplied.rejectedByRole ||
          "admin"
        ).trim()
    };
  }

  /* =========================================================
     ADMIN LIST
  ========================================================= */

  async function adminListInternalProjects({
    status = "",
    limit = 500
  } = {}) {
    const normalizedStatus =
      status ? normalizeInternalStatus(status) : "";

    try {
      const result = await callRpc(
        "albukhr_admin_list_internal_projects",
        {
          p_status: normalizedStatus || null,
          p_limit: safeNumber(limit, 500)
        }
      );

      const rows =
        Array.isArray(result)
          ? result
          : Array.isArray(result?.projects)
            ? result.projects
            : [];

      return rows.map(normalizeAdminInternalProject);
    } catch (err) {
      console.warn(
        "Admin list RPC unavailable; using network-scoped table read.",
        err
      );
    }

    const supabase = getSupabaseClient();

    let query = supabase
      .from("albukhr_internal_projects")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(safeNumber(limit, 500));

    query = applyNetworkFilter(query);

    if (normalizedStatus) {
      query = query.eq("status", normalizedStatus);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(
        error.message || "Unable to load internal projects."
      );
    }

    return (Array.isArray(data) ? data : [])
      .map(normalizeAdminInternalProject);
  }

  /* =========================================================
     ADMIN APPROVE
  ========================================================= */

  async function adminApproveInternalProject(input = {}) {
    let projectId = "";
    let approvedByEmail = "";
    let approvedByName = "";
    let approvedByRole = "";

    if (typeof input === "string") {
      projectId = input.trim();
    } else {
      projectId = safeString(
        input.projectId || input.id
      ).trim();

      approvedByEmail = normalizeEmail(
        input.approvedBy ||
        input.approvedByEmail ||
        ""
      );

      approvedByName = safeString(
        input.approvedByName
      ).trim();

      approvedByRole = safeString(
        input.approvedByRole
      ).trim();
    }

    if (!projectId) {
      throw new Error("Internal project ID is required.");
    }

    const actor = await getInternalAdminMeta({
      email: approvedByEmail,
      name: approvedByName,
      role: approvedByRole
    });

    approvedByEmail = actor.email;
    approvedByName = actor.name;
    approvedByRole = actor.role;

    try {
      const result = await callRpc(
        "albukhr_admin_approve_internal_project",
        {
          p_project_id: projectId,
          p_approved_by_email: approvedByEmail,
          p_approved_by_name: approvedByName,
          p_approved_by_role: approvedByRole
        }
      );

      return {
        ok: true,
        project: normalizeAdminInternalProject(
          result?.project || result || {}
        )
      };
    } catch (err) {
      console.warn(
        "RPC approve unavailable; using network-scoped direct update.",
        err
      );
    }

    const supabase = getSupabaseClient();
    const now = nowIso();

    let query = supabase
      .from("albukhr_internal_projects")
      .update({
        status: "internal_approved",
        approved_at: now,
        reviewed_at: now,
        updated_at: now,
        approved_by_email: approvedByEmail,
        approved_by_name: approvedByName,
        reviewed_by_email: approvedByEmail,
        reviewed_by_name: approvedByName,
        rejected_at: null,
        rejected_by_email: null,
        rejected_by_name: null,
        rejection_reason: null
      })
      .eq("id", projectId);

    query = applyNetworkFilter(query);

    const { data, error } = await query
      .select()
      .single();

    if (error) {
      throw new Error(
        error.message ||
        "Failed to approve internal project."
      );
    }

    return {
      ok: true,
      project: normalizeAdminInternalProject(data)
    };
  }

  /* =========================================================
     ADMIN REJECT
  ========================================================= */

  async function adminRejectInternalProject(input = {}) {
    let projectId = "";
    let reason = "";
    let rejectedByEmail = "";
    let rejectedByName = "";
    let rejectedByRole = "";

    if (typeof input === "string") {
      projectId = input.trim();
    } else {
      projectId = safeString(
        input.projectId || input.id
      ).trim();

      reason = safeString(input.reason).trim();

      rejectedByEmail = normalizeEmail(
        input.rejectedBy ||
        input.rejectedByEmail ||
        ""
      );

      rejectedByName = safeString(
        input.rejectedByName
      ).trim();

      rejectedByRole = safeString(
        input.rejectedByRole
      ).trim();
    }

    if (!projectId) {
      throw new Error("Internal project ID is required.");
    }

    const actor = await getInternalAdminMeta({
      email: rejectedByEmail,
      name: rejectedByName,
      role: rejectedByRole
    });

    rejectedByEmail = actor.email;
    rejectedByName = actor.name;
    rejectedByRole = actor.role;

    try {
      const result = await callRpc(
        "albukhr_admin_reject_internal_project",
        {
          p_project_id: projectId,
          p_rejected_by_email: rejectedByEmail,
          p_rejected_by_name: rejectedByName,
          p_rejected_by_role: rejectedByRole,
          p_reason: reason || null
        }
      );

      return {
        ok: true,
        project: normalizeAdminInternalProject(
          result?.project || result || {}
        )
      };
    } catch (err) {
      console.warn(
        "RPC reject unavailable; using network-scoped direct update.",
        err
      );
    }

    const supabase = getSupabaseClient();
    const now = nowIso();

    let query = supabase
      .from("albukhr_internal_projects")
      .update({
        status: "internal_rejected",
        rejected_at: now,
        reviewed_at: now,
        updated_at: now,
        rejected_by_email: rejectedByEmail,
        rejected_by_name: rejectedByName,
        reviewed_by_email: rejectedByEmail,
        reviewed_by_name: rejectedByName,
        rejection_reason: reason || null,
        approved_at: null,
        approved_by_email: null,
        approved_by_name: null
      })
      .eq("id", projectId);

    query = applyNetworkFilter(query);

    const { data, error } = await query
      .select()
      .single();

    if (error) {
      throw new Error(
        error.message ||
        "Failed to reject internal project."
      );
    }

    return {
      ok: true,
      project: normalizeAdminInternalProject(data)
    };
  }

  /* =========================================================
     UI-SAFE BUTTON HELPERS
     ---------------------------------------------------------
     Kept only as small compatibility helpers. Page-specific
     rendering/navigation remains outside this engine.
  ========================================================= */

  function disableButton(button, text = "Please wait...") {
    if (!button) return;

    if (!button.dataset.originalText) {
      button.dataset.originalText = button.innerHTML;
    }

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

    if (button.dataset.originalText) {
      button.innerHTML = button.dataset.originalText;
    }
  }

  function fillContributorFieldsIfNeeded(
    contributor = {},
    fields = {}
  ) {
    if (!contributor || !fields) return contributor;

    const mapping = {
      creatorName:
        contributor.full_name ||
        contributor.creator_name ||
        "",
      internalId:
        contributor.albukhr_id ||
        contributor.internal_id ||
        "",
      email:
        contributor.email ||
        contributor.creator_email ||
        "",
      phone:
        contributor.phone ||
        contributor.creator_phone ||
        ""
    };

    Object.keys(mapping).forEach((key) => {
      const element = fields[key];

      if (
        !element ||
        typeof element.value === "undefined"
      ) {
        return;
      }

      if (!safeString(element.value).trim()) {
        element.value = safeString(mapping[key]);
      }
    });

    return contributor;
  }

  /* =========================================================
     PAGE BOOTSTRAP
  ========================================================= */

  async function bootstrapInternalRegistryPage() {
    const gate = await validateInternalEntryGate();

    if (!gate.allowed) {
      return {
        allowed: false,
        reason: gate.reason || "access_denied",
        contributor: gate.contributor || null,
        lock: null,
        access: gate.access || null,
        session: gate.session || null
      };
    }

    const contributor = gate.contributor || {};

    let lock = {
      ok: true,
      locked: false,
      reason: ""
    };

    try {
      lock = await checkInternalSubmissionLock(
        contributor.email
      );
    } catch (err) {
      console.warn(
        ENGINE_NAME +
        ": Unable to determine submission lock.",
        err
      );
    }

    return {
      allowed: true,
      reason: "",
      contributor,
      access: gate.access || {},
      session: gate.session || {},
      lock
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
     PUBLIC API
  ========================================================= */

  InternalRegistryEngine.VERSION = VERSION;
  InternalRegistryEngine.BUILD = BUILD;
  InternalRegistryEngine.ENGINE_NAME = ENGINE_NAME;

  InternalRegistryEngine.getNetwork = getNetwork;
  InternalRegistryEngine.getSupabaseClient = getSupabaseClient;

  InternalRegistryEngine.setInternalSession = setInternalSession;
  InternalRegistryEngine.clearInternalSession = clearInternalSession;
  InternalRegistryEngine.getInternalSessionEmail =
    getInternalSessionEmail;
  InternalRegistryEngine.getInternalSessionToken =
    getInternalSessionToken;
  InternalRegistryEngine.hasInternalSession =
    hasInternalSession;
  InternalRegistryEngine.getInternalSession =
    getInternalSession;

  InternalRegistryEngine.findContributorByEmail =
    findContributorByEmail;
  InternalRegistryEngine.checkInternalAccess =
    checkInternalAccess;
  InternalRegistryEngine.validateInternalEntryGate =
    validateInternalEntryGate;
  InternalRegistryEngine.validateInternalEntry =
    validateInternalEntry;

  InternalRegistryEngine.getLatestInternalProjectByEmail =
    getLatestInternalProjectByEmail;
  InternalRegistryEngine.checkInternalSubmissionLock =
    checkInternalSubmissionLock;
  InternalRegistryEngine.validateInternalProjectPayload =
    validateInternalProjectPayload;

  InternalRegistryEngine.submitInternalProject =
    submitInternalProject;
  InternalRegistryEngine.submitInternalProjectFromForm =
    submitInternalProjectFromForm;

  InternalRegistryEngine.bootstrapInternalRegistryPage =
    bootstrapInternalRegistryPage;

  InternalRegistryEngine.fillContributorFieldsIfNeeded =
    fillContributorFieldsIfNeeded;

  InternalRegistryEngine.disableButton = disableButton;
  InternalRegistryEngine.enableButton = enableButton;

  InternalRegistryEngine.getInternalAdminMeta =
    getInternalAdminMeta;
  InternalRegistryEngine.adminListInternalProjects =
    adminListInternalProjects;
  InternalRegistryEngine.adminApproveInternalProject =
    adminApproveInternalProject;
  InternalRegistryEngine.adminRejectInternalProject =
    adminRejectInternalProject;

  InternalRegistryEngine.redirectToContributorPage =
    redirectToContributorPage;
  InternalRegistryEngine.clearInternalRegistrySession =
    clearInternalRegistrySession;

  /* =========================================================
     LEGACY GLOBAL WRAPPERS
     ---------------------------------------------------------
     Names are preserved where harmless so existing pages do
     not break during migration.
  ========================================================= */

  window.setInternalSession = setInternalSession;
  window.clearInternalSession = clearInternalSession;
  window.getInternalSessionEmail = getInternalSessionEmail;
  window.getInternalSessionToken = getInternalSessionToken;
  window.hasInternalSession = hasInternalSession;
  window.getInternalSession = getInternalSession;
  window.findContributorByEmail = findContributorByEmail;
  window.checkInternalAccess = checkInternalAccess;
  window.validateInternalEntryGate = validateInternalEntryGate;
  window.validateInternalEntry = validateInternalEntry;
  window.checkInternalSubmissionLock = checkInternalSubmissionLock;
  window.getLatestInternalProjectByEmail =
    getLatestInternalProjectByEmail;
  window.submitInternalProject = submitInternalProject;
  window.submitInternalProjectFromForm =
    submitInternalProjectFromForm;
  window.validateInternalProjectPayload =
    validateInternalProjectPayload;
  window.bootstrapInternalRegistryPage =
    bootstrapInternalRegistryPage;
  window.fillContributorFieldsIfNeeded =
    fillContributorFieldsIfNeeded;
  window.disableInternalButton = disableButton;
  window.enableInternalButton = enableButton;
  window.getInternalAdminMeta = getInternalAdminMeta;
  window.adminListInternalProjects =
    adminListInternalProjects;
  window.adminApproveInternalProject =
    adminApproveInternalProject;
  window.adminRejectInternalProject =
    adminRejectInternalProject;
  window.redirectToContributorPage =
    redirectToContributorPage;
  window.clearInternalRegistrySession =
    clearInternalRegistrySession;

  try {
    Object.freeze(InternalRegistryEngine);
  } catch (err) {
    console.warn(
      "Unable to freeze InternalRegistryEngine.",
      err
    );
  }

  console.info(
    "%cALBUKHR Internal Registry Engine Ready",
    "color:#0f7a3d;font-weight:bold"
  );

  console.info({
    version: VERSION,
    build: BUILD,
    network: (() => {
      try {
        return getNetwork();
      } catch (_) {
        return "unresolved";
      }
    })()
  });
})();
