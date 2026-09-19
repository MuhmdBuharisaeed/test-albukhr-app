(function(window){
  "use strict";

  /*
   * ALBUKHR TESTNET — Investor API Core
   *
   * Source of truth:
   *   Supabase Edge Function: testnet-investor-data
   *
   * Authentication:
   *   Bearer token returned by testnet-auth-gateway.
   *
   * No LocalStorage is used.
   * The auth token is managed by testnet-gateway-auth.js.
   */

  const DEFAULT_BASE =
    "https://vhvkwvngmrlgyzwemttt.supabase.co/functions/v1/testnet-investor-data";

  const base = String(
    window.ALBukhrTestnetInvestorApiBase || DEFAULT_BASE
  ).replace(/\/+$/, "");

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  async function request(path = "", options = {}) {
    const auth = window.AlbukhrTestnetAuth;

    if (!auth || typeof auth.getSessionToken !== "function") {
      throw new Error("Testnet authentication module is unavailable.");
    }

    let token = clean(auth.getSessionToken());

    /*
     * A page refresh creates a new JS context. Restore the short-lived
     * Testnet session before making the protected API request.
     */
    if (!token && typeof auth.restore === "function") {
      await auth.restore();
      token = clean(auth.getSessionToken());
    }

    if (!token) {
      const error = new Error("TESTNET_SESSION_REQUIRED");
      error.code = "TESTNET_SESSION_REQUIRED";
      throw error;
    }

    const target = path
      ? base + "/" + String(path).replace(/^\/+/, "")
      : base;

    const headers = Object.assign(
      {
        "Accept": "application/json",
        "Authorization": "Bearer " + token
      },
      options.headers || {}
    );

    const response = await fetch(target, {
      method: options.method || "GET",
      headers,
      credentials: "include",
      body: options.body
    });

    let body = null;
    try {
      body = await response.json();
    } catch (_) {
      body = null;
    }

    if (!response.ok) {
      const message =
        body?.error ||
        body?.message ||
        ("TESTNET_API_HTTP_" + response.status);

      const error = new Error(message);
      error.status = response.status;
      error.body = body;
      throw error;
    }

    return body;
  }

  async function getInvestorData() {
    return request("", { method: "GET" });
  }

  window.AlbukhrTestnetApi = Object.freeze({
    baseUrl: base,
    request,
    getInvestorData
  });

})(window);
