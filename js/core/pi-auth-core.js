/* =========================================
   ALBUKHR PI AUTH CORE v2.1
   File:
   js/core/pi-auth-core.js

   PURPOSE:
   - Stable Pi SDK loading / initialization
   - Shared Pi authentication
   - Shared in-memory authenticated-user state
   - Mainnet/Testnet-aware Pi initialization
   - No LocalStorage authentication persistence
   - No Supabase credentials
   - No page-specific redirect logic

   REPAIR:
   - Waits for the official Pi SDK before Pi.init().
   - Dynamically loads the official SDK when necessary.
   - Retries transient authentication/startup failures.
   - Does not convert SDK startup failure into an automatic
     redirect through requireAuth().
========================================= */

"use strict";

(() => {

  const PI_SDK_VERSION = "2.0";
  const PI_SDK_URL = "https://sdk.minepi.com/pi-sdk.js";

  const SDK_WAIT_TIMEOUT_MS = 15000;
  const SDK_POLL_MS = 100;
  const AUTH_RETRIES = 2;
  const AUTH_RETRY_DELAY_MS = 700;

  let initialized = false;
  let initializedNetwork = null;
  let initializing = null;
  let authenticating = null;
  let currentUser = null;
  let sdkLoadPromise = null;

  function getEnvironment() {
    try {
      if (typeof window.getAlbukhrNetwork === "function") {
        const resolved = window.getAlbukhrNetwork();
        if (resolved === "mainnet" || resolved === "testnet") {
          return resolved;
        }
      }
    } catch (_) {}

    const hostname =
      String(window.location.hostname || "").trim().toLowerCase();

    if (
      hostname === "test.albukhr.com" ||
      hostname.startsWith("test.") ||
      hostname === "dev.albukhr.com" ||
      hostname.startsWith("dev.")
    ) {
      return "testnet";
    }

    return "mainnet";
  }

  function isSandboxEnvironment() {
    return getEnvironment() === "testnet";
  }

  function getPiSDK() {
    if (typeof window === "undefined") return null;

    return (
      window.Pi &&
      typeof window.Pi === "object"
    )
      ? window.Pi
      : null;
  }

  function isPiSDKReady() {
    const Pi = getPiSDK();

    return !!(
      Pi &&
      typeof Pi.init === "function" &&
      typeof Pi.authenticate === "function"
    );
  }

  function requirePiSDK() {
    const Pi = getPiSDK();

    if (!Pi) {
      throw new Error(
        "Pi SDK is unavailable. Open ALBUKHR inside Pi Browser."
      );
    }

    if (typeof Pi.init !== "function") {
      throw new Error(
        "Pi SDK initialization API is unavailable."
      );
    }

    if (typeof Pi.authenticate !== "function") {
      throw new Error(
        "Pi SDK authentication API is unavailable."
      );
    }

    return Pi;
  }

  function loadPiSDK() {
    if (isPiSDKReady()) {
      return Promise.resolve(getPiSDK());
    }

    if (sdkLoadPromise) {
      return sdkLoadPromise;
    }

    sdkLoadPromise = new Promise((resolve, reject) => {
      let settled = false;

      const finishResolve = (Pi) => {
        if (settled) return;
        settled = true;
        resolve(Pi);
      };

      const finishReject = (error) => {
        if (settled) return;
        settled = true;
        reject(
          error instanceof Error
            ? error
            : new Error(String(error || "Unable to load Pi SDK."))
        );
      };

      const started = Date.now();

      const poll = () => {
        if (isPiSDKReady()) {
          finishResolve(getPiSDK());
          return;
        }

        if (Date.now() - started >= SDK_WAIT_TIMEOUT_MS) {
          finishReject(
            new Error(
              "Pi SDK did not become available within the expected time."
            )
          );
          return;
        }

        window.setTimeout(poll, SDK_POLL_MS);
      };

      poll();

      try {
        const existing = document.querySelector(
          'script[data-albukhr-pi-sdk="true"]'
        );

        if (existing) return;

        const script = document.createElement("script");
        script.src = PI_SDK_URL;
        script.async = true;
        script.defer = true;
        script.dataset.albukhrPiSdk = "true";

        script.onload = () => {
          if (isPiSDKReady()) {
            finishResolve(getPiSDK());
          }
        };

        script.onerror = () => {
          console.warn(
            "ALBUKHR: Pi SDK script load reported an error; continuing to wait for Pi Browser SDK."
          );
        };

        (
          document.head ||
          document.documentElement
        ).appendChild(script);

      } catch (error) {
        console.warn(
          "ALBUKHR: Pi SDK dynamic loader failed:",
          error
        );
      }
    }).finally(() => {
      sdkLoadPromise = null;
    });

    return sdkLoadPromise;
  }

  async function initPi() {
    const network = getEnvironment();

    if (
      initialized &&
      initializedNetwork === network &&
      isPiSDKReady()
    ) {
      return true;
    }

    if (initializing) {
      return initializing;
    }

    initializing = (async () => {
      try {
        const Pi = await loadPiSDK();

        if (!Pi) {
          throw new Error("Pi SDK object was not returned.");
        }

        const sandbox = network === "testnet";

        Pi.init({
          version: PI_SDK_VERSION,
          sandbox
        });

        initialized = true;
        initializedNetwork = network;

        console.log(
          "ALBUKHR Pi SDK initialized:",
          {
            version: PI_SDK_VERSION,
            network,
            sandbox
          }
        );

        return true;

      } catch (error) {
        initialized = false;
        initializedNetwork = null;

        console.error(
          "ALBUKHR Pi initialization failed:",
          error
        );

        return false;

      } finally {
        initializing = null;
      }
    })();

    return initializing;
  }

  function normalizeUser(auth) {
    if (!auth) return null;

    const source = auth.user || auth;

    const uid =
      source.uid ||
      auth.uid ||
      "";

    const username =
      source.username ||
      auth.username ||
      "";

    const walletAddress =
      source.wallet_address ||
      source.walletAddress ||
      auth.wallet_address ||
      auth.walletAddress ||
      "";

    if (!uid) return null;

    return {
      uid: String(uid),
      username: username ? String(username) : "",
      wallet_address: walletAddress
        ? String(walletAddress)
        : ""
    };
  }

  function handleIncompletePayment(payment) {
    console.log(
      "ALBUKHR Pi incomplete payment:",
      payment
    );

    try {
      window.dispatchEvent(
        new CustomEvent(
          "albukhrPiIncompletePayment",
          { detail: payment }
        )
      );
    } catch (error) {
      console.warn(
        "ALBUKHR payment event dispatch failed:",
        error
      );
    }
  }

  async function authenticateOnce() {
    const ready = await initPi();

    if (!ready) {
      throw new Error("Pi SDK initialization failed.");
    }

    const Pi = requirePiSDK();

    const scopes = [
      "username",
      "payments",
      "wallet_address"
    ];

    const auth = await Pi.authenticate(
      scopes,
      handleIncompletePayment
    );

    console.log(
      "ALBUKHR Pi authentication response:",
      auth
    );

    const user = normalizeUser(auth);

    if (!user?.uid) {
      throw new Error(
        "Pi authentication returned no valid UID."
      );
    }

    return {
      ...user,
      network: getEnvironment(),
      accessToken: auth?.accessToken || ""
    };
  }

  async function ensurePiAuth() {
    if (currentUser) {
      if (currentUser.network === getEnvironment()) {
        return currentUser;
      }

      currentUser = null;
    }

    if (authenticating) {
      return authenticating;
    }

    authenticating = (async () => {
      let lastError = null;

      try {
        for (
          let attempt = 0;
          attempt <= AUTH_RETRIES;
          attempt++
        ) {
          try {
            const user = await authenticateOnce();

            currentUser = Object.freeze(user);

            console.log(
              "ALBUKHR authenticated user:",
              currentUser
            );

            try {
              window.dispatchEvent(
                new CustomEvent(
                  "albukhrAuthChanged",
                  { detail: currentUser }
                )
              );
            } catch (eventError) {
              console.warn(
                "ALBUKHR auth event dispatch failed:",
                eventError
              );
            }

            return currentUser;

          } catch (error) {
            lastError = error;

            console.warn(
              `ALBUKHR authentication attempt ${attempt + 1} failed:`,
              error
            );

            if (attempt < AUTH_RETRIES) {
              await new Promise((resolve) => {
                window.setTimeout(
                  resolve,
                  AUTH_RETRY_DELAY_MS
                );
              });
            }
          }
        }

        currentUser = null;

        console.error(
          "ALBUKHR Pi authentication failed after retries:",
          lastError
        );

        try {
          window.dispatchEvent(
            new CustomEvent(
              "albukhrAuthFailed",
              {
                detail: {
                  error:
                    lastError?.message ||
                    String(
                      lastError ||
                      "Pi authentication failed."
                    )
                }
              }
            )
          );
        } catch (_) {}

        return null;

      } finally {
        authenticating = null;
      }
    })();

    return authenticating;
  }

  function getCurrentUser() {
    return currentUser;
  }

  function isAuthenticated() {
    return Boolean(currentUser?.uid);
  }

  async function requireAuth(options = {}) {
    /*
     * Redirect is now opt-in.
     * Page controllers should call ensurePiAuth()
     * when they want authentication without a forced
     * navigation.
     */
    const redirect = options.redirect === true;

    if (isAuthenticated()) {
      return currentUser;
    }

    const user = await ensurePiAuth();

    if (user) {
      return user;
    }

    if (
      redirect &&
      typeof window !== "undefined"
    ) {
      const loginPage =
        options.loginPage || "login.html";

      window.location.replace(loginPage);
    }

    return null;
  }

  function clearAuth() {
    currentUser = null;

    try {
      window.dispatchEvent(
        new CustomEvent(
          "albukhrAuthChanged",
          { detail: null }
        )
      );
    } catch (_) {}
  }

  async function logout() {
    clearAuth();
    return true;
  }

  function getNetwork() {
    return getEnvironment();
  }

  function isInitialized() {
    return initialized;
  }

  function getAuthStatus() {
    return {
      initialized,
      initializedNetwork,
      currentNetwork: getEnvironment(),
      sdkReady: isPiSDKReady(),
      authenticated: isAuthenticated(),
      uid: currentUser?.uid || null,
      username: currentUser?.username || null
    };
  }

  window.AlbukhrPiAuth = {
    initPi,
    loadPiSDK,
    ensurePiAuth,
    getCurrentUser,
    isAuthenticated,
    requireAuth,
    clearAuth,
    logout,
    getNetwork,
    isInitialized,
    isPiSDKReady,
    getAuthStatus
  };

  window.initPi = initPi;
  window.ensurePiAuth = ensurePiAuth;
  window.getCurrentUser = getCurrentUser;
  window.isPiSDKReady = isPiSDKReady;
  window.getAlbukhrPiAuthStatus = getAuthStatus;

  function preparePiSDK() {
    loadPiSDK()
      .then(() => initPi())
      .catch((error) => {
        console.warn(
          "ALBUKHR Pi SDK preparation failed:",
          error
        );
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      preparePiSDK,
      { once: true }
    );
  } else {
    preparePiSDK();
  }

})();
