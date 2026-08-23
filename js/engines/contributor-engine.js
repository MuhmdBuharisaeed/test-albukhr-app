/* =========================================================
   ALBUKHR — CONTRIBUTOR ENGINE v2
   Architecture-ready / Supabase Source of Truth
   =========================================================
   DEPENDS ON:
   - js/supabase-core.js
   - Network Core / environment-switcher.js
   - js/pi-auth.js
   - optional Supabase Storage bucket for contributor photos

   RULES:
   - No LocalStorage persistence
   - No hard-coded Supabase URL/key
   - No direct REST API
   - No hard-coded contributor/project configuration
   - Every database operation is network-aware
   - Invite/session state is server-backed
   - Access is resolved by contributor status/permissions
========================================================= */

"use strict";

(function(window){
  const CONTRIBUTOR_TABLE = "contributors";
  const INVITE_TABLE = "contributor_invites";
  const ACCESS_TABLE = "contributor_access";
  const PHOTO_BUCKET = "contributor-photos";

  function getNetwork(){
    if(typeof window.requireAlbukhrNetwork !== "function"){
      throw new Error("ALBUKHR Network Core is not available.");
    }
    return window.requireAlbukhrNetwork();
  }

  function getDB(){
    if(typeof window.requireAlbukhrSupabaseClient !== "function"){
      throw new Error("ALBUKHR Supabase Core is not available.");
    }
    const db = window.requireAlbukhrSupabaseClient();
    if(!db) throw new Error("ALBUKHR Supabase client is not available.");
    return db;
  }

  async function getUser(){
    if(typeof window.ensurePiAuth !== "function"){
      throw new Error("Pi authentication engine is not available.");
    }
    return await window.ensurePiAuth();
  }

  function text(v, fallback=""){
    return v == null ? fallback : String(v);
  }

  function email(v){
    return text(v).trim().toLowerCase();
  }

  function tokenFromUrl(){
    const params = new URLSearchParams(window.location.search);
    return text(params.get("invite") || params.get("token")).trim();
  }

  async function getContributorByEmail(value){
    const db = getDB();
    const network = getNetwork();
    const normalized = email(value);

    if(!normalized) return null;

    const result = await db
      .from(CONTRIBUTOR_TABLE)
      .select("*")
      .eq("network", network)
      .eq("email", normalized)
      .limit(1);

    if(result.error) throw new Error(result.error.message);
    return result.data?.[0] || null;
  }

  async function getContributorAccess(value){
    const contributor = await getContributorByEmail(value);
    if(!contributor){
      return { contributor:null };
    }

    const db = getDB();
    const network = getNetwork();

    let access = null;
    try{
      const result = await db
        .from(ACCESS_TABLE)
        .select("*")
        .eq("network", network)
        .eq("contributor_id", contributor.id)
        .limit(1);

      if(!result.error) access = result.data?.[0] || null;
    }catch(e){
      console.warn("Contributor access lookup unavailable:", e);
    }

    return {
      contributor,
      albukhr_id: contributor.albukhr_id || access?.albukhr_id || "",
      has_telegram_access: Boolean(access?.has_telegram_access),
      has_internal_access: Boolean(access?.has_internal_access),
      has_project_builder_access: Boolean(access?.has_project_builder_access),
      telegram_unlocked: Boolean(access?.telegram_unlocked),
      internal_unlocked: Boolean(access?.internal_unlocked),
      project_creation_unlocked: Boolean(access?.project_creation_unlocked),
      access
    };
  }

  async function ensureInviteSessionFromUrl(){
    const token = tokenFromUrl();
    if(!token){
      return {valid:false, reason:"missing_invite"};
    }

    const db = getDB();
    const network = getNetwork();

    const result = await db
      .from(INVITE_TABLE)
      .select("*")
      .eq("network", network)
      .eq("token", token)
      .limit(1);

    if(result.error) throw new Error(result.error.message);

    const invite = result.data?.[0];
    if(!invite) return {valid:false, reason:"missing_invite"};

    if(invite.revoked === true || invite.status === "revoked"){
      return {valid:false, reason:"invite_revoked"};
    }

    if(invite.used === true || invite.status === "used"){
      return {valid:false, reason:"invite_used"};
    }

    if(invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()){
      return {valid:false, reason:"invite_expired"};
    }

    return {
      valid:true,
      token,
      invite
    };
  }

  function renderInviteBlockedScreen(message){
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;box-sizing:border-box;background:#f4f7f6">
        <div style="max-width:420px;background:#fff;padding:28px;border-radius:18px;box-shadow:0 10px 30px rgba(0,0,0,.08);text-align:center;font-family:system-ui">
          <div style="font-size:46px;margin-bottom:10px">⛔</div>
          <h2 style="margin:0 0 12px;color:#b02a37">${text(message)}</h2>
          <p style="margin:0;color:#55625c;line-height:1.7">
            This contributor page is invite-only. Please use a valid ALBUKHR invite link.
          </p>
        </div>
      </div>
    `;
  }

  async function uploadPhoto(file, contributorId){
    if(!file) return null;
    if(!file.type || !file.type.startsWith("image/")){
      throw new Error("Contributor photo must be an image.");
    }
    if(file.size > 5 * 1024 * 1024){
      throw new Error("Contributor photo must be 5 MB or smaller.");
    }

    const db = getDB();
    const path = `${getNetwork()}/${contributorId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;

    const upload = await db.storage
      .from(PHOTO_BUCKET)
      .upload(path, file, { upsert:false, contentType:file.type });

    if(upload.error) throw new Error(upload.error.message);

    const publicResult = db.storage
      .from(PHOTO_BUCKET)
      .getPublicUrl(path);

    return {
      path,
      url: publicResult?.data?.publicUrl || "",
      mime_type: file.type
    };
  }

  async function submitContributorApplication(payload){
    const network = getNetwork();
    const db = getDB();

    const fullName = text(payload?.fullName).trim();
    const phone = text(payload?.phone).trim();
    const normalizedEmail = email(payload?.email);
    const address = text(payload?.address).trim();
    const country = text(payload?.country).trim();
    const skills = text(payload?.skills).trim();
    const experience = text(payload?.experience).trim();
    const contribution = text(payload?.contribution).trim();
    const inviteToken = text(payload?.inviteToken).trim();

    if(!fullName || !phone || !normalizedEmail || !address || !skills || !contribution){
      throw new Error("Please complete all required contributor fields.");
    }
    if(!inviteToken){
      throw new Error("Valid invite session not found.");
    }

    const inviteResult = await db
      .from(INVITE_TABLE)
      .select("*")
      .eq("network", network)
      .eq("token", inviteToken)
      .limit(1);

    if(inviteResult.error) throw new Error(inviteResult.error.message);
    const invite = inviteResult.data?.[0];

    if(!invite) throw new Error("Contributor invite is invalid.");
    if(invite.revoked === true || invite.status === "revoked") throw new Error("Contributor invite has been revoked.");
    if(invite.used === true || invite.status === "used") throw new Error("Contributor invite has already been used.");
    if(invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) throw new Error("Contributor invite has expired.");

    const existing = await getContributorByEmail(normalizedEmail);

    let contributor;
    if(existing){
      if(existing.status === "approved"){
        return {ok:true, contributor:existing, alreadyApproved:true};
      }
      if(existing.status === "pending"){
        return {ok:true, contributor:existing, alreadyPending:true};
      }

      const update = await db
        .from(CONTRIBUTOR_TABLE)
        .update({
          full_name:fullName,
          phone,
          email:normalizedEmail,
          address,
          country,
          skills,
          experience,
          contribution,
          status:"pending",
          updated_at:new Date().toISOString()
        })
        .eq("id", existing.id)
        .eq("network", network)
        .select("*")
        .limit(1);

      if(update.error) throw new Error(update.error.message);
      contributor = update.data?.[0];
    }else{
      const insert = await db
        .from(CONTRIBUTOR_TABLE)
        .insert({
          full_name:fullName,
          phone,
          email:normalizedEmail,
          address,
          country,
          skills,
          experience,
          contribution,
          status:"pending",
          network
        })
        .select("*")
        .limit(1);

      if(insert.error) throw new Error(insert.error.message);
      contributor = insert.data?.[0];
    }

    if(!contributor) throw new Error("Contributor record was not created.");

    if(payload?.photoFile){
      try{
        const media = await uploadPhoto(payload.photoFile, contributor.id);
        if(media){
          const mediaUpdate = await db
            .from(CONTRIBUTOR_TABLE)
            .update({
              photo_url:media.url,
              photo_path:media.path,
              photo_mime_type:media.mime_type,
              updated_at:new Date().toISOString()
            })
            .eq("id", contributor.id)
            .eq("network", network)
            .select("*")
            .limit(1);

          if(!mediaUpdate.error && mediaUpdate.data?.[0]){
            contributor = mediaUpdate.data[0];
          }
        }
      }catch(e){
        console.warn("Contributor photo upload failed:", e);
      }
    }

    const inviteUpdate = await db
      .from(INVITE_TABLE)
      .update({
        used:true,
        used_at:new Date().toISOString(),
        used_by_contributor_id:contributor.id
      })
      .eq("id", invite.id)
      .eq("network", network)
      .eq("token", inviteToken);

    if(inviteUpdate.error){
      console.warn("Invite consumption update failed:", inviteUpdate.error);
    }

    return {ok:true, contributor};
  }

  async function prepareInternalRegistryAccess(value){
    const access = await getContributorAccess(value);
    return {
      allowed: Boolean(
        access.has_internal_access ||
        access.internal_unlocked
      ),
      ...access
    };
  }

  function getContributorSessionEmail(){
    return "";
  }

  window.AlbukhrContributorEngine = {
    getContributorByEmail,
    getContributorAccess,
    ensureInviteSessionFromUrl,
    renderInviteBlockedScreen,
    submitContributorApplication,
    prepareInternalRegistryAccess,
    getContributorSessionEmail
  };
})(window);
