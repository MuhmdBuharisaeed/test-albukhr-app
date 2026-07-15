/* ==========================================
   ALBUKHR ADMIN SESSION ENGINE
   Version 4.0
========================================== */

(function(window){

"use strict";

const TABLE = "admin_users";

/* ==========================================
   GET AUTH
========================================== */

function getAuth(){

    if(window.AlbukhrAuth){

        return window.AlbukhrAuth;

    }

    throw new Error(

        "AlbukhrAuth not initialized."

    );

}

/* ==========================================
   GET CURRENT SESSION
========================================== */

async function getCurrentSession(){

    try{

        return await getAuth()

        .getSession();

    }catch(error){

        console.error(

            "[SESSION]",

            error

        );

        return null;

    }

}

/* ==========================================
   GET CURRENT USER
========================================== */

async function getCurrentUser(){

    try{

        return await getAuth()

        .getUser();

    }catch(error){

        console.error(

            "[USER]",

            error

        );

        return null;

    }

}

/* ==========================================
   GET CURRENT ADMIN
========================================== */

async function getCurrentAdmin(){

    try{

        const user =

        await getCurrentUser();

        if(!user){

            return null;

        }

        const {

            data,

            error

        } = await getAuth()

        .client

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

        .single();

        if(error){

            throw error;

        }

        return data;

    }catch(error){

        console.error(

            "[CURRENT ADMIN]",

            error

        );

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
   IS LOGGED IN
========================================== */

async function isAdminLoggedIn(){

    const session =

    await getCurrentSession();

    return !!session;

}

/* ==========================================
   REFRESH SESSION
========================================== */

async function refreshAdminSession(){

    try{

        const {

            data,

            error

        } = await getAuth()

        .refreshSession();

        if(error){

            throw error;

        }

        return !!data.session;

    }catch(error){

        console.error(

            "[REFRESH]",

            error

        );

        return false;

    }

}

/* ==========================================
   REQUIRE SESSION
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

window.getCurrentUser =
getCurrentUser;

window.getCurrentAdmin =
getCurrentAdmin;

window.getCurrentRole =
getCurrentRole;

window.isAdminLoggedIn =
isAdminLoggedIn;

window.refreshAdminSession =
refreshAdminSession;

window.requireAdminSession =
requireAdminSession;

})(window);
