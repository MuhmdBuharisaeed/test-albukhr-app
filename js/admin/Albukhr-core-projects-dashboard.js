/* =========================================
   ALBUKHR CORE PROJECTS DASHBOARD FINAL
   Supabase-first + project_code based
========================================= */

const coreDashboardEls = {
  totalCoreProjects: document.getElementById("totalCoreProjects"),
  activeCoreProjects: document.getElementById("activeCoreProjects"),
  totalCoreLiquidity: document.getElementById("totalCoreLiquidity"),
  totalCoreUsable: document.getElementById("totalCoreUsable"),
  totalCoreReserve: document.getElementById("totalCoreReserve"),
  totalCoreRewardRate: document.getElementById("totalCoreRewardRate"),
  totalCoreInvestors: document.getElementById("totalCoreInvestors"),
  lastRefreshAt: document.getElementById("lastRefreshAt"),
  projectsGrid: document.getElementById("projectsGrid")
};

let __coreDashboardBusy = false;

/* =========================================
   HELPERS
========================================= */
function formatPi(value){
  const n = Number(value || 0);
  return `${n.toFixed(2)} Pi`;
}

function safeNumber(value, fallback = 0){
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function escapeHtml(text = ""){
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatProjectStatus(status){
  const s = String(status || "").toLowerCase();

  if(s === "active") return "Active";
  if(s === "inactive") return "Inactive";
  if(s === "archived") return "Archived";

  return s || "Unknown";
}

function getStatusBadgeClass(status){
  const s = String(status || "").toLowerCase();

  if(s === "active") return "active";
  if(s === "inactive") return "inactive";
  if(s === "archived") return "archived";

  return "inactive";
}

/*
  Reward rate formatter:
  - idan DB ya adana 0.02 => 2%
  - idan DB ya adana 2 => 2%
*/
function normalizeRewardPercent(value){
  const n = safeNumber(value, 0);

  if(n <= 0) return 0;

  if(n > 0 && n < 1){
    return n * 100;
  }

  return n;
}

function average(values = []){
  if(!Array.isArray(values) || !values.length){
    return 0;
  }

  const nums = values
    .map(v => safeNumber(v, NaN))
    .filter(v => Number.isFinite(v));

  if(!nums.length) return 0;

  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

/* =========================================
   ADMIN AUTH GUARD
========================================= */
function guardAdmin(){

  if(typeof requireRole === "function"){
    requireRole([
      "super_admin",
      "ecosystem_admin",
      "project_admin",
      "finance_admin"
    ]);
  }

  if(typeof getAdmin === "function" && !getAdmin()){
    window.location.href = "admin-login.html";
    return false;
  }

  return true;
}

/* =========================================
   INVESTOR STATS
========================================= */
async function getCoreInvestorStats(coreProjects = []){

  let allStakes = [];

  try{
    if(typeof getAllStakesMerged === "function"){
      const result = await getAllStakesMerged();
      if(Array.isArray(result)){
        allStakes = result;
      }
    }
  }catch(e){
    console.warn("getAllStakesMerged failed:", e);
  }

  const byProject = {};
  coreProjects.forEach(project => {
    byProject[project.project_code] = 0;
  });

  allStakes.forEach(stake => {
    const code = String(
      stake.project_code ||
      stake.project ||
      ""
    ).trim();

    if(code && Object.prototype.hasOwnProperty.call(byProject, code)){
      byProject[code] = (byProject[code] || 0) + 1;
    }
  });

  const total = Object.values(byProject)
    .reduce((sum, count) => sum + Number(count || 0), 0);

  return {
    total,
    byProject
  };
}

/* =========================================
   ROI HELPER
========================================= */
async function getProjectROI(projectCode, fallbackProject = null){

  try{
    if(typeof calculateProjectROI === "function"){
      const roi = await calculateProjectROI(projectCode);
      const n = Number(roi);
      if(Number.isFinite(n)) return n;
    }
  }catch(e){
    console.warn("calculateProjectROI failed:", e);
  }

  return safeNumber(fallbackProject?.roi, 0);
}

/* =========================================
   LOAD CORE DASHBOARD DATA
========================================= */
async function loadCoreDashboardData(){

  if(typeof getCoreProjects !== "function"){
    throw new Error("getCoreProjects() is missing from projects-engine.js");
  }

  const coreProjects = await getCoreProjects({
    visibleOnly:false,
    activeOnly:false
  });

  const summaries = await Promise.all(
    coreProjects.map(async project => {
      try{
        if(typeof getSmartLiquiditySummary !== "function"){
          return null;
        }

        const summary =
          await getSmartLiquiditySummary(project.project_code);

        return summary?.error ? null : summary;

      }catch(e){
        console.warn(
          "getSmartLiquiditySummary failed:",
          project.project_code,
          e
        );
        return null;
      }
    })
  );

  const summaryMap = {};
  summaries.filter(Boolean).forEach(summary => {
    summaryMap[summary.project_code] = summary;
  });

  const investorStats =
    await getCoreInvestorStats(coreProjects);

  return {
    coreProjects,
    summaries,
    summaryMap,
    investorStats
  };
}

/* =========================================
   RENDER TOP SUMMARY
========================================= */
function renderCoreSummary({
  coreProjects,
  summaryMap,
  investorStats
}){

  const totalProjects = coreProjects.length;
  const activeProjects =
    coreProjects.filter(p => p.status === "active").length;

  let totalLiquidity = 0;
  let totalReserve = 0;
  let totalUsable = 0;

  const rewardRates = [];

  coreProjects.forEach(project => {
    const summary = summaryMap[project.project_code] || null;

    totalLiquidity += safeNumber(summary?.liquidity, 0);
    totalReserve += safeNumber(summary?.reserve, 0);
    totalUsable += safeNumber(summary?.max_usable_liquidity, 0);

    const rewardRaw =
      summary?.reward_rate ?? project.reward_rate ?? 0;

    rewardRates.push(
      normalizeRewardPercent(rewardRaw)
    );
  });

  const avgRewardRate = average(rewardRates);

  coreDashboardEls.totalCoreProjects.textContent =
    String(totalProjects);

  coreDashboardEls.activeCoreProjects.textContent =
    `Active: ${activeProjects}`;

  coreDashboardEls.totalCoreLiquidity.textContent =
    formatPi(totalLiquidity);

  coreDashboardEls.totalCoreUsable.textContent =
    `Usable: ${formatPi(totalUsable)}`;

  coreDashboardEls.totalCoreReserve.textContent =
    formatPi(totalReserve);

  coreDashboardEls.totalCoreRewardRate.textContent =
    `Avg Reward Rate: ${avgRewardRate.toFixed(2)}%`;

  coreDashboardEls.totalCoreInvestors.textContent =
    String(investorStats.total || 0);

  coreDashboardEls.lastRefreshAt.textContent =
    `Last refresh: ${new Date().toLocaleString()}`;
}

/* =========================================
   RENDER CORE PROJECT CARDS
========================================= */
async function renderCoreProjects({
  coreProjects,
  summaryMap,
  investorStats
}){

  if(!coreProjects.length){
    coreDashboardEls.projectsGrid.className = "empty";
    coreDashboardEls.projectsGrid.innerHTML = "No core projects found.";
    return;
  }

  const chunks = [];

  for(const project of coreProjects){

    const summary = summaryMap[project.project_code] || {};
    const investors =
      investorStats.byProject[project.project_code] || 0;

    const roi = await getProjectROI(project.project_code, project);

    const liquidity = safeNumber(summary.liquidity, 0);
    const reserve = safeNumber(summary.reserve, 0);
    const usable = safeNumber(summary.max_usable_liquidity, 0);

    const rewardRateRaw =
      summary.reward_rate ?? project.reward_rate ?? 0;

    const rewardRate =
      normalizeRewardPercent(rewardRateRaw);

    const reservePercent =
      safeNumber(
        summary.reserve_percent,
        project.reserve_percent ?? 0.30
      ) * 100;

    const minLiquidity =
      safeNumber(
        summary.min_liquidity,
        project.min_liquidity ?? 100
      );

    const statusClass =
      getStatusBadgeClass(project.status);

    chunks.push(`
      <div class="project-card">

        <div class="project-title">
          ${escapeHtml(project.icon || "📦")} ${escapeHtml(project.project_name || project.project_code)}
        </div>

        <div class="project-desc">
          ${escapeHtml(project.description || "Albukhr Core Project")}
        </div>

        <div class="badges">
          <span class="badge core">Core</span>
          <span class="badge ${statusClass}">
            ${escapeHtml(formatProjectStatus(project.status))}
          </span>
        </div>

        <div class="row">
          <div>Code</div>
          <div><strong>${escapeHtml(project.project_code || "-")}</strong></div>
        </div>

        <div class="row">
          <div>Liquidity</div>
          <div>${formatPi(liquidity)}</div>
        </div>

        <div class="row">
          <div>Reserve</div>
          <div>${formatPi(reserve)}</div>
        </div>

        <div class="row">
          <div>Usable Liquidity</div>
          <div>${formatPi(usable)}</div>
        </div>

        <div class="row">
          <div>Min Liquidity Rule</div>
          <div>${formatPi(minLiquidity)}</div>
        </div>

        <div class="row">
          <div>Reserve Rule</div>
          <div>${reservePercent.toFixed(0)}%</div>
        </div>

        <div class="row">
          <div>Reward Rate</div>
          <div>${rewardRate.toFixed(2)}%</div>
        </div>

        <div class="row">
          <div>Investors</div>
          <div>${investors}</div>
        </div>

        <div class="row">
          <div>ROI</div>
          <div>${safeNumber(roi, 0).toFixed(2)}%</div>
        </div>

        <div class="actions">
          <button onclick="openProject('${encodeURIComponent(project.project_code || "")}')">
            Open Dashboard
          </button>

          <button class="secondary" onclick="openProjectUpdates('${encodeURIComponent(project.project_code || "")}')">
            Project Updates
          </button>
        </div>

      </div>
    `);
  }

  coreDashboardEls.projectsGrid.className = "project-grid";
  coreDashboardEls.projectsGrid.innerHTML = chunks.join("");
}

/* =========================================
   MAIN RENDER
========================================= */
async function renderDashboard(){

  if(__coreDashboardBusy) return;
  __coreDashboardBusy = true;

  try{

    coreDashboardEls.projectsGrid.className = "loading";
    coreDashboardEls.projectsGrid.innerHTML = "Loading core projects...";

    const data = await loadCoreDashboardData();

    renderCoreSummary(data);
    await renderCoreProjects(data);

  }catch(err){

    console.error("Core dashboard render error:", err);

    coreDashboardEls.projectsGrid.className = "error-box";
    coreDashboardEls.projectsGrid.innerHTML = `
      Failed to load core projects dashboard.<br>
      <span class="muted">${escapeHtml(err?.message || "Unknown error")}</span>
    `;

  }finally{
    __coreDashboardBusy = false;
  }
}

/* =========================================
   OPEN PROJECT DASHBOARD
   NOTE:
   muna adana project_code ne, ba project_name ba
========================================= */
function openProject(encodedProjectCode){

  const projectCode =
    decodeURIComponent(encodedProjectCode || "").trim();

  if(!projectCode){
    alert("Project code missing");
    return;
  }

  localStorage.setItem(
    "albukhr_current_project",
    projectCode
  );

  /*
    Wannan page din yanzu muna amfani da shi
    a matsayin single project dashboard entry.
    Daga baya idan ka kirkiri universal page kamar:
    albukhr-project-dashboard.html
    sai a mayar da route can.
  */
  window.location.href =
    "dashboard.html";
}

/* =========================================
   OPEN PROJECT UPDATES
========================================= */
function openProjectUpdates(encodedProjectCode){

  const projectCode =
    decodeURIComponent(encodedProjectCode || "").trim();

  if(!projectCode){
    alert("Project code missing");
    return;
  }

  localStorage.setItem(
    "albukhr_update_project",
    projectCode
  );

  window.location.href =
    "core-project-updates.html";
}

/* =========================================
   START
========================================= */
document.addEventListener("DOMContentLoaded", async ()=>{

  if(!guardAdmin()) return;

  if(typeof loadProjects === "function"){
    try{
      await loadProjects(true);
    }catch(e){
      console.warn("Projects preload failed:", e);
    }
  }

  await renderDashboard();

  /* refresh every 90 seconds */
  setInterval(async ()=>{
    await renderDashboard();
  }, 90000);

});
