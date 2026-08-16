/* =========================================
   ALBUKHR PROJECTS ENGINE v3
   NETWORK-AWARE SUPABASE PROJECT REGISTRY
========================================= */

/*
  SINGLE SOURCE OF TRUTH:
  - Supabase projects table

  NETWORK ISOLATION:
  - mainnet => projects.network = "mainnet"
  - testnet => projects.network = "testnet"

  IMPORTANT:
  This engine does NOT use localStorage.
  Project cache is memory-only and is never persisted.

  DEPENDS ON:
  - supabase-core.js
  - ALBUKHR network/environment resolver
*/

/* =========================================
   TABLE CONFIG
========================================= */

const ALBUKHR_PROJECTS_TABLE = "projects";


/* =========================================
   NETWORK RESOLUTION
   =========================================
   We support the shared network resolver if one
   exists. Otherwise we resolve from the official
   ALBUKHR hostname so this file remains safe
   during the migration.
========================================= */

function getProjectsNetwork(){

  if(
    typeof window.requireAlbukhrNetwork ===
    "function"
  ){

    return window.requireAlbukhrNetwork();

  }

  if(
    typeof window.getAlbukhrNetwork ===
    "function"
  ){

    const network =
      window.getAlbukhrNetwork();

    if(
      network === "mainnet" ||
      network === "testnet"
    ){

      return network;

    }

  }

  const hostname =
    String(
      window.location.hostname || ""
    ).toLowerCase();

  if(
    hostname === "test.albukhr.com" ||
    hostname.startsWith("test.")
  ){

    return "testnet";

  }

  if(
    hostname === "app.albukhr.com" ||
    hostname.startsWith("app.")
  ){

    return "mainnet";

  }

  /*
    Development/local fallback.

    This matches the existing ALBUKHR
    environment convention: local defaults
    to mainnet unless explicitly hosted on test.
  */

  return "mainnet";

}


/* =========================================
   SUPABASE CLIENT
========================================= */

function getProjectsSupabaseClient(){

  if(
    typeof window.getAlbukhrSupabaseClient ===
    "function"
  ){

    const client =
      window.getAlbukhrSupabaseClient();

    if(client){

      return client;

    }

  }

  if(window.albukhrSupabase){

    return window.albukhrSupabase;

  }

  console.warn(
    "projects-engine: ALBUKHR Supabase Core client not found."
  );

  return null;

}


/* =========================================
   FALLBACK PROJECT METADATA
========================================= */

