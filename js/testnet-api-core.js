(function(window){
  "use strict";

  /*
   * Testnet API client.
   *
   * Set window.ALBukhrTestnetApiBase before this file if the API is hosted
   * somewhere other than the same origin.
   *
   * Example:
   * window.ALBukhrTestnetApiBase = "https://YOUR-TESTNET-API-HOST";
   *
   * No API secret belongs here.
   */

  const DEFAULT_BASE = "/api";
  const base = String(
    window.ALBukhrTestnetApiBase || DEFAULT_BASE
  ).replace(/\/+$/, "");

  function clean(value){
    return String(value == null ? "" : value).trim();
  }

  async function request(path, options){
    const sessionApi = window.AlbukhrTestnetAuth;
    if (!sessionApi || typeof sessionApi.getSessionToken !== "function") {
      throw new Error("Testnet authentication module is unavailable.");
    }

    const token = clean(sessionApi.getSessionToken());
    if (!token) {
      const error = new Error("TESTNET_SESSION_REQUIRED");
      error.code = "TESTNET_SESSION_REQUIRED";
      throw error;
    }

    const response = await fetch(base + path, {
      method: options?.method || "GET",
      headers: Object.assign(
        {
          "Accept": "application/json",
          "Authorization": "Bearer " + token
        },
        options?.headers || {}
      ),
      body: options?.body
    });

    let body = null;
    try {
      body = await response.json();
    } catch (_) {}

    if (!response.ok) {
      const error = new Error(
        clean(body?.message) ||
        clean(body?.error) ||
        ("Testnet API request failed (" + response.status + ").")
      );
      error.status = response.status;
      error.code = clean(body?.error);
      throw error;
    }

    return body;
  }

  async function getInvestorData(){
    return request("/investor-data", {method:"GET"});
  }

  window.AlbukhrTestnetApi = Object.freeze({
    baseUrl: base,
    request,
    getInvestorData
  });
})(window);
