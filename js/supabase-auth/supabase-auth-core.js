/* ==========================================
   ALBUKHR AUTH CORE
   Version 4.0
========================================== */

(function(window){

"use strict";

/* ==========================================
   CONFIG
========================================== */

const CONFIG =
window.ALBUKHR_AUTH_CONFIG;

if(!CONFIG){

    throw new Error(
        "ALBUKHR_AUTH_CONFIG not loaded."
    );

}

/* ==========================================
   CLIENT
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

        typeof window.supabase.createClient !==
        "function"

    ){

        throw new Error(
            "Supabase SDK not loaded."
        );

    }

    client =
    window.supabase.createClient(

        CONFIG.url,

        CONFIG.anonKey,

        {

            auth:CONFIG.auth

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
   SIGN IN
========================================== */

async function signIn(

    email,

    password

){

    return await getClient()

    .auth

    .signInWithPassword({

        email,

        password

    });

}

/* ==========================================
   SIGN OUT
========================================== */

async function signOut(){

    return await getClient()

    .auth

    .signOut();

}

/* ==========================================
   SESSION
========================================== */

async function getSession(){

    const {

        data,

        error

    } = await getClient()

    .auth

    .getSession();

    if(error){

        throw error;

    }

    return data.session;

}

/* ==========================================
   USER
========================================== */

async function getUser(){

    const {

        data,

        error

    } = await getClient()

    .auth

    .getUser();

    if(error){

        throw error;

    }

    return data.user;

}

/* ==========================================
   REFRESH
========================================== */

async function refreshSession(){

    return await getClient()

    .auth

    .refreshSession();

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

        !!CONFIG,

        client:

        !!client

    };

}

/* ==========================================
   EXPORT
========================================== */

window.AlbukhrAuth = {

    get client(){

        return getClient();

    },

    getClient,

    signIn,

    signOut,

    getSession,

    getUser,

    refreshSession,

    isReady,

    health

};

console.log(

"✅ ALBUKHR Auth Core Ready"

);

})(window);
