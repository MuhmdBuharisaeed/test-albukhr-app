/* =========================================================
   ALBUKHR PROJECT RESOLVER
   Version 5.0.0

   LOCATION:
   05-investment/project-resolver.js

   ALBUKHR ECOSYSTEM
   └── 05-investment/
       └── project-resolver.js

   PURPOSE:
   - Resolve ALBUKHR projects from authoritative project engines
   - project_code-first resolution
   - Support legacy project_name / slug references
   - Enforce MAINNET / TESTNET isolation
   - Preserve trusted project_type metadata
   - Provide project ownership/access decisions
   - Provide treasury/update permission adapters
   - Maintain compatibility with existing dashboard APIs
   - Provide controlled project caching
   - Remove LocalStorage as a project source of truth

   ARCHITECTURE:

       Supabase
          ↓
       Project Engine(s)
          ↓
       Project Resolver
          ↓
       Investment / Treasury / Dashboard / Marketplace

   DEPENDENCIES:
   - 01-core/environment/*
   - 01-core/database/supabase-core.js
   - authoritative project engine(s)
   - admin session engine where admin permissions are required

   IMPORTANT:
   - project_code is canonical identity
   - network is mandatory
   - unknown network = REFUSED
   - unknown project type = unknown
   - database errors are NOT converted to empty project lists
   - LocalStorage is NOT used
   - sessionStorage is NOT used
   - no UI is modified
========================================================= */

