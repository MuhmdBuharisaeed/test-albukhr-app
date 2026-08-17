/* ==========================================
   ALBUKHR ADMIN SUPABASE AUTH CORE
   Version 1.0
   ISOLATED ADMIN CLIENT

   IMPORTANT:
   - Does NOT overwrite js/supabase-core.js
   - Does NOT overwrite getAlbukhrSupabaseClient()
   - Dedicated only to Admin Authentication
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
        typeof window.supabase.createClient === "function"
    );

}


/* ==========================================
   ENVIRONMENT
========================================== */

function getAlbukhrAdminEnvironment(){

    const hostname =
        String(
            window.location.hostname || ""
        ).toLowerCase();

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
   CREATE ADMIN CLIENT
========================================== */

function createAlbukhrAdminSupabaseClient(){

    if(adminClient){

        return adminClient;

    }


    if(!hasAdminSupabaseSDK()){

        adminInitError =
            "Supabase SDK not found.";

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

                        persistSession:true,

                        autoRefreshToken:true,

                        detectSessionInUrl:false,

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
   HEALTH
========================================== */

function albukhrAdminSupabaseHealth(){

    const client =
        getAlbukhrAdminSupabaseClient();

    return {

        ready:!!client,

        has_sdk:
            hasAdminSupabaseSDK(),

        has_client:
            !!client,

        environment:
            getAlbukhrAdminEnvironment(),

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

window.getAlbukhrAdminSupabaseClient =
    getAlbukhrAdminSupabaseClient;

window.requireAlbukhrAdminSupabaseClient =
    requireAlbukhrAdminSupabaseClient;

window.isAlbukhrAdminSupabaseReady =
    function(){

        return !!getAlbukhrAdminSupabaseClient();

    };

window.albukhrAdminSupabaseHealth =
    albukhrAdminSupabaseHealth;


/* ==========================================
   INITIALIZE
========================================== */

createAlbukhrAdminSupabaseClient();


})(window);
