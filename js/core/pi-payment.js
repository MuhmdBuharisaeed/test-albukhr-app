/* =========================================================
   ALBUKHR PI PAYMENT ENGINE v4
   js/core/pi-payment.js

   USER FOUNDATION
   - Start Pi payments
   - Shared Pi authentication
   - Shared Pi SDK initialization
   - Environment-aware backend resolution
   - Approve/complete through ALBUKHR backend
   - No LocalStorage/sessionStorage
   - No Supabase client
   - No credentials/secrets
========================================================= */

"use strict";

(() => {
  let paymentInProgress = false;

  function getAuthCore() {
    if (!window.AlbukhrPiAuth) {
      throw new Error(
        "ALBUKHR Pi Auth Core is unavailable. Load pi-auth-core.js first."
      );
    }
    return window.AlbukhrPiAuth;
  }

  async function getAuthenticatedUser() {
    const auth = getAuthCore();
    const user = await auth.ensurePiAuth();

    if (!user?.uid) {
      throw new Error("Pi authentication required.");
    }

    return user;
  }

  function getPiSdk() {
    if (
      !window.Pi ||
      typeof window.Pi.createPayment !== "function"
    ) {
      throw new Error(
        "Pi SDK is unavailable. Make sure Pi SDK is loaded before payment."
      );
    }

    return window.Pi;
  }

  function getCurrentNetwork() {
    if (typeof window.getAlbukhrNetwork !== "function") {
      throw new Error(
        "ALBUKHR environment-switcher.js is not loaded."
      );
    }
    return window.getAlbukhrNetwork();
  }

  function getPaymentConfig() {
    const network = getCurrentNetwork();
    const config = window.AlbukhrPaymentConfig;

    if (config && typeof config === "object") {
      const networkConfig = config[network];

      if (networkConfig?.apiBaseUrl) {
        return {
          network,
          apiBaseUrl: String(networkConfig.apiBaseUrl).replace(/\/+$/, "")
        };
      }
    }

    /*
     * Existing testnet endpoint retained for migration compatibility.
     * Mainnet intentionally has no invented/default endpoint.
     */
    if (network === "testnet") {
      return {
        network,
        apiBaseUrl: "https://test-albukhr-api.onrender.com"
      };
    }

    throw new Error(
      "ALBUKHR Mainnet payment API is not configured in window.AlbukhrPaymentConfig."
    );
  }

  function getApiUrl(action) {
    if (!["approve", "complete"].includes(action)) {
      throw new Error("Invalid Pi payment server action.");
    }

    return `${getPaymentConfig().apiBaseUrl}/${action}`;
  }

  async function callPaymentServer(action, payload) {
    const response = await fetch(getApiUrl(action), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    });

    let data;
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = {
        success: response.ok,
        message: await response.text()
      };
    }

    if (!response.ok || data?.success === false) {
      throw new Error(
        data?.error ||
        data?.message ||
        `Payment server returned HTTP ${response.status}.`
      );
    }

    return data;
  }

  function validatePaymentInput({ amount, memo }) {
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new Error("A valid Pi payment amount is required.");
    }

    if (
      memo !== undefined &&
      memo !== null &&
      typeof memo !== "string"
    ) {
      throw new Error("Payment memo must be text.");
    }

    return {
      amount: numericAmount,
      memo: String(memo ?? "").trim()
    };
  }

  function buildMetadata({ user, metadata }) {
    return {
      userId: user.uid,
      ...(metadata && typeof metadata === "object" ? metadata : {})
    };
  }

  async function startPiPayment({
    amount,
    memo,
    metadata = {}
  } = {}) {
    if (paymentInProgress) {
      throw new Error("A Pi payment is already in progress.");
    }

    const payment = validatePaymentInput({ amount, memo });
    paymentInProgress = true;

    try {
      const user = await getAuthenticatedUser();
      const Pi = getPiSdk();
      const network = getCurrentNetwork();

      const paymentMetadata = buildMetadata({
        user,
        metadata
      });

      return await new Promise((resolve, reject) => {
        let settled = false;

        const resolveOnce = (value) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };

        const rejectOnce = (error) => {
          if (settled) return;
          settled = true;
          reject(
            error instanceof Error
              ? error
              : new Error(String(error || "Pi payment failed."))
          );
        };

        try {
          const sdkResult = Pi.createPayment(
            {
              amount: payment.amount,
              memo: payment.memo,
              metadata: paymentMetadata
            },
            {
              onReadyForServerApproval: async (paymentId) => {
                try {
                  if (!paymentId) {
                    throw new Error("Pi payment ID is missing.");
                  }

                  await callPaymentServer("approve", {
                    paymentId,
                    network
                  });
                } catch (error) {
                  console.error(
                    "ALBUKHR Pi approval error:",
                    error
                  );
                  rejectOnce(error);
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

                  const server = await callPaymentServer("complete", {
                    paymentId,
                    txid,
                    network
                  });

                  resolveOnce({
                    paymentId,
                    txid,
                    network,
                    server
                  });
                } catch (error) {
                  console.error(
                    "ALBUKHR Pi completion error:",
                    error
                  );
                  rejectOnce(error);
                }
              },

              onCancel: (paymentId) => {
                rejectOnce(
                  new Error(
                    `User cancelled the Pi payment${paymentId ? ` (${paymentId})` : ""}.`
                  )
                );
              },

              onError: (error) => {
                rejectOnce(
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
            sdkResult.catch(rejectOnce);
          }
        } catch (error) {
          rejectOnce(error);
        }
      });
    } finally {
      paymentInProgress = false;
    }
  }

  function isPaymentInProgress() {
    return paymentInProgress;
  }

  window.AlbukhrPiPayment = Object.freeze({
    startPiPayment,
    isPaymentInProgress,
    getCurrentNetwork,
    getPaymentConfig,
    getApiUrl
  });

  window.startPiPayment = startPiPayment;

  window.dispatchEvent(
    new CustomEvent("albukhrPiPaymentReady")
  );
})();
