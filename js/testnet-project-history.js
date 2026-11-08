/* ALBUKHR TESTNET PROJECT HISTORY v1
 *
 * Read-only project activity renderer.
 * Uses the existing authenticated Testnet investor-data Edge Function.
 * Displays only the signed-in Testnet user's stakes and withdrawals for
 * the currently selected Testnet project. It never queries Supabase from
 * the browser, reads the staking ledger, creates payments, or changes
 * withdrawal/staking controls.
 */
(function (window, document) {
  "use strict";

  var NETWORK = "testnet";
  var currentProject = null;
  var activeRequest = null;
  var activeProjectKey = "";
  var lastRows = [];

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function lower(value) {
    return clean(value).toLowerCase();
  }

  function numberValue(value) {
    var number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function element(id) {
    return document.getElementById(id);
  }

  function formatPi(value) {
    return numberValue(value).toFixed(2) + " Pi";
  }

  function formatPercent(value) {
    return (numberValue(value) * 100).toFixed(2) + "%";
  }

  function formatDate(value) {
    var timestamp = Date.parse(clean(value));
    if (!Number.isFinite(timestamp)) return "Date unavailable";

    try {
      return new Date(timestamp).toLocaleString();
    } catch (_) {
      return new Date(timestamp).toISOString();
    }
  }

  function projectKey(project) {
    return lower(project && (
      project.project_code || project.id || project.slug
    ));
  }

  function belongsToProject(row, project) {
    if (!row || lower(row.network) !== NETWORK || !project) return false;

    var rowCode = lower(row.project_code);
    var rowId = lower(row.project_id);
    var rowSlug = lower(row.slug);
    var code = lower(project.project_code);
    var id = lower(project.id);
    var slug = lower(project.slug);

    return (!!code && rowCode === code) ||
      (!!id && rowId === id) ||
      (!!slug && rowSlug === slug);
  }

  function clearNode(node) {
    if (!node) return;
    if (typeof node.replaceChildren === "function") {
      node.replaceChildren();
    } else {
      while (node.firstChild) node.removeChild(node.firstChild);
    }
  }

  function appendText(parent, tag, className, value) {
    var child = document.createElement(tag);
    if (className) child.className = className;
    child.textContent = clean(value);
    parent.appendChild(child);
    return child;
  }

  function renderState(title, description, icon) {
    var container = element("projectHistory");
    if (!container) return;

    container.className = "history-empty";
    clearNode(container);
    appendText(container, "div", "empty-icon", icon || "i");
    appendText(container, "strong", "", title);
    appendText(container, "p", "", description);
    lastRows = [];
  }

  function toHistoryRows(payload, project) {
    var stakes = Array.isArray(payload.stakes) ? payload.stakes : [];
    var withdrawals = Array.isArray(payload.withdrawals) ? payload.withdrawals : [];
    var rows = [];

    stakes.forEach(function (stake) {
      if (!belongsToProject(stake, project)) return;

      var rate = numberValue(stake.reward_rate);
      rows.push({
        kind: "stake",
        title: "Testnet stake",
        amount: numberValue(stake.amount),
        status: clean(stake.status) || "recorded",
        date: clean(stake.start_at || stake.created_at),
        timestamp: Date.parse(clean(stake.start_at || stake.created_at)) || 0,
        description: formatPi(stake.amount) + " • " +
          numberValue(stake.duration_days) + " days • " +
          formatPercent(rate) + " reward rate • estimated reward " +
          formatPi(stake.reward_amount),
        extra: stake.unlock_at
          ? "Capital unlock: " + formatDate(stake.unlock_at)
          : "",
        reference: ""
      });
    });

    withdrawals.forEach(function (withdrawal) {
      if (!belongsToProject(withdrawal, project)) return;

      var type = lower(withdrawal.withdrawal_type) === "capital"
        ? "Capital withdrawal"
        : "Reward withdrawal";
      var requested = numberValue(withdrawal.requested_amount);
      var fee = numberValue(withdrawal.fee_amount);
      var net = withdrawal.net_amount == null
        ? null
        : numberValue(withdrawal.net_amount);

      rows.push({
        kind: "withdrawal",
        title: type,
        amount: requested,
        status: clean(withdrawal.status) || "recorded",
        date: clean(withdrawal.created_at),
        timestamp: Date.parse(clean(withdrawal.created_at)) || 0,
        description: formatPi(requested) + " requested" +
          (net == null ? "" : " • " + formatPi(net) + " net") +
          (fee > 0 ? " • fee " + formatPi(fee) : ""),
        extra: "",
        reference: clean(withdrawal.txid)
      });
    });

    rows.sort(function (a, b) {
      return b.timestamp - a.timestamp;
    });

    return rows;
  }

  function renderHistory(payload, project) {
    var container = element("projectHistory");
    if (!container) return;

    var rows = toHistoryRows(payload, project);
    lastRows = rows;

    if (!rows.length) {
      renderState(
        "No Testnet activity for this project",
        "Your confirmed Testnet stakes and withdrawal requests will appear here.",
        "✓"
      );
      lastRows = [];
      return;
    }

    container.className = "history-list";
    clearNode(container);

    rows.forEach(function (row) {
      var item = document.createElement("article");
      item.className = "history-item";

      var head = document.createElement("div");
      head.className = "history-item-head";

      appendText(head, "strong", "history-item-title", row.title);
      appendText(head, "span", "history-item-status status-" + lower(row.status),
        clean(row.status).toUpperCase());
      item.appendChild(head);

      appendText(item, "p", "history-item-description", row.description);
      appendText(item, "time", "history-item-date", formatDate(row.date));

      if (row.extra) {
        appendText(item, "p", "history-item-extra", row.extra);
      }

      if (row.reference) {
        appendText(item, "p", "history-item-reference", "Transaction ID: " + row.reference);
      }

      container.appendChild(item);
    });
  }

  function getAuth() {
    var auth = window.AlbukhrTestnetAuth;
    if (!auth || typeof auth.requireTestnetAuth !== "function") {
      throw new Error("TESTNET_AUTH_MODULE_UNAVAILABLE");
    }
    return auth;
  }

  function getApi() {
    var api = window.AlbukhrTestnetApi;
    if (!api || api.network !== NETWORK || typeof api.getInvestorData !== "function") {
      throw new Error("TESTNET_INVESTOR_API_UNAVAILABLE");
    }
    return api;
  }

  async function fetchPortfolio(project) {
    var auth = getAuth();
    var session = await auth.requireTestnetAuth({ redirectOnFailure: false });

    if (!session || session.network !== NETWORK || !clean(session.pi_uid)) {
      renderState(
        "Testnet sign-in required",
        "Sign in through the ALBUKHR Testnet gateway to view your project activity.",
        "i"
      );
      return null;
    }

    var payload = await getApi().getInvestorData();

    if (!payload || payload.ok !== true || lower(payload.network) !== NETWORK) {
      throw new Error("TESTNET_INVESTOR_RESPONSE_INVALID");
    }

    if (!payload.user || clean(payload.user.pi_uid) !== clean(session.pi_uid)) {
      throw new Error("TESTNET_INVESTOR_IDENTITY_MISMATCH");
    }

    if (!Array.isArray(payload.stakes) || !Array.isArray(payload.withdrawals)) {
      throw new Error("TESTNET_INVESTOR_ACTIVITY_INVALID");
    }

    renderHistory(payload, project);

    /* Existing project-page bridge updates stake and reward summary cards. */
    window.dispatchEvent(new window.CustomEvent(
      "albukhr:testnet-investor-data-loaded",
      { detail: { payload: payload } }
    ));

    return payload;
  }

  function refresh(project) {
    if (project) currentProject = project;
    if (!currentProject || lower(currentProject.network) !== NETWORK) {
      renderState(
        "Testnet project unavailable",
        "Project activity cannot be loaded until an approved Testnet project is selected.",
        "!"
      );
      return Promise.resolve(null);
    }

    var key = projectKey(currentProject);
    if (activeRequest && activeProjectKey === key) return activeRequest;

    activeProjectKey = key;
    renderState(
      "Checking Testnet activity…",
      "Loading your Testnet staking and withdrawal history securely.",
      "…"
    );

    activeRequest = fetchPortfolio(currentProject).catch(function (error) {
      console.warn("[ALBUKHR TESTNET PROJECT HISTORY]", error);
      renderState(
        "Testnet activity unavailable",
        "The activity service could not be reached or the Testnet session needs renewal. Use Refresh to try again.",
        "!"
      );
      return null;
    }).finally(function () {
      activeRequest = null;
      activeProjectKey = "";
    });

    return activeRequest;
  }

  window.addEventListener("albukhr:testnet-project-loaded", function (event) {
    var project = event && event.detail && event.detail.project;
    if (!project) return;
    refresh(project);
  });

  window.addEventListener("albukhr:testnet-auth-success", function () {
    if (currentProject) refresh(currentProject);
  });

  var publicApi = {
    refresh: function () { return refresh(currentProject); },
    getRows: function () { return lastRows.slice(); }
  };

  try { Object.freeze(publicApi); } catch (_) {}
  window.AlbukhrTestnetProjectHistory = publicApi;

  /* Support a page where the project module finished before this module loaded. */
  try {
    var projectApi = window.AlbukhrTestnetProject;
    var existing = projectApi && typeof projectApi.getProject === "function"
      ? projectApi.getProject()
      : null;
    if (existing) refresh(existing);
  } catch (_) {}

})(window, document);
