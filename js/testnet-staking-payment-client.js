/* ALBUKHR TESTNET STAKING PAYMENT CLIENT v2
 * Testnet only. Pi access tokens and pending intent state remain in memory.
 * No LocalStorage/sessionStorage is used.
 *
 * Recovery contract:
 * - GET-equivalent read is performed through POST /staking/pending, bound to
 *   the authenticated ALBUKHR Testnet session and the selected project.
 * - A recovered armed intent is treated as a possibly launched Pi payment.
 *   It must never launch a second Pi.createPayment() after a page reload.
 * - Unarmed reservations may be safely cancelled after Pi authentication and
 *   incomplete-payment reconciliation.
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

  // Deliberately memory-only. The backend is the source of truth after reload.
  var pendingIntent = null;

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch (_) {
      // Dispatching a UI event must never interrupt payment verification.
    }
  }

  function validateEnvironment() {
    var env = window.ALBukhrEnvironment;

    if (!env ||
        typeof env.isKnown !== "function" ||
        typeof env.isTestnet !== "function" ||
        typeof env.getNetwork !== "function") {
      throw new Error("TESTNET_ENVIRONMENT_UNAVAILABLE");
    }

    if (!env.isKnown() || !env.isTestnet() || env.getNetwork() !== NETWORK) {
      throw new Error("INVALID_TESTNET_ENVIRONMENT");
    }

    var hostname = clean(
      typeof env.getHostname === "function"
        ? env.getHostname()
        : (window.location && window.location.hostname)
    ).toLowerCase();

    if (hostname !== HOST) {
      throw new Error("STAKING_API_TESTNET_ONLY");
    }
  }

  function getAuth() {
    var auth = window.AlbukhrTestnetAuth;

    if (!auth ||
        typeof auth.requireTestnetAuth !== "function" ||
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

    if (!session || !token) {
      throw new Error("TESTNET_SESSION_REQUIRED");
    }

    return { session: session, token: token };
  }

  async function parseResponse(response) {
    var data = null;

    try {
      data = await response.json();
    } catch (_) {
      // The status code below remains the authoritative failure signal.
    }

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

      if (!accessToken) {
        throw new Error("PI_AUTH_REQUIRED_BEFORE_STAKING");
      }

      headers.Authorization = "Bearer " + accessToken;
    }

    var response;

    try {
      response = await fetch(
        API_BASE.replace(/\/+$/, "") + "/staking/" +
          clean(path).replace(/^\/+/, ""),
        {
          method: "POST",
          headers: headers,
          body: JSON.stringify(body || {})
        }
      );
    } catch (cause) {
      var networkError = new Error("TESTNET_STAKING_NETWORK_ERROR");
      networkError.cause = cause;
      throw networkError;
    }

    return parseResponse(response);
  }

  function requirePiSdk() {
    if (!window.Pi ||
        typeof window.Pi.init !== "function" ||
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

    initPromise = Promise.resolve()
      .then(function () {
        return pi.init({
          version: PI_SDK_VERSION,
          sandbox: PI_SANDBOX
        });
      })
      .then(function () {
        initialized = true;
        return pi;
      })
      .catch(function (error) {
        initPromise = null;
        initialized = false;
        throw error;
      });

    return initPromise;
  }

  function incompleteIdentifier(payment) {
    return clean(payment && (payment.identifier || payment.id));
  }

  function isResolvedOutcome(outcome) {
    return [
      "finalized",
      "cancelled",
      "unrelated_payment_skipped"
    ].indexOf(clean(outcome)) !== -1;
  }

  function hasUnresolvedRecovery() {
    return recoverySummary.some(function (item) {
      return !item || !isResolvedOutcome(item.outcome);
    });
  }

  async function recoverOne(payment) {
    var id = incompleteIdentifier(payment);

    if (!id) {
      return {
        payment_id: null,
        outcome: "unknown_payment_id"
      };
    }

    var metadata = payment &&
      payment.metadata &&
      typeof payment.metadata === "object"
        ? payment.metadata
        : {};

    if (clean(metadata.network).toLowerCase() !== NETWORK ||
        clean(metadata.action) !== "stake") {
      return {
        payment_id: id,
        outcome: "unrelated_payment_skipped"
      };
    }

    try {
      return Object.assign(
        { payment_id: id },
        await request("reconcile", { paymentId: id }, true)
      );
    } catch (error) {
      return {
        payment_id: id,
        outcome: "reconciliation_required",
        error: clean(error && error.message)
      };
    }
  }

  async function reconcilePending() {
    var unresolved = recoverySummary.filter(function (item) {
      return item &&
        item.payment_id &&
        !isResolvedOutcome(item.outcome);
    });

    for (var i = 0; i < unresolved.length; i += 1) {
      var paymentId = unresolved[i].payment_id;
      var result = await recoverOne({
        identifier: paymentId,
        metadata: {
          network: NETWORK,
          action: "stake"
        }
      });

      recoverySummary = recoverySummary.map(function (item) {
        return item && item.payment_id === paymentId ? result : item;
      });
    }

    return recoverySummary.slice();
  }

  async function authenticate() {
    if (authResult &&
        clean(authResult.accessToken) &&
        authResult.user &&
        clean(authResult.user.uid)) {
      return {
        user: authResult.user,
        recovery: recoverySummary.slice()
      };
    }

    if (authPromise) return authPromise;

    authPromise = (async function () {
      await getTestnetSession();

      var pi = await initializePiSdk();
      incompletePayments = [];

      var result = await pi.authenticate(
        ["username", "payments"],
        function onIncompletePaymentFound(payment) {
          if (payment) incompletePayments.push(payment);
        }
      );

      if (!result ||
          !clean(result.accessToken) ||
          !result.user ||
          !clean(result.user.uid)) {
        throw new Error("PI_AUTH_RESULT_INVALID");
      }

      authResult = {
        accessToken: result.accessToken,
        user: {
          uid: clean(result.user.uid),
          username: clean(result.user.username) || null
        }
      };

      // Reconcile every Pi incomplete payment before another stake is allowed.
      recoverySummary = [];

      for (var i = 0; i < incompletePayments.length; i += 1) {
        recoverySummary.push(await recoverOne(incompletePayments[i]));
      }

      incompletePayments = [];

      var unresolved = hasUnresolvedRecovery();

      dispatch("albukhr:testnet-staking-authenticated", {
        username: authResult.user.username,
        unresolved_payment: unresolved,
        recovery: recoverySummary.slice()
      });

      return {
        user: authResult.user,
        recovery: recoverySummary.slice()
      };
    })();

    try {
      return await authPromise;
    } finally {
      authPromise = null;
    }
  }

  function sameProject(intent, project) {
    if (!intent || !intent.project || !project) return false;

    return clean(intent.project.id) === clean(project.id) &&
      clean(intent.project.project_code) === clean(project.project_code);
  }

  function intentExpired(intent) {
    if (!intent || !intent.expiresAt) return false;

    var expiry = new Date(intent.expiresAt).getTime();
    return Number.isFinite(expiry) && expiry <= Date.now();
  }

  function makePendingIntent(row, project, recovered) {
    var paymentArmed = row.payment_armed === true;
    var paymentId = clean(row.payment_id) || null;

    return {
      id: clean(row.id),
      project: {
        id: clean(project.id),
        project_code: clean(project.project_code),
        name: clean(project.name)
      },
      amount: Number(row.amount),
      durationDays: Number(row.duration_days),
      rewardRate: Number(row.reward_rate),
      rewardAmount: Number(row.reward_amount),
      paymentId: paymentId,
      status: clean(row.status) || "pending_payment",
      expiresAt: row.expires_at || null,
      paymentStartedAt: row.payment_started_at || null,
      paymentArmed: paymentArmed,
      // An armed intent found after reload is ambiguous: Pi may already have
      // opened before the old page disappeared. Never launch a second payment.
      paymentLaunched: paymentArmed || !!paymentId,
      recovered: recovered === true
    };
  }

  async function restorePendingStake(project) {
    var safeProject = project || {};

    if (!clean(safeProject.id) || !clean(safeProject.project_code)) {
      throw new Error("PROJECT_ID_AND_CODE_REQUIRED");
    }

    // Do not replace an in-memory reservation belonging to another project.
    if (pendingIntent && !sameProject(pendingIntent, safeProject)) {
      throw new Error("STAKE_INTENT_ALREADY_PENDING");
    }

    var response = await request("pending", {
      projectId: clean(safeProject.id),
      projectCode: clean(safeProject.project_code)
    }, false);

    if (!response ||
        response.success !== true ||
        clean(response.network).toLowerCase() !== NETWORK) {
      throw new Error("STAKE_INTENT_RECOVERY_READ_FAILED");
    }

    var row = response.intent || null;

    if (!row) {
      // Clear only an in-memory intent for this exact project. Never clear a
      // reservation belonging to a different project.
      if (pendingIntent && sameProject(pendingIntent, safeProject)) {
        pendingIntent = null;
      }
      return null;
    }

    if (!clean(row.id) ||
        clean(row.project_id) !== clean(safeProject.id) ||
        clean(row.project_code) !== clean(safeProject.project_code) ||
        clean(row.status) !== "pending_payment" ||
        !Number.isFinite(Number(row.amount)) ||
        Number(row.amount) <= 0 ||
        !Number.isInteger(Number(row.duration_days)) ||
        Number(row.duration_days) <= 0) {
      throw new Error("STAKE_INTENT_RECOVERY_READ_FAILED");
    }

    if (pendingIntent &&
        sameProject(pendingIntent, safeProject) &&
        clean(pendingIntent.id) !== clean(row.id)) {
      throw new Error("STAKE_INTENT_RECOVERY_CONFLICT");
    }

    pendingIntent = makePendingIntent(row, safeProject, true);

    dispatch("albukhr:testnet-stake-intent-restored", {
      intent_id: pendingIntent.id,
      project_id: pendingIntent.project.id,
      project_code: pendingIntent.project.project_code,
      payment_armed: pendingIntent.paymentArmed,
      payment_launched: pendingIntent.paymentLaunched,
      recovered: true
    });

    return getPendingIntent();
  }

  async function getOffers(project) {
    var safeProject = project || {};

    if (!clean(safeProject.id) || !clean(safeProject.project_code)) {
      throw new Error("PROJECT_ID_AND_CODE_REQUIRED");
    }

    // Restore first so the UI cannot present a new reservation after reload.
    await restorePendingStake(safeProject);

    return request("offers", {
      projectId: clean(safeProject.id),
      projectCode: clean(safeProject.project_code)
    }, false);
  }

  async function prepareStake(project, amount, durationDays) {
    var safeProject = project || {};
    var value = Number(amount);
    var days = Number(durationDays);

    if (!clean(safeProject.id) || !clean(safeProject.project_code)) {
      throw new Error("PROJECT_ID_AND_CODE_REQUIRED");
    }

    if (!Number.isFinite(value) || value <= 0 ||
        !Number.isInteger(days) || days <= 0) {
      throw new Error("INVALID_STAKE_INPUT");
    }

    // Re-query the backend before creating anything. This catches a pending
    // intent that survived refresh or a prior session on another device.
    await restorePendingStake(safeProject);

    if (pendingIntent) {
      throw new Error("STAKE_INTENT_ALREADY_PENDING");
    }

    await authenticate();
    await reconcilePending();

    if (hasUnresolvedRecovery()) {
      throw new Error("INCOMPLETE_PI_PAYMENT_RECONCILIATION_REQUIRED");
    }

    var intentResponse = await request("intent", {
      projectId: clean(safeProject.id),
      projectCode: clean(safeProject.project_code),
      amount: value,
      durationDays: days
    }, true);

    if (!intentResponse ||
        !intentResponse.success ||
        !intentResponse.intent ||
        !intentResponse.intent.id) {
      throw new Error("STAKE_INTENT_CREATE_FAILED");
    }

    pendingIntent = {
      id: clean(intentResponse.intent.id),
      project: {
        id: clean(safeProject.id),
        project_code: clean(safeProject.project_code),
        name: clean(safeProject.name)
      },
      amount: value,
      durationDays: days,
      rewardRate: Number(intentResponse.intent.reward_rate),
      rewardAmount: Number(intentResponse.intent.reward_amount),
      paymentId: null,
      status: clean(intentResponse.intent.status) || "pending_payment",
      expiresAt: intentResponse.intent.expires_at || null,
      paymentStartedAt: null,
      paymentArmed: false,
      paymentLaunched: false,
      recovered: false
    };

    return {
      success: true,
      network: NETWORK,
      intent: {
        id: pendingIntent.id,
        amount: pendingIntent.amount,
        duration_days: pendingIntent.durationDays,
        reward_rate: pendingIntent.rewardRate,
        reward_amount: pendingIntent.rewardAmount,
        expires_at: pendingIntent.expiresAt
      }
    };
  }

  async function armPreparedStake() {
    if (!pendingIntent) {
      throw new Error("STAKE_INTENT_NOT_FOUND");
    }

    if (pendingIntent.paymentLaunched || pendingIntent.paymentId) {
      throw new Error("PI_PAYMENT_RECONCILIATION_REQUIRED");
    }

    if (intentExpired(pendingIntent)) {
      throw new Error("STAKE_INTENT_EXPIRED");
    }

    if (pendingIntent.paymentArmed) {
      return {
        success: true,
        network: NETWORK,
        payment_armed: true,
        intent_id: pendingIntent.id
      };
    }

    var result = await request("arm", {
      intentId: pendingIntent.id
    }, true);

    if (!result || !result.success || result.payment_armed !== true) {
      throw new Error("STAKE_INTENT_BIND_FAILED");
    }

    // From this point the backend refuses to release the reserve without
    // authoritative Pi cancellation/reconciliation.
    pendingIntent.paymentArmed = true;
    pendingIntent.paymentStartedAt = new Date().toISOString();

    return result;
  }

  // Must be invoked directly inside a separate user click/tap. There is no
  // await, fetch, or authentication step before Pi.createPayment().
  function payPreparedStake() {
    if (!pendingIntent) {
      throw new Error("STAKE_INTENT_NOT_FOUND");
    }

    if (!pendingIntent.paymentArmed) {
      throw new Error("STAKE_INTENT_PAYMENT_NOT_ARMED");
    }

    if (pendingIntent.paymentLaunched || pendingIntent.paymentId) {
      throw new Error("PI_PAYMENT_RECONCILIATION_REQUIRED");
    }

    if (intentExpired(pendingIntent)) {
      throw new Error("STAKE_INTENT_EXPIRED");
    }

    if (!authResult || !clean(authResult.accessToken)) {
      throw new Error("PI_AUTH_REQUIRED_BEFORE_STAKING");
    }

    var intent = pendingIntent;
    var pi = requirePiSdk();

    // Set before SDK invocation. Even a synchronous SDK exception is ambiguous
    // and must not enable a second payment attempt against the same reserve.
    intent.paymentLaunched = true;

    return new Promise(function (resolve, reject) {
      var settled = false;

      function finish(error, result) {
        if (settled) return;
        settled = true;
        if (error) reject(error);
        else resolve(result);
      }

      try {
        // This call remains synchronous with the user's fresh click.
        pi.createPayment({
          amount: intent.amount,
          memo: "ALBUKHR Testnet stake • " +
            intent.project.project_code +
            " • " + intent.durationDays + " days",
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
              await request("approve", {
                paymentId: clean(paymentId),
                intentId: intent.id
              }, true);

              intent.paymentId = clean(paymentId) || intent.paymentId;
            } catch (error) {
              dispatch("albukhr:testnet-staking-error", {
                stage: "approval",
                error: clean(error && error.message),
                paymentId: clean(paymentId)
              });

              finish(
                error instanceof Error
                  ? error
                  : new Error("PI_PAYMENT_APPROVAL_FAILED")
              );
              throw error;
            }
          },

          onReadyForServerCompletion: async function (paymentId, txid) {
            try {
              var result = await request("complete", {
                paymentId: clean(paymentId),
                intentId: intent.id,
                txid: clean(txid)
              }, true);

              pendingIntent = null;
              dispatch("albukhr:testnet-stake-created", result);
              finish(null, result);
              return result;
            } catch (error) {
              dispatch("albukhr:testnet-staking-error", {
                stage: "completion",
                error: clean(error && error.message),
                paymentId: clean(paymentId),
                txid: clean(txid)
              });

              // Keep the reserve locked until official reconciliation resolves it.
              finish(
                error instanceof Error
                  ? error
                  : new Error("STAKE_INTENT_FINALIZATION_FAILED")
              );
              throw error;
            }
          },

          onCancel: async function (paymentId) {
            try {
              var result = await request("cancel", {
                intentId: intent.id,
                paymentId: clean(paymentId)
              }, true);

              if (!result ||
                  result.success !== true ||
                  clean(result.status) !== "cancelled") {
                throw new Error("STAKE_INTENT_CANCEL_FAILED");
              }

              pendingIntent = null;
              finish(new Error("PI_PAYMENT_CANCELLED"));
            } catch (error) {
              finish(new Error("PI_PAYMENT_CANCELLED_RECONCILIATION_REQUIRED"));
            }
          },

          onError: async function (error, payment) {
            var identifier = incompleteIdentifier(payment);

            dispatch("albukhr:testnet-staking-error", {
              stage: "pi_sdk",
              error: clean(error && error.message) || "PI_PAYMENT_ERROR",
              paymentId: identifier
            });

            if (identifier) {
              try {
                var recovery = await request("reconcile", {
                  paymentId: identifier,
                  intentId: intent.id
                }, true);

                if (recovery &&
                    ["finalized", "cancelled"].indexOf(
                      clean(recovery.outcome)
                    ) !== -1) {
                  pendingIntent = null;
                }
              } catch (_) {
                // An SDK error is not proof of cancellation; retain the reserve.
              }
            }

            finish(new Error("PI_PAYMENT_RECONCILIATION_REQUIRED"));
          }
        });
      } catch (error) {
        // Do not unlock the intent after an uncertain Pi SDK failure.
        finish(
          error instanceof Error
            ? error
            : new Error("PI_PAYMENT_ERROR")
        );
      }
    });
  }

  async function cancelPreparedStake() {
    if (!pendingIntent) {
      return {
        success: true,
        network: NETWORK,
        cancelled: false
      };
    }

    if (pendingIntent.paymentArmed ||
        pendingIntent.paymentLaunched ||
        pendingIntent.paymentId) {
      throw new Error("PI_PAYMENT_RECONCILIATION_REQUIRED");
    }

    // The API cancellation endpoint verifies both the Testnet session and Pi UID.
    await authenticate();
    await reconcilePending();

    if (hasUnresolvedRecovery()) {
      throw new Error("INCOMPLETE_PI_PAYMENT_RECONCILIATION_REQUIRED");
    }

    // Recheck after awaited auth/reconciliation in case another callback changed it.
    if (!pendingIntent) {
      return {
        success: true,
        network: NETWORK,
        cancelled: false
      };
    }

    if (pendingIntent.paymentArmed ||
        pendingIntent.paymentLaunched ||
        pendingIntent.paymentId) {
      throw new Error("PI_PAYMENT_RECONCILIATION_REQUIRED");
    }

    var result = await request("cancel", {
      intentId: pendingIntent.id
    }, true);

    var status = clean(result && result.status);

    if (!result ||
        result.success !== true ||
        ["cancelled", "expired"].indexOf(status) === -1) {
      throw new Error("STAKE_INTENT_CANCEL_FAILED");
    }

    pendingIntent = null;
    return result;
  }

  function getPendingIntent() {
    if (!pendingIntent) return null;

    return {
      id: pendingIntent.id,
      project_id: pendingIntent.project.id,
      project_code: pendingIntent.project.project_code,
      amount: pendingIntent.amount,
      duration_days: pendingIntent.durationDays,
      reward_rate: pendingIntent.rewardRate,
      reward_amount: pendingIntent.rewardAmount,
      payment_id: pendingIntent.paymentId || null,
      status: pendingIntent.status,
      expires_at: pendingIntent.expiresAt,
      payment_started_at: pendingIntent.paymentStartedAt,
      payment_armed: pendingIntent.paymentArmed,
      payment_launched: pendingIntent.paymentLaunched,
      recovered: pendingIntent.recovered === true,
      expired: intentExpired(pendingIntent)
    };
  }

  window.AlbukhrTestnetStakingPayment = Object.freeze({
    network: NETWORK,
    host: HOST,
    authenticate: authenticate,
    getOffers: getOffers,
    restorePendingStake: restorePendingStake,
    prepareStake: prepareStake,
    armPreparedStake: armPreparedStake,
    payPreparedStake: payPreparedStake,
    cancelPreparedStake: cancelPreparedStake,
    getPendingIntent: getPendingIntent,

    
    reconcile: async function (paymentId) {
      var id = clean(paymentId);

      if (!id) {
        throw new Error("PI_PAYMENT_NOT_FOUND");
      }

      // Ensure the Testnet session and official Pi identity
      // are authenticated before contacting the reconciliation API.
      await authenticate();

      // Pi.authenticate() may already have discovered and reconciled
      // this payment through onIncompletePaymentFound.
      var priorRecovery = recoverySummary.find(function (item) {
        return item &&
          clean(item.payment_id) === id &&
          ["finalized", "cancelled"].indexOf(
            clean(item.outcome)
          ) !== -1;
      });

      if (priorRecovery) {
        if (
          pendingIntent &&
          clean(pendingIntent.paymentId) === id
        ) {
          pendingIntent = null;
        }

        return priorRecovery;
      }

      // Retry the existing payment ID only.
      // This does not create or launch another Pi payment.
      var result = await request(
        "reconcile",
        {
          paymentId: id
        },
        true
      );

      var normalized = Object.assign(
        {
          payment_id: id
        },
        result || {}
      );

      var matched = false;

      recoverySummary = recoverySummary.map(function (item) {
        if (item && clean(item.payment_id) === id) {
          matched = true;
          return normalized;
        }

        return item;
      });

      if (!matched) {
        recoverySummary.push(normalized);
      }

      // Clear the in-memory reservation only after the API
      // confirms that the original payment was finalized or cancelled.
      if (
        ["finalized", "cancelled"].indexOf(
          clean(normalized.outcome)
        ) !== -1 &&
        pendingIntent &&
        clean(pendingIntent.paymentId) === id
      ) {
        pendingIntent = null;
      }

      return normalized;
    }
  });
})(window);
