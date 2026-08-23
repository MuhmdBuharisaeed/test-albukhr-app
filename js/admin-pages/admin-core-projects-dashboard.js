/* =========================================
   ALBUKHR ADMIN CORE PROJECTS DASHBOARD
   AUDITED / ARCHITECTURE-ALIGNED
   Supabase-first through engines
   Network-aware
   No LocalStorage persistence
========================================= */
"use strict";

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
let __coreDashboardRefreshTimer = null;

function requireElement(el, name){
  if(!el) console.warn(`[Core Dashboard] Missing DOM element: ${name}`);
  return el;
}

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
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
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
  return ["active","inactive","archived"].includes(s) ? s : "inactive";
}

function normalizeRewardPercent(value){
  const n = safeNumber(value, 0);
  if(n <= 0) return 0;
  return n < 1 ? n * 100 : n;
}

function average(values = []){
  const nums = values.map(v => safeNumber(v, NaN)).filter(Number.isFinite);
  return nums.length ? nums.reduce((a,b)=>a+b,0) / nums.length : 0;
}

/* Network is resolved from the shared architecture/environment layer.
   Hostname fallback is read-only and does not persist state. */
function getAdminNetwork(){
  if(window.AlbukhrNetwork && typeof window.AlbukhrNetwork.getCurrentNetwork === "function"){
    return String(window.AlbukhrNetwork.getCurrentNetwork()).toLowerCase();
  }
  if(typeof window.getCurrentNetwork === "function"){
    return String(window.getCurrentNetwork()).toLowerCase();
  }
  const host = window.location.hostname.toLowerCase();
  if(host === "app.albukhr.com" || host === "www.app.albukhr.com") return "mainnet";
  if(host === "test.albukhr.com" || host === "www.test.albukhr.com") return "testnet";
  return "testnet";
}

function guardAdmin(){
  if(typeof requireRole === "function"){
    const result = requireRole(["super_admin","ecosystem_admin","project_admin","finance_admin"]);
    if(result === false) return false;
  }
  if(typeof getAdmin === "function" && !getAdmin()){
    window.location.href = "admin-login.html";
    return false;
  }
  return true;
}

async function getCoreInvestorStats(coreProjects = [], network){
  let allStakes = [];
  try{
    if(typeof getAllStakesMerged === "function"){
      const result = await getAllStakesMerged({ network });
      if(Array.isArray(result)) allStakes = result;
    }else{
      console.warn("[Core Dashboard] getAllStakesMerged is unavailable.");
    }
  }catch(e){
    console.warn("[Core Dashboard] Investor engine failed:", e);
  }

  const byProject = Object.fromEntries(
    coreProjects.map(project => [project.project_code, 0])
  );

  allStakes.forEach(stake => {
    const stakeNetwork = String(stake.network || network).toLowerCase();
    if(stakeNetwork !== network) return;
    const code = String(stake.project_code || stake.project || "").trim();
    if(code && Object.prototype.hasOwnProperty.call(byProject, code)){
      byProject[code] += 1;
    }
  });

  return { total: Object.values(byProject).reduce((a,b)=>a+b,0), byProject };
}

async function getProjectROI(projectCode, fallbackProject = null, network){
  try{
    if(typeof calculateProjectROI === "function"){
      const roi = await calculateProjectROI(projectCode, { network });
      const n = Number(roi);
      if(Number.isFinite(n)) return n;
    }
  }catch(e){
    console.warn("[Core Dashboard] ROI engine failed:", projectCode, e);
  }
  return safeNumber(fallbackProject?.roi, 0);
}

