/* ==========================================
   ALBUKHR ADMIN BOOTSTRAP ENGINE
   Version 2.2

   SUPABASE SESSION IS SOURCE OF TRUTH

   DEPENDS ON:
   - admin-supabase-auth.js
   - admin-session.js
   - admin-permissions.js

   PURPOSE:
   - Build unified Admin state
   - Verify active admin profile
   - Load permissions
   - Dispatch admin-ready
   - No LocalStorage application state
   - No sessionStorage login gate
   - Isolated Admin Supabase client

   IMPORTANT:
   - Does NOT use js/supabase-core.js
   - Does NOT use js/auth/supabase-auth.js
   - Does NOT modify ecosystem engines
   - Does NOT sign out on permission failure
   - Does NOT create another Supabase client
========================================== */

(function(window){

"use strict";


/* ==========================================
   ADMIN STATE
========================================== */

const Admin = {

    /* Supabase Auth session */
    session:null,

    /* Supabase Auth user */
    user:null,

    /* admin_users database record */
    profile:null,

    /* Normalized role */
    role:null,

    /* Database permissions */
    permissions:[],

    /* Bootstrap state */
    ready:false,

    /* Environment */
    environment:null,

    /* Network */
    network:null,

    /* Last bootstrap error */
    error:null

};


/* ==========================================
   REDIRECT LOGIN
========================================== */

function redirectLogin(){

    try{

        window.location.replace(
            "admin-login.html"
        );

    }catch(error){

        console.error(
            "[ADMIN BOOTSTRAP] Redirect failed:",
            error
        );

    }

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
            "ALBUKHR Admin Supabase client unavailable."
        );

    }


    return client;

}


/* ==========================================
   GET ADMIN ENVIRONMENT
========================================== */

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


        const hostname =
            String(
                window.location.hostname || ""
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


        /*
           Approved development fallback.
        */

        return "mainnet";


    }catch(error){

        console.warn(
            "[ADMIN BOOTSTRAP] Environment detection failed:",
            error
        );

        return "mainnet";

    }

}


/* ==========================================
   GET CURRENT SESSION
========================================== */

async function getBootstrapSession(){

    try{

        /*
           Always prefer admin-session.js.
        */

        if(
            typeof window.getCurrentSession ===
            "function"
        ){

            return await window.getCurrentSession();

        }


        /*
           Safe fallback.
        */

        const supabase =
            getAdminClient();


        const {

            data,

            error

        } =
            await supabase.auth.getSession();


        if(error){

            console.error(
                "[ADMIN BOOTSTRAP] Session query failed:",
                error
            );

            return null;

        }


        return data?.session || null;


    }catch(error){

        console.error(
            "[ADMIN BOOTSTRAP] Session lookup failed:",
            error
        );

        return null;

    }

}


/* ==========================================
   GET CURRENT ADMIN PROFILE
========================================== */

async function getBootstrapAdmin(){

    try{

        /*
           Prefer admin-session.js.
        */

        if(
            typeof window.getCurrentAdmin ===
            "function"
        ){

            return await window.getCurrentAdmin();

        }


        /*
           Fallback.
        */

        const session =
            await getBootstrapSession();


        if(
            !session?.user?.id
        ){

            return null;

        }


        const supabase =
            getAdminClient();


        const {

            data,

            error

        } =
            await supabase

                .from("admin_users")

                .select("*")

                .eq(
                    "auth_user_id",
                    session.user.id
                )

                .eq(
                    "status",
                    "active"
                )

                .maybeSingle();


        if(error){

            console.error(
                "[ADMIN BOOTSTRAP] Admin profile query failed:",
                error
            );

            return null;

        }


        return data || null;


    }catch(error){

        console.error(
            "[ADMIN BOOTSTRAP] Admin profile lookup failed:",
            error
        );

        return null;

    }

}


/* ==========================================
   LOAD PERMISSIONS
========================================== */

async function loadAdminPermissions(
    roleCode
){

    const role =
        String(
            roleCode || ""
        )
        .trim()
        .toLowerCase();


    if(!role){

        return [];

    }


    /*
       Super Admin automatically has
       full application permissions.

       No database query required.
    */

    if(
        role ===
        "super_admin"
    ){

        return ["*"];

    }


    if(
        typeof window.getRolePermissions !==
        "function"
    ){

        console.warn(
            "[ADMIN BOOTSTRAP] Permission engine not loaded."
        );

        return [];

    }


    try{

        const permissions =
            await window.getRolePermissions(
                role
            );


        if(
            !Array.isArray(permissions)
        ){

            return [];

        }


        return [
            ...new Set(

                permissions

                    .map(
                        permission =>
                            String(
                                permission || ""
                            )
                            .trim()
                            .toLowerCase()
                    )

                    .filter(Boolean)

            )
        ];


    }catch(error){

        /*
           Permission failure must NOT
           destroy a valid Admin Auth session.
        */

        console.warn(
            "[ADMIN BOOTSTRAP] Permission load failed:",
            error
        );

        return [];

    }

}


/* ==========================================
   RESET ADMIN STATE
========================================== */

function resetAdminState(){

    Admin.session =
        null;

    Admin.user =
        null;

    Admin.profile =
        null;

    Admin.role =
        null;

    Admin.permissions =
        [];

    Admin.ready =
        false;

    Admin.environment =
        null;

    Admin.network =
        null;

    Admin.error =
        null;

}


/* ==========================================
   INITIALIZE ADMIN
========================================== */

let initializationPromise =
    null;


