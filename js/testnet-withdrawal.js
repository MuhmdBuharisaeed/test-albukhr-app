/* ALBUKHR TESTNET WITHDRAWAL UI v2 — server-authoritative Global Treasury fees
 *
 * This UI is deliberately feature-locked until the controlled Testnet U2A
 * payment and payout tests are approved and completed. Do not change the
 * feature flag to true as part of this patch.
 */
(function (window, document) {
  "use strict";

  var NETWORK = "testnet";
  var MIN_RECEIVE = 0.05;
  var WITHDRAWAL_FLOW_ENABLED =
    window.ALBukhrTestnetGlobalTreasuryWithdrawalEnabled === true;

  var initialized = false;
  var currentProject = null;
  var investorPayload = null;
  var activeType = null;
  var activeStake = null;
  var pendingWithdrawal = null;
  var pendingFee = null;
  var stage = "amount";
  var busy = false;

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function num(value) {
    var result = Number(value);
    return Number.isFinite(result) ? result : 0;
  }

  function pi(value) {
    return num(value).toFixed(2) + " Pi";
  }

  function get(id) {
    return document.getElementById(id);
  }

  function getAuth() {
    var auth = window.AlbukhrTestnetAuth;
    if (!auth || typeof auth.requireTestnetAuth !== "function") {
      throw new Error("TESTNET_AUTH_MODULE_UNAVAILABLE");
    }
    return auth;
  }

  function getInvestorApi() {
    var api = window.AlbukhrTestnetApi;
    if (!api || typeof api.getInvestorData !== "function") {
      throw new Error("TESTNET_INVESTOR_API_UNAVAILABLE");
    }
    return api;
  }

  function getTreasuryClient() {
    var api = window.AlbukhrTestnetGlobalTreasury;
    if (!api || api.network !== NETWORK ||
        typeof api.prepareWithdrawal !== "function" ||
        typeof api.assessWithdrawal !== "function" ||
        typeof api.payFee !== "function" ||
        typeof api.executeWithdrawal !== "function") {
      throw new Error("TESTNET_GLOBAL_TREASURY_CLIENT_UNAVAILABLE");
    }
    return api;
  }

  function projectIdentity() {
    try {
      var params = new URLSearchParams(window.location.search);
      return clean(params.get("project") || params.get("project_code") ||
        params.get("slug") || params.get("project_id")).toLowerCase();
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
    return !!code && projectIdentity() === code;
  }

  function availableFor(stake, type, withdrawals) {
    var rows = Array.isArray(withdrawals) ? withdrawals : [];
    var used = rows.filter(function (row) {
      return clean(row.stake_id) === clean(stake.id) &&
        clean(row.withdrawal_type).toLowerCase() === type &&
        ["pending", "processing", "approved", "completed"].indexOf(
          clean(row.status).toLowerCase()
        ) !== -1;
    }).reduce(function (sum, row) {
      return sum + num(row.requested_amount || row.net_amount);
    }, 0);

    if (type === "reward") {
      return Math.max(0, num(stake.reward_amount) - used);
    }

    var unlockAt = Date.parse(stake.unlock_at || "");
    if (!Number.isFinite(unlockAt) || Date.now() < unlockAt) return 0;
    return Math.max(0, num(stake.amount) - used);
  }

  function findStake(type) {
    var stakes = investorPayload && Array.isArray(investorPayload.stakes)
      ? investorPayload.stakes : [];
    var withdrawals = investorPayload && Array.isArray(investorPayload.withdrawals)
      ? investorPayload.withdrawals : [];

    var matches = stakes.filter(function (stake) {
      var network = clean(stake.network).toLowerCase();
      return (!network || network === NETWORK) &&
        stakeMatchesProject(stake, currentProject) &&
        ["active", "completed"].indexOf(clean(stake.status).toLowerCase()) !== -1;
    });

    matches.sort(function (a, b) {
      return Date.parse(b.created_at || "") - Date.parse(a.created_at || "");
    });

    for (var i = 0; i < matches.length; i += 1) {
      var available = availableFor(matches[i], type, withdrawals);
      if (available >= MIN_RECEIVE) return { stake: matches[i], available: available };
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
        '<div class="albukhr-withdraw-balance"><span>Available from stake</span><strong id="albukhrWithdrawAvailable">0.00 Pi</strong></div>' +
        '<label class="albukhr-withdraw-label" for="albukhrWithdrawAmount">Amount to receive</label>' +
        '<div class="albukhr-amount-row"><input id="albukhrWithdrawAmount" inputmode="decimal" type="number" min="0.05" step="0.01" placeholder="0.05"><span>Pi</span></div>' +
        '<div class="albukhr-withdraw-summary">' +
          '<div><span>Server-assessed fee</span><strong id="albukhrWithdrawFee">Calculated after request</strong></div>' +
          '<div><span>Total outflow</span><strong id="albukhrWithdrawTotal">Shown after server quote</strong></div>' +
          '<div><span>Wallet receive</span><strong id="albukhrWithdrawReceive">0.00 Pi</strong></div>' +
        '</div>' +
        '<div class="albukhr-wallet-box"><span>Testnet wallet</span><strong id="albukhrWithdrawWallet">—</strong></div>' +
        '<p class="albukhr-withdraw-note">The fee is calculated by ALBUKHR Testnet policy and paid separately through an official Pi Testnet U2A payment. The server fee quote is authoritative; this screen does not estimate a fee.</p>' +
        '<p id="albukhrWithdrawStatus" class="albukhr-withdraw-status" aria-live="polite"></p>' +
        '<div class="albukhr-withdraw-actions"><button type="button" class="action-btn" id="albukhrWithdrawCancel">Cancel</button><button type="button" class="action-btn primary" id="albukhrWithdrawConfirm">Get official fee quote</button></div>' +
      '</div>';

    document.body.appendChild(modal);
    get("albukhrWithdrawClose").addEventListener("click", close);
    get("albukhrWithdrawCancel").addEventListener("click", close);
    get("albukhrWithdrawAmount").addEventListener("input", updateReceiveDisplay);
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

  function updateReceiveDisplay() {
    var amountNode = get("albukhrWithdrawAmount");
    if (!amountNode) return;
    var amount = num(amountNode.value);
    get("albukhrWithdrawReceive").textContent = pi(amount);
    if (stage === "amount") {
      get("albukhrWithdrawFee").textContent = "Calculated after request";
      get("albukhrWithdrawTotal").textContent = "Shown after server quote";
    }
    var button = get("albukhrWithdrawConfirm");
    if (button && stage === "amount") {
      button.disabled = busy || amount < MIN_RECEIVE ||
        !activeStake || amount > num(activeStake.available) + 1e-9;
    }
  }

  function feeBasisDescription(basis) {
    switch (clean(basis)) {
      case "no_fee_under_tier_daily_allowance":
        return "Daily free allowance applied by the server.";
      case "under_tier_after_allowance":
        return "Flat sub-tier fee applied after the daily free allowance.";
      case "complete_tier_fee":
        return "Fee assessed for each complete 5 Pi tier.";
      default:
        return "Fee assessed under the current Testnet policy.";
    }
  }

  function validateFeeQuote(quote, withdrawalId) {
    if (!quote || quote.network !== NETWORK ||
        clean(quote.source_type) !== "staker_withdrawal" ||
        !clean(quote.id) || !clean(quote.source_id) ||
        clean(quote.source_id) !== clean(withdrawalId)) {
      throw new Error("TESTNET_FEE_QUOTE_INVALID");
    }
    var requested = Number(quote.requested_amount);
    var recipient = Number(quote.recipient_amount);
    var fee = Number(quote.fee_amount);
    var total = Number(quote.sender_total_debit);
    if (![requested, recipient, fee, total].every(Number.isFinite) ||
        requested < MIN_RECEIVE || recipient !== requested || fee < 0 ||
        total + 1e-8 < requested || Math.abs(total - (requested + fee)) > 1e-7) {
      throw new Error("TESTNET_FEE_QUOTE_INVALID");
    }
    if (!["not_required", "payment_pending", "paid"].includes(clean(quote.fee_status))) {
      throw new Error("TESTNET_FEE_STATUS_INVALID");
    }
    return quote;
  }

  function showFeeQuote(quote) {
    var fee = num(quote.fee_amount);
    get("albukhrWithdrawFee").textContent = pi(fee);
    get("albukhrWithdrawTotal").textContent = pi(quote.sender_total_debit);
    get("albukhrWithdrawReceive").textContent = pi(quote.recipient_amount);
    get("albukhrWithdrawAmount").disabled = true;
    var note = feeBasisDescription(quote.fee_basis);
    setStatus(note + (quote.fee_policy_version
      ? " Policy version " + quote.fee_policy_version + "."
      : ""));
    var button = get("albukhrWithdrawConfirm");
    button.disabled = false;
    button.textContent = fee > 0 && quote.fee_status !== "paid"
      ? "Pay " + pi(fee) + " fee & continue"
      : "Confirm Testnet withdrawal";
    stage = "quoted";
  }

  async function open(type) {
    try {
      if (!WITHDRAWAL_FLOW_ENABLED) {
        alert("Testnet withdrawals remain locked while the controlled U2A fee-payment and payout tests are pending.");
        return;
      }
      if (pendingWithdrawal) {
        alert("A Testnet withdrawal is already awaiting fee payment or reconciliation. Resolve it before starting another request.");
        return;
      }

      var session = await getAuth().requireTestnetAuth({ redirectOnFailure: false });
      if (!session || !session.wallet_address) throw new Error("TESTNET_SESSION_REQUIRED");
      var stakeInfo = findStake(type);
      if (!stakeInfo) throw new Error("NO_TESTNET_STAKE_FOR_PROJECT");

      activeType = type;
      activeStake = stakeInfo;
      stage = "amount";
      pendingFee = null;

      var modal = ensureModal();
      get("albukhrWithdrawTitle").textContent =
        type === "reward" ? "Withdraw Rewards" : "Withdraw Capital";
      get("albukhrWithdrawDescription").textContent =
        type === "reward"
          ? "Request a reward withdrawal from this Testnet stake."
          : "The capital unlock time has been reached for this Testnet stake.";
      get("albukhrWithdrawAvailable").textContent = pi(stakeInfo.available);
      get("albukhrWithdrawWallet").textContent = clean(session.wallet_address);

      var amount = get("albukhrWithdrawAmount");
      amount.value = "";
      amount.min = String(MIN_RECEIVE);
      amount.max = num(stakeInfo.available).toFixed(7);
      amount.disabled = false;
      get("albukhrWithdrawConfirm").textContent = "Get official fee quote";
      setStatus("The server will calculate the current daily tier allowance and fee after the request is prepared.");
      updateReceiveDisplay();
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
    if (!pendingWithdrawal) {
      activeType = null;
      activeStake = null;
      pendingFee = null;
      stage = "amount";
    }
  }

  async function refreshInvestorData() {
    investorPayload = await getInvestorApi().getInvestorData();
    return investorPayload;
  }

  async function prepareWithdrawal() {
    if (!activeStake || !activeType) throw new Error("TESTNET_WITHDRAWAL_CONTEXT_REQUIRED");
    var amount = num(get("albukhrWithdrawAmount").value);
    if (amount < MIN_RECEIVE) throw new Error("MINIMUM_STAKER_WITHDRAWAL_IS_0.05_PI");
    if (amount > num(activeStake.available) + 1e-9) {
      throw new Error("WITHDRAWAL_AMOUNT_EXCEEDS_AVAILABLE_BALANCE");
    }

    var session = await getAuth().requireTestnetAuth({ redirectOnFailure: false });
    var wallet = clean(session && session.wallet_address);
    if (!wallet) throw new Error("TESTNET_WALLET_REQUIRED");

    setStatus("Preparing the request and obtaining the official server fee quote…");
    var result = await getTreasuryClient().prepareWithdrawal({
      stakeId: clean(activeStake.stake.id),
      withdrawalType: activeType,
      requestedAmount: amount,
      walletAddress: wallet
    });

    if (!result || result.success !== true || result.network !== NETWORK ||
        !result.withdrawal || !clean(result.withdrawal.id) || !result.fee) {
      throw new Error("TESTNET_WITHDRAWAL_PREPARE_RESPONSE_INVALID");
    }

    pendingWithdrawal = {
      id: clean(result.withdrawal.id),
      status: clean(result.withdrawal.status),
      requestedAmount: amount,
      stakeId: clean(activeStake.stake.id),
      type: activeType
    };
    pendingFee = validateFeeQuote(result.fee, pendingWithdrawal.id);
    showFeeQuote(pendingFee);
    await refreshInvestorData().catch(function () {});
    return result;
  }

  async function completeWithdrawal() {
    if (!pendingWithdrawal || !pendingFee) throw new Error("TESTNET_WITHDRAWAL_NOT_PREPARED");
    var client = getTreasuryClient();
    var fee = num(pendingFee.fee_amount);

    if (fee > 0 && clean(pendingFee.fee_status) !== "paid") {
      setStatus("Opening the official Pi Testnet fee payment…");
      await client.payFee(pendingFee);
    }

    setStatus("Fee requirement satisfied. Submitting the Testnet withdrawal payout…");
    var result = await client.executeWithdrawal(pendingWithdrawal.id);
    if (!result || result.success !== true || result.network !== NETWORK ||
        result.payout !== "completed" || !clean(result.txid)) {
      throw new Error("TESTNET_PAYOUT_RESULT_UNVERIFIED");
    }

    setStatus("Testnet withdrawal completed. TxID: " + clean(result.txid));
    window.dispatchEvent(new CustomEvent("albukhr:testnet-withdrawal-completed", {
      detail: {
        network: NETWORK,
        type: pendingWithdrawal.type,
        withdrawalId: pendingWithdrawal.id,
        txid: clean(result.txid)
      }
    }));

    pendingWithdrawal = null;
    pendingFee = null;
    stage = "amount";
    await refreshInvestorData().catch(function () {});
    window.setTimeout(close, 1800);
    return result;
  }

  async function submit() {
    if (busy || !WITHDRAWAL_FLOW_ENABLED) return;
    var button = get("albukhrWithdrawConfirm");
    if (!button) return;
    busy = true;
    button.disabled = true;

    try {
      if (stage === "amount") {
        await prepareWithdrawal();
      } else if (stage === "quoted") {
        await completeWithdrawal();
      } else {
        throw new Error("TESTNET_WITHDRAWAL_RECONCILIATION_REQUIRED");
      }
    } catch (error) {
      console.error("[ALBUKHR TESTNET WITHDRAWAL]", error);
      var message = clean(error && error.message);
      if (error && error.body && typeof error.body === "object") {
        message = clean(error.body.message || error.body.error) || message;
      }
      if (stage === "quoted" && pendingWithdrawal) {
        // Do not auto-retry a payment or payout after an uncertain result.
        // The operator must reconcile before any further attempt.
        stage = "reconciliation";
        setStatus((message || "The fee or payout result is uncertain.") +
          " Do not submit another payment or payout; administrator reconciliation is required.", true);
        button.textContent = "Reconciliation required";
      } else {
        setStatus(message || "Testnet withdrawal preparation failed.", true);
        button.disabled = false;
      }
    } finally {
      busy = false;
      if (stage === "reconciliation") button.disabled = true;
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
    if (!project || clean(project.network).toLowerCase() !== NETWORK) return null;
    currentProject = project;
    return project;
  }

  function wireButtons() {
    var rewardButton = get("withdrawRewardsBtn");
    var capitalButton = get("withdrawCapitalBtn");
    [rewardButton, capitalButton].forEach(function (button) {
      if (!button) return;
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
      var small = button.querySelector("small");
      if (small) {
        small.textContent = WITHDRAWAL_FLOW_ENABLED
          ? "Checking eligibility…"
          : "Locked — U2A tests pending";
      }
      if (!WITHDRAWAL_FLOW_ENABLED) return;
    });

    if (!WITHDRAWAL_FLOW_ENABLED) return;
    if (rewardButton) {
      rewardButton.disabled = false;
      rewardButton.removeAttribute("aria-disabled");
      rewardButton.addEventListener("click", function () { open("reward"); });
    }
    if (capitalButton) {
      capitalButton.disabled = false;
      capitalButton.removeAttribute("aria-disabled");
      capitalButton.addEventListener("click", function () { open("capital"); });
    }
  }

  async function init() {
    if (initialized) return;
    initialized = true;
    try {
      if (!WITHDRAWAL_FLOW_ENABLED) {
        wireButtons();
        return;
      }
      await getAuth().requireTestnetAuth({ redirectOnFailure: false });
      getTreasuryClient();
      await loadProject();
      await refreshInvestorData();
      wireButtons();
      window.addEventListener("albukhr:testnet-project-loaded", async function (event) {
        if (event.detail && event.detail.project) currentProject = event.detail.project;
        await refreshInvestorData().catch(function () {});
      });
    } catch (error) {
      console.error("[ALBUKHR TESTNET WITHDRAWAL INIT]", error);
      wireButtons();
    }
  }

  var publicApi = {
    open: open,
    close: close,
    refresh: refreshInvestorData,
    enabled: WITHDRAWAL_FLOW_ENABLED,
    feeBasisDescription: feeBasisDescription,
    validateFeeQuote: validateFeeQuote
  };
  try { Object.freeze(publicApi); } catch (_) {}
  window.AlbukhrTestnetWithdrawal = publicApi;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})(window, document);