const ALBUKHR_PROJECTS_FALLBACK = [

  {
    project_code:"Azman",
    project_name:"Azman Futures Makers Lab",
    project_type:"core",
    status:"active",
    icon:"🧪",
    description:
      "Long-term science, technology, and innovation project focused on future invention and engineering.",
    info:
      "Azman supports research labs, prototyping, and advanced engineering capacity building.",
    durations:[180,365,430],
    reserve_percent:0.30,
    min_liquidity:100,
    reward_rate:0.02,
    sort_order:1,
    is_visible:true,
    treasury_enabled:true,
    staking_enabled:true,
    contributions_enabled:true
  },

  {
    project_code:"Labbaika",
    project_name:"Labbaika Bakery Center",
    project_type:"core",
    status:"active",
    icon:"🍞",
    description:
      "Food production project focused on modern bread and flour processing.",
    info:
      "Labbaika enables scalable bakery production within the ALBUKHR ecosystem.",
    durations:[30,60,90],
    reserve_percent:0.30,
    min_liquidity:100,
    reward_rate:0.02,
    sort_order:2,
    is_visible:true,
    treasury_enabled:true,
    staking_enabled:true,
    contributions_enabled:true
  },

  {
    project_code:"Barsh",
    project_name:"Barsh Agro & Livestock",
    project_type:"core",
    status:"active",
    icon:"🌾",
    description:
      "Mechanized farming and livestock project for large-scale agricultural production.",
    info:
      "Barsh integrates modern farming, livestock, and sustainable agriculture systems.",
    durations:[30,60,90],
    reserve_percent:0.30,
    min_liquidity:100,
    reward_rate:0.02,
    sort_order:3,
    is_visible:true,
    treasury_enabled:true,
    staking_enabled:true,
    contributions_enabled:true
  },

  {
    project_code:"Urban",
    project_name:"Urban Mobility System",
    project_type:"core",
    status:"active",
    icon:"🚍",
    description:
      "Infrastructure project focused on modern transportation of people and goods.",
    info:
      "Urban improves accessibility and builds sustainable mobility networks.",
    durations:[30,60,90],
    reserve_percent:0.30,
    min_liquidity:100,
    reward_rate:0.02,
    sort_order:4,
    is_visible:true,
    treasury_enabled:true,
    staking_enabled:true,
    contributions_enabled:true
  },

  {
    project_code:"Khairat",
    project_name:"Khairat Fertiliser",
    project_type:"core",
    status:"active",
    icon:"♻️",
    description:
      "Agricultural supply project improving fertiliser access and farm productivity.",
    info:
      "Khairat supports transparent distribution systems and sustainable farming inputs.",
    durations:[30,60,90],
    reserve_percent:0.30,
    min_liquidity:100,
    reward_rate:0.02,
    sort_order:5,
    is_visible:true,
    treasury_enabled:true,
    staking_enabled:true,
    contributions_enabled:true
  },

  {
    project_code:"Hauwal",
    project_name:"Hauwal Maize Processing",
    project_type:"core",
    status:"active",
    icon:"🌽",
    description:
      "Agro-processing project modernizing maize milling into scalable production.",
    info:
      "Hauwal focuses on clean processing, packaging, and food system efficiency.",
    durations:[30,60,90],
    reserve_percent:0.30,
    min_liquidity:100,
    reward_rate:0.02,
    sort_order:6,
    is_visible:true,
    treasury_enabled:true,
    staking_enabled:true,
    contributions_enabled:true
  },

  {
    project_code:"Raheem",
    project_name:"Raheem Pharmacy",
    project_type:"core",
    status:"active",
    icon:"💊",
    description:
      "Healthcare project improving access to essential medicines.",
    info:
      "Raheem provides transparent, community-driven pharmaceutical distribution.",
    durations:[30,60,90],
    reserve_percent:0.30,
    min_liquidity:100,
    reward_rate:0.02,
    sort_order:7,
    is_visible:true,
    treasury_enabled:true,
    staking_enabled:true,
    contributions_enabled:true
  }

];


/* =========================================
   CACHE STATE
   ========================================= */

let __albukhrProjectsCache = [];

let __albukhrProjectsLoaded = false;

let __albukhrProjectsLoading = false;

let __albukhrProjectsLastLoadedAt = null;

let __albukhrProjectsLastSource = "none";

let __albukhrProjectsLastNetwork = null;


/* =========================================
   HELPERS
========================================= */

function safeNum(
  value,
  fallback=0
){

  const n =
    Number(value);

  return Number.isFinite(n)
    ? n
    : fallback;

}


function safeStr(
  value,
  fallback=""
){

  if(
    value === null ||
    value === undefined
  ){

    return fallback;

  }

  return String(value);

}


function normalizeProjectType(
  type
){

  const t =
    safeStr(type)
      .trim()
      .toLowerCase();

  if(t === "core"){

    return "core";

  }

  if(t === "internal"){

    return "internal";

  }

  if(t === "external"){

    return "external";

  }

  return "core";

}


function normalizeProjectStatus(
  status
){

  const s =
    safeStr(status)
      .trim()
      .toLowerCase();

  if(s === "active"){

    return "active";

  }

  if(s === "inactive"){

    return "inactive";

  }

  if(s === "archived"){

    return "archived";

  }

  if(s === "disabled"){

    return "inactive";

  }

  return "active";

}


function normalizeDurations(
  value
){

  if(
    Array.isArray(value)
  ){

    const arr =
      value
        .map(
          v => Number(v)
        )
        .filter(
          v =>
            Number.isFinite(v) &&
            v > 0
        );

    return arr.length
      ? arr
      : [30,60,90];

  }

  if(
    typeof value === "string" &&
    value.trim()
  ){

    const arr =
      value
        .split(",")
        .map(
          v => Number(v.trim())
        )
        .filter(
          v =>
            Number.isFinite(v) &&
            v > 0
        );

    return arr.length
      ? arr
      : [30,60,90];

  }

  return [30,60,90];

}


