/* ==========================================
   ALBUKHR ADMIN SESSION ENGINE
   Version 3.0

   ISOLATED ADMIN AUTH

   SOURCE OF TRUTH:
   - admin-supabase-auth.js
   - Supabase Auth session
   - admin_users

   PURPOSE:
   - Read Admin Auth session
   - Read active admin_users profile
   - Provide structured authentication state
   - Prevent database/RLS errors from being
     mistaken for invalid Admin accounts

   IMPORTANT:
   - Does NOT use ecosystem Supabase Core
   - Does NOT use js/auth/supabase-auth.js
   - Does NOT use LocalStorage
   - Does NOT use sessionStorage
   - Does NOT signOut()
   - Does NOT redirect automatically
   - Does NOT create another Supabase client

   AUTHORIZATION DECISIONS:
   - admin-bootstrap.js
   - admin-guard.js
========================================== */

(function(window){

"use strict";


const TABLE =
    "admin_users";


/* ==========================================
   INTERNAL STATE
========================================== */

let lastSessionError =
    null;

let lastAdminProfileError =
    null;


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
   GET CURRENT SESSION RESULT
========================================== */

/*
   Returns a structured result.

   status:
       authenticated
       unauthenticated
       error
*/

async function getCurrentSessionResult(){

    lastSessionError =
        null;


    try{

        const supabase =
            getAdminClient();


        const {

            data,

            error

        } =
            await supabase.auth.getSession();


        if(error){

            lastSessionError =
                error;


            console.error(
                "[ADMIN SESSION] getSession:",
                error
            );


            return {

                ok:false,

                authenticated:false,

                status:"error",

                session:null,

                user:null,

                error

            };

        }


        const session =
            data?.session || null;


        if(
            !session?.user?.id
        ){

            return {

                ok:true,

                authenticated:false,

                status:"unauthenticated",

                session:null,

                user:null,

                error:null

            };

        }


        return {

            ok:true,

            authenticated:true,

            status:"authenticated",

            session,

            user:session.user,

            error:null

        };


    }catch(error){

        lastSessionError =
            error;


        console.error(
            "[ADMIN SESSION] getSession exception:",
            error
        );


        return {

            ok:false,

            authenticated:false,

            status:"error",

            session:null,

            user:null,

            error

        };

    }

}


/* ==========================================
   GET CURRENT SESSION
========================================== */

async function getCurrentSession(){

    const result =
        await getCurrentSessionResult();


    if(
        !result.ok
    ){

        return null;

    }


    return result.session || null;

}


/* ==========================================
   IS LOGGED IN
========================================== */

async function isAdminLoggedIn(){

    const result =
        await getCurrentSessionResult();


    return (
        result.ok === true &&
        result.authenticated === true
    );

}


/* ==========================================
   GET CURRENT ADMIN RESULT
========================================== */

/*
   IMPORTANT:

   This is the new authoritative profile
   inspection function.

   It distinguishes:

   1. unauthenticated
   2. active admin
   3. admin not found
   4. database/query error
   5. client/runtime error

   This prevents Bootstrap from treating
   a temporary Supabase/RLS/database error
   as an invalid Admin account.
*/

async function getCurrentAdminResult(){

    lastAdminProfileError =
        null;


    /* ======================================
       SESSION
    ====================================== */

    const sessionResult =
        await getCurrentSessionResult();


    if(
        !sessionResult.ok
    ){

        return {

            ok:false,

            authenticated:false,

            status:"session_error",

            session:null,

            user:null,

            admin:null,

            error:
                sessionResult.error || null

        };

    }


    if(
        !sessionResult.authenticated
    ){

        return {

            ok:true,

            authenticated:false,

            status:"unauthenticated",

            session:null,

            user:null,

            admin:null,

            error:null

        };

    }


    const session =
        sessionResult.session;


    const user =
        sessionResult.user;


    /* ======================================
       ADMIN PROFILE QUERY
    ====================================== */

    let supabase;


    try{

        supabase =
            getAdminClient();

    }catch(error){

        lastAdminProfileError =
            error;


        console.error(
            "[ADMIN SESSION] Admin client unavailable:",
            error
        );


        return {

            ok:false,

            authenticated:true,

            status:"client_error",

            session,

            user,

            admin:null,

            error

        };

    }


    try{

        const {

            data,

            error

        } =
            await supabase

                .from(TABLE)

                .select("*")

                .eq(
                    "auth_user_id",
                    user.id
                )

                .eq(
                    "status",
                    "active"
                )

                .maybeSingle();


        /* ==============================
           DATABASE / RLS ERROR
        ============================== */

        if(error){

            lastAdminProfileError =
                error;


            console.error(
                "[ADMIN SESSION] Admin profile query failed:",
                error
            );


            /*
               CRITICAL:

               Do NOT convert this into
               "not_found".

               Do NOT sign out.

               Do NOT redirect.

               Let Bootstrap decide.
            */

            return {

                ok:false,

                authenticated:true,

                status:"query_error",

                session,

                user,

                admin:null,

                error

            };

        }


        /* ==============================
           ADMIN NOT FOUND
        ============================== */

        if(!data){

            return {

                ok:true,

                authenticated:true,

                status:"not_found",

                session,

                user,

                admin:null,

                error:null

            };

        }


        /* ==============================
           ACTIVE ADMIN FOUND
        ============================== */

        return {

            ok:true,

            authenticated:true,

            status:"active",

            session,

            user,

            admin:data,

            error:null

        };


    }catch(error){

        lastAdminProfileError =
            error;


        console.error(
            "[ADMIN SESSION] Current admin query exception:",
            error
        );


        return {

            ok:false,

            authenticated:true,

            status:"query_error",

            session,

            user,

            admin:null,

            error

        };

    }

}


/* ==========================================
   GET CURRENT ADMIN
========================================== */

/*
   BACKWARD COMPATIBILITY

   Existing engines expect:

       admin object
       OR null

   Therefore we keep that API.

   IMPORTANT:

   Callers that need to distinguish
   "not found" from "query error"
   MUST use:

       getCurrentAdminResult()
*/

async function getCurrentAdmin(){

    const result =
        await getCurrentAdminResult();


    if(
        result.status !==
        "active"
    ){

        return null;

    }


    return result.admin || null;

}


/* ==========================================
   GET CURRENT ROLE
========================================== */

async function getCurrentRole(){

    const result =
        await getCurrentAdminResult();


    if(
        result.status !==
        "active" ||
        !result.admin
    ){

        return null;

    }


    return String(
        result.admin.role_code || ""
    )
    .trim()
    .toLowerCase() || null;

}


/* ==========================================
   REFRESH SESSION
========================================== */

async function refreshAdminSession(){

    lastSessionError =
        null;


    try{

        const supabase =
            getAdminClient();


        const {

            data,

            error

        } =
            await supabase.auth.refreshSession();


        if(error){

            lastSessionError =
                error;


            console.error(
                "[ADMIN SESSION] Refresh failed:",
                error
            );


            return false;

        }


        return !!(
            data?.session?.user?.id
        );


    }catch(error){

        lastSessionError =
            error;


        console.error(
            "[ADMIN SESSION] Refresh exception:",
            error
        );


        return false;

    }

}


/* ==========================================
   REQUIRE ADMIN SESSION
========================================== */

/*
   IMPORTANT:

   This helper does NOT sign out.

   It returns:

       admin object
       OR null

   The page/guard decides what to do.
*/

async function requireAdminSession(){

    const result =
        await getCurrentAdminResult();


    if(
        result.status !==
        "active"
    ){

        return null;

    }


    return result.admin || null;

}


/* ==========================================
   GET LAST SESSION ERROR
========================================== */

function getLastSessionError(){

    return lastSessionError || null;

}


/* ==========================================
   GET LAST ADMIN PROFILE ERROR
========================================== */

function getLastAdminProfileError(){

    return lastAdminProfileError || null;

}


/* ==========================================
   IS ADMIN PROFILE AVAILABLE
========================================== */

async function hasActiveAdminProfile(){

    const result =
        await getCurrentAdminResult();


    return (
        result.status ===
        "active"
    );

}


/* ==========================================
   GET ADMIN AUTH STATE
========================================== */

async function getAdminAuthState(){

    const result =
        await getCurrentAdminResult();


    return {

        ok:
            result.ok,

        authenticated:
            result.authenticated,

        status:
            result.status,

        session:
            result.session || null,

        user:
            result.user || null,

        admin:
            result.admin || null,

        error:
            result.error || null

    };

}


/* ==========================================
   EXPORT
========================================== */

window.getAdminClient =
    getAdminClient;


window.getCurrentSessionResult =
    getCurrentSessionResult;


window.getCurrentSession =
    getCurrentSession;


window.isAdminLoggedIn =
    isAdminLoggedIn;


window.getCurrentAdminResult =
    getCurrentAdminResult;


window.getCurrentAdmin =
    getCurrentAdmin;


window.getCurrentRole =
    getCurrentRole;


window.refreshAdminSession =
    refreshAdminSession;


window.requireAdminSession =
    requireAdminSession;


window.getLastSessionError =
    getLastSessionError;


window.getLastAdminProfileError =
    getLastAdminProfileError;


window.hasActiveAdminProfile =
    hasActiveAdminProfile;


window.getAdminAuthState =
    getAdminAuthState;


/* ==========================================
   READY
========================================== */

console.log(
    "✅ ALBUKHR Admin Session Engine v3.0 Ready"
);


})(window);
