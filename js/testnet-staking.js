/* ALBUKHR TESTNET STAKING UI v1. Keeps the Stake button locked unless API policy approves. */
(function (window, document) {
  "use strict";
  var project = null;
  var latestOffers = null;
  var loading = false;
  var starting = false;
  var intentPrepared = false;
  var intentArmed = false;
  var modalId = "albukhrTestnetStakeModal";

  function clean(v) { return String(v == null ? "" : v).trim(); }
  function num(v) { var n = Number(v); return Number.isFinite(n) ? n : 0; }
  function money(v) { return num(v).toFixed(3).replace(/0+$/, "").replace(/\.$/, "") + " Pi"; }
  function el(id) { return document.getElementById(id); }
  function setStatus(message, isError) {
    var node = el("albukhrStakeStatus");
    if (!node) return;
    node.textContent = clean(message);
    node.dataset.state = isError ? "error" : "normal";
  }
  function setButton(enabled, label) {
    var button = el("stakeBtn");
    if (!button) return;
    button.disabled = !enabled;
    button.setAttribute("aria-disabled", enabled ? "false" : "true");
    var small = button.querySelector("small");
    if (small) small.textContent = label;
  }
  function getClient() {
    var client = window.AlbukhrTestnetStakingPayment;
    if (!client || typeof client.getOffers !== "function" || typeof client.createStake !== "function") {
      throw new Error("TESTNET_STAKING_CLIENT_UNAVAILABLE");
    }
    return client;
  }

  function ensureModal() {
    var existing = el(modalId);
    if (existing) return existing;
    var modal = document.createElement("div");
    modal.id = modalId;
    modal.className = "albukhr-stake-modal";
    modal.hidden = true;
    modal.innerHTML =
      '<div class="albukhr-stake-dialog" role="dialog" aria-modal="true" aria-labelledby="albukhrStakeTitle">' +
        '<button class="albukhr-stake-close" type="button" id="albukhrStakeClose" aria-label="Close">×</button>' +
        '<div class="section-kicker">ALBUKHR TESTNET STAKING</div>' +
        '<h2 id="albukhrStakeTitle">Stake in project</h2>' +
        '<p id="albukhrStakeIntro">Review the terms before confirming your Pi Testnet payment.</p>' +
        '<label for="albukhrStakeDuration">Duration</label>' +
        '<select id="albukhrStakeDuration"></select>' +
        '<label for="albukhrStakeAmount">Stake amount (Pi)</label>' +
        '<input id="albukhrStakeAmount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="Enter Pi amount">' +
        '<div class="albukhr-stake-summary">' +
          '<div><span>Reward rate</span><strong id="albukhrStakeRate">—</strong></div>' +
          '<div><span>Estimated reward</span><strong id="albukhrStakeReward">—</strong></div>' +
          '<div><span>Reward available</span><strong>After payment is verified</strong></div>' +
          '<div><span>Capital unlock</span><strong id="albukhrStakeUnlock">—</strong></div>' +
        '</div>' +
        '<p class="albukhr-stake-warning">Reward estimates are based on the approved offer. Capital stays locked until the selected duration completes. Do not repeat a payment while an earlier Pi payment is under reconciliation.</p>' +
        '<p id="albukhrStakeStatus" class="albukhr-stake-status" aria-live="polite"></p>' +
        '<div class="albukhr-stake-actions"><button type="button" class="action-btn" id="albukhrStakeCancel">Cancel</button><button type="button" class="action-btn primary" id="albukhrStakeConfirm">Reserve reward</button></div>' +
      '</div>';
    document.body.appendChild(modal);
    el("albukhrStakeClose").addEventListener("click", closeModal);
    el("albukhrStakeCancel").addEventListener("click", closeModal);
    el("albukhrStakeDuration").addEventListener("change", updatePreview);
    el("albukhrStakeAmount").addEventListener("input", updatePreview);
    el("albukhrStakeConfirm").addEventListener("click", submitStake);
    modal.addEventListener("click", function (event) { if (event.target === modal) closeModal(); });
    return modal;
  }

  function selectedTerm() {
    if (!latestOffers || !Array.isArray(latestOffers.terms)) return null;
    var days = Number(el("albukhrStakeDuration") && el("albukhrStakeDuration").value);
    return latestOffers.terms.find(function (term) {
      return Number(term.duration_days) === days && term.available === true;
    }) || null;
  }

  function updatePreview() {
    var term = selectedTerm();
    var amount = num(el("albukhrStakeAmount") && el("albukhrStakeAmount").value);
    if (!term) {
      el("albukhrStakeRate").textContent = "—";
      el("albukhrStakeReward").textContent = "—";
      el("albukhrStakeUnlock").textContent = "—";
      el("albukhrStakeConfirm").disabled = true;
      return;
    }
    var reward = Math.round(amount * Number(term.reward_rate) * 1e7) / 1e7;
    el("albukhrStakeRate").textContent = Number(term.reward_percent).toFixed(2).replace(/0+$/, "").replace(/\.$/, "") + "%";
    el("albukhrStakeReward").textContent = money(reward);
    el("albukhrStakeUnlock").textContent = Number(term.duration_days) + " days after confirmation";
    el("albukhrStakeConfirm").disabled = starting || amount < Number(term.min_stake) || !Number.isFinite(amount);
  }

  async function loadOffers(nextProject) {
    if (!nextProject || !clean(nextProject.id) || !clean(nextProject.project_code)) return;
    project = nextProject;
    loading = true;
    setButton(false, "Checking policy…");
    try {
      var result = await getClient().getOffers(project);
      latestOffers = result;
      var terms = Array.isArray(result.terms) ? result.terms : [];
      var usable = terms.filter(function (term) { return term.available === true; });
      setButton(result.can_stake === true && usable.length > 0, result.can_stake === true && usable.length ? "Ready" : "Policy locked");
      var summary = el("aStakeNote");
      if (summary) summary.textContent = result.can_stake === true ? "Approved Testnet staking offers available" : "Staking is locked until ALBUKHR policy and reserve checks pass";
    } catch (error) {
      latestOffers = null;
      setButton(false, "Locked");
      var summary = el("aStakeNote");
      if (summary) summary.textContent = "Unable to verify Testnet staking policy";
      console.error("[ALBUKHR TESTNET STAKING OFFERS]", error);
    } finally {
      loading = false;
    }
  }

  async function openModal() {
    if (loading || starting || !project) return;
    setButton(false, "Checking policy…");
    try {
      var result = await getClient().getOffers(project);
      latestOffers = result;
      var terms = (result.terms || []).filter(function (term) { return term.available === true; });
      if (result.can_stake !== true || !terms.length) {
        setButton(false, "Policy locked");
        alert("This project is not approved for Testnet staking yet.");
        return;
      }
      var pending = getClient().getPendingIntent();
      if (pending) {
        intentPrepared = true;
        intentArmed = pending.payment_armed === true;
      } else {
        intentPrepared = false;
        intentArmed = false;
      }
      var modal = ensureModal();
      el("albukhrStakeTitle").textContent = "Stake • " + clean(project.name || project.project_code);
      var select = el("albukhrStakeDuration");
      select.textContent = "";
      terms.forEach(function (term) {
        var option = document.createElement("option");
        option.value = String(term.duration_days);
        option.textContent = term.duration_days + " days • " + Number(term.reward_percent).toFixed(2) + "% reward • minimum " + money(term.min_stake);
        select.appendChild(option);
      });
      el("albukhrStakeAmount").value = terms[0].min_stake;
      el("albukhrStakeAmount").min = terms[0].min_stake;
      el("albukhrStakeAmount").step = "0.01";
      setStatus("");
      updatePreview();
      var pending = getClient().getPendingIntent();
      if (pending) {
        if (pending.payment_launched) {
          el("albukhrStakeConfirm").textContent = "Payment needs reconciliation";
          el("albukhrStakeConfirm").disabled = true;
          setModalPaymentArmed(true);
          setStatus("A Pi payment attempt was already started. Do not reopen a second payment for this intent. Use reconciliation or contact ALBUKHR Testnet admin.", true);
        } else if (pending.payment_armed) {
          el("albukhrStakeConfirm").textContent = "Open Pi Testnet Payment";
          setModalPaymentArmed(true);
          setStatus("A payment intent is armed but Pi payment has not been launched on this page. Continue only if this is the same uninterrupted session; otherwise ask admin to reconcile.", true);
        } else {
          el("albukhrStakeConfirm").textContent = "Authorize Pi payment";
          setStatus("A reward reservation already exists. Continue this intent or cancel it before preparing another.");
        }
      } else {
        el("albukhrStakeConfirm").textContent = "Reserve reward";
        setModalPaymentArmed(false);
      }
      modal.hidden = false;
      el("albukhrStakeAmount").focus();
    } catch (error) {
      console.error("[ALBUKHR STAKING MODAL]", error);
      alert("Unable to load approved staking offers. Staking remains locked.");
    } finally {
      if (latestOffers && latestOffers.can_stake === true && (latestOffers.terms || []).some(function (t) { return t.available === true; })) {
        setButton(true, "Ready");
      } else {
        setButton(false, "Policy locked");
      }
    }
  }

  function setModalPaymentArmed(armed) {
    intentArmed = armed === true;
    var close = el("albukhrStakeClose");
    var cancel = el("albukhrStakeCancel");
    if (close) close.disabled = intentArmed || starting;
    if (cancel) {
      cancel.disabled = starting;
      cancel.textContent = intentArmed ? "Payment pending" : "Cancel";
    }
  }

  function closeModal() {
    var client = window.AlbukhrTestnetStakingPayment;
    if (intentArmed) {
      setStatus("The payment intent is armed. Do not cancel it or start another stake; continue to Pi payment or ask ALBUKHR Testnet admin to reconcile it.", true);
      return;
    }
    if (intentPrepared && client && typeof client.cancelPreparedStake === "function") {
      starting = true;
      setModalPaymentArmed(false);
      setStatus("Releasing the unused reward reservation safely…");
      client.cancelPreparedStake().then(function () {
        intentPrepared = false;
        starting = false;
        hideModal();
      }).catch(function (error) {
        starting = false;
        setStatus("The reservation could not be released: " + clean(error && error.message) + ". Keep this page open and ask Testnet admin to reconcile it.", true);
      });
      return;
    }
    hideModal();
  }

  function hideModal() {
    var modal = el(modalId);
    if (modal) modal.hidden = true;
    intentPrepared = false;
    intentArmed = false;
    starting = false;
    var confirm = el("albukhrStakeConfirm");
    if (confirm) {
      confirm.disabled = false;
      confirm.textContent = "Reserve reward";
    }
    setModalPaymentArmed(false);
  }

  async function submitStake() {
    if (starting || !project) return;
    var term = selectedTerm();
    var amount = num(el("albukhrStakeAmount").value);
    if (!latestOffers || latestOffers.can_stake !== true || !term || amount < Number(term.min_stake)) {
      setStatus("The selected offer or amount is not valid under current ALBUKHR policy.", true);
      return;
    }

    var client = getClient();
    starting = true;
    el("albukhrStakeConfirm").disabled = true;
    if (!intentPrepared) {
      setStatus("Verifying Pi identity and reserving the reward before payment…");
      try {
        var prepared = await client.prepareStake(project, amount, Number(term.duration_days));
        if (!prepared || !prepared.success || !prepared.intent || !prepared.intent.id) throw new Error("STAKE_INTENT_CREATE_FAILED");
        intentPrepared = true;
        setStatus("Reward reserve secured. Next, authorize this payment attempt; Pi will not open yet.");
        el("albukhrStakeConfirm").textContent = "Authorize Pi payment";
      } catch (error) {
        var message = clean(error && error.message) || "STAKE_INTENT_CREATE_FAILED";
        setStatus("Staking preparation failed: " + message + ". Do not repeat payment if the reserve status is unclear.", true);
      } finally {
        starting = false;
        if (el("albukhrStakeConfirm")) updatePreview();
      }
      return;
    }

    if (!intentArmed) {
      setStatus("Authorizing the payment attempt. Once armed, the reward reserve stays locked until Pi confirms completion/cancellation or admin reconciliation.");
      try {
        await client.armPreparedStake();
        intentArmed = true;
        setStatus("Payment attempt is armed. Tap Open Pi Testnet Payment next. Do not refresh or close this page until payment status is resolved.");
        el("albukhrStakeConfirm").textContent = "Open Pi Testnet Payment";
      } catch (error) {
        setStatus("Unable to arm payment: " + clean(error && error.message) + ". Do not create another stake; reconcile the reserved intent first.", true);
      } finally {
        starting = false;
        setModalPaymentArmed(intentArmed);
        if (el("albukhrStakeConfirm")) el("albukhrStakeConfirm").disabled = false;
      }
      return;
    }

    var pendingBeforeLaunch = client.getPendingIntent();
    if (pendingBeforeLaunch && pendingBeforeLaunch.payment_launched) {
      setStatus("A Pi payment attempt has already started for this intent. Do not launch another payment; reconcile the existing payment first.", true);
      starting = false;
      if (el("albukhrStakeConfirm")) el("albukhrStakeConfirm").disabled = true;
      return;
    }

    // No await occurs before payPreparedStake(); it calls Pi.createPayment()
    // synchronously inside this fresh user click as required by the Pi SDK.
    try {
      var paymentPromise = client.payPreparedStake();
      setStatus("Pi Testnet payment opened. Complete or cancel it in the Pi dialog; do not start another payment.");
      var result = await paymentPromise;
      if (!result || result.network !== "testnet" || !result.success || !result.stake) {
        throw new Error("STAKE_CONFIRMATION_NOT_VERIFIED");
      }
      intentPrepared = false;
      intentArmed = false;
      setStatus("Stake confirmed. Reward is reserved for immediate withdrawal; capital unlocks after " + term.duration_days + " days.");
      var note = el("aStakeNote");
      if (note) note.textContent = "Active Testnet stake confirmed";
      setButton(false, "Stake created");
      var withdrawal = window.AlbukhrTestnetWithdrawal;
      if (withdrawal && typeof withdrawal.refresh === "function") await withdrawal.refresh().catch(function () {});
      await loadOffers(project);
      dispatch("albukhr:testnet-staking-ui-completed", result);
      window.setTimeout(hideModal, 2500);
    } catch (error) {
      var pendingAfterError = client.getPendingIntent();
      if (!pendingAfterError) {
        intentPrepared = false;
        intentArmed = false;
      } else {
        intentPrepared = true;
        intentArmed = pendingAfterError.payment_armed === true;
      }
      var message = clean(error && error.message) || "TESTNET_STAKING_FAILED";
      if (message.indexOf("INCOMPLETE_PI_PAYMENT_RECONCILIATION_REQUIRED") !== -1 || message.indexOf("RECONCILIATION_REQUIRED") !== -1) {
        setStatus("Pi payment needs reconciliation. Do not create another payment; keep this page open and contact ALBUKHR Testnet admin.", true);
      } else if (message.indexOf("STAKING_POLICY_OR_LIQUIDITY") !== -1 || message.indexOf("STAKING_NOT_ENABLED") !== -1) {
        setStatus("Staking is locked because project policy or liquidity coverage is not approved.", true);
      } else if (message.indexOf("CANCELLED") !== -1) {
        intentPrepared = false;
        intentArmed = false;
        setStatus("Pi confirmed cancellation. The reward reserve was released after backend verification.", true);
        window.setTimeout(hideModal, 1500);
      } else {
        setStatus("Staking was not confirmed: " + message + ". Do not repeat payment until status is reconciled.", true);
      }
    } finally {
      starting = false;
      setModalPaymentArmed(intentArmed);
      if (el("albukhrStakeConfirm") && !intentArmed) updatePreview();
      if (intentArmed && el("albukhrStakeConfirm")) el("albukhrStakeConfirm").disabled = false;
      if ((!el(modalId) || el(modalId).hidden) && latestOffers && latestOffers.can_stake === true) {
        setButton(true, "Ready");
      }
    }
  }

  function init() {
    var button = el("stakeBtn");
    if (button) {
      // Ensure a fresh listener can be attached as each project is rendered.
      button.addEventListener("click", function () {
        if (button.disabled) return;
        openModal();
      });
    }
    window.addEventListener("albukhr:testnet-project-rendered", function (event) {
      if (event && event.detail && event.detail.project) loadOffers(event.detail.project);
    });
    window.addEventListener("albukhr:testnet-withdrawal-completed", function () {
      if (project) loadOffers(project);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(window, document);
