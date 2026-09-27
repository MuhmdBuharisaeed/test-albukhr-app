/* ============================================================
 * ALBUKHR TESTNET — PROJECT OWNER
 * Version: v7
 *
 * Responsibilities:
 * - Load authenticated Testnet project owner
 * - Load project / treasury / liquidity state
 * - Render owner dashboard
 * - Manage owner profile
 * - Manage withdrawal
 * - Start Testnet Pi liquidity payment
 *
 * IMPORTANT:
 * - Testnet session is the ALBUKHR authorization layer.
 * - Pi authentication is required by the payment client/backend,
 *   but Pi authentication status does NOT lock the Add Liquidity
 *   button.
 * - No LocalStorage / sessionStorage is used.
 * ============================================================ */

(function () {
  "use strict";

  var OWNER_API =
    "https://vhvkwvngmrlgyzwemttt.supabase.co/functions/v1/testnet-project-owner";

  var state = {
    projectId: null,
    project: null,
    treasury: null,
    ownerBalance: null,
    liquidity: null,

    session: null,
    owner: null,
    ownerProfile: null,

    withdrawalInFlight: false,
    profileSaveInFlight: false,
    liquidityPaymentInFlight: false,

    ownerLoaded: false,

    /*
     * This is informational only.
     *
     * It MUST NOT be used to disable Add Liquidity.
     * The payment client can authenticate / refresh Pi auth
     * when the payment flow starts.
     */
    piAuthenticated: false,
    piAuthenticationInFlight: false
  };

  /* ==========================================================
   * UTILITIES
   * ========================================================== */

  function byId(id) {
    return document.getElementById(id);
  }

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function numberValue(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatPi(value) {
    var n = numberValue(value);

    return n.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 7
    });
  }

  function getAuth() {
    var auth = window.AlbukhrTestnetGatewayAuth;

    if (!auth) {
      throw new Error("TESTNET_AUTH_UNAVAILABLE");
    }

    return auth;
  }

  function getPaymentClient() {
    return window.AlbukhrTestnetLiquidityPayment || null;
  }

  function getCurrentProjectId() {
    if (state.projectId) {
      return state.projectId;
    }

    var node = byId("projectId");

    if (node) {
      var value = clean(
        node.value ||
        node.dataset.projectId ||
        node.textContent
      );

      if (value) {
        state.projectId = value;
        return value;
      }
    }

    var params = new URLSearchParams(window.location.search);
    var queryProjectId = clean(params.get("project_id"));

    if (queryProjectId) {
      state.projectId = queryProjectId;
      return queryProjectId;
    }

    return "";
  }

  /* ==========================================================
   * ENVIRONMENT VALIDATION
   * ========================================================== */

  function validateEnvironment() {
    var hostname = String(window.location.hostname || "").toLowerCase();

    if (hostname !== "test.albukhr.com") {
      throw new Error("TESTNET_ONLY_PAGE");
    }

    var env = window.AlbukhrEnvironmentCore;

    if (env && typeof env.isTestnet === "function") {
      if (!env.isTestnet()) {
        throw new Error("TESTNET_ENVIRONMENT_REQUIRED");
      }
    }

    return true;
  }

  /* ==========================================================
   * SESSION
   * ========================================================== */

  async function ensureSession() {
    validateEnvironment();

    var auth = getAuth();

    if (typeof auth.requireTestnetAuth !== "function") {
      throw new Error("TESTNET_AUTH_GATE_UNAVAILABLE");
    }

    /*
     * Page load may redirect if no valid Testnet session exists.
     */
    var session = await auth.requireTestnetAuth({
      redirectOnFailure: true
    });

    if (!session) {
      throw new Error("TESTNET_SESSION_REQUIRED");
    }

    state.session = session;

    return session;
  }

  function getSessionToken() {
    try {
      var auth = getAuth();

      if (typeof auth.getSessionToken === "function") {
        return clean(auth.getSessionToken());
      }
    } catch (error) {
      console.warn(
        "[ALBUKHR][OWNER] Could not read Testnet session token:",
        error
      );
    }

    return "";
  }

  /* ==========================================================
   * OWNER API
   * ========================================================== */

  async function ownerRequest(action, payload) {
    validateEnvironment();

    var token = getSessionToken();

    if (!token) {
      throw new Error("TESTNET_SESSION_REQUIRED");
    }

    var body = Object.assign(
      {
        action: action
      },
      payload || {}
    );

    var response = await fetch(OWNER_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Testnet-Session": token
      },
      body: JSON.stringify(body)
    });

    var raw = await response.text();

    var data = null;

    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (error) {
      data = {
        message: raw
      };
    }

    if (!response.ok) {
      var message =
        clean(data && data.error) ||
        clean(data && data.message) ||
        "OWNER_API_REQUEST_FAILED";

      throw new Error(message);
    }

    if (data && data.error) {
      throw new Error(clean(data.error));
    }

    return data;
  }

  /* ==========================================================
   * STATUS / UI
   * ========================================================== */

  function setStatus(id, message, type) {
    var node = byId(id);

    if (!node) {
      return;
    }

    node.textContent = message || "";

    node.classList.remove(
      "success",
      "error",
      "warning",
      "loading"
    );

    if (type) {
      node.classList.add(type);
    }
  }

  function setText(id, value) {
    var node = byId(id);

    if (!node) {
      return;
    }

    node.textContent = value == null ? "" : String(value);
  }

  function setValue(id, value) {
    var node = byId(id);

    if (!node) {
      return;
    }

    node.value = value == null ? "" : String(value);
  }

  /* ==========================================================
   * OWNER RENDER
   * ========================================================== */

  function renderOwner() {
    var owner = state.owner || {};
    var profile = state.ownerProfile || {};

    var username =
      clean(owner.username) ||
      clean(owner.pi_username) ||
      clean(profile.username) ||
      "Project Owner";

    var piUid =
      clean(owner.pi_uid) ||
      clean(profile.pi_uid);

    var verification =
      clean(profile.verification_status) ||
      clean(owner.verification_status) ||
      "pending";

    setText("ownerUsername", username);

    if (piUid) {
      setText("ownerPiUid", piUid);
    }

    setText(
      "verificationStatus",
      verification
    );

    setValue(
      "ownerName",
      profile.full_name ||
      profile.name ||
      ""
    );

    setValue(
      "ownerPhone",
      profile.phone ||
      ""
    );

    setValue(
      "ownerEmail",
      profile.email ||
      ""
    );
  }

  /* ==========================================================
   * PROJECT / TREASURY / LIQUIDITY RENDER
   * ========================================================== */

  function renderProject() {
    var project = state.project || {};
    var treasury = state.treasury || {};
    var liquidity = state.liquidity || {};

    var required =
      numberValue(
        liquidity.required_liquidity
      ) ||
      numberValue(
        project.required_liquidity
      ) ||
      numberValue(
        treasury.required_liquidity
      );

    var verified =
      numberValue(
        liquidity.verified_liquidity
      ) ||
      numberValue(
        liquidity.liquidity
      ) ||
      numberValue(
        project.liquidity
      ) ||
      numberValue(
        treasury.liquidity
      );

    var due = Math.max(
      0,
      required - verified
    );

    setText(
      "requiredLiquidity",
      formatPi(required) + " Pi"
    );

    setText(
      "verifiedLiquidity",
      formatPi(verified) + " Pi"
    );

    setText(
      "liquidityDue",
      formatPi(due) + " Pi"
    );

    var treasuryStatus =
      clean(treasury.status) ||
      clean(project.treasury_status) ||
      "CONFIGURED";

    setText(
      "treasuryStatus",
      treasuryStatus
    );

    /*
     * Default amount is the remaining required liquidity.
     */
    var amountNode = byId("liquidityAmount");

    if (
      amountNode &&
      !clean(amountNode.value) &&
      due > 0
    ) {
      amountNode.value = String(due);
    }

    return {
      required: required,
      verified: verified,
      due: due
    };
  }

  /* ==========================================================
   * PAYMENT CLIENT
   * ========================================================== */

  function liquidityPaymentClientAvailable() {
    var payment = getPaymentClient();

    return !!(
      payment &&
      typeof payment.createLiquidityPayment === "function"
    );
  }

  function paymentClientAuthenticated() {
    var payment = getPaymentClient();

    if (!payment) {
      return false;
    }

    if (
      typeof payment.isAuthenticated === "function"
    ) {
      try {
        return !!payment.isAuthenticated();
      } catch (error) {
        return false;
      }
    }

    /*
     * Older payment client versions may not expose
     * isAuthenticated(). In that case, do not use this
     * as a button-lock condition.
     */
    return false;
  }

  /* ==========================================================
   * LIQUIDITY BUTTON AVAILABILITY
   * ========================================================== */

  function setLiquidityAvailability() {
    var project = state.project || {};
    var owner = state.owner || {};
    var profile = state.ownerProfile || {};

    var liquidityInfo = renderProject();

    var ownerBound =
      !!(
        clean(owner.user_id) ||
        clean(owner.id)
      ) &&
      !!(
        clean(owner.pi_uid) ||
        clean(profile.pi_uid)
      );

    var verificationStatus =
      clean(
        profile.verification_status
      ).toLowerCase() ||
      clean(
        owner.verification_status
      ).toLowerCase();

    var ownerVerified =
      verificationStatus === "verified";

    var due =
      numberValue(liquidityInfo.due);

    var clientAvailable =
      liquidityPaymentClientAvailable();

    /*
     * IMPORTANT:
     *
     * Pi authentication is NOT included here.
     *
     * Otherwise the button can become permanently disabled
     * while Pi authentication is still being initialized.
     *
     * Pi authentication will be handled by the payment flow.
     */
    var ready =
      ownerBound &&
      ownerVerified &&
      due > 0 &&
      clientAvailable &&
      !state.liquidityPaymentInFlight;

    var button =
      byId("addLiquidityBtn") ||
      byId("addLiquidityButton") ||
      byId("liquidityButton");

    if (button) {
      button.disabled = !ready;

      button.classList.toggle(
        "disabled",
        !ready
      );

      button.setAttribute(
        "aria-disabled",
        ready ? "false" : "true"
      );
    }

    /*
     * If the HTML uses a separate disabled attribute,
     * keep it synchronized.
     */
    var amountNode = byId("liquidityAmount");

    if (amountNode) {
      amountNode.disabled =
        state.liquidityPaymentInFlight;
    }

    return ready;
  }

  /* ==========================================================
   * PI AUTHENTICATION
   *
   * This is NOT called by setLiquidityAvailability().
   *
   * It is used only when we actually need the Pi payment flow.
   * ========================================================== */

  async function ensurePiAuthentication() {
    var payment = getPaymentClient();

    if (
      !payment ||
      typeof payment.authenticate !== "function"
    ) {
      throw new Error(
        "PI_SDK_PAYMENT_UNAVAILABLE"
      );
    }

    if (
      typeof payment.isAuthenticated === "function"
    ) {
      try {
        if (payment.isAuthenticated()) {
          state.piAuthenticated = true;
          return true;
        }
      } catch (error) {
        console.warn(
          "[ALBUKHR][OWNER] Pi auth state check failed:",
          error
        );
      }
    }

    if (state.piAuthenticationInFlight) {
      return state.piAuthenticationInFlight;
    }

    state.piAuthenticationInFlight =
      payment
        .authenticate()
        .then(function () {
          state.piAuthenticated = true;

          return true;
        })
        .catch(function (error) {
          state.piAuthenticated = false;
          throw error;
        })
        .finally(function () {
          state.piAuthenticationInFlight = false;
        });

    return state.piAuthenticationInFlight;
  }

  /* ==========================================================
   * LOAD OWNER DATA
   * ========================================================== */

  async function loadOwnerData() {
    var projectId =
      getCurrentProjectId();

    if (!projectId) {
      throw new Error(
        "PROJECT_ID_REQUIRED"
      );
    }

    var data = await ownerRequest(
      "get_owner_dashboard",
      {
        project_id: projectId
      }
    );

    /*
     * Support the different response wrappers that the
     * Testnet owner function may return.
     */
    state.project =
      data.project ||
      (data.data && data.data.project) ||
      null;

    state.owner =
      data.owner ||
      (data.data && data.data.owner) ||
      null;

    state.ownerProfile =
      data.ownerProfile ||
      data.owner_profile ||
      (data.data && (
        data.data.ownerProfile ||
        data.data.owner_profile
      )) ||
      null;

    state.treasury =
      data.treasury ||
      (data.data && data.data.treasury) ||
      null;

    state.ownerBalance =
      data.ownerBalance ||
      data.owner_balance ||
      (data.data && (
        data.data.ownerBalance ||
        data.data.owner_balance
      )) ||
      null;

    state.liquidity =
      data.liquidity ||
      (data.data && data.data.liquidity) ||
      null;

    state.ownerLoaded = true;

    renderOwner();
    renderProject();
    setLiquidityAvailability();

    return data;
  }

  async function load() {
    try {
      validateEnvironment();

      setStatus(
        "ownerStatus",
        "Loading project owner data…",
        "loading"
      );

      await ensureSession();

      await loadOwnerData();

      /*
       * Do NOT force Pi authentication during page load.
       *
       * This prevents Pi authentication from becoming a
       * prerequisite for opening the Add Liquidity button.
       *
       * Payment authentication happens when the payment
       * process actually starts.
       */
      setLiquidityAvailability();

      setStatus(
        "ownerStatus",
        "Project owner dashboard ready.",
        "success"
      );

    } catch (error) {
      console.error(
        "[ALBUKHR][OWNER] Load failed:",
        error
      );

      setStatus(
        "ownerStatus",
        clean(error && error.message) ||
        "Unable to load project owner dashboard.",
        "error"
      );

      setLiquidityAvailability();
    }
  }

  /* ==========================================================
   * START LIQUIDITY PAYMENT
   * ========================================================== */

  async function startLiquidityPayment() {
    if (state.liquidityPaymentInFlight) {
      return;
    }

    try {
      validateEnvironment();

      /*
       * Session must already exist.
       *
       * This is ALBUKHR authorization.
       */
      var sessionToken =
        getSessionToken();

      if (!sessionToken) {
        throw new Error(
          "TESTNET_SESSION_REQUIRED"
        );
      }

      var amountNode =
        byId("liquidityAmount");

      var amount =
        numberValue(
          amountNode &&
          amountNode.value
        );

      var liquidityInfo =
        renderProject();

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error(
          "INVALID_LIQUIDITY_AMOUNT"
        );
      }

      if (
        liquidityInfo.due > 0 &&
        amount > liquidityInfo.due
      ) {
        throw new Error(
          "LIQUIDITY_AMOUNT_EXCEEDS_REQUIRED"
        );
      }

      var project =
        state.project || {};

      var projectId =
        clean(
          project.id ||
          state.projectId
        );

      var projectCode =
        clean(
          project.project_code ||
          project.code ||
          project.slug
        );

      if (!projectId) {
        throw new Error(
          "PROJECT_ID_REQUIRED"
        );
      }

      if (!projectCode) {
        throw new Error(
          "PROJECT_CODE_REQUIRED"
        );
      }

      var network =
        clean(
          project.network
        ).toLowerCase();

      if (
        network &&
        network !== "testnet"
      ) {
        throw new Error(
          "TESTNET_PROJECT_REQUIRED"
        );
      }

      /*
       * Owner verification is checked again immediately
       * before payment.
       */
      var owner =
        state.owner || {};

      var profile =
        state.ownerProfile || {};

      var verificationStatus =
        clean(
          profile.verification_status
        ).toLowerCase() ||
        clean(
          owner.verification_status
        ).toLowerCase();

      if (
        verificationStatus !==
        "verified"
      ) {
        throw new Error(
          "PROJECT_OWNER_NOT_VERIFIED"
        );
      }

      var payment =
        getPaymentClient();

      if (
        !payment ||
        typeof payment.createLiquidityPayment !==
          "function"
      ) {
        throw new Error(
          "PI_SDK_PAYMENT_UNAVAILABLE"
        );
      }

      /*
       * IMPORTANT:
       *
       * We do NOT check payment.isAuthenticated()
       * here and reject the button.
       *
       * Instead, authenticate now if required.
       */
      state.liquidityPaymentInFlight = true;

      setLiquidityAvailability();

      setStatus(
        "liquidityStatus",
        "Preparing the Pi Testnet payment flow…",
        "loading"
      );

      /*
       * Pi authentication is deliberately performed
       * immediately before payment creation.
       */
      await ensurePiAuthentication();

      setStatus(
        "liquidityStatus",
        "Opening the Pi Testnet payment flow…",
        "loading"
      );

      console.log(
        "[ALBUKHR][OWNER] Starting liquidity payment:",
        {
          projectId: projectId,
          projectCode: projectCode,
          amount: amount,
          network: "testnet",
          piAuthenticated:
            state.piAuthenticated
        }
      );

      /*
       * createLiquidityPayment() must call Pi.createPayment()
       * and the payment client handles:
       *
       * 1. Server approval
       * 2. Pi payment completion
       * 3. Incomplete payment recovery
       */
      var result =
        await payment.createLiquidityPayment(
          {
            id: projectId,
            project_code: projectCode,
            network: "testnet"
          },
          amount
        );

      console.log(
        "[ALBUKHR][OWNER] Liquidity payment result:",
        result
      );

      setStatus(
        "liquidityStatus",
        "Liquidity payment completed successfully.",
        "success"
      );

      /*
       * Reload authoritative state from Supabase.
       */
      try {
        await loadOwnerData();
      } catch (reloadError) {
        console.warn(
          "[ALBUKHR][OWNER] Reload after payment failed:",
          reloadError
        );
      }

      return result;

    } catch (error) {
      console.error(
        "[ALBUKHR][OWNER] Liquidity payment failed:",
        error
      );

      var message =
        clean(
          error &&
          error.message
        ) ||
        "Liquidity payment failed.";

      /*
       * Friendly messages for known states.
       */
      if (
        message ===
        "PI_PAYMENT_CANCELLED"
      ) {
        setStatus(
          "liquidityStatus",
          "Pi payment was cancelled.",
          "warning"
        );
      } else {
        setStatus(
          "liquidityStatus",
          message,
          "error"
        );
      }

      throw error;

    } finally {
      state.liquidityPaymentInFlight = false;

      /*
       * Recalculate button state after the payment flow.
       */
      setLiquidityAvailability();
    }
  }

  /* ==========================================================
   * PROFILE SAVE
   * ========================================================== */

  async function saveOwnerProfile() {
    if (state.profileSaveInFlight) {
      return;
    }

    try {
      state.profileSaveInFlight = true;

      var fullNameNode =
        byId("ownerName");

      var phoneNode =
        byId("ownerPhone");

      var emailNode =
        byId("ownerEmail");

      var fullName =
        clean(
          fullNameNode &&
          fullNameNode.value
        );

      var phone =
        clean(
          phoneNode &&
          phoneNode.value
        );

      var email =
        clean(
          emailNode &&
          emailNode.value
        );

      setStatus(
        "profileStatus",
        "Saving profile…",
        "loading"
      );

      var result =
        await ownerRequest(
          "update_owner_profile",
          {
            project_id:
              getCurrentProjectId(),

            full_name:
              fullName,

            phone:
              phone,

            email:
              email
          }
        );

      if (
        result &&
        result.ownerProfile
      ) {
        state.ownerProfile =
          result.ownerProfile;
      }

      if (
        result &&
        result.owner_profile
      ) {
        state.ownerProfile =
          result.owner_profile;
      }

      renderOwner();
      setLiquidityAvailability();

      setStatus(
        "profileStatus",
        "Profile saved successfully.",
        "success"
      );

      return result;

    } catch (error) {
      console.error(
        "[ALBUKHR][OWNER] Profile save failed:",
        error
      );

      setStatus(
        "profileStatus",
        clean(
          error &&
          error.message
        ) ||
        "Unable to save profile.",
        "error"
      );

      throw error;

    } finally {
      state.profileSaveInFlight = false;
    }
  }

  /* ==========================================================
   * WITHDRAWAL
   * ========================================================== */

  async function requestWithdrawal() {
    if (state.withdrawalInFlight) {
      return;
    }

    try {
      state.withdrawalInFlight = true;

      var amountNode =
        byId("withdrawAmount");

      var amount =
        numberValue(
          amountNode &&
          amountNode.value
        );

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        throw new Error(
          "INVALID_WITHDRAWAL_AMOUNT"
        );
      }

      setStatus(
        "withdrawStatus",
        "Submitting withdrawal request…",
        "loading"
      );

      var result =
        await ownerRequest(
          "request_withdrawal",
          {
            project_id:
              getCurrentProjectId(),

            amount:
              amount
          }
        );

      setStatus(
        "withdrawStatus",
        "Withdrawal request submitted successfully.",
        "success"
      );

      return result;

    } catch (error) {
      console.error(
        "[ALBUKHR][OWNER] Withdrawal failed:",
        error
      );

      setStatus(
        "withdrawStatus",
        clean(
          error &&
          error.message
        ) ||
        "Unable to submit withdrawal request.",
        "error"
      );

      throw error;

    } finally {
      state.withdrawalInFlight = false;
    }
  }

  /* ==========================================================
   * PI PAYMENT EVENTS
   * ========================================================== */

  function handlePiAuthenticated(event) {
    state.piAuthenticated = true;

    console.log(
      "[ALBUKHR][OWNER] Pi authentication confirmed.",
      event && event.detail
    );

    /*
     * Authentication status can update the UI,
     * but does not determine whether Add Liquidity
     * is enabled.
     */
    setLiquidityAvailability();
  }

  function handlePiAuthError(event) {
    state.piAuthenticated = false;

    console.warn(
      "[ALBUKHR][OWNER] Pi authentication error:",
      event && event.detail
    );

    /*
     * Do NOT permanently disable Add Liquidity merely
     * because authentication failed here.
     *
     * The next user click can retry authentication.
     */
    setLiquidityAvailability();
  }

  /* ==========================================================
   * BUTTON BINDINGS
   * ========================================================== */

  function bindButton(
    ids,
    handler
  ) {
    for (
      var i = 0;
      i < ids.length;
      i++
    ) {
      var node = byId(ids[i]);

      if (!node) {
        continue;
      }

      /*
       * Prevent duplicate listeners.
       */
      if (
        node.dataset &&
        node.dataset.albukhrOwnerBound ===
          "true"
      ) {
        continue;
      }

      node.addEventListener(
        "click",
        function (event) {
          event.preventDefault();

          handler().catch(function () {
            /*
             * Error is already rendered by the handler.
             */
          });
        }
      );

      if (node.dataset) {
        node.dataset.albukhrOwnerBound =
          "true";
      }
    }
  }

  function bindEvents() {
    bindButton(
      [
        "addLiquidityBtn",
        "addLiquidityButton",
        "liquidityButton"
      ],
      startLiquidityPayment
    );

    bindButton(
      [
        "saveOwnerProfileBtn",
        "saveProfileBtn"
      ],
      saveOwnerProfile
    );

    bindButton(
      [
        "withdrawBtn",
        "requestWithdrawalBtn"
      ],
      requestWithdrawal
    );

    window.addEventListener(
      "albukhr:testnet-liquidity-pi-authenticated",
      handlePiAuthenticated
    );

    window.addEventListener(
      "albukhr:testnet-liquidity-pi-auth-error",
      handlePiAuthError
    );
  }

  /* ==========================================================
   * PUBLIC API
   * ========================================================== */

  window.AlbukhrTestnetProjectOwner = Object.freeze({
    load: load,

    startLiquidityPayment:
      startLiquidityPayment,

    saveOwnerProfile:
      saveOwnerProfile,

    requestWithdrawal:
      requestWithdrawal,

    getState: function () {
      return Object.assign(
        {},
        state
      );
    }
  });

  /* ==========================================================
   * INITIALIZATION
   * ========================================================== */

  function initialize() {
    try {
      bindEvents();
    } catch (error) {
      console.error(
        "[ALBUKHR][OWNER] Event binding failed:",
        error
      );
    }

    load().catch(function (error) {
      console.error(
        "[ALBUKHR][OWNER] Initialization failed:",
        error
      );
    });
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      {
        once: true
      }
    );
  } else {
    initialize();
  }

})();
