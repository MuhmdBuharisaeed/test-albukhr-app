/* ALBUKHR TESTNET OWNER STAKING OFFERS v1
 * Owners may adjust reward rates only within ALBUKHR-approved limits.
 * Duration choices remain the active duration rows defined by ALBUKHR.
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
    if (!response.ok) {
      throw new Error(clean(data && (data.message || data.error)) || "OWNER_STAKING_REQUEST_FAILED");
    }
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
      '<p class="owner-staking-intro">Choose a reward rate for each duration already allowed by ALBUKHR. You cannot add new durations or exceed ALBUKHR\'s reward limit. Existing stakes keep the terms agreed when they were created.</p>' +
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

  function renderSummary(payload) {
    var node = el("ownerStakingSummary");
    if (!node) return;
    var policy = payload.policy || {};
    var coverage = payload.coverage || {};
    node.textContent = "";
    var lines = [
      "Verified liquidity: " + pi(coverage.verified_liquidity_contributed),
      "Liquidity buffer: " + pi(coverage.liquidity_buffer),
      "Capital reserve: " + pi(coverage.capital_reserve_balance),
      "Operating balance: " + pi(coverage.project_operating_balance),
      "Reward reserve: " + pi(coverage.reward_reserve_balance),
      "Outstanding liability: " + pi(coverage.total_liability)
    ];
    lines.forEach(function (text) {
      var item = document.createElement("div");
      var span = document.createElement("span");
      span.textContent = text;
      item.appendChild(span);
      node.appendChild(item);
    });
    var note = document.createElement("p");
    note.className = "owner-staking-policy-note";
    note.textContent = payload.can_configure
      ? "Approved maximum reward rate: " + Number(policy.max_reward_percent || 0).toFixed(2) + "%. Reserve and deployment percentages are controlled by ALBUKHR."
      : "Offer settings are locked until ALBUKHR approves the staking policy and current liquidity coverage passes.";
    node.appendChild(note);
  }

  function renderOffers(payload) {
    var root = el("ownerStakingRows");
    if (!root) return;
    root.textContent = "";
    var terms = Array.isArray(payload.terms) ? payload.terms : [];
    if (!terms.length) {
      root.textContent = "No active durations are currently configured by ALBUKHR.";
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
      info.appendChild(title); info.appendChild(min);

      var field = document.createElement("label");
      field.className = "owner-staking-rate-field";
      var label = document.createElement("span");
      label.textContent = "Reward rate (%)";
      var input = document.createElement("input");
      input.type = "number";
      input.min = "0.01";
      input.max = payload.policy && payload.policy.max_reward_percent != null
        ? String(payload.policy.max_reward_percent) : "0";
      input.step = "0.01";
      input.value = (Number(term.reward_percent) || 0).toFixed(2);
      input.setAttribute("aria-label", "Reward rate for " + term.duration_days + " days");
      input.disabled = !payload.can_configure || busy;
      field.appendChild(label);
      field.appendChild(input);

      var button = document.createElement("button");
      button.type = "button";
      button.className = "action-btn primary owner-staking-save";
      button.textContent = "Save rate";
      button.disabled = !payload.can_configure || busy;
      button.addEventListener("click", function () {
        saveOffer(Number(term.duration_days), num(input.value), button, input);
      });
      row.appendChild(info); row.appendChild(field); row.appendChild(button);
      root.appendChild(row);
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
      setStatus(payload.can_configure ? "Offer settings are available within ALBUKHR policy." : "ALBUKHR policy controls are not yet approved for this project.");
    } catch (error) {
      policyPayload = null;
      var summary = el("ownerStakingSummary");
      if (summary) summary.textContent = "Unable to verify the owner session, staking policy, or liquidity coverage.";
      var rows = el("ownerStakingRows");
      if (rows) rows.textContent = "Offer settings remain locked until the secure Testnet API is available.";
      setStatus(clean(error && error.message) || "OWNER_STAKING_LOAD_FAILED", true);
    } finally {
      busy = false;
    }
  }

  async function saveOffer(durationDays, rewardPercent, button, input) {
    if (busy || !currentProject || !policyPayload || policyPayload.can_configure !== true) return;
    var maxPercent = num(policyPayload.policy && policyPayload.policy.max_reward_percent);
    if (!(rewardPercent > 0) || rewardPercent > maxPercent) {
      setStatus("Reward rate must be greater than 0 and no higher than ALBUKHR's approved maximum of " + maxPercent.toFixed(2) + "%.", true);
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
        policyPayload.terms = policyPayload.terms.map(function (term) {
          if (Number(term.duration_days) !== durationDays) return term;
          return Object.assign({}, term, {
            reward_rate: Number(result.offer.reward_rate),
            reward_percent: Number(result.offer.reward_percent)
          });
        });
      }
      setStatus("Saved " + durationDays + "-day offer at " + Number(result.offer.reward_percent).toFixed(2) + "%. Existing stakes are unchanged.");
    } catch (error) {
      setStatus(clean(error && error.message) || "OFFER_UPDATE_FAILED", true);
    } finally {
      busy = false;
      if (button) { button.disabled = !(policyPayload && policyPayload.can_configure); button.textContent = "Save rate"; }
      if (input) input.disabled = !(policyPayload && policyPayload.can_configure);
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
