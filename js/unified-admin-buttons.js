/* Allow all main admin roles */
requireRole(["super_admin","finance_admin","review_admin","viewer_admin"]);

/* Get current admin */
const admin = getAdmin();

/* Show role badge */
if(admin){
  document.getElementById("adminRoleBadge").innerText =
    admin.role.replace("_"," ").toUpperCase();

  /* Show Super Admin button only if role is super_admin */
  if(admin.role === "super_admin"){
    document.getElementById("superAdminBtn").style.display = "block";
  }
}

function go(page){
  window.location.href = page;
}

/* ===============================
UNIFIED ALERT ENGINE
=============================== */

function updateAdminAlerts(){

updateRiskBadge();
updateTxBadge();
updateWalletBadge();
updateExternalBadge();
updateDappBadge();

}

/* ===============================
TRANSACTION ALERT
=============================== */

function updateTxBadge(){

const badge =
document.getElementById("txBadge");

if(!badge) return;

const tx =
getTransactions
? getTransactions()
: [];

const pending =
tx.filter(t=>t.flag==="risk");

if(pending.length){

badge.style.display="inline-block";
badge.innerText = pending.length;

}else{

badge.style.display="none";

}

}

/* ===============================
WALLET ALERT
=============================== */

function updateWalletBadge(){

const badge =
document.getElementById("walletBadge");

if(!badge) return;

if(typeof getAdminTreasury !== "function")
return;

const t = getAdminTreasury();

if(t.treasury < 100){

badge.style.display="inline-block";
badge.innerText = "!";

}else{

badge.style.display="none";

}

}

/* ===============================
EXTERNAL PROJECT ALERT
=============================== */

function updateExternalBadge(){

const badge =
document.getElementById("externalBadge");

if(!badge) return;

const external =
JSON.parse(
localStorage.getItem("albukhr_external_projects")
)||[];

const pending =
external.filter(p=>p.status==="pending");

if(pending.length){

badge.style.display="inline-block";
badge.innerText = pending.length;

}else{

badge.style.display="none";

}

}

/* ===============================
DAPP ALERT
=============================== */

function updateDappBadge(){

const badge =
document.getElementById("dappBadge");

if(!badge) return;

const dapps =
JSON.parse(
localStorage.getItem("albukhr_dapp_requests")
)||[];

const pending =
dapps.filter(d=>!d.reviewed);

if(pending.length){

badge.style.display="inline-block";
badge.innerText = pending.length;

}else{

badge.style.display="none";

}

}

/* ===============================
CRITICAL ALERT ENGINE
=============================== */

function checkCriticalRisk(){

let critical = false;

/* Treasury */

if(typeof getAdminTreasury === "function"){

const t = getAdminTreasury();

if(t.treasury < 50){
critical = true;
}

}

/* Projects */

const projects = [
"Barsh",
"Labbaika",
"Raheem",
"Urban",
"Khairat",
"Azman",
"Hauwal"
];

projects.forEach(p=>{

if(typeof getProjectTreasuryStatus !== "function")
return;

const status =
getProjectTreasuryStatus(p);

if(status.liquidity < 30){
critical = true;
}

});

triggerCriticalAlert(critical);

}

/* ===============================
TRIGGER ALERT
=============================== */

function triggerCriticalAlert(active){

const alert =
document.getElementById("criticalAlert");

const sound =
document.getElementById("alertSound");

if(!alert) return;

if(active){

alert.style.display="block";

if(sound){
sound.play().catch(()=>{});
}

}else{

alert.style.display="none";

}

}

/* INIT */

updateAdminAlerts();
setInterval(updateAdminAlerts,4000);
