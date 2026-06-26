/* =========================================================
   ALBUKHR CONTRIBUTOR ENGINE
   PATCH-ADMIN-COMPAT FINAL
   ---------------------------------------------------------
   PURPOSE
   - Contributor invite generation
   - Contributor onboarding submit
   - Contributor access / status resolution
   - Admin contributor listing
   - Admin approve / reject
   - Admin unlock telegram / internal / project builder
   - Invite session handling
   ---------------------------------------------------------
   EXPECTED SQL / SUPABASE OBJECTS
   - albukhr_contributors
   - albukhr_contributor_invites
   - albukhr_invites
   - albukhr_invite_sessions
   - albukhr_get_contributor_internal_access(email)
   - albukhr_submit_contributor_application(...)
   - albukhr_generate_contributor_invite(...)
   - albukhr_mark_invite_session(...)
   - albukhr_admin_list_contributors(...)
   - albukhr_admin_get_contributor_by_email(...)
   - albukhr_admin_approve_contributor(...)
   - albukhr_admin_reject_contributor(...)
   - albukhr_admin_unlock_contributor_telegram(...)
   - albukhr_admin_unlock_contributor_internal(...)
   - albukhr_admin_unlock_contributor_project_builder(...)
========================================================= */

(function(){
  "use strict";

  /* =========================================================
     GLOBAL EXPORT NAMESPACE
  ========================================================= */
  const ContributorEngine = {};
  window.AlbukhrContributorEngine = ContributorEngine;

  /* =========================================================
     CONFIG
  ========================================================= */
  const ENGINE_NAME = "ALBUKHR Contributor Engine";
  const DEFAULT_INVITE_LIFETIME_HOURS = 48;

  const SESSION_KEYS = {
    contributorEmail: "albukhr_current_email",
    contributorName: "albukhr_current_username",
    contributorRole: "albukhr_current_role",
    inviteToken: "albukhr_current_invite_token",
    inviteSession: "albukhr_invite_session",
    internalEmail: "albukhr_internal_email",
    internalToken: "albukhr_internal_token"
  };

  const CONTRIBUTOR_PHOTO_BUCKET_CANDIDATES = [
    "albukhr-contributor-photos",
    "contributor-photos",
    "albukhr-files"
  ];

  /* =========================================================
     SUPABASE RESOLVER
  ========================================================= */
  function getSupabaseClient(){

  if(
    window.albukhrSupabase &&
    typeof window.albukhrSupabase.from === "function"
  ){
    return window.albukhrSupabase;
  }

  if(
    typeof window.getAlbukhrSupabaseClient === "function"
  ){
    const client = window.getAlbukhrSupabaseClient();

    if(client && typeof client.from === "function"){
      return client;
    }
  }

  if(
    window.supabaseClient &&
    typeof window.supabaseClient.from === "function"
  ){
    return window.supabaseClient;
  }

  throw new Error(
    ENGINE_NAME +
    ": Valid Supabase client not found. Load js/supabase-core.js first."
  );

     }
  /* =========================================================
     BASIC HELPERS
  ========================================================= */
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

  function safeArray(value){
    return Array.isArray(value) ? value : [];
  }

  function trimOrNull(value){
    const v = safeString(value).trim();
    return v ? v : null;
  }

  function normalizeEmail(value){
    return safeString(value).trim().toLowerCase();
  }

  function normalizePhone(value){
    return safeString(value).trim();
  }

  function nowIso(){
    return new Date().toISOString();
  }

  function randomTokenSegment(length = 8){
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnopqrstuvwxyz";
    let out = "";
    for(let i = 0; i < length; i++){
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  }

  function makeInviteToken(){
    const stamp = Date.now();
    const seg =
      (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID().replace(/-/g, "").slice(0, 10)
        : randomTokenSegment(10);

    return `ALB-INV-${stamp}-${seg}`;
  }

  function escapeHtml(text = ""){
    return safeString(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getOrigin(){
    return window.location.origin || "";
  }

  function buildContributorInviteLink(token){
    return `${getOrigin()}/submit-albukhrecosystem-form.html?invite=${encodeURIComponent(token)}`;
  }

  function setContributorSessionEmail(email){
    if(!email) return;
    localStorage.setItem(SESSION_KEYS.contributorEmail, normalizeEmail(email));
  }

  function getContributorSessionEmail(){
    return normalizeEmail(localStorage.getItem(SESSION_KEYS.contributorEmail) || "");
  }

  function clearContributorSessionEmail(){
    localStorage.removeItem(SESSION_KEYS.contributorEmail);
  }

  function setContributorSessionMeta(meta = {}){
    if(meta.email){
      localStorage.setItem(SESSION_KEYS.contributorEmail, normalizeEmail(meta.email));
    }
    if(meta.name){
      localStorage.setItem(SESSION_KEYS.contributorName, safeString(meta.name).trim());
    }
    if(meta.role){
      localStorage.setItem(SESSION_KEYS.contributorRole, safeString(meta.role).trim());
    }
  }

  function getContributorSessionMeta(){
    return {
      email: normalizeEmail(localStorage.getItem(SESSION_KEYS.contributorEmail) || ""),
      name: safeString(localStorage.getItem(SESSION_KEYS.contributorName) || "").trim(),
      role: safeString(localStorage.getItem(SESSION_KEYS.contributorRole) || "").trim()
    };
  }

  function setInviteSession(payload){
    localStorage.setItem(SESSION_KEYS.inviteSession, JSON.stringify(payload || {}));
  }

  function getInviteSession(){
    try{
      return JSON.parse(localStorage.getItem(SESSION_KEYS.inviteSession)) || null;
    }catch{
      return null;
    }
  }

  function clearInviteSession(){
    localStorage.removeItem(SESSION_KEYS.inviteSession);
  }

  function setInternalRegistrySession(email){
    if(email){
      sessionStorage.setItem(SESSION_KEYS.internalEmail, normalizeEmail(email));
    }
    sessionStorage.setItem(
      SESSION_KEYS.internalToken,
      `INT-${Date.now()}-${randomTokenSegment(8)}`
    );
  }

  /* =========================================================
     ADMIN META HELPERS
  ========================================================= */
  function getAdminMeta(){
    return {
      email:
        normalizeEmail(localStorage.getItem("albukhr_current_email")) ||
        normalizeEmail(localStorage.getItem("currentUserEmail")) ||
        "",
      name:
        safeString(localStorage.getItem("albukhr_current_username")) ||
        safeString(localStorage.getItem("currentUserName")) ||
        "ALBUKHR Admin",
      role:
        safeString(localStorage.getItem("albukhr_current_role")) ||
        "admin"
    };
  }

  function resolveActorMeta(input = {}, mode = "admin"){
    const base = mode === "admin"
      ? getAdminMeta()
      : getContributorSessionMeta();

    const email =
      normalizeEmail(
        input.email ||
        input.actorEmail ||
        input.approvedBy ||
        input.rejectedBy ||
        input.grantedBy ||
        input.createdByEmail ||
        base.email ||
        ""
      );

    const name =
      safeString(
        input.name ||
        input.actorName ||
        input.createdByName ||
        base.name ||
        (mode === "admin" ? "ALBUKHR Admin" : "ALBUKHR User")
      ).trim();

    const role =
      safeString(
        input.role ||
        input.actorRole ||
        base.role ||
        (mode === "admin" ? "admin" : "contributor")
      ).trim();

    return { email, name, role };
  }

  /* =========================================================
     PHOTO STORAGE
  ========================================================= */
  async function uploadContributorPhoto(file, contributorEmail = ""){
    if(!file){
      return {
        ok: true,
        photo_url: null,
        photo_path: null,
        bucket: null
      };
    }

    const supabase = getSupabaseClient();

    const fileExt = (
      safeString(file.name).split(".").pop() || "jpg"
    ).toLowerCase();

    const emailPart = normalizeEmail(contributorEmail || "contributor").replace(/[^a-z0-9]/g, "_");
    const fileName = `${emailPart}_${Date.now()}.${fileExt}`;
    const filePath = `contributors/${fileName}`;

    let lastError = null;

    for(const bucket of CONTRIBUTOR_PHOTO_BUCKET_CANDIDATES){
      try{
        const { error: uploadError } = await supabase
          .storage
          .from(bucket)
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: true
          });

        if(uploadError){
          lastError = uploadError;
          continue;
        }

        const { data: publicData } = supabase
          .storage
          .from(bucket)
          .getPublicUrl(filePath);

        return {
          ok: true,
          bucket,
          photo_path: filePath,
          photo_url: publicData?.publicUrl || null
        };
      }catch(err){
        lastError = err;
      }
    }

    throw new Error(
      lastError?.message ||
      "Unable to upload contributor photo. Please verify storage bucket configuration."
    );
  }

  /* =========================================================
     SHAPE NORMALIZERS
  ========================================================= */
  function normalizeContributorRecord(raw = {}){
    return {
      id: raw.id || null,
      full_name: raw.full_name || raw.fullName || "",
      email: normalizeEmail(raw.email || ""),
      phone: raw.phone || "",
      address: raw.address || "",
      country: raw.country || "",
      skills: raw.skills || "",
      experience: raw.experience || "",
      contribution: raw.contribution || raw.expected_contribution || "",
      photo_url: raw.photo_url || raw.photo || "",
      photo_path: raw.photo_path || "",
      status: raw.status || "pending",
      albukhr_id: raw.albukhr_id || raw.albukhrId || "",
      telegram_unlocked: safeBool(raw.telegram_unlocked),
      internal_unlocked: safeBool(raw.internal_unlocked),
      project_creation_unlocked: safeBool(raw.project_creation_unlocked),
      approved_at: raw.approved_at || null,
      rejected_at: raw.rejected_at || null,
      created_at: raw.created_at || null,
      updated_at: raw.updated_at || null,
      approved_by_name: raw.approved_by_name || "",
      approved_by_email: raw.approved_by_email || "",
      rejected_by_name: raw.rejected_by_name || "",
      rejected_by_email: raw.rejected_by_email || "",
      rejection_reason: raw.rejection_reason || ""
    };
  }

  function normalizeInviteRecord(raw = {}){
    return {
      id: raw.id || null,
      token: raw.token || "",
      invite_type: raw.invite_type || "contributor",
      invite_url: raw.invite_url || buildContributorInviteLink(raw.token || ""),
      created_by_email: raw.created_by_email || "",
      created_by_name: raw.created_by_name || "",
      expires_at: raw.expires_at || null,
      used: safeBool(raw.used),
      used_at: raw.used_at || null,
      revoked: safeBool(raw.revoked),
      created_at: raw.created_at || null
    };
  }

  function normalizeAccessRecord(raw = {}){
    const contributor = raw.contributor || raw.record || raw.data || raw;

    return {
      allowed: safeBool(raw.allowed),
      contributor: normalizeContributorRecord(contributor),
      status: safeString(raw.status || contributor?.status || "").toLowerCase(),
      telegram_unlocked: safeBool(raw.telegram_unlocked ?? contributor?.telegram_unlocked),
      internal_unlocked: safeBool(raw.internal_unlocked ?? contributor?.internal_unlocked),
      project_creation_unlocked: safeBool(raw.project_creation_unlocked ?? contributor?.project_creation_unlocked),
      has_internal_access: safeBool(raw.has_internal_access ?? contributor?.internal_unlocked),
      has_telegram_access: safeBool(raw.has_telegram_access ?? contributor?.telegram_unlocked),
      has_project_builder_access: safeBool(raw.has_project_builder_access ?? contributor?.project_creation_unlocked),
      albukhr_id: raw.albukhr_id || contributor?.albukhr_id || ""
    };
  }

  /* =========================================================
     LOW LEVEL RPC CALLER
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
     FALLBACK TABLE QUERIES
  ========================================================= */
  async function findContributorByEmailDirect(email){
    const supabase = getSupabaseClient();
    const normalized = normalizeEmail(email);

    if(!normalized) return null;

    const { data, error } = await supabase
      .from("albukhr_contributors")
      .select("*")
      .ilike("email", normalized)
      .limit(1)
      .maybeSingle();

    if(error){
      throw new Error(error.message || "Failed to load contributor");
    }

    return data ? normalizeContributorRecord(data) : null;
  }

  async function findContributorByIdDirect(contributorId){
    const supabase = getSupabaseClient();
    const cleanId = safeString(contributorId).trim();

    if(!cleanId) return null;

    const { data, error } = await supabase
      .from("albukhr_contributors")
      .select("*")
      .eq("id", cleanId)
      .limit(1)
      .maybeSingle();

    if(error){
      throw new Error(error.message || "Failed to load contributor by id");
    }

    return data ? normalizeContributorRecord(data) : null;
  }

  async function listContributorsDirect(limit = 300){
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("albukhr_contributors")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if(error){
      throw new Error(error.message || "Failed to load contributors");
    }

    return safeArray(data).map(normalizeContributorRecord);
  }

  /* =========================================================
     IDENTIFIER RESOLVER
     Accepts:
     - "email@example.com"
     - "uuid"
     - { contributorId, email, id }
  ========================================================= */
  async function resolveContributorIdentifier(input){
    if(!input){
      throw new Error("Contributor identifier is required");
    }

    /* string: email or id */
    if(typeof input === "string"){
      const raw = safeString(input).trim();

      if(!raw){
        throw new Error("Contributor identifier is empty");
      }

      if(raw.includes("@")){
        const byEmail = await getContributorByEmail(raw);
        if(!byEmail){
          throw new Error("Contributor not found");
        }
        return byEmail;
      }

      const byId = await findContributorByIdDirect(raw);
      if(!byId){
        throw new Error("Contributor not found");
      }
      return byId;
    }

    /* object */
    const contributorId =
      safeString(
        input.contributorId ||
        input.id ||
        input.recordId ||
        ""
      ).trim();

    const email =
      normalizeEmail(
        input.email ||
        input.contributorEmail ||
        input.userEmail ||
        ""
      );

    if(email){
      const byEmail = await getContributorByEmail(email);
      if(!byEmail){
        throw new Error("Contributor not found");
      }
      return byEmail;
    }

    if(contributorId){
      const byId = await findContributorByIdDirect(contributorId);
      if(!byId){
        throw new Error("Contributor not found");
      }
      return byId;
    }

    throw new Error("Unable to resolve contributor identifier");
  }

  /* =========================================================
     INVITE ACCESS CHECK
  ========================================================= */
  async function validateInviteToken(token){
    const cleanToken = safeString(token).trim();

    if(!cleanToken){
      return {
        ok: false,
        valid: false,
        reason: "missing_token"
      };
    }

    try{
      const data = await callRpc("albukhr_validate_invite_token", {
        p_token: cleanToken
      });

      if(data && typeof data === "object"){
        return {
          ok: true,
          valid: safeBool(data.valid ?? data.ok ?? false),
          invite: data.invite || null,
          reason: data.reason || ""
        };
      }
    }catch(err){
      console.warn("albukhr_validate_invite_token RPC unavailable, falling back to direct query:", err);
    }

    const supabase = getSupabaseClient();

    let invite = null;
    let inviteError = null;

    {
      const { data, error } = await supabase
        .from("albukhr_invites")
        .select("*")
        .eq("token", cleanToken)
        .limit(1)
        .maybeSingle();

      if(!error && data){
        invite = data;
      }else{
        inviteError = error || null;
      }
    }

    if(!invite){
      const { data, error } = await supabase
        .from("albukhr_contributor_invites")
        .select("*")
        .eq("token", cleanToken)
        .limit(1)
        .maybeSingle();

      if(!error && data){
        invite = data;
      }else if(!inviteError){
        inviteError = error || null;
      }
    }

    if(inviteError && !invite){
      throw new Error(inviteError.message || "Failed to validate invite token");
    }

    if(!invite){
      return {
        ok: true,
        valid: false,
        reason: "invite_not_found"
      };
    }

    const expiresAt = invite.expires_at ? new Date(invite.expires_at).getTime() : 0;
    const isExpired = expiresAt && Date.now() > expiresAt;
    const isRevoked = safeBool(invite.revoked);
    const isUsed = safeBool(invite.used);

    return {
      ok: true,
      valid: !isExpired && !isRevoked && !isUsed,
      invite: normalizeInviteRecord(invite),
      reason:
        isExpired ? "invite_expired" :
        isRevoked ? "invite_revoked" :
        isUsed ? "invite_used" :
        ""
    };
  }

  /* =========================================================
     PUBLIC INVITE SESSION FLOW
  ========================================================= */
  async function ensureInviteSessionFromUrl(){
    const params = new URLSearchParams(window.location.search);
    const token = safeString(params.get("invite")).trim();

    const existingSession = getInviteSession();
    if(existingSession?.token && existingSession?.expiresAt){
      const expiresAtMs = new Date(existingSession.expiresAt).getTime();
      if(Number.isFinite(expiresAtMs) && expiresAtMs > Date.now()){
        return {
          ok: true,
          valid: true,
          source: "local_session",
          token: existingSession.token,
          session: existingSession
        };
      }
      clearInviteSession();
    }

    if(!token){
      return {
        ok: false,
        valid: false,
        reason: "missing_invite"
      };
    }

    const check = await validateInviteToken(token);

    if(!check.valid){
      return {
        ok: true,
        valid: false,
        reason: check.reason || "invalid_invite"
      };
    }

    const invite = normalizeInviteRecord(check.invite || {});
    const session = {
      token: invite.token,
      expiresAt: invite.expires_at,
      createdAt: nowIso()
    };

    setInviteSession(session);
    localStorage.setItem(SESSION_KEYS.inviteToken, invite.token);

    try{
      await callRpc("albukhr_mark_invite_session", {
        p_token: invite.token
      });
    }catch(err){
      console.warn("albukhr_mark_invite_session RPC warning:", err);
    }

    return {
      ok: true,
      valid: true,
      source: "url_token",
      token: invite.token,
      invite,
      session
    };
  }

  /* =========================================================
     ADMIN: GENERATE INVITE
  ========================================================= */
  async function generateContributorInvite({
    expiresInHours = DEFAULT_INVITE_LIFETIME_HOURS,
    createdByEmail = "",
    createdByName = "",
    inviteType = "contributor"
  } = {}){
    const token = makeInviteToken();
    const admin = getAdminMeta();

    const creatorEmail = normalizeEmail(createdByEmail || admin.email);
    const creatorName = safeString(createdByName || admin.name).trim() || "ALBUKHR Admin";
    const inviteUrl = buildContributorInviteLink(token);

    try{
      const data = await callRpc("albukhr_generate_contributor_invite", {
        p_token: token,
        p_invite_type: inviteType,
        p_created_by_email: creatorEmail,
        p_created_by_name: creatorName,
        p_expires_in_hours: safeNumber(expiresInHours, DEFAULT_INVITE_LIFETIME_HOURS)
      });

      const invite = normalizeInviteRecord({
        token,
        invite_url: inviteUrl,
        ...(data?.invite || data || {})
      });

      return {
        ok: true,
        invite,
        invite_url: invite.invite_url || inviteUrl,
        token: invite.token || token,
        expires_at: invite.expires_at || null
      };
    }catch(err){
      console.warn("albukhr_generate_contributor_invite RPC unavailable, falling back to direct insert:", err);
    }

    const supabase = getSupabaseClient();
    const expiresAt = new Date(Date.now() + safeNumber(expiresInHours, 48) * 60 * 60 * 1000).toISOString();

    let inserted = null;
    let lastError = null;

    {
      const { data, error } = await supabase
        .from("albukhr_invites")
        .insert({
          token,
          invite_type: inviteType,
          invite_url: inviteUrl,
          created_by_email: creatorEmail,
          created_by_name: creatorName,
          expires_at: expiresAt,
          used: false,
          revoked: false
        })
        .select()
        .single();

      if(!error && data){
        inserted = data;
      }else{
        lastError = error || null;
      }
    }

    if(!inserted){
      const { data, error } = await supabase
        .from("albukhr_contributor_invites")
        .insert({
          token,
          invite_type: inviteType,
          invite_url: inviteUrl,
          created_by_email: creatorEmail,
          created_by_name: creatorName,
          expires_at: expiresAt,
          used: false,
          revoked: false
        })
        .select()
        .single();

      if(!error && data){
        inserted = data;
      }else{
        lastError = error || lastError;
      }
    }

    if(!inserted){
      throw new Error(lastError?.message || "Failed to create contributor invite");
    }

    const invite = normalizeInviteRecord(inserted);
    return {
      ok: true,
      invite,
      invite_url: invite.invite_url || inviteUrl,
      token: invite.token || token,
      expires_at: invite.expires_at || expiresAt
    };
  }

  /* =========================================================
     INVITE USED MARKER
  ========================================================= */
  async function markInviteUsed(token, usedByEmail = ""){
    const cleanToken = safeString(token).trim();
    if(!cleanToken) return { ok: false, reason: "missing_token" };

    try{
      const data = await callRpc("albukhr_mark_invite_used", {
        p_token: cleanToken,
        p_used_by_email: normalizeEmail(usedByEmail)
      });

      return {
        ok: true,
        data
      };
    }catch(err){
      console.warn("albukhr_mark_invite_used RPC unavailable, falling back to direct update:", err);
    }

    const supabase = getSupabaseClient();
    const patch = {
      used: true,
      used_at: nowIso()
    };

    let updated = null;

    {
      const { data, error } = await supabase
        .from("albukhr_invites")
        .update(patch)
        .eq("token", cleanToken)
        .select()
        .maybeSingle();

      if(!error && data){
        updated = data;
      }
    }

    if(!updated){
      const { data, error } = await supabase
        .from("albukhr_contributor_invites")
        .update(patch)
        .eq("token", cleanToken)
        .select()
        .maybeSingle();

      if(error){
        throw new Error(error.message || "Failed to mark invite used");
      }
      updated = data;
    }

    return {
      ok: true,
      invite: updated ? normalizeInviteRecord(updated) : null
    };
  }

  /* =========================================================
     CONTRIBUTOR SUBMIT
  ========================================================= */
  async function submitContributorApplication(payload = {}){
    const {
      fullName,
      phone,
      email,
      address,
      country,
      skills,
      experience,
      contribution,
      photoFile = null,
      inviteToken = null
    } = payload;

    const normalizedEmail = normalizeEmail(email);

    if(!fullName || !safeString(fullName).trim()){
      throw new Error("Full name is required");
    }
    if(!normalizedEmail){
      throw new Error("Email is required");
    }
    if(!phone || !safeString(phone).trim()){
      throw new Error("Phone number is required");
    }
    if(!address || !safeString(address).trim()){
      throw new Error("Address is required");
    }
    if(!skills || !safeString(skills).trim()){
      throw new Error("Skills are required");
    }
    if(!contribution || !safeString(contribution).trim()){
      throw new Error("Expected contribution is required");
    }

    const activeInviteToken =
      safeString(inviteToken || getInviteSession()?.token || localStorage.getItem(SESSION_KEYS.inviteToken) || "").trim();

    if(!activeInviteToken){
      throw new Error("Valid invite token is required before contributor submission");
    }

    const inviteCheck = await validateInviteToken(activeInviteToken);
    if(!inviteCheck.valid){
      throw new Error("Invite is invalid, expired, or already used");
    }

    let photo_url = null;
    let photo_path = null;

    if(photoFile){
      const uploaded = await uploadContributorPhoto(photoFile, normalizedEmail);
      photo_url = uploaded.photo_url || null;
      photo_path = uploaded.photo_path || null;
    }

    let rpcResult = null;
    try{
      rpcResult = await callRpc("albukhr_submit_contributor_application", {
        p_full_name: safeString(fullName).trim(),
        p_phone: normalizePhone(phone),
        p_email: normalizedEmail,
        p_address: safeString(address).trim(),
        p_country: trimOrNull(country),
        p_skills: safeString(skills).trim(),
        p_experience: trimOrNull(experience),
        p_contribution: safeString(contribution).trim(),
        p_photo_url: photo_url,
        p_photo_path: photo_path,
        p_invite_token: activeInviteToken
      });
    }catch(err){
      console.warn("albukhr_submit_contributor_application RPC unavailable, falling back to direct insert:", err);
    }

    let contributor = null;

    if(rpcResult){
      contributor = normalizeContributorRecord(
        rpcResult.contributor || rpcResult.record || rpcResult
      );
    }else{
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from("albukhr_contributors")
        .insert({
          full_name: safeString(fullName).trim(),
          phone: normalizePhone(phone),
          email: normalizedEmail,
          address: safeString(address).trim(),
          country: trimOrNull(country),
          skills: safeString(skills).trim(),
          experience: trimOrNull(experience),
          contribution: safeString(contribution).trim(),
          photo_url,
          photo_path,
          status: "pending",
          telegram_unlocked: false,
          internal_unlocked: false,
          project_creation_unlocked: false
        })
        .select()
        .single();

      if(error){
        throw new Error(error.message || "Failed to submit contributor application");
      }

      contributor = normalizeContributorRecord(data);

      try{
        await markInviteUsed(activeInviteToken, normalizedEmail);
      }catch(err){
        console.warn("markInviteUsed warning:", err);
      }
    }

    setContributorSessionMeta({
      email: normalizedEmail,
      name: contributor.full_name || fullName,
      role: "contributor"
    });

    clearInviteSession();
    localStorage.removeItem(SESSION_KEYS.inviteToken);

    return {
      ok: true,
      contributor
    };
  }

  /* =========================================================
     GET CONTRIBUTOR BY EMAIL
  ========================================================= */
  async function getContributorByEmail(email){
    const normalizedEmail = normalizeEmail(email);
    if(!normalizedEmail) return null;

    try{
      const data = await callRpc("albukhr_admin_get_contributor_by_email", {
        p_email: normalizedEmail
      });

      if(!data) return null;

      if(data.contributor){
        return normalizeContributorRecord(data.contributor);
      }

      if(data.record){
        return normalizeContributorRecord(data.record);
      }

      if(data.email || data.full_name){
        return normalizeContributorRecord(data);
      }
    }catch(err){
      console.warn("albukhr_admin_get_contributor_by_email RPC unavailable, using direct read:", err);
    }

    return await findContributorByEmailDirect(normalizedEmail);
  }

  /* =========================================================
     GET CONTRIBUTOR ACCESS / STATUS
  ========================================================= */
  async function getContributorAccess(email){
    const normalizedEmail = normalizeEmail(email);
    if(!normalizedEmail){
      return {
        allowed: false,
        contributor: null,
        status: ""
      };
    }

    try{
      const data = await callRpc("albukhr_get_contributor_internal_access", {
        p_email: normalizedEmail
      });

      return normalizeAccessRecord(data || {});
    }catch(err){
      console.warn("albukhr_get_contributor_internal_access RPC unavailable, using direct contributor read:", err);
    }

    const contributor = await findContributorByEmailDirect(normalizedEmail);

    if(!contributor){
      return {
        allowed: false,
        contributor: null,
        status: ""
      };
    }

    const approved = contributor.status === "approved";

    return {
      allowed: approved,
      contributor,
      status: contributor.status,
      telegram_unlocked: contributor.telegram_unlocked,
      internal_unlocked: contributor.internal_unlocked,
      project_creation_unlocked: contributor.project_creation_unlocked,
      has_internal_access: approved && contributor.internal_unlocked,
      has_telegram_access: approved && contributor.telegram_unlocked,
      has_project_builder_access: approved && contributor.project_creation_unlocked,
      albukhr_id: contributor.albukhr_id || ""
    };
  }

  async function getMyContributorAccess(){
    const sessionEmail = getContributorSessionEmail();
    if(!sessionEmail){
      return {
        allowed: false,
        contributor: null,
        status: ""
      };
    }
    return await getContributorAccess(sessionEmail);
  }

  /* =========================================================
     ADMIN LIST CONTRIBUTORS
  ========================================================= */
  async function adminListContributors({
    status = "",
    limit = 300
  } = {}){
    try{
      const data = await callRpc("albukhr_admin_list_contributors", {
        p_status: trimOrNull(status),
        p_limit: safeNumber(limit, 300)
      });

      const rows = Array.isArray(data)
        ? data
        : Array.isArray(data?.contributors)
          ? data.contributors
          : [];

      return rows.map(normalizeContributorRecord);
    }catch(err){
      console.warn("albukhr_admin_list_contributors RPC unavailable, using direct read:", err);
    }

    let rows = await listContributorsDirect(limit);

    if(status){
      const s = safeString(status).trim().toLowerCase();
      rows = rows.filter(r => safeString(r.status).trim().toLowerCase() === s);
    }

    return rows;
  }

  /* =========================================================
     DIRECT PATCH HELPER
  ========================================================= */
  async function patchContributorByEmail(email, patch = {}){
    const normalizedEmail = normalizeEmail(email);
    if(!normalizedEmail){
      throw new Error("Contributor email is required");
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("albukhr_contributors")
      .update({
        ...patch,
        updated_at: nowIso()
      })
      .ilike("email", normalizedEmail)
      .select()
      .single();

    if(error){
      throw new Error(error.message || "Failed to update contributor");
    }

    return normalizeContributorRecord(data);
  }

  /* =========================================================
     ADMIN APPROVE / REJECT
     Supports:
     - adminApproveContributor("email@x.com")
     - adminApproveContributor("uuid")
     - adminApproveContributor({ contributorId, email, approvedBy, actorEmail... })
  ========================================================= */
  async function adminApproveContributor(input, adminMeta = {}){
    const contributor = await resolveContributorIdentifier(input);
    const actor = resolveActorMeta(
      typeof input === "object" ? { ...input, ...adminMeta } : adminMeta,
      "admin"
    );

    try{
      const data = await callRpc("albukhr_admin_approve_contributor", {
        p_email: contributor.email,
        p_approved_by_email: normalizeEmail(actor.email),
        p_approved_by_name: safeString(actor.name).trim(),
        p_approved_by_role: safeString(actor.role).trim()
      });

      return {
        ok: true,
        contributor: normalizeContributorRecord(data?.contributor || data || {})
      };
    }catch(err){
      console.warn("albukhr_admin_approve_contributor RPC unavailable, using direct update:", err);
    }

    const updated = await patchContributorByEmail(contributor.email, {
      status: "approved",
      approved_at: nowIso(),
      rejected_at: null,
      approved_by_email: normalizeEmail(actor.email),
      approved_by_name: safeString(actor.name).trim(),
      rejection_reason: null
    });

    return {
      ok: true,
      contributor: updated
    };
  }

  async function adminRejectContributor(input, adminMeta = {}, reason = ""){
    const contributor = await resolveContributorIdentifier(input);

    const mergedInput =
      typeof input === "object"
        ? { ...input, ...adminMeta }
        : { ...adminMeta, reason };

    const actor = resolveActorMeta(mergedInput, "admin");
    const finalReason =
      trimOrNull(
        (typeof input === "object" ? input.reason : "") ||
        reason ||
        mergedInput.reason ||
        ""
      );

    try{
      const data = await callRpc("albukhr_admin_reject_contributor", {
        p_email: contributor.email,
        p_rejected_by_email: normalizeEmail(actor.email),
        p_rejected_by_name: safeString(actor.name).trim(),
        p_rejected_by_role: safeString(actor.role).trim(),
        p_reason: finalReason
      });

      return {
        ok: true,
        contributor: normalizeContributorRecord(data?.contributor || data || {})
      };
    }catch(err){
      console.warn("albukhr_admin_reject_contributor RPC unavailable, using direct update:", err);
    }

    const updated = await patchContributorByEmail(contributor.email, {
      status: "rejected",
      rejected_at: nowIso(),
      approved_at: null,
      rejected_by_email: normalizeEmail(actor.email),
      rejected_by_name: safeString(actor.name).trim(),
      rejection_reason: finalReason
    });

    return {
      ok: true,
      contributor: updated
    };
  }

  /* =========================================================
     ADMIN UNLOCK HELPERS
  ========================================================= */
  async function unlockContributorAccessFlag({
    input,
    email,
    rpcName,
    directPatch = {},
    adminMeta = {}
  }){
    const contributor = input
      ? await resolveContributorIdentifier(input)
      : await resolveContributorIdentifier(email);

    const actor = resolveActorMeta(
      typeof input === "object" ? { ...input, ...adminMeta } : adminMeta,
      "admin"
    );

    try{
      const data = await callRpc(rpcName, {
        p_email: contributor.email,
        p_actor_email: normalizeEmail(actor.email),
        p_actor_name: safeString(actor.name).trim(),
        p_actor_role: safeString(actor.role).trim()
      });

      return {
        ok: true,
        contributor: normalizeContributorRecord(data?.contributor || data || {})
      };
    }catch(err){
      console.warn(`${rpcName} RPC unavailable, using direct update:`, err);
    }

    const updated = await patchContributorByEmail(contributor.email, directPatch);

    return {
      ok: true,
      contributor: updated
    };
  }

  async function adminUnlockTelegram(input, adminMeta = {}){
    return await unlockContributorAccessFlag({
      input,
      rpcName: "albukhr_admin_unlock_contributor_telegram",
      directPatch: { telegram_unlocked: true },
      adminMeta
    });
  }

  async function adminUnlockInternal(input, adminMeta = {}){
    return await unlockContributorAccessFlag({
      input,
      rpcName: "albukhr_admin_unlock_contributor_internal",
      directPatch: { internal_unlocked: true },
      adminMeta
    });
  }

  async function adminUnlockProjectBuilder(input, adminMeta = {}){
    return await unlockContributorAccessFlag({
      input,
      rpcName: "albukhr_admin_unlock_contributor_project_builder",
      directPatch: { project_creation_unlocked: true },
      adminMeta
    });
  }

  /* =========================================================
     NEW GENERIC UNLOCK COMPAT WRAPPER
     Supports:
     adminUnlockContributorAccess({
       contributorId,
       email,
       accessType: "telegram" | "internal" | "project_builder",
       grantedBy: "admin@mail.com"
     })
  ========================================================= */
  async function adminUnlockContributorAccess(payload = {}){
    const accessType = safeString(payload.accessType || payload.type || "").trim().toLowerCase();

    if(!accessType){
      throw new Error("accessType is required");
    }

    const actorMeta = {
      email: payload.grantedBy || payload.actorEmail || "",
      name: payload.actorName || "",
      role: payload.actorRole || "admin"
    };

    if(accessType === "telegram"){
      return await adminUnlockTelegram(payload, actorMeta);
    }

    if(accessType === "internal"){
      return await adminUnlockInternal(payload, actorMeta);
    }

    if(
      accessType === "project_builder" ||
      accessType === "projectbuilder" ||
      accessType === "project"
    ){
      return await adminUnlockProjectBuilder(payload, actorMeta);
    }

    throw new Error(`Unsupported contributor access type: ${accessType}`);
  }

  /* =========================================================
     PUBLIC STATUS HELPERS FOR PAGES
  ========================================================= */
  async function getContributorStatusForPage(email){
    const access = await getContributorAccess(email);
    const contributor = access.contributor || null;

    return {
      exists: !!contributor,
      approved: contributor?.status === "approved",
      pending: contributor?.status === "pending",
      rejected: contributor?.status === "rejected",
      contributor,
      access
    };
  }

  async function resolveContributorPageState(email){
    const state = await getContributorStatusForPage(email);

    return {
      contributorFound: state.exists,
      status: state.contributor?.status || "",
      contributor: state.contributor,
      showPendingNotice: state.pending,
      showApprovedView: state.approved,
      showRejectedState: state.rejected,
      showTelegramBox: !!state.access.has_telegram_access,
      showInternalBox: !!state.access.has_internal_access,
      showProjectBuilderBox: !!state.access.has_project_builder_access,
      showAlbukhrIdBox: !!state.access.albukhr_id
    };
  }

  /* =========================================================
     INTERNAL ENTRY PREP
  ========================================================= */
  async function prepareInternalRegistryAccess(email){
    const access = await getContributorAccess(email);

    if(!access?.contributor){
      return {
        ok: false,
        allowed: false,
        reason: "contributor_not_found"
      };
    }

    if(access.contributor.status !== "approved"){
      return {
        ok: false,
        allowed: false,
        reason: "contributor_not_approved",
        access
      };
    }

    if(!access.internal_unlocked && !access.has_internal_access){
      return {
        ok: false,
        allowed: false,
        reason: "internal_access_locked",
        access
      };
    }

    setInternalRegistrySession(email);

    return {
      ok: true,
      allowed: true,
      access
    };
  }

  /* =========================================================
     VIEWER META
  ========================================================= */
  function getTransparencyViewerMeta(){
    const session = getContributorSessionMeta();

    return {
      email: session.email || normalizeEmail(localStorage.getItem("currentUserEmail") || ""),
      name: session.name || safeString(localStorage.getItem("currentUserName") || "ALBUKHR User"),
      role: session.role || "contributor"
    };
  }

  /* =========================================================
     SIMPLE BLOCK SCREEN HELPER
  ========================================================= */
  function renderInviteBlockedScreen(message = "Access Restricted"){
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;padding:24px;box-sizing:border-box;text-align:center;background:#f4f7f6">
        <div style="max-width:420px;background:#fff;padding:24px;border-radius:18px;box-shadow:0 10px 30px rgba(0,0,0,0.08)">
          <div style="font-size:46px;margin-bottom:10px">⛔</div>
          <h2 style="margin:0 0 12px;color:#b02a37;font-family:system-ui">${escapeHtml(message)}</h2>
          <p style="margin:0;color:#55625c;line-height:1.7;font-family:system-ui">
            This contributor page is invite-only. Please use a valid ALBUKHR invite link.
          </p>
        </div>
      </div>
    `;
  }

  /* =========================================================
     CONVENIENCE WRAPPERS FOR EXISTING PAGES
  ========================================================= */
  async function generateContributorInviteForAdminUI(){
    const result = await generateContributorInvite();

    return {
      ok: true,
      token: result.token,
      invite_url: result.invite_url,
      expires_at: result.expires_at || null,
      invite: result.invite || null,
      html: `
        <b>Secure Invite Link:</b><br>
        ${escapeHtml(result.invite_url)}
        <br><br>
        <button class="copy-btn" onclick="navigator.clipboard.writeText('${escapeHtml(result.invite_url)}'); alert('Invite link copied successfully');">
          📋 Copy Link
        </button>
      `
    };
  }

  async function submitContributorFromForm(formMap = {}){
    const payload = {
      fullName: formMap.fullName?.value || "",
      phone: formMap.phone?.value || "",
      email: formMap.email?.value || "",
      address: formMap.address?.value || "",
      country: formMap.country?.value || "",
      skills: formMap.skills?.value || "",
      experience: formMap.experience?.value || "",
      contribution: formMap.contribution?.value || "",
      photoFile: formMap.photo?.files?.[0] || null,
      inviteToken:
        getInviteSession()?.token ||
        localStorage.getItem(SESSION_KEYS.inviteToken) ||
        ""
    };

    return await submitContributorApplication(payload);
  }

  /* =========================================================
     EXPORTS
  ========================================================= */
  ContributorEngine.getSupabaseClient = getSupabaseClient;

  ContributorEngine.getAdminMeta = getAdminMeta;
  ContributorEngine.getTransparencyViewerMeta = getTransparencyViewerMeta;

  ContributorEngine.setContributorSessionEmail = setContributorSessionEmail;
  ContributorEngine.getContributorSessionEmail = getContributorSessionEmail;
  ContributorEngine.clearContributorSessionEmail = clearContributorSessionEmail;
  ContributorEngine.setContributorSessionMeta = setContributorSessionMeta;
  ContributorEngine.getContributorSessionMeta = getContributorSessionMeta;

  ContributorEngine.setInviteSession = setInviteSession;
  ContributorEngine.getInviteSession = getInviteSession;
  ContributorEngine.clearInviteSession = clearInviteSession;

  ContributorEngine.ensureInviteSessionFromUrl = ensureInviteSessionFromUrl;
  ContributorEngine.validateInviteToken = validateInviteToken;
  ContributorEngine.markInviteUsed = markInviteUsed;
  ContributorEngine.renderInviteBlockedScreen = renderInviteBlockedScreen;

  ContributorEngine.uploadContributorPhoto = uploadContributorPhoto;

  ContributorEngine.generateContributorInvite = generateContributorInvite;
  ContributorEngine.generateContributorInviteForAdminUI = generateContributorInviteForAdminUI;

  ContributorEngine.submitContributorApplication = submitContributorApplication;
  ContributorEngine.submitContributorFromForm = submitContributorFromForm;

  ContributorEngine.getContributorByEmail = getContributorByEmail;
  ContributorEngine.getContributorAccess = getContributorAccess;
  ContributorEngine.getMyContributorAccess = getMyContributorAccess;
  ContributorEngine.getContributorStatusForPage = getContributorStatusForPage;
  ContributorEngine.resolveContributorPageState = resolveContributorPageState;

  ContributorEngine.adminListContributors = adminListContributors;
  ContributorEngine.adminApproveContributor = adminApproveContributor;
  ContributorEngine.adminRejectContributor = adminRejectContributor;
  ContributorEngine.adminUnlockTelegram = adminUnlockTelegram;
  ContributorEngine.adminUnlockInternal = adminUnlockInternal;
  ContributorEngine.adminUnlockProjectBuilder = adminUnlockProjectBuilder;
  ContributorEngine.adminUnlockContributorAccess = adminUnlockContributorAccess;

  ContributorEngine.prepareInternalRegistryAccess = prepareInternalRegistryAccess;
  ContributorEngine.resolveContributorIdentifier = resolveContributorIdentifier;

  /* =========================================================
     LEGACY GLOBAL WRAPPERS
  ========================================================= */
  window.getTransparencyViewerMeta = getTransparencyViewerMeta;

  window.generateContributorInvite = async function(){
    return await generateContributorInviteForAdminUI();
  };

  window.submitContributorApplication = submitContributorApplication;
  window.getContributorByEmail = getContributorByEmail;
  window.getContributorAccess = getContributorAccess;
  window.getMyContributorAccess = getMyContributorAccess;
  window.adminListContributors = adminListContributors;
  window.adminApproveContributor = adminApproveContributor;
  window.adminRejectContributor = adminRejectContributor;
  window.adminUnlockTelegram = adminUnlockTelegram;
  window.adminUnlockInternal = adminUnlockInternal;
  window.adminUnlockProjectBuilder = adminUnlockProjectBuilder;
  window.adminUnlockContributorAccess = adminUnlockContributorAccess;
  window.prepareInternalRegistryAccess = prepareInternalRegistryAccess;

})();
