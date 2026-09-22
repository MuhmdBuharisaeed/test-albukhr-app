/* ALBUKHR TESTNET LIQUIDITY ADMIN API v2 */
(function(window){
  "use strict";

  var NETWORK = "testnet";
  var HOST = "test.albukhr.com";
  var BASE = "https://vhvkwvngmrlgyzwemttt.supabase.co/functions/v1/testnet-liquidity-admin";
  var MIN_REQUIRED_LIQUIDITY = 100;

  function clean(v){ return String(v == null ? "" : v).trim(); }
  function num(v){ var n = Number(v); return Number.isFinite(n) ? n : 0; }

  function validate(){
    var env = window.ALBukhrEnvironment;
    if(!env || typeof env.isKnown !== "function" || typeof env.isTestnet !== "function" || typeof env.getNetwork !== "function") throw new Error("TESTNET_ENVIRONMENT_UNAVAILABLE");
    if(!env.isKnown() || !env.isTestnet() || env.getNetwork() !== NETWORK) throw new Error("INVALID_TESTNET_ENVIRONMENT");
    var host = typeof env.getHostname === "function" ? clean(env.getHostname()).toLowerCase() : clean(window.location.hostname).toLowerCase();
    if(host !== HOST) throw new Error("TESTNET_LIQUIDITY_HOST_REQUIRED");
  }

  function token(){
    validate();
    var auth = window.AlbukhrTestnetAdminAuth;
    if(!auth || typeof auth.getSessionToken !== "function") throw new Error("TESTNET_ADMIN_AUTH_UNAVAILABLE");
    var value = clean(auth.getSessionToken());
    if(!value) throw new Error("TESTNET_ADMIN_SESSION_REQUIRED");
    return value;
  }

  async function request(method, body){
    var bearer = token();
    var options = {
      method: method,
      headers: {"Accept":"application/json", "Authorization":"Bearer " + bearer}
    };
    if(body != null){
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }
    var response = await fetch(BASE, options);
    var data = null;
    try{ data = await response.json(); }catch(_){ }
    if(!response.ok){
      var err = new Error(clean(data && (data.error || data.message)) || "TESTNET_LIQUIDITY_API_ERROR");
      err.status = response.status;
      err.body = data;
      throw err;
    }
    return data;
  }

  function readiness(row){
    var project = row && row.project || {};
    var treasury = row && row.treasury || null;
    var required = Math.max(MIN_REQUIRED_LIQUIDITY, num(row && row.readiness && row.readiness.required));
    var verified = Math.max(0, num(row && row.readiness && row.readiness.verified));
    return {
      project: project,
      treasury: treasury,
      payments: Array.isArray(row && row.payments) ? row.payments : [],
      required: required,
      verified: verified,
      coverage: required > 0 ? (verified / required) * 100 : 0,
      ready: String(project.status || "").toLowerCase() === "approved" && verified >= required,
      code: verified >= required ? "ready" : verified > 0 ? "partial" : "pending"
    };
  }

  async function load(){
    var result = await request("GET");
    var rows = Array.isArray(result && result.projects) ? result.projects : [];
    return rows.map(readiness);
  }

  async function initialize(projectId, treasuryWallet, requiredLiquidity){
    return request("POST", {
      action: "initialize",
      project_id: clean(projectId),
      treasury_wallet: clean(treasuryWallet),
      required_liquidity: Math.max(MIN_REQUIRED_LIQUIDITY, num(requiredLiquidity || MIN_REQUIRED_LIQUIDITY))
    });
  }

  async function recompute(projectId){
    return request("POST", {action:"recompute", project_id:clean(projectId)});
  }

  async function verifyPayment(paymentRecordId, reference){
    return request("POST", {
      action: "verify_payment",
      payment_record_id: clean(paymentRecordId),
      verification_reference: clean(reference)
    });
  }

  window.AlbukhrTestnetLiquidity = Object.freeze({
    network: NETWORK,
    host: HOST,
    baseUrl: BASE,
    MIN_REQUIRED_LIQUIDITY: MIN_REQUIRED_LIQUIDITY,
    load: load,
    initialize: initialize,
    recompute: recompute,
    verifyPayment: verifyPayment
  });
})(window);
