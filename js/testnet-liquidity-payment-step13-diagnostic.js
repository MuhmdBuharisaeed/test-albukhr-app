/* ALBUKHR TESTNET LIQUIDITY PAYMENT STEP 13 DIAGNOSTIC */
(function (window, document) {
  "use strict";

  var API_BASE =
    "https://test-albukhr-api.onrender.com/liquidity-payment";

  var NETWORK = "testnet";
  var HOST = "test.albukhr.com";
  var ORIGIN = "https://test.albukhr.com";

  var SDK_VERSION = "2.0";
  var SANDBOX = false;

  /*
   * This is a hosted registered Pi Testnet app.
   *
   * IMPORTANT:
   * sandbox:false is intentional.
   * The app itself is registered on Pi Testnet.
   *
   * Do NOT change this to sandbox:true unless we intentionally
   * move this diagnostic into the Pi Sandbox environment.
   */
  var AUTH_TIMEOUT_MS = 45000;

  var initialized = false;
  var authResult = null;
  var running = false;
  var startTime = Date.now();

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function elapsed() {
    return (Date.now() - startTime) + "ms";
  }

  function safeJson(value) {
    try {
      return JSON.stringify(value);
    } catch (_) {
      return JSON.stringify({
        type: Object.prototype.toString.call(value)
      });
    }
  }

  function log(event, detail) {
    var line = "[" + elapsed() + "] " + event;

    if (detail !== undefined) {
      line += "\n" + safeJson(detail);
    }

    var node = byId("step13Log");

    if (node) {
      node.textContent +=
        (node.textContent ? "\n" : "") + line;

      node.scrollTop = node.scrollHeight;
    }

    try {
      console.log("[ALBUKHR STEP13]", event, detail);
    } catch (_) {}
  }

  function status(message) {
    var node = byId("step13Status");

    if (node) {
      node.textContent = clean(message);
    }
  }

  function getEnvironment() {
    var env = window.ALBukhrEnvironment;

    if (
      !env ||
      typeof env.isKnown !== "function" ||
      typeof env.isTestnet !== "function" ||
      typeof env.getNetwork !== "function"
    ) {
      throw new Error("TESTNET_ENVIRONMENT_UNAVAILABLE");
    }

    return env;
  }

  function checkEnvironment() {
    var env = getEnvironment();

    var host = clean(
      typeof env.getHostname === "function"
        ? env.getHostname()
        : window.location.hostname
    ).toLowerCase();

    var network = clean(env.getNetwork());

    var result = {
      host: host,
      origin: window.location.origin,
      network: network,
      piPresent: !!window.Pi,
      sdkVersion: SDK_VERSION,
      sandbox: SANDBOX
    };

    log("ENV_CHECK", result);

    if (
      window.location.host !== HOST ||
      window.location.origin !== ORIGIN
    ) {
      throw new Error("TESTNET_HOST_REQUIRED");
    }

    if (
      !env.isKnown() ||
      !env.isTestnet() ||
      network !== NETWORK
    ) {
      throw new Error("INVALID_TESTNET_ENVIRONMENT");
    }

    if (!window.Pi) {
      throw new Error("PI_SDK_UNAVAILABLE");
    }

    return result;
  }

  /*
   * The shared Testnet liquidity payment client owns Pi.init().
   *
   * Step 13 MUST NOT call window.Pi.init() directly.
   */
  function initializePi() {
    checkEnvironment();

    var client = window.AlbukhrTestnetLiquidityPayment;

    if (
      !client ||
      typeof client.init !== "function"
    ) {
      throw new Error(
        "SHARED_TESTNET_PI_CLIENT_UNAVAILABLE"
      );
    }

    if (initialized) {
      log("PI_INIT_SHARED_ALREADY_DONE");
      return window.Pi;
    }

    try {
      var pi = client.init();

      initialized = true;

      log("PI_INIT_SHARED_OK", {
        version: SDK_VERSION,
        sandbox: SANDBOX,
        returnValueType: typeof pi,
        piPresent: !!window.Pi
      });

      return window.Pi;
    } catch (error) {
      log("PI_INIT_SHARED_ERROR", {
        name: error && error.name,
        message: error && error.message
      });

      status("PI_INIT_SHARED_ERROR");

      throw error;
    }
  }

  async function ensureTestnetSession() {
    var auth = window.AlbukhrTestnetAuth;

    if (
      !auth ||
      typeof auth.requireTestnetAuth !== "function" ||
      typeof auth.getSessionToken !== "function"
    ) {
      throw new Error(
        "TESTNET_AUTH_MODULE_UNAVAILABLE"
      );
    }

    var session = await auth.requireTestnetAuth({
      redirectOnFailure: false
    });

    var token = clean(
      auth.getSessionToken()
    );

    if (!session || !token) {
      throw new Error(
        "TESTNET_SESSION_REQUIRED"
      );
    }

    log("TESTNET_SESSION_OK", {
      tokenPresent: true
    });

    return token;
  }

  function getPiAccessToken() {
    if (
      authResult &&
      clean(authResult.accessToken)
    ) {
      return clean(authResult.accessToken);
    }

    /*
     * Fallbacks are retained only for diagnostic compatibility.
     * The preferred source is authResult.accessToken.
     */
    var pi = window.Pi;

    if (pi) {
      var direct =
        clean(pi.accessToken) ||
        clean(pi.access_token);

      if (direct) {
        return direct;
      }
    }

    return "";
  }

  async function authenticatePi() {
    initializePi();

    if (authResult) {
      log("PI_AUTH_ALREADY_DONE", {
        userPresent: !!authResult.user,
        uidPresent: !!clean(
          authResult.user && authResult.user.uid
        ),
        accessTokenPresent: !!clean(
          authResult.accessToken
        )
      });

      return authResult;
    }

    var incomplete = null;

    var scopes = [
      "username",
      "payments"
    ];

    log("PI_AUTH_CALLED", {
      scopes: scopes,
      sdkVersion: SDK_VERSION,
      sandbox: SANDBOX
    });

    var authenticatePromise;

    try {
      authenticatePromise = window.Pi.authenticate(
        scopes,
        function onIncompletePaymentFound(payment) {
          incomplete = payment || null;

          log(
            "INCOMPLETE_PAYMENT_FOUND",
            {
              paymentIdPresent: !!(
                payment &&
                clean(
                  payment.identifier ||
                  payment.id
                )
              )
            }
          );
        }
      );
    } catch (error) {
      log("PI_AUTH_THROWN", {
        name: error && error.name,
        message: error && error.message
      });

      throw error;
    }

    if (
      !authenticatePromise ||
      typeof authenticatePromise.then !== "function"
    ) {
      throw new Error(
        "PI_AUTH_PROMISE_INVALID"
      );
    }

    /*
     * Diagnostic timeout.
     *
     * This does NOT cancel Pi.authenticate().
     * It only prevents Step 13 from waiting indefinitely.
     */
    var timeoutPromise = new Promise(
      function (_, reject) {
        setTimeout(function () {
          reject(
            new Error(
              "PI_AUTH_TIMEOUT_" +
              AUTH_TIMEOUT_MS +
              "MS"
            )
          );
        }, AUTH_TIMEOUT_MS);
      }
    );

    var result;

    try {
      result = await Promise.race([
        authenticatePromise,
        timeoutPromise
      ]);
    } catch (error) {
      log("PI_AUTH_FAILED_OR_TIMEOUT", {
        name: error && error.name,
        message: error && error.message,
        timeoutMs: AUTH_TIMEOUT_MS,
        piPresent: !!window.Pi
      });

      throw error;
    }

    if (
      !result ||
      !result.user ||
      !clean(result.user.uid) ||
      !clean(result.accessToken)
    ) {
      log("PI_AUTH_RESULT_INVALID", {
        resultPresent: !!result,
        userPresent: !!(
          result && result.user
        ),
        uidPresent: !!(
          result &&
          result.user &&
          clean(result.user.uid)
        ),
        accessTokenPresent: !!(
          result &&
          clean(result.accessToken)
        )
      });

      throw new Error(
        "PI_AUTH_RESULT_INVALID"
      );
    }

    authResult = result;

    log("PI_AUTH_OK", {
      userPresent: true,
      uidPresent: !!clean(
        result.user.uid
      ),
      usernamePresent: !!clean(
        result.user.username
      ),
      accessTokenPresent: true,
      incompletePaymentFound: !!incomplete
    });

    /*
     * We do not automatically continue with a previously
     * incomplete payment inside this diagnostic.
     *
     * The shared payment client owns incomplete-payment recovery.
     */
    if (incomplete) {
      log(
        "INCOMPLETE_PAYMENT_DETECTED",
        {
          recoveryRequired: true
        }
      );
    }

    return result;
  }

  function getProjectId() {
    try {
      var params =
        new URLSearchParams(
          window.location.search
        );

      return clean(
        params.get("project") ||
        params.get("project_id")
      );
    } catch (_) {
      return "";
    }
  }

  function getProjectCode() {
    var node = byId("projectCode");

    return clean(
      node && node.textContent
    );
  }

  function getAmount() {
    var node = byId("step13Amount");
    var amount = Number(
      node && node.value
    );

    if (
      !Number.isFinite(amount) ||
      amount < 100
    ) {
      throw new Error(
        "STEP13_AMOUNT_MUST_BE_AT_LEAST_100"
      );
    }

    return amount;
  }

  async function callApi(
    path,
    sessionToken,
    piToken,
    body
  ) {
    var token = clean(piToken);

    if (!token) {
      throw new Error(
        "PI_ACCESS_TOKEN_UNAVAILABLE"
      );
    }

    var response;

    try {
      response = await fetch(
        API_BASE.replace(/\/+$/, "") +
          "/" +
          clean(path).replace(/^\/+/, ""),
        {
          method: "POST",

          headers: {
            "Accept":
              "application/json",

            "Content-Type":
              "application/json",

            "X-Testnet-Session":
              sessionToken,

            "Authorization":
              "Bearer " + token
          },

          body: JSON.stringify(
            body || {}
          )
        }
      );
    } catch (error) {
      var networkError = new Error(
        "STEP13_BACKEND_NETWORK_ERROR"
      );

      networkError.cause = error;

      throw networkError;
    }

    var data = null;

    try {
      data = await response.json();
    } catch (_) {}

    log(
      "BACKEND_" +
        path.toUpperCase() +
        "_RESPONSE",
      {
        httpStatus: response.status,
        ok: response.ok,
        success: !!(
          data &&
          data.success
        ),
        error: clean(
          data && data.error
        )
      }
    );

    if (
      !response.ok ||
      !data ||
      data.success !== true
    ) {
      var apiError = new Error(
        clean(
          data && data.error
        ) ||
          (
            "STEP13_BACKEND_" +
            path.toUpperCase() +
            "_FAILED"
          )
      );

      apiError.status =
        response.status;

      apiError.body = data;

      throw apiError;
    }

    return data;
  }

  async function runPayment() {
    if (running) {
      log("STEP13_ALREADY_RUNNING");
      return;
    }

    running = true;

    try {
      checkEnvironment();

      var sessionToken =
        await ensureTestnetSession();

      var pi =
        await authenticatePi();

      var projectId =
        getProjectId();

      var projectCode =
        getProjectCode();

      var amount =
        getAmount();

      if (!projectId) {
        throw new Error(
          "PROJECT_ID_REQUIRED_IN_OWNER_URL"
        );
      }

      if (!projectCode) {
        throw new Error(
          "PROJECT_CODE_REQUIRED"
        );
      }

      var piToken =
        getPiAccessToken();

      if (!piToken) {
        throw new Error(
          "PI_ACCESS_TOKEN_UNAVAILABLE"
        );
      }

      log(
        "PAYMENT_PARAMETERS",
        {
          projectIdPresent: true,
          projectCode: projectCode,
          amount: amount,
          network: NETWORK,
          action: "add_liquidity",
          piAccessTokenPresent: true,
          testnet: true,
          sandbox: SANDBOX
        }
      );

      status(
        "CREATE_PAYMENT_CALLED — waiting for Pi payment UI…"
      );

      log(
        "CREATE_PAYMENT_CALLED",
        {
          amount: amount,

          memo:
            "ALBUKHR Testnet liquidity • " +
            projectCode
        }
      );

      await new Promise(
        function (resolve, reject) {
          var settled = false;

          function resolveOnce(value) {
            if (settled) return;

            settled = true;
            resolve(value);
          }

          function rejectOnce(error) {
            if (settled) return;

            settled = true;

            reject(
              error instanceof Error
                ? error
                : new Error(
                    "PI_PAYMENT_ERROR"
                  )
            );
          }

          try {
            pi.createPayment(
              {
                amount: amount,

                memo:
                  "ALBUKHR Testnet liquidity • " +
                  projectCode,

                metadata: {
                  network: NETWORK,
                  action:
                    "add_liquidity",
                  project_id:
                    projectId,
                  project_code:
                    projectCode
                }
              },

              {
                onReadyForServerApproval:
                  async function (
                    paymentId
                  ) {
                    log(
                      "READY_FOR_SERVER_APPROVAL",
                      {
                        paymentIdPresent:
                          !!clean(
                            paymentId
                          )
                      }
                    );

                    status(
                      "Pi payment opened. Sending payment approval to ALBUKHR server…"
                    );

                    try {
                      var approval =
                        await callApi(
                          "approve",
                          sessionToken,
                          piToken,
                          {
                            paymentId:
                              paymentId,

                            projectId:
                              projectId,

                            projectCode:
                              projectCode
                          }
                        );

                      log(
                        "ALBUKHR_APPROVAL_OK",
                        {
                          paymentIdPresent:
                            !!clean(
                              paymentId
                            ),

                          recordPresent:
                            !!(
                              approval &&
                              approval.record
                            )
                        }
                      );

                      status(
                        "ALBUKHR approval succeeded. Continue in Pi Wallet to submit the Testnet transaction…"
                      );
                    } catch (error) {
                      log(
                        "ALBUKHR_APPROVAL_ERROR",
                        {
                          name:
                            error &&
                            error.name,

                          message:
                            error &&
                            error.message,

                          status:
                            error &&
                            error.status
                        }
                      );

                      status(
                        "ALBUKHR approval failed: " +
                          (
                            error &&
                            error.message
                              ? error.message
                              : "UNKNOWN_ERROR"
                          )
                      );

                      rejectOnce(
                        error
                      );
                    }
                  },

                onReadyForServerCompletion:
                  async function (
                    paymentId,
                    txid
                  ) {
                    log(
                      "READY_FOR_SERVER_COMPLETION",
                      {
                        paymentIdPresent:
                          !!clean(
                            paymentId
                          ),

                        txidPresent:
                          !!clean(
                            txid
                          )
                      }
                    );

                    status(
                      "Blockchain transaction received. Sending completion to ALBUKHR server…"
                    );

                    try {
                      var completion =
                        await callApi(
                          "complete",
                          sessionToken,
                          piToken,
                          {
                            paymentId:
                              paymentId,

                            projectId:
                              projectId,

                            projectCode:
                              projectCode,

                            txid: txid
                          }
                        );

                      log(
                        "ALBUKHR_COMPLETION_OK",
                        {
                          paymentIdPresent:
                            !!clean(
                              paymentId
                            ),

                          txidPresent:
                            !!clean(
                              txid
                            ),

                          recordPresent:
                            !!(
                              completion &&
                              completion.record
                            )
                        }
                      );

                      status(
                        "TESTNET LIQUIDITY PAYMENT COMPLETED"
                      );

                      resolveOnce(
                        completion
                      );
                    } catch (error) {
                      log(
                        "ALBUKHR_COMPLETION_ERROR",
                        {
                          name:
                            error &&
                            error.name,

                          message:
                            error &&
                            error.message,

                          status:
                            error &&
                            error.status
                        }
                      );

                      status(
                        "ALBUKHR completion failed: " +
                          (
                            error &&
                            error.message
                              ? error.message
                              : "UNKNOWN_ERROR"
                          )
                      );

                      rejectOnce(
                        error
                      );
                    }
                  },

                onCancel:
                  function (paymentId) {
                    log(
                      "PAYMENT_CANCELLED",
                      {
                        paymentIdPresent:
                          !!clean(
                            paymentId
                          )
                      }
                    );

                    status(
                      "PAYMENT_CANCELLED"
                    );

                    rejectOnce(
                      new Error(
                        "PI_PAYMENT_CANCELLED"
                      )
                    );
                  },

                onError:
                  function (
                    error,
                    payment
                  ) {
                    log(
                      "PAYMENT_ERROR",
                      {
                        errorName:
                          error &&
                          error.name,

                        errorMessage:
                          error &&
                          error.message,

                        paymentPresent:
                          !!payment,

                        paymentIdPresent:
                          !!(
                            payment &&
                            clean(
                              payment.identifier
                            )
                          )
                      }
                    );

                    status(
                      "PI_PAYMENT_ERROR"
                    );

                    rejectOnce(
                      error ||
                        new Error(
                          "PI_PAYMENT_ERROR"
                        )
                    );
                  }
              }
            );
          } catch (error) {
            log(
              "CREATE_PAYMENT_THROWN",
              {
                name:
                  error &&
                  error.name,

                message:
                  error &&
                  error.message
              }
            );

            rejectOnce(error);
          }
        }
      );
    } catch (error) {
      log(
        "STEP13_ERROR",
        {
          name:
            error &&
            error.name,

          message:
            error &&
            error.message
        }
      );

      status(
        "STEP13_ERROR: " +
          (
            error &&
            error.message
              ? error.message
              : "UNKNOWN_ERROR"
          )
      );
    } finally {
      running = false;
    }
  }

  window.addEventListener(
    "load",
    function () {
      try {
        checkEnvironment();

        log(
          "STEP13_READY",
          {
            host: HOST,
            origin: ORIGIN,
            piPresent: !!window.Pi,
            projectIdPresent:
              !!getProjectId(),
            projectCodePresent:
              !!getProjectCode(),
            sdkVersion:
              SDK_VERSION,
            sandbox:
              SANDBOX,
            authTimeoutMs:
              AUTH_TIMEOUT_MS
          }
        );
      } catch (error) {
        log(
          "STEP13_BOOT_ERROR",
          {
            name:
              error &&
              error.name,

            message:
              error &&
              error.message
          }
        );

        status(
          "STEP13_BOOT_ERROR"
        );
      }

      var button =
        byId("step13RunBtn");

      if (button) {
        button.addEventListener(
          "click",
          runPayment
        );
      }
    }
  );
})(window, document);
