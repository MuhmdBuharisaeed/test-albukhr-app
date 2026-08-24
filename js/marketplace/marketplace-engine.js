/* =========================================================
   ALBUKHR MARKETPLACE ENGINES
   Unified Engine — Final Architecture
   Engines unified:
   1. Economic Intelligence
   2. Core Projects
   3. Liquidity Pool
   4. Market Ranking
   5. Marketplace UI helpers
   6. Marketplace project source
   7. Market discovery helpers
   8. Project Discovery
   9. Project Moderation
   10. Project Treasury
   11. Project Risk

   Architecture:
   - Supabase is the source of truth.
   - No persistent application state in localStorage/sessionStorage.
   - Network is resolved centrally; no hard-coded testnet.
   - Marketplace does not own payment/staking execution.
   - Investment execution delegates to AlbukhrEcosystem.invest().
========================================================= */

"use strict";

(function (window) {

    const db = window.supabaseClient;

    if (!db) {
        console.error("ALBUKHR Marketplace Engines: window.supabaseClient is unavailable.");
    }

    /* =====================================================
       NETWORK
    ===================================================== */

    function getNetwork() {
        if (typeof window.AlbukhrNetwork?.getCurrent === "function") {
            return String(window.AlbukhrNetwork.getCurrent()).toLowerCase() === "mainnet"
                ? "mainnet"
                : "testnet";
        }

        if (typeof window.getCurrentNetwork === "function") {
            return String(window.getCurrentNetwork()).toLowerCase() === "mainnet"
                ? "mainnet"
                : "testnet";
        }

        const host = String(window.location?.hostname || "").toLowerCase();

        if (host === "app.albukhr.com" || host.endsWith(".app.albukhr.com")) {
            return "mainnet";
        }

        return "testnet";
    }

    function network() {
        return getNetwork();
    }

    function assertDB() {
        if (!db) throw new Error("Supabase client is not available.");
    }

    /* =====================================================
       HELPERS
    ===================================================== */

    function safeNumber(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
    }

    function safeArray(value) {
        return Array.isArray(value) ? value : [];
    }

    function normalizeCode(value) {
        return String(value ?? "").trim().toLowerCase();
    }

    function projectCode(project) {
        if (typeof project === "string" || typeof project === "number") {
            return String(project);
        }

        return String(
            project?.code ??
            project?.project_code ??
            project?.key ??
            project?.projectCode ??
            ""
        );
    }

    function projectTitle(project) {
        return String(
            project?.title ??
            project?.project_name ??
            project?.name ??
            projectCode(project) ??
            "Unnamed Project"
        );
    }

    function projectType(project) {
        return String(
            project?.type ??
            project?.project_type ??
            "external"
        ).toLowerCase();
    }

    function rewardRate(project) {
        const raw =
            project?.roi ??
            project?.rewardRate ??
            project?.reward_rate ??
            0;

        return safeNumber(raw);
    }

    function riskObject(project) {
        return project?.risk && typeof project.risk === "object"
            ? project.risk
            : { risk: "UNKNOWN", score: 0 };
    }

    function defaultRisk() {
        return {
            score: 0,
            risk: "UNKNOWN",
            treasuryHealth: "UNKNOWN",
            liquidityScore: 0,
            investorScore: 0,
            withdrawScore: 0,
            roiScore: 0,
            liquidity: 0,
            totalStake: 0,
            investors: 0,
            withdrawnCapital: 0,
            withdrawnReward: 0
        };
    }

    function uniqueCount(items) {
        return new Set(
            safeArray(items)
                .map(v => String(v ?? "").trim())
                .filter(Boolean)
        ).size;
    }

    function findProject(list, code) {
        const target = normalizeCode(code);

        return safeArray(list).find(p =>
            normalizeCode(projectCode(p)) === target
        ) || null;
    }

    /* =====================================================
       PROJECT SOURCE
    ===================================================== */

    async function getProjects(options = {}) {
        assertDB();

        let query = db
            .from("projects")
            .select("*")
            .eq("network", network());

        if (options.activeOnly !== false) {
            query = query.eq("status", "active");
        }

        const { data, error } = await query;

        if (error) {
            console.error("ALBUKHR Projects:", error);
            throw error;
        }

        return safeArray(data);
    }

    async function getProject(code) {
        const target = normalizeCode(code);
        if (!target) return null;

        const projects = await getProjects({ activeOnly: false });
        return findProject(projects, target);
    }

    async function getActiveProjects() {
        return getProjects({ activeOnly: true });
    }

    async function getAllProjects() {
        return getProjects({ activeOnly: false });
    }

    /* =====================================================
       TREASURY
    ===================================================== */

    async function getProjectTreasuryStatus(code) {
        const target = projectCode(code);
        if (!target) {
            return {
                liquidity: 0,
                totalStake: 0,
                totalReward: 0,
                withdrawnCapital: 0,
                withdrawnReward: 0,
                investors: 0,
                activeStakes: 0
            };
        }

        assertDB();

        const [stakesResult, withdrawalsResult] = await Promise.all([
            db.from("stakes")
                .select("amount,reward,withdrawnCapital,withdrawnReward,userid,status,created_at")
                .eq("project", target)
                .eq("network", network())
                .eq("status", "paid"),

            db.from("withdraw_requests")
                .select("amount,type,status,userid,created_at")
                .eq("project", target)
                .eq("network", network())
        ]);

        if (stakesResult.error) {
            console.error("Treasury stakes:", stakesResult.error);
            throw stakesResult.error;
        }

        if (withdrawalsResult.error) {
            console.error("Treasury withdrawals:", withdrawalsResult.error);
            throw withdrawalsResult.error;
        }

        const stakes = safeArray(stakesResult.data);
        const withdrawals = safeArray(withdrawalsResult.data);

        let totalStake = 0;
        let totalReward = 0;
        let withdrawnCapital = 0;
        let withdrawnReward = 0;

        const investors = new Set();

        for (const stake of stakes) {
            totalStake += safeNumber(stake.amount);
            totalReward += safeNumber(stake.reward);
            withdrawnCapital += safeNumber(stake.withdrawnCapital);
            withdrawnReward += safeNumber(stake.withdrawnReward);

            if (stake.userid) investors.add(String(stake.userid));
        }

        for (const withdrawal of withdrawals) {
            if (String(withdrawal.status).toLowerCase() !== "paid") continue;

            const amount = safeNumber(withdrawal.amount);
            const type = String(withdrawal.type || "").toLowerCase();

            if (type === "capital") withdrawnCapital += amount;
            if (type === "reward") withdrawnReward += amount;
        }

        return {
            liquidity: Math.max(0, totalStake - withdrawnCapital),
            totalStake,
            totalReward,
            withdrawnCapital,
            withdrawnReward,
            investors: investors.size,
            activeStakes: stakes.length
        };
    }

    async function getProjectLiquidity(code) {
        const treasury = await getProjectTreasuryStatus(code);
        return safeNumber(treasury.liquidity);
    }

    async function getProjectTreasuryHistory(code) {
        const target = projectCode(code);
        if (!target) return [];

        assertDB();

        const [stakesResult, withdrawalsResult] = await Promise.all([
            db.from("stakes")
                .select("amount,userid,status,created_at")
                .eq("project", target)
                .eq("network", network())
                .eq("status", "paid"),

            db.from("withdraw_requests")
                .select("amount,type,userid,status,created_at")
                .eq("project", target)
                .eq("network", network())
        ]);

        if (stakesResult.error) throw stakesResult.error;
        if (withdrawalsResult.error) throw withdrawalsResult.error;

        const history = [
            ...safeArray(stakesResult.data).map(s => ({
                type: "stake",
                amount: safeNumber(s.amount),
                status: s.status,
                userid: s.userid,
                created_at: s.created_at
            })),
            ...safeArray(withdrawalsResult.data).map(w => ({
                type: String(w.type || "withdrawal"),
                amount: safeNumber(w.amount),
                status: w.status,
                userid: w.userid,
                created_at: w.created_at
            }))
        ];

        history.sort(
            (a, b) =>
                new Date(b.created_at || 0) -
                new Date(a.created_at || 0)
        );

        return history;
    }

    async function getAllTreasury() {
        const projects = await getProjects({ activeOnly: false });
        const result = {};

        for (const project of projects) {
            result[projectCode(project)] =
                await getProjectTreasuryStatus(projectCode(project));
        }

        return result;
    }

    async function refreshTreasury() {
        return getAllTreasury();
    }

    /* =====================================================
       LIQUIDITY POOL
    ===================================================== */

    function getReservePercent(project) {
        const value =
            project?.reserve_percent ??
            project?.reservePercent ??
            project?.reserve ??
            10;

        let percent = safeNumber(value);

        // Accept both 0.30 and 30 style configurations.
        if (percent > 0 && percent <= 1) percent *= 100;

        return Math.max(0, Math.min(percent, 100));
    }

    const LiquidityPool = {};

    LiquidityPool.getPaidStakes = async function (code) {
        assertDB();

        const { data, error } = await db
            .from("stakes")
            .select("*")
            .eq("project", projectCode(code))
            .eq("network", network())
            .eq("status", "paid");

        if (error) throw error;
        return safeArray(data);
    };

    LiquidityPool.getTotalLiquidity = async function (code) {
        const treasury = await getProjectTreasuryStatus(code);
        return treasury.totalStake;
    };

    LiquidityPool.getWithdrawnCapital = async function (code) {
        const treasury = await getProjectTreasuryStatus(code);
        return treasury.withdrawnCapital;
    };

    LiquidityPool.getLiquidity = async function (code) {
        return getProjectLiquidity(code);
    };

    LiquidityPool.getReserve = async function (code) {
        const project = await getProject(code);
        const liquidity = await getProjectLiquidity(code);

        return (liquidity * getReservePercent(project)) / 100;
    };

    LiquidityPool.getAvailable = async function (code) {
        const liquidity = await getProjectLiquidity(code);
        const reserve = await LiquidityPool.getReserve(code);

        return Math.max(0, liquidity - reserve);
    };

    LiquidityPool.getUtilization = async function (code) {
        const liquidity = await getProjectLiquidity(code);
        const available = await LiquidityPool.getAvailable(code);

        if (liquidity <= 0) return 0;

        return Number(
            (((liquidity - available) / liquidity) * 100).toFixed(2)
        );
    };

    LiquidityPool.getHealth = async function (code) {
        const liquidity = await getProjectLiquidity(code);
        const available = await LiquidityPool.getAvailable(code);

        if (liquidity <= 0) {
            return { status: "EMPTY", score: 0 };
        }

        const percent = (available / liquidity) * 100;

        let status = "CRITICAL";
        if (percent >= 90) status = "EXCELLENT";
        else if (percent >= 70) status = "GOOD";
        else if (percent >= 50) status = "MEDIUM";

        return {
            status,
            score: Number(percent.toFixed(2))
        };
    };

    LiquidityPool.getStatus = async function (code) {
        const [liquidity, reserve, available, utilization, health] =
            await Promise.all([
                LiquidityPool.getLiquidity(code),
                LiquidityPool.getReserve(code),
                LiquidityPool.getAvailable(code),
                LiquidityPool.getUtilization(code),
                LiquidityPool.getHealth(code)
            ]);

        return {
            project: projectCode(code),
            liquidity,
            reserve,
            available,
            utilization,
            health
        };
    };

    LiquidityPool.summary = async function () {
        const projects = await getProjects({ activeOnly: false });

        let liquidity = 0;
        let reserve = 0;
        let available = 0;

        for (const project of projects) {
            const pool = await LiquidityPool.getStatus(projectCode(project));
            liquidity += pool.liquidity;
            reserve += pool.reserve;
            available += pool.available;
        }

        return {
            projects: projects.length,
            liquidity,
            reserve,
            available
        };
    };

    window.LiquidityPool = LiquidityPool;

    /* =====================================================
       RISK ENGINE
    ===================================================== */

    async function calculateProjectROI(code) {
        const project = await getProject(code);
        return rewardRate(project);
    }

    async function getProjectRisk(code) {
        const target = projectCode(code);
        if (!target) return defaultRisk();

        let treasury;

        try {
            treasury = await getProjectTreasuryStatus(target);
        } catch (error) {
            console.error("Risk Treasury:", error);
            return defaultRisk();
        }

        const totalStake = safeNumber(treasury.totalStake);
        const liquidity = safeNumber(treasury.liquidity);
        const investors = safeNumber(treasury.investors);
        const withdrawnCapital = safeNumber(treasury.withdrawnCapital);
        const withdrawnReward = safeNumber(treasury.withdrawnReward);

        let liquidityScore = 100;
        if (totalStake > 0) {
            liquidityScore = Math.min(
                (liquidity / totalStake) * 100,
                100
            );
        }

        let investorScore = 30;
        if (investors >= 100) investorScore = 100;
        else if (investors >= 50) investorScore = 90;
        else if (investors >= 20) investorScore = 75;
        else if (investors >= 10) investorScore = 60;

        let withdrawScore = 100;
        const withdrawn = withdrawnCapital + withdrawnReward;

        if (totalStake > 0) {
            const pressure = (withdrawn / totalStake) * 100;

            if (pressure > 70) withdrawScore = 30;
            else if (pressure > 50) withdrawScore = 50;
            else if (pressure > 30) withdrawScore = 70;
            else if (pressure > 15) withdrawScore = 85;
        }

        const roi = await calculateProjectROI(target);

        let roiScore = 100;
        if (roi >= 50) roiScore = 40;
        else if (roi >= 30) roiScore = 60;
        else if (roi >= 20) roiScore = 80;

        let treasuryHealth = "STRONG";
        if (liquidityScore < 50) treasuryHealth = "WEAK";
        else if (liquidityScore < 80) treasuryHealth = "FAIR";

        const score =
            (liquidityScore * 0.40) +
            (investorScore * 0.20) +
            (withdrawScore * 0.20) +
            (roiScore * 0.20);

        let risk = "HIGH";
        if (score >= 80) risk = "LOW";
        else if (score >= 60) risk = "MEDIUM";

        return {
            score: Number(score.toFixed(2)),
            risk,
            treasuryHealth,
            liquidityScore,
            investorScore,
            withdrawScore,
            roiScore,
            liquidity,
            totalStake,
            investors,
            withdrawnCapital,
            withdrawnReward
        };
    }

    window.getProjectRisk = getProjectRisk;
    window.calculateProjectROI = calculateProjectROI;

    /* =====================================================
       ECONOMIC INTELLIGENCE
    ===================================================== */

    async function getEconomicMetrics(code) {
        const target = projectCode(code);
        if (!target) return null;

        const project = await getProject(target);
        if (!project) return null;

        const [treasury, risk, roi] = await Promise.all([
            getProjectTreasuryStatus(target),
            getProjectRisk(target),
            calculateProjectROI(target)
        ]);

        const liquidity = safeNumber(treasury.liquidity);
        const investors = safeNumber(treasury.investors);
        const totalStake = safeNumber(treasury.totalStake);
        const withdrawnCapital = safeNumber(treasury.withdrawnCapital);
        const withdrawnReward = safeNumber(treasury.withdrawnReward);

        let liquidityNeed = 0;

        if (liquidity < 500) liquidityNeed += 40;
        if (investors >= 20) liquidityNeed += 20;
        if (totalStake > liquidity) liquidityNeed += 40;

        liquidityNeed = Math.min(liquidityNeed, 100);

        let profitScore = 0;
        profitScore += roi * 2;
        profitScore += Math.min(investors, 50);
        profitScore += Math.min(liquidity / 100, 30);
        profitScore = Math.min(profitScore, 100);

        let sustainability = 100 - safeNumber(risk.score);
        sustainability += Math.min(liquidity / 100, 20);
        sustainability = Math.max(0, Math.min(100, sustainability));

        return {
            ...project,
            code: projectCode(project),
            title: projectTitle(project),
            type: projectType(project),
            liquidity,
            investors,
            totalStake,
            roi,
            risk: risk.risk,
            riskScore: risk.score,
            treasuryHealth: risk.treasuryHealth,
            withdrawnCapital,
            withdrawnReward,
            liquidityNeed,
            profitScore,
            sustainability
        };
    }

    async function getEconomicIntelligence() {
        const projects = await getProjects({ activeOnly: false });
        const list = [];

        for (const project of projects) {
            const metrics = await getEconomicMetrics(projectCode(project));
            if (metrics) list.push(metrics);
        }

        return list;
    }

    async function getLiquidityPriority(limit = 5) {
        return (await getEconomicIntelligence())
            .sort((a, b) => b.liquidityNeed - a.liquidityNeed)
            .slice(0, limit);
    }

    async function getTopProfitProjects(limit = 5) {
        return (await getEconomicIntelligence())
            .sort((a, b) => b.profitScore - a.profitScore)
            .slice(0, limit);
    }

    async function getHighRiskProjects(limit = 5) {
        return (await getEconomicIntelligence())
            .filter(p => p.risk === "HIGH")
            .slice(0, limit);
    }

    async function getStrongestProjects(limit = 5) {
        return (await getEconomicIntelligence())
            .sort((a, b) => b.sustainability - a.sustainability)
            .slice(0, limit);
    }

    async function getInvestmentRecommendations() {
        return (await getEconomicIntelligence()).map(project => {
            let recommendation = "HOLD";

            if (
                project.risk === "LOW" &&
                project.sustainability >= 80 &&
                project.profitScore >= 70
            ) {
                recommendation = "INVEST";
            } else if (
                project.risk === "HIGH" ||
                project.sustainability < 40
            ) {
                recommendation = "AVOID";
            }

            return { ...project, recommendation };
        });
    }

    /* =====================================================
       MARKET RANKING
    ===================================================== */

    let rankingCache = [];
    let rankingNetwork = null;
    let rankingUpdated = 0;
    const CACHE_TIME = 10000;

    async function getProjectMetrics(code) {
        const project = await getProject(code);
        if (!project) return null;

        const [treasury, risk] = await Promise.all([
            getProjectTreasuryStatus(code),
            getProjectRisk(code)
        ]);

        return {
            code: projectCode(project),
            title: projectTitle(project),
            type: projectType(project),
            liquidity: safeNumber(treasury.liquidity),
            investors: safeNumber(treasury.investors),
            totalStake: safeNumber(treasury.totalStake),
            totalReward: safeNumber(treasury.totalReward),
            roi: rewardRate(project),
            riskScore: safeNumber(risk.score),
            riskLevel: risk.risk || "UNKNOWN"
        };
    }

    async function getMarketMetrics(force = false) {
        const currentNetwork = network();
        const now = Date.now();

        if (
            !force &&
            rankingNetwork === currentNetwork &&
            rankingCache.length &&
            now - rankingUpdated < CACHE_TIME
        ) {
            return rankingCache;
        }

        const projects = await getProjects({ activeOnly: false });
        const list = [];

        for (const project of projects) {
            const metrics = await getProjectMetrics(projectCode(project));
            if (metrics) list.push(metrics);
        }

        rankingCache = list;
        rankingNetwork = currentNetwork;
        rankingUpdated = now;

        return list;
    }

    async function getTopROIProjects(limit = 5) {
        return (await getMarketMetrics())
            .sort((a, b) => b.roi - a.roi)
            .slice(0, limit);
    }

    async function getHighestLiquidityProjects(limit = 5) {
        return (await getMarketMetrics())
            .sort((a, b) => b.liquidity - a.liquidity)
            .slice(0, limit);
    }

    async function getMostInvestedProjects(limit = 5) {
        return (await getMarketMetrics())
            .sort((a, b) => b.investors - a.investors)
            .slice(0, limit);
    }

    async function getSafestProjects(limit = 5) {
        return (await getMarketMetrics())
            .sort((a, b) => a.riskScore - b.riskScore)
            .slice(0, limit);
    }

    async function getMarketLeaderboard(sort = "default") {
        const data = [...await getMarketMetrics()];

        switch (String(sort).toLowerCase()) {
            case "roi":
                data.sort((a, b) => b.roi - a.roi);
                break;
            case "liquidity":
                data.sort((a, b) => b.liquidity - a.liquidity);
                break;
            case "investors":
                data.sort((a, b) => b.investors - a.investors);
                break;
            case "risk":
                data.sort((a, b) => a.riskScore - b.riskScore);
                break;
            default:
                data.sort((a, b) => a.title.localeCompare(b.title));
        }

        return data;
    }

    async function getMarketSummary() {
        const list = await getMarketMetrics();

        const totals = list.reduce((acc, item) => {
            acc.liquidity += safeNumber(item.liquidity);
            acc.stake += safeNumber(item.totalStake);
            acc.investors += safeNumber(item.investors);
            acc.roi += safeNumber(item.roi);
            acc.risk += safeNumber(item.riskScore);
            return acc;
        }, {
            liquidity: 0,
            stake: 0,
            investors: 0,
            roi: 0,
            risk: 0
        });

        return {
            projects: list.length,
            liquidity: totals.liquidity,
            stake: totals.stake,
            investors: totals.investors,
            averageROI: list.length ? totals.roi / list.length : 0,
            averageRisk: list.length ? totals.risk / list.length : 0
        };
    }

    async function refreshMarketRanking() {
        rankingCache = [];
        rankingNetwork = null;
        rankingUpdated = 0;
        return getMarketMetrics(true);
    }

    async function searchMarketProjects(keyword = "") {
        const search = String(keyword).trim().toLowerCase();
        const list = await getMarketMetrics();

        if (!search) return list;

        return list.filter(project =>
            normalizeCode(project.code).includes(search) ||
            String(project.title).toLowerCase().includes(search) ||
            String(project.type).toLowerCase().includes(search)
        );
    }

    /* =====================================================
       DISCOVERY
    ===================================================== */

    let discoveryCache = [];
    let discoveryNetwork = null;
    let discoveryUpdated = 0;

    async function getProjectDiscoveryScore(code) {
        const metrics = await getProjectMetrics(code);
        if (!metrics) return 0;

        const liquidityScore = Math.min(metrics.liquidity / 10, 100);
        const investorScore = Math.min(metrics.investors * 5, 100);
        const roiScore = Math.min(metrics.roi * 5, 100);
        const riskScore = 100 - metrics.riskScore;

        return (
            liquidityScore * 0.35 +
            investorScore * 0.25 +
            roiScore * 0.20 +
            riskScore * 0.20
        );
    }

    async function getDiscoveryProjects(force = false) {
        const currentNetwork = network();
        const now = Date.now();

        if (
            !force &&
            discoveryNetwork === currentNetwork &&
            discoveryCache.length &&
            now - discoveryUpdated < CACHE_TIME
        ) {
            return discoveryCache;
        }

        const metrics = await getMarketMetrics(force);
        const list = [];

        for (const project of metrics) {
            list.push({
                ...project,
                discoveryScore: await getProjectDiscoveryScore(project.code)
            });
        }

        discoveryCache = list;
        discoveryNetwork = currentNetwork;
        discoveryUpdated = now;

        return list;
    }

    async function getTrendingProjects(limit = 5) {
        return (await getDiscoveryProjects())
            .sort((a, b) => b.discoveryScore - a.discoveryScore)
            .slice(0, limit);
    }

    async function getFeaturedProjects(limit = 5) {
        return (await getDiscoveryProjects())
            .filter(project =>
                project.liquidity >= 300 &&
                project.riskLevel === "LOW"
            )
            .sort((a, b) => b.discoveryScore - a.discoveryScore)
            .slice(0, limit);
    }

    async function getHotProjects(limit = 5) {
        return getTrendingProjects(limit);
    }

    async function sortByDiscovery() {
        return [...await getDiscoveryProjects()]
            .sort((a, b) => b.discoveryScore - a.discoveryScore);
    }

    async function getNewestProjects(limit = 5) {
        const projects = await getProjects({ activeOnly: false });

        return [...projects]
            .sort((a, b) =>
                new Date(b.created_at || 0) -
                new Date(a.created_at || 0)
            )
            .slice(0, limit);
    }

    async function getDiscoveryDashboard() {
        const [
            trending,
            featured,
            hot,
            newest,
            safest
        ] = await Promise.all([
            getTrendingProjects(),
            getFeaturedProjects(),
            getHotProjects(),
            getNewestProjects(),
            getSafestProjects()
        ]);

        return {
            trending,
            featured,
            hot,
            newest,
            safest
        };
    }

    async function refreshDiscovery() {
        discoveryCache = [];
        discoveryNetwork = null;
        discoveryUpdated = 0;
        return getDiscoveryProjects(true);
    }

    /* =====================================================
       MODERATION
       ===================================================== */

    const ProjectModeration = {};

    const MIN_LIQUIDITY = 100;
    const MAX_RISK_SCORE = 75;
    const MAX_REWARD_RATE = 20;

    ProjectModeration.evaluate = async function (code) {
        const project = await getProject(code);
        if (!project) return null;

        const treasury = await getProjectTreasuryStatus(code);
        const risk = await getProjectRisk(code);
        const reward = rewardRate(project);

        const flags = [];

        if (treasury.liquidity < MIN_LIQUIDITY) {
            flags.push({
                code: "LOW_LIQUIDITY",
                message: "Project liquidity is below minimum."
            });
        }

        if (reward > MAX_REWARD_RATE) {
            flags.push({
                code: "HIGH_REWARD",
                message: "Reward rate exceeds safe limit."
            });
        }

        if (risk.score > MAX_RISK_SCORE) {
            flags.push({
                code: "HIGH_RISK",
                message: "Project risk is above acceptable level."
            });
        }

        let status = "approved";

        if (flags.length) status = "review";

        if (
            risk.risk === "HIGH" &&
            treasury.liquidity < MIN_LIQUIDITY
        ) {
            status = "blocked";
        }

        return {
            code: projectCode(project),
            title: projectTitle(project),
            status,
            flags,
            liquidity: treasury.liquidity,
            rewardRate: reward,
            investors: treasury.investors,
            totalStake: treasury.totalStake,
            risk,
            score: risk.score
        };
    };

    ProjectModeration.evaluateAll = async function () {
        const projects = await getProjects({ activeOnly: false });
        const results = [];

        for (const project of projects) {
            const result = await ProjectModeration.evaluate(projectCode(project));
            if (result) results.push(result);
        }

        return results;
    };

    ProjectModeration.getApproved = async function () {
        return (await ProjectModeration.evaluateAll())
            .filter(p => p.status === "approved");
    };

    ProjectModeration.getReviewQueue = async function () {
        return (await ProjectModeration.evaluateAll())
            .filter(p => p.status === "review");
    };

    ProjectModeration.getBlocked = async function () {
        return (await ProjectModeration.evaluateAll())
            .filter(p => p.status === "blocked");
    };

    ProjectModeration.summary = async function () {
        const list = await ProjectModeration.evaluateAll();

        return {
            approved: list.filter(p => p.status === "approved").length,
            review: list.filter(p => p.status === "review").length,
            blocked: list.filter(p => p.status === "blocked").length,
            total: list.length
        };
    };

    window.ProjectModeration = ProjectModeration;

    /* =====================================================
       CORE PROJECTS
    ===================================================== */

    const CoreProjects = {};
    let coreCache = [];
    let coreNetwork = null;
    let coreUpdated = 0;

    CoreProjects.getAll = async function (forceRefresh = false) {
        const currentNetwork = network();
        const now = Date.now();

        if (
            !forceRefresh &&
            coreNetwork === currentNetwork &&
            coreCache.length &&
            now - coreUpdated < CACHE_TIME
        ) {
            return coreCache;
        }

        const projects = await getProjects({ activeOnly: false });

        coreCache = projects.filter(
            p => projectType(p) === "core"
        );

        coreNetwork = currentNetwork;
        coreUpdated = now;

        return coreCache;
    };

    CoreProjects.get = async function (code) {
        return findProject(
            await CoreProjects.getAll(),
            code
        );
    };

    CoreProjects.exists = async function (code) {
        return !!await CoreProjects.get(code);
    };

    CoreProjects.count = async function () {
        return (await CoreProjects.getAll()).length;
    };

    CoreProjects.summary = async function () {
        const list = await CoreProjects.getAll();

        const roi = list.reduce(
            (sum, project) => sum + rewardRate(project),
            0
        );

        const liquidity = list.reduce(
            (sum, project) =>
                sum + safeNumber(project.liquidity),
            0
        );

        return {
            projects: list.length,
            averageROI: list.length
                ? Number((roi / list.length).toFixed(4))
                : 0,
            liquidity
        };
    };

    CoreProjects.refresh = async function () {
        coreCache = [];
        coreNetwork = null;
        coreUpdated = 0;
        return CoreProjects.getAll(true);
    };

    window.CoreProjects = CoreProjects;

    /* =====================================================
       UNIFIED MARKETPLACE API
    ===================================================== */

    const AlbukhrMarketplace = {};

    AlbukhrMarketplace.getProjects = async function (options = {}) {
        return getProjects({
            activeOnly: options.activeOnly !== false
        });
    };

    AlbukhrMarketplace.getProject = getProject;

    AlbukhrMarketplace.getActiveProjects = getActiveProjects;

    AlbukhrMarketplace.getAllProjects = getAllProjects;

    AlbukhrMarketplace.getEconomicMetrics = getEconomicMetrics;

    AlbukhrMarketplace.getEconomicIntelligence = getEconomicIntelligence;

    AlbukhrMarketplace.getMarketMetrics = getMarketMetrics;

    AlbukhrMarketplace.getMarketSummary = getMarketSummary;

    AlbukhrMarketplace.getProjectRisk = getProjectRisk;

    AlbukhrMarketplace.getProjectTreasuryStatus =
        getProjectTreasuryStatus;

    AlbukhrMarketplace.getProjectTreasuryHistory =
        getProjectTreasuryHistory;

    AlbukhrMarketplace.getProjectLiquidity =
        getProjectLiquidity;

    AlbukhrMarketplace.getLiquidityPriority =
        getLiquidityPriority;

    AlbukhrMarketplace.getTopProfitProjects =
        getTopProfitProjects;

    AlbukhrMarketplace.getHighRiskProjects =
        getHighRiskProjects;

    AlbukhrMarketplace.getStrongestProjects =
        getStrongestProjects;

    AlbukhrMarketplace.getInvestmentRecommendations =
        getInvestmentRecommendations;

    AlbukhrMarketplace.getTopROIProjects =
        getTopROIProjects;

    AlbukhrMarketplace.getHighestLiquidityProjects =
        getHighestLiquidityProjects;

    AlbukhrMarketplace.getMostInvestedProjects =
        getMostInvestedProjects;

    AlbukhrMarketplace.getSafestProjects =
        getSafestProjects;

    AlbukhrMarketplace.getMarketLeaderboard =
        getMarketLeaderboard;

    AlbukhrMarketplace.searchMarketProjects =
        searchMarketProjects;

    AlbukhrMarketplace.getProjectDiscoveryScore =
        getProjectDiscoveryScore;

    AlbukhrMarketplace.getDiscoveryProjects =
        getDiscoveryProjects;

    AlbukhrMarketplace.getTrendingProjects =
        getTrendingProjects;

    AlbukhrMarketplace.getFeaturedProjects =
        getFeaturedProjects;

    AlbukhrMarketplace.getHotProjects =
        getHotProjects;

    AlbukhrMarketplace.getNewestProjects =
        getNewestProjects;

    AlbukhrMarketplace.getDiscoveryDashboard =
        getDiscoveryDashboard;

    AlbukhrMarketplace.refreshDiscovery =
        refreshDiscovery;

    AlbukhrMarketplace.refreshMarketRanking =
        refreshMarketRanking;

    AlbukhrMarketplace.refreshTreasury =
        refreshTreasury;

    AlbukhrMarketplace.getInvestmentRecommendations =
        getInvestmentRecommendations;

    /* =====================================================
       INVESTMENT DELEGATION
    ===================================================== */

    AlbukhrMarketplace.invest = async function (payload) {
        if (
            !window.AlbukhrEcosystem ||
            typeof window.AlbukhrEcosystem.invest !== "function"
        ) {
            throw new Error(
                "ALBUKHR investment engine is unavailable."
            );
        }

        if (!payload || !payload.project) {
            throw new Error("Project is required.");
        }

        const project = await getProject(payload.project);

        if (!project) {
            throw new Error("Project not found.");
        }

        const amount = safeNumber(payload.amount);

        const minimum = safeNumber(
            project.minimum ??
            project.min_stake ??
            project.minStake ??
            1
        );

        if (amount < minimum) {
            throw new Error(
                `Minimum investment is ${minimum} Pi.`
            );
        }

        return window.AlbukhrEcosystem.invest({
            ...payload,
            project: projectCode(project),
            amount
        });
    };

    window.AlbukhrMarketplace = AlbukhrMarketplace;

    /* =====================================================
       GLOBAL COMPATIBILITY EXPORTS
    ===================================================== */

    Object.assign(window, {
        getProjects,
        getActiveProjects,
        getAllProjects,
        getProject,
        getProjectLiquidity,
        getProjectTreasuryStatus,
        getProjectTreasuryHistory,
        getAllTreasury,
        refreshTreasury,

        getProjectRisk,
        calculateProjectROI,

        getEconomicMetrics,
        getEconomicIntelligence,
        getLiquidityPriority,
        getTopProfitProjects,
        getHighRiskProjects,
        getStrongestProjects,
        getInvestmentRecommendations,

        getProjectMetrics,
        getMarketMetrics,
        getTopROIProjects,
        getHighestLiquidityProjects,
        getMostInvestedProjects,
        getSafestProjects,
        getMarketLeaderboard,
        getMarketSummary,
        searchMarketProjects,
        refreshMarketRanking,

        getProjectDiscoveryScore,
        getDiscoveryProjects,
        getTrendingProjects,
        getFeaturedProjects,
        getHotProjects,
        getNewestProjects,
        sortByDiscovery,
        getDiscoveryDashboard,
        refreshDiscovery
    });

    /* =====================================================
       MARKETPLACE UI HELPERS
       ===================================================== */

    window.AlbukhrMarketplaceUI = {

        escapeHTML(value) {
            return String(value ?? "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        },

        getProjectByCode(list, code) {
            return findProject(list, code);
        },

        calculateROI(amount, roi) {
            return (
                safeNumber(amount) *
                safeNumber(roi) /
                100
            ).toFixed(2);
        },

        async invest(payload) {
            return AlbukhrMarketplace.invest(payload);
        }
    };

    console.info(
        `ALBUKHR Marketplace Engines loaded (${network()}).`
    );

})(window);
