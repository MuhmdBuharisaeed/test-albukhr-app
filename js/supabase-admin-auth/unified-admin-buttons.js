/* =========================================
   ALBUKHR UNIFIED ADMIN BUTTONS
   Version 4.0 - HARDENED

   DEPENDS ON:
   1) admin-supabase-auth.js
   2) admin-session.js
   3) admin-permissions.js
   4) admin-bootstrap.js

   PURPOSE:
   - Unified Admin Control Center
   - Central Admin UI authorization gateway
   - Page/direct-URL protection (fail closed)
   - Permission-aware navigation/buttons
   - Shared authorization helpers for other Admin JS
   - Admin alerts / critical risk monitoring
   - MAINNET / TESTNET awareness

   SECURITY MODEL:
   - Authentication authority: admin-bootstrap.js
   - Authorization authority: admin-permissions.js
   - Session authority: admin-session.js
   - Supabase client authority: admin-supabase-auth.js
   - This engine NEVER creates a Supabase client.
   - This engine NEVER performs a second Admin login.
   - This engine NEVER signs out an Admin.
   - This engine NEVER uses LocalStorage/sessionStorage
     as authentication, authorization, or application state.
   - UI hiding is NOT treated as the security boundary.
   - Protected pages are locked when authorization cannot
     be established.
   - Privileged Admin JS should call requireAdminPermission()
     before sensitive operations.
   - Database/RLS remains the final server-side security boundary.

   IMPORTANT:
   This file cannot magically secure an arbitrary page or
   privileged JS file that never loads/calls this security layer.
   Therefore this version exposes reusable guards and also
   automatically protects mapped Admin pages when this file
   is included there.
========================================= */

