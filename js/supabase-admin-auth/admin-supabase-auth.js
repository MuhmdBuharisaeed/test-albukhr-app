/* ==========================================
   ALBUKHR ADMIN SUPABASE AUTH CORE
   Version 2.1
   ISOLATED ADMIN AUTH CLIENT

   LOCATION:
   js/supabase-admin-auth/admin-supabase-auth.js

   PURPOSE:
   - Dedicated Supabase client for Admin Auth
   - Does NOT overwrite ecosystem Supabase Core
   - Does NOT use js/auth/supabase-auth.js
   - Does NOT modify staking/liquidity/treasury engines
   - Persistent Admin Auth session
   - Mainnet/Testnet environment awareness
   - Dedicated Admin Auth storage namespace

   IMPORTANT:
   This client is ONLY for Admin Authentication.
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
   CONSTANTS
========================================== */

const ADMIN_AUTH_STORAGE_KEY =
    "albukhr_admin_auth_session";


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
   ENVIRONMENT RESOLUTION
==========================================

   Admin environment is resolved from the
   current ALBUKHR deployment hostname.

   test.albukhr.com
        → testnet

   app.albukhr.com
        → mainnet

   Unknown environments are REFUSED.

========================================== */

function getAlbukhrAdminEnvironment(){

    const hostname =
        String(
            window.location.hostname || ""
        )
        .trim()
        .toLowerCase();


    /* ==============================
       TESTNET
    ============================== */

    if(
        hostname === "test.albukhr.com" ||
        hostname.startsWith("test.")
    ){

        return "testnet";

    }


    /* ==============================
       MAINNET
    ============================== */

    if(
        hostname === "app.albukhr.com" ||
        hostname.startsWith("app.")
    ){

        return "mainnet";

    }


    /* ==============================
       UNKNOWN ENVIRONMENT
    ============================== */

    throw new Error(
        "ALBUKHR Admin environment could not be determined. " +
        "Admin authentication has been refused for this host."
    );

}


/* ==========================================
   ADMIN NETWORK
========================================== */

function getAlbukhrAdminNetwork(){

    return getAlbukhrAdminEnvironment();

}


/* ==========================================
   VALIDATE ADMIN ENVIRONMENT
========================================== */

function assertAlbukhrAdminEnvironment(){

    const environment =
        getAlbukhrAdminEnvironment();


    if(
        environment !== "mainnet" &&
        environment !== "testnet"
    ){

        throw new Error(
            "Invalid ALBUKHR Admin environment."
        );

    }


    return true;

}


/* ==========================================
   CREATE ADMIN CLIENT
========================================== */

