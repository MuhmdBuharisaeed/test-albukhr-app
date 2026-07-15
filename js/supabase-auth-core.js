/* =========================================
   ALBUKHR SUPABASE AUTH CORE
   Version 1.0
========================================= */

(function(window){

"use strict";

/* =========================================
   CONFIG
========================================= */

const ALBUKHR_AUTH_URL =
window.ALBUKHR_SUPABASE_URL ||
"https://qexmnghilahsvethlxem.supabase.co";

const ALBUKHR_AUTH_KEY =
window.ALBUKHR_SUPABASE_KEY ||
"YOUR_SUPABASE_ANON_KEY";

/* =========================================
   INTERNAL CACHE
========================================= */

let __authClient = null;

/* =========================================
   CREATE CLIENT
========================================= */

function createAuthClient(){

    if(__authClient){

        return __authClient;

    }

    if(

        !window.supabase ||

        typeof window.supabase.createClient !==

        "function"

    ){

        throw new Error(

            "Supabase SDK not loaded."

        );

    }

    __authClient =

    window.supabase.createClient(

        ALBUKHR_AUTH_URL,

        ALBUKHR_AUTH_KEY,

        {

            auth:{

                persistSession:true,

                autoRefreshToken:true,

                detectSessionInUrl:false

            }

        }

    );

    return __authClient;

}

/* =========================================
   GET CLIENT
========================================= */

function getAlbukhrAuthClient(){

    return createAuthClient();

}

/* =========================================
   READY
========================================= */

function isAlbukhrAuthReady(){

    try{

        return !!getAlbukhrAuthClient();

    }catch{

        return false;

    }

}

/* =========================================
   HEALTH
========================================= */

function albukhrAuthHealth(){

    return{

        ready:

        isAlbukhrAuthReady(),

        has_sdk:

        !!window.supabase,

        has_client:

        !!__authClient

    };

}

/* =========================================
   EXPORT
========================================= */

window.albukhrAuth =

getAlbukhrAuthClient();

window.getAlbukhrAuthClient =

getAlbukhrAuthClient;

window.isAlbukhrAuthReady =

isAlbukhrAuthReady;

window.albukhrAuthHealth =

albukhrAuthHealth;

console.log(

"✅ ALBUKHR Auth Core Ready"

console.log("=== AUTH CORE ===");
console.log("URL:", ALBUKHR_AUTH_URL);
console.log("KEY:", ALBUKHR_AUTH_KEY);
console.log("CLIENT:", __authClient);
console.log("FUNCTION:", typeof window.getAlbukhrAuthClient);
   
);

})(window);

console.log("AUTH CORE FILE LOADED");
console.log(typeof window.getAlbukhrAuthClient);