(function(window){

"use strict";


/* =========================================
   CONFIG
========================================= */

const ADMIN_ROLES = Object.freeze([

    "super_admin",
    "finance_admin",
    "review_admin",
    "viewer_admin"

]);


/* =========================================
   BUTTON PERMISSIONS
   Arrays use ANY-of semantics.
========================================= */

const BUTTON_PERMISSIONS = Object.freeze({

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

});


/* =========================================
   BUTTON MAP
========================================= */

const BUTTON_MAP = Object.freeze({

    coreProjectsDashboard: {

        selector:
            'button[onclick*="Albukhr-core-projects-dashboard.html"]',

        page:
            "Albukhr-core-projects-dashboard.html"

    },

    ecosystemDashboard: {

        selector:
            'button[onclick*="ALBUKHR-ecosystem-dashboard.html"]',

        page:
            "ALBUKHR-ecosystem-dashboard.html"

    },

    dappRequests: {

        selector:
            'button[onclick*="admin-dapp-requests.html"]',

        page:
            "admin-dapp-requests.html"

    },

    contributors: {

        selector:
            'button[onclick*="admin-contributors.html"]',

        page:
            "admin-contributors.html"

    },

    transactions: {

        selector:
            'button[onclick*="admin-transactions.html"]',

        page:
            "admin-transactions.html"

    },

    riskMonitor: {

        selector:
            'button[onclick*="admin-risk-monitor.html"]',

        page:
            "admin-risk-monitor.html"

    },

    internalProjects: {

        selector:
            'button[onclick*="admin-internal-projects.html"]',

        page:
            "admin-internal-projects.html"

    },

    externalAdmin: {

        selector:
            'button[onclick*="admin-external-panel.html"]',

        page:
            "admin-external-panel.html"

    },

    externalDashboard: {

        selector:
            'button[onclick*="admin-external-dashboard.html"]',

        page:
            "admin-external-dashboard.html"

    },

    externalReviews: {

        selector:
            'button[onclick*="external-project-view.html"]',

        page:
            "external-project-view.html"

    },

    escrow: {

        selector:
            'button[onclick*="escrow-admin.html"]',

        page:
            "escrow-admin.html"

    },

    superAdmin: {

        selector:
            'button[onclick*="super-admin-dashboard.html"]',

        page:
            "super-admin-dashboard.html"

    },

    permissions: {

        selector:
            'button[onclick*="admin-permissions.html"]',

        page:
            "admin-permissions.html"

    },

    wallet: {

        selector:
            'button[onclick*="admin-wallet.html"]',

        page:
            "admin-wallet.html"

    },

    controlCenter: {

        selector:
            'button[onclick*="ALBUKHR-ecosystem-control-center.html"]',

        page:
            "ALBUKHR-ecosystem-control-center.html"

    }

});


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


function normalize(
    value
){

    return safeString(value)
        .trim()
        .toLowerCase();

}


function normalizePermission(
    value
){

    return normalize(value);

}


/* =========================================
   ADMIN ENVIRONMENT
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
            "[UNIFIED ADMIN] Environment lookup failed:",
            error
        );

    }


    /*
       Hostname fallback is display/network context only.
       It NEVER authenticates or authorizes an Admin.
    */

    const hostname =
        safeString(
            window.location?.hostname
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


window.getAdminEnvironment =
    getAdminEnvironment;


function getCurrentAdminEnvironment(){

    return getAdminEnvironment();

}


window.getCurrentAdminEnvironment =
    getCurrentAdminEnvironment;


/* =========================================
   ADMIN NETWORK
========================================= */

function getAdminNetwork(){

    try{

        if(
            typeof window.getAlbukhrAdminNetwork ===
            "function"
        ){

            const network =
                window.getAlbukhrAdminNetwork();


            if(
                network
            ){

                return network;

            }

        }

    }catch(error){

        console.warn(
            "[UNIFIED ADMIN] Network lookup failed:",
            error
        );

    }


    return getAdminEnvironment();

}


window.getAdminNetwork =
    getAdminNetwork;


window.ALBUKHR_ADMIN_ENVIRONMENT =
    getCurrentAdminEnvironment();


window.ALBUKHR_ADMIN_NETWORK =
    getAdminNetwork();


/* =========================================
   BOOTSTRAP STATE
========================================= */

function isAdminBootstrapReady(){

    return Boolean(

        window.Admin &&
        window.Admin.ready === true &&
        window.Admin.profile

    );

}


window.isAdminBootstrapReady =
    isAdminBootstrapReady;


/* =========================================
   BOOTSTRAP INITIALIZATION LOCK
========================================= */

let bootstrapInitialization =
    null;


async function ensureAdminBootstrap(){

    if(
        isAdminBootstrapReady()
    ){

        return true;

    }


    if(
        typeof window.initializeAdmin !==
        "function"
    ){

        console.error(
            "[UNIFIED ADMIN] Admin Bootstrap Engine is not loaded."
        );

        return false;

    }


    if(
        bootstrapInitialization
    ){

        return await bootstrapInitialization;

    }


    bootstrapInitialization =
        (async function(){

            try{

                const ready =
                    await window.initializeAdmin();


                if(
                    !ready
                ){

                    return false;

                }


                return isAdminBootstrapReady();

            }catch(error){

                console.error(
                    "[UNIFIED ADMIN] Bootstrap initialization failed:",
                    error
                );

                return false;

            }

        })();


    try{

        return await bootstrapInitialization;

    }finally{

        bootstrapInitialization =
            null;

    }

}


window.ensureAdminBootstrap =
    ensureAdminBootstrap;


/* =========================================
   GET BOOTSTRAPPED ADMIN
========================================= */

async function getUnifiedAdmin(){

    if(
        isAdminBootstrapReady()
    ){

        return window.Admin.profile;

    }


    const ready =
        await ensureAdminBootstrap();


    if(
        ready &&
        isAdminBootstrapReady()
    ){

        return window.Admin.profile;

    }


    /*
       Fail closed.
       No getCurrentAdmin() fallback.
    */

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

        if(
            window.Admin &&
            window.Admin.ready === true
        ){

            return normalize(

                window.Admin.role ??
                window.Admin.profile?.role_code ??
                window.Admin.profile?.role ??
                ""

            );

        }

        return "";

    }


    return normalize(

        admin.role_code ??
        admin.role ??
        window.Admin?.role ??
        ""

    );

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
        normalize(role)
    );

}


window.isAllowedAdminRole =
    isAllowedAdminRole;


/* =========================================
   GET ADMIN PERMISSIONS
========================================= */

function getUnifiedAdminPermissions(
    admin = null
){

    const source =
        admin ||
        window.Admin?.profile ||
        window.Admin ||
        null;


    if(!source){

        return [];

    }


    const candidates = [];


    if(
        Array.isArray(source.permissions)
    ){

        candidates.push(
            ...source.permissions
        );

    }


    if(
        Array.isArray(window.Admin?.permissions)
    ){

        candidates.push(
            ...window.Admin.permissions
        );

    }


    const result =
        candidates
            .map(
                item => {

                    if(
                        typeof item ===
                        "string"
                    ){

                        return item;

                    }


                    if(
                        item &&
                        typeof item ===
                        "object"
                    ){

                        return (
                            item.permission ??
                            item.permission_code ??
                            item.code ??
                            item.name ??
                            ""
                        );

                    }


                    return "";

                }
            )
            .map(
                normalizePermission
            )
            .filter(Boolean);


    return [
        ...new Set(result)
    ];

}


window.getUnifiedAdminPermissions =
    getUnifiedAdminPermissions;


/* =========================================
   REQUIRE ROLE
========================================= */

async function requireRole(
    roles = []
){

    const admin =
        await getUnifiedAdmin();


    if(!admin){

        console.warn(
            "[UNIFIED ADMIN] Admin state is not ready."
        );

        return null;

    }


    const role =
        getUnifiedAdminRole(
            admin
        );


    if(
        !isAllowedAdminRole(role)
    ){

        console.warn(
            "[UNIFIED ADMIN] Invalid Admin role:",
            role
        );

        return null;

    }


    const allowed =
        Array.isArray(roles)
            ? roles
            : [roles];


    const normalized =
        allowed
            .map(normalize)
            .filter(Boolean);


    if(
        normalized.length &&
        !normalized.includes(role)
    ){

        showAuthorizationDenied(
            "You are not authorized to access this Admin area."
        );

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
        normalizePermission(
            permission
        );


    if(!required){

        return false;

    }


    if(
        !isAdminBootstrapReady()
    ){

        return false;

    }


    const role =
        getUnifiedAdminRole(
            window.Admin.profile
        );


    if(
        !isAllowedAdminRole(role)
    ){

        return false;

    }


    if(
        role === "super_admin"
    ){

        return true;

    }


    const permissions =
        getUnifiedAdminPermissions(
            window.Admin.profile
        );


    if(
        permissions.includes("*")
    ){

        return true;

    }


    return permissions.includes(
        required
    );

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
   ALL PERMISSIONS
   Available for sensitive Admin JS.
========================================= */

async function hasAllPermissions(
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
            !(await checkPermission(permission))
        ){

            return false;

        }

    }


    return true;

}


window.hasAllPermissions =
    hasAllPermissions;


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

        return false;

    }


    if(
        permissions.includes("*")
    ){

        return (
            isAdminBootstrapReady() &&
            getUnifiedAdminRole(
                window.Admin.profile
            ) === "super_admin"
        );

    }


    return await hasAnyPermission(
        permissions
    );

}


