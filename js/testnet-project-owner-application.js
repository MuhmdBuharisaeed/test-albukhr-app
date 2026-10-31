/* ALBUKHR TESTNET PROJECT OWNER SELF-APPLICATION — additive module */
(function (window, document) {
  "use strict";

  var API = "https://vhvkwvngmrlgyzwemttt.supabase.co/functions/v1/testnet-project-owner-application";
  var MAINNET_ISSUER = "https://ribpntyqdleytsyktdfb.supabase.co/functions/v1/testnet-project-owner-proof-issuer";
  var PI_SDK_VERSION = "2.0";
  var PI_SANDBOX = true;
  var piInitPromise = null;
  var eligibilityInFlight = Object.create(null);
  var panel = null;
  var currentProject = null;
  var currentTicket = "";
  var existingApplicationId = "";
  var existingSubmission = null;
  var busy = false;
  var initialized = false;

  function clean(value) { return String(value == null ? "" : value).trim(); }
  function byId(id) { return panel ? panel.querySelector("#" + id) : null; }
  function setStatus(message, isError) {
    var node = byId("ownerApplicationStatus");
    if (!node) return;
    node.textContent = clean(message);
    node.dataset.state = isError ? "error" : "info";
  }
  function auth() { return window.AlbukhrTestnetAuth || null; }
  function sessionToken() {
    var module = auth();
    return module && typeof module.getSessionToken === "function" ? clean(module.getSessionToken()) : "";
  }
  async function request(action, body) {
    var token = sessionToken();
    if (!token) throw new Error("TESTNET_SESSION_REQUIRED");
    var response = await fetch(API, {
      method: body ? "POST" : "GET",
      headers: Object.assign({ Accept: "application/json", "X-Testnet-Session": token }, body ? { "Content-Type": "application/json" } : {}),
      body: body ? JSON.stringify(Object.assign({ action: action }, body)) : undefined,
      cache: "no-store"
    });
    var data = await response.json().catch(function () { return null; });
    if (!response.ok || !data || data.ok !== true) throw new Error(clean(data && data.error) || "OWNER_APPLICATION_REQUEST_FAILED");
    return data;
  }
  function mount() {
    if (panel) return panel;
    var main = document.querySelector("main.project-page");
    if (!main) return null;
    panel = document.createElement("section");
    panel.className = "panel owner-application-panel";
    panel.id = "testnetOwnerApplicationPanel";
    panel.hidden = true;
    panel.innerHTML =
      '<div class="section-kicker">PROJECT OWNERSHIP</div>' +
      '<h2>Apply as Project Owner</h2>' +
      '<p class="owner-app-intro">This application is submitted by the project owner. ALBUKHR administrators review the information and may approve, request changes, or reject it.</p>' +
      '<div id="ownerApplicationStatus" class="owner-app-status" role="status" aria-live="polite"></div>' +
      '<div id="ownerApplicationExisting" class="owner-app-existing" hidden></div>' +
      '<div id="ownerApplicationActions" class="owner-app-actions">' +
        '<button id="ownerApplicationStart" class="action-btn primary" type="button">Verify ownership and apply</button>' +
      '</div>' +
      '<form id="ownerApplicationForm" class="owner-app-form" hidden>' +
        '<label>Owner full name<input name="owner_name" maxlength="160" required autocomplete="name"></label>' +
        '<label>Role / title<input name="role_title" maxlength="160" required></label>' +
        '<label>Organization / business name<input name="organization_name" maxlength="200" required></label>' +
        '<div class="owner-app-grid"><label>Contact email<input name="contact_email" type="email" maxlength="254" required autocomplete="email"></label><label>Contact phone<input name="contact_phone" type="tel" maxlength="64" required autocomplete="tel"></label></div>' +
        '<label>Business address<input name="business_address" maxlength="500" required autocomplete="street-address"></label>' +
        '<label>Business / project summary<textarea name="business_summary" maxlength="3000" rows="5" required></textarea></label>' +
        '<button id="ownerApplicationSubmit" class="action-btn primary" type="submit">Submit Owner Application</button>' +
      '</form>';
    var about = main.querySelector("section.panel");
    if (about && about.parentNode) about.parentNode.insertBefore(panel, about.nextSibling);
    else main.appendChild(panel);
    byId("ownerApplicationStart").addEventListener("click", startVerification);
    byId("ownerApplicationForm").addEventListener("submit", submitApplication);
    return panel;
  }
  function showForm(submission) {
    var form = byId("ownerApplicationForm");
    if (!form) return;
    var values = submission || {};
    Object.keys(values).forEach(function (key) {
      var field = form.elements.namedItem(key);
      if (field && typeof values[key] === "string") field.value = values[key];
    });
    form.hidden = false;
    byId("ownerApplicationStart").hidden = true;
  }
  function setBusy(value) {
    busy = !!value;
    ["ownerApplicationStart", "ownerApplicationSubmit"].forEach(function (id) {
      var node = byId(id);
      if (node) node.disabled = busy;
    });
  }
  async function initializePi() {
    if (!window.Pi || typeof window.Pi.init !== "function" || typeof window.Pi.authenticate !== "function") throw new Error("PI_SDK_UNAVAILABLE");
    if (!piInitPromise) {
      piInitPromise = Promise.resolve(window.Pi.init({ version: PI_SDK_VERSION, sandbox: PI_SANDBOX })).catch(function (error) {
        piInitPromise = null;
        throw error;
      });
    }
    await piInitPromise;
  }
  async function startVerification() {
    if (busy || !currentProject) return;
    setBusy(true);
    setStatus("Starting a fresh Pi identity verification…");
    var accessToken = "";
    try {
      await initializePi();
      var result = await window.Pi.authenticate(["username"], function () { /* No payment flow is initiated here. */ });
      accessToken = clean(result && result.accessToken);
      result = null;
      if (!accessToken) throw new Error("PI_ACCESS_TOKEN_REQUIRED");
      var response = await fetch(MAINNET_ISSUER, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ action: "issue", project_code: currentProject.project_code }),
        cache: "no-store"
      });
      accessToken = "";
      var proofResult = await response.json().catch(function () { return null; });
      if (!response.ok || !proofResult || proofResult.ok !== true || !proofResult.proof) throw new Error(clean(proofResult && proofResult.error) || "MAINNET_OWNER_PROOF_FAILED");
      var verified = await request("verify_owner_proof", { project_id: currentProject.id, proof: proofResult.proof });
      proofResult.proof = "";
      currentTicket = clean(verified.ticket);
      if (!currentTicket) throw new Error("OWNER_APPLICATION_TICKET_MISSING");
      setStatus("Mainnet ownership verified. Complete the form below; your Pi access token was not saved.");
      showForm(existingApplicationId ? existingSubmission : null);
    } catch (error) {
      setStatus(clean(error && error.message) || "OWNER_APPLICATION_VERIFICATION_FAILED", true);
    } finally {
      accessToken = "";
      setBusy(false);
    }
  }
  function readSubmission(form) {
    var data = new FormData(form);
    var result = {};
    ["owner_name", "role_title", "organization_name", "contact_email", "contact_phone", "business_address", "business_summary"].forEach(function (key) {
      result[key] = clean(data.get(key));
    });
    return result;
  }
  async function submitApplication(event) {
    event.preventDefault();
    if (busy || !currentTicket || !currentProject) return;
    var form = byId("ownerApplicationForm");
    if (!form.reportValidity()) return;
    setBusy(true);
    setStatus("Submitting your Owner application securely…");
    try {
      var submission = readSubmission(form);
      var result;
      if (existingApplicationId) {
        result = await request("resubmit", { application_id: existingApplicationId, ticket: currentTicket, submission: submission });
        setStatus("Your revised application has been resubmitted for Admin review.");
      } else {
        result = await request("submit", { project_id: currentProject.id, ticket: currentTicket, submission: submission });
        setStatus("Your application has been submitted. Reference: " + clean(result.application_id) + ". The Admin team will review the information you submitted.");
      }
      currentTicket = "";
      existingApplicationId = "";
      existingSubmission = null;
      form.hidden = true;
      byId("ownerApplicationActions").hidden = true;
    } catch (error) {
      setStatus(clean(error && error.message) || "APPLICATION_SUBMIT_FAILED", true);
    } finally {
      setBusy(false);
    }
  }
  async function loadEligibility(project) {
    if (!project || clean(project.network).toLowerCase() !== "testnet") return;
    var type = clean(project.project_type).toLowerCase();
    if (type !== "internal" && type !== "external") return;
    var module = auth();
    if (!module || typeof module.getSession !== "function") return;
    // The existing Owner bridge owns one-time access_code redemption.
    // Never redeem from two modules at once: the gateway code is single-use.
    var session = module.getSession();
    if (!session || !sessionToken()) return;
    var response = await fetch(API + "?project_id=" + encodeURIComponent(project.id), {
      headers: { Accept: "application/json", "X-Testnet-Session": sessionToken() }, cache: "no-store"
    });
    var data = await response.json().catch(function () { return null; });
    if (!response.ok || !data || data.ok !== true) throw new Error(clean(data && data.error) || "OWNER_APPLICATION_ELIGIBILITY_FAILED");
    if (!data.eligible && !data.application && !data.another_application_pending) return;
    mount();
    panel.hidden = false;
    currentProject = project;
    if (data.another_application_pending && !data.application) {
      byId("ownerApplicationStart").hidden = true;
      byId("ownerApplicationActions").hidden = true;
      setStatus("An Owner application for this project is already under Admin review. No second application can be opened.");
      return;
    }
    if (!data.eligible && !data.application) return;
    var existing = data.application;
    if (existing) {
      byId("ownerApplicationStart").hidden = true;
      byId("ownerApplicationActions").hidden = true;
      var statusText = "Application status: " + clean(existing.status).replace(/_/g, " ").toUpperCase();
      if (existing.review_note) statusText += " — Admin note: " + clean(existing.review_note);
      setStatus(statusText);
      if (existing.status === "changes_requested") {
        existingApplicationId = clean(existing.id);
        existingSubmission = existing.owner_submission || {};
        byId("ownerApplicationActions").hidden = false;
        byId("ownerApplicationStart").hidden = false;
        byId("ownerApplicationStart").textContent = "Verify again to resubmit changes";
      }
      return;
    }
    setStatus("This project is eligible for an Owner application. Only the project Owner can submit the information.");
  }
  function onProject(event) {
    var project = event && event.detail && event.detail.project;
    if (!project && window.AlbukhrTestnetProject && typeof window.AlbukhrTestnetProject.getProject === "function") project = window.AlbukhrTestnetProject.getProject();
    if (!project) return;
    currentProject = project;
    var projectId = clean(project.id);
    if (!projectId || eligibilityInFlight[projectId]) return;
    eligibilityInFlight[projectId] = true;
    loadEligibility(project)
      .catch(function (error) { console.warn("[ALBUKHR OWNER APPLICATION UI]", clean(error && error.message)); })
      .finally(function () { delete eligibilityInFlight[projectId]; });
  }
  function init() {
    if (initialized) return;
    initialized = true;
    window.addEventListener("albukhr:testnet-project-loaded", onProject);
    window.addEventListener("albukhr:testnet-project-rendered", onProject);
    window.addEventListener("albukhr:testnet-auth-success", function () {
      if (currentProject) onProject({ detail: { project: currentProject } });
    });
    if (window.AlbukhrTestnetProject && typeof window.AlbukhrTestnetProject.getProject === "function") onProject({ detail: { project: window.AlbukhrTestnetProject.getProject() } });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})(window, document);
