/* ==========================================
   ALBUKHR ADMIN BOOTSTRAP ENGINE
   Version 3.0

   SINGLE ADMIN AUTHORITY

   DEPENDS ON:
   - admin-supabase-auth.js
   - admin-session.js
   - admin-permissions.js

   PURPOSE:
   - Verify Supabase Admin session
   - Verify active admin_users profile
   - Load permissions
   - Build unified Admin state
   - Dispatch admin-ready

   IMPORTANT:
   - Does NOT use ecosystem Supabase Core
   - Does NOT use js/auth/supabase-auth.js
   - Does NOT use LocalStorage
   - Does NOT use sessionStorage
   - Does NOT create another Supabase client
   - Does NOT sign out on database/query errors
   - Does NOT create redirect loops
========================================== */

(function(window){

"use strict";


/* ==========================================
   ADMIN STATE
========================================== */

const Admin = {

    session:null,

    user:null,

    profile:null,

    role:null,

    permissions:[],

    ready:false,

    environment:null,

    network:null,

    error:null,

    errorCode:null,

    profileVerified:false

};


/* ==========================================
   INTERNAL STATE
========================================== */

let bootstrapPromise =
    null;

let bootstrapStarted =
    false;


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
   ENVIRONMENT
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

    }catch(error){

        console.warn(
            "[ADMIN BOOTSTRAP] Environment helper failed:",
            error
        );

    }


    const hostname =
        safeString(
            window.location.hostname
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


    return "mainnet";

}


/* ==========================================
   REDIRECT LOGIN
========================================== */

function redirectLogin(){

    /*
       IMPORTANT:

       This function is used ONLY when
       Supabase Auth has definitively confirmed
       that there is no session.

       It is NOT used for database errors.
    */

    if(
        window.location.pathname
            .endsWith(
                "admin-login.html"
            )
    ){

        return;

    }


    console.warn(
        "[ADMIN BOOTSTRAP] Redirecting to Admin Login."
    );


    window.location.replace(
        "admin-login.html"
    );

}


/* ==========================================
   RESET STATE
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

    Admin.profileVerified =
        false;

}


/* ==========================================
   GET SESSION
========================================== */

async function getBootstrapSession(){

    try{

        if(
            typeof window.getCurrentSession ===
            "function"
        ){

            const session =
                await window.getCurrentSession();


            return session || null;

        }


        const supabase =
            getAdminClient();


        const {

            data,

            error

        } =
            await supabase.auth.getSession();


        if(error){

            console.error(
                "[ADMIN BOOTSTRAP] Auth session error:",
                error
            );


            return null;

        }


        return data?.session || null;

    }catch(error){

        console.error(
            "[ADMIN BOOTSTRAP] Session exception:",
            error
        );

        return null;

    }

}


/* ==========================================
   GET ADMIN PROFILE
========================================== */

async function getBootstrapAdmin(){

    try{

        if(
            typeof window.getCurrentAdmin ===
            "function"
        ){

            /*
               IMPORTANT:

               We need to distinguish:

               1. No profile
               2. Database error

               Therefore admin-session.js is not
               sufficient by itself because its
               getCurrentAdmin() returns null
               for both conditions.
            */

        }


        const session =
            Admin.session;


        if(
            !session?.user?.id
        ){

            return {

                admin:null,

                error:null,

                reason:"no-session"

            };

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
                "[ADMIN BOOTSTRAP] admin_users query failed:",
                error
            );


            return {

                admin:null,

                error:error,

                reason:"database-error"

            };

        }


        if(!data){

            return {

                admin:null,

                error:null,

                reason:"profile-not-found"

            };

        }


        return {

            admin:data,

            error:null,

            reason:"verified"

        };


    }catch(error){

        console.error(
            "[ADMIN BOOTSTRAP] Admin profile exception:",
            error
        );


        return {

            admin:null,

            error:error,

            reason:"exception"

        };

    }

}


/* ==========================================
   LOAD PERMISSIONS
========================================== */

