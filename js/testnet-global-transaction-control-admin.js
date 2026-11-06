/* ALBUKHR Testnet Super Admin — Global Transaction Controls v1 */
(function (window, document) {
  "use strict";

  var API_BASE = "https://test-albukhr-api.onrender.com/staking";
  var HOST = "test.albukhr.com";
  var NETWORK = "testnet";
  var AUTH = window.AlbukhrTestnetAdminAuth;
  var ROOT_ID = "albukhrTestnetGlobalTransactionControls";
  var busy = false;

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function create(tag, className, value) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (value != null) node.textContent = String(value);
    return node;
  }

  function environment() {
    var env = window.ALBukhrEnvironment;
    if (!env || typeof env.isKnown !== "function" ||
        typeof env.isTestnet !== "function" ||
        typeof env.getNetwork !== "function") {
      throw new Error("TESTNET_ENVIRONMENT_UNAVAILABLE");
    }
    if (!env.isKnown() || !env.isTestnet() || env.getNetwork() !== NETWORK) {
      throw new Error("INVALID_TESTNET_ENVIRONMENT");
    }
    var host = clean(typeof env.getHostname === "function"
      ? env.getHostname()
      : window.location.hostname).toLowerCase();
    if (host !== HOST) throw new Error("TESTNET_ADMIN_AUTH_HOST_REQUIRED");
  }

  function requireSuperAdmin(session) {
    var roles = session && session.admin && Array.isArray(session.admin.roles)
      ? session.admin.roles : [];
    if (!roles.some(function (role) {
      return clean(role).toLowerCase() === "super_admin";
    })) {
      throw new Error("GLOBAL_TRANSACTION_CONTROL_SUPER_ADMIN_REQUIRED");
    }
  }

  function addStyles() {
    if (document.getElementById(ROOT_ID + "Styles")) return;
    var style = create("style");
    style.id = ROOT_ID + "Styles";
    style.textContent = `
      #${ROOT_ID}{margin:24px 0;padding:18px;border:1px solid #cddfd3;border-radius:16px;background:var(--panel-bg,#fff);color:var(--text-color,#1f2d25)}
      #${ROOT_ID} .global-control-head{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}
      #${ROOT_ID} h2{margin:4px 0 8px;font-size:1.2rem}
      #${ROOT_ID} .global-control-note{margin:0 0 14px;line-height:1.5;color:var(--muted-color,#617067)}
      #${ROOT_ID} .global-control-status{margin:12px 0;padding:10px 12px;border-radius:9px;background:#f0f5f1;color:#294d37;white-space:pre-wrap;overflow-wrap:anywhere}
      #${ROOT_ID} .global-control-status.error{background:#fff0ef;color:#8b2222}
      #${ROOT_ID} .global-control-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      #${ROOT_ID} .global-control-card{border:1px solid #dfe9e2;border-radius:12px;padding:13px;background:#fbfefc;min-width:0}
      #${ROOT_ID} .global-control-card h3{margin:0 0 8px;font-size:1rem}
      #${ROOT_ID} .global-control-state{font-weight:800;font-size:1.05rem;margin-bottom:8px}
      #${ROOT_ID} .global-control-state.active{color:#137344}
      #${ROOT_ID} .global-control-state.paused{color:#92610e}
      #${ROOT_ID} .global-control-checks{padding:0;margin:10px 0;list-style:none;display:grid;gap:7px}
      #${ROOT_ID} .global-control-checks li{font-size:12px;line-height:1.45;border-top:1px solid #e7eee9;padding-top:7px;overflow-wrap:anywhere}
      #${ROOT_ID} .global-control-checks b{display:block;font-size:11px}
      #${ROOT_ID} .global-control-checks .pass b{color:#137344}
      #${ROOT_ID} .global-control-checks .blocked b{color:#a33a2d}
      #${ROOT_ID} .global-control-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
      #${ROOT_ID} button{border:0;border-radius:9px;padding:10px 12px;background:#0f7a3d;color:#fff;font-weight:800;cursor:pointer}
      #${ROOT_ID} button.secondary{background:#8d2d2d}
      #${ROOT_ID} button.refresh{background:#e8f0eb;color:#174d32}
      #${ROOT_ID} button:disabled{opacity:.45;cursor:not-allowed}
      #${ROOT_ID} .global-control-footnote{margin:10px 0 0;color:#6f7d74;font-size:11px;line-height:1.5}
      #${ROOT_ID} .global-control-audit{margin-top:16px;border-top:1px solid #e0e9e3;padding-top:12px}
      #${ROOT_ID} .global-control-audit h3{font-size:13px;margin:0 0 8px}
      #${ROOT_ID} .global-control-audit-item{padding:8px 0;border-bottom:1px solid #edf1ee;font-size:11px;line-height:1.45}
      #${ROOT_ID} .global-control-audit-item strong{display:block}
      @media(max-width:640px){#${ROOT_ID}{padding:14px}#${ROOT_ID} .global-control-grid{grid-template-columns:1fr}#${ROOT_ID} .global-control-actions button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function getHost() {
    var existing = document.getElementById(ROOT_ID);
    if (existing) return existing;
    addStyles();

    var panel = create("section");
    panel.id = ROOT_ID;
    panel.setAttribute("aria-labelledby", ROOT_ID + "Title");

    var head = create("div", "global-control-head");
    var titleBox = create("div");
    titleBox.appendChild(create("div", "section-kicker", "SUPER ADMIN · TESTNET ONLY"));
    var title = create("h2", "", "Global Testnet Transaction Control");
    title.id = ROOT_ID + "Title";
    titleBox.appendChild(title);
    titleBox.appendChild(create("p", "global-control-note",
      "Control the shared Testnet Treasury and the Global Staking Policy separately. Every activation is rechecked by the API and database, and recorded in the audit log."));
    head.appendChild(titleBox);

    var refresh = create("button", "refresh", "Refresh status");
    refresh.type = "button";
    refresh.addEventListener("click", load);
    head.appendChild(refresh);
    panel.appendChild(head);
    panel.appendChild(create("div", "global-control-status", "Checking Super Admin access…"));
    panel.appendChild(create("div", "global-control-content"));

    var rulesPanel = document.querySelector("main .rules-panel");
    var main = document.querySelector("main") || document.body;
    if (rulesPanel && rulesPanel.parentNode === main) main.insertBefore(panel, rulesPanel);
    else main.appendChild(panel);
    return panel;
  }

  function setStatus(message, isError) {
    var panel = document.getElementById(ROOT_ID);
    var node = panel && panel.querySelector(".global-control-status");
    if (!node) return;
    node.textContent = clean(message);
    node.classList.toggle("error", Boolean(isError));
  }

  async function api(path, payload) {
    environment();
    var allowed = ["/admin/global-controls", "/admin/global-controls/enablement"];
    if (allowed.indexOf(path) === -1) throw new Error("GLOBAL_CONTROL_API_PATH_NOT_ALLOWED");
    if (!AUTH || typeof AUTH.getSessionToken !== "function") throw new Error("TESTNET_ADMIN_AUTH_UNAVAILABLE");
    var token = clean(AUTH.getSessionToken());
    if (!token) throw new Error("TESTNET_ADMIN_SESSION_REQUIRED");

    var response = await fetch(API_BASE + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "x-testnet-admin-session": token
      },
      body: JSON.stringify(payload || {})
    });
    var body = null;
    try { body = await response.json(); } catch (_) { body = null; }
    if (!response.ok || !body || body.success !== true) {
      throw new Error(clean(body && (body.message || body.error)) || "GLOBAL_TRANSACTION_CONTROL_REQUEST_FAILED");
    }
    return body;
  }

  function renderChecks(list) {
    var ul = create("ul", "global-control-checks");
    (Array.isArray(list) ? list : []).forEach(function (item) {
      var li = create("li", item.ready ? "pass" : "blocked");
      li.appendChild(create("b", "", (item.ready ? "PASS · " : "BLOCKED · ") + clean(item.label)));
      li.appendChild(create("span", "", clean(item.detail)));
      ul.appendChild(li);
    });
    return ul;
  }

  function actionButton(label, control, enabled, disabled, secondary) {
    var button = create("button", secondary ? "secondary" : "", label);
    button.type = "button";
    button.disabled = Boolean(disabled) || busy;
    button.addEventListener("click", function () {
      changeControl(control, enabled);
    });
    return button;
  }

  function render(status) {
    var panel = getHost();
    var content = panel.querySelector(".global-control-content");
    content.replaceChildren();

    var grid = create("div", "global-control-grid");

    var treasuryCard = create("article", "global-control-card");
    treasuryCard.appendChild(create("h3", "", "Global Treasury"));
    var treasuryActive = status.policy && status.policy.treasury_active === true;
    treasuryCard.appendChild(create("div", "global-control-state " + (treasuryActive ? "active" : "paused"), treasuryActive ? "ACTIVE" : "PAUSED"));
    treasuryCard.appendChild(renderChecks(status.treasury && status.treasury.checks));
    var treasuryActions = create("div", "global-control-actions");
    if (treasuryActive) {
      treasuryActions.appendChild(actionButton("Pause Global Treasury", "treasury", false, !status.treasury.can_disable, true));
    } else {
      treasuryActions.appendChild(actionButton("Activate Global Treasury", "treasury", true, !status.treasury.can_enable, false));
    }
    treasuryCard.appendChild(treasuryActions);
    treasuryCard.appendChild(create("p", "global-control-footnote", "This control enables the shared Testnet treasury and its fee-processing gates. It does not activate staking by itself."));
    grid.appendChild(treasuryCard);

    var stakingCard = create("article", "global-control-card");
    stakingCard.appendChild(create("h3", "", "Global Staking Policy"));
    var stakingActive = status.policy && status.policy.staking_policy_active === true;
    stakingCard.appendChild(create("div", "global-control-state " + (stakingActive ? "active" : "paused"), stakingActive ? "ACTIVE" : "PAUSED"));
    stakingCard.appendChild(renderChecks(status.staking && status.staking.checks));
    stakingCard.appendChild(create("p", "global-control-footnote", "Eligible projects must also have their own approved risk controls and project-level staking flag. Current eligible projects: " + Number(status.staking && status.staking.ready_project_count || 0) + "."));
    var stakingActions = create("div", "global-control-actions");
    if (stakingActive) {
      stakingActions.appendChild(actionButton("Pause Global Staking", "staking", false, !status.staking.can_disable, true));
    } else {
      stakingActions.appendChild(actionButton("Activate Global Staking Policy", "staking", true, !status.staking.can_enable, false));
    }
    stakingCard.appendChild(stakingActions);
    grid.appendChild(stakingCard);

    content.appendChild(grid);

    var audit = create("div", "global-control-audit");
    audit.appendChild(create("h3", "", "Recent Global Control Audit"));
    var rows = Array.isArray(status.audit) ? status.audit : [];
    if (!rows.length) {
      audit.appendChild(create("div", "global-control-audit-item", "No global activation changes recorded yet."));
    } else {
      rows.forEach(function (row) {
        var item = create("div", "global-control-audit-item");
        var label = clean(row.control).toUpperCase() + " · " + clean(row.action).toUpperCase();
        item.appendChild(create("strong", "", label));
        item.appendChild(create("span", "", clean(row.reason)));
        var time = row.created_at ? new Date(row.created_at).toLocaleString() : "Time unavailable";
        item.appendChild(create("div", "", time + " · " + clean(row.admin_email || "Super Admin")));
        audit.appendChild(item);
      });
    }
    content.appendChild(audit);
  }

  async function load() {
    if (busy) return;
    setStatus("Loading global Testnet control status and readiness…", false);
    try {
      environment();
      if (!AUTH || typeof AUTH.requireAdmin !== "function") throw new Error("TESTNET_ADMIN_AUTH_UNAVAILABLE");
      var session = await AUTH.requireAdmin({ redirectOnFailure: false });
      if (!session) throw new Error("TESTNET_ADMIN_SESSION_REQUIRED");
      requireSuperAdmin(session);
      var result = await api("/admin/global-controls", {});
      render(result);
      setStatus("Global controls loaded from the Testnet database. No activation was performed.", false);
    } catch (error) {
      setStatus(clean(error && error.message) || "Could not load global Testnet controls.", true);
    }
  }

  async function changeControl(control, enabled) {
    if (busy) return;
    var action = enabled ? "ACTIVATE" : "PAUSE";
    var explanation = control === "treasury"
      ? "This changes the shared Testnet Treasury state. Global Staking is a separate control."
      : "This opens or pauses Global Testnet staking. Only approved projects with their own enabled risk controls can accept stakes.";
    if (!window.confirm(action + " Global Testnet " + control.toUpperCase() + "?\n\n" + explanation)) return;

    var reason = window.prompt("Enter the Super Admin audit reason (10–500 characters):", "");
    if (reason === null) return;
    reason = clean(reason);
    if (reason.length < 10 || reason.length > 500) {
      setStatus("The reason must contain 10–500 characters. No change was made.", true);
      return;
    }

    busy = true;
    setStatus(action + " request submitted for " + control + "…", false);
    try {
      await api("/admin/global-controls/enablement", {
        control: control,
        enabled: enabled,
        reason: reason
      });
      setStatus("Global " + control + " control updated. Reloading verified database status…", false);
    } catch (error) {
      setStatus(clean(error && error.message) || "Global control update failed. No success is assumed.", true);
    } finally {
      busy = false;
      await load();
    }
  }

  function init() {
    try {
      environment();
      getHost();
      load();
    } catch (_) {
      // Keep the privileged control panel unavailable outside the official Testnet host.
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})(window, document);
