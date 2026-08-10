/* ==========================================
   ALBUKHR ADMIN DASHBOARD HEADER
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

function init(admin){

    if(!admin){

        return;

    }

    showRoleBadge(admin);

}

/* ==========================================
   ROLE BADGE
========================================== */

function showRoleBadge(admin){

    const id =

    Config.HEADER.ROLE_BADGE;

    let role =

    admin.role_code || "";

    role =

    String(role)

    .replaceAll("_"," ")

    .toUpperCase();

    Utils.text(

        id,

        role

    );

}

/* ==========================================
   ADMIN NAME
========================================== */

function getAdminName(admin){

    if(!admin){

        return "";

    }

    return (

        admin.full_name ||

        admin.username ||

        "Administrator"

    );

}

/* ==========================================
   ADMIN EMAIL
========================================== */

function getAdminEmail(admin){

    if(!admin){

        return "";

    }

    return admin.email || "";

}

/* ==========================================
   IS SUPER ADMIN
========================================== */

function isSuperAdmin(admin){

    return (

        admin &&

        admin.role_code ===

        "super_admin"

    );

}

/* ==========================================
   EXPORT
========================================== */

window.AdminDashboardHeader = {

    init,

    showRoleBadge,

    getAdminName,

    getAdminEmail,

    isSuperAdmin

};

})(window);
