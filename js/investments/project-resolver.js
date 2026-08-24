/* =========================================================
   ALBUKHR PROJECT RESOLVER
   Version 6.0.0
   LOCATION: js/investments/project-resolver.js

   ARCHITECTURE:
     environment-switcher.js
          ↓
     supabase-core.js
          ↓
     authoritative projects engine
          ↓
     project-resolver.js
          ↓
     investment / staking / treasury / dashboard / marketplace

   RULES:
   - project_code is canonical identity
   - project network is mandatory
   - MAINNET/TESTNET isolation is strict
   - network comes from ALBUKHR Environment Core
   - project data comes from authoritative Projects Engine
   - Pioneer identity comes from Pi Auth Core
   - admin identity is consumed only through shared admin APIs
   - no LocalStorage
   - no sessionStorage
   - no direct Supabase client
   - no direct REST
   - no UI modification
========================================================= */

(function(window){
  "use strict";

  const RESOLVER_VERSION = "6.0.0";

  const NETWORKS = Object.freeze({
    MAINNET: "mainnet",
    TESTNET: "testnet"
  });

  const ADMIN_ROLES = Object.freeze([
    "super_admin",
    "ecosystem_admin",
    "finance_admin",
    "project_admin"
  ]);

  const CACHE_TIME = 10000;

  const CACHE = {
    loaded:false,
    loading:false,
    loadingPromise:null,
    lastUpdate:0,
    network:"",
    projects:[],
    lastError:null
  };

  class AlbukhrProjectResolverError extends Error {
    constructor(message, code="PROJECT_RESOLVER_ERROR", details=null){
      super(message);
      this.name="AlbukhrProjectResolverError";
      this.code=code;
      this.details=details;
    }
  }

  function safeString(value,fallback=""){
    return value===null||value===undefined?fallback:String(value);
  }

  function safeNumber(value,fallback=0){
    const n=Number(value);
    return Number.isFinite(n)?n:fallback;
  }

  function lower(value){ return safeString(value).trim().toLowerCase(); }

  function normalizeKey(value){ return lower(value).replace(/\s+/g," ").trim(); }

  function slugifyProjectRef(value){
    return lower(value)
      .replace(/[^a-z0-9]+/g,"_")
      .replace(/^_+|_+$/g,"");
  }

  function normalizeNetwork(value){
    const n=lower(value);
    if(n==="mainnet"||n==="main") return NETWORKS.MAINNET;
    if(n==="testnet"||n==="test"||n==="dev"||n==="development") return NETWORKS.TESTNET;
    return "";
  }

  function uniqueBy(array,keyGetter){
    const map=new Map();
    (Array.isArray(array)?array:[]).forEach(item=>{
      const key=keyGetter(item);
      if(key&&!map.has(key)) map.set(key,item);
    });
    return Array.from(map.values());
  }

  /* =======================================================
     NETWORK CORE
  ======================================================= */

  async function getCurrentAlbukhrNetwork(){
    try{
      if(typeof window.requireAlbukhrNetwork==="function"){
        return assertNetwork(await window.requireAlbukhrNetwork());
      }
      if(typeof window.getAlbukhrNetwork==="function"){
        return assertNetwork(await window.getAlbukhrNetwork());
      }
    }catch(error){
      if(error instanceof AlbukhrProjectResolverError) throw error;
      throw new AlbukhrProjectResolverError(
        "ALBUKHR network resolution failed.",
        "NETWORK_RESOLUTION_ERROR",
        error
      );
    }
    throw new AlbukhrProjectResolverError(
      "ALBUKHR Environment Core is not loaded.",
      "NETWORK_CORE_UNAVAILABLE"
    );
  }

  async function requireCurrentAlbukhrNetwork(){ return getCurrentAlbukhrNetwork(); }

  function assertNetwork(network){
    const normalized=normalizeNetwork(network);
    if(!normalized){
      throw new AlbukhrProjectResolverError(
        "Invalid or unknown ALBUKHR network.",
        "INVALID_NETWORK",
        {network}
      );
    }
    return normalized;
  }

  function getProjectNetwork(project){
    if(!project) return "";
    return normalizeNetwork(
      project.network ?? project.environment ?? project.project_network
    );
  }

  function projectBelongsToNetwork(project,network){
    if(!project) return false;
    const target=normalizeNetwork(network);
    if(!target) return false;
    const projectNetwork=getProjectNetwork(project);
    return !!projectNetwork&&projectNetwork===target;
  }

  /* =======================================================
     USER / PIONEER IDENTITY
  ======================================================= */

  async function getCurrentAlbukhrUser(){
    let user=null;
    try{
      if(typeof window.ensurePiAuth==="function"){
        user=await window.ensurePiAuth();
      }else if(window.AlbukhrPiAuth){
        if(typeof window.AlbukhrPiAuth.getCurrentUser==="function"){
          user=window.AlbukhrPiAuth.getCurrentUser();
        }
        if(!user&&typeof window.AlbukhrPiAuth.ensurePiAuth==="function"){
          user=await window.AlbukhrPiAuth.ensurePiAuth();
        }
      }else if(typeof window.getCurrentUser==="function"){
        user=window.getCurrentUser();
      }
    }catch(error){
      return {
        email:"",userid:"",username:"",role:"",wallet_address:"",
        isAdmin:false,isAuthenticated:false,authStatus:"error",
        user:null,error
      };
    }

    if(!user?.uid){
      return {
        email:"",userid:"",username:"",role:"",wallet_address:"",
        isAdmin:false,isAuthenticated:false,authStatus:"unauthenticated",
        user:null,error:null
      };
    }

    return {
      email:safeString(user.email||user.user_metadata?.email).trim(),
      userid:safeString(user.uid||user.userid||user.user_id).trim(),
      username:safeString(user.username||user.user_metadata?.username).trim(),
      role:safeString(user.role||user.role_code).trim().toLowerCase(),
      wallet_address:safeString(user.wallet_address||user.walletAddress||user.wallet).trim(),
      isAdmin:false,
      isAuthenticated:true,
      authStatus:"active",
      user,
      error:null
    };
  }

  /* =======================================================
     ADMIN COMPATIBILITY
     -------------------------------------------------------
     This resolver never owns admin authentication and never
     reads browser storage. It consumes shared structured APIs.
  ======================================================= */

  async function getCurrentAlbukhrAdminResult(){
    if(typeof window.getCurrentAdminResult==="function"){
      try{
        return await window.getCurrentAdminResult();
      }catch(error){
        return {ok:false,authenticated:false,status:"error",admin:null,error};
      }
    }

    if(typeof window.getCurrentAdmin==="function"){
      try{
        const admin=await window.getCurrentAdmin();
        return admin
          ? {ok:true,authenticated:true,status:"active",admin,error:null}
          : {ok:true,authenticated:false,status:"unauthenticated",admin:null,error:null};
      }catch(error){
        return {ok:false,authenticated:false,status:"error",admin:null,error};
      }
    }

    return {ok:true,authenticated:false,status:"unavailable",admin:null,error:null};
  }

  async function getCurrentAlbukhrAdminRaw(){
    const result=await getCurrentAlbukhrAdminResult();
    return result?.admin||null;
  }

  async function getCurrentAlbukhrEmail(){
    const admin=await getCurrentAlbukhrAdminRaw();
    return safeString(admin?.email||admin?.admin_email).trim();
  }

  async function getCurrentAlbukhrActor(){
    const result=await getCurrentAlbukhrAdminResult();
    if(result?.status==="active"&&result.admin){
      const admin=result.admin;
      return {
        email:safeString(admin.email||admin.admin_email).trim(),
        userid:safeString(admin.auth_user_id||admin.userid||admin.user_id).trim(),
        username:safeString(admin.username).trim(),
        role:safeString(admin.role_code||admin.role).trim().toLowerCase(),
        isAdmin:true,isAuthenticated:true,authStatus:"active",admin
      };
    }
    return getCurrentAlbukhrUser();
  }

  function hasAdminRole(user,roles=[]){
    if(!user||user.isAdmin!==true) return false;
    return roles.map(lower).includes(lower(user.role));
  }

  function isSuperAdmin(user){ return hasAdminRole(user,["super_admin"]); }
  function isFinanceAdmin(user){ return hasAdminRole(user,["finance_admin"]); }
  function isEcosystemAdmin(user){ return hasAdminRole(user,["ecosystem_admin"]); }
  function isProjectAdmin(user){ return hasAdminRole(user,["project_admin"]); }
  function isAnyProjectAdmin(user){ return hasAdminRole(user,ADMIN_ROLES); }

  async function getEffectiveAccessUser(user=null){
    if(user) return user;
    const adminResult=await getCurrentAlbukhrAdminResult();
    if(adminResult?.status==="active"&&adminResult.admin){
      const admin=adminResult.admin;
      return {
        email:safeString(admin.email||admin.admin_email).trim(),
        userid:safeString(admin.auth_user_id||admin.userid||admin.user_id).trim(),
        username:safeString(admin.username).trim(),
        role:safeString(admin.role_code||admin.role).trim().toLowerCase(),
        isAdmin:true,isAuthenticated:true,authStatus:"active",admin
      };
    }
    return getCurrentAlbukhrUser();
  }

  /* =======================================================
     AUTHORITATIVE PROJECT ENGINE
  ======================================================= */

  function assertProjectEngine(){
    if(typeof window.getAllProjects!=="function"){
      throw new AlbukhrProjectResolverError(
        "Authoritative ALBUKHR Projects Engine is not loaded.",
        "PROJECT_ENGINE_UNAVAILABLE"
      );
    }
  }

  async function loadProjectsFromEngine(network=null){
    assertProjectEngine();
    const target=normalizeNetwork(network)||await requireCurrentAlbukhrNetwork();
    const rows=await window.getAllProjects({
      visibleOnly:false,
      activeOnly:false,
      network:target
    });
    if(!Array.isArray(rows)){
      throw new AlbukhrProjectResolverError(
        "Project engine returned an invalid result.",
        "INVALID_PROJECT_ENGINE_RESULT"
      );
    }
    return rows.filter(p=>projectBelongsToNetwork(p,target));
  }

  async function loadCoreProjectsFromEngine(network=null){
    const target=normalizeNetwork(network)||await requireCurrentAlbukhrNetwork();
    if(typeof window.getCoreProjects!=="function") return [];
    const rows=await window.getCoreProjects({visibleOnly:false,activeOnly:false,network:target});
    if(!Array.isArray(rows)) throw new AlbukhrProjectResolverError(
      "Core project engine returned an invalid result.",
      "INVALID_CORE_PROJECT_RESULT"
    );
    return rows.filter(p=>projectBelongsToNetwork(p,target));
  }

  async function loadMarketplaceProjectsFromEngine(network=null){
    const target=normalizeNetwork(network)||await requireCurrentAlbukhrNetwork();
    if(typeof window.getMarketplaceProjects!=="function") return [];
    const rows=await window.getMarketplaceProjects({network:target});
    if(!Array.isArray(rows)) throw new AlbukhrProjectResolverError(
      "Marketplace project engine returned an invalid result.",
      "INVALID_MARKETPLACE_PROJECT_RESULT"
    );
    return rows.filter(p=>projectBelongsToNetwork(p,target));
  }

  function normalizeProjectType(value){
    const t=lower(value);
    if(t==="core") return "core";
    if(t==="internal") return "internal";
    if(t==="external") return "external";
    return "";
  }

  function normalizeProject(raw={},source="unknown"){
    const code=safeString(
      raw.project_code||raw.code||raw.projectCode||""
    ).trim();
    const name=safeString(
      raw.project_name||raw.projectName||raw.name||raw.title||code
    ).trim();
    const network=getProjectNetwork(raw);

    let type=normalizeProjectType(
      raw.project_type||raw.projectType||raw.type||""
    );
    if(!type){
      if(raw.is_core===true) type="core";
      else if(raw.is_internal===true) type="internal";
      else if(raw.is_external===true) type="external";
    }

    const creatorUserid=safeString(
      raw.creator_userid||raw.creator_user_id||raw.creatorUserId||
      raw.creator_auth_user_id||raw.owner_userid||raw.owner_user_id||
      raw.owner_auth_user_id||""
    ).trim();

    const creatorUsername=safeString(
      raw.creator_username||raw.creatorUsername||raw.creator_name||
      raw.owner_username||raw.owner_name||raw.username||""
    ).trim();

    return {
      id:raw.id??null,
      project_code:code||slugifyProjectRef(name),
      project_name:name||code||"Unnamed Project",
      project_type:type||"unknown",
      network,
      description:safeString(raw.description||raw.desc||"ALBUKHR Project"),
      info:safeString(raw.info||"Project information not available."),
      icon:safeString(raw.icon||"📦"),
      status:lower(raw.status||raw.project_status||"active")||"active",
      reward_rate:safeNumber(raw.reward_rate,0),
      reserve_percent:safeNumber(raw.reserve_percent,.30),
      min_liquidity:safeNumber(raw.min_liquidity,100),
      durations:Array.isArray(raw.durations)?raw.durations:[30,60,90],
      is_visible:raw.is_visible!==false,
      treasury_enabled:raw.treasury_enabled!==false,
      staking_enabled:raw.staking_enabled!==false,
      contributions_enabled:raw.contributions_enabled!==false,
      creator_userid:creatorUserid,
      creator_username:creatorUsername,
      source,raw,
      is_core:type==="core",
      is_internal:type==="internal",
      is_external:type==="external"
    };
  }

  async function collectAlbukhrProjects(options={}){
    const target=normalizeNetwork(options.network)||await requireCurrentAlbukhrNetwork();

    /* Authoritative project engine is mandatory. */
    const all=await loadProjectsFromEngine(target);
    const core=await loadCoreProjectsFromEngine(target);
    const marketplace=await loadMarketplaceProjectsFromEngine(target);

    const normalized=[
      ...all.map(p=>normalizeProject(p,"projects_engine")),
      ...core.map(p=>normalizeProject(p,"core_engine")),
      ...marketplace.map(p=>normalizeProject(p,"marketplace_engine"))
    ].filter(p=>projectBelongsToNetwork(p,target));

    const projects=uniqueBy(
      normalized.filter(p=>p.project_code),
      p=>normalizeKey(p.project_code)
    );

    return {
      projects,
      network:target,
      source_errors:[],
      authoritative_available:true,
      loaded_at:Date.now()
    };
  }

  /* =======================================================
     IN-MEMORY CACHE
  ======================================================= */

  async function loadProjectCache(force=false,network=null){
    const target=normalizeNetwork(network)||await requireCurrentAlbukhrNetwork();
    const now=Date.now();

    if(!force&&CACHE.loaded&&CACHE.network===target&&now-CACHE.lastUpdate<CACHE_TIME){
      return CACHE.projects;
    }

    if(CACHE.loading&&CACHE.loadingPromise&&CACHE.network===target){
      return CACHE.loadingPromise;
    }

    CACHE.loading=true;
    CACHE.lastError=null;
    CACHE.network=target;

    CACHE.loadingPromise=(async()=>{
      try{
        const result=await collectAlbukhrProjects({network:target});
        CACHE.projects=result.projects;
        CACHE.loaded=true;
        CACHE.lastUpdate=Date.now();
        CACHE.lastError=null;
        return CACHE.projects;
      }catch(error){
        CACHE.lastError=error;
        if(CACHE.loaded&&CACHE.network===target&&Array.isArray(CACHE.projects)){
          console.warn(
            "[PROJECT RESOLVER] Keeping previous valid project cache after refresh failure.",
            error
          );
          return CACHE.projects;
        }
        throw error;
      }finally{
        CACHE.loading=false;
        CACHE.loadingPromise=null;
      }
    })();

    return CACHE.loadingPromise;
  }

  async function refreshAlbukhrProjects(){
    CACHE.loaded=false;
    CACHE.loading=false;
    CACHE.loadingPromise=null;
    CACHE.lastUpdate=0;
    CACHE.network="";
    CACHE.projects=[];
    CACHE.lastError=null;
    return loadProjectCache(true);
  }

  function invalidateAlbukhrProjectCache(){
    CACHE.loaded=false;
    CACHE.loading=false;
    CACHE.loadingPromise=null;
    CACHE.lastUpdate=0;
    CACHE.network="";
    CACHE.projects=[];
    CACHE.lastError=null;
  }

  /* =======================================================
     FINDERS / RESOLUTION
  ======================================================= */

  function findProjectByCode(projects=[],projectCode=""){
    const key=normalizeKey(projectCode);
    if(!key) return null;
    return projects.find(p=>normalizeKey(p.project_code)===key)||null;
  }

  function findProjectByName(projects=[],projectName=""){
    const key=normalizeKey(projectName);
    if(!key) return null;
    return projects.find(p=>normalizeKey(p.project_name)===key)||null;
  }

  function findProjectByFlexibleRef(projects=[],projectRef=""){
    const ref=safeString(projectRef).trim();
    if(!ref) return null;

    const byCode=findProjectByCode(projects,ref);
    if(byCode) return byCode;

    const byName=findProjectByName(projects,ref);
    if(byName) return byName;

    const slug=slugifyProjectRef(ref);
    if(!slug) return null;

    return projects.find(p=>
      slugifyProjectRef(p.project_code)===slug||
      slugifyProjectRef(p.project_name)===slug
    )||null;
  }

  async function resolveAlbukhrProject(projectRef,options={}){
    const ref=safeString(projectRef).trim();
    if(!ref) return null;

    const network=normalizeNetwork(options.network)||await requireCurrentAlbukhrNetwork();
    const projects=await loadProjectCache(!!options.forceRefresh,network);
    return findProjectByFlexibleRef(projects,ref);
  }

  function getLegacyProjectReference(){
    try{
      const current=window.ALBUKHR_CURRENT_PROJECT;
      if(current){
        if(typeof current==="object"){
          return safeString(
            current.project_code||current.code||current.project_name||""
          ).trim();
        }
        return safeString(current).trim();
      }
    }catch(error){
      console.warn("[PROJECT RESOLVER] Legacy project reference unavailable:",error);
    }

    try{
      const params=new URLSearchParams(window.location.search);
      return safeString(
        params.get("project_code")||params.get("project")||params.get("projectRef")||""
      ).trim();
    }catch(error){ return ""; }
  }

  async function resolveCurrentAlbukhrProject(options={}){
    const ref=safeString(options.projectRef||getLegacyProjectReference()).trim();
    if(!ref) return null;
    return resolveAlbukhrProject(ref,options);
  }

  /* =======================================================
     PROJECT TYPE / OWNERSHIP
  ======================================================= */

  function getAlbukhrProjectType(project){
    return project?normalizeProjectType(project.project_type)||"unknown":"unknown";
  }
  function isCoreProject(project){ return getAlbukhrProjectType(project)==="core"; }
  function isInternalProject(project){ return getAlbukhrProjectType(project)==="internal"; }
  function isExternalProject(project){ return getAlbukhrProjectType(project)==="external"; }

  function isProjectOwner(project,user){
    if(!project||!user) return false;
    const owner=lower(
      project.creator_userid||project.creator_user_id||
      project.owner_userid||project.owner_user_id
    );
    const current=lower(user.userid||user.uid||user.user_id);
    return !!owner&&!!current&&owner===current;
  }

  async function isProjectInCurrentNetwork(project){
    if(!project) return false;
    return projectBelongsToNetwork(
      project,
      await requireCurrentAlbukhrNetwork()
    );
  }

  /* =======================================================
     ACCESS RULES
  ======================================================= */

  async function canAccessAlbukhrProjectDashboard(project,user=null){
    if(!project) return false;
    const network=await requireCurrentAlbukhrNetwork();
    if(!projectBelongsToNetwork(project,network)) return false;

    const effective=await getEffectiveAccessUser(user);
    if(isAnyProjectAdmin(effective)) return true;
    if(isCoreProject(project)) return false;

    if(isInternalProject(project)||isExternalProject(project)){
      return isProjectOwner(project,effective);
    }
    return false;
  }

  async function canManageAlbukhrProjectTreasury(project,user=null){
    if(!project) return false;
    const network=await requireCurrentAlbukhrNetwork();
    if(!projectBelongsToNetwork(project,network)) return false;
    const effective=await getEffectiveAccessUser(user);
    return isSuperAdmin(effective)||isFinanceAdmin(effective)||isEcosystemAdmin(effective);
  }

  async function canUploadAlbukhrProjectUpdate(project,user=null){
    if(!project) return false;
    const network=await requireCurrentAlbukhrNetwork();
    if(!projectBelongsToNetwork(project,network)) return false;
    const effective=await getEffectiveAccessUser(user);
    if(isAnyProjectAdmin(effective)) return true;
    if(isInternalProject(project)||isExternalProject(project)) return isProjectOwner(project,effective);
    return false;
  }

  async function guardAlbukhrDashboardAccess({projectRef="",requireProject=true,network=null}={}){
    let target;
    try{
      target=normalizeNetwork(network)||await requireCurrentAlbukhrNetwork();
    }catch(error){
      return {ok:false,reason:"network_unavailable",project:null,user:await getEffectiveAccessUser(),network:null,error};
    }

    const user=await getEffectiveAccessUser();
    const ref=safeString(projectRef).trim();

    if(!ref){
      if(requireProject) return {ok:false,reason:"missing_project",project:null,user,network:target};
      return {ok:true,reason:null,project:null,user,network:target};
    }

    let project;
    try{
      project=await resolveAlbukhrProject(ref,{network:target});
    }catch(error){
      return {ok:false,reason:"project_load_error",project:null,user,network:target,error};
    }

    if(!project) return {ok:false,reason:"project_not_found",project:null,user,network:target};

    if(!projectBelongsToNetwork(project,target)){
      return {ok:false,reason:"network_mismatch",project,user,network:target};
    }

    try{
      if(!(await canAccessAlbukhrProjectDashboard(project,user))){
        return {ok:false,reason:"access_denied",project,user,network:target};
      }
    }catch(error){
      return {ok:false,reason:"access_check_error",project,user,network:target,error};
    }

    return {ok:true,reason:null,project,user,network:target};
  }

  /* =======================================================
     UI HELPERS
  ======================================================= */

  function getAlbukhrDashboardTitle(project){
    const type=getAlbukhrProjectType(project);
    if(type==="core") return "ALBUKHR Core Project Dashboard";
    if(type==="internal") return "ALBUKHR Internal Project Dashboard";
    if(type==="external") return "ALBUKHR External Project Dashboard";
    return "ALBUKHR Project Dashboard";
  }

  function getAlbukhrProjectUpdateTitle(project){
    const type=getAlbukhrProjectType(project);
    if(type==="core") return "📸 Core Project Updates";
    if(type==="internal") return "📸 Internal Project Updates";
    if(type==="external") return "📸 External Project Updates";
    return "📸 Project Updates";
  }

  function getAlbukhrProjectTypeLabel(project){
    const type=getAlbukhrProjectType(project);
    if(type==="core") return "Core Project";
    if(type==="internal") return "Internal Project";
    if(type==="external") return "External Project";
    return "Unknown Project Type";
  }

  async function getResolvedAlbukhrProjects(options={}){
    const network=normalizeNetwork(options.network)||await requireCurrentAlbukhrNetwork();
    return loadProjectCache(!!options.forceRefresh,network);
  }

  function getAlbukhrProjectResolverStatus(){
    return {
      version:RESOLVER_VERSION,
      loaded:CACHE.loaded,
      loading:CACHE.loading,
      network:CACHE.network,
      project_count:CACHE.projects.length,
      last_update:CACHE.lastUpdate,
      has_error:!!CACHE.lastError,
      last_error:CACHE.lastError||null
    };
  }

  function handleAlbukhrNetworkChanged(network){
    const normalized=normalizeNetwork(network);
    if(!normalized){
      CACHE.loaded=false;
      CACHE.loading=false;
      CACHE.loadingPromise=null;
      CACHE.lastUpdate=0;
      CACHE.network="";
      CACHE.projects=[];
      CACHE.lastError=new AlbukhrProjectResolverError(
        "Project cache invalidated because the new network is invalid.",
        "INVALID_NETWORK"
      );
      return;
    }
    if(CACHE.network===normalized) return;
    invalidateAlbukhrProjectCache();
  }

  /* =======================================================
     PUBLIC API
  ======================================================= */

  const PROJECT_RESOLVER={
    version:RESOLVER_VERSION,
    NETWORKS,
    ADMIN_ROLES,
    AlbukhrProjectResolverError,
    safeString,safeNumber,lower,normalizeKey,slugifyProjectRef,normalizeNetwork,
    getCurrentAlbukhrNetwork,requireCurrentAlbukhrNetwork,assertNetwork,
    getProjectNetwork,projectBelongsToNetwork,
    getCurrentAlbukhrUser,getCurrentAlbukhrAdminRaw,getCurrentAlbukhrAdminResult,
    getCurrentAlbukhrEmail,getCurrentAlbukhrActor,
    hasAdminRole,isSuperAdmin,isFinanceAdmin,isEcosystemAdmin,isProjectAdmin,isAnyProjectAdmin,
    normalizeProjectType,normalizeProject,
    loadProjectsFromEngine,loadCoreProjectsFromEngine,loadMarketplaceProjectsFromEngine,
    collectAlbukhrProjects,getResolvedAlbukhrProjects,
    findProjectByCode,findProjectByName,findProjectByFlexibleRef,
    resolveAlbukhrProject,resolveCurrentAlbukhrProject,
    getAlbukhrProjectType,isCoreProject,isInternalProject,isExternalProject,
    isProjectOwner,isProjectInCurrentNetwork,
    canAccessAlbukhrProjectDashboard,canManageAlbukhrProjectTreasury,canUploadAlbukhrProjectUpdate,
    guardAlbukhrDashboardAccess,
    getAlbukhrDashboardTitle,getAlbukhrProjectUpdateTitle,getAlbukhrProjectTypeLabel,
    refreshAlbukhrProjects,invalidateAlbukhrProjectCache,
    getAlbukhrProjectResolverStatus,handleAlbukhrNetworkChanged
  };

  window.ALBUKHR_PROJECT_RESOLVER=PROJECT_RESOLVER;

  /* Existing global compatibility API */
  window.resolveAlbukhrProject=resolveAlbukhrProject;
  window.resolveCurrentAlbukhrProject=resolveCurrentAlbukhrProject;
  window.getAlbukhrProjectType=getAlbukhrProjectType;
  window.canAccessAlbukhrProjectDashboard=canAccessAlbukhrProjectDashboard;
  window.canManageAlbukhrProjectTreasury=canManageAlbukhrProjectTreasury;
  window.canUploadAlbukhrProjectUpdate=canUploadAlbukhrProjectUpdate;
  window.guardAlbukhrDashboardAccess=guardAlbukhrDashboardAccess;
  window.getResolvedAlbukhrProjects=getResolvedAlbukhrProjects;
  window.refreshAlbukhrProjects=refreshAlbukhrProjects;
  window.getCurrentAlbukhrNetwork=getCurrentAlbukhrNetwork;
  window.getAlbukhrProjectResolverStatus=getAlbukhrProjectResolverStatus;
  window.handleAlbukhrNetworkChanged=handleAlbukhrNetworkChanged;

  window.addEventListener("albukhr:network-changed",event=>{
    try{
      handleAlbukhrNetworkChanged(
        event?.detail?.network||event?.detail||""
      );
    }catch(error){
      console.warn("[PROJECT RESOLVER] Network change handling failed:",error);
    }
  });

  console.log(`✅ ALBUKHR Project Resolver v${RESOLVER_VERSION} Ready`);

})(window);
