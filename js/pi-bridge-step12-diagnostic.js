/* ALBUKHR PI BRIDGE STEP 12 - DIRECT PAYMENT DIAGNOSTIC */
(function (window, document) {
  "use strict";
  var HOST = "test.albukhr.com";
  var ORIGIN = "https://" + HOST;
  var SDK_VERSION = "2.0";
  var SANDBOX = false;
  var initialized = false;
  var authenticatedUser = null;
  var startTime = Date.now();

  function clean(value) { return String(value == null ? "" : value).trim(); }
  function byId(id) { return document.getElementById(id); }
  function elapsed() { return (Date.now() - startTime) + "ms"; }
  function safeJson(value) { try { return JSON.stringify(value); } catch (e) { return JSON.stringify({type:Object.prototype.toString.call(value)}); } }

  function log(event, detail) {
    var line = "[" + elapsed() + "] " + event;
    if (detail !== undefined) line += "\n" + safeJson(detail);
    var node = byId("log");
    if (node) { node.textContent += (node.textContent ? "\n" : "") + line; node.scrollTop = node.scrollHeight; }
    try { console.log("[ALBUKHR STEP12]", event, detail); } catch (_) {}
  }
  function setStatus(text) { var node = byId("status"); if (node) node.textContent = text; }

  function checkEnvironment() {
    var result = {host:window.location.host,origin:window.location.origin,piPresent:!!window.Pi,paymentCreated:false,accessTokenDisplayed:false};
    log("PI_CHECK", result);
    if (window.location.host !== HOST || window.location.origin !== ORIGIN) throw new Error("STEP12_WRONG_ORIGIN");
    if (!window.Pi) throw new Error("PI_SDK_NOT_AVAILABLE");
    return result;
  }

  function initializePi() {
    checkEnvironment();
    if (initialized) { log("PI_INIT_ALREADY_DONE"); setStatus("PI_INIT_OK"); return window.Pi; }
    if (typeof window.Pi.init !== "function") throw new Error("PI_INIT_UNAVAILABLE");
    try {
      var result = window.Pi.init({version:SDK_VERSION,sandbox:SANDBOX});
      initialized = true;
      log("PI_INIT_OK", {version:SDK_VERSION,sandbox:SANDBOX,returnValueType:typeof result});
      setStatus("PI_INIT_OK");
      return window.Pi;
    } catch (error) {
      initialized = false;
      log("PI_INIT_ERROR", {name:error&&error.name,message:error&&error.message});
      setStatus("PI_INIT_ERROR");
      throw error;
    }
  }

  async function authenticate() {
    initializePi();
    if (authenticatedUser) { log("AUTH_ALREADY_DONE", {uidPresent:!!clean(authenticatedUser.uid),usernamePresent:!!clean(authenticatedUser.username)}); setStatus("AUTH_OK"); return authenticatedUser; }
    if (typeof window.Pi.authenticate !== "function") throw new Error("PI_AUTHENTICATE_UNAVAILABLE");
    log("AUTH_CALLED", {scopes:["username","payments"]});
    try {
      var result = await window.Pi.authenticate(["username","payments"], function(payment) {
        log("INCOMPLETE_PAYMENT_FOUND", {paymentPresent:!!payment,paymentIdPresent:!!(payment&&payment.identifier)});
      });
      if (!result || !result.user || !clean(result.user.uid)) throw new Error("PI_AUTH_RESULT_INVALID");
      authenticatedUser = {uid:clean(result.user.uid),username:clean(result.user.username)};
      log("AUTH_OK", {userPresent:true,uidPresent:!!authenticatedUser.uid,usernamePresent:!!authenticatedUser.username,accessTokenPresent:!!clean(result.accessToken)});
      setStatus("AUTH_OK");
      return result;
    } catch (error) {
      log("AUTH_ERROR", {name:error&&error.name,message:error&&error.message});
      setStatus("AUTH_ERROR");
      throw error;
    }
  }

  function getAmount() {
    var node = byId("amount");
    var value = Number(node && node.value);
    if (!Number.isFinite(value) || value <= 0) throw new Error("INVALID_TESTNET_AMOUNT");
    return value;
  }

  async function createPayment() {
    checkEnvironment();
    await authenticate();
    if (typeof window.Pi.createPayment !== "function") throw new Error("PI_CREATE_PAYMENT_UNAVAILABLE");
    var amount = getAmount();
    var paymentData = {amount:amount,memo:"ALBUKHR Testnet Bridge Step 12 Diagnostic",metadata:{network:"testnet",action:"step12_direct_payment_diagnostic",project_code:"DIAGNOSTIC"}};
    log("CREATE_PAYMENT_CALLED", {amount:amount,memo:paymentData.memo,metadataAction:paymentData.metadata.action});
    setStatus("CREATE_PAYMENT_CALLED — waiting for Pi payment UI/callback…");

    try {
      await new Promise(function(resolve,reject) {
        var settled = false;
        function finishResolve(value) { if (settled) return; settled=true; resolve(value); }
        function finishReject(error) { if (settled) return; settled=true; reject(error instanceof Error ? error : new Error("PI_CREATE_PAYMENT_ERROR")); }
        try {
          window.Pi.createPayment(paymentData, {
            onReadyForServerApproval:function(paymentId) {
              log("READY_FOR_SERVER_APPROVAL", {paymentIdPresent:!!clean(paymentId)});
              setStatus("READY_FOR_SERVER_APPROVAL — Pi.createPayment reached the approval callback. No backend approval is called.");
              /* Intentionally do NOT call ALBUKHR /approve. */
            },
            onReadyForServerCompletion:function(paymentId,txid) {
              log("READY_FOR_SERVER_COMPLETION", {paymentIdPresent:!!clean(paymentId),txidPresent:!!clean(txid)});
              setStatus("READY_FOR_SERVER_COMPLETION — diagnostic did not call backend completion.");
            },
            onCancel:function(paymentId) {
              log("PAYMENT_CANCELLED", {paymentIdPresent:!!clean(paymentId)});
              setStatus("PAYMENT_CANCELLED");
              finishResolve({status:"cancelled",paymentIdPresent:!!clean(paymentId)});
            },
            onError:function(error,payment) {
              log("PAYMENT_ERROR", {errorName:error&&error.name,errorMessage:error&&error.message,paymentPresent:!!payment,paymentIdPresent:!!(payment&&clean(payment.identifier))});
              setStatus("PAYMENT_ERROR");
              finishReject(error||new Error("PI_CREATE_PAYMENT_ERROR"));
            }
          });
        } catch (error) {
          log("CREATE_PAYMENT_THROWN", {name:error&&error.name,message:error&&error.message});
          finishReject(error);
        }
      });
      log("CREATE_PAYMENT_FLOW_ENDED");
    } catch (error) {
      log("CREATE_PAYMENT_ERROR", {name:error&&error.name,message:error&&error.message});
      setStatus("CREATE_PAYMENT_ERROR");
      throw error;
    }
  }

  function wire(id,handler) {
    var node=byId(id);
    if (node) node.addEventListener("click",function(){ Promise.resolve().then(handler).catch(function(){}); });
  }

  window.addEventListener("load",function(){
    try {
      checkEnvironment();
      log("STEP12_READY", {host:HOST,origin:ORIGIN,piPresent:!!window.Pi,paymentCreated:false,accessTokenDisplayed:false});
    } catch (error) {
      log("STEP12_BOOT_ERROR", {name:error&&error.name,message:error&&error.message});
      setStatus("STEP12_BOOT_ERROR");
    }
    wire("initBtn",initializePi);
    wire("authBtn",authenticate);
    wire("paymentBtn",createPayment);
    var clearButton=byId("clearBtn");
    if (clearButton) clearButton.addEventListener("click",function(){var node=byId("log");if(node)node.textContent="";startTime=Date.now();log("LOG_CLEARED");});
  });
})(window, document);