window.canUseButton =
    canUseButton;


/* =========================================
   AUTHORIZE ADMIN ACTION
   Shared helper for other Admin JS.

   Example:
       const ok =
           await authorizeAdminAction(
               "finance.manage"
           );

   For multiple permissions, use:
       {
           all: ["finance.manage","approvals.manage"]
       }

   or:
       {
           any: ["finance.manage","approvals.manage"]
       }
========================================= */

async function authorizeAdminAction(
    requirement,
    options = {}
){

    if(
        !isAdminBootstrapReady()
    ){

        return false;

    }


    const role =
        getUnifiedAdminRole(
            window.Admin.profile
        );


    if(
        !isAllowedAdminRole(role)
    ){

        return false;

    }


    if(
        role === "super_admin"
    ){

        return true;

    }


    if(
        typeof requirement ===
        "string"
    ){

        return await checkPermission(
            requirement
        );

    }


    if(
        Array.isArray(requirement)
    ){

        const mode =
            options.mode === "all"
                ? "all"
                : "any";


        return mode === "all"
            ? await hasAllPermissions(requirement)
            : await hasAnyPermission(requirement);

    }


    if(
        requirement &&
        typeof requirement ===
        "object"
    ){

        if(
            Array.isArray(requirement.all)
        ){

            return await hasAllPermissions(
                requirement.all
            );

        }


        if(
            Array.isArray(requirement.any)
        ){

            return await hasAnyPermission(
                requirement.any
            );

        }

    }


    return false;

}


window.authorizeAdminAction =
    authorizeAdminAction;


/* =========================================
   REQUIRE ADMIN PERMISSION
   Hard guard for privileged Admin JS.
========================================= */

async function requireAdminPermission(
    requirement,
    options = {}
){

    const authorized =
        await authorizeAdminAction(
            requirement,
            options
        );


    if(
        !authorized
    ){

        if(
            options.silent !== true
        ){

            showAuthorizationDenied(
                options.message ||
                "You are not authorized to perform this Admin action."
            );

        }


        return null;

    }


    return (
        window.Admin?.profile ||
        null
    );

}


