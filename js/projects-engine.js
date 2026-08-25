/* =========================================
   ALBUKHR PROJECTS ENGINE v3 FINAL
   Supabase Core-Compatible Project Registry
   Canonical source: public.projects
   Network-aware: mainnet / testnet
   Image-aware: logo_url / logo_path
========================================= */

const ALBUKHR_PROJECTS_TABLE = "projects";

/* ---------- Supabase client ---------- */
function getProjectsSupabaseClient(){
  if(typeof window.getAlbukhrSupabaseClient === "function"){
    const client = window.getAlbukhrSupabaseClient();
    if(client) return client;
  }
  if(window.albukhrSupabase) return window.albukhrSupabase;

  console.warn(
    "projects-engine: ALBUKHR Supabase Core client not found. " +
    "Load js/supabase-core.js before js/projects-engine.js"
  );
  return null;
}

/* ---------- Network ---------- */
function normalizeAlbukhrNetwork(network){
  const value = String(network || "").trim().toLowerCase();
  if(value === "mainnet") return "mainnet";
  if(value === "testnet") return "testnet";
  return "";
}

function getCurrentAlbukhrNetwork(){
  try{
    if(typeof window.getAlbukhrCurrentNetwork === "function"){
      const n = normalizeAlbukhrNetwork(window.getAlbukhrCurrentNetwork());
      if(n) return n;
    }
  }catch(e){
    console.warn("getAlbukhrCurrentNetwork warning:", e);
  }

  try{
    if(typeof window.getCurrentAlbukhrNetwork === "function"){
      const n = normalizeAlbukhrNetwork(window.getCurrentAlbukhrNetwork());
      if(n) return n;
    }
  }catch(e){
    console.warn("getCurrentAlbukhrNetwork warning:", e);
  }

  try{
    if(typeof window.ALBKHR_ENVIRONMENT !== "undefined"){
      const value = typeof window.ALBKHR_ENVIRONMENT === "object"
        ? window.ALBKHR_ENVIRONMENT.network
        : window.ALBKHR_ENVIRONMENT;
      const n = normalizeAlbukhrNetwork(value);
      if(n) return n;
    }
  }catch(e){
    console.warn("ALBUKHR_ENVIRONMENT warning:", e);
  }

  const host = String(window.location?.hostname || "").toLowerCase();

  if(host === "app.albukhr.com" || host.endsWith(".app.albukhr.com")){
    return "mainnet";
  }

  if(host === "test.albukhr.com" || host.endsWith(".test.albukhr.com")){
    return "testnet";
  }

  /* Safe development default. */
  return "testnet";
}

window.getAlbukhrProjectsNetwork = getCurrentAlbukhrNetwork;
window.getCurrentAlbukhrNetwork = getCurrentAlbukhrNetwork;

/* ---------- Testnet-only compatibility fallback ---------- */
const ALBUKHR_PROJECTS_FALLBACK = [
  ["Azman","Azman Futures Makers Lab",1],
  ["Labbaika","Labbaika Bakery Center",2],
  ["Barsh","Barsh Agro & Livestock",3],
  ["Urban","Urban Mobility System",4],
  ["Khairat","Khairat Fertiliser",5],
  ["Hauwal","Hauwal Maize Processing",6],
  ["Raheem","Raheem Pharmacy",7]
].map(([project_code, project_name, sort_order]) => ({
  project_code,
  project_name,
  project_type:"core",
  network:"testnet",
  status:"active",
  description:"",
  info:"",
  min_liquidity:100,
  reserve_percent:0.30,
  project_visible:true,
  dashboard_enabled:true,
  transparency_enabled:true,
  sort_order,
  logo_url:"",
  logo_path:"",
  logo_mime_type:"",
  logo_size_bytes:null,
  logo_width:null,
  logo_height:null
}));

/* ---------- Cache ---------- */
let __albukhrProjectsCache = [];
let __albukhrProjectsLoaded = false;
let __albukhrProjectsLoading = false;
let __albukhrProjectsLastLoadedAt = null;
let __albukhrProjectsLastSource = "none";
let __albukhrProjectsLastNetwork = null;

