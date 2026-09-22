/* ALBUKHR TESTNET LIQUIDITY PAYMENT v2 */
(function(window, document){
  "use strict";

  var NETWORK = "testnet";
  var HOST = "test.albukhr.com";
  var API_BASE = "https://test-albukhr-api.onrender.com/liquidity-payment";
  var initialized = false;
  var accessToken = "";
  var authPromise = null;

  function clean(v){
    return String(v == null ? "" : v).trim();
  }

  function validateEnvironment(){
    var env = window.ALBukhrEnvironment;
    if(
      !env ||
      typeof env.isKnown !== "function" ||
      typeof env.isTestnet !== "function" ||
      typeof env.getNetwork !== "function"
    ){
      throw new Error("TESTNET_ENVIRONMENT_UNAVAILABLE");
    }

    if(!env.isKnown() || !env.isTestnet() || env.getNetwork() !== NETWORK){
      throw new Error("INVALID_TESTNET_ENVIRONMENT");
    }

    var host = typeof env.getHostname === "function"
      ? clean(env.getHostname()).toLowerCase()
      : clean(window.location.hostname).toLowerCase();

    if(host !== HOST) throw new Error("TESTNET_LIQUIDITY_PAYMENT_HOST_REQUIRED");
  }

  function sdk(){
    if(
      !window.Pi ||
      typeof window.Pi.init !== "function" ||
      typeof window.Pi.authenticate !== "function" ||
      typeof window.Pi.createPayment !== "function"
    ){
      throw new Error("PI_SDK_PAYMENT_UNAVAILABLE");
    }
    return window.Pi;
  }

  async function parse(response){
    var type = "";
    try{
      type = String(response.headers.get("content-type") || "").toLowerCase();
    }catch(_){}

    if(type.indexOf("json") !== -1){
      try{
        return await response.json();
      }catch(_){
        return null;
      }
    }

    var text = "";
    try{
      text = await response.text();
    }catch(_){}

    if(!text) return null;

    try{
      return JSON.parse(text);
    }catch(_){
      return text;
    }
  }

  async function request(path, options){
    validateEnvironment();
    options = options || {};

    var headers = {
      "Accept": "application/json"
    };

    if(accessToken){
      headers["Authorization"] = "Bearer " + accessToken;
    }

    if(options.body != null){
      headers["Content-Type"] = "application/json";
    }

    var response = await fetch(
      API_BASE.replace(/\/+$/g, "") + "/" + clean(path).replace(/^\/+/, ""),
      {
        method: clean(options.method || "GET").toUpperCase(),
        headers: headers,
        body: options.body != null ? options.body : undefined
      }
    );

    var data = await parse(response);

    if(!response.ok){
      var error = new Error(
        clean(data && (data.error || data.message)) ||
        "TESTNET_LIQUIDITY_PAYMENT_ERROR"
      );
      error.status = response.status;
      error.body = data;
      throw error;
    }

    return data;
  }

  /*
   * Pi invokes this callback when the authenticated user has an incomplete
   * U2A payment that still needs server-side completion.
   *
   * The callback intentionally does not send the Pi access token because
   * the backend resolves the payment from the trusted PaymentDTO identifier,
   * validates its Testnet metadata, verifies the on-chain transaction, and
   * then completes the payment with Pi.
   */
  async function onIncompletePayment(payment){
    var identifier = clean(payment && payment.identifier);
    if(!identifier) return null;

    var txid = clean(
      payment &&
      payment.transaction &&
      payment.transaction.txid
    );

    var response = await fetch(API_BASE + "/incomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        paymentId: identifier,
        txid: txid || undefined
      })
    });

    var data = await parse(response);

    if(!response.ok){
      var error = new Error(
        clean(data && (data.error || data.message)) ||
        "TESTNET_LIQUIDITY_INCOMPLETE_FAILED"
      );
      error.status = response.status;
      error.body = data;
      throw error;
    }

    return data;
  }

  function init(){
    validateEnvironment();

    var Pi = sdk();

    if(initialized) return;

    /*
     * This page is the hosted ALBUKHR Testnet app, not the Pi Sandbox URL.
     * The Testnet app must therefore use its Developer Portal Testnet
     * configuration rather than sandbox mode.
     */
    Pi.init({
      version: "2.0"
    });

    initialized = true;
  }

  async function authenticate(){
    validateEnvironment();
    init();

    if(accessToken){
      return { accessToken: accessToken };
    }

    if(authPromise) return authPromise;

    authPromise = (async function(){
      var Pi = sdk();

      var auth = await Pi.authenticate(
        ["username", "payments"],
        onIncompletePayment
      );

      if(!auth || !auth.accessToken){
        throw new Error("PI_ACCESS_TOKEN_MISSING");
      }

      accessToken = clean(auth.accessToken);

      return auth;
    })();

    try{
      return await authPromise;
    }finally{
      authPromise = null;
    }
  }

  async function startPayment(options){
    options = options || {};

    var projectId = clean(options.projectId);
    var projectCode = clean(options.projectCode);
    var amount = Number(options.amount);

    if(!projectId || !projectCode){
      throw new Error("PROJECT_ID_AND_CODE_REQUIRED");
    }

    if(!Number.isFinite(amount) || amount <= 0){
      throw new Error("INVALID_LIQUIDITY_AMOUNT");
    }

    await authenticate();

    var Pi = sdk();

    return new Promise(function(resolve, reject){
      var finished = false;

      function done(fn, value){
        if(finished) return;
        finished = true;
        fn(value);
      }

      Pi.createPayment(
        {
          amount: amount,
          memo: clean(
            options.memo ||
            ("ALBUKHR Testnet liquidity - " + projectCode)
          ),
          metadata: {
            network: NETWORK,
            action: "add_liquidity",
            project_id: projectId,
            project_code: projectCode
          }
        },
        {
          onReadyForServerApproval: async function(paymentId){
            try{
              var approved = await request("approve", {
                method: "POST",
                body: JSON.stringify({
                  paymentId: paymentId,
                  projectId: projectId
                })
              });

              if(!approved || approved.success !== true){
                throw new Error("TESTNET_LIQUIDITY_APPROVAL_FAILED");
              }

              return approved;
            }catch(error){
              console.error(
                "[ALBUKHR TESTNET LIQUIDITY APPROVE]",
                error
              );

              /*
               * Do not swallow the approval failure. Pi may retry this
               * callback during its approval window.
               */
              throw error;
            }
          },

          onReadyForServerCompletion: async function(paymentId, txid){
            try{
              var completed = await request("complete", {
                method: "POST",
                body: JSON.stringify({
                  paymentId: paymentId,
                  projectId: projectId,
                  txid: txid
                })
              });

              if(!completed || completed.success !== true){
                throw new Error("TESTNET_LIQUIDITY_COMPLETION_FAILED");
              }

              done(resolve, completed);
              return completed;
            }catch(error){
              console.error(
                "[ALBUKHR TESTNET LIQUIDITY COMPLETE]",
                error
              );

              /*
               * Do not swallow the completion failure. Pi may retry this
               * callback during its completion window.
               */
              throw error;
            }
          },

          onCancel: function(paymentId){
            var error = new Error("PI_PAYMENT_CANCELLED");
            error.paymentId = paymentId;
            done(reject, error);
          },

          onError: function(error, payment){
            var e = error instanceof Error
              ? error
              : new Error(
                  clean(error && error.message) ||
                  "PI_PAYMENT_FAILED"
                );

            e.payment = payment || null;
            done(reject, e);
          }
        }
      );
    });
  }

  function clearAuth(){
    /*
     * This only clears the in-memory browser copy.
     * No persistent storage is used for the Pi access token.
     */
    accessToken = "";
  }

  var api = {
    network: NETWORK,
    host: HOST,
    apiBase: API_BASE,
    init: init,
    authenticate: authenticate,
    startPayment: startPayment,
    clearAuth: clearAuth
  };

  try{
    Object.freeze(api);
  }catch(_){}

  window.AlbukhrTestnetLiquidityPayment = api;
})(window, document);
