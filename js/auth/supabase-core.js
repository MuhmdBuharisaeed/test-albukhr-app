/* =========================================
   ALBUKHR SUPABASE CORE
   Dedicated Supabase bootstrap for
   projects / treasury / liquidity ecosystem
========================================= */

/*
  MANUFA:
  - Kada ya karya tsohon supabase.js
  - Ya zama sabon foundation na:
      1) projects-engine.js
      2) project-treasury.js
      3) smart-liquidity-engine.js
      4) ecosystem dashboards
      5) future contributors / internal / external projects

  GLOBALS EXPOSED:
  - window.ALBUKHR_SUPABASE_URL
  - window.ALBUKHR_SUPABASE_KEY
  - window.albukhrSupabase
  - window.getAlbukhrSupabaseClient()
  - window.isAlbukhrSupabaseReady()
  - window.albukhrSupabaseHealth()
*/

/* =========================================
   CONFIG
========================================= */
(function(){

  const ALBUKHR_SUPABASE_URL =
    "https://qexmnghilahsvethlxem.supabase.co";

  const ALBUKHR_SUPABASE_KEY =
    "sb_publishable_mSbWlhVKdmSjasKJC50QYw_5wzgRMe2";

  /* =========================================
     EXPOSE RAW CONFIG
  ========================================= */
  window.ALBUKHR_SUPABASE_URL =
    ALBUKHR_SUPABASE_URL;

  window.ALBUKHR_SUPABASE_KEY =
    ALBUKHR_SUPABASE_KEY;

  /* =========================================
     INTERNAL CACHE
  ========================================= */
  let __albukhrSupabaseClient = null;
  let __albukhrSupabaseInitError = null;

  /* =========================================
     SAFE STRING
  ========================================= */
  function coreSafeString(value, fallback = ""){
    if(value === null || value === undefined){
      return fallback;
    }
    return String(value);
  }

  /* =========================================
     CHECK SDK READY
  ========================================= */
  function hasSupabaseSDK(){
    return !!(
      window.supabase &&
      typeof window.supabase.createClient === "function"
    );
  }

  /* =========================================
     CREATE CLIENT
  ========================================= */
  function createAlbukhrSupabaseClient(){

    if(__albukhrSupabaseClient){
      return __albukhrSupabaseClient;
    }

    if(!hasSupabaseSDK()){
      __albukhrSupabaseInitError =
        "Supabase SDK not found. Load @supabase/supabase-js first.";
      console.error(__albukhrSupabaseInitError);
      return null;
    }

    try{

      __albukhrSupabaseClient =
        window.supabase.createClient(
          ALBUKHR_SUPABASE_URL,
          ALBUKHR_SUPABASE_KEY,
          {
            auth:{

    persistSession:true,

    autoRefreshToken:true,

    detectSessionInUrl:false

            }
          }
        );

      __albukhrSupabaseInitError = null;

      return __albukhrSupabaseClient;

    }catch(e){

      __albukhrSupabaseInitError =
        e?.message || "Failed to create ALBUKHR Supabase client";

      console.error(
        "ALBUKHR Supabase client creation failed:",
        e
      );

      return null;
    }

  }

  /* =========================================
     GET CLIENT
  ========================================= */
  function getAlbukhrSupabaseClient(){

    if(__albukhrSupabaseClient){
      return __albukhrSupabaseClient;
    }

    return createAlbukhrSupabaseClient();
  }

  /* =========================================
     READY CHECK
  ========================================= */
  function isAlbukhrSupabaseReady(){

    return !!getAlbukhrSupabaseClient();

  }

  /* =========================================
     HEALTH SUMMARY
  ========================================= */
  function albukhrSupabaseHealth(){

    const client = getAlbukhrSupabaseClient();

    return {
      ready: !!client,
      has_sdk: hasSupabaseSDK(),
      has_client: !!client,
      url:
        coreSafeString(ALBUKHR_SUPABASE_URL),
      key_present:
        !!coreSafeString(ALBUKHR_SUPABASE_KEY),
      init_error:
        __albukhrSupabaseInitError || null
    };

  }

  /* =========================================
     OPTIONAL CONNECTIVITY TEST
     - admin/debug pages zasu iya kira idan suna so
  ========================================= */
  async function testAlbukhrSupabaseConnection(){

    const client = getAlbukhrSupabaseClient();

    if(!client){
      return {
        success:false,
        error:
          __albukhrSupabaseInitError ||
          "Supabase client not available"
      };
    }

    try{

      // lightweight ping against projects table
      const { error } = await client
        .from("projects")
        .select("id", { count:"exact", head:true });

      if(error){
        return {
          success:false,
          error:error.message || "Supabase connection test failed"
        };
      }

      return {
        success:true
      };

    }catch(e){
      return {
        success:false,
        error:e?.message || "Supabase connection test crashed"
      };
    }
  }

  /* =========================================
     EXPOSE GLOBALS
  ========================================= */
  window.albukhrSupabase =
    getAlbukhrSupabaseClient();

  window.getAlbukhrSupabaseClient =
    getAlbukhrSupabaseClient;

  window.isAlbukhrSupabaseReady =
    isAlbukhrSupabaseReady;

  window.albukhrSupabaseHealth =
    albukhrSupabaseHealth;

  window.testAlbukhrSupabaseConnection =
    testAlbukhrSupabaseConnection;

  /* =========================================
     DEBUG LOG
  ========================================= */
  const health = albukhrSupabaseHealth();

  if(health.ready){
    console.log(
      "✅ ALBUKHR Supabase Core ready"
    );
  }else{
    console.warn(
      "⚠️ ALBUKHR Supabase Core not ready:",
      health.init_error || "Unknown issue"
    );
  }

})();
