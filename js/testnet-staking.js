/* ALBUKHR TESTNET STAKING UI v2
 * Testnet only. Keeps the Stake button locked unless the API approves the
 * current project. Restores backend-persisted intents after page reload and
 * never offers a second Pi payment for an armed/recovered payment attempt.
 * No LocalStorage/sessionStorage is used.
 */
(function (window, document) {
  "use strict";

  var project = null;
  var latestOffers = null;
  var loading = false;
  var starting = false;
  var intentPrepared = false;
  var intentArmed = false;
  var modalId = "albukhrTestnetStakeModal";

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function num(value) {
    var number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function money(value) {
    return num(value).toFixed(3).replace(/0+$/, "").replace(/\.$/, "") + " Pi";
  }

  function el(id) {
    return document.getElementById(id);
  }

  function dispatch(name, detail) {
    if (typeof window.CustomEvent === "function") {
      window.dispatchEvent(new window.CustomEvent(name, { detail: detail || {} }));
      return;
    }
    var event = document.createEvent("CustomEvent");
    event.initCustomEvent(name, false, false, detail || {});
    window.dispatchEvent(event);
  }

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
        var requiredMethods = [
      "getOffers",
      "prepareStake",
      "armPreparedStake",
      "payPreparedStake",
      "cancelPreparedStake",
      "getPendingIntent",
      "authenticate",
      "reconcile"
    ];

    if (!client) throw new Error("TESTNET_STAKING_CLIENT_UNAVAILABLE");

    for (var i = 0; i < requiredMethods.length; i += 1) {
      if (typeof client[requiredMethods[i]] !== "function") {
        throw new Error(
          "TESTNET_STAKING_CLIENT_METHOD_UNAVAILABLE: " + requiredMethods[i]
        );
      }
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
    modal.addEventListener("click", function (event) {
      if (event.target === modal) closeModal();
    });
    return modal;
  }

  function selectedTerm() {
    if (!latestOffers || !Array.isArray(latestOffers.terms)) return null;
    var durationNode = el("albukhrStakeDuration");
    var days = Number(durationNode && durationNode.value);
    return latestOffers.terms.find(function (term) {
      return Number(term.duration_days) === days && term.available === true;
    }) || null;
  }

  function setFormLocked(locked) {
    var duration = el("albukhrStakeDuration");
    var amount = el("albukhrStakeAmount");
    if (duration) duration.disabled = locked === true;
    if (amount) amount.disabled = locked === true;
  }

  function updatePreview() {
    var term = selectedTerm();
    var amountNode = el("albukhrStakeAmount");
    var amount = num(amountNode && amountNode.value);
    var rateNode = el("albukhrStakeRate");
    var rewardNode = el("albukhrStakeReward");
    var unlockNode = el("albukhrStakeUnlock");
    var confirm = el("albukhrStakeConfirm");

    if (!term) {
      if (rateNode) rateNode.textContent = "—";
      if (rewardNode) rewardNode.textContent = "—";
      if (unlockNode) unlockNode.textContent = "—";
      if (confirm) confirm.disabled = true;
      return;
    }

    var reward = Math.round(amount * Number(term.reward_rate) * 1e7) / 1e7;
    if (rateNode) {
      rateNode.textContent = Number(term.reward_percent).toFixed(2)
        .replace(/0+$/, "").replace(/\.$/, "") + "%";
    }
    if (rewardNode) rewardNode.textContent = money(reward);
    if (unlockNode) {
      unlockNode.textContent = Number(term.duration_days) + " days after confirmation";
    }
    if (confirm) {
      confirm.disabled = starting || amount < Number(term.min_stake) || !Number.isFinite(amount);
    }
  }

  function findTerm(days) {
    if (!latestOffers || !Array.isArray(latestOffers.terms)) return null;
    return latestOffers.terms.find(function (term) {
      return Number(term.duration_days) === Number(days);
    }) || null;
  }

  function populateTerms(terms, pending) {
    var select = el("albukhrStakeDuration");
    if (!select) return;
    select.textContent = "";

    (terms || []).forEach(function (term) {
      if (term.available !== true &&
          !(pending && Number(term.duration_days) === Number(pending.duration_days))) {
        return;
      }
      var option = document.createElement("option");
      option.value = String(term.duration_days);
      option.textContent = term.duration_days + " days • " +
        Number(term.reward_percent).toFixed(2) + "% reward • minimum " +
        money(term.min_stake);
      select.appendChild(option);
    });

    if (pending && !findTerm(pending.duration_days)) {
      var restoredOption = document.createElement("option");
      restoredOption.value = String(pending.duration_days);
      restoredOption.textContent = pending.duration_days + " days • existing reservation";
      select.appendChild(restoredOption);
    }

    if (pending) select.value = String(pending.duration_days);
    else if (select.options.length) select.selectedIndex = 0;
  }

  function renderPendingIntent(pending) {
    var confirm = el("albukhrStakeConfirm");
    var amount = el("albukhrStakeAmount");
    var term = pending ? findTerm(pending.duration_days) : null;

    if (!pending) {
      intentPrepared = false;
      intentArmed = false;
      setFormLocked(false);
      if (confirm) {
        confirm.textContent = "Reserve reward";
        confirm.disabled = false;
      }
      var terms = latestOffers && Array.isArray(latestOffers.terms)
        ? latestOffers.terms.filter(function (item) { return item.available === true; })
        : [];
      if (terms.length) {
        amount.value = terms[0].min_stake;
        amount.min = terms[0].min_stake;
        updatePreview();
      }
      setModalPaymentArmed(false);
      return;
    }

    intentPrepared = true;
    intentArmed = pending.payment_armed === true;
    setFormLocked(true);
    if (amount) {
      amount.value = String(pending.amount);
      amount.min = String(pending.amount);
    }

    var rewardRate = Number(pending.reward_rate);
    var rewardAmount = Number(pending.reward_amount);
    var rate = el("albukhrStakeRate");
    var reward = el("albukhrStakeReward");
    var unlock = el("albukhrStakeUnlock");
    if (rate) {
      rate.textContent = term && Number.isFinite(Number(term.reward_percent))
        ? Number(term.reward_percent).toFixed(2).replace(/0+$/, "").replace(/\.$/, "") + "%"
        : (Number.isFinite(rewardRate) ? (rewardRate * 100).toFixed(2) + "%" : "—");
    }
    if (reward) reward.textContent = Number.isFinite(rewardAmount) ? money(rewardAmount) : "—";
    if (unlock) unlock.textContent = pending.duration_days + " days after confirmation";

    if (pending.payment_launched === true || clean(pending.payment_id)) {
      if (confirm) {
        confirm.textContent = "Payment needs reconciliation";
        confirm.disabled = true;
      }
      setModalPaymentArmed(true);
      setStatus(
        "This Testnet payment intent was already armed or has a payment ID. A Pi payment may already have opened before the page was refreshed. Do not start another payment; ALBUKHR Testnet admin must reconcile this intent.",
        true
      );
      return;
    }

    if (pending.expired === true) {
      if (confirm) {
        confirm.textContent = "Reservation expired";
        confirm.disabled = true;
      }
      setModalPaymentArmed(false);
      setStatus(
        "This unused reward reservation has expired and cannot authorize a Pi payment. Use Cancel to ask the Testnet API to safely close the expired intent.",
        true
      );
      return;
    }

    if (pending.payment_armed === true) {
      if (confirm) {
        confirm.textContent = "Open Pi Testnet Payment";
        confirm.disabled = starting;
      }
      setModalPaymentArmed(true);
      setStatus(
        "The payment attempt is armed in this active page session. Tap Open Pi Testnet Payment only once. Do not refresh or close the page until Pi returns a verified result.",
        true
      );
      return;
    }

    if (confirm) {
      confirm.textContent = "Authorize Pi payment";
      confirm.disabled = starting;
    }
    setModalPaymentArmed(false);
    setStatus(
      "An existing reward reservation was restored from Testnet. Its amount and duration are locked. Continue this same intent, or cancel it safely before preparing another stake."
    );
  }

  async function loadOffers(nextProject) {
    if (!nextProject || !clean(nextProject.id) || !clean(nextProject.project_code)) return;
    project = nextProject;
    loading = true;
    setButton(false, "Checking policy…");

    try {
      var result = await getClient().getOffers(project);
      latestOffers = result;
      var pending = getClient().getPendingIntent();
      var terms = Array.isArray(result.terms) ? result.terms : [];
      var usable = terms.filter(function (term) { return term.available === true; });
      var canOpen = pending || (result.can_stake === true && usable.length > 0);

      setButton(!!canOpen, pending ? "Resume existing stake" : (canOpen ? "Ready" : "Policy locked"));
      var summary = el("aStakeNote");
      if (summary) {
        if (pending && pending.payment_launched) {
          summary.textContent = "Existing Testnet payment requires reconciliation; do not pay again";
        } else if (pending) {
          summary.textContent = "Existing Testnet reward reservation restored";
        } else {
          summary.textContent = result.can_stake === true
            ? "Approved Testnet staking offers available"
            : "Staking is locked until ALBUKHR policy and reserve checks pass";
        }
      }
    } catch (error) {
      latestOffers = null;
      setButton(false, "Locked");
      var summaryNode = el("aStakeNote");
      if (summaryNode) summaryNode.textContent = "Unable to verify Testnet staking policy or restore pending intent";
      console.error("[ALBUKHR TESTNET STAKING OFFERS]", error);
    } finally {
      loading = false;
    }
  }

  async function openModal() {
    if (loading || starting || !project) return;
    setButton(false, "Checking policy…");

    try {
      // getOffers() in the payment client first restores any server-side
      // pending intent for this exact Testnet project.
      var result = await getClient().getOffers(project);
      latestOffers = result;
      var client = getClient();
      var pending = client.getPendingIntent();
      var terms = Array.isArray(result.terms) ? result.terms : [];
      var usable = terms.filter(function (term) { return term.available === true; });

      // An existing reservation must remain accessible even if the current
      // offer policy has subsequently been locked or changed.
      if (!pending && (result.can_stake !== true || !usable.length)) {
        setButton(false, "Policy locked");
        alert("This project is not approved for Testnet staking yet.");
        return;
      }

      var modal = ensureModal();
      el("albukhrStakeTitle").textContent = "Stake • " + clean(project.name || project.project_code);
      populateTerms(terms, pending);

      if (!pending && usable.length) {
        el("albukhrStakeAmount").value = usable[0].min_stake;
        el("albukhrStakeAmount").min = usable[0].min_stake;
        el("albukhrStakeAmount").step = "0.01";
      }

      setStatus("");
      renderPendingIntent(pending);
      modal.hidden = false;

      if (!pending) el("albukhrStakeAmount").focus();
      else if (pending.payment_launched) el("albukhrStakeStatus").focus();

      setButton(true, pending ? "Resume existing stake" : "Ready");
    } catch (error) {
      console.error("[ALBUKHR STAKING MODAL]", error);
      setButton(false, "Locked");
      alert("Unable to verify Testnet staking policy or restore its pending reservation. Staking remains locked.");
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
    var pending = client && typeof client.getPendingIntent === "function"
      ? client.getPendingIntent()
      : null;

    if (intentArmed || (pending && (pending.payment_armed || pending.payment_launched || pending.payment_id))) {
      setStatus(
        "This intent may already be associated with an open Pi payment. It cannot be cancelled or released from this page. Do not make another payment; contact ALBUKHR Testnet admin for reconciliation.",
        true
      );
      return;
    }

    if (intentPrepared && client && typeof client.cancelPreparedStake === "function") {
      starting = true;
      setModalPaymentArmed(false);
      setStatus("Safely closing the unused reward reservation with the Testnet API…");
      client.cancelPreparedStake().then(function () {
        intentPrepared = false;
        starting = false;
        hideModal();
        if (project) loadOffers(project);
      }).catch(function (error) {
        starting = false;
        setStatus(
          "The reservation could not be safely closed: " +
          (clean(error && error.message) || "UNKNOWN_ERROR") +
          ". Keep this page open and ask Testnet admin to reconcile it.",
          true
        );
        setModalPaymentArmed(false);
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
    setFormLocked(false);
    var confirm = el("albukhrStakeConfirm");
    if (confirm) {
      confirm.disabled = false;
      confirm.textContent = "Reserve reward";
    }
    setModalPaymentArmed(false);
  }

  async function submitStake() {
    if (starting || !project) return;

    var client = getClient();
    var pending = client.getPendingIntent();
    var term = selectedTerm();
    var amount = num(el("albukhrStakeAmount") && el("albukhrStakeAmount").value);

    if (!pending && (!latestOffers || latestOffers.can_stake !== true ||
        !term || amount < Number(term.min_stake))) {
      setStatus("The selected offer or amount is not valid under current ALBUKHR policy.", true);
      return;
    }

    if (pending) {
      intentPrepared = true;
      intentArmed = pending.payment_armed === true;
      if (pending.payment_launched === true || clean(pending.payment_id)) {
        renderPendingIntent(pending);
        return;
      }
      if (pending.expired === true) {
        renderPendingIntent(pending);
        return;
      }
    }

    starting = true;
    var confirm = el("albukhrStakeConfirm");
    if (confirm) confirm.disabled = true;

    if (!pending && !intentPrepared) {
      setStatus("Verifying Pi identity and reserving the reward before payment…");
      try {
        var prepared = await client.prepareStake(project, amount, Number(term.duration_days));
        if (!prepared || !prepared.success || !prepared.intent || !prepared.intent.id) {
          throw new Error("STAKE_INTENT_CREATE_FAILED");
        }
        intentPrepared = true;
        var createdPending = client.getPendingIntent();
        renderPendingIntent(createdPending);
        setStatus("Reward reservation secured. The next step authorizes this same payment intent; Pi will not open yet.");
      } catch (error) {
        var prepareMessage = clean(error && error.message) || "STAKE_INTENT_CREATE_FAILED";
        setStatus("Staking preparation failed: " + prepareMessage + ". Do not repeat payment while the reservation status is unclear.", true);
      } finally {
        starting = false;
        if (el("albukhrStakeConfirm") && intentPrepared) {
          var afterPrepare = client.getPendingIntent();
          renderPendingIntent(afterPrepare);
        } else if (el("albukhrStakeConfirm")) {
          updatePreview();
        }
      }
      return;
    }

    if (!pending) pending = client.getPendingIntent();
    if (!pending) {
      starting = false;
      setStatus("The pending reservation could not be found. Recheck the Testnet project state before trying again.", true);
      if (confirm) confirm.disabled = true;
      return;
    }

    if (!pending.payment_armed) {
      setStatus("Authorizing the payment attempt. Once armed, the reward reservation stays locked until Pi confirms completion/cancellation or admin reconciliation.");
      try {
        await client.armPreparedStake();
        intentArmed = true;
        var armedPending = client.getPendingIntent();
        renderPendingIntent(armedPending);
        setStatus("Payment attempt armed. Tap Open Pi Testnet Payment once in this same page session. Do not refresh or close the page until its status is resolved.");
      } catch (error) {
        setStatus("Unable to arm payment: " + clean(error && error.message) + ". Do not create another stake; reconcile the reserved intent first.", true);
      } finally {
        starting = false;
        setModalPaymentArmed(intentArmed);
        if (el("albukhrStakeConfirm")) {
          var current = client.getPendingIntent();
          if (current && current.payment_armed && !current.payment_launched) {
            el("albukhrStakeConfirm").disabled = false;
          } else if (current && current.payment_launched) {
            el("albukhrStakeConfirm").disabled = true;
          }
        }
      }
      return;
    }

    // An armed intent from the current uninterrupted page session can launch
    // once. The client marks paymentLaunched before invoking Pi.createPayment.
    // After reload, an armed intent is restored with payment_launched=true and
    // is stopped above, so this block cannot start a duplicate Pi payment.
    if (pending.payment_launched === true || clean(pending.payment_id)) {
      starting = false;
      renderPendingIntent(pending);
      return;
    }

    try {
      // No await occurs before payPreparedStake(); it calls Pi.createPayment()
      // synchronously inside this fresh user click as required by the Pi SDK.
      var paymentPromise = client.payPreparedStake();
      setStatus("Pi Testnet payment opened. Complete or cancel it in the Pi dialog; do not start another payment.");
      var result = await paymentPromise;

      if (!result || result.network !== "testnet" || !result.success || !result.stake) {
        throw new Error("STAKE_CONFIRMATION_NOT_VERIFIED");
      }

      intentPrepared = false;
      intentArmed = false;
      setStatus("Stake confirmed. Reward is reserved for immediate withdrawal; capital unlocks after " + pending.duration_days + " days.");
      var note = el("aStakeNote");
      if (note) note.textContent = "Active Testnet stake confirmed";
      setButton(false, "Stake created");

      var withdrawal = window.AlbukhrTestnetWithdrawal;
      if (withdrawal && typeof withdrawal.refresh === "function") {
        await withdrawal.refresh().catch(function () {});
      }
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
      if (message.indexOf("INCOMPLETE_PI_PAYMENT_RECONCILIATION_REQUIRED") !== -1 ||
          message.indexOf("RECONCILIATION_REQUIRED") !== -1 ||
          message.indexOf("PI_PAYMENT_RECONCILIATION_REQUIRED") !== -1) {
        setStatus("Pi payment needs reconciliation. Do not create another payment; keep this page open and contact ALBUKHR Testnet admin.", true);
      } else if (message.indexOf("STAKING_POLICY_OR_LIQUIDITY") !== -1 ||
                 message.indexOf("STAKING_NOT_ENABLED") !== -1) {
        setStatus("Staking is locked because project policy or liquidity coverage is not approved.", true);
      } else if (message.indexOf("CANCELLED") !== -1) {
        intentPrepared = false;
        intentArmed = false;
        setStatus("Pi cancellation was reported. The reservation is considered released only after backend verification.", true);
        window.setTimeout(hideModal, 1500);
      } else {
        setStatus("Staking was not confirmed: " + message + ". Do not repeat payment until its status is reconciled.", true);
      }

      if (pendingAfterError) renderPendingIntent(pendingAfterError);
      else setFormLocked(false);
    } finally {
      starting = false;
      var finalPending = client.getPendingIntent();
      if (finalPending) {
        intentPrepared = true;
        intentArmed = finalPending.payment_armed === true;
        renderPendingIntent(finalPending);
      } else {
        intentPrepared = false;
        intentArmed = false;
        setModalPaymentArmed(false);
        if (el("albukhrStakeConfirm")) updatePreview();
      }
      if ((!el(modalId) || el(modalId).hidden) && latestOffers && latestOffers.can_stake === true) {
        setButton(true, "Ready");
      }
    }
  }

  function init() {
    var button = el("stakeBtn");
    if (button) {
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window, document);
