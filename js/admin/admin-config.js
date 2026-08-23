/* ==========================================
   ALBUKHR ADMIN DASHBOARD CONFIG v2
   ARCHITECTURE-SAFE CONFIGURATION LAYER

   PURPOSE:
   - Static admin UI configuration only
   - No Supabase access
   - No authentication logic
   - No LocalStorage persistence
   - No network/environment state
   - No business logic

   DEPENDS ON:
   - Nothing

   USED BY:
   - js/admin/admin-auth.js
   - js/admin/admin-permissions.js
   - js/admin/admin-data.js
   - js/admin/admin-alerts.js
   - js/admin/admin-dashboard.js
========================================== */

(function(window){

  "use strict";

  const REFRESH = Object.freeze({
    INTERVAL: 5000
  });

  const PAGES = Object.freeze({
    LOGIN: "admin-login.html",
    DASHBOARD: "unified-admin-buttons.html"
  });

  const BUTTONS = Object.freeze({
    CORE_PROJECTS: "coreProjectsBtn",
    ECOSYSTEM: "ecosystemBtn",
    DAPPS: "dappBtn",
    CONTRIBUTORS: "contributorsBtn",
    TRANSACTIONS: "transactionsBtn",
    RISK: "riskBtn",
    INTERNAL: "internalProjectsBtn",
    EXTERNAL_ADMIN: "externalAdminBtn",
    EXTERNAL_DASHBOARD: "externalDashboardBtn",
    EXTERNAL_REVIEW: "externalReviewBtn",
    ESCROW: "escrowBtn",
    SUPER_ADMIN: "superAdminBtn",
    PERMISSIONS: "permissionsBtn",
    WALLET: "walletBtn",
    CONTROL_CENTER: "controlCenterBtn",
    LOGOUT: "logoutBtn"
  });

  const BADGES = Object.freeze({
    CORE: "coreBadge",
    ECOSYSTEM: "ecosystemBadge",
    DAPPS: "dappBadge",
    CONTRIBUTORS: "contributorsBadge",
    TRANSACTIONS: "txBadge",
    RISK: "riskBadge",
    INTERNAL: "internalBadge",
    EXTERNAL_ADMIN: "externalAdminBadge",
    EXTERNAL_DASHBOARD: "externalDashBadge",
    EXTERNAL_REVIEW: "externalReviewBadge",
    ESCROW: "escrowBadge",
    SUPER_ADMIN: "superBadge",
    PERMISSIONS: "permissionsBadge",
    WALLET: "walletBadge",
    CONTROL_CENTER: "controlBadge"
  });

  const HEADER = Object.freeze({
    ROLE_BADGE: "adminRoleBadge"
  });

  const ALERTS = Object.freeze({
    BANNER: "criticalAlert",
    SOUND: "alertSound"
  });

  window.AdminDashboardConfig = Object.freeze({
    REFRESH,
    PAGES,
    BUTTONS,
    BADGES,
    HEADER,
    ALERTS
  });

})(window);
