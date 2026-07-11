/* =========================================
   ALBUKHR CORE PROJECT ENGINE v2
   Testnet • Mainnet Ready
========================================= */

(function(window){

"use strict";

const CoreProjects = {};

window.CoreProjects = CoreProjects;

let cache = [];

let lastRefresh = 0;

const CACHE_TIME = 10000;

 /* =========================================
   LOAD CORE PROJECTS
========================================= */

CoreProjects.getAll =
async function(forceRefresh=false){

const now = Date.now();

if(

!forceRefresh &&
cache.length &&
(now-lastRefresh)<CACHE_TIME

){

return cache;

}

let projects=[];

if(

window.AlbukhrMarketplace &&
typeof AlbukhrMarketplace.getProjects==="function"

){

projects =
await AlbukhrMarketplace.getProjects({
forceRefresh
});

}

projects = projects.filter(p=>

String(p.type||p.project_type)

.toLowerCase()

==="core"

);

cache = projects;

lastRefresh = now;

return cache;

};

/* =========================================
   GET PROJECT
========================================= */

CoreProjects.get =
async function(code){

const projects =
await CoreProjects.getAll();

return projects.find(p=>

String(p.code)

.toLowerCase()

===

String(code)

.toLowerCase()

) || null;

};

/* =========================================
   EXISTS
========================================= */

CoreProjects.exists =
async function(code){

return !!(

await CoreProjects.get(code)

);

};

/* =========================================
   COUNT
========================================= */

CoreProjects.count =
async function(){

const list =
await CoreProjects.getAll();

return list.length;

};

/* =========================================
   SUMMARY
========================================= */

CoreProjects.summary =
async function(){

const list =
await CoreProjects.getAll();

let roi = 0;

let liquidity = 0;

for(const project of list){

roi +=
Number(project.rewardRate||0);

liquidity +=
Number(project.liquidity||0);

}

return{

projects:list.length,

averageROI:

list.length

?

Number(

(roi/list.length)

.toFixed(4)

)

:0,

liquidity

};

};

/* =========================================
   REFRESH
========================================= */

CoreProjects.refresh =
async function(){

cache=[];

lastRefresh=0;

return await CoreProjects.getAll(true);

};

})(window);
