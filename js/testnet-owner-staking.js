/* ALBUKHR TESTNET OWNER STAKING OFFERS v2
 * Project owners configure duration-specific reward rates within ALBUKHR caps.
 * The preview is informational; PostgreSQL remains the final financial gate.
 */
(function (window, document) {
  "use strict";
  var API_BASE = "https://test-albukhr-api.onrender.com";
  var HOST = "test.albukhr.com";
  var NETWORK = "testnet";
  var currentProject = null;
  var policyPayload = null;
  var busy = false;
  var rootId = "albukhrOwnerStakingPanel";

  function clean(v) { return String(v == null ? "" : v).trim(); }
  function num(v) { var n = Number(v); return Number.isFinite(n) ? n : 0; }
  function el(id) { return document.getElementById(id); }
  function pi(v) { return num(v).toFixed(2) + " Pi"; }

  function validateEnvironment() {
    var env = window.ALBukhrEnvironment;
    if (!env || typeof env.isKnown !== "function" || typeof env.isTestnet !== "function" || typeof env.getNetwork !== "function") {
      throw new Error("TESTNET_ENVIRONMENT_UNAVAILABLE");
    }
    if (!env.isKnown() || !env.isTestnet() || env.getNetwork() !== NETWORK) throw new Error("INVALID_TESTNET_ENVIRONMENT");
    var host = clean(typeof env.getHostname === "function" ? env.getHostname() : window.location.hostname).toLowerCase();
    if (host !== HOST) throw new Error("OWNER_STAKING_TESTNET_ONLY");
  }

  async function request(path, body) {
    validateEnvironment();
    var auth = window.AlbukhrTestnetAuth;
    if (!auth || typeof auth.requireTestnetAuth !== "function" || typeof auth.getSessionToken !== "function") {
      throw new Error("TESTNET_AUTH_MODULE_UNAVAILABLE");
    }
    var session = await auth.requireTestnetAuth({ redirectOnFailure: false });
    var token = clean(auth.getSessionToken());
    if (!session || !token) throw new Error("TESTNET_SESSION_REQUIRED");
    var response = await fetch(API_BASE + "/staking/owner/" + path, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", "X-Testnet-Session": token },
      body: JSON.stringify(body || {})
    });
    var data = null;
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(clean(data && (data.message || data.error)) || "OWNER_STAKING_REQUEST_FAILED");
    return data;
  }

  function ensurePanel() {
    var panel = el(rootId);
    if (panel) return panel;
    panel = document.createElement("section");
    panel.id = rootId;
    panel.className = "panel owner-staking-panel";
    panel.setAttribute("aria-labelledby", "ownerStakingHeading");
    panel.innerHTML =
      '<div class="section-head"><div><div class="section-kicker">STAKING POLICY</div><h2 id="ownerStakingHeading">Staking offers</h2></div><span class="owner-staking-badge">TESTNET</span></div>' +
      '<p class="owner-staking-intro">Choose from ALBUKHR-approved durations and set the reward rate your project can support. Each rate is checked against the limit for that exact duration. Existing stakes keep their original terms.</p>' +
      '<div id="ownerStakingSummary" class="owner-staking-summary" aria-live="polite">Loading policy and reserve status…</div>' +
      '<div id="ownerStakingRows" class="owner-staking-rows"></div>' +
      '<p id="ownerStakingStatus" class="owner-staking-status" aria-live="polite"></p>';
    var main = document.querySelector("main.owner-shell") || document.querySelector("main");
    var before = main && main.querySelector(".notice");
    if (main) main.insertBefore(panel, before || null);
    return panel;
  }

  function setStatus(text, isError) {
    var node = el("ownerStakingStatus");
    if (!node) return;
    node.textContent = clean(text);
    node.dataset.state = isError ? "error" : "normal";
  }

  function appendLine(node, text) {
    var item = document.createElement("div");
    var span = document.createElement("span");
    span.textContent = text;
    item.appendChild(span);
    node.appendChild(item);
  }

  function renderSummary(payload) {
    var node = el("ownerStakingSummary");
    if (!node) return;
    var policy = payload.policy || {};
    var coverage = payload.coverage || {};
    var preview = payload.preview || {};
    node.textContent = "";
    appendLine(node, "Project liquidity target: " + pi(preview.required_liquidity) + " (verified " + pi(preview.verified_liquidity) + ")");
    appendLine(node, "Available reward-funding liquidity: " + pi(preview.available_reward_liquidity));
    appendLine(node, "Capital reserve balance: " + pi(coverage.capital_reserve_balance));
    appendLine(node, "Project operating balance: " + pi(coverage.project_operating_balance));
    appendLine(node, "Reward reserve balance: " + pi(coverage.reward_reserve_balance));
    appendLine(node, "Outstanding principal and reward liability: " + pi(coverage.total_liability));
    appendLine(node, "Current staking stage: " + (clean(preview.staking_stage) || "Not assigned"));

    var note = document.createElement("p");
    note.className = "owner-staking-policy-note";
    var notes = [];
    notes.push("Reward percentages are total rewards for the selected term, not APR.");
    notes.push("The engine calculates reward funding, capital reserve and deployment from the live Testnet policy.");
    if (!payload.can_configure) notes.push("Offer changes are locked because the project or ALBUKHR policy is not currently eligible for configuration.");
    if (!preview.target_met) notes.push("New staking remains blocked until verified liquidity reaches this project's full configured target.");
    if (!policy.staking_policy_active) notes.push("Global Testnet staking is currently paused by ALBUKHR. You may configure offers, but investors cannot stake.");
        if (policy.approval_status === "not_provisioned") {
      notes.push("ALBUKHR Admin must assign a staking stage and provision this project's risk controls before you can configure offers.");
    } else if (policy.approval_status && policy.approval_status !== "approved") {
      notes.push("Project risk controls are awaiting Super Admin review.");
        }
    if (policy.approval_status === "approved" && !policy.staking_enabled) notes.push("Project risk controls are approved but project staking has not been enabled.");
    note.textContent = notes.join(" ");
    node.appendChild(note);
  }

  function calculatePreview(term, rewardPercent) {
    var p = policyPayload && policyPayload.preview ? policyPayload.preview : {};
    var minStake = num(p.minimum_stake);
    var rate = num(rewardPercent) / 100;
    var availableReward = Math.max(0, num(p.available_reward_liquidity));
    var rewardPerMinimumStake = minStake * rate;
    var remainingPrincipal = Math.max(0, num(p.max_active_principal) - num(p.outstanding_principal));
    var maxByReward = rewardPerMinimumStake > 0 ? Math.floor((availableReward + 0.00000001) / rewardPerMinimumStake) : 0;
    var maxByPrincipal = minStake > 0 ? Math.floor((remainingPrincipal + 0.00000001) / minStake) : 0;
    var maxStakers = Math.max(0, Math.min(maxByReward, maxByPrincipal));
    var reserveAmount = minStake * num(p.capital_reserve_percent) / 100;
    var deploymentAmount = minStake * num(p.maximum_deployment_percent) / 100;
    var rewardCapacity = rewardPerMinimumStake * maxStakers;
    return {
      minStake: minStake,
      rewardPerMinimumStake: rewardPerMinimumStake,
      maxStakers: maxStakers,
      rewardCapacity: rewardCapacity,
      reserveAmount: reserveAmount,
      deploymentAmount: deploymentAmount,
      remainingRewardLiquidity: Math.max(0, availableReward - rewardCapacity)
    };
  }

  function renderPreview(node, term, input) {
    if (!node) return;
    node.textContent = "";
    var rate = num(input && input.value);
    var maxRate = num(term.max_reward_percent);
    var p = policyPayload && policyPayload.preview ? policyPayload.preview : {};
    var preview = calculatePreview(term, rate);
    var lines = [
      "Reward for minimum stake: " + pi(preview.rewardPerMinimumStake),
      "Estimated maximum new stakers at minimum stake: " + preview.maxStakers,
      "Reward funding committed at that capacity: " + pi(preview.rewardCapacity),
      "Capital reserve from one minimum stake: " + pi(preview.reserveAmount) + " (" + num(p.capital_reserve_percent).toFixed(2) + "%)",
      "Maximum operating/deployment allocation from one minimum stake: " + pi(preview.deploymentAmount) + " (" + num(p.maximum_deployment_percent).toFixed(2) + "%)"
    ];
    lines.forEach(function (line) { appendLine(node, line); });
    var explanation = document.createElement("p");
    explanation.className = "owner-staking-policy-note";
    if (!(rate > 0)) {
      explanation.textContent = "Enter a reward rate to calculate reward funding and the estimated staker limit.";
    } else if (rate > maxRate) {
      explanation.textContent = "This rate exceeds the ALBUKHR maximum of " + maxRate.toFixed(2) + "% for " + Number(term.duration_days) + " days.";
    } else if (preview.maxStakers === 0) {
      explanation.textContent = "There is not enough free reward liquidity or remaining active-principal capacity for another minimum-size stake. New staking must remain closed until verified liquidity or capacity increases.";
    } else {
      explanation.textContent = "The estimate assumes every new staker contributes only the minimum stake. Larger stakes consume reward capacity faster. The API and database re-check all amounts before accepting each stake.";
    }
    node.appendChild(explanation);
  }

  function renderOffers(payload) {
    var root = el("ownerStakingRows");
    if (!root) return;
    root.textContent = "";
    var terms = Array.isArray(payload.terms) ? payload.terms : [];
    if (!terms.length) {
      root.textContent = "No ALBUKHR-approved staking durations are configured in the global Testnet policy.";
      return;
    }
    terms.forEach(function (term) {
      var row = document.createElement("div");
      row.className = "owner-staking-row";
      var info = document.createElement("div");
      info.className = "owner-staking-term-info";
      var title = document.createElement("strong");
      title.textContent = Number(term.duration_days) + " days";
      var min = document.createElement("span");
      min.textContent = "Minimum stake: " + pi(term.min_stake);
      var cap = document.createElement("span");
      cap.textContent = "ALBUKHR maximum: " + num(term.max_reward_percent).toFixed(2) + "% total reward";
      info.appendChild(title); info.appendChild(min); info.appendChild(cap);

      var field = document.createElement("label");
      field.className = "owner-staking-rate-field";
      var label = document.createElement("span");
      label.textContent = "Project reward rate (%)";
      var input = document.createElement("input");
      input.type = "number";
      input.min = "0.01";
      input.max = String(num(term.max_reward_percent));
      input.step = "0.01";
      input.value = num(term.reward_percent) > 0 ? num(term.reward_percent).toFixed(2) : "";
      input.setAttribute("aria-label", "Reward rate for " + term.duration_days + " days");
      input.disabled = !payload.can_configure || busy;
      field.appendChild(label);
      field.appendChild(input);

      var button = document.createElement("button");
      button.type = "button";
      button.className = "action-btn primary owner-staking-save";
      button.textContent = "Save rate";
      button.disabled = !payload.can_configure || busy;
      var previewBox = document.createElement("div");
      previewBox.className = "owner-staking-preview";
      previewBox.setAttribute("aria-live", "polite");
      input.addEventListener("input", function () { renderPreview(previewBox, term, input); });
      button.addEventListener("click", function () {
        saveOffer(Number(term.duration_days), num(input.value), button, input);
      });
      row.appendChild(info); row.appendChild(field); row.appendChild(previewBox); row.appendChild(button);
      root.appendChild(row);
      renderPreview(previewBox, term, input);
    });
  }

  async function refresh() {
    if (!currentProject || busy) return;
    busy = true;
    try {
      var payload = await request("offers", {
        projectId: clean(currentProject.id),
        projectCode: clean(currentProject.project_code)
      });
      policyPayload = payload;
      renderSummary(payload);
      renderOffers(payload);
      setStatus(payload.can_configure
        ? "You can save duration-specific reward rates within ALBUKHR's published limits. Staking is separately controlled by Admin and the global policy."
        : "Offer configuration is locked until the project's configuration requirements are met.");
    } catch (error) {
      policyPayload = null;
      var summary = el("ownerStakingSummary");
      if (summary) summary.textContent = "Unable to verify the owner session, staking policy, or liquidity coverage.";
      var rows = el("ownerStakingRows");
      if (rows) rows.textContent = "Offer settings remain locked until the secure Testnet API is available.";
      setStatus(clean(error && error.message) || "OWNER_STAKING_LOAD_FAILED", true);
    } finally {
      busy = false;
      if (policyPayload) renderOffers(policyPayload);
    }
  }

  async function saveOffer(durationDays, rewardPercent, button, input) {
    if (busy || !currentProject || !policyPayload || policyPayload.can_configure !== true) return;
    var term = (policyPayload.terms || []).find(function (item) { return Number(item.duration_days) === durationDays; });
    var maxPercent = num(term && term.max_reward_percent);
    if (!(rewardPercent > 0) || rewardPercent > maxPercent) {
      setStatus("Reward rate must be greater than 0 and no higher than the ALBUKHR maximum of " + maxPercent.toFixed(2) + "% for this duration.", true);
      return;
    }
    busy = true;
    if (button) { button.disabled = true; button.textContent = "Saving…"; }
    try {
      var result = await request("offer-settings", {
        projectId: clean(currentProject.id),
        projectCode: clean(currentProject.project_code),
        durationDays: durationDays,
        rewardRate: rewardPercent / 100
      });
      if (policyPayload && Array.isArray(policyPayload.terms)) {
        policyPayload.terms = policyPayload.terms.map(function (item) {
          if (Number(item.duration_days) !== durationDays) return item;
          return Object.assign({}, item, {
            reward_rate: Number(result.offer.reward_rate),
            reward_percent: Number(result.offer.reward_percent),
            active: result.offer.active === true
          });
        });
      }
      setStatus("Saved " + durationDays + "-day offer at " + Number(result.offer.reward_percent).toFixed(2) + "%. Existing stakes are unchanged.");
      renderOffers(policyPayload);
    } catch (error) {
      setStatus(clean(error && error.message) || "OFFER_UPDATE_FAILED", true);
    } finally {
      busy = false;
      if (policyPayload) renderOffers(policyPayload);
    }
  }

  window.addEventListener("albukhr:testnet-owner-project-rendered", function (event) {
    var detail = event && event.detail ? event.detail : {};
    var nextProject = detail.project;
    if (!nextProject || !clean(nextProject.id) || !clean(nextProject.project_code)) return;
    currentProject = nextProject;
    ensurePanel();
    refresh();
  });
})(window, document);
