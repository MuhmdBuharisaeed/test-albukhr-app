/* =========================================
   ALBUKHR PROJECTS ENGINE v1
   Supabase-first Project Registry
========================================= */

/*
  Wannan file shi ne single source of truth
  na project metadata a ALBUKHR.

  Yana aiki da:
  - projects table a Supabase
  - smart-liquidity-engine.js
  - project-treasury.js
  - future contributor / staking engines

  PROJECT TYPES:
  - core
  - internal
  - external
*/

/* =========================================
   SUPABASE CLIENT RESOLUTION
========================================= */
function getProjectsSupabaseClient(){

  if(window.supabaseClient){
    return window.supabaseClient;
  }

  if(window.supabase){
    try{
      // idan akwai global keys a wani file
      if(window.SUPABASE_URL && window.SUPABASE_KEY){
        return window.supabase.createClient(
          window.SUPABASE_URL,
          window.SUPABASE_KEY
        );
      }
    }catch(e){
      console.warn("Supabase client creation failed:", e);
    }
  }

  return null;
}

/* =========================================
   FALLBACK LOCAL CONFIG
   - idan Supabase bai dawo ba
========================================= */
const ALBUKHR_PROJECTS_FALLBACK = [
  {
    project_code: "Azman",
    project_name: "Azman Futures Makers Lab",
    project_type: "core",
    status: "active",
    icon: "🧪",
    description:
      "Long-term science, technology, and innovation project focused on future invention and engineering.",
    info:
      "Azman supports research labs, prototyping, and advanced engineering capacity building.",
    durations: [180, 365, 430],
    reserve_percent: 0.30,
    min_liquidity: 100,
    reward_rate: 0.02,
    sort_order: 1,
    is_visible: true
  },
  {
    project_code: "Labbaika",
    project_name: "Labbaika Bakery Center",
    project_type: "core",
    status: "active",
    icon: "🍞",
    description:
      "Food production project focused on modern bread and flour processing.",
    info:
      "Labbaika enables scalable bakery production within the ALBUKHR ecosystem.",
    durations: [30, 60, 90],
    reserve_percent: 0.30,
    min_liquidity: 100,
    reward_rate: 0.02,
    sort_order: 2,
    is_visible: true
  },
  {
    project_code: "Barsh",
    project_name: "Barsh Agro & Livestock",
    project_type: "core",
    status: "active",
    icon: "🌾",
    description:
      "Mechanized farming and livestock project for large-scale agricultural production.",
    info:
      "Barsh integrates modern farming, livestock, and sustainable agriculture systems.",
    durations: [30, 60, 90],
    reserve_percent: 0.30,
    min_liquidity: 100,
    reward_rate: 0.02,
    sort_order: 3,
    is_visible: true
  },
  {
    project_code: "Urban",
    project_name: "Urban Mobility System",
    project_type: "core",
    status: "active",
    icon: "🚍",
    description:
      "Infrastructure project focused on modern transportation of people and goods.",
    info:
      "Urban improves accessibility and builds sustainable mobility networks.",
    durations: [30, 60, 90],
    reserve_percent: 0.30,
    min_liquidity: 100,
    reward_rate: 0.02,
    sort_order: 4,
    is_visible: true
  },
  {
    project_code: "Khairat",
    project_name: "Khairat Fertiliser",
    project_type: "core",
    status: "active",
    icon: "♻️",
    description:
      "Agricultural supply project improving fertiliser access and farm productivity.",
    info:
      "Khairat supports transparent distribution systems and sustainable farming inputs.",
    durations: [30, 60, 90],
    reserve_percent: 0.30,
    min_liquidity: 100,
    reward_rate: 0.02,
    sort_order: 5,
    is_visible: true
  },
  {
    project_code: "Hauwal",
    project_name: "Hauwal Maize Processing",
    project_type: "core",
    status: "active",
    icon: "🌽",
    description:
      "Agro-processing project modernizing maize milling into scalable production.",
    info:
      "Hauwal focuses on clean processing, packaging, and food system efficiency.",
    durations: [30, 60, 90],
    reserve_percent: 0.30,
    min_liquidity: 100,
    reward_rate: 0.02,
    sort_order: 6,
    is_visible: true
  },
  {
    project_code: "Raheem",
    project_name: "Raheem Pharmacy",
    project_type: "core",
    status: "active",
    icon: "💊",
    description:
      "Healthcare project improving access to essential medicines.",
    info:
      "Raheem provides transparent, community-driven pharmaceutical distribution.",
    durations: [30, 60, 90],
    reserve_percent: 0.30,
    min_liquidity: 100,
    reward_rate: 0.02,
    sort_order: 7,
    is_visible: true
  }
];

/* =========================================
   CACHE STATE
========================================= */
let __albukhrProjectsCache = [];
let __albukhrProjectsLoaded = false;
let __albukhrProjectsLoading = false;
let __albukhrProjectsLastLoadedAt = null;

