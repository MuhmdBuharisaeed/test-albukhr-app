/* =========================================================
   ALBUKHR CONTRIBUTOR ENGINE
   FINAL ARCHITECTURE-SAFE VERSION
   Location: js/engines/contributor-engine.js

   Rules:
   - Supabase is the source of truth.
   - Browser storage is session/UI state only.
   - Mainnet/Testnet isolation is strict.
   - Existing RPC names/signatures are preserved.
   - No contributor logic is injected into other engines.
========================================================= */
(function () {
  "use strict";

  const E = "ALBUKHR Contributor Engine";
  const VERSION = "2.0.0";
  const INVITE_HOURS = 48;
  const KEYS = Object.freeze({
    email: "albukhr_current_email",
    name: "albukhr_current_username",
    role: "albukhr_current_role",
    invite: "albukhr_current_invite_token",
    inviteSession: "albukhr_invite_session",
    internalEmail: "albukhr_internal_email",
    internalToken: "albukhr_internal_token"
  });
  const PHOTO_BUCKETS = [
    "project-updates",
    "albukhr-contributor-photos",
    "contributor-photos",
    "albukhr-files"
  ];

  const api = {};
  window.AlbukhrContributorEngine = api;

  /* ---------------- SUPABASE ---------------- */
  function db() {
    if (window.albukhrSupabase?.from) return window.albukhrSupabase;
    if (typeof window.getAlbukhrSupabaseClient === "function") {
      const c = window.getAlbukhrSupabaseClient();
      if (c?.from) return c;
    }
    if (window.supabaseClient?.from) return window.supabaseClient;
    throw new Error(`${E}: Supabase client not found. Load js/core/supabase-core.js first.`);
  }

  async function rpc(name, params = {}) {
    const { data, error } = await db().rpc(name, params);
    if (error) throw new Error(error.message || `RPC failed: ${name}`);
    return data;
  }

  /* ---------------- HELPERS ---------------- */
  const str = (v, f = "") => v == null ? f : String(v);
  const email = v => str(v).trim().toLowerCase();
  const phone = v => str(v).trim();
  const nullIfEmpty = v => str(v).trim() || null;
  const num = (v, f = 0) => Number.isFinite(Number(v)) ? Number(v) : f;
  const bool = v => v === true;
  const arr = v => Array.isArray(v) ? v : [];
  const iso = () => new Date().toISOString();

  function ls() { try { return window.localStorage; } catch { return null; } }
  function ss() { try { return window.sessionStorage; } catch { return null; } }
  function get(s, k) { try { return s?.getItem(k) || ""; } catch { return ""; } }
  function set(s, k, v) { try { s?.setItem(k, v); } catch {} }
  function remove(s, k) { try { s?.removeItem(k); } catch {} }

  function normalizeNetwork(v) {
    v = str(v).trim().toLowerCase();
    if (v === "main" || v === "mainnet") return "mainnet";
    if (["test", "testnet", "dev", "development"].includes(v)) return "testnet";
    return "";
  }

  function network() {
    const explicit = [
      window.ALBUKHR_NETWORK,
      window.albukhrNetwork,
      window.ALBUKHR_ENVIRONMENT,
      window.albukhrEnvironment,
      window.__ALBUKHR_NETWORK__,
      window.__ALBUKHR_ENVIRONMENT__
    ];
    for (const v of explicit) {
      const n = normalizeNetwork(v);
      if (n) return n;
    }

    const host = str(location.hostname).toLowerCase();
    if (host === "app.albukhr.com") return "mainnet";
    if (
      host === "test.albukhr.com" ||
      host === "dev.albukhr.com" ||
      host.includes("testnet") ||
      host === "localhost" || host === "127.0.0.1" || host === "::1"
    ) return "testnet";

    for (const fn of ["getAlbukhrNetwork", "getCurrentAlbukhrNetwork", "getAlbukhrEnvironment"]) {
      try {
        if (typeof window[fn] === "function") {
          const n = normalizeNetwork(window[fn]());
          if (n) return n;
        }
      } catch {}
    }
    return "";
  }

  function requireNetwork() {
    const n = network();
    if (!n) throw new Error(`${E}: Network cannot be resolved; database operation refused.`);
    return n;
  }

  function token() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnopqrstuvwxyz";
    let r = "";
    if (crypto?.getRandomValues) {
      const a = new Uint32Array(12); crypto.getRandomValues(a);
      for (let i = 0; i < a.length; i++) r += chars[a[i] % chars.length];
    } else for (let i = 0; i < 12; i++) r += chars[Math.floor(Math.random() * chars.length)];
    return `ALB-INV-${Date.now()}-${r}`;
  }

  function inviteUrl(t) {
    return `${location.origin}/submit-albukhrecosystem-form.html?invite=${encodeURIComponent(t)}`;
  }

  function esc(v) {
    return str(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  }

  /* ---------------- SESSION ---------------- */
  function setContributorSessionMeta(m = {}) {
    const s = ls();
    if (m.email) set(s, KEYS.email, email(m.email));
    if (m.name) set(s, KEYS.name, str(m.name).trim());
    if (m.role) set(s, KEYS.role, str(m.role).trim());
  }
  function getContributorSessionMeta() {
    const s = ls();
    return { email: email(get(s, KEYS.email)), name: get(s, KEYS.name).trim(), role: get(s, KEYS.role).trim() };
  }
  function setContributorSessionEmail(v) { if (email(v)) set(ls(), KEYS.email, email(v)); }
  function getContributorSessionEmail() { return email(get(ls(), KEYS.email)); }
  function clearContributorSessionEmail() { remove(ls(), KEYS.email); }
  function setInviteSession(v) { set(ls(), KEYS.inviteSession, JSON.stringify(v || {})); }
  function getInviteSession() { try { return JSON.parse(get(ls(), KEYS.inviteSession)) || null; } catch { return null; } }
  function clearInviteSession() { remove(ls(), KEYS.inviteSession); }
  function setInternalRegistrySession(v) {
    if (v) set(ss(), KEYS.internalEmail, email(v));
    set(ss(), KEYS.internalToken, `INT-${Date.now()}`);
  }

  function getAdminMeta() {
    const s = ls();
    return {
      email: email(get(s, KEYS.email) || get(s, "currentUserEmail")),
      name: (get(s, KEYS.name) || get(s, "currentUserName") || "ALBUKHR Admin").trim(),
      role: (get(s, KEYS.role) || "admin").trim()
    };
  }

  function actor(input = {}, mode = "admin") {
    const base = mode === "admin" ? getAdminMeta() : getContributorSessionMeta();
    return {
      email: email(input.email || input.actorEmail || input.approvedBy || input.rejectedBy || input.grantedBy || base.email),
      name: str(input.name || input.actorName || input.createdByName || base.name || "ALBUKHR User").trim(),
      role: str(input.role || input.actorRole || base.role || (mode === "admin" ? "admin" : "contributor")).trim()
    };
  }

  /* ---------------- NORMALIZERS ---------------- */
  function contributor(r = {}) {
    return {
      id: r.id || null, contributor_code: r.contributor_code || "", albukhr_id: r.albukhr_id || "",
      full_name: r.full_name || r.fullName || "", email: email(r.email), phone: r.phone || "", address: r.address || "",
      country: r.country || "", photo_url: r.photo_url || r.photo || "", photo_path: r.photo_path || "",
      skills: r.skills || "", experience: r.experience || "", contribution: r.contribution || "",
      status: r.status || "pending", telegram_unlocked: bool(r.telegram_unlocked), internal_unlocked: bool(r.internal_unlocked),
      project_creation_unlocked: bool(r.project_creation_unlocked), invite_token: r.invite_token || "", invite_id: r.invite_id || null,
      approved_at: r.approved_at || null, approved_by_email: r.approved_by_email || "", approved_by_name: r.approved_by_name || "",
      rejected_at: r.rejected_at || null, rejected_by_email: r.rejected_by_email || "", rejected_by_name: r.rejected_by_name || "",
      approval_note: r.approval_note || "", rejection_note: r.rejection_note || "", rejection_reason: r.rejection_reason || "",
      submitted_at: r.submitted_at || null, created_at: r.created_at || null, updated_at: r.updated_at || null,
      metadata: r.metadata && typeof r.metadata === "object" ? r.metadata : {}
    };
  }

  function invite(r = {}) {
    return {
      id: r.id || null, token: r.token || "", invite_type: r.invite_type || "contributor", status: r.status || "active",
      invited_email: r.invited_email || "", invited_name: r.invited_name || "", created_by_email: r.created_by_email || "",
      created_by_name: r.created_by_name || "", created_by_role: r.created_by_role || "", used_by_email: r.used_by_email || "",
      used_at: r.used_at || r.last_used_at || null, expires_at: r.expires_at || null, created_at: r.created_at || null,
      updated_at: r.updated_at || null, invite_url: r.invite_url || "", network: r.network || null, is_active: r.is_active === undefined ? r.status === "active" : !!r.is_active,
      used: bool(r.used), max_uses: num(r.max_uses, 1), used_count: num(r.used_count), revoked: bool(r.revoked),
      metadata: r.metadata && typeof r.metadata === "object" ? r.metadata : {}
    };
  }

  function access(r = {}) {
    const c = contributor(r.contributor || r.record || r.data || r);
    const status = str(r.status || c.status).trim().toLowerCase();
    const approved = status === "approved";
    const tg = r.telegram_unlocked === undefined ? c.telegram_unlocked : bool(r.telegram_unlocked);
    const internal = r.internal_unlocked === undefined ? c.internal_unlocked : bool(r.internal_unlocked);
    const builder = r.project_creation_unlocked === undefined ? c.project_creation_unlocked : bool(r.project_creation_unlocked);
    return {
      allowed: r.allowed === undefined ? approved : bool(r.allowed), contributor: c, status,
      telegram_unlocked: tg, internal_unlocked: internal, project_creation_unlocked: builder,
      has_internal_access: r.has_internal_access === undefined ? approved && internal : bool(r.has_internal_access),
      has_telegram_access: r.has_telegram_access === undefined ? approved && tg : bool(r.has_telegram_access),
      has_project_builder_access: r.has_project_builder_access === undefined ? approved && builder : bool(r.has_project_builder_access),
      albukhr_id: r.albukhr_id || c.albukhr_id || ""
    };
  }

  /* ---------------- CONTRIBUTOR READS ---------------- */
  async function findContributorByEmailDirect(v) {
    const e = email(v); if (!e) return null;
    const { data, error } = await db().from("albukhr_contributors").select("*").ilike("email", e).limit(1).maybeSingle();
    if (error) throw new Error(error.message || "Failed to load contributor");
    return data ? contributor(data) : null;
  }

  async function findContributorByIdDirect(id) {
    id = str(id).trim(); if (!id) return null;
    const { data, error } = await db().from("albukhr_contributors").select("*").eq("id", id).limit(1).maybeSingle();
    if (error) throw new Error(error.message || "Failed to load contributor");
    return data ? contributor(data) : null;
  }

  async function listContributorsDirect(limit = 300) {
    const { data, error } = await db().from("albukhr_contributors").select("*").order("created_at", { ascending: false }).limit(num(limit, 300));
    if (error) throw new Error(error.message || "Failed to load contributors");
    return arr(data).map(contributor);
  }

  async function getContributorByEmail(v) {
    const e = email(v); if (!e) return null;
    try { const d = await rpc("albukhr_admin_get_contributor_by_email", { p_email: e }); if (d) return contributor(d.contributor || d.record || d.data || d); } catch (x) { console.warn(E, x); }
    try { const d = await rpc("albukhr_get_contributor_by_email", { p_email: e }); if (d) return contributor(d.contributor || d.record || d.data || d); } catch (x) { console.warn(E, x); }
    return findContributorByEmailDirect(e);
  }

  async function resolveContributorIdentifier(input) {
    if (!input) throw new Error("Contributor identifier is required");
    if (typeof input === "string") return input.includes("@") ? await getContributorByEmail(input) : await findContributorByIdDirect(input);
    const e = email(input.email || input.contributorEmail || input.userEmail);
    if (e) return await getContributorByEmail(e);
    return await findContributorByIdDirect(input.contributorId || input.id || input.recordId);
  }

  /* ---------------- INVITES ---------------- */
  async function findInviteByTokenDirect(v) {
    const t = str(v).trim(); if (!t) return null;
    const n = requireNetwork();
    const primary = await db().from("albukhr_invites").select("*").eq("token", t).eq("network", n).limit(1).maybeSingle();
    if (!primary.error && primary.data) return { source: "albukhr_invites", record: invite(primary.data) };
    if (n === "mainnet") {
      if (primary.error) throw new Error(primary.error.message || "Failed to find Mainnet invite");
      return null;
    }
    const legacy = await db().from("albukhr_contributor_invites").select("*").eq("token", t).limit(1).maybeSingle();
    if (!legacy.error && legacy.data) return { source: "albukhr_contributor_invites", record: invite(legacy.data) };
    if (primary.error && legacy.error) throw new Error(primary.error.message || legacy.error.message || "Failed to find invite");
    return null;
  }

  async function validateInviteToken(v) {
    const t = str(v).trim(); if (!t) return { ok: false, valid: false, reason: "missing_token" };
    try {
      const d = await rpc("albukhr_validate_invite_token", { p_token: t });
      if (typeof d === "boolean") return { ok: true, valid: d, reason: d ? "" : "invalid_invite" };
      if (d && typeof d === "object") return { ok: true, valid: bool(d.valid ?? d.ok), invite: d.invite || d.record || d.data || null, reason: d.reason || "" };
    } catch (x) { console.warn(E, x); }
    const found = await findInviteByTokenDirect(t);
    if (!found) return { ok: true, valid: false, reason: "invite_not_found" };
    const i = found.record, exp = i.expires_at ? new Date(i.expires_at).getTime() : 0;
    const expired = Number.isFinite(exp) && exp > 0 && Date.now() > exp;
    const revoked = i.revoked || i.status === "revoked" || i.is_active === false;
    const used = i.used || i.status === "used" || (i.max_uses > 0 && i.used_count >= i.max_uses);
    return { ok: true, valid: !expired && !revoked && !used, invite: i, reason: expired ? "invite_expired" : revoked ? "invite_revoked" : used ? "invite_used" : "" };
  }

  async function ensureInviteSessionFromUrl() {
    const urlToken = str(new URLSearchParams(location.search).get("invite")).trim();
    const existing = getInviteSession();
    if (existing?.token && existing?.expiresAt && new Date(existing.expiresAt).getTime() > Date.now() && existing.consumed !== true) return { ok: true, valid: true, source: "local_session", token: existing.token, session: existing };
    if (!urlToken) return { ok: false, valid: false, reason: "missing_invite" };
    const check = await validateInviteToken(urlToken);
    if (!check.valid) return { ok: true, valid: false, reason: check.reason || "invalid_invite" };
    const i = invite(check.invite || { token: urlToken });
    const session = { token: i.token || urlToken, inviteId: i.id || null, expiresAt: i.expires_at || new Date(Date.now() + INVITE_HOURS * 3600000).toISOString(), createdAt: iso(), consumed: false };
    setInviteSession(session); set(ls(), KEYS.invite, session.token);
    try { await rpc("albukhr_mark_invite_session", { p_token: session.token }); } catch (x) { console.warn(E, x); }
    return { ok: true, valid: true, source: "url_token", token: session.token, invite: i, session };
  }

  async function generateContributorInvite({ expiresInHours = INVITE_HOURS, createdByEmail = "", createdByName = "", inviteType = "contributor" } = {}) {
    const n = requireNetwork(), t = token(), admin = getAdminMeta();
    const ce = email(createdByEmail || admin.email), cn = str(createdByName || admin.name).trim() || "ALBUKHR Admin";
    const hours = Math.max(1, Math.floor(num(expiresInHours, INVITE_HOURS))), url = inviteUrl(t), expires = new Date(Date.now() + hours * 3600000).toISOString();
    try {
      const d = await rpc("albukhr_generate_contributor_invite", { p_token: t, p_invite_type: inviteType, p_created_by_email: ce, p_created_by_name: cn, p_expires_in_hours: hours });
      const i = invite({ token: t, invite_url: url, expires_at: expires, network: n, ...(d?.invite || d?.record || d?.data || d || {}) });
      return { ok: true, network: n, invite: i, token: i.token || t, invite_url: i.invite_url || url, expires_at: i.expires_at || expires };
    } catch (x) { console.warn(E, x); }
    const { data, error } = await db().from("albukhr_invites").insert({ token: t, invite_type: inviteType, status: "active", created_by_email: ce || null, created_by_name: cn || null, created_by_role: admin.role || "admin", expires_at: expires, network: n, metadata: { source: E, version: VERSION, invite_url: url } }).select().single();
    if (error) throw new Error(error.message || "Failed to create contributor invite");
    const i = invite({ ...data, invite_url: data.invite_url || url });
    return { ok: true, network: n, invite: i, token: i.token, invite_url: i.invite_url || url, expires_at: i.expires_at || expires };
  }

  async function markInviteUsed(v, usedByEmail = "") {
    const t = str(v).trim(); if (!t) return { ok: false, reason: "missing_token" };
    const n = requireNetwork();
    try { return { ok: true, network: n, data: await rpc("albukhr_mark_invite_used", { p_token: t, p_used_by_email: email(usedByEmail) }) }; } catch (x) { console.warn(E, x); }
    const found = await findInviteByTokenDirect(t); if (!found) throw new Error("Invite not found");
    if (found.source === "albukhr_invites") {
      const { data, error } = await db().from("albukhr_invites").update({ status: "used", used_by_email: email(usedByEmail) || null, used_at: iso(), updated_at: iso() }).eq("id", found.record.id).eq("network", n).select().single();
      if (error) throw new Error(error.message || "Failed to mark invite used");
      return { ok: true, network: n, invite: invite(data) };
    }
    if (n !== "testnet") throw new Error("Legacy contributor invite table cannot be used for Mainnet.");
    const { data, error } = await db().from("albukhr_contributor_invites").update({ used: true, used_count: Math.max(1, num(found.record.used_count) + 1), last_used_at: iso(), updated_at: iso() }).eq("id", found.record.id).select().single();
    if (error) throw new Error(error.message || "Failed to mark legacy invite used");
    return { ok: true, network: n, invite: invite(data) };
  }

  /* ---------------- APPLICATION ---------------- */
  async function uploadContributorPhoto(file, contributorEmail = "") {
    if (!file) return { ok: true, photo_url: null, photo_path: null, bucket: null };
    const ext = (str(file.name).split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const owner = email(contributorEmail || "contributor").replace(/[^a-z0-9]/g, "_");
    const path = `contributors/${owner}_${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
    let last;
    for (const bucket of PHOTO_BUCKETS) {
      try {
        const { error } = await db().storage.from(bucket).upload(path, file, { cacheControl: "3600", upsert: true });
        if (error) { last = error; continue; }
        const { data } = db().storage.from(bucket).getPublicUrl(path);
        return { ok: true, bucket, photo_path: path, photo_url: data?.publicUrl || null };
      } catch (x) { last = x; }
    }
    throw new Error(last?.message || "Unable to upload contributor photo.");
  }

  async function submitContributorApplication(p = {}) {
    const e = email(p.email), n = requireNetwork();
    if (!str(p.fullName).trim()) throw new Error("Full name is required");
    if (!e) throw new Error("Email is required");
    if (!str(p.phone).trim()) throw new Error("Phone number is required");
    if (!str(p.address).trim()) throw new Error("Address is required");
    if (!str(p.skills).trim()) throw new Error("Skills are required");
    if (!str(p.contribution).trim()) throw new Error("Expected contribution is required");
    const t = str(p.inviteToken || getInviteSession()?.token || get(ls(), KEYS.invite)).trim();
    if (!t) throw new Error("Valid invite token is required before contributor submission");
    const check = await validateInviteToken(t); if (!check.valid) throw new Error("Invite is invalid, expired, revoked, or already used");
    let photo_url = null, photo_path = null;
    if (p.photoFile) { const up = await uploadContributorPhoto(p.photoFile, e); photo_url = up.photo_url; photo_path = up.photo_path; }

    let result;
    try {
      result = await rpc("albukhr_submit_contributor_application", {
        p_full_name: str(p.fullName).trim(), p_phone: phone(p.phone), p_email: e, p_address: str(p.address).trim(),
        p_country: nullIfEmpty(p.country), p_skills: str(p.skills).trim(), p_experience: nullIfEmpty(p.experience),
        p_contribution: str(p.contribution).trim(), p_photo_url: photo_url, p_photo_path: photo_path, p_invite_token: t
      });
    } catch (x) { console.warn(E, x); }

    let c;
    if (result) c = contributor(result.contributor || result.record || result.data || result);
    else {
      const found = await findInviteByTokenDirect(t);
      const { data, error } = await db().from("albukhr_contributors").insert({
        full_name: str(p.fullName).trim(), email: e, phone: phone(p.phone), address: str(p.address).trim(), country: nullIfEmpty(p.country),
        photo_url, photo_path, skills: str(p.skills).trim(), experience: nullIfEmpty(p.experience), contribution: str(p.contribution).trim(),
        status: "pending", telegram_unlocked: false, internal_unlocked: false, project_creation_unlocked: false,
        invite_token: t, invite_id: found?.record?.id || null, submitted_at: iso(),
        metadata: { ...(p.metadata && typeof p.metadata === "object" ? p.metadata : {}), albukhr_network: n, contributor_engine_version: VERSION }
      }).select().single();
      if (error) throw new Error(error.message || "Failed to submit contributor application");
      c = contributor(data);
      try { await markInviteUsed(t, e); } catch (x) { console.warn(E, x); }
    }
    setContributorSessionMeta({ email: e, name: c.full_name || p.fullName, role: "contributor" });
    clearInviteSession(); remove(ls(), KEYS.invite);
    return { ok: true, network: n, contributor: c };
  }

  async function submitContributorFromForm(m = {}) {
    return submitContributorApplication({
      fullName: m.fullName?.value || "", phone: m.phone?.value || "", email: m.email?.value || "", address: m.address?.value || "",
      country: m.country?.value || "", skills: m.skills?.value || "", experience: m.experience?.value || "", contribution: m.contribution?.value || "",
      photoFile: m.photo?.files?.[0] || null, inviteToken: getInviteSession()?.token || get(ls(), KEYS.invite) || ""
    });
  }

  /* ---------------- ACCESS ---------------- */
  async function getContributorAccess(v) {
    const e = email(v); if (!e) return { allowed: false, contributor: null, status: "" };
    try { return access(await rpc("albukhr_get_contributor_internal_access", { p_email: e }) || {}); } catch (x) { console.warn(E, x); }
    const c = await findContributorByEmailDirect(e); if (!c) return { allowed: false, contributor: null, status: "" };
    const a = access(c); return { ...a, allowed: a.status === "approved" };
  }
  async function getMyContributorAccess() { const e = getContributorSessionEmail(); return e ? getContributorAccess(e) : { allowed: false, contributor: null, status: "" }; }

  /* ---------------- ADMIN ---------------- */
  async function adminListContributors({ status = "", limit = 300 } = {}) {
    try {
      const d = await rpc("albukhr_admin_list_contributors", { p_status: nullIfEmpty(status), p_limit: num(limit, 300) });
      const rows = Array.isArray(d) ? d : arr(d?.contributors || d?.records);
      return rows.map(contributor);
    } catch (x) { console.warn(E, x); }
    let rows = await listContributorsDirect(limit);
    if (status) rows = rows.filter(r => str(r.status).toLowerCase() === str(status).trim().toLowerCase());
    return rows;
  }

  async function patchContributorByEmail(v, patch = {}) {
    const e = email(v); if (!e) throw new Error("Contributor email is required");
    const { data, error } = await db().from("albukhr_contributors").update({ ...patch, updated_at: iso() }).ilike("email", e).select().single();
    if (error) throw new Error(error.message || "Failed to update contributor");
    return contributor(data);
  }

  async function adminApproveContributor(input, meta = {}) {
    const c = await resolveContributorIdentifier(input); if (!c) throw new Error("Contributor not found");
    const a = actor(typeof input === "object" ? { ...input, ...meta } : meta);
    try { const d = await rpc("albukhr_admin_approve_contributor", { p_email: c.email, p_approved_by_email: email(a.email), p_approved_by_name: a.name, p_approved_by_role: a.role }); return { ok: true, contributor: contributor(d?.contributor || d?.record || d?.data || d) }; } catch (x) { console.warn(E, x); }
    try { const d = await rpc("albukhr_admin_approve_contributor", { p_contributor_id: c.id }); return { ok: true, contributor: contributor(d?.contributor || d?.record || d?.data || d) }; } catch (x) { console.warn(E, x); }
    return { ok: true, contributor: await patchContributorByEmail(c.email, { status: "approved", approved_at: iso(), rejected_at: null, approved_by_email: email(a.email) || null, approved_by_name: a.name || null, rejection_note: null, rejection_reason: null }) };
  }

  async function adminRejectContributor(input, meta = {}, reason = "") {
    const c = await resolveContributorIdentifier(input); if (!c) throw new Error("Contributor not found");
    const merged = typeof input === "object" ? { ...input, ...meta } : { ...meta, reason };
    const a = actor(merged);
    const r = nullIfEmpty(merged.reason || merged.rejectionReason || reason);
    try { const d = await rpc("albukhr_admin_reject_contributor", { p_email: c.email, p_rejected_by_email: email(a.email), p_rejected_by_name: a.name, p_rejected_by_role: a.role, p_reason: r }); return { ok: true, contributor: contributor(d?.contributor || d?.record || d?.data || d) }; } catch (x) { console.warn(E, x); }
    try { const d = await rpc("albukhr_admin_reject_contributor", { p_contributor_id: c.id }); return { ok: true, contributor: contributor(d?.contributor || d?.record || d?.data || d) }; } catch (x) { console.warn(E, x); }
    return { ok: true, contributor: await patchContributorByEmail(c.email, { status: "rejected", rejected_at: iso(), approved_at: null, rejected_by_email: email(a.email) || null, rejected_by_name: a.name || null, rejection_note: r, rejection_reason: r }) };
  }

  async function unlock(input, meta, rpcName, type, patch) {
    const c = await resolveContributorIdentifier(input); if (!c) throw new Error("Contributor not found");
    const a = actor(typeof input === "object" ? { ...input, ...meta } : meta);
    if (rpcName) {
      try { const d = await rpc(rpcName, { p_email: c.email, p_actor_email: email(a.email), p_actor_name: a.name, p_actor_role: a.role }); return { ok: true, contributor: contributor(d?.contributor || d?.record || d?.data || d) }; } catch (x) { console.warn(E, x); }
    }
    return { ok: true, contributor: await patchContributorByEmail(c.email, patch) };
  }
  const adminUnlockTelegram = (i,m={}) => unlock(i,m,"albukhr_admin_unlock_contributor_telegram","telegram",{telegram_unlocked:true});
  const adminUnlockInternal = (i,m={}) => unlock(i,m,"albukhr_admin_unlock_contributor_internal","internal",{internal_unlocked:true});
  const adminUnlockProjectBuilder = (i,m={}) => unlock(i,m,"albukhr_admin_unlock_contributor_project_builder","project_builder",{project_creation_unlocked:true});

  async function adminUnlockContributorAccess(p = {}) {
    const t = str(p.accessType || p.type).trim().toLowerCase(), m = { email:p.grantedBy || p.actorEmail, name:p.actorName, role:p.actorRole || "admin" };
    if (t === "telegram") return adminUnlockTelegram(p,m);
    if (t === "internal") return adminUnlockInternal(p,m);
    if (["project_builder","projectbuilder","project"].includes(t)) return adminUnlockProjectBuilder(p,m);
    throw new Error(`Unsupported contributor access type: ${t}`);
  }

  /* ---------------- PAGE / INTERNAL HELPERS ---------------- */
  async function getContributorStatusForPage(e) {
    const a = await getContributorAccess(e), c = a.contributor, s = str(c?.status).toLowerCase();
    return { exists: !!c, approved:s === "approved", pending:s === "pending", rejected:s === "rejected", contributor:c, access:a };
  }
  async function resolveContributorPageState(e) {
    const s = await getContributorStatusForPage(e);
    return { contributorFound:s.exists, status:s.contributor?.status || "", contributor:s.contributor, showPendingNotice:s.pending, showApprovedView:s.approved, showRejectedState:s.rejected, showTelegramBox:!!s.access.has_telegram_access, showInternalBox:!!s.access.has_internal_access, showProjectBuilderBox:!!s.access.has_project_builder_access, showAlbukhrIdBox:!!s.access.albukhr_id };
  }
  async function prepareInternalRegistryAccess(e) {
    const a = await getContributorAccess(e);
    if (!a.contributor) return { ok:false, allowed:false, reason:"contributor_not_found" };
    if (str(a.contributor.status).toLowerCase() !== "approved") return { ok:false, allowed:false, reason:"contributor_not_approved", access:a };
    if (!a.internal_unlocked && !a.has_internal_access) return { ok:false, allowed:false, reason:"internal_access_locked", access:a };
    setInternalRegistrySession(e); return { ok:true, allowed:true, access:a };
  }
  function getTransparencyViewerMeta() {
    const c = getContributorSessionMeta(), s = ls();
    return { email:c.email || email(get(s,"currentUserEmail")), name:c.name || get(s,"currentUserName") || "ALBUKHR User", role:c.role || "contributor" };
  }
  function renderInviteBlockedScreen(message="Access Restricted") {
    if (!document.body) return;
    document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;box-sizing:border-box;text-align:center;background:#f4f7f6"><div style="width:100%;max-width:420px;background:#fff;padding:24px;border-radius:18px;box-shadow:0 10px 30px rgba(0,0,0,.08)"><div style="font-size:46px">⛔</div><h2 style="color:#b02a37;font-family:system-ui">${esc(message)}</h2><p style="color:#55625c;line-height:1.7;font-family:system-ui">This contributor page is invite-only. Please use a valid ALBUKHR invite link.</p></div></div>`;
  }
  async function generateContributorInviteForAdminUI() {
    const r = await generateContributorInvite(), u = esc(r.invite_url);
    return { ok:true, token:r.token, invite_url:r.invite_url, expires_at:r.expires_at, invite:r.invite, html:`<b>Secure Invite Link:</b><br>${u}<br><br><button class="copy-btn" type="button" data-invite-copy="${u}">📋 Copy Link</button>` };
  }
  function engineInfo() { return { name:E, version:VERSION, network:network() || null, sourceOfTruth:"Supabase", storageRole:"session/UI hints only" }; }

  /* ---------------- EXPORTS ---------------- */
  Object.assign(api, {
    VERSION, ENGINE_NAME:E, getEngineInfo:engineInfo, getSupabaseClient:db, getCurrentNetwork:network, requireCurrentNetwork:requireNetwork,
    getAdminMeta, getTransparencyViewerMeta, setContributorSessionEmail, getContributorSessionEmail, clearContributorSessionEmail,
    setContributorSessionMeta, getContributorSessionMeta, setInviteSession, getInviteSession, clearInviteSession,
    ensureInviteSessionFromUrl, validateInviteToken, markInviteUsed, renderInviteBlockedScreen, uploadContributorPhoto,
    generateContributorInvite, generateContributorInviteForAdminUI, submitContributorApplication, submitContributorFromForm,
    getContributorByEmail, getContributorAccess, getMyContributorAccess, getContributorStatusForPage, resolveContributorPageState,
    adminListContributors, adminApproveContributor, adminRejectContributor, adminUnlockTelegram, adminUnlockInternal,
    adminUnlockProjectBuilder, adminUnlockContributorAccess, prepareInternalRegistryAccess, resolveContributorIdentifier,
    patchContributorByEmail
  });

  /* Legacy globals: keeps existing pages working without changing other engines. */
  window.getTransparencyViewerMeta = getTransparencyViewerMeta;
  window.generateContributorInvite = generateContributorInviteForAdminUI;
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

  document.addEventListener("click", async e => {
    const b = e.target.closest?.("[data-invite-copy]"); if (!b) return;
    const v = b.getAttribute("data-invite-copy"); if (!v) return;
    try { await navigator.clipboard.writeText(v); const old=b.textContent; b.textContent="✓ Copied"; setTimeout(()=>b.textContent=old,1500); }
    catch { console.warn(`${E}: clipboard unavailable`); }
  });

  console.info(`${E} v${VERSION} loaded.`);
})();
