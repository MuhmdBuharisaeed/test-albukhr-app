/* ALBUKHR TESTNET GLOBAL TREASURY PAYMENT CLIENT v1
 * Not auto-initialized. Do not load on investor.html until end-to-end tests pass.
 * Testnet-only; no Mainnet fallback, persistent browser storage, or stored Pi token.
 */
(function (window) {
  "use strict";

  var NETWORK = "testnet";
  var HOST = "test.albukhr.com";
  var API_BASE = "https://test-albukhr-api.onrender.com/outflow-fee";
  var initialized = false;
  var initPromise = null;
  var authPromise = null;
  var piAuth = null;
  var pendingIncomplete = [];
  var prepareKey = null;
  var lastWithdrawalId = null;

  function clean(value) { return String(value == null ? "" : value).trim(); }
  function emit(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch (_) {}
  }
  function environment() {
    var env = window.ALBukhrEnvironment;
    var host = clean(window.location && window.location.hostname).toLowerCase();
    if (host !== HOST || !env || typeof env.isKnown !== "function" ||
        typeof env.isTestnet !== "function" || typeof env.getNetwork !== "function" ||
        !env.isKnown() || !env.isTestnet() || env.getNetwork() !== NETWORK) {
      throw new Error("INVALID_TESTNET_ENVIRONMENT");
    }
  }
  function authModule() {
    var auth = window.AlbukhrTestnetAuth;
    if (!auth || typeof auth.requireTestnetAuth !== "function" ||
        typeof auth.getSessionToken !== "function") throw new Error("TESTNET_AUTH_MODULE_UNAVAILABLE");
    return auth;
  }
  function sessionToken() {
    var token = clean(authModule().getSessionToken());
    if (!token) throw new Error("TESTNET_SESSION_REQUIRED");
    return token;
  }
  function piSdk() {
    if (!window.Pi || typeof window.Pi.init !== "function" ||
        typeof window.Pi.authenticate !== "function" ||
        typeof window.Pi.createPayment !== "function") throw new Error("PI_SDK_UNAVAILABLE");
    return window.Pi;
  }
  function randomKey() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    if (!window.crypto || typeof window.crypto.getRandomValues !== "function") throw new Error("SECURE_RANDOM_UNAVAILABLE");
    var bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    var h = Array.from(bytes, function (b) { return b.toString(16).padStart(2, "0"); }).join("");
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
  }
  async function initialize() {
    environment();
    var pi = piSdk();
    if (initialized) return pi;
    if (initPromise) return initPromise;
    initPromise = Promise.resolve()
      .then(function () { return pi.init({ version: "2.0", sandbox: true }); })
      .then(function () {
        initialized = true;
        emit("albukhr:testnet-global-treasury-sdk-ready", { network: NETWORK, sandbox: true });
        return pi;
      })
      .catch(function (error) {
        initialized = false; initPromise = null;
        emit("albukhr:testnet-global-treasury-sdk-error", { error: clean(error && error.message) || "PI_INIT_FAILED" });
        throw error;
      });
    return initPromise;
  }
  async function apiRequest(path, body, includePiToken) {
    environment();
    var headers = { Accept: "application/json", "Content-Type": "application/json", "X-Testnet-Session": sessionToken() };
    if (includePiToken) {
      var token = clean(piAuth && piAuth.accessToken);
      if (!token) throw new Error("PI_AUTH_REQUIRED");
      headers.Authorization = "Bearer " + token;
    }
    var response = await fetch(API_BASE.replace(/\/+$/, "") + "/" + clean(path).replace(/^\/+/, ""), {
      method: "POST", headers: headers, body: JSON.stringify(body || {})
    });
    var data = null;
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) {
      var error = new Error(clean(data && (data.error || data.message)) || "TESTNET_OUTFLOW_FEE_ERROR");
      error.status = response.status; error.body = data; throw error;
    }
    return data;
  }
  async function recoverIncomplete(payment) {
    var metadata = payment && payment.metadata && typeof payment.metadata === "object" ? payment.metadata : {};
    if (clean(metadata.network) !== NETWORK || clean(metadata.action) !== "outflow_fee" || !clean(metadata.fee_assessment_id)) return null;
    var paymentId = clean(payment.identifier || payment.id);
    if (!paymentId) throw new Error("PAYMENT_ID_REQUIRED");
    var status = payment.status && typeof payment.status === "object" ? payment.status : {};
    if (status.cancelled === true || status.user_cancelled === true) {
      return apiRequest("cancel", { paymentId: paymentId, assessmentId: clean(metadata.fee_assessment_id) }, true);
    }
    var txid = clean(payment.transaction && (payment.transaction.txid || payment.transaction.tx_hash) || payment.txid);
    if (!txid) throw new Error("FEE_PAYMENT_RECOVERY_NEEDS_TRANSACTION");
    return apiRequest("complete", { paymentId: paymentId, assessmentId: clean(metadata.fee_assessment_id), txid: txid }, true);
  }
  async function authenticate() {
    environment();
    await authModule().requireTestnetAuth({ redirectOnFailure: false });
    sessionToken();
    if (piAuth && clean(piAuth.accessToken) && piAuth.user && clean(piAuth.user.uid)) return { user: piAuth.user };
    if (authPromise) return authPromise;
    authPromise = (async function () {
      var pi = await initialize();
      pendingIncomplete = [];
      var result = await pi.authenticate(["username", "payments"], function (payment) {
        if (payment) pendingIncomplete.push(payment);
      });
      if (!result || !clean(result.accessToken) || !result.user || !clean(result.user.uid)) throw new Error("PI_AUTH_RESULT_INVALID");
      piAuth = { accessToken: clean(result.accessToken), user: { uid: clean(result.user.uid), username: clean(result.user.username) || null } };
      var items = pendingIncomplete.slice(); pendingIncomplete = [];
      for (var i = 0; i < items.length; i += 1) {
        try { await recoverIncomplete(items[i]); }
        catch (error) {
          emit("albukhr:testnet-global-treasury-recovery-required", {
            paymentId: clean(items[i] && (items[i].identifier || items[i].id)),
            error: clean(error && error.message) || "FEE_PAYMENT_RECOVERY_REQUIRED"
          });
        }
      }
      emit("albukhr:testnet-global-treasury-pi-authenticated", { network: NETWORK, uid: piAuth.user.uid });
      return { user: piAuth.user };
    })();
    try { return await authPromise; } finally { authPromise = null; }
  }
  async function prepareWithdrawal(options) {
    options = options || {};
    environment();
    await authModule().requireTestnetAuth({ redirectOnFailure: false });
    if (!prepareKey) prepareKey = randomKey();
    try {
      var result = await apiRequest("withdrawal/prepare", {
        stakeId: clean(options.stakeId), withdrawalType: clean(options.withdrawalType).toLowerCase(),
        requestedAmount: Number(options.requestedAmount), walletAddress: clean(options.walletAddress) || undefined,
        idempotencyKey: prepareKey
      }, false);
      lastWithdrawalId = clean(result && result.withdrawal && result.withdrawal.id) || null;
      prepareKey = null;
      emit("albukhr:testnet-global-treasury-withdrawal-prepared", result);
      return result;
    } catch (error) {
      var body = error && error.body || {};
      if (clean(body.withdrawal_id)) lastWithdrawalId = clean(body.withdrawal_id);
      else if (Number(error && error.status) === 423) prepareKey = null;
      throw error;
    }
  }
  async function assessWithdrawal(withdrawalId) {
    await authModule().requireTestnetAuth({ redirectOnFailure: false });
    return apiRequest("withdrawal/assess", { withdrawalId: clean(withdrawalId || lastWithdrawalId) }, false);
  }
  async function prepareOwnerFeePayment(withdrawalId) {
    await authModule().requireTestnetAuth({ redirectOnFailure: false });
    return apiRequest("owner/prepare-payment", { withdrawalId: clean(withdrawalId) }, false);
  }
  function validateAssessment(assessment) {
    if (!assessment || clean(assessment.network) !== NETWORK || !clean(assessment.id) ||
        !clean(assessment.source_type) || !clean(assessment.source_id)) throw new Error("FEE_ASSESSMENT_INVALID");
    var amount = Number(assessment.fee_amount);
    if (!Number.isFinite(amount) || amount < 0) throw new Error("FEE_AMOUNT_INVALID");
    return amount;
  }
  async function payFee(assessment) {
    environment();
    await authenticate();
    var fee = validateAssessment(assessment);
    if (fee === 0 || clean(assessment.fee_status) === "not_required") return { success: true, fee_required: false, fee_paid: false };
    if (clean(assessment.fee_status) === "paid") return { success: true, fee_required: true, fee_paid: true, already_paid: true };
    if (clean(assessment.fee_status) !== "payment_pending") throw new Error("FEE_PAYMENT_NOT_PENDING");
    var pi = piSdk();
    var metadata = {
      network: NETWORK, action: "outflow_fee", fee_assessment_id: clean(assessment.id),
      source_type: clean(assessment.source_type), source_id: clean(assessment.source_id)
    };
    // This method must be called directly from an explicit user action.
    return new Promise(function (resolve, reject) {
      var settled = false;
      function resolveOnce(value) { if (!settled) { settled = true; resolve(value); } }
      function rejectOnce(error) { if (!settled) { settled = true; reject(error instanceof Error ? error : new Error("PI_FEE_PAYMENT_FAILED")); } }
      pi.createPayment({ amount: fee, memo: "ALBUKHR Testnet outflow fee", metadata: metadata }, {
        onReadyForServerApproval: async function (paymentId) {
          try {
            await apiRequest("approve", { paymentId: clean(paymentId), assessmentId: clean(assessment.id) }, true);
            emit("albukhr:testnet-global-treasury-fee-approved", { paymentId: clean(paymentId), assessmentId: clean(assessment.id) });
          } catch (error) {
            emit("albukhr:testnet-global-treasury-fee-approval-error", { paymentId: clean(paymentId), error: clean(error && error.message) });
            rejectOnce(error);
          }
        },
        onReadyForServerCompletion: async function (paymentId, txid) {
          try {
            var completed = await apiRequest("complete", { paymentId: clean(paymentId), assessmentId: clean(assessment.id), txid: clean(txid) }, true);
            emit("albukhr:testnet-global-treasury-fee-paid", completed);
            resolveOnce(completed);
          } catch (error) {
            emit("albukhr:testnet-global-treasury-fee-completion-error", { paymentId: clean(paymentId), error: clean(error && error.message) });
            rejectOnce(error); throw error;
          }
        },
        onCancel: function (paymentId) {
          var cancelledId = clean(paymentId);
          emit("albukhr:testnet-global-treasury-fee-cancelled", { paymentId: cancelledId, assessmentId: clean(assessment.id), network: NETWORK });
          // Best-effort backend notification. The API independently reads the
          // official Pi payment and only frees the attempt if Pi marks it cancelled.
          if (cancelledId) {
            apiRequest("cancel", { paymentId: cancelledId, assessmentId: clean(assessment.id) }, true)
              .catch(function (error) {
                emit("albukhr:testnet-global-treasury-recovery-required", {
                  paymentId: cancelledId,
                  assessmentId: clean(assessment.id),
                  error: clean(error && error.message) || "FEE_PAYMENT_CANCELLATION_UNCONFIRMED"
                });
              });
          }
          rejectOnce(new Error("PI_PAYMENT_CANCELLED"));
        },
        onError: function (error, payment) {
          emit("albukhr:testnet-global-treasury-fee-payment-error", {
            message: clean(error && error.message) || "PI_PAYMENT_ERROR",
            paymentId: clean(payment && (payment.identifier || payment.id))
          });
          rejectOnce(error instanceof Error ? error : new Error("PI_PAYMENT_ERROR"));
        }
      });
    });
  }
  async function executeWithdrawal(withdrawalId) {
    await authModule().requireTestnetAuth({ redirectOnFailure: false });
    var result = await apiRequest("withdrawal/execute", { withdrawalId: clean(withdrawalId || lastWithdrawalId) }, false);
    emit("albukhr:testnet-global-treasury-withdrawal-executed", result);
    return result;
  }

  async function executeOwnerWithdrawal(withdrawalId) {
  await authModule().requireTestnetAuth({
    redirectOnFailure: false,
  });

  var id = clean(withdrawalId);
  if (!id) {
    throw new Error("OWNER_WITHDRAWAL_ID_REQUIRED");
  }

  var result = await apiRequest(
    "owner/execute",
    { withdrawalId: id },
    false
  );

  emit(
    "albukhr:testnet-global-treasury-owner-withdrawal-executed",
    result
  );

  return result;
}

async function reconcileOwnerWithdrawal(withdrawalId) {
  await authModule().requireTestnetAuth({
    redirectOnFailure: false,
  });

  var id = clean(withdrawalId);
  if (!id) {
    throw new Error("OWNER_WITHDRAWAL_ID_REQUIRED");
  }

  var result = await apiRequest(
    "owner/reconcile",
    { withdrawalId: id },
    false
  );

  emit(
    "albukhr:testnet-global-treasury-owner-withdrawal-reconciled",
    result
  );

  return result;
}

  function clearPiAuth() { piAuth = null; authPromise = null; pendingIncomplete = []; }

  var api = {
    network: NETWORK, host: HOST, apiBase: API_BASE,
    authenticate: authenticate, prepareWithdrawal: prepareWithdrawal,
    assessWithdrawal: assessWithdrawal, prepareOwnerFeePayment: prepareOwnerFeePayment,
    payFee: payFee, executeWithdrawal: executeWithdrawal, clearPiAuth: clearPiAuth
  };
  try { Object.freeze(api); } catch (_) {}
  window.AlbukhrTestnetGlobalTreasury = api;
})(window);
