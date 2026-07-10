/* =========================================================
   ALBUKHR MARKETPLACE DATA ENGINE v2
========================================================= */

(function(window){

"use strict";

const AlbukhrMarketplace = {};

window.AlbukhrMarketplace = AlbukhrMarketplace;

/* =========================================================
   CACHE
========================================================= */

let cache = [];
let lastRefresh = 0;
const CACHE_TIME = 10000;

/* =========================================================
   HELPERS
========================================================= */

function toNumber(value){

const n = Number(value);

return Number.isFinite(n) ? n : 0;

}

function normalize(text){

return String(text || "").trim();

}

/* =========================================================
   GET PROJECTS
========================================================= */

AlbukhrMarketplace.getProjects = async function(options={}){

const forceRefresh =
options.forceRefresh === true;

const now = Date.now();

if(
!forceRefresh &&
cache.length &&
(now-lastRefresh)<CACHE_TIME
){
return cache;
}

let projects = [];

try{

if(typeof getActiveProjects==="function"){

projects =
await getActiveProjects();

}
else if(typeof getAllProjects==="function"){

projects =
await getAllProjects();

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

cache = projects.map(project=>({

key:
normalize(project.project_code),

code:
normalize(project.project_code),

title:
normalize(project.project_name),

icon:
project.icon || "📦",

description:
project.description || "",

category:
project.project_type || "General",

project_type:
project.project_type || "core",

roi:
toNumber(project.reward_rate)*100,

minimum:
toNumber(project.min_liquidity),

durations:
project.durations || [30,60,90],

status:
project.status || "active",

sortOrder:
toNumber(project.sort_order)

}));

lastRefresh = now;

return cache;

};

})(window);

/* =========================================================
   GET MARKETPLACE
========================================================= */

AlbukhrMarketplace.getMarketplace =
async function(options={}){

const projects =
await AlbukhrMarketplace.getProjects(options);

let stakes = [];

try{

if(typeof getGlobalStakes==="function"){

stakes =
await getGlobalStakes();

}

}catch(error){

console.error(
"Stake Engine:",
error
);

stakes=[];

}

const result = [];

for(const project of projects){

const projectStakes =

stakes.filter(s=>

String(s.project).trim().toLowerCase()===

String(project.key).trim().toLowerCase()

&&

s.type==="stake"

&&

s.status==="paid"

);

const liquidity =
projectStakes.reduce(

(total,s)=>

total + (Number(s.amount)||0),

0

);

const investors =
new Set(

projectStakes.map(s=>s.userid)

).size;

result.push({

...project,

liquidity,

investors,

totalStake:liquidity,

totalReward:
projectStakes.reduce(

(total,s)=>

total + (Number(s.reward)||0),

0

)

});

}

return result;

};

/* =========================================================
   REFRESH MARKETPLACE
========================================================= */

AlbukhrMarketplace.refresh =
async function(){

cache = [];

lastRefresh = 0;

return await AlbukhrMarketplace.getMarketplace({

forceRefresh:true

});

};

/* =========================================================
   SEARCH PROJECTS
========================================================= */

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

/* =========================================================
   MARKET SUMMARY
========================================================= */

AlbukhrMarketplace.summary =
async function(){

const projects =
await AlbukhrMarketplace.getMarketplace();

let totalLiquidity = 0;
let totalInvestors = 0;
let totalStake = 0;
let totalReward = 0;

projects.forEach(project=>{

totalLiquidity +=
Number(project.liquidity)||0;

totalInvestors +=
Number(project.investors)||0;

totalStake +=
Number(project.totalStake)||0;

totalReward +=
Number(project.totalReward)||0;

});

return{

projects:projects.length,

liquidity:totalLiquidity,

investors:totalInvestors,

stake:totalStake,

reward:totalReward

};

};

/* =========================================================
   GET SINGLE PROJECT
========================================================= */

AlbukhrMarketplace.getProject =
async function(projectCode){

if(!projectCode){

return null;

}

const projects =
await AlbukhrMarketplace.getMarketplace();

return projects.find(project=>

String(project.key)
.toLowerCase()

===

String(projectCode)
.toLowerCase()

) || null;

};

/* =========================================================
   HOT PROJECTS
========================================================= */

window.getHotProjects =
async function(limit=5){

const projects =
await AlbukhrMarketplace.getMarketplace();

return [...projects]

.sort((a,b)=>

(Number(b.investors)||0)-

(Number(a.investors)||0)

)

.slice(0,limit);

};

/* =========================================================
   LIQUIDITY LEADERBOARD
========================================================= */

window.getLiquidityLeaderboard =
async function(limit=5){

const projects =
await AlbukhrMarketplace.getMarketplace();

return [...projects]

.sort((a,b)=>

(Number(b.liquidity)||0)-

(Number(a.liquidity)||0)

)

.slice(0,limit);

};

/* =========================================================
   TOP INVESTORS
========================================================= */

window.getTopInvestors =
async function(limit=10){

let stakes=[];

try{

stakes =
await getGlobalStakes();

}catch(e){

console.error(e);

return [];

}

const users = {};

stakes.forEach(stake=>{

if(

stake.type!=="stake"

||

stake.status!
