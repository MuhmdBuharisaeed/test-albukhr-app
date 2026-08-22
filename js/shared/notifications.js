/* =========================================
   ALBUKHR NOTIFICATION ENGINE — NEW ARCHITECTURE
   File: js/shared/notifications.js

   Responsibilities:
   - Notification badge
   - Official ecosystem news notifications
   - Personalized project-update notifications
   - Supabase-persisted read state
   - Mainnet/Testnet isolation
   - Shared ALBUKHR auth + Supabase client
   - Navigation to News Center

   Architecture rules:
   - No localStorage/sessionStorage for persistent state
   - No hard-coded Supabase credentials
   - Uses shared ALBUKHR Supabase client
   - Uses shared ALBUKHR auth/session layer
   - Uses shared staking/investment engine
   - Network-aware
   - Does not modify Dock Navigation
========================================= */

"use strict";

(() => {
  const CONFIG = {
    newsTable: "ecosystem_news",
    projectUpdatesTable: "project_updates",

    /*
     * This table stores the user's read state.
     * Expected columns:
     *   user_id
     *   notification_id
     *   notification_type
     *   network
     *   read_at
     *
     * notification_id is the source row id.
     */
    readTable: "notification_reads",

    readUserColumn: "user_id",
    readNotificationColumn: "notification_id",
    readTypeColumn: "notification_type",
    readNetworkColumn: "network",
    readAtColumn: "read_at",

    limit: 100,
    newsPage: "news.html"
  };

  const State = {
    loading: false,
    network: null,
    user: null,
    notifications: [],
    readKeys: new Set(),
    initialized: false
  };

  /* =========================================
     SHARED CLIENT
  ========================================= */

  function getSupabaseClient() {
    const client =
      window.AlbukhrSupabase?.client ||
      window.AlbukhrSupabaseClient ||
      window.supabaseClient ||
      window.supabase;

    if (!client || typeof client.from !== "function") {
      throw new Error(
        "ALBUKHR shared Supabase client is unavailable."
      );
    }

    return client;
  }

  /* =========================================
     NETWORK
  ========================================= */

  function getCurrentNetwork() {
    const candidates = [
      window.AlbukhrNetwork?.current,
      window.AlbukhrEnvironment?.current,
      window.AlbukhrEnvironment?.network,
      window.ALBUKHR_NETWORK,
      document.documentElement?.dataset?.network,
      document.body?.dataset?.network
    ];

    for (const value of candidates) {
      const normalized =
        String(value || "").toLowerCase().trim();

      if (
        normalized === "mainnet" ||
        normalized === "testnet"
      ) {
        return normalized;
      }
    }

    const host =
      window.location.hostname.toLowerCase();

    if (
      host === "test.albukhr.com" ||
      host.startsWith("test.")
    ) {
      return "testnet";
    }

    return "mainnet";
  }

  /* =========================================
     AUTH
  ========================================= */

  async function getAuthenticatedUser() {
    const candidates = [
      window.AlbukhrAuth?.getCurrentUser,
      window.getCurrentUser,
      window.ensurePiAuth
    ];

    for (const resolver of candidates) {
      if (typeof resolver !== "function") continue;

      try {
        const result = await resolver();

        const user =
          result?.user ||
          result?.data?.user ||
          result;

        if (
          user?.uid ||
          user?.id ||
          user?.username
        ) {
          return user;
        }
      } catch (error) {
        console.warn(
          "ALBUKHR Notifications auth resolver failed:",
          error
        );
      }
    }

    return null;
  }

  function getUserId(user = State.user) {
    return String(
      user?.uid ||
      user?.id ||
      user?.user_id ||
      ""
    ).trim();
  }

  /* =========================================
     STAKING / INVESTMENT ENGINE
  ========================================= */

  async function getMergedStakes() {
    const resolver =
      window.getAllStakesMerged ||
      window.AlbukhrStakingEngine?.getAllStakesMerged ||
      window.AlbukhrInvestmentEngine?.getAllStakesMerged;

    if (typeof resolver !== "function") {
      return [];
    }

    try {
      const result = await resolver();
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error(
        "ALBUKHR Notifications investment data error:",
        error
      );
      return [];
    }
  }

  async function getUserProjects() {
    const stakes = await getMergedStakes();
    const projects = [];

    for (const stake of stakes) {
      if (!stake) continue;
      if (stake.type !== "stake") continue;
      if (!stake.project) continue;
      if (Number(stake.amount || 0) <= 0) continue;

      /*
       * If the staking engine exposes network,
       * never use a stake from another network.
       */
      if (
        stake.network &&
        String(stake.network).toLowerCase() !==
          State.network
      ) {
        continue;
      }

      const project =
        String(stake.project).trim();

      if (
        project &&
        !projects.includes(project)
      ) {
        projects.push(project);
      }
    }

    return projects;
  }

  /* =========================================
     NOTIFICATION KEY
  ========================================= */

  function makeKey(
    id,
    type
  ) {
    return `${type}:${String(id)}`;
  }

  /* =========================================
     LOAD SOURCE NOTIFICATIONS
  ========================================= */

  async function loadNotifications() {
    const client = getSupabaseClient();

    const [officialResult, projectResult] =
      await Promise.all([
        loadOfficial(client),
        loadProjectUpdates(client)
      ]);

    State.notifications = [
      ...officialResult,
      ...projectResult
    ].sort((a, b) => {
      const aTime =
        new Date(a.created_at || 0).getTime();

      const bTime =
        new Date(b.created_at || 0).getTime();

      return bTime - aTime;
    });

    return State.notifications;
  }

  async function loadOfficial(client) {
    let query = client
      .from(CONFIG.newsTable)
      .select(
        "id,title,description,created_at,visible,network"
      )
      .eq("visible", true)
      .order("created_at", {
        ascending: false
      })
      .range(0, CONFIG.limit - 1);

    query = query.eq(
      "network",
      State.network
    );

    const { data, error } =
      await query;

    if (error) {
      console.error(
        "ALBUKHR official notifications error:",
        error
      );
      return [];
    }

    return (Array.isArray(data) ? data : [])
      .map(item => ({
        id: item.id,
        type: "official",
        title:
          item.title ||
          "ALBUKHR Ecosystem Update",
        description:
          item.description || "",
        created_at:
          item.created_at,
        network:
          item.network
      }));
  }

  async function loadProjectUpdates(client) {
    const projects =
      await getUserProjects();

    if (!projects.length) {
      return [];
    }

    let query = client
      .from(CONFIG.projectUpdatesTable)
      .select(
        "id,project,title,description,created_at,visible,network"
      )
      .in("project", projects)
      .eq("visible", true)
      .order("created_at", {
        ascending: false
      });

    query = query.eq(
      "network",
      State.network
    );

    const { data, error } =
      await query;

    if (error) {
      console.error(
        "ALBUKHR project notifications error:",
        error
      );
      return [];
    }

    return (Array.isArray(data) ? data : [])
      .map(item => ({
        id: item.id,
        type: "project",
        project:
          item.project || "Project",
        title:
          item.title ||
          "Project Update",
        description:
          item.description || "",
        created_at:
          item.created_at,
        network:
          item.network
      }));
  }

  /* =========================================
     READ STATE
  ========================================= */

  async function loadReadState() {
    const userId =
      getUserId();

    State.readKeys = new Set();

    if (!userId) {
      return;
    }

    let client;

    try {
      client = getSupabaseClient();
    } catch (error) {
      console.error(error);
      return;
    }

    let query = client
      .from(CONFIG.readTable)
      .select(
        `${CONFIG.readNotificationColumn},${CONFIG.readTypeColumn}`
      )
      .eq(
        CONFIG.readUserColumn,
        userId
      )
      .eq(
        CONFIG.readNetworkColumn,
        State.network
      );

    const { data, error } =
      await query;

    if (error) {
      /*
       * Do not fall back to localStorage.
       * A missing read-state table/policy is a
       * backend configuration issue and must remain
       * visible in the console.
       */
      console.error(
        "ALBUKHR notification read-state error:",
        error
      );
      return;
    }

    for (const row of Array.isArray(data) ? data : []) {
      State.readKeys.add(
        makeKey(
          row[CONFIG.readNotificationColumn],
          row[CONFIG.readTypeColumn]
        )
      );
    }
  }

  async function markAsRead(
    id,
    type = "official"
  ) {
    const userId =
      getUserId();

    if (!userId) {
      return false;
    }

    const key =
      makeKey(id, type);

    if (State.readKeys.has(key)) {
      return true;
    }

    let client;

    try {
      client = getSupabaseClient();
    } catch (error) {
      console.error(error);
      return false;
    }

    const row = {
      [CONFIG.readUserColumn]:
        userId,

      [CONFIG.readNotificationColumn]:
        id,

      [CONFIG.readTypeColumn]:
        type,

      [CONFIG.readNetworkColumn]:
        State.network,

      [CONFIG.readAtColumn]:
        new Date().toISOString()
    };

    const { error } =
      await client
        .from(CONFIG.readTable)
        .upsert(
          row,
          {
            onConflict:
              `${CONFIG.readUserColumn},${CONFIG.readNotificationColumn},${CONFIG.readTypeColumn},${CONFIG.readNetworkColumn}`
          }
        );

    if (error) {
      console.error(
        "ALBUKHR mark notification read error:",
        error
      );
      return false;
    }

    State.readKeys.add(key);
    updateBadge();

    return true;
  }

  async function markAllAsRead() {
    const notifications =
      [...State.notifications];

    for (const item of notifications) {
      await markAsRead(
        item.id,
        item.type
      );
    }

    updateBadge();
  }

  /* =========================================
     UNREAD
  ========================================= */

  function getUnreadNotifications() {
    return State.notifications.filter(
      item =>
        !State.readKeys.has(
          makeKey(
            item.id,
            item.type
          )
        )
    );
  }

  function getUnreadCount() {
    return getUnreadNotifications().length;
  }

  /* =========================================
     BADGE
  ========================================= */

  function updateBadge() {
    const badge =
      document.getElementById(
        "notifBadge"
      );

    if (!badge) return;

    const count =
      getUnreadCount();

    if (count <= 0) {
      badge.style.display = "none";
      badge.textContent = "";
      badge.setAttribute(
        "aria-label",
        "No unread notifications"
      );
      return;
    }

    badge.style.display = "flex";
    badge.textContent =
      count > 99 ? "99+" : String(count);

    badge.setAttribute(
      "aria-label",
      `${count} unread notification${
        count === 1 ? "" : "s"
      }`
    );
  }

  /* =========================================
     OPEN NEWS CENTER
  ========================================= */

  function openNotifications() {
    window.location.href =
      CONFIG.newsPage;
  }

  /* =========================================
     REFRESH
  ========================================= */

  async function refresh() {
    if (State.loading) return;

    State.loading = true;

    try {
      State.network =
        getCurrentNetwork();

      State.user =
        await getAuthenticatedUser();

      if (!State.user) {
        updateBadge();
        return;
      }

      await loadNotifications();
      await loadReadState();
      updateBadge();
    } catch (error) {
      console.error(
        "ALBUKHR Notification refresh error:",
        error
      );
    } finally {
      State.loading = false;
    }
  }

  /* =========================================
     NETWORK CHANGE
  ========================================= */

  async function handleNetworkChange() {
    State.network =
      getCurrentNetwork();

    State.notifications = [];
    State.readKeys = new Set();

    await refresh();
  }

  /* =========================================
     EVENTS
  ========================================= */

  function bindEvents() {
    window.addEventListener(
      "albukhrNetworkChanged",
      handleNetworkChange
    );

    window.addEventListener(
      "projectFeedUpdated",
      refresh
    );

    window.addEventListener(
      "officialNewsUpdated",
      refresh
    );

    document.addEventListener(
      "visibilitychange",
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          refresh();
        }
      }
    );
  }

  /* =========================================
     PUBLIC API
  ========================================= */

  window.AlbukhrNotificationEngine = {
    state: State,
    config: CONFIG,

    refresh,
    updateBadge,

    getUnreadCount,
    getUnreadNotifications,

    markAsRead,
    markAllAsRead,

    getUserProjects,
    loadNotifications,
    loadReadState,

    openNotifications
  };

  /*
   * Backward-compatible markup handler.
   */
  window.openNotifications =
    openNotifications;

  /* =========================================
     INIT
  ========================================= */

  function init() {
    if (State.initialized) return;

    State.initialized = true;

    bindEvents();
    refresh();
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }
})();
