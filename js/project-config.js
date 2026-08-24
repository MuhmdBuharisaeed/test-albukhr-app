/* =========================================================
   ALBUKHR – PROJECT CONFIG / REGISTRY ADAPTER v2
   NEW ARCHITECTURE

   environment-switcher.js
          ↓
   supabase-core.js
          ↓
   project-config.js
          ↓
   page/domain controllers

   PURPOSE
   -------
   This file replaces the legacy static PROJECT_CONFIG source
   with a network-aware Supabase registry adapter.

   SOURCE OF TRUTH
   ---------------
   public.albukhr_project_registry

   RULES
   -----
   - No LocalStorage persistence.
   - No direct Supabase credentials.
   - Current network comes from ALBUKHR Network Core.
   - Only active + visible projects are exposed.
   - Core projects are read from project_type = "core".
   - Mainnet never reads Testnet records and vice versa.
   - Data is cached in memory only for the current page lifetime.
   - Legacy getProjectConfig(name) remains available for compatibility.
   - Supabase registry data takes precedence over legacy static data.

   IMPORTANT
   ----------
   The current database schema does not contain a dedicated
   "durations" column. The legacy duration values are therefore
   retained only as compatibility metadata until durations are
   formally stored in Supabase. They are NOT persisted locally.
========================================================= */

