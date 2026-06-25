/* =========================================================
   ALBUKHR INTERNAL REGISTRY ENGINE
   FINAL SUPABASE VERSION
   ---------------------------------------------------------
   PURPOSE
   - Resolve internal registry access from contributor account
   - Validate internal registry session token
   - Submit internal project to Supabase RPC
   - Check contributor lock state before submit
   - Expose helper methods for internal-registry-form.html
   ---------------------------------------------------------
   EXPECTED BACKEND
   - public.albukhr_submit_internal_project(...)
   - public.albukhr_contributors
   - public.albukhr_internal_projects
   ---------------------------------------------------------
   EXPECTED FRONTEND
   - js/supabase-core.js
   - js/contributor-engine.js
========================================================= */

(function(){
  "use strict";

  /* =========================================================
     GLOBAL EXPORT
  ========================================================= */
  const InternalRegistryEngine = {};
  window.AlbukhrInternalRegistryEngine = InternalRegistryEngine;

  /* =========================================================
     CONFIG
  ========================================================= */
  const ENGINE_NAME = "ALBUKHR Internal Registry Engine";

  const SESSION_KEYS = {
    contributorEmail: "albukhr_current_email",
    internalEmail: "albukhr_internal_email",
    internalToken: "albukhr_internal_token"
  };

  /* =========================================================
     CORE HELPERS
  ========================================================= */
  function getSupabaseClient(){
    const client =
      window.supabaseClient ||
      window.supabase ||
      window.albukhrSupabase ||
      null;

    if(!client){
      throw new Error(
        `${ENGINE_NAME}: Supabase client not found. Load js/supabase-core.js first.`
      );
    }

    return client;
  }

  function getContributorEngine(){
    return window.AlbukhrContributorEngine || null;
  }

  function safeString(value, fallback = ""){
    if(value === null || value === undefined) return fallback;
    return String(value);
  }

  function safeNumber(value, fallback = 0){
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function safeBool(value){
    return value === true;
  }

  function trimOrNull(value){
    const v = safeString(value).trim();
    return v ? v : null;
  }

  function normalizeEmail(value){
    return safeString(value).trim().toLowerCase();
  }

  function nowIso(){
    return new Date().toISOString();
  }

  function getCurrentContributorEmail(){
    return normalizeEmail(
      localStorage.getItem(SESSION_KEYS.contributorEmail) || ""
    );
  }

  function getInternalSessionEmail(){
    return normalizeEmail(
      sessionStorage.getItem(SESSION_KEYS.internalEmail) || ""
    );
  }

  function getInternalSessionToken(){
    return safeString(
      sessionStorage.getItem(SESSION_KEYS.internalToken) || ""
    ).trim();
  }

  function clearInternalSession(){
    sessionStorage.removeItem(SESSION_KEYS.internalEmail);
    sessionStorage.removeItem(SESSION_KEYS.internalToken);
  }

  function setInternalSession(email){
    if(email){
      sessionStorage.setItem(
        SESSION_KEYS.internalEmail,
        normalizeEmail(email)
      );
    }
    sessionStorage.setItem(
      SESSION_KEYS.internalToken,
      `INT-${Date.now()}-${Math.random().toString(36).slice(2,10)}`
    );
  }

  function ensureContributorEngineLoaded(){
    const engine = getContributorEngine();
    if(!engine){
      throw new Error(
        `${ENGINE_NAME}: contributor-engine.js not loaded`
      );
    }
    return engine;
  }

  /* =========================================================
     NORMALIZERS
  ========================================================= */
  function normalizeContributor(raw = {}){
    return {
      id: raw.id || null,
      full_name: raw.full_name || raw.fullName || "",
      email: normalizeEmail(raw.email || ""),
      status: safeString(raw.status || "").trim().toLowerCase(),
      albukhr_id: raw.albukhr_id || raw.albukhrId || "",
      internal_unlocked:
        safeBool(raw.internal_unlocked) ||
        safeBool(raw.internalUnlocked),
      telegram_unlocked:
        safeBool(raw.telegram_unlocked) ||
        safeBool(raw.telegramUnlocked),
      project_creation_unlocked:
        safeBool(raw.project_creation_unlocked) ||
        safeBool(raw.projectCreationUnlocked)
    };
  }

  function normalizeInternalProject(raw = {}){
    return {
      id: raw.id || null,
      project_name: raw.project_name || "",
      category: raw.category || "",
      stage: raw.stage || "",
      creator_name: raw.creator_name || "",
      role: raw.role || "",
      internal_id: raw.internal_id || "",
      email: normalizeEmail(raw.email || ""),
      summary: raw.summary || "",
      problem: raw.problem || "",
      solution: raw.solution || "",
      impact: raw.impact || "",
      funding: raw.funding || "",
      risk: raw.risk || "",
      confidentiality: raw.confidentiality || "",
      roi: safeNumber(raw.roi, 0),
      initial_liquidity: safeNumber(raw.initial_liquidity, 0),
      status: raw.status || "",
      created_at: raw.created_at || null,
      approved_at: raw.approved_at || null
    };
  }

  function normalizeAccessResult(raw = {}){
    return {
      ok: safeBool(raw.ok),
      allowed: safeBool(raw.allowed),
      reason: raw.reason || "",
      contributor: raw.contributor
        ? normalizeContributor(raw.contributor)
        : null,
      access: raw.access || null
    };
  }

  /* =========================================================
     LOW LEVEL RPC
  ========================================================= */
  async function callRpc(fnName, payload = {}){
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc(fnName, payload);

    if(error){
      throw new Error(error.message || `RPC failed: ${fnName}`);
    }

    return data;
  }

  /* =========================================================
     DIRECT TABLE READ HELPERS
  ========================================================= */
  async function findContributorByEmail(email){
    const supabase = getSupabaseClient();
    const normalizedEmail = normalizeEmail(email);

    if(!normalizedEmail) return null;

    const { data, error } = await supabase
      .from("albukhr_contributors")
      .select("*")
      .ilike("email", normalizedEmail)
      .limit(1)
      .maybeSingle();

    if(error){
      throw new Error(error.message || "Failed to load contributor");
    }

    return data ? normalizeContributor(data) : null;
  }

  async function getLatestInternalProjectByEmail(email){
    const supabase = getSupabaseClient();
    const normalizedEmail = normalizeEmail(email);

    if(!normalizedEmail) return null;

    const { data, error } = await supabase
      .from("albukhr_internal_projects")
      .select("*")
      .ilike("email", normalizedEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if(error){
      throw new Error(error.message || "Failed to load internal project history");
    }

    return data ? normalizeInternalProject(data) : null;
  }

  /* =========================================================
     ACCESS CHECK
     Hard gate for internal-registry-form.html
  ========================================================= */
  async function checkInternalAccess(email = ""){
    const engine = ensureContributorEngineLoaded();

    const candidateEmail =
      normalizeEmail(email) ||
      getInternalSessionEmail() ||
      getCurrentContributorEmail();

    if(!candidateEmail){
      return {
        ok: false,
        allowed: false,
        reason: "missing_contributor_session",
        contributor: null
      };
    }

    /* preferred path via contributor engine */
    try{
      const result = await engine.getContributorAccess(candidateEmail);

      const contributor = normalizeContributor(result?.contributor || {});
      const approved = contributor.status === "approved";
      const internalUnlocked =
        safeBool(result?.internal_unlocked) ||
        safeBool(result?.has_internal_access) ||
        contributor.internal_unlocked;

      if(!contributor.email){
        return {
          ok: false,
          allowed: false,
          reason: "contributor_not_found",
          contributor: null
        };
      }

      if(!approved){
        return {
          ok: false,
          allowed: false,
          reason: "contributor_not_approved",
          contributor
        };
      }

      if(!internalUnlocked){
        return {
          ok: false,
          allowed: false,
          reason: "internal_access_locked",
          contributor
        };
      }

      return {
        ok: true,
        allowed: true,
        reason: "",
        contributor
      };
    }catch(err){
      console.warn("Contributor engine access lookup failed, falling back to direct contributor query:", err);
    }

    /* fallback direct read */
    const contributor = await findContributorByEmail(candidateEmail);

    if(!contributor){
      return {
        ok: false,
        allowed: false,
        reason: "contributor_not_found",
        contributor: null
      };
    }

    if(contributor.status !== "approved"){
      return {
        ok: false,
        allowed: false,
        reason: "contributor_not_approved",
        contributor
      };
    }

    if(!contributor.internal_unlocked){
      return {
        ok: false,
        allowed: false,
        reason: "internal_access_locked",
        contributor
      };
    }

    return {
      ok: true,
      allowed: true,
      reason: "",
      contributor
    };
  }

  /* =========================================================
     SESSION TOKEN GATE
     This matches your page logic:
     - sessionStorage.albukhr_internal_token must exist
     - sessionStorage.albukhr_internal_email must exist
  ========================================================= */
  async function validateInternalEntryGate(){
    const token = getInternalSessionToken();
    const email = getInternalSessionEmail();

    if(!token || !email){
      return {
        ok: false,
        allowed: false,
        reason: "missing_internal_session"
      };
    }

    const access = await checkInternalAccess(email);

    if(!access.allowed){
      return {
        ok: false,
        allowed: false,
        reason: access.reason || "internal_access_denied",
        contributor: access.contributor || null
      };
    }

    return {
      ok: true,
      allowed: true,
      reason: "",
      contributor: access.contributor || null
    };
  }

  /* =========================================================
     LOCK CHECK
     Mirrors SQL logic before submit so UI can react early:
     - latest internal_pending => lock
     - latest internal_approved within 7 days => lock
  ========================================================= */
  async function checkInternalSubmissionLock(email = ""){
    const normalizedEmail =
      normalizeEmail(email) ||
      getInternalSessionEmail() ||
      getCurrentContributorEmail();

    if(!normalizedEmail){
      return {
        ok: false,
        locked: true,
        reason: "missing_email",
        message: "Contributor email not found."
      };
    }

    const latest = await getLatestInternalProjectByEmail(normalizedEmail);

    if(!latest){
      return {
        ok: true,
        locked: false,
        reason: "",
        message: ""
      };
    }

    if(latest.status === "internal_pending"){
      return {
        ok: true,
        locked: true,
        reason: "internal_pending_exists",
        message: "Previous project under review.",
        project: latest
      };
    }

    if(
      latest.status === "internal_approved" &&
      latest.approved_at
    ){
      const approvedAt = new Date(latest.approved_at).getTime();
      const unlockAt = approvedAt + (7 * 24 * 60 * 60 * 1000);

      if(Number.isFinite(unlockAt) && Date.now() < unlockAt){
        return {
          ok: true,
          locked: true,
          reason: "approval_cooldown_active",
          message: "You can submit again after 7 days.",
          unlock_at: new Date(unlockAt).toISOString(),
          project: latest
        };
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
     FORM PAYLOAD VALIDATION
  ========================================================= */
  function validateInternalProjectPayload(payload = {}){
    const errors = [];

    if(!trimOrNull(payload.projectName)){
      errors.push("Project name is required");
    }
    if(!trimOrNull(payload.category)){
      errors.push("Project category is required");
    }
    if(!trimOrNull(payload.stage)){
      errors.push("Project stage is required");
    }
    if(!trimOrNull(payload.creatorName)){
      errors.push("Creator name is required");
    }
    if(!trimOrNull(payload.role)){
      errors.push("Role is required");
    }
    if(!trimOrNull(payload.internalId)){
      errors.push("Albukhr Internal ID is required");
    }
    if(!normalizeEmail(payload.email)){
      errors.push("Contributor email is required");
    }
    if(!trimOrNull(payload.summary)){
      errors.push("Project summary is required");
    }
    if(!trimOrNull(payload.problem)){
      errors.push("Problem statement is required");
    }
    if(!trimOrNull(payload.solution)){
      errors.push("Solution is required");
    }

    return {
      ok: errors.length === 0,
      errors
    };
  }

  /* =========================================================
     SUBMIT INTERNAL PROJECT
     Preferred path:
       RPC public.albukhr_submit_internal_project(...)
  ========================================================= */
  async function submitInternalProject(payload = {}){
    const access = await checkInternalAccess(payload.email);

    if(!access.allowed){
      throw new Error(
        access.reason === "contributor_not_found"
          ? "Contributor account not found."
          : access.reason === "contributor_not_approved"
            ? "Contributor is not approved."
            : access.reason === "internal_access_locked"
              ? "Internal project access is locked for this contributor."
              : "Internal registry access denied."
      );
    }

    const cleanPayload = {
      projectName: trimOrNull(payload.projectName),
      category: trimOrNull(payload.category),
      stage: trimOrNull(payload.stage),
      creatorName: trimOrNull(payload.creatorName),
      role: trimOrNull(payload.role),
      internalId: trimOrNull(payload.internalId),
      email: normalizeEmail(payload.email || access.contributor?.email || ""),
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
    if(!validation.ok){
      throw new Error(validation.errors[0] || "Please complete all required fields");
    }

    /* early lock check for UI friendliness */
    const lockState = await checkInternalSubmissionLock(cleanPayload.email);
    if(lockState.locked){
      throw new Error(lockState.message || "Internal project submission is currently locked.");
    }

    /* RPC submit */
    const result = await callRpc("albukhr_submit_internal_project", {
      p_project_name: cleanPayload.projectName,
      p_category: cleanPayload.category,
      p_stage: cleanPayload.stage,
      p_creator_name: cleanPayload.creatorName,
      p_role: cleanPayload.role,
      p_internal_id: cleanPayload.internalId,
      p_email: cleanPayload.email,
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

    const project = normalizeInternalProject(
      result?.project || result || {}
    );

    return {
      ok: true,
      message:
        result?.message ||
        "Internal project submitted successfully.",
      project
    };
  }

  /* =========================================================
     FORM HELPER
     For internal-registry-form.html direct binding
  ========================================================= */
  async function submitInternalProjectFromForm(formMap = {}){
    const email =
      normalizeEmail(formMap.email?.value || "") ||
      getInternalSessionEmail() ||
      getCurrentContributorEmail();

    const payload = {
      projectName: formMap.projectName?.value || "",
      category: formMap.category?.value || "",
      stage: formMap.stage?.value || "",
      creatorName: formMap.creatorName?.value || "",
      role: formMap.role?.value || "",
      internalId: formMap.internalId?.value || "",
      email,
      summary: formMap.summary?.value || "",
      problem: formMap.problem?.value || "",
      solution: formMap.solution?.value || "",
      impact: formMap.impact?.value || "",
      funding: formMap.funding?.value || "",
      risk: formMap.risk?.value || "",
      confidentiality: formMap.confidentiality?.value || "",
      roi: formMap.roi?.value || 0,
      initialLiquidity: formMap.liquidity?.value || 0
    };

    return await submitInternalProject(payload);
  }

  /* =========================================================
     PAGE BOOTSTRAP HELPER
     - validates session gate
     - validates contributor access
     - returns lock state
  ========================================================= */
  async function bootstrapInternalRegistryPage(){
    const gate = await validateInternalEntryGate();

    if(!gate.allowed){
      return {
        ok: false,
        allowed: false,
        reason: gate.reason || "internal_access_denied",
        contributor: gate.contributor || null,
        lock: null
      };
    }

    const email =
      gate.contributor?.email ||
      getInternalSessionEmail() ||
      getCurrentContributorEmail();

    const lock = await checkInternalSubmissionLock(email);

    return {
      ok: true,
      allowed: true,
      reason: "",
      contributor: gate.contributor || null,
      lock
    };
  }

  /* =========================================================
     SIMPLE PAGE UTILITIES
  ========================================================= */
  function fillContributorFieldsIfNeeded({
    emailInput = null
  } = {}){
    const email =
      getInternalSessionEmail() ||
      getCurrentContributorEmail();

    if(emailInput && email && !emailInput.value){
      emailInput.value = email;
    }

    return {
      email
    };
  }

  function disableButton(btn, text = ""){
    if(!btn) return;
    btn.disabled = true;
    btn.classList.add("disabled");
    if(text){
      btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
      btn.textContent = text;
    }
  }

  function enableButton(btn){
    if(!btn) return;
    btn.disabled = false;
    btn.classList.remove("disabled");
    if(btn.dataset.originalText){
      btn.textContent = btn.dataset.originalText;
    }
  }

  /* =========================================================
     PUBLIC EXPORTS
  ========================================================= */
  InternalRegistryEngine.getSupabaseClient = getSupabaseClient;
  InternalRegistryEngine.getCurrentContributorEmail = getCurrentContributorEmail;
  InternalRegistryEngine.getInternalSessionEmail = getInternalSessionEmail;
  InternalRegistryEngine.getInternalSessionToken = getInternalSessionToken;
  InternalRegistryEngine.setInternalSession = setInternalSession;
  InternalRegistryEngine.clearInternalSession = clearInternalSession;

  InternalRegistryEngine.findContributorByEmail = findContributorByEmail;
  InternalRegistryEngine.getLatestInternalProjectByEmail = getLatestInternalProjectByEmail;

  InternalRegistryEngine.checkInternalAccess = checkInternalAccess;
  InternalRegistryEngine.validateInternalEntryGate = validateInternalEntryGate;
  InternalRegistryEngine.checkInternalSubmissionLock = checkInternalSubmissionLock;

  InternalRegistryEngine.validateInternalProjectPayload = validateInternalProjectPayload;
  InternalRegistryEngine.submitInternalProject = submitInternalProject;
  InternalRegistryEngine.submitInternalProjectFromForm = submitInternalProjectFromForm;

  InternalRegistryEngine.bootstrapInternalRegistryPage = bootstrapInternalRegistryPage;
  InternalRegistryEngine.fillContributorFieldsIfNeeded = fillContributorFieldsIfNeeded;
  InternalRegistryEngine.disableButton = disableButton;
  InternalRegistryEngine.enableButton = enableButton;

  /* =========================================================
     LEGACY GLOBAL WRAPPERS
  ========================================================= */
  window.checkInternalAccess = checkInternalAccess;
  window.submitInternalProject = submitInternalProject;
  window.submitInternalProjectFromForm = submitInternalProjectFromForm;

/* =========================================================
   ADMIN REVIEW PATCH FINAL
   ADD THIS INSIDE internal-registry-engine.js
   BEFORE THE FINAL: })();
========================================================= */

/* =========================================================
   INTERNAL ADMIN HELPERS
========================================================= */
function getInternalAdminMeta(){
  return {
    email:
      (
        localStorage.getItem("albukhr_current_email") ||
        localStorage.getItem("currentUserEmail") ||
        ""
      ).trim().toLowerCase(),
    name:
      (
        localStorage.getItem("albukhr_current_username") ||
        localStorage.getItem("currentUserName") ||
        "ALBUKHR Admin"
      ).trim(),
    role:
      (
        localStorage.getItem("albukhr_current_role") ||
        "admin"
      ).trim()
  };
}

function normalizeInternalProjectRecord(raw = {}){
  return {
    id: raw.id || null,

    project_name: raw.project_name || raw.projectName || "",
    category: raw.category || "",
    stage: raw.stage || "",

    creator_name: raw.creator_name || raw.creatorName || "",
    role: raw.role || "",
    internal_id: raw.internal_id || raw.albukhr_id || raw.albukhrId || "",
    email: (raw.email || "").trim().toLowerCase(),
    phone: raw.phone || "",

    summary: raw.summary || "",
    problem: raw.problem || "",
    solution: raw.solution || "",
    impact: raw.impact || "",

    funding: raw.funding || "",
    risk: raw.risk || "",
    confidentiality: raw.confidentiality || "",

    roi: raw.roi ?? null,
    initial_liquidity:
      raw.initial_liquidity ??
      raw.liquidity ??
      null,

    status: raw.status || "internal_pending",

    approved_at: raw.approved_at || null,
    rejected_at: raw.rejected_at || null,
    created_at: raw.created_at || null,
    updated_at: raw.updated_at || null,

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

/* =========================================================
   ADMIN LIST INTERNAL PROJECTS
   Preferred RPC:
   albukhr_admin_list_internal_projects(
     p_status text default null,
     p_limit integer default 500
   )
========================================================= */
async function adminListInternalProjects({
  status = "",
  limit = 500
} = {}){
  const supabase = getSupabaseClient();

  /* preferred RPC */
  try{
    const { data, error } = await supabase.rpc(
      "albukhr_admin_list_internal_projects",
      {
        p_status: status ? String(status).trim() : null,
        p_limit: Number(limit) || 500
      }
    );

    if(error){
      throw error;
    }

    const rows = Array.isArray(data)
      ? data
      : Array.isArray(data?.projects)
        ? data.projects
        : [];

    return rows.map(normalizeInternalProjectRecord);

  }catch(err){
    console.warn(
      "albukhr_admin_list_internal_projects RPC unavailable, using direct read:",
      err
    );
  }

  /* fallback direct table read */
  let query = supabase
    .from("albukhr_internal_projects")
    .select("*")
    .order("created_at", { ascending:false })
    .limit(Number(limit) || 500);

  if(status){
    query = query.eq("status", String(status).trim());
  }

  const { data, error } = await query;

  if(error){
    throw new Error(
      error.message || "Failed to load internal projects."
    );
  }

  return (Array.isArray(data) ? data : [])
    .map(normalizeInternalProjectRecord);
}

/* =========================================================
   ADMIN APPROVE INTERNAL PROJECT
   Supports BOTH signatures:
   1) adminApproveInternalProject("project-id")
   2) adminApproveInternalProject({
        projectId,
        approvedBy,
        approvedByName,
        approvedByRole
      })

   Preferred RPC:
   albukhr_admin_approve_internal_project(
     p_project_id uuid/text,
     p_approved_by_email text,
     p_approved_by_name text,
     p_approved_by_role text
   )
========================================================= */
async function adminApproveInternalProject(input = {}){
  const supabase = getSupabaseClient();

  let projectId = "";
  let approvedByEmail = "";
  let approvedByName = "";
  let approvedByRole = "";

  if(typeof input === "string"){
    projectId = input.trim();
  }else{
    projectId = String(
      input.projectId ||
      input.id ||
      ""
    ).trim();

    approvedByEmail = String(
      input.approvedBy ||
      input.approvedByEmail ||
      ""
    ).trim().toLowerCase();

    approvedByName = String(
      input.approvedByName || ""
    ).trim();

    approvedByRole = String(
      input.approvedByRole || ""
    ).trim();
  }

  if(!projectId){
    throw new Error("Internal project ID is required for approval.");
  }

  const actor = getInternalAdminMeta();

  const actorEmail = approvedByEmail || actor.email || "";
  const actorName = approvedByName || actor.name || "ALBUKHR Admin";
  const actorRole = approvedByRole || actor.role || "admin";

  /* preferred RPC */
  try{
    const { data, error } = await supabase.rpc(
      "albukhr_admin_approve_internal_project",
      {
        p_project_id: projectId,
        p_approved_by_email: actorEmail,
        p_approved_by_name: actorName,
        p_approved_by_role: actorRole
      }
    );

    if(error){
      throw error;
    }

    return {
      ok:true,
      project: normalizeInternalProjectRecord(
        data?.project || data || {}
      )
    };

  }catch(err){
    console.warn(
      "albukhr_admin_approve_internal_project RPC unavailable, using direct update:",
      err
    );
  }

  /* fallback direct update */
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("albukhr_internal_projects")
    .update({
      status: "internal_approved",
      approved_at: now,
      rejected_at: null,

      approved_by_email: actorEmail || null,
      approved_by_name: actorName || null,

      reviewed_by_email: actorEmail || null,
      reviewed_by_name: actorName || null,

      rejected_by_email: null,
      rejected_by_name: null,
      rejection_reason: null,

      updated_at: now
    })
    .eq("id", projectId)
    .select()
    .single();

  if(error){
    throw new Error(
      error.message || "Failed to approve internal project."
    );
  }

  return {
    ok:true,
    project: normalizeInternalProjectRecord(data)
  };
}

/* =========================================================
   ADMIN REJECT INTERNAL PROJECT
   Supports BOTH signatures:
   1) adminRejectInternalProject("project-id")
   2) adminRejectInternalProject({
        projectId,
        reason,
        rejectedBy,
        rejectedByName,
        rejectedByRole
      })

   Preferred RPC:
   albukhr_admin_reject_internal_project(
     p_project_id uuid/text,
     p_rejected_by_email text,
     p_rejected_by_name text,
     p_rejected_by_role text,
     p_reason text
   )
========================================================= */
async function adminRejectInternalProject(input = {}){
  const supabase = getSupabaseClient();

  let projectId = "";
  let reason = "";
  let rejectedByEmail = "";
  let rejectedByName = "";
  let rejectedByRole = "";

  if(typeof input === "string"){
    projectId = input.trim();
  }else{
    projectId = String(
      input.projectId ||
      input.id ||
      ""
    ).trim();

    reason = String(
      input.reason || ""
    ).trim();

    rejectedByEmail = String(
      input.rejectedBy ||
      input.rejectedByEmail ||
      ""
    ).trim().toLowerCase();

    rejectedByName = String(
      input.rejectedByName || ""
    ).trim();

    rejectedByRole = String(
      input.rejectedByRole || ""
    ).trim();
  }

  if(!projectId){
    throw new Error("Internal project ID is required for rejection.");
  }

  const actor = getInternalAdminMeta();

  const actorEmail = rejectedByEmail || actor.email || "";
  const actorName = rejectedByName || actor.name || "ALBUKHR Admin";
  const actorRole = rejectedByRole || actor.role || "admin";

  /* preferred RPC */
  try{
    const { data, error } = await supabase.rpc(
      "albukhr_admin_reject_internal_project",
      {
        p_project_id: projectId,
        p_rejected_by_email: actorEmail,
        p_rejected_by_name: actorName,
        p_rejected_by_role: actorRole,
        p_reason: reason || null
      }
    );

    if(error){
      throw error;
    }

    return {
      ok:true,
      project: normalizeInternalProjectRecord(
        data?.project || data || {}
      )
    };

  }catch(err){
    console.warn(
      "albukhr_admin_reject_internal_project RPC unavailable, using direct update:",
      err
    );
  }

  /* fallback direct update */
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("albukhr_internal_projects")
    .update({
      status: "internal_rejected",
      rejected_at: now,
      approved_at: null,

      rejected_by_email: actorEmail || null,
      rejected_by_name: actorName || null,

      reviewed_by_email: actorEmail || null,
      reviewed_by_name: actorName || null,

      rejection_reason: reason || null,

      approved_by_email: null,
      approved_by_name: null,

      updated_at: now
    })
    .eq("id", projectId)
    .select()
    .single();

  if(error){
    throw new Error(
      error.message || "Failed to reject internal project."
    );
  }

  return {
    ok:true,
    project: normalizeInternalProjectRecord(data)
  };
}

/* =========================================================
   EXPORT TO ENGINE NAMESPACE
========================================================= */
InternalRegistryEngine.adminListInternalProjects = adminListInternalProjects;
InternalRegistryEngine.adminApproveInternalProject = adminApproveInternalProject;
InternalRegistryEngine.adminRejectInternalProject = adminRejectInternalProject;

/* =========================================================
   OPTIONAL GLOBAL WRAPPERS
========================================================= */
window.adminListInternalProjects = adminListInternalProjects;
window.adminApproveInternalProject = adminApproveInternalProject;
window.adminRejectInternalProject = adminRejectInternalProject;

})();
