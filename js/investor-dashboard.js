/* =========================================================
   ALBUKHR – INVESTOR DASHBOARD V4
   Investor dashboard logic
   NOTE: ALBUKHR DOCK NAV is intentionally not modified.
========================================================= */

(() => {
    "use strict";

    /* =========================================================
       DOCK NAV — PRESERVED
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

    const currentPage = location.pathname.split("/").pop() || "index.html";

    document.querySelectorAll(".dock-item").forEach(link => {
        if (link.getAttribute("href") === currentPage) {
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

    function getNumber(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : 0;
    }

    function formatPi(value) {
        return `${getNumber(value).toFixed(2)} Pi`;
    }

    function getCurrentUser() {
        try {
            return window.AlbukhrEcosystem?.currentUser?.() || {};
        } catch (error) {
            console.warn("Unable to read current user:", error);
            return {};
        }
    }

    /* =========================================================
       HERO USER
    ========================================================= */

    const user = getCurrentUser();

    const heroUserName = document.getElementById("heroUserName");

    if (heroUserName) {
        heroUserName.textContent =
            user.username ||
            user.name ||
            "Investor";
    }

    /* =========================================================
       GREETING
    ========================================================= */

    const greeting = document.getElementById("greetingText");

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

        const container = document.getElementById("investments");

        if (!container) return;

        container.innerHTML = `
            <div class="invest-card dashboard-loading">
                Loading investments...
            </div>
        `;

        try {
            if (typeof window.getAllStakesMerged !== "function") {
                throw new Error("Investment data engine is unavailable.");
            }

            const stakes = await window.getAllStakesMerged();

            if (!Array.isArray(stakes)) {
                throw new Error("Invalid investment data.");
            }

            let totalInvest = 0;
            let totalEarn = 0;
            let totalPortfolio = 0;

            const projects = {};

            stakes.forEach(stake => {

                const amount = getNumber(stake.amount);
                const reward = getNumber(stake.reward);
                const withdrawnReward = getNumber(
                    stake.withdrawnReward
                );

                const remainingReward = Math.max(
                    0,
                    reward - withdrawnReward
                );

                const projectName =
                    String(
                        stake.project ||
                        "Unnamed Project"
                    ).trim();

                totalInvest += amount;
                totalPortfolio += amount;

                if (stake.type === "stake") {
                    totalEarn += remainingReward;
                }

                if (!projects[projectName]) {
                    projects[projectName] = {
                        invest: 0,
                        earn: 0,
                        status: "Active",
                        count: 0
                    };
                }

                projects[projectName].invest += amount;
                projects[projectName].count += 1;

                if (stake.type === "stake") {
                    projects[projectName].earn += remainingReward;
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

            if (Object.keys(projects).length === 0) {

                container.innerHTML = `
                    <div class="invest-card empty-investments">

                        <h3>No investments yet</h3>

                        <p>
                            Start by exploring approved projects.
                        </p>

                        <button
                            class="wallet-btn"
                            type="button"
                            onclick="location.href='marketplace.html'">

                            Explore Marketplace

                        </button>

                    </div>
                `;

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

                    card.innerHTML = `
                        <div class="investment-top">

                            <div class="investment-project">

                                <div class="investment-icon">

                                    <img
                                        src="images/projects/default.png"
                                        alt="${safeProject}"
                                        loading="lazy"
                                        onerror="this.style.display='none';"
                                    >

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
                                            Core Project
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

                        <div class="progress-header">

                            <span>
                                Project Progress
                            </span>

                            <span>
                                85%
                            </span>

                        </div>

                        <div class="investment-progress">

                            <div
                                class="investment-progress-bar"
                                style="width:85%">
                            </div>

                        </div>

                        <button
                            class="investment-btn"
                            type="button"
                            data-project-url="${escapeHTML(projectURL)}">

                            View Details

                        </button>
                    `;

                    const viewButton =
                        card.querySelector(".investment-btn");

                    if (viewButton) {
                        viewButton.addEventListener(
                            "click",
                            () => {
                                location.href = projectURL;
                            }
                        );
                    }

                    container.appendChild(card);
                }
            );

        } catch (error) {

            console.error(
                "Investor Dashboard Error:",
                error
            );

            container.innerHTML = `
                <div class="invest-card dashboard-error">

                    <h3>
                        Unable to load investments
                    </h3>

                    <p>
                        Please check your internet connection
                        or try again later.
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
       No emoji is used here.
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

    /* Optional global access for existing UI code. */
    window.renderInvestorDashboard =
        renderInvestorDashboard;

})();
