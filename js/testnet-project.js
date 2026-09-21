/* ALBUKHR TESTNET WITHDRAWAL UI v1 */
(function (window, document) {
  "use strict";

  var MIN_RECEIVE = 0.50;
  var FEE_RATE = 0.01;
  var MIN_FEE = 0.01;
  var initialized = false;
  var currentProject = null;
  var investorPayload = null;
  var activeType = null;
  var activeStake = null;

  function clean(v) { return String(v == null ? "" : v).trim(); }
  function num(v) {
    var n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  function pi(v) { return num(v).toFixed(2) + " Pi"; }
  function get(id) { return document.getElementById(id); }

  function feeFor(amount) {
    return Math.max(amount * FEE_RATE, MIN_FEE);
  }

  function totalFor(amount) {
    return amount + feeFor(amount);
  }

  function maxReceive(available) {
    available = Math.max(0, num(available));
    if (available < MIN_FEE + MIN_RECEIVE) return 0;
    return Math.max(0, (available - MIN_FEE) / (1 + FEE_RATE));
  }

  function getAuth() {
    var auth = window.AlbukhrTestnetAuth;
    if (!auth || typeof auth.requireTestnetAuth !== "function" ||
        typeof auth.getSession !== "function") {
      throw new Error("Testnet authentication module is unavailable.");
    }
    return auth;
  }

  function getApi() {
    var api = window.AlbukhrTestnetApi;
    if (!api || typeof api.getInvestorData !== "function") {
      throw new Error("Testnet investor API is unavailable.");
    }
    return api;
  }

  function getWithdrawalApi() {
    var api = window.AlbukhrTestnetWithdrawalApi;
    if (!api || typeof api.withdraw !== "function") {
      throw new Error("Testnet withdrawal API is unavailable.");
    }
    return api;
  }

  function projectIdentity() {
    try {
      var p = new URLSearchParams(window.location.search);
      return clean(p.get("project") || p.get("project_code") ||
                   p.get("slug") || p.get("project_id")).toLowerCase();
    } catch (_) {
      return "";
    }
  }

  function stakeMatchesProject(stake, project) {
    if (!stake || typeof stake !== "object" || !project) return false;
    var code = clean(stake.project_code).toLowerCase();
    var projectCode = clean(project.project_code).toLowerCase();
    var id = clean(stake.project_id).toLowerCase();
    var projectId = clean(project.id).toLowerCase();
    var slug = clean(stake.slug).toLowerCase();
    var projectSlug = clean(project.slug).toLowerCase();

    if (projectCode && code === projectCode) return true;
    if (projectId && id === projectId) return true;
    if (projectSlug && slug === projectSlug) return true;
    return projectIdentity() === code && !!code;
  }

  function availableFor(stake, type, withdrawals) {
    var rows = Array.isArray(withdrawals) ? withdrawals : [];
    var used = rows
      .filter(function (row) {
        return clean(row.stake_id) === clean(stake.id) &&
          clean(row.withdrawal_type).toLowerCase() === type &&
          ["pending", "processing", "approved", "completed"].indexOf(
            clean(row.status).toLowerCase()
          ) !== -1;
      })
      .reduce(function (sum, row) {
        return sum + num(row.net_amount || row.requested_amount);
      }, 0);

    if (type === "reward") {
      return Math.max(0, num(stake.reward_amount) - used);
    }

    var unlock = Date.parse(stake.unlock_at || "");
    if (!Number.isFinite(unlock) || Date.now() < unlock) return 0;

    return Math.max(0, num(stake.amount) - used);
  }

  function findStake(type) {
    var stakes = investorPayload && Array.isArray(investorPayload.stakes)
      ? investorPayload.stakes : [];
    var withdrawals = investorPayload && Array.isArray(investorPayload.withdrawals)
      ? investorPayload.withdrawals : [];

    var matches = stakes.filter(function (stake) {
      if (clean(stake.network).toLowerCase() &&
          clean(stake.network).toLowerCase() !== "testnet") return false;
      if (!stakeMatchesProject(stake, currentProject)) return false;
      return ["active", "completed"].indexOf(clean(stake.status).toLowerCase()) !== -1;
    });

    matches.sort(function (a, b) {
      return Date.parse(b.created_at || "") - Date.parse(a.created_at || "");
    });

    for (var i = 0; i < matches.length; i++) {
      var available = availableFor(matches[i], type, withdrawals);
      if (available >= MIN_RECEIVE + MIN_FEE) {
        return { stake: matches[i], available: available };
      }
    }

    if (matches.length) {
      return {
        stake: matches[0],
        available: availableFor(matches[0], type, withdrawals)
      };
    }

    return null;
  }

  function ensureModal() {
    if (get("albukhrWithdrawalModal")) return get("albukhrWithdrawalModal");

    var modal = document.createElement("div");
    modal.id = "albukhrWithdrawalModal";
    modal.className = "albukhr-withdraw-modal";
    modal.hidden = true;
    modal.innerHTML =
      '<div class="albukhr-withdraw-box" role="dialog" aria-modal="true" aria-labelledby="albukhrWithdrawTitle">' +
        '<button type="button" class="albukhr-withdraw-close" id="albukhrWithdrawClose" aria-label="Close">×</button>' +
        '<div class="section-kicker">TESTNET WITHDRAWAL</div>' +
        '<h2 id="albukhrWithdrawTitle">Withdraw</h2>' +
        '<p id="albukhrWithdrawDescription"></p>' +
        '<div class="albukhr-withdraw-balance"><span>Available</span><strong id="albukhrWithdrawAvailable">0.00 Pi</strong></div>' +
        '<label class="albukhr-withdraw-label" for="albukhrWithdrawAmount">Amount to receive</label>' +
        '<div class="albukhr-amount-row"><input id="albukhrWithdrawAmount" inputmode="decimal" type="number" min="0.50" step="0.01" placeholder="0.50"><span>Pi</span></div>' +
        '<div class="albukhr-withdraw-summary">' +
          '<div><span>Fee</span><strong id="albukhrWithdrawFee">0.00 Pi</strong></div>' +
          '<div><span>Total Deduction</span><strong id="albukhrWithdrawTotal">0.00 Pi</strong></div>' +
          '<div><span>Wallet Receive</span><strong id="albukhrWithdrawReceive">0.00 Pi</strong></div>' +
        '</div>' +
        '<div class="albukhr-wallet-box"><span>Wallet</span><strong id="albukhrWithdrawWallet">—</strong></div>' +
        '<p class="albukhr-withdraw-note">ALBUKHR service fee: 1%, minimum 0.01 Pi. The amount above is the amount sent to your wallet.</p>' +
        '<p id="albukhrWithdrawStatus" class="albukhr-withdraw-status" aria-live="polite"></p>' +
        '<div class="albukhr-withdraw-actions"><button type="button" class="action-btn" id="albukhrWithdrawCancel">Cancel</button><button type="button" class="action-btn primary" id="albukhrWithdrawConfirm">Confirm Withdrawal</button></div>' +
      '</div>';

    document.body.appendChild(modal);

    get("albukhrWithdrawClose").addEventListener("click", close);
    get("albukhrWithdrawCancel").addEventListener("click", close);
    get("albukhrWithdrawAmount").addEventListener("input", updateCalculation);
    get("albukhrWithdrawConfirm").addEventListener("click", submit);

    modal.addEventListener("click", function (event) {
      if (event.target === modal) close();
    });

    return modal;
  }

  function setStatus(message, error) {
    var node = get("albukhrWithdrawStatus");
    if (!node) return;
    node.textContent = clean(message);
    node.dataset.state = error ? "error" : "normal";
  }

  function updateCalculation() {
    var amountNode = get("albukhrWithdrawAmount");
    if (!amountNode) return;
    var amount = num(amountNode.value);
    var fee = amount > 0 ? feeFor(amount) : 0;
    var total = amount > 0 ? totalFor(amount) : 0;

    get("albukhrWithdrawFee").textContent = pi(fee);
    get("albukhrWithdrawTotal").textContent = pi(total);
    get("albukhrWithdrawReceive").textContent = pi(amount);

    var available = activeStake ? num(activeStake.available) : 0;
    var button = get("albukhrWithdrawConfirm");

    var valid = amount >= MIN_RECEIVE && total <= available;
    if (button) button.disabled = !valid;
  }

  async function open(type) {
    try {
      var auth = getAuth();
      var session = await auth.requireTestnetAuth({ redirectOnFailure: false });
      if (!session) throw new Error("TESTNET_SESSION_REQUIRED");

      var stakeInfo = findStake(type);
      if (!stakeInfo) throw new Error("NO_TESTNET_STAKE_FOR_PROJECT");

      activeType = type;
      activeStake = stakeInfo;

      var modal = ensureModal();
      get("albukhrWithdrawTitle").textContent =
        type === "reward" ? "Withdraw Rewards" : "Withdraw Capital";
      get("albukhrWithdrawDescription").textContent =
        type === "reward"
          ? "Withdraw available rewards from this Testnet stake."
          : "The capital unlock time has been reached for this Testnet stake.";

      get("albukhrWithdrawAvailable").textContent = pi(stakeInfo.available);

      var wallet = clean(session.wallet_address ||
        investorPayload && investorPayload.user && investorPayload.user.wallet_address);
      get("albukhrWithdrawWallet").textContent = wallet || "Wallet address unavailable";

      var amount = get("albukhrWithdrawAmount");
      amount.value = "";
      amount.max = maxReceive(stakeInfo.available).toFixed(8);

      setStatus("");
      updateCalculation();
      modal.hidden = false;
      try { amount.focus(); } catch (_) {}
    } catch (error) {
      var message = clean(error && error.message);
      if (message === "NO_TESTNET_STAKE_FOR_PROJECT") {
        alert("No eligible Testnet stake was found for this project.");
      } else if (message === "TESTNET_SESSION_REQUIRED") {
        alert("Your Testnet session is required before withdrawal.");
      } else {
        console.error("[ALBUKHR WITHDRAWAL UI]", error);
        alert("Unable to open Testnet withdrawal.");
      }
    }
  }

  function close() {
    var modal = get("albukhrWithdrawalModal");
    if (modal) modal.hidden = true;
    activeType = null;
    activeStake = null;
  }

  async function refreshInvestorData() {
    var api = getApi();
    investorPayload = await api.getInvestorData();
    return investorPayload;
  }

  async function submit() {
    if (!activeStake || !activeType) return;

    var amount = num(get("albukhrWithdrawAmount").value);
    var available = num(activeStake.available);
    var fee = feeFor(amount);
    var total = totalFor(amount);

    if (amount < MIN_RECEIVE) {
      setStatus("Minimum wallet receive amount is 0.50 Pi.", true);
      return;
    }

    if (total > available + 1e-9) {
      setStatus("Total deduction exceeds the available balance.", true);
      return;
    }

    var auth = getAuth();
    var session = await auth.requireTestnetAuth({ redirectOnFailure: false });
    var wallet = clean(session && session.wallet_address ||
      investorPayload && investorPayload.user && investorPayload.user.wallet_address);

    if (!wallet) {
      setStatus("A verified Testnet wallet address is required.", true);
      return;
    }

    var button = get("albukhrWithdrawConfirm");
    button.disabled = true;
    setStatus("Submitting Testnet withdrawal…");

    try {
      var api = getWithdrawalApi();
      var result = await api.withdraw(
        activeStake.stake.id,
        activeType,
        amount,
        wallet
      );

      if (!result || result.network !== "testnet" || !result.success) {
        throw new Error("INVALID_TESTNET_WITHDRAWAL_RESPONSE");
      }

      var txid = clean(result.txid);
      setStatus(txid
        ? "Withdrawal completed. TxID: " + txid
        : "Withdrawal completed on Testnet.");

      await refreshInvestorData();

      window.setTimeout(close, 1800);
      window.dispatchEvent(new CustomEvent("albukhr:testnet-withdrawal-completed", {
        detail: { network: "testnet", type: activeType, txid: txid }
      }));
    } catch (error) {
      console.error("[ALBUKHR WITHDRAWAL]", error);
      var message = clean(error && error.message);

      if (error && error.body && typeof error.body === "object") {
        message = clean(error.body.message || error.body.error) || message;
      }

      setStatus(message || "Testnet withdrawal failed. Please try again.", true);
      button.disabled = false;
    }
  }

  async function loadProject() {
    var registry = window.AlbukhrTestnetRegistry;
    if (!registry || typeof registry.resolve !== "function") return null;

    var identity = projectIdentity();
    var project = registry.resolve(identity);
    if (!project && typeof registry.load === "function") {
      await registry.load(false);
      project = registry.resolve(identity);
    }
    if (!project || clean(project.network).toLowerCase() !== "testnet") return null;

    currentProject = project;
    return project;
  }

  function wireButtons() {
    var buttons = document.querySelectorAll(".action-grid .action-btn");
    if (!buttons.length) return;

    var rewardButton = null;
    var capitalButton = null;

    buttons.forEach(function (button) {
      var text = clean(button.textContent).toLowerCase();
      if (text.indexOf("withdraw rewards") !== -1) rewardButton = button;
      if (text.indexOf("withdraw capital") !== -1) capitalButton = button;
    });

    function enable(button, type) {
      if (!button) return;
      button.disabled = false;
      button.removeAttribute("aria-disabled");
      var small = button.querySelector("small");
      if (small) small.textContent = "Available";
      button.addEventListener("click", function () { open(type); });
    }

    enable(rewardButton, "reward");
    enable(capitalButton, "capital");
  }

  async function init() {
    if (initialized) return;
    initialized = true;

    try {
      await getAuth().requireTestnetAuth({ redirectOnFailure: false });
      await loadProject();
      await refreshInvestorData();
      wireButtons();
      window.addEventListener("albukhr:testnet-project-loaded", async function (event) {
        if (event.detail && event.detail.project) currentProject = event.detail.project;
        await refreshInvestorData().catch(function () {});
      });
    } catch (error) {
      console.error("[ALBUKHR TESTNET WITHDRAWAL INIT]", error);
    }
  }

  window.AlbukhrTestnetWithdrawal = Object.freeze({
    open: open,
    close: close,
    refresh: refreshInvestorData,
    feeFor: feeFor,
    totalFor: totalFor,
    maxReceive: maxReceive
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})(window, document);
