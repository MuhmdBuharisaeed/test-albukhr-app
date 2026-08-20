/* =========================================================
   ALBUKHR PROJECT RESOLVER v4
   NETWORK-AWARE • SUPABASE-FIRST • PROJECT-CODE-FIRST
   ---------------------------------------------------------
   PURPOSE:
   - Resolve ALBUKHR projects from the authoritative project engine
   - Support project_code-first resolution
   - Support legacy project_name / slug references
   - Preserve core / internal / external classification
   - Enforce Mainnet / Testnet isolation
   - Provide dashboard / treasury / update permissions
   - Maintain compatibility with existing dashboard APIs
   - Remove LocalStorage as a persistent project source of truth

   ARCHITECTURE:
   Supabase
      ↓
   projects-engine.js
      ↓
   ALBUKHR PROJECT RESOLVER
      ↓
   Dashboard / Treasury / Updates / Marketplace

   DEPENDS ON:
   - js/projects-engine.js
   - Current ALBUKHR Supabase architecture

   IMPORTANT:
   - project_code is authoritative
   - project_type must come from trusted project metadata
   - network isolation is mandatory
   - LocalStorage is NOT a source of truth
========================================================= */

(function(window){

  "use strict";

  /* =======================================================
     VERSION
  ======================================================= */

  const RESOLVER_VERSION = "4.0.0";


  /* =======================================================
     NETWORK CONSTANTS
  ======================================================= */

  const NETWORKS = Object.freeze({
    MAINNET: "mainnet",
    TESTNET: "testnet"
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
     CACHE
  ======================================================= */

  const CACHE = {

    loaded: false,

    loading: false,

    lastUpdate: 0,

    network: "",

    projects: []

  };

  const CACHE_TIME = 10000;


  /* =======================================================
     SAFE HELPERS
  ======================================================= */

  function safeString(value, fallback = ""){

    if(
      value === null ||
      value === undefined
    ){
      return fallback;
    }

    return String(value);

  }


  function safeNumber(value, fallback = 0){

    const n = Number(value);

    return Number.isFinite(n)
      ? n
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
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  }


  function normalizeNetwork(value){

    const network = lower(value);

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


  function uniqueBy(arr, keyGetter){

    const map = new Map();

    (
      Array.isArray(arr)
        ? arr
        : []
    ).forEach(item => {

      const key = keyGetter(item);

      if(!map.has(key)){
        map.set(key, item);
      }

    });

    return Array.from(map.values());

  }


  /* =======================================================
     CURRENT NETWORK
     -------------------------------------------------------
     Priority:
     1. projects-engine network helper
     2. ALBUKHR environment object
     3. hostname
     4. safe default = mainnet
  ======================================================= */

  async function getCurrentAlbukhrNetwork(){

    try{

      if(
        typeof getCurrentNetwork === "function"
      ){

        const network =
          await getCurrentNetwork();

        const normalized =
          normalizeNetwork(network);

        if(normalized){
          return normalized;
        }

      }

    }catch(error){

      console.warn(
        "getCurrentNetwork() failed:",
        error
      );

    }


    try{

      if(
        window.ALBUKHR_NETWORK
      ){

        const normalized =
          normalizeNetwork(
            typeof window.ALBUKHR_NETWORK === "object"
              ? (
                  window.ALBUKHR_NETWORK.network ||
                  window.ALBUKHR_NETWORK.current ||
                  window.ALBUKHR_NETWORK.name
                )
              : window.ALBUKHR_NETWORK
          );

        if(normalized){
          return normalized;
        }

      }

    }catch(error){

      console.warn(
        "ALBUKHR network state unavailable:",
        error
      );

    }


    try{

      const hostname =
        lower(window.location.hostname);

      if(
        hostname === "test.albukhr.com" ||
        hostname.startsWith("test.")
      ){

        return NETWORKS.TESTNET;

      }

      return NETWORKS.MAINNET;

    }catch(error){

      return NETWORKS.MAINNET;

    }

  }


  /* =======================================================
     NETWORK FILTER
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
      normalizeNetwork(
        project.network ||
        project.environment ||
        project.project_network
      );

    /*
      Projects without an explicit network must NOT be
      silently assigned to another network.
    */

    if(!projectNetwork){
      return false;
    }

    return projectNetwork === targetNetwork;

  }


  /* =======================================================
     CURRENT USER / ADMIN
  ======================================================= */

  async function getCurrentAlbukhrAdminRaw(){

    if(
      typeof window.getCurrentAdmin !== "function"
    ){
      return null;
    }

    try{

      return await window.getCurrentAdmin();

    }catch(error){

      console.warn(
        "getCurrentAdmin() failed:",
        error
      );

      return null;

    }

  }


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


  async function getCurrentAlbukhrUser(){

    const admin =
      await getCurrentAlbukhrAdminRaw();

    if(!admin){

      return {

        email: "",

        userid: "",

        username: "",

        role: "",

        isAdmin: false,

        admin: null

      };

    }

    return {

      email:
        safeString(admin.email).trim(),

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
        ).trim(),

      isAdmin: true,

      admin

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
      !user.isAdmin
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
      ["super_admin"]
    );

  }


  function isFinanceAdmin(user){

    return hasAdminRole(
      user,
      ["finance_admin"]
    );

  }


  function isEcosystemAdmin(user){

    return hasAdminRole(
      user,
      ["ecosystem_admin"]
    );

  }


  function isProjectAdmin(user){

    return hasAdminRole(
      user,
      ["project_admin"]
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
      typeof getAllProjects !== "function"
    ){

      throw new Error(
        "projects-engine.js must be loaded before project-resolver.js"
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
      normalizeNetwork(
        network
      ) ||
      await getCurrentAlbukhrNetwork();


    let rows = [];

    try{

      /*
        Network-aware query.

        Current projects-engine should use this value
        when querying Supabase.
      */

      rows =
        await getAllProjects({

          visibleOnly: false,

          activeOnly: false,

          network: targetNetwork

        });

    }catch(error){

      console.error(
        "getAllProjects() failed:",
        error
      );

      return [];

    }


    if(!Array.isArray(rows)){
      return [];
    }


    return rows.filter(project => {

      return projectBelongsToNetwork(
        project,
        targetNetwork
      );

    });

  }


  /* =======================================================
     CORE PROJECTS
     -------------------------------------------------------
     Compatibility adapter.
     No LocalStorage.
  ======================================================= */

  async function loadCoreProjectsFromEngine(
    network = null
  ){

    const targetNetwork =
      normalizeNetwork(network) ||
      await getCurrentAlbukhrNetwork();


    try{

      if(
        typeof getCoreProjects !== "function"
      ){
        return [];
      }

      const rows =
        await getCoreProjects({

          visibleOnly: false,

          activeOnly: false,

          network: targetNetwork

        });


      if(!Array.isArray(rows)){
        return [];
      }


      return rows.filter(project => {

        return projectBelongsToNetwork(
          {
            ...project,
            network:
              project.network ||
              targetNetwork
          },
          targetNetwork
        );

      });

    }catch(error){

      console.warn(
        "getCoreProjects() failed:",
        error
      );

      return [];

    }

  }


  /* =======================================================
     MARKETPLACE PROJECTS
     -------------------------------------------------------
     Compatibility adapter.
  ======================================================= */

  async function loadMarketplaceProjectsFromEngine(
    network = null
  ){

    const targetNetwork =
      normalizeNetwork(network) ||
      await getCurrentAlbukhrNetwork();


    try{

      if(
        typeof getMarketplaceProjects !== "function"
      ){
        return [];
      }

      const rows =
        await getMarketplaceProjects({

          network: targetNetwork

        });


      if(!Array.isArray(rows)){
        return [];
      }


      return rows.filter(project => {

        return projectBelongsToNetwork(
          {
            ...project,
            network:
              project.network ||
              targetNetwork
          },
          targetNetwork
        );

      });

    }catch(error){

      console.warn(
        "getMarketplaceProjects() failed:",
        error
      );

      return [];

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

    if(type === "core"){
      return "core";
    }

    if(type === "internal"){
      return "internal";
    }

    if(type === "external"){
      return "external";
    }

    return "";

  }


  /* =======================================================
     PROJECT NORMALIZATION
     -------------------------------------------------------
     IMPORTANT:
     No name-based type inference.
     No generic-project => internal coercion.
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


    const projectNetwork =
      normalizeNetwork(
        raw.network ||
        raw.environment ||
        raw.project_network ||
        network
      );


    let projectType =
      normalizeProjectType(
        raw.project_type ||
        raw.type ||
        raw.projectType ||
        ""
      );


    /*
      Explicit flags remain supported.
    */

    if(!projectType){

      if(raw.is_core === true){
        projectType = "core";
      }

      else if(raw.is_internal === true){
        projectType = "internal";
      }

      else if(raw.is_external === true){
        projectType = "external";
      }

    }


    /*
      IMPORTANT:

      We do NOT infer project type from project name.

      We do NOT automatically convert an unknown project
      into core/internal/external.

      Unknown remains unknown.
    */


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
        projectType || "unknown",

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
        projectType === "core",

      is_internal:
        projectType === "internal",

      is_external:
        projectType === "external"

    };

  }


  /* =======================================================
     COLLECT ALL PROJECTS
  ======================================================= */

  async function collectAlbukhrProjects(
    options = {}
  ){

    const targetNetwork =
      normalizeNetwork(
        options.network
      ) ||
      await getCurrentAlbukhrNetwork();


    const [
      allProjects,
      coreProjects,
      marketplaceProjects
    ] = await Promise.all([

      loadProjectsFromEngine(
        targetNetwork
      ),

      loadCoreProjectsFromEngine(
        targetNetwork
      ),

      loadMarketplaceProjectsFromEngine(
        targetNetwork
      )

    ]);


    const all = [];


    allProjects.forEach(project => {

      all.push(
        normalizeProject(
          project,
          "projects_engine",
          targetNetwork
        )
      );

    });


    coreProjects.forEach(project => {

      all.push(
        normalizeProject(
          {
            ...project,

            project_type:
              project.project_type ||
              "core"

          },

          "core_engine",

          targetNetwork

        )
      );

    });


    marketplaceProjects.forEach(project => {

      all.push(
        normalizeProject(
          {
            ...project,

            project_type:
              project.project_type ||
              "external"

          },

          "marketplace_engine",

          targetNetwork

        )
      );

    });


    /*
      Final network isolation.
    */

    const networkRows =
      all.filter(project => {

        return (
          project.network ===
          targetNetwork
        );

      });


    /*
      project_code is the canonical
      deduplication identity.
    */

    return uniqueBy(

      networkRows
        .filter(Boolean)
        .filter(project =>
          project.project_code
        ),

      project =>
        normalizeKey(
          project.project_code
        )

    );

  }


  /* =======================================================
     CACHE LOAD
  ======================================================= */

  async function loadProjectCache(
    force = false,
    network = null
  ){

    const targetNetwork =
      normalizeNetwork(network) ||
      await getCurrentAlbukhrNetwork();


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


    if(CACHE.loading){

      return CACHE.projects;

    }


    CACHE.loading = true;


    try{

      const projects =
        await collectAlbukhrProjects({

          network:
            targetNetwork

        });


      CACHE.projects =
        Array.isArray(projects)
          ? projects
          : [];


      CACHE.network =
        targetNetwork;


      CACHE.loaded =
        true;


      CACHE.lastUpdate =
        Date.now();


    }catch(error){

      console.error(
        "ALBUKHR Project Resolver cache load failed:",
        error
      );

    }


    CACHE.loading = false;


    return CACHE.projects;

  }


  /* =======================================================
     CACHE REFRESH
  ======================================================= */

  async function refreshAlbukhrProjects(){

    CACHE.loaded = false;

    CACHE.loading = false;

    CACHE.lastUpdate = 0;

    CACHE.network = "";

    CACHE.projects = [];

    return await loadProjectCache(
      true
    );

  }


  /* =======================================================
     FIND BY CODE
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
     FIND BY NAME
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
     FLEXIBLE REFERENCE
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
      await getCurrentAlbukhrNetwork();


    const projects =
      await loadProjectCache(
        false,
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
     Read-only compatibility.

     We do NOT use LocalStorage as source of truth.
     Existing dashboard pages may still pass their old
     reference through this function while migrating.
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

    }catch(error){}


    /*
      URL query is the preferred compatibility
      mechanism for page-to-page project selection.
    */

    try{

      const params =
        new URLSearchParams(
          window.location.search
        );


      return safeString(
        params.get("project_code") ||
        params.get("project") ||
        params.get("projectRef") ||
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


    return await resolveAlbukhrProject(
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


    const type =
      normalizeProjectType(
        project.project_type
      );


    return type || "unknown";

  }


  function isCoreProject(project){

    return (
      getAlbukhrProjectType(project) ===
      "core"
    );

  }


  function isInternalProject(project){

    return (
      getAlbukhrProjectType(project) ===
      "internal"
    );

  }


  function isExternalProject(project){

    return (
      getAlbukhrProjectType(project) ===
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
      creatorId === currentUserId
    ){
      return true;
    }


    return false;

  }


  /* =======================================================
     DASHBOARD ACCESS
     -------------------------------------------------------
     Rules:
     - super/ecosystem/project admins: allowed
     - core: admin-only
     - internal/external: owner allowed
     - unknown type: denied
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


    const currentNetwork =
      await getCurrentAlbukhrNetwork();


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


    const currentNetwork =
      await getCurrentAlbukhrNetwork();


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


    const currentNetwork =
      await getCurrentAlbukhrNetwork();


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
     DASHBOARD GUARD
  ======================================================= */

  async function guardAlbukhrDashboardAccess({

    projectRef = "",

    requireProject = true,

    network = null

  } = {}){

    const user =
      await getCurrentAlbukhrUser();


    const targetNetwork =
      normalizeNetwork(network) ||
      await getCurrentAlbukhrNetwork();


    const ref =
      safeString(
        projectRef
      ).trim();


    if(!ref){

      if(requireProject){

        return {

          ok: false,

          reason:
            "missing_project",

          project: null,

          user,

          network:
            targetNetwork

        };

      }


      return {

        ok: true,

        reason: null,

        project: null,

        user,

        network:
          targetNetwork

      };

    }


    const project =
      await resolveAlbukhrProject(
        ref,
        {
          network:
            targetNetwork
        }
      );


    if(!project){

      return {

        ok: false,

        reason:
          "project_not_found",

        project: null,

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

        ok: false,

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

        ok: false,

        reason:
          "access_denied",

        project,

        user,

        network:
          targetNetwork

      };

    }


    return {

      ok: true,

      reason: null,

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


    if(type === "core"){
      return "ALBUKHR Core Project Dashboard";
    }


    if(type === "internal"){
      return "ALBUKHR Internal Project Dashboard";
    }


    if(type === "external"){
      return "ALBUKHR External Project Dashboard";
    }


    return "ALBUKHR Project Dashboard";

  }


  function getAlbukhrProjectUpdateTitle(
    project
  ){

    const type =
      getAlbukhrProjectType(
        project
      );


    if(type === "core"){
      return "📸 Core Project Updates";
    }


    if(type === "internal"){
      return "📸 Internal Project Updates";
    }


    if(type === "external"){
      return "📸 External Project Updates";
    }


    return "📸 Project Updates";

  }


  function getAlbukhrProjectTypeLabel(
    project
  ){

    const type =
      getAlbukhrProjectType(
        project
      );


    if(type === "core"){
      return "Core Project";
    }


    if(type === "internal"){
      return "Internal Project";
    }


    if(type === "external"){
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
      await getCurrentAlbukhrNetwork();


    return await loadProjectCache(
      !!options.forceRefresh,
      network
    );

  }


  /* =======================================================
     PROJECT CACHE STATUS
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
        CACHE.lastUpdate

    };

  }


  /* =======================================================
     NETWORK CHANGE HANDLER
     -------------------------------------------------------
     Allows environment-switching logic to invalidate
     project cache without changing the Dock Navigation.
  ======================================================= */

  function handleAlbukhrNetworkChanged(
    network
  ){

    const normalized =
      normalizeNetwork(
        network
      );


    if(
      !normalized ||
      CACHE.network === normalized
    ){
      return;
    }


    CACHE.loaded = false;

    CACHE.lastUpdate = 0;

    CACHE.network = "";

    CACHE.projects = [];

  }


  /* =======================================================
     PUBLIC NAMESPACE
  ======================================================= */

  window.ALBUKHR_PROJECT_RESOLVER = {

    version:
      RESOLVER_VERSION,

    NETWORKS,

    ADMIN_ROLES,

    safeString,

    safeNumber,

    lower,

    normalizeKey,

    slugifyProjectRef,

    normalizeNetwork,

    getCurrentAlbukhrNetwork,

    getCurrentAlbukhrEmail,

    getCurrentAlbukhrAdminRaw,

    getCurrentAlbukhrUser,

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

    canAccessAlbukhrProjectDashboard,

    canManageAlbukhrProjectTreasury,

    canUploadAlbukhrProjectUpdate,

    guardAlbukhrDashboardAccess,

    getAlbukhrDashboardTitle,

    getAlbukhrProjectUpdateTitle,

    getAlbukhrProjectTypeLabel,

    refreshAlbukhrProjects,

    getAlbukhrProjectResolverStatus,

    handleAlbukhrNetworkChanged

  };


  /* =======================================================
     GLOBAL COMPATIBILITY EXPORTS
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
     OPTIONAL NETWORK EVENT INTEGRATION
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
          "ALBUKHR network change handling failed:",
          error
        );

      }

    }
  );


})();
