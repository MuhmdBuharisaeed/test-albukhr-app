/* =========================================================
   ALBUKHR TESTNET LIQUIDITY PAYMENT CLIENT v4
   =========================================================

   SECURITY MODEL
   --------------
   1. Testnet session authorizes ALBUKHR access.
   2. Pi.authenticate() verifies Pi identity.
   3. Pi access token remains memory-only.
   4. Pi.createPayment() is called from the user click path.
   5. Backend receives X-Testnet-Session and Pi Bearer token.

   SECURITY NOTE
   -------------
   This client never persists Pi credentials. Payment is blocked unless
   Testnet session and Pi identity have both been verified.
========================================================= */

(function (window) {
  "use strict";

  /* =======================================================
     CONFIGURATION
  ======================================================= */

  var API_BASE = "https://test-albukhr-api.onrender.com";
  var NETWORK = "testnet";
  var PI_SDK_VERSION = "2.0";

  /*
   * This is the Testnet payment client. Sandbox mode is appropriate only
   * when the corresponding Pi Developer Portal app is configured for
   * Sandbox/Test-Pi. Keep this aligned with that official app configuration.
   */
  var PI_SANDBOX = true;

  /* =======================================================
     INTERNAL STATE
  ======================================================= */

  var initialized = false;
  var initializationPromise = null;

  // Pi access token is kept in memory only.
  var authResult = null;
  var pendingIncompletePayments = [];

  // Prevent duplicate Pi.authenticate() calls.
  var authenticationPromise = null;

  // Share Testnet session validation among concurrent callers.
  var testnetSessionPromise = null;

  /* =======================================================
     TIMEOUT HELPER
  ======================================================= */

  function withAuthTimeout(promise, milliseconds, errorCode) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        reject(new Error(errorCode));
      }, milliseconds);

      Promise.resolve(promise).then(
        function (value) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(value);
        },
        function (error) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(error);
        }
      );
    });
  }

  /* =======================================================
     UTILITY
  ======================================================= */

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  /* =======================================================
     TESTNET AUTH MODULE
  ======================================================= */

  function getAuth() {
    var auth = window.AlbukhrTestnetAuth;

    if (!auth || typeof auth.requireTestnetAuth !== "function") {
      throw new Error("TESTNET_AUTH_MODULE_UNAVAILABLE");
    }

    return auth;
  }

  /* =======================================================
     TESTNET SESSION TOKEN
  ======================================================= */

  function getSessionToken() {
    var auth = getAuth();
    var token = clean(auth.getSessionToken());

    if (!token) {
      throw new Error("TESTNET_SESSION_REQUIRED");
    }

    return token;
  }

  /* =======================================================
     ENVIRONMENT VALIDATION
  ======================================================= */

  function validateEnvironment() {
    var env = window.ALBukhrEnvironment;

    if (
      !env ||
      typeof env.isKnown !== "function" ||
      typeof env.isTestnet !== "function" ||
      typeof env.getNetwork !== "function"
    ) {
      throw new Error("TESTNET_ENVIRONMENT_UNAVAILABLE");
    }

    if (!env.isKnown() || !env.isTestnet() || env.getNetwork() !== NETWORK) {
      throw new Error("INVALID_TESTNET_ENVIRONMENT");
    }

    var hostname = clean(
      typeof env.getHostname === "function"
        ? env.getHostname()
        : window.location.hostname
    ).toLowerCase();

    if (hostname !== "test.albukhr.com") {
      throw new Error("TESTNET_HOST_REQUIRED");
    }
  }

  /* =======================================================
     PI SDK VALIDATION
  ======================================================= */

  function requirePiSdk() {
    if (
      !window.Pi ||
      typeof window.Pi.init !== "function" ||
      typeof window.Pi.authenticate !== "function" ||
      typeof window.Pi.createPayment !== "function"
    ) {
      throw new Error("PI_SDK_UNAVAILABLE");
    }

    return window.Pi;
  }

  /* =======================================================
     EVENT DISPATCH
  ======================================================= */

  function dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch (_) {}
  }

  /* =======================================================
     API REQUEST
  ======================================================= */

  async function apiRequest(path, body, includePiToken) {
    var sessionToken = getSessionToken();

    var headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Testnet-Session": sessionToken
    };

    if (includePiToken) {
      var piToken = clean(authResult && authResult.accessToken);

      if (!piToken) {
        throw new Error("PI_ACCESS_TOKEN_REQUIRED");
      }

      headers.Authorization = "Bearer " + piToken;
    }

    var response = await fetch(
      API_BASE.replace(/\/+$/, "") +
        "/liquidity-payment/" +
        clean(path).replace(/^\/+/, ""),
      {
        method: "POST",
        headers: headers,
        body: JSON.stringify(body || {})
      }
    );

    var data = null;

    try {
      data = await response.json();
    } catch (_) {}

    if (!response.ok) {
      var code =
        clean(data && data.error) ||
        "TESTNET_LIQUIDITY_PAYMENT_ERROR";

      var error = new Error(code);
      error.status = response.status;
      error.body = data;
      throw error;
    }

    return data;
  }

  /* =======================================================
     INCOMPLETE PAYMENT RECOVERY
  ======================================================= */

  async function recoverIncomplete(payment) {
    if (!payment) return null;

    var identifier = clean(payment.identifier || payment.id);
    if (!identifier) return null;

    try {
      var response = await fetch(
        API_BASE.replace(/\/+$/, "") + "/liquidity-payment/incomplete",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            paymentId: identifier,
            identifier: identifier,
            txid: clean(payment.transaction && payment.transaction.txid) || null
          })
        }
      );

      var result = null;
      try {
        result = await response.json();
      } catch (_) {}

      if (!response.ok) {
        var error = new Error(
          clean(result && (result.error || result.message)) ||
            "TESTNET_LIQUIDITY_RECOVERY_FAILED"
        );
        error.status = response.status;
        error.body = result;
        throw error;
      }

      dispatch("albukhr:testnet-liquidity-payment-recovered", result);
      return result;
    } catch (error) {
      console.error("[ALBUKHR TESTNET LIQUIDITY RECOVERY]", error);
      dispatch("albukhr:testnet-liquidity-payment-recovery-error", {
        error: error,
        payment: payment
      });
      throw error;
    }
  }

  /* =======================================================
     PI SDK INITIALIZATION
  ======================================================= */

  function initializePiSdk() {
    dispatch("albukhr:testnet-liquidity-debug", {
      stage: "sdk-init-start",
      message: "Checking Testnet environment and starting Pi SDK…"
    });

    validateEnvironment();

    var pi = requirePiSdk();

    if (initialized) {
      return Promise.resolve(pi);
    }

    if (initializationPromise) {
      return initializationPromise;
    }

    /*
     * IMPORTANT:
     * Timeout the underlying initialization attempt itself. A timeout applied
     * only by authenticate() leaves initializationPromise pending forever and
     * causes every retry to wait on the same stale promise.
     */
    var attemptPromise;
    var initTimer = null;

    attemptPromise = new Promise(function (resolve, reject) {
      var settled = false;

      initTimer = setTimeout(function () {
        if (settled) return;
        settled = true;
        reject(new Error("PI_SDK_INIT_TIMEOUT"));
      }, 10000);

      Promise.resolve()
        .then(function () {
          dispatch("albukhr:testnet-liquidity-debug", {
            stage: "pi-init-call",
            message: "Calling Pi.init(); version=" + PI_SDK_VERSION + ", sandbox=" + PI_SANDBOX + "."
          });
          return pi.init({
            version: PI_SDK_VERSION,
            sandbox: PI_SANDBOX
          });
        })
        .then(
          function () {
            if (settled) return;
            settled = true;
            clearTimeout(initTimer);
            resolve(pi);
          },
          function (error) {
            if (settled) return;
            settled = true;
            clearTimeout(initTimer);
            reject(error);
          }
        );
    });

    initializationPromise = attemptPromise
      .then(function (readyPi) {
        initialized = true;

        dispatch("albukhr:testnet-liquidity-debug", {
          stage: "sdk-init-ok",
          message: "Pi SDK initialization completed."
        });

        dispatch("albukhr:testnet-liquidity-pi-initialized", {
          version: PI_SDK_VERSION,
          sandbox: PI_SANDBOX
        });

        return readyPi;
      })
      .catch(function (error) {
        initialized = false;

        // Clear the cached promise so a later, deliberate retry can try again.
        initializationPromise = null;

        var message = clean(error && error.message) || "PI_INIT_FAILED";

        dispatch("albukhr:testnet-liquidity-debug", {
          stage: "sdk-init-error",
          message: message
        });

        dispatch("albukhr:testnet-liquidity-pi-init-error", {
          message: message
        });

        throw error;
      });

    return initializationPromise;
  }

  /* =======================================================
     PI AUTHENTICATION
  ======================================================= */

  async function authenticate() {
    dispatch("albukhr:testnet-liquidity-debug", { stage: "auth-start", message: "Checking Testnet session and Pi identity…" });
    validateEnvironment();

    // Enforce ALBUKHR's Mainnet-approved Testnet gateway session BEFORE
    // initializing Pi SDK or requesting Pi identity/payment capabilities.
    if (!testnetSessionPromise) {
      testnetSessionPromise = getAuth().requireTestnetAuth({
        redirectOnFailure: false
      });
    }

    var session;
    try {
      session = await withAuthTimeout(
        testnetSessionPromise,
        12000,
        "TESTNET_SESSION_CHECK_TIMEOUT"
      );
    } finally {
      testnetSessionPromise = null;
    }

    if (!session) {
      throw new Error("TESTNET_SESSION_REQUIRED");
    }

    // Only after the Testnet gateway session has passed do we initialize Pi.
    var pi = await withAuthTimeout(
      initializePiSdk(),
      12000,
      "PI_SDK_INIT_TIMEOUT"
    );

    if (authenticationPromise) {
      return authenticationPromise;
    }

    if (
      authResult &&
      clean(authResult.accessToken) &&
      authResult.user &&
      clean(authResult.user.uid)
    ) {
      return { user: authResult.user };
    }

    authenticationPromise = (async function () {
      pendingIncompletePayments = [];

      var result = await withAuthTimeout(
        pi.authenticate(
          ["username", "payments"],
          function onIncompletePaymentFound(payment) {
            if (payment) pendingIncompletePayments.push(payment);
          }
        ),
        20000,
        "PI_AUTHENTICATION_TIMEOUT"
      );

      if (
        !result ||
        !clean(result.accessToken) ||
        !result.user ||
        !clean(result.user.uid)
      ) {
        throw new Error("PI_AUTH_RESULT_INVALID");
      }

      // MEMORY ONLY: never persist this access token.
      authResult = {
        accessToken: result.accessToken,
        user: {
          uid: clean(result.user.uid),
          username: clean(result.user.username) || null
        }
      };

      for (var i = 0; i < pendingIncompletePayments.length; i += 1) {
        try {
          await recoverIncomplete(pendingIncompletePayments[i]);
        } catch (recoveryError) {
          console.error(
            "[ALBUKHR TESTNET INCOMPLETE PAYMENT RECOVERY]",
            recoveryError
          );
        }
      }

      pendingIncompletePayments = [];

      dispatch("albukhr:testnet-liquidity-debug", { stage: "auth-ok", message: "Pi identity authentication completed." });
      dispatch("albukhr:testnet-liquidity-pi-authenticated", {
        username: authResult.user.username,
        uid: authResult.user.uid
      });

      return { user: authResult.user };
    })();

    try {
      return await authenticationPromise;
    } finally {
      authenticationPromise = null;
    }
  }

  /* =======================================================
     CHECK PI AUTHENTICATION STATE
  ======================================================= */

  function isAuthenticated() {
    return !!(
      authResult &&
      clean(authResult.accessToken) &&
      authResult.user &&
      clean(authResult.user.uid)
    );
  }

  /* =======================================================
     GET PI ACCESS TOKEN
     INTERNAL ONLY
  ======================================================= */

  function getPiAccessToken() {
    if (!isAuthenticated()) return "";
    return clean(authResult.accessToken);
  }

  /* =======================================================
     CREATE LIQUIDITY PAYMENT
  ======================================================= */

  async function createLiquidityPayment(project, amount) {
    validateEnvironment();

    var safeProject = project || {};
    var projectId = clean(safeProject.id);
    var projectCode = clean(safeProject.project_code);

    if (!projectId) throw new Error("PROJECT_ID_REQUIRED");
    if (!projectCode) throw new Error("PROJECT_CODE_REQUIRED");

    if (clean(safeProject.network).toLowerCase() !== NETWORK) {
      throw new Error("PROJECT_NETWORK_INVALID");
    }

    var value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error("INVALID_LIQUIDITY_AMOUNT");
    }

    // Do not authenticate inside the click/payment path.
    if (!isAuthenticated()) {
      throw new Error("PI_AUTH_REQUIRED_BEFORE_PAYMENT");
    }

    var pi = requirePiSdk();
    var memo = "ALBUKHR Testnet liquidity • " + projectCode;

    return new Promise(function (resolve, reject) {
      pi.createPayment(
        {
          amount: value,
          memo: memo,
          metadata: {
            network: NETWORK,
            action: "add_liquidity",
            project_id: projectId,
            project_code: projectCode
          }
        },
        {
          onReadyForServerApproval: async function (paymentId) {
            try {
              var approved = await apiRequest(
                "approve",
                {
                  paymentId: paymentId,
                  projectId: projectId,
                  projectCode: projectCode
                },
                true
              );

              dispatch("albukhr:testnet-liquidity-payment-approved", approved);
            } catch (error) {
              console.error("[ALBUKHR TESTNET LIQUIDITY APPROVAL]", error);
              dispatch("albukhr:testnet-liquidity-payment-approval-error", {
                error: error,
                paymentId: paymentId
              });
              reject(error instanceof Error ? error : new Error("PI_PAYMENT_APPROVAL_FAILED"));
            }
          },

          onReadyForServerCompletion: async function (paymentId, txid) {
            try {
              var completed = await apiRequest(
                "complete",
                {
                  paymentId: paymentId,
                  projectId: projectId,
                  projectCode: projectCode,
                  txid: txid
                },
                true
              );

              dispatch("albukhr:testnet-liquidity-payment-completed", completed);
              resolve(completed);
            } catch (error) {
              console.error("[ALBUKHR TESTNET LIQUIDITY COMPLETION]", error);
              dispatch("albukhr:testnet-liquidity-payment-completion-error", {
                error: error,
                paymentId: paymentId,
                txid: txid
              });
              throw error;
            }
          },

          onCancel: function (paymentId) {
            dispatch("albukhr:testnet-liquidity-payment-cancelled", {
              paymentId: paymentId,
              network: NETWORK
            });
            reject(new Error("PI_PAYMENT_CANCELLED"));
          },

          onError: function (error, payment) {
            console.error("[ALBUKHR TESTNET LIQUIDITY PAYMENT]", error, payment || null);
            dispatch("albukhr:testnet-liquidity-payment-error", {
              error: error,
              payment: payment || null
            });
            reject(
              error instanceof Error ? error : new Error("PI_PAYMENT_ERROR")
            );
          }
        }
      );
    });
  }

  /* =======================================================
     CLEAR MEMORY-ONLY PI AUTH
  ======================================================= */

  function clearInMemoryPiAuth() {
    authResult = null;
    pendingIncompletePayments = [];
    authenticationPromise = null;
  }

  /* =======================================================
     PAGE-LOAD PRE-AUTHENTICATION
     authenticate() validates the short-lived Testnet gateway session first,
     then initializes Pi SDK and requests Pi identity.
  ======================================================= */

  /* =======================================================
     PRE-AUTHENTICATION
  ======================================================= */

  authenticate().catch(function (error) {
    console.error("[ALBUKHR TESTNET PI PRE-AUTH]", error);

    dispatch("albukhr:testnet-liquidity-pi-auth-error", {
      message: clean(error && error.message) || "PI_AUTH_FAILED"
    });
  });

  /* =======================================================
     PUBLIC API
  ======================================================= */

  var api = {
    init: initializePiSdk,
    authenticate: authenticate,
    isAuthenticated: isAuthenticated,
    createLiquidityPayment: createLiquidityPayment,
    addLiquidity: createLiquidityPayment,
    recoverIncomplete: recoverIncomplete,
    clearInMemoryPiAuth: clearInMemoryPiAuth,
    network: NETWORK,
    apiBase: API_BASE
  };

  try {
    Object.freeze(api);
  } catch (_) {}

  window.AlbukhrTestnetLiquidityPayment = api;
})(window);