window.requireAdminPermission =
    requireAdminPermission;


/* =========================================
   APPLY BUTTON PERMISSIONS
========================================= */

async function applyButtonPermissions(){

    if(
        !isAdminBootstrapReady()
    ){

        console.warn(
            "[UNIFIED ADMIN] Cannot apply button permissions before Admin Bootstrap is ready."
        );

        return false;

    }


    for(
        const [
            key,
            config
        ]
        of Object.entries(
            BUTTON_MAP
        )
    ){

        const buttons =
            document.querySelectorAll(
                config.selector
            );


        if(!buttons.length){

            continue;

        }


        const allowed =
            await canUseButton(key);


        buttons.forEach(
            button => {

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

                    button.removeAttribute(
                        "data-admin-denied"
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

                    button.setAttribute(
                        "data-admin-denied",
                        "true"
                    );

                }

            }
        );

    }


    return true;

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
        environment.toUpperCase();


    badge.dataset.environment =
        environment;


    badge.dataset.network =
        network;

}


/* =========================================
   AUTHORIZATION DENIED UI
========================================= */

function showAuthorizationDenied(
    message
){

    const text =
        safeString(
            message,
            "You are not authorized to access this Admin area."
        );


    /*
       Prefer an existing Admin denial UI.
    */

    const existing =
        document.getElementById(
            "adminAuthorizationDenied"
        );


    if(existing){

        existing.textContent =
            text;

        existing.style.display =
            "block";

        return;

    }


    /*
       Do not redirect and do not logout.
       A lightweight alert is only a compatibility
       fallback for button/action denial.
    */

    if(
        typeof window.alert ===
        "function"
    ){

        window.alert(text);

    }

}


window.showAuthorizationDenied =
    showAuthorizationDenied;


/* =========================================
   ADMIN PAGE LOCK
   Fail closed when this engine is loaded
   on a protected Admin page and the required
   authorization cannot be established.
========================================= */

function createAdminLockOverlay(
    message
){

    let overlay =
        document.getElementById(
            "albukhrAdminSecurityLock"
        );


    if(!overlay){

        overlay =
            document.createElement(
                "div"
            );

        overlay.id =
            "albukhrAdminSecurityLock";

        overlay.setAttribute(
            "role",
            "alert"
        );

        overlay.setAttribute(
            "aria-live",
            "assertive"
        );

        Object.assign(
            overlay.style,
            {
                position: "fixed",
                inset: "0",
                zIndex: "2147483647",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px",
                background: "#ffffff",
                color: "#111111",
                fontFamily:
                    "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
                textAlign: "center"
            }
        );


        const panel =
            document.createElement(
                "div"
            );


        Object.assign(
            panel.style,
            {
                width: "min(520px, 100%)",
                padding: "28px",
                borderRadius: "16px",
                border: "1px solid #dddddd",
                background: "#ffffff",
                boxShadow:
                    "0 20px 60px rgba(0,0,0,.18)"
            }
        );


        const title =
            document.createElement(
                "h1"
            );


        title.textContent =
            "Admin Access Protected";


        title.style.margin =
            "0 0 12px";


        const body =
            document.createElement(
                "p"
            );


        body.id =
            "albukhrAdminSecurityLockMessage";


        body.style.margin =
            "0";


        panel.appendChild(
            title
        );

        panel.appendChild(
            body
        );

        overlay.appendChild(
            panel
        );

        document.documentElement.appendChild(
            overlay
        );

    }


    const body =
        document.getElementById(
            "albukhrAdminSecurityLockMessage"
        );


    if(body){

        body.textContent =
            safeString(
                message,
                "Admin authorization could not be established. Access is blocked."
            );

    }


    return overlay;

}


function lockAdminPage(
    message
){

    /*
       Make the page inert before showing the
       security overlay.
    */

    try{

        document.documentElement
            .setAttribute(
                "data-albukhr-admin-locked",
                "true"
            );

        document.body?.setAttribute(
            "aria-hidden",
            "true"
        );

    }catch(error){

        console.warn(
            "[UNIFIED ADMIN] Could not mark page locked:",
            error
        );

    }


    createAdminLockOverlay(
        message
    );


    return false;

}


window.lockAdminPage =
    lockAdminPage;