async function initializeAdmin(){

    /*
       Prevent multiple simultaneous
       bootstrap operations.
    */

    if(initializationPromise){

        return initializationPromise;

    }


    initializationPromise =
        (async function(){

            try{

                /* ==============================
                   RESET ERROR ONLY
                ============================== */

                Admin.error =
                    null;


                /* ==============================
                   ENVIRONMENT
                ============================== */

                const environment =
                    getAdminEnvironment();


                Admin.environment =
                    environment;


                Admin.network =
                    environment;


                /* ==============================
                   SESSION
                ============================== */

                const session =
                    await getBootstrapSession();


                if(
                    !session?.user?.id
                ){

                    console.warn(
                        "[ADMIN BOOTSTRAP] No valid Admin Supabase session."
                    );


                    resetAdminState();


                    redirectLogin();


                    return false;

                }


                Admin.session =
                    session;


                Admin.user =
                    session.user;


                /* ==============================
                   ADMIN PROFILE
                ============================== */

                const admin =
                    await getBootstrapAdmin();


                if(!admin){

                    console.warn(
                        "[ADMIN BOOTSTRAP] Active admin profile not found."
                    );


                    /*
                       Auth session exists but there
                       is no active admin profile.

                       This is a real authorization
                       failure, so terminate session.
                    */

                    try{

                        const supabase =
                            getAdminClient();


                        await supabase.auth.signOut();

                    }catch(signOutError){

                        console.warn(
                            "[ADMIN BOOTSTRAP] Sign-out cleanup failed:",
                            signOutError
                        );

                    }


                    resetAdminState();


                    redirectLogin();


                    return false;

                }


                /* ==============================
                   ADMIN PROFILE
                ============================== */

                Admin.profile =
                    admin;


                Admin.role =
                    String(
                        admin.role_code || ""
                    )
                    .trim()
                    .toLowerCase();


                if(!Admin.role){

                    console.error(
                        "[ADMIN BOOTSTRAP] Admin role is missing."
                    );


                    /*
                       Active admin without role
                       is not safe to authorize.
                    */

                    try{

                        const supabase =
                            getAdminClient();


                        await supabase.auth.signOut();

                    }catch(signOutError){

                        console.warn(
                            "[ADMIN BOOTSTRAP] Role cleanup sign-out failed:",
                            signOutError
                        );

                    }


                    resetAdminState();


                    redirectLogin();


                    return false;

                }


                /* ==============================
                   PERMISSIONS
                ============================== */

                Admin.permissions =
                    await loadAdminPermissions(
                        Admin.role
                    );


                /* ==============================
                   READY
                ============================== */

                Admin.ready =
                    true;


                window.Admin =
                    Admin;


                /* ==============================
                   ADMIN READY EVENT
                ============================== */

                document.dispatchEvent(

                    new CustomEvent(

                        "admin-ready",

                        {
                            detail:Admin
                        }

                    )

                );


                /* ==============================
                   DEBUG
                ============================== */

                console.log(
                    "✅ ALBUKHR Admin Bootstrap Ready"
                );


                console.table({

                    email:
                        admin.email || "",

                    username:
                        admin.username || "",

                    role:
                        Admin.role,

                    status:
                        admin.status || "",

                    environment:
                        Admin.environment,

                    permissions:
                        Admin.permissions.length

                });


                return true;


            }catch(error){

                console.error(
                    "[ADMIN BOOTSTRAP]",
                    error
                );


                Admin.error =
                    error?.message ||
                    "Admin bootstrap failed.";


                /*
                   Important:

                   We do NOT automatically sign out
                   here because an unexpected runtime
                   error is not proof that the session
                   is invalid.

                   Only redirect if the application
                   cannot continue safely.
                */

                resetAdminState();


                Admin.error =
                    error?.message ||
                    "Admin bootstrap failed.";


                redirectLogin();


                return false;

            }

        })();


    try{

        return await initializationPromise;

    }finally{

        /*
           Keep the resolved state if successful.
           Clear only after failure so a later retry
           is possible.
        */

        if(!Admin.ready){

            initializationPromise =
                null;

        }

    }

}


/* ==========================================
   GET ADMIN STATE
========================================== */

function getAdminState(){

    return Admin;

}


/* ==========================================
   IS ADMIN READY
========================================== */

function isAdminReady(){

    return (
        Admin.ready === true
    );

}


/* ==========================================
   GET ADMIN PROFILE
========================================== */

function getAdminProfile(){

    return Admin.profile || null;

}


/* ==========================================
   GET ADMIN ROLE
========================================== */

function getAdminRole(){

    return Admin.role || null;

}


/* ==========================================
   GET ADMIN PERMISSIONS
========================================== */

function getAdminPermissions(){

    return Array.isArray(
        Admin.permissions
    )
        ? [...Admin.permissions]
        : [];

}


/* ==========================================
   EXPORT
========================================== */

window.Admin =
    Admin;


window.initializeAdmin =
    initializeAdmin;


window.getAdminState =
    getAdminState;


window.isAdminReady =
    isAdminReady;


window.getAdminProfile =
    getAdminProfile;


window.getAdminRole =
    getAdminRole;


window.getAdminPermissions =
    getAdminPermissions;


/* ==========================================
   START
========================================== */

if(
    document.readyState ===
    "loading"
){

    document.addEventListener(

        "DOMContentLoaded",

        function(){

            initializeAdmin();

        },

        {
            once:true
        }

    );

}else{

    initializeAdmin();

}


})(window);
