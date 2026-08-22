/* =========================================
   ALBUKHR PI PROJECT TREASURY PAYMENT ADAPTER
   js/core/pi-project-treasury-payment.js

   NEW ARCHITECTURE
   -----------------------------------------
   U2A: Pioneer -> ALBUKHR App

   Responsibilities:
   - Add project liquidity through Pi Payment
   - Authenticate Pioneer through shared Pi SDK
   - Authenticate administrator through shared
     ALBUKHR Admin Auth Core
   - Send treasury operations only to the
     dedicated backend endpoint
   - Enforce Mainnet/Testnet isolation
   - Never write directly to treasury records
   - Never use LocalStorage
   - Never contain Supabase credentials
   - Never create a Supabase client

   Required shared dependencies:
   - Pi SDK
   - js/core/pi-auth-core.js
   - js/core/admin-auth-core.js
   - shared environment/network resolver
========================================= */

"use strict";

(() => {

  /* =========================================
     CONFIG
  ========================================= */

  const ENDPOINT =
    "/api/pi-project-treasury-payment";

  const PAYMENT_MEMO_PREFIX =
    "ALBUKHR liquidity";

  const ALBUKHR_VERSION =
    "1.0.0";

  /* =========================================
     STATE
  ========================================= */

  let paymentBusy = false;

  /* =========================================
     HELPERS
  ========================================= */

  function stringValue(
    value,
    fallback = ""
  ) {
    return value == null
      ? fallback
      : String(value);
  }

  function numberValue(
    value,
    fallback = 0
  ) {
    const number =
      Number(value);

    return Number.isFinite(number)
      ? number
      : fallback;
  }

  /* =========================================
     NETWORK
     ========================================= */

  function getNetwork() {

    /*
     * Preferred shared resolver.
     */
    if (
      typeof window.getAlbukhrNetwork ===
      "function"
    ) {

      const resolved =
        window.getAlbukhrNetwork();

      if (
        resolved === "mainnet" ||
        resolved === "testnet"
      ) {
        return resolved;
      }
    }

    /*
     * New architecture environment layer.
     */
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
        stringValue(value)
          .toLowerCase()
          .trim();

      if (
        normalized === "mainnet" ||
        normalized === "testnet"
      ) {
        return normalized;
      }
    }

    /*
     * Hostname fallback.
     */
    const hostname =
      window.location.hostname
        .toLowerCase();

    if (
      hostname === "test.albukhr.com" ||
      hostname.startsWith("test.")
    ) {
      return "testnet";
    }

    if (
      hostname === "app.albukhr.com" ||
      hostname.startsWith("app.")
    ) {
      return "mainnet";
    }

    throw new Error(
      "ALBUKHR network could not be determined."
    );
  }

  /* =========================================
     PI SDK
     ========================================= */

  function requirePiSdk() {

    if (
      !window.Pi ||
      typeof window.Pi.authenticate !==
        "function" ||
      typeof window.Pi.createPayment !==
        "function"
    ) {

      throw new Error(
        "Pi SDK is not available. Open ALBUKHR inside Pi Browser."
      );
    }

    return window.Pi;
  }

  /* =========================================
     ADMIN AUTH
     ========================================= */

  async function getAdminAccessToken() {

    /*
     * Admin authentication belongs to the
     * shared admin-auth-core.js layer.
     */
    if (
      typeof window.getAlbukhrAdminSupabaseClient !==
      "function"
    ) {

      throw new Error(
        "ALBUKHR Admin Auth Core is not loaded."
      );
    }

    const client =
      window.getAlbukhrAdminSupabaseClient();

    if (
      !client ||
      !client.auth ||
      typeof client.auth.getSession !==
        "function"
    ) {

      throw new Error(
        "ALBUKHR Admin Auth Core returned an invalid client."
      );
    }

    const {
      data,
      error
    } =
      await client.auth.getSession();

    if (
      error ||
      !data?.session?.access_token
    ) {

      throw new Error(
        "Administrator session has expired. Please sign in again."
      );
    }

    return data.session.access_token;
  }

  /* =========================================
     BACKEND REQUEST
     ========================================= */

  async function postTreasuryRequest(
    body
  ) {

    const token =
      await getAdminAccessToken();

    const response =
      await fetch(
        ENDPOINT,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "Accept":
              "application/json",

            "Authorization":
              `Bearer ${token}`
          },

          body:
            JSON.stringify(body)
        }
      );

    const contentType =
      response.headers.get(
        "content-type"
      ) || "";

    let data = null;

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

    if (
      !response.ok ||
      !data?.success
    ) {

      throw new Error(
        data?.error ||
        data?.message ||
        `Payment backend HTTP ${response.status}`
      );
    }

    return data;
  }

  /* =========================================
     INCOMPLETE PAYMENT RESOLUTION
     ========================================= */

  async function resolveIncompletePayment(
    payment,
    network
  ) {

    const paymentId =
      payment?.identifier ||
      payment?.paymentId;

    if (!paymentId) {
      return;
    }

    try {

      await postTreasuryRequest({
        action:
          "resolve_incomplete",

        paymentId,

        network
      });

    } catch (error) {

      /*
       * This callback must not turn an
       * unrelated Pi authentication flow
       * into a hard failure.
       */
      console.warn(
        "ALBUKHR incomplete payment resolution failed:",
        error
      );
    }
  }

  /* =========================================
     PI AUTHENTICATION
     ========================================= */

  async function authenticatePioneer(
    network
  ) {

    const Pi =
      requirePiSdk();

    /*
     * Authentication is deliberately kept
     * here at the payment boundary because
     * Pi payment callbacks need the Pi
     * access token supplied by authentication.
     *
     * No LocalStorage is used.
     */
    const auth =
      await Pi.authenticate(
        ["username"],

        payment =>
          resolveIncompletePayment(
            payment,
            network
          )
      );

    if (
      !auth?.accessToken ||
      !auth?.user?.uid
    ) {

      throw new Error(
        "Pi authentication failed."
      );
    }

    return auth;
  }

  /* =========================================
     PAYMENT CREATION
     ========================================= */

  function createPiPayment({
    amount,
    memo,
    metadata,
    accessToken,
    network
  }) {

    const Pi =
      requirePiSdk();

    return new Promise(
      (resolve, reject) => {

        let settled = false;

        function fail(error) {

          if (settled) return;

          settled = true;
          paymentBusy = false;

          reject(
            error instanceof Error
              ? error
              : new Error(
                  stringValue(
                    error,
                    "Pi payment failed."
                  )
                )
          );
        }

        function succeed(result) {

          if (settled) return;

          settled = true;
          paymentBusy = false;

          resolve(result);
        }

        try {

          const payment =
            Pi.createPayment(
              {
                amount,
                memo,
                metadata
              },

              {

                /* =========================
                   SERVER APPROVAL
                ========================= */

                onReadyForServerApproval:
                  async paymentId => {

                    try {

                      if (!paymentId) {

                        throw new Error(
                          "Pi payment ID is missing."
                        );
                      }

                      await postTreasuryRequest({
                        action:
                          "approve",

                        paymentId,

                        accessToken,

                        network,

                        metadata
                      });

                    } catch (error) {

                      console.error(
                        "ALBUKHR treasury payment approval failed:",
                        error
                      );

                      fail(error);
                    }
                  },

                /* =========================
                   SERVER COMPLETION
                ========================= */

                onReadyForServerCompletion:
                  async (
                    paymentId,
                    txid
                  ) => {

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

                      const result =
                        await postTreasuryRequest({
                          action:
                            "complete",

                          paymentId,

                          txid,

                          accessToken,

                          network,

                          metadata
                        });

                      succeed({
                        success:
                          true,

                        paymentId,

                        txid,

                        network,

                        treasury:
                          result.treasury,

                        transaction:
                          result.transaction,

                        payment:
                          result.payment
                      });

                    } catch (error) {

                      console.error(
                        "ALBUKHR treasury payment completion failed:",
                        error
                      );

                      fail(error);
                    }
                  },

                /* =========================
                   USER CANCEL
                ========================= */

                onCancel:
                  paymentId => {

                    console.warn(
                      "ALBUKHR Pi payment cancelled:",
                      paymentId
                    );

                    fail(
                      new Error(
                        "Pi payment was cancelled."
                      )
                    );
                  },

                /* =========================
                   PI ERROR
                ========================= */

                onError:
                  error => {

                    console.error(
                      "ALBUKHR Pi treasury payment error:",
                      error
                    );

                    fail(
                      error?.message
                        ? new Error(
                            error.message
                          )
                        : new Error(
                            "Pi payment failed."
                          )
                    );
                  }
              }
            );

          /*
           * Some Pi SDK implementations return
           * a Promise from createPayment. Others
           * rely entirely on callbacks.
           *
           * Supporting both avoids an
           * implementation-specific rejection
           * from becoming an unhandled promise.
           */
          if (
            payment &&
            typeof payment.catch ===
              "function"
          ) {

            payment.catch(fail);
          }

        } catch (error) {

          fail(error);
        }
      }
    );
  }

  /* =========================================
     ADD PROJECT LIQUIDITY
     ========================================= */

  async function addProjectLiquidityWithPiPayment(
    context = {}
  ) {

    if (paymentBusy) {

      return {
        success:
          false,

        error:
          "Another Pi payment is already processing."
      };
    }

    const amount =
      numberValue(
        context.amount
      );

    const projectCode =
      stringValue(
        context.project_code
      ).trim();

    if (amount <= 0) {

      return {
        success:
          false,

        error:
          "Invalid Pi liquidity amount."
      };
    }

    if (!projectCode) {

      return {
        success:
          false,

        error:
          "Project code is required."
      };
    }

    let currentNetwork;

    try {

      currentNetwork =
        getNetwork();

    } catch (error) {

      return {
        success:
          false,

        error:
          error.message
      };
    }

    if (
      context.network &&
      context.network !==
        currentNetwork
    ) {

      return {
        success:
          false,

        error:
          `Network mismatch: current environment is ${currentNetwork}.`
      };
    }

    paymentBusy = true;

    try {

      /*
       * Pioneer authentication.
       */
      const auth =
        await authenticatePioneer(
          currentNetwork
        );

      /*
       * Metadata is sent to the backend.
       * Treasury writes remain server-side.
       */
      const metadata = {

        albukhr_version:
          ALBUKHR_VERSION,

        action:
          "add_liquidity",

        project_code:
          projectCode,

        project_name:
          stringValue(
            context.project_name ||
            projectCode
          ),

        project_type:
          stringValue(
            context.project_type ||
            "core"
          ),

        network:
          currentNetwork,

        amount,

        source:
          stringValue(
            context.source ||
            "universal_project_dashboard"
          )
      };

      return await createPiPayment({

        amount,

        memo:
          `${PAYMENT_MEMO_PREFIX}: ${projectCode}`,

        metadata,

        accessToken:
          auth.accessToken,

        network:
          currentNetwork

      });

    } catch (error) {

      paymentBusy = false;

      return {
        success:
          false,

        error:
          error?.message ||
          "Pi liquidity payment failed."
      };
    }
  }

  /* =========================================
     WITHDRAWAL
     ========================================= */

  async function withdrawProjectLiquidityWithPiPayment() {

    return {
      success:
        false,

      error:
        "Pi treasury withdrawal adapter is not enabled yet."
    };
  }

  /* =========================================
     HEALTH
     ========================================= */

  function albukhrPiPaymentHealth() {

    let currentNetwork =
      null;

    let networkError =
      null;

    try {

      currentNetwork =
        getNetwork();

    } catch (error) {

      networkError =
        error.message;
    }

    const piReady =
      !!(
        window.Pi &&
        typeof window.Pi.authenticate ===
          "function" &&
        typeof window.Pi.createPayment ===
          "function"
      );

    const adminAuthReady =
      typeof window.getAlbukhrAdminSupabaseClient ===
        "function";

    return {

      ready:
        piReady &&
        adminAuthReady &&
        !networkError,

      pi_sdk_ready:
        piReady,

      admin_auth_core_ready:
        adminAuthReady,

      network:
        currentNetwork,

      payment_busy:
        paymentBusy,

      endpoint:
        ENDPOINT,

      network_error:
        networkError
    };
  }

  /* =========================================
     PUBLIC API
     ========================================= */

  const TreasuryPaymentAdapter = {

    addProjectLiquidityWithPiPayment,

    withdrawProjectLiquidityWithPiPayment,

    albukhrPiPaymentHealth,

    getNetwork,

    authenticatePioneer
  };

  window.AlbukhrProjectTreasuryPayment =
    TreasuryPaymentAdapter;

  /*
   * Backward-compatible public names.
   */
  window.addProjectLiquidityWithPiPayment =
    addProjectLiquidityWithPiPayment;

  window.withdrawProjectLiquidityWithPiPayment =
    withdrawProjectLiquidityWithPiPayment;

  window.albukhrPiPaymentHealth =
    albukhrPiPaymentHealth;

  /*
   * Signal that the adapter is available.
   */
  window.dispatchEvent(
    new CustomEvent(
      "albukhrProjectTreasuryPaymentReady"
    )
  );

})();
