/* ALBUKHR TESTNET INVESTOR FINANCIAL UI v1.2
 * Additive, read-only presentation layer.
 * Reuses the existing Investor controller boot promise and Testnet API response.
 * No direct Supabase access, storage, payment, staking, or withdrawal actions.
 */
(function (window, document) {
  "use strict";

  var NETWORK = "testnet";
  var started = false;

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function byId(id) {
    return document.getElementById(id);
  }

  /* Preserve the exact decimal string returned by the financial core. */
  function pi(value) {
    var source = clean(value || "0");
    if (!/^\d+(?:\.\d{1,7})?$/.test(source)) source = "0";
    var parts = source.split(".");
    var whole;
    try {
      whole = BigInt(parts[0]).toLocaleString();
    } catch (_) {
      whole = parts[0];
    }
    var fraction = (parts[1] || "").replace(/0+$/, "");
    if (fraction.length < 2) fraction = fraction.padEnd(2, "0");
    return whole + (fraction ? "." + fraction : "") + " π";
  }

  function setText(id, value) {
    var node = byId(id);
    if (node) node.textContent = String(value == null ? "" : value);
  }

  function setStatus(state, message) {
    var badge = byId("financialReconciliationStatus");
    var note = byId("financialReconciliationNote");
    if (badge) {
      badge.textContent = state;
      badge.className = "financial-status" +
        (state === "RECONCILED" ? " is-reconciled" :
          state === "REVIEW REQUIRED" ? " is-review" :
            state === "NO ACTIVITY" ? " is-empty" : "");
    }
    if (note && message) note.textContent = message;
  }

  function renderSummary(summary) {
    setText("totalPortfolio", pi(summary.portfolio));
    setText("totalInvest", pi(summary.capital_remaining));
    setText("totalEarn", pi(summary.rewards_remaining));
    setText("heroPortfolio", pi(summary.portfolio));
    setText("totalProjects", Number(summary.active_projects || 0));
  }

  function renderBreakdown(summary) {
    var fields = {
      financialCapitalRemaining: summary.capital_remaining,
      financialRewardsRemaining: summary.rewards_remaining,
      financialCapitalLocked: summary.capital_locked,
      financialCapitalMatured: summary.capital_matured,
      financialCapitalPending: summary.capital_pending_withdrawal,
      financialRewardsPending: summary.reward_pending_withdrawal,
      financialCapitalReturned: summary.capital_returned,
      financialRewardsPaid: summary.rewards_paid
    };

    Object.keys(fields).forEach(function (id) {
      setText(id, pi(fields[id]));
    });

    var stakeCount = Number(summary.stake_count || 0);
    var withdrawalCount =
      Number(summary.completed_withdrawal_count || 0) +
      Number(summary.pending_withdrawal_count || 0);

    if (summary.reconciled === true && stakeCount === 0 && withdrawalCount === 0) {
      setStatus(
        "NO ACTIVITY",
        "No Testnet investment or withdrawal records were found for this portfolio. This is an empty portfolio, not a payout reconciliation. All transaction controls remain locked."
      );
    } else if (summary.reconciled === true) {
      setStatus(
        "RECONCILED",
        "Balances are calculated from the available Testnet stake and withdrawal records. All transaction controls remain locked."
      );
    } else {
      var count = Array.isArray(summary.warnings) ? summary.warnings.length : 0;
      setStatus(
        "REVIEW REQUIRED",
        "Some records need administrative reconciliation (" + count +
          " check" + (count === 1 ? "" : "s") +
          "). The financial core excludes invalid or non-Testnet rows. All transaction controls remain locked."
      );
    }
  }

  function appendPendingValues(card, position) {
    var values = card.querySelector(".investment-values");
    if (!values) return;

    if (values.children && values.children[0]) {
      var firstLabel = values.children[0].querySelector("span");
      if (firstLabel) firstLabel.textContent = "Capital remaining";
    }
    if (values.children && values.children[1]) {
      var secondLabel = values.children[1].querySelector("span");
      if (secondLabel) secondLabel.textContent = "Rewards remaining";
    }

    var capital = document.createElement("div");
    capital.className = "investment-pending-value";
    var capitalLabel = document.createElement("span");
    capitalLabel.textContent = "Capital pending";
    var capitalAmount = document.createElement("strong");
    capitalAmount.textContent = pi(position.capital_pending_withdrawal || "0");
    capital.appendChild(capitalLabel);
    capital.appendChild(capitalAmount);

    var rewards = document.createElement("div");
    rewards.className = "investment-pending-value";
    var rewardsLabel = document.createElement("span");
    rewardsLabel.textContent = "Rewards pending";
    var rewardsAmount = document.createElement("strong");
    rewardsAmount.textContent = pi(position.reward_pending_withdrawal || "0");
    rewards.appendChild(rewardsLabel);
    rewards.appendChild(rewardsAmount);

    var lock = document.createElement("span");
    lock.className = "investment-lock-state";
    lock.textContent = position.capital_matured === true
      ? "CAPITAL MATURED • TESTNET LOCKED"
      : "CAPITAL LOCKED";

    values.appendChild(capital);
    values.appendChild(rewards);
    values.appendChild(lock);
  }

  function renderPositions(investor, positions, projects) {
    var safePositions = positions.map(function (position) {
      return Object.assign({}, position, {
        amount: position.capital_remaining,
        reward_amount: position.reward_remaining
      });
    });

    investor.renderInvestments(safePositions, projects);

    var cards = document.querySelectorAll("#investments .investment-card");
    var byCode = new Map();
    positions.forEach(function (position) {
      var code = clean(position.project_code).toLowerCase();
      if (code && !byCode.has(code)) byCode.set(code, []);
      if (code) byCode.get(code).push(position);
    });

    cards.forEach(function (card) {
      var code = clean(card.dataset.projectCode).toLowerCase();
      var candidates = byCode.get(code) || [];
      var position = candidates.shift();
      if (position) appendPendingValues(card, position);
    });

    var list = byId("investments");
    if (list) list.setAttribute("aria-busy", "false");
  }

  function start() {
    if (started) return;
    started = true;

    var investor = window.AlbukhrTestnetInvestor;
    var core = window.AlbukhrTestnetFinancialCore;

    if (!investor || typeof investor.boot !== "function" ||
        typeof investor.renderInvestments !== "function") {
      setStatus("UNAVAILABLE", "The existing Testnet Investor controller is unavailable. No transaction controls have been enabled.");
      return;
    }
    if (!core || typeof core.calculate !== "function") {
      setStatus("UNAVAILABLE", "The Testnet financial calculation module did not load. Existing Investor functions are unchanged.");
      return;
    }

    investor.boot().then(function (payload) {
      if (!payload || payload.network !== NETWORK) {
        setStatus("UNAVAILABLE", "No verified Testnet investor response was available. All transaction controls remain locked.");
        return;
      }

      var result = core.calculate({
        piUid: payload.user && payload.user.pi_uid,
        stakes: payload.stakes,
        withdrawals: payload.withdrawals,
        asOf: new Date().toISOString()
      });

      if (!result || result.network !== NETWORK || !result.summary || !Array.isArray(result.positions)) {
        throw new Error("INVALID_TESTNET_FINANCIAL_RESULT");
      }

      renderSummary(result.summary);
      renderBreakdown(result.summary);
      renderPositions(investor, result.positions, payload.projects);

      console.info("[ALBUKHR TESTNET FINANCIAL UI]", {
        network: NETWORK,
        reconciled: result.ok,
        warningCount: result.warnings.length,
        stakeCount: result.summary.stake_count
      });
    }).catch(function (error) {
      console.error("[ALBUKHR TESTNET FINANCIAL UI]", error);
      setStatus("UNAVAILABLE", "Financial details could not be calculated. The original Investor dashboard remains available; staking, withdrawals and payments remain locked.");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})(window, document);
