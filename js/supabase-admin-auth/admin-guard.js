/* ==========================================
   ALBUKHR ADMIN GUARD ENGINE
   Version 2.1
   ISOLATED ADMIN AUTH COMPATIBILITY

   LOCATION:
   js/supabase-admin-auth/admin-guard.js

   DEPENDS ON:
   - admin-supabase-auth.js
   - admin-session.js
   - admin-permissions.js (for permission guards)

   PURPOSE:
   - Protect Admin pages
   - Verify active Admin session
   - Verify Admin roles
   - Verify Admin permissions
   - Prevent unauthorized access

   IMPORTANT:
   - Does NOT use js/supabase-core.js
   - Does NOT use js/auth/supabase-auth.js
   - Does NOT use LocalStorage
   - Does NOT use sessionStorage
   - Does NOT modify other ALBUKHR engines
   - Does NOT overwrite window.requireRole
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

    window.location.replace(
        url
    );

}


/* ==========================================
   ACCESS DENIED
========================================== */

function accessDenied(
    message = "Access denied."
){

    alert(
        message
    );

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
           admin-session.js is the
           single source for current Admin.
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
            "[ADMIN GUARD] Current admin lookup failed:",
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

function normalizeRole(
    admin
){

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
        normalizeRole(
            admin
        );


    const requiredRole =
        String(
            roleCode || ""
        )
        .trim()
        .toLowerCase();


    /*
       Empty role must never pass.
    */

    if(!requiredRole){

        console.error(
            "[ADMIN GUARD] Required role is empty."
        );

        accessDenied(
            "Invalid Admin role requirement."
        );

        return false;

    }


    if(
        currentRole !==
        requiredRole
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

        roles = [
            roles
        ];

    }


    /*
       Empty role list must deny.
    */

    if(!roles.length){

        console.error(
            "[ADMIN GUARD] No allowed roles supplied."
        );

        accessDenied(
            "No authorized Admin role was specified."
        );

        return false;

    }


    const currentRole =
        normalizeRole(
            admin
        );


    if(!currentRole){

        accessDenied(
            "Administrator role could not be verified."
        );

        return false;

    }


    const allowedRoles =
        roles

            .map(
                role =>
                    String(
                        role ?? ""
                    )
                    .trim()
                    .toLowerCase()
            )

            .filter(Boolean);


    if(!allowedRoles.length){

        console.error(
            "[ADMIN GUARD] Allowed role list is empty."
        );

        accessDenied(
            "No authorized Admin role was specified."
        );

        return false;

    }


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


    const requiredPermission =
        String(
            permission ?? ""
        )
        .trim()
        .toLowerCase();


    if(!requiredPermission){

        console.error(
            "[ADMIN GUARD] Permission requirement is empty."
        );

        accessDenied(
            "Invalid Admin permission requirement."
        );

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
                requiredPermission
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


    /*
       Empty permission list must deny.
    */

    if(!permissions.length){

        console.error(
            "[ADMIN GUARD] No permissions supplied."
        );

        accessDenied(
            "No required Admin permissions were specified."
        );

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


    for(
        const permission
        of permissions
    ){

        const requiredPermission =
            String(
                permission ?? ""
            )
            .trim()
            .toLowerCase();


        if(!requiredPermission){

            console.error(
                "[ADMIN GUARD] Empty permission detected."
            );

            accessDenied(
                "Invalid permission requirement."
            );

            return false;

        }


        try{

            const allowed =
                await window.hasPermission(
                    requiredPermission
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
                requiredPermission,
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
   REQUIRE ANY PERMISSION
========================================== */

async function requireAnyPermission(
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


    if(!permissions.length){

        console.error(
            "[ADMIN GUARD] No permissions supplied."
        );

        accessDenied(
            "No authorized Admin permission was specified."
        );

        return false;

    }


   
