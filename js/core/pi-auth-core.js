/* =========================================
   ALBUKHR PI AUTH CORE
   File:
   js/core/pi-auth-core.js

   Responsibilities:
   - Pi SDK initialization
   - Pi authentication
   - Shared authenticated-user state
   - Environment-aware Pi initialization
   - Auth guards
   - No localStorage auth persistence
   - No Supabase credentials
   - No page-specific authentication logic
========================================= */

"use strict";

(() => {

  let initialized = false;
  let initializing = null;
  let authenticating = null;
  let currentUser = null;

  const PI_SDK_VERSION = "2.0";

  function getEnvironment() {
    const candidates = [
      window.AlbukhrEnvironment?.current,
      window.AlbukhrEnvironment?.network,
      window.AlbukhrNetwork?.current,
      window.AlbukhrNetwork?.network,
      window.ALBUKHR_NETWORK,
      document.documentElement?.dataset?.network,
      document.body?.dataset?.network
    ];

    for (const value of candidates) {
      const normalized = String(value || "").toLowerCase().trim();

      if (normalized === "mainnet" || normalized === "testnet") {
        return normalized;
      }
    }

    const hostname = window.location.hostname.toLowerCase();

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
    return typeof window.Pi === "undefined"
      ? null
      : window.Pi;
  }

  function requirePiSDK() {
    const Pi = getPiSDK();

    if (!Pi) {
      throw new Error(
        "Pi SDK is unavailable. Please open ALBUKHR inside Pi Browser."
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

  async function initPi() {
    if (initialized) return true;
    if (initializing) return initializing;

    initializing = (async () => {
      try {
        const Pi = requirePiSDK();
        const sandbox = isSandboxEnvironment();

        Pi.init({
          version: PI_SDK_VERSION,
          sandbox
        });

        initialized = true;

        console.log(
          "ALBUKHR Pi SDK initialized:",
          {
            version: PI_SDK_VERSION,
            network: getEnvironment(),
            sandbox
          }
        );

        return true;
      } catch (error) {
        initialized = false;

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
      wallet_address: walletAddress ? String(walletAddress) : ""
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

  async function ensurePiAuth() {
    if (currentUser) return currentUser;
    if (authenticating) return authenticating;

    authenticating = (async () => {
      try {
        const ready = await initPi();

        if (!ready) {
          throw new Error(
            "Pi SDK initialization failed."
          );
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
            "Pi authentication succeeded but no valid UID was returned."
          );
        }

        currentUser = Object.freeze({
          ...user,
          network: getEnvironment()
        });

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
        console.error(
          "ALBUKHR Pi authentication failed:",
          error
        );

        currentUser = null;
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
    const redirect = options.redirect !== false;

    if (isAuthenticated()) {
      return currentUser;
    }

    const user = await ensurePiAuth();

    if (user) {
      return user;
    }

    if (redirect && typeof window !== "undefined") {
      const loginPage = options.loginPage || "login.html";
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
    } catch (_) {
      /* Ignore event errors */
    }
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

  window.AlbukhrPiAuth = {
    initPi,
    ensurePiAuth,
    getCurrentUser,
    isAuthenticated,
    requireAuth,
    clearAuth,
    logout,
    getNetwork,
    isInitialized
  };

  /*
   * Temporary compatibility aliases while
   * remaining ALBUKHR engines are migrated.
   */
  window.initPi = initPi;
  window.ensurePiAuth = ensurePiAuth;
  window.getCurrentUser = getCurrentUser;

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      initPi();
    },
    { once: true }
  );

})();
