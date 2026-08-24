/* =========================================================
   ALBUKHR — PROJECTS ENGINE v5
   Canonical project registry — USER FOUNDATION INTEGRATION

   Architecture:
     js/core/environment-switcher.js
              ↓
     js/core/supabase-core.js
              ↓
     js/engines/projects-engine.js
              ↓
     user page controllers

   Responsibilities:
   - Supabase is the canonical project source of truth.
   - Mainnet/Testnet is resolved ONLY through the shared
     environment-switcher foundation.
   - All project reads are network-isolated.
   - No LocalStorage.
   - No independent Supabase client.
   - Logo/image is the project identity media; emoji is not used.
   - Cache is memory-only and is invalidated when network changes.
   - Concurrent loads share one in-flight request.
   - Failed loads remain retryable.
   - Public compatibility functions are retained for migrating
     existing ALBUKHR user engines/pages.

   Required foundation:
   - js/core/environment-switcher.js
   - js/core/supabase-core.js
========================================================= */

(function (window) {
  "use strict";

  const TABLE = "projects";

  let cache = [];
  let loaded = false;
  let loading = false;
  let loadingPromise = null;
  let lastLoadedAt = null;
  let lastSource = "none";
  let lastNetwork = null;
  let lastError = null;

  /* =========================================================
     BASIC NORMALIZATION
  ========================================================= */

  function str(value, fallback = "") {
    return value == null ? fallback : String(value);
  }

  function num(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function normalizeNetwork(value) {
    return str(value).trim().toLowerCase();
  }

  /* =========================================================
     SHARED NETWORK FOUNDATION
     ========================================================= */

  function getNetwork() {
    if (typeof window.requireAlbukhrNetwork !== "function") {
      throw new Error(
        "ALBUKHR Network Core is not available. Load js/core/environment-switcher.js first."
      );
    }

    const network = normalizeNetwork(
      window.requireAlbukhrNetwork()
    );

    if (network !== "mainnet" && network !== "testnet") {
      throw new Error(
        "ALBUKHR: invalid network returned by the shared network core."
      );
    }

    return network;
  }

  /* =========================================================
     SHARED SUPABASE FOUNDATION
  ========================================================= */

  function getClient() {
    if (
      typeof window.requireAlbukhrSupabaseClient ===
      "function"
    ) {
      return window.requireAlbukhrSupabaseClient();
    }

    if (
      typeof window.getAlbukhrSupabaseClient ===
      "function"
    ) {
      return window.getAlbukhrSupabaseClient();
    }

    throw new Error(
      "ALBUKHR Supabase Core is not available. Load js/core/supabase-core.js first."
    );
  }

  function networkFilter(query) {
    if (
      typeof window.applyAlbukhrNetworkFilter ===
      "function"
    ) {
      return window.applyAlbukhrNetworkFilter(query);
    }

    /* Compatibility fallback for a partially migrated page.
       The shared foundation remains the preferred path. */
    if (!query || typeof query.eq !== "function") {
      throw new Error(
        "A valid Supabase query is required."
      );
    }

    return query.eq("network", getNetwork());
  }

  /* =========================================================
     PROJECT FIELD NORMALIZATION
  ========================================================= */

  function projectType(value) {
    const v = str(value).trim().toLowerCase();

    return [
      "core",
      "internal",
      "external"
    ].includes(v)
      ? v
      : "core";
  }

  function projectStatus(value) {
    const v = str(value).trim().toLowerCase();

    if (v === "disabled") {
      return "inactive";
    }

    return [
      "active",
      "inactive",
      "archived"
    ].includes(v)
      ? v
      : "active";
  }

  function projectDurations(value) {
    if (Array.isArray(value)) {
      const values = value
        .map(Number)
        .filter(
          n => Number.isFinite(n) && n > 0
        );

      if (values.length) {
        return values;
      }
    }

    if (
      typeof value === "string" &&
      value.trim()
    ) {
      const values = value
        .split(",")
        .map(x => Number(x.trim()))
        .filter(
          n => Number.isFinite(n) && n > 0
        );

      if (values.length) {
        return values;
      }
    }

    return [30, 60, 90];
  }

  function mimeType(value) {
    const v = str(value).trim().toLowerCase();

    return [
      "image/png",
      "image/jpeg",
      "image/webp"
    ].includes(v)
      ? v
      : "";
  }

  function hasMediaReference(row) {
    return Boolean(
      str(row.logo_url).trim() ||
      str(row.image_url).trim() ||
      str(row.logo_path).trim()
    );
  }

  function logoIsValid(row) {
    const mime = mimeType(
      row.logo_mime_type
    );

    const size = Number(
      row.logo_size_bytes
    );

    const width = Number(
      row.logo_width
    );

    const height = Number(
      row.logo_height
    );

    return Boolean(
      mime &&
      Number.isFinite(size) &&
      size > 0 &&
      size <= 1048576 &&
      Number.isFinite(width) &&
      Number.isFinite(height) &&
      width >= 400 &&
      height >= 400 &&
      hasMediaReference(row)
    );
  }

  function normalize(row = {}, network) {
    const code = str(
      row.project_code ||
      row.code ||
      row.slug
    ).trim();

    const name = str(
      row.project_name ||
      row.title ||
      row.name ||
      code ||
      "Unnamed Project"
    ).trim();

    const imageUrl = str(
      row.logo_url ||
      row.image_url ||
      row.logo ||
      row.image
    ).trim();

    const rowNetwork = normalizeNetwork(
      row.network
    );

    return {
      id: row.id ?? null,

      network:
        rowNetwork || network,

      project_code: code,
      code,

      project_name: name,
      name,
      title: name,

      project_type:
        projectType(row.project_type),

      status:
        projectStatus(row.status),

      /*
       * Legacy compatibility field.
       * Project identity is NOT based on emoji.
       */
      icon: "",

      description: str(
        row.description ||
        row.desc,
        "ALBUKHR Project"
      ),

      info: str(
        row.info ||
        row.about ||
        row.details,
        "Project information not available."
      ),

      durations:
        projectDurations(row.durations),

      reserve_percent:
        num(row.reserve_percent, 0.30),

      min_liquidity:
        num(row.min_liquidity, 100),

      min_stake:
        num(
          row.min_stake,
          row.min_liquidity ?? 100
        ),

      reward_rate:
        num(row.reward_rate, 0.02),

      is_visible:
        row.is_visible === false
          ? false
          : true,

      treasury_enabled:
        row.treasury_enabled === false
          ? false
          : true,

      staking_enabled:
        row.staking_enabled === false
          ? false
          : true,

      contributions_enabled:
        row.contributions_enabled === false
          ? false
          : true,

      logo_url: imageUrl,
      image_url: imageUrl,

      logo_path:
        str(row.logo_path).trim(),

      logo_mime_type:
        mimeType(row.logo_mime_type) || null,

      logo_size_bytes:
        row.logo_size_bytes ?? null,

      logo_width:
        row.logo_width ?? null,

      logo_height:
        row.logo_height ?? null,

      logo_required: true,

      logo_present:
        Boolean(
          imageUrl ||
          str(row.logo_path).trim()
        ),

      logo_valid:
        logoIsValid(row),

      created_at:
        row.created_at || null,

      updated_at:
        row.updated_at || null,

      raw: row
    };
  }

  function sortRows(rows) {
    return [...rows].sort(
      (a, b) =>
        str(a.project_name).localeCompare(
          str(b.project_name),
          undefined,
          { sensitivity: "base" }
        )
    );
  }

  /* =========================================================
     SUPABASE READ
  ========================================================= */

  async function fetchProjectsFromSupabase() {
    const network = getNetwork();
    const client = getClient();

    try {
      /*
       * The network predicate is mandatory even though the shared
       * Supabase helper also supports network filtering. This makes
       * the isolation explicit at the project-engine boundary.
       */
      let query = client
        .from(TABLE)
        .select("*")
        .eq("network", network);

      query = networkFilter(query);

      const result = await query.order(
        "project_name",
        { ascending: true }
      );

      const data = result?.data;
      const error = result?.error;

      if (error) {
        return {
          success: false,
          data: [],
          network,
          error:
            error.message ||
            "Failed to load projects."
        };
      }

      const rows = (data || [])
        .map(row =>
          normalize(row, network)
        )
        .filter(project =>
          Boolean(
            project.project_code &&
            project.network === network
          )
        );

      return {
        success: true,
        data: sortRows(rows),
        network,
        error: null
      };

    } catch (error) {
      return {
        success: false,
        data: [],
        network,
        error:
          error?.message ||
          "Projects fetch failed."
      };
    }
  }

  /* =========================================================
     CACHE / LOAD CONTROL
  ========================================================= */

  function resetCacheState(network = null) {
    cache = [];
    loaded = false;
    loading = false;
    loadingPromise = null;
    lastLoadedAt = null;
    lastSource = "none";
    lastNetwork = network;
    lastError = null;
  }

  async function loadProjects(forceRefresh = false) {
    const network = getNetwork();

    /*
     * Never allow a cached result from another network to survive.
     */
    if (
      lastNetwork !== null &&
      lastNetwork !== network
    ) {
      resetCacheState(network);
    }

    if (
      loaded &&
      lastNetwork === network &&
      !forceRefresh
    ) {
      return [...cache];
    }

    /*
     * Share the same in-flight request. This prevents multiple user
     * pages/components from issuing duplicate project queries.
     */
    if (
      loadingPromise &&
      lastNetwork === network &&
      !forceRefresh
    ) {
      return loadingPromise;
    }

    lastNetwork = network;
    loading = true;
    lastError = null;

    const request = (async () => {
      const result =
        await fetchProjectsFromSupabase();

      /*
       * Re-check the environment after the async operation.
       * If the page environment changed while the request was
       * running, do not publish the old network's rows into cache.
       */
      const currentNetwork = getNetwork();

      if (
        result.network !== currentNetwork
      ) {
        resetCacheState(currentNetwork);

        return [];
      }

      if (result.success) {
        cache = result.data;
        loaded = true;
        lastSource = "supabase";
        lastError = null;
        lastLoadedAt = Date.now();

        return [...cache];
      }

      /*
       * Failed loads remain retryable. Do not mark the cache as
       * successfully loaded when Supabase failed.
       */
      cache = [];
      loaded = false;
      lastSource = "error";
      lastError = result.error || "Projects fetch failed.";
      lastLoadedAt = null;

      console.warn(
        "ALBUKHR Projects Engine:",
        lastError
      );

      return [];

    })().finally(() => {
      loading = false;
      loadingPromise = null;
    });

    loadingPromise = request;

    return request;
  }

  async function refreshProjectsCache() {
    return loadProjects(true);
  }

  /* =========================================================
     READ API
  ========================================================= */

  async function getAllProjects(options = {}) {
    let rows = [
      ...(await loadProjects(
        Boolean(options.forceRefresh)
      ))
    ];

    if (options.visibleOnly) {
      rows = rows.filter(
        project =>
          project.is_visible !== false
      );
    }

    if (options.activeOnly) {
      rows = rows.filter(
        project =>
          project.status === "active"
      );
    }

    if (options.logoReadyOnly) {
      rows = rows.filter(
        project =>
          project.logo_valid === true
      );
    }

    if (options.treasuryEnabledOnly) {
      rows = rows.filter(
        project =>
          project.treasury_enabled !== false
      );
    }

    if (options.stakingEnabledOnly) {
      rows = rows.filter(
        project =>
          project.staking_enabled !== false
      );
    }

    if (options.contributionsEnabledOnly) {
      rows = rows.filter(
        project =>
          project.contributions_enabled !== false
      );
    }

    return rows;
  }

  async function getProjects(options = {}) {
    return getAllProjects(options);
  }

  async function getActiveProjects(options = {}) {
    return getAllProjects({
      ...options,
      activeOnly: true
    });
  }

  async function getMarketplaceProjects(options = {}) {
    return getAllProjects({
      ...options,
      activeOnly: true,
      visibleOnly: true,
      logoReadyOnly: true
    });
  }

  async function getProjectsByType(
    value,
    options = {}
  ) {
    const rows =
      await getAllProjects(options);

    const selectedType =
      projectType(value);

    return rows.filter(
      project =>
        project.project_type === selectedType
    );
  }

  async function getCoreProjects(options = {}) {
    return getProjectsByType(
      "core",
      options
    );
  }

  async function getInternalProjects(options = {}) {
    return getProjectsByType(
      "internal",
      options
    );
  }

  async function getExternalProjects(options = {}) {
    return getProjectsByType(
      "external",
      options
    );
  }

  async function groupProjectsByType(
    options = {}
  ) {
    const rows =
      await getAllProjects(options);

    return {
      core: rows.filter(
        project =>
          project.project_type === "core"
      ),

      internal: rows.filter(
        project =>
          project.project_type === "internal"
      ),

      external: rows.filter(
        project =>
          project.project_type === "external"
      )
    };
  }

  async function getProjectByCode(
    code,
    options = {}
  ) {
    if (!code) {
      return null;
    }

    const normalizedCode =
      str(code)
        .trim()
        .toLowerCase();

    const rows =
      await getAllProjects(options);

    return (
      rows.find(
        project =>
          str(project.project_code)
            .trim()
            .toLowerCase() ===
          normalizedCode
      ) || null
    );
  }

  async function getProjectMeta(code) {
    return getProjectByCode(code);
  }

  async function getProject(code) {
    return getProjectByCode(code);
  }

  /* =========================================================
     PROJECT METADATA HELPERS
  ========================================================= */

  async function getProjectLogo(code) {
    const project =
      await getProjectByCode(code);

    return project?.logo_url || null;
  }

  async function getProjectLogoUrl(code) {
    return getProjectLogo(code);
  }

  async function getProjectLogoPath(code) {
    const project =
      await getProjectByCode(code);

    return project?.logo_path || null;
  }

  async function isProjectLogoReady(code) {
    const project =
      await getProjectByCode(code);

    return Boolean(
      project &&
      project.logo_valid === true
    );
  }

  async function hasProjectLogo(code) {
    const project =
      await getProjectByCode(code);

    return Boolean(
      project &&
      project.logo_present === true
    );
  }

  async function getProjectTitle(code) {
    const project =
      await getProjectByCode(code);

    return (
      project?.project_name ||
      code ||
      "Unknown Project"
    );
  }

  async function getProjectName(code) {
    return getProjectTitle(code);
  }

  /*
   * Deliberately empty.
   * Emoji is not canonical project identity.
   */
  async function getProjectIcon() {
    return "";
  }

  async function getProjectDescription(code) {
    const project =
      await getProjectByCode(code);

    return (
      project?.description ||
      "ALBUKHR Project"
    );
  }

  async function getProjectInfo(code) {
    const project =
      await getProjectByCode(code);

    return (
      project?.info ||
      "Project information not available."
    );
  }

  async function getProjectDurations(code) {
    const project =
      await getProjectByCode(code);

    return (
      project?.durations ||
      [30, 60, 90]
    );
  }

  async function getProjectType(code) {
    const project =
      await getProjectByCode(code);

    return project?.project_type || null;
  }

  async function getProjectStatus(code) {
    const project =
      await getProjectByCode(code);

    return project?.status || null;
  }

  async function projectExists(code) {
    return Boolean(
      await getProjectByCode(code)
    );
  }

  async function isProjectActive(code) {
    const project =
      await getProjectByCode(code);

    return Boolean(
      project &&
      project.status === "active"
    );
  }

  async function isProjectVisible(code) {
    const project =
      await getProjectByCode(code);

    return Boolean(
      project &&
      project.is_visible !== false
    );
  }

  async function isCoreProject(code) {
    const project =
      await getProjectByCode(code);

    return Boolean(
      project &&
      project.project_type === "core"
    );
  }

  async function isInternalProject(code) {
    const project =
      await getProjectByCode(code);

    return Boolean(
      project &&
      project.project_type === "internal"
    );
  }

  async function isExternalProject(code) {
    const project =
      await getProjectByCode(code);

    return Boolean(
      project &&
      project.project_type === "external"
    );
  }

  async function isProjectTreasuryEnabled(code) {
    const project =
      await getProjectByCode(code);

    return Boolean(
      project &&
      project.treasury_enabled !== false
    );
  }

  async function isProjectStakingEnabled(code) {
    const project =
      await getProjectByCode(code);

    return Boolean(
      project &&
      project.staking_enabled !== false
    );
  }

  async function isProjectContributionsEnabled(code) {
    const project =
      await getProjectByCode(code);

    return Boolean(
      project &&
      project.contributions_enabled !== false
    );
  }

  async function getProjectRules(code) {
    const project =
      await getProjectByCode(code);

    return {
      reserve_percent:
        num(
          project?.reserve_percent,
          0.30
        ),

      min_liquidity:
        num(
          project?.min_liquidity,
          100
        ),

      min_stake:
        num(
          project?.min_stake,
          project?.min_liquidity ?? 100
        ),

      reward_rate:
        num(
          project?.reward_rate,
          0.02
        )
    };
  }

  /* =========================================================
     ENGINE STATE / DIAGNOSTICS
  ========================================================= */

  async function getProjectsEngineSummary() {
    const network = getNetwork();
    const all =
      await getAllProjects();

    const groups =
      await groupProjectsByType();

    return {
      total: all.length,
      network,

      core: groups.core.length,
      internal: groups.internal.length,
      external: groups.external.length,

      logo_ready:
        all.filter(
          project => project.logo_valid
        ).length,

      logo_missing:
        all.filter(
          project => !project.logo_valid
        ).length,

      loaded,
      loading,

      last_loaded_at:
        lastLoadedAt,

      last_network:
        lastNetwork,

      source:
        lastSource,

      last_error:
        lastError
    };
  }

  function clearProjectsCache() {
    const network = getNetwork();

    resetCacheState(network);

    return true;
  }

  /* =========================================================
     PUBLIC API
  ========================================================= */

  Object.assign(window, {
    loadProjects,
    refreshProjectsCache,
    clearProjectsCache,

    getProjects,
    getAllProjects,
    getActiveProjects,
    getMarketplaceProjects,

    getProjectsByType,
    getCoreProjects,
    getInternalProjects,
    getExternalProjects,
    groupProjectsByType,

    getProjectByCode,
    getProjectMeta,
    getProject,

    getProjectTitle,
    getProjectName,
    getProjectIcon,

    getProjectLogo,
    getProjectLogoUrl,
    getProjectLogoPath,

    isProjectLogoReady,
    hasProjectLogo,

    getProjectDescription,
    getProjectInfo,
    getProjectDurations,
    getProjectType,
    getProjectStatus,

    projectExists,
    isProjectActive,
    isProjectVisible,

    isCoreProject,
    isInternalProject,
    isExternalProject,

    isProjectTreasuryEnabled,
    isProjectStakingEnabled,
    isProjectContributionsEnabled,

    getProjectRules,
    getProjectsEngineSummary
  });

  /* =========================================================
     NETWORK CHANGE SAFETY
     ========================================================= */

  window.addEventListener(
    "albukhrNetworkChanged",
    () => {
      try {
        clearProjectsCache();
      } catch (error) {
        console.warn(
          "ALBUKHR Projects Engine network-change cache reset failed:",
          error
        );
      }
    }
  );

  /* =========================================================
     DOM READY PRELOAD
  ========================================================= */

  function preload() {
    loadProjects().catch(error => {
      console.warn(
        "ALBUKHR Projects preload warning:",
        error
      );
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      preload,
      { once: true }
    );
  } else {
    preload();
  }

  console.log(
    "ALBUKHR Projects Engine v5 — Core Foundation + Supabase + Network + Logo First"
  );

})(window);
