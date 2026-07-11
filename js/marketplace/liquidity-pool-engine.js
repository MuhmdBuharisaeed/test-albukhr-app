/* =========================================
   ALBUKHR LIQUIDITY POOL ENGINE v2
   Testnet • Mainnet Ready
========================================= */

(function(window){

"use strict";

const LiquidityPool = {};

window.LiquidityPool = LiquidityPool;

const DEFAULT_RESERVE = 10;

/* =========================================
   PROJECT CONFIG
========================================= */

function getReservePercent(project){

try{

const config = getProjectConfig(project);

return Number(config?.reserve || DEFAULT_RESERVE);

}catch{

return DEFAULT_RESERVE;

}

}

})(window);

LiquidityPool.getPaidStakes = async function(project){

const stakes =
await getGlobalStakes();

return stakes.filter(s=>

s.project === project &&
s.status === "paid"

);

};

LiquidityPool.getTotalLiquidity =
async function(project){

const stakes =
await LiquidityPool.getPaidStakes(project);

let total = 0;

stakes.forEach(s=>{

total += Number(s.amount)||0;

});

return total;

};

LiquidityPool.getWithdrawnCapital =
async function(project){

const res = await fetch(

`${SUPABASE_URL}/rest/v1/withdraw_requests?select=amount&project=eq.${project}&type=eq.capital&status=eq.paid&network=eq.testnet`,

{

headers:{

apikey:SUPABASE_KEY,

Authorization:
`Bearer ${SUPABASE_KEY}`

}

}

);

if(!res.ok){

return 0;

}

const data =
await res.json();

let total = 0;

data.forEach(r=>{

total += Number(r.amount)||0;

});

return total;

};

LiquidityPool.getLiquidity =
async function(project){

const total =
await LiquidityPool.getTotalLiquidity(project);

const withdrawn =
await LiquidityPool.getWithdrawnCapital(project);

return Math.max(
0,
total - withdrawn
);

};

/* =========================================
   RESERVE
========================================= */

LiquidityPool.getReserve =
async function(project){

const liquidity =
await LiquidityPool.getLiquidity(project);

const reservePercent =
getReservePercent(project);

return Number(

(liquidity * reservePercent) / 100

);

};

/* =========================================
   AVAILABLE LIQUIDITY
========================================= */

LiquidityPool.getAvailable =
async function(project){

const liquidity =
await LiquidityPool.getLiquidity(project);

const reserve =
await LiquidityPool.getReserve(project);

return Math.max(
0,
liquidity - reserve
);

};

/* =========================================
   UTILIZATION
========================================= */

LiquidityPool.getUtilization =
async function(project){

const liquidity =
await LiquidityPool.getLiquidity(project);

const available =
await LiquidityPool.getAvailable(project);

if(liquidity <= 0){

return 0;

}

const used =
liquidity - available;

return Number(

((used / liquidity) * 100)
.toFixed(2)

);

};

/* =========================================
   HEALTH
========================================= */

LiquidityPool.getHealth =
async function(project){

const available =
await LiquidityPool.getAvailable(project);

const liquidity =
await LiquidityPool.getLiquidity(project);

if(liquidity <= 0){

return{

status:"EMPTY",

score:0

};

}

const percent =

(available / liquidity) * 100;

let status = "CRITICAL";

if(percent >= 90){

status = "EXCELLENT";

}

else if(percent >= 70){

status = "GOOD";

}

else if(percent >= 50){

status = "MEDIUM";

}

return{

status,

score:Number(percent.toFixed(2))

};

};

/* =========================================
   STATUS
========================================= */

LiquidityPool.getStatus =
async function(project){

const liquidity =
await LiquidityPool.getLiquidity(project);

const reserve =
await LiquidityPool.getReserve(project);

const available =
await LiquidityPool.getAvailable(project);

const utilization =
await LiquidityPool.getUtilization(project);

const health =
await LiquidityPool.getHealth(project);

return{

project,

liquidity,

reserve,

available,

utilization,

health

};

};

/* =========================================
   SUMMARY
========================================= */

LiquidityPool.summary =
async function(){

const projects =
await AlbukhrMarketplace.getProjects();

let liquidity = 0;
let reserve = 0;
let available = 0;

for(const project of projects){

const pool =
await LiquidityPool.getStatus(
project.code
);

liquidity += pool.liquidity;
reserve += pool.reserve;
available += pool.available;

}

return{

projects:projects.length,

liquidity,

reserve,

available

};

};
