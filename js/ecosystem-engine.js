/* =========================================
   ALBUKHR ECOSYSTEM ENGINE v2
   Central Gateway for ALBUKHR Ecosystem
   Testnet Ready
========================================= */

(function(window){

"use strict";

const AlbukhrEcosystem = {};

window.AlbukhrEcosystem = AlbukhrEcosystem;

/* =========================================
   CACHE
========================================= */

let cache = {};

const CACHE_TIME = 10000;

/* =========================================
   REFRESH
========================================= */

AlbukhrEcosystem.clearCache = function(){

cache = {};

};

/* =========================================
   MARKETPLACE
========================================= */

AlbukhrEcosystem.marketplace =
async function(force=false){

const now = Date.now();

if(

!force &&

cache.marketplace &&

(now-cache.marketplace.time)<CACHE_TIME

){

return cache.marketplace.data;

}

const projects =

typeof AlbukhrMarketplace !== "undefined"

?

await AlbukhrMarketplace.getMarketplace()

:[];

const hot =

typeof getHotProjects==="function"

?

await getHotProjects()

:[];

const liquidity =

typeof getLiquidityLeaderboard==="function"

?

await getLiquidityLeaderboard()

:[];

const investors =

typeof getTopInvestors==="function"

?

await getTopInvestors()

:[];

const featured =

projects.length

?

projects[0]

:null;

const summary =

typeof AlbukhrMarketplace!=="undefined"

?

await AlbukhrMarketplace.summary()

:{};

const result = {

projects,

featured,

hotProjects:hot,

liquidityLeaders:liquidity,

topInvestors:investors,

summary,

timestamp:now

};

cache.marketplace = {

time:now,

data:result

};

return result;

};

/* =========================================
   SINGLE PROJECT
========================================= */

AlbukhrEcosystem.project =
async function(projectCode){

if(

typeof AlbukhrMarketplace==="undefined"

){

return null;

}

return await AlbukhrMarketplace.getProject(projectCode);

};

/* =========================================
   DASHBOARD
========================================= */

AlbukhrEcosystem.dashboard =
async function(){

const market =
await AlbukhrEcosystem.marketplace();

return{

market,

generatedAt:Date.now()

};

};

/* =========================================
   ADMIN
========================================= */

AlbukhrEcosystem.admin =
async function(){

const market =
await AlbukhrEcosystem.marketplace(true);

return{

market,

generatedAt:Date.now()

};

};

})(window);
