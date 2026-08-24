/* =========================================================
   ALBUKHR SUPABASE CORE v4
   js/core/supabase-core.js

   USER FOUNDATION
   environment-switcher.js
          ↓
   supabase-core.js
          ↓
   domain engines
          ↓
   page controllers

   RULES
   - One shared lazy Supabase client.
   - Environment-switcher is authoritative for network.
   - No LocalStorage/sessionStorage persistence.
   - Network-aware read/write helpers.
   - Domain engines do not carry Supabase credentials.
   - No second eager client is created.
========================================================= */

(function () {
  "use strict";

  const ALBUKHR_SUPABASE_URL =
    "https://qexmnghilahsvethlxem.supabase.co";

  const ALBUKHR_SUPABASE_KEY =
    "sb_publishable_mSbWlhVKdmSjasKJC50QYw_5wzgRMe2";

  let client = null;
  let initError = null;

  function safeString(value, fallback = "") {
    return value === null || value === undefined
      ? fallback
      : String(value);
  }

  function resolveNetwork() {
    if (typeof window.getAlbukhrNetwork !== "function") {
      throw new Error(
        "ALBUKHR environment-switcher.js must load before supabase-core.js."
      );
    }

    const network = window.getAlbukhrNetwork();

    if (network !== "mainnet" && network !== "testnet") {
      throw new Error(
        "Unknown ALBUKHR network. Network-sensitive operation refused."
      );
    }

    return network;
  }

  function hasSupabaseSDK() {
    return Boolean(
      window.supabase &&
      typeof window.supabase.createClient === "function"
    );
  }

  function createClient() {
    if (client) return client;

    if (!hasSupabaseSDK()) {
      initError =
        "Supabase SDK not found. Load @supabase/supabase-js before supabase-core.js.";
      return null;
    }

    try {
      client = window.supabase.createClient(
        ALBUKHR_SUPABASE_URL,
        ALBUKHR_SUPABASE_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        }
      );

      initError = null;
      return client;
    } catch (error) {
      initError =
        error?.message ||
        "Failed to create ALBUKHR Supabase client.";

      console.error(
        "ALBUKHR Supabase client creation failed:",
        error
      );

      return null;
    }
  }

  function getAlbukhrSupabaseClient() {
    return client || createClient();
  }

  function requireAlbukhrSupabaseClient() {
    const instance = getAlbukhrSupabaseClient();

    if (!instance) {
      throw new Error(
        initError ||
        "ALBUKHR Supabase client is unavailable."
      );
    }

    return instance;
  }

  function applyAlbukhrNetworkFilter(query) {
    if (!query || typeof query.eq !== "function") {
      throw new Error("A valid Supabase query is required.");
    }

    return query.eq("network", resolveNetwork());
  }

  function withAlbukhrNetwork(payload = {}) {
    return {
      ...payload,
      network: resolveNetwork()
    };
  }

  function assertAlbukhrNetworkValue(network) {
    const current = resolveNetwork();

    if (network !== "mainnet" && network !== "testnet") {
      throw new Error("Invalid ALBUKHR network value.");
    }

    if (network !== current) {
      throw new Error(
        `Network mismatch: current environment is ${current}, requested ${network}.`
      );
    }

    return true;
  }

  function albukhrFrom(table) {
    const tableName = safeString(table).trim();

    if (!tableName) {
      throw new Error("Supabase table name is required.");
    }

    return requireAlbukhrSupabaseClient().from(tableName);
  }

  function albukhrSelect(table, columns = "*") {
    return applyAlbukhrNetworkFilter(
      albukhrFrom(table).select(columns)
    );
  }

  function albukhrInsert(table, payload, options = {}) {
    const rows = Array.isArray(payload)
      ? payload
      : [payload];

    const safeRows = rows.map((row) =>
      withAlbukhrNetwork(row || {})
    );

    return albukhrFrom(table).insert(
      safeRows,
      options
    );
  }

  function albukhrUpdate(table, values, filterBuilder) {
    if (typeof filterBuilder !== "function") {
      throw new Error(
        "albukhrUpdate() requires a filterBuilder callback."
      );
    }

    let query =
      albukhrFrom(table).update(values);

    query = filterBuilder(query);

    return applyAlbukhrNetworkFilter(query);
  }

  function albukhrDelete(table, filterBuilder) {
    if (typeof filterBuilder !== "function") {
      throw new Error(
        "albukhrDelete() requires a filterBuilder callback."
      );
    }

    let query =
      albukhrFrom(table).delete();

    query = filterBuilder(query);

    return applyAlbukhrNetworkFilter(query);
  }

  function albukhrSupabaseHealth() {
    let network = null;
    let networkError = null;

    try {
      network = resolveNetwork();
    } catch (error) {
      networkError =
        error?.message || "Network unavailable";
    }

    const instance =
      getAlbukhrSupabaseClient();

    return {
      ready: Boolean(instance),
      has_sdk: hasSupabaseSDK(),
      has_client: Boolean(instance),
      network,
      network_ready: Boolean(network),
      url: safeString(ALBUKHR_SUPABASE_URL),
      key_present: Boolean(
        safeString(ALBUKHR_SUPABASE_KEY)
      ),
      init_error: initError || null,
      network_error: networkError
    };
  }

  async function testAlbukhrSupabaseConnection() {
    let network;

    try {
      network = resolveNetwork();
    } catch (error) {
      return {
        success: false,
        network: null,
        error:
          error?.message ||
          "Network unavailable"
      };
    }

    const instance =
      getAlbukhrSupabaseClient();

    if (!instance) {
      return {
        success: false,
        network,
        error:
          initError ||
          "Supabase client unavailable"
      };
    }

    try {
      /*
       * "projects" is the foundation smoke-test table currently used
       * by ALBUKHR. If the final schema uses another guaranteed table,
       * this helper can be changed centrally without touching pages.
       */
      const result =
        await applyAlbukhrNetworkFilter(
          instance
            .from("projects")
            .select("id", {
              count: "exact",
              head: true
            })
        );

      if (result.error) {
        return {
          success: false,
          network,
          error:
            result.error.message ||
            "Connection test failed"
        };
      }

      return {
        success: true,
        network,
        count: result.count ?? null
      };
    } catch (error) {
      return {
        success: false,
        network,
        error:
          error?.message ||
          "Connection test crashed"
      };
    }
  }

  window.getAlbukhrSupabaseClient =
    getAlbukhrSupabaseClient;

  window.requireAlbukhrSupabaseClient =
    requireAlbukhrSupabaseClient;

  window.isAlbukhrSupabaseReady =
    () => Boolean(getAlbukhrSupabaseClient());

  /*
   * IMPORTANT:
   * Do not redefine getAlbukhrNetwork here. The environment switcher
   * remains the single authoritative network resolver.
   */
  window.applyAlbukhrNetworkFilter =
    applyAlbukhrNetworkFilter;

  window.withAlbukhrNetwork =
    withAlbukhrNetwork;

  window.assertAlbukhrNetworkValue =
    assertAlbukhrNetworkValue;

  window.albukhrFrom =
    albukhrFrom;

  window.albukhrSelect =
    albukhrSelect;

  window.albukhrInsert =
    albukhrInsert;

  window.albukhrUpdate =
    albukhrUpdate;

  window.albukhrDelete =
    albukhrDelete;

  window.albukhrSupabaseHealth =
    albukhrSupabaseHealth;

  window.testAlbukhrSupabaseConnection =
    testAlbukhrSupabaseConnection;

  /*
   * Compatibility accessor — this is still the same shared client.
   */
  try {
    Object.defineProperty(
      window,
      "albukhrSupabase",
      {
        configurable: true,
        get() {
          return getAlbukhrSupabaseClient();
        }
      }
    );
  } catch (error) {
    console.warn(
      "Could not define albukhrSupabase compatibility accessor:",
      error
    );
  }

  console.info(
    "ALBUKHR Supabase Core loaded. Client initialization is lazy."
  );
})();
