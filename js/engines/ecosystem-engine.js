/* =========================================================
   ALBUKHR ECOSYSTEM ENGINE
   ARCHITECTURE-COMPATIBLE FULL VERSION
   ---------------------------------------------------------
   Purpose:
   - Unified read-only ecosystem aggregation layer.
   - Uses the existing shared staking engines as data sources.
   - Does NOT create/alter Supabase schema.
   - Does NOT write stakes, projects, contributors, or transactions.
   - Network-aware through the shared staking/data layer where available.
   - No persistent application state is stored in localStorage.
   - Preserves the existing public API for dependent pages.
   - Project metadata is resolved from the existing core project registry.
   - No project emoji fallback; uses the project's existing logo/image fields.
========================================================= */

(function (window) {
  "use strict";

  const AlbukhrEcosystem = {};
  window.AlbukhrEcosystem = AlbukhrEcosystem;

  const ENGINE_NAME = "ALBUKHR Ecosystem Engine";

  const CACHE = {
    loaded: false,
    loading: null,
    lastUpdate: 0,
    stakes: [],
    globalStakes: [],
    projects: [],
    summary: {
      portfolio: 0,
      invested: 0,
      earnings: 0,
      projects: 0,
      records: 0
    },
    topInvestors: [],
    hotProjects: [],
    liquidityLeaders: [],
    featured: null
  };

  const CACHE_TIME = 10000;

  /* =========================================================
     SAFE HELPERS
  ========================================================= */

  function safeString(value, fallback = "") {
    if (value === null || value === undefined) return fallback;
    return String(value);
  }

  function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizeKey(value) {
    return safeString(value).trim().toLowerCase();
  }

  function firstDefined() {
    for (const value of arguments) {
      if (
        value !== undefined &&
        value !== null &&
        safeString(value).trim() !== ""
      ) {
        return value;
      }
    }
    return "";
  }

  function cloneArray(value) {
    return safeArray(value).slice();
  }

  function cloneObject(value) {
    return value && typeof value === "object" ? { ...value } : {};
  }

  function logWarn(message, error) {
    console.warn(
      `${ENGINE_NAME}: ${message}`,
      error || ""
    );
  }

  /* =========================================================
     NETWORK
     ---------------------------------------------------------
     The ecosystem engine does not invent network state.
     It asks the shared environment/staking layer first.
  ========================================================= */

  function getCurrentNetwork() {
    try {
      if (
        window.AlbukhrEnvironment &&
        typeof window.AlbukhrEnvironment.getNetwork === "function"
      ) {
        return safeString(
          window.AlbukhrEnvironment.getNetwork()
        ).toLowerCase();
      }

      if (
        typeof window.getAlbukhrNetwork === "function"
      ) {
        return safeString(
          window.getAlbukhrNetwork()
        ).toLowerCase();
      }

      if (
        window.AlbukhrNetwork &&
        typeof window.AlbukhrNetwork.getCurrent === "function"
      ) {
        return safeString(
          window.AlbukhrNetwork.getCurrent()
        ).toLowerCase();
      }
    } catch (error) {
      logWarn("Unable to resolve shared network.", error);
    }

    const host = safeString(
      window.location && window.location.hostname
    ).toLowerCase();

    if (
      host === "app.albukhr.com"
    ) {
      return "mainnet";
    }

    if (
      host === "test.albukhr.com" ||
      host.includes("testnet") ||
      host === "localhost" ||
      host === "127.0.0.1"
    ) {
      return "testnet";
    }

    return "";
  }

  AlbukhrEcosystem.getCurrentNetwork =
    getCurrentNetwork;

  /* =========================================================
     STAKE SOURCE RESOLUTION
     ---------------------------------------------------------
     IMPORTANT:
     This engine does not replace the existing staking engine.
     It consumes whichever shared merged-stake APIs already
     exist in the ALBUKHR architecture.
  ========================================================= */

  async function loadUserStakes() {
    if (
      typeof window.getAllStakesMerged === "function"
    ) {
      const result =
        await window.getAllStakesMerged();

      return safeArray(result);
    }

    if (
      window.AlbukhrStakingEngine &&
      typeof window.AlbukhrStakingEngine.getAllStakesMerged ===
        "function"
    ) {
      const result =
        await window.AlbukhrStakingEngine.getAllStakesMerged();

      return safeArray(result);
    }

    if (
      window.AlbukhrStaking &&
      typeof window.AlbukhrStaking.getAllStakesMerged ===
        "function"
    ) {
      const result =
        await window.AlbukhrStaking.getAllStakesMerged();

      return safeArray(result);
    }

    throw new Error(
      "Shared getAllStakesMerged() is not available."
    );
  }

  async function loadGlobalStakes() {
    if (
      typeof window.getGlobalStakes === "function"
    ) {
      const result =
        await window.getGlobalStakes();

      return safeArray(result);
    }

    if (
      window.AlbukhrStakingEngine &&
      typeof window.AlbukhrStakingEngine.getGlobalStakes ===
        "function"
    ) {
      const result =
        await window.AlbukhrStakingEngine.getGlobalStakes();

      return safeArray(result);
    }

    if (
      window.AlbukhrStaking &&
      typeof window.AlbukhrStaking.getGlobalStakes ===
        "function"
    ) {
      const result =
        await window.AlbukhrStaking.getGlobalStakes();

      return safeArray(result);
    }

    /*
      Do not manufacture a second Supabase query here.
      If the existing shared global-stake source does not exist,
      the merged stake source remains the safe fallback.
    */
    return [];
  }

  /* =========================================================
     STAKE NORMALIZATION
  ========================================================= */

  function getStakeUserKey(stake) {
    return safeString(
      firstDefined(
        stake?.userid,
        stake?.user_id,
        stake?.uid,
        stake?.wallet,
        stake?.wallet_address,
        stake?.from_wallet
      ),
      "unknown"
    ).trim();
  }

  function getStakeProjectKey(stake) {
    return safeString(
      firstDefined(
        stake?.project,
        stake?.project_code,
        stake?.projectCode,
        stake?.project_id
      ),
      "Unknown"
    ).trim();
  }

  function getStakeAmount(stake) {
    return Math.max(
      0,
      safeNumber(
        firstDefined(
          stake?.amount,
          stake?.stake_amount,
          stake?.invested_amount
        )
      )
    );
  }

  function getStakeReward(stake) {
    return Math.max(
      0,
      safeNumber(
        firstDefined(
          stake?.reward,
          stake?.reward_amount,
          stake?.earned_reward
        )
      )
    );
  }

  function getWithdrawnReward(stake) {
    return Math.max(
      0,
      safeNumber(
        firstDefined(
          stake?.withdrawnReward,
          stake?.withdrawn_reward,
          stake?.withdrawn_rewards
        )
      )
    );
  }

  function normalizeStake(stake) {
    if (!stake || typeof stake !== "object") {
      return null;
    }

    return {
      ...stake,
      project: getStakeProjectKey(stake),
      userid: getStakeUserKey(stake),
      amount: getStakeAmount(stake),
      reward: getStakeReward(stake),
      withdrawnReward: getWithdrawnReward(stake)
    };
  }

  function normalizeStakes(stakes) {
    return safeArray(stakes)
      .map(normalizeStake)
      .filter(Boolean);
  }

  /* =========================================================
     PROJECT REGISTRY RESOLUTION
     ---------------------------------------------------------
     Never replaces the project's canonical registry.
  ========================================================= */

  function resolveCoreProject(projectName) {
    const key = safeString(projectName).trim();

    try {
      if (
        typeof window.getCoreProjectByName === "function"
      ) {
        const result =
          window.getCoreProjectByName(key);

        if (result) return result;
      }
    } catch (error) {
      logWarn(
        `Core project lookup failed for ${key}.`,
        error
      );
    }

    try {
      if (
        window.AlbukhrCoreProjects &&
        typeof window.AlbukhrCoreProjects.getByName ===
          "function"
      ) {
        const result =
          window.AlbukhrCoreProjects.getByName(key);

        if (result) return result;
      }
    } catch (error) {
      logWarn(
        `Shared project registry lookup failed for ${key}.`,
        error
      );
    }

    try {
      if (
        window.AlbukhrProjectRegistry &&
        typeof window.AlbukhrProjectRegistry.getByName ===
          "function"
      ) {
        const result =
          window.AlbukhrProjectRegistry.getByName(key);

        if (result) return result;
      }
    } catch (error) {
      logWarn(
        `Project registry lookup failed for ${key}.`,
        error
      );
    }

    return null;
  }

  function resolveProject(projectName) {
    const code =
      safeString(projectName).trim();

    const core =
      resolveCoreProject(code);

    if (!core) {
      return {
        code,
        title: code,
        name: code,
        logo: "",
        logo_url: "",
        image: "",
        image_url: "",
        category: "Project",
        sector: "Project",
        description: "",
        roi: 0,
        minimum: 0,
        target: 0,
        type: "community"
      };
    }

    return {
      code,
      title: safeString(
        firstDefined(
          core.title,
          core.name,
          core.project_name,
          code
        )
      ),
      name: safeString(
        firstDefined(
          core.name,
          core.title,
          core.project_name,
          code
        )
      ),
      logo: safeString(
        firstDefined(
          core.logo,
          core.logoUrl,
          core.logo_url,
          core.projectLogo,
          core.project_logo
        )
      ),
      logo_url: safeString(
        firstDefined(
          core.logo_url,
          core.logoUrl,
          core.logo,
          core.projectLogo,
          core.project_logo
        )
      ),
      image: safeString(
        firstDefined(
          core.image,
          core.imageUrl,
          core.image_url,
          core.projectImage,
          core.project_image
        )
      ),
      image_url: safeString(
        firstDefined(
          core.image_url,
          core.imageUrl,
          core.image,
          core.projectImage,
          core.project_image
        )
      ),
      category: safeString(
        firstDefined(
          core.category,
          core.sector,
          "Project"
        )
      ),
      sector: safeString(
        firstDefined(
          core.sector,
          core.category,
          "Project"
        )
      ),
      description: safeString(
        core.description
      ),
      roi: safeNumber(
        core.roi
      ),
      minimum: safeNumber(
        firstDefined(
          core.minimum,
          core.minStake,
          core.min_stake
        )
      ),
      target: safeNumber(
        core.target
      ),
      type: "core"
    };
  }

  AlbukhrEcosystem.resolveProject =
    resolveProject;

  /* =========================================================
     BUILD PROJECT AGGREGATION
  ========================================================= */

  function buildProjects() {
    const map = new Map();

    CACHE.globalStakes.forEach((stake) => {
      const projectCode =
        getStakeProjectKey(stake);

      const key =
        normalizeKey(projectCode);

      if (!map.has(key)) {
        const meta =
          resolveProject(projectCode);

        map.set(key, {
          ...meta,
          investorsSet: new Set(),
          liquidity: 0,
          reward: 0,
          records: 0,
          stakes: []
        });
      }

      const project =
        map.get(key);

      project.records += 1;

      project.stakes.push(stake);

      project.investorsSet.add(
        getStakeUserKey(stake)
      );

      project.liquidity +=
        getStakeAmount(stake);

      project.reward +=
        getStakeReward(stake);
    });

    CACHE.projects =
      Array.from(map.values()).map(
        (project) => {
          const {
            investorsSet,
            ...publicProject
          } = project;

          return {
            ...publicProject,
            investors:
              investorsSet.size
          };
        }
      );
  }

  /* =========================================================
     BUILD SUMMARY
  ========================================================= */

  function buildSummary() {
    let invested = 0;
    let earnings = 0;

    CACHE.projects.forEach(
      (project) => {
        invested +=
          safeNumber(project.liquidity);

        earnings +=
          safeNumber(project.reward);
      }
    );

    CACHE.summary = {
      portfolio:
        invested + earnings,
      invested,
      earnings,
      projects:
        CACHE.projects.length,
      records:
        CACHE.globalStakes.length
    };
  }

  /* =========================================================
     TOP INVESTORS
  ========================================================= */

  function buildTopInvestors() {
    const map = new Map();

    CACHE.stakes.forEach((stake) => {
      const user =
        getStakeUserKey(stake);

      map.set(
        user,
        safeNumber(map.get(user)) +
          getStakeAmount(stake)
      );
    });

    CACHE.topInvestors =
      Array.from(map.entries())
        .map(([user, amount]) => ({
          user,
          amount
        }))
        .sort(
          (a, b) =>
            b.amount - a.amount
        )
        .slice(0, 10);
  }

  /* =========================================================
     PROJECT RANKINGS
  ========================================================= */

  function buildRankings() {
    CACHE.hotProjects =
      [...CACHE.projects]
        .sort(
          (a, b) =>
            safeNumber(b.investors) -
            safeNumber(a.investors)
        )
        .slice(0, 5);

    CACHE.liquidityLeaders =
      [...CACHE.projects]
        .sort(
          (a, b) =>
            safeNumber(b.liquidity) -
            safeNumber(a.liquidity)
        )
        .slice(0, 5);

    CACHE.featured =
      CACHE.hotProjects[0] ||
      CACHE.liquidityLeaders[0] ||
      CACHE.projects[0] ||
      null;
  }

  /* =========================================================
     CACHE BUILD
  ========================================================= */

  function resetCache() {
    CACHE.loaded = false;
    CACHE.lastUpdate = 0;
    CACHE.stakes = [];
    CACHE.globalStakes = [];
    CACHE.projects = [];
    CACHE.summary = {
      portfolio: 0,
      invested: 0,
      earnings: 0,
      projects: 0,
      records: 0
    };
    CACHE.topInvestors = [];
    CACHE.hotProjects = [];
    CACHE.liquidityLeaders = [];
    CACHE.featured = null;
  }

  async function performLoad() {
    const [
      userStakesRaw,
      globalStakesRaw
    ] = await Promise.all([
      loadUserStakes(),
      loadGlobalStakes()
    ]);

    CACHE.stakes =
      normalizeStakes(
        userStakesRaw
      );

    const global =
      normalizeStakes(
        globalStakesRaw
      );

    /*
      If the architecture has no separate global source,
      use the merged source without creating another data path.
    */
    CACHE.globalStakes =
      global.length
        ? global
        : CACHE.stakes.slice();

    buildProjects();
    buildSummary();
    buildTopInvestors();
    buildRankings();

    CACHE.loaded = true;
    CACHE.lastUpdate = Date.now();

    return CACHE;
  }

  /* =========================================================
     LOAD
  ========================================================= */

  AlbukhrEcosystem.load =
    async function (force = false) {
      const now = Date.now();

      if (
        !force &&
        CACHE.loaded &&
        now - CACHE.lastUpdate <
          CACHE_TIME
      ) {
        return CACHE;
      }

      if (CACHE.loading) {
        return CACHE.loading;
      }

      CACHE.loading =
        performLoad()
          .catch((error) => {
            logWarn(
              "Ecosystem data load failed.",
              error
            );

            /*
              Preserve previously valid cache.
              Never destroy working data because a refresh failed.
            */
            if (!CACHE.loaded) {
              resetCache();
            }

            return CACHE;
          })
          .finally(() => {
            CACHE.loading = null;
          });

      return CACHE.loading;
    };

  /* =========================================================
     MARKETPLACE API
  ========================================================= */

  AlbukhrEcosystem.marketplace =
    async function (forceRefresh = false) {
      await AlbukhrEcosystem.load(
        forceRefresh
      );

      return {
        projects:
          cloneArray(CACHE.projects),
        summary:
          cloneObject(CACHE.summary),
        featured:
          CACHE.featured,
        hotProjects:
          cloneArray(
            CACHE.hotProjects
          ),
        liquidityLeaders:
          cloneArray(
            CACHE.liquidityLeaders
          ),
        topInvestors:
          cloneArray(
            CACHE.topInvestors
          ),
        network:
          getCurrentNetwork()
      };
    };

  /* =========================================================
     DASHBOARD API
  ========================================================= */

  AlbukhrEcosystem.dashboard =
    async function (forceRefresh = false) {
      await AlbukhrEcosystem.load(
        forceRefresh
      );

      return {
        portfolio:
          CACHE.summary.portfolio,
        invested:
          CACHE.summary.invested,
        earnings:
          CACHE.summary.earnings,
        totalProjects:
          CACHE.summary.projects,
        totalRecords:
          CACHE.summary.records,
        projects:
          cloneArray(CACHE.projects),
        network:
          getCurrentNetwork()
      };
    };

  /* =========================================================
     PROJECT API
  ========================================================= */

  AlbukhrEcosystem.project =
    async function (projectCode) {
      await AlbukhrEcosystem.load();

      const wanted =
        normalizeKey(projectCode);

      return (
        CACHE.projects.find(
          (project) =>
            normalizeKey(
              project.code
            ) === wanted ||
            normalizeKey(
              project.title
            ) === wanted ||
            normalizeKey(
              project.name
            ) === wanted
        ) || null
      );
    };

  /* =========================================================
     SUMMARY API
  ========================================================= */

  AlbukhrEcosystem.summary =
    async function () {
      await AlbukhrEcosystem.load();

      return {
        ...CACHE.summary,
        network:
          getCurrentNetwork()
      };
    };

  /* =========================================================
     REFRESH API
  ========================================================= */

  AlbukhrEcosystem.refresh =
    async function () {
      resetCache();
      return await AlbukhrEcosystem.load(
        true
      );
    };

  /* =========================================================
     SEARCH API
  ========================================================= */

  AlbukhrEcosystem.search =
    async function (keyword = "") {
      await AlbukhrEcosystem.load();

      const wanted =
        normalizeKey(keyword);

      if (!wanted) {
        return cloneArray(
          CACHE.projects
        );
      }

      return CACHE.projects.filter(
        (project) => {
          return [
            project.code,
            project.title,
            project.name,
            project.description,
            project.category,
            project.sector
          ].some((value) =>
            normalizeKey(
              value
            ).includes(wanted)
          );
        }
      );
    };

  /* =========================================================
     RANKING API
  ========================================================= */

  AlbukhrEcosystem.rankings =
    async function () {
      await AlbukhrEcosystem.load();

      return {
        featured:
          CACHE.featured,
        hotProjects:
          cloneArray(
            CACHE.hotProjects
          ),
        liquidityLeaders:
          cloneArray(
            CACHE.liquidityLeaders
          ),
        topInvestors:
          cloneArray(
            CACHE.topInvestors
          )
      };
    };

  /* =========================================================
     CURRENT USER
     ---------------------------------------------------------
     No localStorage persistence.
     Prefer the existing authentication/session engine.
  ========================================================= */

  AlbukhrEcosystem.currentUser =
    function () {
      try {
        if (
          window.AlbukhrAuth &&
          typeof window.AlbukhrAuth.getCurrentUser ===
            "function"
        ) {
          return (
            window.AlbukhrAuth.getCurrentUser() ||
            null
          );
        }

        if (
          typeof window.getCurrentUser ===
          "function"
        ) {
          return (
            window.getCurrentUser() ||
            null
          );
        }

        if (
          window.Pi &&
          window.Pi.user
        ) {
          return (
            window.Pi.user ||
            null
          );
        }

        /*
          Deliberately do not read pi_user from localStorage.
          Authentication state belongs to the shared auth layer.
        */
      } catch (error) {
        logWarn(
          "Unable to resolve current authenticated user.",
          error
        );
      }

      return null;
    };

  /* =========================================================
     CURRENT USER IDENTIFIER
  ========================================================= */

  function resolveCurrentUserId() {
    const user =
      AlbukhrEcosystem.currentUser();

    if (!user) return "";

    return safeString(
      firstDefined(
        user.uid,
        user.id,
        user.user_id,
        user.wallet,
        user.wallet_address
      )
    ).trim();
  }

  /* =========================================================
     MY STAKES
  ========================================================= */

  AlbukhrEcosystem.myStakes =
    async function (
      forceRefresh = false
    ) {
      await AlbukhrEcosystem.load(
        forceRefresh
      );

      const userId =
        resolveCurrentUserId();

      if (!userId) {
        return [];
      }

      const wanted =
        normalizeKey(userId);

      return CACHE.stakes.filter(
        (stake) =>
          normalizeKey(
            getStakeUserKey(stake)
          ) === wanted
      );
    };

  /* =========================================================
     MY PORTFOLIO
  ========================================================= */

  AlbukhrEcosystem.myPortfolio =
    async function (
      forceRefresh = false
    ) {
      const stakes =
        await AlbukhrEcosystem.myStakes(
          forceRefresh
        );

      let invested = 0;
      let earnings = 0;

      const projects =
        new Set();

      stakes.forEach((stake) => {
        const amount =
          getStakeAmount(stake);

        const reward =
          getStakeReward(stake);

        const withdrawn =
          getWithdrawnReward(stake);

        invested += amount;

        earnings += Math.max(
          0,
          reward - withdrawn
        );

        projects.add(
          getStakeProjectKey(stake)
        );
      });

      return {
        invested,
        earnings,
        portfolio:
          invested + earnings,
        totalProjects:
          projects.size,
        records:
          stakes.length,
        network:
          getCurrentNetwork()
      };
    };

  /* =========================================================
     MY PROJECTS
  ========================================================= */

  AlbukhrEcosystem.myProjects =
    async function (
      forceRefresh = false
    ) {
      const stakes =
        await AlbukhrEcosystem.myStakes(
          forceRefresh
        );

      const map =
        new Map();

      stakes.forEach((stake) => {
        const code =
          getStakeProjectKey(stake);

        const key =
          normalizeKey(code);

        if (!map.has(key)) {
          map.set(key, {
            ...resolveProject(code),
            invested: 0,
            earnings: 0,
            records: 0,
            stakes: []
          });
        }

        const project =
          map.get(key);

        project.invested +=
          getStakeAmount(stake);

        project.earnings +=
          Math.max(
            0,
            getStakeReward(stake) -
              getWithdrawnReward(
                stake
              )
          );

        project.records += 1;
        project.stakes.push(stake);
      });

      return Array.from(
        map.values()
      );
    };

  /* =========================================================
     INVESTOR DASHBOARD API
  ========================================================= */

  AlbukhrEcosystem.investorDashboard =
    async function (
      forceRefresh = false
    ) {
      const portfolio =
        await AlbukhrEcosystem.myPortfolio(
          forceRefresh
        );

      const projects =
        await AlbukhrEcosystem.myProjects();

      return {
        ...portfolio,
        projects
      };
    };

  /* =========================================================
     CACHE / DIAGNOSTICS
  ========================================================= */

  AlbukhrEcosystem.getCache =
    function () {
      return {
        loaded: CACHE.loaded,
        loading: !!CACHE.loading,
        lastUpdate:
          CACHE.lastUpdate,
        network:
          getCurrentNetwork(),
        stakes:
          cloneArray(CACHE.stakes),
        globalStakes:
          cloneArray(
            CACHE.globalStakes
          ),
        projects:
          cloneArray(CACHE.projects),
        summary:
          cloneObject(CACHE.summary),
        topInvestors:
          cloneArray(
            CACHE.topInvestors
          ),
        hotProjects:
          cloneArray(
            CACHE.hotProjects
          ),
        liquidityLeaders:
          cloneArray(
            CACHE.liquidityLeaders
          ),
        featured:
          CACHE.featured
      };
    };

  AlbukhrEcosystem.clearCache =
    function () {
      resetCache();
      return true;
    };

  /* =========================================================
     VERSION / HEALTH
  ========================================================= */

  AlbukhrEcosystem.version =
    "2.1.0";

  AlbukhrEcosystem.health =
    function () {
      return {
        engine:
          ENGINE_NAME,
        version:
          AlbukhrEcosystem.version,
        loaded:
          CACHE.loaded,
        network:
          getCurrentNetwork(),
        stakingSource:
          typeof window.getAllStakesMerged ===
            "function" ||
          !!(
            window.AlbukhrStakingEngine &&
            typeof window.AlbukhrStakingEngine
              .getAllStakesMerged ===
              "function"
          ),
        projectRegistry:
          typeof window.getCoreProjectByName ===
            "function" ||
          !!(
            window.AlbukhrCoreProjects &&
            typeof window.AlbukhrCoreProjects
              .getByName ===
              "function"
          ),
        writesToSupabase:
          false,
        ownsAuthentication:
          false
      };
    };

})(window);