function normalizeProjectRow(
  row={}
){

  const code =
    safeStr(
      row.project_code ||
      row.code ||
      row.slug ||
      ""
    ).trim();

  const name =
    safeStr(
      row.project_name ||
      row.title ||
      code ||
      "Unnamed Project"
    ).trim();

  return {

    id:
      row.id ??
      null,

    project_code:
      code,

    project_name:
      name,

    title:
      name,

    project_type:
      normalizeProjectType(
        row.project_type
      ),

    status:
      normalizeProjectStatus(
        row.status
      ),

    icon:
      safeStr(
        row.icon,
        "📦"
      ),

    description:
      safeStr(
        row.description ||
        row.desc,
        "Albukhr Project"
      ),

    info:
      safeStr(
        row.info,
        "Project information not available."
      ),

    durations:
      normalizeDurations(
        row.durations
      ),

    reserve_percent:
      safeNum(
        row.reserve_percent,
        0.30
      ),

    min_liquidity:
      safeNum(
        row.min_liquidity,
        100
      ),

    reward_rate:
      safeNum(
        row.reward_rate,
        0.02
      ),

    sort_order:
      safeNum(
        row.sort_order,
        9999
      ),

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
      safeStr(
        row.cover_image,
        ""
      ),

    created_at:
      row.created_at ||
      null,

    updated_at:
      row.updated_at ||
      null,

    network:
      safeStr(
        row.network,
        getProjectsNetwork()
      ),

    raw:
      row

  };

}


/* =========================================
   SORT PROJECTS
========================================= */

function sortProjects(
  rows=[]
){

  return [
    ...rows
  ].sort(
    (a,b)=>{

      const aSort =
        safeNum(
          a.sort_order,
          9999
        );

      const bSort =
        safeNum(
          b.sort_order,
          9999
        );

      if(
        aSort !== bSort
      ){

        return aSort -
               bSort;

      }

      return safeStr(
        a.project_name
      ).localeCompare(
        safeStr(
          b.project_name
        )
      );

    }
  );

}


/* =========================================
   FETCH PROJECTS FROM SUPABASE
========================================= */

async function fetchProjectsFromSupabase(){

  const network =
    getProjectsNetwork();

  const supabase =
    getProjectsSupabaseClient();

  if(!supabase){

    return {

      success:false,

      network,

      error:
        "Supabase core client not available"

    };

  }

  try{

    const {
      data,
      error
    } =
      await supabase

        .from(
          ALBUKHR_PROJECTS_TABLE
        )

        .select("*")

        /*
          CRITICAL NETWORK ISOLATION
        */

        .eq(
          "network",
          network
        )

        .order(
          "sort_order",
          {
            ascending:true
          }
        )

        .order(
          "project_name",
          {
            ascending:true
          }
        );

    if(error){

      return {

        success:false,

        network,

        error:
          error.message ||
          "Failed to load projects"

      };

    }

    const normalized =
      (
        data ||
        []
      )
        .map(
          normalizeProjectRow
        )
        /*
          Defensive second filter.
          Even if an unexpected row enters
          the response, never expose it.
        */
        .filter(
          p =>
            p.project_code &&
            p.network === network
        );

    return {

      success:true,

      network,

      data:
        sortProjects(
          normalized
        )

    };

  }catch(e){

    return {

      success:false,

      network,

      error:
        e?.message ||
        "Projects fetch failed"

    };

  }

}


/* =========================================
   NETWORK-SAFE FALLBACK
========================================= */

function getProjectsFallbackForNetwork(
  network
){

  return (
    ALBUKHR_PROJECTS_FALLBACK
      .map(
        row => ({
          ...row,
          network
        })
      )
      .map(
        normalizeProjectRow
      )
  );

}


/* =========================================
   LOAD PROJECTS
   SUPABASE FIRST
========================================= */

