/* ==========================================
   ALBUKHR ADMIN BOOTSTRAP ENGINE
   Version 3.0

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
   - Isolated Admin Supabase client
   - Prevent accidental Admin lockout

   IMPORTANT:
   - Does NOT use js/supabase-core.js
   - Does NOT use js/auth/supabase-auth.js
   - Does NOT create another Supabase client
   - Does NOT use LocalStorage
   - Does NOT use sessionStorage
   - Does NOT sign out on database/query failure
   - Does NOT sign out on permission failure

   SECURITY RULE:

   Only these conditions may terminate Admin Auth:

   1. No valid Supabase Auth session
   2. Authenticated user is confirmed NOT to be
      an active admin
   3. Active admin profile has no valid role

   Database errors, permission errors,
   network errors and runtime errors MUST NOT
   automatically destroy a valid Auth session.
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

    errorCode:null

};


/* ==========================================
   INTERNAL INITIALIZATION LOCK
========================================== */

let initializationPromise = null;


/* ==========================================
   CONSTANTS
========================================== */

const ADMIN_TABLE =
    "admin_users";


const VALID_ENVIRONMENTS = [
    "mainnet",
    "testnet"
];


/* ==========================================
   RESET STATE
========================================== */

function resetAdminState(){

    Admin.session = null;

    Admin.user = null;

    Admin.profile = null;

    Admin.role = null;

    Admin.permissions = [];

    Admin.ready = false;

    Admin.environment = null;

    Admin.network = null;

}


/* ==========================================
   SET ERROR
========================================== */

function setAdminError(
    message,
    code = "ADMIN_BOOTSTRAP_ERROR"
){

    Admin.error =
        message ||
        "Admin bootstrap failed.";

    Admin.errorCode =
        code;

}


/* ==========================================
   CLEAR ERROR
========================================== */

function clearAdminError(){

    Admin.error = null;

    Admin.errorCode = null;

}


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
                VALID_ENVIRONMENTS.includes(
                    environment
                )
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
           Admin Session Engine is authoritative.
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

/*
   IMPORTANT:

   This function does NOT simply return null
   for every failure.

   It returns a structured result so Bootstrap
   can distinguish:

   - not_found
   - database_error
   - success
*/

async function getBootstrapAdmin(){

    try{

        const session =
            await getBootstrapSession();


        if(
            !session?.user?.id
        ){

            return {

                success:false,

                status:"no_session",

                admin:null,

                error:null

            };

        }


        /*
           Prefer admin-session.js.
        */

        if(
            typeof window.getCurrentAdmin ===
            "function"
        ){

            try{

                const admin =
                    await window.getCurrentAdmin();


                if(admin){

                    return {

                        success:true,

                        status:"active",

                        admin,

                        error:null

                    };

                }


                /*
                   getCurrentAdmin() returns null
                   for both no profile and errors.

                   Therefore we verify directly below
                   so that we can distinguish them.
                */

            }catch(error){

                console.warn(
                    "[ADMIN BOOTSTRAP] Session engine profile lookup failed:",
                    error
                );

            }

        }


        /*
           Direct verification.

           We intentionally use maybeSingle().
        */

        const supabase =
            getAdminClient();


        const {

            data,

            error

        } =
            await supabase

                .from(ADMIN_TABLE)

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


            return {

                success:false,

                status:"database_error",

                admin:null,

                error

            };

        }


        if(!data){

            return {

                success:false,

                status:"not_found",

                admin:null,

                error:null

            };

        }


        return {

            success:true,

            status:"active",

            admin:data,

            error:null

        };


    }catch(error){

        console.error(
            "[ADMIN BOOTSTRAP] Admin profile lookup crashed:",
            error
        );


        return {

            success:false,

            status:"runtime_error",

            admin:null,

            error

        };

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
       Super Admin automatically receives
       wildcard access.
    */

    if(
        role === "super_admin"
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


        /*
           admin-permissions.js Version 2.1
           already returns strings.

           This normalization also keeps
           compatibility with older versions.
        */

        const normalized =
            permissions

                .map(
                    permission => {

                        if(
                            typeof permission ===
                            "string"
                        ){

                            return permission;

                        }


                        if(
                            permission &&
                            typeof permission.permission ===
                            "string"
                        ){

                            return permission.permission;

                        }


                        return "";

                    }
                )

                .map(
                    permission =>
                        String(
                            permission
                        )
                        .trim()
                        .toLowerCase()
                )

                .filter(Boolean);


        return [
            ...new Set(
                normalized
            )
        ];


    }catch(error){

        /*
           CRITICAL:

           Permission failure does NOT
           invalidate Admin Auth.
        */

        console.warn(
            "[ADMIN BOOTSTRAP] Permission load failed:",
            error
        );

        return [];

    }

}


/* ==========================================
   INITIALIZE ADMIN
========================================== */