async function loadPermissions(
    role
){

    const normalizedRole =
        safeString(
            role
        )
        .trim()
        .toLowerCase();


    if(!normalizedRole){

        return [];

    }


    /*
       Super Admin is unrestricted.
    */

    if(
        normalizedRole ===
        "super_admin"
    ){

        return ["*"];

    }


    if(
        typeof window.getRolePermissions !==
        "function"
    ){

        console.warn(
            "[ADMIN BOOTSTRAP] Permission engine unavailable."
        );

        return [];

    }


    try{

        const permissions =
            await window.getRolePermissions(
                normalizedRole
            );


        if(
            !Array.isArray(
                permissions
            )
        ){

            return [];

        }


        return [
            ...new Set(

                permissions

                    .map(
                        item => {

                            if(
                                typeof item ===
                                "string"
                            ){

                                return item;

                            }

                            return item?.permission;

                        }
                    )

                    .map(
                        item =>
                            safeString(
                                item
                            )
                            .trim()
                            .toLowerCase()
                    )

                    .filter(Boolean)

            )
        ];

    }catch(error){

        console.warn(
            "[ADMIN BOOTSTRAP] Permission loading failed:",
            error
        );


        /*
           Permission failure does NOT
           destroy the authenticated
           Admin session.
        */

        return [];

    }

}


/* ==========================================
   INITIALIZE ADMIN
========================================== */

