/* ALBUKHR Testnet Super Admin — Global Staking Stage Manager v2 */
(function (window, document) {
  "use strict";

  var API_BASE = "https://test-albukhr-api.onrender.com/staking";
  var HOST = "test.albukhr.com";
  var NETWORK = "testnet";
  var AUTH = window.AlbukhrTestnetAdminAuth;
  var ROOT_ID = "albukhrTestnetStakingStageManager";

  var STAGES = [
    { value: "setup_pre_operation", label: "Setup / Pre-operation" },
    { value: "construction_fit_out", label: "Construction / Fit-out" },
    { value: "operating_expansion", label: "Operating / Expansion" }
  ];

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function create(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  }

  /* FIX 1:
   * Validate the complete Testnet environment.
   * Prevents the Stage Manager from running on Mainnet,
   * unknown environments, or an unexpected hostname.
   */
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

    var hostname = clean(
      typeof env.getHostname === "function"
        ? env.getHostname()
        : window.location.hostname
    ).toLowerCase();

    if (hostname !== HOST) {
      throw new Error("TESTNET_ADMIN_AUTH_HOST_REQUIRED");
    }

    return env;
  }

  /* FIX 2:
   * Do not display null or missing liquidity as 0 Pi.
   * A real zero remains a valid numeric value.
   */
  function money(value) {
    if (value == null || value === "") {
      return "Not configured";
    }

    var n = Number(value);

    if (!Number.isFinite(n)) {
      return "Not configured";
    }

    return n.toLocaleString(undefined, {
      maximumFractionDigits: 4
    }) + " Pi";
  }

  function getApiMessage(body) {
    return clean(body && (body.message || body.error)) ||
      "Request failed. Please try again.";
  }

  /* FIX 3:
   * Revalidate Testnet before EVERY API request.
   * This prevents a stale page or environment switch
   * from sending Stage Manager requests to the wrong network.
   */
  async function api(path, payload) {
    environment();

    var allowedPaths = [
      "/admin/project-stages",
      "/admin/project-stages/set"
    ];

    if (allowedPaths.indexOf(path) === -1) {
      throw new Error("TESTNET_STAGE_API_PATH_NOT_ALLOWED");
    }

    if (!AUTH || typeof AUTH.getSessionToken !== "function") {
      throw new Error("TESTNET_ADMIN_AUTH_UNAVAILABLE");
    }

    var token = clean(AUTH.getSessionToken());

    if (!token) {
      throw new Error("TESTNET_ADMIN_SESSION_REQUIRED");
    }

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
      throw new Error(getApiMessage(body));
    }

    return body;
  }

  /* FIX 4:
   * Validate stage values against the approved stage list.
   */
  function isValidStage(value) {
    return STAGES.some(function (stage) {
      return stage.value === value;
    });
  }

  function addStyles() {
    if (document.getElementById(ROOT_ID + "Styles")) return;

    var style = create("style");
    style.id = ROOT_ID + "Styles";

    style.textContent = `
      #${ROOT_ID}{
        margin:24px 0;
        padding:22px;
        border:1px solid #d7e0da;
        border-radius:16px;
        background:var(--panel-bg,#fff);
        color:var(--text-color,#1f2d25)
      }

      #${ROOT_ID} .stage-manager-heading{
        display:flex;
        gap:12px;
        align-items:flex-start;
        justify-content:space-between;
        flex-wrap:wrap
      }

      #${ROOT_ID} h2{
        margin:4px 0 8px;
        font-size:1.25rem
      }

      #${ROOT_ID} .stage-manager-note{
        margin:0 0 16px;
        line-height:1.5;
        color:var(--muted-color,#617067)
      }

      #${ROOT_ID} .stage-manager-status{
        margin:12px 0;
        padding:10px 12px;
        border-radius:8px;
        background:#f3f6f3;
        color:#30473a;
        white-space:pre-wrap
      }

      #${ROOT_ID} .stage-manager-status.error{
        background:#fff0ef;
        color:#8b2222
      }

      #${ROOT_ID} .stage-manager-table-wrap{
        width:100%;
        overflow-x:auto
      }

      #${ROOT_ID} table{
        border-collapse:collapse;
        width:100%;
        min-width:740px
      }

      #${ROOT_ID} th,
      #${ROOT_ID} td{
        padding:11px 9px;
        border-bottom:1px solid #e3e9e4;
        text-align:left;
        vertical-align:middle
      }

      #${ROOT_ID} th{
        font-size:.83rem;
        color:var(--muted-color,#617067)
      }

      #${ROOT_ID} .stage-project-name{
        display:block;
        font-weight:700
      }

      #${ROOT_ID} .stage-project-code{
        display:block;
        font-size:.82rem;
        color:var(--muted-color,#617067);
        margin-top:3px
      }

      #${ROOT_ID} select{
        min-width:200px;
        padding:9px;
        border:1px solid #aebdb3;
        border-radius:8px;
        background:transparent;
        color:inherit
      }

      #${ROOT_ID} button{
        padding:9px 13px;
        border:0;
        border-radius:8px;
        background:#176b45;
        color:#fff;
        font-weight:700;
        cursor:pointer
      }

      #${ROOT_ID} button:disabled{
        opacity:.55;
        cursor:not-allowed
      }

      #${ROOT_ID} .stage-manager-refresh{
        background:#e8f0eb;
        color:#174d32
      }

      #${ROOT_ID} .stage-manager-empty{
        padding:16px;
        border:1px dashed #c7d5cc;
        border-radius:10px
      }

      @media(max-width:640px){
        #${ROOT_ID}{padding:15px}
        #${ROOT_ID} .stage-manager-heading{display:block}
        #${ROOT_ID} .stage-manager-refresh{margin-bottom:12px}
      }
    `;

    document.head.appendChild(style);
  }

  function getHost() {
    var existing = document.getElementById(ROOT_ID);
    if (existing) return existing;

    addStyles();

    var main = document.querySelector("main") || document.body;
    var panel = create("section");

    panel.id = ROOT_ID;
    panel.setAttribute("aria-labelledby", ROOT_ID + "Title");

    var heading = create("div", "stage-manager-heading");
    var titleBox = create("div");

    titleBox.appendChild(
      create("div", "section-kicker", "GLOBAL TREASURY · TESTNET ONLY")
    );

    var title = create(
      "h2",
      "",
      "Project Staking Stage Management"
    );

    title.id = ROOT_ID + "Title";
    titleBox.appendChild(title);

    titleBox.appendChild(
      create(
        "p",
        "stage-manager-note",
        "Assign the business lifecycle stage approved by ALBUKHR. Stage changes are blocked while a stake payment intent is pending or when the new stage cap is below existing principal."
      )
    );

    var refresh = create(
      "button",
      "stage-manager-refresh",
      "Refresh projects"
    );

    refresh.type = "button";
    refresh.addEventListener("click", loadProjects);

    heading.appendChild(titleBox);
    heading.appendChild(refresh);

    panel.appendChild(heading);

    panel.appendChild(
      create(
        "div",
        "stage-manager-status",
        "Checking Testnet admin access…"
      )
    );

    panel.appendChild(create("div", "stage-manager-content"));

    var rulesPanel = document.querySelector("main .rules-panel");

    if (rulesPanel && rulesPanel.parentNode === main) {
      main.insertBefore(panel, rulesPanel);
    } else {
      main.appendChild(panel);
    }

    return panel;
  }

  function setStatus(message, error) {
    var panel = document.getElementById(ROOT_ID);
    if (!panel) return;

    var box = panel.querySelector(".stage-manager-status");
    if (!box) return;

    box.textContent = clean(message);
    box.classList.toggle("error", Boolean(error));
  }

  function stageLabel(value) {
    var found = STAGES.find(function (stage) {
      return stage.value === value;
    });

    return found ? found.label : "Not assigned";
  }

  function renderProjects(projects) {
    var panel = document.getElementById(ROOT_ID);
    var content = panel && panel.querySelector(".stage-manager-content");

    if (!content) return;

    content.replaceChildren();

    if (!Array.isArray(projects) || projects.length === 0) {
      content.appendChild(
        create(
          "div",
          "stage-manager-empty",
          "No approved Testnet projects were returned."
        )
      );
      return;
    }

    var wrap = create("div", "stage-manager-table-wrap");
    var table = create("table");
    var thead = create("thead");
    var header = create("tr");

    [
      "Project",
      "Verified / Required liquidity",
      "Treasury",
      "Current stage",
      "Assign stage",
      "Action"
    ].forEach(function (label) {
      header.appendChild(create("th", "", label));
    });

    thead.appendChild(header);
    table.appendChild(thead);

    var tbody = create("tbody");

    projects.forEach(function (project) {
      var tr = create("tr");

      var projectCell = create("td");

      projectCell.appendChild(
        create(
          "span",
          "stage-project-name",
          project.name || project.project_code || "Project"
        )
      );

      projectCell.appendChild(
        create(
          "span",
          "stage-project-code",
          project.project_code || "—"
        )
      );

      tr.appendChild(projectCell);

      /* FIX 5:
       * Use safe liquidity formatting for both values.
       * Missing verified liquidity is no longer presented as zero.
       */
      var liquidityDisplay =
        money(project.verified_liquidity) +
        " / " +
        money(project.required_liquidity);

      tr.appendChild(create("td", "", liquidityDisplay));

      tr.appendChild(
        create(
          "td",
          "",
          project.treasury_status || "Not configured"
        )
      );

      tr.appendChild(
        create(
          "td",
          "",
          stageLabel(project.staking_stage)
        )
      );

      var stageCell = create("td");
      var select = create("select");

      select.setAttribute(
        "aria-label",
        "Assign staking stage for " + clean(project.project_code)
      );

      var placeholder = create("option", "", "Select a stage…");
      placeholder.value = "";

      select.appendChild(placeholder);

      STAGES.forEach(function (stage) {
        var option = create("option", "", stage.label);
        option.value = stage.value;
        select.appendChild(option);
      });

      select.value = isValidStage(project.staking_stage)
        ? project.staking_stage
        : "";

      stageCell.appendChild(select);
      tr.appendChild(stageCell);

      var actionCell = create("td");
      var save = create("button", "", "Save stage");

      save.type = "button";

      function updateSaveState() {
        save.disabled =
          !project.id ||
          !project.project_code ||
          !isValidStage(select.value) ||
          select.value === project.staking_stage;
      }

      updateSaveState();

      select.addEventListener("change", updateSaveState);

      /* FIX 6:
       * Validate the selected stage before sending the request.
       * Do not allow arbitrary stage values from the browser.
       */
      save.addEventListener("click", async function () {
        if (!project.id || !project.project_code) {
          setStatus("Project identity is incomplete. Cannot update stage.", true);
          return;
        }

        if (!isValidStage(select.value)) {
          setStatus("Select a valid approved business stage before saving.", true);
          return;
        }

        if (select.value === project.staking_stage) {
          setStatus("The selected stage is already assigned.", false);
          updateSaveState();
          return;
        }

        save.disabled = true;

        setStatus(
          "Saving stage for " + clean(project.project_code) + "…",
          false
        );

        try {
          var body = await api("/admin/project-stages/set", {
            projectId: project.id,
            projectCode: project.project_code,
            stakingStage: select.value
          });

          setStatus(
            body.changed
              ? "Stage saved for " + clean(project.project_code) + "."
              : "No change was needed for " + clean(project.project_code) + ".",
            false
          );

          await loadProjects();

        } catch (error) {
          setStatus(
            clean(error && error.message) || "Stage update failed.",
            true
          );

          updateSaveState();
        }
      });

      actionCell.appendChild(save);
      tr.appendChild(actionCell);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    wrap.appendChild(table);
    content.appendChild(wrap);
  }

  async function loadProjects() {
    var panel = getHost();
    var content = panel.querySelector(".stage-manager-content");

    if (content) content.replaceChildren();

    setStatus("Loading approved Testnet projects…", false);

    try {
      /* FIX 7:
       * Validate the environment before loading admin data.
       */
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

      /* FIX 8:
       * Require an explicit Testnet Super Admin role.
       * Backend authorization must independently enforce this too.
       */
      var roles =
        session.admin && Array.isArray(session.admin.roles)
          ? session.admin.roles
          : [];

      if (
        !roles.some(function (role) {
          return clean(role).toLowerCase() === "super_admin";
        })
      ) {
        setStatus(
          "This tool is restricted to Testnet Super Admins.",
          true
        );
        return;
      }

      var body = await api("/admin/project-stages", {});
      var projects = Array.isArray(body.projects)
        ? body.projects
        : [];

      renderProjects(projects);

      var unassigned = projects.filter(function (project) {
        return !isValidStage(project.staking_stage);
      }).length;

      setStatus(
        "Loaded " + projects.length +
        " approved Testnet projects. " +
        unassigned +
        " still need an authorized stage assignment. Staking remains inactive.",
        false
      );

    } catch (error) {
      setStatus(
        clean(error && error.message) ||
        "Could not load stage-management data.",
        true
      );
    }
  }

  /* FIX 9:
   * Do not initialize on Mainnet, an unknown network,
   * or any host other than the official Testnet app.
   */
  function init() {
    try {
      environment();
      loadProjects();
    } catch (_) {
      // Privileged Testnet panel stays unavailable outside Testnet.
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, {
      once: true
    });
  } else {
    init();
  }

})(window, document);
