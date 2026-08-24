/* =========================================================
   ALBUKHR USER LOGIN CONTROLLER v4
   File:
   js/auth/login.js

   ROLE:
   - User-facing login page controller only.
   - Delegates Pi authentication to js/core/pi-auth-core.js.
   - Does not initialize Pi SDK itself.
   - Does not store authentication state in LocalStorage.
   - Does not create a Supabase client.
   - Does not contain network detection logic.
   - Does not duplicate authentication logic.

   REQUIRED FOUNDATION:
   - js/core/environment-switcher.js
   - js/core/pi-auth-core.js

   DOM CONTRACT:
   - #status

   PUBLIC API:
   - window.AlbukhrUserLogin.login()
   - window.AlbukhrUserLogin.setStatus()
========================================================= */

"use strict";

(() => {

  /* =======================================================
     CONFIG
  ======================================================= */

  const DEFAULT_REDIRECT =
    "index.html";


  /* =======================================================
     STATUS
  ======================================================= */

  function setStatus(message) {

    const status =
      document.getElementById("status");

    if (status) {
      status.textContent =
        String(message ?? "");
    }

    console.log(
      "ALBUKHR Login:",
      message
    );
  }


  /* =======================================================
     FOUNDATION CHECK
  ======================================================= */

  function requirePiAuthCore() {

    if (
      !window.AlbukhrPiAuth ||
      typeof window.AlbukhrPiAuth.ensurePiAuth !==
        "function"
    ) {

      throw new Error(
        "ALBUKHR Pi Auth Core is unavailable. " +
        "Load js/core/pi-auth-core.js before js/auth/login.js."
      );
    }

    return window.AlbukhrPiAuth;
  }


  /* =======================================================
     REDIRECT
  ======================================================= */

  function redirectAfterLogin() {

    const target =
      window.AlbukhrLoginConfig?.redirectAfterLogin ||
      DEFAULT_REDIRECT;

    window.location.replace(
      String(target)
    );
  }


  /* =======================================================
     LOGIN
     -------------------------------------------------------
     All Pi authentication belongs to pi-auth-core.js.
  ======================================================= */

  async function login() {

    try {

      const auth =
        requirePiAuthCore();

      setStatus(
        "🔄 Initializing Pi..."
      );

      /*
       * ensurePiAuth() is responsible for:
       * - Pi SDK availability
       * - Pi SDK initialization
       * - MAINNET/TESTNET sandbox mode
       * - Pi authentication
       * - incomplete-payment callback
       * - shared in-memory authenticated state
       */
      const user =
        await auth.ensurePiAuth();

      if (!user?.uid) {

        throw new Error(
          "Pi authentication did not return a valid user."
        );
      }

      setStatus(
        "✅ Login success: " +
        (
          user.username ||
          user.uid
        )
      );

      /*
       * Give the page one event-loop cycle to
       * render the successful state before
       * navigating away.
       */
      setTimeout(
        redirectAfterLogin,
        300
      );

      return user;

    } catch (error) {

      console.error(
        "ALBUKHR Login Error:",
        error
      );

      setStatus(
        "❌ Login failed: " +
        (
          error?.message ||
          "Unable to authenticate with Pi."
        )
      );

      return null;
    }
  }


  /* =======================================================
     AUTO LOGIN CHECK
     -------------------------------------------------------
     No LocalStorage lookup.
     The shared auth core owns the current
     authenticated state.

     If the page is opened while the shared
     auth core already has an authenticated
     user, redirect immediately.
  ======================================================= */

  function checkExistingAuthentication() {

    try {

      const auth =
        requirePiAuthCore();

      if (
        typeof auth.isAuthenticated !==
          "function" ||
        !auth.isAuthenticated()
      ) {

        return false;
      }

      const user =
        typeof auth.getCurrentUser ===
          "function"
          ? auth.getCurrentUser()
          : null;

      if (!user?.uid) {
        return false;
      }

      setStatus(
        "✅ Already authenticated. Redirecting..."
      );

      setTimeout(
        redirectAfterLogin,
        150
      );

      return true;

    } catch (error) {

      console.warn(
        "ALBUKHR existing authentication check failed:",
        error
      );

      return false;
    }
  }


  /* =======================================================
     PUBLIC API
  ======================================================= */

  window.AlbukhrUserLogin = Object.freeze({

    login,

    setStatus,

    checkExistingAuthentication

  });


  /*
   * Compatibility alias.
   *
   * Existing login.html markup may already call:
   *   login()
   *
   * Keep that public function while the
   * authentication implementation remains
   * centralized in pi-auth-core.js.
   */
  window.login =
    login;


  /* =======================================================
     DOM READY
  ======================================================= */

  function init() {

    /*
     * Do not automatically call Pi.authenticate()
     * here. Login should occur when the user
     * explicitly starts the login flow.
     */
    checkExistingAuthentication();

  }


  if (
    document.readyState ===
      "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );

  } else {

    init();

  }

})();
