/* =========================================================
   ALBUKHR MARKETPLACE DATA ENGINE
   Version 1.0
   Testnet → Mainnet Ready
========================================================= */

(function(window){

"use strict";

/* =========================================================
   ENGINE
========================================================= */

const AlbukhrMarketplace = {};

/* =========================================================
   CACHE
========================================================= */

let marketplaceCache = [];

let lastRefresh = 0;

const CACHE_TIME = 10000;

/* =========================================================
   HELPERS
========================================================= */

function normalizeText(value){

return String(

value || ""

).trim();

}

function normalizeNumber(value){

const number = Number(value);

return Number.isFinite(number)

? number

: 0;

}

function safe(callback,fallback=null){

try{

return callback();

}catch(error){

console.warn(error);

return fallback;

}

}

/* =========================================================
   PUBLIC ENGINE
========================================================= */

window.AlbukhrMarketplace =
AlbukhrMarketplace;

})(window);

/* =========================================================
   LOAD MARKETPLACE PROJECTS
========================================================= */

AlbukhrMarketplace.getProjects =
async function(forceRefresh=false){

const now = Date.now();

/* ============================
   CACHE
============================ */

if(

!forceRefresh &&

marketplaceCache.length &&

(now-lastRefresh)<CACHE_TIME

){

return marketplaceCache;

}

/* ============================
   LOAD PROJECTS
============================ */

let projects=[];

/* ---------- SOURCE 1 ---------- */

if(typeof loadMarketplaceProjects==="function"){

try{

projects =
await loadMarketplaceProjects();

}catch(error){

console.error(

"Marketplace Loader",

error

);

}

}

/* ---------- SOURCE 2 ---------- */

if(

(!projects || !projects.length)

&&

typeof getMarketplaceProjects==="function"

){

try{

projects =
await getMarketplaceProjects();

}catch(error){

console.error(

"Marketplace Projects",

error

);

}

}

/* ---------- SOURCE 3 ---------- */

if(

(!projects || !projects.length)

&&

typeof fetchMarketplaceProjects==="function"

){

try{

projects =
await fetchMarketplaceProjects();

}catch(error){

console.error(

"Marketplace Fetch",

error

);

}

}

/* ---------- EMPTY ---------- */

if(!Array.isArray(projects)){

projects=[];

}

marketplaceCache = projects;

lastRefresh = now;

return marketplaceCache;

};

/* ==========================================
   LOAD MARKETPLACE PROJECTS
========================================== */

AlbukhrMarketplace.getProjects = async function(options={}){

const activeOnly =
options.activeOnly !== false;

const forceRefresh =
options.forceRefresh === true;

let projects = [];

try{

if(typeof getActiveProjects==="function"){

projects = await getActiveProjects({
forceRefresh
});

}else if(typeof getAllProjects==="function"){

projects = await getAllProjects({
forceRefresh
});

}else if(typeof getProjects==="function"){

projects = await getProjects({
forceRefresh
});

}

}catch(error){

console.error(
"Projects Engine:",
error
);

projects=[];

}

if(!Array.isArray(projects)){

projects=[];

}

const result=[];

for(const project of projects){

const code =
project.project_code;

result.push({

key:code,

code:code,

title:
project.project_name,

roi:
(project.reward_rate || 0) * 100,

name:
project.project_name,

icon:
project.icon || "📦",

description:
project.description || "",

info:
project.info || "",

type:
project.project_type || "core",

status:
project.status || "active",

category:
project.project_type || "core",

durations:
project.durations || [30,60,90],

minimum:
project.min_liquidity || 100,

rewardRate:
project.reward_rate || 0,

reserve:
project.reserve_percent || 0,

treasuryEnabled:
project.treasury_enabled !== false,

stakingEnabled:
project.staking_enabled !== false,

contributionsEnabled:
project.contributions_enabled !== false,

sortOrder:
project.sort_order || 9999,

raw:project

});

}

marketplaceCache = result;

lastRefresh = Date.now();

return marketplaceCache;

};

/* ==========================================
   GET SINGLE MARKETPLACE PROJECT
========================================== */

