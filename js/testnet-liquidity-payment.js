/* ALBUKHR TESTNET LIQUIDITY PAYMENT v3 */
(function(window, document){
  "use strict";

  var NETWORK = "testnet";
  var HOST = "test.albukhr.com";
  var API_BASE = "https://test-albukhr-api.onrender.com/liquidity-payment";
  var initialized = false;
  var accessToken = "";
  var authPromise = null;
  var authenticatedMode = "";

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

  function getOwnerSessionToken(){
    var auth = window.AlbukhrTestnetAuth;
    if(!auth || typeof auth.getSessionToken !== "function"){
      throw new Error("TESTNET_SESSION_REQUIRED");
    }

    var token = clean(auth.getSessionToken());
    if(!token){
      throw new Error("TESTNET_SESSION_REQUIRED");
    }

    return token;
  }

  function getAdminSessionToken(){
    var auth = window.AlbukhrTestnetAdminAuth;
    if(!auth || typeof auth.getSessionToken !== "function"){
      throw new Error("TESTNET_ADMIN_SESSION_REQUIRED");
    }

    var token = clean(auth.getSessionToken());
    if(!token){
      throw new Error("TESTNET_ADMIN_SESSION_REQUIRED");
    }

    return token;
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

    if(options.sessionToken){
      headers["X-Testnet-Session"] = options.sessionToken;
    }

    if(options.adminSessionToken){
      headers["X-Testnet-Admin-Session"] =
        options.adminSessionToken;
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

  async function recoverIncompletePayment(payment, mode){
    var identifier = clean(payment && payment.identifier);
    if(!identifier) return null;

    var txid = clean(
      payment &&
      payment.transaction &&
      payment.transaction.txid
    );

    var isAdmin = mode === "admin";
    var headers = {
      "Content-Type": "application/json",
      "Accept": "application/json"
    };

    if(isAdmin){
      headers["X-Testnet-Admin-Session"] = getAdminSessionToken();
    }

    var endpoint = isAdmin ? "/admin-incomplete" : "/incomplete";

    var response = await fetch(API_BASE + endpoint, {
      method: "POST",
      headers: headers,
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

  async function onOwnerIncompletePayment(payment){
    return recoverIncompletePayment(payment, "owner");
  }

  async function onAdminIncompletePayment(payment){
    return recoverIncompletePayment(payment, "admin");
  }

  function init(){
    validateEnvironment();

    var Pi = sdk();

    if(initialized) return;

    Pi.init({
      version: "2.0"
    });

    initialized = true;
  }

  async function authenticate(mode){
    validateEnvironment();
    init();

    var authMode = mode === "admin" ? "admin" : "owner";
    var callback = authMode === "admin"
      ? onAdminIncompletePayment
      : onOwnerIncompletePayment;

    if(accessToken && authenticatedMode === authMode){
      return { accessToken: accessToken };
    }

    if(authPromise){
      return authPromise;
    }

    authPromise = (async function(){
      var Pi = sdk();

      var auth = await Pi.authenticate(
        ["username", "payments"],
        callback
      );

      if(!auth || !auth.accessToken){
        throw new Error("PI_ACCESS_TOKEN_MISSING");
      }

      accessToken = clean(auth.accessToken);
      authenticatedMode = authMode;

      return auth;
    })();

    try{
      return await authPromise;
    }finally{
      authPromise = null;
    }
  }

  function createPaymentFlow(options, mode){
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

    var endpointPrefix =
      mode === "admin"
        ? "admin-"
        : "";

    var sessionToken =
      mode === "admin"
        ? null
        : getOwnerSessionToken();

    var adminSessionToken =
      mode === "admin"
        ? getAdminSessionToken()
        : null;

    return authenticate(mode).then(function(){
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
                var approved =
                  await request(
                    endpointPrefix + "approve",
                    {
                      method: "POST",
                      sessionToken: sessionToken,
                      adminSessionToken:
                        adminSessionToken,
                      body: JSON.stringify({
                        paymentId: paymentId,
                        projectId: projectId,
                        projectCode: projectCode
                      })
                    }
                  );

                dispatch("albukhr:testnet-liquidity-payment-approved", approved);

                if(!approved || approved.success !== true){
                  throw new Error(
                    "TESTNET_LIQUIDITY_APPROVAL_FAILED"
                  );
                }

                return approved;
              }catch(error){
                console.error(
                  "[ALBUKHR TESTNET LIQUIDITY APPROVE]",
                  error
                );
                throw error;
              }
            },

            onReadyForServerCompletion: async function(paymentId, txid){
              try{
                var completed =
                  await request(
                    endpointPrefix + "complete",
                    {
                      method: "POST",
                      sessionToken: sessionToken,
                      adminSessionToken:
                        adminSessionToken,
                      body: JSON.stringify({
                        paymentId: paymentId,
                        projectId: projectId,
                        projectCode: projectCode,
                        txid: txid
                      })
                    }
                  );

                if(!completed || completed.success !== true){
                  throw new Error(
                    "TESTNET_LIQUIDITY_COMPLETION_FAILED"
                  );
                }

                dispatch("albukhr:testnet-liquidity-payment-completed", completed);
                done(resolve, completed);
                return completed;
              }catch(error){
                console.error(
                  "[ALBUKHR TESTNET LIQUIDITY COMPLETE]",
                  error
                );
                throw error;
              }
            },

            onCancel: function(paymentId){
              var error =
                new Error(
                  "PI_PAYMENT_CANCELLED"
                );
              error.paymentId =
                paymentId;
              dispatch("albukhr:testnet-liquidity-payment-cancelled", { paymentId: paymentId, network: NETWORK });
              done(reject, error);
            },

            onError: function(error, payment){
              var e =
                error instanceof Error
                  ? error
                  : new Error(
                      clean(
                        error &&
                        error.message
                      ) ||
                      "PI_PAYMENT_FAILED"
                    );

              e.payment =
                payment || null;

              dispatch("albukhr:testnet-liquidity-payment-error", { error: e, payment: payment || null });
              done(reject, e);
            }
          }
        );
      });
    });
  }

  async function startPayment(options){
    return createPaymentFlow(
      options,
      "owner"
    );
  }

  async function startAdminPayment(options){
    return createPaymentFlow(
      options,
      "admin"
    );
  }

  async function createLiquidityPayment(project, amount){
    var safeProject = project || {};
    var projectId = clean(safeProject.id);
    var projectCode = clean(safeProject.project_code);

    if(!projectId) throw new Error("PROJECT_ID_REQUIRED");
    if(!projectCode) throw new Error("PROJECT_CODE_REQUIRED");
    if(clean(safeProject.network).toLowerCase() !== NETWORK){
      throw new Error("PROJECT_NETWORK_INVALID");
    }

    return startPayment({
      projectId: projectId,
      projectCode: projectCode,
      amount: amount,
      memo: "ALBUKHR Testnet liquidity • " + projectCode
    });
  }

  async function addLiquidity(project, amount){
    return createLiquidityPayment(project, amount);
  }

  async function recoverIncomplete(payment, mode){
    return recoverIncompletePayment(
      payment,
      mode === "admin" ? "admin" : "owner"
    );
  }

  function clearAuth(){
    accessToken = "";
    authenticatedMode = "";
  }

  function clearInMemoryPiAuth(){
    clearAuth();
  }

  function dispatch(name, detail){
    try{
      window.dispatchEvent(
        new CustomEvent(name, { detail: detail || null })
      );
    }catch(_){ }
  }

  var api = {
    network: NETWORK,
    host: HOST,
    apiBase: API_BASE,
    init: init,
    authenticate: authenticate,
    createLiquidityPayment: createLiquidityPayment,
    addLiquidity: addLiquidity,
    startPayment: startPayment,
    startAdminPayment: startAdminPayment,
    recoverIncomplete: recoverIncomplete,
    clearAuth: clearAuth,
    clearInMemoryPiAuth: clearInMemoryPiAuth
  };

  try{
    Object.freeze(api);
  }catch(_){}

  window.AlbukhrTestnetLiquidityPayment = api;
})(window, document);