/* =========================================
   PAGE REQUIREMENT LOOKUP
========================================= */

function getCurrentPageName(){

    return safeString(
        window.location?.pathname
    )
    .split("/")
    .pop()
    .split("?")[0]
    .split("#")[0]
    .toLowerCase();

}


function getButtonKeyForPage(
    page
){

    const normalized =
        safeString(page)
            .split("/")
            .pop()
            .toLowerCase();


    for(
        const [
            key,
            config
        ]
        of Object.entries(
            BUTTON_MAP
        )
    ){

        if(
            safeString(config.page)
                .toLowerCase() ===
            normalized
        ){

            return key;

        }

    }


    return null;

}


window.getButtonKeyForPage =
    getButtonKeyForPage;


/* =========================================
   CURRENT ADMIN PAGE GUARD
========================================= */

async function guardCurrentAdminPage(){

    const page =
        getCurrentPageName();


    if(!page){

        return true;

    }


    const buttonKey =
        getButtonKeyForPage(
            page
        );


    /*
       Page is not part of this unified map.
       Do not block unrelated public pages.
    */

    if(!buttonKey){

        return true;

    }


    /*
       Authentication/Bootstrap failure:
       fail closed. Bootstrap itself remains the
       only authority that may perform auth redirects.
    */

    const admin =
        await getUnifiedAdmin();


    if(!admin){

        return lockAdminPage(
            "Admin authentication could not be verified. Access has been blocked."
        );

    }


    const role =
        getUnifiedAdminRole(
            admin
        );


    if(
        !isAllowedAdminRole(role)
    ){

        return lockAdminPage(
            "This account is not authorized to access the ALBUKHR Admin area."
        );

    }


    const allowed =
        await canUseButton(
            buttonKey
        );


    if(!allowed){

        return lockAdminPage(
            "You do not have permission to access this Admin page."
        );

    }


    return true;

}


window.guardCurrentAdminPage =
    guardCurrentAdminPage;


/* =========================================
   SECURE NAVIGATION
========================================= */

async function secureNavigate(
    page,
    buttonKey = null
){

    const target =
        safeString(page)
            .trim();


    if(!target){

        return false;

    }


    const key =
        buttonKey ||
        getButtonKeyForPage(
            target
        );


    if(key){

        const allowed =
            await canUseButton(key);


        if(!allowed){

            showAuthorizationDenied(
                "You are not authorized to open this Admin page."
            );

            return false;

        }

    }else{

        /*
           Unknown navigation target is not automatically
           treated as an Admin route. Callers performing
           privileged navigation should pass buttonKey.
        */

        if(
            !isAdminBootstrapReady()
        ){

            return false;

        }

    }


    window.location.href =
        target;


    return true;

}


window.secureNavigate =
    secureNavigate;


/* =========================================
   LEGACY / COMPATIBILITY NAVIGATION
========================================= */

function go(
    page,
    buttonKey = null
){

    /*
       Preserve existing go("page.html") calls while
       converting known Admin destinations into guarded
       navigation.
    */

    return secureNavigate(
        page,
        buttonKey
    );

}


window.go =
    go;


/* =========================================
   BUTTON CLICK PROTECTION
   This blocks mapped Admin buttons even if an
   inline onclick tries to navigate directly.
========================================= */

let clickProtectionInstalled =
    false;


function installAdminButtonClickProtection(){

    if(
        clickProtectionInstalled
    ){

        return;

    }


    if(
        !document ||
        typeof document.addEventListener !==
        "function"
    ){

        return;

    }


    clickProtectionInstalled =
        true;


    document.addEventListener(
        "click",
        async function(event){

            try{

                const target =
                    event.target;


                const button =
                    target?.closest?.(
                        "button"
                    );


                if(!button){

                    return;

                }


                let matchedKey =
                    null;


                for(
                    const [
                        key,
                        config
                    ]
                    of Object.entries(
                        BUTTON_MAP
                    )
                ){

                    if(
                        button.matches(
                            config.selector
                        )
                    ){

                        matchedKey =
                            key;

                        break;

                    }

                }


                if(!matchedKey){

                    return;

                }


                /*
                   Stop direct inline onclick until permission
                   has been verified.
                */

                event.preventDefault();
                event.stopImmediatePropagation();


                const allowed =
                    await canUseButton(
                        matchedKey
                    );


                if(!allowed){

                    showAuthorizationDenied(
                        "You are not authorized to open this Admin area."
                    );

                    return;

                }


                const page =
                    BUTTON_MAP[
                        matchedKey
                    ]?.page;


                if(page){

                    window.location.href =
                        page;

                }

            }catch(error){

                /*
                   Fail closed for protected navigation.
                */

                console.error(
                    "[UNIFIED ADMIN] Protected button navigation failed:",
                    error
                );

                event.preventDefault();
                event.stopImmediatePropagation();

            }

        },
        true
    );

}


