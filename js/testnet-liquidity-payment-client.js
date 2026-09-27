/* =========================================================
   ALBUKHR TESTNET LIQUIDITY PAYMENT CLIENT v4
   =========================================================

   PURPOSE
   -------
   Testnet Pi liquidity payment client.

   SECURITY MODEL
   --------------
   1. Testnet session authorizes ALBUKHR access.
   2. Pi.authenticate() verifies Pi identity.
   3. Pi access token remains memory-only.
   4. Pi.createPayment() is called directly from the
      user click path.
   5. Backend receives:
        - X-Testnet-Session
        - Authorization: Bearer <Pi access token>

   IMPORTANT PAYMENT FLOW
   ----------------------
   Page Load
       ↓
   Testnet Session
       ↓
   Pi.init()
       ↓
   Pi.authenticate()
       ↓
   Pi access token in memory
       ↓
   Add Liquidity enabled
       ↓
   User click
       ↓
   Pi.createPayment()
       ↓
   Pi Payment UI

   NO Pi.authenticate() is performed inside
   createLiquidityPayment().

   NO LocalStorage is used for Pi credentials.
   NO sessionStorage is used for Pi credentials.
========================================================= */

(function (window) {

  "use strict";


  /* =======================================================
     CONFIGURATION
  ======================================================= */

  var API_BASE =
    "https://test-albukhr-api.onrender.com";

  var NETWORK =
    "testnet";

  var PI_SDK_VERSION =
    "2.0";

  /*
   * ALBUKHR Testnet payment environment.
   *
   * The Testnet application itself determines its environment.
   * Keep this value aligned with the existing Testnet payment
   * configuration.
   */
  var PI_SANDBOX =
    false;


  /* =======================================================
     INTERNAL STATE
  ======================================================= */

  var initialized =
    false;

  /*
   * IMPORTANT:
   *
   * Pi access token exists ONLY in JavaScript memory.
   *
   * It is NOT written to:
   * - localStorage
   * - sessionStorage
   * - cookies
   * - URL
   */
  var authResult =
    null;

  var pendingIncompletePayments =
    [];

  /*
   * Prevent duplicate Pi.authenticate() calls.
   */
  var authenticationPromise =
    null;


  /* =======================================================
     UTILITY
  ======================================================= */

  function clean(value) {

    return String(
      value == null
        ? ""
        : value
    ).trim();

  }


  /* =======================================================
     TESTNET AUTH MODULE
  ======================================================= */

  function getAuth() {

    var auth =
      window.AlbukhrTestnetAuth;

    if (
      !auth ||
      typeof auth.requireTestnetAuth !==
        "function"
    ) {

      throw new Error(
        "TESTNET_AUTH_MODULE_UNAVAILABLE"
      );

    }

    return auth;

  }


  /* =======================================================
     TESTNET SESSION TOKEN
  ======================================================= */

  function getSessionToken() {

    var auth =
      getAuth();

    var token =
      clean(
        auth.getSessionToken()
      );

    if (!token) {

      throw new Error(
        "TESTNET_SESSION_REQUIRED"
      );

    }

    return token;

  }


  /* =======================================================
     ENVIRONMENT VALIDATION
  ======================================================= */

  function validateEnvironment() {

    var env =
      window.ALBukhrEnvironment;

    if (
      !env ||
      typeof env.isKnown !==
        "function" ||
      typeof env.isTestnet !==
        "function" ||
      typeof env.getNetwork !==
        "function"
    ) {

      throw new Error(
        "TESTNET_ENVIRONMENT_UNAVAILABLE"
      );

    }


    if (
      !env.isKnown() ||
      !env.isTestnet() ||
      env.getNetwork() !==
        NETWORK
    ) {

      throw new Error(
        "INVALID_TESTNET_ENVIRONMENT"
      );

    }


    var hostname =
      clean(
        typeof env.getHostname ===
          "function"
          ? env.getHostname()
          : window.location.hostname
      ).toLowerCase();


    if (
      hostname !==
      "test.albukhr.com"
    ) {

      throw new Error(
        "TESTNET_HOST_REQUIRED"
      );

    }

  }


  /* =======================================================
     PI SDK VALIDATION
  ======================================================= */

  function requirePiSdk() {

    if (
      !window.Pi ||
      typeof window.Pi.init !==
        "function" ||
      typeof window.Pi.authenticate !==
        "function" ||
      typeof window.Pi.createPayment !==
        "function"
    ) {

      throw new Error(
        "PI_SDK_UNAVAILABLE"
      );

    }

    return window.Pi;

  }


  /* =======================================================
     EVENT DISPATCH
  ======================================================= */

  function dispatch(
    name,
    detail
  ) {

    try {

      window.dispatchEvent(
        new CustomEvent(
          name,
          {
            detail:
              detail || {}
          }
        )
      );

    } catch (_) {}

  }


  /* =======================================================
     API REQUEST
  ======================================================= */

  async function apiRequest(
    path,
    body,
    includePiToken
  ) {

    var sessionToken =
      getSessionToken();


    var headers = {

      "Accept":
        "application/json",

      "Content-Type":
        "application/json",

      "X-Testnet-Session":
        sessionToken

    };


    /*
     * Server approval/completion requires
     * the Pi access token.
     */
    if (includePiToken) {

      var piToken =
        clean(
          authResult &&
          authResult.accessToken
        );


      if (!piToken) {

        throw new Error(
          "PI_ACCESS_TOKEN_REQUIRED"
        );

      }


      headers.Authorization =
        "Bearer " +
        piToken;

    }


    var response =
      await fetch(

        API_BASE.replace(
          /\/+$/,
          ""
        ) +
          "/liquidity-payment/" +
          clean(path).replace(
            /^\/+/,
            ""
          ),

        {
          method:
            "POST",

          headers:
            headers,

          body:
            JSON.stringify(
              body || {}
            )
        }

      );


    var data =
      null;


    try {

      data =
        await response.json();

    } catch (_) {}


    if (!response.ok) {

      var code =
        clean(
          data &&
          data.error
        ) ||
        "TESTNET_LIQUIDITY_PAYMENT_ERROR";


      var error =
        new Error(code);


      error.status =
        response.status;

      error.body =
        data;


      throw error;

    }


    return data;

  }


  /* =======================================================
     INCOMPLETE PAYMENT RECOVERY
  ======================================================= */

  async function recoverIncomplete(
    payment
  ) {

    if (!payment) {

      return null;

    }


    var identifier =
      clean(
        payment.identifier ||
        payment.id
      );


    if (!identifier) {

      return null;

    }


    try {

      var response =
        await fetch(

          API_BASE.replace(
            /\/+$/,
            ""
          ) +
            "/liquidity-payment/incomplete",

          {
            method:
              "POST",

            headers: {

              "Accept":
                "application/json",

              "Content-Type":
                "application/json"

            },

            body:
              JSON.stringify({

                paymentId:
                  identifier,

                identifier:
                  identifier,

                txid:
                  clean(
                    payment.transaction &&
                    payment.transaction.txid
                  ) ||
                  null

              })

          }

        );


      var result =
        null;


      try {

        result =
          await response.json();

      } catch (_) {}


      if (!response.ok) {

        var error =
          new Error(

            clean(
              result &&
              (
                result.error ||
                result.message
              )
            ) ||
            "TESTNET_LIQUIDITY_RECOVERY_FAILED"

          );


        error.status =
          response.status;

        error.body =
          result;


        throw error;

      }


      dispatch(

        "albukhr:testnet-liquidity-payment-recovered",

        result

      );


      return result;

    } catch (error) {

      console.error(

        "[ALBUKHR TESTNET LIQUIDITY RECOVERY]",

        error

      );


      dispatch(

        "albukhr:testnet-liquidity-payment-recovery-error",

        {
          error:
            error,

          payment:
            payment
        }

      );


      throw error;

    }

  }


  /* =======================================================
     PI SDK INITIALIZATION
  ======================================================= */

  function initializePiSdk() {

    validateEnvironment();


    var pi =
      requirePiSdk();


    /*
     * Do not initialize more than once.
     */
    if (initialized) {

      return pi;

    }


    try {

      pi.init({

        version:
          PI_SDK_VERSION,

        sandbox:
          PI_SANDBOX

      });


      initialized =
        true;


      dispatch(

        "albukhr:testnet-liquidity-pi-initialized",

        {

          version:
            PI_SDK_VERSION,

          sandbox:
            PI_SANDBOX

        }

      );


      return pi;

    } catch (error) {

      initialized =
        false;


      dispatch(

        "albukhr:testnet-liquidity-pi-init-error",

        {

          message:
            clean(
              error &&
              error.message
            ) ||
            "PI_INIT_FAILED"

        }

      );


      throw error;

    }

  }


  /* =======================================================
     PI AUTHENTICATION
  =======================================================

     IMPORTANT:

     This function is NOT called by
     createLiquidityPayment().

     It is called during page preparation.

     This prevents the payment click from having to wait
     for Pi.authenticate().
  ======================================================= */

  async function authenticate() {

    validateEnvironment();


    /*
     * Pi SDK must already be initialized.
     */
    var pi =
      initializePiSdk();


    /*
     * Testnet session must exist before Pi authentication
     * is accepted by the ALBUKHR payment flow.
     */
    var session =
      await getAuth()
        .requireTestnetAuth({

          redirectOnFailure:
            false

        });


    if (!session) {

      throw new Error(
        "TESTNET_SESSION_REQUIRED"
      );

    }


    /*
     * If another authentication request is already running,
     * reuse it instead of calling Pi.authenticate() twice.
     */
    if (authenticationPromise) {

      return authenticationPromise;

    }


    /*
     * If we already have a valid in-memory Pi auth result,
     * return it.
     */
    if (
      authResult &&
      clean(
        authResult.accessToken
      ) &&
      authResult.user &&
      clean(
        authResult.user.uid
      )
    ) {

      return {

        user:
          authResult.user

      };

    }


    authenticationPromise =
      (async function () {

        pendingIncompletePayments =
          [];


        /*
         * ONLY ONE Pi.authenticate() CALL.
         */
        var result =
          await pi.authenticate(

            [
              "username",
              "payments"
            ],

            function
              onIncompletePaymentFound(
                payment
              ) {

              if (payment) {

                pendingIncompletePayments.push(
                  payment
                );

              }

            }

          );


        /*
         * Validate Pi response.
         */
        if (
          !result ||
          !clean(
            result.accessToken
          ) ||
          !result.user ||
          !clean(
            result.user.uid
          )
        ) {

          throw new Error(
            "PI_AUTH_RESULT_INVALID"
          );

        }


        /*
         * MEMORY ONLY.
         *
         * Never persist this object.
         */
        authResult = {

          accessToken:
            result.accessToken,

          user: {

            uid:
              clean(
                result.user.uid
              ),

            username:
              clean(
                result.user.username
              ) ||
              null

          }

        };


        /*
         * Recover incomplete payments after authentication.
         */
        for (
          var i = 0;
          i <
          pendingIncompletePayments.length;
          i += 1
        ) {

          try {

            await recoverIncomplete(
              pendingIncompletePayments[i]
            );

          } catch (
            recoveryError
          ) {

            /*
             * Recovery failure must not destroy
             * the newly authenticated Pi session.
             */
            console.error(

              "[ALBUKHR TESTNET INCOMPLETE PAYMENT RECOVERY]",

              recoveryError

            );

          }

        }


        pendingIncompletePayments =
          [];


        /*
         * Notify the Project Owner page that
         * Pi authentication is ready.
         */
        dispatch(

          "albukhr:testnet-liquidity-pi-authenticated",

          {

            username:
              authResult.user.username,

            uid:
              authResult.user.uid

          }

        );


        return {

          user:
            authResult.user

        };

      })();


    try {

      return await authenticationPromise;

    } finally {

      authenticationPromise =
        null;

    }

  }


  /* =======================================================
     CHECK PI AUTHENTICATION STATE
  ======================================================= */

  function isAuthenticated() {

    return !!(

      authResult &&

      clean(
        authResult.accessToken
      ) &&

      authResult.user &&

      clean(
        authResult.user.uid
      )

    );

  }


  /* =======================================================
     GET PI ACCESS TOKEN
     INTERNAL ONLY
  ======================================================= */

  function getPiAccessToken() {

    if (!isAuthenticated()) {

      return "";

    }

    return clean(
      authResult.accessToken
    );

  }


  /* =======================================================
     CREATE LIQUIDITY PAYMENT
  =======================================================

     CRITICAL:

     There is NO:

         await authenticate();

     inside this function.

     Pi authentication must already be complete before
     the user presses Add Liquidity.

     Therefore the user click can proceed directly to:

         Pi.createPayment()

     This preserves the payment UI user-gesture chain.
  ======================================================= */

  async function createLiquidityPayment(
    project,
    amount
  ) {

    validateEnvironment();


    var safeProject =
      project || {};


    var projectId =
      clean(
        safeProject.id
      );


    var projectCode =
      clean(
        safeProject.project_code
      );


    if (!projectId) {

      throw new Error(
        "PROJECT_ID_REQUIRED"
      );

    }


    if (!projectCode) {

      throw new Error(
        "PROJECT_CODE_REQUIRED"
      );

    }


    if (
      clean(
        safeProject.network
      ).toLowerCase() !==
      NETWORK
    ) {

      throw new Error(
        "PROJECT_NETWORK_INVALID"
      );

    }


    var value =
      Number(amount);


    if (
      !Number.isFinite(value) ||
      value <= 0
    ) {

      throw new Error(
        "INVALID_LIQUIDITY_AMOUNT"
      );

    }


    /*
     * CRITICAL:
     *
     * Do not authenticate here.
     *
     * The Pi identity must already be authenticated.
     */
    if (!isAuthenticated()) {

      throw new Error(
        "PI_AUTH_REQUIRED_BEFORE_PAYMENT"
      );

    }


    /*
     * Require Pi SDK.
     */
    var pi =
      requirePiSdk();


    /*
     * Do not call Pi.authenticate() here.
     *
     * The next Pi call is createPayment().
     */
    var memo =
      "ALBUKHR Testnet liquidity • " +
      projectCode;


    return new Promise(

      function (
        resolve,
        reject
      ) {


        /*
         * =====================================================
         * PI PAYMENT UI
         * =====================================================
         *
         * This is intentionally the first Pi SDK operation
         * after the user's Add Liquidity click.
         */
        pi.createPayment(

          {

            amount:
              value,

            memo:
              memo,

            metadata: {

              network:
                NETWORK,

              action:
                "add_liquidity",

              project_id:
                projectId,

              project_code:
                projectCode

            }

          },


          {

            /* ===============================================
               SERVER APPROVAL
            =============================================== */

            onReadyForServerApproval:
              async function (
                paymentId
              ) {

                try {

                  var approved =
                    await apiRequest(

                      "approve",

                      {

                        paymentId:
                          paymentId,

                        projectId:
                          projectId,

                        projectCode:
                          projectCode

                      },

                      true

                    );


                  dispatch(

                    "albukhr:testnet-liquidity-payment-approved",

                    approved

                  );

                } catch (error) {

                  console.error(

                    "[ALBUKHR TESTNET LIQUIDITY APPROVAL]",

                    error

                  );


                  dispatch(

                    "albukhr:testnet-liquidity-payment-approval-error",

                    {

                      error:
                        error,

                      paymentId:
                        paymentId

                    }

                  );


                  throw error;

                }

              },


            /* ===============================================
               SERVER COMPLETION
            =============================================== */

            onReadyForServerCompletion:
              async function (
                paymentId,
                txid
              ) {

                try {

                  var completed =
                    await apiRequest(

                      "complete",

                      {

                        paymentId:
                          paymentId,

                        projectId:
                          projectId,

                        projectCode:
                          projectCode,

                        txid:
                          txid

                      },

                      true

                    );


                  dispatch(

                    "albukhr:testnet-liquidity-payment-completed",

                    completed

                  );


                  resolve(
                    completed
                  );

                } catch (error) {

                  console.error(

                    "[ALBUKHR TESTNET LIQUIDITY COMPLETION]",

                    error

                  );


                  dispatch(

                    "albukhr:testnet-liquidity-payment-completion-error",

                    {

                      error:
                        error,

                      paymentId:
                        paymentId,

                      txid:
                        txid

                    }

                  );


                  throw error;

                }

              },


            /* ===============================================
               USER CANCEL
            =============================================== */

            onCancel:
              function (
                paymentId
              ) {

                dispatch(

                  "albukhr:testnet-liquidity-payment-cancelled",

                  {

                    paymentId:
                      paymentId,

                    network:
                      NETWORK

                  }

                );


                reject(

                  new Error(
                    "PI_PAYMENT_CANCELLED"
                  )

                );

              },


            /* ===============================================
               PI PAYMENT ERROR
            =============================================== */

            onError:
              function (
                error,
                payment
              ) {

                console.error(

                  "[ALBUKHR TESTNET LIQUIDITY PAYMENT]",

                  error,

                  payment || null

                );


                dispatch(

                  "albukhr:testnet-liquidity-payment-error",

                  {

                    error:
                      error,

                    payment:
                      payment ||
                      null

                  }

                );


                reject(

                  error instanceof Error
                    ? error
                    : new Error(
                        "PI_PAYMENT_ERROR"
                      )

                );

              }

          }

        );

      }

    );

  }


  /* =======================================================
     CLEAR MEMORY-ONLY PI AUTH
  ======================================================= */

  function clearInMemoryPiAuth() {

    authResult =
      null;

    pendingIncompletePayments =
      [];

    authenticationPromise =
      null;

  }


  /* =======================================================
     INITIAL PAGE-LOAD PI INITIALIZATION
  ======================================================= */

  try {

    initializePiSdk();

  } catch (error) {

    console.error(

      "[ALBUKHR TESTNET LIQUIDITY PI INIT]",

      error

    );

  }


  /* =======================================================
     PRE-AUTHENTICATION
  =======================================================

     This starts Pi authentication after the payment client
     has loaded.

     It does NOT create a payment.

     It only obtains the Pi identity/access token so that
     the later Add Liquidity click can call Pi.createPayment()
     directly.
  ======================================================= */

  try {

    authenticate().catch(

      function (error) {

        console.error(

          "[ALBUKHR TESTNET PI PRE-AUTH]",

          error

        );


        dispatch(

          "albukhr:testnet-liquidity-pi-auth-error",

          {

            message:
              clean(
                error &&
                error.message
              ) ||
              "PI_AUTH_FAILED"

          }

        );

      }

    );

  } catch (error) {

    console.error(

      "[ALBUKHR TESTNET PI PRE-AUTH START]",

      error

    );

  }


  /* =======================================================
     PUBLIC API
  ======================================================= */

  var api = {

    init:
      initializePiSdk,

    authenticate:
      authenticate,

    isAuthenticated:
      isAuthenticated,

    createLiquidityPayment:
      createLiquidityPayment,

    addLiquidity:
      createLiquidityPayment,

    recoverIncomplete:
      recoverIncomplete,

    clearInMemoryPiAuth:
      clearInMemoryPiAuth,

    network:
      NETWORK,

    apiBase:
      API_BASE

  };


  try {

    Object.freeze(
      api
    );

  } catch (_) {}


  window.AlbukhrTestnetLiquidityPayment =
    api;


})(window);
