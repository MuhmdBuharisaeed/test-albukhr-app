/* ALBUKHR TESTNET PROJECT OWNER PAGE v1 */
(function (window, document) {
  "use strict";

  var OWNER_API =
    "https://vhvkwvngmrlgyzwemttt.supabase.co/functions/v1/testnet-project-owner";

  var state = {
    projectId: "",
    project: null,
    treasury: null,
    ownerBalance: 0,
    liquidity: null,
    session: null,
    withdrawalInFlight: false,
    ownerLoaded: false
  };

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

  function getProjectId() {
    try {
      return clean(
        new URLSearchParams(window.location.search).get("project") ||
        new URLSearchParams(window.location.search).get("project_id")
      );
    } catch (_) {
      return "";
    }
  }

  function validateEnvironment() {
    var env = window.ALBukhrEnvironment;

    if (
      !env ||
      typeof env.isKnown !== "function" ||
      typeof env.isTestnet !== "function" ||
      typeof env.getNetwork !== "function"
    ) {
      throw new Error("TESTNET_ENVIRONMENT_UNAVAILABLE");
    }

    if (
      !env.isKnown() ||
      !env.isTestnet() ||
      env.getNetwork() !== "testnet"
    ) {
      throw new Error("INVALID_TESTNET_ENVIRONMENT");
    }

    var hostname =
      clean(
        typeof env.getHostname === "function"
          ? env.getHostname()
          : window.location.hostname
      ).toLowerCase();

    if (hostname !== "test.albukhr.com") {
      throw new Error("TESTNET_HOST_REQUIRED");
    }
  }

  function getAuth() {
    var auth = window.AlbukhrTestnetAuth;

    if (
      !auth ||
      typeof auth.requireTestnetAuth !== "function" ||
      typeof auth.getSessionToken !== "function"
    ) {
      throw new Error("TESTNET_AUTH_MODULE_UNAVAILABLE");
    }

    return auth;
  }

  async function ensureSession() {
    validateEnvironment();

    var auth = getAuth();

    state.session =
      await auth.requireTestnetAuth({
        redirectOnFailure: true
      });

    if (!state.session) {
      throw new Error("TESTNET_SESSION_REQUIRED");
    }

    return state.session;
  }

  async function ownerRequest(method, query, body) {
    var auth = getAuth();
    var token = clean(auth.getSessionToken());

    if (!token) {
      throw new Error("TESTNET_SESSION_REQUIRED");
    }

    var url = OWNER_API;

    if (query) {
      url += "?" + query;
    }

    var options = {
      method: method,
      headers: {
        "Accept": "application/json",
        "X-Testnet-Session": token
      }
    };

    if (body !== undefined) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    var response;

    try {
      response = await fetch(url, options);
    } catch (networkError) {
      var error = new Error("PROJECT_OWNER_NETWORK_ERROR");
      error.cause = networkError;
      throw error;
    }

    var payload = null;

    try {
      payload = await response.json();
    } catch (_) {
      payload = null;
    }

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

  function renderLogo(project) {
    var img = byId("ownerProjectLogo");
    var fallback = byId("ownerProjectLogoFallback");

    if (!img) return;

    var url = clean(project && project.logo_url);

    if (!url) {
      img.hidden = true;
      img.removeAttribute("src");
      if (fallback) fallback.hidden = false;
      return;
    }

    img.hidden = true;
    img.alt = clean(project.name) + " logo";

    img.onload = function () {
      img.hidden = false;
      if (fallback) fallback.hidden = true;
    };

    img.onerror = function () {
      img.hidden = true;
      img.removeAttribute("src");
      if (fallback) fallback.hidden = false;
    };

    img.src = url;
  }

  function renderOwner(stateRow) {
    var project = stateRow.project || {};
    var liquidity = stateRow.liquidity || {};
    var treasury = stateRow.treasury || null;

    state.project = project;
    state.treasury = treasury;
    state.liquidity = liquidity;
    state.ownerBalance = numberValue(stateRow.owner_balance);

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

    setText(
      "verifiedLiquidity",
      formatPi(liquidity.verified)
    );

    setText(
      "liquidityCoverage",
      numberValue(liquidity.coverage).toFixed(1) + "% coverage"
    );

    setText(
      "treasuryState",
      liquidity.treasury_configured ? "CONFIGURED" : "NOT CONFIGURED"
    );

    var walletNode = byId("withdrawWallet");
    if (walletNode) {
      walletNode.value =
        clean(state.session && state.session.wallet_address);
    }

    var withdrawButton = byId("requestWithdrawalBtn");
    if (withdrawButton) {
      withdrawButton.disabled =
        !state.session ||
        !clean(state.session.wallet_address) ||
        state.ownerBalance <= 0;
    }

    /*
     * Add-liquidity remains deliberately disabled until the Render
     * liquidity-payment router has the owner authorization guard.
     */
    var addButton = byId("addLiquidityBtn");
    if (addButton) {
      addButton.disabled = true;
    }

    setStatus(
      "liquidityStatus",
      "Add Liquidity is held pending the server-side owner gate on the Pi payment router."
    );

    renderLogo(project);
    renderWithdrawals(stateRow.withdrawals || []);

    var back = byId("backToProject");
    if (back && clean(project.id)) {
      back.href =
        "project.html?project=" +
        encodeURIComponent(project.project_code || project.id);
    }

    document.title =
      (clean(project.name) || "Project Owner") +
      " • ALBUKHR TESTNET";
  }

  function renderWithdrawals(rows) {
    var container = byId("withdrawalHistory");
    if (!container) return;

    var list = Array.isArray(rows) ? rows : [];

    if (!list.length) {
      container.innerHTML =
        '<div class="empty-state">No Project Owner withdrawals yet.</div>';
      return;
    }

    container.innerHTML = list.map(function (row) {
      var status = clean(row.status || "pending").toUpperCase();
      var amount = formatPi(row.requested_amount);
      var net = formatPi(row.net_amount);

      return (
        '<article class="history-item">' +
          '<div>' +
            '<strong>' + escapeHtml(status) + '</strong>' +
            '<span>' + escapeHtml(amount) + ' requested</span>' +
          '</div>' +
          '<div class="history-meta">' +
            '<span>Receive: ' + escapeHtml(net) + '</span>' +
            '<span>' + escapeHtml(formatDate(row.created_at)) + '</span>' +
          '</div>' +
        '</article>'
      );
    }).join("");
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDate(value) {
    if (!value) return "—";

    var date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    try {
      return new Intl.DateTimeFormat(
        "en",
        {
          year: "numeric",
          month: "short",
          day: "numeric"
        }
      ).format(date);
    } catch (_) {
      return date.toLocaleDateString();
    }
  }

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

  async function load() {
    try {
      validateEnvironment();
      await ensureSession();

      state.projectId = getProjectId();

      if (!state.projectId) {
        throw new Error("PROJECT_ID_REQUIRED");
      }

      var query =
        "project_id=" +
        encodeURIComponent(state.projectId);

      var payload =
        await ownerRequest("GET", query);

      var projects =
        Array.isArray(payload && payload.projects)
          ? payload.projects
          : [];

      if (!projects.length) {
        throw new Error("PROJECT_OWNER_ACCESS_DENIED");
      }

      state.ownerLoaded = true;

      setText(
        "ownerUserPill",
        clean(payload.owner && payload.owner.username) ||
        "OWNER"
      );

      setHidden("ownerError", true);
      setHidden("ownerContent", false);

      renderOwner(projects[0]);

    } catch (error) {
      console.error(
        "[ALBUKHR TESTNET PROJECT OWNER]",
        error
      );

      showAccessError(error);
    }
  }

  async function refresh() {
    if (!state.projectId) return;

    try {
      var query =
        "project_id=" +
        encodeURIComponent(state.projectId);

      var payload =
        await ownerRequest("GET", query);

      var projects =
        Array.isArray(payload && payload.projects)
          ? payload.projects
          : [];

      if (!projects.length) {
        throw new Error("PROJECT_OWNER_ACCESS_DENIED");
      }

      state.session =
        getAuth().getSession();

      renderOwner(projects[0]);

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

  async function requestWithdrawal() {
    if (state.withdrawalInFlight) return;

    var amountNode = byId("withdrawAmount");
    var amount = numberValue(amountNode && amountNode.value);

    if (amount <= 0) {
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

    if (!clean(state.session && state.session.wallet_address)) {
      setStatus(
        "withdrawStatus",
        "A registered Testnet wallet address is required.",
        "error"
      );
      return;
    }

    state.withdrawalInFlight = true;

    var button = byId("requestWithdrawalBtn");
    if (button) {
      button.disabled = true;
      button.textContent = "Submitting…";
    }

    setStatus(
      "withdrawStatus",
      "Submitting Project Owner withdrawal request…"
    );

    try {
      var response =
        await ownerRequest(
          "POST",
          null,
          {
            action: "request_withdrawal",
            project_id: state.projectId,
            amount: amount
          }
        );

      var withdrawal =
        response && response.withdrawal
          ? response.withdrawal
          : null;

      if (!withdrawal || !withdrawal.id) {
        throw new Error("OWNER_WITHDRAWAL_REQUEST_FAILED");
      }

      setStatus(
        "withdrawStatus",
        "Owner withdrawal request submitted successfully.",
        "success"
      );

      if (amountNode) {
        amountNode.value = "";
      }

      await refresh();

    } catch (error) {
      console.error(
        "[ALBUKHR TESTNET OWNER WITHDRAWAL]",
        error
      );

      setStatus(
        "withdrawStatus",
        error && error.message
          ? error.message
          : "Owner withdrawal request failed.",
        "error"
      );

    } finally {
      state.withdrawalInFlight = false;

      if (button) {
        button.textContent = "Request Owner Withdrawal";
        button.disabled =
          !state.session ||
          !clean(state.session.wallet_address) ||
          state.ownerBalance <= 0;
      }
    }
  }

  function bindEvents() {
    var refreshButton = byId("refreshOwnerBtn");
    if (refreshButton) {
      refreshButton.addEventListener("click", refresh);
    }

    var withdrawalButton = byId("requestWithdrawalBtn");
    if (withdrawalButton) {
      withdrawalButton.addEventListener(
        "click",
        requestWithdrawal
      );
    }

    var addButton = byId("addLiquidityBtn");
    if (addButton) {
      addButton.addEventListener("click", function () {
        setStatus(
          "liquidityStatus",
          "Add Liquidity is waiting for the server-side owner authorization patch on the Pi payment router.",
          "error"
        );
      });
    }
  }

  function initialize() {
    bindEvents();
    load();
  }

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
