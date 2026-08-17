/* ==========================================
   ALBUKHR ADMIN GUARD ENGINE
   Version 2.0
   ISOLATED ADMIN AUTH COMPATIBILITY
========================================== */

(function(window){

"use strict";


/* ==========================================
   REDIRECT
========================================== */

function redirect(url){

    if(!url){
        return;
    }

    window.location.replace(url);

}


/* ==========================================
   ACCESS DENIED
========================================== */

function accessDenied(
    message = "Access denied."
){

    alert(message);

    redirect(
        "unified-admin-buttons.html"
    );

}


/* ==========================================
   GET ADMIN
========================================== */

async function getGuardAdmin(){

    try{

        /*
          admin-session.js
          must provide getCurrentAdmin()
        */

        if(
            typeof window.getCurrentAdmin !==
            "function"
        ){

            throw new Error(
                "ALBUKHR Admin Session Engine not loaded."
            );

        }

        const admin =
            await window.getCurrentAdmin();

        return admin || null;

    }catch(error){

        console.error(
            "[ADMIN GUARD]",
            error
        );

        return null;

    }

}


/* ==========================================
   REQUIRE LOGIN
========================================== */

async function requireAdmin(){

    const admin =
        await getGuardAdmin();

    if(!admin){

        redirect(
            "admin-login.html"
        );

        return null;

    }

    return admin;

}


/* ==========================================
   NORMALIZE ROLE
========================================== */

function normalizeRole(admin){

    if(!admin){

        return "";

    }

    return String(
        admin.role_code ??
        admin.role ??
        ""
    )
    .trim()
    .toLowerCase();

}


/* ==========================================
   REQUIRE ROLE
========================================== */

async function requireGuardRole(
    roleCode
){

    const admin =
        await requireAdmin();

    if(!admin){

        return false;

    }

    const currentRole =
        normalizeRole(admin);

    const requiredRole =
        String(
            roleCode || ""
        )
        .trim()
        .toLowerCase();

    if(
        currentRole !== requiredRole
    ){

        accessDenied(
            "You are not authorized to access this Admin area."
        );

        return false;

    }

    return true;

}


/* ==========================================
   REQUIRE ANY ROLE
========================================== */

async function requireAnyRole(
    roles = []
){

    const admin =
        await requireAdmin();

    if(!admin){

        return false;

    }

    if(!Array.isArray(roles)){

        roles = [roles];

    }

    const currentRole =
        normalizeRole(admin);

    const allowedRoles =
        roles.map(
            role =>
                String(role)
                    .trim()
                    .toLowerCase()
        );

    if(
        !allowedRoles.includes(
            currentRole
        )
    ){

        accessDenied(
            "You are not authorized to access this Admin area."
        );

        return false;

    }

    return true;

}


/* ==========================================
   REQUIRE PERMISSION
========================================== */

async function requirePermission(
    permission
){

    const admin =
        await requireAdmin();

    if(!admin){

        return false;

    }


    if(
        typeof window.hasPermission !==
        "function"
    ){

        console.error(
            "[ADMIN GUARD] Permission engine not loaded."
        );

        accessDenied(
            "Admin permission engine is unavailable."
        );

        return false;

    }


    try{

        const allowed =
            await window.hasPermission(
                permission
            );

        if(!allowed){

            accessDenied(
                "You don't have permission to access this page."
            );

            return false;

        }

        return true;

    }catch(error){

        console.error(
            "[ADMIN GUARD] Permission check failed:",
            error
        );

        accessDenied(
            "Permission verification failed."
        );

        return false;

    }

}


/* ==========================================
   REQUIRE ALL PERMISSIONS
========================================== */

async function requirePermissions(
    permissions = []
){

    const admin =
        await requireAdmin();

    if(!admin){

        return false;

    }

    if(!Array.isArray(permissions)){

        permissions = [
            permissions
        ];

    }


    if(
        typeof window.hasPermission !==
        "function"
    ){

        console.error(
            "[ADMIN GUARD] Permission engine not loaded."
        );

        accessDenied(
            "Admin permission engine is unavailable."
        );

        return false;

    }


    for(
        const permission
        of permissions
    ){

        try{

            const allowed =
                await window.hasPermission(
                    permission
                );

            if(!allowed){

                accessDenied(
                    "Required permission missing."
                );

                return false;

            }

        }catch(error){

            console.error(
                "[ADMIN GUARD] Permission failed:",
                permission,
                error
            );

            accessDenied(
                "Permission verification failed."
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

    return await requireGuardRole(
        "super_admin"
    );

}


/* ==========================================
   EXPORT
========================================== */

/*
   IMPORTANT:

   We deliberately DO NOT overwrite:

       window.requireRole

   because unified-admin-buttons.js
   already owns that compatibility helper.
*/


window.requireAdmin =
    requireAdmin;

window.requireGuardRole =
    requireGuardRole;

window.requireAnyRole =
    requireAnyRole;

window.requirePermission =
    requirePermission;

window.requirePermissions =
    requirePermissions;

window.requireSuperAdmin =
    requireSuperAdmin;


})(window);
