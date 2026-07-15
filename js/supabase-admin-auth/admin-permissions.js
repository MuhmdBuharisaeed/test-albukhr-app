/* ==========================================
   ALBUKHR ADMIN PERMISSIONS ENGINE
   Version 4.0
========================================== */

(function(window){

"use strict";

const TABLE = "admin_permissions";

let permissionCache = [];

/* ==========================================
   AUTH
========================================== */

function getAuth(){

    if(window.AlbukhrAuth){

        return window.AlbukhrAuth;

    }

    throw new Error(
        "AlbukhrAuth not initialized."
    );

}

/* ==========================================
   LOAD ROLE PERMISSIONS
========================================== */

async function getRolePermissions(roleCode){

    try{

        const { data, error } =

        await getAuth()

        .client

        .from(TABLE)

        .select("*")

        .eq("role_code", roleCode)

        .eq("enabled", true);

        if(error){

            throw error;

        }

        permissionCache = data || [];

        return permissionCache;

    }catch(error){

        console.error(

            "[PERMISSIONS]",

            error

        );

        permissionCache = [];

        return [];

    }

}

/* ==========================================
   HAS PERMISSION
========================================== */

async function hasPermission(permission){

    if(!permission){

        return true;

    }

    if(permissionCache.length === 0){

        const admin =

        await getCurrentAdmin();

        if(!admin){

            return false;

        }

        await getRolePermissions(

            admin.role_code

        );

    }

    return permissionCache.some(

        p => p.permission_code === permission

    );

}

/* ==========================================
   REQUIRE PERMISSION
========================================== */

async function requirePermission(permission){

    const allowed =

    await hasPermission(permission);

    if(!allowed){

        location.replace(

            "unified-admin-buttons.html"

        );

        return false;

    }

    return true;

}

/* ==========================================
   CLEAR CACHE
========================================== */

function clearPermissionCache(){

    permissionCache = [];

}

/* ==========================================
   EXPORT
========================================== */

window.getRolePermissions =
getRolePermissions;

window.hasPermission =
hasPermission;

window.requirePermission =
requirePermission;

window.clearPermissionCache =
clearPermissionCache;

})(window);
