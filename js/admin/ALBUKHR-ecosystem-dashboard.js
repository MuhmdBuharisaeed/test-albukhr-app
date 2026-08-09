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
      project_status: project.status || "
