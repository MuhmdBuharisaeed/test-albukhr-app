/* =========================================
   ALBUKHR SUPABASE CORE v2
   NETWORK-AWARE SUPABASE FOUNDATION

   DEPENDS ON:
   - js/environment-switcher.js

   PURPOSE:
   - Single Supabase client
   - Single network identity source
   - No LocalStorage persistence
   - Mainnet/Testnet isolation helper
   - Shared foundation for all ALBUKHR engines
========================================= */

(function(){

  "use strict";

  /* =========================================
     CONFIG
  ========================================== */

  const ALBUKHR_SUPABASE_URL =
    "https://qexmnghilahsvethlxem.supabase.co";

  const ALBUKHR_SUPABASE_KEY =
    "sb_publishable_mSbWlhVKdmSjasKJC50QYw_5wzgRMe2";


  /* =========================================
     EXPOSE CONFIG
  ========================================== */

  window.ALBUKHR_SUPABASE_URL =
    ALBUKHR_SUPABASE_URL;

  window.ALBUKHR_SUPABASE_KEY =
    ALBUKHR_SUPABASE_KEY;


  /* =========================================
     INTERNAL STATE
  ========================================== */

  let __albukhrSupabaseClient = null;
  let __albukhrSupabaseInitError = null;


  /* =========================================
     SAFE HELPERS
  ========================================== */

  function coreSafeString(
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


  /* =========================================
     NETWORK RESOLUTION
     Environment switcher is authoritative.
  ========================================== */

  function getAlbukhrNetworkFromCore(){

    if(
      typeof window.getAlbukhrNetwork !==
      "function"
    ){

      throw new Error(
        "ALBUKHR Network Core is not loaded. " +
        "Load js/environment-switcher.js " +
        "before js/supabase-core.js."
      );

    }

    const network =
      window.getAlbukhrNetwork();

    if(
      network !== "mainnet" &&
      network !== "testnet"
    ){

      throw new Error(
        "ALBUKHR network is unknown. " +
        "Network-sensitive Supabase operation refused."
      );

    }

    return network;

  }


  /* =========================================
     PUBLIC NETWORK HELPERS
  ========================================== */

  function getAlbukhrNetwork(){

    return getAlbukhrNetworkFromCore();

  }


  function isAlbukhrMainnet(){

    return getAlbukhrNetworkFromCore() ===
      "mainnet";

  }


  function isAlbukhrTestnet(){

    return getAlbukhrNetworkFromCore() ===
      "testnet";

  }


  function requireAlbukhrNetwork(){

    return getAlbukhrNetworkFromCore();

  }


  /* =========================================
     CHECK SUPABASE SDK
  ========================================== */

  function hasSupabaseSDK(){

    return !!(
      window.supabase &&
      typeof window.supabase.createClient ===
        "function"
    );

  }


  /* =========================================
     CREATE CLIENT
  ========================================== */

  function createAlbukhrSupabaseClient(){

    if(__albukhrSupabaseClient){

      return __albukhrSupabaseClient;

    }

    if(!hasSupabaseSDK()){

      __albukhrSupabaseInitError =
        "Supabase SDK not found. " +
        "Load @supabase/supabase-js first.";

      console.error(
        __albukhrSupabaseInitError
      );

      return null;

    }

    try{

      __albukhrSupabaseClient =
        window.supabase.createClient(
          ALBUKHR_SUPABASE_URL,
          ALBUKHR_SUPABASE_KEY,
          {
            auth:{
              /*
                Supabase auth session must not be
                persisted as application state.
              */
              persistSession:false,
              autoRefreshToken:false,
              detectSessionInUrl:false
            }
          }
        );

      __albukhrSupabaseInitError = null;

      return __albukhrSupabaseClient;

    }catch(e){

      __albukhrSupabaseInitError =
        e?.message ||
        "Failed to create ALBUKHR Supabase client";

      console.error(
        "ALBUKHR Supabase client creation failed:",
        e
      );

      return null;

    }

  }


  /* =========================================
     GET CLIENT
  ========================================== */

  function getAlbukhrSupabaseClient(){

    if(__albukhrSupabaseClient){

      return __albukhrSupabaseClient;

    }

    return createAlbukhrSupabaseClient();

  }


  /* =========================================
     REQUIRE CLIENT
  ========================================== */

  function requireAlbukhrSupabaseClient(){

    const client =
      getAlbukhrSupabaseClient();

    if(!client){

      throw new Error(
        __albukhrSupabaseInitError ||
        "ALBUKHR Supabase client not available."
      );

    }

    return client;

  }


  /* =========================================
     NETWORK FILTER HELPER

     Usage:
       const query =
         from("projects")
           .select("*");

       const safeQuery =
         applyAlbukhrNetworkFilter(query);
  ========================================== */

  function applyAlbukhrNetworkFilter(query){

    if(!query){

      throw new Error(
        "Supabase query is required."
      );

    }

    const network =
      getAlbukhrNetworkFromCore();

    return query.eq(
      "network",
      network
    );

  }


  /* =========================================
     NETWORK PAYLOAD HELPER

     Usage:
       {
         ...payload,
         ...withAlbukhrNetwork()
       }
  ========================================== */

  function withAlbukhrNetwork(
    payload = {}
  ){

    const network =
      getAlbukhrNetworkFromCore();

    return {
      ...payload,
      network
    };

  }


  /* =========================================
     NETWORK VALIDATION

     Prevent accidental writes containing
     another network value.
  ========================================== */

  function assertAlbukhrNetworkValue(
    network
  ){

    const current =
      getAlbukhrNetworkFromCore();

    if(
      network !== "mainnet" &&
      network !== "testnet"
    ){

      throw new Error(
        "Invalid ALBUKHR network value."
      );

    }

    if(network !== current){

      throw new Error(
        `Network mismatch: current environment is ` +
        `${current}, but operation requested ${network}.`
      );

    }

    return true;

  }


  /* =========================================
     SAFE NETWORKED SELECT

     Convenience helper:
       const {data,error} =
         await albukhrSelect("projects", "*");
  ========================================== */

  function albukhrSelect(
    table,
    columns = "*"
  ){

    if(!table){

      throw new Error(
        "Supabase table name is required."
      );

    }

    const client =
      requireAlbukhrSupabaseClient();

    return applyAlbukhrNetworkFilter(
      client
        .from(table)
        .select(columns)
    );

  }


  /* =========================================
     HEALTH SUMMARY
  ========================================== */

  function albukhrSupabaseHealth(){

    let network = null;
    let networkError = null;

    try{

      network =
        getAlbukhrNetworkFromCore();

    }catch(e){

      networkError =
        e?.message || "Network unavailable";

    }

    const client =
      getAlbukhrSupabaseClient();

    return {

      ready: !!client,

      has_sdk:
        hasSupabaseSDK(),

      has_client:
        !!client,

      network,

      network_ready:
        !!network,

      url:
        coreSafeString(
          ALBUKHR_SUPABASE_URL
        ),

      key_present:
        !!coreSafeString(
          ALBUKHR_SUPABASE_KEY
        ),

      init_error:
        __albukhrSupabaseInitError ||
        null,

      network_error:
        networkError

    };

  }


  /* =========================================
     CONNECTIVITY TEST

     IMPORTANT:
     Test is network-aware.
  ========================================== */

  async function testAlbukhrSupabaseConnection(){

    let network;

    try{

      network =
        getAlbukhrNetworkFromCore();

    }catch(e){

      return {
        success:false,
        network:null,
        error:
          e?.message ||
          "ALBUKHR network unavailable"
      };

    }

    const client =
      getAlbukhrSupabaseClient();

    if(!client){

      return {
        success:false,
        network,
        error:
          __albukhrSupabaseInitError ||
          "Supabase client not available"
      };

    }

    try{

      /*
        Execute a network-filtered health query.
      */

      const result =
        await applyAlbukhrNetworkFilter(
          client
            .from("projects")
            .select("id", {
              count:"exact",
              head:true
            })
        );

      if(result.error){

        return {
          success:false,
          network,
          error:
            result.error.message ||
            "Supabase connection test failed"
        };

      }

      return {
        success:true,
        network,
        count:
          result.count ?? null
      };

    }catch(e){

      return {
        success:false,
        network,
        error:
          e?.message ||
          "Supabase connection test crashed"
      };

    }

  }


  /* =========================================
     GLOBAL EXPORTS
  ========================================== */

  window.albukhrSupabase =
    getAlbukhrSupabaseClient();

  window.getAlbukhrSupabaseClient =
    getAlbukhrSupabaseClient;

  window.requireAlbukhrSupabaseClient =
    requireAlbukhrSupabaseClient;

  window.isAlbukhrSupabaseReady =
    () => !!getAlbukhrSupabaseClient();

  window.getAlbukhrNetwork =
    getAlbukhrNetwork;

  window.isAlbukhrMainnet =
    isAlbukhrMainnet;

  window.isAlbukhrTestnet =
    isAlbukhrTestnet;

  window.requireAlbukhrNetwork =
    requireAlbukhrNetwork;

  window.applyAlbukhrNetworkFilter =
    applyAlbukhrNetworkFilter;

  window.withAlbukhrNetwork =
    withAlbukhrNetwork;

  window.assertAlbukhrNetworkValue =
    assertAlbukhrNetworkValue;

  window.albukhrSelect =
    albukhrSelect;

  window.albukhrSupabaseHealth =
    albukhrSupabaseHealth;

  window.testAlbukhrSupabaseConnection =
    testAlbukhrSupabaseConnection;


  /* =========================================
     DEBUG LOG
  ========================================== */

  try{

    const health =
      albukhrSupabaseHealth();

    if(
      health.ready &&
      health.network_ready
    ){

      console.log(
        `ALBUKHR Supabase Core ready — ` +
        `${health.network.toUpperCase()}`
      );

    }else{

      console.warn(
        "ALBUKHR Supabase Core not fully ready:",
        health
      );

    }

  }catch(e){

    console.warn(
      "ALBUKHR Supabase Core initialization warning:",
      e
    );

  }

})();