(function () {
  "use strict";

  const REGISTRY_TABLE = "albukhr_project_registry";

  /*
    Compatibility metadata only.

    These values came from the legacy project-config.js supplied
    for migration. They are not the project source of truth and
    are not written to LocalStorage.
  */
  const LEGACY_DURATION_MAP = Object.freeze({
    Azman: [180, 365, 430],
    Labbaika: [30, 60, 90],
    Barsh: [30, 60, 90],
    Urban: [30, 60, 90],
    Khairat: [30, 60, 90],
    Hauwal: [30, 60, 90],
    Raheem: [30, 60, 90]
  });

  const LEGACY_ICON_MAP = Object.freeze({
    Azman: "🧪",
    Labbaika: "🍞",
    Barsh: "🌾",
    Urban: "🚍",
    Khairat: "♻️",
    Hauwal: "🌽",
    Raheem: "💊"
  });

  const LEGACY_DESCRIPTION_MAP = Object.freeze({
    Azman:
      "Long-term science, technology, and innovation project focused on future invention and engineering.",
    Labbaika:
      "Food production project focused on modern bread and flour processing.",
    Barsh:
      "Mechanized farming and livestock project for large-scale agricultural production.",
    Urban:
      "Infrastructure project focused on modern transportation of people and goods.",
    Khairat:
      "Agricultural supply project improving fertiliser access and farm productivity.",
    Hauwal:
      "Agro-processing project modernizing maize milling into scalable production.",
    Raheem:
      "Healthcare project improving access to essential medicines."
  });

  const LEGACY_INFO_MAP = Object.freeze({
    Azman:
      "Azman supports research labs, prototyping, and advanced engineering capacity building.",
    Labbaika:
      "Labbaika enables scalable bakery production within the ALBUKHR ecosystem.",
    Barsh:
      "Barsh integrates modern farming, livestock, and sustainable agriculture systems.",
    Urban:
      "Urban improves accessibility and builds sustainable mobility networks.",
    Khairat:
      "Khairat supports transparent distribution systems and sustainable farming inputs.",
    Hauwal:
      "Hauwal focuses on clean processing, packaging, and food system efficiency.",
    Raheem:
      "Raheem provides transparent, community-driven pharmaceutical distribution."
  });

  let memoryCache = [];
  let loadedNetwork = null;
  let loadingPromise = null;
  let lastError = null;

  function safeString(value, fallback = "") {
    return value === null || value === undefined
      ? fallback
      : String(value);
  }

  function requireNetwork() {
    if (typeof window.requireAlbukhrNetwork === "function") {
      return window.requireAlbukhrNetwork();
    }

    if (typeof window.getAlbukhrNetwork === "function") {
      const network = window.getAlbukhrNetwork();

      if (network === "mainnet" || network === "testnet") {
        return network;
      }
    }

    throw new Error(
      "ALBUKHR Network Core is not available. Load environment-switcher.js before project-config.js."
    );
  }

  function requireSupabase() {
    if (typeof window.requireAlbukhrSupabaseClient === "function") {
      return window.requireAlbukhrSupabaseClient();
    }

    if (typeof window.getAlbukhrSupabaseClient === "function") {
      const client = window.getAlbukhrSupabaseClient();

      if (client) {
        return client;
      }
    }

    throw new Error(
      "ALBUKHR Supabase Core is not available. Load supabase-core.js before project-config.js."
    );
  }

  function getCompatibilityMetadata(projectCode) {
    return {
      icon: LEGACY_ICON_MAP[projectCode] || "📦",
      desc:
        LEGACY_DESCRIPTION_MAP[projectCode] ||
        "Albukhr Project",
      info:
        LEGACY_INFO_MAP[projectCode] ||
        "Project information not available.",
      durations:
        Array.isArray(LEGACY_DURATION_MAP[projectCode])
          ? [...LEGACY_DURATION_MAP[projectCode]]
          : [30, 60, 90]
    };
  }

  function normalizeProject(row) {
    const projectCode = safeString(row?.project_code).trim();

    if (!projectCode) {
      return null;
    }

    const compatibility = getCompatibilityMetadata(projectCode);

    const metadata =
      row?.metadata &&
      typeof row.metadata === "object" &&
      !Array.isArray(row.metadata)
        ? row.metadata
        : {};

    /*
      If durations are eventually added to registry metadata,
      use them. Otherwise retain the supplied legacy compatibility
      values until the schema is formally extended.
    */
    const metadataDurations =
      Array.isArray(metadata.durations)
        ? metadata.durations
            .map(Number)
            .filter(Number.isFinite)
        : null;

    const durations =
      metadataDurations && metadataDurations.length
        ? metadataDurations
        : compatibility.durations;

    const icon =
      safeString(metadata.icon).trim() ||
      compatibility.icon;

    const desc =
      safeString(row.description).trim() ||
      safeString(metadata.desc).trim() ||
      compatibility.desc;

    const info =
      safeString(row.info).trim() ||
      safeString(metadata.info).trim() ||
      desc ||
      compatibility.info;

    return Object.freeze({
      id: row.id ?? null,
      project_code: projectCode,
      code: projectCode,
      name: safeString(row.project_name, projectCode),
      title: safeString(row.project_name, projectCode),
      project_name: safeString(row.project_name, projectCode),
      project_type: safeString(row.project_type),
      status: safeString(row.status),
      network: safeString(row.network),
      category: safeString(row.category),
      stage: safeString(row.stage),
      description: desc,
      desc,
      info,
      icon,
      durations: Object.freeze([...durations]),
      roi: Number(row.roi ?? 0),
      reward_rate: Number(row.reward_rate ?? 0),
      reserve_percent: Number(row.reserve_percent ?? 0),
      min_liquidity: Number(row.min_liquidity ?? 100),
      project_visible: row.project_visible === true,
      dashboard_enabled: row.dashboard_enabled === true,
      transparency_enabled: row.transparency_enabled === true,
      metadata: Object.freeze({ ...metadata }),
      created_at: row.created_at ?? null,
      updated_at: row.updated_at ?? null
    });
  }

  async function loadProjectRegistry(options = {}) {
    const forceRefresh = options.forceRefresh === true;
    const coreOnly = options.coreOnly !== false;
    const network = requireNetwork();

    if (
      !forceRefresh &&
      loadedNetwork === network &&
      memoryCache.length
    ) {
      return [...memoryCache];
    }

    if (
      !forceRefresh &&
      loadingPromise &&
      loadedNetwork === network
    ) {
      return loadingPromise;
    }

    lastError = null;

    loadingPromise = (async function () {
      const supabase = requireSupabase();

      let query = supabase
        .from(REGISTRY_TABLE)
        .select([
          "id",
          "project_code",
          "project_name",
          "project_type",
          "status",
          "description",
          "category",
          "stage",
          "roi",
          "reward_rate",
          "reserve_percent",
          "min_liquidity",
          "project_visible",
          "dashboard_enabled",
          "transparency_enabled",
          "metadata",
          "created_at",
          "updated_at",
          "network"
        ].join(","))
        .eq("network", network)
        .eq("status", "active")
        .eq("project_visible", true);

      if (coreOnly) {
        query = query.eq("project_type", "core");
      }

      query = query.order("project_name", {
        ascending: true
      });

      const { data, error } = await query;

      if (error) {
        throw new Error(
          error.message ||
          "Failed to load ALBUKHR project registry."
        );
      }

      const rows = Array.isArray(data) ? data : [];

      const normalized = rows
        .map(normalizeProject)
        .filter(Boolean)
        .filter(project => project.network === network);

      /*
        Replace the cache atomically only after a successful query.
        This prevents a failed refresh from destroying a previously
        valid in-memory registry.
      */
      memoryCache = normalized;
      loadedNetwork = network;

      return [...memoryCache];
    })();

    try {
      return await loadingPromise;
    } catch (error) {
      lastError =
        error?.message ||
        "Failed to load ALBUKHR project registry.";

      /*
        Do not silently cross networks. A failed query for the
        current network never returns another network's cache.
      */
      if (loadedNetwork !== network) {
        memoryCache = [];
        loadedNetwork = network;
      }

      throw error;
    } finally {
      loadingPromise = null;
    }
  }

  async function loadCoreProjects(options = {}) {
    return loadProjectRegistry({
      ...options,
      coreOnly: true
    });
  }

  async function getProjectByCode(projectCode, options = {}) {
    const code = safeString(projectCode).trim();

    if (!code) {
      return null;
    }

    const projects = await loadProjectRegistry(options);

    return (
      projects.find(
        project =>
          project.project_code === code ||
          project.code === code
      ) || null
    );
  }

  /*
    Legacy-compatible synchronous accessor.

    IMPORTANT:
    This function can only return data already loaded into the
    current page's in-memory cache. It never queries LocalStorage.
    New controllers should prefer await loadProjectRegistry().
  */
  function getProjectConfig(name) {
    const code = safeString(name).trim();

    const cached =
      memoryCache.find(
        project =>
          project.project_code === code ||
          project.code === code
      );

    if (cached) {
      return cached;
    }

    const compatibility = getCompatibilityMetadata(code);

    return Object.freeze({
      project_code: code,
      code,
      name: code,
      title: code,
      project_name: code,
      project_type: "unknown",
      status: "unknown",
      network: loadedNetwork,
      category: "",
      stage: "",
      description: compatibility.desc,
      desc: compatibility.desc,
      info: compatibility.info,
      icon: compatibility.icon,
      durations: Object.freeze([...compatibility.durations]),
      roi: 0,
      reward_rate: 0,
      reserve_percent: 0,
      min_liquidity: 100,
      project_visible: false,
      dashboard_enabled: false,
      transparency_enabled: false,
      metadata: Object.freeze({})
    });
  }

  function getLoadedProjects() {
    return [...memoryCache];
  }

  function clearProjectRegistryMemory() {
    memoryCache = [];
    loadedNetwork = null;
    lastError = null;
    loadingPromise = null;
  }

  function getProjectRegistryState() {
    return {
      table: REGISTRY_TABLE,
      network: loadedNetwork,
      count: memoryCache.length,
      loading: !!loadingPromise,
      last_error: lastError
    };
  }

  /*
    Compatibility surface.

    PROJECT_CONFIG is intentionally no longer the source of truth.
    It is exposed as an empty immutable object so old code that
    checks for its existence does not crash. Consumers must use
    loadProjectRegistry()/getProjectConfig().
  */
  const PROJECT_CONFIG = Object.freeze({});

  window.PROJECT_CONFIG = PROJECT_CONFIG;

  window.loadProjectRegistry = loadProjectRegistry;
  window.loadCoreProjects = loadCoreProjects;
  window.getProjectByCode = getProjectByCode;
  window.getProjectConfig = getProjectConfig;
  window.getLoadedProjects = getLoadedProjects;
  window.clearProjectRegistryMemory = clearProjectRegistryMemory;
  window.getProjectRegistryState = getProjectRegistryState;

  console.log(
    "ALBUKHR Project Config / Registry Adapter loaded."
  );
})();
