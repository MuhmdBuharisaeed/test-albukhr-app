/* =========================================
   ALBUKHR PI PAYMENT ENGINE
   js/core/pi-payment.js

   NEW ARCHITECTURE
   -----------------------------------------
   Responsibilities:
   - Start Pi payments
   - Use shared ALBUKHR authentication
   - Use shared Pi SDK initialization
   - Approve payments through ALBUKHR API
   - Complete payments through ALBUKHR API
   - Resolve Mainnet/Testnet API from shared
     environment configuration
   - Return paymentId + txid to the caller

   Architecture rules:
   - No localStorage
   - No Supabase client
   - No Supabase credentials
   - No Pi authentication implementation
   - Uses shared pi-auth-core.js
   - Uses shared environment configuration
   - Does not modify Dock Navigation
========================================= */

"use strict";

(() => {

  /* =========================================
     STATE
  ========================================= */

  let paymentInProgress = false;

  /* =========================================
     SHARED AUTH RESOLUTION
     pi-auth-core.js must expose
     window.ensurePiAuth()
  ========================================= */

  async function getAuthenticatedUser() {

    if (typeof window.ensurePiAuth !== "function") {
      throw new Error(
        "ALBUKHR Pi Auth Core is unavailable. Load js/core/pi-auth-core.js before js/core/pi-payment.js."
      );
    }

    const user = await window.ensurePiAuth();

    if (!user?.uid) {
      throw new Error("Pi authentication required.");
    }

    return user;
  }

  /* =========================================
     PI SDK CHECK
  ========================================= */

  function getPiSdk() {

    if (
      !window.Pi ||
      typeof window.Pi.createPayment !== "function"
    ) {
      throw new Error(
        "Pi SDK is unavailable. Make sure the Pi SDK is loaded before starting a payment."
      );
    }

    return window.Pi;
  }

  /* =========================================
     ENVIRONMENT
  ========================================= */

  function getCurrentNetwork() {

    const candidates = [
      window.AlbukhrNetwork?.current,
      window.AlbukhrEnvironment?.current,
      window.AlbukhrEnvironment?.network,
      window.ALBUKHR_NETWORK,
      document.documentElement?.dataset?.network,
      document.body?.dataset?.network
    ];

    for (const value of candidates) {

      const normalized =
        String(value || "")
          .toLowerCase()
          .trim();

      if (
        normalized === "mainnet" ||
        normalized === "testnet"
      ) {
        return normalized;
      }
    }

    const host =
      window.location.hostname
        .toLowerCase();

    if (
      host === "test.albukhr.com" ||
      host.startsWith("test.")
    ) {
      return "testnet";
    }

    return "mainnet";
  }

  /* =========================================
     PAYMENT API CONFIG
     -----------------------------------------
     Preferred:
       window.AlbukhrPaymentConfig

     Example supplied by the shared
     environment/config layer:

       window.AlbukhrPaymentConfig = {
         mainnet: {
           apiBaseUrl: "https://YOUR-MAINNET-API"
         },
         testnet: {
           apiBaseUrl: "https://test-albukhr-api.onrender.com"
         }
       };

     The payment engine itself contains no
     secret credentials.
  ========================================= */

  function getPaymentConfig() {

    const network =
      getCurrentNetwork();

    const config =
      window.AlbukhrPaymentConfig;

    if (
      config &&
      typeof config === "object"
    ) {

      const networkConfig =
        config[network];

      if (
        networkConfig?.apiBaseUrl
      ) {

        return {
          network,
          apiBaseUrl:
            String(
              networkConfig.apiBaseUrl
            ).replace(/\/+$/, "")
        };
      }
    }

    /*
     * Backward-compatible testnet fallback.
     *
     * This keeps the existing testnet payment
     * endpoint functional while the shared
     * environment configuration is being wired.
     *
     * Mainnet has NO invented endpoint.
     */
    if (network === "testnet") {

      return {
        network,
        apiBaseUrl:
          "https://test-albukhr-api.onrender.com"
      };
    }

    throw new Error(
      "ALBUKHR Mainnet payment API is not configured in window.AlbukhrPaymentConfig."
    );
  }

  /* =========================================
     API URL
  ========================================= */

  function getApiUrl(action) {

    const config =
      getPaymentConfig();

    const allowedActions = [
      "approve",
      "complete"
    ];

    if (
      !allowedActions.includes(action)
    ) {
      throw new Error(
        "Invalid Pi payment server action."
      );
    }

    return (
      config.apiBaseUrl +
      "/" +
      action
    );
  }

  /* =========================================
     SERVER REQUEST
  ========================================= */

  async function callPaymentServer(
    action,
    payload
  ) {

    const response =
      await fetch(
        getApiUrl(action),
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
            "Accept":
              "application/json"
          },

          body:
            JSON.stringify(payload)
        }
      );

    let data = null;

    const contentType =
      response.headers.get(
        "content-type"
      ) || "";

    if (
      contentType.includes(
        "application/json"
      )
    ) {

      data =
        await response.json();

    } else {

      const text =
        await response.text();

      data = {
        success:
          response.ok,
        message:
          text
      };
    }

    if (!response.ok) {

      throw new Error(
        data?.error ||
        data?.message ||
        `Payment server returned HTTP ${response.status}.`
      );
    }

    if (
      data &&
      data.success === false
    ) {

      throw new Error(
        data.error ||
        data.message ||
        `${action} failed.`
      );
    }

    return data;
  }

  /* =========================================
     PAYMENT METADATA
  ========================================= */

  function buildMetadata({
    user,
    metadata
  }) {

    return {
      userId:
        user.uid,

      ...(metadata &&
      typeof metadata === "object"
        ? metadata
        : {})
    };
  }

  /* =========================================
     VALIDATION
  ========================================= */

  function validatePaymentInput({
    amount,
    memo
  }) {

    const numericAmount =
      Number(amount);

    if (
      !Number.isFinite(
        numericAmount
      ) ||
      numericAmount <= 0
    ) {

      throw new Error(
        "A valid Pi payment amount is required."
      );
    }

    if (
      memo !== undefined &&
      memo !== null &&
      typeof memo !== "string"
    ) {

      throw new Error(
        "Payment memo must be text."
      );
    }

    return {
      amount:
        numericAmount,

      memo:
        String(
          memo ?? ""
        ).trim()
    };
  }

  /* =========================================
     START PI PAYMENT
  ========================================= */

  async function startPiPayment({
    amount,
    memo,
    metadata = {}
  } = {}) {

    if (paymentInProgress) {

      throw new Error(
        "A Pi payment is already in progress."
      );
    }

    const payment =
      validatePaymentInput({
        amount,
        memo
      });

    paymentInProgress = true;

    try {

      /*
       * Authentication belongs to
       * pi-auth-core.js.
       */
      const user =
        await getAuthenticatedUser();

      /*
       * Pi SDK must already be initialized
       * by pi-auth-core.js.
       */
      const Pi =
        getPiSdk();

      const paymentMetadata =
        buildMetadata({
          user,
          metadata
        });

      return await new Promise(
        (resolve, reject) => {

          let settled = false;

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
                    String(
                      error ||
                      "Pi payment failed."
                    )
                  )
            );
          }

          try {

            Pi.createPayment(
              {
                amount:
                  payment.amount,

                memo:
                  payment.memo,

                metadata:
                  paymentMetadata
              },

              {
                /* =========================
                   SERVER APPROVAL
                ========================= */

                onReadyForServerApproval:
                  async function(paymentId) {

                    try {

                      if (!paymentId) {
                        throw new Error(
                          "Pi payment ID is missing."
                        );
                      }

                      console.log(
                        "ALBUKHR Pi payment approval:",
                        paymentId
                      );

                      const data =
                        await callPaymentServer(
                          "approve",
                          {
                            paymentId
                          }
                        );

                      console.log(
                        "ALBUKHR Pi payment approved:",
                        paymentId
                      );

                      /*
                       * Do not resolve here.
                       * Pi will continue to
                       * server completion.
                       */

                      return data;

                    } catch (error) {

                      console.error(
                        "ALBUKHR Pi approval error:",
                        error
                      );

                      rejectOnce(error);
                    }
                  },

                /* =========================
                   SERVER COMPLETION
                ========================= */

                onReadyForServerCompletion:
                  async function(
                    paymentId,
                    txid
                  ) {

                    try {

                      if (!paymentId) {
                        throw new Error(
                          "Pi payment ID is missing."
                        );
                      }

                      if (!txid) {
                        throw new Error(
                          "Pi transaction ID is missing."
                        );
                      }

                      console.log(
                        "ALBUKHR Pi payment completion:",
                        {
                          paymentId,
                          txid
                        }
                      );

                      const data =
                        await callPaymentServer(
                          "complete",
                          {
                            paymentId,
                            txid
                          }
                        );

                      console.log(
                        "ALBUKHR Pi payment completed:",
                        paymentId
                      );

                      resolveOnce({
                        paymentId,
                        txid,
                        network:
                          getCurrentNetwork(),
                        server:
                          data
                      });

                    } catch (error) {

                      console.error(
                        "ALBUKHR Pi completion error:",
                        error
                      );

                      rejectOnce(error);
                    }
                  },

                /* =========================
                   USER CANCELLED
                ========================= */

                onCancel:
                  function(paymentId) {

                    console.warn(
                      "ALBUKHR Pi payment cancelled:",
                      paymentId
                    );

                    rejectOnce(
                      new Error(
                        "User cancelled the Pi payment."
                      )
                    );
                  },

                /* =========================
                   PI PAYMENT ERROR
                ========================= */

                onError:
                  function(error) {

                    console.error(
                      "ALBUKHR Pi payment error:",
                      error
                    );

                    rejectOnce(
                      error ||
                      new Error(
                        "Pi payment failed."
                      )
                    );
                  }
              }
            );

          } catch (error) {

            console.error(
              "ALBUKHR Pi.createPayment error:",
              error
            );

            rejectOnce(error);
          }
        }
      );

    } finally {

      paymentInProgress = false;
    }
  }

  /* =========================================
     PAYMENT STATUS
  ========================================= */

  function isPaymentInProgress() {

    return paymentInProgress;
  }

  /* =========================================
     PUBLIC API
  ========================================= */

  window.AlbukhrPiPayment = {
    startPiPayment,
    isPaymentInProgress,
    getCurrentNetwork,
    getPaymentConfig,
    getApiUrl
  };

  /*
   * Backward compatibility:
   *
   * Existing ALBUKHR engines can continue
   * calling startPiPayment(...)
   * without changing their public interface.
   */
  window.startPiPayment =
    startPiPayment;

  /* =========================================
     OPTIONAL LEGACY EVENT HOOK
  ========================================= */

  window.dispatchEvent(
    new CustomEvent(
      "albukhrPiPaymentReady"
    )
  );

})();
