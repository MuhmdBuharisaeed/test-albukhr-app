/* ==========================================
   ALBUKHR ADMIN GUARD ENGINE
   Version 3.0
========================================== */

(function(window){

"use strict";

/* ==========================================
   REQUIRE LOGIN
========================================== */

async function requireAdmin(){

    const admin =
    await getCurrentAdmin();

    if(!admin){

        location.replace(
            "admin-login.html"
        );

        return null;

    }

    return admin;

}

/* ==========================================
   REQUIRE ROLE
========================================== */

async function requireRole(roleCode){

    const admin =
    await requireAdmin();

    if(!admin){

        return false;

    }

    if(admin.role_code !== roleCode){

        alert(
            "Access denied."
        );

        location.replace(
            "unified-admin-buttons.html"
        );

        return false;

    }

    return true;

}

/* ==========================================
   REQUIRE ANY ROLE
========================================== */

async function requireAnyRole(roles=[]){

    const admin =
    await requireAdmin();

    if(!admin){

        return false;

    }

    if(!roles.includes(admin.role_code)){

        alert(
            "Access denied."
        );

        location.replace(
            "unified-admin-buttons.html"
        );

        return false;

    }

    return true;

}

/* ==========================================
   REQUIRE PERMISSION
========================================== */

async function requirePermission(permission){

    const admin =
    await requireAdmin();

    if(!admin){

        return false;

    }

    const allowed =
    await hasPermission(permission);

    if(!allowed){

        alert(
            "You don't have permission."
        );

        location.replace(
            "unified-admin-buttons.html"
        );

        return false;

    }

    return true;

}

/* ==========================================
   EXPORT
========================================== */

window.requireAdmin =
requireAdmin;

window.requireRole =
requireRole;

window.requireAnyRole =
requireAnyRole;

window.requirePermission =
requirePermission;

})(window);
