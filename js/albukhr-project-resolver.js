/* =========================================
   ALBUKHR PROJECT RESOLVER v2 FINAL PATCHED
   SAFE MIGRATION LAYER FOR SINGLE / UNIVERSAL DASHBOARD
   ------------------------------------------------
   PURPOSE:
   - Resolve ALBUKHR project from localStorage/projectRef
   - Support project_code-first and old project_name fallback
   - Identify project_type correctly: core/internal/external
   - Provide dashboard access rules
   - Provide treasury/update permission rules
   - Work with old dashboard pages without breaking them

   IMPORTANT PATCH:
   - REMOVED dangerous name-based CORE fallback
   - project_type is now trusted from real source first
   - no more accidental "Barsh Agro => core" coercion
========================================= */

(function(){
  "use strict";

  const RESOLVER_VERSION = "2.0.0";

  const ADMIN_ROLES = [
    "super_admin",
    "ecosystem_admin",
    "finance_admin",
    "project_admin"
  ];

  /* =========================================
     SAFE HELPERS
  ========================================= */
  function safeString(value, fallback = ""){
    if(value === null || value === undefined) return fallback;
    return String(value);
  }

  function safeNumber(value, fallback = 0){
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function lower(value){
    return safeString(value).trim().toLowerCase();
  }

  function normalizeKey(value){
    return lower(value).replace(/\s+/g, " ").trim();
  }

  function slugifyProjectRef(value){
    return lower(value)
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function uniqueBy(arr, keyGetter){
    const map = new Map();
    (Array.isArray(arr) ? arr : []).forEach(item => {
      const key = keyGetter(item);
      if(!map.has(key)){
        map.set(key, item);
      }
    });
    return Array.from(map.values());
  }

  /* =========================================
     CURRENT USER / ADMIN HELPERS
  ========================================= */
  function getCurrentAlbukhrEmail(){
    return safeString(
      localStorage.getItem("albukhr_current_email") ||
      localStorage.getItem("albukhr_user_email") ||
      ""
    ).trim();
  }

  function getCurrentAlbukhrAdminRaw(){
    try{
      if(typeof getAdmin === "function"){
        return getAdmin() || null;
      }
    }catch(e){
      console.warn("getAdmin() failed:", e);
    }

    try{
      const raw =
        localStorage.getItem("albukhr_admin") ||
        localStorage.getItem("albukhr_current_admin");

      if(raw){
        return JSON.parse(raw);
      }
    }catch(e){
      console.warn("Admin localStorage parse failed:", e);
    }

    return null;
  }

  function getCurrentAlbukhrUser(){
    const admin = getCurrentAlbukhrAdminRaw();
    const email = getCurrentAlbukhrEmail();

    const role =
      safeString(admin?.role || admin?.admin_role || "").trim().toLowerCase();

    return {
      email,
      userid: email,
      username: safeString(admin?.username || admin?.name || email || ""),
      role,
      isAdmin: !!admin,
      admin
    };
  }

  function hasAdminRole(user, roles = []){
    if(!user || !user.isAdmin) return false;
    const role = lower(user.role);
    return roles.map(lower).includes(role);
  }

  function isSuperAdmin(user){
    return hasAdminRole(user, ["super_admin"]);
  }

  function isFinanceAdmin(user){
    return hasAdminRole(user, ["finance_admin"]);
  }

  function isEcosystemAdmin(user){
    return hasAdminRole(user, ["ecosystem_admin"]);
  }

  function isProjectAdmin(user){
    return hasAdminRole(user, ["project_admin"]);
  }

  function isAnyProjectAdmin(user){
    return hasAdminRole(user, ADMIN_ROLES);
  }

  /* =========================================
     RAW SOURCE LOADERS
  ========================================= */
  async function loadProjectsFromEngine(){
    const out = [];

    try{
      if(typeof getAllProjects === "function"){
        const rows = await getAllProjects({
          visibleOnly:false,
          activeOnly:false
        });

        if(Array.isArray(rows)){
          out.push(...rows);
        }
      }
    }catch(e){
      console.warn("getAllProjects failed:", e);
    }

    return out;
  }

  async function loadCoreProjectsFromEngine(){
    const out = [];

    try{
      if(typeof getCoreProjects === "function"){
        const rows = await getCoreProjects({
          visibleOnly:false,
          activeOnly:false
        });

        if(Array.isArray(rows)){
          out.push(...rows);
        }
      }
    }catch(e){
      console.warn("getCoreProjects failed:", e);
    }

    return out;
  }

  async function loadMarketplaceProjectsFromEngine(){
    const out = [];

    try{
      if(typeof getMarketplaceProjects === "function"){
        const rows = await getMarketplaceProjects();
        if(Array.isArray(rows)){
          out.push(...rows);
        }
      }
    }catch(e){
      console.warn("getMarketplaceProjects failed:", e);
    }

    return out;
  }

  function loadInternalProjectsFromLocalStorage(){
    try{
      const rows = JSON.parse(
        localStorage.getItem("albukhr_internal_projects") || "[]"
      );

      return Array.isArray(rows) ? rows : [];
    }catch(e){
      console.warn("albukhr_internal_projects parse failed:", e);
      return [];
    }
  }

  function loadMarketplaceProjectsFromLocalStorage(){
    try{
      const rows = JSON.parse(
        localStorage.getItem("albukhr_marketplace_projects") || "[]"
      );

      return Array.isArray(rows) ? rows : [];
    }catch(e){
      console.warn("albukhr_marketplace_projects parse failed:", e);
      return [];
    }
  }

  /* =========================================
     TYPE NORMALIZER
  ========================================= */
  function normalizeProjectType(value){
    const t = lower(value);
    if(t === "core") return "core";
    if(t === "internal") return "internal";
    if(t === "external") return "external";
    return "";
  }

  /* =========================================
     PROJECT NORMALIZATION
  ========================================= */
  function normalizeProject(raw = {}, source = "unknown"){
    const projectCode =
      safeString(
        raw.project_code ||
        raw.code ||
        raw.projectCode ||
        raw.slug ||
        raw.id ||
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

    let projectType = normalizeProjectType(
      raw.project_type ||
      raw.type ||
      raw.projectType ||
      ""
    );

    /* -----------------------------------------
       TRUST EXPLICIT FLAGS FIRST
    ----------------------------------------- */
    if(!projectType){
      if(raw.is_core === true || raw.core === true){
        projectType = "core";
      }else if(raw.internal === true){
        projectType = "internal";
      }else if(raw.external === true){
        projectType = "external";
      }
    }

    /* -----------------------------------------
       SAFE SOURCE-BASED FALLBACK ONLY
       NO NAME-BASED CORE FALLBACK ANYMORE
    ----------------------------------------- */
    if(!projectType){
      if(source === "core_engine"){
        projectType = "core";
      }else if(source === "marketplace_engine" || source === "marketplace_local"){
        projectType = "external";
      }else if(source === "internal_local"){
        projectType = "internal";
      }else{
        /*
          Default safe fallback:
          if a project exists in generic projects engine
          and type is missing, do NOT force core by name.
          keep it internal unless explicitly marked otherwise.
        */
        projectType = "internal";
      }
    }

    const creatorUserid =
      safeString(
        raw.creator_userid ||
        raw.creatorUserId ||
        raw.creator_email ||
        raw.email ||
        raw.creator ||
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
      lower(raw.status || raw.project_status || "active") || "active";

    return {
      id: raw.id ?? null,
      project_code: projectCode || slugifyProjectRef(projectName),
      project_name: projectName || projectCode || "Unnamed Project",
      project_type: projectType,
      description: safeString(raw.description || "Albukhr Project"),
      icon: safeString(raw.icon || "📦"),
      status,
      reward_rate: safeNumber(raw.reward_rate, 0),
      reserve_percent: safeNumber(raw.reserve_percent, 0.30),
      min_liquidity: safeNumber(raw.min_liquidity, 100),

      creator_userid: creatorUserid,
      creator_username: creatorUsername,

      source,
      raw,

      is_core: projectType === "core",
      is_internal: projectType === "internal",
      is_external: projectType === "external"
    };
  }

  /* =========================================
     COLLECT ALL PROJECTS
  ========================================= */
  async function collectAlbukhrProjects(){
    const all = [];

    const [
      allProjects,
      coreProjects,
      marketplaceEngineProjects
    ] = await Promise.all([
      loadProjectsFromEngine(),
      loadCoreProjectsFromEngine(),
      loadMarketplaceProjectsFromEngine()
    ]);

    allProjects.forEach(p => {
      all.push(normalizeProject(p, "projects_engine"));
    });

    coreProjects.forEach(p => {
      all.push(normalizeProject(
        { ...p, project_type: p.project_type || "core" },
        "core_engine"
      ));
    });

    marketplaceEngineProjects.forEach(p => {
      all.push(normalizeProject(
        { ...p, project_type: p.project_type || "external" },
        "marketplace_engine"
      ));
    });

    loadInternalProjectsFromLocalStorage().forEach(p => {
      all.push(normalizeProject(
        {
          ...p,
          project_name: p.project_name || p.projectName || p.name,
          project_code: p.project_code || p.projectCode,
          project_type: p.project_type || "internal"
        },
        "internal_local"
      ));
    });

    loadMarketplaceProjectsFromLocalStorage().forEach(p => {
      all.push(normalizeProject(
        {
          ...p,
          project_name: p.project_name || p.projectName || p.name,
          project_code: p.project_code || p.projectCode,
          project_type: p.project_type || "external"
        },
        "marketplace_local"
      ));
    });

    return uniqueBy(
      all.filter(Boolean).filter(p => p.project_code || p.project_name),
      p => `${normalizeKey(p.project_code)}::${normalizeKey(p.project_name)}`
    );
  }

  /* =========================================
     FINDERS
  ========================================= */
  function findProjectByCode(projects = [], projectCode = ""){
    const key = normalizeKey(projectCode);
    if(!key) return null;

    return projects.find(p =>
      normalizeKey(p.project_code) === key
    ) || null;
  }

  function findProjectByName(projects = [], projectName = ""){
    const key = normalizeKey(projectName);
    if(!key) return null;

    return projects.find(p =>
      normalizeKey(p.project_name) === key
    ) || null;
  }

  function findProjectByFlexibleRef(projects = [], projectRef = ""){
    const ref = safeString(projectRef).trim();
    if(!ref) return null;

    const byCode = findProjectByCode(projects, ref);
    if(byCode) return byCode;

    const byName = findProjectByName(projects, ref);
    if(byName) return byName;

    const slugRef = slugifyProjectRef(ref);

    return projects.find(p =>
      slugifyProjectRef(p.project_code) === slugRef ||
      slugifyProjectRef(p.project_name) === slugRef
    ) || null;
  }

  /* =========================================
     RESOLVE PROJECT
  ========================================= */
  async function resolveAlbukhrProject(projectRef){
    const ref = safeString(projectRef).trim();
    if(!ref) return null;

    const projects = await collectAlbukhrProjects();
    return findProjectByFlexibleRef(projects, ref);
  }

  async function resolveCurrentAlbukhrProject(){
    const ref =
      safeString(localStorage.getItem("albukhr_current_project")).trim();

    if(!ref) return null;

    return await resolveAlbukhrProject(ref);
  }

  /* =========================================
     PROJECT TYPE HELPERS
  ========================================= */
  function getAlbukhrProjectType(project){
    if(!project) return "unknown";

    if(project.is_core || lower(project.project_type) === "core"){
      return "core";
    }

    if(project.is_external || lower(project.project_type) === "external"){
      return "external";
    }

    if(project.is_internal || lower(project.project_type) === "internal"){
      return "internal";
    }

    return "unknown";
  }

  function isCoreProject(project){
    return getAlbukhrProjectType(project) === "core";
  }

  function isInternalProject(project){
    return getAlbukhrProjectType(project) === "internal";
  }

  function isExternalProject(project){
    return getAlbukhrProjectType(project) === "external";
  }

  /* =========================================
     ACCESS RULES
  ========================================= */
  function canAccessAlbukhrProjectDashboard(project, user = null){
    if(!project) return false;

    user = user || getCurrentAlbukhrUser();

    if(isAnyProjectAdmin(user)){
      return true;
    }

    if(isCoreProject(project)){
      return false;
    }

    const creatorId = lower(project.creator_userid);
    const currentUserId = lower(user.userid || user.email);

    if(creatorId && creatorId === currentUserId){
      return true;
    }

    return false;
  }

  /* =========================================
     TREASURY RULES
  ========================================= */
  function canManageAlbukhrProjectTreasury(project, user = null){
    if(!project) return false;

    user = user || getCurrentAlbukhrUser();

    if(
      isSuperAdmin(user) ||
      isFinanceAdmin(user) ||
      isEcosystemAdmin(user)
    ){
      return true;
    }

    return false;
  }

  /* =========================================
     UPDATE RULES
  ========================================= */
  function canUploadAlbukhrProjectUpdate(project, user = null){
    if(!project) return false;

    user = user || getCurrentAlbukhrUser();

    if(isAnyProjectAdmin(user)){
      return true;
    }

    const creatorId = lower(project.creator_userid);
    const currentUserId = lower(user.userid || user.email);

    if(
      (isInternalProject(project) || isExternalProject(project)) &&
      creatorId &&
      creatorId === currentUserId
    ){
      return true;
    }

    return false;
  }

  /* =========================================
     SAFE DASHBOARD GUARD
  ========================================= */
  async function guardAlbukhrDashboardAccess({
    projectRef = "",
    requireProject = true
  } = {}){

    const user = getCurrentAlbukhrUser();

    const ref =
      safeString(projectRef || localStorage.getItem("albukhr_current_project"))
        .trim();

    if(!ref){
      if(requireProject){
        return {
          ok:false,
          reason:"missing_project",
          project:null,
          user
        };
      }

      return {
        ok:true,
        reason:null,
        project:null,
        user
      };
    }

    const project = await resolveAlbukhrProject(ref);

    if(!project){
      return {
        ok:false,
        reason:"project_not_found",
        project:null,
        user
      };
    }

    if(!canAccessAlbukhrProjectDashboard(project, user)){
      return {
        ok:false,
        reason:"access_denied",
        project,
        user
      };
    }

    return {
      ok:true,
      reason:null,
      project,
      user
    };
  }

  /* =========================================
     UI HELPERS
  ========================================= */
  function getAlbukhrDashboardTitle(project){
    const type = getAlbukhrProjectType(project);

    if(type === "core") return "ALBUKHR Core Project Dashboard";
    if(type === "internal") return "ALBUKHR Internal Project Dashboard";
    if(type === "external") return "ALBUKHR External Project Dashboard";

    return "ALBUKHR Project Dashboard";
  }

  function getAlbukhrProjectUpdateTitle(project){
    const type = getAlbukhrProjectType(project);

    if(type === "core") return "📸 Core Project Updates";
    if(type === "internal") return "📸 Internal Project Updates";
    if(type === "external") return "📸 External Project Updates";

    return "📸 Project Updates";
  }

  function getAlbukhrProjectTypeLabel(project){
    const type = getAlbukhrProjectType(project);

    if(type === "core") return "Core Project";
    if(type === "internal") return "Internal Project";
    if(type === "external") return "External Project";

    return "Project";
  }

  /* =========================================
     LEGACY STORAGE NORMALIZERS
  ========================================= */
  async function normalizeAlbukhrCurrentProjectStorage(){
    const raw =
      safeString(localStorage.getItem("albukhr_current_project")).trim();

    if(!raw) return null;

    const project = await resolveAlbukhrProject(raw);
    if(!project) return null;

    if(project.project_code){
      localStorage.setItem("albukhr_current_project", project.project_code);
    }

    return project;
  }

  async function normalizeAlbukhrUpdateProjectStorage(){
    const raw =
      safeString(localStorage.getItem("albukhr_update_project")).trim();

    if(!raw) return null;

    const project = await resolveAlbukhrProject(raw);
    if(!project) return null;

    if(project.project_code){
      localStorage.setItem("albukhr_update_project", project.project_code);
    }

    return project;
  }

  /* =========================================
     PUBLIC EXPORTS
  ========================================= */
  window.ALBUKHR_PROJECT_RESOLVER = {
    version: RESOLVER_VERSION,
    ADMIN_ROLES,

    safeString,
    safeNumber,
    lower,
    normalizeKey,
    slugifyProjectRef,

    getCurrentAlbukhrEmail,
    getCurrentAlbukhrAdminRaw,
    getCurrentAlbukhrUser,

    isSuperAdmin,
    isFinanceAdmin,
    isEcosystemAdmin,
    isProjectAdmin,
    isAnyProjectAdmin,

    normalizeProject,
    collectAlbukhrProjects,

    findProjectByCode,
    findProjectByName,
    findProjectByFlexibleRef,

    resolveAlbukhrProject,
    resolveCurrentAlbukhrProject,

    getAlbukhrProjectType,
    isCoreProject,
    isInternalProject,
    isExternalProject,

    canAccessAlbukhrProjectDashboard,
    canManageAlbukhrProjectTreasury,
    canUploadAlbukhrProjectUpdate,

    guardAlbukhrDashboardAccess,

    getAlbukhrDashboardTitle,
    getAlbukhrProjectUpdateTitle,
    getAlbukhrProjectTypeLabel,

    normalizeAlbukhrCurrentProjectStorage,
    normalizeAlbukhrUpdateProjectStorage
  };

  window.resolveAlbukhrProject = resolveAlbukhrProject;
  window.resolveCurrentAlbukhrProject = resolveCurrentAlbukhrProject;
  window.getAlbukhrProjectType = getAlbukhrProjectType;
  window.canAccessAlbukhrProjectDashboard = canAccessAlbukhrProjectDashboard;
  window.canManageAlbukhrProjectTreasury = canManageAlbukhrProjectTreasury;
  window.canUploadAlbukhrProjectUpdate = canUploadAlbukhrProjectUpdate;
  window.guardAlbukhrDashboardAccess = guardAlbukhrDashboardAccess;
  window.normalizeAlbukhrCurrentProjectStorage = normalizeAlbukhrCurrentProjectStorage;
  window.normalizeAlbukhrUpdateProjectStorage = normalizeAlbukhrUpdateProjectStorage;

})();
