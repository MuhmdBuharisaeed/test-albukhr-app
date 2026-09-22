/* ALBUKHR TESTNET LIQUIDITY PAYMENT v1 */
(function(window, document){
  "use strict";

  var NETWORK = "testnet";
  var HOST = "test.albukhr.com";
  var API_BASE = "https://test-albukhr-api.onrender.com/liquidity";
  var initialized = false;
  var accessToken = "";
  var authPromise = null;
  var incompleteHandlerInstalled = false;

  function clean(v){ return String(v == null ? "" : v).trim(); }

  function validateEnvironment(){
    var env = window.ALBukhrEnvironment;
    if(!env || typeof env.isKnown !== "function" || typeof env.isTestnet !== "function" || typeof env.getNetwork !== "function") throw new Error("TESTNET_ENVIRONMENT_UNAVAILABLE");
    if(!env.isKnown() || !env.isTestnet() || env.getNetwork() !== NETWORK) throw new Error("INVALID_TESTNET_ENVIRONMENT");
    var host = typeof env.getHostname === "function" ? clean(env.getHostname()).toLowerCase() : clean(window.location.hostname).toLowerCase();
    if(host !== HOST) throw new Error("TESTNET_LIQUIDITY_PAYMENT_HOST_REQUIRED");
  }

  function sdk(){
    if(!window.Pi || typeof window.Pi.init !== "function" || typeof window.Pi.authenticate !== "function" || typeof window.Pi.createPayment !== "function") throw new Error("PI_SDK_PAYMENT_UNAVAILABLE");
    return window.Pi;
  }

  async function parse(response){
    var type="";
    try{ type=String(response.headers.get("content-type")||"").toLowerCase(); }catch(_){ }
    if(type.indexOf("json")!==-1){ try{return await response.json();}catch(_){return null;} }
    var text=""; try{text=await response.text();}catch(_){ }
    if(!text) return null;
    try{return JSON.parse(text);}catch(_){return text;}
  }

  async function request(path, options){
    validateEnvironment();
    options=options||{};
    var headers={"Accept":"application/json"};
    if(accessToken) headers["Authorization"]="Bearer "+accessToken;
    if(options.body!=null){ headers["Content-Type"]="application/json"; }
    var response=await fetch(API_BASE.replace(/\/+$/g,"")+"/"+clean(path).replace(/^\/+/,""),{
      method:clean(options.method||"GET").toUpperCase(),
      headers:headers,
      body:options.body!=null?options.body:undefined
    });
    var data=await parse(response);
    if(!response.ok){
      var error=new Error(clean(data && (data.error||data.message)) || "TESTNET_LIQUIDITY_PAYMENT_ERROR");
      error.status=response.status;
      error.body=data;
      throw error;
    }
    return data;
  }

  async function onIncompletePayment(payment){
    var identifier=clean(payment && payment.identifier);
    if(!identifier) return null;
    try{
      return await fetch(API_BASE+"/incomplete",{
        method:"POST",
        headers:{"Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify({
          paymentId:identifier,
          txid:clean(payment && payment.transaction && payment.transaction.txid),
          metadata:payment && payment.metadata ? payment.metadata : undefined
        })
      }).then(parse);
    }catch(error){
      console.error("[ALBUKHR TESTNET LIQUIDITY INCOMPLETE]",error);
      return null;
    }
  }

  function init(){
    validateEnvironment();
    var Pi=sdk();
    if(initialized) return;
    Pi.init({version:"2.0",sandbox:true});
    initialized=true;
  }

  async function authenticate(){
    validateEnvironment();
    init();
    if(accessToken) return {accessToken:accessToken};
    if(authPromise) return authPromise;
    authPromise=(async function(){
      var Pi=sdk();
      var auth=await Pi.authenticate(["username","payments"],onIncompletePayment);
      if(!auth || !auth.accessToken) throw new Error("PI_ACCESS_TOKEN_MISSING");
      accessToken=clean(auth.accessToken);
      return auth;
    })();
    try{return await authPromise;}finally{authPromise=null;}
  }

  async function startPayment(options){
    options=options||{};
    var projectId=clean(options.projectId);
    var projectCode=clean(options.projectCode);
    var amount=Number(options.amount);
    if(!projectId || !projectCode) throw new Error("PROJECT_ID_AND_CODE_REQUIRED");
    if(!Number.isFinite(amount) || amount<=0) throw new Error("INVALID_LIQUIDITY_AMOUNT");

    var auth=await authenticate();
    var Pi=sdk();

    return new Promise(function(resolve,reject){
      var finished=false;
      function done(fn,value){ if(finished)return; finished=true; fn(value); }
      Pi.createPayment({
        amount:amount,
        memo:clean(options.memo || ("ALBUKHR Testnet liquidity • "+projectCode)),
        metadata:{
          network:NETWORK,
          action:"add_liquidity",
          project_id:projectId,
          project_code:projectCode
        }
      },{
        onReadyForServerApproval:async function(paymentId){
          try{
            var approved=await request("approve",{
              method:"POST",
              body:JSON.stringify({
                paymentId:paymentId,
                projectId:projectId
              })
            });
            if(!approved || approved.success!==true) throw new Error("TESTNET_LIQUIDITY_APPROVAL_FAILED");
          }catch(error){
            console.error("[ALBUKHR TESTNET LIQUIDITY APPROVE]",error);
          }
        },
        onReadyForServerCompletion:async function(paymentId,txid){
          try{
            var completed=await request("complete",{
              method:"POST",
              body:JSON.stringify({
                paymentId:paymentId,
                projectId:projectId,
                txid:txid
              })
            });
            if(!completed || completed.success!==true) throw new Error("TESTNET_LIQUIDITY_COMPLETION_FAILED");
            done(resolve,completed);
          }catch(error){
            console.error("[ALBUKHR TESTNET LIQUIDITY COMPLETE]",error);
            done(reject,error);
          }
        },
        onCancel:function(paymentId){
          var error=new Error("PI_PAYMENT_CANCELLED");
          error.paymentId=paymentId;
          done(reject,error);
        },
        onError:function(error,payment){
          var e=error instanceof Error?error:new Error(clean(error&&error.message)||"PI_PAYMENT_FAILED");
          e.payment=payment||null;
          done(reject,e);
        }
      });
    });
  }

  function clearAuth(){ accessToken=""; }

  window.AlbukhrTestnetLiquidityPayment=Object.freeze({
    network:NETWORK,
    host:HOST,
    apiBase:API_BASE,
    init:init,
    authenticate:authenticate,
    startPayment:startPayment,
    clearAuth:clearAuth
  });
})(window,document);
