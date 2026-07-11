/* =========================================
   ALBUKHR ECOSYSTEM ENGINE v2
   Single Source Of Truth
   Powered by getAllStakesMerged()
========================================= */

(function(window){

"use strict";

const AlbukhrEcosystem = {};

window.AlbukhrEcosystem = AlbukhrEcosystem;

/* =========================================
   CACHE
========================================= */

const CACHE = {

loaded:false,

loading:false,

lastUpdate:0,

stakes:[],

projects:[],

summary:{},

topInvestors:[],

hotProjects:[],

liquidityLeaders:[]

};

const CACHE_TIME = 10000;

/* =========================================
   LOAD
========================================= */

AlbukhrEcosystem.load = async function(force=false){

const now = Date.now();

if(

!force &&

CACHE.loaded &&

(now-CACHE.lastUpdate)<CACHE_TIME

){

return CACHE;

}

if(CACHE.loading){

return CACHE;

}

CACHE.loading = true;

try{

const stakes =
await getAllStakesMerged();

CACHE.stakes =

Array.isArray(stakes)

? stakes

: [];

buildProjects();

buildSummary();

buildTopInvestors();

buildRankings();

CACHE.loaded = true;

CACHE.lastUpdate = now;

catch(error){

console.error("Ecosystem Load Error:", error);

throw error;

}

CACHE.loading = false;

return CACHE;

};

function buildProjects(){

const map = {};

CACHE.stakes.forEach(stake=>{

const name =
String(

stake.project ||

"Unknown"

).trim();

if(!map[name]){

const meta = resolveProject(name);

map[name]={

...meta,

investors:new Set(),

liquidity:0,

reward:0,

records:0,

stakes:[]

};

}

const project =

map[name];

project.records++;

project.stakes.push(stake);

project.investors.add(

stake.userid ||

stake.wallet ||

"unknown"

);

project.liquidity +=

Number(stake.amount)||0;

project.reward +=

Number(stake.reward)||0;

});

CACHE.projects =

Object.values(map).map(project=>{

project.investors =

project.investors.size;

return project;

});

}

/* =========================================
   BUILD SUMMARY
========================================= */

function buildSummary(){

let portfolio = 0;

let invested = 0;

let earnings = 0;

CACHE.projects.forEach(project=>{

invested +=
Number(project.liquidity)||0;

earnings +=
Number(project.reward)||0;

});

portfolio =

invested + earnings;

CACHE.summary = {

portfolio,

invested,

earnings,

projects:CACHE.projects.length,

records:CACHE.stakes.length

};

   }

 /* =========================================
   TOP INVESTORS
========================================= */

function buildTopInvestors(){

const map = {};

CACHE.stakes.forEach(stake=>{

const user =

stake.userid ||

stake.wallet ||

"Unknown";

map[user] =

(map[user]||0)+

(Number(stake.amount)||0);

});

CACHE.topInvestors =

Object.entries(map)

.map(([user,amount])=>({

user,

amount

}))

.sort((a,b)=>

b.amount-a.amount

)

.slice(0,10);

}

/* =========================================
   PROJECT RANKINGS
========================================= */

function buildRankings(){

CACHE.hotProjects =

[...CACHE.projects]

.sort((a,b)=>

b.investors-a.investors

)

.slice(0,5);

CACHE.liquidityLeaders =

[...CACHE.projects]

.sort((a,b)=>

b.liquidity-a.liquidity

)

.slice(0,5);

/* Featured */

CACHE.featured =

CACHE.hotProjects[0] ||

CACHE.projects[0] ||

null;

}

/* =========================================
   RESOLVE PROJECT METADATA
========================================= */

function resolveProject(projectName){

let core = null;

if(typeof getCoreProjectByName === "function"){

    core = getCoreProjectByName(projectName);

}

if(!core){

    return{

        code:projectName,

        title:projectName,

        icon:"📦",

        category:"Project",

        description:"",

        roi:0,

        minimum:1,

        target:1000,

        type:"community"

    };

}

return{

    code:projectName,

    title:core.title,

    icon:core.icon,

    category:core.sector,

    description:core.description,

    roi:core.roi,

    minimum:core.minimum,

    target:core.target,

    type:"core"

};

}

/* =========================================
   MARKETPLACE API
========================================= */

AlbukhrEcosystem.marketplace =
async function(forceRefresh=false){

    await AlbukhrEcosystem.load(forceRefresh);

    return{

        projects:[...CACHE.projects],

        summary:{...CACHE.summary},

        featured:CACHE.featured,

        hotProjects:[...CACHE.hotProjects],

        liquidityLeaders:[...CACHE.liquidityLeaders],

        topInvestors:[...CACHE.topInvestors]

    };

};

/* =========================================
   DASHBOARD API
========================================= */

AlbukhrEcosystem.dashboard =
async function(forceRefresh=false){

    await AlbukhrEcosystem.load(forceRefresh);

    return{

        portfolio:CACHE.summary.portfolio,

        invested:CACHE.summary.invested,

        earnings:CACHE.summary.earnings,

        totalProjects:CACHE.summary.projects,

        totalRecords:CACHE.summary.records,

        projects:[...CACHE.projects]

    };

};

/* =========================================
   PROJECT API
========================================= */

AlbukhrEcosystem.project =
async function(projectCode){

    await AlbukhrEcosystem.load();

    return CACHE.projects.find(project=>{

        return String(project.code)
        .trim()
        .toLowerCase()

        ===

        String(projectCode)
        .trim()
        .toLowerCase();

    }) || null;

};

/* =========================================
   SUMMARY API
========================================= */

AlbukhrEcosystem.summary =
async function(){

    await AlbukhrEcosystem.load();

    return{

        ...CACHE.summary

    };

};

/* =========================================
   REFRESH API
========================================= */

AlbukhrEcosystem.refresh =
async function(){

    CACHE.loaded = false;

    CACHE.lastUpdate = 0;

    return await AlbukhrEcosystem.load(true);

};

/* =========================================
   SEARCH API
========================================= */

AlbukhrEcosystem.search =
async function(keyword=""){

    await AlbukhrEcosystem.load();

    keyword = String(keyword)
    .trim()
    .toLowerCase();

    if(!keyword){

        return [...CACHE.projects];

    }

    return CACHE.projects.filter(project=>{

        return(

            project.title.toLowerCase().includes(keyword)

            ||

            project.description.toLowerCase().includes(keyword)

            ||

            project.category.toLowerCase().includes(keyword)

        );

    });

};

/* =========================================
   RANKING API
========================================= */

AlbukhrEcosystem.rankings =
async function(){

    await AlbukhrEcosystem.load();

    return{

        featured:CACHE.featured,

        hotProjects:[...CACHE.hotProjects],

        liquidityLeaders:[...CACHE.liquidityLeaders],

        topInvestors:[...CACHE.topInvestors]

    };

};

/* =========================================
   CURRENT USER
========================================= */

AlbukhrEcosystem.currentUser = function(){

    try{

        return JSON.parse(
            localStorage.getItem("pi_user")
        ) || null;

    }catch{

        return null;

    }

};

/* =========================================
   MY STAKES
========================================= */

AlbukhrEcosystem.myStakes =
async function(forceRefresh=false){

    await AlbukhrEcosystem.load(forceRefresh);

    const user =
    AlbukhrEcosystem.currentUser();

    if(!user){

        return [];

    }

    return CACHE.stakes.filter(stake=>{

        return stake.userid === user.uid;

    });

};

/* =========================================
   MY PORTFOLIO
========================================= */

AlbukhrEcosystem.myPortfolio =
async function(forceRefresh=false){

    const stakes =
    await AlbukhrEcosystem.myStakes(forceRefresh);

    let invested = 0;

    let earnings = 0;

    let projects = new Set();

    stakes.forEach(stake=>{

        const amount =
        Number(stake.amount)||0;

        const reward =
        Number(stake.reward)||0;

        const withdrawn =
        Number(stake.withdrawnReward)||0;

        invested += amount;

        earnings += Math.max(
            0,
            reward-withdrawn
        );

        projects.add(stake.project);

    });

    return{

        invested,

        earnings,

        portfolio:

        invested + earnings,

        totalProjects:

        projects.size,

        records:

        stakes.length

    };

};

/* =========================================
   MY PROJECTS
========================================= */

AlbukhrEcosystem.myProjects =
async function(forceRefresh=false){

    const stakes =
    await AlbukhrEcosystem.myStakes(forceRefresh);

    const map = {};

    stakes.forEach(stake=>{

        const code =
        String(stake.project).trim();

        if(!map[code]){

            map[code]={

                ...resolveProject(code),

                invested:0,

                earnings:0,

                records:0,

                stakes:[]

            };

        }

        map[code].invested +=
        Number(stake.amount)||0;

        map[code].earnings +=
        Math.max(

            0,

            (Number(stake.reward)||0)

            -

            (Number(stake.withdrawnReward)||0)

        );

        map[code].records++;

        map[code].stakes.push(stake);

    });

    return Object.values(map);

};

/* =========================================
   INVESTOR DASHBOARD API
========================================= */

AlbukhrEcosystem.investorDashboard =
async function(forceRefresh=false){

    const portfolio =
    await AlbukhrEcosystem.myPortfolio(forceRefresh);

    const projects =
    await AlbukhrEcosystem.myProjects();

    return{

        ...portfolio,

        projects

    };

};
})(window);