(function(window){

  "use strict";


  /* =======================================================
     VERSION
  ======================================================= */

  const RESOLVER_VERSION =
    "5.0.0";


  /* =======================================================
     NETWORK CONSTANTS
  ======================================================= */

  const NETWORKS = Object.freeze({

    MAINNET:
      "mainnet",

    TESTNET:
      "testnet"

  });


  /* =======================================================
     ADMIN ROLES
  ======================================================= */

  const ADMIN_ROLES = Object.freeze([

    "super_admin",

    "ecosystem_admin",

    "finance_admin",

    "project_admin"

  ]);


  /* =======================================================
     CACHE CONFIGURATION
  ======================================================= */

  const CACHE_TIME =
    10000;


  const CACHE = {

    loaded:
      false,

    loading:
      false,

    loadingPromise:
      null,

    lastUpdate:
      0,

    network:
      "",

    projects:
      [],

    lastError:
      null

  };


  /* =======================================================
     ERROR TYPES
  ======================================================= */

  class AlbukhrProjectResolverError
    extends Error{

    constructor(
      message,
      code = "PROJECT_RESOLVER_ERROR",
      details = null
    ){

      super(message);

      this.name =
        "AlbukhrProjectResolverError";

      this.code =
        code;

      this.details =
        details;

    }

  }


  /* =======================================================
     SAFE HELPERS
  ======================================================= */

  function safeString(
    value,
    fallback = ""
  ){

    if(
      value === null ||
      value === undefined
    ){

      return fallback;

    }


    return String(value);

  }


  function safeNumber(
    value,
    fallback = 0
  ){

    const number =
      Number(value);


    return Number.isFinite(number)
      ? number
      : fallback;

  }


  function lower(value){

    return safeString(value)
      .trim()
      .toLowerCase();

  }


  function normalizeKey(value){

    return lower(value)
      .replace(/\s+/g, " ")
      .trim();

  }


  function slugifyProjectRef(value){

    return lower(value)
      .replace(
        /[^a-z0-9]+/g,
        "_"
      )
      .replace(
        /^_+|_+$/g,
        "");

  }


  function normalizeNetwork(value){

    const network =
      lower(value);


    if(
      network === NETWORKS.MAINNET ||
      network === "main"
    ){

      return NETWORKS.MAINNET;

    }


    if(
      network === NETWORKS.TESTNET ||
      network === "test"
    ){

      return NETWORKS.TESTNET;

    }


    return "";

  }


  function uniqueBy(
    array,
    keyGetter
  ){

    const map =
      new Map();


    (
      Array.isArray(array)
        ? array
        : []
    ).forEach(item => {

      const key =
        keyGetter(item);


      if(
        key &&
        !map.has(key)
      ){

        map.set(
          key,
          item
        );

      }

    });


    return Array.from(
      map.values()
    );

  }


  /* =======================================================
     CURRENT NETWORK
     -------------------------------------------------------
     Priority:
       1. authoritative environment helper
       2. ALBUKHR_NETWORK
       3. hostname

     IMPORTANT:
       Unknown environment is REFUSED.

     There is NO silent mainnet fallback.
  ======================================================= */

  async function getCurrentAlbukhrNetwork(){

    /* -----------------------------------------------
       ENVIRONMENT SWITCHER / CORE HELPER
    ----------------------------------------------- */

    try{

      if(
        typeof window.getCurrentNetwork ===
          "function"
      ){

        const value =
          await window.getCurrentNetwork();


        const network =
          normalizeNetwork(value);


        if(network){

          return network;

        }

      }

    }catch(error){

      console.warn(
        "[PROJECT RESOLVER] " +
        "getCurrentNetwork() failed:",
        error
      );

    }


    /* -----------------------------------------------
       GLOBAL NETWORK STATE
    ----------------------------------------------- */

    try{

      if(
        window.ALBUKHR_NETWORK
      ){

        const value =
          typeof window.ALBUKHR_NETWORK ===
            "object"

            ? (
                window.ALBUKHR_NETWORK.network ||
                window.ALBUKHR_NETWORK.current ||
                window.ALBUKHR_NETWORK.name
              )

            : window.ALBUKHR_NETWORK;


        const network =
          normalizeNetwork(value);


        if(network){

          return network;

        }

      }

    }catch(error){

      console.warn(
        "[PROJECT RESOLVER] " +
        "ALBUKHR_NETWORK unavailable:",
        error
      );

    }


    /* -----------------------------------------------
       HOSTNAME
    ----------------------------------------------- */

    try{

      const hostname =
        lower(
          window.location.hostname
        );


      if(
        hostname ===
          "test.albukhr.com" ||

        hostname.startsWith(
          "test."
        )
      ){

        return NETWORKS.TESTNET;

      }


      if(
        hostname ===
          "app.albukhr.com" ||

        hostname.startsWith(
          "app."
        )
      ){

        return NETWORKS.MAINNET;

      }


      throw new AlbukhrProjectResolverError(

        "ALBUKHR network could not be determined " +
        "for this host.",

        "NETWORK_UNDETERMINED"

      );

    }catch(error){

      if(
        error instanceof
        AlbukhrProjectResolverError
      ){

        throw error;

      }


      throw new AlbukhrProjectResolverError(

        "ALBUKHR network resolution failed.",

        "NETWORK_RESOLUTION_ERROR",

        error

      );

    }

  }


  /* =======================================================
     REQUIRE NETWORK
  ======================================================= */

  async function requireCurrentAlbukhrNetwork(){

    const network =
      await getCurrentAlbukhrNetwork();


    if(!network){

      throw new AlbukhrProjectResolverError(

        "ALBUKHR network is unavailable.",

        "NETWORK_UNAVAILABLE"

      );

    }


    return network;

  }


  /* =======================================================
     NETWORK VALIDATION
  ======================================================= */

  function assertNetwork(
    network
  ){

    const normalized =
      normalizeNetwork(network);


    if(!normalized){

      throw new AlbukhrProjectResolverError(

        "Invalid or unknown ALBUKHR network.",

        "INVALID_NETWORK",

        {
          network
        }

      );

    }


    return normalized;

  }


  /* =======================================================
     PROJECT NETWORK
     -------------------------------------------------------
     Projects MUST explicitly declare network.

     No implicit assignment.
  ======================================================= */

  function getProjectNetwork(
    project
  ){

    if(!project){

      return "";

    }


    return normalizeNetwork(

      project.network ||

      project.environment ||

      project.project_network

    );

  }


  /* =======================================================
     NETWORK MEMBERSHIP
  ======================================================= */

  function projectBelongsToNetwork(
    project,
    network
  ){

    if(!project){

      return false;

    }


    const targetNetwork =
      normalizeNetwork(network);


    if(!targetNetwork){

      return false;

    }


    const projectNetwork =
      getProjectNetwork(project);


    /*
      Missing project network is NOT allowed.
    */

    if(!projectNetwork){

      return false;

    }


    return (
      projectNetwork ===
      targetNetwork
    );

  }


  /* =======================================================
     CURRENT ADMIN
  ======================================================= */

  async function getCurrentAlbukhrAdminRaw(){

    if(
      typeof window.getCurrentAdmin !==
        "function"
    ){

      return null;

    }


    try{

      return await
        window.getCurrentAdmin();

    }catch(error){

      console.warn(
        "[PROJECT RESOLVER] " +
        "getCurrentAdmin() failed:",
        error
      );

      return null;

    }

  }


  /* =======================================================
     ADMIN RESULT
     -------------------------------------------------------
     Prefer structured admin session API when available.
  ======================================================= */

  async function getCurrentAlbukhrAdminResult(){

    if(
      typeof window.getCurrentAdminResult ===
        "function"
    ){

      try{

        return await
          window.getCurrentAdminResult();

      }catch(error){

        return {

          ok:
            false,

          authenticated:
            false,

          status:
            "error",

          admin:
            null,

          error

        };

      }

    }


    const admin =
      await getCurrentAlbukhrAdminRaw();


    if(admin){

      return {

        ok:
          true,

        authenticated:
          true,

        status:
          "active",

        admin,

        error:
          null

      };

    }


    return {

      ok:
        true,

      authenticated:
        false,

      status:
        "unauthenticated",

      admin:
        null,

      error:
        null

    };

  }


  /* =======================================================
     CURRENT ADMIN EMAIL
  ======================================================= */

  async function getCurrentAlbukhrEmail(){

    const admin =
      await getCurrentAlbukhrAdminRaw();


    if(!admin){

      return "";

    }


    return safeString(

      admin.email ||

      admin.admin_email ||

      ""

    ).trim();

  }


  /* =======================================================
     CURRENT ALBUKHR USER
  ======================================================= */

  async function getCurrentAlbukhrUser(){

    const result =
      await getCurrentAlbukhrAdminResult();


    const admin =
      result?.admin;


    if(
      result?.status !==
        "active" ||
      !admin
    ){

      return {

        email:
          "",

        userid:
          "",

        username:
          "",

        role:
          "",

        isAdmin:
          false,

        admin:
          null,

        authStatus:
          result?.status ||
          "unauthenticated"

      };

    }


    return {

      email:
        safeString(
          admin.email
        ).trim(),

      userid:
        safeString(

          admin.auth_user_id ||

          admin.userid ||

          admin.user_id

        ).trim(),

      username:
        safeString(
          admin.username
        ).trim(),

      role:
        safeString(

          admin.role_code ||

          admin.role

        )
        .trim()
        .toLowerCase(),

      isAdmin:
        true,

      admin,

      authStatus:
        "active"

    };

  }


  /* =======================================================
     ROLE HELPERS
  ======================================================= */

  function hasAdminRole(
    user,
    roles = []
  ){

    if(
      !user ||
      user.isAdmin !== true
    ){

      return false;

    }


    const role =
      lower(user.role);


    return roles
      .map(lower)
      .includes(role);

  }


  function isSuperAdmin(user){

    return hasAdminRole(
      user,
      [
        "super_admin"
      ]
    );

  }


  function isFinanceAdmin(user){

    return hasAdminRole(
      user,
      [
        "finance_admin"
      ]
    );

  }


  function isEcosystemAdmin(user){

    return hasAdminRole(
      user,
      [
        "ecosystem_admin"
      ]
    );

  }


  function isProjectAdmin(user){

    return hasAdminRole(
      user,
      [
        "project_admin"
      ]
    );

  }


  function isAnyProjectAdmin(user){

    return hasAdminRole(
      user,
      ADMIN_ROLES
    );

  }


  /* =======================================================
     PROJECT ENGINE DEPENDENCY
  ======================================================= */

  function assertProjectEngine(){

    if(
      typeof window.getAllProjects !==
        "function"
    ){

      throw new AlbukhrProjectResolverError(

        "Authoritative projects engine is not loaded.",

        "PROJECT_ENGINE_UNAVAILABLE"

      );

    }

  }


  /* =======================================================
     LOAD PROJECTS FROM AUTHORITATIVE ENGINE
  ======================================================= */

  async function loadProjectsFromEngine(
    network = null
  ){

    assertProjectEngine();


    const targetNetwork =
      normalizeNetwork(network) ||
      await requireCurrentAlbukhrNetwork();


    const rows =
      await window.getAllProjects({

        visibleOnly:
          false,

        activeOnly:
          false,

        network:
          targetNetwork

      });


    if(
      !Array.isArray(rows)
    ){

      throw new AlbukhrProjectResolverError(

        "Project engine returned an invalid result.",

        "INVALID_PROJECT_ENGINE_RESULT"

      );

    }


    /*
      Strict network isolation.

      A project returned by the engine is still
      checked independently.
    */

    return rows.filter(
      project =>
        projectBelongsToNetwork(
          project,
          targetNetwork
        )
    );

  }


  /* =======================================================
     LOAD CORE PROJECTS
     -------------------------------------------------------
     Compatibility adapter.
  ======================================================= */

  async function loadCoreProjectsFromEngine(
    network = null
  ){

    const targetNetwork =
      normalizeNetwork(network) ||
      await requireCurrentAlbukhrNetwork();


    if(
      typeof window.getCoreProjects !==
        "function"
    ){

      return [];

    }


    try{

      const rows =
        await window.getCoreProjects({

          visibleOnly:
            false,

          activeOnly:
            false,

          network:
            targetNetwork

        });


      if(
        !Array.isArray(rows)
      ){

        throw new AlbukhrProjectResolverError(

          "Core project engine returned an invalid result.",

          "INVALID_CORE_PROJECT_RESULT"

        );

      }


      /*
        Do NOT silently assign target network to
        missing project metadata.

        Explicit network is required.
      */

      return rows.filter(
        project =>
          projectBelongsToNetwork(
            project,
            targetNetwork
          )
      );

    }catch(error){

      if(
        error instanceof
        AlbukhrProjectResolverError
      ){

        throw error;

      }


      throw new AlbukhrProjectResolverError(

        "Core project loading failed.",

        "CORE_PROJECT_LOAD_ERROR",

        error

      );

    }

  }


  /* =======================================================
     LOAD MARKETPLACE PROJECTS
     -------------------------------------------------------
     Compatibility adapter.
  ======================================================= */

  async function loadMarketplaceProjectsFromEngine(
    network = null
  ){

    const targetNetwork =
      normalizeNetwork(network) ||
      await requireCurrentAlbukhrNetwork();


    if(
      typeof window.getMarketplaceProjects !==
        "function"
    ){

      return [];

    }


    try{

      const rows =
        await window.getMarketplaceProjects({

          network:
            targetNetwork

        });


      if(
        !Array.isArray(rows)
      ){

        throw new AlbukhrProjectResolverError(

          "Marketplace project engine returned an invalid result.",

          "INVALID_MARKETPLACE_PROJECT_RESULT"

        );

      }


      return rows.filter(
        project =>
          projectBelongsToNetwork(
            project,
            targetNetwork
          )
      );

    }catch(error){

      if(
        error instanceof
        AlbukhrProjectResolverError
      ){

        throw error;

      }


      throw new AlbukhrProjectResolverError(

        "Marketplace project loading failed.",

        "MARKETPLACE_PROJECT_LOAD_ERROR",

        error

      );

    }

  }


  /* =======================================================
     PROJECT TYPE NORMALIZER
  ======================================================= */

  function normalizeProjectType(
    value
  ){

    const type =
      lower(value);


    if(
      type === "core"
    ){

      return "core";

    }


    if(
      type === "internal"
    ){

      return "internal";

    }


    if(
      type === "external"
    ){

      return "external";

    }


    return "";

  }


  /* =======================================================
     PROJECT NORMALIZATION
     -------------------------------------------------------
     IMPORTANT:
     - no project-name type inference
     - no unknown => internal coercion
     - no implicit network assignment
  ======================================================= */

  function normalizeProject(
    raw = {},
    source = "unknown",
    network = ""
  ){

    const projectCode =
      safeString(

        raw.project_code ||

        raw.code ||

        raw.projectCode ||

        raw.slug ||

        ""

      ).trim();


    const projectName =
      safeString(

        raw.project_name ||

        raw.projectName ||

        raw.name ||

        raw.title ||

        projectCode

      ).trim();


    const explicitNetwork =
      getProjectNetwork(raw);


    const projectNetwork =
      explicitNetwork ||
      "";


    let projectType =
      normalizeProjectType(

        raw.project_type ||

        raw.type ||

        raw.projectType ||

        ""

      );


    /*
      Explicit boolean metadata remains supported.

      These are still metadata signals, not name inference.
    */

    if(!projectType){

      if(
        raw.is_core === true
      ){

        projectType =
          "core";

      }

      else if(
        raw.is_internal === true
      ){

        projectType =
          "internal";

      }

      else if(
        raw.is_external === true
      ){

        projectType =
          "external";

      }

    }


    const creatorUserid =
      safeString(

        raw.creator_userid ||

        raw.creatorUserId ||

        raw.creator_auth_user_id ||

        ""

      ).trim();


    const creatorUsername =
      safeString(

        raw.creator_username ||

        raw.creatorUsername ||

        raw.username ||

        ""

      ).trim();


    const status =
      lower(

        raw.status ||

        raw.project_status ||

        "active"

      ) || "active";


    return {

      id:
        raw.id ?? null,

      project_code:
        projectCode ||
        slugifyProjectRef(
          projectName
        ),

      project_name:
        projectName ||
        projectCode ||
        "Unnamed Project",

      project_type:
        projectType ||
        "unknown",

      network:
        projectNetwork,

      description:
        safeString(
          raw.description ||
          "ALBUKHR Project"
        ),

      icon:
        safeString(
          raw.icon ||
          "📦"
        ),

      status,

      reward_rate:
        safeNumber(
          raw.reward_rate,
          0
        ),

      reserve_percent:
        safeNumber(
          raw.reserve_percent,
          0.30
        ),

      min_liquidity:
        safeNumber(
          raw.min_liquidity,
          100
        ),

      creator_userid:
        creatorUserid,

      creator_username:
        creatorUsername,

      source,

      raw,

      is_core:
        projectType ===
        "core",

      is_internal:
        projectType ===
        "internal",

      is_external:
        projectType ===
        "external"

    };

  }


  /* =======================================================
     COLLECT PROJECTS
  ======================================================= */

  async function collectAlbukhrProjects(
    options = {}
  ){

    const targetNetwork =
      normalizeNetwork(
        options.network
      ) ||
      await requireCurrentAlbukhrNetwork();


    const results = {

      all:
        [],

      core:
        [],

      marketplace:
        [],

      errors:
        []

    };


    /* =====================================================
       AUTHORITATIVE PROJECT ENGINE
    ===================================================== */

    try{

      results.all =
        await loadProjectsFromEngine(
          targetNetwork
        );

    }catch(error){

      results.errors.push({

        source:
          "projects_engine",

        error

      });

    }


    /* =====================================================
       CORE ENGINE
    ===================================================== */

    try{

      results.core =
        await loadCoreProjectsFromEngine(
          targetNetwork
        );

    }catch(error){

      results.errors.push({

        source:
          "core_engine",

        error

      });

    }


    /* =====================================================
       MARKETPLACE ENGINE
    ===================================================== */

    try{

      results.marketplace =
        await loadMarketplaceProjectsFromEngine(
          targetNetwork
        );

    }catch(error){

      results.errors.push({

        source:
          "marketplace_engine",

        error

      });

    }


    /*
      If the authoritative project engine failed,
      do not silently present an empty ecosystem.

      However, optional compatibility engines can still
      provide records if the authoritative engine itself
      was unavailable.

      This distinction is preserved through metadata.
    */

    const normalized = [];


    results.all.forEach(
      project => {

        normalized.push(

          normalizeProject(

            project,

            "projects_engine",

            targetNetwork

          )

        );

      }
    );


    results.core.forEach(
      project => {

        normalized.push(

          normalizeProject(

            project,

            "core_engine",

            targetNetwork

          )

        );

      }
    );


    results.marketplace.forEach(
      project => {

        normalized.push(

          normalizeProject(

            project,

            "marketplace_engine",

            targetNetwork

          )

        );

      }
    );


    /*
      Strict network isolation.
    */

    const networkRows =
      normalized.filter(
        project =>

          projectBelongsToNetwork(
            project,
            targetNetwork
          )
      );


    /*
      Canonical identity:
      project_code.
    */

    const projects =
      uniqueBy(

        networkRows
          .filter(Boolean)
          .filter(
            project =>
              project.project_code
          ),

        project =>

          normalizeKey(
            project.project_code
          )

      );


    return {

      projects,

      network:
        targetNetwork,

      source_errors:
        results.errors,

      authoritative_available:
        results.errors.every(
          item =>
            item.source !==
            "projects_engine"
        ),

      loaded_at:
        Date.now()

    };

  }


  /* =======================================================
     CACHE LOAD
     -------------------------------------------------------
     Shared promise prevents duplicate concurrent queries.
  ======================================================= */

  async function loadProjectCache(
    force = false,
    network = null
  ){

    const targetNetwork =
      normalizeNetwork(network) ||
      await requireCurrentAlbukhrNetwork();


    const now =
      Date.now();


    if(

      !force &&

      CACHE.loaded &&

      CACHE.network ===
        targetNetwork &&

      (
        now -
        CACHE.lastUpdate
      ) < CACHE_TIME

    ){

      return CACHE.projects;

    }


    if(
      CACHE.loading &&
      CACHE.loadingPromise
    ){

      return CACHE.loadingPromise;

    }


    CACHE.loading =
      true;


    CACHE.lastError =
      null;


    CACHE.loadingPromise =
      (async () => {

        try{

          const result =
            await collectAlbukhrProjects({

              network:
                targetNetwork

            });


          /*
            If the authoritative engine failed,
            do NOT overwrite a valid cache with [].

            This is critical for avoiding false
            "no projects" states during temporary
            database/RLS/network failures.
          */

          const authoritativeError =
            result.source_errors.find(
              item =>
                item.source ===
                "projects_engine"
            );


          if(
            authoritativeError &&
            !result.projects.length
          ){

            throw new AlbukhrProjectResolverError(

              "Authoritative project data could not be loaded.",

              "PROJECT_DATA_UNAVAILABLE",

              {
                network:
                  targetNetwork,

                sourceErrors:
                  result.source_errors

              }

            );

          }


          CACHE.projects =
            result.projects;


          CACHE.network =
            targetNetwork;


          CACHE.loaded =
            true;


          CACHE.lastUpdate =
            Date.now();


          CACHE.lastError =
            result.source_errors.length
              ? result.source_errors
              : null;


          return CACHE.projects;

        }catch(error){

          CACHE.lastError =
            error;


          /*
            Keep previous valid cache if it belongs
            to the same network.
          */

          if(
            CACHE.network ===
              targetNetwork &&
            CACHE.loaded
          ){

            console.warn(
              "[PROJECT RESOLVER] " +
              "Keeping previous valid project cache " +
              "after refresh failure.",
              error
            );


            return CACHE.projects;

          }


          throw error;

        }finally{

          CACHE.loading =
            false;

          CACHE.loadingPromise =
            null;

        }

      })();


    return CACHE.loadingPromise;

  }


  /* =======================================================
     CACHE REFRESH
  ======================================================= */

  async function refreshAlbukhrProjects(){

    CACHE.loaded =
      false;

    CACHE.loading =
      false;

    CACHE.loadingPromise =
      null;

    CACHE.lastUpdate =
      0;

    CACHE.network =
      "";

    CACHE.projects =
      [];

    CACHE.lastError =
      null;


    return await loadProjectCache(
      true
    );

  }


  /* =======================================================
     FIND BY PROJECT CODE
  ======================================================= */

  function findProjectByCode(
    projects = [],
    projectCode = ""
  ){

    const key =
      normalizeKey(
        projectCode
      );


    if(!key){

      return null;

    }


    return projects.find(
      project =>

        normalizeKey(
          project.project_code
        ) === key

    ) || null;

  }


  /* =======================================================
     FIND BY PROJECT NAME
  ======================================================= */

  function findProjectByName(
    projects = [],
    projectName = ""
  ){

    const key =
      normalizeKey(
        projectName
      );


    if(!key){

      return null;

    }


    return projects.find(
      project =>

        normalizeKey(
          project.project_name
        ) === key

    ) || null;

  }


  /* =======================================================
     FLEXIBLE PROJECT REFERENCE
     -------------------------------------------------------
     Priority:
       1. project_code
       2. exact project_name
       3. slug compatibility
  ======================================================= */

  function findProjectByFlexibleRef(
    projects = [],
    projectRef = ""
  ){

    const ref =
      safeString(
        projectRef
      ).trim();


    if(!ref){

      return null;

    }


    const byCode =
      findProjectByCode(
        projects,
        ref
      );


    if(byCode){

      return byCode;

    }


    const byName =
      findProjectByName(
        projects,
        ref
      );


    if(byName){

      return byName;

    }


    const slugRef =
      slugifyProjectRef(
        ref
      );


    if(!slugRef){

      return null;

    }


    return projects.find(
      project =>

        slugifyProjectRef(
          project.project_code
        ) === slugRef

        ||

        slugifyProjectRef(
          project.project_name
        ) === slugRef

    ) || null;

  }


  /* =======================================================
     RESOLVE PROJECT
  ======================================================= */

  async function resolveAlbukhrProject(
    projectRef,
    options = {}
  ){

    const ref =
      safeString(
        projectRef
      ).trim();


    if(!ref){

      return null;

    }


    const network =
      normalizeNetwork(
        options.network
      ) ||
      await requireCurrentAlbukhrNetwork();


    const projects =
      await loadProjectCache(
        !!options.forceRefresh,
        network
      );


    return findProjectByFlexibleRef(
      projects,
      ref
    );

  }


  /* =======================================================
     LEGACY PROJECT REFERENCE
     -------------------------------------------------------
     Compatibility only.

     NO LocalStorage.
     NO sessionStorage.

     Supported:
       - ALBUKHR_CURRENT_PROJECT
       - URL query parameters
  ======================================================= */

  function getLegacyProjectReference(){

    try{

      if(
        window.ALBUKHR_CURRENT_PROJECT
      ){

        if(
          typeof window.ALBUKHR_CURRENT_PROJECT ===
            "object"
        ){

          return safeString(

            window.ALBUKHR_CURRENT_PROJECT.project_code ||

            window.ALBUKHR_CURRENT_PROJECT.code ||

            window.ALBUKHR_CURRENT_PROJECT.project_name ||

            ""

          ).trim();

        }


        return safeString(
          window.ALBUKHR_CURRENT_PROJECT
        ).trim();

      }

    }catch(error){

      console.warn(
        "[PROJECT RESOLVER] " +
        "Legacy project reference unavailable:",
        error
      );

    }


    /*
      URL is the preferred compatibility mechanism.
    */

    try{

      const params =
        new URLSearchParams(
          window.location.search
        );


      return safeString(

        params.get(
          "project_code"
        ) ||

        params.get(
          "project"
        ) ||

        params.get(
          "projectRef"
        ) ||

        ""

      ).trim();

    }catch(error){

      return "";

    }

  }


  /* =======================================================
     RESOLVE CURRENT PROJECT
  ======================================================= */

  async function resolveCurrentAlbukhrProject(
    options = {}
  ){

    const ref =
      safeString(

        options.projectRef ||

        getLegacyProjectReference()

      ).trim();


    if(!ref){

      return null;

    }


    return await
      resolveAlbukhrProject(
        ref,
        options
      );

  }


  /* =======================================================
     PROJECT TYPE
  ======================================================= */

  function getAlbukhrProjectType(
    project
  ){

    if(!project){

      return "unknown";

    }


    return (
      normalizeProjectType(
        project.project_type
      ) ||
      "unknown"
    );

  }


  function isCoreProject(
    project
  ){

    return (
      getAlbukhrProjectType(
        project
      ) ===
      "core"
    );

  }


  function isInternalProject(
    project
  ){

    return (
      getAlbukhrProjectType(
        project
      ) ===
      "internal"
    );

  }


  function isExternalProject(
    project
  ){

    return (
      getAlbukhrProjectType(
        project
      ) ===
      "external"
    );

  }


  /* =======================================================
     PROJECT OWNERSHIP
  ======================================================= */

  function isProjectOwner(
    project,
    user
  ){

    if(
      !project ||
      !user
    ){

      return false;

    }


    const creatorId =
      lower(
        project.creator_userid
      );


    const currentUserId =
      lower(
        user.userid
      );


    if(
      creatorId &&
      currentUserId &&
      creatorId ===
        currentUserId
    ){

      return true;

    }


    return false;

  }


  /* =======================================================
     NETWORK ACCESS
  ======================================================= */

  async function isProjectInCurrentNetwork(
    project
  ){

    if(
      !project
    ){

      return false;

    }


    const currentNetwork =
      await requireCurrentAlbukhrNetwork();


    return (
      projectBelongsToNetwork(
        project,
        currentNetwork
      )
    );

  }


  /* =======================================================
     DASHBOARD ACCESS
     -------------------------------------------------------
     Rules:
       - Any approved project admin role:
           allowed
       - Core:
           admin only
       - Internal:
           owner or admin
       - External:
           owner or admin
       - Unknown:
           denied
  ======================================================= */

  async function canAccessAlbukhrProjectDashboard(
    project,
    user = null
  ){

    if(!project){

      return false;

    }


    user =
      user ||
      await getCurrentAlbukhrUser();


    if(
      !project.network
    ){

      return false;

    }


    let currentNetwork;


    try{

      currentNetwork =
        await requireCurrentAlbukhrNetwork();

    }catch(error){

      return false;

    }


    if(
      project.network !==
      currentNetwork
    ){

      return false;

    }


    if(
      isAnyProjectAdmin(user)
    ){

      return true;

    }


    if(
      isCoreProject(project)
    ){

      return false;

    }


    if(
      isInternalProject(project) ||
      isExternalProject(project)
    ){

      return isProjectOwner(
        project,
        user
      );

    }


    return false;

  }


  /* =======================================================
     TREASURY PERMISSIONS
  ======================================================= */

  async function canManageAlbukhrProjectTreasury(
    project,
    user = null
  ){

    if(!project){

      return false;

    }


    user =
      user ||
      await getCurrentAlbukhrUser();


    let currentNetwork;


    try{

      currentNetwork =
        await requireCurrentAlbukhrNetwork();

    }catch(error){

      return false;

    }


    if(
      project.network !==
      currentNetwork
    ){

      return false;

    }


    return (

      isSuperAdmin(user) ||

      isFinanceAdmin(user) ||

      isEcosystemAdmin(user)

    );

  }


  /* =======================================================
     PROJECT UPDATE PERMISSIONS
  ======================================================= */

  async function canUploadAlbukhrProjectUpdate(
    project,
    user = null
  ){

    if(!project){

      return false;

    }


    user =
      user ||
      await getCurrentAlbukhrUser();


    let currentNetwork;


    try{

      currentNetwork =
        await requireCurrentAlbukhrNetwork();

    }catch(error){

      return false;

    }


    if(
      project.network !==
      currentNetwork
    ){

      return false;

    }


    if(
      isAnyProjectAdmin(user)
    ){

      return true;

    }


    if(
      isInternalProject(project) ||
      isExternalProject(project)
    ){

      return isProjectOwner(
        project,
        user
      );

    }


    return false;

  }


  /* =======================================================
     DASHBOARD ACCESS GUARD
  ======================================================= */

  async function guardAlbukhrDashboardAccess({

    projectRef = "",

    requireProject = true,

    network = null

  } = {}){

    let targetNetwork;


    try{

      targetNetwork =
        normalizeNetwork(network) ||
        await requireCurrentAlbukhrNetwork();

    }catch(error){

      return {

        ok:
          false,

        reason:
          "network_unavailable",

        project:
          null,

        user:
          await getCurrentAlbukhrUser(),

        network:
          null,

        error

      };

    }


    const user =
      await getCurrentAlbukhrUser();


    const ref =
      safeString(
        projectRef
      ).trim();


    if(!ref){

      if(requireProject){

        return {

          ok:
            false,

          reason:
            "missing_project",

          project:
            null,

          user,

          network:
            targetNetwork

        };

      }


      return {

        ok:
          true,

        reason:
          null,

        project:
          null,

        user,

        network:
          targetNetwork

      };

    }


    let project;


    try{

      project =
        await resolveAlbukhrProject(
          ref,
          {
            network:
              targetNetwork
          }
        );

    }catch(error){

      return {

        ok:
          false,

        reason:
          "project_load_error",

        project:
          null,

        user,

        network:
          targetNetwork,

        error

      };

    }


    if(!project){

      return {

        ok:
          false,

        reason:
          "project_not_found",

        project:
          null,

        user,

        network:
          targetNetwork

      };

    }


    if(
      project.network !==
      targetNetwork
    ){

      return {

        ok:
          false,

        reason:
          "network_mismatch",

        project,

        user,

        network:
          targetNetwork

      };

    }


    const allowed =
      await canAccessAlbukhrProjectDashboard(
        project,
        user
      );


    if(!allowed){

      return {

        ok:
          false,

        reason:
          "access_denied",

        project,

        user,

        network:
          targetNetwork

      };

    }


    return {

      ok:
        true,

      reason:
        null,

      project,

      user,

      network:
        targetNetwork

    };

  }


  /* =======================================================
     UI HELPERS
  ======================================================= */

  function getAlbukhrDashboardTitle(
    project
  ){

    const type =
      getAlbukhrProjectType(
        project
      );


    if(
      type === "core"
    ){

      return (
        "ALBUKHR Core Project Dashboard"
      );

    }


    if(
      type === "internal"
    ){

      return (
        "ALBUKHR Internal Project Dashboard"
      );

    }


    if(
      type === "external"
    ){

      return (
        "ALBUKHR External Project Dashboard"
      );

    }


    return (
      "ALBUKHR Project Dashboard"
    );

  }


  function getAlbukhrProjectUpdateTitle(
    project
  ){

    const type =
      getAlbukhrProjectType(
        project
      );


    if(
      type === "core"
    ){

      return (
        "📸 Core Project Updates"
      );

    }


    if(
      type === "internal"
    ){

      return (
        "📸 Internal Project Updates"
      );

    }


    if(
      type === "external"
    ){

      return (
        "📸 External Project Updates"
      );

    }


    return (
      "📸 Project Updates"
    );

  }


  function getAlbukhrProjectTypeLabel(
    project
  ){

    const type =
      getAlbukhrProjectType(
        project
      );


    if(
      type === "core"
    ){

      return "Core Project";

    }


    if(
      type === "internal"
    ){

      return "Internal Project";

    }


    if(
      type === "external"
    ){

      return "External Project";

    }


    return "Unknown Project Type";

  }


  /* =======================================================
     PROJECT LIST API
  ======================================================= */

  async function getResolvedAlbukhrProjects(
    options = {}
  ){

    const network =
      normalizeNetwork(
        options.network
      ) ||
      await requireCurrentAlbukhrNetwork();


    return await loadProjectCache(

      !!options.forceRefresh,

      network

    );

  }


  /* =======================================================
     PROJECT RESOLVER STATUS
  ======================================================= */

  function getAlbukhrProjectResolverStatus(){

    return {

      version:
        RESOLVER_VERSION,

      loaded:
        CACHE.loaded,

      loading:
        CACHE.loading,

      network:
        CACHE.network,

      project_count:
        CACHE.projects.length,

      last_update:
        CACHE.lastUpdate,

      has_error:
        !!CACHE.lastError,

      last_error:
        CACHE.lastError || null

    };

  }


  /* =======================================================
     NETWORK CHANGE HANDLER
     -------------------------------------------------------
     Environment switching invalidates project cache.
  ======================================================= */

  function handleAlbukhrNetworkChanged(
    network
  ){

    const normalized =
      normalizeNetwork(
        network
      );


    /*
      Unknown network must never be treated
      as a valid environment.
    */

    if(!normalized){

      CACHE.loaded =
        false;

      CACHE.lastUpdate =
        0;

      CACHE.network =
        "";

      CACHE.projects =
        [];

      CACHE.lastError =
        new AlbukhrProjectResolverError(

          "Project cache invalidated because " +
          "the new network is invalid.",

          "INVALID_NETWORK"

        );

      return;

    }


    if(
      CACHE.network ===
      normalized
    ){

      return;

    }


    CACHE.loaded =
      false;

    CACHE.loading =
      false;

    CACHE.loadingPromise =
      null;

    CACHE.lastUpdate =
      0;

    CACHE.network =
      "";

    CACHE.projects =
      [];

    CACHE.lastError =
      null;

  }


  /* =======================================================
     FORCE CACHE INVALIDATION
  ======================================================= */

  function invalidateAlbukhrProjectCache(){

    CACHE.loaded =
      false;

    CACHE.lastUpdate =
      0;

    CACHE.network =
      "";

    CACHE.projects =
      [];

    CACHE.lastError =
      null;

  }


  /* =======================================================
     PUBLIC NAMESPACE
  ======================================================= */

  const PROJECT_RESOLVER = {

    version:
      RESOLVER_VERSION,

    NETWORKS,

    ADMIN_ROLES,

    AlbukhrProjectResolverError,

    safeString,

    safeNumber,

    lower,

    normalizeKey,

    slugifyProjectRef,

    normalizeNetwork,

    getCurrentAlbukhrNetwork,

    requireCurrentAlbukhrNetwork,

    assertNetwork,

    getProjectNetwork,

    projectBelongsToNetwork,

    getCurrentAlbukhrAdminRaw,

    getCurrentAlbukhrAdminResult,

    getCurrentAlbukhrEmail,

    getCurrentAlbukhrUser,

    hasAdminRole,

    isSuperAdmin,

    isFinanceAdmin,

    isEcosystemAdmin,

    isProjectAdmin,

    isAnyProjectAdmin,

    normalizeProjectType,

    normalizeProject,

    loadProjectsFromEngine,

    loadCoreProjectsFromEngine,

    loadMarketplaceProjectsFromEngine,

    collectAlbukhrProjects,

    getResolvedAlbukhrProjects,

    findProjectByCode,

    findProjectByName,

    findProjectByFlexibleRef,

    resolveAlbukhrProject,

    resolveCurrentAlbukhrProject,

    getAlbukhrProjectType,

    isCoreProject,

    isInternalProject,

    isExternalProject,

    isProjectOwner,

    isProjectInCurrentNetwork,

    canAccessAlbukhrProjectDashboard,

    canManageAlbukhrProjectTreasury,

    canUploadAlbukhrProjectUpdate,

    guardAlbukhrDashboardAccess,

    getAlbukhrDashboardTitle,

    getAlbukhrProjectUpdateTitle,

    getAlbukhrProjectTypeLabel,

    refreshAlbukhrProjects,

    invalidateAlbukhrProjectCache,

    getAlbukhrProjectResolverStatus,

    handleAlbukhrNetworkChanged

  };


  /* =======================================================
     PUBLIC NAMESPACE EXPORT
  ======================================================= */

  window.ALBUKHR_PROJECT_RESOLVER =
    PROJECT_RESOLVER;


  /* =======================================================
     GLOBAL COMPATIBILITY EXPORTS
     -------------------------------------------------------
     These are retained during migration so existing
     HTML/pages/engines do not immediately break.
  ======================================================= */

  window.resolveAlbukhrProject =
    resolveAlbukhrProject;


  window.resolveCurrentAlbukhrProject =
    resolveCurrentAlbukhrProject;


  window.getAlbukhrProjectType =
    getAlbukhrProjectType;


  window.canAccessAlbukhrProjectDashboard =
    canAccessAlbukhrProjectDashboard;


  window.canManageAlbukhrProjectTreasury =
    canManageAlbukhrProjectTreasury;


  window.canUploadAlbukhrProjectUpdate =
    canUploadAlbukhrProjectUpdate;


  window.guardAlbukhrDashboardAccess =
    guardAlbukhrDashboardAccess;


  window.getResolvedAlbukhrProjects =
    getResolvedAlbukhrProjects;


  window.refreshAlbukhrProjects =
    refreshAlbukhrProjects;


  window.getCurrentAlbukhrNetwork =
    getCurrentAlbukhrNetwork;


  window.getAlbukhrProjectResolverStatus =
    getAlbukhrProjectResolverStatus;


  window.handleAlbukhrNetworkChanged =
    handleAlbukhrNetworkChanged;


  /* =======================================================
     NETWORK EVENT INTEGRATION
  ======================================================= */

  window.addEventListener(

    "albukhr:network-changed",

    event => {

      try{

        const network =
          event?.detail?.network ||
          event?.detail ||
          "";


        handleAlbukhrNetworkChanged(
          network
        );

      }catch(error){

        console.warn(

          "[PROJECT RESOLVER] " +
          "Network change handling failed:",

          error

        );

      }

    }

  );


  /* =======================================================
     READY
  ======================================================= */

  console.log(
    "✅ ALBUKHR Project Resolver v5.0.0 Ready"
  );


})(window);
