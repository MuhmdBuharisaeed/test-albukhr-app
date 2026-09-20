/* ALBUKHR TESTNET ENVIRONMENT CORE v4 */
(function(window){
  "use strict";
  window.__ALBUKHR_ENVIRONMENT_CORE_LOADED__ = true;

  var host = String(window.location && window.location.hostname ? window.location.hostname : "")
    .toLowerCase().replace(/\.$/,"");
  var known = host === "test.albukhr.com";

  var config = {
    key: "testnet",
    name: "TESTNET",
    host: "test.albukhr.com",
    appUrl: "https://test.albukhr.com",
    supabaseUrl: "https://vhvkwvngmrlgyzwemttt.supabase.co",
    network: "testnet"
  };

  window.ALBukhrEnvironment = {
    current: known ? config : null,
    environments: { testnet: config },
    getKey: function(){ return known ? "testnet" : null; },
    getName: function(){ return known ? "TESTNET" : null; },
    getNetwork: function(){ return known ? "testnet" : null; },
    getAppUrl: function(){ return known ? config.appUrl : null; },
    getSupabaseUrl: function(){ return known ? config.supabaseUrl : null; },
    getHostname: function(){ return host; },
    isKnown: function(){ return known; },
    isTestnet: function(){ return known; },
    isMainnet: function(){ return false; },
    getConfig: function(){ return known ? config : null; }
  };

  try {
    Object.freeze(config);
    Object.freeze(window.ALBukhrEnvironment);
  } catch (_) {}
})(window);
