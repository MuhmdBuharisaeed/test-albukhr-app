/* ==========================================
   ALBUKHR ADMIN DASHBOARD ENGINE
   Version 1.0
========================================== */

(function(window){

"use strict";

let refreshTimer = null;

/* ==========================================
   ADMIN READY
========================================== */

document.addEventListener(

    "admin-ready",

    async(event)=>{

        const admin = event.detail.user;

        await initDashboard(admin);

    }

);

/* ==========================================
   INIT
========================================== */

async function initDashboard(admin){

    showRoleBadge(admin);

    showSuperAdminButton(admin);

    bindButtons();

    await updateAdminAlerts();

    await checkCriticalRisk();

    startRefresh();

}

/* ==========================================
   ROLE BADGE
========================================== */

function showRoleBadge(admin){

    const badge =

    document.getElementById(

        "adminRoleBadge"

    );

    if(!badge) return;

    badge.textContent =

    String(admin.role_code || "")

    .replaceAll("_"," ")

    .toUpperCase();

}

/* ==========================================
   SUPER ADMIN
========================================== */

function showSuperAdminButton(admin){

    const btn =

    document.getElementById(

        "superAdminBtn"

    );

    if(!btn) return;

    btn.style.display =

    admin.role_code ===

    "super_admin"

    ? ""

    : "none";

}

/* ==========================================
   BUTTONS
========================================== */

function bindButtons(){

    document

    .querySelectorAll(

        ".admin-btn[data-page]"

    )

    .forEach(button=>{

        button.addEventListener(

            "click",

            ()=>{

                go(

                    button.dataset.page

                );

            }

        );

    });

    const logout =

    document.getElementById(

        "logoutBtn"

    );

    if(logout){

        logout.addEventListener(

            "click",

            adminLogout

        );

    }

}

/* ==========================================
   NAVIGATION
========================================== */

function go(page){

    if(

        !window.Admin ||

        !window.Admin.ready

    ){

        location.replace(

            "admin-login.html"

        );

        return;

    }

    location.href = page;

}

/* ==========================================
   ALERTS
========================================== */

async function updateAdminAlerts(){

    if(

        typeof updateTxBadge ===

        "function"

    ){

        await updateTxBadge();

    }

    if(

        typeof updateWalletBadge ===

        "function"

    ){

        await updateWalletBadge();

    }

    if(

        typeof updateExternalBadge ===

        "function"

    ){

        await updateExternalBadge();

    }

    if(

        typeof updateDappBadge ===

        "function"

    ){

        await updateDappBadge();

    }

}

/* ==========================================
   CRITICAL
========================================== */

async function checkCriticalRisk(){

    if(

        typeof window.checkCriticalRisk

        === "function"

    ){

        await window.checkCriticalRisk();

    }

}

/* ==========================================
   REFRESH
========================================== */

function startRefresh(){

    stopRefresh();

    refreshTimer =

    setInterval(

        async()=>{

            await updateAdminAlerts();

            await checkCriticalRisk();

        },

        5000

    );

}

function stopRefresh(){

    if(refreshTimer){

        clearInterval(

            refreshTimer

        );

        refreshTimer = null;

    }

}

/* ==========================================
   EXPORT
========================================== */

window.go = go;

window.startDashboardRefresh =

startRefresh;

window.stopDashboardRefresh =

stopRefresh;

})(window);