async function loadCoreDashboardData(){
  if(typeof getCoreProjects !== "function"){
    throw new Error("getCoreProjects() is missing from the core project engine.");
  }
  const network = getAdminNetwork();

  const coreProjects = await getCoreProjects({
    visibleOnly: false,
    activeOnly: false,
    network
  });

  const isolatedProjects = (Array.isArray(coreProjects) ? coreProjects : [])
    .filter(p => !p.network || String(p.network).toLowerCase() === network);

  const summaries = await Promise.all(isolatedProjects.map(async project => {
    try{
      if(typeof getSmartLiquiditySummary !== "function") return null;
      const summary = await getSmartLiquiditySummary(project.project_code, { network });
      if(!summary || summary.error) return null;
      if(summary.network && String(summary.network).toLowerCase() !== network) return null;
      return summary;
    }catch(e){
      console.warn("[Core Dashboard] Liquidity summary failed:", project.project_code, e);
      return null;
    }
  }));

  const summaryMap = {};
  summaries.filter(Boolean).forEach(summary => {
    summaryMap[summary.project_code] = summary;
  });

  return {
    network,
    coreProjects: isolatedProjects,
    summaryMap,
    investorStats: await getCoreInvestorStats(isolatedProjects, network)
  };
}

function renderCoreSummary({coreProjects, summaryMap, investorStats}){
  if(coreDashboardEls.totalCoreProjects)
    coreDashboardEls.totalCoreProjects.textContent = String(coreProjects.length);

  if(coreDashboardEls.activeCoreProjects)
    coreDashboardEls.activeCoreProjects.textContent =
      `Active: ${coreProjects.filter(p => String(p.status).toLowerCase() === "active").length}`;

  let totalLiquidity=0,totalReserve=0,totalUsable=0;
  const rewardRates=[];

  coreProjects.forEach(project=>{
    const summary=summaryMap[project.project_code]||{};
    totalLiquidity += safeNumber(summary.liquidity);
    totalReserve += safeNumber(summary.reserve);
    totalUsable += safeNumber(summary.max_usable_liquidity);
    rewardRates.push(normalizeRewardPercent(summary.reward_rate ?? project.reward_rate));
  });

  if(coreDashboardEls.totalCoreLiquidity) coreDashboardEls.totalCoreLiquidity.textContent=formatPi(totalLiquidity);
  if(coreDashboardEls.totalCoreUsable) coreDashboardEls.totalCoreUsable.textContent=`Usable: ${formatPi(totalUsable)}`;
  if(coreDashboardEls.totalCoreReserve) coreDashboardEls.totalCoreReserve.textContent=formatPi(totalReserve);
  if(coreDashboardEls.totalCoreRewardRate) coreDashboardEls.totalCoreRewardRate.textContent=`Avg Reward Rate: ${average(rewardRates).toFixed(2)}%`;
  if(coreDashboardEls.totalCoreInvestors) coreDashboardEls.totalCoreInvestors.textContent=String(investorStats.total || 0);
  if(coreDashboardEls.lastRefreshAt) coreDashboardEls.lastRefreshAt.textContent=`Last refresh: ${new Date().toLocaleString()}`;
}

