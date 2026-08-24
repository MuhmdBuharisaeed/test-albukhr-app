/* =========================================================
   ALBUKHR PI AUTH CORE v4
   js/core/pi-auth-core.js

   USER FOUNDATION
   - Pi SDK initialization
   - Shared Pi authentication
   - In-memory authenticated-user state
   - Environment-aware sandbox mode
   - Auth guards
   - No LocalStorage/sessionStorage persistence
   - No Supabase credentials
   - No page-specific auth logic

   Depends on:
   js/core/environment-switcher.js
========================================================= */

"use strict";

(() => {
  const PI_SDK_VERSION = "2.0";

  let initialized = false;
  let initializing = null;
  let authenticating = null;
  let currentAuth = null;

  function getEnvironment() {
    if (typeof window.getAlbukhrNetwork === "function") {
      return window.getAlbukhrNetwork();
    }

    throw new Error(
      "ALBUKHR environment-switcher.js must load before pi-auth-core.js."
    );
  }

  function isSandboxEnvironment() {
    return getEnvironment() === "testnet";
  }

  function getPiSDK() {
    return typeof window.Pi === "undefined" ? null : window.Pi;
  }

  function requirePiSDK() {
    const Pi = getPiSDK();

    if (!Pi) {
      throw new Error(
        "Pi SDK is unavailable. Please open ALBUKHR inside Pi Browser."
      );
    }

    if (typeof Pi.init !== "function") {
      throw new Error("Pi SDK initialization API is unavailable.");
    }

    if (typeof Pi.authenticate !== "function") {
      throw new Error("Pi SDK authentication API is unavailable.");
    }

    return Pi;
  }

  async function initPi() {
    if (initialized) return true;
    if (initializing) return initializing;

    initializing = (async () => {
      try {
        const Pi = requirePiSDK();
        const network = getEnvironment();

        Pi.init({
          version: PI_SDK_VERSION,
          sandbox: network === "testnet"
        });

        initialized = true;

        console.info("ALBUKHR Pi SDK initialized.", {
          version: PI_SDK_VERSION,
          network,
          sandbox: network === "testnet"
        });

        return true;
      } catch (error) {
        initialized = false;
        console.error("ALBUKHR Pi initialization failed:", error);
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
    const uid = source.uid || auth.uid || "";
    const username = source.username || auth.username || "";
    const walletAddress =
      source.wallet_address ||
      source.walletAddress ||
      auth.wallet_address ||
      auth.walletAddress ||
      "";

    if (!uid) return null;

    return Object.freeze({
      uid: String(uid),
      username: username ? String(username) : "",
      wallet_address: walletAddress ? String(walletAddress) : ""
    });
  }

  function buildAuthState(auth) {
    const user = normalizeUser(auth);
    if (!user?.uid) return null;

    const network = getEnvironment();

    /*
     * accessToken is kept only in memory and is never written to
     * LocalStorage/sessionStorage. It is exposed through getAuthContext()
     * for trusted backend requests that require the Pi auth token.
     */
    return Object.freeze({
      user,
      uid: user.uid,
      username: user.username,
      wallet_address: user.wallet_address,
      accessToken: auth.accessToken
        ? String(auth.accessToken)
        : "",
      network
    });
  }

  function handleIncompletePayment(payment) {
    try {
      window.dispatchEvent(
        new CustomEvent("albukhrPiIncompletePayment", {
          detail: payment
        })
      );
    } catch (error) {
      console.warn(
        "ALBUKHR incomplete payment event failed:",
        error
      );
    }
  }

  async function ensurePiAuth() {
    if (currentAuth?.user?.uid) {
      return currentAuth.user;
    }

    if (authenticating) {
      const authState = await authenticating;
      return authState?.user || null;
    }

    authenticating = (async () => {
      try {
        if (!(await initPi())) {
          throw new Error("Pi SDK initialization failed.");
        }

        const Pi = requirePiSDK();

        const auth = await Pi.authenticate(
          ["username", "payments", "wallet_address"],
          handleIncompletePayment
        );

        const authState = buildAuthState(auth);

        if (!authState) {
          throw new Error(
            "Pi authentication succeeded but no valid UID was returned."
          );
        }

        currentAuth = authState;

        window.dispatchEvent(
          new CustomEvent("albukhrAuthChanged", {
            detail: authState.user
          })
        );

        return authState;
      } catch (error) {
        currentAuth = null;
        console.error("ALBUKHR Pi authentication failed:", error);
        return null;
      } finally {
        authenticating = null;
      }
    })();

    const authState = await authenticating;
    return authState?.user || null;
  }

  function getCurrentUser() {
    return currentAuth?.user || null;
  }

  function getAuthContext() {
    return currentAuth;
  }

  function getAccessToken() {
    return currentAuth?.accessToken || "";
  }

  function isAuthenticated() {
    return Boolean(currentAuth?.user?.uid);
  }

  async function requireAuth(options = {}) {
    const redirect = options.redirect !== false;

    if (isAuthenticated()) {
      return getCurrentUser();
    }

    const user = await ensurePiAuth();

    if (user) return user;

    if (redirect && typeof window !== "undefined") {
      const loginPage = options.loginPage || "login.html";
      window.location.replace(loginPage);
    }

    return null;
  }

  function clearAuth() {
    currentAuth = null;

    try {
      window.dispatchEvent(
        new CustomEvent("albukhrAuthChanged", { detail: null })
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

  window.AlbukhrPiAuth = Object.freeze({
    initPi,
    ensurePiAuth,
    getCurrentUser,
    getAuthContext,
    getAccessToken,
    isAuthenticated,
    requireAuth,
    clearAuth,
    logout,
    getNetwork,
    isInitialized
  });

  /*
   * Compatibility aliases for engines that have not yet migrated.
   */
  window.initPi = initPi;
  window.ensurePiAuth = ensurePiAuth;
  window.getCurrentUser = getCurrentUser;

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => { void initPi(); },
      { once: true }
    );
  } else {
    void initPi();
  }
})();
