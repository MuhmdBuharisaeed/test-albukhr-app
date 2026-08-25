/* =========================================
   ALBUKHR PROJECTS ENGINE v4
   Supabase Core-Compatible Project Registry
   Canonical source: public.projects
   Network-aware: mainnet / testnet
   Image-aware: logo_url / logo_path

   ARCHITECTURE
   environment-switcher.js
        ↓
   supabase-core.js
        ↓
   projects-engine.js
        ↓
   domain/page controllers

   RULES
   - Supabase is the source of truth.
   - No LocalStorage.
   - No alternate project registry table.
   - Mainnet/testnet are strictly isolated by network.
   - No static project fallback is exposed.
   - Network resolution is delegated to ALBUKHR Network Core.
   - Cache is in memory only and keyed by network.
========================================= */

"use strict";

const ALBUKHR_PROJECTS_TABLE = "projects";

/* ---------- Supabase client ---------- */
function getProjectsSupabaseClient(){
  if(typeof window.getAlbukhrSupabaseClient === "function"){
    const client = window.getAlbukhrSupabaseClient();
    if(client) return client;
  }

  if(window.albukhrSupabase){
    return window.albukhrSupabase;
  }

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

function resolveProjectsNetwork(network){
  const explicit = normalizeAlbukhrNetwork(network);
  if(explicit) return explicit;

  const resolvers = [
    "requireAlbukhrNetwork",
    "getAlbukhrNetwork",
    "getAlbukhrCurrentNetwork",
    "getCurrentAlbukhrNetwork"
  ];

  for(const name of resolvers){
    try{
      if(typeof window[name] === "function"){
        const resolved = normalizeAlbukhrNetwork(window[name]());

        if(resolved){
          return resolved;
        }
      }
    }catch(error){
      console.warn(`projects-engine: ${name}() failed:`, error);
    }
  }

  throw new Error(
    "ALBUKHR Network Core is unavailable. " +
    "Load environment-switcher.js before projects-engine.js."
  );
}

function getCurrentAlbukhrNetwork(){
  return resolveProjectsNetwork();
}

/*
 * Do not overwrite the canonical global network resolver.
 * Only expose a project-specific alias.
 */
window.getAlbukhrProjectsNetwork = getCurrentAlbukhrNetwork;

/* ---------- Cache ---------- */
const __albukhrProjectsCache = {
  mainnet: [],
  testnet: []
};

const __albukhrProjectsLoaded = {
  mainnet: false,
  testnet: false
};

const __albukhrProjectsLoading = {
  mainnet: null,
  testnet: null
};

const __albukhrProjectsLastLoadedAt = {
  mainnet: null,
  testnet: null
};

const __albukhrProjectsLastSource = {
  mainnet: "none",
  testnet: "none"
};

const __albukhrProjectsLastError = {
  mainnet: null,
  testnet: null
};

/* ---------- Helpers ---------- */
function safeNum(value, fallback = 0){
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeStr(value, fallback = ""){
  return value === null || value === undefined
    ? fallback
    : String(value);
}

function normalizeProjectType(type){
  const t = safeStr(type).trim().toLowerCase();

  if(t === "core" || t === "internal" || t === "external"){
    return t;
  }

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
    const arr = value
      .map(Number)
      .filter(v => Number.isFinite(v) && v > 0);

    return arr.length ? arr : [30,60,90];
  }

  if(typeof value === "string" && value.trim()){
    const arr = value
      .split(",")
      .map(v => Number(v.trim()))
      .filter(v => Number.isFinite(v) && v > 0);

    return arr.length ? arr : [30,60,90];
  }

  return [30,60,90];
}

function normalizeProjectRow(row = {}){
  const code = safeStr(
    row.project_code || row.code || row.slug
  ).trim();

  const name = safeStr(
    row.project_name || row.title || code || "Unnamed Project"
  ).trim();

  const network =
    normalizeAlbukhrNetwork(row.network);

  return {
    id: row.id ?? null,

    project_code: code,
    project_name: name,
    title: name,

    project_type: normalizeProjectType(row.project_type),
    network: network || "",

    status: normalizeProjectStatus(row.status),

    /*
     * Legacy field retained only for compatibility.
     * New UI should use logo_url/logo_path.
     */
    icon: safeStr(row.icon, ""),

    description: safeStr(
      row.description || row.desc,
      "ALBUKHR Project"
    ),

    info: safeStr(
      row.info,
      "Project information not available."
    ),

    min_liquidity: safeNum(
      row.min_liquidity,
      100
    ),

    reserve_percent: safeNum(
      row.reserve_percent,
      0.30
    ),

    /*
     * reward_rate is nullable in the verified project schema.
     * Do not invent a database value here.
     */
    reward_rate:
      row.reward_rate === null ||
      row.reward_rate === undefined ||
      row.reward_rate === ""
        ? null
        : safeNum(row.reward_rate, null),

    durations: normalizeDurations(row.durations),

    sort_order: safeNum(
      row.sort_order,
      9999
    ),

    project_visible:
      row.project_visible === false
        ? false
        : true,

    dashboard_enabled:
      row.dashboard_enabled === false
        ? false
        : true,

    transparency_enabled:
      row.transparency_enabled === false
        ? false
        : true,

    /*
     * Compatibility aliases.
     */
    is_visible:
      row.project_visible === false
        ? false
        : true,

    treasury_enabled:
      row.treasury_enabled === false
        ? false
        : true,

    staking_enabled:
      row.staking_enabled === false
        ? false
        : true,

    contributions_enabled:
      row.contributions_enabled === false
        ? false
        : true,

    /* Canonical project image metadata. */
    logo_url: safeStr(row.logo_url, ""),
    logo_path: safeStr(row.logo_path, ""),
    logo_mime_type: safeStr(row.logo_mime_type, ""),

    logo_size_bytes:
      row.logo_size_bytes == null
        ? null
        : safeNum(row.logo_size_bytes, null),

    logo_width:
      row.logo_width == null
        ? null
        : safeNum(row.logo_width, null),

    logo_height:
      row.logo_height == null
        ? null
        : safeNum(row.logo_height, null),

    cover_image:
      safeStr(row.logo_url, ""),

    created_at: row.created_at || null,
    updated_at: row.updated_at || null,

    raw: row
  };
}

function sortProjects(rows = []){
  return [...rows].sort((a,b) => {
    const aSort = safeNum(a.sort_order, 9999);
    const bSort = safeNum(b.sort_order, 9999);

    if(aSort !== bSort){
      return aSort - bSort;
    }

    return safeStr(a.project_name)
      .localeCompare(safeStr(b.project_name));
  });
}

/* ---------- Supabase fetch ---------- */
async function fetchProjectsFromSupabase(options = {}){
  const supabase = getProjectsSupabaseClient();

  if(!supabase){
    return {
      success:false,
      network:normalizeAlbukhrNetwork(options.network) || "",
      error:"Supabase core client not available"
    };
  }

  let network;

  try{
    network = resolveProjectsNetwork(options.network);
  }catch(error){
    return {
      success:false,
      network:"",
      error:error?.message || "ALBUKHR network is unavailable"
    };
  }

  try{
    const {data, error} = await supabase
      .from(ALBUKHR_PROJECTS_TABLE)
      .select("*")
      .eq("network", network)
      .order("project_name", {ascending:true});

    if(error){
      return {
        success:false,
        network,
        error:error.message || "Failed to load projects"
      };
    }

    const normalized = (data || [])
      .map(normalizeProjectRow)
      .filter(project =>
        project.project_code &&
        project.network === network
      );

    return {
      success:true,
      network,
      data:sortProjects(normalized)
    };

  }catch(error){
    return {
      success:false,
      network,
      error:error?.message || "Projects fetch failed"
    };
  }
}

/* ---------- Load ---------- */
async function loadProjects(forceRefresh = false, options = {}){
  const network = resolveProjectsNetwork(options.network);

  if(!forceRefresh && __albukhrProjectsLoaded[network]){
    return [...__albukhrProjectsCache[network]];
  }

  if(!forceRefresh && __albukhrProjectsLoading[network]){
    return await __albukhrProjectsLoading[network];
  }

  const request = (async () => {
    const remote = await fetchProjectsFromSupabase({network});

    if(remote.success && Array.isArray(remote.data)){
      __albukhrProjectsCache[network] = remote.data;
      __albukhrProjectsLoaded[network] = true;
      __albukhrProjectsLastLoadedAt[network] = Date.now();
      __albukhrProjectsLastSource[network] = "supabase";
      __albukhrProjectsLastError[network] = null;

      return [...__albukhrProjectsCache[network]];
    }

    /*
     * Never fall back to another network.
     * Never expose static project records as a substitute
     * for the canonical Supabase registry.
     */
    __albukhrProjectsCache[network] = [];
    __albukhrProjectsLoaded[network] = true;
    __albukhrProjectsLastLoadedAt[network] = Date.now();
    __albukhrProjectsLastSource[network] = "supabase-error";
    __albukhrProjectsLastError[network] =
      remote.error || "Project registry unavailable";

    console.error(
      `Projects engine: ${network} project registry unavailable.`,
      remote.error || "Unknown Supabase error"
    );

    return [];

  })();

  __albukhrProjectsLoading[network] = request;

  try{
    return await request;
  }finally{
    __albukhrProjectsLoading[network] = null;
  }
}

async function refreshProjectsCache(options = {}){
  return await loadProjects(true, options);
}

/* ---------- Collection ---------- */
async function getAllProjects(options = {}){
  const rows = await loadProjects(
    options.forceRefresh === true,
    options
  );

  let result = [...rows];

  if(options.visibleOnly){
    result = result.filter(
      p => p.project_visible !== false
    );
  }

  if(options.activeOnly){
    result = result.filter(
      p => p.status === "active"
    );
  }

  if(options.dashboardEnabledOnly){
    result = result.filter(
      p => p.dashboard_enabled !== false
    );
  }

  if(options.transparencyEnabledOnly){
    result = result.filter(
      p => p.transparency_enabled !== false
    );
  }

  if(options.treasuryEnabledOnly){
    result = result.filter(
      p => p.treasury_enabled !== false
    );
  }

  if(options.stakingEnabledOnly){
    result = result.filter(
      p => p.staking_enabled !== false
    );
  }

  if(options.contributionsEnabledOnly){
    result = result.filter(
      p => p.contributions_enabled !== false
    );
  }

  return result;
}

async function getProjects(options = {}){
  return await getAllProjects(options);
}

async function getActiveProjects(options = {}){
  return await getAllProjects({
    ...options,
    activeOnly:true
  });
}

/* ---------- Types ---------- */
async function getProjectsByType(projectType, options = {}){
  const type = normalizeProjectType(projectType);
  const rows = await getAllProjects(options);

  return rows.filter(
    p => p.project_type === type
  );
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
  if(!projectCode){
    return null;
  }

  const rows = await getAllProjects(options);
  const code = safeStr(projectCode)
    .trim()
    .toLowerCase();

  return rows.find(p =>
    safeStr(p.project_code)
      .trim()
      .toLowerCase() === code
  ) || null;
}

async function getProjectMeta(projectCode, options = {}){
  return await getProjectByCode(
    projectCode,
    options
  );
}

async function getProject(projectCode, options = {}){
  return await getProjectByCode(
    projectCode,
    options
  );
}

/* ---------- Field helpers ---------- */
async function getProjectTitle(projectCode, options = {}){
  const p = await getProjectByCode(
    projectCode,
    options
  );

  return p?.project_name ||
    projectCode ||
    "Unknown Project";
}

async function getProjectName(projectCode, options = {}){
  return await getProjectTitle(
    projectCode,
    options
  );
}

async function getProjectIcon(projectCode, options = {}){
  const p = await getProjectByCode(
    projectCode,
    options
  );

  return p?.icon || "";
}

async function getProjectLogo(projectCode, options = {}){
  const p = await getProjectByCode(
    projectCode,
    options
  );

  return {
    url:p?.logo_url || "",
    path:p?.logo_path || "",
    mime_type:p?.logo_mime_type || "",
    size_bytes:p?.logo_size_bytes ?? null,
    width:p?.logo_width ?? null,
    height:p?.logo_height ?? null
  };
}

async function getProjectLogoUrl(projectCode, options = {}){
  const logo = await getProjectLogo(
    projectCode,
    options
  );

  return logo.url || "";
}

async function getProjectDescription(projectCode, options = {}){
  const p = await getProjectByCode(
    projectCode,
    options
  );

  return p?.description ||
    "ALBUKHR Project";
}

async function getProjectInfo(projectCode, options = {}){
  const p = await getProjectByCode(
    projectCode,
    options
  );

  return p?.info ||
    "Project information not available.";
}

async function getProjectDurations(projectCode, options = {}){
  const p = await getProjectByCode(
    projectCode,
    options
  );

  return p?.durations || [30,60,90];
}

async function getProjectType(projectCode, options = {}){
  const p = await getProjectByCode(
    projectCode,
    options
  );

  return p?.project_type || null;
}

async function getProjectStatus(projectCode, options = {}){
  const p = await getProjectByCode(
    projectCode,
    options
  );

  return p?.status || null;
}

async function getProjectNetwork(projectCode, options = {}){
  const p = await getProjectByCode(
    projectCode,
    options
  );

  return p?.network || null;
}

async function projectExists(projectCode, options = {}){
  return !!(
    await getProjectByCode(
      projectCode,
      options
    )
  );
}

/* ---------- Flags ---------- */
async function isProjectActive(projectCode, options = {}){
  const p = await getProjectByCode(
    projectCode,
    options
  );

  return !!p && p.status === "active";
}

async function isProjectVisible(projectCode, options = {}){
  const p = await getProjectByCode(
    projectCode,
    options
  );

  return !!p &&
    p.project_visible !== false;
}

async function isProjectDashboardEnabled(projectCode, options = {}){
  const p = await getProjectByCode(
    projectCode,
    options
  );

  return !!p &&
    p.dashboard_enabled !== false;
}

async function isProjectTransparencyEnabled(projectCode, options = {}){
  const p = await getProjectByCode(
    projectCode,
    options
  );

  return !!p &&
    p.transparency_enabled !== false;
}

async function isCoreProject(projectCode, options = {}){
  const p = await getProjectByCode(
    projectCode,
    options
  );

  return !!p && p.project_type === "core";
}

async function isInternalProject(projectCode, options = {}){
  const p = await getProjectByCode(
    projectCode,
    options
  );

  return !!p && p.project_type === "internal";
}

async function isExternalProject(projectCode, options = {}){
  const p = await getProjectByCode(
    projectCode,
    options
  );

  return !!p && p.project_type === "external";
}

/* ---------- Compatibility flags ---------- */
async function isProjectTreasuryEnabled(projectCode, options = {}){
  const p = await getProjectByCode(
    projectCode,
    options
  );

  return !!p &&
    p.treasury_enabled !== false;
}

async function isProjectStakingEnabled(projectCode, options = {}){
  const p = await getProjectByCode(
    projectCode,
    options
  );

  return !!p &&
    p.staking_enabled !== false;
}

async function isProjectContributionsEnabled(projectCode, options = {}){
  const p = await getProjectByCode(
    projectCode,
    options
  );

  return !!p &&
    p.contributions_enabled !== false;
}

/* ---------- Rules ---------- */
async function getProjectRules(projectCode, options = {}){
  const p = await getProjectByCode(
    projectCode,
    options
  );

  if(!p){
    return null;
  }

  return {
    reserve_percent:safeNum(
      p.reserve_percent,
      0.30
    ),

    min_liquidity:safeNum(
      p.min_liquidity,
      100
    ),

    reward_rate:
      p.reward_rate == null
        ? null
        : safeNum(p.reward_rate, null)
  };
}

/* ---------- Cache/state ---------- */
function clearProjectsCache(options = {}){
  const explicit = normalizeAlbukhrNetwork(
    options.network
  );

  if(explicit){
    __albukhrProjectsCache[explicit] = [];
    __albukhrProjectsLoaded[explicit] = false;
    __albukhrProjectsLastLoadedAt[explicit] = null;
    __albukhrProjectsLastSource[explicit] = "none";
    __albukhrProjectsLastError[explicit] = null;
    return true;
  }

  for(const network of ["mainnet","testnet"]){
    __albukhrProjectsCache[network] = [];
    __albukhrProjectsLoaded[network] = false;
    __albukhrProjectsLastLoadedAt[network] = null;
    __albukhrProjectsLastSource[network] = "none";
    __albukhrProjectsLastError[network] = null;
  }

  return true;
}

function getProjectsEngineSummary(options = {}){
  let network;

  try{
    network = resolveProjectsNetwork(
      options.network
    );
  }catch(error){
    return {
      table:ALBUKHR_PROJECTS_TABLE,
      network:null,
      total:0,
      loaded:false,
      loading:false,
      source:"none",
      last_loaded_at:null,
      last_error:error?.message || "Network unavailable"
    };
  }

  return {
    table:ALBUKHR_PROJECTS_TABLE,
    network,
    total:__albukhrProjectsCache[network].length,
    loaded:__albukhrProjectsLoaded[network],
    loading:!!__albukhrProjectsLoading[network],
    last_loaded_at:
      __albukhrProjectsLastLoadedAt[network],
    source:
      __albukhrProjectsLastSource[network],
    last_error:
      __albukhrProjectsLastError[network]
  };
}

/* ---------- Global exports ---------- */
window.loadProjects = loadProjects;
window.refreshProjectsCache = refreshProjectsCache;
window.fetchProjectsFromSupabase = fetchProjectsFromSupabase;

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
window.clearProjectsCache = clearProjectsCache;
window.getProjectsEngineSummary = getProjectsEngineSummary;

/* ---------- Preload ---------- */
window.addEventListener("DOMContentLoaded", () => {
  try{
    loadProjects().catch(error => {
      console.warn(
        "Projects preload warning:",
        error
      );
    });
  }catch(error){
    console.warn(
      "Projects preload skipped:",
      error
    );
  }
});