/* =========================================
   HELPERS
========================================= */
function safeNum(value, fallback = 0){
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeProjectType(type){
  const t = String(type || "").trim().toLowerCase();

  if(t === "core") return "core";
  if(t === "internal") return "internal";
  if(t === "external") return "external";

  return "core";
}

function normalizeProjectStatus(status){
  const s = String(status || "").trim().toLowerCase();

  if(s === "active") return "active";
  if(s === "inactive") return "inactive";
  if(s === "archived") return "archived";
  if(s === "disabled") return "inactive";

  return "active";
}

function normalizeDurations(value){

  if(Array.isArray(value)){
    return value
      .map(v => Number(v))
      .filter(v => Number.isFinite(v) && v > 0);
  }

  // idan text ne kamar "30,60,90"
  if(typeof value === "string" && value.trim()){
    return value
      .split(",")
      .map(v => Number(v.trim()))
      .filter(v => Number.isFinite(v) && v > 0);
  }

  return [30, 60, 90];
}

function normalizeProjectRow(row = {}){

  const code =
    String(
      row.project_code ||
      row.code ||
      row.slug ||
      ""
    ).trim();

  const name =
    String(
      row.project_name ||
      row.title ||
      code ||
      "Unnamed Project"
    ).trim();

  return {
    id: row.id ?? null,
    project_code: code,
    project_name: name,
    title: name,

    project_type:
      normalizeProjectType(
        row.project_type
      ),

    status:
      normalizeProjectStatus(
        row.status
      ),

    icon:
      String(row.icon || "📦"),

    description:
      String(
        row.description ||
        row.desc ||
        "Albukhr Project"
      ),

    info:
      String(
        row.info ||
        "Project information not available."
      ),

    durations:
      normalizeDurations(
        row.durations
      ),

    reserve_percent:
      safeNum(row.reserve_percent, 0.30),

    min_liquidity:
      safeNum(row.min_liquidity, 100),

    reward_rate:
      safeNum(row.reward_rate, 0.02),

    sort_order:
      safeNum(row.sort_order, 9999),

    is_visible:
      row.is_visible === false
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

    cover_image:
      row.cover_image || "",

    created_at:
      row.created_at || null,

    raw: row
  };

}

/* =========================================
   SORT PROJECTS
========================================= */
function sortProjects(rows = []){

  return [...rows].sort((a, b) => {

    const aSort = safeNum(a.sort_order, 9999);
    const bSort = safeNum(b.sort_order, 9999);

    if(aSort !== bSort){
      return aSort - bSort;
    }

    return String(a.project_name || "")
      .localeCompare(String(b.project_name || ""));
  });

}

/* =========================================
   LOAD PROJECTS FROM SUPABASE
========================================= */
async function fetchProjectsFromSupabase(){

  const supabase = getProjectsSupabaseClient();

  if(!supabase){
    return {
      success:false,
      error:"Supabase client not available"
    };
  }

  try{

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("sort_order", { ascending:true })
      .order("project_name", { ascending:true });

    if(error){
      return {
        success:false,
        error:error.message || "Failed to load projects"
      };
    }

    const normalized =
      (data || [])
      .map(normalizeProjectRow)
      .filter(p => p.project_code);

    return {
      success:true,
      data: sortProjects(normalized)
    };

  }catch(e){
    return {
      success:false,
      error:e?.message || "Projects fetch failed"
    };
  }

}

/* =========================================
   LOAD PROJECTS (SUPABASE FIRST)
========================================= */
async function loadProjects(forceRefresh = false){

  if(__albukhrProjectsLoaded && !forceRefresh){
    return __albukhrProjectsCache;
  }

  if(__albukhrProjectsLoading && !forceRefresh){
    return __albukhrProjectsCache;
  }

  __albukhrProjectsLoading = true;

  const remote = await fetchProjectsFromSupabase();

  if(remote.success && Array.isArray(remote.data) && remote.data.length){

    __albukhrProjectsCache = remote.data;
    __albukhrProjectsLoaded = true;
    __albukhrProjectsLoading = false;
    __albukhrProjectsLastLoadedAt = Date.now();

    return __albukhrProjectsCache;
  }

  // fallback
  const fallbackRows =
    ALBUKHR_PROJECTS_FALLBACK
      .map(normalizeProjectRow);

  __albukhrProjectsCache =
    sortProjects(fallbackRows);

  __albukhrProjectsLoaded = true;
  __albukhrProjectsLoading = false;
  __albukhrProjectsLastLoadedAt = Date.now();

  console.warn(
    "Projects engine fallback in use:",
    remote.error || "Supabase unavailable"
  );

  return __albukhrProjectsCache;

}

/* =========================================
   FORCE REFRESH CACHE
========================================= */
async function refreshProjectsCache(){
  return await loadProjects(true);
}

/* =========================================
   GET ALL PROJECTS
========================================= */
async function getAllProjects(options = {}){

  const rows = await loadProjects(
    !!options.forceRefresh
  );

  let result = [...rows];

  if(options.visibleOnly){
    result = result.filter(p => p.is_visible !== false);
  }

  if(options.activeOnly){
    result = result.filter(p => p.status === "active");
  }

  return result;
}

/* =========================================
   GET ACTIVE PROJECTS
========================================= */
async function getActiveProjects(options = {}){
  return await getAllProjects({
    ...options,
    activeOnly:true
  });
}

/* =========================================
   GET PROJECTS BY TYPE
========================================= */
async function getProjectsByType(projectType, options = {}){

  const type =
    normalizeProjectType(projectType);

  const rows =
    await getAllProjects(options);

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

/* =========================================
   GROUP PROJECTS BY TYPE
========================================= */
async function groupProjectsByType(options = {}){

  const rows =
    await getAllProjects(options);

  return {
    core:
      rows.filter(p => p.project_type === "core"),
    internal:
      rows.filter(p => p.project_type === "internal"),
    external:
      rows.filter(p => p.project_type === "external")
  };

}

/* =========================================
   FIND PROJECT
========================================= */
async function getProjectByCode(projectCode){

  if(!projectCode) return null;

  const rows = await getAllProjects();

  const code =
    String(projectCode).trim().toLowerCase();

  return rows.find(p => {
    return String(p.project_code)
      .trim()
      .toLowerCase() === code;
  }) || null;

}

/* alias mai sauki */
async function getProjectMeta(projectCode){
  return await getProjectByCode(projectCode);
}

/* =========================================
   QUICK FIELD HELPERS
========================================= */
async function getProjectTitle(projectCode){
  const p = await getProjectByCode(projectCode);
  return p?.project_name || projectCode || "Unknown Project";
}

async function getProjectIcon(projectCode){
  const p = await getProjectByCode(projectCode);
  return p?.icon || "📦";
}

async function getProjectDescription(projectCode){
  const p = await getProjectByCode(projectCode);
  return p?.description || "Albukhr Project";
}

async function getProjectInfo(projectCode){
  const p = await getProjectByCode(projectCode);
  return p?.info || "Project information not available.";
}

async function getProjectDurations(projectCode){
  const p = await getProjectByCode(projectCode);
  return p?.durations || [30, 60, 90];
}

async function getProjectType(projectCode){
  const p = await getProjectByCode(projectCode);
  return p?.project_type || null;
}

async function getProjectStatus(projectCode){
  const p = await getProjectByCode(projectCode);
  return p?.status || null;
}

async function projectExists(projectCode){
  const p = await getProjectByCode(projectCode);
  return !!p;
}

/* =========================================
   CHECK PROJECT FLAGS
========================================= */
async function isProjectActive(projectCode){
  const p = await getProjectByCode(projectCode);
  return !!p && p.status === "active";
}

async function isProjectVisible(projectCode){
  const p = await getProjectByCode(projectCode);
  return !!p && p.is_visible !== false;
}

async function isCoreProject(projectCode){
  const p = await getProjectByCode(projectCode);
  return !!p && p.project_type === "core";
}

async function isInternalProject(projectCode){
  const p = await getProjectByCode(projectCode);
  return !!p && p.project_type === "internal";
}

async function isExternalProject(projectCode){
  const p = await getProjectByCode(projectCode);
  return !!p && p.project_type === "external";
}

/* =========================================
   GET PROJECT RULES
   - liquidity engine zai iya amfani da shi
========================================= */
async function getProjectRules(projectCode){

  const p = await getProjectByCode(projectCode);

  if(!p){
    return {
      reserve_percent: 0.30,
      min_liquidity: 100,
      reward_rate: 0.02
    };
  }

  return {
    reserve_percent: safeNum(p.reserve_percent, 0.30),
    min_liquidity: safeNum(p.min_liquidity, 100),
    reward_rate: safeNum(p.reward_rate, 0.02)
  };

}

/* =========================================
   ADMIN / DEBUG SUMMARY
========================================= */
async function getProjectsEngineSummary(){

  const all = await getAllProjects();
  const grouped = await groupProjectsByType();

  return {
    total: all.length,
    core: grouped.core.length,
    internal: grouped.internal.length,
    external: grouped.external.length,
    loaded: __albukhrProjectsLoaded,
    last_loaded_at: __albukhrProjectsLastLoadedAt,
    source:
      all.length &&
      !ALBUKHR_PROJECTS_FALLBACK.some(f => f.project_code === all[0]?.project_code)
        ? "supabase_or_fallback"
        : "fallback_or_supabase"
  };

}

/* =========================================
   PRELOAD ON PAGE LOAD (OPTIONAL)
========================================= */
window.addEventListener("DOMContentLoaded", ()=>{
  loadProjects().catch(err=>{
    console.warn("Projects preload warning:", err);
  });
});
