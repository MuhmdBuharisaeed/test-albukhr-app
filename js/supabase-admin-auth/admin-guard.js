/* ==========================================
   ALBUKHR ADMIN GUARD ENGINE
   Version 3.1
========================================== */

(function(window){

"use strict";

/* ==========================================
   REDIRECT
========================================== */

function redirect(url){

    location.replace(url);

}

/* ==========================================
   ACCESS DENIED
========================================== */

function accessDenied(message = "Access denied."){

    alert(message);

    redirect(
        "unified-admin-buttons.html"
    );

}

/* ==========================================
   REQUIRE LOGIN
========================================== */

async function requireAdmin(){

    try{

        const admin =
        await getCurrentAdmin();

        if(!admin){

            redirect(
                "admin-login.html"
            );

            return null;

        }

        return admin;

    }catch(error){

        console.error(error);

        redirect(
            "admin-login.html"
        );

        return null;

    }

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

        accessDenied();

        return false;

    }

    return true;

}

/* ==========================================
   REQUIRE ANY ROLE
========================================== */

async function requireAnyRole(roles = []){

    const admin =
    await requireAdmin();

    if(!admin){

        return false;

    }

    if(!roles.includes(admin.role_code)){

        accessDenied();

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

        accessDenied(
            "You don't have permission to access this page."
        );

        return false;

    }

    return true;

}

/* ==========================================
   REQUIRE ALL PERMISSIONS
========================================== */

async function requirePermissions(permissions = []){

    const admin =
    await requireAdmin();

    if(!admin){

        return false;

    }

    for(const permission of permissions){

        const allowed =
        await hasPermission(permission);

        if(!allowed){

            accessDenied(
                "Required permission missing."
            );

            return false;

        }

    }

    return true;

}

/* ==========================================
   REQUIRE SUPER ADMIN
========================================== */

async function requireSuperAdmin(){

    return await requireRole(
        "super_admin"
    );

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

window.requirePermissions =
requirePermissions;

window.requireSuperAdmin =
requireSuperAdmin;

})(window);
