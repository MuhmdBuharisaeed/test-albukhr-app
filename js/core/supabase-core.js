/* =========================================================
   ALBUKHR SUPABASE CORE v3
   NETWORK-AWARE SUPABASE FOUNDATION

   ARCHITECTURE:
   environment-switcher.js
          ↓
   supabase-core.js
          ↓
   domain engines
          ↓
   page controllers

   RULES:
   - Single shared Supabase client
   - Lazy client initialization
   - environment-switcher is authoritative for network
   - No LocalStorage persistence
   - Network-aware read/write helpers
   - No direct Supabase credentials in domain engines
========================================================= */

(function(){
  "use strict";

  const ALBUKHR_SUPABASE_URL =
    "https://qexmnghilahsvethlxem.supabase.co";

  const ALBUKHR_SUPABASE_KEY =
    "sb_publishable_mSbWlhVKdmSjasKJC50QYw_5wzgRMe2";

  window.ALBUKHR_SUPABASE_URL = ALBUKHR_SUPABASE_URL;
  window.ALBUKHR_SUPABASE_KEY = ALBUKHR_SUPABASE_KEY;

  let __client = null;
  let __initError = null;

  function safeString(value, fallback = ""){
    return value === null || value === undefined
      ? fallback
      : String(value);
  }

  function resolveNetwork(){
    if(typeof window.getAlbukhrNetwork !== "function"){
      throw new Error(
        "ALBUKHR Network Core is not loaded. Load environment-switcher.js before supabase-core.js."
      );
    }

    const network = window.getAlbukhrNetwork();

    if(network !== "mainnet" && network !== "testnet"){
      throw new Error(
        "Unknown ALBUKHR network. Network-sensitive operation refused."
      );
    }

    return network;
  }

  function getAlbukhrNetwork(){
    return resolveNetwork();
  }

  function isAlbukhrMainnet(){
    return resolveNetwork() === "mainnet";
  }

  function isAlbukhrTestnet(){
    return resolveNetwork() === "testnet";
  }

  function requireAlbukhrNetwork(){
    return resolveNetwork();
  }

  function hasSupabaseSDK(){
    return !!(
      window.supabase &&
      typeof window.supabase.createClient === "function"
    );
  }

  function createClient(){
    if(__client) return __client;

    if(!hasSupabaseSDK()){
      __initError =
        "Supabase SDK not found. Load @supabase/supabase-js before supabase-core.js.";
      return null;
    }

    try{
      __client = window.supabase.createClient(
        ALBUKHR_SUPABASE_URL,
        ALBUKHR_SUPABASE_KEY,
        {
          auth:{
            persistSession:false,
            autoRefreshToken:false,
            detectSessionInUrl:false
          }
        }
      );

      __initError = null;
      return __client;

    }catch(error){
      __initError =
        error?.message ||
        "Failed to create ALBUKHR Supabase client.";
      console.error(
        "ALBUKHR Supabase client creation failed:",
        error
      );
      return null;
    }
  }

  function getAlbukhrSupabaseClient(){
    return __client || createClient();
  }

  function requireAlbukhrSupabaseClient(){
    const client = getAlbukhrSupabaseClient();

    if(!client){
      throw new Error(
        __initError ||
        "ALBUKHR Supabase client is unavailable."
      );
    }

    return client;
  }

  function applyAlbukhrNetworkFilter(query){
    if(!query || typeof query.eq !== "function"){
      throw new Error("A valid Supabase query is required.");
    }

    return query.eq("network", resolveNetwork());
  }

  function withAlbukhrNetwork(payload = {}){
    return {
      ...payload,
      network: resolveNetwork()
    };
  }

  function assertAlbukhrNetworkValue(network){
    const current = resolveNetwork();

    if(network !== "mainnet" && network !== "testnet"){
      throw new Error("Invalid ALBUKHR network value.");
    }

    if(network !== current){
      throw new Error(
        `Network mismatch: current environment is ${current}, requested ${network}.`
      );
    }

    return true;
  }

  function albukhrFrom(table){
    if(!table){
      throw new Error("Supabase table name is required.");
    }

    return requireAlbukhrSupabaseClient().from(table);
  }

  function albukhrSelect(table, columns = "*"){
    return applyAlbukhrNetworkFilter(
      albukhrFrom(table).select(columns)
    );
  }

  function albukhrInsert(table, payload, options = {}){
    const rows = Array.isArray(payload) ? payload : [payload];

    const safeRows = rows.map(row => withAlbukhrNetwork(row));

    return albukhrFrom(table).insert(
      safeRows,
      options
    );
  }

  function albukhrUpdate(table, values, filterBuilder){
    if(typeof filterBuilder !== "function"){
      throw new Error(
        "albukhrUpdate() requires a filterBuilder callback."
      );
    }

    let query =
      albukhrFrom(table).update(values);

    query =
      filterBuilder(query);

    return applyAlbukhrNetworkFilter(query);
  }

  function albukhrDelete(table, filterBuilder){
    if(typeof filterBuilder !== "function"){
      throw new Error(
        "albukhrDelete() requires a filterBuilder callback."
      );
    }

    let query =
      albukhrFrom(table).delete();

    query =
      filterBuilder(query);

    return applyAlbukhrNetworkFilter(query);
  }

  function albukhrSupabaseHealth(){
    let network = null;
    let networkError = null;

    try{
      network = resolveNetwork();
    }catch(error){
      networkError =
        error?.message || "Network unavailable";
    }

    const client =
      getAlbukhrSupabaseClient();

    return {
      ready:!!client,
      has_sdk:hasSupabaseSDK(),
      has_client:!!client,
      network,
      network_ready:!!network,
      url:safeString(ALBUKHR_SUPABASE_URL),
      key_present:!!safeString(ALBUKHR_SUPABASE_KEY),
      init_error:__initError || null,
      network_error:networkError
    };
  }

  async function testAlbukhrSupabaseConnection(){
    let network;

    try{
      network = resolveNetwork();
    }catch(error){
      return {
        success:false,
        network:null,
        error:error?.message || "Network unavailable"
      };
    }

    const client =
      getAlbukhrSupabaseClient();

    if(!client){
      return {
        success:false,
        network,
        error:__initError || "Supabase client unavailable"
      };
    }

    try{
      const result =
        await applyAlbukhrNetworkFilter(
          client
            .from("projects")
            .select("id", {count:"exact", head:true})
        );

      if(result.error){
        return {
          success:false,
          network,
          error:result.error.message || "Connection test failed"
        };
      }

      return {
        success:true,
        network,
        count:result.count ?? null
      };

    }catch(error){
      return {
        success:false,
        network,
        error:error?.message || "Connection test crashed"
      };
    }
  }

  /*
    IMPORTANT:
    Do not expose a separate eager client instance as the
    architecture's source of truth. Consumers must request
    the shared client through get/requireAlbukhrSupabaseClient().
  */

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

  window.albukhrFrom =
    albukhrFrom;

  window.albukhrSelect =
    albukhrSelect;

  window.albukhrInsert =
    albukhrInsert;

  window.albukhrUpdate =
    albukhrUpdate;

  window.albukhrDelete =
    albukhrDelete;

  window.albukhrSupabaseHealth =
    albukhrSupabaseHealth;

  window.testAlbukhrSupabaseConnection =
    testAlbukhrSupabaseConnection;

  /*
    Backward-compatible accessor.
    It is a getter, not a second client.
  */
  try{
    Object.defineProperty(window, "albukhrSupabase", {
      configurable:true,
      get(){
        return getAlbukhrSupabaseClient();
      }
    });
  }catch(error){
    console.warn(
      "Could not define albukhrSupabase compatibility accessor:",
      error
    );
  }

  try{
    console.log(
      "ALBUKHR Supabase Core loaded. Client initialization is lazy."
    );
  }catch(_){}

})();