async function loadProjects(
  forceRefresh=false
){

  const network =
    getProjectsNetwork();

  /*
    Never reuse an in-memory cache belonging
    to another network.
  */

  if(
    __albukhrProjectsLastNetwork !==
    network
  ){

    __albukhrProjectsCache = [];

    __albukhrProjectsLoaded = false;

    __albukhrProjectsLoading = false;

    __albukhrProjectsLastNetwork =
      network;

  }

  if(
    __albukhrProjectsLoaded &&
    !forceRefresh
  ){

    return [
      ...__albukhrProjectsCache
    ];

  }

  if(
    __albukhrProjectsLoading &&
    !forceRefresh
  ){

    return [
      ...__albukhrProjectsCache
    ];

  }

  __albukhrProjectsLoading = true;

  const remote =
    await fetchProjectsFromSupabase();

  if(
    remote.success &&
    Array.isArray(
      remote.data
    ) &&
    remote.data.length
  ){

    __albukhrProjectsCache =
      remote.data;

    __albukhrProjectsLoaded =
      true;

    __albukhrProjectsLoading =
      false;

    __albukhrProjectsLastLoadedAt =
      Date.now();

    __albukhrProjectsLastSource =
      "supabase";

    __albukhrProjectsLastNetwork =
      network;

    return [
      ...__albukhrProjectsCache
    ];

  }

  /*
    IMPORTANT:
    This fallback is memory-only.
    It is NOT localStorage and is never
    written to Supabase.
  */

  const fallbackRows =
    getProjectsFallbackForNetwork(
      network
    );

  __albukhrProjectsCache =
    sortProjects(
      fallbackRows
    );

  __albukhrProjectsLoaded =
    true;

  __albukhrProjectsLoading =
    false;

  __albukhrProjectsLastLoadedAt =
    Date.now();

  __albukhrProjectsLastSource =
    "fallback";

  __albukhrProjectsLastNetwork =
    network;

  console.warn(
    "Projects engine fallback in use:",
    remote.error ||
    "Supabase returned no projects",
    "network:",
    network
  );

  return [
    ...__albukhrProjectsCache
  ];

}


/* =========================================
   REFRESH CACHE
========================================= */

async function refreshProjectsCache(){

  return await loadProjects(
    true
  );

}


/* =========================================
   GET ALL PROJECTS
========================================= */

async function getAllProjects(
  options={}
){

  const rows =
    await loadProjects(
      !!options.forceRefresh
    );

  let result =
    [
      ...rows
    ];

  if(
    options.visibleOnly
  ){

    result =
      result.filter(
        p =>
          p.is_visible !== false
      );

  }

  if(
    options.activeOnly
  ){

    result =
      result.filter(
        p =>
          p.status ===
          "active"
      );

  }

  if(
    options.treasuryEnabledOnly
  ){

    result =
      result.filter(
        p =>
          p.treasury_enabled !==
          false
      );

  }

  if(
    options.stakingEnabledOnly
  ){

    result =
      result.filter(
        p =>
          p.staking_enabled !==
          false
      );

  }

  if(
    options.contributionsEnabledOnly
  ){

    result =
      result.filter(
        p =>
          p.contributions_enabled !==
          false
      );

  }

  /*
    Final defensive network filter.
  */

  const network =
    getProjectsNetwork();

  return result.filter(
    p =>
      p.network ===
      network
  );

}


/* =========================================
   LEGACY ALIASES
========================================= */

async function getProjects(
  options={}
){

  return await getAllProjects(
    options
  );

}


async function getActiveProjects(
  options={}
){

  return await getAllProjects({

    ...options,

    activeOnly:true

  });

}


/* =========================================
   GET PROJECTS BY TYPE
========================================= */

async function getProjectsByType(
  projectType,
  options={}
){

  const type =
    normalizeProjectType(
      projectType
    );

  const rows =
    await getAllProjects(
      options
    );

  return rows.filter(
    p =>
      p.project_type ===
      type
  );

}


async function getCoreProjects(
  options={}
){

  return await getProjectsByType(
    "core",
    options
  );

}


