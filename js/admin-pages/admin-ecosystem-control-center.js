/* =========================================================
   ALBUKHR ECOSYSTEM CONTROL CENTER
   Page Controller
   Version 3.0
   NETWORK-AWARE / SUPABASE-ARCHITECTURE SAFE

   LOCATION:
   js/admin-pages/admin-ecosystem-control-center.js

   RESPONSIBILITY:
   - Ecosystem-wide admin control-center page UI/controller
   - Read Core / Internal / External projects through the
     network-isolated Project Registry
   - Read treasury/liquidity through shared engines
   - Read treasury requests with current-network isolation
   - Route project actions to the universal project dashboard
   - Keep page-specific UI logic isolated from core engines

   ARCHITECTURE RULES:
   - No LocalStorage application state
   - No duplicate Supabase client
   - No direct REST API
   - Network comes from ALBUKHR Network Core
   - Ecosystem database access comes from ALBUKHR Supabase Core
   - Admin authentication/session comes from the isolated
     ALBUKHR Admin Auth system
   - Treasury mutations use the approved treasury RPC boundary
   - This page does not own projects, treasury, staking,
     authentication, or network engines
========================================================= */

(function (window) {
  "use strict";

  const ENGINE_NAME =
    "ALBUKHR Ecosystem Control Center";

  const VERSION = "3.0.0";

  const CONTROL_CENTER_REFRESH_MS = 20000;

  const TREASURY_REQUESTS_TABLE =
    "treasury_requests";

  let controlCenterBusy = false;

  /* =========================================================
     DOM
  ========================================================= */

  const ccEls = {
    totalProjects:
      document.getElementById("totalProjects"),

    totalLiquidity:
      document.getElementById("totalLiquidity"),

    totalInvestors:
      document.getElementById("totalInvestors"),

    totalReserve:
      document.getElementById("totalReserve"),

    totalUsableLiquidity:
      document.getElementById("totalUsableLiquidity"),

    projectTypeSummary:
      document.getElementById("projectTypeSummary"),

    activeProjectsCount:
      document.getElementById("activeProjectsCount"),

    lastRefreshAt:
      document.getElementById("lastRefreshAt"),

    projectList:
      document.getElementById("projectList"),

    economicPanel:
      document.getElementById("economicPanel"),

    treasuryRequests:
      document.getElementById("treasuryRequests")
  };

  /* =========================================================
     DEPENDENCY GUARDS
  ========================================================= */

  function requireNetwork() {
    if (
      typeof window.requireAlbukhrNetwork !==
      "function"
    ) {
      throw new Error(
        `${ENGINE_NAME}: ` +
        "ALBUKHR Network Core is not available."
      );
    }

    const network =
      window.requireAlbukhrNetwork();

    if (
      network !== "mainnet" &&
      network !== "testnet"
    ) {
      throw new Error(
        `${ENGINE_NAME}: Invalid ALBUKHR network.`
      );
    }

    return network;
  }

  function requireSupabase() {
    if (
      typeof window.requireAlbukhrSupabaseClient !==
      "function"
    ) {
      throw new Error(
        `${ENGINE_NAME}: ` +
        "ALBUKHR Supabase Core is not available."
      );
    }

    const client =
      window.requireAlbukhrSupabaseClient();

    if (
      !client ||
      typeof client.from !== "function"
    ) {
      throw new Error(
        `${ENGINE_NAME}: ` +
        "ALBUKHR Supabase Core returned an invalid client."
      );
    }

    return client;
  }

  async function requireAdmin() {
    if (
      typeof window.requireAdminSession ===
      "function"
    ) {
      const admin =
        await window.requireAdminSession();

      if (!admin) {
        return null;
      }

      return admin;
    }

    if (
      typeof window.getCurrentAdmin ===
      "function"
    ) {
      const admin =
        await window.getCurrentAdmin();

      if (!admin) {
        window.location.replace(
          "admin-login.html"
        );

        return null;
      }

      return admin;
    }

    throw new Error(
      `${ENGINE_NAME}: ` +
      "ALBUKHR Admin Session Engine is not available."
    );
  }

  /* =========================================================
     HELPERS
  ========================================================= */

  function safeString(
    value,
    fallback = ""
  ) {
    if (
      value === null ||
      value === undefined
    ) {
      return fallback;
    }

    return String(value);
  }

  function safeNumber(
    value,
    fallback = 0
  ) {
    const n = Number(value);

    return Number.isFinite(n)
      ? n
      : fallback;
  }

  function safeArray(value) {
    return Array.isArray(value)
      ? value
      : [];
  }

  function normalizeNetwork(value) {
    const network =
      safeString(value)
        .trim()
        .toLowerCase();

    if (
      network === "mainnet" ||
      network === "testnet"
    ) {
      return network;
    }

    return "";
  }

  function formatPi(value) {
    return (
      safeNumber(value, 0)
        .toFixed(2) +
      " Pi"
    );
  }

  function escapeHtml(text = "") {
    return safeString(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatProjectType(type) {
    const t =
      safeString(type)
        .trim()
        .toLowerCase();

    if (t === "core") {
      return "Core";
    }

    if (t === "internal") {
      return "Internal";
    }

    if (t === "external") {
      return "External";
    }

    return "Project";
  }

  function formatProjectStatus(status) {
    const s =
      safeString(status)
        .trim()
        .toLowerCase();

    if (s === "active") {
      return "Active";
    }

    if (s === "inactive") {
      return "Inactive";
    }

    if (s === "archived") {
      return "Archived";
    }

    return s || "Unknown";
  }

  function getTypeBadgeClass(type) {
    const t =
      safeString(type)
        .trim()
        .toLowerCase();

    if (t === "core") {
      return "core";
    }

    if (t === "internal") {
      return "internal";
    }

    if (t === "external") {
      return "external";
    }

    return "core";
  }

  function getStatusBadgeClass(status) {
    return (
      safeString(status)
        .trim()
        .toLowerCase() === "active"
    )
      ? "active"
      : "inactive";
  }

  function showAlert(
    title,
    message
  ) {
    if (
      typeof window.openAppAlert ===
      "function"
    ) {
      window.openAppAlert(
        title,
        message
      );

      return;
    }

    window.alert(
      `${title}\n\n${message}`
    );
  }

  function getProjectUrl(
    projectCode
  ) {
    const code =
      safeString(projectCode).trim();

    if (!code) {
      return "admin-universal-dashboard.html";
    }

    return (
      "admin-universal-dashboard.html?project=" +
      encodeURIComponent(code)
    );
  }

  function getUpdatesUrl(
    projectCode
  ) {
    const code =
      safeString(projectCode).trim();

    return (
      "core-project-updates.html?project=" +
      encodeURIComponent(code)
    );
  }

  /* =========================================================
     ADMIN GUARD
  ========================================================= */

  async function guardControlCenterAdmin() {
    try {
      const network =
        requireNetwork();

      const admin =
        await requireAdmin();

      if (!admin) {
        return false;
      }

      const role =
        safeString(
          admin.role_code
        )
          .trim()
          .toLowerCase();

      const allowedRoles = [
        "super_admin",
        "ecosystem_admin"
      ];

      if (
        !allowedRoles.includes(role)
      ) {
        showAlert(
          "Access denied",
          "Only Super Admin or Ecosystem Admin can access the Ecosystem Control Center."
        );

        window.location.replace(
          "admin-login.html"
        );

        return false;
      }

      console.log(
        `[${ENGINE_NAME}] Authorized`,
        {
          network,
          admin_id:
            admin.auth_user_id ||
            admin.id ||
            null,
          role
        }
      );

      return true;
    } catch (error) {
      console.error(
        `[${ENGINE_NAME}] Admin guard failed:`,
        error
      );

      showAlert(
        "Control Center unavailable",
        error?.message ||
        "Administrator session could not be verified."
      );

      return false;
    }
  }

  /* =========================================================
     PROJECT REGISTRY
  ========================================================= */

  async function loadProjectsFromRegistry() {
    if (
      typeof window.getAllProjects !==
      "function"
    ) {
      throw new Error(
        `${ENGINE_NAME}: ` +
        "Network-isolated Project Registry is not loaded."
      );
    }

    const network =
      requireNetwork();

    const projects =
      await window.getAllProjects({
        visibleOnly: false,
        activeOnly: false
      });

    const rows =
      safeArray(projects);

    /*
      Defensive second-layer validation.
      The Project Registry is already expected to be
      network-isolated. If a returned row exposes a network
      value, it must match the current network.
    */

    return rows.filter(
      project => {
        const rowNetwork =
          normalizeNetwork(
            project?.network
          );

        return (
          !rowNetwork ||
          rowNetwork === network
        );
      }
    );
  }

  /* =========================================================
     INVESTOR / STAKE AGGREGATION
     ========================================================= */

  async function getInvestorMap(
    projects = []
  ) {
    let stakes = [];

    try {
      if (
        typeof window.getGlobalStakes ===
        "function"
      ) {
        stakes =
          safeArray(
            await window.getGlobalStakes()
          );
      } else if (
        window.AlbukhrEcosystem &&
        typeof window.AlbukhrEcosystem.load ===
        "function"
      ) {
        await window.AlbukhrEcosystem.load(
          true
        );

        const cache =
          typeof window.AlbukhrEcosystem.getCache ===
          "function"
            ? window.AlbukhrEcosystem.getCache()
            : null;

        stakes =
          safeArray(
            cache?.globalStakes
          );

        if (!stakes.length) {
          stakes =
            safeArray(
              cache?.stakes
            );
        }
      } else if (
        typeof window.getAllStakesMerged ===
        "function"
      ) {
        stakes =
          safeArray(
            await window.getAllStakesMerged()
          );
      }
    } catch (error) {
      console.warn(
        `[${ENGINE_NAME}] Stake source failed:`,
        error
      );
    }

    const network =
      requireNetwork();

    /*
      Do not silently mix explicitly network-labelled
      stake records.
    */

    stakes =
      stakes.filter(
        stake => {
          const rowNetwork =
            normalizeNetwork(
              stake?.network
            );

          return (
            !rowNetwork ||
            rowNetwork === network
          );
        }
      );

    const map = {};

    projects.forEach(
      project => {
        map[
          safeString(
            project.project_code
          ).trim()
        ] = 0;
      }
    );

    stakes.forEach(
      stake => {
        const code =
          safeString(
            stake?.project_code ||
            stake?.project ||
            ""
          ).trim();

        if (
          code &&
          Object.prototype.hasOwnProperty.call(
            map,
            code
          )
        ) {
          map[code] =
            (map[code] || 0) + 1;
        }
      }
    );

    return {
      total:
        Object.values(map)
          .reduce(
            (sum, count) =>
              sum +
              safeNumber(
                count,
                0
              ),
            0
          ),

      byProject:
        map
    };
  }

  /* =========================================================
     LIQUIDITY SUMMARIES
  ========================================================= */

  async function loadProjectSummaries(
    projects = []
  ) {
    if (
      typeof window.getAllSmartLiquiditySummaries ===
      "function"
    ) {
      try {
        const rows =
          safeArray(
            await window.getAllSmartLiquiditySummaries()
          );

        const network =
          requireNetwork();

        const filtered =
          rows.filter(
            row => {
              const rowNetwork =
                normalizeNetwork(
                  row?.network
                );

              return (
                !rowNetwork ||
                rowNetwork === network
              );
            }
          );

        const map = {};

        filtered.forEach(
          row => {
            map[
              safeString(
                row.project_code
              ).trim()
            ] = row;
          }
        );

        return {
          rows:
            projects.map(
              project =>
                map[
                  safeString(
                    project.project_code
                  ).trim()
                ] ||
                buildSummaryFallback(
                  project
                )
            ),

          map
        };
      } catch (error) {
        console.warn(
          `[${ENGINE_NAME}] Bulk liquidity summary failed:`,
          error
        );
      }
    }

    const rows =
      await Promise.all(
        projects.map(
          async project => {
            try {
              if (
                typeof window.getSmartLiquiditySummary ===
                "function"
              ) {
                const summary =
                  await window.getSmartLiquiditySummary(
                    project.project_code
                  );

                if (
                  summary &&
                  !summary.error
                ) {
                  return summary;
                }
              }
            } catch (error) {
              console.warn(
                `[${ENGINE_NAME}] Liquidity summary failed for ${project.project_code}:`,
                error
              );
            }

            return buildSummaryFallback(
              project
            );
          }
        )
      );

    const map = {};

    rows.forEach(
      row => {
        map[
          safeString(
            row.project_code
          ).trim()
        ] = row;
      }
    );

    return {
      rows,
      map
    };
  }

  function buildSummaryFallback(
    project
  ) {
    return {
      project_code:
        project.project_code,

      project_name:
        project.project_name,

      project_type:
        project.project_type,

      project_status:
        project.status,

      liquidity: 0,
      reserve: 0,

      reserve_percent:
        safeNumber(
          project.reserve_percent,
          0.30
        ),

      min_liquidity:
        safeNumber(
          project.min_liquidity,
          100
        ),

      max_usable_liquidity: 0,

      reward_rate:
        safeNumber(
          project.reward_rate,
          0
        )
    };
  }

  /* =========================================================
     LOAD CONTROL CENTER DATA
  ========================================================= */

  async function loadControlCenterData() {
    const network =
      requireNetwork();

    const projects =
      await loadProjectsFromRegistry();

    const [
      summaryData,
      investorData
    ] =
      await Promise.all([
        loadProjectSummaries(
          projects
        ),
        getInvestorMap(
          projects
        )
      ]);

    return {
      network,
      projects,
      summaryRows:
        summaryData.rows,
      summaryMap:
        summaryData.map,
      investorData
    };
  }

  /* =========================================================
     SUMMARY
  ========================================================= */

  function renderControlSummary(
    {
      projects,
      summaryRows,
      investorData,
      network
    }
  ) {
    let totalLiquidity = 0;
    let totalReserve = 0;
    let totalUsable = 0;

    let coreCount = 0;
    let internalCount = 0;
    let externalCount = 0;
    let activeCount = 0;

    summaryRows.forEach(
      row => {
        totalLiquidity +=
          safeNumber(
            row.liquidity,
            0
          );

        totalReserve +=
          safeNumber(
            row.reserve,
            0
          );

        totalUsable +=
          safeNumber(
            row.max_usable_liquidity,
            0
          );
      }
    );

    projects.forEach(
      project => {
        const type =
          safeString(
            project.project_type
          )
            .trim()
            .toLowerCase();

        if (type === "core") {
          coreCount += 1;
        } else if (
          type === "internal"
        ) {
          internalCount += 1;
        } else if (
          type === "external"
        ) {
          externalCount += 1;
        }

        if (
          safeString(
            project.status
          )
            .trim()
            .toLowerCase() ===
          "active"
        ) {
          activeCount += 1;
        }
      }
    );

    if (ccEls.totalProjects) {
      ccEls.totalProjects.textContent =
        String(projects.length);
    }

    if (ccEls.totalLiquidity) {
      ccEls.totalLiquidity.textContent =
        formatPi(totalLiquidity);
    }

    if (ccEls.totalInvestors) {
      ccEls.totalInvestors.textContent =
        String(
          investorData.total || 0
        );
    }

    if (ccEls.totalReserve) {
      ccEls.totalReserve.textContent =
        formatPi(totalReserve);
    }

    if (
      ccEls.totalUsableLiquidity
    ) {
      ccEls.totalUsableLiquidity.textContent =
        `Usable: ${formatPi(totalUsable)}`;
    }

    if (
      ccEls.projectTypeSummary
    ) {
      ccEls.projectTypeSummary.textContent =
        `Core: ${coreCount} • Internal: ${internalCount} • External: ${externalCount}`;
    }

    if (
      ccEls.activeProjectsCount
    ) {
      ccEls.activeProjectsCount.textContent =
        `Active projects: ${activeCount}`;
    }

    if (ccEls.lastRefreshAt) {
      ccEls.lastRefreshAt.textContent =
        `Network: ${escapeHtml(network)} • Last refresh: ${new Date().toLocaleString()}`;
    }
  }

  /* =========================================================
     ROI
  ========================================================= */

  async function getProjectROI(
    project
  ) {
    try {
      if (
        typeof window.calculateProjectROI ===
        "function"
      ) {
        const result =
          await window.calculateProjectROI(
            project.project_code
          );

        const n =
          Number(result);

        if (
          Number.isFinite(n)
        ) {
          return n;
        }
      }
    } catch (error) {
      console.warn(
        `[${ENGINE_NAME}] ROI failed:`,
        error
      );
    }

    return safeNumber(
      project.roi,
      0
    );
  }

  /* =========================================================
     PROJECT CARDS
  ========================================================= */

  async function renderProjects(
    {
      projects,
      summaryMap,
      investorData
    }
  ) {
    if (!ccEls.projectList) {
      return;
    }

    if (!projects.length) {
      ccEls.projectList.className =
        "empty";

      ccEls.projectList.innerHTML =
        "No projects found.";

      return;
    }

    const cards = [];

    for (
      const project of projects
    ) {
      const code =
        safeString(
          project.project_code
        ).trim();

      const summary =
        summaryMap[code] ||
        buildSummaryFallback(
          project
        );

      const investors =
        investorData.byProject[
          code
        ] || 0;

      const roi =
        await getProjectROI(
          project
        );

      const dashboardUrl =
        getProjectUrl(code);

      const updatesUrl =
        getUpdatesUrl(code);

      cards.push(`
        <div class="project-card">

          <div class="project-title">
            ${escapeHtml(project.icon || "📦")}
            ${escapeHtml(
              project.project_name ||
              code
            )}
          </div>

          <div class="project-desc">
            ${escapeHtml(
              project.description ||
              "ALBUKHR Project"
            )}
          </div>

          <div class="badges">

            <span class="badge ${escapeHtml(
              getTypeBadgeClass(
                project.project_type
              )
            )}">
              ${escapeHtml(
                formatProjectType(
                  project.project_type
                )
              )}
            </span>

            <span class="badge ${escapeHtml(
              getStatusBadgeClass(
                project.status
              )
            )}">
              ${escapeHtml(
                formatProjectStatus(
                  project.status
                )
              )}
            </span>

          </div>

          <div class="kpi-row">

            <div class="kpi-box">
              <div class="kpi-title">
                Project Code
              </div>

              <div class="kpi-value">
                ${escapeHtml(
                  code || "-"
                )}
              </div>
            </div>

            <div class="kpi-box">
              <div class="kpi-title">
                Investors
              </div>

              <div class="kpi-value">
                ${safeNumber(
                  investors,
                  0
                )}
              </div>
            </div>

          </div>

          <div class="row">
            <div>Liquidity</div>
            <div>
              ${formatPi(
                summary.liquidity
              )}
            </div>
          </div>

          <div class="row">
            <div>Reserve</div>
            <div>
              ${formatPi(
                summary.reserve
              )}
            </div>
          </div>

          <div class="row">
            <div>Usable Liquidity</div>
            <div>
              ${formatPi(
                summary.max_usable_liquidity
              )}
            </div>
          </div>

          <div class="row">
            <div>Minimum Liquidity</div>
            <div>
              ${formatPi(
                summary.min_liquidity
              )}
            </div>
          </div>

          <div class="row">
            <div>Reward Rate</div>
            <div>
              ${safeNumber(
                summary.reward_rate,
                0
              )}%
            </div>
          </div>

          <div class="row">
            <div>ROI</div>
            <div>
              ${safeNumber(
                roi,
                0
              )}%
            </div>
          </div>

          <div class="actions">

            <button
              type="button"
              data-action="open-project"
              data-project-code="${escapeHtml(
                code
              )}"
            >
              Open Dashboard
            </button>

            <button
              type="button"
              class="secondary"
              data-action="open-project-treasury"
              data-project-code="${escapeHtml(
                code
              )}"
            >
              Treasury View
            </button>

            <button
              type="button"
              class="secondary"
              data-action="open-project-updates"
              data-project-code="${escapeHtml(
                code
              )}"
            >
              Project Updates
            </button>

            <button
              type="button"
              class="pause"
              data-action="pause-project"
              data-project-code="${escapeHtml(
                code
              )}"
            >
              Pause Project
            </button>

          </div>

          <div
            class="project-navigation-meta"
            hidden
            data-dashboard-url="${escapeHtml(
              dashboardUrl
            )}"
            data-updates-url="${escapeHtml(
              updatesUrl
            )}"
          ></div>

        </div>
      `);
    }

    ccEls.projectList.className = "";

    ccEls.projectList.innerHTML =
      cards.join("");
  }

  /* =========================================================
     ECONOMIC INTELLIGENCE
  ========================================================= */

  function buildLiquidityPriority(
    summaryRows = []
  ) {
    return [...summaryRows]
      .map(
        row => {
          const min =
            safeNumber(
              row.min_liquidity,
              0
            );

          const current =
            safeNumber(
              row.liquidity,
              0
            );

          return {
            project_code:
              row.project_code,

            project_name:
              row.project_name,

            project_type:
              row.project_type,

            liquidity_need:
              Math.max(
                0,
                min - current
              )
          };
        }
      )
      .filter(
        row =>
          row.liquidity_need >
          0
      )
      .sort(
        (a, b) =>
          b.liquidity_need -
          a.liquidity_need
      )
      .slice(0, 5);
  }

  function buildTopLiquidity(
    summaryRows = []
  ) {
    return [...summaryRows]
      .sort(
        (a, b) =>
          safeNumber(
            b.liquidity,
            0
          ) -
          safeNumber(
            a.liquidity,
            0
          )
      )
      .slice(0, 5);
  }

  function buildReservePressure(
    summaryRows = []
  ) {
    return [...summaryRows]
      .map(
        row => {
          const liquidity =
            safeNumber(
              row.liquidity,
              0
            );

          const reserve =
            safeNumber(
              row.reserve,
              0
            );

          return {
            ...row,

            reserve_ratio:
              liquidity > 0
                ? (reserve /
                    liquidity) *
                  100
                : 0
          };
        }
      )
      .sort(
        (a, b) =>
          safeNumber(
            b.reserve_ratio,
            0
          ) -
          safeNumber(
            a.reserve_ratio,
            0
          )
      )
      .slice(0, 5);
  }

  function renderEconomicPanel(
    {
      summaryRows
    }
  ) {
    if (!ccEls.economicPanel) {
      return;
    }

    const liquidityPriority =
      buildLiquidityPriority(
        summaryRows
      );

    const topLiquidity =
      buildTopLiquidity(
        summaryRows
      );

    const reservePressure =
      buildReservePressure(
        summaryRows
      );

    ccEls.economicPanel.className =
      "panel-grid";

    ccEls.economicPanel.innerHTML = `
      <div class="card">

        <b>
          Projects Needing Liquidity
        </b>

        <br><br>

        ${
          liquidityPriority.length
            ? liquidityPriority
                .map(
                  item => `
                    <div class="row">

                      <div>
                        ${escapeHtml(
                          item.project_name ||
                          item.project_code
                        )}
                      </div>

                      <div>
                        ${formatPi(
                          item.liquidity_need
                        )}
                      </div>

                    </div>
                  `
                )
                .join("")
            : `
              <div class="muted">
                No project currently below minimum liquidity rule.
              </div>
            `
        }

      </div>

      <div class="card">

        <b>
          Top Liquidity Projects
        </b>

        <br><br>

        ${
          topLiquidity.length
            ? topLiquidity
                .map(
                  item => `
                    <div class="row">

                      <div>
                        ${escapeHtml(
                          item.project_name ||
                          item.project_code
                        )}
                      </div>

                      <div>
                        ${formatPi(
                          item.liquidity
                        )}
                      </div>

                    </div>
                  `
                )
                .join("")
            : `
              <div class="muted">
                No liquidity data yet.
              </div>
            `
        }

      </div>

      <div class="card">

        <b>
          Highest Reserve Pressure
        </b>

        <br><br>

        ${
          reservePressure.length
            ? reservePressure
                .map(
                  item => `
                    <div class="row">

                      <div>
                        ${escapeHtml(
                          item.project_name ||
                          item.project_code
                        )}
                      </div>

                      <div>
                        ${safeNumber(
                          item.reserve_ratio,
                          0
                        ).toFixed(2)}%
                      </div>

                    </div>
                  `
                )
                .join("")
            : `
              <div class="muted">
                No reserve analytics yet.
              </div>
            `
        }

      </div>
    `;
  }

  /* =========================================================
     TREASURY REQUESTS
  ========================================================= */

  async function fetchTreasuryRequests() {
    const supabase =
      requireSupabase();

    const network =
      requireNetwork();

    try {
      let query =
        supabase
          .from(
            TREASURY_REQUESTS_TABLE
          )
          .select("*")
          .order(
            "created_at",
            {
              ascending: false
            }
          );

      /*
        Strict network isolation.
        The treasury_requests contract is expected to carry
        a network column. If the table does not have it yet,
        the query fails visibly instead of silently mixing data.
      */

      query =
        query.eq(
          "network",
          network
        );

      const {
        data,
        error
      } = await query;

      if (error) {
        return {
          success: false,
          error:
            error.message ||
            "Failed to load treasury requests.",
          data: []
        };
      }

      return {
        success: true,
        network,
        data:
          safeArray(data)
      };
    } catch (error) {
      return {
        success: false,
        error:
          error?.message ||
          "Treasury requests fetch failed.",
        data: []
      };
    }
  }

  async function renderTreasuryRequests() {
    if (!ccEls.treasuryRequests) {
      return;
    }

    const result =
      await fetchTreasuryRequests();

    if (!result.success) {
      ccEls.treasuryRequests.className =
        "empty";

      ccEls.treasuryRequests.innerHTML = `
        Treasury requests are unavailable.

        <div
          class="muted"
          style="margin-top:8px"
        >
          ${escapeHtml(
            result.error ||
            "No treasury request data."
          )}
        </div>
      `;

      return;
    }

    const requests =
      result.data || [];

    if (!requests.length) {
      ccEls.treasuryRequests.className =
        "empty";

      ccEls.treasuryRequests.innerHTML =
        "No treasury requests found.";

      return;
    }

    ccEls.treasuryRequests.className =
      "";

    ccEls.treasuryRequests.innerHTML =
      requests
        .map(
          request => {
            const amount =
              safeNumber(
                request.amount,
                0
              );

            const status =
              safeString(
                request.status,
                "pending"
              );

            const pending =
              status
                .trim()
                .toLowerCase() ===
              "pending";

            return `
              <div class="project-card">

                <div class="project-title">
                  ${escapeHtml(
                    request.project_name ||
                    request.project_code ||
                    "Treasury Request"
                  )}
                </div>

                <div class="row">
                  <div>
                    Project Code
                  </div>
                  <div>
                    ${escapeHtml(
                      request.project_code ||
                      "-"
                    )}
                  </div>
                </div>

                <div class="row">
                  <div>
                    Amount
                  </div>
                  <div>
                    ${formatPi(
                      amount
                    )}
                  </div>
                </div>

                <div class="row">
                  <div>
                    Reason
                  </div>
                  <div>
                    ${escapeHtml(
                      request.reason ||
                      "-"
                    )}
                  </div>
                </div>

                <div class="row">
                  <div>
                    Status
                  </div>
                  <div>
                    ${escapeHtml(
                      status
                    )}
                  </div>
                </div>

                <div class="row">
                  <div>
                    Created
                  </div>
                  <div>
                    ${escapeHtml(
                      request.created_at
                        ? new Date(
                            request.created_at
                          ).toLocaleString()
                        : "-"
                    )}
                  </div>
                </div>

                <div class="actions">

                  <button
                    type="button"
                    data-action="approve-treasury-request"
                    data-request-id="${escapeHtml(
                      request.id
                    )}"
                    ${pending ? "" : "disabled"}
                  >
                    Approve
                  </button>

                  <button
                    type="button"
                    class="pause"
                    data-action="reject-treasury-request"
                    data-request-id="${escapeHtml(
                      request.id
                    )}"
                    ${pending ? "" : "disabled"}
                  >
                    Reject
                  </button>

                </div>

              </div>
            `;
          }
        )
        .join("");
  }

  /* =========================================================
     TREASURY REQUEST APPROVAL
     ---------------------------------------------------------
     IMPORTANT:
     The browser never directly INSERTs/UPDATEs treasury
     balances. The approved PostgreSQL treasury RPC performs
     the atomic balance + transaction mutation.
  ========================================================= */

  async function approveTreasuryFunding(
    requestId
  ) {
    if (!requestId) {
      showAlert(
        "Request missing",
        "Treasury request ID is required."
      );

      return;
    }

    const supabase =
      requireSupabase();

    const network =
      requireNetwork();

    try {
      const {
        data: request,
        error: requestError
      } =
        await supabase
          .from(
            TREASURY_REQUESTS_TABLE
          )
          .select("*")
          .eq(
            "id",
            requestId
          )
          .eq(
            "network",
            network
          )
          .maybeSingle();

      if (
        requestError ||
        !request
      ) {
        throw new Error(
          requestError?.message ||
          "Treasury request not found for the current network."
        );
      }

      if (
        safeString(
          request.status
        )
          .trim()
          .toLowerCase() !==
        "pending"
      ) {
        throw new Error(
          "This treasury request has already been processed."
        );
      }

      const amount =
        safeNumber(
          request.amount,
          0
        );

      if (amount <= 0) {
        throw new Error(
          "Invalid treasury request amount."
        );
      }

      const projectCode =
        safeString(
          request.project_code ||
          request.project
        ).trim();

      if (!projectCode) {
        throw new Error(
          "Treasury request has no project code."
        );
      }

      const admin =
        await requireAdmin();

      if (!admin) {
        return;
      }

      /*
        Confirm current project still belongs to the current
        network before executing the treasury RPC.
      */

      if (
        typeof window.getProjectByCode !==
        "function"
      ) {
        throw new Error(
          "Network-isolated Project Registry is not available."
        );
      }

      const project =
        await window.getProjectByCode(
          projectCode
        );

      if (!project) {
        throw new Error(
          `Project not found for current network: ${projectCode}`
        );
      }

      const rpcPayload = {
        p_project_code:
          projectCode,

        p_amount:
          amount,

        p_reference_table:
          TREASURY_REQUESTS_TABLE,

        p_reference_id:
          safeString(
            request.id
          ),

        p_note:
          "Treasury request approved",

        p_meta: {
          source:
            "ecosystem_control_center",

          network,

          treasury_request_id:
            request.id,

          approved_by_admin_id:
            admin.auth_user_id ||
            admin.id ||
            null,

          approved_by_role:
            admin.role_code ||
            null
        }
      };

      const {
        data: fundingResult,
        error: fundingError
      } =
        await supabase.rpc(
          "albukhr_treasury_add_liquidity",
          rpcPayload
        );

      if (fundingError) {
        throw new Error(
          fundingError.message ||
          "Treasury funding RPC failed."
        );
      }

      if (
        fundingResult &&
        fundingResult.success === false
      ) {
        throw new Error(
          fundingResult.error ||
          "Treasury funding was rejected."
        );
      }

      /*
        Only mark the request approved after the treasury
        mutation has returned successfully.
      */

      const {
        error: updateError
      } =
        await supabase
          .from(
            TREASURY_REQUESTS_TABLE
          )
          .update({
            status:
              "approved",

            processed_at:
              new Date().toISOString()
          })
          .eq(
            "id",
            requestId
          )
          .eq(
            "network",
            network
          )
          .eq(
            "status",
            "pending"
          );

      if (updateError) {
        throw new Error(
          updateError.message ||
          "Treasury was funded, but request status could not be updated."
        );
      }

      showAlert(
        "Treasury request approved",
        `Project: ${project.project_name || projectCode}\n` +
        `Amount: ${formatPi(amount)}\n` +
        `Network: ${network}`
      );

      await renderAllControlCenter();

    } catch (error) {
      console.error(
        `[${ENGINE_NAME}] Approve treasury request failed:`,
        error
      );

      showAlert(
        "Approval failed",
        error?.message ||
        "Failed to approve treasury request."
      );
    }
  }

  /* =========================================================
     TREASURY REQUEST REJECTION
  ========================================================= */

  async function rejectTreasuryFunding(
    requestId
  ) {
    if (!requestId) {
      showAlert(
        "Request missing",
        "Treasury request ID is required."
      );

      return;
    }

    const supabase =
      requireSupabase();

    const network =
      requireNetwork();

    try {
      const {
        data: request,
        error: requestError
      } =
        await supabase
          .from(
            TREASURY_REQUESTS_TABLE
          )
          .select(
            "id,status,network"
          )
          .eq(
            "id",
            requestId
          )
          .eq(
            "network",
            network
          )
          .maybeSingle();

      if (
        requestError ||
        !request
      ) {
        throw new Error(
          requestError?.message ||
          "Treasury request not found for the current network."
        );
      }

      if (
        safeString(
          request.status
        )
          .trim()
          .toLowerCase() !==
        "pending"
      ) {
        throw new Error(
          "This treasury request has already been processed."
        );
      }

      const {
        error
      } =
        await supabase
          .from(
            TREASURY_REQUESTS_TABLE
          )
          .update({
            status:
              "rejected",

            processed_at:
              new Date().toISOString()
          })
          .eq(
            "id",
            requestId
          )
          .eq(
            "network",
            network
          )
          .eq(
            "status",
            "pending"
          );

      if (error) {
        throw new Error(
          error.message ||
          "Failed to reject treasury request."
        );
      }

      showAlert(
        "Treasury request rejected",
        `Network: ${network}`
      );

      await renderAllControlCenter();

    } catch (error) {
      console.error(
        `[${ENGINE_NAME}] Reject treasury request failed:`,
        error
      );

      showAlert(
        "Rejection failed",
        error?.message ||
        "Failed to reject treasury request."
      );
    }
  }

  /* =========================================================
     NAVIGATION
  ========================================================= */

  function openProject(
    projectCode
  ) {
    const code =
      safeString(
        projectCode
      ).trim();

    if (!code) {
      showAlert(
        "Project missing",
        "Project code is required."
      );

      return;
    }

    window.location.href =
      getProjectUrl(code);
  }

  function openProjectTreasury(
    projectCode
  ) {
    openProject(
      projectCode
    );
  }

  function openProjectUpdates(
    projectCode
  ) {
    const code =
      safeString(
        projectCode
      ).trim();

    if (!code) {
      showAlert(
        "Project missing",
        "Project code is required."
      );

      return;
    }

    window.location.href =
      getUpdatesUrl(code);
  }

  /* =========================================================
     PAUSE PROJECT
     ---------------------------------------------------------
     Project writes remain network-scoped.
     No LocalStorage is used.
  ========================================================= */

  async function pauseProject(
    projectCode
  ) {
    const code =
      safeString(
        projectCode
      ).trim();

    if (!code) {
      showAlert(
        "Project missing",
        "Project code is required."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Are you sure you want to pause project: ${code}?`
      );

    if (!confirmed) {
      return;
    }

    const network =
      requireNetwork();

    const supabase =
      requireSupabase();

    try {
      const admin =
        await requireAdmin();

      if (!admin) {
        return;
      }

      if (
        typeof window.getProjectByCode !==
        "function"
      ) {
        throw new Error(
          "Network-isolated Project Registry is not available."
        );
      }

      const project =
        await window.getProjectByCode(
          code
        );

      if (!project) {
        throw new Error(
          `Project not found for current network: ${code}`
        );
      }

      /*
        Direct project writes are still performed only against
        the current network. RLS remains the final authorization
        boundary.
      */

      const {
        error
      } =
        await supabase
          .from("projects")
          .update({
            status:
              "inactive"
          })
          .eq(
            "id",
            project.id
          )
          .eq(
            "project_code",
            code
          )
          .eq(
            "network",
            network
          );

      if (error) {
        throw new Error(
          error.message ||
          "Failed to pause project."
        );
      }

      /*
        Optional audit integration.
      */

      if (
        typeof window.logAdminAction ===
        "function"
      ) {
        try {
          await window.logAdminAction({
            action:
              "pause_project",

            target:
              code,

            details: {
              project_code:
                code,

              network,

              actor:
                admin.auth_user_id ||
                admin.id ||
                null
            }
          });
        } catch (auditError) {
          console.warn(
            `[${ENGINE_NAME}] Pause audit failed:`,
            auditError
          );
        }
      }

      showAlert(
        "Project paused",
        `${code} is now inactive on ${network}.`
      );

      if (
        typeof window.refreshProjectsCache ===
        "function"
      ) {
        await window.refreshProjectsCache();
      }

      await renderAllControlCenter();

    } catch (error) {
      console.error(
        `[${ENGINE_NAME}] Pause project failed:`,
        error
      );

      showAlert(
        "Pause failed",
        error?.message ||
        "Failed to pause project."
      );
    }
  }

  /* =========================================================
     EVENT DELEGATION
     ---------------------------------------------------------
     Replaces inline onclick handlers so the page controller
     remains the owner of its UI actions.
  ========================================================= */

  function bindControlCenterActions() {
    if (
      !ccEls.projectList
    ) {
      return;
    }

    ccEls.projectList.addEventListener(
      "click",
      async event => {
        const button =
          event.target.closest(
            "button[data-action]"
          );

        if (!button) {
          return;
        }

        const action =
          safeString(
            button.dataset.action
          ).trim();

        const projectCode =
          safeString(
            button.dataset.projectCode
          ).trim();

        if (
          action ===
          "open-project"
        ) {
          openProject(
            projectCode
          );

          return;
        }

        if (
          action ===
          "open-project-treasury"
        ) {
          openProjectTreasury(
            projectCode
          );

          return;
        }

        if (
          action ===
          "open-project-updates"
        ) {
          openProjectUpdates(
            projectCode
          );

          return;
        }

        if (
          action ===
          "pause-project"
        ) {
          await pauseProject(
            projectCode
          );
        }
      }
    );

    if (
      ccEls.treasuryRequests
    ) {
      ccEls.treasuryRequests.addEventListener(
        "click",
        async event => {
          const button =
            event.target.closest(
              "button[data-action]"
            );

          if (!button) {
            return;
          }

          const action =
            safeString(
              button.dataset.action
            ).trim();

          const requestId =
            safeString(
              button.dataset.requestId
            ).trim();

          if (
            action ===
            "approve-treasury-request"
          ) {
            await approveTreasuryFunding(
              requestId
            );

            return;
          }

          if (
            action ===
            "reject-treasury-request"
          ) {
            await rejectTreasuryFunding(
              requestId
            );
          }
        }
      );
    }
  }

  /* =========================================================
     RENDER ALL
  ========================================================= */

  async function renderAllControlCenter() {
    if (
      controlCenterBusy
    ) {
      return;
    }

    controlCenterBusy = true;

    try {
      const network =
        requireNetwork();

      if (
        ccEls.projectList
      ) {
        ccEls.projectList.className =
          "loading";

        ccEls.projectList.innerHTML =
          "Loading projects...";
      }

      if (
        ccEls.economicPanel
      ) {
        ccEls.economicPanel.className =
          "loading";

        ccEls.economicPanel.innerHTML =
          "Loading economic intelligence...";
      }

      if (
        ccEls.treasuryRequests
      ) {
        ccEls.treasuryRequests.className =
          "loading";

        ccEls.treasuryRequests.innerHTML =
          "Loading treasury requests...";
      }

      const data =
        await loadControlCenterData();

      if (
        data.network !==
        network
      ) {
        throw new Error(
          "Network changed during Control Center load. Refresh required."
        );
      }

      renderControlSummary(
        data
      );

      await renderProjects(
        data
      );

      renderEconomicPanel(
        data
      );

      await renderTreasuryRequests();

    } catch (error) {
      console.error(
        `[${ENGINE_NAME}] Render failed:`,
        error
      );

      if (
        ccEls.projectList
      ) {
        ccEls.projectList.className =
          "error-box";

        ccEls.projectList.innerHTML = `
          Failed to load ecosystem control center.

          <div
            class="muted"
            style="margin-top:8px"
          >
            ${escapeHtml(
              error?.message ||
              "Unknown error"
            )}
          </div>
        `;
      }

      if (
        ccEls.economicPanel
      ) {
        ccEls.economicPanel.className =
          "empty";

        ccEls.economicPanel.innerHTML =
          "Economic intelligence unavailable.";
      }

      if (
        ccEls.treasuryRequests
      ) {
        ccEls.treasuryRequests.className =
          "empty";

        ccEls.treasuryRequests.innerHTML =
          "Treasury requests unavailable.";
      }

    } finally {
      controlCenterBusy =
        false;
    }
  }

  /* =========================================================
     PUBLIC API
     ---------------------------------------------------------
     Compatibility exports are page actions only.
     The engine itself remains page-scoped.
  ========================================================= */

  window.AlbukhrAdminControlCenter = {
    VERSION,
    ENGINE_NAME,

    render:
      renderAllControlCenter,

    openProject,
    openProjectTreasury,
    openProjectUpdates,

    pauseProject,

    approveTreasuryFunding,
    rejectTreasuryFunding,

    getNetwork:
      requireNetwork
  };

  /*
    Preserve compatibility with existing HTML that may still
    call these names directly.
  */

  window.openProject =
    openProject;

  window.openProjectTreasury =
    openProjectTreasury;

  window.openProjectUpdates =
    openProjectUpdates;

  window.pauseProject =
    pauseProject;

  window.approveTreasuryFunding =
    approveTreasuryFunding;

  window.rejectTreasuryFunding =
    rejectTreasuryFunding;

  window.renderAllControlCenter =
    renderAllControlCenter;

  /* =========================================================
     START
  ========================================================= */

  document.addEventListener(
    "DOMContentLoaded",
    async function () {
      const allowed =
        await guardControlCenterAdmin();

      if (!allowed) {
        return;
      }

      bindControlCenterActions();

      await renderAllControlCenter();

      window.setInterval(
        async function () {
          try {
            await renderAllControlCenter();
          } catch (error) {
            console.error(
              `[${ENGINE_NAME}] Refresh failed:`,
              error
            );
          }
        },
        CONTROL_CENTER_REFRESH_MS
      );
    }
  );

})(window);
