/* =========================================
   ALBUKHR SUPABASE ADMIN GUARD
========================================= */

(async function(){

"use strict";

try{

  /* -----------------------------------------
     REQUIRE SUPABASE ADMIN SESSION
  ----------------------------------------- */

  const admin = await getCurrentAdmin();

  if(!admin){

    location.replace("admin-login.html");

    return;

  }

  /* -----------------------------------------
     CURRENT ROLE
  ----------------------------------------- */

  const role =
    String(admin.role_code || "")
      .trim()
      .toLowerCase();

  /* -----------------------------------------
     CURRENT DATABASE ROLES
     
     A yanzu Supabase ya tabbatar da:
     super_admin
     
     Sauran roles za mu ƙara daga baya.
  ----------------------------------------- */

  const allowedRoles = [
    "super_admin"
  ];

  if(!allowedRoles.includes(role)){

    alert("You are not authorized to access the Admin Control Center.");

    await adminLogout();

    return;

  }

  /* -----------------------------------------
     ROLE BADGE
  ----------------------------------------- */

  const roleBadge =
    document.getElementById("adminRoleBadge");

  if(roleBadge){

    roleBadge.innerText =
      role
        .replace(/_/g, " ")
        .toUpperCase();

  }

  /* -----------------------------------------
     SUPER ADMIN BUTTON
  ----------------------------------------- */

  const superAdminBtn =
    document.getElementById("superAdminBtn");

  if(superAdminBtn){

    superAdminBtn.style.display =
      role === "super_admin"
        ? "block"
        : "none";

  }

}catch(error){

  console.error(
    "ALBUKHR Admin Guard Error:",
    error
  );

  location.replace("admin-login.html");

}

})();

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
