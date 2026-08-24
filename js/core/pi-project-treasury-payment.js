/* =========================================================
   ALBUKHR PI PROJECT TREASURY PAYMENT ADAPTER v4
   js/core/pi-project-treasury-payment.js

   USER/TREASURY FOUNDATION
   U2A: Pioneer -> ALBUKHR App

   - Uses shared Pi Auth Core.
   - Uses shared environment resolver.
   - Sends treasury mutations to backend only.
   - Never writes treasury rows directly.
   - Never uses LocalStorage/sessionStorage.
   - No Supabase client/credentials in this adapter.
   - No duplicate Pi authentication implementation.
========================================================= */

"use strict";

(() => {
  const ENDPOINT = "/api/pi-project-treasury-payment";
  const PAYMENT_MEMO_PREFIX = "ALBUKHR liquidity";
  const ALBUKHR_VERSION = "1.0.0";

  let paymentBusy = false;

  function stringValue(value, fallback = "") {
    return value == null ? fallback : String(value);
  }

  function numberValue(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function getNetwork() {
    if (typeof window.getAlbukhrNetwork !== "function") {
      throw new Error(
        "ALBUKHR environment-switcher.js is not loaded."
      );
    }
    return window.getAlbukhrNetwork();
  }

  function requirePiAuthCore() {
    if (!window.AlbukhrPiAuth) {
      throw new Error(
        "ALBUKHR Pi Auth Core is not loaded."
      );
    }
    return window.AlbukhrPiAuth;
  }

  function requirePiSdk() {
    if (
      !window.Pi ||
      typeof window.Pi.createPayment !== "function"
    ) {
      throw new Error(
        "Pi SDK is not available. Open ALBUKHR inside Pi Browser."
      );
    }
    return window.Pi;
  }

  /*
   * Backend authorization is based on the shared Pi auth context.
   * The previous version incorrectly required an administrator Supabase
   * session for a Pioneer -> App liquidity operation.
   */
  async function getPioneerAuth() {
    const authCore = requirePiAuthCore();
    const user = await authCore.ensurePiAuth();

    if (!user?.uid) {
      throw new Error("Pi authentication required.");
    }

    const accessToken = authCore.getAccessToken();

    if (!accessToken) {
      throw new Error(
        "Pi access token is unavailable. Please authenticate again."
      );
    }

    return {
      user,
      accessToken
    };
  }

  async function postTreasuryRequest(body, accessToken) {
    if (!accessToken) {
      throw new Error("Pi access token is required.");
    }

    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify(body)
    });

    const contentType = response.headers.get("content-type") || "";
    let data;

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = {
        success: response.ok,
        message: await response.text()
      };
    }

    if (!response.ok || !data?.success) {
      throw new Error(
        data?.error ||
        data?.message ||
        `Treasury backend HTTP ${response.status}.`
      );
    }

    return data;
  }

  async function resolveIncompletePayment(payment) {
    const paymentId =
      payment?.identifier ||
      payment?.paymentId;

    if (!paymentId) return;

    try {
      const authCore = requirePiAuthCore();
      const accessToken = authCore.getAccessToken();

      if (!accessToken) return;

      await postTreasuryRequest(
        {
          action: "resolve_incomplete",
          paymentId,
          network: getNetwork()
        },
        accessToken
      );
    } catch (error) {
      console.warn(
        "ALBUKHR incomplete payment resolution failed:",
        error
      );
    }
  }

  function createPiPayment({
    amount,
    memo,
    metadata,
    accessToken,
    network
  }) {
    const Pi = requirePiSdk();

    return new Promise((resolve, reject) => {
      let settled = false;

      const fail = (error) => {
        if (settled) return;
        settled = true;
        paymentBusy = false;
        reject(
          error instanceof Error
            ? error
            : new Error(
                stringValue(error, "Pi payment failed.")
              )
        );
      };

      const succeed = (result) => {
        if (settled) return;
        settled = true;
        paymentBusy = false;
        resolve(result);
      };

      try {
        const sdkResult = Pi.createPayment(
          {
            amount,
            memo,
            metadata
          },
          {
            onReadyForServerApproval: async (paymentId) => {
              try {
                if (!paymentId) {
                  throw new Error("Pi payment ID is missing.");
                }

                await postTreasuryRequest(
                  {
                    action: "approve",
                    paymentId,
                    network,
                    metadata
                  },
                  accessToken
                );
              } catch (error) {
                console.error(
                  "ALBUKHR treasury payment approval failed:",
                  error
                );
                fail(error);
              }
            },

            onReadyForServerCompletion: async (paymentId, txid) => {
              try {
                if (!paymentId) {
                  throw new Error("Pi payment ID is missing.");
                }

                if (!txid) {
                  throw new Error("Pi transaction ID is missing.");
                }

                const result = await postTreasuryRequest(
                  {
                    action: "complete",
                    paymentId,
                    txid,
                    network,
                    metadata
                  },
                  accessToken
                );

                succeed({
                  success: true,
                  paymentId,
                  txid,
                  network,
                  treasury: result.treasury,
                  transaction: result.transaction,
                  payment: result.payment
                });
              } catch (error) {
                console.error(
                  "ALBUKHR treasury payment completion failed:",
                  error
                );
                fail(error);
              }
            },

            onCancel: (paymentId) => {
              fail(
                new Error(
                  `Pi payment was cancelled${paymentId ? ` (${paymentId})` : ""}.`
                )
              );
            },

            onError: (error) => {
              fail(
                error instanceof Error
                  ? error
                  : new Error(
                      error?.message || "Pi payment failed."
                    )
              );
            }
          }
        );

        if (sdkResult && typeof sdkResult.catch === "function") {
          sdkResult.catch(fail);
        }
      } catch (error) {
        fail(error);
      }
    });
  }

  async function addProjectLiquidityWithPiPayment(context = {}) {
    if (paymentBusy) {
      return {
        success: false,
        error: "Another Pi payment is already processing."
      };
    }

    const amount = numberValue(context.amount);
    const projectCode =
      stringValue(context.project_code).trim();

    if (amount <= 0) {
      return {
        success: false,
        error: "Invalid Pi liquidity amount."
      };
    }

    if (!projectCode) {
      return {
        success: false,
        error: "Project code is required."
      };
    }

    let currentNetwork;

    try {
      currentNetwork = getNetwork();
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }

    if (
      context.network &&
      context.network !== currentNetwork
    ) {
      return {
        success: false,
        error:
          `Network mismatch: current environment is ${currentNetwork}.`
      };
    }

    paymentBusy = true;

    try {
      const { user, accessToken } = await getPioneerAuth();

      const metadata = {
        albukhr_version: ALBUKHR_VERSION,
        action: "add_liquidity",
        user_id: user.uid,
        project_code: projectCode,
        project_name: stringValue(
          context.project_name || projectCode
        ),
        project_type: stringValue(
          context.project_type || "core"
        ),
        network: currentNetwork,
        amount,
        source: stringValue(
          context.source || "universal_project_dashboard"
        )
      };

      return await createPiPayment({
        amount,
        memo: `${PAYMENT_MEMO_PREFIX}: ${projectCode}`,
        metadata,
        accessToken,
        network: currentNetwork
      });
    } catch (error) {
      paymentBusy = false;
      return {
        success: false,
        error:
          error?.message ||
          "Pi liquidity payment failed."
      };
    }
  }

  async function withdrawProjectLiquidityWithPiPayment() {
    return {
      success: false,
      error: "Pi treasury withdrawal adapter is not enabled yet."
    };
  }

  function albukhrPiPaymentHealth() {
    let currentNetwork = null;
    let networkError = null;

    try {
      currentNetwork = getNetwork();
    } catch (error) {
      networkError = error.message;
    }

    const piReady = Boolean(
      window.Pi &&
      typeof window.Pi.authenticate === "function" &&
      typeof window.Pi.createPayment === "function"
    );

    const authCoreReady = Boolean(window.AlbukhrPiAuth);

    return {
      ready:
        piReady &&
        authCoreReady &&
        !networkError,
      pi_sdk_ready: piReady,
      pi_auth_core_ready: authCoreReady,
      network: currentNetwork,
      payment_busy: paymentBusy,
      endpoint: ENDPOINT,
      network_error: networkError
    };
  }

  window.AlbukhrProjectTreasuryPayment = Object.freeze({
    addProjectLiquidityWithPiPayment,
    withdrawProjectLiquidityWithPiPayment,
    albukhrPiPaymentHealth,
    getNetwork
  });

  window.addProjectLiquidityWithPiPayment =
    addProjectLiquidityWithPiPayment;
  window.withdrawProjectLiquidityWithPiPayment =
    withdrawProjectLiquidityWithPiPayment;
  window.albukhrPiPaymentHealth =
    albukhrPiPaymentHealth;

  /*
   * Incomplete-payment resolution is intentionally exposed only as an
   * adapter method for the Pi auth callback path, not as a page concern.
   */
  window.AlbukhrProjectTreasuryPayment.resolveIncompletePayment =
    resolveIncompletePayment;

  window.dispatchEvent(
    new CustomEvent(
      "albukhrProjectTreasuryPaymentReady"
    )
  );
})();