window.installAdminButtonClickProtection =
    installAdminButtonClickProtection;


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


    if(
        !(await checkPermission("finance.manage"))
    ){

        badge.style.display =
            "none";

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
        !Array.isArray(transactions)
    ){

        transactions = [];

    }


    const risky =
        transactions.filter(
            tx =>
                tx &&
                tx.flag === "risk"
        );


    if(
        risky.length
    ){

        badge.style.display =
            "inline-block";

        badge.innerText =
            risky.length;

    }else{

        badge.style.display =
            "none";

    }

}


window.updateTxBadge =
    updateTxBadge;


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
        !(await checkPermission("finance.manage"))
    ){

        badge.style.display =
            "none";

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


window.updateWalletBadge =
    updateWalletBadge;


/* =========================================
   NETWORK CACHE KEY
   LEGACY COMPATIBILITY ONLY.

   IMPORTANT:
   This function no longer authorizes or stores
   application data. LocalStorage is NOT read or
   written by this security engine.
========================================= */

function getNetworkStorageKey(
    baseKey
){

    const network =
        getCurrentAdminEnvironment();


    return (
        `${safeString(baseKey)}_${network}`
    );

}


window.getNetworkStorageKey =
    getNetworkStorageKey;


/* =========================================
   EXTERNAL PROJECT BADGE
   Supabase/application-engine driven only.

   Supported providers:
   - getAdminExternalProjects()
   - getExternalProjects()
   - getExternalProjectRequests()
========================================= */

async function getExternalProjectsForBadge(){

    const providers = [

        "getAdminExternalProjects",
        "getExternalProjects",
        "getExternalProjectRequests"

    ];


    for(
        const name
        of providers
    ){

        if(
            typeof window[name] !==
            "function"
        ){

            continue;

        }


        try{

            const data =
                await Promise.resolve(
                    window[name]()
                );


            if(
                Array.isArray(data)
            ){

                return data;

            }


            if(
                Array.isArray(data?.data)
            ){

                return data.data;

            }


            if(
                Array.isArray(data?.projects)
            ){

                return data.projects;

            }

        }catch(error){

            console.warn(
                `[UNIFIED ADMIN] ${name} unavailable:`,
                error
            );

        }

    }


    return [];

}


async function updateExternalBadge(){

    const badge =
        document.getElementById(
            "externalBadge"
        );


    if(!badge){

        return;

    }


    if(
        !(await hasAnyPermission([
            "projects.manage",
            "approvals.manage"
        ]))
    ){

        badge.style.display =
            "none";

        return;

    }


    const projects =
        await getExternalProjectsForBadge();


    const pending =
        projects.filter(
            project =>
                project &&
                normalize(project.status) ===
                "pending"
        );


    if(
        pending.length
    ){

        badge.style.display =
            "inline-block";

        badge.innerText =
            pending.length;

    }else{

        badge.style.display =
            "none";

    }

}


window.updateExternalBadge =
    updateExternalBadge;


/* =========================================
   DAPP BADGE
   Supabase/application-engine driven only.
========================================= */

async function getDappRequestsForBadge(){

    const providers = [

        "getAdminDappRequests",
        "getDappRequests",
        "getAdminDAppRequests"

    ];


    for(
        const name
        of providers
    ){

        if(
            typeof window[name] !==
            "function"
        ){

            continue;

        }


        try{

            const data =
                await Promise.resolve(
                    window[name]()
                );


            if(
                Array.isArray(data)
            ){

                return data;

            }


            if(
                Array.isArray(data?.data)
            ){

                return data.data;

            }


            if(
                Array.isArray(data?.requests)
            ){

                return data.requests;

            }

        }catch(error){

            console.warn(
                `[UNIFIED ADMIN] ${name} unavailable:`,
                error
            );

        }

    }


    return [];

}


async function updateDappBadge(){

    const badge =
        document.getElementById(
            "dappBadge"
        );


    if(!badge){

        return;

    }


    if(
        !(await checkPermission("approvals.manage"))
    ){

        badge.style.display =
            "none";

        return;

    }


    const dapps =
        await getDappRequestsForBadge();


    const pending =
        dapps.filter(
            dapp =>
                dapp &&
                !(
                    dapp.reviewed === true ||
                    normalize(dapp.status) ===
                    "approved" ||
                    normalize(dapp.status) ===
                    "rejected"
                )
        );


    if(
        pending.length
    ){

        badge.style.display =
            "inline-block";

        badge.innerText =
            pending.length;

    }else{

        badge.style.display =
            "none";

    }

}


window.updateDappBadge =
    updateDappBadge;


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


    if(
        !(await hasAnyPermission([
            "risk.manage",
            "finance.manage"
        ]))
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


window.updateRiskBadgeSafe =
    updateRiskBadgeSafe;


/* =========================================
   UNIFIED ALERT ENGINE
========================================= */

async function updateAdminAlerts(){

    if(
        !isAdminBootstrapReady()
    ){

        return false;

    }


    await Promise.allSettled([

        updateRiskBadgeSafe(),

        updateTxBadge(),

        updateWalletBadge(),

        updateExternalBadge(),

        updateDappBadge()

    ]);


    return true;

}


window.updateAdminAlerts =
    updateAdminAlerts;


/* =========================================
   CRITICAL RISK
========================================= */

async function checkCriticalRisk(){

    if(
        !isAdminBootstrapReady()
    ){

        return false;

    }


    if(
        !(await hasAnyPermission([
            "risk.manage",
            "finance.manage"
        ]))
    ){

        return false;

    }


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

    if(
        unifiedInitialization
    ){

        return unifiedInitialization;

    }


    unifiedInitialization =
        (async function(){

            /* ==============================
               BOOTSTRAP
            ============================== */

            const bootstrapReady =
                await ensureAdminBootstrap();


            /*
               Fail closed.
               Bootstrap remains responsible for
               authentication redirects when appropriate.
            */

            if(
                !bootstrapReady
            ){

                /*
                   If this file is on a mapped Admin page,
                   block it. On unrelated pages, simply stop.
                */

                const page =
                    getCurrentPageName();


                if(
                    getButtonKeyForPage(page)
                ){

                    lockAdminPage(
                        "Admin authentication could not be verified. Access is blocked."
                    );

                }


                return false;

            }


            /* ==============================
               FINAL STATE
            ============================== */

            if(
                !isAdminBootstrapReady()
            ){

                return false;

            }


            const admin =
                window.Admin.profile;


            const role =
                getUnifiedAdminRole(
                    admin
                );


            /* ==============================
               ROLE
            ============================== */

            if(
                !isAllowedAdminRole(role)
            ){

                lockAdminPage(
                    "This account is not authorized to access the ALBUKHR Admin area."
                );

                return false;

            }


            /* ==============================
               CURRENT ADMIN PAGE GUARD
            ============================== */

            const pageAllowed =
                await guardCurrentAdminPage();


            if(
                !pageAllowed
            ){

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
               BUTTON CLICK PROTECTION
            ============================== */

            installAdminButtonClickProtection();


            /* ==============================
               ALERTS
            ============================== */

            await updateAdminAlerts();


            /* ==============================
               CRITICAL RISK
            ============================== */

            await checkCriticalRisk();


            /* ==============================
               CURRENT ADMIN STATE
            ============================== */

            window.ALBUKHR_CURRENT_ADMIN_ROLE =
                role;

            window.ALBUKHR_CURRENT_ADMIN_ENVIRONMENT =
                getCurrentAdminEnvironment();

            window.ALBUKHR_CURRENT_ADMIN_NETWORK =
                getAdminNetwork();


            /* ==============================
               READY
            ============================== */

            console.log(
                "✅ ALBUKHR Unified Admin Buttons v4.0 Ready"
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
           Retry is allowed when the Admin Bootstrap
           state was not established.
        */

        if(
            !isAdminBootstrapReady()
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


if(
    document.readyState ===
    "loading"
){

    document.addEventListener(

        "DOMContentLoaded",

        function(){

            /*
               Allow Admin Bootstrap its own
               DOMContentLoaded handler to initialize.
            */

            setTimeout(
                startUnifiedAdmin,
                0
            );

        },

        {
            once: true
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

            if(
                isAdminBootstrapReady()
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
                isAdminBootstrapReady()
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
