/* =========================================
   ALBUKHR ECOSYSTEM DASHBOARD FINAL
   SUPABASE + TREASURY VERSION
========================================= */

const dashboardEls = {
  totalProjects: document.getElementById("totalProjects"),
  totalLiquidity: document.getElementById("totalLiquidity"),
  totalInvestors: document.getElementById("totalInvestors"),
  totalReserve: document.getElementById("totalReserve"),
  totalUsableLiquidity: document.getElementById("totalUsableLiquidity"),
  totalActiveProjects: document.getElementById("totalActiveProjects"),
  projectTypeBreakdown: document.getElementById("projectTypeBreakdown"),
  lastRefreshAt: document.getElementById("lastRefreshAt"),
  coreLiquidity: document.getElementById("coreLiquidity"),
  internalLiquidity: document.getElementById("internalLiquidity"),
  externalLiquidity: document.getElementById("externalLiquidity"),
  projectList: document.getElementById("projectList"),

  ecoMainBalance: document.getElementById("ecoMainBalance"),
  ecoAvailableLiquidity: document.getElementById("ecoAvailableLiquidity"),
  ecoPendingFunding: document.getElementById("ecoPendingFunding"),
  ecoApprovedFunding: document.getElementById("ecoApprovedFunding"),
  ecoTreasuryStatus: document.getElementById("ecoTreasuryStatus")
};

let __dashboardBusy = false;

/* =========================================
   HELPERS
========================================= */
function formatPi(value){
  const n = Number(value || 0);
  return `${n.toFixed(2)} Pi`;
}

