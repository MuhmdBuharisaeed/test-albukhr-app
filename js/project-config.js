/* =========================================================
   ALBUKHR – PROJECT CONFIG / REGISTRY ADAPTER v3

   NEW ARCHITECTURE

   environment-switcher.js
          ↓
   supabase-core.js
          ↓
   projects-engine.js
          ↓
   project-config.js
          ↓
   page/domain controllers

   PURPOSE
   -------
   Compatibility adapter for legacy project-config consumers.

   CANONICAL SOURCE
   ----------------
   public.projects, through projects-engine.js.

   RULES
   -----
   - No LocalStorage.
   - No direct Supabase credentials.
   - No second project registry table.
   - Mainnet/testnet isolation is inherited from projects-engine.js.
   - Active + visible core projects are exposed by loadProjectRegistry().
   - PROJECT_CONFIG is no longer a static source of truth.
   - Legacy metadata is compatibility-only for fields not yet stored
     in the canonical project schema.
========================================================= */

"use strict";

(() => {

  /*
   * Compatibility metadata only.
   * These values are not persisted and are never used to replace
   * canonical Supabase project fields when those fields exist.
   */
  const LEGACY_DURATION_MAP = Object.freeze({
    Azman:[180,365,430],
    Labbaika:[30,60,90],
    Barsh:[30,60,90],
    Urban:[30,60,90],
    Khairat:[30,60,90],
    Hauwal:[30,60,90],
    Raheem:[30,60,90]
  });

  const LEGACY_ICON_MAP = Object.freeze({
    Azman:"🧪",
    Labbaika:"🍞",
    Barsh:"🌾",
    Urban:"🚍",
    Khairat:"♻️",
    Hauwal:"🌽",
    Raheem:"💊"
  });

  const LEGACY_DESCRIPTION_MAP = Object.freeze({
    Azman:
      "Long-term science, technology, and innovation project focused on future invention and engineering.",

    Labbaika:
      "Food production project focused on modern bread and flour processing.",

    Barsh:
      "Mechanized farming and livestock project for large-scale agricultural production.",

    Urban:
      "Infrastructure project focused on modern transportation of people and goods.",

    Khairat:
      "Agricultural supply project improving fertiliser access and farm productivity.",

    Hauwal:
      "Agro-processing project modernizing maize milling into scalable production.",

    Raheem:
      "Healthcare project improving access to essential medicines."
  });

  const LEGACY_INFO_MAP = Object.freeze({
    Azman:
      "Azman supports research labs, prototyping, and advanced engineering capacity building.",

    Labbaika:
      "Labbaika enables scalable bakery production within the ALBUKHR ecosystem.",

    Barsh:
      "Barsh integrates modern farming, livestock, and sustainable agriculture systems.",

    Urban:
      "Urban improves accessibility and builds sustainable mobility networks.",

    Khairat:
      "Khairat supports transparent distribution systems and sustainable farming inputs.",

    Hauwal:
      "Hauwal focuses on clean processing, packaging, and food system efficiency.",

    Raheem:
      "Raheem provides transparent, community-driven pharmaceutical distribution."
  });

  let memoryCache = [];
  let loadedNetwork = null;
  let loadingPromise = null;
  let lastError = null;

  /* =========================================
     DEPENDENCY / NETWORK
  ========================================= */
  function requireProjectsEngine(){
    if(
      typeof window.loadProjects !== "function" ||
      typeof window.getProjectByCode !== "function"
    ){
      throw new Error(
        "projects-engine.js must be loaded before project-config.js."
      );
    }
  }

  function resolveNetwork(explicitNetwork){
    const normalize = value => {
      const n =
        String(value || "")
          .trim()
          .toLowerCase();

      if(n === "mainnet") return "mainnet";
      if(n === "testnet") return "testnet";

      return "";
    };

    const explicit =
      normalize(explicitNetwork);

    if(explicit){
      return explicit;
    }

    const resolvers = [
      "requireAlbukhrNetwork",
      "getAlbukhrNetwork",
      "getAlbukhrCurrentNetwork",
      "getCurrentAlbukhrNetwork"
    ];

    for(const name of resolvers){
      try{
        if(typeof window[name] === "function"){
          const network =
            normalize(
              window[name]()
            );

          if(network){
            return network;
          }
        }
      }catch(error){
        console.warn(
          `project-config: ${name}() failed:`,
          error
        );
      }
    }

    throw new Error(
      "ALBUKHR Network Core is unavailable."
    );
  }

  /* =========================================
     COMPATIBILITY METADATA
  ========================================= */
  function getCompatibilityMetadata(
    projectCode
  ){
    return {
      icon:
        LEGACY_ICON_MAP[projectCode] ||
        "📦",

      desc:
        LEGACY_DESCRIPTION_MAP[
          projectCode
        ] ||
        "ALBUKHR Project",

      info:
        LEGACY_INFO_MAP[
          projectCode
        ] ||
        "Project information not available.",

      durations:
        Array.isArray(
          LEGACY_DURATION_MAP[
            projectCode
          ]
        )
          ? [
              ...LEGACY_DURATION_MAP[
                projectCode
              ]
            ]
          : [30,60,90]
    };
  }

  function normalizeProject(
    row
  ){
    const projectCode =
      String(
        row?.project_code ||
        row?.code ||
        ""
      ).trim();

    if(!projectCode){
      return null;
    }

    const compatibility =
      getCompatibilityMetadata(
        projectCode
      );

    const metadata =
      row?.metadata &&
      typeof row.metadata === "object" &&
      !Array.isArray(row.metadata)
        ? row.metadata
        : {};

    const metadataDurations =
      Array.isArray(
        metadata.durations
      )
        ? metadata.durations
            .map(Number)
            .filter(
              Number.isFinite
            )
        : null;

    const durations =
      metadataDurations &&
      metadataDurations.length
        ? metadataDurations
        : (
            Array.isArray(
              row.durations
            )
              ? row.durations
                  .map(Number)
                  .filter(
                    Number.isFinite
                  )
              : compatibility.durations
          );

    const icon =
      String(
        metadata.icon ||
        row.icon ||
        ""
      ).trim() ||
      compatibility.icon;

    const desc =
      String(
        row.description ||
        row.desc ||
        metadata.desc ||
        ""
      ).trim() ||
      compatibility.desc;

    const info =
      String(
        row.info ||
        metadata.info ||
        ""
      ).trim() ||
      compatibility.info;

    return Object.freeze({
      id:row.id ?? null,

      project_code:projectCode,
      code:projectCode,

      name:
        row.project_name ||
        projectCode,

      title:
        row.project_name ||
        projectCode,

      project_name:
        row.project_name ||
        projectCode,

      project_type:
        row.project_type ||
        "core",

      status:
        row.status ||
        "active",

      network:
        row.network ||
        null,

      category:
        row.category ||
        "",

      stage:
        row.stage ||
        "",

      description:desc,
      desc,
      info,
      icon,

      durations:
        Object.freeze(
          [...durations]
        ),

      roi:
        Number(
          row.roi ?? 0
        ),

      reward_rate:
        row.reward_rate == null
          ? null
          : Number(
              row.reward_rate
            ),

      reserve_percent:
        Number(
          row.reserve_percent ??
          0.30
        ),

      min_liquidity:
        Number(
          row.min_liquidity ??
          100
        ),

      project_visible:
        row.project_visible !== false,

      dashboard_enabled:
        row.dashboard_enabled !== false,

      transparency_enabled:
        row.transparency_enabled !== false,

      metadata:
        Object.freeze({
          ...metadata
        }),

      created_at:
        row.created_at ??
        null,

      updated_at:
        row.updated_at ??
        null
    });
  }

  /* =========================================
     LOAD CANONICAL REGISTRY
  ========================================= */
  async function loadProjectRegistry(
    options = {}
  ){
    requireProjectsEngine();

    const forceRefresh =
      options.forceRefresh === true;

    const coreOnly =
      options.coreOnly !== false;

    const network =
      resolveNetwork(
        options.network
      );

    if(
      !forceRefresh &&
      loadedNetwork === network &&
      memoryCache.length
    ){
      return [...memoryCache];
    }

    if(
      !forceRefresh &&
      loadingPromise &&
      loadedNetwork === network
    ){
      return await loadingPromise;
    }

    lastError = null;

    loadingPromise =
      (async () => {
        const rows =
          await window.loadProjects(
            forceRefresh,
            {network}
          );

        let normalized =
          (Array.isArray(rows)
            ? rows
            : []
          )
            .filter(
              project =>
                project &&
                project.network === network &&
                project.status === "active" &&
                project.project_visible !== false
            )
            .filter(
              project =>
                !coreOnly ||
                project.project_type === "core"
            )
            .map(normalizeProject)
            .filter(Boolean);

        /*
         * Atomic adapter cache replacement.
         */
        memoryCache = normalized;
        loadedNetwork = network;

        return [...memoryCache];
      })();

    try{
      return await loadingPromise;

    }catch(error){
      lastError =
        error?.message ||
        "Failed to load ALBUKHR project registry.";

      /*
       * Never retain another network's adapter cache.
       */
      if(loadedNetwork !== network){
        memoryCache = [];
        loadedNetwork = network;
      }

      throw error;

    }finally{
      loadingPromise = null;
    }
  }

  async function loadCoreProjects(
    options = {}
  ){
    return await loadProjectRegistry({
      ...options,
      coreOnly:true
    });
  }

  /* =========================================
     LOOKUP
  ========================================= */
  async function getRegistryProjectByCode(
    projectCode,
    options = {}
  ){
    const code =
      String(
        projectCode || ""
      ).trim();

    if(!code){
      return null;
    }

    const projects =
      await loadProjectRegistry(
        options
      );

    return (
      projects.find(
        project =>
          project.project_code === code ||
          project.code === code
      ) ||
      null
    );
  }

  /*
   * Legacy-compatible synchronous accessor.
   * It reads only the current in-memory cache.
   */
  function getProjectConfig(
    name
  ){
    const code =
      String(
        name || ""
      ).trim();

    const cached =
      memoryCache.find(
        project =>
          project.project_code === code ||
          project.code === code
      );

    if(cached){
      return cached;
    }

    const compatibility =
      getCompatibilityMetadata(
        code
      );

    return Object.freeze({
      project_code:code,
      code,

      name:code,
      title:code,
      project_name:code,

      project_type:"unknown",
      status:"unknown",
      network:loadedNetwork,

      category:"",
      stage:"",

      description:
        compatibility.desc,

      desc:
        compatibility.desc,

      info:
        compatibility.info,

      icon:
        compatibility.icon,

      durations:
        Object.freeze(
          [...compatibility.durations]
        ),

      roi:0,
      reward_rate:null,

      reserve_percent:0,
      min_liquidity:100,

      project_visible:false,
      dashboard_enabled:false,
      transparency_enabled:false,

      metadata:
        Object.freeze({})
    });
  }

  function getLoadedProjects(){
    return [...memoryCache];
  }

  function clearProjectRegistryMemory(){
    memoryCache = [];
    loadedNetwork = null;
    lastError = null;
    loadingPromise = null;
  }

  function getProjectRegistryState(){
    return {
      source:"public.projects via projects-engine.js",

      network:loadedNetwork,

      count:
        memoryCache.length,

      loading:
        !!loadingPromise,

      last_error:
        lastError
    };
  }

  /* =========================================
     LEGACY PROJECT_CONFIG SURFACE
  ========================================= */
  const PROJECT_CONFIG =
    Object.freeze({});

  window.PROJECT_CONFIG =
    PROJECT_CONFIG;

  window.loadProjectRegistry =
    loadProjectRegistry;

  window.loadCoreProjects =
    loadCoreProjects;

  window.getRegistryProjectByCode =
    getRegistryProjectByCode;

  /*
   * Do not overwrite the canonical projects-engine
   * getProjectByCode(). This removes the previous global
   * function collision between two project registries.
   */
  if(
    typeof window.getProjectByCode !== "function"
  ){
    window.getProjectByCode =
      getRegistryProjectByCode;
  }

  window.getProjectConfig =
    getProjectConfig;

  window.getLoadedProjects =
    getLoadedProjects;

  window.clearProjectRegistryMemory =
    clearProjectRegistryMemory;

  window.getProjectRegistryState =
    getProjectRegistryState;

  console.log(
    "ALBUKHR Project Config / Registry Adapter loaded."
  );

})();
