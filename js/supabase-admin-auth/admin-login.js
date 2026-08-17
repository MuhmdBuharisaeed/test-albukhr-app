/* ==========================================
   ALBUKHR ADMIN LOGIN CONTROLLER
   Version 2.1

   DEPENDS ON:
   - admin-supabase-auth.js
   - admin-session.js
   - admin-auth.js

   PURPOSE:
   - Admin login UI controller
   - Uses Supabase Admin Auth session
   - Does NOT use ecosystem Supabase Core
   - Does NOT use LocalStorage
   - Does NOT create a second auth system
   - Does NOT depend on sessionStorage login gates
========================================== */

(function(window){

"use strict";


/* ==========================================
   CONFIG
========================================== */

const ADMIN_CONTROL_CENTER =
    "unified-admin-buttons.html";

const ADMIN_LOGIN_PAGE =
    "admin-login.html";


/* ==========================================
   SAFE REDIRECT
========================================== */

function redirectToAdminCenter(){

    window.location.replace(
        ADMIN_CONTROL_CENTER
    );

}


/* ==========================================
   CHECK ADMIN SESSION
========================================== */

async function checkExistingAdminSession(){

    try{

        if(
            typeof window.getCurrentAdmin !==
            "function"
        ){

            console.warn(
                "[ADMIN LOGIN] getCurrentAdmin() not available yet."
            );

            return false;

        }


        const admin =
            await window.getCurrentAdmin();


        if(!admin){

            return false;

        }


        /*
           Session exists AND admin_users contains
           an active administrator record.
        */

        console.log(
            "✅ Existing ALBUKHR Admin session detected."
        );


        console.log(
            "[ADMIN LOGIN] Admin:",
            admin.username
        );


        console.log(
            "[ADMIN LOGIN] Role:",
            admin.role_code
        );


        redirectToAdminCenter();

        return true;


    }catch(error){

        console.warn(
            "[ADMIN LOGIN] Existing session check failed:",
            error
        );

        return false;

    }

}


/* ==========================================
   DOM READY
========================================== */

document.addEventListener(

    "DOMContentLoaded",

    async function(){

        /*
           Do not redirect blindly.

           Only redirect when:
           1. Supabase Admin session exists
           2. admin_users record exists
           3. status = active
        */

        await checkExistingAdminSession();

    }

);


/* ==========================================
   LOGIN
========================================== */

async function login(){

    const btn =
        document.querySelector(
            ".login-btn"
        );


    const emailInput =
        document.getElementById(
            "email"
        );


    const keyInput =
        document.getElementById(
            "key"
        );


    /* ======================================
       ELEMENT VALIDATION
    ====================================== */

    if(!emailInput){

        console.error(
            "[ADMIN LOGIN] Email input not found."
        );

        alert(
            "Login form error: email field is missing."
        );

        return;

    }


    if(!keyInput){

        console.error(
            "[ADMIN LOGIN] Access key input not found."
        );

        alert(
            "Login form error: access key field is missing."
        );

        return;

    }


    /* ======================================
       READ INPUT
    ====================================== */

    const email =
        String(
            emailInput.value || ""
        )
        .trim()
        .toLowerCase();


    const key =
        String(
            keyInput.value || ""
        )
        .trim();


    /* ======================================
       VALIDATE EMAIL
    ====================================== */

    if(!email){

        alert(
            "Administrator Email Required"
        );

        emailInput.focus();

        return;

    }


    /* ======================================
       VALIDATE ACCESS KEY
    ====================================== */

    if(!key){

        alert(
            "Access Key Required"
        );

        keyInput.focus();

        return;

    }


    /* ======================================
       LOCK BUTTON
    ====================================== */

    if(btn){

        btn.disabled =
            true;

        btn.textContent =
            "Signing In...";

    }


    try{

        /* ==================================
           VERIFY ADMIN AUTH ENGINE
        ================================== */

        if(
            typeof window.adminLogin !==
            "function"
        ){

            throw new Error(
                "ALBUKHR Admin Authentication Engine is not loaded."
            );

        }


        /* ==================================
           AUTHENTICATE
        ================================== */

        const result =
            await window.adminLogin({

                email,

                accessKey:key

            });


        /* ==================================
           LOGIN FAILURE
        ================================== */

        if(
            !result ||
            result.success !== true
        ){

            alert(
                result?.error ||
                "Login failed."
            );

            return;

        }


        /* ==================================
           VERIFY RETURNED ADMIN
        ================================== */

        if(
            !result.admin ||
            !result.admin.id
        ){

            console.error(
                "[ADMIN LOGIN] Authentication succeeded but admin profile is missing."
            );


            alert(
                "Authentication succeeded, but administrator verification failed."
            );


            /*
               Safety cleanup.
            */

            if(
                typeof window.adminLogout ===
                "function"
            ){

                try{

                    await window.adminLogout();

                }catch(error){

                    console.warn(
                        "[ADMIN LOGIN] Cleanup failed:",
                        error
                    );

                }

            }

            return;

        }


        /* ==================================
           SUCCESS
        ================================== */

        console.log(
            "✅ ALBUKHR Admin Login Successful"
        );


        console.log(
            "[ADMIN LOGIN] Username:",
            result.admin.username
        );


        console.log(
            "[ADMIN LOGIN] Role:",
            result.admin.role_code
        );


        console.log(
            "[ADMIN LOGIN] Environment:",
            result.environment ||
            "unknown"
        );


        /*
           IMPORTANT:

           We intentionally DO NOT write:

           sessionStorage.setItem(
               "albukhr_admin_entry",
               "granted"
           );

           Supabase Admin Auth session is the
           authentication source of truth.
        */


        /* ==================================
           REDIRECT
        ================================== */

        redirectToAdminCenter();


    }catch(error){

        console.error(
            "[ADMIN LOGIN]",
            error
        );


        alert(
            error?.message ||
            "Login failed."
        );


    }finally{

        if(btn){

            btn.disabled =
                false;

            btn.textContent =
                "Access Control Center";

        }

    }

}


/* ==========================================
   ENTER KEY SUPPORT
========================================== */

document.addEventListener(

    "DOMContentLoaded",

    function(){

        const emailInput =
            document.getElementById(
                "email"
            );


        const keyInput =
            document.getElementById(
                "key"
            );


        if(!emailInput || !keyInput){

            return;

        }


        /*
           Allow Enter from either field.
        */

        [emailInput, keyInput].forEach(

            function(input){

                input.addEventListener(

                    "keydown",

                    function(event){

                        if(
                            event.key ===
                            "Enter"
                        ){

                            event.preventDefault();

                            login();

                        }

                    }

                );

            }

        );

    }

);


/* ==========================================
   EXPORT
========================================== */

window.login =
    login;


window.checkExistingAdminSession =
    checkExistingAdminSession;


})(window);
