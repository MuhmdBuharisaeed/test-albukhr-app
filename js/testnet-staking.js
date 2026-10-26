/* ALBUKHR TESTNET STAKING CLIENT v1 — Testnet host only. */
(function (window, document) {
  "use strict";

  var NETWORK = "testnet";
  var HOST = "test.albukhr.com";
  var API_BASE = "https://test-albukhr-api.onrender.com/staking";
  var INVESTOR_API = "https://test-albukhr-api.onrender.com/investor-data";
  var PI_SDK_URL = "https://sdk.minepi.com/pi-sdk.js";
  var currentProject = null;
  var currentTerms = [];
  var eligible = false;
  var busy = false;
  var piInitialized = false;
  var piInitialization = null;
  var piAuthResult = null;
  var piAuthentication = null;
  var pendingIncompletePayments = [];
  var modal = null;
  var notice = null;

  function clean(value) { return String(value == null ? "" : value).trim(); }
  function numberValue(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  function element(id) { return document.getElementById(id); }
  function setText(id, value) {
    var node = element(id);
    if (node) node.textContent = clean(value);
  }
  function formatPi(value) { return numberValue(value).toFixed(2) + " Pi"; }

  function validateEnvironment() {
    var env = window.ALBukhrEnvironment;
    if (!env || typeof env.isKnown !== "function" || typeof env.isTestnet !== "function" ||
        typeof env.getNetwork !== "function") throw new Error("TESTNET_ENVIRONMENT_UNAVAILABLE");
    if (!env.isKnown() || !env.isTestnet() || env.getNetwork() !== NETWORK) {
      throw new Error("INVALID_TESTNET_ENVIRONMENT");
    }
    var host = typeof env.getHostname === "function" ? clean(env.getHostname()).toLowerCase() :
      clean(window.location.hostname).toLowerCase();
    if (host !== HOST) throw new Error("TESTNET_HOST_REQUIRED");
  }

  function authModule() {
    var auth = window.AlbukhrTestnetAuth;
    if (!auth || typeof auth.getSessionToken !== "function") throw new Error("TESTNET_SESSION_REQUIRED");
    return auth;
  }
  function sessionToken() {
    var token = clean(authModule().getSessionToken());
    if (!token) throw new Error("TESTNET_SESSION_REQUIRED");
    return token;
  }

  async function parseResponse(response) {
    try { return await response.json(); } catch (_) { return null; }
  }

  async function apiRequest(path, options) {
    validateEnvironment();
    options = options || {};
    var headers = { Accept: "application/json", "X-Testnet-Session": sessionToken() };
    if (options.piToken) headers.Authorization = "Bearer " + clean(options.piToken);
    if (options.body != null) headers["Content-Type"] = "application/json";
    var response = await fetch(API_BASE.replace(/\/+$/, "") + "/" + clean(path).replace(/^\/+/, ""), {
      method: clean(options.method || "GET").toUpperCase(),
      headers: headers,
      body: options.body == null ? undefined : JSON.stringify(options.body)
    });
    var data = await parseResponse(response);
    if (!response.ok) {
      var code = clean(data && (data.error || data.message)) || "TESTNET_STAKING_HTTP_" + response.status;
      var error = new Error(code);
      error.status = response.status;
      error.body = data;
      throw error;
    }
    return data;
  }

  function ensurePiSdkLoaded() {
    if (window.Pi && typeof window.Pi.authenticate === "function" && typeof window.Pi.createPayment === "function") {
      return Promise.resolve(window.Pi);
    }
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-albukhr-pi-sdk="true"]');
      var script = existing || document.createElement("script");
      var settled = false;
      var timeout = window.setTimeout(function () {
        if (settled) return;
        settled = true;
        reject(new Error("PI_SDK_LOAD_TIMEOUT"));
      }, 12000);
      script.onload = function () {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        if (!window.Pi || typeof window.Pi.createPayment !== "function") reject(new Error("PI_SDK_UNAVAILABLE"));
        else resolve(window.Pi);
      };
      script.onerror = function () {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        reject(new Error("PI_SDK_LOAD_FAILED"));
      };
      if (!existing) {
        script.src = PI_SDK_URL;
        script.async = true;
        script.dataset.albukhrPiSdk = "true";
        document.head.appendChild(script);
      }
    });
  }

  async function initializePi() {
    validateEnvironment();
    if (piInitialized) return window.Pi;
    if (piInitialization) return piInitialization;
    piInitialization = (async function () {
      var Pi = await ensurePiSdkLoaded();
      await Promise.resolve(Pi.init({ version: "2.0", sandbox: true }));
      piInitialized = true;
      return Pi;
    })();
    try { return await piInitialization; }
    catch (error) { piInitialization = null; throw error; }
  }

  async function recoverIncomplete(payment) {
    var identifier = clean(payment && (payment.identifier || payment.id));
    if (!identifier || !piAuthResult || !piAuthResult.accessToken) return null;
    return apiRequest("incomplete", {
      method: "POST",
      piToken: piAuthResult.accessToken,
      body: {
        paymentId: identifier,
        txid: clean(payment && payment.transaction && payment.transaction.txid) || undefined
      }
    });
  }

  async function authenticatePi() {
    validateEnvironment();
    // Validate the gateway session before requesting Pi payment permission.
    var auth = authModule();
    if (typeof auth.requireTestnetAuth === "function") {
      var allowed = await auth.requireTestnetAuth({ redirectOnFailure: false });
      if (!allowed) throw new Error("TESTNET_SESSION_REQUIRED");
    }
    sessionToken();
    if (piAuthResult && clean(piAuthResult.accessToken) && piAuthResult.user && clean(piAuthResult.user.uid)) {
      return piAuthResult;
    }
    if (piAuthentication) return piAuthentication;
    piAuthentication = (async function () {
      var Pi = await initializePi();
      pendingIncompletePayments = [];
      var result = await Pi.authenticate(["username", "payments"], function (payment) {
        if (payment) pendingIncompletePayments.push(payment);
      });
      if (!result || !clean(result.accessToken) || !result.user || !clean(result.user.uid)) {
        throw new Error("PI_AUTH_RESULT_INVALID");
      }
      // Pi access token remains in memory only.
      piAuthResult = {
        accessToken: clean(result.accessToken),
        user: { uid: clean(result.user.uid), username: clean(result.user.username) || null }
      };
      for (var i = 0; i < pendingIncompletePayments.length; i += 1) {
        try { await recoverIncomplete(pendingIncompletePayments[i]); }
        catch (error) { console.warn("[ALBUKHR TESTNET STAKING RECOVERY]", error); }
      }
      pendingIncompletePayments = [];
      return piAuthResult;
    })();
    try { return await piAuthentication; }
    finally { piAuthentication = null; }
  }

  function ensureStylesAndModal() {
    if (modal) return;
    modal = document.createElement("div");
    modal.id = "testnetStakeModal";
    modal.className = "tn-stake-modal";
    modal.hidden = true;
    modal.innerHTML = [
      '<div class="tn-stake-dialog" role="dialog" aria-modal="true" aria-labelledby="tnStakeTitle">',
      '  <button class="tn-stake-close" type="button" aria-label="Close staking dialog">×</button>',
      '  <div class="tn-stake-kicker">ALBUKHR TESTNET</div>',
      '  <h2 id="tnStakeTitle">Create a Testnet stake</h2>',
      '  <p class="tn-stake-intro">Choose the amount of Test-Pi and an available staking term for this approved project.</p>',
      '  <label for="tnStakeAmount">Stake amount (Pi)</label>',
      '  <input id="tnStakeAmount" type="number" min="0.01" step="0.01" inputmode="decimal" autocomplete="off">',
      '  <label for="tnStakeDuration">Duration</label>',
      '  <select id="tnStakeDuration"></select>',
      '  <div class="tn-stake-estimate" aria-live="polite"><span>Estimated fixed-term reward</span><strong id="tnStakeReward">—</strong><small id="tnStakeRateNote">Displayed rates are the configured Testnet terms.</small></div>',
      '  <p id="tnStakeFeedback" class="tn-stake-feedback" role="status" aria-live="polite"></p>',
      '  <div class="tn-stake-actions"><button id="tnStakeCancel" type="button" class="tn-stake-secondary">Cancel</button><button id="tnStakeConfirm" type="button" class="tn-stake-primary">Continue to Pi payment</button></div>',
      '  <p class="tn-stake-disclaimer">Testnet only. No Mainnet Pi is used. A stake is recorded only after the Pi Platform confirms completion and transaction verification.</p>',
      '</div>'
    ].join("");
    document.body.appendChild(modal);
    modal.querySelector(".tn-stake-close").addEventListener("click", closeModal);
    element("tnStakeCancel").addEventListener("click", closeModal);
    element("tnStakeConfirm").addEventListener("click", submitStake);
    element("tnStakeAmount").addEventListener("input", updateEstimate);
    element("tnStakeDuration").addEventListener("change", updateEstimate);
    modal.addEventListener("click", function (event) { if (event.target === modal) closeModal(); });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape" && modal && !modal.hidden) closeModal(); });
  }

  function setFeedback(message, isError) {
    var node = element("tnStakeFeedback");
    if (!node) return;
    node.textContent = clean(message);
    node.classList.toggle("is-error", !!isError);
    node.classList.toggle("is-success", !isError && !!message);
  }
  function setBusy(value) {
    busy = !!value;
    var confirm = element("tnStakeConfirm");
    if (confirm) { confirm.disabled = busy; confirm.textContent = busy ? "Processing Testnet payment…" : "Continue to Pi payment"; }
    var amount = element("tnStakeAmount");
    var duration = element("tnStakeDuration");
    if (amount) amount.disabled = busy;
    if (duration) duration.disabled = busy;
  }
  function selectedTerm() {
    var select = element("tnStakeDuration");
    var value = select ? Number(select.value) : 0;
    for (var i = 0; i < currentTerms.length; i += 1) {
      if (Number(currentTerms[i].duration_days) === value) return currentTerms[i];
    }
    return null;
  }
  function updateEstimate() {
    var term = selectedTerm();
    var amount = numberValue(element("tnStakeAmount") && element("tnStakeAmount").value);
    if (!term) { setText("tnStakeReward", "—"); setText("tnStakeRateNote", "No active staking term is available."); return; }
    var rate = numberValue(term.reward_rate);
    setText("tnStakeReward", amount > 0 ? formatPi(amount * rate) : formatPi(0));
    setText("tnStakeRateNote", (rate * 100).toFixed(2) + "% configured reward rate for " + term.duration_days + " days; minimum " + formatPi(term.min_stake) + ".");
  }

  function openModal() {
    if (!currentProject || !eligible || busy) return;
    ensureStylesAndModal();
    var title = element("tnStakeTitle");
    if (title) title.textContent = "Stake in " + clean(currentProject.name || currentProject.project_code);
    var select = element("tnStakeDuration");
    select.textContent = "";
    currentTerms.forEach(function (term) {
      var option = document.createElement("option");
      option.value = String(term.duration_days);
      option.textContent = term.duration_days + " days · " + (numberValue(term.reward_rate) * 100).toFixed(2) + "% reward · minimum " + numberValue(term.min_stake) + " Pi";
      select.appendChild(option);
    });
    var amountInput = element("tnStakeAmount");
    amountInput.value = currentTerms.length ? String(currentTerms[0].min_stake) : "";
    amountInput.min = currentTerms.length ? String(currentTerms[0].min_stake) : "0.01";
    setFeedback("");
    updateEstimate();
    modal.hidden = false;
    document.body.classList.add("tn-stake-modal-open");
    try { amountInput.focus(); } catch (_) {}
  }
  function closeModal() {
    if (busy) return;
    if (modal) modal.hidden = true;
    document.body.classList.remove("tn-stake-modal-open");
  }

  async function createPiPayment(project, amount, term, accessToken) {
    var Pi = await initializePi();
    return new Promise(function (resolve, reject) {
      var settled = false;
      function fail(error) { if (settled) return; settled = true; reject(error instanceof Error ? error : new Error(clean(error && error.message) || "PI_PAYMENT_FAILED")); }
      Pi.createPayment({
        amount: amount,
        memo: "ALBUKHR Testnet stake · " + clean(project.project_code) + " · " + term.duration_days + " days",
        metadata: {
          network: NETWORK,
          action: "stake",
          project_id: clean(project.id),
          project_code: clean(project.project_code),
          duration_days: Number(term.duration_days)
        }
      }, {
        onReadyForServerApproval: async function (paymentId) {
          try {
            await apiRequest("approve", {
              method: "POST", piToken: accessToken,
              body: { paymentId: clean(paymentId), projectId: clean(project.id), projectCode: clean(project.project_code) }
            });
          } catch (error) { fail(error); }
        },
        onReadyForServerCompletion: async function (paymentId, txid) {
          try {
            var result = await apiRequest("complete", {
              method: "POST", piToken: accessToken,
              body: { paymentId: clean(paymentId), projectId: clean(project.id), projectCode: clean(project.project_code), txid: clean(txid) }
            });
            if (settled) return;
            settled = true;
            resolve(result);
          } catch (error) { fail(error); throw error; }
        },
        onCancel: function () { fail(new Error("PI_PAYMENT_CANCELLED")); },
        onError: function (error) { fail(error || new Error("PI_PAYMENT_FAILED")); }
      });
    });
  }

  async function refreshStakeSummary(project) {
    try {
      var token = sessionToken();
      var response = await fetch(INVESTOR_API, {
        method: "GET", headers: { Accept: "application/json", Authorization: "Bearer " + token }
      });
      var payload = await parseResponse(response);
      if (!response.ok || !payload || !Array.isArray(payload.stakes)) return;
      var code = clean(project.project_code).toLowerCase();
      var projectId = clean(project.id).toLowerCase();
      var stakes = payload.stakes.filter(function (stake) {
        return clean(stake.network).toLowerCase() === NETWORK &&
          (clean(stake.project_code).toLowerCase() === code || clean(stake.project_id).toLowerCase() === projectId);
      });
      var active = stakes.filter(function (stake) { return clean(stake.status).toLowerCase() === "active"; });
      var totalStake = active.reduce(function (sum, stake) { return sum + numberValue(stake.amount); }, 0);
      var withdrawals = Array.isArray(payload.withdrawals) ? payload.withdrawals : [];
      var totalReward = active.reduce(function (sum, stake) {
        var paidOrPending = withdrawals.filter(function (row) {
          return clean(row.stake_id) === clean(stake.id) && clean(row.withdrawal_type).toLowerCase() === "reward" &&
            ["pending", "processing", "approved", "completed"].indexOf(clean(row.status).toLowerCase()) !== -1;
        }).reduce(function (sub, row) { return sub + numberValue(row.net_amount || row.requested_amount); }, 0);
        return sum + Math.max(0, numberValue(stake.reward_amount) - paidOrPending);
      }, 0);
      setText("aStake", formatPi(totalStake));
      setText("aStakeNote", active.length + " active Testnet stake" + (active.length === 1 ? "" : "s"));
      setText("aReward", formatPi(totalReward));
      setText("aRewardNote", totalReward > 0 ? "Available Testnet reward" : "No available Testnet reward");
      if (element("aStake")) element("aStake").dataset.liveState = "true";
      if (element("aStakeNote")) element("aStakeNote").dataset.liveState = "true";
      if (element("aReward")) element("aReward").dataset.liveState = "true";
      if (element("aRewardNote")) element("aRewardNote").dataset.liveState = "true";
    } catch (error) { console.warn("[ALBUKHR TESTNET STAKING REFRESH]", error); }
  }

  async function submitStake() {
    if (busy || !currentProject || !eligible) return;
    var term = selectedTerm();
    var amount = numberValue(element("tnStakeAmount") && element("tnStakeAmount").value);
    if (!term) { setFeedback("No active staking term is selected.", true); return; }
    if (!Number.isFinite(amount) || amount < numberValue(term.min_stake)) {
      setFeedback("Minimum for this duration is " + formatPi(term.min_stake) + ".", true); return;
    }
    if (amount > 1000000000) { setFeedback("Amount exceeds the Testnet safety limit.", true); return; }
    setBusy(true);
    setFeedback("Checking your Testnet session and authenticating with Pi…");
    try {
      var auth = await authenticatePi();
      setFeedback("Confirm the Testnet payment in Pi Browser. A stake is created only after server verification.");
      var result = await createPiPayment(currentProject, amount, term, auth.accessToken);
      setFeedback("Payment verified. Testnet stake recorded successfully.");
      setText("aStake", "Updating…");
      await refreshStakeSummary(currentProject);
      try { window.dispatchEvent(new CustomEvent("albukhr:testnet-stake-completed", { detail: result })); } catch (_) {}
      window.setTimeout(function () { closeModal(); }, 800);
    } catch (error) {
      console.error("[ALBUKHR TESTNET STAKING]", error);
      var message = clean(error && (error.message || error.error)) || "TESTNET_STAKING_FAILED";
      if (message === "PI_PAYMENT_CANCELLED") message = "You cancelled the Pi Testnet payment. No stake was created.";
      else if (message === "TESTNET_SESSION_REQUIRED") message = "Sign in to your ALBUKHR Testnet account before staking.";
      else if (message === "PI_SDK_UNAVAILABLE" || message === "PI_SDK_LOAD_FAILED") message = "Pi Browser payment SDK is unavailable. Open this page in Pi Browser and retry.";
      else message = "Staking did not complete: " + message + ". If Pi already processed a payment, do not pay again; support must reconcile that payment first.";
      setFeedback(message, true);
    } finally { setBusy(false); }
  }

  async function loadTerms(project) {
    currentProject = project;
    eligible = false;
    currentTerms = [];
    var button = element("stakeBtn");
    if (button) { button.disabled = true; button.setAttribute("aria-disabled", "true"); var small = button.querySelector("small"); if (small) small.textContent = "Checking…"; }
    if (!project || clean(project.network).toLowerCase() !== NETWORK) {
      setText("aStakeNote", "Staking is available on approved Testnet projects only.");
      return;
    }
    try {
      validateEnvironment();
      var auth = authModule();
      var token = clean(auth.getSessionToken());
      if (!token) {
        setText("aStakeNote", "Sign in to ALBUKHR Testnet to enable staking.");
        if (button) { var smallNoSession = button.querySelector("small"); if (smallNoSession) smallNoSession.textContent = "Sign in required"; }
        return;
      }
      var data = await apiRequest("terms?project_code=" + encodeURIComponent(clean(project.project_code)), { method: "GET" });
      currentTerms = Array.isArray(data.terms) ? data.terms : [];
      eligible = data.eligible === true && currentTerms.length > 0;
      if (button) {
        button.disabled = !eligible;
        if (eligible) button.removeAttribute("aria-disabled"); else button.setAttribute("aria-disabled", "true");
        var small = button.querySelector("small");
        if (small) small.textContent = eligible ? "Stake now" : "Locked";
      }
      if (eligible) {
        if (!element("aStake") || clean(element("aStake").textContent) === "LOCKED") {
          setText("aStakeNote", "Available for Testnet staking");
        }
      } else {
        setText("aStakeNote", clean(data.reason) === "TREASURY_NOT_READY" ? "Project liquidity/treasury is not ready for staking." : "No active Testnet staking terms are available.");
      }
    } catch (error) {
      eligible = false;
      setText("aStakeNote", clean(error && error.message) === "TESTNET_SESSION_REQUIRED" ? "Sign in to ALBUKHR Testnet to enable staking." : "Testnet staking status could not be verified.");
      if (button) { button.disabled = true; button.setAttribute("aria-disabled", "true"); var smallErr = button.querySelector("small"); if (smallErr) smallErr.textContent = "Locked"; }
      console.warn("[ALBUKHR TESTNET STAKING TERMS]", error);
    }
  }

  function onProjectRendered(event) {
    var project = event && event.detail && event.detail.project;
    if (!project) return;
    loadTerms(project);
  }

  function init() {
    var stakeButton = element("stakeBtn");
    if (stakeButton) {
      stakeButton.addEventListener("click", function (event) {
        event.preventDefault();
        openModal();
      });
    }
    window.addEventListener("albukhr:testnet-project-rendered", onProjectRendered);
    // The project engine may already have rendered before this module loads.
    if (window.ALBukhrTestnetCurrentProject) loadTerms(window.ALBukhrTestnetCurrentProject);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(window, document);
