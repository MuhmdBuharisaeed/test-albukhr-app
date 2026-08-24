/* =========================================================
   ALBUKHR PROJECT REGISTRY ENGINE v1
   Canonical public project source for index/home.

   SOURCE OF TRUTH:
     public.albukhr_project_registry

   READ RULES:
     - Current ALBUKHR network is mandatory.
     - status must be active.
     - project_visible must be true.
     - project_type is core for this home registry.
     - No LocalStorage.
     - No hard-coded seven-project source.
========================================================= */
(function(){
  "use strict";

  const TABLE = "albukhr_project_registry";

  function client(){
    if(typeof window.requireAlbukhrSupabaseClient !== "function"){
      throw new Error("ALBUKHR Supabase Core is not loaded.");
    }
    return window.requireAlbukhrSupabaseClient();
  }

  function network(){
    if(typeof window.requireAlbukhrNetwork !== "function"){
      throw new Error("ALBUKHR Network Core is not loaded.");
    }
    return window.requireAlbukhrNetwork();
  }

  async function getAlbukhrProjectRegistry(options = {}){
    const currentNetwork = network();
    const projectType = options.projectType || null;

    let query = client()
      .from(TABLE)
      .select("*")
      .eq("network", currentNetwork)
      .eq("status", "active")
      .eq("project_visible", true);

    if(projectType){
      query = query.eq("project_type", projectType);
    }

    query = query.order("project_name", { ascending:true });

    const {data,error} = await query;

    if(error){
      console.error("ALBUKHR Project Registry read failed:", error);
      throw new Error(error.message || "Project registry read failed.");
    }

    return Array.isArray(data) ? data : [];
  }

  async function getAlbukhrCoreProjects(){
    return getAlbukhrProjectRegistry({projectType:"core"});
  }

  async function getAlbukhrProject(projectCode){
    if(!projectCode) return null;

    const currentNetwork = network();

    const {data,error} = await client()
      .from(TABLE)
      .select("*")
      .eq("network", currentNetwork)
      .eq("status", "active")
      .eq("project_visible", true)
      .eq("project_code", String(projectCode))
      .maybeSingle();

    if(error){
      console.error("ALBUKHR Project Registry single read failed:", error);
      throw new Error(error.message || "Project registry read failed.");
    }

    return data || null;
  }

  window.getAlbukhrProjectRegistry = getAlbukhrProjectRegistry;
  window.getAlbukhrCoreProjects = getAlbukhrCoreProjects;
  window.getAlbukhrProject = getAlbukhrProject;

  console.log("ALBUKHR Project Registry Engine loaded.");
})();
