/* =========================================
   ALBUKHR ADMIN ALERT ENGINE
========================================= */

const LOW_BALANCE_LIMIT = 100;

const CRITICAL_BALANCE_LIMIT = 20;

/* =========================================
   CHECK LIQUIDITY
========================================= */

async function checkLiquidity(){

try{

const balance =
Number(await getWalletBalance()) || 0;

const warning =
document.getElementById(
"liquidityWarning"
);

const status =
document.getElementById(
"liquidityStatus"
);

if(!warning) return;

let color = "";

let message = "";

let badge = "";

if(balance <= CRITICAL_BALANCE_LIMIT){

color = "#c0392b";

message =
"🚨 Critical Liquidity Level";

badge =
"🔴 CRITICAL";

}else if(balance <= LOW_BALANCE_LIMIT){

color = "#f39c12";

message =
"⚠️ Low Liquidity Level";

badge =
"🟠 LOW";

}else{

warning.style.display = "none";

if(status){

status.innerHTML =
"🟢 SAFE";

status.style.color =
"#18a558";

}

return;

}

/* Warning Banner */

warning.style.display =
"block";

warning.style.background =
color;

warning.innerHTML =
message;

/* Treasury Status */

if(status){

status.innerHTML = badge;

status.style.color = color;

}

}catch(error){

console.error(

"Liquidity Check Error:",

error

);

}

}
