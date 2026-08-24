/* =========================================================
   ALBUKHR PI AUTH ENGINE
   User Authentication Domain Engine
   ---------------------------------------------------------
   ROLE:
   - User-facing Pi authentication orchestration
   - Delegates Pi SDK initialization/authentication to:
       js/core/pi-auth-core.js
   - Uses environment-switcher.js as the only network source
     of truth
   - Uses the shared Supabase client from supabase-core.js
   - Delegates application-session creation to the shared
     ALBUKHR authentication bridge
   - No LocalStorage / SessionStorage
   - No duplicate Pi SDK initialization
   - No duplicate Pi authentication implementation
   - No direct Supabase client creation
   - No Supabase credentials
   - Fails closed when required foundation layers are absent

   ARCHITECTURE:
     environment-switcher.js
              ↓
        pi-auth-core.js
              ↓
       pi-auth-engine.js
              ↓
        user page controllers

   REQUIRED CORE DEPENDENCIES:
   - js/core/environment-switcher.js
   - js/core/pi-auth-core.js
   - js/core/supabase-core.js

   OPTIONAL APPLICATION AUTH BRIDGE:
   - window.ALBUKHR_AUTH.loginWithPi(...)
   - window.AlbukhrAuthEngine.loginWithPi(...)

   IMPORTANT:
   pi-auth-core.js owns Pi.authenticate().
   This engine must not create a second Pi authentication flow.
========================================================= */