async function initializeAdmin(){

    /*
       Prevent multiple simultaneous
       initialization operations.
    */

    if(initializationPromise){

        return initializationPromise;

    }


    initializationPromise =
        (async function(){

            clearAdminError();


            try{

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
                   NO SESSION

                   This is the only normal case
                   where redirect is immediate.
                */

                if(
                    !session?.user?.id
                ){

                    resetAdminState();


                    setAdminError(
                        "No active Admin Supabase session.",
                        "NO_SESSION"
                    );


                    console.warn(
                        "[ADMIN BOOTSTRAP] No active session."
                    );


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

                const profileResult =
                    await getBootstrapAdmin();


                /* ==============================
                   DATABASE ERROR
                ============================== */

                if(
                    profileResult.status ===
                    "database_error"
                ){

                    setAdminError(
                        "Unable to verify Admin profile because the database query failed.",
                        "ADMIN_PROFILE_QUERY_ERROR"
                    );


                    console.error(
                        "[ADMIN BOOTSTRAP] Admin profile query failed."
                    );


                    /*
                       DO NOT SIGN OUT.
                       DO NOT REDIRECT.

                       Keep the valid Supabase session.
                    */

                    return false;

                }


                /* ==============================
                   RUNTIME ERROR
                ============================== */

                if(
                    profileResult.status ===
                    "runtime_error"
                ){

                    setAdminError(
                        "Admin profile verification encountered a runtime error.",
                        "ADMIN_PROFILE_RUNTIME_ERROR"
                    );


                    console.error(
                        "[ADMIN BOOTSTRAP] Profile verification runtime error."
                    );


                    /*
                       DO NOT SIGN OUT.
                       DO NOT REDIRECT.
                    */

                    return false;

                }


                /* ==============================
                   NO PROFILE
                ============================== */

                if(
                    profileResult.status ===
                    "not_found"
                ){

                    console.warn(
                        "[ADMIN BOOTSTRAP] Authenticated user is not an active Admin."
                    );


                    setAdminError(
                        "Authenticated user is not an active ALBUKHR administrator.",
                        "ADMIN_NOT_FOUND"
                    );


                    /*
                       This IS a genuine authorization
                       failure.

                       The Auth user exists, but there
                       is no matching active admin_users
                       record.
                    */

                    try{

                        const supabase =
                            getAdminClient();


                        await supabase.auth.signOut();

                    }catch(signOutError){

                        console.warn(
                            "[ADMIN BOOTSTRAP] Authorization cleanup failed:",
                            signOutError
                        );

                    }


                    resetAdminState();


                    setAdminError(
                        "Authenticated user is not an active ALBUKHR administrator.",
                        "ADMIN_NOT_FOUND"
                    );


                    redirectLogin();


                    return false;

                }


                /* ==============================
                   PROFILE SUCCESS
                ============================== */

                const admin =
                    profileResult.admin;


                if(!admin){

                    setAdminError(
                        "Admin profile verification returned no profile.",
                        "ADMIN_PROFILE_INVALID"
                    );


                    /*
                       Do not destroy the session here.
                    */

                    return false;

                }


                Admin.profile =
                    admin;


                Admin.role =
                    String(
                        admin.role_code || ""
                    )
                    .trim()
                    .toLowerCase();


                /* ==============================
                   ROLE VALIDATION
                ============================== */

                if(!Admin.role){

                    console.error(
                        "[ADMIN BOOTSTRAP] Active Admin has no role_code."
                    );


                    setAdminError(
                        "Active Admin profile has no valid role.",
                        "ADMIN_ROLE_MISSING"
                    );


                    /*
                       This is an authorization
                       configuration failure.

                       We terminate because an Admin
                       without a role cannot safely
                       access the Control Center.
                    */

                    try{

                        const supabase =
                            getAdminClient();


                        await supabase.auth.signOut();

                    }catch(signOutError){

                        console.warn(
                            "[ADMIN BOOTSTRAP] Role cleanup failed:",
                            signOutError
                        );

                    }


                    resetAdminState();


                    setAdminError(
                        "Active Admin profile has no valid role.",
                        "ADMIN_ROLE_MISSING"
                    );


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


                /*
                   Permission failure is NOT Auth
                   failure.

                   Admin remains authenticated.
                */


                /* ==============================
                   READY
                ============================== */

                Admin.ready =
                    true;


                window.Admin =
                    Admin;


                clearAdminError();


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
                    "[ADMIN BOOTSTRAP] Unexpected error:",
                    error
                );


                setAdminError(
                    error?.message ||
                    "Unexpected Admin bootstrap error.",
                    "ADMIN_BOOTSTRAP_RUNTIME_ERROR"
                );


                /*
                   CRITICAL CHANGE:

                   Do NOT automatically sign out.
                   Do NOT automatically redirect.

                   A runtime exception is NOT proof
                   that the Supabase Auth session is
                   invalid.
                */

                return false;

            }

        })();


    try{

        return await initializationPromise;

    }finally{

        /*
           Allow retry after a failed initialization.

           Keep the promise when Admin is ready.
        */

        if(
            !Admin.ready
        ){

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
        ? [
            ...Admin.permissions
        ]
        : [];

}


/* ==========================================
   GET BOOTSTRAP ERROR
========================================== */

function getAdminBootstrapError(){

    if(
        !Admin.error
    ){

        return null;

    }


    return {

        code:
            Admin.errorCode || null,

        message:
            Admin.error

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
   AUTO START
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


/* ==========================================
   READY LOG
========================================== */

console.log(
    "✅ ALBUKHR Admin Bootstrap Engine Loaded"
);


})(window);
