/* =========================================================
   ALBUKHR NEWS ENGINE
   NEW ARCHITECTURE / SUPABASE CORE VERSION
   ---------------------------------------------------------
   Location:
   js/pages/news.js

   Responsibilities:
   - Load visible official ecosystem news
   - Load visible updates for projects owned by the investor
   - Merge and sort the feed
   - Search / tab filtering / pagination
   - Render news cards through the existing page UI
   - Respect the active ALBUKHR network
   - Use shared authentication / Supabase core
   - No persistent auth state in localStorage
   - No hard-coded Supabase URL / key
========================================================= */

(() => {
    "use strict";

    /* =====================================================
       STATE
    ===================================================== */

    const NewsState = {
        allNews: [],
        filteredNews: [],
        page: 1,
        limit: 10,
        currentTab: "all",
        loading: false,
        hasMore: true
    };

    let currentUser = null;
    let refreshTimer = null;

    /* =====================================================
       DOM
    ===================================================== */

    const els = {
        newsFeed: document.getElementById("newsFeed"),
        newsEmpty: document.getElementById("newsEmpty"),
        newsLoading: document.getElementById("newsLoading"),
        refreshNewsBtn: document.getElementById("refreshNewsBtn"),
        loadMoreNews: document.getElementById("loadMoreNews"),
        searchInput: document.getElementById("newsSearch"),
        officialCount: document.getElementById("officialNewsCount"),
        projectCount: document.getElementById("projectNewsCount"),
        tabAll: document.getElementById("tabAll"),
        tabOfficial: document.getElementById("tabOfficial"),
        tabProjects: document.getElementById("tabProjects"),
        piUser: document.getElementById("piUser")
    };

    /* =====================================================
       CORE RESOLUTION
       -----------------------------------------------------
       The page must use the shared ALBUKHR architecture.
       We intentionally do not create a second Supabase client.
    ===================================================== */

    function getCore() {
        const core =
            window.AlbukhrSupabaseCore ||
            window.AlbukhrCore ||
            window.AlbukhrDataCore;

        if (!core) {
            throw new Error(
                "ALBUKHR Supabase Core is unavailable. Load js/supabase-core.js before js/pages/news.js."
            );
        }

        return core;
    }

    async function getSupabaseClient() {
        const core = getCore();

        if (typeof core.getClient === "function") {
            return await core.getClient();
        }

        if (typeof core.getSupabaseClient === "function") {
            return await core.getSupabaseClient();
        }

        if (core.supabase) {
            return core.supabase;
        }

        throw new Error(
            "ALBUKHR Supabase Core does not expose a Supabase client."
        );
    }

    /* =====================================================
       ACTIVE NETWORK
       -----------------------------------------------------
       Supports the shared network resolver used by the
       current/new architecture. If the core does not expose
       one, the engine does not invent a network value.
    ===================================================== */

    async function getActiveNetwork() {
        const core = getCore();

        const resolvers = [
            core.getNetwork,
            core.getActiveNetwork,
            core.resolveNetwork
        ];

        for (const resolver of resolvers) {
            if (typeof resolver === "function") {
                const value = await resolver.call(core);

                if (
                    value === "mainnet" ||
                    value === "testnet"
                ) {
                    return value;
                }
            }
        }

        const globalNetwork =
            window.AlbukhrNetwork ||
            window.ALBUKHR_NETWORK ||
            window.currentNetwork;

        if (
            globalNetwork === "mainnet" ||
            globalNetwork === "testnet"
        ) {
            return globalNetwork;
        }

        /*
         * Network isolation is a core requirement. We do not
         * silently guess when a network-aware schema is in use.
         */
        return null;
    }

    /* =====================================================
       AUTH
       ===================================================== */

    async function getCurrentUser() {
        const core = getCore();

        const authResolvers = [
            core.getCurrentUser,
            core.currentUser,
            core.getAuthenticatedUser
        ];

        for (const resolver of authResolvers) {
            if (typeof resolver !== "function") continue;

            try {
                const result = await resolver.call(core);

                if (result?.uid || result?.id || result?.username) {
                    return normalizeUser(result);
                }
            } catch (error) {
                console.warn(
                    "ALBUKHR shared auth resolver failed:",
                    error
                );
            }
        }

        if (typeof window.ensurePiAuth === "function") {
            try {
                const result = await window.ensurePiAuth();

                if (result?.uid || result?.id) {
                    return normalizeUser(result);
                }
            } catch (error) {
                console.warn(
                    "ALBUKHR ensurePiAuth failed:",
                    error
                );
            }
        }

        /*
         * Pi SDK is an authentication source, not persistent storage.
         */
        if (
            window.Pi &&
            typeof window.Pi.getUser === "function"
        ) {
            try {
                const result = await window.Pi.getUser();

                if (result?.uid) {
                    return normalizeUser(result);
                }
            } catch (error) {
                console.warn(
                    "Pi.getUser failed:",
                    error
                );
            }
        }

        return null;
    }

    function normalizeUser(user) {
        return {
            uid: user?.uid || user?.id || "",
            username: user?.username || user?.name || "",
            name: user?.name || user?.username || "",
            email: user?.email || ""
        };
    }

    async function loadCurrentUser() {
        try {
            currentUser = await getCurrentUser();

            if (!currentUser?.uid) {
                showLoginRequired();
                return false;
            }

            if (els.piUser) {
                els.piUser.textContent =
                    currentUser.username ||
                    currentUser.name ||
                    "";
            }

            return true;
        } catch (error) {
            console.error(
                "ALBUKHR News auth initialization error:",
                error
            );

            showLoginRequired();
            return false;
        }
    }

    function showLoginRequired() {
        if (els.newsFeed) {
            els.newsFeed.innerHTML = `
                <div class="loading-card">
                    Please login with Pi Browser to view your news.
                </div>
            `;
        }

        if (els.newsEmpty) {
            els.newsEmpty.style.display = "none";
        }

        if (els.loadMoreNews) {
            els.loadMoreNews.style.display = "none";
        }
    }

    /* =====================================================
       HELPERS
    ===================================================== */

    function escapeHtml(value = "") {
        const div = document.createElement("div");
        div.textContent = String(value);
        return div.innerHTML;
    }

    function shortText(text = "", limit = 180) {
        const value = String(text || "");

        if (value.length <= limit) {
            return value;
        }

        return `${value.substring(0, limit)}...`;
    }

    function formatDate(date) {
        if (!date) return "";

        const parsed = new Date(date);

        if (Number.isNaN(parsed.getTime())) {
            return "";
        }

        try {
            return parsed.toLocaleString([], {
                dateStyle: "medium",
                timeStyle: "short"
            });
        } catch (_) {
            return parsed.toLocaleString();
        }
    }

    function normalizeProjectName(value) {
        return String(value || "").trim();
    }

    function uniqueValues(values) {
        return [
            ...new Set(
                values
                    .map(normalizeProjectName)
                    .filter(Boolean)
            )
        ];
    }

    /* =====================================================
       LOADING UI
    ===================================================== */

    function showLoading() {
        NewsState.loading = true;

        if (els.newsLoading) {
            els.newsLoading.style.display = "flex";
        }
    }

    function hideLoading() {
        NewsState.loading = false;

        if (els.newsLoading) {
            els.newsLoading.style.display = "none";
        }
    }

    /* =====================================================
       COUNTERS
    ===================================================== */

    function updateCounters() {
        const official =
            NewsState.allNews.filter(
                item => item.category === "official"
            ).length;

        const projects =
            NewsState.allNews.filter(
                item => item.category === "project"
            ).length;

        if (els.officialCount) {
            els.officialCount.textContent = String(official);
        }

        if (els.projectCount) {
            els.projectCount.textContent = String(projects);
        }
    }

    /* =====================================================
       TABS
    ===================================================== */

    function clearTabs() {
        [els.tabAll, els.tabOfficial, els.tabProjects]
            .filter(Boolean)
            .forEach(tab => tab.classList.remove("active"));
    }

    function selectTab(tab) {
        NewsState.currentTab =
            ["all", "official", "projects"].includes(tab)
                ? tab
                : "all";

        clearTabs();

        if (NewsState.currentTab === "all") {
            els.tabAll?.classList.add("active");
        }

        if (NewsState.currentTab === "official") {
            els.tabOfficial?.classList.add("active");
        }

        if (NewsState.currentTab === "projects") {
            els.tabProjects?.classList.add("active");
        }

        filterNews();
    }

    /* =====================================================
       USER PROJECTS
    ===================================================== */

    async function getUserProjects() {
        /*
         * Preferred source: shared investment/stake engine.
         * This keeps investment business rules out of News Engine.
         */
        if (typeof window.getAllStakesMerged === "function") {
            try {
                const stakes =
                    await window.getAllStakesMerged();

                if (!Array.isArray(stakes)) {
                    return [];
                }

                const active = stakes.filter(item =>
                    item &&
                    item.type === "stake" &&
                    Number(item.amount) > 0 &&
                    item.project
                );

                return uniqueValues(
                    active.map(item => item.project)
                );
            } catch (error) {
                console.warn(
                    "Shared investment engine unavailable:",
                    error
                );
            }
        }

        /*
         * Optional new architecture registry API.
         */
        const core = getCore();

        const resolvers = [
            core.getUserProjects,
            core.getInvestorProjects,
            core.getOwnedProjects
        ];

        for (const resolver of resolvers) {
            if (typeof resolver !== "function") continue;

            try {
                const result =
                    await resolver.call(core, currentUser);

                if (Array.isArray(result)) {
                    return uniqueValues(
                        result.map(item =>
                            typeof item === "string"
                                ? item
                                : item?.project ||
                                  item?.project_name ||
                                  item?.name
                        )
                    );
                }
            } catch (error) {
                console.warn(
                    "Project resolver failed:",
                    error
                );
            }
        }

        return [];
    }

    /* =====================================================
       OFFICIAL NEWS
    ===================================================== */

    async function getOfficialNews() {
        const supabase =
            await getSupabaseClient();

        const network =
            await getActiveNetwork();

        let query =
            supabase
                .from("ecosystem_news")
                .select("*")
                .eq("visible", true)
                .order("created_at", {
                    ascending: false
                });

        /*
         * Network-aware tables must never mix environments.
         */
        if (network) {
            query = query.eq("network", network);
        }

        const { data, error } =
            await query;

        if (error) {
            console.error(
                "ALBUKHR official news query error:",
                error
            );
            return [];
        }

        return (data || []).map(item => ({
            id: item.id,
            type: "official",
            category: "official",
            title: item.title || "",
            description: item.description || "",
            image: item.image_url || "",
            created_at: item.created_at || null,
            project: null,
            network:
                item.network || network || null
        }));
    }

    /* =====================================================
       PROJECT NEWS
    ===================================================== */

    async function getMyProjectNews() {
        const projects =
            await getUserProjects();

        if (!projects.length) {
            return [];
        }

        const supabase =
            await getSupabaseClient();

        const network =
            await getActiveNetwork();

        let query =
            supabase
                .from("project_updates")
                .select("*")
                .in("project", projects)
                .eq("visible", true)
                .order("created_at", {
                    ascending: false
                });

        if (network) {
            query = query.eq("network", network);
        }

        const { data, error } =
            await query;

        if (error) {
            console.error(
                "ALBUKHR project news query error:",
                error
            );
            return [];
        }

        return (data || []).map(item => ({
            id: item.id,
            type: "project",
            category: "project",
            title: item.title || "",
            description: item.description || "",
            image: item.image_url || "",
            created_at: item.created_at || null,
            project: item.project || "",
            network:
                item.network || network || null
        }));
    }

    /* =====================================================
       LOAD MERGED FEED
    ===================================================== */

    async function loadNewsFeed() {
        const [official, projects] =
            await Promise.all([
                getOfficialNews(),
                getMyProjectNews()
            ]);

        const merged = [
            ...official,
            ...projects
        ];

        merged.sort((a, b) =>
            new Date(b.created_at || 0) -
            new Date(a.created_at || 0)
        );

        return merged;
    }

    /* =====================================================
       FILTER
    ===================================================== */

    function filterNews() {
        const keyword =
            (els.searchInput?.value || "")
                .toLowerCase()
                .trim();

        let list = [
            ...NewsState.allNews
        ];

        if (NewsState.currentTab === "official") {
            list = list.filter(
                item => item.category === "official"
            );
        }

        if (NewsState.currentTab === "projects") {
            list = list.filter(
                item => item.category === "project"
            );
        }

        if (keyword) {
            list = list.filter(item => {
                return (
                    String(item.title || "")
                        .toLowerCase()
                        .includes(keyword) ||
                    String(item.description || "")
                        .toLowerCase()
                        .includes(keyword) ||
                    String(item.project || "")
                        .toLowerCase()
                        .includes(keyword)
                );
            });
        }

        NewsState.filteredNews = list;
        NewsState.page = 1;

        renderNews();
    }

    /* =====================================================
       EMPTY STATE
    ===================================================== */

    function showEmpty() {
        if (els.newsFeed) {
            els.newsFeed.style.display = "none";
        }

        if (els.newsEmpty) {
            els.newsEmpty.style.display = "block";
        }

        if (els.loadMoreNews) {
            els.loadMoreNews.style.display = "none";
        }
    }

    function hideEmpty() {
        if (els.newsFeed) {
            els.newsFeed.style.display = "block";
        }

        if (els.newsEmpty) {
            els.newsEmpty.style.display = "none";
        }
    }

    /* =====================================================
       NEWS CARD
       -----------------------------------------------------
       Existing page markup/classes are preserved.
    ===================================================== */

    function createNewsCard(item) {
        const card =
            document.createElement("article");

        card.className = "news-card";

        const categoryLabel =
            item.category === "official"
                ? "Official"
                : "Project Update";

        const projectLabel =
            item.project
                ? `
                    <span class="news-project">
                        ${escapeHtml(item.project)}
                    </span>
                  `
                : "";

        const image =
            item.image
                ? `
                    <img
                        src="${escapeHtml(item.image)}"
                        alt="${escapeHtml(item.title || "News image")}"
                        class="news-image"
                        loading="lazy"
                        onerror="this.style.display='none';"
                    >
                  `
                : "";

        card.innerHTML = `
            ${image}

            <div class="news-card-content">

                <div class="news-meta">
                    <span class="news-category">
                        ${escapeHtml(categoryLabel)}
                    </span>

                    ${projectLabel}

                    ${
                        item.created_at
                            ? `
                                <time
                                    datetime="${escapeHtml(item.created_at)}"
                                >
                                    ${escapeHtml(
                                        formatDate(item.created_at)
                                    )}
                                </time>
                              `
                            : ""
                    }
                </div>

                <h3 class="news-title">
                    ${escapeHtml(item.title || "Untitled")}
                </h3>

                <p class="news-description">
                    ${escapeHtml(
                        shortText(item.description || "")
                    )}
                </p>

            </div>
        `;

        return card;
    }

    /* =====================================================
       RENDER
    ===================================================== */

    function renderNews() {
        if (!els.newsFeed) {
            return;
        }

        const end =
            NewsState.page *
            NewsState.limit;

        const list =
            NewsState.filteredNews.slice(0, end);

        els.newsFeed.innerHTML = "";

        if (!list.length) {
            NewsState.hasMore = false;
            showEmpty();
            return;
        }

        hideEmpty();

        list.forEach(item => {
            els.newsFeed.appendChild(
                createNewsCard(item)
            );
        });

        NewsState.hasMore =
            end < NewsState.filteredNews.length;

        if (els.loadMoreNews) {
            els.loadMoreNews.style.display =
                NewsState.hasMore
                    ? "inline-flex"
                    : "none";
        }
    }

    /* =====================================================
       LOAD
    ===================================================== */

    async function loadNews(refresh = false) {
        if (NewsState.loading) {
            return;
        }

        try {
            showLoading();

            if (refresh) {
                NewsState.page = 1;
            }

            const data =
                await loadNewsFeed();

            NewsState.allNews =
                Array.isArray(data)
                    ? data
                    : [];

            updateCounters();
            filterNews();

        } catch (error) {
            console.error(
                "ALBUKHR News Engine load error:",
                error
            );

            NewsState.allNews = [];
            NewsState.filteredNews = [];

            if (els.newsFeed) {
                els.newsFeed.style.display = "block";
                els.newsFeed.innerHTML = `
                    <div class="loading-card">
                        Unable to load news. Please try again.
                    </div>
                `;
            }

            if (els.newsEmpty) {
                els.newsEmpty.style.display = "none";
            }

            if (els.loadMoreNews) {
                els.loadMoreNews.style.display = "none";
            }
        } finally {
            hideLoading();
        }
    }

    /* =====================================================
       LOAD MORE
    ===================================================== */

    function loadMore() {
        if (
            NewsState.loading ||
            !NewsState.hasMore
        ) {
            return;
        }

        NewsState.page += 1;
        renderNews();
    }

    /* =====================================================
       EVENTS
    ===================================================== */

    function bindEvents() {
        els.tabAll?.addEventListener(
            "click",
            () => selectTab("all")
        );

        els.tabOfficial?.addEventListener(
            "click",
            () => selectTab("official")
        );

        els.tabProjects?.addEventListener(
            "click",
            () => selectTab("projects")
        );

        els.searchInput?.addEventListener(
            "input",
            () => filterNews()
        );

        els.refreshNewsBtn?.addEventListener(
            "click",
            () => loadNews(true)
        );

        els.loadMoreNews?.addEventListener(
            "click",
            loadMore
        );
    }

    /* =====================================================
       EXTERNAL EVENTS
    ===================================================== */

    function bindExternalEvents() {
        window.addEventListener(
            "projectFeedUpdated",
            () => loadNews(true)
        );

        window.addEventListener(
            "officialNewsUpdated",
            () => loadNews(true)
        );

        /*
         * Shared environment switcher can dispatch this event
         * when the active network changes without a full reload.
         */
        window.addEventListener(
            "albukhrNetworkChanged",
            () => loadNews(true)
        );
    }

    /* =====================================================
       AUTO REFRESH
    ===================================================== */

    function startAutoRefresh() {
        if (refreshTimer) {
            clearInterval(refreshTimer);
        }

        refreshTimer =
            window.setInterval(
                () => {
                    if (
                        document.hidden ||
                        NewsState.loading
                    ) {
                        return;
                    }

                    loadNews(true);
                },
                60000
            );
    }

    function stopAutoRefresh() {
        if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
        }
    }

    document.addEventListener(
        "visibilitychange",
        () => {
            if (document.hidden) {
                stopAutoRefresh();
            } else {
                startAutoRefresh();
                loadNews(true);
            }
        }
    );

    /* =====================================================
       INIT
    ===================================================== */

    async function init() {
        try {
            bindEvents();
            bindExternalEvents();

            clearTabs();
            els.tabAll?.classList.add("active");

            const authenticated =
                await loadCurrentUser();

            if (!authenticated) {
                return;
            }

            await loadNews(true);
            startAutoRefresh();

        } catch (error) {
            console.error(
                "ALBUKHR News Engine initialization error:",
                error
            );

            if (els.newsFeed) {
                els.newsFeed.innerHTML = `
                    <div class="loading-card">
                        News engine failed to initialize.
                    </div>
                `;
            }
        }
    }

    /* =====================================================
       PUBLIC API
    ===================================================== */

    const NewsEngine = {
        state: NewsState,
        init,
        loadNews,
        loadNewsFeed,
        filterNews,
        renderNews,
        getOfficialNews,
        getMyProjectNews,
        getUserProjects,
        getNewsById: id =>
            NewsState.allNews.find(
                item =>
                    String(item.id) === String(id)
            ),
        refresh: () => loadNews(true)
    };

    window.NewsEngine =
        NewsEngine;

    window.refreshNews =
        () => loadNews(true);

    /* =====================================================
       START
    ===================================================== */

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            init,
            { once: true }
        );
    } else {
        init();
    }

})();
