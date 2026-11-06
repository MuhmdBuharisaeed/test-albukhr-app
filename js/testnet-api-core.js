/* ALBUKHR TESTNET API CORE v7 — includes required Supabase apikey header */
(function (window) {
  "use strict";

  var DEFAULT_BASE =
    "https://vhvkwvngmrlgyzwemttt.supabase.co/functions/v1/testnet-investor-data";

  var TESTNET_HOST = "test.albukhr.com";
  var TESTNET_NETWORK = "testnet";
  var TESTNET_SUPABASE_URL = "https://vhvkwvngmrlgyzwemttt.supabase.co";

  var base = String(
    window.ALBukhrTestnetInvestorApiBase || DEFAULT_BASE
  ).replace(/\/+$/, "");

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function getEnvironment() {
    var env = window.ALBukhrEnvironment;

    if (
      !env ||
      typeof env.isKnown !== "function" ||
      typeof env.isTestnet !== "function" ||
      typeof env.getNetwork !== "function"
    ) {
      throw new Error("Testnet environment module is unavailable.");
    }

    if (
      !env.isKnown() ||
      !env.isTestnet() ||
      env.getNetwork() !== TESTNET_NETWORK
    ) {
      throw new Error("Invalid Testnet environment.");
    }

    var hostname = "";

    if (typeof env.getHostname === "function") {
      hostname = clean(env.getHostname()).toLowerCase();
    } else {
      try {
        hostname = clean(
          window.location && window.location.hostname
            ? window.location.hostname
            : ""
        ).toLowerCase();
      } catch (_) {
        hostname = "";
      }
    }

    if (hostname !== TESTNET_HOST) {
      throw new Error("Testnet API is available only on test.albukhr.com.");
    }

    return env;
  }

  function getAuth() {
    var auth = window.AlbukhrTestnetAuth;

    if (
      !auth ||
      typeof auth.getSessionToken !== "function"
    ) {
      throw new Error("Testnet authentication module is unavailable.");
    }

    return auth;
  }

  /*
   * Read the public key from the one canonical shared Supabase Core.
   * Do not create a second Supabase client and never use service_role here.
   */
  function getSupabasePublishableKey() {
    var core = window.ALBUKHR_SUPABASE;
    var key = clean(core && core.publishableKey);

    if (
      !core ||
      core.network !== TESTNET_NETWORK ||
      core.url !== TESTNET_SUPABASE_URL ||
      key.indexOf("sb_publishable_") !== 0
    ) {
      throw new Error("TESTNET_SUPABASE_PUBLISHABLE_KEY_UNAVAILABLE");
    }

    return key;
  }

  function buildTarget(path) {
    var cleanPath = clean(path);

    if (!cleanPath) {
      return base;
    }

    return base + "/" + cleanPath.replace(/^\/+/, "");
  }

  function buildHeaders(options, token) {
    var headers = {
      "Accept": "application/json"
    };

    if (
      options &&
      options.body != null
    ) {
      headers["Content-Type"] = "application/json";
    }

    /* Preserve harmless caller headers, but never allow auth/key override. */
    if (options && options.headers) {
      Object.keys(options.headers).forEach(function (key) {
        var normalized = clean(key).toLowerCase();
        if (normalized === "authorization" || normalized === "apikey") {
          return;
        }
        headers[key] = options.headers[key];
      });
    }

    /* These two credentials are always set from trusted Testnet sources. */
    headers["Authorization"] = "Bearer " + token;
    headers["apikey"] = getSupabasePublishableKey();

    return headers;
  }

  async function parseResponse(response) {
    var contentType = "";

    try {
      contentType = String(
        response.headers.get("content-type") || ""
      ).toLowerCase();
    } catch (_) {
      contentType = "";
    }

    if (
      contentType.indexOf("application/json") !== -1 ||
      contentType.indexOf("+json") !== -1
    ) {
      try {
        return await response.json();
      } catch (_) {
        return null;
      }
    }

    try {
      var text = await response.text();

      if (!text) {
        return null;
      }

      try {
        return JSON.parse(text);
      } catch (_) {
        return text;
      }
    } catch (_) {
      return null;
    }
  }

  function getErrorMessage(body, status) {
    if (body && typeof body === "object") {
      var message = clean(
        body.error ||
        body.message ||
        body.detail ||
        body.code
      );

      if (message) {
        return message;
      }
    }

    if (typeof body === "string") {
      var text = clean(body);

      if (text) {
        return text;
      }
    }

    return "TESTNET_API_HTTP_" + String(status);
  }

  async function request(path, options) {
    options = options || {};

    getEnvironment();

    var auth = getAuth();
    var token = clean(auth.getSessionToken());

    if (!token) {
      var sessionError = new Error("TESTNET_SESSION_REQUIRED");
      sessionError.code = "TESTNET_SESSION_REQUIRED";
      throw sessionError;
    }

    var target = buildTarget(path);
    var method = clean(options.method || "GET").toUpperCase();
    var fetchOptions = {
      method: method,
      headers: buildHeaders(options, token)
    };

    if (options.body != null) {
      fetchOptions.body = options.body;
    }

    /* No browser cookies: Testnet API authentication is bearer-session based. */
    var response;

    try {
      response = await fetch(target, fetchOptions);
    } catch (networkError) {
      var error = new Error("TESTNET_API_NETWORK_ERROR");
      error.code = "TESTNET_API_NETWORK_ERROR";
      error.cause = networkError;
      throw error;
    }

    var body = await parseResponse(response);

    if (!response.ok) {
      var apiError = new Error(
        getErrorMessage(body, response.status)
      );

      apiError.status = response.status;
      apiError.body = body;

      if (response.status === 401) {
        apiError.code = "TESTNET_SESSION_UNAUTHORIZED";
      } else if (response.status === 403) {
        apiError.code = "TESTNET_API_FORBIDDEN";
      } else {
        apiError.code = "TESTNET_API_ERROR";
      }

      throw apiError;
    }

    return body;
  }

  async function getInvestorData() {
    return request("", {
      method: "GET"
    });
  }

  var api = {
    baseUrl: base,
    network: TESTNET_NETWORK,
    host: TESTNET_HOST,
    request: request,
    getInvestorData: getInvestorData
  };

  try {
    Object.freeze(api);
  } catch (_) {}

  window.AlbukhrTestnetApi = api;

})(window);