async function getInternalProjects(
  options={}
){

  return await getProjectsByType(
    "internal",
    options
  );

}


async function getExternalProjects(
  options={}
){

  return await getProjectsByType(
    "external",
    options
  );

}


/* =========================================
   GROUP PROJECTS BY TYPE
========================================= */

async function groupProjectsByType(
  options={}
){

  const rows =
    await getAllProjects(
      options
    );

  return {

    network:
      getProjectsNetwork(),

    core:
      rows.filter(
        p =>
          p.project_type ===
          "core"
      ),

    internal:
      rows.filter(
        p =>
          p.project_type ===
          "internal"
      ),

    external:
      rows.filter(
        p =>
          p.project_type ===
          "external"
      )

  };

}


/* =========================================
   FIND PROJECT
========================================= */

async function getProjectByCode(
  projectCode
){

  if(!projectCode){

    return null;

  }

  const rows =
    await getAllProjects();

  const code =
    safeStr(
      projectCode
    )
      .trim()
      .toLowerCase();

  return (
    rows.find(
      p =>
        safeStr(
          p.project_code
        )
          .trim()
          .toLowerCase() ===
        code
    ) ||
    null
  );

}


/* =========================================
   ALIASES
========================================= */

async function getProjectMeta(
  projectCode
){

  return await getProjectByCode(
    projectCode
  );

}


async function getProject(
  projectCode
){

  return await getProjectByCode(
    projectCode
  );

}


/* =========================================
   QUICK FIELD HELPERS
========================================= */

async function getProjectTitle(
  projectCode
){

  const p =
    await getProjectByCode(
      projectCode
    );

  return (
    p?.project_name ||
    projectCode ||
    "Unknown Project"
  );

}


async function getProjectName(
  projectCode
){

  return await getProjectTitle(
    projectCode
  );

}


async function getProjectIcon(
  projectCode
){

  const p =
    await getProjectByCode(
      projectCode
    );

  return p?.icon ||
    "📦";

}


async function getProjectDescription(
  projectCode
){

  const p =
    await getProjectByCode(
      projectCode
    );

  return (
    p?.description ||
    "Albukhr Project"
  );

}


async function getProjectInfo(
  projectCode
){

  const p =
    await getProjectByCode(
      projectCode
    );

  return (
    p?.info ||
    "Project information not available."
  );

}


async function getProjectDurations(
  projectCode
){

  const p =
    await getProjectByCode(
      projectCode
    );

  return (
    p?.durations ||
    [30,60,90]
  );

}


async function getProjectType(
  projectCode
){

  const p =
    await getProjectByCode(
      projectCode
    );

  return p?.project_type ||
    null;

}


async function getProjectStatus(
  projectCode
){

  const p =
    await getProjectByCode(
      projectCode
    );

  return p?.status ||
    null;

}


async function projectExists(
  projectCode
){

  const p =
    await getProjectByCode(
      projectCode
    );

  return !!p;

}


/* =========================================
   NETWORK HELPER
========================================= */

function getCurrentProjectsNetwork(){

  return getProjectsNetwork();

}


/* =========================================
   CHECK PROJECT FLAGS
========================================= */

async function isProjectActive(
  projectCode
){

  const p =
    await getProjectByCode(
      projectCode
    );

  return (
    !!p &&
    p.status ===
    "active"
  );

}


async function isProjectVisible(
  projectCode
){

  const p =
    await getProjectByCode(
      projectCode
    );

  return (
    !!p &&
    p.is_visible !==
    false
  );

}


async function isCoreProject(
  projectCode
){

  const p =
    await getProjectByCode(
      projectCode
    );

  return (
    !!p &&
    p.project_type ===
    "core"
  );

}


async function isInternalProject(
  projectCode
){

  const p =
    await getProjectByCode(
      projectCode
    );

  return (
    !!p &&
    p.project_type ===
    "internal"
  );

}


async function isExternalProject(
  projectCode
){

  const p =
    await getProjectByCode(
      projectCode
    );

  return (
    !!p &&
    p.project_type ===
    "external"
  );

}


