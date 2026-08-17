/* ==========================================
   ALBUKHR ADMIN SESSION ENGINE
   Version 2.1
   ISOLATED ADMIN AUTH CLIENT

   LOCATION:
   js/supabase-admin-auth/admin-session.js

   PURPOSE:
   - Manage Admin Supabase Auth session
   - Use ONLY Admin Supabase Auth Core
   - Never use ecosystem Supabase Core
   - Resolve Admin Mainnet/Testnet environment
   - Load active admin profile
   - Provide role information
   - Protect Admin pages
========================================== */

(function(window){

"use strict";


const TABLE = "admin_users";


/* ==========================================
   GET ADMIN AUTH CLIENT
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
   GET ADMIN ENVIRONMENT
========================================== */

function getCurrentAdminEnvironment(){

    if(
        typeof window.getAlbukhrAdminEnvironment !==
        "function"
    ){

        throw new Error(
            "ALBUKHR Admin Environment Core not loaded."
        );

    }


    const environment =
        window.getAlbukhrAdminEnvironment();


    if(
        environment !== "mainnet" &&
        environment !== "testnet"
    ){

        throw new Error(
            "Invalid ALBUKHR Admin environment."
        );

    }


    return environment;

}


/* ==========================================
   GET ADMIN NETWORK
========================================== */

function getCurrentAdminNetwork(){

    return getCurrentAdminEnvironment();

}


/* ==========================================
   REQUIRE ADMIN NETWORK
========================================== */

function requireAdminNetwork(){

    const network =
        getCurrentAdminNetwork();


    if(
        network !== "mainnet" &&
        network !== "testnet"
    ){

        throw new Error(
            "ALBUKHR Admin network is invalid."
        );

    }


    return network;

}


/* ==========================================
   GET CURRENT SESSION
========================================== */

async function getCurrentSession(){

    try{

        /*
           Validate Admin environment first.
        */

        requireAdminNetwork();


        const supabase =
            getAdminClient();


        const {
            data,
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


        return data?.session || null;

    }catch(error){

        console.error(
            "[ADMIN SESSION]",
            error
        );

        return null;

    }

}


/* ==========================================
   IS ADMIN LOGGED IN
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

            console.error(
                "[ADMIN PROFILE]",
                error
            );

            return null;

        }


        if(!data){

            return null;

        }


        return data;


    }catch(error){

        console.error(
            "[ADMIN CURRENT]",
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


    return admin
        ? admin.role_code
        : null;

}


/* ==========================================
   GET CURRENT ADMIN NETWORK
========================================== */

async function getCurrentAdminNetwork(){

    /*
       Admin identity remains tied to
       Supabase Auth.

       Network is resolved from the
       current ALBUKHR deployment.
    */

    try{

        return getCurrentAdminNetworkValue();

    }catch(error){

        console.error(
            "[ADMIN NETWORK]",
            error
        );

        return null;

    }

}


/*
   Internal synchronous resolver.

   Kept separate so async callers
   and synchronous callers can both
   use the network safely.
*/

function getCurrentAdminNetworkValue(){

    return requireAdminNetwork();

}


/* ==========================================
   REFRESH ADMIN SESSION
========================================== */

async function refreshAdminSession(){

    try{

        requireAdminNetwork();


        const supabase =
            getAdminClient();


        const {
            data,
            error
        } =
            await supabase.auth.refreshSession();


        if(error){

            console.error(
                "[ADMIN REFRESH]",
                error
            );

            return false;

        }


        return !!(
            data?.session?.user?.id
        );


    }catch(error){

        console.error(
            "[ADMIN REFRESH]",
            error
        );

        return false;

    }

}


/* ==========================================
   REQUIRE ADMIN SESSION
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
   REQUIRE ADMIN NETWORK
========================================== */

function requireCurrentAdminNetwork(){

    return requireAdminNetwork();

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


window.getCurrentAdminEnvironment =
    getCurrentAdminEnvironment;


window.getCurrentAdminNetwork =
    getCurrentAdminNetwork;


window.requireAdminNetwork =
    requireAdminNetwork;


window.requireCurrentAdminNetwork =
    requireCurrentAdminNetwork;


window.refreshAdminSession =
    refreshAdminSession;


window.isAdminLoggedIn =
    isAdminLoggedIn;


window.requireAdminSession =
    requireAdminSession;


})(window);
