/* =========================================================
   ALBUKHR TESTNET LIQUIDITY PAYMENT CLIENT v4.1
   =========================================================

   SECURITY MODEL
   --------------
   1. Testnet session authorizes ALBUKHR access.
   2. Pi.authenticate() verifies Pi Sandbox identity.
   3. Pi access token remains memory-only.
   4. Owner Sandbox identity must be server-verified and linked
      before incomplete-payment recovery or new liquidity payments.
   5. Pi.createPayment() remains on the synchronous user-click path:
      the identity check is completed during authentication, not by
      awaiting a network request inside createLiquidityPayment().
   6. Backend receives X-Testnet-Session and Pi Bearer token.

   SECURITY NOTE
   -------------
   This client never persists Pi credentials. Payment is blocked unless
   Testnet session, Pi identity, and Owner Sandbox identity are verified.
========================================================= */

(function (window) {
  "use strict";

  /* =======================================================
     CONFIGURATION
  ======================================================= */

  var API_BASE = "https://test-albukhr-api.onrender.com";
  var NETWORK = "testnet";
  var PI_SDK_VERSION = "2.0";
  var OWNER_IDENTITY_URL =
    "https://vhvkwvngmrlgyzwemttt.supabase.co/functions/v1/testnet-direct-auth";

  /*
   * Keep this aligned with the official Pi Developer Portal app
   * configuration for the Testnet application.
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

  // Share Owner identity verification among concurrent callers.
  var ownerIdentityLinkPromise = null;

  // A successful server response is required before either payment
  // recovery or a new Pi liquidity payment is allowed.
  var ownerIdentityLinked = false;
  var ownerIdentityStatus = "not_checked";
  var ownerIdentityCanonicalUid = "";
  var ownerIdentitySandboxUid = "";

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

    // This function is also exposed through the public API.
    // Enforce the same identity gate here so callers cannot bypass
    // authenticate() and invoke recovery directly.
    if (!isAuthenticated()) {
      throw new Error("PI_AUTH_REQUIRED_BEFORE_RECOVERY");
    }

    if (
      !ownerIdentityLinked ||
      ownerIdentityStatus !== "linked" ||
      ownerIdentitySandboxUid !== clean(authResult.user.uid)
    ) {
      throw new Error("OWNER_IDENTITY_LINK_REQUIRED_BEFORE_RECOVERY");
    }

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
     OWNER SANDBOX IDENTITY LINK
  ======================================================= */

  async function ensureOwnerIdentityLink() {
    validateEnvironment();

    if (!isAuthenticated()) {
      throw new Error("PI_AUTH_REQUIRED_BEFORE_OWNER_LINK");
    }

    if (ownerIdentityLinkPromise) {
      return ownerIdentityLinkPromise;
    }

    ownerIdentityLinkPromise = (async function () {
      var auth = getAuth();

      // Support either a synchronous session getter or a Promise-returning one.
      var canonicalSession = typeof auth.getSession === "function"
        ? await Promise.resolve(auth.getSession())
        : null;

      var canonicalUid = clean(
        canonicalSession && canonicalSession.pi_uid
      );

      var sandboxUid = clean(
        authResult && authResult.user && authResult.user.uid
      );

      var piToken = getPiAccessToken();
      var sessionToken = getSessionToken();

      if (!canonicalUid || !sandboxUid || !piToken || !sessionToken) {
        ownerIdentityLinked = false;
        ownerIdentityStatus = "error";
        throw new Error("OWNER_IDENTITY_CREDENTIALS_INCOMPLETE");
      }

      var response = await fetch(OWNER_IDENTITY_URL, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Authorization": "Bearer " + piToken,
          "X-Testnet-Session": sessionToken
        },
        body: JSON.stringify({
          action: "authenticate",
          purpose: "project_owner"
        })
      });

      var data = null;

      try {
        data = await response.json();
      } catch (_) {}

      if (!response.ok || !data || data.ok !== true) {
        ownerIdentityLinked = false;
        ownerIdentityStatus = "error";

        throw new Error(
          clean(data && data.error) ||
          "OWNER_IDENTITY_LINK_FAILED"
        );
      }

      var status = clean(data.identity_link_status).toLowerCase();

      if (status === "pending") {
        ownerIdentityLinked = false;
        ownerIdentityStatus = "pending";
        ownerIdentityCanonicalUid = canonicalUid;
        ownerIdentitySandboxUid = sandboxUid;

        dispatch("albukhr:testnet-owner-identity-link", {
          status: "pending",
          requestId: clean(data.identity_link_request_id)
        });

        return data;
      }

      if (status === "rejected") {
        ownerIdentityLinked = false;
        ownerIdentityStatus = "rejected";
        ownerIdentityCanonicalUid = canonicalUid;
        ownerIdentitySandboxUid = sandboxUid;

        dispatch("albukhr:testnet-owner-identity-link", {
          status: "rejected"
        });

        return data;
      }

      if (status !== "linked") {
        ownerIdentityLinked = false;
        ownerIdentityStatus = "error";
        throw new Error("OWNER_IDENTITY_LINK_STATUS_INVALID");
      }

      if (
        clean(data.user && data.user.uid) !== canonicalUid ||
        clean(data.user && data.user.testnet_pi_uid) !== sandboxUid
      ) {
        ownerIdentityLinked = false;
        ownerIdentityStatus = "error";
        throw new Error("OWNER_IDENTITY_LINK_RESPONSE_MISMATCH");
      }

      ownerIdentityLinked = true;
      ownerIdentityStatus = "linked";
      ownerIdentityCanonicalUid = canonicalUid;
      ownerIdentitySandboxUid = sandboxUid;

      dispatch("albukhr:testnet-owner-identity-link", {
        status: "linked"
      });

      return data;
    })();

    try {
      return await ownerIdentityLinkPromise;
    } finally {
      ownerIdentityLinkPromise = null;
    }
  }

  /* =======================================================
     PI AUTHENTICATION
  ======================================================= */

  async function authenticate() {
    dispatch("albukhr:testnet-liquidity-debug", {
      stage: "auth-start",
      message: "Checking Testnet session and Pi identity…"
    });

    validateEnvironment();

    // Enforce ALBUKHR's Testnet gateway session before Pi SDK initialization.
    if (!testnetSessionPromise) {
  testnetSessionPromise = getAuth().requireTestnetAuth({
    redirectOnFailure: true
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

    // Initialize Pi only after the Testnet gateway session has passed.
    var pi = await withAuthTimeout(
      initializePiSdk(),
      12000,
      "PI_SDK_INIT_TIMEOUT"
    );

    // Avoid duplicate Pi authentication.
    if (authenticationPromise) {
      return authenticationPromise;
    }

    async function verifyOwnerIdentityAndRecover() {
      var ownerIdentity;

      try {
        ownerIdentity = await ensureOwnerIdentityLink();
      } catch (linkError) {
        ownerIdentityLinked = false;

        console.error(
          "[ALBUKHR TESTNET OWNER IDENTITY]",
          linkError
        );

        dispatch("albukhr:testnet-owner-identity-link-error", {
          message:
            clean(linkError && linkError.message) ||
            "OWNER_IDENTITY_LINK_FAILED"
        });

        dispatch("albukhr:testnet-liquidity-debug", {
          stage: "owner-identity-pending",
          message:
            "Owner Sandbox identity is not verified. Payment and recovery remain locked."
        });

        // Authentication remains available, but payment/recovery do not.
        return {
          linked: false,
          recovered: 0
        };
      }

      var identityStatus = clean(
        ownerIdentity && ownerIdentity.identity_link_status
      ).toLowerCase();

      if (identityStatus !== "linked") {
        dispatch("albukhr:testnet-liquidity-debug", {
          stage: "owner-identity-pending",
          message:
            "Sandbox identity approval is required before payment recovery."
        });

        return {
          linked: false,
          recovered: 0
        };
      }

      var recoveredCount = 0;

      for (
        var i = 0;
        i < pendingIncompletePayments.length;
        i += 1
      ) {
        try {
          await recoverIncomplete(pendingIncompletePayments[i]);
          recoveredCount += 1;
        } catch (recoveryError) {
          console.error(
            "[ALBUKHR TESTNET INCOMPLETE PAYMENT RECOVERY]",
            recoveryError
          );
        }
      }

      // Clear only after the identity gate has passed.
      pendingIncompletePayments = [];

      dispatch("albukhr:testnet-liquidity-debug", {
        stage: "owner-identity-linked",
        message:
          "Owner Sandbox identity verified. Incomplete payment recovery checked.",
        recovered: recoveredCount
      });

      return {
        linked: true,
        recovered: recoveredCount
      };
    }

    // Existing Pi authentication may be reused, but identity verification
    // must still run on every authenticate() call.
    if (
      authResult &&
      clean(authResult.accessToken) &&
      authResult.user &&
      clean(authResult.user.uid)
    ) {
      await verifyOwnerIdentityAndRecover();

      return {
        user: authResult.user
      };
    }

    authenticationPromise = (async function () {
      pendingIncompletePayments = [];

      // A new Pi identity authentication invalidates any previous mapping
      // cached in this browser memory.
      ownerIdentityLinked = false;
      ownerIdentityStatus = "not_checked";
      ownerIdentityCanonicalUid = "";
      ownerIdentitySandboxUid = "";

      var result = await withAuthTimeout(
        pi.authenticate(
          ["username", "payments"],
          function onIncompletePaymentFound(payment) {
            if (payment) {
              pendingIncompletePayments.push(payment);
            }
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

      // Verify the Owner mapping before attempting any recovery.
      await verifyOwnerIdentityAndRecover();

      dispatch("albukhr:testnet-liquidity-debug", {
        stage: "auth-ok",
        message: "Pi identity authentication completed."
      });

      dispatch("albukhr:testnet-liquidity-pi-authenticated", {
        username: authResult.user.username,
        uid: authResult.user.uid
      });

      return {
        user: authResult.user
      };
    })();

    try {
      return await authenticationPromise;
    } finally {
      authenticationPromise = null;
    }
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

    // Do not authenticate or perform network requests inside the payment
    // click path. The Owner identity check must already have completed.
    if (!isAuthenticated()) {
      throw new Error("PI_AUTH_REQUIRED_BEFORE_PAYMENT");
    }

    if (
      !ownerIdentityLinked ||
      ownerIdentityStatus !== "linked" ||
      ownerIdentitySandboxUid !== clean(authResult.user.uid) ||
      !ownerIdentityCanonicalUid
    ) {
      throw new Error("OWNER_IDENTITY_LINK_REQUIRED");
    }

    // Re-check the current canonical session against the identity mapping
    // cached in memory. This is synchronous and preserves the click path.
    var currentSession = getAuth().getSession &&
      getAuth().getSession();

    if (
      !currentSession ||
      clean(currentSession.pi_uid) !== ownerIdentityCanonicalUid
    ) {
      ownerIdentityLinked = false;
      ownerIdentityStatus = "session_changed";
      throw new Error("OWNER_CANONICAL_SESSION_CHANGED");
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
              reject(
                error instanceof Error
                  ? error
                  : new Error("PI_PAYMENT_APPROVAL_FAILED")
              );
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

          onCancel: async function (paymentId) {
  try {
    if (!paymentId) {
      throw new Error("PAYMENT_ID_REQUIRED");
    }

    const cancellation = await apiRequest(
      "cancel",
      {
        paymentId: paymentId,
        projectId: projectId,
        projectCode: projectCode
      },
      true
    );

    dispatch(
      "albukhr:testnet-liquidity-payment-cancelled",
      cancellation
    );
  } catch (error) {
    console.error(
      "[ALBUKHR TESTNET LIQUIDITY CANCELLATION CHECK]",
      error
    );

    dispatch(
      "albukhr:testnet-liquidity-payment-cancel-verification-error",
      {
        paymentId: paymentId,
        network: NETWORK,
        cancellation_confirmed: false,
        error: error
      }
    );
  } finally {
    reject(new Error("PI_PAYMENT_CANCELLED"));
  }
},

          onError: function (error, payment) {
            console.error(
              "[ALBUKHR TESTNET LIQUIDITY PAYMENT]",
              error,
              payment || null
            );

            dispatch("albukhr:testnet-liquidity-payment-error", {
              error: error,
              payment: payment || null
            });

            reject(
              error instanceof Error
                ? error
                : new Error("PI_PAYMENT_ERROR")
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
    ownerIdentityLinkPromise = null;
    ownerIdentityLinked = false;
    ownerIdentityStatus = "not_checked";
    ownerIdentityCanonicalUid = "";
    ownerIdentitySandboxUid = "";
  }

  /* =======================================================
     PAGE-LOAD PRE-AUTHENTICATION
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
