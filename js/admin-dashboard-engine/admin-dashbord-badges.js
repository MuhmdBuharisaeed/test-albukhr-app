/* ==========================================
   ALBUKHR ADMIN DASHBOARD BADGES
   Version 1.0
========================================== */

(function(window){

"use strict";

const Config =
window.AdminDashboardConfig;

const Utils =
window.AdminDashboardUtils;

/* ==========================================
   INIT
========================================== */

async function init(){

    await refresh();

}

/* ==========================================
   REFRESH
========================================== */

async function refresh(){

    await updateTransactions();

    await updateWallet();

    await updateContributors();

    await updateDapps();

    await updateProjects();

    await updateRisk();

    await updateControlCenter();

}

/* ==========================================
   TRANSACTIONS
========================================== */

async function updateTransactions(){

    try{

        let total = 0;

        if(
            window.TransactionsService &&
            typeof window.TransactionsService.pendingCount === "function"
        ){

            total =
            await window.TransactionsService.pendingCount();

        }

        Utils.badge(
            Config.BADGES.TRANSACTIONS,
            total
        );

    }catch(error){

        console.error(error);

    }

}

/* ==========================================
   WALLET
========================================== */

async function updateWallet(){

    try{

        let total = 0;

        if(
            window.WalletsService &&
            typeof window.WalletsService.alertCount === "function"
        ){

            total =
            await window.WalletsService.alertCount();

        }

        Utils.badge(
            Config.BADGES.WALLET,
            total
        );

    }catch(error){

        console.error(error);

    }

}

/* ==========================================
   CONTRIBUTORS
========================================== */

async function updateContributors(){

    try{

        let total = 0;

        if(
            window.ContributorsService &&
            typeof window.ContributorsService.pendingCount === "function"
        ){

            total =
            await window.ContributorsService.pendingCount();

        }

        Utils.badge(
            Config.BADGES.CONTRIBUTORS,
            total
        );

    }catch(error){

        console.error(error);

    }

}

/* ==========================================
   DAPPS
========================================== */

async function updateDapps(){

    try{

        let total = 0;

        if(
            window.DappsService &&
            typeof window.DappsService.pendingCount === "function"
        ){

            total =
            await window.DappsService.pendingCount();

        }

        Utils.badge(
            Config.BADGES.DAPPS,
            total
        );

    }catch(error){

        console.error(error);

    }

}

/* ==========================================
   PROJECTS
========================================== */

async function updateProjects(){

    try{

        let total = 0;

        if(
            window.ProjectsService &&
            typeof window.ProjectsService.pendingCount === "function"
        ){

            total =
            await window.ProjectsService.pendingCount();

        }

        Utils.badge(
            Config.BADGES.EXTERNAL_ADMIN,
            total
        );

    }catch(error){

        console.error(error);

    }

}

/* ==========================================
   RISK
========================================== */

async function updateRisk(){

    try{

        let total = 0;

        if(
            window.TransactionsService &&
            typeof window.TransactionsService.flaggedCount === "function"
        ){

            total =
            await window.TransactionsService.flaggedCount();

        }

        Utils.badge(
            Config.BADGES.RISK,
            total
        );

    }catch(error){

        console.error(error);

    }

}

/* ==========================================
   CONTROL CENTER
========================================== */

async function updateControlCenter(){

    Utils.badge(

        Config.BADGES.CONTROL_CENTER,

        ""

    );

}

/* ==========================================
   EXPORT
========================================== */

window.AdminDashboardBadges = {

    init,

    refresh,

    updateTransactions,

    updateWallet,

    updateContributors,

    updateDapps,

    updateProjects,

    updateRisk,

    updateControlCenter

};

})(window);