function escapeHtml(text = ""){
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatProjectType(type){
  const t = String(type || "").toLowerCase();
  if(t === "core") return "Core";
  if(t === "internal") return "Internal";
  if(t === "external") return "External";
  return "Unknown";
}

function formatProjectStatus(status){
  const s = String(status || "").toLowerCase();
  if(s === "active") return "Active";
  if(s === "inactive") return "Inactive";
  if(s === "archived") return "Archived";
  return s || "Unknown";
}

function safeNumber(value, fallback = 0){
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatPercent(value){
  const n = safeNumber(value, 0);
  return `${n.toFixed(2)}%`;
}

function normalizePercent(rawValue){
  const n = safeNumber(rawValue, 0);
  if(n > 0 && n <= 1){
    return n * 100;
  }
  return n;
}

/* =========================================
   ADMIN AUTH GUARD
========================================= */
function guardAdmin(){

  if(typeof requireRole === "function"){
    requireRole([
      "super_admin",
      "ecosystem_admin",
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
   SMART LIQUIDITY FALLBACK HELPERS
========================================= */
async function dashboardGetAllSmartLiquiditySummaries(){

  if(typeof getAllSmartLiquiditySummaries === "function"){
    return await getAllSmartLiquiditySummaries();
  }

  const projects =
    typeof getAllProjects === "function"
      ? await getAllProjects({ visibleOnly:false, activeOnly:false })
      : [];

  const rows = [];

  for(const project of projects){
    const code = project.project_code;
    if(!code) continue;

    let summary = null;

    try{
      if(typeof getSmartLiquiditySummary === "function"){
        summary = await getSmartLiquiditySummary(code);
      }
    }catch(e){
      console.warn("getSmartLiquiditySummary failed:", code, e);
    }

    if(summary && !summary.error){
      rows.push(summary);
      continue;
    }

    rows.push({
      project_code: code,
      project_name: project.project_name || code,
      project_type: project.project_type || "core",
      project_status: project.status || "active",
      liquidity: 0,
      reserve: 0,
      reserve_percent: safeNumber(project.reserve_percent, 0.30),
      min_liquidity: safeNumber(project.min_liquidity, 100),
      max_usable_liquidity: 0,
      reward_rate: safeNumber(project.reward_rate, 0)
    });
  }

  return rows;
}

async function dashboardGetEcosystemLiquidityTotals(){

  if(typeof getEcosystemLiquidityTotals === "function"){
    return await getEcosystemLiquidityTotals();
  }

  const rows = await dashboardGetAllSmartLiquiditySummaries();

  const totals = {
    total_liquidity: 0,
    total_reserve: 0,
    total_usable_liquidity: 0,

    core_liquidity: 0,
    internal_liquidity: 0,
    external_liquidity: 0
  };

  for(const row of rows){

    const liquidity = safeNumber(row.liquidity, 0);
    const reserve = safeNumber(row.reserve, 0);
    const usable = safeNumber(row.max_usable_liquidity, 0);
    const type = String(row.project_type || "core").toLowerCase();

    totals.total_liquidity += liquidity;
    totals.total_reserve += reserve;
    totals.total_usable_liquidity += usable;

    if(type === "core"){
      totals.core_liquidity += liquidity;
    }else if(type === "internal"){
      totals.internal_liquidity += liquidity;
    }else if(type === "external"){
      totals.external_liquidity += liquidity;
    }
  }

  return totals;
}

/* =========================================
   ECOSYSTEM TREASURY SNAPSHOT
========================================= */
async function getDashboardEcosystemTreasurySnapshot(){

  const fallback = {
    treasury_balance: 0,
    available_liquidity: 0,
    pending_funding: 0,
    approved_funding: 0,
    status: "N/A"
  };

  try{
    if(typeof getEcosystemTreasurySummary === "function"){
      const summary = await getEcosystemTreasurySummary();
      if(summary && !summary.error){
        return {
          treasury_balance: safeNumber(
            summary.treasury_balance ??
            summary.balance ??
            summary.available_balance,
            0
          ),
          available_liquidity: safeNumber(
            summary.available_liquidity ??
            summary.available_balance ??
            summary.treasury_balance ??
            summary.balance,
            0
          ),
          pending_funding: safeNumber(
            summary.pending_funding ??
            summary.pending ??
            0,
            0
          ),
          approved_funding: safeNumber(
            summary.approved_funding ??
            summary.approved ??
            0,
            0
          ),
          status: summary.status || "ACTIVE"
        };
      }
    }

    if(typeof getEcosystemTreasury === "function"){
      const treasury = await getEcosystemTreasury();

      if(treasury && !treasury.error){
        return {
          treasury_balance: safeNumber(
            treasury.treasury_balance ??
            treasury.balance ??
            treasury.available_balance,
            0
          ),
          available_liquidity: safeNumber(
            treasury.available_liquidity ??
            treasury.available_balance ??
            treasury.treasury_balance ??
            treasury.balance,
            0
          ),
          pending_funding: safeNumber(
            treasury.pending_funding ??
            treasury.pending ??
            0,
            0
          ),
          approved_funding: safeNumber(
            treasury.approved_funding ??
            treasury.approved ??
            0,
            0
          ),
          status: treasury.status || "ACTIVE"
        };
      }
    }

    return fallback;

  }catch(e){
    console.warn("Ecosystem treasury snapshot failed:", e);
    return fallback;
  }
}

/* =========================================
   INVESTOR COUNT
========================================= */
async function getInvestorStats(projects = []){

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

  const totalInvestors = allStakes.length;

  const byProject = {};
  projects.forEach(p => {
    byProject[p.project_code] = 0;
  });

  allStakes.forEach(stake => {
    const code = String(
      stake.project_code ||
      stake.project ||
      ""
    ).trim();

    if(code){
      byProject[code] = (byProject[code] || 0) + 1;
    }
  });

  return {
    totalInvestors,
    byProject
  };
}

/* =========================================
   ROI HELPER
========================================= */
async function getProjectROI(project){

  try{
    if(typeof calculateProjectROI === "function"){
      const roi = await calculateProjectROI(project.project_code);
      return safeNumber(roi, 0);
    }
  }catch(e){
    console.warn("calculateProjectROI failed:", e);
  }

  return safeNumber(project.roi, 0);
}

/* =========================================
   LOAD DASHBOARD DATA
========================================= */
async function loadDashboardData(){

  const [
    projects,
    liquidityRows,
    ecosystemTotals,
    ecosystemTreasury
  ] = await Promise.all([
    typeof getAllProjects === "function"
      ? getAllProjects({
          visibleOnly:false,
          activeOnly:false
        })
      : [],
    dashboardGetAllSmartLiquiditySummaries(),
    dashboardGetEcosystemLiquidityTotals(),
    getDashboardEcosystemTreasurySnapshot()
  ]);

  const investorStats =
    await getInvestorStats(projects);

  const liquidityMap = {};
  liquidityRows.forEach(row => {
    liquidityMap[row.project_code] = row;
  });

  return {
    projects,
    liquidityRows,
    liquidityMap,
    ecosystemTotals,
    ecosystemTreasury,
    investorStats
  };
}

/* =========================================
   RENDER TOP CARDS
========================================= */
function renderTopCards({
  projects,
  ecosystemTotals,
  investorStats
}){

  const coreCount =
    projects.filter(p => p.project_type === "core").length;

  const internalCount =
    projects.filter(p => p.project_type === "internal").length;

  const externalCount =
    projects.filter(p => p.project_type === "external").length;

  const activeCount =
    projects.filter(p => p.status === "active").length;

  dashboardEls.totalProjects.textContent =
    String(projects.length);

  dashboardEls.totalLiquidity.textContent =
    formatPi(ecosystemTotals.total_liquidity);

  dashboardEls.totalReserve.textContent =
    formatPi(ecosystemTotals.total_reserve);

  dashboardEls.totalInvestors.textContent =
    String(investorStats.totalInvestors || 0);

  dashboardEls.totalUsableLiquidity.textContent =
    `Usable: ${formatPi(ecosystemTotals.total_usable_liquidity)}`;

  dashboardEls.totalActiveProjects.textContent =
    `Active Projects: ${activeCount}`;

  dashboardEls.projectTypeBreakdown.textContent =
    `Core: ${coreCount} • Internal: ${internalCount} • External: ${externalCount}`;

  dashboardEls.coreLiquidity.textContent =
    formatPi(ecosystemTotals.core_liquidity);

  dashboardEls.internalLiquidity.textContent =
    formatPi(ecosystemTotals.internal_liquidity);

  dashboardEls.externalLiquidity.textContent =
    formatPi(ecosystemTotals.external_liquidity);

  dashboardEls.lastRefreshAt.textContent =
    `Last refresh: ${new Date().toLocaleString()}`;
}

/* =========================================
   RENDER ECOSYSTEM TREASURY
========================================= */
function renderEcosystemTreasury(ecosystemTreasury = {}){

  dashboardEls.ecoMainBalance.textContent =
    formatPi(ecosystemTreasury.treasury_balance || 0);

  dashboardEls.ecoAvailableLiquidity.textContent =
    formatPi(ecosystemTreasury.available_liquidity || 0);

  dashboardEls.ecoPendingFunding.textContent =
    formatPi(ecosystemTreasury.pending_funding || 0);

  dashboardEls.ecoApprovedFunding.textContent =
    formatPi(ecosystemTreasury.approved_funding || 0);

  dashboardEls.ecoTreasuryStatus.textContent =
    ecosystemTreasury.status || "N/A";
}

/* =========================================
   RENDER PROJECT LIST
========================================= */
async function renderProjects({
  projects,
  liquidityMap,
  investorStats
}){

  if(!projects.length){
    dashboardEls.projectList.className = "empty";
    dashboardEls.projectList.innerHTML =
      "No projects found.";
    return;
  }

  const chunks = [];

  for(const project of projects){

    const liquidity =
      liquidityMap[project.project_code] || null;

    const investors =
      investorStats.byProject[project.project_code] || 0;

    const roi = await getProjectROI(project);

    const projectName =
      project.project_name || project.project_code || "Unnamed Project";

    const projectType =
      String(project.project_type || "core").toLowerCase();

    const status =
      String(project.status || "active").toLowerCase();

    const projectIcon = project.icon || "📦";

    const liquidityValue =
      safeNumber(liquidity?.liquidity, 0);

    const reserveValue =
      safeNumber(liquidity?.reserve, 0);

    const usableValue =
      safeNumber(liquidity?.max_usable_liquidity, 0);

    const rewardRateRaw =
      safeNumber(liquidity?.reward_rate, project.reward_rate || 0);

    const rewardRatePercent =
      normalizePercent(rewardRateRaw);

    const reservePercent =
      safeNumber(
        liquidity?.reserve_percent,
        project.reserve_percent || 0.30
      ) * 100;

    chunks.push(`
      <div class="project-card">

        <div class="project-top">
          <div>
            <div class="project-title">
              ${projectIcon} ${escapeHtml(projectName)}
            </div>

            <div class="project-meta">
              Code: ${escapeHtml(project.project_code || "-")}<br>
              ${escapeHtml(project.description || "Albukhr Project")}
            </div>

            <div class="badges">
              <span class="badge ${escapeHtml(projectType)}">
                ${escapeHtml(formatProjectType(projectType))}
              </span>

              <span class="badge ${status === "active" ? "active" : "inactive"}">
                ${escapeHtml(formatProjectStatus(status))}
              </span>
            </div>
          </div>
        </div>

        <div class="row">
          <div>Liquidity</div>
          <div><strong>${formatPi(liquidityValue)}</strong></div>
        </div>

        <div class="row">
          <div>Reserve</div>
          <div>${formatPi(reserveValue)}</div>
        </div>

        <div class="row">
          <div>Usable Liquidity</div>
          <div>${formatPi(usableValue)}</div>
        </div>

        <div class="row">
          <div>Investors</div>
          <div>${investors}</div>
        </div>

        <div class="row">
          <div>Reward Rate</div>
          <div>${formatPercent(rewardRatePercent)}</div>
        </div>

        <div class="row">
          <div>Reserve Rule</div>
          <div>${reservePercent.toFixed(0)}%</div>
        </div>

        <div class="row">
          <div>ROI</div>
          <div>${formatPercent(safeNumber(roi, 0))}</div>
        </div>

      </div>
    `);
  }

  dashboardEls.projectList.className = "";
  dashboardEls.projectList.innerHTML = chunks.join("");
}

/* =========================================
   RENDER FULL DASHBOARD
========================================= */
async function renderDashboard(){

  if(__dashboardBusy) return;
  __dashboardBusy = true;

  try{

    dashboardEls.projectList.className = "loading";
    dashboardEls.projectList.innerHTML = "Loading dashboard...";

    const data = await loadDashboardData();

    renderTopCards(data);
    renderEcosystemTreasury(data.ecosystemTreasury);
    await renderProjects(data);

  }catch(err){

    console.error("renderDashboard error:", err);

    dashboardEls.projectList.className = "error-box";
    dashboardEls.projectList.innerHTML = `
      Failed to load ecosystem dashboard.<br>
      <span class="muted">${escapeHtml(err?.message || "Unknown error")}</span>
    `;

  }finally{
    __dashboardBusy = false;
  }
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

  // refresh every 30 seconds
  setInterval(async ()=>{
    await renderDashboard();
  }, 30000);

});
