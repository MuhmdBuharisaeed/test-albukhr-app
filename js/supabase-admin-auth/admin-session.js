/* ==========================================
   ALBUKHR ADMIN SESSION ENGINE
   Version 3.1
========================================== */

(function(window){

"use strict";

const TABLE = "admin_users";

/* ==========================================
   GET AUTH CLIENT
========================================== */

function getClient(){

    if(typeof window.getAlbukhrAuthClient === "function"){

        const client =
        window.getAlbukhrAuthClient();

        if(client){

            return client;

        }

    }

    throw new Error(

        "ALBUKHR Auth Core not initialized."

    );

}

/* ==========================================
   GET CURRENT SESSION
========================================== */

async function getCurrentSession(){

    try{

        const supabase = getClient();

        const {

            data:{session},
            error

        } = await supabase.auth.getSession();

        if(error){

            console.error(error);

            return null;

        }

        return session;

    }catch(error){

        console.error(error);

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

        if(!session){

            return null;

        }

        const supabase =
        getClient();

        const {

            data,
            error

        } = await supabase

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

        .single();

        if(error){

            console.error(error);

            return null;

        }

        return data;

    }catch(error){

        console.error(error);

        return null;

    }

}

/* ==========================================
   GET ROLE
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
        getClient();

        const {

            data,
            error

        } = await supabase.auth.refreshSession();

        if(error){

            console.error(error);

            return false;

        }

        return !!data.session;

    }catch(error){

        console.error(error);

        return false;

    }

}

/* ==========================================
   REQUIRE LOGIN
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
