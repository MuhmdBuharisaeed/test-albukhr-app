/* ==========================================
   ALBUKHR AUTH CORE
   Version 4.0
========================================== */

(function(window){

"use strict";

/* ==========================================
   INTERNAL CLIENT
========================================== */

let client = null;

/* ==========================================
   CREATE CLIENT
========================================== */

function createClient(){

    if(client){

        return client;

    }

    if(

        !window.supabase ||

        typeof window.supabase.createClient !== "function"

    ){

        throw new Error(

            "Supabase SDK not loaded."

        );

    }

    if(

        !window.ALBUKHR_AUTH_CONFIG

    ){

        throw new Error(

            "Auth Config not loaded."

        );

    }

    const config =

    window.ALBUKHR_AUTH_CONFIG;

    client =

    window.supabase.createClient(

        config.url,

        config.anonKey,

        {

            auth:config.auth

        }

    );

    return client;

}

/* ==========================================
   GET CLIENT
========================================== */

function getClient(){

    return createClient();

}

/* ==========================================
   READY
========================================== */

function isReady(){

    try{

        return !!getClient();

    }catch{

        return false;

    }

}

/* ==========================================
   HEALTH
========================================== */

function health(){

    return{

        ready:

        isReady(),

        sdk:

        !!window.supabase,

        config:

        !!window.ALBUKHR_AUTH_CONFIG,

        client:

        !!client

    };

}

/* ==========================================
   EXPORT
========================================== */

window.AlbukhrAuthCore = {

    getClient,

    isReady,

    health

};

console.log(

    "✅ ALBUKHR Auth Core Ready"

);

})(window);
