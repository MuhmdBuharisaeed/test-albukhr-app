/* ALBUKHR TESTNET WITHDRAWAL API v1 */
(function (window) {
  "use strict";

  var BASE_URL = "https://test-albukhr-api.onrender.com";
  var HOST = "test.albukhr.com";
  var NETWORK = "testnet";

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function validateEnvironment() {
    var env = window.ALBukhrEnvironment;
    if (!env || typeof env.isKnown !== "function" ||
        typeof env.isTestnet !== "function" ||
        typeof env.getNetwork !== "function") {
      throw new Error("TESTNET_ENVIRONMENT_UNAVAILABLE");
    }

    if (!env.isKnown() || !env.isTestnet() ||
        env.getNetwork() !== NETWORK) {
      throw new Error("INVALID_TESTNET_ENVIRONMENT");
    }

    var hostname = clean(
      typeof env.getHostname === "function"
        ? env.getHostname()
        : window.location.hostname
    ).toLowerCase();

    if (hostname !== HOST) {
      throw new Error("WITHDRAWAL_API_TESTNET_ONLY");
    }
  }

  function getToken() {
    var auth = window.AlbukhrTestnetAuth;
    if (!auth || typeof auth.getSessionToken !== "function") {
      throw new Error("TESTNET_AUTH_MODULE_UNAVAILABLE");
    }

    var token = clean(auth.getSessionToken());
    if (!token) {
      var error = new Error("TESTNET_SESSION_REQUIRED");
      error.code = "TESTNET_SESSION_REQUIRED";
      throw error;
    }
    return token;
  }

  async function parse(response) {
    var type = "";
    try {
      type = String(response.headers.get("content-type") || "").toLowerCase();
    } catch (_) {}

    if (type.indexOf("json") !== -1) {
      try { return await response.json(); } catch (_) { return null; }
    }

    var text = "";
    try { text = await response.text(); } catch (_) {}
    if (!text) return null;

    try { return JSON.parse(text); } catch (_) { return text; }
  }

  async function request(path, options) {
    options = options || {};
    validateEnvironment();

    var token = getToken();
    var target = BASE_URL.replace(/\/+$/, "") + "/" +
      clean(path).replace(/^\/+/, "");

    var headers = {
      "Accept": "application/json",
      "Authorization": "Bearer " + token
    };

    if (options.body != null) {
      headers["Content-Type"] = "application/json";
    }

    var response;
    try {
      response = await fetch(target, {
        method: clean(options.method || "GET").toUpperCase(),
        headers: headers,
        body: options.body != null ? options.body : undefined
      });
    } catch (error) {
      var networkError = new Error("TESTNET_WITHDRAWAL_NETWORK_ERROR");
      networkError.code = "TESTNET_WITHDRAWAL_NETWORK_ERROR";
      networkError.cause = error;
      throw networkError;
    }

    var body = await parse(response);

    if (!response.ok) {
      var message = "";
      if (body && typeof body === "object") {
        message = clean(body.message || body.error || body.detail);
      } else if (typeof body === "string") {
        message = clean(body);
      }

      var apiError = new Error(message || ("TESTNET_WITHDRAWAL_HTTP_" + response.status));
      apiError.code = body && typeof body === "object"
        ? clean(body.error) || "TESTNET_WITHDRAWAL_ERROR"
        : "TESTNET_WITHDRAWAL_ERROR";
      apiError.status = response.status;
      apiError.body = body;
      throw apiError;
    }

    return body;
  }

  async function withdraw(stakeId, withdrawalType, requestedAmount, walletAddress) {
    return request("withdraw", {
      method: "POST",
      body: JSON.stringify({
        stakeId: clean(stakeId),
        withdrawalType: clean(withdrawalType).toLowerCase(),
        requestedAmount: Number(requestedAmount),
        walletAddress: clean(walletAddress)
      })
    });
  }

  var api = {
    baseUrl: BASE_URL,
    network: NETWORK,
    host: HOST,
    request: request,
    withdraw: withdraw
  };

  try { Object.freeze(api); } catch (_) {}
  window.AlbukhrTestnetWithdrawalApi = api;
})(window);
