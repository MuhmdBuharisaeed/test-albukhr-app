/* =========================================
   ALBUKHR UNIFIED ADMIN BUTTONS
   Version 3.0

   DEPENDS ON:
   1) admin-supabase-auth.js
   2) admin-session.js
   3) admin-permissions.js
   4) admin-bootstrap.js

   PURPOSE:
   - Unified Admin Control Center
   - Use Admin Bootstrap as source of truth
   - Role detection
   - Permission-aware buttons
   - Admin alerts
   - Critical risk monitoring
   - MAINNET / TESTNET awareness
   - No second Admin authentication flow

   IMPORTANT:
   This engine does NOT modify:
   - staking engines
   - treasury engines
   - liquidity engines
   - transaction engines
   - ecosystem Supabase Core
========================================= */

(function(window){

"use strict";


/* =========================================
   CONFIG
========================================= */

const ADMIN_ROLES = [

    "super_admin",

    "finance_admin",

    "review_admin",

    "viewer_admin"

];


/* =========================================
   BUTTON PERMISSIONS

   These are UI access rules.

   Database permissions remain the
   final authorization source.
========================================= */

const BUTTON_PERMISSIONS = {

    coreProjectsDashboard: [
        "projects.manage"
    ],

    ecosystemDashboard: [
        "projects.manage",
        "finance.manage"
    ],

    dappRequests: [
        "approvals.manage"
    ],

    contributors: [
        "users.manage"
    ],

    transactions: [
        "finance.manage"
    ],

    riskMonitor: [
        "risk.manage",
        "finance.manage"
    ],

    internalProjects: [
        "projects.manage"
    ],

    externalAdmin: [
        "projects.manage",
        "approvals.manage"
    ],

    externalDashboard: [
        "projects.manage"
    ],

    externalReviews: [
        "approvals.manage"
    ],

    escrow: [
        "finance.manage",
        "approvals.manage"
    ],

    superAdmin: [
        "*"
    ],

    permissions: [
        "settings.manage"
    ],

    wallet: [
        "finance.manage"
    ],

    controlCenter: [
        "settings.manage"
    ]

};


/* =========================================
   BUTTON MAP
========================================= */

const BUTTON_MAP = {

    coreProjectsDashboard: {

        selector:
            'button[onclick*="Albukhr-core-projects-dashboard.html"]'

    },

    ecosystemDashboard: {

        selector:
            'button[onclick*="ALBUKHR-ecosystem-dashboard.html"]'

    },

    dappRequests: {

        selector:
            'button[onclick*="admin-dapp-requests.html"]'

    },

    contributors: {

        selector:
            'button[onclick*="admin-contributors.html"]'

    },

    transactions: {

        selector:
            'button[onclick*="admin-transactions.html"]'

    },

    riskMonitor: {

        selector:
            'button[onclick*="admin-risk-monitor.html"]'

    },

    internalProjects: {

        selector:
            'button[onclick*="admin-internal-projects.html"]'

    },

    externalAdmin: {

        selector:
            'button[onclick*="admin-external-panel.html"]'

    },

    externalDashboard: {

        selector:
            'button[onclick*="admin-external-dashboard.html"]'

    },

    externalReviews: {

        selector:
            'button[onclick*="external-project-view.html"]'

    },

    escrow: {

        selector:
            'button[onclick*="escrow-admin.html"]'

    },

    superAdmin: {

        selector:
            'button[onclick*="super-admin-dashboard.html"]'

    },

    permissions: {

        selector:
            'button[onclick*="admin-permissions.html"]'

    },

    wallet: {

        selector:
            'button[onclick*="admin-wallet.html"]'

    },

    controlCenter: {

        selector:
            'button[onclick*="ALBUKHR-ecosystem-control-center.html"]'

    }

};


/* =========================================
   SAFE HELPERS
========================================= */

function safeString(
    value,
    fallback = ""
){

    if(
        value === null ||
        value === undefined
    ){

        return fallback;

    }

    return String(value);

}


function safeNumber(
    value,
    fallback = 0
){

    const number =
        Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;

}


/* =========================================
   ADMIN ENVIRONMENT
=========================================

   IMPORTANT:
   Admin Auth Core is authoritative.

   We do not create a second network
   resolution system here.
========================================= */

function getAdminEnvironment(){

    try{

        if(
            typeof window.getAlbukhrAdminEnvironment ===
            "function"
        ){

            const environment =
                window.getAlbukhrAdminEnvironment();


            if(
                environment === "mainnet" ||
                environment === "testnet"
            ){

                return environment;

            }

        }

    }catch(error){

        console.warn(
            "[UNIFIED ADMIN] Admin environment lookup failed:",
            error
        );

    }


    /*
       Fallback only.
    */

    const hostname =
        String(
            window.location.hostname || ""
        )
        .toLowerCase();


    if(
        hostname === "test.albukhr.com" ||
        hostname.startsWith("test.")
    ){

        return "testnet";

    }


    if(
        hostname === "app.albukhr.com" ||
        hostname.startsWith("app.")
    ){

        return "mainnet";

    }


    return "mainnet";

}


/* =========================================
   CURRENT ENVIRONMENT
========================================= */

function getCurrentAdminEnvironment(){

    return getAdminEnvironment();

}


window.getAdminEnvironment =
    getAdminEnvironment;


/* =========================================
   ADMIN NETWORK
========================================= */

function getAdminNetwork(){

    try{

        if(
            typeof window.getAlbukhrAdminNetwork ===
            "function"
        ){

            return window.getAlbukhrAdminNetwork();

        }

    }catch(error){

        console.warn(
            "[UNIFIED ADMIN] Admin network lookup failed:",
            error
        );

    }


    return getAdminEnvironment();

}


window.getAdminNetwork =
    getAdminNetwork;


/* =========================================
   GLOBAL ENVIRONMENT
========================================= */

window.ALBUKHR_ADMIN_ENVIRONMENT =
    getCurrentAdminEnvironment();


window.ALBUKHR_ADMIN_NETWORK =
    getAdminNetwork();


/* =========================================
   GET BOOTSTRAPPED ADMIN
========================================= */

async function getUnifiedAdmin(){

    /*
       PRIMARY SOURCE:
       Admin Bootstrap.
    */

    if(
        window.Admin &&
        window.Admin.ready === true &&
        window.Admin.profile
    ){

        return window.Admin.profile;

    }


    /*
       If bootstrap has not completed yet,
       wait for it.
    */

    if(
        typeof window.initializeAdmin ===
        "function"
    ){

        try{

            const ready =
                await window.initializeAdmin();


            if(
                ready &&
                window.Admin &&
                window.Admin.ready &&
                window.Admin.profile
            ){

                return window.Admin.profile;

            }

        }catch(error){

            console.warn(
                "[UNIFIED ADMIN] Bootstrap failed:",
                error
            );

        }

    }


    /*
       Final compatibility fallback.
    */

    if(
        typeof window.getCurrentAdmin ===
        "function"
    ){

        try{

            return await window.getCurrentAdmin();

        }catch(error){

            console.warn(
                "[UNIFIED ADMIN] Session fallback failed:",
                error
            );

        }

    }


    return null;

}


window.getUnifiedAdmin =
    getUnifiedAdmin;


/* =========================================
   GET ROLE
========================================= */

function getUnifiedAdminRole(
    admin
){

    if(!admin){

        /*
           Try Bootstrap state.
        */

        if(
            window.Admin &&
            window.Admin.ready
        ){

            return safeString(
                window.Admin.role,
                ""
            )
            .trim()
            .toLowerCase();

        }

        return "";

    }


    return safeString(

        admin.role_code ??
        admin.role ??
        "",

        ""

    )
    .trim()
    .toLowerCase();

}


window.getUnifiedAdminRole =
    getUnifiedAdminRole;


/* =========================================
   ROLE VALIDATION
========================================= */

function isAllowedAdminRole(
    role
){

    return ADMIN_ROLES.includes(

        safeString(role)
            .trim()
            .toLowerCase()

    );

}


window.isAllowedAdminRole =
    isAllowedAdminRole;


/* =========================================
   REQUIRE ROLE
========================================= */

async function requireRole(
    roles = []
){

    const admin =
        await getUnifiedAdmin();


    if(!admin){

        window.location.replace(
            "admin-login.html"
        );

        return null;

    }


    const role =
        getUnifiedAdminRole(admin);


    const allowed =
        Array.isArray(roles)
            ? roles
            : [roles];


    const normalized =
        allowed.map(
            item =>
                safeString(item)
                    .trim()
                    .toLowerCase()
        );


    if(
        !normalized.includes(role)
    ){

        alert(
            "You are not authorized to access this Admin area."
        );


        if(
            typeof window.adminLogout ===
            "function"
        ){

            try{

                await window.adminLogout();

            }catch(error){

                console.warn(
                    "[UNIFIED ADMIN] Logout failed:",
                    error
                );

            }

        }


        return null;

    }


    return admin;

}


window.requireRole =
    requireRole;


/* =========================================
   CHECK PERMISSION
========================================= */

async function checkPermission(
    permission
){

    const required =
        safeString(
            permission
        )
        .trim()
        .toLowerCase();


    if(!required){

        return false;

    }


    /*
       Bootstrap state is preferred.
    */

    if(
        window.Admin &&
        window.Admin.ready === true
    ){

        const role =
            safeString(
                window.Admin.role,
                ""
            )
            .trim()
            .toLowerCase();


        /*
           Super Admin.
        */

        if(
            role ===
            "super_admin"
        ){

            return true;

        }


        const permissions =
            Array.isArray(
                window.Admin.permissions
            )
                ? window.Admin.permissions
                : [];


        const normalized =
            permissions.map(
                item =>
                    typeof item === "string"
                        ? item.trim().toLowerCase()
                        : safeString(
                            item?.permission,
                            ""
                        )
                        .trim()
                        .toLowerCase()
            )
            .filter(Boolean);


        if(
            normalized.includes("*")
        ){

            return true;

        }


        if(
            normalized.includes(required)
        ){

            return true;

        }

    }


    /*
       Database permission engine fallback.
    */

    if(
        typeof window.hasPermission ===
        "function"
    ){

        try{

            return await window.hasPermission(
                required
            );

        }catch(error){

            console.warn(
                "[UNIFIED ADMIN] Permission check failed:",
                required,
                error
            );

        }

    }


    return false;

}


window.checkPermission =
    checkPermission;


/* =========================================
   ANY PERMISSION
========================================= */

async function hasAnyPermission(
    permissions = []
){

    if(
        !Array.isArray(permissions) ||
        !permissions.length
    ){

        return false;

    }


    for(
        const permission
        of permissions
    ){

        if(
            await checkPermission(
                permission
            )
        ){

            return true;

        }

    }


    return false;

}


window.hasAnyPermission =
    hasAnyPermission;


/* =========================================
   BUTTON ACCESS
========================================= */

async function canUseButton(
    buttonKey
){

    const permissions =
        BUTTON_PERMISSIONS[
            buttonKey
        ];


    if(!permissions){

        /*
           Deny unknown buttons.
        */

        return false;

    }


    /*
       Super Admin button specifically
       requires super_admin.
    */

    if(
        permissions.includes("*")
    ){

        const admin =
            await getUnifiedAdmin();


        return (
            getUnifiedAdminRole(admin) ===
            "super_admin"
        );

    }


    return await hasAnyPermission(
        permissions
    );

}


window.canUseButton =
    canUseButton;


/* =========================================
   APPLY BUTTON PERMISSIONS
========================================= */

async function applyButtonPermissions(){

    for(
        const [
            key,
            config
        ]
        of Object.entries(
            BUTTON_MAP
        )
    ){

        const button =
            document.querySelector(
                config.selector
            );


        if(!button){

            continue;

        }


        const allowed =
            await canUseButton(
                key
            );


        if(allowed){

            button.style.display =
                "";

            button.disabled =
                false;

            button.removeAttribute(
                "aria-disabled"
            );

            button.removeAttribute(
                "data-admin-hidden"
            );

        }else{

            button.style.display =
                "none";

            button.disabled =
                true;

            button.setAttribute(
                "aria-disabled",
                "true"
            );

            button.setAttribute(
                "data-admin-hidden",
                "true"
            );

        }

    }

}


window.applyButtonPermissions =
    applyButtonPermissions;


/* =========================================
   ROLE BADGE
========================================= */

function renderRoleBadge(
    admin
){

    const badge =
        document.getElementById(
            "adminRoleBadge"
        );


    if(!badge){

        return;

    }


    const role =
        getUnifiedAdminRole(
            admin
        );


    badge.innerText =
        role
            ? role
                .replace(
                    /_/g,
                    " "
                )
                .toUpperCase()
            : "ADMIN";

}


/* =========================================
   ENVIRONMENT BADGE
========================================= */

function renderEnvironmentBadge(){

    const badge =
        document.getElementById(
            "adminEnvironmentBadge"
        );


    if(!badge){

        return;

    }


    const environment =
        getCurrentAdminEnvironment();


    const network =
        getAdminNetwork();


    badge.innerText =
        environment
            .toUpperCase();


    badge.dataset.environment =
        environment;


    badge.dataset.network =
        network;

}


/* =========================================
   NAVIGATION
========================================= */

function go(page){

    if(!page){

        return;

    }


    window.location.href =
        page;

}


window.go =
    go;


/* =========================================
   TRANSACTION BADGE
========================================= */

async function updateTxBadge(){

    const badge =
        document.getElementById(
            "txBadge"
        );


    if(!badge){

        return;

    }


    let transactions = [];


    if(
        typeof window.getTransactions ===
        "function"
    ){

        try{

            transactions =
                await Promise.resolve(
                    window.getTransactions()
                );

        }catch(error){

            console.warn(
                "[UNIFIED ADMIN] Transactions unavailable:",
                error
            );

        }

    }


    if(
        !Array.isArray(
            transactions
        )
    ){

        transactions = [];

    }


    const risky =
        transactions.filter(
            tx =>
                tx &&
                tx.flag === "risk"
        );


    if(risky.length){

        badge.style.display =
            "inline-block";

        badge.innerText =
            risky.length;

    }else{

        badge.style.display =
            "none";

    }

}


/* =========================================
   WALLET BADGE
========================================= */

async function updateWalletBadge(){

    const badge =
        document.getElementById(
            "walletBadge"
        );


    if(!badge){

        return;

    }


    if(
        typeof window.getAdminTreasury !==
        "function"
    ){

        badge.style.display =
            "none";

        return;

    }


    try{

        const treasury =
            await Promise.resolve(
                window.getAdminTreasury()
            );


        const balance =
            safeNumber(
                treasury?.treasury,
                0
            );


        if(
            balance < 100
        ){

            badge.style.display =
                "inline-block";

            badge.innerText =
                "!";

        }else{

            badge.style.display =
                "none";

        }

    }catch(error){

        console.warn(
            "[UNIFIED ADMIN] Treasury unavailable:",
            error
        );

        badge.style.display =
            "none";

    }

}


/* =========================================
   LEGACY STORAGE KEY
========================================= */

function getNetworkStorageKey(
    baseKey
){

    const network =
        getCurrentAdminEnvironment();


    return (
        `${baseKey}_${network}`
    );

}


/* =========================================
   EXTERNAL PROJECT BADGE
========================================= */

function updateExternalBadge(){

    const badge =
        document.getElementById(
            "externalBadge"
        );


    if(!badge){

        return;

    }


    let projects = [];


    try{

        const key =
            getNetworkStorageKey(
                "albukhr_external_projects"
            );


        const raw =
            localStorage.getItem(
                key
            );


        const data =
            raw
                ? JSON.parse(raw)
                : [];


        projects =
            Array.isArray(data)
                ? data
                : [];

    }catch(error){

        console.warn(
            "[UNIFIED ADMIN] External project cache unavailable:",
            error
        );

    }


    const pending =
        projects.filter(
            project =>
                project &&
                project.status ===
                    "pending"
        );


    if(pending.length){

        badge.style.display =
            "inline-block";

        badge.innerText =
            pending.length;

    }else{

        badge.style.display =
            "none";

    }

}


/* =========================================
   DAPP BADGE
========================================= */

function updateDappBadge(){

    const badge =
        document.getElementById(
            "dappBadge"
        );


    if(!badge){

        return;

    }


    let dapps = [];


    try{

        const key =
            getNetworkStorageKey(
                "albukhr_dapp_requests"
            );


        const raw =
            localStorage.getItem(
                key
            );


        const data =
            raw
                ? JSON.parse(raw)
                : [];


        dapps =
            Array.isArray(data)
                ? data
                : [];

    }catch(error){

        console.warn(
            "[UNIFIED ADMIN] DApp cache unavailable:",
            error
        );

    }


    const pending =
        dapps.filter(
            dapp =>
                dapp &&
                !dapp.reviewed
        );


    if(pending.length){

        badge.style.display =
            "inline-block";

        badge.innerText =
            pending.length;

    }else{

        badge.style.display =
            "none";

    }

}


/* =========================================
   RISK BADGE
========================================= */

async function updateRiskBadgeSafe(){

    if(
        typeof window.updateRiskBadge !==
        "function"
    ){

        return;

    }


    try{

        await Promise.resolve(
            window.updateRiskBadge()
        );

    }catch(error){

        console.warn(
            "[UNIFIED ADMIN] Risk badge unavailable:",
            error
        );

    }

}


/* =========================================
   UNIFIED ALERT ENGINE
========================================= */

async function updateAdminAlerts(){

    await Promise.allSettled([

        updateRiskBadgeSafe(),

        updateTxBadge(),

        updateWalletBadge(),

        Promise.resolve(
            updateExternalBadge()
        ),

        Promise.resolve(
            updateDappBadge()
        )

    ]);

}


window.updateAdminAlerts =
    updateAdminAlerts;


/* =========================================
   CRITICAL RISK
========================================= */

async function checkCriticalRisk(){

    let critical =
        false;


    /* ======================================
       MAIN TREASURY
    ====================================== */

    if(
        typeof window.getAdminTreasury ===
        "function"
    ){

        try{

            const treasury =
                await Promise.resolve(
                    window.getAdminTreasury()
                );


            const balance =
                safeNumber(
                    treasury?.treasury,
                    0
                );


            if(
                balance < 50
            ){

                critical =
                    true;

            }

        }catch(error){

            console.warn(
                "[CRITICAL] Treasury check failed:",
                error
            );

        }

    }


    /* ======================================
       PROJECT TREASURIES
    ====================================== */

    if(
        !critical &&
        typeof window.getProjectTreasuryStatus ===
        "function"
    ){

        const projects = [

            "Barsh",

            "Labbaika",

            "Raheem",

            "Urban",

            "Khairat",

            "Azman",

            "Hauwal"

        ];


        for(
            const project
            of projects
        ){

            try{

                const status =
                    await window.getProjectTreasuryStatus(
                        project
                    );


                if(
                    !status ||
                    status.error
                ){

                    continue;

                }


                const liquidity =
                    safeNumber(
                        status.liquidity,
                        0
                    );


                if(
                    liquidity < 30
                ){

                    critical =
                        true;

                    break;

                }

            }catch(error){

                console.warn(
                    "[CRITICAL] Project treasury check failed:",
                    project,
                    error
                );

            }

        }

    }


    triggerCriticalAlert(
        critical
    );


    return critical;

}


window.checkCriticalRisk =
    checkCriticalRisk;


/* =========================================
   CRITICAL ALERT
========================================= */

function triggerCriticalAlert(
    active
){

    const alert =
        document.getElementById(
            "criticalAlert"
        );


    const sound =
        document.getElementById(
            "alertSound"
        );


    if(!alert){

        return;

    }


    if(active){

        alert.style.display =
            "block";


        if(sound){

            sound.play()
                .catch(
                    () => {}
                );

        }

    }else{

        alert.style.display =
            "none";

    }

}


window.triggerCriticalAlert =
    triggerCriticalAlert;


/* =========================================
   INITIALIZE UNIFIED ADMIN
========================================= */

let unifiedInitialization =
    null;


async function initializeUnifiedAdminButtons(){

    /*
       Prevent duplicate initialization.
    */

    if(unifiedInitialization){

        return unifiedInitialization;

    }


    unifiedInitialization =
        (async function(){

            /*
               IMPORTANT:

               Wait for Admin Bootstrap first.
               This eliminates the previous race
               between Bootstrap and Unified Admin.
            */

            if(
                typeof window.initializeAdmin ===
                "function"
            ){

                const ready =
                    await window.initializeAdmin();


                if(!ready){

                    return false;

                }

            }


            /* ==============================
               GET BOOTSTRAPPED ADMIN
            ============================== */

            const admin =
                await getUnifiedAdmin();


            if(!admin){

                window.location.replace(
                    "admin-login.html"
                );

                return false;

            }


            /* ==============================
               ROLE
            ============================== */

            const role =
                getUnifiedAdminRole(
                    admin
                );


            if(
                !isAllowedAdminRole(
                    role
                )
            ){

                alert(
                    "You are not authorized to access the Admin Control Center."
                );


                if(
                    typeof window.adminLogout ===
                    "function"
                ){

                    try{

                        await window.adminLogout();

                    }catch(error){

                        console.warn(
                            "[UNIFIED ADMIN] Logout failed:",
                            error
                        );

                    }

                }


                return false;

            }


            /* ==============================
               ROLE BADGE
            ============================== */

            renderRoleBadge(
                admin
            );


            /* ==============================
               ENVIRONMENT
            ============================== */

            renderEnvironmentBadge();


            /* ==============================
               BUTTON PERMISSIONS
            ============================== */

            await applyButtonPermissions();


            /* ==============================
               ALERTS
            ============================== */

            await updateAdminAlerts();


            /* ==============================
               CRITICAL RISK
            ============================== */

            await checkCriticalRisk();


            /* ==============================
               CURRENT ADMIN
            ============================== */

            window.ALBUKHR_CURRENT_ADMIN =
                admin;


            window.ALBUKHR_CURRENT_ADMIN_ROLE =
                role;


            window.ALBUKHR_CURRENT_ADMIN_ENVIRONMENT =
                getCurrentAdminEnvironment();


            window.ALBUKHR_CURRENT_ADMIN_NETWORK =
                getAdminNetwork();


            console.log(
                "✅ ALBUKHR Unified Admin Buttons Ready"
            );


            console.log(
                "Environment:",
                getCurrentAdminEnvironment()
            );


            console.log(
                "Network:",
                getAdminNetwork()
            );


            console.log(
                "Role:",
                role
            );


            return true;

        })();


    try{

        return await unifiedInitialization;

    }catch(error){

        console.error(
            "[UNIFIED ADMIN] Initialization failed:",
            error
        );

        return false;

    }finally{

        /*
           Allow retry after a failed
           initialization.
        */

        if(
            !(
                window.Admin &&
                window.Admin.ready === true
            )
        ){

            unifiedInitialization =
                null;

        }

    }

}


window.initializeUnifiedAdminButtons =
    initializeUnifiedAdminButtons;


/* =========================================
   DOM READY
========================================= */

function startUnifiedAdmin(){

    initializeUnifiedAdminButtons()
        .catch(
            error => {

                console.error(
                    "[UNIFIED ADMIN] Startup failed:",
                    error
                );

            }
        );

}


/*
   Bootstrap itself also starts on DOMContentLoaded.

   We therefore wait one microtask after DOM
   readiness before starting Unified Admin.
*/

if(
    document.readyState ===
    "loading"
){

    document.addEventListener(

        "DOMContentLoaded",

        function(){

            setTimeout(
                startUnifiedAdmin,
                0
            );

        },

        {
            once:true
        }

    );

}else{

    setTimeout(
        startUnifiedAdmin,
        0
    );

}


/* =========================================
   ALERT REFRESH
========================================= */

setInterval(

    async function(){

        try{

            /*
               Do not refresh if Admin is
               no longer authenticated.
            */

            if(
                window.Admin &&
                window.Admin.ready === true
            ){

                await updateAdminAlerts();

            }

        }catch(error){

            console.warn(
                "[UNIFIED ADMIN] Alert refresh failed:",
                error
            );

        }

    },

    4000

);


/* =========================================
   CRITICAL RISK REFRESH
========================================= */

setInterval(

    async function(){

        try{

            if(
                window.Admin &&
                window.Admin.ready === true
            ){

                await checkCriticalRisk();

            }

        }catch(error){

            console.warn(
                "[UNIFIED ADMIN] Critical risk refresh failed:",
                error
            );

        }

    },

    30000

);


})(window);
