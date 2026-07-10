/* =========================================
   ALBUKHR MARKET RANKING ENGINE v2
   Testnet → Mainnet Ready
========================================= */

(function(window){

"use strict";

/* =========================================
   CACHE
========================================= */

let rankingCache = [];
let lastUpdate = 0;

const CACHE_TIME = 10000;

/* =========================================
   HELPERS
========================================= */

function safeNumber(value){
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

/* =========================================
   PROJECT METRICS
========================================= */

async function getProjectMetrics(projectCode){

    const project =
        await getProject(projectCode);

    if(!project){
        return null;
    }

    const treasury =
        typeof getProjectTreasuryStatus === "function"
        ? await getProjectTreasuryStatus(projectCode)
        : {};

    const totals =
        typeof getProjectTotals === "function"
        ? await getProjectTotals(projectCode)
        : {
            stake:0,
            reward:0,
            stakes:[]
        };

    const risk =
        typeof getProjectRisk === "function"
        ? await getProjectRisk(projectCode)
        : {
            score:0,
            risk:"LOW"
        };

    return{

        code:project.project_code,

        title:project.project_name,

        type:project.project_type,

        liquidity:
            safeNumber(treasury?.liquidity),

        investors:
            totals.stakes.length,

        totalStake:
            safeNumber(totals.stake),

        totalReward:
            safeNumber(totals.reward),

        roi:
            safeNumber(project.reward_rate),

        riskScore:
            safeNumber(risk.score),

        riskLevel:
            risk.risk || "LOW"

    };

}

/* =========================================
   MARKET METRICS
========================================= */

async function getMarketMetrics(force=false){

    const now = Date.now();

    if(
        !force &&
        rankingCache.length &&
        (now-lastUpdate)<CACHE_TIME
    ){
        return rankingCache;
    }

    const projects =
        await getProjects();

    const list = [];

    for(const project of projects){

        const metrics =
            await getProjectMetrics(
                project.project_code
            );

        if(metrics){
            list.push(metrics);
        }

    }

    rankingCache = list;
    lastUpdate = now;

    return list;

}

window.getProjectMetrics =
    getProjectMetrics;

window.getMarketMetrics =
    getMarketMetrics;

})(window);

/* =========================================
   TOP ROI
========================================= */

async function getTopROIProjects(limit = 5){

    const list = await getMarketMetrics();

    return [...list]
        .sort((a,b)=>
            b.roi - a.roi
        )
        .slice(0,limit);

}

/* =========================================
   HIGHEST LIQUIDITY
========================================= */

async function getHighestLiquidityProjects(limit = 5){

    const list = await getMarketMetrics();

    return [...list]
        .sort((a,b)=>
            b.liquidity - a.liquidity
        )
        .slice(0,limit);

}

/* =========================================
   MOST INVESTORS
========================================= */

async function getMostInvestedProjects(limit = 5){

    const list = await getMarketMetrics();

    return [...list]
        .sort((a,b)=>
            b.investors - a.investors
        )
        .slice(0,limit);

}

/* =========================================
   SAFEST PROJECTS
========================================= */

async function getSafestProjects(limit = 5){

    const list = await getMarketMetrics();

    return [...list]
        .sort((a,b)=>
            a.riskScore - b.riskScore
        )
        .slice(0,limit);

}

/* =========================================
   MARKET LEADERBOARD
========================================= */

async function getMarketLeaderboard(
    sort = "default"
){

    const list =
        await getMarketMetrics();

    const data = [...list];

    switch(String(sort).toLowerCase()){

        case "roi":

            data.sort((a,b)=>
                b.roi - a.roi
            );

            break;

        case "liquidity":

            data.sort((a,b)=>
                b.liquidity - a.liquidity
            );

            break;

        case "investors":

            data.sort((a,b)=>
                b.investors - a.investors
            );

            break;

        case "risk":

            data.sort((a,b)=>
                a.riskScore - b.riskScore
            );

            break;

        default:

            data.sort((a,b)=>
                a.title.localeCompare(
                    b.title
                )
            );

    }

    return data;

}

/* =========================================
   MARKET SUMMARY
========================================= */

async function getMarketSummary(){

    const list =
        await getMarketMetrics();

    let totalLiquidity = 0;
    let totalStake = 0;
    let totalInvestors = 0;
    let totalROI = 0;
    let totalRisk = 0;

    for(const item of list){

        totalLiquidity +=
            safeNumber(item.liquidity);

        totalStake +=
            safeNumber(item.totalStake);

        totalInvestors +=
            safeNumber(item.investors);

        totalROI +=
            safeNumber(item.roi);

        totalRisk +=
            safeNumber(item.riskScore);

    }

    return{

        projects:
            list.length,

        liquidity:
            totalLiquidity,

        stake:
            totalStake,

        investors:
            totalInvestors,

        averageROI:

            list.length

            ? totalROI / list.length

            : 0,

        averageRisk:

            list.length

            ? totalRisk / list.length

            : 0

    };

}

/* =========================================
   REFRESH
========================================= */

async function refreshMarketRanking(){

    rankingCache = [];

    lastUpdate = 0;

    return await getMarketMetrics(true);

}

/* =========================================
   SEARCH
========================================= */

async function searchMarketProjects(keyword=""){

    const search =
        String(keyword)
        .trim()
        .toLowerCase();

    const list =
        await getMarketMetrics();

    if(!search){

        return list;

    }

    return list.filter(project=>{

        return(

            String(project.code)
            .toLowerCase()
            .includes(search)

            ||

            String(project.title)
            .toLowerCase()
            .includes(search)

            ||

            String(project.type)
            .toLowerCase()
            .includes(search)

        );

    });

}

/* =========================================
   EXPORTS
========================================= */

window.getTopROIProjects =
    getTopROIProjects;

window.getHighestLiquidityProjects =
    getHighestLiquidityProjects;

window.getMostInvestedProjects =
    getMostInvestedProjects;

window.getSafestProjects =
    getSafestProjects;

window.getMarketLeaderboard =
    getMarketLeaderboard;

window.getMarketSummary =
    getMarketSummary;

window.searchMarketProjects =
    searchMarketProjects;

window.refreshMarketRanking =
    refreshMarketRanking;

