/* Separate Testnet Super Admin queue for Owner-submitted applications. */
(function (window, document) {
  "use strict";
  var API = "https://vhvkwvngmrlgyzwemttt.supabase.co/functions/v1/testnet-project-owner-application-admin";
  var list = document.getElementById("applicationQueue");
  var status = document.getElementById("queueStatus");
  var refresh = document.getElementById("refreshQueue");
  var busy = false;
  function clean(v) { return String(v == null ? "" : v).trim(); }
  function setStatus(value, isError) { status.textContent = clean(value); status.dataset.state = isError ? "error" : "info"; }
  function getToken() {
    var auth = window.AlbukhrTestnetAdminAuth;
    return auth && typeof auth.getSessionToken === "function" ? clean(auth.getSessionToken()) : "";
  }
  async function call(method, body) {
    var token = getToken();
    if (!token) throw new Error("TESTNET_ADMIN_SESSION_REQUIRED");
    var response = await fetch(API, {
      method: method,
      headers: Object.assign({ Accept: "application/json", Authorization: "Bearer " + token }, body ? { "Content-Type": "application/json" } : {}),
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store"
    });
    var data = await response.json().catch(function () { return null; });
    if (!response.ok || !data || data.ok !== true) throw new Error(clean(data && data.error) || "OWNER_APPLICATION_ADMIN_REQUEST_FAILED");
    return data;
  }
  function field(label, value, full) {
    var box = document.createElement("div"); box.className = "owner-field" + (full ? " full" : "");
    var title = document.createElement("span"); title.textContent = label;
    var text = document.createElement("p"); text.textContent = clean(value) || "—";
    box.appendChild(title); box.appendChild(text); return box;
  }
  function renderApplication(app) {
    var card = document.createElement("article"); card.className = "application-card";
    var project = app.project || {};
    var heading = document.createElement("h3"); heading.textContent = clean(project.name) || clean(app.mainnet_source_project_code) || "Project application";
    var meta = document.createElement("div"); meta.className = "application-meta";
    meta.textContent = [clean(project.project_code), clean(project.project_type).toUpperCase(), "Submitted " + clean(app.submitted_at)].filter(Boolean).join(" • ");
    var badge = document.createElement("span"); badge.className = "application-status"; badge.textContent = clean(app.status).replace(/_/g, " ");
    card.appendChild(heading); card.appendChild(meta); card.appendChild(badge);
    var submission = app.owner_submission || {};
    var data = document.createElement("div"); data.className = "owner-submission";
    data.appendChild(field("Owner full name", submission.owner_name));
    data.appendChild(field("Role / title", submission.role_title));
    data.appendChild(field("Organization", submission.organization_name));
    data.appendChild(field("Contact email", submission.contact_email));
    data.appendChild(field("Contact phone", submission.contact_phone));
    data.appendChild(field("Business address", submission.business_address, true));
    data.appendChild(field("Business / project summary", submission.business_summary, true));
    card.appendChild(data);
    if (app.review_note) card.appendChild(field("Previous Admin note", app.review_note, true));
    if (["submitted", "resubmitted"].indexOf(clean(app.status)) === -1) return card;
    var note = document.createElement("textarea"); note.className = "review-note"; note.maxLength = 3000; note.placeholder = "Write the reason or review note. Required for every decision."; note.setAttribute("aria-label", "Admin review note");
    card.appendChild(note);
    var actions = document.createElement("div"); actions.className = "review-actions";
    [
      ["changes_requested", "Request changes"],
      ["approved", "Approve Owner"],
      ["rejected", "Reject application"]
    ].forEach(function (item) {
      var button = document.createElement("button"); button.type = "button"; button.textContent = item[1]; button.dataset.decision = item[0];
      button.addEventListener("click", async function () {
        if (busy) return;
        if (!clean(note.value)) { setStatus("A review note is required before making a decision.", true); note.focus(); return; }
        busy = true; Array.prototype.forEach.call(actions.querySelectorAll("button"), function (b) { b.disabled = true; });
        setStatus(item[1] + " in progress…");
        var refreshAfterReview = false;
        try {
          await call("POST", { action: "review_application", application_id: app.id, decision: item[0], note: clean(note.value) });
          setStatus("Application " + item[0].replace(/_/g, " ") + " successfully.");
          refreshAfterReview = true;
        } catch (error) { setStatus(clean(error && error.message) || "APPLICATION_REVIEW_FAILED", true); }
        finally { busy = false; Array.prototype.forEach.call(actions.querySelectorAll("button"), function (b) { b.disabled = false; }); }
        if (refreshAfterReview) await loadQueue();
      });
      actions.appendChild(button);
    });
    card.appendChild(actions);
    return card;
  }
  async function loadQueue() {
    if (busy) return;
    busy = true; refresh.disabled = true; setStatus("Loading Testnet Owner applications…"); list.textContent = "";
    try {
      var result = await call("GET");
      var apps = Array.isArray(result.applications) ? result.applications : [];
      if (!apps.length) { var empty = document.createElement("div"); empty.className = "empty-queue"; empty.textContent = "There are no Owner applications in your permitted project scope."; list.appendChild(empty); }
      else apps.forEach(function (app) { list.appendChild(renderApplication(app)); });
      setStatus("Loaded " + apps.length + " application(s). Owner-submitted information is displayed read-only.");
    } catch (error) { setStatus(clean(error && error.message) || "APPLICATION_QUEUE_LOAD_FAILED", true); }
    finally { busy = false; refresh.disabled = false; }
  }
  async function init() {
    if (!window.ALBukhrEnvironment || typeof window.ALBukhrEnvironment.isTestnet !== "function" || !window.ALBukhrEnvironment.isTestnet()) { setStatus("This review queue is available only in the Testnet environment.", true); return; }
    var auth = window.AlbukhrTestnetAdminAuth;
    if (!auth || typeof auth.requireAdmin !== "function") { setStatus("Testnet Admin authentication module is unavailable.", true); return; }
    try {
      await auth.requireAdmin({ redirectOnFailure: true });
      if (!getToken()) return;
      await loadQueue();
    } catch (error) { setStatus(clean(error && error.message) || "TESTNET_ADMIN_AUTH_FAILED", true); }
  }
  refresh.addEventListener("click", loadQueue);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})(window, document);
