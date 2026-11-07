/* ALBUKHR TESTNET INVESTOR FINANCIAL UI INTEGRATION v1
 *
 * Loads after testnet-api-core.js and testnet-investor-financial-core.js,
 * but before testnet-investor.js.
 *
 * It wraps the existing Investor API response in memory only. It performs no
 * network/database writes and does not change the original API request.
 */
(function (root, factory) {
  "use strict";

  var api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root && root.document) {
    api.install(root, root.document);
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  var NETWORK = "testnet";
  var INSTALL_FLAG = "__ALBUKHR_TESTNET_FINANCIAL_UI_V1__";

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function pi(value) {
    var number = Number(value);
    if (!Number.isFinite(number)) number = 0;
    return number.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 7
    }) + " π";
  }

  function createMetric(document, label, value, description) {
    var card = document.createElement("article");
    card.className = "financial-metric";

    var title = document.createElement("span");
    title.className = "financial-metric-label";
    title.textContent = label;

    var amount = document.createElement("strong");
    amount.className = "financial-metric-value";
    amount.textContent = pi(value);

    var note = document.createElement("small");
    note.className = "financial-metric-note";
    note.textContent = description || "Testnet read-only figure";

    card.appendChild(title);
    card.appendChild(amount);
    card.appendChild(note);
    return card;
  }

  function install(window, document) {
    if (window[INSTALL_FLAG]) {
      return window[INSTALL_FLAG];
    }

    var financialCore = window.AlbukhrTestnetFinancialCore;
    var originalApi = window.AlbukhrTestnetApi;

    if (!financialCore || typeof financialCore.calculate !== "function") {
      console.error("[ALBUKHR FINANCIAL UI] Financial Core is unavailable.");
      return null;
    }

    if (!originalApi || typeof originalApi.getInvestorData !== "function") {
      console.error("[ALBUKHR FINANCIAL UI] Investor API is unavailable.");
      return null;
    }

    var latestCalculation = null;
    var latestFinancialPayload = null;

    function enrichPayload(payload) {
      if (!payload || typeof payload !== "object") {
        throw new Error("INVALID_TESTNET_INVESTOR_RESPONSE");
      }
      if (clean(payload.network).toLowerCase() !== NETWORK) {
        throw new Error("INVALID_TESTNET_INVESTOR_NETWORK");
      }

      var calculation = financialCore.calculate({
        stakes: payload.stakes,
        withdrawals: payload.withdrawals,
        asOf: new Date().toISOString()
      });

      if (!calculation || calculation.network !== NETWORK || !calculation.summary) {
        throw new Error("TESTNET_FINANCIAL_CALCULATION_INVALID");
      }

      var positions = calculation.positions.map(function (position) {
        return Object.assign({}, position, {
          original_amount: position.amount,
          original_reward_amount: position.reward_amount,
          amount: position.capital_remaining,
          reward_amount: position.reward_remaining,
          network: NETWORK
        });
      });

      latestCalculation = calculation;
      latestFinancialPayload = {
        network: NETWORK,
        summary: calculation.summary,
        warnings: calculation.warnings.slice(),
        positions: positions
      };

      return Object.assign({}, payload, {
        summary: Object.assign({}, payload.summary || {}, calculation.summary),
        stakes: positions,
        financial: latestFinancialPayload
      });
    }

    var wrappedApi = Object.assign({}, originalApi, {
      getInvestorData: async function () {
        var payload = await originalApi.getInvestorData();
        return enrichPayload(payload);
      }
    });

    try {
      Object.freeze(wrappedApi);
    } catch (_) {}

    window.AlbukhrTestnetApi = wrappedApi;

    function ensureOverview() {
      var existing = document.getElementById("investorFinancialOverview");
      if (existing) return existing;

      var summaryGrid = document.querySelector(".summary-grid");
      if (!summaryGrid || !summaryGrid.parentNode) return null;

      var section = document.createElement("section");
      section.id = "investorFinancialOverview";
      section.className = "financial-overview";
      section.setAttribute("aria-label", "Investor financial breakdown");

      var header = document.createElement("div");
      header.className = "financial-overview-header";

      var headingWrap = document.createElement("div");
      var heading = document.createElement("h2");
      heading.textContent = "Financial Breakdown";
      var subtitle = document.createElement("p");
      subtitle.textContent = "Calculated from settled Testnet stake and withdrawal records";
      headingWrap.appendChild(heading);
      headingWrap.appendChild(subtitle);

      var badge = document.createElement("span");
      badge.className = "financial-readonly-badge";
      badge.textContent = "READ ONLY";
      header.appendChild(headingWrap);
      header.appendChild(badge);

      var grid = document.createElement("div");
      grid.id = "investorFinancialMetrics";
      grid.className = "financial-metrics-grid";

      var note = document.createElement("p");
      note.className = "financial-overview-note";
      note.textContent = "Pending withdrawals remain included in portfolio value until settlement. Withdrawal actions remain locked; the server remains authoritative for eligibility.";

      var warning = document.createElement("div");
      warning.id = "investorFinancialWarning";
      warning.className = "financial-warning";
      warning.hidden = true;
      warning.setAttribute("role", "status");
      warning.setAttribute("aria-live", "polite");

      section.appendChild(header);
      section.appendChild(grid);
      section.appendChild(note);
      section.appendChild(warning);

      summaryGrid.parentNode.insertBefore(section, summaryGrid.nextSibling);
      return section;
    }

    function updateSummaryLabels() {
      var cards = document.querySelectorAll(".summary-grid .summary-card");
      if (!cards || cards.length < 4) return;

      var labels = ["Portfolio", "Capital Remaining", "Rewards Remaining", "Active Projects"];
      var notes = ["Remaining Testnet value", "After settled capital withdrawals", "After settled reward withdrawals", "Projects with active stakes"];

      for (var i = 0; i < 4; i += 1) {
        var title = cards[i].querySelector(".summary-title");
        var small = cards[i].querySelector("small");
        if (title) title.textContent = labels[i];
        if (small) small.textContent = notes[i];
      }

      var heroNote = document.querySelector(".hero-note");
      if (heroNote) {
        heroNote.textContent = "Testnet portfolio is a read-only calculation from verified stake and settled withdrawal records.";
      }
    }

    function updateInvestmentLabels() {
      var cards = document.querySelectorAll("#investments .investment-card");
      Array.prototype.forEach.call(cards || [], function (card) {
        var groups = card.querySelectorAll(".investment-values > div");
        if (groups && groups[0]) {
          var capitalLabel = groups[0].querySelector("span");
          if (capitalLabel) capitalLabel.textContent = "Capital remaining";
        }
        if (groups && groups[1]) {
          var rewardLabel = groups[1].querySelector("span");
          if (rewardLabel) rewardLabel.textContent = "Rewards remaining";
        }
      });
    }

    function renderBreakdown() {
      if (!latestCalculation || !latestCalculation.summary) return;

      var section = ensureOverview();
      if (!section) return;
      section.hidden = false;

      updateSummaryLabels();
      updateInvestmentLabels();

      var summary = latestCalculation.summary;
      var grid = document.getElementById("investorFinancialMetrics");
      if (!grid) return;

      while (grid.firstChild) grid.removeChild(grid.firstChild);

      var metrics = [
        ["Capital locked", summary.capital_locked, "Capital before unlock_at"],
        ["Capital matured", summary.capital_matured, "Reached the recorded unlock date"],
        ["Capital pending", summary.capital_pending_withdrawal, "Pending, processing or approved"],
        ["Rewards pending", summary.reward_pending_withdrawal, "Pending, processing or approved"],
        ["Capital returned", summary.capital_returned, "Completed withdrawals with transaction IDs"],
        ["Rewards paid", summary.rewards_paid, "Completed withdrawals with transaction IDs"]
      ];

      metrics.forEach(function (metric) {
        grid.appendChild(createMetric(document, metric[0], metric[1], metric[2]));
      });

      var warning = document.getElementById("investorFinancialWarning");
      if (warning) {
        if (latestCalculation.ok) {
          warning.hidden = true;
          warning.textContent = "";
        } else {
          warning.hidden = false;
          warning.textContent = "Financial reconciliation required. " +
            latestCalculation.warnings.length +
            " data check(s) need review. Balances are shown as provisional.";
        }
      }

      var list = document.getElementById("investments");
      if (list) list.setAttribute("aria-busy", "false");
    }

    function onLoaded(event) {
      if (!event || !event.detail || event.detail.network !== NETWORK) return;
      renderBreakdown();
    }

    function onError() {
      var section = document.getElementById("investorFinancialOverview");
      if (section) section.hidden = true;
      var list = document.getElementById("investments");
      if (list) list.setAttribute("aria-busy", "false");
    }

    window.addEventListener("albukhr:testnet-investor-loaded", onLoaded);
    window.addEventListener("albukhr:testnet-investor-error", onError);

    var installation = Object.freeze({
      network: NETWORK,
      enrichPayload: enrichPayload,
      renderBreakdown: renderBreakdown,
      getLastCalculation: function () { return latestCalculation; },
      getLastFinancialPayload: function () { return latestFinancialPayload; }
    });

    window[INSTALL_FLAG] = installation;
    window.AlbukhrTestnetFinancialUI = installation;
    return installation;
  }

  return Object.freeze({
    network: NETWORK,
    install: install
  });
});
