/* ALBUKHR ADMIN INTERNAL PROJECTS — REVIEW FIX
   Load AFTER internal-registry-engine.js and BEFORE admin page logic.
   Fixes the current Supabase schema mismatch:
   albukhr_internal_projects has NO reviewed_at column.
*/

(function () {
  "use strict";

  function supabase() {
    const e = window.AlbukhrInternalRegistryEngine;
    if (e && typeof e.getSupabaseClient === "function") return e.getSupabaseClient();

    if (window.albukhrSupabase && typeof window.albukhrSupabase.from === "function")
      return window.albukhrSupabase;

    if (window.supabaseClient && typeof window.supabaseClient.from === "function")
      return window.supabaseClient;

    throw new Error("ALBUKHR: Supabase client not initialized.");
  }

  function actor() {
    const a = window.admin || window.currentAdmin || window.AlbukhrAdmin || {};
    return {
      email: String(
        a.email ||
        localStorage.getItem("albukhr_current_email") ||
        localStorage.getItem("currentUserEmail") ||
        ""
      ).trim().toLowerCase(),

      name: String(
        a.username ||
        a.name ||
        localStorage.getItem("albukhr_current_username") ||
        localStorage.getItem("currentUserName") ||
        "ALBUKHR Admin"
      ).trim() || "ALBUKHR Admin"
    };
  }

  function email(p) {
    return String(
      p.creator_email || p.email || p.creatorEmail || ""
    ).trim().toLowerCase();
  }

  function role(p) {
    return p.creator_role || p.role || "—";
  }

  async function approve(input = {}) {
    const id = String(
      typeof input === "string"
        ? input
        : (input.projectId || input.id || "")
    ).trim();

    if (!id) throw new Error("Internal project ID is required.");

    const a = actor();
    const now = new Date().toISOString();

    const { data, error } = await supabase()
      .from("albukhr_internal_projects")
      .update({
        status: "internal_approved",
        project_approved: true,
        approved_at: now,
        approved_by_email: a.email || null,
        approved_by_name: a.name,
        rejected_at: null,
        rejected_by_email: null,
        rejected_by_name: null,
        rejection_reason: null,
        reviewed_by_email: a.email || null,
        reviewed_by_name: a.name,
        updated_at: now
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw new Error(error.message || "Failed to approve internal project.");

    return { ok: true, project: data };
  }

  async function reject(input = {}) {
    const id = String(
      typeof input === "string"
        ? input
        : (input.projectId || input.id || "")
    ).trim();

    const reason = typeof input === "string"
      ? ""
      : String(input.reason || "").trim();

    if (!id) throw new Error("Internal project ID is required.");

    const a = actor();
    const now = new Date().toISOString();

    const { data, error } = await supabase()
      .from("albukhr_internal_projects")
      .update({
        status: "internal_rejected",
        project_approved: false,
        rejected_at: now,
        rejected_by_email: a.email || null,
        rejected_by_name: a.name,
        rejection_reason: reason || null,
        approved_at: null,
        approved_by_email: null,
        approved_by_name: null,
        reviewed_by_email: a.email || null,
        reviewed_by_name: a.name,
        updated_at: now
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw new Error(error.message || "Failed to reject internal project.");

    return { ok: true, project: data };
  }

  window.AlbukhrInternalRegistryReviewFix = {
    approve,
    reject,
    projectEmail: email,
    projectRole: role
  };

  /* Override engine review methods so old reviewed_at code is not used. */
  if (window.AlbukhrInternalRegistryEngine) {
    window.AlbukhrInternalRegistryEngine.adminApproveInternalProject = approve;
    window.AlbukhrInternalRegistryEngine.adminRejectInternalProject = reject;
  }

  /* Also expose corrected field helpers for existing admin JS. */
  window.albukhrInternalProjectEmail = email;
  window.albukhrInternalProjectRole = role;

  console.info(
    "%cALBUKHR Internal Registry Review Fix Ready",
    "color:#0f7a3d;font-weight:bold"
  );
})();
