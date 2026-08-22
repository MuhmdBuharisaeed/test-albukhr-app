/* =========================================================
   ALBUKHR PI AUTH ENGINE
   Production-Consolidated Supabase Architecture Version
   ---------------------------------------------------------
   ROLE:
   - Pi Browser / Pi SDK authentication boundary
   - Does NOT use localStorage for auth persistence
   - Delegates authoritative application session creation
     to the existing ALBUKHR auth layer
   - Fails closed when the Supabase auth bridge is absent
========================================================= */

(function (window) {
  "use strict";

  if (window.__ALBUKHR_PI_AUTH_ENGINE_LOADED__) {
    console.warn("ALBUKHR Pi Auth Engine already loaded.");
    return;
  }

  window.__ALBUKHR_PI_AUTH_ENGINE_LOADED__ = true;

  const ENGINE_NAME = "ALBUKHR Pi Auth Engine";
  const VERSION = "2.0.0";
  const BUILD = "SUPABASE-FIRST-PI-SDK";

  const PiAuthEngine = {};

  /* =========================================================
     HELPERS
  ========================================================= */

  function safeString(value, fallback = "") {
    if (value === null || value === undefined) {
      return fallback;
    }

    return String(value);
  }

  function setStatus(message) {
    const status = document.getElementById("status");

    if (status) {
      status.textContent = message;
    }

    console.log("[ALBUKHR Pi Auth]", message);
  }

  function getPi() {
    if (
      typeof window.Pi === "undefined" ||
      typeof window.Pi.init !== "function" ||
      typeof window.Pi.authenticate !== "function"
    ) {
      throw new Error(
        "Open ALBUKHR inside Pi Browser to continue."
      );
    }

    return window.Pi;
  }

  function getSupabaseClient() {
    if (
      typeof window.getAlbukhrSupabaseClient === "function"
    ) {
      const client =
        window.getAlbukhrSupabaseClient();

      if (
        client &&
        typeof client.from === "function" &&
        client.auth
      ) {
        return client;
      }
    }

    if (
      window.albukhrSupabase &&
      typeof window.albukhrSupabase.from === "function" &&
      window.albukhrSupabase.auth
    ) {
      return window.albukhrSupabase;
    }

    if (
      window.supabaseClient &&
      typeof window.supabaseClient.from === "function" &&
      window.supabaseClient.auth
    ) {
      return window.supabaseClient;
    }

    throw new Error(
      "ALBUKHR Supabase Core is not initialized."
    );
  }

  function normalizePiUser(auth) {
    const rawUser = auth?.user || auth || {};

    return {
      uid:
        safeString(
          rawUser.uid
        ).trim(),

      username:
        safeString(
          rawUser.username
        ).trim()
    };
  }

  function validatePiUser(user) {
    if (!user.uid) {
      throw new Error(
        "Pi authentication returned an invalid user."
      );
    }

    return user;
  }

  /* =========================================================
     ENVIRONMENT
  ========================================================= */

  function getEnvironment() {
    try {
      if (
        window.AlbukhrEnvironmentSwitcher &&
        typeof window.AlbukhrEnvironmentSwitcher
          .getEnvironment === "function"
      ) {
        return window.AlbukhrEnvironmentSwitcher
          .getEnvironment();
      }
    } catch (error) {
      console.warn(
        ENGINE_NAME +
          ": unable to resolve environment.",
        error
      );
    }

    const host =
      safeString(
        window.location.hostname
      ).toLowerCase();

    if (
      host === "test.albukhr.com" ||
      host.startsWith("test.")
    ) {
      return "testnet";
    }

    return "mainnet";
  }

  function isTestnet() {
    return getEnvironment() === "testnet";
  }

  /* =========================================================
     PI SDK INIT
  ========================================================= */

  function initializePi() {
    const Pi = getPi();

    Pi.init({
      version: "2.0",
      sandbox: isTestnet()
    });

    return Pi;
  }

  /* =========================================================
     INCOMPLETE PAYMENT CALLBACK
  ========================================================= */

  function onIncompletePaymentFound(payment) {
    console.warn(
      ENGINE_NAME +
        ": incomplete Pi payment found.",
      payment
    );

    /*
      Authentication and payment recovery are separate
      responsibilities.

      The payment engine should own recovery/approval/
      completion. This engine deliberately does not mutate
      payment state.
    */

    try {
      if (
        window.AlbukhrPaymentEngine &&
        typeof window.AlbukhrPaymentEngine
          .handleIncompletePayment === "function"
      ) {
        window.AlbukhrPaymentEngine
          .handleIncompletePayment(payment);
      }
    } catch (error) {
      console.warn(
        ENGINE_NAME +
          ": payment recovery handoff failed.",
        error
      );
    }
  }

  /* =========================================================
     SUPABASE AUTH BRIDGE
  ========================================================= */

  async function establishApplicationSession(
    piAuth,
    options = {}
  ) {
    /*
      The existing ALBUKHR architecture makes Supabase the
      authoritative application/auth source.

      Therefore this engine never writes Pi identity to
      localStorage/sessionStorage.

      The auth layer must explicitly accept the verified Pi
      authentication result through one of these contracts:

        window.ALBUKHR_AUTH.loginWithPi(piAuth, options)

      or

        window.AlbukhrAuthEngine.loginWithPi(piAuth, options)

      If neither exists, authentication fails closed instead
      of creating a fake client-side session.
    */

    if (
      window.ALBUKHR_AUTH &&
      typeof window.ALBUKHR_AUTH.loginWithPi === "function"
    ) {
      return await window.ALBUKHR_AUTH.loginWithPi(
        piAuth,
        {
          ...options,
          network: getEnvironment()
        }
      );
    }

    if (
      window.AlbukhrAuthEngine &&
      typeof window.AlbukhrAuthEngine.loginWithPi ===
        "function"
    ) {
      return await window.AlbukhrAuthEngine.loginWithPi(
        piAuth,
        {
          ...options,
          network: getEnvironment()
        }
      );
    }

    /*
      Verify that Supabase Core exists before reporting the
      missing bridge. This prevents silently falling back to
      client-only local persistence.
    */
    getSupabaseClient();

    throw new Error(
      "ALBUKHR Pi authentication bridge is not available. " +
      "Load the Supabase authentication engine with loginWithPi() " +
      "before starting Pi login."
    );
  }

  /* =========================================================
     LOGIN
  ========================================================= */

  async function login(options = {}) {
    const scopes =
      Array.isArray(options.scopes) &&
      options.scopes.length
        ? options.scopes
        : ["username", "payments"];

    try {
      setStatus("Initializing Pi...");

      const Pi = initializePi();

      setStatus("Authenticating...");

      const auth =
        await Pi.authenticate(
          scopes,
          onIncompletePaymentFound
        );

      const user =
        validatePiUser(
          normalizePiUser(auth)
        );

      const session =
        await establishApplicationSession(
          auth,
          options
        );

      setStatus(
        "Login successful" +
          (
            user.username
              ? ": " + user.username
              : "."
          )
      );

      return {
        ok: true,
        environment: getEnvironment(),
        network: getEnvironment(),
        piAuth: auth,
        piUser: user,
        session: session || null
      };

    } catch (error) {
      console.error(
        ENGINE_NAME +
          ": login failed.",
        error
      );

      setStatus(
        safeString(
          error?.message,
          "Login failed."
        )
      );

      return {
        ok: false,
        environment: getEnvironment(),
        network: getEnvironment(),
        error:
          safeString(
            error?.message,
            "Login failed."
          )
      };
    }
  }

  /* =========================================================
     CURRENT SUPABASE SESSION
  ========================================================= */

  async function getSession() {
    const supabase =
      getSupabaseClient();

    const {
      data,
      error
    } =
      await supabase.auth.getSession();

    if (error) {
      throw new Error(
        error.message ||
          "Unable to read Supabase session."
      );
    }

    return data?.session || null;
  }

  async function getCurrentUser() {
    const supabase =
      getSupabaseClient();

    const {
      data,
      error
    } =
      await supabase.auth.getUser();

    if (error) {
      return null;
    }

    return data?.user || null;
  }

  /* =========================================================
     LOGOUT
  ========================================================= */

  async function logout() {
    const supabase =
      getSupabaseClient();

    const {
      error
    } =
      await supabase.auth.signOut();

    if (error) {
      throw new Error(
        error.message ||
          "Unable to sign out."
      );
    }

    setStatus("Signed out.");

    return {
      ok: true
    };
  }

  /* =========================================================
     AUTO LOGIN / SESSION CHECK
  ========================================================= */

  async function checkSession() {
    try {
      const session =
        await getSession();

      if (!session) {
        return {
          authenticated: false,
          session: null,
          user: null,
          network: getEnvironment()
        };
      }

      const user =
        await getCurrentUser();

      return {
        authenticated: !!user,
        session,
        user,
        network: getEnvironment()
      };

    } catch (error) {
      console.error(
        ENGINE_NAME +
          ": session check failed.",
        error
      );

      return {
        authenticated: false,
        session: null,
        user: null,
        network: getEnvironment(),
        error:
          safeString(error?.message)
      };
    }
  }

  /* =========================================================
     PAGE REDIRECT HELPER
  ========================================================= */

  function redirectAfterLogin(
    destination = "index.html"
  ) {
    window.location.assign(
      destination
    );
  }

  /* =========================================================
     PUBLIC API
  ========================================================= */

  PiAuthEngine.VERSION = VERSION;
  PiAuthEngine.BUILD = BUILD;
  PiAuthEngine.ENGINE_NAME = ENGINE_NAME;

  PiAuthEngine.getEnvironment =
    getEnvironment;

  PiAuthEngine.isTestnet =
    isTestnet;

  PiAuthEngine.initializePi =
    initializePi;

  PiAuthEngine.login =
    login;

  PiAuthEngine.getSession =
    getSession;

  PiAuthEngine.getCurrentUser =
    getCurrentUser;

  PiAuthEngine.checkSession =
    checkSession;

  PiAuthEngine.logout =
    logout;

  PiAuthEngine.redirectAfterLogin =
    redirectAfterLogin;

  PiAuthEngine.setStatus =
    setStatus;

  try {
    Object.freeze(
      PiAuthEngine
    );
  } catch (error) {
    console.warn(
      ENGINE_NAME +
        ": unable to freeze public API.",
      error
    );
  }

  window.AlbukhrPiAuthEngine =
    PiAuthEngine;

  console.info(
    "%cALBUKHR Pi Auth Engine Ready",
    "color:#0f7a3d;font-weight:bold"
  );

  console.info({
    version: VERSION,
    build: BUILD,
    network: getEnvironment()
  });

})(window);
