/* ALBUKHR TESTNET SUPABASE CORE v6 */
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

  /* Prevent duplicate initialization. */
  if (window.ALBUKHR_SUPABASE) {
    return;
  }

  /* Environment Core must already be loaded. */
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

  /* Testnet-only environment validation; no Mainnet fallback. */
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

  /* Resolve and pin the canonical Testnet Supabase URL. */
  var supabaseUrl = env.getSupabaseUrl();
  var expectedSupabaseUrl =
    "https://vhvkwvngmrlgyzwemttt.supabase.co";

  if (!supabaseUrl || supabaseUrl !== expectedSupabaseUrl) {
    console.error(
      "[ALBUKHR TESTNET] Supabase URL does not match the Testnet project."
    );
    return;
  }

  /* Validate the Supabase browser SDK. */
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
   * ALBUKHR Testnet publishable browser key.
   * This key is public by design. It is NOT a service-role key.
   * RLS, database grants and server-side authorization remain mandatory.
   */
  var SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_5YNtKXSpO1xvPXbpLTo2Nw_mrxDp1qT";

  /* Create the single shared Testnet client. */
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
   * publishableKey is intentionally exposed so direct Edge Function
   * requests can send Supabase's required `apikey` header. It is a
   * publishable browser key, never a service-role secret.
   */
  var core = {
    client: client,
    network: "testnet",
    url: supabaseUrl,
    publishableKey: SUPABASE_PUBLISHABLE_KEY,

    rpc: function (name, args) {
      return client.rpc(name, args);
    },

    from: function (table) {
      return client.from(table);
    },

    storage: client.storage
  };

  /* Freeze the public Core interface. */
  try {
    Object.freeze(core);
  } catch (_) {
    /* Object.freeze is defensive, not a database security boundary. */
  }

  window.ALBUKHR_SUPABASE = core;

  /* Compatibility accessor used throughout ALBUKHR. */
  window.getAlbukhrSupabaseClient = function () {
    return client;
  };

})(window);
