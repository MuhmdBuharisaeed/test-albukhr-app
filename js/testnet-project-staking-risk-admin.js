
/* ALBUKHR Testnet Super Admin — Project Staking Risk Controls v2
 *
 * Testnet-only risk-control administration.
 * Provisioning creates pending controls only.
 * Review is separate and never enables project/global staking.
 */
(function (window, document) {
  "use strict";

  var API_BASE = "https://test-albukhr-api.onrender.com/staking";
  var HOST = "test.albukhr.com";
  var NETWORK = "testnet";
  var AUTH = window.AlbukhrTestnetAdminAuth;
  var ROOT_ID = "albukhrTestnetStakingRiskControls";
  var busy = false;
  var projects = [];
  var policies = Object.create(null);

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function create(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  }

  function pi(value) {
    if (value == null || value === "") return "Not configured";
    var n = Number(value);
    return Number.isFinite(n)
      ? n.toLocaleString(undefined, { maximumFractionDigits: 4 }) + " Pi"
      : "Not configured";
  }

  function percent(value) {
    if (value == null || value === "") return "Not configured";
    var n = Number(value);
    return Number.isFinite(n)
      ? n.toLocaleString(undefined, { maximumFractionDigits: 4 }) + "%"
      : "Not configured";
  }

  /* FIX 1: Full Testnet environment and hostname validation. */
  function environment() {
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
      env.getNetwork() !== NETWORK
    ) {
      throw new Error("INVALID_TESTNET_ENVIRONMENT");
    }

    var host = clean(
      typeof env.getHostname === "function"
        ? env.getHostname()
        : window.location.hostname
    ).toLowerCase();

    if (host !== HOST) {
      throw new Error("TESTNET_ADMIN_AUTH_HOST_REQUIRED");
    }

    return env;
  }

  function requireSuperAdmin(session) {
    var roles =
      session && session.admin && Array.isArray(session.admin.roles)
        ? session.admin.roles
        : [];

    if (!roles.some(function (role) {
      return clean(role).toLowerCase() === "super_admin";
    })) {
      throw new Error("STAKING_POLICY_SUPER_ADMIN_REQUIRED");
    }
  }

  /* FIX 2: Accept both actual database status and legacy UI status. */
  function isPendingReview(status) {
    var value = clean(status).toLowerCase();
    return value === "pending" || value === "pending_review";
  }

  async function api(path, payload) {
    environment();

      var allowedPaths = [
  "/admin/risk-projects",
  "/admin/policy",
  "/admin/policy/provision",
  "/admin/policy/review",
  "/admin/policy/enablement"
];

    if (allowedPaths.indexOf(path) === -1) {
      throw new Error("TESTNET_RISK_ADMIN_API_PATH_NOT_ALLOWED");
    }

    if (!AUTH || typeof AUTH.getSessionToken !== "function") {
      throw new Error("TESTNET_ADMIN_AUTH_UNAVAILABLE");
    }

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
    try {
      body = await response.json();
    } catch (_) {
      body = null;
    }

    if (!response.ok || !body || body.success !== true) {
      throw new Error(
        clean(body && (body.message || body.error)) ||
        "TESTNET_STAKING_RISK_ADMIN_REQUEST_FAILED"
      );
    }

    return body;
  }

  function addStyles() {
    if (document.getElementById(ROOT_ID + "Styles")) return;

    var style = create("style");
    style.id = ROOT_ID + "Styles";
    style.textContent = `
      #${ROOT_ID}{
        margin:24px 0;
        padding:18px;
        border:1px solid #d7e0da;
        border-radius:16px;
        background:var(--panel-bg,#fff);
        color:var(--text-color,#1f2d25)
      }
      #${ROOT_ID} .risk-head{
        display:flex;
        gap:12px;
        align-items:flex-start;
        justify-content:space-between;
        flex-wrap:wrap
      }
      #${ROOT_ID} h2{margin:4px 0 8px;font-size:1.2rem}
      #${ROOT_ID} .risk-note{
        margin:0 0 14px;
        line-height:1.5;
        color:var(--muted-color,#617067)
      }
      #${ROOT_ID} .risk-status{
        margin:12px 0;
        padding:10px 12px;
        border-radius:9px;
        background:#f0f5f1;
        color:#294d37;
        white-space:pre-wrap;
        overflow-wrap:anywhere
      }
      #${ROOT_ID} .risk-status.error{
        background:#fff0ef;
        color:#8b2222
      }
      #${ROOT_ID} .risk-card{
        margin:12px 0;
        padding:14px;
        border:1px solid #dfe7e1;
        border-radius:12px
      }
      #${ROOT_ID} .risk-card-head{
        display:flex;
        gap:12px;
        align-items:flex-start;
        justify-content:space-between;
        flex-wrap:wrap
      }
      #${ROOT_ID} .risk-project-name{
        display:block;
        font-weight:700
      }
      #${ROOT_ID} .risk-project-code{
        display:block;
        margin-top:3px;
        color:var(--muted-color,#617067);
        font-size:.84rem
      }
      #${ROOT_ID} .risk-grid{
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
        gap:8px;
        margin:12px 0
      }
      #${ROOT_ID} .risk-field{
        padding:9px;
        border-radius:8px;
        background:var(--soft-panel,#f5f8f5);
        overflow-wrap:anywhere
      }
      #${ROOT_ID} .risk-field small{
        display:block;
        color:var(--muted-color,#617067);
        margin-bottom:3px
      }
      #${ROOT_ID} .risk-field strong{font-size:.94rem}
      #${ROOT_ID} .risk-actions{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
        margin-top:12px
      }
      #${ROOT_ID} button{
        padding:9px 12px;
        border:0;
        border-radius:8px;
        background:#176b45;
        color:#fff;
        font-weight:700;
        cursor:pointer
      }
      #${ROOT_ID} button.secondary{
        background:#e8f0eb;
        color:#174d32
      }
      #${ROOT_ID} button.danger{
        background:#8b2828;
        color:#fff
      }
      #${ROOT_ID} button:disabled{
        opacity:.5;
        cursor:not-allowed
      }
      #${ROOT_ID} .risk-tag{
        display:inline-block;
        padding:4px 8px;
        border-radius:999px;
        background:#edf3ee;
        color:#31543c;
        font-size:.78rem;
        font-weight:700
      }
      #${ROOT_ID} .risk-warning{
        margin:10px 0 0;
        padding:10px;
        border-left:3px solid #a77a21;
        background:#fff9e9;
        color:#59451b;
        line-height:1.45
      }
      @media(max-width:600px){
        #${ROOT_ID}{padding:13px}
        #${ROOT_ID} .risk-actions button{
          width:100%;
          min-height:42px
        }
      }
    `;

    document.head.appendChild(style);
  }

  function hostPanel() {
    var existing = document.getElementById(ROOT_ID);
    if (existing) return existing;

    addStyles();

    var panel = create("section");
    panel.id = ROOT_ID;
    panel.setAttribute("aria-labelledby", ROOT_ID + "Title");

    var head = create("div", "risk-head");
    var titleBox = create("div");

    titleBox.appendChild(
      create("div", "section-kicker", "TESTNET ONLY · SUPER ADMIN")
    );

    var title = create("h2", "", "Project Staking Risk Controls");
    title.id = ROOT_ID + "Title";
    titleBox.appendChild(title);

    titleBox.appendChild(
      create(
        "p",
        "risk-note",
      "Testnet uses one universal Testnet risk profile for every Mainnet-approved project. Provisioning creates pending controls only. A separate Super Admin decision is required; approval does not enable staking."
      )
    );

    var refresh = create("button", "secondary", "Refresh risk controls");
    refresh.type = "button";
    refresh.addEventListener("click", loadAll);

    head.appendChild(titleBox);
    head.appendChild(refresh);
    panel.appendChild(head);

    panel.appendChild(
      create("div", "risk-status", "Checking Testnet Super Admin access…")
    );
    panel.appendChild(create("div", "risk-content"));

    var main =
      document.querySelector("main.admin-main") ||
      document.querySelector("main") ||
      document.body;

    var stagePanel = document.getElementById(
      "albukhrTestnetStakingStageManager"
    );
    var rulesPanel = main.querySelector(".rules-panel");

    if (stagePanel && stagePanel.parentNode === main) {
      main.insertBefore(panel, stagePanel.nextSibling);
    } else if (rulesPanel && rulesPanel.parentNode === main) {
      main.insertBefore(panel, rulesPanel);
    } else {
      main.appendChild(panel);
    }

    return panel;
  }

  function setStatus(message, isError) {
    var panel = document.getElementById(ROOT_ID);
    var node = panel && panel.querySelector(".risk-status");
    if (!node) return;

    node.textContent = clean(message);
    node.classList.toggle("error", Boolean(isError));
  }

  function field(grid, label, value) {
    var box = create("div", "risk-field");
    box.appendChild(create("small", "", label));
    box.appendChild(create("strong", "", value));
    grid.appendChild(box);
  }

  function stageLabel(value) {
    return ({
      setup_pre_operation: "Setup / Pre-operation",
      construction_fit_out: "Construction / Fit-out",
      operating_expansion: "Operating / Expansion"
    })[clean(value)] || "Not assigned";
  }

  function canProvision(project, result) {
    var policy = result && result.policy;

    return Boolean(
      result &&
      result.can_provision === true &&
      !policy &&
      clean(project.staking_stage) &&
      clean(project.treasury_status).toLowerCase() === "active" &&
      Number(project.required_liquidity) > 0
    );
  }

  function renderCard(project, result) {
    var card = create("article", "risk-card");
    var head = create("div", "risk-card-head");
    var identity = create("div");

    identity.appendChild(
      create(
        "span",
        "risk-project-name",
        project.name || project.project_code || "Project"
      )
    );

    identity.appendChild(
      create("span", "risk-project-code", project.project_code || "—")
    );

    head.appendChild(identity);

    var policy = result && result.policy;
    var status = clean(policy && policy.approval_status).toLowerCase();

    /* FIX 3: Display a consistent review label for both pending values. */
    var badgeText = result && result.error
      ? "Policy read failed"
      : !policy
        ? "Not provisioned"
        : isPendingReview(status)
          ? "Pending review"
          : status || "Policy record";

    head.appendChild(create("span", "risk-tag", badgeText));
    card.appendChild(head);

    var grid = create("div", "risk-grid");

    field(grid, "Business stage", stageLabel(project.staking_stage));
    field(
      grid,
      "Treasury status",
      clean(project.treasury_status) || "Not configured"
    );
    field(
      grid,
      "Verified / required liquidity",
      pi(project.verified_liquidity) + " / " + pi(project.required_liquidity)
    );
    field(
      grid,
      "Project staking enabled",
      policy && policy.staking_enabled === true ? "Yes" : "No"
    );

    if (policy) {
      field(grid, "Minimum liquidity", pi(policy.minimum_liquidity));
      field(grid, "Capital reserve", percent(policy.capital_reserve_percent));
      field(grid, "Maximum deployment", percent(policy.maximum_deployment_percent));
      field(grid, "Maximum reward rate (stored)", clean(policy.max_reward_rate));
      field(grid, "Maximum active principal", pi(policy.max_active_principal));
      field(
        grid,
        "Reward reserve coverage",
        percent(policy.reward_reserve_coverage_percent)
      );
    }

    card.appendChild(grid);

    if (result && result.error) {
      card.appendChild(
        create(
          "p",
          "risk-warning",
          "Could not read this project's policy: " + result.error
        )
      );
      return card;
    }

    var actions = create("div", "risk-actions");

    if (!policy) {
      var provision = create(
        "button",
        "",
        "Provision pending risk controls"
      );

      provision.type = "button";
      provision.disabled = !canProvision(project, result);

      provision.addEventListener("click", async function () {
        if (busy || !canProvision(project, result)) return;

        var ok = window.confirm(
          "Create a PENDING Testnet risk-control record for " +
          clean(project.project_code) +
          " using the current approved stage policy? This does not approve the controls or enable staking."
        );

        if (!ok) return;
        await perform(project, "provision");
      });

      actions.appendChild(provision);

      if (!project.staking_stage) {
        card.appendChild(
          create(
            "p",
            "risk-warning",
            "Assign the correct business lifecycle stage in the Stage Manager before provisioning."
          )
        );
      } else if (
        clean(project.treasury_status).toLowerCase() !== "active" ||
        !(Number(project.required_liquidity) > 0)
      ) {
        card.appendChild(
          create(
            "p",
            "risk-warning",
            "An active Testnet project treasury and a positive project liquidity target are required before provisioning."
          )
        );
      }

    /* FIX 4: Review buttons now support database status 'pending'. */
    } else if (isPendingReview(policy.approval_status)) {
      [
        {
          decision: "approved",
          label: "Approve controls",
          className: ""
        },
        {
          decision: "rejected",
          label: "Reject controls",
          className: "danger"
        },
        {
          decision: "suspended",
          label: "Suspend controls",
          className: "secondary"
        }
      ].forEach(function (item) {
        var button = create("button", item.className, item.label);
        button.type = "button";

        button.addEventListener("click", async function () {
          if (busy) return;

          var warning = item.decision === "approved"
            ? "Confirm you have reviewed all displayed risk limits and approve this Testnet policy. Staking will remain disabled."
            : "Confirm " + item.decision +
              " for this Testnet project's pending risk controls.";

          if (!window.confirm(warning)) return;
          await perform(project, "review", item.decision);
        });

        actions.appendChild(button);
      });
    }

        if (policy && status === "approved") {
      var currentlyEnabled = policy.staking_enabled === true;

      var enablementButton = create(
        "button",
        currentlyEnabled ? "danger" : "",
        currentlyEnabled
          ? "Disable project staking"
          : "Enable project staking"
      );

      enablementButton.type = "button";

      enablementButton.addEventListener("click", async function () {
        if (busy) return;

        var desiredEnabled = !currentlyEnabled;

        var reason = window.prompt(
          "Enter the reason for " +
          (desiredEnabled ? "enabling" : "disabling") +
          " project staking for " +
          clean(project.project_code) +
          " (10–500 characters):"
        );

        if (reason === null) return;

        reason = clean(reason);

        if (reason.length < 10 || reason.length > 500) {
          setStatus(
            "Enter a reason between 10 and 500 characters.",
            true
          );
          return;
        }

        var warning = desiredEnabled
          ? "Enable the project-level staking flag for " +
            clean(project.project_code) +
            "? Global Testnet staking remains a separate control."
          : "Disable new project staking for " +
            clean(project.project_code) +
            "? Existing stakes and withdrawal rights will not be changed.";

        if (!window.confirm(warning)) return;

        await perform(project, "enablement", null, {
          enabled: desiredEnabled,
          reason: reason
        });
      });

      actions.appendChild(enablementButton);
        }

    if (actions.children.length) {
      card.appendChild(actions);
    }

    if (policy) {
      /* FIX 5: The review message uses the same normalized status test. */
            var globalActive =
        result && result.global_staking_policy_active === true;

      var message = status === "approved"
        ? policy.staking_enabled === true
          ? (globalActive
            ? "Project-level staking is enabled. Existing global, liquidity, treasury, reward-reserve and coverage checks still apply."
            : "Project-level staking is enabled, but global Testnet staking remains paused. Investors cannot create stakes until ALBUKHR separately activates the global policy.")
          : "Risk controls are approved. A Super Admin must separately enable this project's staking flag. Global Testnet staking activation is a different control."
        : isPendingReview(status)
          ? "These controls are pending Super Admin review. Review the displayed values before making a decision."
          : "This policy is not approved for project staking enablement.";

      card.appendChild(create("p", "risk-warning", message));
    }

    return card;
  }

    async function perform(project, action, decision, enablement) {
    busy = true;

    setStatus(
            action === "provision"
        ? "Provisioning pending controls for " + project.project_code + "…"
        : action === "enablement"
          ? (enablement && enablement.enabled
            ? "Enabling project-level staking for " + project.project_code + "…"
            : "Disabling project-level staking for " + project.project_code + "…")
          : "Submitting " + decision + " review for " + project.project_code + "…",
      false
    );

    try {
            if (action === "provision") {
        await api("/admin/policy/provision", {
          projectId: project.id,
          projectCode: project.project_code
        });

      } else if (action === "enablement") {
        await api("/admin/policy/enablement", {
          projectId: project.id,
          projectCode: project.project_code,
          enabled: enablement && enablement.enabled === true,
          reason: enablement && enablement.reason
        });

      } else {
        await api("/admin/policy/review", {
          projectId: project.id,
          projectCode: project.project_code,
          decision: decision
        });
            }

      setStatus(
        "The " + action + " request completed for " +
        project.project_code + ". Refreshing policy records…",
        false
      );

      busy = false;
      await loadAll(true);

    } catch (error) {
      setStatus(
        clean(error && error.message) ||
        "TESTNET_STAKING_RISK_ADMIN_REQUEST_FAILED",
        true
      );
    } finally {
      busy = false;
    }
  }

  async function loadAll(silent) {
    if (busy) return;

    busy = true;

    var panel = hostPanel();
    var content = panel.querySelector(".risk-content");
    content.replaceChildren();

    if (!silent) {
      setStatus(
        "Loading approved Testnet projects and risk-control records…",
        false
      );
    }

    try {
      environment();

      if (!AUTH || typeof AUTH.requireAdmin !== "function") {
        throw new Error("TESTNET_ADMIN_AUTH_UNAVAILABLE");
      }

      var session = await AUTH.requireAdmin({
        redirectOnFailure: false
      });

      if (!session) {
        throw new Error("TESTNET_ADMIN_SESSION_REQUIRED");
      }

      requireSuperAdmin(session);

      var response = await api("/admin/project-stages", {});
      projects = Array.isArray(response.projects) ? response.projects : [];
      policies = Object.create(null);

      for (var i = 0; i < projects.length; i += 1) {
        var project = projects[i];

        try {
          policies[clean(project.id)] = await api("/admin/policy", {
            projectId: project.id,
            projectCode: project.project_code
          });
        } catch (error) {
          policies[clean(project.id)] = {
            error: clean(error && error.message) || "POLICY_READ_FAILED"
          };
        }
      }

      if (!projects.length) {
        content.appendChild(
          create(
            "div",
            "risk-card",
            "No approved Testnet projects were returned."
          )
        );
      } else {
        projects.forEach(function (project) {
          content.appendChild(
            renderCard(project, policies[clean(project.id)])
          );
        });
      }

      /* FIX 6: Count both 'pending' and 'pending_review'. */
      var pending = projects.filter(function (project) {
        var p = policies[clean(project.id)];
        return p && p.policy &&
          isPendingReview(p.policy.approval_status);
      }).length;

      var missing = projects.filter(function (project) {
        var p = policies[clean(project.id)];
        return p && !p.error && !p.policy;
      }).length;

      setStatus(
        "Loaded " + projects.length +
        " approved Testnet projects. " +
        missing + " need risk-control provisioning; " +
        pending +
                " have controls pending review. Project-level enablement does not override global Testnet activation.",
        false
      );

    } catch (error) {
      setStatus(
        clean(error && error.message) ||
        "Could not load Testnet risk-control data.",
        true
      );
    } finally {
      busy = false;
    }
  }

  /* FIX 7: Do not initialize this privileged panel outside Testnet. */
  function init() {
    try {
      environment();
      loadAll(false);
    } catch (_) {
      // Do not render this privileged Testnet panel outside its known environment.
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

})(window, document);
