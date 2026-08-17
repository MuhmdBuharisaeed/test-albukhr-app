/* ==========================================
   ALBUKHR ADMIN PERMISSIONS ENGINE
   Version 2.1

   LOCATION:
   js/supabase-admin-auth/admin-permissions.js

   DEPENDS ON:
   - admin-supabase-auth.js
   - admin-session.js

   PURPOSE:
   - Admin role verification
   - Admin permission verification
   - Permission-aware Admin UI
   - Supabase Admin Client only

   IMPORTANT:
   - Does NOT use js/supabase-core.js
   - Does NOT use js/auth/supabase-auth.js
   - Does NOT use LocalStorage
   - Does NOT use sessionStorage
   - Does NOT modify other ALBUKHR engines
========================================== */

(function(window){

"use strict";


const TABLE =
    "admin_permissions";


/* ==========================================
   SAFE STRING
========================================== */

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


/* ==========================================
   NORMALIZE ROLE
========================================== */

function normalizeRole(
    roleCode
){

    return safeString(
        roleCode
    )
    .trim()
    .toLowerCase();

}


/* ==========================================
   NORMALIZE PERMISSION
========================================== */

function normalizePermission(
    permission
){

    return safeString(
        permission
    )
    .trim()
    .toLowerCase();

}


/* ==========================================
   GET ADMIN CLIENT
========================================== */

function getAdminClient(){

    if(
        typeof window.getAlbukhrAdminSupabaseClient !==
        "function"
    ){

        throw new Error(
            "ALBUKHR Admin Supabase Auth Core not loaded."
        );

    }


    const client =
        window.getAlbukhrAdminSupabaseClient();


    if(!client){

        throw new Error(
            "ALBUKHR Admin Supabase Auth Core not initialized."
        );

    }


    return client;

}


/* ==========================================
   GET CURRENT ADMIN SAFELY
========================================== */

async function getPermissionAdmin(){

    if(
        typeof window.getCurrentAdmin !==
        "function"
    ){

        console.error(
            "[ADMIN PERMISSIONS] admin-session.js is not loaded."
        );

        return null;

    }


    try{

        return await window.getCurrentAdmin();

    }catch(error){

        console.error(
            "[ADMIN PERMISSIONS] Current admin lookup failed:",
            error
        );

        return null;

    }

}


/* ==========================================
   GET ROLE PERMISSIONS
========================================== */

async function getRolePermissions(
    roleCode
){

    const role =
        normalizeRole(
            roleCode
        );


    if(!role){

        return [];

    }


    try{

        const supabase =
            getAdminClient();


        const {

            data,

            error

        } =
            await supabase

                .from(TABLE)

                .select(
                    "permission"
                )

                .eq(
                    "role_code",
                    role
                );


        if(error){

            console.error(
                "[ADMIN PERMISSIONS] Permission query failed:",
                error
            );

            return [];

        }


        if(!Array.isArray(data)){

            return [];

        }


        /*
           Normalize and remove invalid/duplicate
           permission values.
        */

        const permissions =
            data

                .map(
                    item =>
                        normalizePermission(
                            item?.permission
                        )
                )

                .filter(Boolean);


        return [
            ...new Set(
                permissions
            )
        ];


    }catch(error){

        console.error(
            "[ADMIN PERMISSIONS] getRolePermissions failed:",
            error
        );

        return [];

    }

}


/* ==========================================
   HAS ROLE
========================================== */

async function hasRole(
    roleCode
){

    const admin =
        await getPermissionAdmin();


    if(!admin){

        return false;

    }


    const currentRole =
        normalizeRole(
            admin.role_code
        );


    const requiredRole =
        normalizeRole(
            roleCode
        );


    if(
        !currentRole ||
        !requiredRole
    ){

        return false;

    }


    return (
        currentRole ===
        requiredRole
    );

}


/* ==========================================
   HAS ANY ROLE
========================================== */

async function hasAnyRole(
    roles = []
){

    const admin =
        await getPermissionAdmin();


    if(!admin){

        return false;

    }


    if(!Array.isArray(roles)){

        return false;

    }


    const currentRole =
        normalizeRole(
            admin.role_code
        );


    if(!currentRole){

        return false;

    }


    return roles.some(
        role =>
            normalizeRole(role) ===
            currentRole
    );

}


/* ==========================================
   HAS PERMISSION
========================================== */

async function hasPermission(
    permission
){

    const requiredPermission =
        normalizePermission(
            permission
        );


    if(!requiredPermission){

        return false;

    }


    const admin =
        await getPermissionAdmin();


    if(!admin){

        return false;

    }


    const role =
        normalizeRole(
            admin.role_code
        );


    if(!role){

        return false;

    }


    /* ======================================
       SUPER ADMIN

       Super Admin has full access.

       This avoids requiring a "*" row in
       admin_permissions for the master role.
    ====================================== */

    if(
        role ===
        "super_admin"
    ){

        return true;

    }


    /* ======================================
       DATABASE PERMISSIONS
    ====================================== */

    const permissions =
        await getRolePermissions(
            role
        );


    if(!permissions.length){

        return false;

    }


    /*
       Explicit wildcard permission.
    */

    if(
        permissions.includes("*")
    ){

        return true;

    }


    return permissions.includes(
        requiredPermission
    );

}


/* ==========================================
   HAS ANY PERMISSION
========================================== */

async function hasAnyPermission(
    permissions = []
){

    if(
        !Array.isArray(permissions) ||
        !permissions.length
    ){

        return false;

    }


    const admin =
        await getPermissionAdmin();


    if(!admin){

        return false;

    }


    const role =
        normalizeRole(
            admin.role_code
        );


    if(!role){

        return false;

    }


    /*
       Super Admin has complete access.
    */

    if(
        role ===
        "super_admin"
    ){

        return true;

    }


    const normalizedPermissions =
        permissions

            .map(
                normalizePermission
            )

            .filter(Boolean);


    if(!normalizedPermissions.length){

        return false;

    }


    const currentPermissions =
        await getRolePermissions(
            role
        );


    if(
        currentPermissions.includes("*")
    ){

        return true;

    }


    return normalizedPermissions.some(
        permission =>
            currentPermissions.includes(
                permission
            )
    );

}


/* ==========================================
   HAS ALL PERMISSIONS
========================================== */

async function hasAllPermissions(
    permissions = []
){

    if(
        !Array.isArray(permissions) ||
        !permissions.length
    ){

        return false;

    }


    const admin =
        await getPermissionAdmin();


    if(!admin){

        return false;

    }


    const role =
        normalizeRole(
            admin.role_code
        );


    if(!role){

        return false;

    }


    /*
       Super Admin has complete access.
    */

    if(
        role ===
        "super_admin"
    ){

        return true;

    }


    const requiredPermissions =
        [
            ...new Set(
                permissions
                    .map(
                        normalizePermission
                    )
                    .filter(Boolean)
            )
        ];


    if(!requiredPermissions.length){

        return false;

    }


    const currentPermissions =
        await getRolePermissions(
            role
        );


    if(
        currentPermissions.includes("*")
    ){

        return true;

    }


    return requiredPermissions.every(
        permission =>
            currentPermissions.includes(
                permission
            )
    );

}


/* ==========================================
   COMMON PERMISSION HELPERS
========================================== */

async function canManageFinance(){

    return await hasPermission(
        "finance.manage"
    );

}


async function canManageProjects(){

    return await hasPermission(
        "projects.manage"
    );

}


async function canManageUsers(){

    return await hasPermission(
        "users.manage"
    );

}


async function canApprove(){

    return await hasPermission(
        "approvals.manage"
    );

}


async function canManageSettings(){

    return await hasPermission(
        "settings.manage"
    );

}


async function canManageRisk(){

    return await hasPermission(
        "risk.manage"
    );

}


/* ==========================================
   GET CURRENT ADMIN ROLE
========================================== */

async function getAdminPermissionRole(){

    const admin =
        await getPermissionAdmin();


    if(!admin){

        return null;

    }


    return normalizeRole(
        admin.role_code
    ) || null;

}


/* ==========================================
   EXPORT
========================================== */

window.getRolePermissions =
    getRolePermissions;


window.hasRole =
    hasRole;


window.hasAnyRole =
    hasAnyRole;


window.hasPermission =
    hasPermission;


window.hasAnyPermission =
    hasAnyPermission;


window.hasAllPermissions =
    hasAllPermissions;


window.canManageFinance =
    canManageFinance;


window.canManageProjects =
    canManageProjects;


window.canManageUsers =
    canManageUsers;


window.canApprove =
    canApprove;


window.canManageSettings =
    canManageSettings;


window.canManageRisk =
    canManageRisk;


window.getAdminPermissionRole =
    getAdminPermissionRole;


/* ==========================================
   DEBUG
========================================== */

console.log(
    "✅ ALBUKHR Admin Permissions Engine Ready"
);


})(window);