async function renderCoreProjects({coreProjects, summaryMap, investorStats, network}){
  requireElement(coreDashboardEls.projectsGrid,"projectsGrid");
  if(!coreDashboardEls.projectsGrid) return;

  if(!coreProjects.length){
    coreDashboardEls.projectsGrid.className="empty";
    coreDashboardEls.projectsGrid.textContent="No core projects found.";
    return;
  }

  const chunks=[];
  for(const project of coreProjects){
    const summary=summaryMap[project.project_code]||{};
    const investors=investorStats.byProject[project.project_code]||0;
    const roi=await getProjectROI(project.project_code,project,network);
    const liquidity=safeNumber(summary.liquidity);
    const reserve=safeNumber(summary.reserve);
    const usable=safeNumber(summary.max_usable_liquidity);
    const rewardRate=normalizeRewardPercent(summary.reward_rate ?? project.reward_rate);
    const reservePercent=safeNumber(summary.reserve_percent, project.reserve_percent ?? 0.30) * 100;
    const minLiquidity=safeNumber(summary.min_liquidity, project.min_liquidity ?? 100);
    const code=String(project.project_code||"").trim();

    chunks.push(`
      <div class="project-card" data-network="${escapeHtml(network)}">
        <div class="project-title">${escapeHtml(project.icon||"📦")} ${escapeHtml(project.project_name||code)}</div>
        <div class="project-desc">${escapeHtml(project.description||"Albukhr Core Project")}</div>
        <div class="badges">
          <span class="badge core">Core</span>
          <span class="badge ${getStatusBadgeClass(project.status)}">${escapeHtml(formatProjectStatus(project.status))}</span>
        </div>
        <div class="row"><div>Code</div><div><strong>${escapeHtml(code||"-")}</strong></div></div>
        <div class="row"><div>Network</div><div>${escapeHtml(network)}</div></div>
        <div class="row"><div>Liquidity</div><div>${formatPi(liquidity)}</div></div>
        <div class="row"><div>Reserve</div><div>${formatPi(reserve)}</div></div>
        <div class="row"><div>Usable Liquidity</div><div>${formatPi(usable)}</div></div>
        <div class="row"><div>Min Liquidity Rule</div><div>${formatPi(minLiquidity)}</div></div>
        <div class="row"><div>Reserve Rule</div><div>${reservePercent.toFixed(0)}%</div></div>
        <div class="row"><div>Reward Rate</div><div>${rewardRate.toFixed(2)}%</div></div>
        <div class="row"><div>Investors</div><div>${investors}</div></div>
        <div class="row"><div>ROI</div><div>${safeNumber(roi).toFixed(2)}%</div></div>
        <div class="actions">
          <button type="button" onclick="openProject('${encodeURIComponent(code)}')">Open Dashboard</button>
          <button type="button" class="secondary" onclick="openProjectUpdates('${encodeURIComponent(code)}')">Project Updates</button>
        </div>
      </div>`);
  }
  coreDashboardEls.projectsGrid.className="project-grid";
  coreDashboardEls.projectsGrid.innerHTML=chunks.join("");
}

async function renderDashboard(){
  if(__coreDashboardBusy) return;
  __coreDashboardBusy=true;
  try{
    if(coreDashboardEls.projectsGrid){
      coreDashboardEls.projectsGrid.className="loading";
      coreDashboardEls.projectsGrid.textContent="Loading core projects...";
    }
    const data=await loadCoreDashboardData();
    renderCoreSummary(data);
    await renderCoreProjects(data);
  }catch(err){
    console.error("[Core Dashboard]",err);
    if(coreDashboardEls.projectsGrid){
      coreDashboardEls.projectsGrid.className="error-box";
      coreDashboardEls.projectsGrid.innerHTML=`Failed to load core projects dashboard.<br><span class="muted">${escapeHtml(err?.message||"Unknown error")}</span>`;
    }
  }finally{
    __coreDashboardBusy=false;
  }
}

/* Navigation is URL-state based; no LocalStorage persistence. */
function openProject(encodedProjectCode){
  const projectCode=decodeURIComponent(encodedProjectCode||"").trim();
  if(!projectCode){ alert("Project code missing"); return; }
  window.location.href=`dashboard.html?project_code=${encodeURIComponent(projectCode)}`;
}

function openProjectUpdates(encodedProjectCode){
  const projectCode=decodeURIComponent(encodedProjectCode||"").trim();
  if(!projectCode){ alert("Project code missing"); return; }
  window.location.href=`core-project-updates.html?project_code=${encodeURIComponent(projectCode)}`;
}

document.addEventListener("DOMContentLoaded",async()=>{
  if(!guardAdmin()) return;
  if(typeof loadProjects==="function"){
    try{ await loadProjects(true); }catch(e){ console.warn("[Core Dashboard] Projects preload failed:",e); }
  }
  await renderDashboard();
  if(__coreDashboardRefreshTimer) clearInterval(__coreDashboardRefreshTimer);
  __coreDashboardRefreshTimer=setInterval(renderDashboard,90000);
});

window.renderCoreDashboard=renderDashboard;
window.openProject=openProject;
window.openProjectUpdates=openProjectUpdates;
