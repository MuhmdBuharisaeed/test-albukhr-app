/* =========================================================
   ALBUKHR PROJECT REGISTRY ENGINE v2
   PUBLIC / NETWORK-ISOLATED PROJECT SOURCE

   SOURCE OF TRUTH:
     public.albukhr_project_registry

   READ RULES:
     - Current ALBUKHR network is mandatory.
     - status = active.
     - project_visible = true.
     - Home uses project_type = core.
     - No LocalStorage project persistence.
     - Auth/staking must never block public project reads.
========================================================= */
(function(){
  "use strict";

  const TABLE = "albukhr_project_registry";

  function getNetwork(){
    if(typeof window.requireAlbukhrNetwork === "function"){
      return window.requireAlbukhrNetwork();
    }
    if(typeof window.getAlbukhrNetwork === "function"){
      return window.getAlbukhrNetwork();
    }
    throw new Error("ALBUKHR Network Core is not loaded.");
  }

  function getClient(){
    if(typeof window.requireAlbukhrSupabaseClient === "function"){
      return window.requireAlbukhrSupabaseClient();
    }
    if(typeof window.getAlbukhrSupabaseClient === "function"){
      const client=window.getAlbukhrSupabaseClient();
      if(client)return client;
    }
    if(window.albukhrSupabase)return window.albukhrSupabase;
    throw new Error("ALBUKHR Supabase client is not available.");
  }

  async function getAlbukhrProjectRegistry(options={}){
    const currentNetwork=getNetwork();
    const projectType=options.projectType || null;

    let query=getClient()
      .from(TABLE)
      .select("*")
      .eq("network",currentNetwork)
      .eq("status","active")
      .eq("project_visible",true);

    if(projectType){
      query=query.eq("project_type",projectType);
    }

    query=query.order("project_name",{ascending:true});

    const {data,error}=await query;

    if(error){
      console.error("ALBUKHR Project Registry read failed:",{
        table:TABLE,
        network:currentNetwork,
        error
      });
      throw new Error(error.message || "Project registry read failed.");
    }

    return Array.isArray(data)?data:[];
  }

  async function getAlbukhrCoreProjects(){
    return getAlbukhrProjectRegistry({projectType:"core"});
  }

  async function getAlbukhrProject(projectCode){
    if(!projectCode)return null;

    const currentNetwork=getNetwork();
    const {data,error}=await getClient()
      .from(TABLE)
      .select("*")
      .eq("network",currentNetwork)
      .eq("status","active")
      .eq("project_visible",true)
      .eq("project_code",String(projectCode))
      .maybeSingle();

    if(error){
      console.error("ALBUKHR Project Registry single read failed:",error);
      throw new Error(error.message || "Project registry read failed.");
    }

    return data || null;
  }

  window.getAlbukhrProjectRegistry=getAlbukhrProjectRegistry;
  window.getAlbukhrCoreProjects=getAlbukhrCoreProjects;
  window.getAlbukhrProject=getAlbukhrProject;

  console.log("ALBUKHR Project Registry Engine v2 loaded.");
})();