function createAlbukhrAdminSupabaseClient(){

    /* --------------------------------------
       EXISTING CLIENT
    -------------------------------------- */

    if(adminClient){

        return adminClient;

    }


    /* --------------------------------------
       ENVIRONMENT CHECK
    -------------------------------------- */

    try{

        assertAlbukhrAdminEnvironment();

    }catch(error){

        adminInitError =
            error?.message ||
            "ALBUKHR Admin environment unavailable.";

        console.error(
            "[ADMIN AUTH CORE]",
            adminInitError
        );

        return null;

    }


    /* --------------------------------------
       SDK CHECK
    -------------------------------------- */

    if(!hasAdminSupabaseSDK()){

        adminInitError =
            "Supabase SDK not found. " +
            "Load @supabase/supabase-js before " +
            "admin-supabase-auth.js.";

        console.error(
            "[ADMIN AUTH CORE]",
            adminInitError
        );

        return null;

    }


    /* --------------------------------------
       CREATE CLIENT
    -------------------------------------- */

    try{

        adminClient =
            window.supabase.createClient(

                ADMIN_SUPABASE_URL,

                ADMIN_SUPABASE_KEY,

                {

                    auth:{

                        /*
                           Admin Auth requires a
                           persistent session.

                           This is intentional.

                           It is NOT application
                           LocalStorage state.
                        */

                        persistSession:true,

                        autoRefreshToken:true,

                        detectSessionInUrl:false,

                        /*
                           Dedicated storage namespace.

                           Prevents collision with
                           other Supabase clients.
                        */

                        storageKey:
                            ADMIN_AUTH_STORAGE_KEY

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

        adminClient = null;

        adminInitError =
            error?.message ||
            "Failed to create ALBUKHR Admin Supabase client.";

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

            "ALBUKHR Admin Supabase Auth Core " +
            "not initialized."

        );

    }


    return client;

}


/* ==========================================
   ADMIN AUTH HEALTH
========================================== */

function albukhrAdminSupabaseHealth(){

    let environment = null;

    let environmentError = null;


    /* --------------------------------------
       ENVIRONMENT
    -------------------------------------- */

    try{

        environment =
            getAlbukhrAdminEnvironment();

    }catch(error){

        environmentError =
            error?.message ||
            "Admin environment unavailable.";

    }


    /* --------------------------------------
       CLIENT
    -------------------------------------- */

    const client =
        getAlbukhrAdminSupabaseClient();


    /* --------------------------------------
       HEALTH RESULT
    -------------------------------------- */

    return {

        ready:
            !!client,

        has_sdk:
            hasAdminSupabaseSDK(),

        has_client:
            !!client,

        environment:
            environment,

        network:
            environment,

        environment_ready:
            !!environment,

        url:
            ADMIN_SUPABASE_URL,

        key_present:
            !!ADMIN_SUPABASE_KEY,

        storage_key:
            ADMIN_AUTH_STORAGE_KEY,

        persistent_session:
            true,

        init_error:
            adminInitError || null,

        environment_error:
            environmentError

    };

}


/* ==========================================
   ADMIN AUTH READY CHECK
========================================== */

function isAlbukhrAdminSupabaseReady(){

    return !!(
        getAlbukhrAdminSupabaseClient()
    );

}


/* ==========================================
   VERIFY ADMIN AUTH CORE
========================================== */

function verifyAlbukhrAdminAuthCore(){

    const health =
        albukhrAdminSupabaseHealth();


    if(
        !health.ready
    ){

        console.error(
            "❌ ALBUKHR ADMIN AUTH CORE FAILED",
            health
        );

        return false;

    }


    if(
        !health.environment_ready
    ){

        console.error(
            "❌ ALBUKHR ADMIN ENVIRONMENT FAILED",
            health
        );

        return false;

    }


    console.log(
        "✅ ALBUKHR ADMIN AUTH CORE VERIFIED",
        health
    );


    return true;

}


/* ==========================================
   EXPORT CONFIG
========================================== */

window.ALBUKHR_ADMIN_SUPABASE_URL =
    ADMIN_SUPABASE_URL;


window.ALBUKHR_ADMIN_SUPABASE_KEY =
    ADMIN_SUPABASE_KEY;


/* ==========================================
   EXPORT ENVIRONMENT
========================================== */

window.getAlbukhrAdminEnvironment =
    getAlbukhrAdminEnvironment;


window.getAlbukhrAdminNetwork =
    getAlbukhrAdminNetwork;


window.assertAlbukhrAdminEnvironment =
    assertAlbukhrAdminEnvironment;


/* ==========================================
   EXPORT CLIENT
========================================== */

window.getAlbukhrAdminSupabaseClient =
    getAlbukhrAdminSupabaseClient;


window.requireAlbukhrAdminSupabaseClient =
    requireAlbukhrAdminSupabaseClient;


window.isAlbukhrAdminSupabaseReady =
    isAlbukhrAdminSupabaseReady;


/* ==========================================
   EXPORT HEALTH
========================================== */

window.albukhrAdminSupabaseHealth =
    albukhrAdminSupabaseHealth;


window.verifyAlbukhrAdminAuthCore =
    verifyAlbukhrAdminAuthCore;


/* ==========================================
   INITIALIZE
========================================== */

createAlbukhrAdminSupabaseClient();


/* ==========================================
   VERIFY
========================================== */

try{

    verifyAlbukhrAdminAuthCore();

}catch(error){

    console.error(
        "❌ ALBUKHR ADMIN AUTH CORE " +
        "VERIFICATION FAILED",
        error
    );

}


})(window);
