/* =========================================
   ALBUKHR UNIFIED ADMIN BUTTONS
   Version 2.0 SAFE PATCH

   DEPENDS ON:
   1) supabase-core.js
   2) admin-session.js
   3) admin-permissions.js
   4) admin-bootstrap.js (optional but recommended)

   PURPOSE:
   - Unified Admin Control Center
   - Role detection
   - Permission-aware buttons
   - Admin alerts
   - Critical risk monitoring
   - MAINNET / TESTNET awareness

   IMPORTANT:
   This engine does NOT modify:
   - staking engines
   - treasury engines
   - liquidity engines
   - transaction engines
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


/*
   Permission mapping.

   These are only button-access rules.
   Ba su canza database permissions ba.

   "*" = Super Admin full access.
*/

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
   CURRENT ENVIRONMENT
========================================= */

function getAdminEnvironment(){

    const hostname =
        String(
            window.location.hostname || ""
        ).toLowerCase();

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

    /*
       Local development fallback.
       We deliberately keep this as mainnet
       to match the approved environment logic.
    */

    return "mainnet";

}


const CURRENT_ENVIRONMENT =
    getAdminEnvironment();


window.ALBUKHR_ADMIN_ENVIRONMENT =
    CURRENT_ENVIRONMENT;


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

    const n =
        Number(value);

    return Number.isFinite(n)
        ? n
        : fallback;

}


/* =========================================
   GET CURRENT ADMIN
========================================= */

async function getUnifiedAdmin(){

    /*
       New Supabase Admin Session Engine
    */

    if(
        typeof window.getCurrentAdmin ===
        "function"
    ){

        try{

            const admin =
                await window.getCurrentAdmin();

            if(admin){

                return admin;

            }

        }catch(error){

            console.warn(
                "[UNIFIED ADMIN] getCurrentAdmin failed:",
                error
            );

        }

    }


    /*
       Bootstrap fallback
    */

    if(
        window.Admin &&
        window.Admin.user
    ){

        return window.Admin.user;

    }


    /*
       Legacy compatibility
    */

    if(
        typeof window.getAdmin ===
        "function"
    ){

        try{

            const admin =
                await Promise.resolve(
                    window.getAdmin()
                );

            if(admin){

                return admin;

            }

        }catch(error){

            console.warn(
                "[UNIFIED ADMIN] Legacy getAdmin failed:",
                error
            );

        }

    }

    return null;

}


/* =========================================
   GET ROLE
========================================= */

