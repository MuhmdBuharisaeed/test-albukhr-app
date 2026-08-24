/* =========================================================
   ALBUKHR — CONTRIBUTOR ENGINE v4
   User Architecture / Supabase Source of Truth

   FILE:
   js/engines/contributor-engine.js

   FOUNDATION DEPENDENCIES:
   - js/core/environment-switcher.js
   - js/core/supabase-core.js
   - js/core/pi-auth-core.js

   OPTIONAL:
   - Supabase Storage bucket: contributor-photos

   ARCHITECTURE RULES:
   - No LocalStorage persistence
   - No hard-coded Supabase URL/key
   - No direct REST API
   - No independent Supabase client
   - No independent network resolver
   - Pi authentication belongs to pi-auth-core.js
   - Supabase access belongs to supabase-core.js
   - Network is resolved from environment-switcher.js
   - Every contributor/invite/access database operation is
     network-aware
   - Invite state is server-backed
   - Contributor access is resolved from server records
   - No page-specific authentication implementation
   - Existing public API names are preserved for migration
========================================================= */

"use strict";

(function (window, document) {

  const CONTRIBUTOR_TABLE = "contributors";
  const INVITE_TABLE = "contributor_invites";
  const ACCESS_TABLE = "contributor_access";
  const PHOTO_BUCKET = "contributor-photos";

  /* =======================================================
     FOUNDATION RESOLUTION
  ======================================================= */

  function requireNetwork() {

    if (
      typeof window.requireAlbukhrNetwork !== "function"
    ) {
      throw new Error(
        "ALBUKHR Environment Switcher is not available. Load js/core/environment-switcher.js first."
      );
    }

    const network =
      window.requireAlbukhrNetwork();

    if (
      network !== "mainnet" &&
      network !== "testnet"
    ) {
      throw new Error(
        "ALBUKHR: invalid network."
      );
    }

    return network;
  }

  function requireDatabase() {

    if (
      typeof window.requireAlbukhrSupabaseClient !==
        "function"
    ) {
      throw new Error(
        "ALBUKHR Supabase Core is not available. Load js/core/supabase-core.js first."
      );
    }

    const db =
      window.requireAlbukhrSupabaseClient();

    if (!db) {
      throw new Error(
        "ALBUKHR Supabase client is not available."
      );
    }

    return db;
  }

  async function ensureAuthenticatedUser() {

    if (
      typeof window.ensurePiAuth !== "function"
    ) {
      throw new Error(
        "ALBUKHR Pi Auth Core is not available. Load js/core/pi-auth-core.js first."
      );
    }

    const user =
      await window.ensurePiAuth();

    if (!user?.uid) {
      throw new Error(
        "ALBUKHR user authentication is required."
      );
    }

    return user;
  }

  function getCurrentAuthenticatedUser() {

    if (
      typeof window.getCurrentUser !== "function"
    ) {
      return null;
    }

    return window.getCurrentUser();
  }

  /* =======================================================
     GENERIC HELPERS
  ======================================================= */

  function text(
    value,
    fallback = ""
  ) {

    return value == null
      ? fallback
      : String(value);
  }

  function normalizeEmail(value) {

    return text(value)
      .trim()
      .toLowerCase();
  }

  function tokenFromUrl() {

    if (
      typeof window.location === "undefined"
    ) {
      return "";
    }

    const params =
      new URLSearchParams(
        window.location.search || ""
      );

    return text(
      params.get("invite") ||
      params.get("token")
    ).trim();
  }

  function isExpired(value) {

    if (!value) {
      return false;
    }

    const timestamp =
      new Date(value).getTime();

    return Number.isFinite(timestamp) &&
      timestamp < Date.now();
  }

  function assertInviteUsable(invite) {

    if (!invite) {
      throw new Error(
        "Contributor invite is invalid."
      );
    }

    if (
      invite.revoked === true ||
      invite.status === "revoked"
    ) {
      throw new Error(
        "Contributor invite has been revoked."
      );
    }

    if (
      invite.used === true ||
      invite.status === "used"
    ) {
      throw new Error(
        "Contributor invite has already been used."
      );
    }

    if (isExpired(invite.expires_at)) {
      throw new Error(
        "Contributor invite has expired."
      );
    }

    return true;
  }

  /* =======================================================
     CONTRIBUTOR LOOKUP
  ======================================================= */

  async function getContributorByEmail(value) {

    const normalized =
      normalizeEmail(value);

    if (!normalized) {
      return null;
    }

    const db =
      requireDatabase();

    const network =
      requireNetwork();

    const result =
      await db
        .from(CONTRIBUTOR_TABLE)
        .select("*")
        .eq("network", network)
        .eq("email", normalized)
        .limit(1);

    if (result.error) {
      throw new Error(
        result.error.message ||
        "Contributor lookup failed."
      );
    }

    return result.data?.[0] || null;
  }

  async function getContributorAccess(value) {

    const contributor =
      await getContributorByEmail(value);

    if (!contributor) {
      return {
        contributor: null,
        albukhr_id: "",
        has_telegram_access: false,
        has_internal_access: false,
        has_project_builder_access: false,
        telegram_unlocked: false,
        internal_unlocked: false,
        project_creation_unlocked: false,
        access: null
      };
    }

    const db =
      requireDatabase();

    const network =
      requireNetwork();

    let access = null;

    try {

      const result =
        await db
          .from(ACCESS_TABLE)
          .select("*")
          .eq("network", network)
          .eq("contributor_id", contributor.id)
          .limit(1);

      if (!result.error) {
        access =
          result.data?.[0] || null;
      } else {
        console.warn(
          "ALBUKHR contributor access lookup unavailable:",
          result.error
        );
      }

    } catch (error) {

      console.warn(
        "ALBUKHR contributor access lookup unavailable:",
        error
      );

    }

    return {
      contributor,

      albukhr_id:
        contributor.albukhr_id ||
        access?.albukhr_id ||
        "",

      has_telegram_access:
        Boolean(
          access?.has_telegram_access
        ),

      has_internal_access:
        Boolean(
          access?.has_internal_access
        ),

      has_project_builder_access:
        Boolean(
          access?.has_project_builder_access
        ),

      telegram_unlocked:
        Boolean(
          access?.telegram_unlocked
        ),

      internal_unlocked:
        Boolean(
          access?.internal_unlocked
        ),

      project_creation_unlocked:
        Boolean(
          access?.project_creation_unlocked
        ),

      access
    };
  }

  /* =======================================================
     INVITE SESSION
  ======================================================= */

  async function getInviteByToken(token) {

    const normalizedToken =
      text(token).trim();

    if (!normalizedToken) {
      return null;
    }

    const db =
      requireDatabase();

    const network =
      requireNetwork();

    const result =
      await db
        .from(INVITE_TABLE)
        .select("*")
        .eq("network", network)
        .eq("token", normalizedToken)
        .limit(1);

    if (result.error) {
      throw new Error(
        result.error.message ||
        "Contributor invite lookup failed."
      );
    }

    return result.data?.[0] || null;
  }

  async function ensureInviteSessionFromUrl() {

    const token =
      tokenFromUrl();

    if (!token) {
      return {
        valid: false,
        reason: "missing_invite"
      };
    }

    const invite =
      await getInviteByToken(token);

    if (!invite) {
      return {
        valid: false,
        reason: "missing_invite"
      };
    }

    if (
      invite.revoked === true ||
      invite.status === "revoked"
    ) {
      return {
        valid: false,
        reason: "invite_revoked"
      };
    }

    if (
      invite.used === true ||
      invite.status === "used"
    ) {
      return {
        valid: false,
        reason: "invite_used"
      };
    }

    if (isExpired(invite.expires_at)) {
      return {
        valid: false,
        reason: "invite_expired"
      };
    }

    return {
      valid: true,
      token,
      invite,
      network: requireNetwork()
    };
  }

  /* =======================================================
     INVITE BLOCKED UI
     =======================================================
     This preserves the original public behavior.
     It does not create or alter shared navigation.
  ======================================================= */

  function renderInviteBlockedScreen(message) {

    if (!document?.body) {
      return false;
    }

    document.body.innerHTML = `
      <div style="
        display:flex;
        align-items:center;
        justify-content:center;
        min-height:100vh;
        padding:24px;
        box-sizing:border-box;
        background:#f4f7f6;
      ">
        <div style="
          max-width:420px;
          background:#fff;
          padding:28px;
          border-radius:18px;
          box-shadow:0 10px 30px rgba(0,0,0,.08);
          text-align:center;
          font-family:system-ui;
        ">
          <div style="font-size:46px;margin-bottom:10px">⛔</div>

          <h2 style="
            margin:0 0 12px;
            color:#b02a37;
          ">
            ${text(message)}
          </h2>

          <p style="
            margin:0;
            color:#55625c;
            line-height:1.7;
          ">
            This contributor page is invite-only.
            Please use a valid ALBUKHR invite link.
          </p>
        </div>
      </div>
    `;

    return true;
  }

  /* =======================================================
     PHOTO UPLOAD
  ======================================================= */

  function createSafeFileName(name) {

    return text(name, "photo")
      .replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );
  }

  function createUploadId() {

    if (
      window.crypto &&
      typeof window.crypto.randomUUID ===
        "function"
    ) {
      return window.crypto.randomUUID();
    }

    /*
     * This is only a temporary object-storage
     * path identifier. It is not authentication,
     * session, or persistent application state.
     */
    return (
      Date.now().toString(36) +
      "-" +
      Math.random()
        .toString(36)
        .slice(2)
    );
  }

  async function uploadPhoto(
    file,
    contributorId
  ) {

    if (!file) {
      return null;
    }

    if (
      !file.type ||
      !file.type.startsWith("image/")
    ) {
      throw new Error(
        "Contributor photo must be an image."
      );
    }

    if (
      file.size >
      5 * 1024 * 1024
    ) {
      throw new Error(
        "Contributor photo must be 5 MB or smaller."
      );
    }

    if (!contributorId) {
      throw new Error(
        "Contributor ID is required for photo upload."
      );
    }

    const db =
      requireDatabase();

    const network =
      requireNetwork();

    if (
      !db.storage ||
      typeof db.storage.from !==
        "function"
    ) {
      throw new Error(
        "Supabase Storage is unavailable."
      );
    }

    const path =
      `${network}/${contributorId}/${createUploadId()}-${createSafeFileName(file.name)}`;

    const upload =
      await db.storage
        .from(PHOTO_BUCKET)
        .upload(
          path,
          file,
          {
            upsert: false,
            contentType: file.type
          }
        );

    if (upload.error) {
      throw new Error(
        upload.error.message ||
        "Contributor photo upload failed."
      );
    }

    const publicResult =
      db.storage
        .from(PHOTO_BUCKET)
        .getPublicUrl(path);

    return {
      path,
      url:
        publicResult?.data?.publicUrl ||
        "",
      mime_type:
        file.type
    };
  }

  /* =======================================================
     APPLICATION VALIDATION
  ======================================================= */

  function normalizeApplicationPayload(
    payload = {}
  ) {

    return {
      fullName:
        text(payload.fullName).trim(),

      phone:
        text(payload.phone).trim(),

      email:
        normalizeEmail(payload.email),

      address:
        text(payload.address).trim(),

      country:
        text(payload.country).trim(),

      skills:
        text(payload.skills).trim(),

      experience:
        text(payload.experience).trim(),

      contribution:
        text(payload.contribution).trim(),

      inviteToken:
        text(payload.inviteToken).trim(),

      photoFile:
        payload.photoFile || null
    };
  }

  function validateApplicationPayload(
    data
  ) {

    if (
      !data.fullName ||
      !data.phone ||
      !data.email ||
      !data.address ||
      !data.skills ||
      !data.contribution
    ) {
      throw new Error(
        "Please complete all required contributor fields."
      );
    }

    if (!data.inviteToken) {
      throw new Error(
        "Valid invite session not found."
      );
    }

    return true;
  }

  /* =======================================================
     CONTRIBUTOR APPLICATION
  ======================================================= */

  async function submitContributorApplication(
    payload = {}
  ) {

    const data =
      normalizeApplicationPayload(
        payload
      );

    validateApplicationPayload(
      data
    );

    const db =
      requireDatabase();

    const network =
      requireNetwork();

    /*
     * Validate the invite against the current
     * network immediately before modifying data.
     */
    const invite =
      await getInviteByToken(
        data.inviteToken
      );

    assertInviteUsable(invite);

    /*
     * Existing contributor lookup is already
     * network-scoped.
     */
    const existing =
      await getContributorByEmail(
        data.email
      );

    let contributor = null;

    if (existing) {

      if (
        existing.status ===
        "approved"
      ) {
        return {
          ok: true,
          contributor: existing,
          alreadyApproved: true
        };
      }

      if (
        existing.status ===
        "pending"
      ) {
        return {
          ok: true,
          contributor: existing,
          alreadyPending: true
        };
      }

      /*
       * Re-application for an existing
       * non-approved/non-pending record.
       */
      const update =
        await db
          .from(CONTRIBUTOR_TABLE)
          .update({
            full_name:
              data.fullName,

            phone:
              data.phone,

            email:
              data.email,

            address:
              data.address,

            country:
              data.country,

            skills:
              data.skills,

            experience:
              data.experience,

            contribution:
              data.contribution,

            status:
              "pending",

            updated_at:
              new Date().toISOString()
          })
          .eq(
            "id",
            existing.id
          )
          .eq(
            "network",
            network
          )
          .select("*")
          .limit(1);

      if (update.error) {
        throw new Error(
          update.error.message ||
          "Contributor update failed."
        );
      }

      contributor =
        update.data?.[0] ||
        null;

    } else {

      const insert =
        await db
          .from(CONTRIBUTOR_TABLE)
          .insert({
            full_name:
              data.fullName,

            phone:
              data.phone,

            email:
              data.email,

            address:
              data.address,

            country:
              data.country,

            skills:
              data.skills,

            experience:
              data.experience,

            contribution:
              data.contribution,

            status:
              "pending",

            network
          })
          .select("*")
          .limit(1);

      if (insert.error) {
        throw new Error(
          insert.error.message ||
          "Contributor creation failed."
        );
      }

      contributor =
        insert.data?.[0] ||
        null;
    }

    if (!contributor) {
      throw new Error(
        "Contributor record was not created."
      );
    }

    /* =====================================================
       OPTIONAL PHOTO
    ===================================================== */

    if (data.photoFile) {

      try {

        const media =
          await uploadPhoto(
            data.photoFile,
            contributor.id
          );

        if (media) {

          const mediaUpdate =
            await db
              .from(CONTRIBUTOR_TABLE)
              .update({
                photo_url:
                  media.url,

                photo_path:
                  media.path,

                photo_mime_type:
                  media.mime_type,

                updated_at:
                  new Date().toISOString()
              })
              .eq(
                "id",
                contributor.id
              )
              .eq(
                "network",
                network
              )
              .select("*")
              .limit(1);

          if (
            !mediaUpdate.error &&
            mediaUpdate.data?.[0]
          ) {
            contributor =
              mediaUpdate.data[0];
          } else if (
            mediaUpdate.error
          ) {
            console.warn(
              "ALBUKHR contributor photo metadata update failed:",
              mediaUpdate.error
            );
          }
        }

      } catch (error) {

        /*
         * Preserve original behavior:
         * application remains valid if optional
         * photo upload fails.
         */
        console.warn(
          "ALBUKHR contributor photo upload failed:",
          error
        );
      }
    }

    /* =====================================================
       CONSUME INVITE
       =====================================================

       The existing schema/API does not expose an atomic
       server-side consume operation, so this remains a
       server-backed update. The network + token + invite ID
       are all constrained to the current environment.
    */

    const inviteUpdate =
      await db
        .from(INVITE_TABLE)
        .update({
          used:
            true,

          used_at:
            new Date().toISOString(),

          used_by_contributor_id:
            contributor.id
        })
        .eq(
          "id",
          invite.id
        )
        .eq(
          "network",
          network
        )
        .eq(
          "token",
          data.inviteToken
        );

    if (inviteUpdate.error) {
      /*
       * Preserve the previous non-fatal behavior,
       * because the contributor record has already
       * been created/updated.
       */
      console.warn(
        "ALBUKHR contributor invite consumption update failed:",
        inviteUpdate.error
      );
    }

    return {
      ok: true,
      contributor
    };
  }

  /* =======================================================
     INTERNAL REGISTRY ACCESS
  ======================================================= */

  async function prepareInternalRegistryAccess(
    value
  ) {

    const access =
      await getContributorAccess(
        value
      );

    return {
      allowed: Boolean(
        access.has_internal_access ||
        access.internal_unlocked
      ),

      ...access
    };
  }

  /* =======================================================
     SESSION HELPERS
  =======================================================

     Pi authentication does not provide an email in the
     shared auth scopes. Therefore this function intentionally
     does NOT invent an email or persist one locally.

     It returns the currently authenticated Pi identity when
     available. Existing callers expecting an email string
     still receive "" for backward compatibility.
  ======================================================= */

  function getContributorSession() {

    const user =
      getCurrentAuthenticatedUser();

    if (!user?.uid) {
      return null;
    }

    return {
      uid:
        user.uid,

      username:
        user.username || "",

      wallet_address:
        user.wallet_address || "",

      network:
        user.network ||
        requireNetwork()
    };
  }

  function getContributorSessionEmail() {

    /*
     * Pi Auth Core intentionally does not request or expose
     * an email address. Do not derive or fabricate one.
     */
    return "";
  }

  async function requireContributorUser() {

    return await ensureAuthenticatedUser();
  }

  /* =======================================================
     HEALTH
  ======================================================= */

  function contributorEngineHealth() {

    let network = null;
    let networkError = null;

    try {
      network =
        requireNetwork();
    } catch (error) {
      networkError =
        error?.message ||
        "Network unavailable.";
    }

    const supabaseReady =
      typeof window.requireAlbukhrSupabaseClient ===
        "function";

    const piAuthReady =
      typeof window.ensurePiAuth ===
        "function";

    return {
      ready:
        Boolean(
          network &&
          supabaseReady &&
          piAuthReady
        ),

      network,

      network_ready:
        Boolean(network),

      supabase_core_ready:
        supabaseReady,

      pi_auth_core_ready:
        piAuthReady,

      contributor_table:
        CONTRIBUTOR_TABLE,

      invite_table:
        INVITE_TABLE,

      access_table:
        ACCESS_TABLE,

      photo_bucket:
        PHOTO_BUCKET,

      network_error:
        networkError
    };
  }

  /* =======================================================
     PUBLIC API
  ======================================================= */

  const ContributorEngine = {

    getContributorByEmail,

    getContributorAccess,

    getInviteByToken,

    ensureInviteSessionFromUrl,

    renderInviteBlockedScreen,

    uploadPhoto,

    submitContributorApplication,

    prepareInternalRegistryAccess,

    getContributorSession,

    getContributorSessionEmail,

    requireContributorUser,

    contributorEngineHealth,

    getNetwork:
      requireNetwork
  };

  window.AlbukhrContributorEngine =
    ContributorEngine;

  /*
   * Compatibility aliases for pages/engines that
   * still call these functions globally.
   */
  window.getContributorByEmail =
    getContributorByEmail;

  window.getContributorAccess =
    getContributorAccess;

  window.ensureContributorInviteSession =
    ensureInviteSessionFromUrl;

  window.submitContributorApplication =
    submitContributorApplication;

  window.prepareInternalRegistryAccess =
    prepareInternalRegistryAccess;

  window.getContributorSessionEmail =
    getContributorSessionEmail;

  /*
   * No LocalStorage/sessionStorage state is created.
   * No automatic authentication is forced merely by
   * loading the engine.
   */

})(window, document);
