/* ==========================================
   ALBUKHR ADMIN SUPABASE AUTH CORE
   Version 2.0
   ISOLATED ADMIN AUTH CLIENT

   LOCATION:
   js/supabase-admin-auth/admin-supabase-auth.js

   PURPOSE:
   - Dedicated Supabase client for Admin Auth
   - Does NOT overwrite ecosystem Supabase Core
   - Does NOT use js/auth/supabase-auth.js
   - Does NOT modify staking/liquidity/treasury engines
   - Persistent Admin Auth session
========================================== */

(function(window){

"use strict";


/* ==========================================
   CONFIG
========================================== */

const ADMIN_SUPABASE_URL =
    "https://qexmnghilahsvethlxem.supabase.co";

const ADMIN_SUPABASE_KEY =
    "sb_publishable_mSbWlhVKdmSjasKJC50QYw_5wzgRMe2";


/* ==========================================
   INTERNAL STATE
========================================== */

let adminClient = null;

let adminInitError = null;


/* ==========================================
   SDK CHECK
========================================== */

function hasAdminSupabaseSDK(){

    return !!(
        window.supabase &&
        typeof window.supabase.createClient ===
            "function"
    );

}


/* ==========================================
   ENVIRONMENT
========================================== */

function getAlbukhrAdminEnvironment(){

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
       Local/dev fallback.
    */

    return "mainnet";

}


/* ==========================================
   CREATE ADMIN CLIENT
========================================== */

function createAlbukhrAdminSupabaseClient(){

    if(adminClient){

        return adminClient;

    }


    if(!hasAdminSupabaseSDK()){

        adminInitError =
            "Supabase SDK not found. " +
            "Load @supabase/supabase-js first.";

        console.error(
            "[ADMIN AUTH CORE]",
            adminInitError
        );

        return null;

    }


    try{

        adminClient =
            window.supabase.createClient(

                ADMIN_SUPABASE_URL,

                ADMIN_SUPABASE_KEY,

                {

                    auth:{

                        /*
                           Admin authentication requires
                           persistent Supabase Auth session.
                        */

                        persistSession:true,

                        autoRefreshToken:true,

                        detectSessionInUrl:false,

                        /*
                           Dedicated storage namespace.

                           This prevents the Admin Auth
                           session from colliding with
                           other Supabase clients.
                        */

                        storageKey:
                            "albukhr_admin_auth_session"

                    }

                }

            );


        adminInitError = null;


        console.log(
            "✅ ALBUKHR Admin Supabase Auth Core ready"
        );


        console.log(
            "Admin Environment:",
            getAlbukhrAdminEnvironment()
        );


        return adminClient;


    }catch(error){

        adminInitError =
            error?.message ||
            "Failed to create Admin Supabase client.";

        console.error(
            "[ADMIN AUTH CORE]",
            error
        );

        return null;

    }

}


/* ==========================================
   GET ADMIN CLIENT
========================================== */

function getAlbukhrAdminSupabaseClient(){

    if(adminClient){

        return adminClient;

    }

    return createAlbukhrAdminSupabaseClient();

}


/* ==========================================
   REQUIRE ADMIN CLIENT
========================================== */

function requireAlbukhrAdminSupabaseClient(){

    const client =
        getAlbukhrAdminSupabaseClient();


    if(!client){

        throw new Error(
            adminInitError ||
            "ALBUKHR Admin Supabase Auth Core not initialized."
        );

    }


    return client;

}


/* ==========================================
   ADMIN NETWORK
========================================== */

function getAlbukhrAdminNetwork(){

    return getAlbukhrAdminEnvironment();

}


/* ==========================================
   HEALTH
========================================== */

function albukhrAdminSupabaseHealth(){

    const client =
        getAlbukhrAdminSupabaseClient();


    return {

        ready:
            !!client,

        has_sdk:
            hasAdminSupabaseSDK(),

        has_client:
            !!client,

        environment:
            getAlbukhrAdminEnvironment(),

        network:
            getAlbukhrAdminNetwork(),

        url:
            ADMIN_SUPABASE_URL,

        key_present:
            !!ADMIN_SUPABASE_KEY,

        init_error:
            adminInitError || null

    };

}


/* ==========================================
   EXPORT
========================================== */

window.ALBUKHR_ADMIN_SUPABASE_URL =
    ADMIN_SUPABASE_URL;


window.ALBUKHR_ADMIN_SUPABASE_KEY =
    ADMIN_SUPABASE_KEY;


window.getAlbukhrAdminEnvironment =
    getAlbukhrAdminEnvironment;


window.getAlbukhrAdminNetwork =
    getAlbukhrAdminNetwork;


window.getAlbukhrAdminSupabaseClient =
    getAlbukhrAdminSupabaseClient;


window.requireAlbukhrAdminSupabaseClient =
    requireAlbukhrAdminSupabaseClient;


window.isAlbukhrAdminSupabaseReady =
    function(){

        return !!(
            getAlbukhrAdminSupabaseClient()
        );

    };


window.albukhrAdminSupabaseHealth =
    albukhrAdminSupabaseHealth;


/* ==========================================
   INITIALIZE
========================================== */

createAlbukhrAdminSupabaseClient();


/* ==========================================
   VERIFY
========================================== */

try{

    const health =
        albukhrAdminSupabaseHealth();


    if(
        health.ready
    ){

        console.log(
            "✅ ADMIN AUTH CORE VERIFIED",
            health
        );

    }else{

        console.error(
            "❌ ADMIN AUTH CORE FAILED",
            health
        );

    }

}catch(error){

    console.error(
        "❌ ADMIN AUTH CORE VERIFICATION FAILED",
        error
    );

}


})(window);
