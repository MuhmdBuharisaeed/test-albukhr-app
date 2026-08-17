/* ==========================================
   ALBUKHR ADMIN SESSION ENGINE
   Version 4.0
   ISOLATED ADMIN AUTH
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
            "ALBUKHR Admin Supabase Auth Core not initialized."
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
            data:{session},
            error
        } =
            await supabase.auth.getSession();

        if(error){

            console.error(
                "[ADMIN SESSION]",
                error
            );

            return null;

        }

        return session || null;

    }catch(error){

        console.error(
            "[ADMIN SESSION]",
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

    return !!session;

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
                "[ADMIN SESSION] admin_users:",
                error
            );

            return null;

        }

        return data || null;

    }catch(error){

        console.error(
            "[ADMIN SESSION]",
            error
        );

        return null;

    }

}


/* ==========================================
   ROLE
========================================== */

async function getCurrentRole(){

    const admin =
        await getCurrentAdmin();

    return admin
        ? admin.role_code
        : null;

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
                "[ADMIN SESSION] refresh:",
                error
            );

            return false;

        }

        return !!data?.session;

    }catch(error){

        console.error(error);

        return false;

    }

}


/* ==========================================
   REQUIRE ADMIN
========================================== */

async function requireAdminSession(){

    const admin =
        await getCurrentAdmin();

    if(!admin){

        location.replace(
            "admin-login.html"
        );

        return null;

    }

    return admin;

}


/* ==========================================
   EXPORT
========================================== */

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


})(window);