function getUnifiedAdminRole(
    admin
){

    if(!admin){

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


/* =========================================
   REQUIRE ROLE
   Compatibility helper
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

    if(
        !allowed.includes(role)
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
   PERMISSION CHECK
========================================= */

async function checkPermission(
    permission
){

    const admin =
        await getUnifiedAdmin();

    if(!admin){

        return false;

    }

    const role =
        getUnifiedAdminRole(admin);

    /*
       Super Admin = full permission.
    */

    if(role === "super_admin"){

        return true;

    }


    /*
       Use existing permission engine.
    */

    if(
        typeof window.hasPermission ===
        "function"
    ){

        try{

            return await window.hasPermission(
                permission
            );

        }catch(error){

            console.warn(
                "[UNIFIED ADMIN] Permission check failed:",
                permission,
                error
            );

        }

    }


    /*
       Bootstrap permissions fallback.

       This is only used if
       admin-permissions.js is not available.
    */

    if(
        window.Admin &&
        Array.isArray(window.Admin.permissions)
    ){

        const list =
            window.Admin.permissions
                .map(
                    item =>
                        typeof item === "string"
                            ? item
                            : item?.permission
                )
                .filter(Boolean);

        if(list.includes("*")){

            return true;

        }

        return list.includes(
            permission
        );

    }

    return false;

}


/* =========================================
   ANY PERMISSION
========================================= */

async function hasAnyPermission(
    permissions = []
){

    const admin =
        await getUnifiedAdmin();

    if(!admin){

        return false;

    }

    const role =
        getUnifiedAdminRole(admin);

    if(role === "super_admin"){

        return true;

    }

    if(!Array.isArray(permissions)){

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
           Unknown button:
           deny by default.

           This prevents accidental exposure.
        */

        return false;

    }

    if(
        permissions.includes("*")
    ){

        const admin =
            await getUnifiedAdmin();

        return (
            getUnifiedAdminRole(admin)
            === "super_admin"
        );

    }

    return await hasAnyPermission(
        permissions
    );

}


/* =========================================
   BUTTON ELEMENT MAP
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
   APPLY BUTTON ACCESS
========================================= */

async function applyButtonPermissions(){

    for(
        const [
            key,
            config
        ]
        of Object.entries(BUTTON_MAP)
    ){

        const button =
            document.querySelector(
                config.selector
            );

        if(!button){

            continue;

        }

        const allowed =
            await canUseButton(key);


        /*
           Hide unauthorized buttons.

           We do not remove the element.
           This preserves existing HTML/CSS.
        */

        if(allowed){

            button.style.display =
                "";

            button.disabled =
                false;

            button.removeAttribute(
                "aria-disabled"
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

        }

    }

}


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
        getUnifiedAdminRole(admin);

    badge.innerText =
        role
            .replace(/_/g, " ")
            .toUpperCase();

}


/* =========================================
   OPTIONAL ENVIRONMENT BADGE
========================================= */

function renderEnvironmentBadge(){

    const badge =
        document.getElementById(
            "adminEnvironmentBadge"
        );

    if(!badge){

        return;

    }

    badge.innerText =
        CURRENT_ENVIRONMENT
            .toUpperCase();

    badge.dataset.environment =
        CURRENT_ENVIRONMENT;

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


    if(!Array.isArray(transactions)){

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


        if(balance < 100){

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
   EXTERNAL PROJECT BADGE
   LEGACY COMPATIBILITY
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

        const raw =
            localStorage.getItem(
                "albukhr_external_projects"
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
            "[UNIFIED ADMIN] External local cache unavailable:",
            error
        );

    }


    const pending =
        projects.filter(
            project =>
                project &&
                project.status === "pending"
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
   LEGACY COMPATIBILITY
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

        const raw =
            localStorage.getItem(
                "albukhr_dapp_requests"
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
            "[UNIFIED ADMIN] DApp local cache unavailable:",
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

            if(balance < 50){

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

                /*
                   IMPORTANT:
                   This function is async.
                */

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


                if(liquidity < 30){

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


/* =========================================
   TRIGGER CRITICAL ALERT
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


/* =========================================
   INITIALIZE
========================================= */

async function initializeUnifiedAdminButtons(){

    const admin =
        await getUnifiedAdmin();


    if(!admin){

        window.location.replace(
            "admin-login.html"
        );

        return false;

    }


    const role =
        getUnifiedAdminRole(admin);


    if(
        !isAllowedAdminRole(role)
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


    /*
       Role badge.
    */

    renderRoleBadge(
        admin
    );


    /*
       Environment.
    */

    renderEnvironmentBadge();


    /*
       Apply database permissions.
    */

    await applyButtonPermissions();


    /*
       Alerts.
    */

    await updateAdminAlerts();


    /*
       Critical treasury checks.
    */

    await checkCriticalRisk();


    /*
       Expose current admin state.
    */

    window.ALBUKHR_CURRENT_ADMIN =
        admin;


    console.log(
        "✅ ALBUKHR Unified Admin Buttons Ready"
    );

    console.log(
        "Environment:",
        CURRENT_ENVIRONMENT
    );

    console.log(
        "Role:",
        role
    );


    return true;

}


/* =========================================
   EXPORTS
========================================= */

window.getAdminEnvironment =
    getAdminEnvironment;

window.getUnifiedAdmin =
    getUnifiedAdmin;

window.getUnifiedAdminRole =
    getUnifiedAdminRole;

window.isAllowedAdminRole =
    isAllowedAdminRole;

window.checkPermission =
    checkPermission;

window.hasAnyPermission =
    hasAnyPermission;

window.canUseButton =
    canUseButton;

window.applyButtonPermissions =
    applyButtonPermissions;

window.updateAdminAlerts =
    updateAdminAlerts;

window.updateTxBadge =
    updateTxBadge;

window.updateWalletBadge =
    updateWalletBadge;

window.updateExternalBadge =
    updateExternalBadge;

window.updateDappBadge =
    updateDappBadge;

window.checkCriticalRisk =
    checkCriticalRisk;

window.triggerCriticalAlert =
    triggerCriticalAlert;

window.initializeUnifiedAdminButtons =
    initializeUnifiedAdminButtons;


/* =========================================
   DOM READY
========================================= */

if(
    document.readyState ===
    "loading"
){

    document.addEventListener(
        "DOMContentLoaded",
        initializeUnifiedAdminButtons
    );

}else{

    initializeUnifiedAdminButtons();

}


/* =========================================
   REFRESH ALERTS
========================================= */

setInterval(
    async function(){

        try{

            await updateAdminAlerts();

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
   REFRESH CRITICAL RISK
========================================= */

setInterval(
    async function(){

        try{

            await checkCriticalRisk();

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
