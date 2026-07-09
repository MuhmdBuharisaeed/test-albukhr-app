/* =========================================================
   ALBUKHR MARKETPLACE DATA ENGINE
   Testnet → Mainnet Bridge
   Version 1.0
========================================================= */

(function(){

"use strict";

/* =========================================================
   CACHE
========================================================= */

let marketplaceCache = [];

let lastRefresh = 0;

const CACHE_TIME = 10000;

/* =========================================================
   HELPERS
========================================================= */

function safe(fn,fallback){

try{

return fn();

}catch(e){

console.warn(e);

return fallback;

}

}

function normalizeNumber(value){

const n = Number(value);

return isNaN(n) ? 0 : n;

}

function normalizeText(value){

return String(value || "").trim();

}

/* =========================================================
   PUBLIC API
========================================================= */

window.AlbukhrMarketplace = {

refresh,

getProjects,

getProject,

getStats,

search,

sort,

filter

};

})();

/* =========================================================
   REFRESH MARKETPLACE
========================================================= */

async function refresh(force=false){

const now = Date.now();

if(

!force &&

marketplaceCache.length &&

(now-lastRefresh)<CACHE_TIME

){

return marketplaceCache;

}

let projects=[];

/* -----------------------------------------
   LOAD PROJECTS ENGINE
------------------------------------------ */

try{

if(typeof getProjects==="function"){

projects = await getProjects();

}

}catch(e){

console.warn(

"Projects Engine",

e

);

}

/* -----------------------------------------
   FALLBACK
------------------------------------------ */

if(

!Array.isArray(projects)

||

projects.length===0

){

projects = safe(()=>{

if(typeof PROJECT_CONFIG!=="object"){

return [];

}

return Object.keys(PROJECT_CONFIG).map(key=>({

project_code:key,

project_name:

PROJECT_CONFIG[key]?.title||key,

description:

PROJECT_CONFIG[key]?.desc||"",

icon:

PROJECT_CONFIG[key]?.icon||"📦",

category:

PROJECT_CONFIG[key]?.category||"General",

roi:

normalizeNumber(

PROJECT_CONFIG[key]?.roi

),

minimum:

normalizeNumber(

PROJECT_CONFIG[key]?.minimum

),

duration:

PROJECT_CONFIG[key]?.duration||"--"

}));

},[]);

}

/* -----------------------------------------
   ENRICH PROJECTS
------------------------------------------ */

marketplaceCache = projects.map(project=>{

const code =

normalizeText(

project.project_code ||

project.code ||

project.name

);

const treasury =

safe(

()=>getProjectTreasuryStatus(code),

{}

);

const risk =

safe(

()=>getProjectRisk(code),

{

risk:"LOW",

score:0

}

);

const pool =

safe(

()=>getPoolStatus(code),

{}

);

const minimum =

safe(

()=>getMinStake(code),

project.minimum||1

);

const investors =

safe(()=>{

if(typeof getAllStakesMerged!=="function"){

return 0;

}

const stakes=

getAllStakesMerged()||[];

return stakes.filter(s=>{

return normalizeText(

s.project

)===code;

}).length;

},0);

const liquidity =

normalizeNumber(

treasury.liquidity ||

pool.liquidity ||

0

);

const target =

normalizeNumber(

project.target ||

1000

);

const funded =

target>0

?

Math.min(

(liquidity/target)*100,

100

)

:

0;

return{

...project,

project_code:code,

liquidity,

target,

funded,

minimum,

investors,

risk,

treasury,

pool

};

});

lastRefresh = Date.now();

return marketplaceCache;

  }

/* =========================================================
   GET ALL PROJECTS
========================================================= */

async function getProjects(force=false){

return await refresh(force);

}

/* =========================================================
   GET SINGLE PROJECT
========================================================= */

async function getProject(projectCode){

const projects =

await refresh();

const code =

normalizeText(projectCode);

return (

projects.find(p=>

normalizeText(

p.project_code

)===code

)

||

null

);

}

/* =========================================================
   MARKETPLACE STATS
========================================================= */

async function getStats(){

const projects =

await refresh();

let totalLiquidity=0;

let totalInvestors=0;

let totalROI=0;

projects.forEach(project=>{

totalLiquidity+=

normalizeNumber(

project.liquidity

);

totalInvestors+=

normalizeNumber(

project.investors

);

totalROI+=

normalizeNumber(

project.roi

);

});

return{

projects:

projects.length,

liquidity:

totalLiquidity,

investors:

totalInvestors,

averageROI:

projects.length

?

totalROI/projects.length

:

0

};

}

/* =========================================================
   SEARCH
========================================================= */

async function search(keyword=""){

const projects=

await refresh();

const query=

normalizeText(keyword)

.toLowerCase();

if(!query){

return projects;

}

return projects.filter(project=>{

return(

normalizeText(

project.project_name

)

.toLowerCase()

.includes(query)

||

normalizeText(

project.description

)

.toLowerCase()

.includes(query)

||

normalizeText(

project.category

)

.toLowerCase()

.includes(query)

);

});

}

/* =========================================================
   FILTER
========================================================= */

async function filter(callback){

const projects=

await refresh();

if(typeof callback!=="function"){

return projects;

}

return projects.filter(callback);

}

/* =========================================================
   SORT
========================================================= */

async function sort(compareFn){

const projects=

await refresh();

const cloned=[...projects];

if(typeof compareFn==="function"){

cloned.sort(compareFn);

}

return cloned;

}
