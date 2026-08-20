/* =========================================================
   ALBUKHR CONTRIBUTOR ENGINE
   SCHEMA-COMPATIBLE FINAL
   ---------------------------------------------------------
   Built against the CONFIRMED Supabase schema / RPC signatures.

   CONFIRMED TABLES
   - albukhr_contributors
   - albukhr_contributor_invites
   - albukhr_invites
   - albukhr_invite_sessions

   IMPORTANT
   - Uses the confirmed column names only.
   - Uses the confirmed RPC signatures only.
   - Does NOT assume albukhr_invites has `used` / `revoked`.
   - Does NOT assume albukhr_contributor_invites has `status`.
   - Does NOT call RPCs with nonexistent parameter names.
   - Network isolation is respected for albukhr_invites via `network`
     when the current environment can be resolved.
========================================================= */

(function () {
  "use strict";

  const ContributorEngine = {};
  window.AlbukhrContributorEngine = ContributorEngine;

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

  const PHOTO_BUCKETS = [
    "project-updates",
    "albukhr-contributor-photos",
    "contributor-photos",
    "albukhr-files"
  ];

  /* =========================================================
     SUPABASE
  ========================================================= */

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

    throw new Error(
      `${ENGINE_NAME}: Valid Supabase client not found. Load js/supabase-core.js first.`
    );
  }

  /* =========================================================
     HELPERS
  ========================================================= */

  function safeString(value, fallback = "") {
    if (value === null || value === undefined) return fallback;
    return String(value);
  }

  function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function safeBool(value) {
    return value === true;
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function trimOrNull(value) {
    const v = safeString(value).trim();
    return v ? v : null;
  }

  function normalizeEmail(value) {
    return safeString(value).trim().toLowerCase();
  }

  function normalizePhone(value) {
    return safeString(value).trim();
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function randomTokenSegment(length = 8) {
    const chars =
      "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnopqrstuvwxyz";
    let out = "";
    for (let i = 0; i < length; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  }

  function makeInviteToken() {
    const stamp = Date.now();
    const seg =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, "").slice(0, 10)
        : randomTokenSegment(10);

    return `ALB-INV-${stamp}-${seg}`;
  }

  function escapeHtml(text = "") {
    return safeString(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getOrigin() {
    return window.location.origin || "";
  }

  function buildContributorInviteLink(token) {
    return `${getOrigin()}/submit-albukhrecosystem-form.html?invite=${encodeURIComponent(
      token
    )}`;
  }

  function getCurrentNetwork() {
    const host = safeString(window.location.hostname).toLowerCase();

    if (
      host === "test.albukhr.com" ||
      host.includes("testnet") ||
      host.includes("localhost") ||
      host === "127.0.0.1"
    ) {
      return "testnet";
    }

    if (host === "app.albukhr.com") return "mainnet";

    const stored =
      safeString(
        localStorage.getItem("albukhr_network") ||
          localStorage.getItem("albukhr_environment") ||
          localStorage.getItem("network")
      )
        .trim()
        .toLowerCase();

    return stored === "mainnet" ? "mainnet" : "testnet";
  }

  function setContributorSessionEmail(email) {
    if (!email) return;
    localStorage.setItem(
      SESSION_KEYS.contributorEmail,
      normalizeEmail(email)
    );
  }

  function getContributorSessionEmail() {
    return normalizeEmail(
      localStorage.getItem(SESSION_KEYS.contributorEmail) || ""
    );
  }

  function clearContributorSessionEmail() {
    localStorage.removeItem(SESSION_KEYS.contributorEmail);
  }

  function setContributorSessionMeta(meta = {}) {
    if (meta.email) {
      localStorage.setItem(
        SESSION_KEYS.contributorEmail,
        normalizeEmail(meta.email)
      );
    }

    if (meta.name) {
      localStorage.setItem(
        SESSION_KEYS.contributorName,
        safeString(meta.name).trim()
      );
    }

    if (meta.role) {
      localStorage.setItem(
        SESSION_KEYS.contributorRole,
        safeString(meta.role).trim()
      );
    }
  }

  function getContributorSessionMeta() {
    return {
      email: normalizeEmail(
        localStorage.getItem(SESSION_KEYS.contributorEmail) || ""
      ),
      name: safeString(
        localStorage.getItem(SESSION_KEYS.contributorName) || ""
      ).trim(),
      role: safeString(
        localStorage.getItem(SESSION_KEYS.contributorRole) || ""
      ).trim()
    };
  }

  function setInviteSession(payload) {
    localStorage.setItem(
      SESSION_KEYS.inviteSession,
      JSON.stringify(payload || {})
    );
  }

  function getInviteSession() {
    try {
      return (
        JSON.parse(localStorage.getItem(SESSION_KEYS.inviteSession)) || null
      );
    } catch {
      return null;
    }
  }

  function clearInviteSession() {
    localStorage.removeItem(SESSION_KEYS.inviteSession);
  }

  function setInternalRegistrySession(email) {
    if (email) {
      sessionStorage.setItem(
        SESSION_KEYS.internalEmail,
        normalizeEmail(email)
      );
    }

    sessionStorage.setItem(
      SESSION_KEYS.internalToken,
      `INT-${Date.now()}-${randomTokenSegment(8)}`
    );
  }

  /* =========================================================
     ADMIN META
  ========================================================= */

  function getAdminMeta() {
    return {
      email:
        normalizeEmail(localStorage.getItem("albukhr_current_email")) ||
        normalizeEmail(localStorage.getItem("currentUserEmail")) ||
        "",
      name:
        safeString(localStorage.getItem("albukhr_current_username")).trim() ||
        safeString(localStorage.getItem("currentUserName")).trim() ||
        "ALBUKHR Admin",
      role:
        safeString(localStorage.getItem("albukhr_current_role")).trim() ||
        "admin"
    };
  }

  function resolveActorMeta(input = {}, mode = "admin") {
    const base =
      mode === "admin" ? getAdminMeta() : getContributorSessionMeta();

    return {
      email: normalizeEmail(
        input.email ||
          input.actorEmail ||
          input.approvedBy ||
          input.rejectedBy ||
          input.grantedBy ||
          input.createdByEmail ||
          base.email ||
          ""
      ),
      name: safeString(
        input.name ||
          input.actorName ||
          input.createdByName ||
          base.name ||
          (mode === "admin" ? "ALBUKHR Admin" : "ALBUKHR User")
      ).trim(),
      role: safeString(
        input.role ||
          input.actorRole ||
          base.role ||
          (mode === "admin" ? "admin" : "contributor")
      ).trim()
    };
  }

  /* =========================================================
     PHOTO STORAGE
  ========================================================= */

  async function uploadContributorPhoto(file, contributorEmail = "") {
    if (!file) {
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

    const emailPart = normalizeEmail(
      contributorEmail || "contributor"
    ).replace(/[^a-z0-9]/g, "_");

    const fileName = `${emailPart}_${Date.now()}.${fileExt}`;
    const filePath = `contributors/${fileName}`;

    let lastError = null;

    for (const bucket of PHOTO_BUCKETS) {
      try {
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: true
          });

        if (uploadError) {
          lastError = uploadError;
          continue;
        }

        const { data: publicData } = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath);

        return {
          ok: true,
          bucket,
          photo_path: filePath,
          photo_url: publicData?.publicUrl || null
        };
      } catch (err) {
        lastError = err;
      }
    }

    throw new Error(
      lastError?.message ||
        "Unable to upload contributor photo. Verify the storage bucket configuration."
    );
  }

  /* =========================================================
     NORMALIZERS
     ========================================================= */

  function normalizeContributorRecord(raw = {}) {
    return {
      id: raw.id || null,
      contributor_code: raw.contributor_code || "",
      albukhr_id: raw.albukhr_id || "",
      full_name: raw.full_name || raw.fullName || "",
      email: normalizeEmail(raw.email || ""),
      phone: raw.phone || "",
      address: raw.address || "",
      country: raw.country || "",
      photo_url: raw.photo_url || raw.photo || "",
      photo_path: raw.photo_path || "",
      skills: raw.skills || "",
      experience: raw.experience || "",
      contribution: raw.contribution || "",
      status: raw.status || "pending",
      telegram_unlocked: safeBool(raw.telegram_unlocked),
      internal_unlocked: safeBool(raw.internal_unlocked),
      project_creation_unlocked: safeBool(raw.project_creation_unlocked),
      invite_token: raw.invite_token || "",
      invite_id: raw.invite_id || null,
      approved_at: raw.approved_at || null,
      approved_by_email: raw.approved_by_email || "",
      approved_by_name: raw.approved_by_name || "",
      rejected_at: raw.rejected_at || null,
      rejected_by_email: raw.rejected_by_email || "",
      rejected_by_name: raw.rejected_by_name || "",
      approval_note: raw.approval_note || "",
      rejection_note: raw.rejection_note || "",
      rejection_reason: raw.rejection_reason || "",
      submitted_at: raw.submitted_at || null,
      created_at: raw.created_at || null,
      updated_at: raw.updated_at || null,
      metadata:
        raw.metadata && typeof raw.metadata === "object"
          ? raw.metadata
          : {}
    };
  }

  function normalizeInviteRecord(raw = {}) {
    return {
      id: raw.id || null,
      token: raw.token || "",
      invite_type: raw.invite_type || "contributor",
      status: raw.status || (raw.is_active === false ? "revoked" : "active"),
      invited_email: raw.invited_email || "",
      invited_name: raw.invited_name || "",
      created_by_email: raw.created_by_email || "",
      created_by_name: raw.created_by_name || "",
      created_by_role: raw.created_by_role || "",
      used_by_email: raw.used_by_email || "",
      used_at: raw.used_at || raw.last_used_at || null,
      expires_at: raw.expires_at || null,
      created_at: raw.created_at || null,
      updated_at: raw.updated_at || null,
      invite_url: raw.invite_url || "",
      network: raw.network || null,
      is_active:
        raw.is_active === undefined ? raw.status === "active" : !!raw.is_active,
      used: safeBool(raw.used),
      max_uses: safeNumber(raw.max_uses, 1),
      used_count: safeNumber(raw.used_count, 0),
      revoked: safeBool(raw.revoked),
      metadata:
        raw.metadata && typeof raw.metadata === "object"
          ? raw.metadata
          : {}
    };
  }

  function normalizeAccessRecord(raw = {}) {
    const contributor = normalizeContributorRecord(
      raw.contributor || raw.record || raw.data || raw
    );

    return {
      allowed: safeBool(raw.allowed),
      contributor,
      status: safeString(
        raw.status || contributor.status || ""
      ).toLowerCase(),
      telegram_unlocked: safeBool(
        raw.telegram_unlocked ?? contributor.telegram_unlocked
      ),
      internal_unlocked: safeBool(
        raw.internal_unlocked ?? contributor.internal_unlocked
      ),
      project_creation_unlocked: safeBool(
        raw.project_creation_unlocked ??
          contributor.project_creation_unlocked
      ),
      has_internal_access: safeBool(
        raw.has_internal_access ??
          (contributor.status === "approved" &&
            contributor.internal_unlocked)
      ),
      has_telegram_access: safeBool(
        raw.has_telegram_access ??
          (contributor.status === "approved" &&
            contributor.telegram_unlocked)
      ),
      has_project_builder_access: safeBool(
        raw.has_project_builder_access ??
          (contributor.status === "approved" &&
            contributor.project_creation_unlocked)
      ),
      albukhr_id: raw.albukhr_id || contributor.albukhr_id || ""
    };
  }

  /* =========================================================
     RPC
  ========================================================= */

  async function callRpc(fnName, payload = {}) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc(fnName, payload);

    if (error) {
      throw new Error(error.message || `RPC failed: ${fnName}`);
    }

    return data;
  }

  /* =========================================================
     DIRECT CONTRIBUTOR QUERIES
  ========================================================= */

  async function findContributorByEmailDirect(email) {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("albukhr_contributors")
      .select("*")
      .ilike("email", normalized)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || "Failed to load contributor");
    }

    return data ? normalizeContributorRecord(data) : null;
  }

  async function findContributorByIdDirect(contributorId) {
    const cleanId = safeString(contributorId).trim();
    if (!cleanId) return null;

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("albukhr_contributors")
      .select("*")
      .eq("id", cleanId)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || "Failed to load contributor by id");
    }

    return data ? normalizeContributorRecord(data) : null;
  }

  async function listContributorsDirect(limit = 300) {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("albukhr_contributors")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(safeNumber(limit, 300));

    if (error) {
      throw new Error(error.message || "Failed to load contributors");
    }

    return safeArray(data).map(normalizeContributorRecord);
  }

  /* =========================================================
     IDENTIFIER
  ========================================================= */

  async function resolveContributorIdentifier(input) {
    if (!input) {
      throw new Error("Contributor identifier is required");
    }

    if (typeof input === "string") {
      const raw = safeString(input).trim();

      if (!raw) {
        throw new Error("Contributor identifier is empty");
      }

      if (raw.includes("@")) {
        const byEmail = await getContributorByEmail(raw);
        if (!byEmail) throw new Error("Contributor not found");
        return byEmail;
      }

      const byId = await findContributorByIdDirect(raw);
      if (!byId) throw new Error("Contributor not found");
      return byId;
    }

    const contributorId = safeString(
      input.contributorId || input.id || input.recordId || ""
    ).trim();

    const email = normalizeEmail(
      input.email ||
        input.contributorEmail ||
        input.userEmail ||
        ""
    );

    if (email) {
      const byEmail = await getContributorByEmail(email);
      if (!byEmail) throw new Error("Contributor not found");
      return byEmail;
    }

    if (contributorId) {
      const byId = await findContributorByIdDirect(contributorId);
      if (!byId) throw new Error("Contributor not found");
      return byId;
    }

    throw new Error("Unable to resolve contributor identifier");
  }

  /* =========================================================
     INVITE TABLE RESOLUTION
     ========================================================= */

  async function findInviteByTokenDirect(token) {
    const cleanToken = safeString(token).trim();
    if (!cleanToken) return null;

    const supabase = getSupabaseClient();

    /*
      Primary invite table.
      `network` exists only on albukhr_invites, so network filtering
      is applied here.
    */
    const network = getCurrentNetwork();

    let primaryQuery = supabase
      .from("albukhr_invites")
      .select("*")
      .eq("token", cleanToken)
      .eq("network", network)
      .limit(1)
      .maybeSingle();

    const primary = await primaryQuery;

    if (!primary.error && primary.data) {
      return {
        source: "albukhr_invites",
        record: normalizeInviteRecord(primary.data)
      };
    }

    /*
      Compatibility table has no network column in the confirmed schema.
      It is therefore used only as the legacy fallback.
    */
    const legacy = await supabase
      .from("albukhr_contributor_invites")
      .select("*")
      .eq("token", cleanToken)
      .limit(1)
      .maybeSingle();

    if (!legacy.error && legacy.data) {
      return {
        source: "albukhr_contributor_invites",
        record: normalizeInviteRecord(legacy.data)
      };
    }

    if (primary.error && legacy.error) {
      throw new Error(
        primary.error.message ||
          legacy.error.message ||
          "Failed to find invite"
      );
    }

    return null;
  }

  /* =========================================================
     INVITE VALIDATION
  ========================================================= */

  async function validateInviteToken(token) {
    const cleanToken = safeString(token).trim();

    if (!cleanToken) {
      return {
        ok: false,
        valid: false,
        reason: "missing_token"
      };
    }

    /*
      Confirmed RPC:
      albukhr_validate_invite_token(p_token text)
    */
    try {
      const data = await callRpc("albukhr_validate_invite_token", {
        p_token: cleanToken
      });

      if (data && typeof data === "object") {
        return {
          ok: true,
          valid: safeBool(data.valid ?? data.ok ?? false),
          invite: data.invite || data.record || data.data || null,
          reason: data.reason || ""
        };
      }

      if (typeof data === "boolean") {
        return {
          ok: true,
          valid: data,
          invite: null,
          reason: data ? "" : "invalid_invite"
        };
      }
    } catch (err) {
      console.warn(
        "albukhr_validate_invite_token RPC unavailable; using direct lookup:",
        err
      );
    }

    const found = await findInviteByTokenDirect(cleanToken);

    if (!found) {
      return {
        ok: true,
        valid: false,
        reason: "invite_not_found"
      };
    }

    const invite = found.record;
    const expiresAt = invite.expires_at
      ? new Date(invite.expires_at).getTime()
      : 0;

    const expired =
      Number.isFinite(expiresAt) &&
      expiresAt > 0 &&
      Date.now() > expiresAt;

    const revoked =
      invite.revoked ||
      invite.status === "revoked" ||
      invite.is_active === false;

    const used =
      invite.used ||
      invite.status === "used" ||
      invite.used_count >= invite.max_uses;

    return {
      ok: true,
      valid: !expired && !revoked && !used,
      invite,
      reason: expired
        ? "invite_expired"
        : revoked
        ? "invite_revoked"
        : used
        ? "invite_used"
        : ""
    };
  }

  /* =========================================================
     INVITE SESSION
  ========================================================= */

  async function ensureInviteSessionFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const token = safeString(params.get("invite")).trim();

    const existing = getInviteSession();

    if (existing?.token && existing?.expiresAt) {
      const expiresAt = new Date(existing.expiresAt).getTime();

      if (
        Number.isFinite(expiresAt) &&
        expiresAt > Date.now() &&
        existing.consumed !== true
      ) {
        return {
          ok: true,
          valid: true,
          source: "local_session",
          token: existing.token,
          session: existing
        };
      }

      clearInviteSession();
    }

    if (!token) {
      return {
        ok: false,
        valid: false,
        reason: "missing_invite"
      };
    }

    const check = await validateInviteToken(token);

    if (!check.valid) {
      return {
        ok: true,
        valid: false,
        reason: check.reason || "invalid_invite"
      };
    }

    const invite = normalizeInviteRecord(check.invite || {});
    const sessionExpiresAt =
      invite.expires_at ||
      new Date(
        Date.now() + DEFAULT_INVITE_LIFETIME_HOURS * 3600000
      ).toISOString();

    const session = {
      token: invite.token || token,
      inviteId: invite.id || null,
      expiresAt: sessionExpiresAt,
      createdAt: nowIso(),
      consumed: false
    };

    setInviteSession(session);
    localStorage.setItem(
      SESSION_KEYS.inviteToken,
      invite.token || token
    );

    /*
      Confirmed RPC:
      albukhr_mark_invite_session(p_token text)
    */
    try {
      await callRpc("albukhr_mark_invite_session", {
        p_token: invite.token || token
      });
    } catch (err) {
      console.warn("albukhr_mark_invite_session warning:", err);
    }

    return {
      ok: true,
      valid: true,
      source: "url_token",
      token: invite.token || token,
      invite,
      session
    };
  }

  /* =========================================================
     GENERATE INVITE
  ========================================================= */

  async function generateContributorInvite({
    expiresInHours = DEFAULT_INVITE_LIFETIME_HOURS,
    createdByEmail = "",
    createdByName = "",
    inviteType = "contributor"
  } = {}) {
    const token = makeInviteToken();
    const admin = getAdminMeta();

    const creatorEmail = normalizeEmail(
      createdByEmail || admin.email
    );
    const creatorName =
      safeString(createdByName || admin.name).trim() ||
      "ALBUKHR Admin";

    const inviteUrl = buildContributorInviteLink(token);
    const expiresAt = new Date(
      Date.now() +
        safeNumber(
          expiresInHours,
          DEFAULT_INVITE_LIFETIME_HOURS
        ) *
          60 *
          60 *
          1000
    ).toISOString();

    /*
      Confirmed RPC:
      albukhr_generate_contributor_invite(
        p_token text,
        p_invite_type text,
        p_created_by_email text,
        p_created_by_name text,
        p_expires_in_hours integer
      )
    */
    try {
      const data = await callRpc(
        "albukhr_generate_contributor_invite",
        {
          p_token: token,
          p_invite_type: inviteType,
          p_created_by_email: creatorEmail,
          p_created_by_name: creatorName,
          p_expires_in_hours: safeNumber(
            expiresInHours,
            DEFAULT_INVITE_LIFETIME_HOURS
          )
        }
      );

      const rawInvite =
        data?.invite ||
        data?.record ||
        data?.data ||
        data ||
        {};

      const invite = normalizeInviteRecord({
        token,
        invite_url: inviteUrl,
        expires_at: expiresAt,
        ...rawInvite
      });

      return {
        ok: true,
        invite,
        token: invite.token || token,
        invite_url: invite.invite_url || inviteUrl,
        expires_at: invite.expires_at || expiresAt
      };
    } catch (err) {
      console.warn(
        "albukhr_generate_contributor_invite RPC unavailable; using confirmed table fallback:",
        err
      );
    }

    /*
      Confirmed primary table columns:
      albukhr_invites:
      token, invite_type, status, created_by_email,
      created_by_name, created_by_role, expires_at,
      created_at, updated_at, metadata, network

      The `used` / `revoked` columns do NOT exist here.
    */
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("albukhr_invites")
      .insert({
        token,
        invite_type: inviteType,
        status: "active",
        created_by_email: creatorEmail || null,
        created_by_name: creatorName || null,
        created_by_role: admin.role || "admin",
        expires_at: expiresAt,
        network: getCurrentNetwork(),
        metadata: {
          source: "ALBUKHR Contributor Engine",
          invite_url: inviteUrl
        }
      })
      .select()
      .single();

    if (error) {
      throw new Error(
        error.message || "Failed to create contributor invite"
      );
    }

    const invite = normalizeInviteRecord({
      ...data,
      invite_url: data.invite_url || inviteUrl
    });

    return {
      ok: true,
      invite,
      token: invite.token,
      invite_url: invite.invite_url || inviteUrl,
      expires_at: invite.expires_at || expiresAt
    };
  }

  /* =========================================================
     MARK INVITE USED
  ========================================================= */

  async function markInviteUsed(token, usedByEmail = "") {
    const cleanToken = safeString(token).trim();
    if (!cleanToken) {
      return {
        ok: false,
        reason: "missing_token"
      };
    }

    /*
      Confirmed RPC:
      albukhr_mark_invite_used(p_token text, p_used_by_email text)
    */
    try {
      const data = await callRpc("albukhr_mark_invite_used", {
        p_token: cleanToken,
        p_used_by_email: normalizeEmail(usedByEmail)
      });

      return {
        ok: true,
        data
      };
    } catch (err) {
      console.warn(
        "albukhr_mark_invite_used RPC unavailable; using direct update:",
        err
      );
    }

    const found = await findInviteByTokenDirect(cleanToken);

    if (!found) {
      throw new Error("Invite not found");
    }

    const supabase = getSupabaseClient();
    const usedEmail = normalizeEmail(usedByEmail);

    /*
      Primary table uses:
      status + used_by_email + used_at
      It does NOT have `used`.
    */
    if (found.source === "albukhr_invites") {
      const { data, error } = await supabase
        .from("albukhr_invites")
        .update({
          status: "used",
          used_by_email: usedEmail || null,
          used_at: nowIso(),
          updated_at: nowIso()
        })
        .eq("id", found.record.id)
        .select()
        .single();

      if (error) {
        throw new Error(
          error.message || "Failed to mark invite used"
        );
      }

      return {
        ok: true,
        invite: normalizeInviteRecord(data)
      };
    }

    /*
      Legacy table uses:
      used + used_count + last_used_at + updated_at
    */
    const nextCount = Math.max(
      1,
      safeNumber(found.record.used_count, 0) + 1
    );

    const { data, error } = await supabase
      .from("albukhr_contributor_invites")
      .update({
        used: true,
        used_count: nextCount,
        last_used_at: nowIso(),
        updated_at: nowIso()
      })
      .eq("id", found.record.id)
      .select()
      .single();

    if (error) {
      throw new Error(
        error.message || "Failed to mark legacy invite used"
      );
    }

    return {
      ok: true,
      invite: normalizeInviteRecord(data)
    };
  }

  /* =========================================================
     SUBMIT CONTRIBUTOR APPLICATION
  ========================================================= */

  async function submitContributorApplication(payload = {}) {
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
      inviteToken = null,
      metadata = {}
    } = payload;

    const normalizedEmail = normalizeEmail(email);

    if (!safeString(fullName).trim()) {
      throw new Error("Full name is required");
    }

    if (!normalizedEmail) {
      throw new Error("Email is required");
    }

    if (!safeString(phone).trim()) {
      throw new Error("Phone number is required");
    }

    if (!safeString(address).trim()) {
      throw new Error("Address is required");
    }

    if (!safeString(skills).trim()) {
      throw new Error("Skills are required");
    }

    if (!safeString(contribution).trim()) {
      throw new Error("Expected contribution is required");
    }

    const activeInviteToken = safeString(
      inviteToken ||
        getInviteSession()?.token ||
        localStorage.getItem(SESSION_KEYS.inviteToken) ||
        ""
    ).trim();

    if (!activeInviteToken) {
      throw new Error(
        "Valid invite token is required before contributor submission"
      );
    }

    const inviteCheck = await validateInviteToken(
      activeInviteToken
    );

    if (!inviteCheck.valid) {
      throw new Error(
        "Invite is invalid, expired, revoked, or already used"
      );
    }

    let photoUrl = null;
    let photoPath = null;

    if (photoFile) {
      const uploaded = await uploadContributorPhoto(
        photoFile,
        normalizedEmail
      );

      photoUrl = uploaded.photo_url || null;
      photoPath = uploaded.photo_path || null;
    }

    /*
      Confirmed RPC signature:
      albukhr_submit_contributor_application(
        p_full_name text,
        p_phone text,
        p_email text,
        p_address text,
        p_country text,
        p_skills text,
        p_experience text,
        p_contribution text,
        p_photo_url text,
        p_photo_path text,
        p_invite_token text
      )
    */
    let rpcResult;

    try {
      rpcResult = await callRpc(
        "albukhr_submit_contributor_application",
        {
          p_full_name: safeString(fullName).trim(),
          p_phone: normalizePhone(phone),
          p_email: normalizedEmail,
          p_address: safeString(address).trim(),
          p_country: trimOrNull(country),
          p_skills: safeString(skills).trim(),
          p_experience: trimOrNull(experience),
          p_contribution: safeString(contribution).trim(),
          p_photo_url: photoUrl,
          p_photo_path: photoPath,
          p_invite_token: activeInviteToken
        }
      );
    } catch (err) {
      console.warn(
        "albukhr_submit_contributor_application RPC unavailable; using direct confirmed table insert:",
        err
      );
      rpcResult = null;
    }

    let contributor;

    if (rpcResult) {
      contributor = normalizeContributorRecord(
        rpcResult?.contributor ||
          rpcResult?.record ||
          rpcResult?.data ||
          rpcResult
      );
    } else {
      const supabase = getSupabaseClient();

      const inviteCheckDirect = await findInviteByTokenDirect(
        activeInviteToken
      );

      const inviteId =
        inviteCheckDirect?.record?.id || null;

      const { data, error } = await supabase
        .from("albukhr_contributors")
        .insert({
          full_name: safeString(fullName).trim(),
          email: normalizedEmail,
          phone: normalizePhone(phone),
          address: safeString(address).trim(),
          country: trimOrNull(country),
          photo_url: photoUrl,
          photo_path: photoPath,
          skills: safeString(skills).trim(),
          experience: trimOrNull(experience),
          contribution: safeString(contribution).trim(),
          status: "pending",
          telegram_unlocked: false,
          internal_unlocked: false,
          project_creation_unlocked: false,
          invite_token: activeInviteToken,
          invite_id: inviteId,
          submitted_at: nowIso(),
          metadata:
            metadata && typeof metadata === "object"
              ? metadata
              : {}
        })
        .select()
        .single();

      if (error) {
        throw new Error(
          error.message ||
            "Failed to submit contributor application"
        );
      }

      contributor = normalizeContributorRecord(data);

      try {
        await markInviteUsed(
          activeInviteToken,
          normalizedEmail
        );
      } catch (err) {
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
     GET CONTRIBUTOR
  ========================================================= */

  async function getContributorByEmail(email) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return null;

    /*
      Confirmed RPC:
      albukhr_admin_get_contributor_by_email(p_email text)
    */
    try {
      const data = await callRpc(
        "albukhr_admin_get_contributor_by_email",
        {
          p_email: normalizedEmail
        }
      );

      if (!data) return null;

      return normalizeContributorRecord(
        data?.contributor ||
          data?.record ||
          data?.data ||
          data
      );
    } catch (err) {
      console.warn(
        "albukhr_admin_get_contributor_by_email RPC unavailable; direct read:",
        err
      );
    }

    /*
      Confirmed non-admin RPC also exists:
      albukhr_get_contributor_by_email(p_email text)
    */
    try {
      const data = await callRpc(
        "albukhr_get_contributor_by_email",
        {
          p_email: normalizedEmail
        }
      );

      if (data) {
        return normalizeContributorRecord(
          data?.contributor ||
            data?.record ||
            data?.data ||
            data
        );
      }
    } catch (err) {
      console.warn(
        "albukhr_get_contributor_by_email RPC unavailable; direct read:",
        err
      );
    }

    return await findContributorByEmailDirect(
      normalizedEmail
    );
  }

  /* =========================================================
     GET CONTRIBUTOR ACCESS
  ========================================================= */

  async function getContributorAccess(email) {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return {
        allowed: false,
        contributor: null,
        status: ""
      };
    }

    /*
      Confirmed RPC:
      albukhr_get_contributor_internal_access(p_email text)
    */
    try {
      const data = await callRpc(
        "albukhr_get_contributor_internal_access",
        {
          p_email: normalizedEmail
        }
      );

      return normalizeAccessRecord(data || {});
    } catch (err) {
      console.warn(
        "albukhr_get_contributor_internal_access RPC unavailable; direct read:",
        err
      );
    }

    const contributor =
      await findContributorByEmailDirect(normalizedEmail);

    if (!contributor) {
      return {
        allowed: false,
        contributor: null,
        status: ""
      };
    }

    const approved =
      safeString(contributor.status).toLowerCase() ===
      "approved";

    return {
      allowed: approved,
      contributor,
      status: contributor.status,
      telegram_unlocked: contributor.telegram_unlocked,
      internal_unlocked: contributor.internal_unlocked,
      project_creation_unlocked:
        contributor.project_creation_unlocked,
      has_internal_access:
        approved && contributor.internal_unlocked,
      has_telegram_access:
        approved && contributor.telegram_unlocked,
      has_project_builder_access:
        approved &&
        contributor.project_creation_unlocked,
      albukhr_id: contributor.albukhr_id || ""
    };
  }

  async function getMyContributorAccess() {
    const email = getContributorSessionEmail();

    if (!email) {
      return {
        allowed: false,
        contributor: null,
        status: ""
      };
    }

    return await getContributorAccess(email);
  }

  /* =========================================================
     ADMIN LIST
  ========================================================= */

  async function adminListContributors({
    status = "",
    limit = 300
  } = {}) {
    /*
      Confirmed RPC:
      albukhr_admin_list_contributors(
        p_status text,
        p_limit integer
      )
    */
    try {
      const data = await callRpc(
        "albukhr_admin_list_contributors",
        {
          p_status: trimOrNull(status),
          p_limit: safeNumber(limit, 300)
        }
      );

      const rows = Array.isArray(data)
        ? data
        : Array.isArray(data?.contributors)
        ? data.contributors
        : Array.isArray(data?.records)
        ? data.records
        : [];

      return rows.map(normalizeContributorRecord);
    } catch (err) {
      console.warn(
        "albukhr_admin_list_contributors RPC unavailable; direct read:",
        err
      );
    }

    let rows = await listContributorsDirect(limit);

    if (status) {
      const wanted = safeString(status)
        .trim()
        .toLowerCase();

      rows = rows.filter(
        (row) =>
          safeString(row.status)
            .trim()
            .toLowerCase() === wanted
      );
    }

    return rows;
  }

  /* =========================================================
     DIRECT PATCH
  ========================================================= */

  async function patchContributorByEmail(email, patch = {}) {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
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

    if (error) {
      throw new Error(
        error.message || "Failed to update contributor"
      );
    }

    return normalizeContributorRecord(data);
  }

  /* =========================================================
     ADMIN APPROVE
  ========================================================= */

  async function adminApproveContributor(
    input,
    adminMeta = {}
  ) {
    const contributor =
      await resolveContributorIdentifier(input);

    const actor = resolveActorMeta(
      typeof input === "object"
        ? { ...input, ...adminMeta }
        : adminMeta,
      "admin"
    );

    /*
      Confirmed email-based RPC:
      albukhr_admin_approve_contributor(
        p_email text,
        p_approved_by_email text,
        p_approved_by_name text,
        p_approved_by_role text
      )
    */
    try {
      const data = await callRpc(
        "albukhr_admin_approve_contributor",
        {
          p_email: contributor.email,
          p_approved_by_email: normalizeEmail(
            actor.email
          ),
          p_approved_by_name: safeString(
            actor.name
          ).trim(),
          p_approved_by_role: safeString(
            actor.role
          ).trim()
        }
      );

      return {
        ok: true,
        contributor: normalizeContributorRecord(
          data?.contributor ||
            data?.record ||
            data?.data ||
            data
        )
      };
    } catch (err) {
      console.warn(
        "albukhr_admin_approve_contributor email RPC unavailable; trying UUID RPC:",
        err
      );
    }

    /*
      Confirmed UUID-based RPC:
      albukhr_admin_approve_contributor(
        p_contributor_id uuid
      )
    */
    try {
      const data = await callRpc(
        "albukhr_admin_approve_contributor",
        {
          p_contributor_id: contributor.id
        }
      );

      return {
        ok: true,
        contributor: normalizeContributorRecord(
          data?.contributor ||
            data?.record ||
            data?.data ||
            data
        )
      };
    } catch (err) {
      console.warn(
        "UUID approve RPC unavailable; using direct update:",
        err
      );
    }

    const updated = await patchContributorByEmail(
      contributor.email,
      {
        status: "approved",
        approved_at: nowIso(),
        rejected_at: null,
        approved_by_email:
          normalizeEmail(actor.email) || null,
        approved_by_name:
          safeString(actor.name).trim() || null,
        rejection_note: null,
        rejection_reason: null
      }
    );

    return {
      ok: true,
      contributor: updated
    };
  }

  /* =========================================================
     ADMIN REJECT
  ========================================================= */

  async function adminRejectContributor(
    input,
    adminMeta = {},
    reason = ""
  ) {
    const contributor =
      await resolveContributorIdentifier(input);

    const merged =
      typeof input === "object"
        ? { ...input, ...adminMeta }
        : { ...adminMeta, reason };

    const actor = resolveActorMeta(
      merged,
      "admin"
    );

    const finalReason = trimOrNull(
      (typeof input === "object"
        ? input.reason || input.rejectionReason
        : "") ||
        reason ||
        merged.reason ||
        ""
    );

    /*
      Confirmed email-based RPC.
    */
    try {
      const data = await callRpc(
        "albukhr_admin_reject_contributor",
        {
          p_email: contributor.email,
          p_rejected_by_email: normalizeEmail(
            actor.email
          ),
          p_rejected_by_name: safeString(
            actor.name
          ).trim(),
          p_rejected_by_role: safeString(
            actor.role
          ).trim(),
          p_reason: finalReason
        }
      );

      return {
        ok: true,
        contributor: normalizeContributorRecord(
          data?.contributor ||
            data?.record ||
            data?.data ||
            data
        )
      };
    } catch (err) {
      console.warn(
        "Email reject RPC unavailable; trying UUID RPC:",
        err
      );
    }

    /*
      Confirmed UUID-based RPC.
    */
    try {
      const data = await callRpc(
        "albukhr_admin_reject_contributor",
        {
          p_contributor_id: contributor.id
        }
      );

      /*
        The confirmed UUID signature has no reason/actor arguments.
        The RPC result remains authoritative.
      */
      return {
        ok: true,
        contributor: normalizeContributorRecord(
          data?.contributor ||
            data?.record ||
            data?.data ||
            data
        )
      };
    } catch (err) {
      console.warn(
        "UUID reject RPC unavailable; using direct update:",
        err
      );
    }

    const updated = await patchContributorByEmail(
      contributor.email,
      {
        status: "rejected",
        rejected_at: nowIso(),
        approved_at: null,
        rejected_by_email:
          normalizeEmail(actor.email) || null,
        rejected_by_name:
          safeString(actor.name).trim() || null,
        rejection_note: finalReason,
        rejection_reason: finalReason
      }
    );

    return {
      ok: true,
      contributor: updated
    };
  }

  /* =========================================================
     ADMIN UNLOCK
  ========================================================= */

  async function unlockContributorAccessFlag({
    input,
    email,
    rpcName,
    accessType,
    directPatch = {},
    adminMeta = {}
  }) {
    const contributor = input
      ? await resolveContributorIdentifier(input)
      : await resolveContributorIdentifier(email);

    const actor = resolveActorMeta(
      typeof input === "object"
        ? { ...input, ...adminMeta }
        : adminMeta,
      "admin"
    );

    /*
      Confirmed generic RPC:
      albukhr_admin_unlock_contributor_access(
        p_contributor_id uuid,
        p_access_type text,
        p_unlock boolean
      )
    */
    if (rpcName === "albukhr_admin_unlock_contributor_access") {
      try {
        const data = await callRpc(
          rpcName,
          {
            p_contributor_id: contributor.id,
            p_access_type: accessType,
            p_unlock: true
          }
        );

        return {
          ok: true,
          contributor: normalizeContributorRecord(
            data?.contributor ||
              data?.record ||
              data?.data ||
              data
          )
        };
      } catch (err) {
        console.warn(
          "Generic contributor access RPC unavailable; trying specific RPC:",
          err
        );
      }
    }

    /*
      Confirmed specific RPCs:
      - telegram
      - internal
      - project_builder

      All use:
      p_email, p_actor_email, p_actor_name, p_actor_role
    */
    if (rpcName) {
      try {
        const data = await callRpc(
          rpcName,
          {
            p_email: contributor.email,
            p_actor_email: normalizeEmail(
              actor.email
            ),
            p_actor_name: safeString(
              actor.name
            ).trim(),
            p_actor_role: safeString(
              actor.role
            ).trim()
          }
        );

        return {
          ok: true,
          contributor: normalizeContributorRecord(
            data?.contributor ||
              data?.record ||
              data?.data ||
              data
          )
        };
      } catch (err) {
        console.warn(
          `${rpcName} RPC unavailable; using direct update:`,
          err
        );
      }
    }

    const updated = await patchContributorByEmail(
      contributor.email,
      directPatch
    );

    return {
      ok: true,
      contributor: updated
    };
  }

  async function adminUnlockTelegram(
    input,
    adminMeta = {}
  ) {
    return await unlockContributorAccessFlag({
      input,
      rpcName:
        "albukhr_admin_unlock_contributor_telegram",
      accessType: "telegram",
      directPatch: {
        telegram_unlocked: true
      },
      adminMeta
    });
  }

  async function adminUnlockInternal(
    input,
    adminMeta = {}
  ) {
    return await unlockContributorAccessFlag({
      input,
      rpcName:
        "albukhr_admin_unlock_contributor_internal",
      accessType: "internal",
      directPatch: {
        internal_unlocked: true
      },
      adminMeta
    });
  }

  async function adminUnlockProjectBuilder(
    input,
    adminMeta = {}
  ) {
    return await unlockContributorAccessFlag({
      input,
      rpcName:
        "albukhr_admin_unlock_contributor_project_builder",
      accessType: "project_builder",
      directPatch: {
        project_creation_unlocked: true
      },
      adminMeta
    });
  }

  async function adminUnlockContributorAccess(
    payload = {}
  ) {
    const accessType = safeString(
      payload.accessType ||
        payload.type ||
        ""
    )
      .trim()
      .toLowerCase();

    if (!accessType) {
      throw new Error("accessType is required");
    }

    const actorMeta = {
      email:
        payload.grantedBy ||
        payload.actorEmail ||
        "",
      name: payload.actorName || "",
      role: payload.actorRole || "admin"
    };

    if (accessType === "telegram") {
      return await adminUnlockTelegram(
        payload,
        actorMeta
      );
    }

    if (accessType === "internal") {
      return await adminUnlockInternal(
        payload,
        actorMeta
      );
    }

    if (
      accessType === "project_builder" ||
      accessType === "projectbuilder" ||
      accessType === "project"
    ) {
      return await adminUnlockProjectBuilder(
        payload,
        actorMeta
      );
    }

    throw new Error(
      `Unsupported contributor access type: ${accessType}`
    );
  }

  /* =========================================================
     PUBLIC PAGE STATE
  ========================================================= */

  async function getContributorStatusForPage(email) {
    const access =
      await getContributorAccess(email);

    const contributor =
      access.contributor || null;

    return {
      exists: !!contributor,
      approved:
        contributor?.status === "approved",
      pending:
        contributor?.status === "pending",
      rejected:
        contributor?.status === "rejected",
      contributor,
      access
    };
  }

  async function resolveContributorPageState(email) {
    const state =
      await getContributorStatusForPage(email);

    return {
      contributorFound: state.exists,
      status: state.contributor?.status || "",
      contributor: state.contributor,
      showPendingNotice: state.pending,
      showApprovedView: state.approved,
      showRejectedState: state.rejected,
      showTelegramBox:
        !!state.access.has_telegram_access,
      showInternalBox:
        !!state.access.has_internal_access,
      showProjectBuilderBox:
        !!state.access.has_project_builder_access,
      showAlbukhrIdBox:
        !!state.access.albukhr_id
    };
  }

  /* =========================================================
     INTERNAL ACCESS
  ========================================================= */

  async function prepareInternalRegistryAccess(
    email
  ) {
    const access =
      await getContributorAccess(email);

    if (!access?.contributor) {
      return {
        ok: false,
        allowed: false,
        reason: "contributor_not_found"
      };
    }

    if (
      access.contributor.status !==
      "approved"
    ) {
      return {
        ok: false,
        allowed: false,
        reason: "contributor_not_approved",
        access
      };
    }

    if (
      !access.internal_unlocked &&
      !access.has_internal_access
    ) {
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

  function getTransparencyViewerMeta() {
    const session =
      getContributorSessionMeta();

    return {
      email:
        session.email ||
        normalizeEmail(
          localStorage.getItem(
            "currentUserEmail"
          ) || ""
        ),
      name:
        session.name ||
        safeString(
          localStorage.getItem(
            "currentUserName"
          ) || "ALBUKHR User"
        ),
      role:
        session.role || "contributor"
    };
  }

  /* =========================================================
     BLOCK SCREEN
  ========================================================= */

  function renderInviteBlockedScreen(
    message = "Access Restricted"
  ) {
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;padding:24px;box-sizing:border-box;text-align:center;background:#f4f7f6">
        <div style="max-width:420px;background:#fff;padding:24px;border-radius:18px;box-shadow:0 10px 30px rgba(0,0,0,0.08)">
          <div style="font-size:46px;margin-bottom:10px">⛔</div>
          <h2 style="margin:0 0 12px;color:#b02a37;font-family:system-ui">${escapeHtml(
            message
          )}</h2>
          <p style="margin:0;color:#55625c;line-height:1.7;font-family:system-ui">
            This contributor page is invite-only. Please use a valid ALBUKHR invite link.
          </p>
        </div>
      </div>
    `;
  }

  /* =========================================================
     CONVENIENCE WRAPPERS
  ========================================================= */

  async function generateContributorInviteForAdminUI() {
    const result =
      await generateContributorInvite();

    const safeUrl = escapeHtml(
      result.invite_url
    );

    return {
      ok: true,
      token: result.token,
      invite_url: result.invite_url,
      expires_at:
        result.expires_at || null,
      invite: result.invite || null,
      html: `
        <b>Secure Invite Link:</b><br>
        ${safeUrl}
        <br><br>
        <button class="copy-btn"
          onclick="navigator.clipboard.writeText('${safeUrl}'); alert('Invite link copied successfully');">
          📋 Copy Link
        </button>
      `
    };
  }

  async function submitContributorFromForm(
    formMap = {}
  ) {
    return await submitContributorApplication({
      fullName:
        formMap.fullName?.value || "",
      phone:
        formMap.phone?.value || "",
      email:
        formMap.email?.value || "",
      address:
        formMap.address?.value || "",
      country:
        formMap.country?.value || "",
      skills:
        formMap.skills?.value || "",
      experience:
        formMap.experience?.value || "",
      contribution:
        formMap.contribution?.value || "",
      photoFile:
        formMap.photo?.files?.[0] || null,
      inviteToken:
        getInviteSession()?.token ||
        localStorage.getItem(
          SESSION_KEYS.inviteToken
        ) ||
        ""
    });
  }

  /* =========================================================
     EXPORTS
  ========================================================= */

  ContributorEngine.getSupabaseClient =
    getSupabaseClient;

  ContributorEngine.getCurrentNetwork =
    getCurrentNetwork;

  ContributorEngine.getAdminMeta =
    getAdminMeta;

  ContributorEngine.getTransparencyViewerMeta =
    getTransparencyViewerMeta;

  ContributorEngine.setContributorSessionEmail =
    setContributorSessionEmail;

  ContributorEngine.getContributorSessionEmail =
    getContributorSessionEmail;

  ContributorEngine.clearContributorSessionEmail =
    clearContributorSessionEmail;

  ContributorEngine.setContributorSessionMeta =
    setContributorSessionMeta;

  ContributorEngine.getContributorSessionMeta =
    getContributorSessionMeta;

  ContributorEngine.setInviteSession =
    setInviteSession;

  ContributorEngine.getInviteSession =
    getInviteSession;

  ContributorEngine.clearInviteSession =
    clearInviteSession;

  ContributorEngine.ensureInviteSessionFromUrl =
    ensureInviteSessionFromUrl;

  ContributorEngine.validateInviteToken =
    validateInviteToken;

  ContributorEngine.markInviteUsed =
    markInviteUsed;

  ContributorEngine.renderInviteBlockedScreen =
    renderInviteBlockedScreen;

  ContributorEngine.uploadContributorPhoto =
    uploadContributorPhoto;

  ContributorEngine.generateContributorInvite =
    generateContributorInvite;

  ContributorEngine.generateContributorInviteForAdminUI =
    generateContributorInviteForAdminUI;

  ContributorEngine.submitContributorApplication =
    submitContributorApplication;

  ContributorEngine.submitContributorFromForm =
    submitContributorFromForm;

  ContributorEngine.getContributorByEmail =
    getContributorByEmail;

  ContributorEngine.getContributorAccess =
    getContributorAccess;

  ContributorEngine.getMyContributorAccess =
    getMyContributorAccess;

  ContributorEngine.getContributorStatusForPage =
    getContributorStatusForPage;

  ContributorEngine.resolveContributorPageState =
    resolveContributorPageState;

  ContributorEngine.adminListContributors =
    adminListContributors;

  ContributorEngine.adminApproveContributor =
    adminApproveContributor;

  ContributorEngine.adminRejectContributor =
    adminRejectContributor;

  ContributorEngine.adminUnlockTelegram =
    adminUnlockTelegram;

  ContributorEngine.adminUnlockInternal =
    adminUnlockInternal;

  ContributorEngine.adminUnlockProjectBuilder =
    adminUnlockProjectBuilder;

  ContributorEngine.adminUnlockContributorAccess =
    adminUnlockContributorAccess;

  ContributorEngine.prepareInternalRegistryAccess =
    prepareInternalRegistryAccess;

  ContributorEngine.resolveContributorIdentifier =
    resolveContributorIdentifier;

  /* =========================================================
     LEGACY GLOBALS
  ========================================================= */

  window.getTransparencyViewerMeta =
    getTransparencyViewerMeta;

  window.generateContributorInvite =
    async function () {
      return await generateContributorInviteForAdminUI();
    };

  window.submitContributorApplication =
    submitContributorApplication;

  window.getContributorByEmail =
    getContributorByEmail;

  window.getContributorAccess =
    getContributorAccess;

  window.getMyContributorAccess =
    getMyContributorAccess;

  window.adminListContributors =
    adminListContributors;

  window.adminApproveContributor =
    adminApproveContributor;

  window.adminRejectContributor =
    adminRejectContributor;

  window.adminUnlockTelegram =
    adminUnlockTelegram;

  window.adminUnlockInternal =
    adminUnlockInternal;

  window.adminUnlockProjectBuilder =
    adminUnlockProjectBuilder;

  window.adminUnlockContributorAccess =
    adminUnlockContributorAccess;

  window.prepareInternalRegistryAccess =
    prepareInternalRegistryAccess;
})();
