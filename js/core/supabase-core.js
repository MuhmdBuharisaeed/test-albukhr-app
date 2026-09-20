/* ALBUKHR TESTNET SUPABASE CORE v5 */
(function (window) {
  "use strict";

  /*
   * ALBUKHR TESTNET SUPABASE CORE
   *
   * Responsibilities:
   * - Validate the ALBUKHR Testnet environment.
   * - Validate the Supabase browser SDK.
   * - Create exactly one Testnet Supabase client.
   * - Expose the shared ALBUKHR Supabase Core.
   *
   * This file does NOT:
   * - authenticate Pi users;
   * - manage Testnet gateway sessions;
   * - perform payments;
   * - switch environments;
   * - read/write Mainnet data.
   */

  /*
   * Prevent duplicate initialization.
   *
   * The first successfully initialized client remains the shared
   * ALBUKHR Supabase client for the current page.
   */
  if (window.ALBUKHR_SUPABASE) {
    return;
  }

  /*
   * Environment Core must already be loaded.
   */
  var env = window.ALBukhrEnvironment;

  if (
    !env ||
    typeof env.isKnown !== "function" ||
    typeof env.getNetwork !== "function" ||
    typeof env.getSupabaseUrl !== "function"
  ) {
    console.error(
      "[ALBUKHR TESTNET] Environment Core is unavailable."
    );
    return;
  }

  /*
   * Testnet-only environment validation.
   *
   * There is deliberately no Mainnet fallback here.
   */
  if (
    !env.isKnown() ||
    !env.isTestnet() ||
    env.getNetwork() !== "testnet"
  ) {
    console.error(
      "[ALBUKHR TESTNET] Unknown or invalid environment."
    );
    return;
  }

  /*
   * Resolve the Testnet Supabase URL from Environment Core.
   */
  var supabaseUrl = env.getSupabaseUrl();

  if (!supabaseUrl) {
    console.error(
      "[ALBUKHR TESTNET] Testnet Supabase URL is unavailable."
    );
    return;
  }

  /*
   * The browser must never initialize the Testnet client unless
   * the configured URL is the canonical Testnet Supabase project.
   *
   * This is an additional frontend guard against accidental
   * configuration drift.
   */
  var expectedSupabaseUrl =
    "https://vhvkwvngmrlgyzwemttt.supabase.co";

  if (supabaseUrl !== expectedSupabaseUrl) {
    console.error(
      "[ALBUKHR TESTNET] Supabase URL does not match the Testnet project."
    );
    return;
  }

  /*
   * Validate the Supabase browser SDK.
   */
  if (
    !window.supabase ||
    typeof window.supabase.createClient !== "function"
  ) {
    console.error(
      "[ALBUKHR TESTNET] Supabase SDK missing."
    );
    return;
  }

  /*
   * ALBUKHR Testnet publishable key.
   *
   * This is intentionally a publishable browser key.
   * Database protection must be enforced through Supabase RLS,
   * database permissions, and server-side functions.
   */
  var SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_5YNtKXSpO1xvPXbpLTo2Nw_mrxDp1qT";

  /*
   * Create the single shared Testnet client.
   */
  var client;

  try {
    client = window.supabase.createClient(
      supabaseUrl,
      SUPABASE_PUBLISHABLE_KEY
    );
  } catch (error) {
    console.error(
      "[ALBUKHR TESTNET] Failed to initialize Supabase client.",
      error
    );
    return;
  }

  if (!client) {
    console.error(
      "[ALBUKHR TESTNET] Supabase client initialization returned no client."
    );
    return;
  }

  /*
   * Shared ALBUKHR Testnet Core.
   *
   * All Testnet application modules should use this object rather
   * than creating independent Supabase clients.
   */
  var core = {
    client: client,

    network: "testnet",

    url: supabaseUrl,

    rpc: function (name, args) {
      return client.rpc(name, args);
    },

    from: function (table) {
      return client.from(table);
    },

    storage: client.storage
  };

  /*
   * Freeze the public Core object.
   *
   * The underlying Supabase client remains functional, while the
   * Core interface itself cannot be replaced or mutated by normal
   * application scripts.
   */
  try {
    Object.freeze(core);
  } catch (_) {
    /*
     * Object.freeze() is defensive only and is not relied upon
     * for database security.
     */
  }

  /*
   * Publish the canonical shared Testnet Supabase Core.
   */
  window.ALBUKHR_SUPABASE = core;

  /*
   * Compatibility accessor used throughout ALBUKHR.
   */
  window.getAlbukhrSupabaseClient = function () {
    return client;
  };

})(window);