async function isProjectTreasuryEnabled(
  projectCode
){

  const p =
    await getProjectByCode(
      projectCode
    );

  return (
    !!p &&
    p.treasury_enabled !==
    false
  );

}


async function isProjectStakingEnabled(
  projectCode
){

  const p =
    await getProjectByCode(
      projectCode
    );

  return (
    !!p &&
    p.staking_enabled !==
    false
  );

}


async function isProjectContributionsEnabled(
  projectCode
){

  const p =
    await getProjectByCode(
      projectCode
    );

  return (
    !!p &&
    p.contributions_enabled !==
    false
  );

}


/* =========================================
   GET PROJECT RULES
========================================= */

async function getProjectRules(
  projectCode
){

  const p =
    await getProjectByCode(
      projectCode
    );

  if(!p){

    return {

      reserve_percent:
        0.30,

      min_liquidity:
        100,

      reward_rate:
        0.02

    };

  }

  return {

    network:
      getProjectsNetwork(),

    reserve_percent:
      safeNum(
        p.reserve_percent,
        0.30
      ),

    min_liquidity:
      safeNum(
        p.min_liquidity,
        100
      ),

    reward_rate:
      safeNum(
        p.reward_rate,
        0.02
      )

  };

}


/* =========================================
   ADMIN / DEBUG SUMMARY
========================================= */

async function getProjectsEngineSummary(){

  const all =
    await getAllProjects();

  const grouped =
    await groupProjectsByType();

  return {

    network:
      getProjectsNetwork(),

    total:
      all.length,

    core:
      grouped.core.length,

    internal:
      grouped.internal.length,

    external:
      grouped.external.length,

    loaded:
      __albukhrProjectsLoaded,

    loading:
      __albukhrProjectsLoading,

    last_loaded_at:
      __albukhrProjectsLastLoadedAt,

    source:
      __albukhrProjectsLastSource,

    last_network:
      __albukhrProjectsLastNetwork

  };

}


/* =========================================
   GLOBAL EXPORTS
========================================= */

window.getAlbukhrProjectsNetwork =
  getProjectsNetwork;

window.getCurrentProjectsNetwork =
  getCurrentProjectsNetwork;

window.loadProjects =
  loadProjects;

window.refreshProjectsCache =
  refreshProjectsCache;

window.getProjects =
  getProjects;

window.getAllProjects =
  getAllProjects;

window.getActiveProjects =
  getActiveProjects;

window.getProjectsByType =
  getProjectsByType;

window.getCoreProjects =
  getCoreProjects;

window.getInternalProjects =
  getInternalProjects;

window.getExternalProjects =
  getExternalProjects;

window.groupProjectsByType =
  groupProjectsByType;

window.getProjectByCode =
  getProjectByCode;

window.getProjectMeta =
  getProjectMeta;

window.getProject =
  getProject;

window.getProjectTitle =
  getProjectTitle;

window.getProjectName =
  getProjectName;

window.getProjectIcon =
  getProjectIcon;

window.getProjectDescription =
  getProjectDescription;

window.getProjectInfo =
  getProjectInfo;

window.getProjectDurations =
  getProjectDurations;

window.getProjectType =
  getProjectType;

window.getProjectStatus =
  getProjectStatus;

window.projectExists =
  projectExists;

window.isProjectActive =
  isProjectActive;

window.isProjectVisible =
  isProjectVisible;

window.isCoreProject =
  isCoreProject;

window.isInternalProject =
  isInternalProject;

window.isExternalProject =
  isExternalProject;

window.isProjectTreasuryEnabled =
  isProjectTreasuryEnabled;

window.isProjectStakingEnabled =
  isProjectStakingEnabled;

window.isProjectContributionsEnabled =
  isProjectContributionsEnabled;

window.getProjectRules =
  getProjectRules;

window.getProjectsEngineSummary =
  getProjectsEngineSummary;


/* =========================================
   PRELOAD
========================================= */

window.addEventListener(
  "DOMContentLoaded",
  ()=>{

    loadProjects()
      .catch(
        err => {

          console.warn(
            "Projects preload warning:",
            err
          );

        }
      );

  }
);
