/* ALBUKHR TESTNET PROJECT OWNER PAGE v5
 * Additive owner self-service profile layer.
 * Ownership transfer remains Super Admin-only.
 * Step 5: enable owner-authorized Testnet liquidity payment flow.
 */
(function (window, document) {
  "use strict";

  var OWNER_API =
    "https://vhvkwvngmrlgyzwemttt.supabase.co/functions/v1/testnet-project-owner";

  var state = {
    projectId: "",
    project: null,
    treasury: null,
    ownerBalance: 0,
    liquidity: null,
    session: null,
    owner: null,
    ownerProfile: null,
    withdrawalInFlight: false,
    profileSaveInFlight: false,
    liquidityPaymentInFlight: false,
    ownerLoaded: false
  };

  function clean(value) { return String(value == null ? "" : value).trim(); }
  function numberValue(value) { var n = Number(value); return Number.isFinite(n) ? n : 0; }
  function formatPi(value) { return numberValue(value).toFixed(2) + " Pi"; }
  function byId(id) { return document.getElementById(id); }
  function setText(id, value) { var node = byId(id); if (node) node.textContent = clean(value); }
  function setValue(id, value) { var node = byId(id); if (node) node.value = clean(value); }
  function setHidden(id, hidden) { var node = byId(id); if (node) node.hidden = !!hidden; }

  function setStatus(id, message, type) {
    var node = byId(id);
    if (!node) return;
    node.textContent = clean(message);
    if (type) node.dataset.status = type;
    else delete node.dataset.status;
  }

  function getProjectId() {
    try {
      var params = new URLSearchParams(window.location.search);
      return clean(params.get("project") || params.get("project_id"));
    } catch (_) { return ""; }
  }

  function validateEnvironment() {
    var env = window.ALBukhrEnvironment;
    if (!env || typeof env.isKnown !== "function" ||
        typeof env.isTestnet !== "function" ||
        typeof env.getNetwork !== "function") {
      throw new Error("TESTNET_ENVIRONMENT_UNAVAILABLE");
    }
    if (!env.isKnown() || !env.isTestnet() || env.getNetwork() !== "testnet") {
      throw new Error("INVALID_TESTNET_ENVIRONMENT");
    }
    var hostname = clean(typeof env.getHostname === "function"
      ? env.getHostname() : window.location.hostname).toLowerCase();
    if (hostname !== "test.albukhr.com") throw new Error("TESTNET_HOST_REQUIRED");
  }

  function getAuth() {
    var auth = window.AlbukhrTestnetAuth;
    if (!auth || typeof auth.requireTestnetAuth !== "function" ||
        typeof auth.getSessionToken !== "function") {
      throw new Error("TESTNET_AUTH_MODULE_UNAVAILABLE");
    }
    return auth;
  }

  async function ensureSession() {
    validateEnvironment();
    state.session = await getAuth().requireTestnetAuth({ redirectOnFailure: true });
    if (!state.session) throw new Error("TESTNET_SESSION_REQUIRED");
    return state.session;
  }

  async function ownerRequest(method, query, body) {
    var token = clean(getAuth().getSessionToken());
    if (!token) throw new Error("TESTNET_SESSION_REQUIRED");

    var url = OWNER_API + (query ? "?" + query : "");
    var options = {
      method: method,
      headers: { "Accept": "application/json", "X-Testnet-Session": token }
    };

    if (body !== undefined) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    var response;
    try { response = await fetch(url, options); }
    catch (e) { var ne = new Error("PROJECT_OWNER_NETWORK_ERROR"); ne.cause = e; throw ne; }

    var payload = null;
    try { payload = await response.json(); } catch (_) {}

    if (!response.ok) {
      var apiError = new Error(clean(payload && payload.error) || ("PROJECT_OWNER_HTTP_" + response.status));
      apiError.status = response.status;
      apiError.body = payload;
      throw apiError;
    }
    return payload;
  }

  function renderLogo(project) {
    var img = byId("ownerProjectLogo"), fallback = byId("ownerProjectLogoFallback");
    if (!img) return;
    var url = clean(project && project.logo_url);
    if (!url) {
      img.hidden = true; img.removeAttribute("src");
      if (fallback) fallback.hidden = false;
      return;
    }
    img.hidden = true;
    img.alt = clean(project.name) + " logo";
    img.onload = function () { img.hidden = false; if (fallback) fallback.hidden = true; };
    img.onerror = function () { img.hidden = true; img.removeAttribute("src"); if (fallback) fallback.hidden = false; };
    img.src = url;
  }

  function renderWithdrawals(rows) {
    var container = byId("withdrawalHistory");
    if (!container) return;
    var list = Array.isArray(rows) ? rows : [];
    if (!list.length) {
      container.innerHTML = '<div class="empty-state">No Project Owner withdrawals yet.</div>';
      return;
    }
    container.innerHTML = list.map(function (row) {
      return '<article class="history-item">' +
        '<div><strong>' + escapeHtml(clean(row.status || "pending").toUpperCase()) + '</strong>' +
        '<span>' + escapeHtml(formatPi(row.requested_amount)) + ' requested</span></div>' +
        '<div class="history-meta"><span>Receive: ' + escapeHtml(formatPi(row.net_amount)) +
        '</span><span>' + escapeHtml(formatDate(row.created_at)) + '</span></div></article>';
    }).join("");
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function formatDate(value) {
    if (!value) return "—";
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    try {
      return new Intl.DateTimeFormat("en", {year:"numeric",month:"short",day:"numeric"}).format(date);
    } catch (_) { return date.toLocaleDateString(); }
  }

  function liquidityPaymentClientAvailable() {
    var client = window.AlbukhrTestnetLiquidityPayment;
    return !!client && typeof client.createLiquidityPayment === "function";
  }

  function setLiquidityAvailability() {
    var button = byId("addLiquidityBtn");
    if (!button) return;

    var liquidity = state.liquidity || {};
    var profile = state.ownerProfile || {};
    var owner = state.owner || {};
    var required = numberValue(liquidity.required);
    var verified = numberValue(liquidity.verified);
    var due = Math.max(0, required - verified);

    var ownerBound =
      !!clean(owner.user_id || owner.id) &&
      !!clean(owner.pi_uid);

    var ownerVerified =
      clean(profile.verification_status).toLowerCase() === "verified";

    var treasuryReady =
      !!state.treasury &&
      !!liquidity.treasury_configured;

    var ready =
      ownerBound &&
      ownerVerified &&
      treasuryReady &&
      due > 0 &&
      liquidityPaymentClientAvailable() &&
      !state.liquidityPaymentInFlight;

    button.disabled = !ready;
    button.title = ready
      ? "Start the server-authorized Testnet liquidity payment."
      : "";

    var amountNode = byId("liquidityAmount");
    if (amountNode) {
      amountNode.min = String(Math.max(100, due));
      if (due > 0 && !clean(amountNode.value)) {
        amountNode.placeholder = due.toFixed(2);
      }
    }

    if (state.liquidityPaymentInFlight) {
      setStatus("liquidityStatus", "Pi liquidity payment is in progress…");
    } else if (!ownerVerified) {
      setStatus("liquidityStatus", "Owner identity verification is required before liquidity can be added.", "error");
    } else if (!treasuryReady) {
      setStatus("liquidityStatus", "The Testnet project treasury is not ready for liquidity.", "error");
    } else if (due <= 0) {
      setStatus("liquidityStatus", "The project liquidity requirement is already satisfied.", "success");
    } else if (!liquidityPaymentClientAvailable()) {
      setStatus("liquidityStatus", "The Testnet Pi payment module is not available on this page.", "error");
    } else {
      setStatus("liquidityStatus", "Owner authorization verified. Minimum remaining liquidity: " + formatPi(due) + ".");
    }
  }

  function renderOwner(stateRow, ownerData) {
    var project = stateRow.project || {};
    var liquidity = stateRow.liquidity || {};
    var owner = ownerData || {};
    var profile = owner.profile || stateRow.owner_profile || {};

    state.project = project;
    state.treasury = stateRow.treasury || null;
    state.liquidity = liquidity;
    state.ownerBalance = numberValue(stateRow.owner_balance);
    state.owner = owner;
    state.ownerProfile = profile;

    setText("ownerTitle", "Manage " + (clean(project.name) || "Project"));
    setText("ownerSubtitle", "Owner controls for approved Testnet project " + (clean(project.project_code) || "—"));
    setText("projectName", clean(project.name) || "Project");
    setText("projectCode", clean(project.project_code) || "—");
    setText("ownerBalance", formatPi(state.ownerBalance));
    setText("requiredLiquidity", formatPi(liquidity.required));
    setText("verifiedLiquidity", formatPi(liquidity.verified));
    setText("liquidityCoverage", numberValue(liquidity.coverage).toFixed(1) + "% coverage");
    setText("treasuryState", liquidity.treasury_configured ? "CONFIGURED" : "NOT CONFIGURED");

    setValue("profilePiUid", owner.pi_uid);
    setValue("profileUsername", owner.username);
    setValue("profileDisplayName", profile.display_name);
    setValue("profileRoleTitle", profile.role_title);
    setValue("profileOrganization", profile.organization_name);
    setValue("profileEmail", profile.contact_email);
    setValue("profilePhone", profile.contact_phone);
    setValue("profileWallet", owner.wallet_address);
    setValue("profileBio", profile.bio);
    setText("profileVerificationState", clean(profile.verification_status || "pending").toUpperCase());

    var walletNode = byId("withdrawWallet");
    if (walletNode) walletNode.value = clean(owner.wallet_address);

    var withdrawButton = byId("requestWithdrawalBtn");
    if (withdrawButton) {
      withdrawButton.disabled = !owner || !clean(owner.wallet_address) || state.ownerBalance <= 0;
    }

    setLiquidityAvailability();

    renderLogo(project);
    renderWithdrawals(stateRow.withdrawals || []);

    var back = byId("backToProject");
    if (back && clean(project.id)) {
      back.href = "project.html?project=" + encodeURIComponent(project.project_code || project.id);
    }

    document.title = (clean(project.name) || "Project Owner") + " • ALBUKHR TESTNET";
  }

  function showAccessError(error) {
    var code = clean(error && error.message) || "PROJECT_OWNER_ACCESS_DENIED";
    setHidden("ownerContent", true);
    setHidden("ownerError", false);

    if (code === "PROJECT_OWNER_NOT_BOUND") {
      setText("ownerErrorTitle", "Project Owner access is not assigned");
      setText("ownerErrorText", "Your Testnet identity is authenticated, but this approved project is not currently bound to your account.");
      return;
    }
    if (code === "PROJECT_OWNER_ACCESS_DENIED") {
      setText("ownerErrorTitle", "Owner access denied");
      setText("ownerErrorText", "The Testnet owner service did not authorize this project for your identity.");
      return;
    }
    setText("ownerErrorTitle", "Unable to open Project Owner");
    setText("ownerErrorText", code);
  }

  async function load() {
    try {
      await ensureSession();
      state.projectId = getProjectId();
      if (!state.projectId) throw new Error("PROJECT_ID_REQUIRED");

      var payload = await ownerRequest("GET", "project_id=" + encodeURIComponent(state.projectId));
      var projects = Array.isArray(payload && payload.projects) ? payload.projects : [];
      if (!projects.length) throw new Error("PROJECT_OWNER_ACCESS_DENIED");

      state.ownerLoaded = true;
      setText("ownerUserPill", clean(payload.owner && payload.owner.username) || "OWNER");
      setHidden("ownerError", true);
      setHidden("ownerContent", false);
      renderOwner(projects[0], payload.owner || {});
    } catch (error) {
      console.error("[ALBUKHR TESTNET PROJECT OWNER]", error);
      showAccessError(error);
    }
  }

  async function refresh() {
    if (!state.projectId) return;
    try {
      var payload = await ownerRequest("GET", "project_id=" + encodeURIComponent(state.projectId));
      var projects = Array.isArray(payload && payload.projects) ? payload.projects : [];
      if (!projects.length) throw new Error("PROJECT_OWNER_ACCESS_DENIED");
      state.session = getAuth().getSession ? getAuth().getSession() : state.session;
      renderOwner(projects[0], payload.owner || {});
      setStatus("withdrawStatus", "Owner project state refreshed.", "success");
    } catch (error) {
      console.error("[ALBUKHR TESTNET PROJECT OWNER REFRESH]", error);
      setStatus("withdrawStatus", error && error.message ? error.message : "Unable to refresh owner state.", "error");
    }
  }

  async function startLiquidityPayment() {
    if (state.liquidityPaymentInFlight) return;

    try {
      await ensureSession();

      var amountNode = byId("liquidityAmount");
      var amount = numberValue(amountNode && amountNode.value);
      var required = numberValue(state.liquidity && state.liquidity.required);
      var verified = numberValue(state.liquidity && state.liquidity.verified);
      var due = Math.max(0, required - verified);

      if (due <= 0) {
        setStatus("liquidityStatus", "The project liquidity requirement is already satisfied.", "success");
        return;
      }
      if (amount < 100 || amount < due) {
        setStatus("liquidityStatus", "Enter at least " + formatPi(Math.max(100, due)) + " for the remaining Testnet liquidity requirement.", "error");
        return;
      }

      var project = state.project || {};
      if (!clean(project.id) || !clean(project.project_code)) {
        throw new Error("PROJECT_ID_AND_CODE_REQUIRED");
      }

      var payment = window.AlbukhrTestnetLiquidityPayment;
      if (!payment || typeof payment.createLiquidityPayment !== "function") {
        throw new Error("PI_SDK_PAYMENT_UNAVAILABLE");
      }

      state.liquidityPaymentInFlight = true;
      setLiquidityAvailability();

      setStatus("liquidityStatus", "Opening the Pi Testnet payment flow…");

      var result = await payment.createLiquidityPayment({
        id: project.id,
        project_code: project.project_code,
        network: "testnet"
      }, amount);

      setStatus(
        "liquidityStatus",
        result && result.record && result.record.verification_status === "verified"
          ? "Liquidity payment completed and verified."
          : "Liquidity payment completed and recorded. Testnet Admin verification is still required before it counts as verified.",
        "success"
      );

      await refresh();
    } catch (error) {
      console.error("[ALBUKHR TESTNET PROJECT OWNER LIQUIDITY]", error);
      setStatus(
        "liquidityStatus",
        error && error.message
          ? error.message
          : "Unable to complete the Testnet liquidity payment.",
        "error"
      );
    } finally {
      state.liquidityPaymentInFlight = false;
      setLiquidityAvailability();
    }
  }

  async function saveProfile() {
    if (state.profileSaveInFlight) return;

    var button = byId("saveOwnerProfileBtn");
    var wallet = clean(byId("profileWallet") && byId("profileWallet").value);
    if (!wallet) {
      setStatus("profileStatus", "A registered Testnet wallet address is required.", "error");
      return;
    }

    state.profileSaveInFlight = true;
    if (button) { button.disabled = true; button.textContent = "Saving…"; }
    setStatus("profileStatus", "Saving your Project Owner profile…");

    try {
      var response = await ownerRequest("POST", null, {
        action: "update_profile",
        project_id: state.projectId,
        wallet_address: wallet,
        display_name: clean(byId("profileDisplayName") && byId("profileDisplayName").value),
        role_title: clean(byId("profileRoleTitle") && byId("profileRoleTitle").value),
        organization_name: clean(byId("profileOrganization") && byId("profileOrganization").value),
        contact_email: clean(byId("profileEmail") && byId("profileEmail").value),
        contact_phone: clean(byId("profilePhone") && byId("profilePhone").value),
        bio: clean(byId("profileBio") && byId("profileBio").value)
      });

      state.owner = response.owner || state.owner;
      state.ownerProfile = response.profile || state.ownerProfile;

      setStatus("profileStatus",
        response.verification_reset
          ? "Profile saved. Identity-sensitive changes require Super Admin re-verification."
          : "Profile saved successfully.",
        "success"
      );
      await refresh();
    } catch (error) {
      console.error("[ALBUKHR TESTNET OWNER PROFILE]", error);
      setStatus("profileStatus", error && error.message ? error.message : "Unable to save owner profile.", "error");
    } finally {
      state.profileSaveInFlight = false;
      if (button) { button.disabled = false; button.textContent = "Save Profile"; }
    }
  }

  async function requestWithdrawal() {
    if (state.withdrawalInFlight) return;

    var amountNode = byId("withdrawAmount");
    var amount = numberValue(amountNode && amountNode.value);

    if (amount <= 0) {
      setStatus("withdrawStatus", "Enter a withdrawal amount greater than zero.", "error");
      return;
    }
    if (amount > state.ownerBalance) {
      setStatus("withdrawStatus", "Requested amount is greater than the available owner balance.", "error");
      return;
    }
    if (!clean(state.owner && state.owner.wallet_address)) {
      setStatus("withdrawStatus", "A registered Testnet wallet address is required.", "error");
      return;
    }

    state.withdrawalInFlight = true;
    var button = byId("requestWithdrawalBtn");
    if (button) { button.disabled = true; button.textContent = "Submitting…"; }
    setStatus("withdrawStatus", "Submitting Project Owner withdrawal request…");

    try {
      var response = await ownerRequest("POST", null, {
        action: "request_withdrawal",
        project_id: state.projectId,
        amount: amount
      });

      if (!response || !response.withdrawal || !response.withdrawal.id) {
        throw new Error("OWNER_WITHDRAWAL_REQUEST_FAILED");
      }

      setStatus("withdrawStatus", "Owner withdrawal request submitted successfully.", "success");
      if (amountNode) amountNode.value = "";
      await refresh();
    } catch (error) {
      console.error("[ALBUKHR TESTNET OWNER WITHDRAWAL]", error);
      setStatus("withdrawStatus", error && error.message ? error.message : "Owner withdrawal request failed.", "error");
    } finally {
      state.withdrawalInFlight = false;
      if (button) {
        button.textContent = "Request Owner Withdrawal";
        button.disabled = !state.owner || !clean(state.owner.wallet_address) || state.ownerBalance <= 0;
      }
    }
  }

  function bindEvents() {
    var refreshButton = byId("refreshOwnerBtn");
    if (refreshButton) refreshButton.addEventListener("click", refresh);

    var withdrawalButton = byId("requestWithdrawalBtn");
    if (withdrawalButton) withdrawalButton.addEventListener("click", requestWithdrawal);

    var profileButton = byId("saveOwnerProfileBtn");
    if (profileButton) profileButton.addEventListener("click", saveProfile);

    var addButton = byId("addLiquidityBtn");
    if (addButton) addButton.addEventListener("click", startLiquidityPayment);
  }

  function initialize() {
    bindEvents();
    load();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else initialize();
})(window, document);
