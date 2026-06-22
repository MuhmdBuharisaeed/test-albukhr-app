/* =========================================
   ALBUKHR PROJECT DASHBOARD BASE v1 FINAL
   SAFE MIGRATION VERSION
   ------------------------------------------------
   PURPOSE:
   Shared dashboard engine for NEW project dashboards:
   - alb-core-project-dashboard.html
   - alb-internal-project-dashboard.html
   - alb-external-project-dashboard.html

   IMPORTANT:
   - Does NOT modify old dashboards
   - Does NOT change routing
   - Does NOT overwrite legacy behavior
   - Uses project_code-first architecture
========================================= */

(function(){

  "use strict";

  /* =========================================
     CONFIG
  ========================================= */
  const DASHBOARD_BASE_VERSION = "1.0.0";
  const DEFAULT_HISTORY_LIMIT = 50;
  const DEFAULT_MIN_LIQUIDITY = 100;
  const DEFAULT_RESERVE_PERCENT = 0.30;

  /* =========================================
     SAFE HELPERS
  ========================================= */
  function dashboardSafeNumber(value, fallback = 0){
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function dashboardSafeString(value, fallback = ""){
    if(value === null || value === undefined){
      return fallback;
    }
    return String(value);
  }

  function formatPi(value){
    const n = dashboardSafeNumber(value, 0);
    return `${n.toFixed(2)} Pi`;
  }

  function escapeHtml(text = ""){
    return dashboardSafeString(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatProjectType(type){
    const t = dashboardSafeString(type).trim().toLowerCase();

    if(t === "core") return "Core";
    if(t === "internal") return "Internal";
    if(t === "external") return "External";

    return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Unknown";
  }

  function formatProjectStatus(status){
    const s = dashboardSafeString(status).trim().toLowerCase();

    if(s === "active") return "Active";
    if(s === "inactive") return "Inactive";
    if(s === "archived") return "Archived";
    if(s === "paused") return "Paused";

    return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Unknown";
  }

  function normalizePercent(value){
    const n = dashboardSafeNumber(value, 0);

    if(n <= 0) return 0;

    /*
      Supports:
      0.02 => 2
      2    => 2
    */
    if(n > 0 && n < 1){
      return n * 100;
    }

    return n;
  }

  function getProjectTypeBadgeClass(type){
    const t = dashboardSafeString(type).trim().toLowerCase();

    if(t === "core") return "core";
    if(t === "internal") return "internal";
    if(t === "external") return "external";

    return "core";
  }

  function getProjectStatusBadgeClass(status){
    const s = dashboardSafeString(status).trim().toLowerCase();

    if(s === "active") return "active";
    if(s === "inactive") return "inactive";
    if(s === "archived") return "archived";
    if(s === "paused") return "inactive";

    return "inactive";
  }

  function safeSetText(el, text){
    if(el){
      el.textContent = dashboardSafeString(text);
    }
  }

  function safeSetHtml(el, html){
    if(el){
      el.innerHTML = dashboardSafeString(html);
    }
  }

  function computeLiquidityStatus(status = {}){
    const liquidity =
      dashboardSafeNumber(status.liquidity, 0);

    const minLiquidity =
      dashboardSafeNumber(
        status.min_liquidity,
        DEFAULT_MIN_LIQUIDITY
      );

    const usable =
      dashboardSafeNumber(
        status.max_usable_liquidity,
        0
      );

    if(liquidity < minLiquidity){
      return {
        label: "LOW",
        className: "status-low"
      };
    }

    if(usable <= 0){
      return {
        label: "SAFE",
        className: "status-safe"
      };
    }

    return {
      label: "STRONG",
      className: "status-strong"
    };
  }

  /* =========================================
     DEPENDENCY ASSERTIONS
     NOTE:
     We keep this soft where possible to avoid
     breaking pages that only use part of the API.
  ========================================= */
  function assertDashboardBaseCoreDependencies(){

    if(typeof getProjectMeta !== "function"){
      throw new Error(
        "projects-engine.js must be loaded before project-dashboard-base.js"
      );
    }

    if(typeof getProjectTreasuryStatus !== "function"){
      throw new Error(
        "smart-liquidity-engine.js must be loaded before project-dashboard-base.js"
      );
    }

    if(typeof getProjectTreasuryHistory !== "function"){
      throw new Error(
        "project-treasury.js must be loaded before project-dashboard-base.js"
      );
    }

  }

  /* =========================================
     NORMALIZE PROJECT META
  ========================================= */
  function normalizeDashboardProjectMeta(project = {}){

    return {
      id: project.id ?? null,
      project_code: dashboardSafeString(project.project_code),
      project_name: dashboardSafeString(project.project_name || project.name),
      project_type: dashboardSafeString(project.project_type || "core").toLowerCase(),
      description: dashboardSafeString(project.description || "Albukhr Project"),
      icon: dashboardSafeString(project.icon || "📦"),
      status: dashboardSafeString(project.status || "active").toLowerCase(),
      reward_rate: dashboardSafeNumber(project.reward_rate, 0),
      reserve_percent: dashboardSafeNumber(
        project.reserve_percent,
        DEFAULT_RESERVE_PERCENT
      ),
      min_liquidity: dashboardSafeNumber(
        project.min_liquidity,
        DEFAULT_MIN_LIQUIDITY
      ),
      creator_userid: dashboardSafeString(project.creator_userid || project.creator || ""),
      creator_username: dashboardSafeString(project.creator_username || ""),
      raw: project
    };

  }

  /* =========================================
     LOAD PROJECT META
  ========================================= */
  async function loadDashboardProjectMeta(projectCode){

    assertDashboardBaseCoreDependencies();

    projectCode = dashboardSafeString(projectCode).trim();

    if(!projectCode){
      throw new Error("Project code is required");
    }

    const project = await getProjectMeta(projectCode);

    if(!project){
      throw new Error(`Project not found: ${projectCode}`);
    }

    return normalizeDashboardProjectMeta(project);

  }

  /* =========================================
     LOAD PROJECT TREASURY STATUS
  ========================================= */
  async function loadDashboardTreasuryStatus(projectCode, projectMeta = null){

    assertDashboardBaseCoreDependencies();

    const status = await getProjectTreasuryStatus(projectCode);

    if(status?.error){
      return {
        project_code: projectCode,
        project_name: projectMeta?.project_name || projectCode,
        project_type: projectMeta?.project_type || "core",
        project_status: projectMeta?.status || "active",
        liquidity: 0,
        reserve: 0,
        reserve_percent: dashboardSafeNumber(
          projectMeta?.reserve_percent,
          DEFAULT_RESERVE_PERCENT
        ),
        min_liquidity: dashboardSafeNumber(
          projectMeta?.min_liquidity,
          DEFAULT_MIN_LIQUIDITY
        ),
        usable_after_reserve: 0,
        usable_after_minimum: 0,
        max_usable_liquidity: 0,
        reward_rate: dashboardSafeNumber(projectMeta?.reward_rate, 0),
        treasury: null
      };
    }

    return {
      project_code: dashboardSafeString(status.project_code || projectCode),
      project_name: dashboardSafeString(
        status.project_name || projectMeta?.project_name || projectCode
      ),
      project_type: dashboardSafeString(
        status.project_type || projectMeta?.project_type || "core"
      ).toLowerCase(),
      project_status: dashboardSafeString(
        status.project_status || projectMeta?.status || "active"
      ).toLowerCase(),
      liquidity: dashboardSafeNumber(status.liquidity, 0),
      reserve: dashboardSafeNumber(status.reserve, 0),
      reserve_percent: dashboardSafeNumber(
        status.reserve_percent,
        dashboardSafeNumber(projectMeta?.reserve_percent, DEFAULT_RESERVE_PERCENT)
      ),
      min_liquidity: dashboardSafeNumber(
        status.min_liquidity,
        dashboardSafeNumber(projectMeta?.min_liquidity, DEFAULT_MIN_LIQUIDITY)
      ),
      usable_after_reserve: dashboardSafeNumber(status.usable_after_reserve, 0),
      usable_after_minimum: dashboardSafeNumber(status.usable_after_minimum, 0),
      max_usable_liquidity: dashboardSafeNumber(status.max_usable_liquidity, 0),
      reward_rate: dashboardSafeNumber(
        status.reward_rate,
        dashboardSafeNumber(projectMeta?.reward_rate, 0)
      ),
      treasury: status.treasury || null
    };

  }

  /* =========================================
     LOAD PROJECT ROI
     Graceful fallback if ROI engine is absent
  ========================================= */
  async function loadDashboardProjectROI(projectCode, projectMeta = null){

    let roi = 0;

    try{
      if(typeof calculateProjectROI === "function"){
        const result = await calculateProjectROI(projectCode);
        roi = dashboardSafeNumber(result, 0);
      }else{
        roi = dashboardSafeNumber(projectMeta?.raw?.roi, 0);
      }
    }catch(e){
      console.warn("loadDashboardProjectROI warning:", e);
      roi = dashboardSafeNumber(projectMeta?.raw?.roi, 0);
    }

    return roi;
  }

  /* =========================================
     LOAD PROJECT INVESTOR STATS
     Graceful fallback if staking engine absent
  ========================================= */
  async function loadDashboardProjectInvestors(projectCode){

    let allStakes = [];

    try{
      if(typeof getAllStakesMerged === "function"){
        const result = await getAllStakesMerged();
        if(Array.isArray(result)){
          allStakes = result;
        }
      }
    }catch(e){
      console.warn("loadDashboardProjectInvestors warning:", e);
      allStakes = [];
    }

    const code = dashboardSafeString(projectCode).trim().toLowerCase();

    const investors = allStakes.filter(stake => {
      const stakeCode = dashboardSafeString(
        stake?.project_code || stake?.project
      ).trim().toLowerCase();

      return stakeCode === code;
    }).length;

    return {
      count: investors,
      stakes: allStakes
    };

  }

  /* =========================================
     LOAD PROJECT HISTORY
  ========================================= */
  async function loadDashboardProjectHistory(
    projectCode,
    limit = DEFAULT_HISTORY_LIMIT
  ){

    assertDashboardBaseCoreDependencies();

    limit = dashboardSafeNumber(limit, DEFAULT_HISTORY_LIMIT);
    if(limit <= 0) limit = DEFAULT_HISTORY_LIMIT;

    try{
      const history = await getProjectTreasuryHistory(projectCode, limit);
      return Array.isArray(history) ? history : [];
    }catch(e){
      console.warn("loadDashboardProjectHistory warning:", e);
      return [];
    }

  }

  /* =========================================
     LOAD FULL DASHBOARD DATA
  ========================================= */
  async function loadProjectDashboardData(projectCode, options = {}){

    const historyLimit =
      dashboardSafeNumber(options.historyLimit, DEFAULT_HISTORY_LIMIT);

    const project =
      await loadDashboardProjectMeta(projectCode);

    const [
      treasuryStatus,
      roi,
      investorStats,
      history
    ] = await Promise.all([
      loadDashboardTreasuryStatus(project.project_code, project),
      loadDashboardProjectROI(project.project_code, project),
      loadDashboardProjectInvestors(project.project_code),
      loadDashboardProjectHistory(project.project_code, historyLimit)
    ]);

    return {
      project,
      treasuryStatus,
      roi,
      investors: investorStats.count,
      investorStats,
      history
    };

  }

  /* =========================================
     RENDER PROJECT HEADER
     targets expected:
     - projectName
     - projectMetaLine
     - projectBadges
  ========================================= */
  function renderProjectHeader(targets = {}, project = {}){

    if(targets.projectName){
      targets.projectName.textContent =
        project.project_name || project.project_code || "Unknown Project";
    }

    if(targets.projectMetaLine){
      targets.projectMetaLine.innerHTML = `
        Code: <strong>${escapeHtml(project.project_code || "-")}</strong> •
        Type: <strong>${escapeHtml(formatProjectType(project.project_type))}</strong>
      `;
    }

    if(targets.projectBadges){
      targets.projectBadges.innerHTML = `
        <span class="badge ${escapeHtml(getProjectTypeBadgeClass(project.project_type))}">
          ${escapeHtml(formatProjectType(project.project_type))}
        </span>

        <span class="badge ${escapeHtml(getProjectStatusBadgeClass(project.status))}">
          ${escapeHtml(formatProjectStatus(project.status))}
        </span>
      `;
    }

  }

  /* =========================================
     RENDER PROJECT STATS
     targets supported:
     - liquidity
     - reserve
     - roi
     - investors
     - liquidityStatus
     - usableLiquidity
     - rewardRate
     - reserveRule
     - minLiquidity
  ========================================= */
  function renderProjectStats(targets = {}, payload = {}){

    const treasuryStatus = payload.treasuryStatus || {};
    const liquidity = dashboardSafeNumber(treasuryStatus.liquidity, 0);
    const reserve = dashboardSafeNumber(treasuryStatus.reserve, 0);
    const usable = dashboardSafeNumber(
      treasuryStatus.max_usable_liquidity,
      0
    );

    const minLiquidity = dashboardSafeNumber(
      treasuryStatus.min_liquidity,
      DEFAULT_MIN_LIQUIDITY
    );

    const reservePercent =
      dashboardSafeNumber(
        treasuryStatus.reserve_percent,
        DEFAULT_RESERVE_PERCENT
      ) * 100;

    const rewardRate =
      normalizePercent(
        treasuryStatus.reward_rate ??
        payload.project?.reward_rate ??
        0
      );

    if(targets.liquidity){
      targets.liquidity.textContent = formatPi(liquidity);
    }

    if(targets.reserve){
      targets.reserve.textContent = formatPi(reserve);
    }

    if(targets.usableLiquidity){
      targets.usableLiquidity.textContent = formatPi(usable);
    }

    if(targets.roi){
      targets.roi.textContent =
        `${dashboardSafeNumber(payload.roi, 0).toFixed(2)}%`;
    }

    if(targets.investors){
      targets.investors.textContent =
        String(dashboardSafeNumber(payload.investors, 0));
    }

    if(targets.rewardRate){
      targets.rewardRate.textContent =
        `${dashboardSafeNumber(rewardRate, 0).toFixed(2)}%`;
    }

    if(targets.reserveRule){
      targets.reserveRule.textContent =
        `${dashboardSafeNumber(reservePercent, 0).toFixed(0)}%`;
    }

    if(targets.minLiquidity){
      targets.minLiquidity.textContent =
        formatPi(minLiquidity);
    }

    if(targets.liquidityStatus){
      const state = computeLiquidityStatus(treasuryStatus);
      targets.liquidityStatus.textContent = state.label;
      targets.liquidityStatus.className = `big ${state.className}`;
    }

  }

  /* =========================================
     RENDER PROJECT HISTORY
     target expected:
     - history
  ========================================= */
  function renderProjectHistory(targets = {}, history = []){

    const historyEl = targets.history;

    if(!historyEl){
      return;
    }

    if(!Array.isArray(history) || !history.length){
      historyEl.className = "empty";
      historyEl.innerHTML = "No treasury activity yet.";
      return;
    }

    const chunks = history.map(tx => {

      const txType =
        dashboardSafeString(tx.tx_type || "transaction")
          .replace(/_/g, " ");

      const amount =
        dashboardSafeNumber(tx.amount, 0);

      const note =
        dashboardSafeString(
          tx.note || tx.tx_type || "Treasury transaction"
        );

      const createdAt =
        tx.created_at
          ? new Date(tx.created_at).toLocaleString()
          : "—";

      return `
        <div class="tx">
          <div class="tx-left">
            <div><strong>${escapeHtml(txType)}</strong></div>
            <div class="muted">${escapeHtml(note)}</div>
            <div class="muted">${escapeHtml(createdAt)}</div>
          </div>

          <div class="tx-right">
            ${formatPi(amount)}
          </div>
        </div>
      `;
    });

    historyEl.className = "";
    historyEl.innerHTML = chunks.join("");

  }

  /* =========================================
     RENDER PROJECT STAKE PANEL
     target expected:
     - projectStakeBox
  ========================================= */
  async function renderProjectStakePanel(
    targets = {},
    projectCode,
    viewerId = ""
  ){

    const stakeTarget =
      targets.projectStakeBox ||
      targets.stakeBox ||
      null;

    if(!stakeTarget){
      return;
    }

    if(typeof renderProjectStakeUI !== "function"){
      return;
    }

    try{
      await renderProjectStakeUI(projectCode, viewerId);
    }catch(e){
      console.warn("renderProjectStakePanel warning:", e);
    }

  }

  /* =========================================
     DASHBOARD ACTIONS
     NOTE:
     Uses SAFE wrappers from smart-liquidity-engine.js
  ========================================= */
  async function handleAddLiquidity(projectCode, amount, actorMeta = {}){

    amount = dashboardSafeNumber(amount, 0);

    if(!projectCode){
      return { error:"Project code is required" };
    }

    if(amount <= 0){
      return { error:"Invalid liquidity amount" };
    }

    if(typeof safeAddProjectLiquidity !== "function"){
      return { error:"safeAddProjectLiquidity() is not available" };
    }

    return await safeAddProjectLiquidity(
      projectCode,
      amount,
      actorMeta || {}
    );

  }

  async function handleInternalWithdraw(projectCode, amount, actorMeta = {}){

    amount = dashboardSafeNumber(amount, 0);

    if(!projectCode){
      return { error:"Project code is required" };
    }

    if(amount <= 0){
      return { error:"Invalid withdraw amount" };
    }

    if(typeof safeProjectInternalWithdraw !== "function"){
      return { error:"safeProjectInternalWithdraw() is not available" };
    }

    return await safeProjectInternalWithdraw(
      projectCode,
      amount,
      actorMeta || {}
    );

  }

  async function handleRewardFunding(projectCode, amount, actorMeta = {}){

    amount = dashboardSafeNumber(amount, 0);

    if(!projectCode){
      return { error:"Project code is required" };
    }

    if(amount <= 0){
      return { error:"Invalid reward funding amount" };
    }

    if(typeof safeFundRewardFromLiquidity !== "function"){
      return { error:"safeFundRewardFromLiquidity() is not available" };
    }

    return await safeFundRewardFromLiquidity(
      projectCode,
      amount,
      actorMeta || {}
    );

  }

  /* =========================================
     REFRESH DASHBOARD PAYLOAD
     Useful after add / withdraw / reward funding
  ========================================= */
  async function refreshProjectDashboard({
    projectCode,
    targets = {},
    options = {},
    viewerId = ""
  } = {}){

    const data =
      await loadProjectDashboardData(projectCode, options);

    renderProjectHeader(targets, data.project);
    renderProjectStats(targets, data);
    renderProjectHistory(targets, data.history);

    if(options.renderStakePanel){
      await renderProjectStakePanel(
        targets,
        data.project.project_code,
        viewerId
      );
    }

    return data;

  }

  /* =========================================
     MAIN BOOTSTRAP
     ------------------------------------------------
     INPUT:
     bootstrapProjectDashboard({
       projectCode,
       dashboardType, // core | internal | external
       targets,
       options,
       viewerId
     })
  ========================================= */
  async function bootstrapProjectDashboard(config = {}){

    assertDashboardBaseCoreDependencies();

    const projectCode =
      dashboardSafeString(config.projectCode).trim();

    const dashboardType =
      dashboardSafeString(config.dashboardType || "internal")
        .trim()
        .toLowerCase();

    const targets = config.targets || {};
    const options = config.options || {};
    const viewerId =
      dashboardSafeString(config.viewerId || "");

    if(!projectCode){
      throw new Error("Project code is required for dashboard bootstrap");
    }

    /*
      Load data first
    */
    const data =
      await loadProjectDashboardData(projectCode, options);

    /*
      Safe type warning only:
      We DO NOT block page if type mismatches,
      because safe migration wants flexibility.
    */
    if(
      dashboardType &&
      data.project.project_type &&
      dashboardType !== data.project.project_type
    ){
      console.warn(
        `Dashboard type mismatch: requested=${dashboardType}, actual=${data.project.project_type}, project=${projectCode}`
      );
    }

    /*
      Render common sections
    */
    renderProjectHeader(targets, data.project);
    renderProjectStats(targets, data);
    renderProjectHistory(targets, data.history);

    if(options.renderStakePanel){
      await renderProjectStakePanel(
        targets,
        data.project.project_code,
        viewerId
      );
    }

    /*
      Return controller API to the page
    */
    return {
      version: DASHBOARD_BASE_VERSION,
      dashboardType,
      projectCode: data.project.project_code,
      data,

      async reload(){
        const fresh = await refreshProjectDashboard({
          projectCode: data.project.project_code,
          targets,
          options,
          viewerId
        });

        this.data = fresh;
        return fresh;
      },

      async addLiquidity(amount, actorMeta = {}){
        const result = await handleAddLiquidity(
          data.project.project_code,
          amount,
          actorMeta
        );

        if(!result?.error){
          const fresh = await this.reload();
          this.data = fresh;
        }

        return result;
      },

      async withdrawLiquidity(amount, actorMeta = {}){
        const result = await handleInternalWithdraw(
          data.project.project_code,
          amount,
          actorMeta
        );

        if(!result?.error){
          const fresh = await this.reload();
          this.data = fresh;
        }

        return result;
      },

      async fundReward(amount, actorMeta = {}){
        const result = await handleRewardFunding(
          data.project.project_code,
          amount,
          actorMeta
        );

        if(!result?.error){
          const fresh = await this.reload();
          this.data = fresh;
        }

        return result;
      }
    };

  }

  /* =========================================
     PUBLIC API EXPORT
     SAFE MIGRATION:
     We export new names only.
     We DO NOT overwrite old dashboard functions.
  ========================================= */
  window.dashboardSafeNumber = dashboardSafeNumber;
  window.dashboardSafeString = dashboardSafeString;

  window.formatPi = window.formatPi || formatPi;
  window.escapeHtml = window.escapeHtml || escapeHtml;
  window.formatProjectType = window.formatProjectType || formatProjectType;
  window.formatProjectStatus = window.formatProjectStatus || formatProjectStatus;
  window.normalizePercent = window.normalizePercent || normalizePercent;
  window.computeLiquidityStatus = window.computeLiquidityStatus || computeLiquidityStatus;

  window.loadDashboardProjectMeta = loadDashboardProjectMeta;
  window.loadDashboardTreasuryStatus = loadDashboardTreasuryStatus;
  window.loadDashboardProjectROI = loadDashboardProjectROI;
  window.loadDashboardProjectInvestors = loadDashboardProjectInvestors;
  window.loadDashboardProjectHistory = loadDashboardProjectHistory;
  window.loadProjectDashboardData = loadProjectDashboardData;

  window.renderProjectHeader = renderProjectHeader;
  window.renderProjectStats = renderProjectStats;
  window.renderProjectHistory = renderProjectHistory;
  window.renderProjectStakePanel = renderProjectStakePanel;

  window.handleAddLiquidity = handleAddLiquidity;
  window.handleInternalWithdraw = handleInternalWithdraw;
  window.handleRewardFunding = handleRewardFunding;

  window.refreshProjectDashboard = refreshProjectDashboard;
  window.bootstrapProjectDashboard = bootstrapProjectDashboard;

  window.ALBUKHR_PROJECT_DASHBOARD_BASE = {
    version: DASHBOARD_BASE_VERSION,
    DEFAULT_HISTORY_LIMIT,
    DEFAULT_MIN_LIQUIDITY,
    DEFAULT_RESERVE_PERCENT,

    dashboardSafeNumber,
    dashboardSafeString,
    formatPi,
    escapeHtml,
    formatProjectType,
    formatProjectStatus,
    normalizePercent,
    computeLiquidityStatus,

    loadDashboardProjectMeta,
    loadDashboardTreasuryStatus,
    loadDashboardProjectROI,
    loadDashboardProjectInvestors,
    loadDashboardProjectHistory,
    loadProjectDashboardData,

    renderProjectHeader,
    renderProjectStats,
    renderProjectHistory,
    renderProjectStakePanel,

    handleAddLiquidity,
    handleInternalWithdraw,
    handleRewardFunding,

    refreshProjectDashboard,
    bootstrapProjectDashboard
  };

})();
