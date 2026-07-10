/* =========================================
   ALBUKHR MARKETPLACE ENGINE v3
   Supabase • Testnet • Mainnet Ready
========================================= */

async function getMarketplaceProjects(){

let projects = [];

/* ===============================
   PROJECTS ENGINE
=============================== */

try{

if(typeof getActiveProjects === "function"){

projects = await getActiveProjects();

}else if(typeof getAllProjects === "function"){

projects = await getAllProjects();

}else if(typeof getProjects === "function"){

projects = await getProjects();

}

}catch(error){

console.error(
"Projects Engine:",
error
);

projects = [];

}

if(!Array.isArray(projects)){

projects = [];

}

/* ===============================
   STAKE DISCOVERY
=============================== */

try{

if(typeof getAllStakesMerged === "function"){

const stakes =
await getAllStakesMerged();

for(const stake of stakes){

if(!stake.project) continue;

const exists = projects.find(p=>{

const code =
p.project_code ||
p.code ||
p.key ||
p.name;

return String(code).trim().toLowerCase() ===
String(stake.project).trim().toLowerCase();

});

if(!exists){

projects.push({

project_code: stake.project,
project_name: stake.project,
description: "Community discovered project",
project_type: "external",
status: "active",
icon: "📦",
durations: [30,60,90],
min_liquidity: 100,
reward_rate: 0,
reserve_percent: 0.30

});

}

}

}

}catch(error){

console.error(
"Stake Discovery:",
error
);

}

return projects;

}
