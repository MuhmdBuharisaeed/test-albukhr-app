/* ==========================================
   ALBUKHR ADMIN DASHBOARD CONFIG
   Version 1.0
========================================== */

(function(window){

"use strict";

/* ==========================================
   REFRESH
========================================== */

const REFRESH = {

    INTERVAL: 5000

};

/* ==========================================
   PAGES
========================================== */

const PAGES = {

    LOGIN:
    "admin-login.html",

    DASHBOARD:
    "unified-admin-buttons.html"

};

/* ==========================================
   BUTTON IDS
========================================== */

const BUTTONS = {

    CORE_PROJECTS:
    "coreProjectsBtn",

    ECOSYSTEM:
    "ecosystemBtn",

    DAPPS:
    "dappBtn",

    CONTRIBUTORS:
    "contributorsBtn",

    TRANSACTIONS:
    "transactionsBtn",

    RISK:
    "riskBtn",

    INTERNAL:
    "internalProjectsBtn",

    EXTERNAL_ADMIN:
    "externalAdminBtn",

    EXTERNAL_DASHBOARD:
    "externalDashboardBtn",

    EXTERNAL_REVIEW:
    "externalReviewBtn",

    ESCROW:
    "escrowBtn",

    SUPER_ADMIN:
    "superAdminBtn",

    PERMISSIONS:
    "permissionsBtn",

    WALLET:
    "walletBtn",

    CONTROL_CENTER:
    "controlCenterBtn",

    LOGOUT:
    "logoutBtn"

};

/* ==========================================
   BADGES
========================================== */

const BADGES = {

    CORE:
    "coreBadge",

    ECOSYSTEM:
    "ecosystemBadge",

    DAPPS:
    "dappBadge",

    CONTRIBUTORS:
    "contributorsBadge",

    TRANSACTIONS:
    "txBadge",

    RISK:
    "riskBadge",

    INTERNAL:
    "internalBadge",

    EXTERNAL_ADMIN:
    "externalAdminBadge",

    EXTERNAL_DASHBOARD:
    "externalDashBadge",

    EXTERNAL_REVIEW:
    "externalReviewBadge",

    ESCROW:
    "escrowBadge",

    SUPER_ADMIN:
    "superBadge",

    PERMISSIONS:
    "permissionsBadge",

    WALLET:
    "walletBadge",

    CONTROL_CENTER:
    "controlBadge"

};

/* ==========================================
   HEADER
========================================== */

const HEADER = {

    ROLE_BADGE:
    "adminRoleBadge"

};

/* ==========================================
   ALERTS
========================================== */

const ALERTS = {

    BANNER:
    "criticalAlert",

    SOUND:
    "alertSound"

};

/* ==========================================
   EXPORT
========================================== */

window.AdminDashboardConfig = {

    REFRESH,

    PAGES,

    BUTTONS,

    BADGES,

    HEADER,

    ALERTS

};

})(window);
