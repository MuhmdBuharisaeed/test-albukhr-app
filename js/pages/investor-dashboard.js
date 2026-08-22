/* =========================================================
   ALBUKHR – INVESTOR DASHBOARD V5
   Production-consolidated investor dashboard page controller

   ARCHITECTURE:
   - Supabase/auth/data engines remain the source of truth.
   - Network is resolved from environment-switcher.js.
   - Investment records are obtained from the staking/data engine.
   - This page does NOT persist investment/auth state locally.
   - ALBUKHR DOCK NAV is intentionally preserved.
========================================================= */

(() => {
    "use strict";

    /* =========================================================
       DUPLICATE LOADER PROTECTION
    ========================================================= */

    if (window.__ALBUKHR_INVESTOR_DASHBOARD_LOADED__) {
        console.warn("ALBUKHR Investor Dashboard already loaded.");
        return;
    }

    window.__ALBUKHR_INVESTOR_DASHBOARD_LOADED__ = true;

    /* =========================================================
       DOCK NAV — PRESERVED EXACTLY IN BEHAVIOUR
    ========================================================= */

    let lastScroll = 0;
    const threshold = 10;
    const dock = document.querySelector(".dock-nav");

    if (dock) {
        window.addEventListener("scroll", () => {
            const current = window.pageYOffset;

            if (Math.abs(current - lastScroll) <= threshold) return;

            if (current > lastScroll) {
                dock.classList.add("hide");
            } else {
                dock.classList.remove("hide");
            }

            lastScroll = current;
        });
    }

    const currentPage =
        location.pathname.split("/").pop() || "index.html";

    document.querySelectorAll(".dock-item").forEach(link => {
        const href = link.getAttribute("href");

        if (href === currentPage) {
            link.classList.add("active");
        }
    });

    /* =========================================================
       HELPERS
    ========================================================= */

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function getNumber(value, fallback = 0) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function formatPi(value) {
        return `${getNumber(value).toFixed(2)} Pi`;
    }

    function getNetwork() {
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
            "ALBUKHR environment-switcher.js is required before investor-dashboard.js."
        );
    }

    function getSupabaseClient() {
        if (
            window.albukhrSupabase &&
            typeof window.albukhrSupabase.from === "function"
        ) {
            return window.albukhrSupabase;
        }

        if (typeof window.getAlbukhrSupabaseClient === "function") {
            const client = window.getAlbukhrSupabaseClient();

            if (client && typeof client.from === "function") {
                return client;
            }
        }

        if (
            window.supabaseClient &&
            typeof window.supabaseClient.from === "function"
        ) {
            return window.supabaseClient;
        }

        return null;
    }

    async function getAuthenticatedUser() {
        const supabase = getSupabaseClient();

        if (!supabase || !supabase.auth) {
            return null;
        }

        const result = await supabase.auth.getUser();

        if (result.error) {
            throw new Error(
                result.error.message || "Unable to verify investor session."
            );
        }

        return result.data?.user || null;
    }

    function getCurrentUserCompat() {
        try {
            if (
                window.AlbukhrEcosystem &&
                typeof window.AlbukhrEcosystem.currentUser === "function"
            ) {
                return window.AlbukhrEcosystem.currentUser() || {};
            }
        } catch (error) {
            console.warn("Unable to read compatibility user:", error);
        }

        return {};
    }

    function getInvestorIdentity(authUser) {
        const compat = getCurrentUserCompat();
        const metadata = authUser?.user_metadata || {};

        return {
            id: authUser?.id || compat.id || compat.user_id || "",
            username:
                metadata.username ||
                metadata.user_name ||
                compat.username ||
                compat.name ||
                "Investor",
            email:
                authUser?.email ||
                compat.email ||
                ""
        };
    }

    function normalizeStake(raw = {}, network = "") {
        const amount = Math.max(0, getNumber(raw.amount));
        const withdrawnCapital = Math.min(
            amount,
            Math.max(0, getNumber(raw.withdrawnCapital))
        );

        const reward = Math.max(0, getNumber(raw.reward));
        const withdrawnReward = Math.min(
            reward,
            Math.max(0, getNumber(raw.withdrawnReward))
        );

        return {
            ...raw,
            network: String(raw.network || network).trim().toLowerCase(),
            project: String(
                raw.project ||
                raw.project_name ||
                "Unnamed Project"
            ).trim(),
            amount,
            activeCapital: Math.max(0, amount - withdrawnCapital),
            reward,
            withdrawnReward,
            remainingReward: Math.max(
                0,
                reward - withdrawnReward
            ),
            withdrawnCapital,
            type: String(raw.type || "stake").trim().toLowerCase()
        };
    }

    function assertNetworkIsolation(stakes, network) {
        if (!Array.isArray(stakes)) {
            throw new Error("Invalid investment data.");
        }

        const recordsWithNetwork = stakes.filter(
            stake =>
                stake &&
                stake.network !== undefined &&
                stake.network !== null &&
                String(stake.network).trim() !== ""
        );

        const wrongNetwork = recordsWithNetwork.find(
            stake =>
                String(stake.network).trim().toLowerCase() !== network
        );

        if (wrongNetwork) {
            throw new Error(
                `ALBUKHR network isolation error: received ${String(
                    wrongNetwork.network
                )} investment data while running on ${network}.`
            );
        }

        /*
         * A legacy record without a network marker cannot be proven to
         * belong to the active network. Do not silently mix it into the
         * dashboard when network-aware data is available.
         */
        if (
            recordsWithNetwork.length > 0 &&
            recordsWithNetwork.length !== stakes.length
        ) {
            console.warn(
                "ALBUKHR Investor Dashboard: some investment records have no network field and were excluded."
            );

            return stakes.filter(
                stake =>
                    stake &&
                    String(stake.network || "").trim().toLowerCase() === network
            );
        }

        return stakes;
    }

    async function loadInvestments(network) {
        if (typeof window.getAllStakesMerged !== "function") {
            throw new Error("Investment data engine is unavailable.");
        }

        let result;

        try {
            /*
             * New engines should accept the active network explicitly.
             */
            result = await window.getAllStakesMerged({ network });
        } catch (firstError) {
            /*
             * Compatibility path for an older engine. It is only accepted
             * when every returned record carries a matching network marker.
             */
            console.warn(
                "ALBUKHR Investor Dashboard: network-aware investment call failed; attempting compatibility read.",
                firstError
            );

            result = await window.getAllStakesMerged();
        }

        const rawStakes = Array.isArray(result)
            ? result
            : Array.isArray(result?.stakes)
                ? result.stakes
                : null;

        if (!rawStakes) {
            throw new Error("Invalid investment data.");
        }

        const isolated = assertNetworkIsolation(
            rawStakes,
            network
        );

        return isolated.map(
            stake => normalizeStake(stake, network)
        );
    }

    function getProjectProgress(stakes) {
        /*
         * Progress must come from actual project data. There is no
         * production-safe basis for the previous hard-coded 85%.
         *
         * Supported optional fields:
         * progress / progress_percent / project_progress
         */
        const values = stakes
            .map(stake =>
                getNumber(
                    stake.progress ??
                    stake.progress_percent ??
                    stake.project_progress,
                    NaN
                )
            )
            .filter(Number.isFinite)
            .map(value => Math.min(100, Math.max(0, value)));

        if (!values.length) {
            return null;
        }

        return values.reduce(
            (sum, value) => sum + value,
            0
        ) / values.length;
    }

    function getProjectIcon(project, stakes) {
        const icon =
            stakes.find(stake => stake.icon)?.icon ||
            "";

        if (icon) {
            return String(icon);
        }

        return "images/projects/default.png";
    }

    function isImageIcon(value) {
        return /\.(png|jpe?g|webp|svg|gif)(\?.*)?$/i.test(
            String(value || "")
        );
    }

    /* =========================================================
       HERO USER
    ========================================================= */

    const heroUserName =
        document.getElementById("heroUserName");

    /* =========================================================
       GREETING
    ========================================================= */

    const greeting =
        document.getElementById("greetingText");

    if (greeting) {
        const hour = new Date().getHours();

        if (hour < 12) {
            greeting.textContent = "Good Morning,";
        } else if (hour < 18) {
            greeting.textContent = "Good Afternoon,";
        } else {
            greeting.textContent = "Good Evening,";
        }
    }

    /* =========================================================
       INVESTOR DASHBOARD
    ========================================================= */

    async function renderInvestorDashboard() {
        const container =
            document.getElementById("investments");

        if (!container) return;

        container.innerHTML = `
            <div class="invest-card dashboard-loading">
                Loading investments...
            </div>
        `;

        try {
            const network = getNetwork();
            const authUser = await getAuthenticatedUser();

            /*
             * A production investor dashboard must not render investment
             * data without an authenticated Supabase identity when
             * Supabase Auth is available.
             */
            if (getSupabaseClient() && !authUser) {
                throw new Error(
                    "Investor session is not authenticated."
                );
            }

            const identity =
                getInvestorIdentity(authUser);

            if (heroUserName) {
                heroUserName.textContent =
                    identity.username || "Investor";
            }

            const stakes =
                await loadInvestments(network);

            let totalInvest = 0;
            let totalEarn = 0;
            let totalPortfolio = 0;

            const projects = {};

            stakes.forEach(stake => {
                /*
                 * The staking engine is responsible for ownership
                 * filtering. This controller only aggregates the
                 * already-authorized records returned by that engine.
                 */
                const activeCapital =
                    stake.activeCapital;

                const remainingReward =
                    stake.remainingReward;

                totalInvest += activeCapital;
                totalPortfolio += activeCapital;

                if (stake.type === "stake") {
                    totalEarn += remainingReward;
                }

                const projectName =
                    stake.project || "Unnamed Project";

                if (!projects[projectName]) {
                    projects[projectName] = {
                        invest: 0,
                        earn: 0,
                        status: "Active",
                        count: 0,
                        stakes: []
                    };
                }

                projects[projectName].invest +=
                    activeCapital;

                projects[projectName].count += 1;

                projects[projectName].stakes.push(
                    stake
                );

                if (stake.type === "stake") {
                    projects[projectName].earn +=
                        remainingReward;
                }
            });

            /* =====================================================
               SUMMARY
            ===================================================== */

            const totalPortfolioEl =
                document.getElementById("totalPortfolio");

            const totalInvestEl =
                document.getElementById("totalInvest");

            const totalEarnEl =
                document.getElementById("totalEarn");

            const totalProjectsEl =
                document.getElementById("totalProjects");

            if (totalPortfolioEl) {
                totalPortfolioEl.textContent =
                    formatPi(totalPortfolio);
            }

            if (totalInvestEl) {
                totalInvestEl.textContent =
                    formatPi(totalInvest);
            }

            if (totalEarnEl) {
                totalEarnEl.textContent =
                    formatPi(totalEarn);
            }

            if (totalProjectsEl) {
                totalProjectsEl.textContent =
                    Object.keys(projects).length;
            }

            /* =====================================================
               HERO PORTFOLIO
            ===================================================== */

            const heroPortfolio =
                document.getElementById("heroPortfolio");

            if (heroPortfolio) {
                heroPortfolio.textContent =
                    formatPi(totalPortfolio);
            }

            const todayProfit =
                document.getElementById("todayProfit");

            if (todayProfit) {
                todayProfit.textContent =
                    `+${totalEarn.toFixed(2)} Pi`;
            }

            /* =====================================================
               EMPTY STATE
            ===================================================== */

            container.innerHTML = "";

            if (!Object.keys(projects).length) {
                container.innerHTML = `
                    <div class="invest-card empty-investments">
                        <h3>No investments yet</h3>
                        <p>
                            Start by exploring approved projects.
                        </p>
                        <button
                            class="wallet-btn"
                            type="button"
                            id="exploreMarketplaceButton">
                            Explore Marketplace
                        </button>
                    </div>
                `;

                const marketplaceButton =
                    document.getElementById(
                        "exploreMarketplaceButton"
                    );

                if (marketplaceButton) {
                    marketplaceButton.addEventListener(
                        "click",
                        () => {
                            location.href =
                                "marketplace.html";
                        }
                    );
                }

                return;
            }

            /* =====================================================
               PROJECT CARDS
            ===================================================== */

            Object.entries(projects).forEach(
                ([project, data]) => {
                    const card =
                        document.createElement("div");

                    card.className = "invest-card";

                    const safeProject =
                        escapeHTML(project);

                    const roi =
                        data.invest > 0
                            ? (
                                (data.earn / data.invest) *
                                100
                              ).toFixed(2)
                            : "0.00";

                    const projectURL =
                        `project.html?project=${
                            encodeURIComponent(project)
                        }`;

                    const progress =
                        getProjectProgress(
                            data.stakes
                        );

                    const icon =
                        getProjectIcon(
                            project,
                            data.stakes
                        );

                    const iconHTML =
                        isImageIcon(icon)
                            ? `
                                <img
                                    src="${escapeHTML(icon)}"
                                    alt="${safeProject}"
                                    loading="lazy"
                                    onerror="this.style.display='none';"
                                >
                              `
                            : `
                                <span
                                    class="investment-project-icon"
                                    aria-hidden="true">
                                    ${escapeHTML(icon)}
                                </span>
                              `;

                    const progressHTML =
                        progress === null
                            ? `
                                <div class="progress-header">
                                    <span>
                                        Project Progress
                                    </span>
                                    <span>
                                        —
                                    </span>
                                </div>

                                <div
                                    class="investment-progress"
                                    aria-label="Project progress unavailable">
                                    <div
                                        class="investment-progress-bar"
                                        style="width:0%">
                                    </div>
                                </div>
                              `
                            : `
                                <div class="progress-header">
                                    <span>
                                        Project Progress
                                    </span>
                                    <span>
                                        ${progress.toFixed(0)}%
                                    </span>
                                </div>

                                <div class="investment-progress">
                                    <div
                                        class="investment-progress-bar"
                                        style="width:${progress.toFixed(2)}%">
                                    </div>
                                </div>
                              `;

                    card.innerHTML = `
                        <div class="investment-top">

                            <div class="investment-project">

                                <div class="investment-icon">
                                    ${iconHTML}
                                </div>

                                <div>
                                    <div class="investment-name">
                                        ${safeProject}
                                    </div>

                                    <div class="investment-status">
                                        <span class="status-dot">
                                            Active
                                        </span>

                                        <span class="project-badge">
                                            ${data.stakes.some(
                                                stake =>
                                                    stake.project_type ===
                                                    "external"
                                            )
                                                ? "External Project"
                                                : "Core Project"}
                                        </span>
                                    </div>
                                </div>

                            </div>

                            <div class="investment-profit">
                                <b>
                                    ${data.earn.toFixed(2)} Pi
                                </b>

                                <span>
                                    Current Earnings
                                </span>
                            </div>

                        </div>

                        <div class="investment-grid">

                            <div>
                                <span>Invested</span>
                                <b>
                                    ${data.invest.toFixed(2)} Pi
                                </b>
                            </div>

                            <div>
                                <span>Earnings</span>
                                <b>
                                    ${data.earn.toFixed(2)} Pi
                                </b>
                            </div>

                            <div>
                                <span>ROI</span>
                                <b>
                                    ${roi}%
                                </b>
                            </div>

                            <div>
                                <span>Records</span>
                                <b>
                                    ${data.count}
                                </b>
                            </div>

                        </div>

                        ${progressHTML}

                        <button
                            class="investment-btn"
                            type="button"
                            data-project-url="${escapeHTML(projectURL)}">
                            View Details
                        </button>
                    `;

                    const viewButton =
                        card.querySelector(
                            ".investment-btn"
                        );

                    if (viewButton) {
                        viewButton.addEventListener(
                            "click",
                            () => {
                                location.href =
                                    projectURL;
                            }
                        );
                    }

                    container.appendChild(card);
                }
            );

        } catch (error) {
            console.error(
                "ALBUKHR Investor Dashboard Error:",
                error
            );

            container.innerHTML = `
                <div class="invest-card dashboard-error">
                    <h3>
                        Unable to load investments
                    </h3>

                    <p>
                        ${escapeHTML(
                            error?.message ||
                            "Please try again later."
                        )}
                    </p>

                    <button
                        class="wallet-btn"
                        type="button"
                        id="retryInvestorDashboard">
                        Retry
                    </button>
                </div>
            `;

            const retryButton =
                document.getElementById(
                    "retryInvestorDashboard"
                );

            if (retryButton) {
                retryButton.addEventListener(
                    "click",
                    renderInvestorDashboard
                );
            }
        }
    }

    /* =========================================================
       BALANCE VISIBILITY
       No local persistence.
       No emoji.
    ========================================================= */

    let portfolioVisible = true;

    const eyeButton =
        document.getElementById("toggleBalance");

    if (eyeButton) {
        eyeButton.setAttribute(
            "aria-label",
            "Hide portfolio balance"
        );

        eyeButton.setAttribute(
            "title",
            "Hide portfolio balance"
        );

        eyeButton.addEventListener(
            "click",
            async () => {
                const balance =
                    document.getElementById(
                        "heroPortfolio"
                    );

                if (!balance) return;

                portfolioVisible =
                    !portfolioVisible;

                if (portfolioVisible) {
                    await renderInvestorDashboard();

                    eyeButton.setAttribute(
                        "aria-label",
                        "Hide portfolio balance"
                    );

                    eyeButton.setAttribute(
                        "title",
                        "Hide portfolio balance"
                    );

                    eyeButton.innerHTML = `
                        <span
                            class="balance-eye-icon"
                            aria-hidden="true">
                            ◉
                        </span>
                    `;
                } else {
                    balance.textContent =
                        "••••••";

                    eyeButton.setAttribute(
                        "aria-label",
                        "Show portfolio balance"
                    );

                    eyeButton.setAttribute(
                        "title",
                        "Show portfolio balance"
                    );

                    eyeButton.innerHTML = `
                        <span
                            class="balance-eye-icon"
                            aria-hidden="true">
                            ○
                        </span>
                    `;
                }
            }
        );
    }

    /* =========================================================
       START
    ========================================================= */

    renderInvestorDashboard();

    /* =========================================================
       PUBLIC COMPATIBILITY API
    ========================================================= */

    window.renderInvestorDashboard =
        renderInvestorDashboard;

})();