async function initializeAdmin(){

    /*
       If already ready, do nothing.
    */

    if(
        Admin.ready === true
    ){

        return true;

    }


    /*
       Prevent simultaneous duplicate
       initialization.
    */

    if(
        bootstrapPromise
    ){

        return bootstrapPromise;

    }


    bootstrapStarted =
        true;


    bootstrapPromise =
        (async function(){

            try{

                console.log(
                    "🔐 [ADMIN BOOTSTRAP] Starting..."
                );


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


                /*
                   THIS IS THE ONLY PLACE WHERE
                   WE TREAT MISSING SESSION AS
                   AN AUTHENTICATION FAILURE.
                */

                if(
                    !session?.user?.id
                ){

                    console.warn(
                        "[ADMIN BOOTSTRAP] No Supabase Admin session."
                    );


                    Admin.error =
                        "NO_ADMIN_SESSION";

                    Admin.errorCode =
                        "NO_ADMIN_SESSION";


                    resetAdminState();


                    Admin.error =
                        "NO_ADMIN_SESSION";

                    Admin.errorCode =
                        "NO_ADMIN_SESSION";


                    redirectLogin();


                    return false;

                }


                /* ==============================
                   SESSION VERIFIED
                ============================== */

                Admin.session =
                    session;


                Admin.user =
                    session.user;


                console.log(
                    "✅ [ADMIN BOOTSTRAP] Supabase session found:",
                    session.user.email ||
                    session.user.id
                );


                /* ==============================
                   ADMIN PROFILE
                ============================== */

                const profileResult =
                    await getBootstrapAdmin();


                /* ==============================
                   DATABASE ERROR
                ============================== */

                if(
                    profileResult.reason ===
                    "database-error" ||
                    profileResult.reason ===
                    "exception"
                ){

                    /*
                       CRITICAL:

                       DO NOT SIGN OUT.

                       DO NOT REDIRECT.

                       A database failure is not
                       proof that authentication
                       failed.
                    */

                    Admin.error =
                        profileResult.error?.message ||
                        "ADMIN_PROFILE_QUERY_FAILED";

                    Admin.errorCode =
                        "ADMIN_PROFILE_QUERY_FAILED";


                    console.error(
                        "❌ [ADMIN BOOTSTRAP] Admin profile query failed."
                    );


                    console.error(
                        "[ADMIN BOOTSTRAP] Error:",
                        profileResult.error
                    );


                    return false;

                }


                /* ==============================
                   PROFILE NOT FOUND
                ============================== */

                if(
                    profileResult.reason ===
                    "profile-not-found"
                ){

                    /*
                       This means:

                       Supabase Auth user exists,
                       but no active admin_users
                       record was found.
                    */

                    Admin.error =
                        "ADMIN_PROFILE_NOT_FOUND";

                    Admin.errorCode =
                        "ADMIN_PROFILE_NOT_FOUND";


                    console.error(
                        "❌ [ADMIN BOOTSTRAP] Authenticated user is not an active ALBUKHR administrator."
                    );


                    /*
                       NOW it is safe to terminate
                       the session because the
                       administrator authorization
                       failed.
                    */

                    try{

                        const supabase =
                            getAdminClient();


                        await supabase.auth.signOut();

                    }catch(error){

                        console.warn(
                            "[ADMIN BOOTSTRAP] Sign-out failed:",
                            error
                        );

                    }


                    resetAdminState();


                    Admin.error =
                        "ADMIN_PROFILE_NOT_FOUND";

                    Admin.errorCode =
                        "ADMIN_PROFILE_NOT_FOUND";


                    redirectLogin();


                    return false;

                }


                /* ==============================
                   PROFILE VERIFIED
                ============================== */

                const admin =
                    profileResult.admin;


                if(!admin){

                    console.error(
                        "[ADMIN BOOTSTRAP] Unexpected empty Admin profile."
                    );


                    Admin.error =
                        "ADMIN_PROFILE_INVALID";

                    Admin.errorCode =
                        "ADMIN_PROFILE_INVALID";


                    return false;

                }


                Admin.profile =
                    admin;


                Admin.role =
                    safeString(
                        admin.role_code
                    )
                    .trim()
                    .toLowerCase();


                Admin.profileVerified =
                    true;


                /* ==============================
                   ROLE VALIDATION
                ============================== */

                if(
                    !Admin.role
                ){

                    /*
                       Do NOT immediately logout
                       here. This is a database
                       integrity problem.
                    */

                    Admin.error =
                        "ADMIN_ROLE_MISSING";

                    Admin.errorCode =
                        "ADMIN_ROLE_MISSING";


                    console.error(
                        "❌ [ADMIN BOOTSTRAP] Active admin profile has no role_code."
                    );


                    return false;

                }


                /* ==============================
                   PERMISSIONS
                ============================== */

                Admin.permissions =
                    await loadPermissions(
                        Admin.role
                    );


                /* ==============================
                   READY
                ============================== */

                Admin.ready =
                    true;


                Admin.error =
                    null;

                Admin.errorCode =
                    null;


                /*
                   Publish final Admin state.
                */

                window.Admin =
                    Admin;


                /* ==============================
                   EVENT
                ============================== */

                document.dispatchEvent(

                    new CustomEvent(

                        "admin-ready",

                        {

                            detail:
                                Admin

                        }

                    )

                );


                /* ==============================
                   DEBUG
                ============================== */

                console.log(
                    "=========================================="
                );

                console.log(
                    "✅ ALBUKHR ADMIN BOOTSTRAP READY"
                );

                console.log(
                    "=========================================="
                );


                console.table({

                    email:
                        admin.email ||
                        session.user.email ||
                        "",

                    username:
                        admin.username ||
                        "",

                    role:
                        Admin.role,

                    status:
                        admin.status ||
                        "",

                    environment:
                        Admin.environment,

                    network:
                        Admin.network,

                    permissions:
                        Admin.permissions.length

                });


                return true;


            }catch(error){

                console.error(
                    "❌ [ADMIN BOOTSTRAP] Fatal error:",
                    error
                );


                /*
                   IMPORTANT:

                   Do NOT sign out here.

                   Do NOT automatically redirect
                   because runtime/database errors
                   are not authentication failures.
                */

                Admin.ready =
                    false;

                Admin.error =
                    error?.message ||
                    "ADMIN_BOOTSTRAP_FAILED";

                Admin.errorCode =
                    "ADMIN_BOOTSTRAP_FAILED";


                return false;

            }

        })();


    try{

        return await bootstrapPromise;

    }finally{

        /*
           Allow retry after failure.

           Keep promise if Admin became ready.
        */

        if(
            !Admin.ready
        ){

            bootstrapPromise =
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
   IS READY
========================================== */

function isAdminReady(){

    return (
        Admin.ready === true
    );

}


/* ==========================================
   GET PROFILE
========================================== */

function getAdminProfile(){

    return (
        Admin.profile ||
        null
    );

}


/* ==========================================
   GET ROLE
========================================== */

function getAdminRole(){

    return (
        Admin.role ||
        null
    );

}


/* ==========================================
   GET PERMISSIONS
========================================== */

function getAdminPermissions(){

    return Array.isArray(
        Admin.permissions
    )
        ? [
            ...Admin.permissions
        ]
        : [];

}


/* ==========================================
   GET BOOTSTRAP ERROR
========================================== */

function getAdminBootstrapError(){

    return {

        error:
            Admin.error,

        code:
            Admin.errorCode,

        ready:
            Admin.ready,

        profileVerified:
            Admin.profileVerified

    };

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


window.getAdminBootstrapError =
    getAdminBootstrapError;


/* ==========================================
   START
========================================== */

function startAdminBootstrap(){

    initializeAdmin()
        .catch(
            error => {

                console.error(
                    "[ADMIN BOOTSTRAP] Startup exception:",
                    error
                );

            }
        );

}


if(
    document.readyState ===
    "loading"
){

    document.addEventListener(

        "DOMContentLoaded",

        startAdminBootstrap,

        {
            once:true
        }

    );

}else{

    /*
       Small delay gives the Admin Auth Core
       and Admin Session Engine time to finish
       their synchronous initialization.
    */

    setTimeout(
        startAdminBootstrap,
        0
    );

}


})(window);