/* ---------- Helpers ---------- */
function safeNum(value, fallback = 0){
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeStr(value, fallback = ""){
  return value === null || value === undefined ? fallback : String(value);
}

function normalizeProjectType(type){
  const t = safeStr(type).trim().toLowerCase();
  if(t === "core" || t === "internal" || t === "external") return t;
  return "core";
}

function normalizeProjectStatus(status){
  const s = safeStr(status).trim().toLowerCase();
  if(s === "active") return "active";
  if(s === "inactive" || s === "disabled") return "inactive";
  if(s === "archived") return "archived";
  return "active";
}

function normalizeDurations(value){
  if(Array.isArray(value)){
    const arr = value.map(Number).filter(v => Number.isFinite(v) && v > 0);
    return arr.length ? arr : [30,60,90];
  }
  if(typeof value === "string" && value.trim()){
    const arr = value.split(",").map(v => Number(v.trim()))
      .filter(v => Number.isFinite(v) && v > 0);
    return arr.length ? arr : [30,60,90];
  }
  return [30,60,90];
}

function normalizeProjectRow(row = {}){
  const code = safeStr(row.project_code || row.code || row.slug).trim();
  const name = safeStr(row.project_name || row.title || code || "Unnamed Project").trim();
  const network = normalizeAlbukhrNetwork(row.network) || "testnet";

  const visible = row.project_visible === false ? false : true;
  const dashboard = row.dashboard_enabled === false ? false : true;
  const transparency = row.transparency_enabled === false ? false : true;

  return {
    id: row.id ?? null,
    project_code: code,
    project_name: name,
    title: name,
    project_type: normalizeProjectType(row.project_type),
    network,
    status: normalizeProjectStatus(row.status),

    /* Legacy only. New UI must use logo_url/logo_path. */
    icon: safeStr(row.icon, ""),

    description: safeStr(row.description || row.desc, "ALBUKHR Project"),
    info: safeStr(row.info, "Project information not available."),

    min_liquidity: safeNum(row.min_liquidity, 100),
    reserve_percent: safeNum(row.reserve_percent, 0.30),

    /* Not present in verified schema: do not invent a value. */
    reward_rate:
      row.reward_rate === null || row.reward_rate === undefined || row.reward_rate === ""
        ? null : safeNum(row.reward_rate, null),

    durations: normalizeDurations(row.durations),
    sort_order: safeNum(row.sort_order, 9999),

    project_visible: visible,
    dashboard_enabled: dashboard,
    transparency_enabled: transparency,

    /* Compatibility aliases for older consumers. */
    is_visible: visible,
    treasury_enabled: row.treasury_enabled === false ? false : true,
    staking_enabled: row.staking_enabled === false ? false : true,
    contributions_enabled: row.contributions_enabled === false ? false : true,

    /* Canonical project image metadata. */
    logo_url: safeStr(row.logo_url, ""),
    logo_path: safeStr(row.logo_path, ""),
    logo_mime_type: safeStr(row.logo_mime_type, ""),
    logo_size_bytes: row.logo_size_bytes == null ? null : safeNum(row.logo_size_bytes, null),
    logo_width: row.logo_width == null ? null : safeNum(row.logo_width, null),
    logo_height: row.logo_height == null ? null : safeNum(row.logo_height, null),

    /* Compatibility alias; points to canonical logo URL. */
    cover_image: safeStr(row.logo_url, ""),

    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    raw: row
  };
}

function sortProjects(rows = []){
  return [...rows].sort((a,b) => {
    const aSort = safeNum(a.sort_order, 9999);
    const bSort = safeNum(b.sort_order, 9999);
    if(aSort !== bSort) return aSort - bSort;
    return safeStr(a.project_name).localeCompare(safeStr(b.project_name));
  });
}

/* ---------- Supabase fetch: network is mandatory ---------- */
async function fetchProjectsFromSupabase(options = {}){
  const supabase = getProjectsSupabaseClient();
  if(!supabase){
    return {success:false, error:"Supabase core client not available"};
  }

  const network =
    normalizeAlbukhrNetwork(options.network) || getCurrentAlbukhrNetwork();

  try{
    const {data, error} = await supabase
      .from(ALBUKHR_PROJECTS_TABLE)
      .select("*")
      .eq("network", network)
      .order("project_name", {ascending:true});

    if(error){
      return {success:false, network, error:error.message || "Failed to load projects"};
    }

    const normalized = (data || [])
      .map(normalizeProjectRow)
      .filter(p => p.project_code && p.network === network);

    return {success:true, network, data:sortProjects(normalized)};
  }catch(e){
    return {success:false, network, error:e?.message || "Projects fetch failed"};
  }
}

/* ---------- Load ---------- */
async function loadProjects(forceRefresh = false, options = {}){
  const network =
    normalizeAlbukhrNetwork(options.network) || getCurrentAlbukhrNetwork();

  const networkChanged =
    __albukhrProjectsLastNetwork &&
    __albukhrProjectsLastNetwork !== network;

  if(__albukhrProjectsLoaded && !forceRefresh && !networkChanged){
    return __albukhrProjectsCache;
  }

  if(__albukhrProjectsLoading && !forceRefresh && !networkChanged){
    return __albukhrProjectsCache;
  }

  __albukhrProjectsLoading = true;
  __albukhrProjectsLastNetwork = network;

  const remote = await fetchProjectsFromSupabase({network});

  if(remote.success && Array.isArray(remote.data)){
    __albukhrProjectsCache = remote.data;
    __albukhrProjectsLoaded = true;
    __albukhrProjectsLoading = false;
    __albukhrProjectsLastLoadedAt = Date.now();
    __albukhrProjectsLastSource = "supabase";
    return __albukhrProjectsCache;
  }

  /* Never expose testnet fallback on mainnet. */
  if(network === "mainnet"){
    __albukhrProjectsCache = [];
    __albukhrProjectsLoaded = true;
    __albukhrProjectsLoading = false;
    __albukhrProjectsLastLoadedAt = Date.now();
    __albukhrProjectsLastSource = "mainnet-empty";

    console.error(
      "Projects engine: mainnet project registry unavailable.",
      remote.error || "Unknown Supabase error"
    );
    return [];
  }

  __albukhrProjectsCache = sortProjects(
    ALBUKHR_PROJECTS_FALLBACK
      .map(normalizeProjectRow)
      .filter(p => p.network === network)
  );

  __albukhrProjectsLoaded = true;
  __albukhrProjectsLoading = false;
  __albukhrProjectsLastLoadedAt = Date.now();
  __albukhrProjectsLastSource = "fallback";

  console.warn(
    "Projects engine fallback in use:",
    remote.error || "Supabase unavailable"
  );

  return __albukhrProjectsCache;
}

async function refreshProjectsCache(options = {}){
  return await loadProjects(true, options);
}

/* ---------- Collection ---------- */
async function getAllProjects(options = {}){
  const rows = await loadProjects(!!options.forceRefresh, options);
  let result = [...rows];

  if(options.visibleOnly)
    result = result.filter(p => p.project_visible !== false);

  if(options.activeOnly)
    result = result.filter(p => p.status === "active");

  if(options.dashboardEnabledOnly)
    result = result.filter(p => p.dashboard_enabled !== false);

  if(options.transparencyEnabledOnly)
    result = result.filter(p => p.transparency_enabled !== false);

  /* Legacy filters retained for compatibility. */
  if(options.treasuryEnabledOnly)
    result = result.filter(p => p.treasury_enabled !== false);

  if(options.stakingEnabledOnly)
    result = result.filter(p => p.staking_enabled !== false);

  if(options.contributionsEnabledOnly)
    result = result.filter(p => p.contributions_enabled !== false);

  return result;
}

async function getProjects(options = {}){
  return await getAllProjects(options);
}

async function getActiveProjects(options = {}){
  return await getAllProjects({...options, activeOnly:true});
}

/* ---------- Types ---------- */
async function getProjectsByType(projectType, options = {}){
  const type = normalizeProjectType(projectType);
  const rows = await getAllProjects(options);
  return rows.filter(p => p.project_type === type);
}

async function getCoreProjects(options = {}){
  return await getProjectsByType("core", options);
}

async function getInternalProjects(options = {}){
  return await getProjectsByType("internal", options);
}

async function getExternalProjects(options = {}){
  return await getProjectsByType("external", options);
}

async function groupProjectsByType(options = {}){
  const rows = await getAllProjects(options);
  return {
    core: rows.filter(p => p.project_type === "core"),
    internal: rows.filter(p => p.project_type === "internal"),
    external: rows.filter(p => p.project_type === "external")
  };
}

/* ---------- Lookup ---------- */
async function getProjectByCode(projectCode, options = {}){
  if(!projectCode) return null;

  const rows = await getAllProjects(options);
  const code = safeStr(projectCode).trim().toLowerCase();

  return rows.find(p =>
    safeStr(p.project_code).trim().toLowerCase() === code
  ) || null;
}

async function getProjectMeta(projectCode, options = {}){
  return await getProjectByCode(projectCode, options);
}

async function getProject(projectCode, options = {}){
  return await getProjectByCode(projectCode, options);
}

/* ---------- Field helpers ---------- */
async function getProjectTitle(projectCode, options = {}){
  const p = await getProjectByCode(projectCode, options);
  return p?.project_name || projectCode || "Unknown Project";
}

async function getProjectName(projectCode, options = {}){
  return await getProjectTitle(projectCode, options);
}

/* Legacy compatibility only; no generated emoji. */
async function getProjectIcon(projectCode, options = {}){
  const p = await getProjectByCode(projectCode, options);
  return p?.icon || "";
}

/* New image API. */
async function getProjectLogo(projectCode, options = {}){
  const p = await getProjectByCode(projectCode, options);

  return {
    url: p?.logo_url || "",
    path: p?.logo_path || "",
    mime_type: p?.logo_mime_type || "",
    size_bytes: p?.logo_size_bytes ?? null,
    width: p?.logo_width ?? null,
    height: p?.logo_height ?? null
  };
}

async function getProjectLogoUrl(projectCode, options = {}){
  const logo = await getProjectLogo(projectCode, options);
  return logo.url || "";
}

async function getProjectDescription(projectCode, options = {}){
  const p = await getProjectByCode(projectCode, options);
  return p?.description || "ALBUKHR Project";
}

async function getProjectInfo(projectCode, options = {}){
  const p = await getProjectByCode(projectCode, options);
  return p?.info || "Project information not available.";
}

async function getProjectDurations(projectCode, options = {}){
  const p = await getProjectByCode(projectCode, options);
  return p?.durations || [30,60,90];
}

async function getProjectType(projectCode, options = {}){
  const p = await getProjectByCode(projectCode, options);
  return p?.project_type || null;
}

async function getProjectStatus(projectCode, options = {}){
  const p = await getProjectByCode(projectCode, options);
  return p?.status || null;
}

async function getProjectNetwork(projectCode, options = {}){
  const p = await getProjectByCode(projectCode, options);
  return p?.network || null;
}

async function projectExists(projectCode, options = {}){
  return !!(await getProjectByCode(projectCode, options));
}

/* ---------- Flags ---------- */
async function isProjectActive(projectCode, options = {}){
  const p = await getProjectByCode(projectCode, options);
  return !!p && p.status === "active";
}

async function isProjectVisible(projectCode, options = {}){
  const p = await getProjectByCode(projectCode, options);
  return !!p && p.project_visible !== false;
}

async function isProjectDashboardEnabled(projectCode, options = {}){
  const p = await getProjectByCode(projectCode, options);
  return !!p && p.dashboard_enabled !== false;
}

async function isProjectTransparencyEnabled(projectCode, options = {}){
  const p = await getProjectByCode(projectCode, options);
  return !!p && p.transparency_enabled !== false;
}

async function isCoreProject(projectCode, options = {}){
  const p = await getProjectByCode(projectCode, options);
  return !!p && p.project_type === "core";
}

async function isInternalProject(projectCode, options = {}){
  const p = await getProjectByCode(projectCode, options);
  return !!p && p.project_type === "internal";
}

async function isExternalProject(projectCode, options = {}){
  const p = await getProjectByCode(projectCode, options);
  return !!p && p.project_type === "external";
}

/* Compatibility helpers for older engines. */
async function isProjectTreasuryEnabled(projectCode, options = {}){
  const p = await getProjectByCode(projectCode, options);
  return !!p && p.treasury_enabled !== false;
}

async function isProjectStakingEnabled(projectCode, options = {}){
  const p = await getProjectByCode(projectCode, options);
  return !!p && p.staking_enabled !== false;
}

async function isProjectContributionsEnabled(projectCode, options = {}){
  const p = await getProjectByCode(projectCode, options);
  return !!p && p.contributions_enabled !== false;
}

/* ---------- Rules ---------- */
async function getProjectRules(projectCode, options = {}){
  const p = await getProjectByCode(projectCode, options);

  if(!p){
    return {
      reserve_percent:0.30,
      min_liquidity:100,
      reward_rate:null
    };
  }

  return {
    reserve_percent:safeNum(p.reserve_percent, 0.30),
    min_liquidity:safeNum(p.min_liquidity, 100),
    reward_rate:p.reward_rate == null ? null : safeNum(p.reward_rate, null)
  };
}

/* ---------- Summary ---------- */
async function getProjectsEngineSummary(options = {}){
  const all = await getAllProjects(options);
  const grouped = await groupProjectsByType(options);

  return {
    network:
      normalizeAlbukhrNetwork(options.network) ||
      getCurrentAlbukhrNetwork(),
    total:all.length,
    core:grouped.core.length,
    internal:grouped.internal.length,
    external:grouped.external.length,
    loaded:__albukhrProjectsLoaded,
    loading:__albukhrProjectsLoading,
    last_loaded_at:__albukhrProjectsLastLoadedAt,
    source:__albukhrProjectsLastSource,
    last_network:__albukhrProjectsLastNetwork
  };
}

/* ---------- Global exports ---------- */
window.loadProjects = loadProjects;
window.refreshProjectsCache = refreshProjectsCache;

window.getProjects = getProjects;
window.getAllProjects = getAllProjects;
window.getActiveProjects = getActiveProjects;

window.getProjectsByType = getProjectsByType;
window.getCoreProjects = getCoreProjects;
window.getInternalProjects = getInternalProjects;
window.getExternalProjects = getExternalProjects;
window.groupProjectsByType = groupProjectsByType;

window.getProjectByCode = getProjectByCode;
window.getProjectMeta = getProjectMeta;
window.getProject = getProject;

window.getProjectTitle = getProjectTitle;
window.getProjectName = getProjectName;
window.getProjectIcon = getProjectIcon;
window.getProjectLogo = getProjectLogo;
window.getProjectLogoUrl = getProjectLogoUrl;
window.getProjectDescription = getProjectDescription;
window.getProjectInfo = getProjectInfo;
window.getProjectDurations = getProjectDurations;
window.getProjectType = getProjectType;
window.getProjectStatus = getProjectStatus;
window.getProjectNetwork = getProjectNetwork;
window.projectExists = projectExists;

window.isProjectActive = isProjectActive;
window.isProjectVisible = isProjectVisible;
window.isProjectDashboardEnabled = isProjectDashboardEnabled;
window.isProjectTransparencyEnabled = isProjectTransparencyEnabled;
window.isCoreProject = isCoreProject;
window.isInternalProject = isInternalProject;
window.isExternalProject = isExternalProject;

window.isProjectTreasuryEnabled = isProjectTreasuryEnabled;
window.isProjectStakingEnabled = isProjectStakingEnabled;
window.isProjectContributionsEnabled = isProjectContributionsEnabled;

window.getProjectRules = getProjectRules;
window.getProjectsEngineSummary = getProjectsEngineSummary;

/* ---------- Preload ---------- */
window.addEventListener("DOMContentLoaded", () => {
  loadProjects().catch(err => {
    console.warn("Projects preload warning:", err);
  });
});
