/* ALBUKHR TESTNET ADMIN AUTH v1 */
(function(window, document){
  "use strict";

  var HOST = "test.albukhr.com";
  var NETWORK = "testnet";
  var STORAGE_KEY = "albukhr_testnet_admin_session_v1";
  var GATEWAY_URL = "https://vhvkwvngmrlgyzwemttt.supabase.co/functions/v1/testnet-admin-gateway";
  var MAINNET_BRIDGE = "https://admin.albukhr.com/admin-testnet-access.html";
  var initialized = false;

  function clean(v){ return String(v == null ? "" : v).trim(); }

  function environment(){
    var env = window.ALBukhrEnvironment;
    if(!env || typeof env.isKnown !== "function" || typeof env.isTestnet !== "function" || typeof env.getNetwork !== "function"){
      throw new Error("TESTNET_ENVIRONMENT_UNAVAILABLE");
    }
    if(!env.isKnown() || !env.isTestnet() || env.getNetwork() !== NETWORK){
      throw new Error("INVALID_TESTNET_ENVIRONMENT");
    }
    var host = typeof env.getHostname === "function" ? clean(env.getHostname()).toLowerCase() : clean(window.location.hostname).toLowerCase();
    if(host !== HOST) throw new Error("TESTNET_ADMIN_AUTH_HOST_REQUIRED");
    return env;
  }

  function save(session){
    if(!session || !session.session || !session.expires_at) throw new Error("INVALID_TESTNET_ADMIN_SESSION");
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      session: clean(session.session),
      expires_at: clean(session.expires_at),
      admin: session.admin || null,
      network: NETWORK
    }));
  }

  function clear(){
    try{ sessionStorage.removeItem(STORAGE_KEY); }catch(_){ }
  }

  function getSession(){
    environment();
    try{
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if(!raw) return null;
      var data = JSON.parse(raw);
      if(!data || data.network !== NETWORK || !data.session) return null;
      if(!data.expires_at || new Date(data.expires_at).getTime() <= Date.now()){
        clear();
        return null;
      }
      return data;
    }catch(_){
      clear();
      return null;
    }
  }

  function getToken(){
    var current = getSession();
    return current ? clean(current.session) : "";
  }

  async function parse(response){
    var type = "";
    try{ type = String(response.headers.get("content-type") || "").toLowerCase(); }catch(_){ }
    if(type.indexOf("json") !== -1){
      try{ return await response.json(); }catch(_){ return null; }
    }
    var text = "";
    try{ text = await response.text(); }catch(_){ }
    if(!text) return null;
    try{ return JSON.parse(text); }catch(_){ return text; }
  }

  async function redeem(code){
    environment();
    var value = clean(code);
    if(!value) throw new Error("TESTNET_ADMIN_CODE_REQUIRED");

    var response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=UTF-8",
        "Accept": "application/json"
      },
      body: JSON.stringify({action:"redeem_admin",code:value})
    });

    var body = await parse(response);
    if(!response.ok || !body || !body.session){
      throw new Error(clean(body && (body.error || body.message)) || "TESTNET_ADMIN_REDEEM_FAILED");
    }

    save(body);
    return getSession();
  }

  function stripCodeFromUrl(){
    try{
      var url = new URL(window.location.href);
      url.searchParams.delete("admin_code");
      history.replaceState({}, document.title, url.pathname + (url.search ? "?"+url.searchParams.toString() : "") + url.hash);
    }catch(_){ }
  }

  function redirectToMainnet(){
    var target = MAINNET_BRIDGE;
    try{
      var returnTo = window.location.pathname + window.location.search.replace(/(?:^|&)admin_code=[^&]*/g, "").replace(/^&/, "");
      if(returnTo){
        target += "?returnTo=" + encodeURIComponent(returnTo);
      }
    }catch(_){ }
    window.location.replace(target);
  }

  async function requireAdmin(options){
    options = options || {};
    environment();

    var code = "";
    try{ code = clean(new URL(window.location.href).searchParams.get("admin_code")); }catch(_){ }

    if(code){
      try{
        var session = await redeem(code);
        stripCodeFromUrl();
        return session;
      }catch(error){
        clear();
        if(options.redirectOnFailure !== false){ redirectToMainnet(); return null; }
        throw error;
      }
    }

    var existing = getSession();
    if(existing) return existing;

    if(options.redirectOnFailure !== false){
      redirectToMainnet();
      return null;
    }

    return null;
  }

  function logout(){
    clear();
    try{
      window.dispatchEvent(new CustomEvent("albukhr:testnet-admin-logged-out"));
    }catch(_){ }
  }

  var api = {
    network: NETWORK,
    host: HOST,
    gatewayUrl: GATEWAY_URL,
    getSession: getSession,
    getSessionToken: getToken,
    redeem: redeem,
    requireAdmin: requireAdmin,
    logout: logout,
    init: function(){
      if(initialized) return;
      initialized = true;
      environment();
    }
  };

  try{ Object.freeze(api); }catch(_){ }
  window.AlbukhrTestnetAdminAuth = api;
})(window, document);
