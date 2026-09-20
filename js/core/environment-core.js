/* ALBUKHR TESTNET ENVIRONMENT CORE v5 */
(function (window) {
  "use strict";

  /*
   * ALBUKHR TESTNET
   *
   * This file is intentionally TESTNET-ONLY.
   *
   * Responsibilities:
   * - Identify the current ALBUKHR Testnet host.
   * - Expose the Testnet environment configuration.
   * - Provide the Testnet Supabase URL.
   * - Prevent accidental Mainnet fallback.
   *
   * This file does NOT:
   * - authenticate users;
   * - create Supabase clients;
   * - read/write application data;
   * - perform Pi payments;
   * - switch environments.
   */

  var TESTNET_HOST = "test.albukhr.com";
  var TESTNET_APP_URL = "https://test.albukhr.com";
  var TESTNET_SUPABASE_URL =
    "https://vhvkwvngmrlgyzwemttt.supabase.co";
  var TESTNET_NETWORK = "testnet";

  /*
   * Diagnostic marker.
   *
   * Other ALBUKHR modules can use this to distinguish:
   * 1. environment-core.js did not execute;
   * 2. environment-core.js executed but the host is invalid.
   */
  window.__ALBUKHR_ENVIRONMENT_CORE_LOADED__ = true;

  /*
   * Resolve the browser hostname safely.
   */
  var host = "";

  try {
    host = String(
      window.location && window.location.hostname
        ? window.location.hostname
        : ""
    )
      .trim()
      .toLowerCase()
      .replace(/\.$/, "");
  } catch (_) {
    host = "";
  }

  /*
   * Only the canonical Testnet hostname is accepted.
   */
  var known = host === TESTNET_HOST;

  /*
   * Immutable Testnet configuration.
   */
  var config = {
    key: "testnet",
    name: "TESTNET",
    host: TESTNET_HOST,
    appUrl: TESTNET_APP_URL,
    supabaseUrl: TESTNET_SUPABASE_URL,
    network: TESTNET_NETWORK
  };

  /*
   * Public Environment API.
   *
   * If the page is not running on test.albukhr.com:
   * - current = null
   * - getKey() = null
   * - getNetwork() = null
   * - getAppUrl() = null
   * - getSupabaseUrl() = null
   * - isKnown() = false
   *
   * This prevents accidental cross-environment access.
   */
  var environment = {
    current: known ? config : null,

    environments: {
      testnet: config
    },

    getKey: function () {
      return known ? "testnet" : null;
    },

    getName: function () {
      return known ? "TESTNET" : null;
    },

    getNetwork: function () {
      return known ? TESTNET_NETWORK : null;
    },

    getAppUrl: function () {
      return known ? TESTNET_APP_URL : null;
    },

    getSupabaseUrl: function () {
      return known ? TESTNET_SUPABASE_URL : null;
    },

    getHostname: function () {
      return host;
    },

    isKnown: function () {
      return known;
    },

    isTestnet: function () {
      return known;
    },

    /*
     * Explicitly false.
     *
     * Mainnet is not represented by this Testnet environment core.
     */
    isMainnet: function () {
      return false;
    },

    getConfig: function () {
      return known ? config : null;
    }
  };

  /*
   * Freeze configuration and public API where supported.
   *
   * This prevents another frontend script from modifying:
   * - Testnet Supabase URL
   * - Testnet network
   * - Testnet host
   * - environment methods
   *
   * It does not provide security by itself; actual data security
   * remains enforced by Supabase/RLS and backend functions.
   */
  try {
    Object.freeze(config);
    Object.freeze(environment.environments);
    Object.freeze(environment);
  } catch (_) {
    /*
     * Older browsers may not fully support Object.freeze().
     * The environment remains functional without freezing.
     */
  }

  /*
   * Publish the canonical environment object.
   */
  window.ALBukhrEnvironment = environment;

})(window);
