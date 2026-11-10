
/* =========================================================
 * ALBUKHR TESTNET PROJECT OWNER PAGE v7
 *
 * Owner self-service profile and project wallet separation.
 * Ownership transfer remains Super Admin-only.
 *
 * Security:
 * - Testnet session is required.
 * - Project ownership is verified server-side.
 * - Mainnet and Testnet data remain isolated.
 * - Pi access token remains in memory.
 * - Project Owner withdrawal wallet is entered per request.
 * - Global users.wallet_address is never changed by this page.
 *
 * Liquidity:
 * - Owner identity verification remains mandatory.
 * - Pi authentication remains separate from payment execution.
 * - Payment is started only by the user's payment click.
 * ========================================================= */

(function (window, document) {
  "use strict";

  /* =======================================================
     CONFIGURATION
  ======================================================= */

  var OWNER_API =
    "https://vhvkwvngmrlgyzwemttt.supabase.co/functions/v1/testnet-project-owner";

  var STELLAR_G_ADDRESS_PATTERN = /^G[A-Z2-7]{55}$/;

  /* =======================================================
     STATE
  ======================================================= */

  var state = {
    projectId: "",
    project: null,
    treasury: null,
    ownerBalance: 0,
    liquidity: null,
    session: null,
    owner: null,
    ownerProfile: null,

    withdrawalInFlight: false,
    profileSaveInFlight: false,
    liquidityPaymentInFlight: false,
    ownerLoaded: false,

    piAuthenticated: false,
    piAuthenticationInFlight: false,
    piAuthenticationError: null
  };

  /* =======================================================
     BASIC UTILITIES
  ======================================================= */

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function numberValue(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function formatPi(value) {
    return numberValue(value).toFixed(2) + " Pi";
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    var node = byId(id);
    if (node) node.textContent = clean(value);
  }

  function setValue(id, value) {
    var node = byId(id);
    if (node) node.value = clean(value);
  }

  function setHidden(id, hidden) {
    var node = byId(id);
    if (node) node.hidden = !!hidden;
  }

  function setStatus(id, message, type) {
    var node = byId(id);
    if (!node) return;

    node.textContent = clean(message);

    if (type) {
      node.dataset.status = type;
    } else {
      delete node.dataset.status;
    }
  }

  function isValidTestnetWallet(value) {
    return STELLAR_G_ADDRESS_PATTERN.test(
      clean(value).toUpperCase()
    );
  }

  function getOwnerEnteredWallet() {
    var input = byId("withdrawWallet");

    return clean(input && input.value).toUpperCase();
  }

  /*
   * The withdrawal button depends on:
   * 1. A positive available Owner balance.
   * 2. A valid wallet entered by this Owner.
   * 3. No withdrawal request currently being submitted.
   *
   * It does NOT depend on users.wallet_address.
   */
  function updateWithdrawalAvailability() {
    var button = byId("requestWithdrawalBtn");

    if (!button) return;

    var wallet = getOwnerEnteredWallet();

    var validWallet =
      isValidTestnetWallet(wallet);

    var availableBalance =
      numberValue(state.ownerBalance);

    var disabled =
      state.withdrawalInFlight ||
      availableBalance <= 0 ||
      !validWallet;

    button.disabled = disabled;

    button.setAttribute(
      "aria-disabled",
      String(disabled)
    );

    button.title =
      availableBalance <= 0
        ? "A positive Project Owner balance is required."
        : !validWallet
          ? "Enter your own valid Testnet wallet address."
          : "Submit a Project Owner withdrawal request.";
  }

  /* =======================================================
     PROJECT ID
  ======================================================= */

  function getProjectId() {
    try {
      var params =
        new URLSearchParams(window.location.search);

      return clean(
        params.get("project") ||
        params.get("project_id")
      );
    } catch (_) {
      return "";
    }
  }

  /* =======================================================
     ENVIRONMENT VALIDATION
  ======================================================= */

  function validateEnvironment() {
    var env = window.ALBukhrEnvironment;

    if (
      !env ||
      typeof env.isKnown !== "function" ||
      typeof env.isTestnet !== "function" ||
      typeof env.getNetwork !== "function"
    ) {
      throw new Error(
        "TESTNET_ENVIRONMENT_UNAVAILABLE"
      );
    }

    if (
      !env.isKnown() ||
      !env.isTestnet() ||
      env.getNetwork() !== "testnet"
    ) {
      throw new Error(
        "INVALID_TESTNET_ENVIRONMENT"
      );
    }

    var hostname = clean(
      typeof env.getHostname === "function"
        ? env.getHostname()
        : window.location.hostname
    ).toLowerCase();

    if (hostname !== "test.albukhr.com") {
      throw new Error(
        "TESTNET_HOST_REQUIRED"
      );
    }
  }

  /* =======================================================
     TESTNET AUTH
  ======================================================= */

  function getAuth() {
    var auth = window.AlbukhrTestnetAuth;

    if (
      !auth ||
      typeof auth.requireTestnetAuth !== "function" ||
      typeof auth.getSessionToken !== "function"
    ) {
      throw new Error(
        "TESTNET_AUTH_MODULE_UNAVAILABLE"
      );
    }

    return auth;
  }

  /* =======================================================
     ENSURE TESTNET SESSION
  ======================================================= */

  async function ensureSession() {
    validateEnvironment();

    var auth = getAuth();

    state.session =
      await auth.requireTestnetAuth({
        redirectOnFailure: true
      });

    if (!state.session) {
      throw new Error(
        "TESTNET_SESSION_REQUIRED"
      );
    }

    return state.session;
  }

  /* =======================================================
     OWNER API REQUEST
  ======================================================= */

  async function ownerRequest(method, query, body) {
  /*
   * Revalidate the temporary Testnet session before every owner API call.
   * If it has expired, ensureSession() starts the safe Mainnet handoff and
   * the handoff returns the user to this same Project Owner route.
   * The owner operation is deliberately not replayed after authentication;
   * the user must explicitly retry it after returning.
   */
  await ensureSession();

  var token = clean(
    getAuth().getSessionToken()
  );

    if (!token) {
      throw new Error(
        "TESTNET_SESSION_REQUIRED"
      );
    }

    var url =
      OWNER_API +
      (query ? "?" + query : "");

    var options = {
      method: method,
      headers: {
        "Accept": "application/json",
        "X-Testnet-Session": token
      }
    };

    if (body !== undefined) {
      options.headers["Content-Type"] =
        "application/json";

      options.body = JSON.stringify(body);
    }

    var response;

    try {
      response = await fetch(url, options);
    } catch (e) {
      var networkError = new Error(
        "PROJECT_OWNER_NETWORK_ERROR"
      );

      networkError.cause = e;
      throw networkError;
    }

    var payload = null;

    try {
      payload = await response.json();
    } catch (_) {}

    if (!response.ok) {
      var apiError = new Error(
        clean(payload && payload.error) ||
        ("PROJECT_OWNER_HTTP_" + response.status)
      );

      apiError.status = response.status;
      apiError.body = payload;

      throw apiError;
    }

    return payload;
  }

  /* =======================================================
     LOGO
  ======================================================= */

  function renderLogo(project) {
    var img = byId("ownerProjectLogo");
    var fallback = byId("ownerProjectLogoFallback");

    if (!img) return;

    var url = clean(project && project.logo_url);

    if (!url) {
      img.hidden = true;
      img.removeAttribute("src");

      if (fallback) {
        fallback.hidden = false;
      }

      return;
    }

    img.hidden = true;
    img.alt = clean(project.name) + " logo";

    img.onload = function () {
      img.hidden = false;

      if (fallback) {
        fallback.hidden = true;
      }
    };

    img.onerror = function () {
      img.hidden = true;
      img.removeAttribute("src");

      if (fallback) {
        fallback.hidden = false;
      }
    };

    img.src = url;
  }

  /* =======================================================
     WITHDRAWAL HISTORY
  ======================================================= */

  function renderWithdrawals(rows) {
    var container = byId("withdrawalHistory");

    if (!container) return;

    var list = Array.isArray(rows) ? rows : [];

    if (!list.length) {
      container.innerHTML =
        '<div class="empty-state">' +
        "No Project Owner withdrawals yet." +
        "</div>";

      return;
    }

    container.innerHTML = list.map(function (row) {
      return (
        '<article class="history-item">' +
          "<div>" +
            "<strong>" +
              escapeHtml(
                clean(row.status || "pending").toUpperCase()
              ) +
            "</strong>" +
            "<span>" +
              escapeHtml(formatPi(row.requested_amount)) +
              " requested</span>" +
          "</div>" +
          '<div class="history-meta">' +
            "<span>Receive: " +
              escapeHtml(formatPi(row.net_amount)) +
            "</span>" +
            "<span>" +
              escapeHtml(formatDate(row.created_at)) +
            "</span>" +
          "</div>" +
        "</article>"
      );
    }).join("");
  }

  /* =======================================================
     HTML ESCAPE
  ======================================================= */

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /* =======================================================
     DATE
  ======================================================= */

  function formatDate(value) {
    if (!value) return "—";

    var date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    try {
      return new Intl.DateTimeFormat("en", {
        year: "numeric",
        month: "short",
        day: "numeric"
      }).format(date);
    } catch (_) {
      return date.toLocaleDateString();
    }
  }

  /* =======================================================
     PAYMENT CLIENT CHECK
  ======================================================= */

  function liquidityPaymentClientAvailable() {
    var client =
      window.AlbukhrTestnetLiquidityPayment;

    return !!client &&
      typeof client.createLiquidityPayment === "function";
  }

  /* =======================================================
     PI AUTHENTICATION CHECK
  ======================================================= */

  function piPaymentAuthenticated() {
    var client =
      window.AlbukhrTestnetLiquidityPayment;

    if (
      client &&
      typeof client.isAuthenticated === "function"
    ) {
      return client.isAuthenticated();
    }

    return !!state.piAuthenticated;
  }

  /* =======================================================
     PI PRE-AUTHENTICATION
  ======================================================= */

  async function ensurePiAuthentication() {
    var client =
      window.AlbukhrTestnetLiquidityPayment;

    if (
      !client ||
      typeof client.authenticate !== "function" ||
      typeof client.isAuthenticated !== "function"
    ) {
      state.piAuthenticationError =
        "PI_SDK_PAYMENT_UNAVAILABLE";

      throw new Error(
        "PI_SDK_PAYMENT_UNAVAILABLE"
      );
    }

    if (client.isAuthenticated()) {
      state.piAuthenticated = true;
      state.piAuthenticationError = null;

      return true;
    }

    if (state.piAuthenticationInFlight) {
      return false;
    }

    state.piAuthenticationInFlight = true;
    state.piAuthenticationError = null;

    setLiquidityAvailability();

    try {
      setStatus(
        "liquidityStatus",
        "Verifying Pi identity for Testnet payment…"
      );

      await client.authenticate();

      if (!client.isAuthenticated()) {
        throw new Error(
          "PI_AUTH_RESULT_NOT_PERSISTED"
        );
      }

      state.piAuthenticated = true;
      state.piAuthenticationError = null;

      return true;

    } catch (error) {
      state.piAuthenticated = false;

      state.piAuthenticationError =
        error && error.message
          ? error.message
          : "Pi authentication could not be completed.";

      console.error(
        "[ALBUKHR TESTNET PI PRE-AUTH]",
        error
      );

      return false;

    } finally {
      state.piAuthenticationInFlight = false;

      setLiquidityAvailability();

      if (
        !state.piAuthenticated &&
        state.piAuthenticationError
      ) {
        setStatus(
          "liquidityStatus",
          state.piAuthenticationError,
          "error"
        );
      }
    }
  }

  /* =======================================================
     LIQUIDITY BUTTON AVAILABILITY
  ======================================================= */

  function setLiquidityAvailability() {
    var button = byId("addLiquidityBtn");

    if (!button) return;

    var liquidity = state.liquidity || {};
    var profile = state.ownerProfile || {};
    var owner = state.owner || {};

    var required =
      numberValue(liquidity.required);

    var verified =
      numberValue(liquidity.verified);

    var due = Math.max(
      0,
      required - verified
    );

    var ownerBound =
      !!clean(owner.user_id || owner.id) &&
      !!clean(owner.pi_uid);

    var ownerVerified =
      clean(profile.verification_status).toLowerCase() ===
      "verified";

    var piAuthenticated =
      piPaymentAuthenticated();

    /*
     * Treasury is informational only.
     * The server remains authoritative.
     */
    var treasuryReady =
      !!state.treasury &&
      !!liquidity.treasury_configured;

    /*
     * Identity verification remains a strict gate.
     */
    var ready =
      ownerBound &&
      ownerVerified &&
      due > 0 &&
      liquidityPaymentClientAvailable() &&
      !state.piAuthenticationInFlight &&
      !state.liquidityPaymentInFlight;

    button.disabled = !ready;

    button.setAttribute(
      "aria-disabled",
      String(!ready)
    );

    button.title = ready
      ? "Start Testnet liquidity. Pi identity will be verified if needed."
      : "";

    var amountNode =
      byId("liquidityAmount");

    if (amountNode) {
      amountNode.min = String(
        Math.max(100, due)
      );

      if (
        due > 0 &&
        !clean(amountNode.value)
      ) {
        amountNode.placeholder =
          due.toFixed(2);
      }
    }

    if (state.liquidityPaymentInFlight) {
      setStatus(
        "liquidityStatus",
        "Pi liquidity payment is in progress…"
      );

    } else if (!ownerBound) {
      setStatus(
        "liquidityStatus",
        "Testnet Project Owner identity binding is required.",
        "error"
      );

    } else if (!ownerVerified) {
      /*
       * Do not remove or weaken this identity gate.
       */
      setStatus(
        "liquidityStatus",
        "Owner identity verification is required before liquidity can be added.",
        "error"
      );

    } else if (due <= 0) {
      setStatus(
        "liquidityStatus",
        "The project liquidity requirement is already satisfied.",
        "success"
      );

    } else if (!liquidityPaymentClientAvailable()) {
      setStatus(
        "liquidityStatus",
        "The Testnet Pi payment module is not available on this page.",
        "error"
      );

    } else if (state.piAuthenticationInFlight) {
      setStatus(
        "liquidityStatus",
        "Verifying Pi identity for Testnet payment…"
      );

    } else if (!piAuthenticated && state.piAuthenticationError) {
      setStatus(
        "liquidityStatus",
        state.piAuthenticationError,
        "error"
      );

    } else if (!piAuthenticated) {
      setStatus(
        "liquidityStatus",
        "Tap Add Liquidity to verify Pi identity. After verification, tap again to open the payment dialog."
      );

    } else if (!treasuryReady) {
      setStatus(
        "liquidityStatus",
        "Owner authorization verified. Treasury readiness will be re-checked securely by the server when the payment is approved."
      );

    } else {
      setStatus(
        "liquidityStatus",
        "Owner authorization verified. Remaining amount to reach this project's configured Testnet target: " +
        formatPi(due) +
        "."
      );
    }
  }

  /* =======================================================
     RENDER OWNER
  ======================================================= */

function renderOwner(stateRow, ownerData) {
  var project = stateRow.project || {};
  var liquidity = stateRow.liquidity || {};
  var owner = ownerData || {};

  var profile =
    owner.profile ||
    stateRow.owner_profile ||
    {};

  state.project = project;
  state.treasury = stateRow.treasury || null;
  state.liquidity = liquidity;

  state.ownerBalance =
    numberValue(stateRow.owner_balance);

  state.owner = owner;
  state.ownerProfile = profile;

  setText(
    "ownerTitle",
    "Manage " + (clean(project.name) || "Project")
  );

  setText(
    "ownerSubtitle",
    "Owner controls for approved Testnet project " +
    (clean(project.project_code) || "—")
  );

  setText(
    "projectName",
    clean(project.name) || "Project"
  );

  setText(
    "projectCode",
    clean(project.project_code) || "—"
  );

  setText(
    "ownerBalance",
    formatPi(state.ownerBalance)
  );

  setText(
    "requiredLiquidity",
    formatPi(liquidity.required)
  );

  // Total completed Testnet liquidity payments received.
  setText(
    "receivedLiquidity",
    formatPi(liquidity.received)
  );

  setText(
    "verifiedLiquidity",
    formatPi(liquidity.verified)
  );

  setText(
    "liquidityCoverage",
    numberValue(liquidity.coverage).toFixed(1) +
    "% coverage"
  );

  setText(
    "treasuryState",
    liquidity.treasury_configured
      ? "CONFIGURED"
      : "NOT CONFIGURED"
  );

  setValue(
    "profilePiUid",
    owner.pi_uid
  );

  setValue(
    "profileUsername",
    owner.username
  );

  setValue(
    "profileDisplayName",
    profile.display_name
  );

  setValue(
    "profileRoleTitle",
    profile.role_title
  );

  setValue(
    "profileOrganization",
    profile.organization_name
  );

  setValue(
    "profileEmail",
    profile.contact_email
  );

  setValue(
    "profilePhone",
    profile.contact_phone
  );

  /*
   * IMPORTANT:
   * Do not read owner.wallet_address here.
   * Do not populate withdrawWallet from the shared users record.
   * The project Owner enters a wallet for each withdrawal request.
   *
   * Do not clear the field during refresh either:
   * preserve the Owner's current input while refreshing the page state.
   */

  setValue(
    "profileBio",
    profile.bio
  );

  setText(
    "profileVerificationState",
    clean(profile.verification_status || "pending").toUpperCase()
  );

  updateWithdrawalAvailability();
  setLiquidityAvailability();

  renderLogo(project);

  renderWithdrawals(
    stateRow.withdrawals || []
  );

  var back = byId("backToProject");

  if (back && clean(project.id)) {
    back.href =
      "project.html?project=" +
      encodeURIComponent(
        project.project_code || project.id
      );
  }

  document.title =
    (clean(project.name) || "Project Owner") +
    " • ALBUKHR TESTNET";

  
  // Notify the owner staking module after project rendering.
  if (typeof window.CustomEvent === "function") {
    window.dispatchEvent(
      new window.CustomEvent(
        "albukhr:testnet-owner-project-rendered",
        {
          detail: {
            project: project
          }
        }
      )
    );
  }

}

  /* =======================================================
     ACCESS ERROR
  ======================================================= */

  function showAccessError(error) {
    var code =
      clean(error && error.message) ||
      "PROJECT_OWNER_ACCESS_DENIED";

    setHidden("ownerContent", true);
    setHidden("ownerError", false);

    if (code === "PROJECT_OWNER_NOT_BOUND") {
      setText(
        "ownerErrorTitle",
        "Project Owner access is not assigned"
      );

      setText(
        "ownerErrorText",
        "Your Testnet identity is authenticated, but this approved project is not currently bound to your account."
      );

      return;
    }

    if (code === "PROJECT_OWNER_ACCESS_DENIED") {
      setText(
        "ownerErrorTitle",
        "Owner access denied"
      );

      setText(
        "ownerErrorText",
        "The Testnet owner service did not authorize this project for your identity."
      );

      return;
    }

    setText(
      "ownerErrorTitle",
      "Unable to open Project Owner"
    );

    setText(
      "ownerErrorText",
      code
    );
  }

  /* =======================================================
     LOAD OWNER PAGE
  ======================================================= */

  async function load() {
    try {
      await ensureSession();

      state.projectId = getProjectId();

      if (!state.projectId) {
        throw new Error("PROJECT_ID_REQUIRED");
      }

      /*
       * Start with an empty withdrawal wallet.
       * Never inherit a wallet from the global user record.
       */
      var walletInput = byId("withdrawWallet");

      if (walletInput) {
        walletInput.value = "";
        walletInput.autocomplete = "off";
      }

      updateWithdrawalAvailability();

      var payload = await ownerRequest(
        "GET",
        "project_id=" +
        encodeURIComponent(state.projectId)
      );

      var projects =
        Array.isArray(payload && payload.projects)
          ? payload.projects
          : [];

      if (!projects.length) {
        throw new Error(
          "PROJECT_OWNER_ACCESS_DENIED"
        );
      }

      /*
       * The server already filters by requested project_id.
       * Use the returned authorized project, not projects[0]
       * from an unrelated multi-project list.
       */
      var selectedProject = projects.find(function (item) {
        return (
          clean(item && item.project && item.project.id) ===
            state.projectId ||
          clean(item && item.project_id) === state.projectId ||
          clean(item && item.project && item.project.project_code) ===
            state.projectId ||
          clean(item && item.project_code) === state.projectId
        );
      }) || projects[0];

      state.ownerLoaded = true;

      setText(
        "ownerUserPill",
        clean(payload.owner && payload.owner.username) ||
        "OWNER"
      );

      setHidden("ownerError", true);
      setHidden("ownerContent", false);

      renderOwner(
        selectedProject,
        payload.owner || {}
      );

      /*
       * Page-load Pi pre-auth remains best-effort.
       * The payment click path remains separate.
       */
      ensurePiAuthentication().catch(function (error) {
        state.piAuthenticationError =
          error && error.message
            ? error.message
            : "PI_AUTH_FAILED";

        setLiquidityAvailability();
      });

      setLiquidityAvailability();
      updateWithdrawalAvailability();

    } catch (error) {
      console.error(
        "[ALBUKHR TESTNET PROJECT OWNER]",
        error
      );

      showAccessError(error);
    }
  }

  /* =======================================================
     REFRESH
  ======================================================= */

  async function refresh() {
    if (!state.projectId) return;

    try {
      var payload = await ownerRequest(
        "GET",
        "project_id=" +
        encodeURIComponent(state.projectId)
      );

      var projects =
        Array.isArray(payload && payload.projects)
          ? payload.projects
          : [];

      if (!projects.length) {
        throw new Error(
          "PROJECT_OWNER_ACCESS_DENIED"
        );
      }

      var auth = getAuth();

      state.session =
        typeof auth.getSession === "function"
          ? auth.getSession()
          : state.session;

      var selectedProject = projects.find(function (item) {
        return (
          clean(item && item.project && item.project.id) ===
            state.projectId ||
          clean(item && item.project_id) === state.projectId ||
          clean(item && item.project && item.project.project_code) ===
            state.projectId ||
          clean(item && item.project_code) === state.projectId
        );
      }) || projects[0];

      renderOwner(
        selectedProject,
        payload.owner || {}
      );

      if (piPaymentAuthenticated()) {
        state.piAuthenticated = true;
        state.piAuthenticationError = null;
      }

      setLiquidityAvailability();
      updateWithdrawalAvailability();

      setStatus(
        "withdrawStatus",
        "Owner project state refreshed.",
        "success"
      );

    } catch (error) {
      console.error(
        "[ALBUKHR TESTNET PROJECT OWNER REFRESH]",
        error
      );

      setStatus(
        "withdrawStatus",
        error && error.message
          ? error.message
          : "Unable to refresh owner state.",
        "error"
      );
    }
  }

  /* =======================================================
     START LIQUIDITY PAYMENT
  ======================================================= */

  async function startLiquidityPayment() {
    if (state.liquidityPaymentInFlight) return;

    /*
     * Do not start a second concurrent Pi authentication.
     */
    if (state.piAuthenticationInFlight) {
      setStatus(
        "liquidityStatus",
        "Pi identity verification is still in progress. Please wait."
      );

      return;
    }

    try {
      validateEnvironment();

      var sessionToken =
        clean(getAuth().getSessionToken());

      if (!sessionToken) {
        throw new Error(
          "TESTNET_SESSION_REQUIRED"
        );
      }

      var payment =
        window.AlbukhrTestnetLiquidityPayment;

      if (
        !payment ||
        typeof payment.createLiquidityPayment !== "function" ||
        typeof payment.isAuthenticated !== "function"
      ) {
        throw new Error(
          "PI_SDK_PAYMENT_UNAVAILABLE"
        );
      }

      var amountNode =
        byId("liquidityAmount");

      var amount =
        numberValue(amountNode && amountNode.value);

      var required =
        numberValue(
          state.liquidity && state.liquidity.required
        );

      var verified =
        numberValue(
          state.liquidity && state.liquidity.verified
        );

      var due = Math.max(
        0,
        required - verified
      );

      if (due <= 0) {
        setStatus(
          "liquidityStatus",
          "The project liquidity requirement is already satisfied.",
          "success"
        );

        return;
      }

      if (amount < 100 || amount < due) {
        setStatus(
          "liquidityStatus",
          "Enter at least " +
          formatPi(Math.max(100, due)) +
          " for the remaining Testnet liquidity requirement.",
          "error"
        );

        return;
      }

      var project = state.project || {};

      if (
        !clean(project.id) ||
        !clean(project.project_code)
      ) {
        throw new Error(
          "PROJECT_ID_AND_CODE_REQUIRED"
        );
      }

      var owner = state.owner || {};
      var profile = state.ownerProfile || {};

      if (
        !clean(owner.user_id || owner.id) ||
        !clean(owner.pi_uid)
      ) {
        throw new Error(
          "PROJECT_OWNER_IDENTITY_INVALID"
        );
      }

      if (
        clean(profile.verification_status).toLowerCase() !==
        "verified"
      ) {
        throw new Error(
          "PROJECT_OWNER_PROFILE_NOT_VERIFIED"
        );
      }

      /*
       * First click can authenticate.
       * It does not start payment in the same click.
       */
      if (!payment.isAuthenticated()) {
        var authenticated =
          await ensurePiAuthentication();

        if (!authenticated || !payment.isAuthenticated()) {
          return;
        }

        setStatus(
          "liquidityStatus",
          "Pi identity verified. Tap Add Liquidity again to open the Pi Testnet payment dialog.",
          "success"
        );

        return;
      }

      state.piAuthenticated = true;
      state.liquidityPaymentInFlight = true;

      setLiquidityAvailability();

      setStatus(
        "liquidityStatus",
        "Opening the Pi Testnet payment flow…"
      );

      /*
       * Payment client still independently enforces
       * Pi auth, Testnet environment and payment constraints.
       */
      var result =
        await payment.createLiquidityPayment(
          {
            id: project.id,
            project_code: project.project_code,
            network: "testnet"
          },
          amount
        );

      setStatus(
        "liquidityStatus",
        result &&
        result.record &&
        result.record.verification_status === "verified"
          ? "Liquidity payment completed and verified."
          : "Liquidity payment completed and recorded. Testnet Admin verification is still required before it counts as verified.",
        "success"
      );

      await refresh();

    } catch (error) {
      console.error(
        "[ALBUKHR TESTNET PROJECT OWNER LIQUIDITY]",
        error
      );

      var code =
        clean(error && error.message);

      if (
        code === "PROJECT_OWNER_PROFILE_NOT_VERIFIED"
      ) {
        setStatus(
          "liquidityStatus",
          "Owner identity verification is required before liquidity can be added.",
          "error"
        );
      } else {
        setStatus(
          "liquidityStatus",
          code ||
          "Unable to complete the Testnet liquidity payment.",
          "error"
        );
      }

    } finally {
      state.liquidityPaymentInFlight = false;
      setLiquidityAvailability();
    }
  }

  /* =======================================================
     SAVE OWNER PROFILE
  ======================================================= */

  async function saveProfile() {
    if (state.profileSaveInFlight) return;

    var button =
      byId("saveOwnerProfileBtn");

    /*
     * This profile form no longer contains a wallet field.
     * Do not require profileWallet.
     * Do not update the shared users.wallet_address.
     */

    state.profileSaveInFlight = true;

    if (button) {
      button.disabled = true;
      button.textContent = "Saving…";
    }

    setStatus(
      "profileStatus",
      "Saving your Project Owner profile…"
    );

    try {
      var response = await ownerRequest(
        "POST",
        null,
        {
          action: "update_profile",
          project_id: state.projectId,

          display_name: clean(
            byId("profileDisplayName") &&
            byId("profileDisplayName").value
          ),

          role_title: clean(
            byId("profileRoleTitle") &&
            byId("profileRoleTitle").value
          ),

          organization_name: clean(
            byId("profileOrganization") &&
            byId("profileOrganization").value
          ),

          contact_email: clean(
            byId("profileEmail") &&
            byId("profileEmail").value
          ),

          contact_phone: clean(
            byId("profilePhone") &&
            byId("profilePhone").value
          ),

          bio: clean(
            byId("profileBio") &&
            byId("profileBio").value
          )
        }
      );

      state.owner =
        response.owner || state.owner;

      state.ownerProfile =
        response.profile || state.ownerProfile;

      setStatus(
        "profileStatus",
        response.verification_reset
          ? "Profile saved. Identity-sensitive changes require Super Admin re-verification."
          : "Profile saved successfully.",
        "success"
      );

      await refresh();

    } catch (error) {
      console.error(
        "[ALBUKHR TESTNET OWNER PROFILE]",
        error
      );

      setStatus(
        "profileStatus",
        error && error.message
          ? error.message
          : "Unable to save owner profile.",
        "error"
      );

    } finally {
      state.profileSaveInFlight = false;

      if (button) {
        button.disabled = false;
        button.textContent = "Save Profile";
      }
    }
  }

  /* =======================================================
     REQUEST WITHDRAWAL
  ======================================================= */

  async function requestWithdrawal() {
    if (state.withdrawalInFlight) return;

    var amountNode =
      byId("withdrawAmount");

    var amount =
      numberValue(amountNode && amountNode.value);

    if (!Number.isFinite(amount) || amount <= 0) {
      setStatus(
        "withdrawStatus",
        "Enter a withdrawal amount greater than zero.",
        "error"
      );

      return;
    }

    if (amount > state.ownerBalance) {
      setStatus(
        "withdrawStatus",
        "Requested amount is greater than the available owner balance.",
        "error"
      );

      return;
    }

    /*
     * Wallet is supplied by this project Owner for this request.
     * Never inherit it from owner.wallet_address or RAHEEM-25.
     */
    var walletNode =
      byId("withdrawWallet");

    var walletAddress =
      clean(walletNode && walletNode.value).toUpperCase();

    if (!walletAddress) {
      setStatus(
        "withdrawStatus",
        "Enter your own Testnet wallet address.",
        "error"
      );

      if (walletNode) walletNode.focus();

      updateWithdrawalAvailability();

      return;
    }

    if (!isValidTestnetWallet(walletAddress)) {
      setStatus(
        "withdrawStatus",
        "Invalid Testnet wallet address. Enter a valid G-address containing 56 characters.",
        "error"
      );

      if (walletNode) walletNode.focus();

      updateWithdrawalAvailability();

      return;
    }

    /*
     * Retain server-side owner binding and available balance checks.
     */
    if (
      !state.projectId ||
      !state.owner ||
      !clean(state.owner.user_id || state.owner.id)
    ) {
      setStatus(
        "withdrawStatus",
        "Project Owner authorization is required before submitting a withdrawal.",
        "error"
      );

      return;
    }

    state.withdrawalInFlight = true;

    var button =
      byId("requestWithdrawalBtn");

    if (button) {
      button.disabled = true;
      button.textContent = "Submitting…";
    }

    setStatus(
      "withdrawStatus",
      "Submitting Project Owner withdrawal request…"
    );

    try {
      var response = await ownerRequest(
        "POST",
        null,
        {
          action: "request_withdrawal",
          project_id: state.projectId,
          amount: amount,
          wallet_address: walletAddress
        }
      );

      if (
        !response ||
        !response.withdrawal ||
        !response.withdrawal.id
      ) {
        throw new Error(
          "OWNER_WITHDRAWAL_REQUEST_FAILED"
        );
      }

      setStatus(
        "withdrawStatus",
        "Owner withdrawal request submitted successfully.",
        "success"
      );

      if (amountNode) {
        amountNode.value = "";
      }

      /*
       * Keep the wallet visible for the Owner's next request.
       * It is not saved to the shared users record.
       */
      await refresh();

    } catch (error) {
      console.error(
        "[ALBUKHR TESTNET OWNER WITHDRAWAL]",
        error
      );

      var code =
        clean(error && error.message);

      var message =
        code === "OWNER_WITHDRAWAL_WALLET_INVALID"
          ? "The server rejected the wallet address. Check the Testnet wallet and try again."
          : code === "OWNER_WITHDRAWAL_WALLET_REQUIRED"
            ? "Enter your own Testnet wallet address."
            : code === "OWNER_BALANCE_INSUFFICIENT"
              ? "Your available Project Owner balance is insufficient for this request."
              : code || "Owner withdrawal request failed.";

      setStatus(
        "withdrawStatus",
        message,
        "error"
      );

    } finally {
      state.withdrawalInFlight = false;

      if (button) {
        button.textContent =
          "Request Owner Withdrawal";
      }

      updateWithdrawalAvailability();
    }
  }

  /* =======================================================
     PI AUTH EVENT
  ======================================================= */

  function bindPiAuthenticationEvents() {
    window.addEventListener(
      "albukhr:testnet-liquidity-pi-authenticated",
      function () {
        state.piAuthenticated = true;
        state.piAuthenticationInFlight = false;
        state.piAuthenticationError = null;

        setLiquidityAvailability();
      }
    );

    window.addEventListener(
      "albukhr:testnet-liquidity-pi-auth-error",
      function (event) {
        state.piAuthenticated = false;
        state.piAuthenticationInFlight = false;

        state.piAuthenticationError =
          clean(event && event.detail && event.detail.message) ||
          "PI_AUTH_FAILED";

        setLiquidityAvailability();
      }
    );
  }

  /* =======================================================
     BIND UI EVENTS
  ======================================================= */

  function bindEvents() {
    var refreshButton =
      byId("refreshOwnerBtn");

    if (refreshButton) {
      refreshButton.addEventListener(
        "click",
        refresh
      );
    }

    var withdrawalButton =
      byId("requestWithdrawalBtn");

    if (withdrawalButton) {
      withdrawalButton.addEventListener(
        "click",
        requestWithdrawal
      );
    }

    /*
     * Live wallet validation.
     * Automatically uppercase the address while typing.
     */
    var withdrawalWalletInput =
      byId("withdrawWallet");

    if (withdrawalWalletInput) {
      withdrawalWalletInput.value = "";
      withdrawalWalletInput.autocomplete = "off";

      withdrawalWalletInput.addEventListener(
        "input",
        function () {
          var value =
            clean(withdrawalWalletInput.value).toUpperCase();

          if (withdrawalWalletInput.value !== value) {
            withdrawalWalletInput.value = value;
          }

          updateWithdrawalAvailability();
        }
      );

      withdrawalWalletInput.addEventListener(
        "blur",
        function () {
          var value =
            clean(withdrawalWalletInput.value).toUpperCase();

          if (withdrawalWalletInput.value !== value) {
            withdrawalWalletInput.value = value;
          }

          updateWithdrawalAvailability();
        }
      );
    }

    var profileButton =
      byId("saveOwnerProfileBtn");

    if (profileButton) {
      profileButton.addEventListener(
        "click",
        saveProfile
      );
    }

    var addButton =
      byId("addLiquidityBtn");

    if (addButton) {
      addButton.addEventListener(
        "click",
        startLiquidityPayment
      );
    }
  }

  /* =======================================================
     INITIALIZE
  ======================================================= */

  function initialize() {
    bindPiAuthenticationEvents();
    bindEvents();

    updateWithdrawalAvailability();

    load();
  }

  /* =======================================================
     DOM READY
  ======================================================= */

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }

})(window, document);