(function (window, document) {
  "use strict";

  if (window.__ALBUKHR_PI_AUTH_ENGINE_LOADED__) {
    console.warn("ALBUKHR Pi Auth Engine already loaded.");
    return;
  }

  window.__ALBUKHR_PI_AUTH_ENGINE_LOADED__ = true;

  const ENGINE_NAME = "ALBUKHR Pi Auth Engine";
  const VERSION = "3.0.0";
  const BUILD = "CORE-DELEGATED-USER-AUTH";

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
      status.textContent = safeString(message);
    }

    console.log("[ALBUKHR Pi Auth]", message);
  }

  /* =========================================================
     SHARED ENVIRONMENT
     environment-switcher.js is authoritative.
  ========================================================= */

  function getEnvironment() {
    if (typeof window.getAlbukhrNetwork !== "function") {
      throw new Error(
        "ALBUKHR Environment Core is unavailable. " +
        "Load js/core/environment-switcher.js before pi-auth-engine.js."
      );
    }

    const network = window.getAlbukhrNetwork();

    if (network !== "mainnet" && network !== "testnet") {
      throw new Error(
        "ALBUKHR: invalid network returned by environment-switcher.js."
      );
    }

    return network;
  }

  function isTestnet() {
    return getEnvironment() === "testnet";
  }

  function getEnvironmentConfig() {
    const network = getEnvironment();

    if (typeof window.getAlbukhrEnvironmentConfig === "function") {
      return window.getAlbukhrEnvironmentConfig();
    }

    return {
      network,
      name: network === "testnet" ? "TESTNET" : "MAINNET",
      url:
        typeof window.getAlbukhrNetworkUrl === "function"
          ? window.getAlbukhrNetworkUrl(network)
          : ""
    };
  }

  /* =========================================================
     SHARED PI AUTH CORE
     pi-auth-core.js owns:
     - Pi SDK availability
     - Pi SDK initialization
     - Pi authentication
     - current authenticated-user state
     - auth concurrency
  ========================================================= */

  function getPiAuthCore() {
    if (
      !window.AlbukhrPiAuth ||
      typeof window.AlbukhrPiAuth.ensurePiAuth !== "function"
    ) {
      throw new Error(
        "ALBUKHR Pi Auth Core is unavailable. " +
        "Load js/core/pi-auth-core.js before pi-auth-engine.js."
      );
    }

    return window.AlbukhrPiAuth;
  }

  async function initializePi() {
    const core = getPiAuthCore();

    if (typeof core.initPi !== "function") {
      throw new Error(
        "ALBUKHR Pi Auth Core initialization API is unavailable."
      );
    }

    return core.initPi();
  }

  async function ensurePiAuth() {
    const core = getPiAuthCore();
    const user = await core.ensurePiAuth();

    if (!user?.uid) {
      throw new Error(
        "Pi authentication did not return a valid user."
      );
    }

    return user;
  }

  function getPiUser() {
    const core = getPiAuthCore();

    return typeof core.getCurrentUser === "function"
      ? core.getCurrentUser()
      : null;
  }

  function isPiAuthenticated() {
    const core = getPiAuthCore();

    return typeof core.isAuthenticated === "function"
      ? core.isAuthenticated()
      : Boolean(getPiUser()?.uid);
  }

  /* =========================================================
     SHARED SUPABASE CORE
  ========================================================= */

  function getSupabaseClient() {
    if (typeof window.getAlbukhrSupabaseClient !== "function") {
      throw new Error(
        "ALBUKHR Supabase Core is unavailable. " +
        "Load js/core/supabase-core.js before pi-auth-engine.js."
      );
    }

    const client = window.getAlbukhrSupabaseClient();

    if (
      !client ||
      typeof client.from !== "function" ||
      !client.auth
    ) {
      throw new Error(
        "ALBUKHR Supabase Core returned an invalid client."
      );
    }

    return client;
  }

  /* =========================================================
     PI USER NORMALIZATION
  ========================================================= */

  function normalizePiUser(user) {
    const source = user?.user || user || {};
    const network = getEnvironment();

    return {
      uid: safeString(source.uid).trim(),
      username: safeString(source.username).trim(),
      wallet_address: safeString(
        source.wallet_address || source.walletAddress
      ).trim(),
      network: network
    };
  }

  function validatePiUser(user) {
    if (!user?.uid) {
      throw new Error(
        "Pi authentication returned an invalid user."
      );
    }

    if (
      user.network !== "mainnet" &&
      user.network !== "testnet"
    ) {
      throw new Error(
        "Pi authentication returned an invalid network."
      );
    }

    if (user.network !== getEnvironment()) {
      throw new Error(
        `Pi authentication network mismatch: authenticated user is ${user.network}, current environment is ${getEnvironment()}.`
      );
    }

    return user;
  }

  /* =========================================================
     APPLICATION AUTH BRIDGE
     ---------------------------------------------------------
     This engine never invents a client-side application
     session. A shared authentication engine must establish
     the authoritative application session.

     The bridge receives the authenticated Pi context plus
     the current network. It must perform any server-side
     verification/session exchange required by the ALBUKHR
     authentication architecture.
  ========================================================= */

  async function establishApplicationSession(
    piAuthContext,
    options = {}
  ) {
    const network = getEnvironment();

    const bridgeOptions = {
      ...options,
      network,
      piUser: piAuthContext
    };

    if (
      window.ALBUKHR_AUTH &&
      typeof window.ALBUKHR_AUTH.loginWithPi === "function"
    ) {
      return window.ALBUKHR_AUTH.loginWithPi(
        piAuthContext,
        bridgeOptions
      );
    }

    if (
      window.AlbukhrAuthEngine &&
      typeof window.AlbukhrAuthEngine.loginWithPi === "function"
    ) {
      return window.AlbukhrAuthEngine.loginWithPi(
        piAuthContext,
        bridgeOptions
      );
    }

    /*
     * Verify the shared Supabase foundation exists before
     * reporting the missing authentication bridge. Never fall
     * back to LocalStorage, SessionStorage, or a fake session.
     */
    getSupabaseClient();

    throw new Error(
      "ALBUKHR Pi authentication bridge is not available. " +
      "Load the shared authentication engine exposing loginWithPi() " +
      "before starting application login."
    );
  }

  /* =========================================================
     INCOMPLETE PAYMENT HANDOFF
     ---------------------------------------------------------
     Payment recovery belongs to the payment layer.
     Authentication does not mutate payment state.
  ========================================================= */

  function onIncompletePaymentFound(payment) {
    console.warn(
      ENGINE_NAME + ": incomplete Pi payment found.",
      payment
    );

    try {
      if (
        window.AlbukhrPiPayment &&
        typeof window.AlbukhrPiPayment.handleIncompletePayment ===
          "function"
      ) {
        return window.AlbukhrPiPayment.handleIncompletePayment(
          payment
        );
      }

      if (
        window.AlbukhrPaymentEngine &&
        typeof window.AlbukhrPaymentEngine.handleIncompletePayment ===
          "function"
      ) {
        return window.AlbukhrPaymentEngine.handleIncompletePayment(
          payment
        );
      }

      window.dispatchEvent(
        new CustomEvent("albukhrPiIncompletePayment", {
          detail: payment
        })
      );
    } catch (error) {
      console.warn(
        ENGINE_NAME + ": incomplete payment handoff failed.",
        error
      );
    }
  }

  /* =========================================================
     LOGIN
     ---------------------------------------------------------
     Primary authentication path:
       pi-auth-core.ensurePiAuth()

     pi-auth-core owns Pi.authenticate(), therefore this engine
     does not call Pi.authenticate() itself.
  ========================================================= */

  async function login(options = {}) {
    let network = null;

    try {
      setStatus("Initializing ALBUKHR authentication...");

      network = getEnvironment();

      await initializePi();

      setStatus("Authenticating with Pi...");

      const piUser = validatePiUser(
        normalizePiUser(await ensurePiAuth())
      );

      let session = null;

      /*
       * Normal application login establishes the authoritative
       * Supabase/application session through the shared bridge.
       *
       * Pi-only callers may explicitly disable this step.
       */
      if (options.createApplicationSession !== false) {
        setStatus(
          "Establishing ALBUKHR application session..."
        );

        session = await establishApplicationSession(
          piUser,
          options
        );
      }

      setStatus(
        "Login successful" +
          (piUser.username ? ": " + piUser.username : ".")
      );

      return {
        ok: true,
        authenticated: true,
        environment: network,
        network,
        piAuth: piUser,
        piUser,
        session: session || null
      };
    } catch (error) {
      console.error(
        ENGINE_NAME + ": login failed.",
        error
      );

      try {
        network = network || getEnvironment();
      } catch (_) {
        network = null;
      }

      const message = safeString(
        error?.message,
        "Login failed."
      );

      setStatus(message);

      return {
        ok: false,
        authenticated: false,
        environment: network,
        network,
        error: message
      };
    }
  }

  /* =========================================================
     CURRENT APPLICATION SESSION
  ========================================================= */

  async function getSession() {
    const supabase = getSupabaseClient();

    const { data, error } =
      await supabase.auth.getSession();

    if (error) {
      throw new Error(
        error.message ||
          "Unable to read ALBUKHR application session."
      );
    }

    return data?.session || null;
  }

  async function getCurrentUser() {
    const supabase = getSupabaseClient();

    const { data, error } =
      await supabase.auth.getUser();

    if (error) {
      return null;
    }

    return data?.user || null;
  }

  /* =========================================================
     COMBINED AUTH STATE
  ========================================================= */

  async function checkSession() {
    let network = null;

    try {
      network = getEnvironment();

      const piAuthenticated = isPiAuthenticated();
      const piUser = getPiUser();

      let session = null;
      let applicationUser = null;

      try {
        session = await getSession();

        if (session) {
          applicationUser = await getCurrentUser();
        }
      } catch (error) {
        return {
          authenticated: false,
          piAuthenticated,
          piUser: piUser || null,
          session: null,
          user: null,
          network,
          error: safeString(
            error?.message,
            "Unable to read application session."
          )
        };
      }

      return {
        authenticated: Boolean(session && applicationUser),
        piAuthenticated,
        piUser: piUser || null,
        session: session || null,
        user: applicationUser || null,
        network
      };
    } catch (error) {
      console.error(
        ENGINE_NAME + ": session check failed.",
        error
      );

      return {
        authenticated: false,
        piAuthenticated: false,
        piUser: null,
        session: null,
        user: null,
        network,
        error: safeString(
          error?.message,
          "Session check failed."
        )
      };
    }
  }

  /* =========================================================
     AUTH GUARD
  ========================================================= */

  async function requireAuth(options = {}) {
    const redirect = options.redirect !== false;

    /*
     * First use an already-established application session.
     */
    try {
      const session = await getSession();
      const user = session ? await getCurrentUser() : null;

      if (session && user) {
        return {
          ok: true,
          authenticated: true,
          session,
          user,
          piUser: getPiUser() || null,
          network: getEnvironment()
        };
      }
    } catch (_) {
      /*
       * Fall through to the shared Pi authentication flow.
       */
    }

    const result = await login({
      ...options,
      createApplicationSession:
        options.createApplicationSession !== false
    });

    if (result.ok) {
      return result;
    }

    if (redirect) {
      const loginPage =
        options.loginPage || "login.html";

      window.location.replace(loginPage);
    }

    return result;
  }

  /* =========================================================
     LOGOUT
     ---------------------------------------------------------
     Clears both shared application and Pi in-memory auth
     state. No browser storage is touched.
  ========================================================= */

  async function logout() {
    let firstError = null;

    try {
      const supabase = getSupabaseClient();
      const { error } =
        await supabase.auth.signOut();

      if (error) {
        firstError =
          error.message ||
          "Unable to sign out of ALBUKHR application session.";
      }
    } catch (error) {
      firstError =
        error?.message ||
        "Unable to sign out of ALBUKHR application session.";
    }

    try {
      const core = getPiAuthCore();

      if (typeof core.logout === "function") {
        await core.logout();
      } else if (typeof core.clearAuth === "function") {
        core.clearAuth();
      }
    } catch (error) {
      if (!firstError) {
        firstError =
          error?.message ||
          "Unable to clear Pi authentication state.";
      }
    }

    if (firstError) {
      throw new Error(firstError);
    }

    setStatus("Signed out.");

    return {
      ok: true,
      network: getEnvironment()
    };
  }

  /* =========================================================
     REDIRECT
  ========================================================= */

  function redirectAfterLogin(destination = "index.html") {
    window.location.assign(destination);
  }

  /* =========================================================
     HEALTH
  ========================================================= */

  function health() {
    let network = null;
    let networkError = null;

    try {
      network = getEnvironment();
    } catch (error) {
      networkError =
        error?.message || "Network unavailable.";
    }

    const piCoreReady = Boolean(
      window.AlbukhrPiAuth &&
        typeof window.AlbukhrPiAuth.ensurePiAuth ===
          "function"
    );

    const supabaseCoreReady =
      typeof window.getAlbukhrSupabaseClient ===
        "function";

    const authBridgeReady =
      Boolean(
        window.ALBUKHR_AUTH &&
          typeof window.ALBUKHR_AUTH.loginWithPi ===
            "function"
      ) ||
      Boolean(
        window.AlbukhrAuthEngine &&
          typeof window.AlbukhrAuthEngine.loginWithPi ===
            "function"
      );

    return {
      ready:
        !networkError &&
        piCoreReady &&
        supabaseCoreReady,

      network,
      network_ready: !networkError,

      pi_auth_core_ready: piCoreReady,
      supabase_core_ready: supabaseCoreReady,
      application_auth_bridge_ready: authBridgeReady,

      pi_sdk_loaded: Boolean(
        window.Pi &&
          typeof window.Pi.init === "function" &&
          typeof window.Pi.authenticate === "function"
      ),

      error: networkError
    };
  }

  /* =========================================================
     PUBLIC API
  ========================================================= */

  PiAuthEngine.VERSION = VERSION;
  PiAuthEngine.BUILD = BUILD;
  PiAuthEngine.ENGINE_NAME = ENGINE_NAME;

  PiAuthEngine.getEnvironment = getEnvironment;
  PiAuthEngine.getEnvironmentConfig = getEnvironmentConfig;
  PiAuthEngine.isTestnet = isTestnet;

  PiAuthEngine.initializePi = initializePi;
  PiAuthEngine.ensurePiAuth = ensurePiAuth;
  PiAuthEngine.getPiUser = getPiUser;
  PiAuthEngine.isPiAuthenticated = isPiAuthenticated;

  PiAuthEngine.login = login;
  PiAuthEngine.getSession = getSession;
  PiAuthEngine.getCurrentUser = getCurrentUser;
  PiAuthEngine.checkSession = checkSession;
  PiAuthEngine.requireAuth = requireAuth;
  PiAuthEngine.logout = logout;

  PiAuthEngine.redirectAfterLogin =
    redirectAfterLogin;

  PiAuthEngine.setStatus = setStatus;
  PiAuthEngine.health = health;

  try {
    Object.freeze(PiAuthEngine);
  } catch (error) {
    console.warn(
      ENGINE_NAME + ": unable to freeze public API.",
      error
    );
  }

  window.AlbukhrPiAuthEngine = PiAuthEngine;

  /*
   * Compatibility aliases for existing user pages.
   * These point to the consolidated engine and do not create
   * another authentication implementation.
   */
  window.albukhrPiAuthLogin = login;
  window.albukhrPiAuthLogout = logout;
  window.albukhrPiAuthCheckSession = checkSession;

  /*
   * Keep the incomplete-payment hook available to callers that
   * explicitly need the handoff. It does not mutate payment data.
   */
  PiAuthEngine.onIncompletePaymentFound =
    onIncompletePaymentFound;

  console.info(
    "%cALBUKHR Pi Auth Engine Ready",
    "color:#0f7a3d;font-weight:bold"
  );

  console.info({
    version: VERSION,
    build: BUILD,
    network: (() => {
      try {
        return getEnvironment();
      } catch (_) {
        return "unavailable";
      }
    })()
  });
})(window, document);