AlbukhrMarketplace.getProject =
async function(projectCode){

if(!projectCode){

return null;

}

const projects =
await AlbukhrMarketplace.getProjects();

const project =
projects.find(

p=>String(p.code).trim().toLowerCase()===

String(projectCode).trim().toLowerCase()

);

if(!project){

return null;

}

/* ===========================
   TREASURY
=========================== */

const treasury =

typeof getProjectTreasuryStatus==="function"

?

getProjectTreasuryStatus(project.code)

:{};

/* ===========================
   STAKING
=========================== */

let totals={

stake:0,

reward:0,

stakes:[]

};

if(typeof getProjectTotals==="function"){

try{

totals =

await getProjectTotals(

project.code

);

}catch(error){

console.warn(error);

}

}

/* ===========================
   RISK
=========================== */

const risk =

typeof getProjectRisk==="function"

?

getProjectRisk(project.code)

:{

risk:"LOW",

score:0

};

/* ===========================
   POOL
=========================== */

const pool =

typeof getPoolStatus==="function"

?

getPoolStatus(project.code)

:{

liquidity:0

};

/* ===========================
   RETURN
=========================== */

return{

...project,

treasury,

pool,

risk,

totals,

liquidity:

Number(

treasury?.liquidity

)||0,

investors:

Array.isArray(

totals.stakes

)

?

totals.stakes.length

:0,

totalStake:

Number(

totals.stake

)||0,

totalReward:

Number(

totals.reward

)||0

};

};

/* ==========================================
   GET MARKETPLACE LIST
========================================== */

AlbukhrMarketplace.getMarketplace =
async function(options={}){

const projects =
await AlbukhrMarketplace.getProjects(options);

const marketplace = [];

for(const project of projects){

const fullProject =

await AlbukhrMarketplace.getProject(

project.code

);

if(fullProject){

marketplace.push(fullProject);

}

}

/* ===========================
   SORT
=========================== */

const sort =

String(options.sort || "")

.toLowerCase();

if(sort==="roi"){

marketplace.sort(

(a,b)=>

(b.rewardRate||0)-

(a.rewardRate||0)

);

}

else if(sort==="liquidity"){

marketplace.sort(

(a,b)=>

(b.liquidity||0)-

(a.liquidity||0)

);

}

else if(sort==="investors"){

marketplace.sort(

(a,b)=>

(b.investors||0)-

(a.investors||0)

);

}

else if(sort==="risk"){

marketplace.sort(

(a,b)=>

(a.risk?.score||0)-

(b.risk?.score||0)

);

}

else{

marketplace.sort(

(a,b)=>

(a.sortOrder||9999)-

(b.sortOrder||9999)

);

}

return marketplace;

};

/* ==========================================
   REFRESH MARKETPLACE CACHE
========================================== */

AlbukhrMarketplace.refresh =
async function(){

marketplaceCache = [];

lastRefresh = 0;

await AlbukhrMarketplace.getProjects({

forceRefresh:true

});

return await AlbukhrMarketplace.getMarketplace();

};

/* ==========================================
   SEARCH PROJECTS
========================================== */

AlbukhrMarketplace.search =
async function(keyword=""){

const projects =
await AlbukhrMarketplace.getMarketplace();

const search =
String(keyword)
.trim()
.toLowerCase();

if(!search){

return projects;

}

return projects.filter(project=>{

return(

String(project.title)
.toLowerCase()
.includes(search)

||

String(project.code)
.toLowerCase()
.includes(search)

||

String(project.description)
.toLowerCase()
.includes(search)

||

String(project.category)
.toLowerCase()
.includes(search)

);

});

};

/* ==========================================
   MARKET SUMMARY
========================================== */

AlbukhrMarketplace.summary =
async function(){

const projects =
await AlbukhrMarketplace.getMarketplace();

let totalLiquidity = 0;
let totalInvestors = 0;
let totalStake = 0;

projects.forEach(project=>{

totalLiquidity +=
Number(project.liquidity)||0;

totalInvestors +=
Number(project.investors)||0;

totalStake +=
Number(project.totalStake)||0;

});

return{

projects:
projects.length,

liquidity:
totalLiquidity,

investors:
totalInvestors,

stake:
totalStake

};

};

window.getHotProjects = async function(){

const projects =
await AlbukhrMarketplace.getMarketplace();

return [...projects]
.sort((a,b)=>
(b.investors||0)-
(a.investors||0)
)
.slice(0,5);

};

window.getLiquidityLeaderboard =
async function(){

const projects =
await AlbukhrMarketplace.getMarketplace();

return [...projects]
.sort((a,b)=>
(b.liquidity||0)-
(a.liquidity||0)
);

};

window.getTopInvestors =
async function(){

const stakes =
await getGlobalStakes();

const map = {};

stakes.forEach(s=>{

const id =
s.userid || "Unknown";

map[id] =
(map[id]||0)+
Number(s.amount||0);

});

return Object.entries(map)
.map(([user,amount])=>({
user,
amount
}))
.sort((a,b)=>b.amount-a.amount)
.slice(0,10);

};
