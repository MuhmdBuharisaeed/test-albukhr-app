/* ==========================================
   ALBUKHR ADMIN CORE
   Master Loader
   Version 1.0
========================================== */

(function(window){

"use strict";

/* ==========================================
   CONFIG
========================================== */

const BASE =
"js/supabase-admin-auth/";

const MODULES = [

"admin-session.js",

"admin-logs.js",

"admin-permissions.js",

"admin-router.js",

"admin-guard.js",

"admin-auth.js",

"admin-bootstrap.js"

];

/* ==========================================
   LOAD SCRIPT
========================================== */

function loadScript(file){

    return new Promise((resolve,reject)=>{

        const script =
        document.createElement("script");

        script.src =
        BASE + file;

        script.onload =
        ()=>resolve(file);

        script.onerror =
        ()=>reject(
            new Error(
                "Failed to load " + file
            )
        );

        document.head.appendChild(script);

    });

}

/* ==========================================
   LOAD ALL MODULES
========================================== */

async function loadAdminModules(){

    for(const file of MODULES){

        await loadScript(file);

    }

}

/* ==========================================
   START
========================================== */

async function startAdminCore(){

    try{

        if(
            typeof getAlbukhrSupabaseClient !==
            "function"
        ){

            throw new Error(
                "Supabase Core missing."
            );

        }

        await loadAdminModules();

        if(
            typeof initializeAdmin ===
            "function"
        ){

            await initializeAdmin();

        }

        console.log(
            "✅ ALBUKHR Admin Core Ready"
        );

    }catch(error){

        console.error(
            "[ADMIN CORE]",
            error
        );

        location.replace(
            "admin-login.html"
        );

    }

}

/* ==========================================
   AUTO START
========================================== */

document.addEventListener(

    "DOMContentLoaded",

    startAdminCore

);

/* ==========================================
   EXPORT
========================================== */

window.startAdminCore =
startAdminCore;

})(window);
