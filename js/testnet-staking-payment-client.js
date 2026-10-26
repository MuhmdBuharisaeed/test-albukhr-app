/* ALBUKHR TESTNET STAKING PAYMENT CLIENT v1
 * Testnet only. Pi access tokens remain in memory; no LocalStorage/sessionStorage.
 */
(function (window) {
  "use strict";

  var API_BASE = "https://test-albukhr-api.onrender.com";
  var HOST = "test.albukhr.com";
  var NETWORK = "testnet";
  var PI_SDK_VERSION = "2.0";
  var PI_SANDBOX = true;
  var initialized = false;
  var initPromise = null;
  var authPromise = null;
  var authResult = null;
  var incompletePayments = [];
  var recoverySummary = [];
  // Staking intent is memory-only; payment attempts are never stored locally.
  var pendingIntent = null;

  function clean(value) { return String(value == null ? "" : value).trim(); }
  function dispatch(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch (_) {}
  }

  function validateEnvironment() {
    var env = window.ALBukhrEnvironment;
    if (!env || typeof env.isKnown !== "function" ||
        typeof env.isTestnet !== "function" ||
        typeof env.getNetwork !== "function") {
      throw new Error("TESTNET_ENVIRONMENT_UNAVAILABLE");
    }
    if (!env.isKnown() || !env.isTestnet() || env.getNetwork() !== NETWORK) {
      throw new Error("INVALID_TESTNET_ENVIRONMENT");
    }
    var hostname = clean(typeof env.getHostname === "function"
      ? env.getHostname() : window.location.hostname).toLowerCase();
    if (hostname !== HOST) throw new Error("STAKING_API_TESTNET_ONLY");
  }

  function getAuth() {
    var auth = window.AlbukhrTestnetAuth;
    if (!auth || typeof auth.requireTestnetAuth !== "function" ||
        typeof auth.getSessionToken !== "function") {
      throw new Error("TESTNET_AUTH_MODULE_UNAVAILABLE");
    }
    return auth;
  }

  async function getTestnetSession() {
    validateEnvironment();
    var auth = getAuth();
    var session = await auth.requireTestnetAuth({ redirectOnFailure: false });
    var token = clean(auth.getSessionToken());
    if (!session || !token) throw new Error("TESTNET_SESSION_REQUIRED");
    return { session: session, token: token };
  }

  async function parseResponse(response) {
    var data = null;
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) {
      var message = clean(data && (data.message || data.error)) ||
        ("TESTNET_STAKING_HTTP_" + response.status);
      var error = new Error(message);
      error.code = clean(data && data.error) || "TESTNET_STAKING_ERROR";
      error.status = response.status;
      error.body = data;
      throw error;
    }
    return data;
  }

  async function request(path, body, requiresPiAuth) {
    validateEnvironment();
    var sessionInfo = await getTestnetSession();
    var headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Testnet-Session": sessionInfo.token
    };
    if (requiresPiAuth) {
      var accessToken = clean(authResult && authResult.accessToken);
      if (!accessToken) throw new Error("PI_AUTH_REQUIRED_BEFORE_STAKING");
      headers.Authorization = "Bearer " + accessToken;
    }
    var response;
    try {
      response = await fetch(API_BASE.replace(/\/+$/, "") + "/staking/" +
        clean(path).replace(/^\/+/, ""), {
          method: "POST", headers: headers, body: JSON.stringify(body || {})
        });
    } catch (cause) {
      var networkError = new Error("TESTNET_STAKING_NETWORK_ERROR");
      networkError.cause = cause;
      throw networkError;
    }
    return parseResponse(response);
  }

  function requirePiSdk() {
    if (!window.Pi || typeof window.Pi.init !== "function" ||
        typeof window.Pi.authenticate !== "function" ||
        typeof window.Pi.createPayment !== "function") {
      throw new Error("PI_SDK_UNAVAILABLE");
    }
    return window.Pi;
  }

  async function initializePiSdk() {
    if (initialized) return requirePiSdk();
    if (initPromise) return initPromise;
    var pi = requirePiSdk();
    initPromise = Promise.resolve().then(function () {
      return pi.init({ version: PI_SDK_VERSION, sandbox: PI_SANDBOX });
    }).then(function () {
      initialized = true;
      return pi;
    }).catch(function (error) {
      initPromise = null;
      initialized = false;
      throw error;
    });
    return initPromise;
  }

  function incompleteIdentifier(payment) {
    return clean(payment && (payment.identifier || payment.id));
  }

  async function recoverOne(payment) {
    var id = incompleteIdentifier(payment);
    if (!id) return { payment_id: null, outcome: "unknown_payment_id" };
    var metadata = payment && payment.metadata && typeof payment.metadata === "object" ? payment.metadata : {};
    if (clean(metadata.network).toLowerCase() !== NETWORK || clean(metadata.action) !== "stake") {
      return { payment_id: id, outcome: "unrelated_payment_skipped" };
    }
    try {
      return Object.assign({ payment_id: id }, await request("reconcile", { paymentId: id }, true));
    } catch (error) {
      return { payment_id: id, outcome: "reconciliation_required", error: clean(error && error.message) };
    }
  }

  async function reconcilePending() {
    var unresolved = recoverySummary.filter(function (item) {
      return item && item.payment_id && ["finalized", "cancelled", "unrelated_payment_skipped"].indexOf(clean(item.outcome)) === -1;
    });
    for (var i = 0; i < unresolved.length; i += 1) {
      var result = await recoverOne({ identifier: unresolved[i].payment_id, metadata: { network: NETWORK, action: "stake" } });
      recoverySummary = recoverySummary.map(function (item) {
        return item && item.payment_id === unresolved[i].payment_id ? result : item;
      });
    }
    return recoverySummary.slice();
  }

  async function authenticate() {
    if (authResult && clean(authResult.accessToken) && authResult.user && clean(authResult.user.uid)) {
      return { user: authResult.user, recovery: recoverySummary.slice() };
    }
    if (authPromise) return authPromise;
    authPromise = (async function () {
      await getTestnetSession();
      var pi = await initializePiSdk();
      incompletePayments = [];
      var result = await pi.authenticate(["username", "payments"], function onIncompletePaymentFound(payment) {
        if (payment) incompletePayments.push(payment);
      });
      if (!result || !clean(result.accessToken) || !result.user || !clean(result.user.uid)) {
        throw new Error("PI_AUTH_RESULT_INVALID");
      }
      authResult = {
        accessToken: result.accessToken,
        user: { uid: clean(result.user.uid), username: clean(result.user.username) || null }
      };
      // Reconcile unfinished Pi payments before allowing another stake.
      recoverySummary = [];
      for (var i = 0; i < incompletePayments.length; i += 1) {
        recoverySummary.push(await recoverOne(incompletePayments[i]));
      }
      incompletePayments = [];
      var unresolved = recoverySummary.some(function (item) {
        return !item || ["finalized", "cancelled", "unrelated_payment_skipped"].indexOf(clean(item.outcome)) === -1;
      });
      dispatch("albukhr:testnet-staking-authenticated", {
        username: authResult.user.username,
        unresolved_payment: unresolved,
        recovery: recoverySummary.slice()
      });
      return { user: authResult.user, recovery: recoverySummary.slice() };
    })();
    try { return await authPromise; }
    finally { authPromise = null; }
  }

  async function getOffers(project) {
    var safeProject = project || {};
    if (!clean(safeProject.id) || !clean(safeProject.project_code)) {
      throw new Error("PROJECT_ID_AND_CODE_REQUIRED");
    }
    return request("offers", {
      projectId: clean(safeProject.id),
      projectCode: clean(safeProject.project_code)
    }, false);
  }

  async function prepareStake(project, amount, durationDays) {
    var safeProject = project || {};
    var value = Number(amount);
    var days = Number(durationDays);
    if (!clean(safeProject.id) || !clean(safeProject.project_code)) throw new Error("PROJECT_ID_AND_CODE_REQUIRED");
    if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(days) || days <= 0) throw new Error("INVALID_STAKE_INPUT");
    if (pendingIntent) throw new Error("STAKE_INTENT_ALREADY_PENDING");

    await authenticate();
    await reconcilePending();
    var unresolved = recoverySummary.some(function (item) {
      return !item || ["finalized", "cancelled", "unrelated_payment_skipped"].indexOf(clean(item.outcome)) === -1;
    });
    if (unresolved) throw new Error("INCOMPLETE_PI_PAYMENT_RECONCILIATION_REQUIRED");

    var intentResponse = await request("intent", {
      projectId: clean(safeProject.id),
      projectCode: clean(safeProject.project_code),
      amount: value,
      durationDays: days
    }, true);
    if (!intentResponse || !intentResponse.success || !intentResponse.intent || !intentResponse.intent.id) {
      throw new Error("STAKE_INTENT_CREATE_FAILED");
    }
    pendingIntent = {
      id: clean(intentResponse.intent.id),
      project: { id: clean(safeProject.id), project_code: clean(safeProject.project_code), name: clean(safeProject.name) },
      amount: value,
      durationDays: days,
      rewardRate: Number(intentResponse.intent.reward_rate),
      rewardAmount: Number(intentResponse.intent.reward_amount),
      paymentArmed: false,
      paymentLaunched: false
    };
    return {
      success: true, network: NETWORK,
      intent: {
        id: pendingIntent.id,
        amount: pendingIntent.amount,
        duration_days: pendingIntent.durationDays,
        reward_rate: pendingIntent.rewardRate,
        reward_amount: pendingIntent.rewardAmount,
        expires_at: intentResponse.intent.expires_at
      }
    };
  }

  async function armPreparedStake() {
    if (!pendingIntent) throw new Error("STAKE_INTENT_NOT_FOUND");
    if (pendingIntent.paymentArmed) return { success: true, network: NETWORK, payment_armed: true, intent_id: pendingIntent.id };
    var result = await request("arm", { intentId: pendingIntent.id }, true);
    if (!result || !result.success || result.payment_armed !== true) {
      throw new Error("STAKE_INTENT_BIND_FAILED");
    }
    // Once armed, the server will not release the reserve without authoritative
    // Pi cancellation/reconciliation. This avoids a cancel-vs-payment race.
    pendingIntent.paymentArmed = true;
    return result;
  }

  // Must be called directly inside a separate user click/tap. There is no
  // await, fetch, or authentication step before Pi.createPayment().
  function payPreparedStake() {
    if (!pendingIntent) throw new Error("STAKE_INTENT_NOT_FOUND");
    if (!pendingIntent.paymentArmed) throw new Error("STAKE_INTENT_PAYMENT_NOT_ARMED");
    if (!authResult || !clean(authResult.accessToken)) throw new Error("PI_AUTH_REQUIRED_BEFORE_STAKING");
    var intent = pendingIntent;
    var pi = requirePiSdk();
    intent.paymentLaunched = true;

    return new Promise(function (resolve, reject) {
      var settled = false;
      function finish(error, result) {
        if (settled) return;
        settled = true;
        if (error) reject(error); else resolve(result);
      }

      try {
        // Important: this call is synchronous with the user's click.
        pi.createPayment({
          amount: intent.amount,
          memo: "ALBUKHR Testnet stake • " + intent.project.project_code + " • " + intent.durationDays + " days",
          metadata: {
            network: NETWORK,
            action: "stake",
            project_id: intent.project.id,
            project_code: intent.project.project_code,
            duration_days: intent.durationDays,
            stake_intent_id: intent.id
          }
        }, {
          onReadyForServerApproval: async function (paymentId) {
            try {
              await request("approve", { paymentId: clean(paymentId), intentId: intent.id }, true);
            } catch (error) {
              dispatch("albukhr:testnet-staking-error", { stage: "approval", error: clean(error && error.message), paymentId: clean(paymentId) });
              finish(error instanceof Error ? error : new Error("PI_PAYMENT_APPROVAL_FAILED"));
              throw error;
            }
          },
          onReadyForServerCompletion: async function (paymentId, txid) {
            try {
              var result = await request("complete", {
                paymentId: clean(paymentId), intentId: intent.id, txid: clean(txid)
              }, true);
              pendingIntent = null;
              dispatch("albukhr:testnet-stake-created", result);
              finish(null, result);
              return result;
            } catch (error) {
              dispatch("albukhr:testnet-staking-error", { stage: "completion", error: clean(error && error.message), paymentId: clean(paymentId), txid: clean(txid) });
              // Keep the intent reserved until official reconciliation resolves it.
              finish(error instanceof Error ? error : new Error("STAKE_INTENT_FINALIZATION_FAILED"));
              throw error;
            }
          },
          onCancel: async function (paymentId) {
            try {
              await request("cancel", { intentId: intent.id, paymentId: clean(paymentId) }, true);
              pendingIntent = null;
              finish(new Error("PI_PAYMENT_CANCELLED"));
            } catch (error) {
              finish(new Error("PI_PAYMENT_CANCELLED_RECONCILIATION_REQUIRED"));
            }
          },
          onError: async function (error, payment) {
            var identifier = incompleteIdentifier(payment);
            dispatch("albukhr:testnet-staking-error", {
              stage: "pi_sdk", error: clean(error && error.message) || "PI_PAYMENT_ERROR", paymentId: identifier
            });
            if (identifier) {
              try {
                var recovery = await request("reconcile", { paymentId: identifier, intentId: intent.id }, true);
                if (recovery && ["finalized", "cancelled"].indexOf(clean(recovery.outcome)) !== -1) {
                  pendingIntent = null;
                }
              } catch (_) {
                // Keep the reserve locked; a generic SDK error is not proof of cancellation.
              }
              finish(new Error("PI_PAYMENT_RECONCILIATION_REQUIRED"));
            } else {
              finish(new Error("PI_PAYMENT_RECONCILIATION_REQUIRED"));
            }
          }
        });
      } catch (error) {
        // Keep the intent/reserve locked even if the SDK throws synchronously.
        // Only an authenticated backend reconciliation may free an armed reserve.
        finish(error instanceof Error ? error : new Error("PI_PAYMENT_ERROR"));
      }
    });
  }

  async function cancelPreparedStake() {
    if (!pendingIntent) return { success: true, network: NETWORK, cancelled: false };
    if (pendingIntent.paymentArmed || pendingIntent.paymentLaunched) {
      throw new Error("PI_PAYMENT_RECONCILIATION_REQUIRED");
    }
    var result = await request("cancel", { intentId: pendingIntent.id }, true);
    if (!result || !result.success || result.status !== "cancelled") {
      throw new Error("STAKE_INTENT_CANCEL_FAILED");
    }
    pendingIntent = null;
    return result;
  }

  function getPendingIntent() {
    if (!pendingIntent) return null;
    return {
      id: pendingIntent.id,
      amount: pendingIntent.amount,
      duration_days: pendingIntent.durationDays,
      reward_amount: pendingIntent.rewardAmount,
      payment_armed: pendingIntent.paymentArmed,
      payment_launched: pendingIntent.paymentLaunched
    };
  }

  window.AlbukhrTestnetStakingPayment = Object.freeze({
    network: NETWORK,
    host: HOST,
    authenticate: authenticate,
    getOffers: getOffers,
    prepareStake: prepareStake,
    armPreparedStake: armPreparedStake,
    payPreparedStake: payPreparedStake,
    cancelPreparedStake: cancelPreparedStake,
    getPendingIntent: getPendingIntent,
    reconcile: function (paymentId) { return request("reconcile", { paymentId: clean(paymentId) }, true); }
  });
})(window);
