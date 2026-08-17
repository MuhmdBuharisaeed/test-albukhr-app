/* ==========================================
   ALBUKHR ADMIN SESSION ENGINE
   Version 2.0
   ISOLATED ADMIN AUTH

   SOURCE OF TRUTH:
   - admin-supabase-auth.js
   - Supabase Auth session
   - admin_users

   IMPORTANT:
   - Does NOT use ecosystem Supabase Core
   - Does NOT use js/auth/supabase-auth.js
   - Does NOT use LocalStorage
   - Does NOT use sessionStorage
========================================== */

(function(window){

"use strict";

const TABLE = "admin_users";


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
   GET CURRENT SESSION
========================================== */

async function getCurrentSession(){

    try{

        const supabase =
            getAdminClient();

        const {
            data,
            error
        } =
            await supabase.auth.getSession();

        if(error){

            console.error(
                "[ADMIN SESSION] getSession:",
                error
            );

            return null;

        }

        return data?.session || null;

    }catch(error){

        console.error(
            "[ADMIN SESSION] Fatal:",
            error
        );

        return null;

    }

}


/* ==========================================
   IS LOGGED IN
========================================== */

async function isAdminLoggedIn(){

    const session =
        await getCurrentSession();

    return !!(
        session?.user?.id
    );

}


/* ==========================================
   GET CURRENT ADMIN
========================================== */

async function getCurrentAdmin(){

    try{

        const session =
            await getCurrentSession();

        if(!session?.user?.id){

            return null;

        }

        const supabase =
            getAdminClient();


        /*
           IMPORTANT:

           Use maybeSingle() rather than single()
           so "no admin record" does not create
           a query exception.
        */

        const {
            data,
            error
        } =
            await supabase

                .from(TABLE)

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
                "[ADMIN SESSION] Admin profile query failed:",
                error
            );

            /*
               Do NOT sign out here.

               A database/query problem must not
               automatically destroy a valid
               Supabase Auth session.
            */

            return null;

        }


        if(!data){

            return null;

        }


        return data;

    }catch(error){

        console.error(
            "[ADMIN SESSION] Current admin failed:",
            error
        );

        return null;

    }

}


/* ==========================================
   GET CURRENT ROLE
========================================== */

async function getCurrentRole(){

    const admin =
        await getCurrentAdmin();

    if(!admin){

        return null;

    }

    return String(
        admin.role_code || ""
    )
    .trim()
    .toLowerCase() || null;

}


/* ==========================================
   REFRESH SESSION
========================================== */

async function refreshAdminSession(){

    try{

        const supabase =
            getAdminClient();

        const {
            data,
            error
        } =
            await supabase.auth.refreshSession();

        if(error){

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

async function requireAdminSession(){

    const session =
        await getCurrentSession();

    if(!session?.user?.id){

        window.location.replace(
            "admin-login.html"
        );

        return null;

    }


    const admin =
        await getCurrentAdmin();


    if(!admin){

        /*
           Do NOT sign out here.

           The caller can decide whether this is
           an authorization problem or a database
           availability problem.
        */

        return null;

    }


    return admin;

}


/* ==========================================
   EXPORT
========================================== */

window.getAdminClient =
    getAdminClient;

window.getCurrentSession =
    getCurrentSession;

window.getCurrentAdmin =
    getCurrentAdmin;

window.getCurrentRole =
    getCurrentRole;

window.refreshAdminSession =
    refreshAdminSession;

window.isAdminLoggedIn =
    isAdminLoggedIn;

window.requireAdminSession =
    requireAdminSession;


/* ==========================================
   READY
========================================== */

console.log(
    "✅ ALBUKHR Admin Session Engine Ready"
);


})(window);
