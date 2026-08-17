/* ==========================================
   ALBUKHR ADMIN LOGIN CONTROLLER
   Version 3.0

   ARCHITECTURE:
   - admin-supabase-auth.js
   - admin-session.js
   - admin-auth.js

   PURPOSE:
   - Admin login UI controller
   - Uses isolated Admin Supabase Auth
   - Supabase Auth is the authentication source
     of truth
   - Redirects ONLY after successful login
   - No automatic login-page redirect
   - No LocalStorage
   - No sessionStorage
   - No competing authentication flow
   - Prevents LOGIN ↔ UNIFIED redirect loops

   IMPORTANT:
   This controller does NOT:
   - create a Supabase client
   - sign out automatically on page load
   - redirect because an existing session exists
   - use ecosystem Supabase Core
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
   INTERNAL STATE
========================================== */

let loginInProgress =
    false;


/* ==========================================
   SAFE REDIRECT
========================================== */

function redirectToAdminCenter(){

    try{

        window.location.replace(
            ADMIN_CONTROL_CENTER
        );

    }catch(error){

        console.error(
            "[ADMIN LOGIN] Redirect failed:",
            error
        );

    }

}


/* ==========================================
   GET ADMIN SESSION
========================================== */

async function getExistingAdminSession(){

    try{

        /*
           admin-session.js owns the session
           lookup.

           We only READ the session here.

           We do NOT redirect.
           We do NOT logout.
        */

        if(
            typeof window.getCurrentSession !==
            "function"
        ){

            console.warn(
                "[ADMIN LOGIN] getCurrentSession() is not available."
            );

            return null;

        }


        const session =
            await window.getCurrentSession();


        if(
            !session?.user?.id
        ){

            return null;

        }


        return session;


    }catch(error){

        console.warn(
            "[ADMIN LOGIN] Existing session lookup failed:",
            error
        );

        return null;

    }

}


/* ==========================================
   CHECK EXISTING ADMIN SESSION
========================================== */

/*
   IMPORTANT:

   This function is intentionally READ-ONLY.

   It MUST NOT redirect to the Admin Control
   Center.

   The previous Version 2.1 redirected here,
   which could create:

       login → unified → login → unified

   when Bootstrap temporarily failed.

   It is retained as a compatibility/debug
   helper only.
*/

async function checkExistingAdminSession(){

    try{

        const session =
            await getExistingAdminSession();


        if(
            !session
        ){

            console.log(
                "[ADMIN LOGIN] No existing Admin session."
            );

            return false;

        }


        console.log(
            "ℹ️ Existing ALBUKHR Admin Supabase session detected."
        );


        console.log(
            "[ADMIN LOGIN] Auth User:",
            session.user?.email ||
            session.user?.id ||
            "unknown"
        );


        /*
           IMPORTANT:

           We deliberately DO NOT call:

               redirectToAdminCenter()

           here.
        */


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
   LOGIN BUTTON STATE
========================================== */

function setLoginButtonState(
    loading
){

    const btn =
        document.querySelector(
            ".login-btn"
        );


    if(!btn){

        return;

    }


    if(loading){

        btn.disabled =
            true;

        btn.setAttribute(
            "aria-busy",
            "true"
        );

        btn.textContent =
            "Signing In...";

    }else{

        btn.disabled =
            false;

        btn.removeAttribute(
            "aria-busy"
        );

        btn.textContent =
            "Access Control Center";

    }

}


/* ==========================================
   GET INPUTS
========================================== */

function getLoginInputs(){

    const emailInput =
        document.getElementById(
            "email"
        );


    const keyInput =
        document.getElementById(
            "key"
        );


    return {

        emailInput,

        keyInput

    };

}


/* ==========================================
   VALIDATE LOGIN FORM
========================================== */

function validateLoginForm(){

    const {

        emailInput,

        keyInput

    } =
        getLoginInputs();


    if(!emailInput){

        console.error(
            "[ADMIN LOGIN] Email input not found."
        );

        alert(
            "Login form error: administrator email field is missing."
        );

        return null;

    }


    if(!keyInput){

        console.error(
            "[ADMIN LOGIN] Access key input not found."
        );

        alert(
            "Login form error: access key field is missing."
        );

        return null;

    }


    const email =
        String(
            emailInput.value || ""
        )
        .trim()
        .toLowerCase();


    const accessKey =
        String(
            keyInput.value || ""
        )
        .trim();


    if(!email){

        alert(
            "Administrator Email Required"
        );

        emailInput.focus();

        return null;

    }


    if(!accessKey){

        alert(
            "Access Key Required"
        );

        keyInput.focus();

        return null;

    }


    return {

        email,

        accessKey,

        emailInput,

        keyInput

    };

}


/* ==========================================
   LOGIN
========================================== */

async function login(){

    /*
       Prevent double-click / duplicate
       Supabase sign-in requests.
    */

    if(loginInProgress){

        return;

    }


    const form =
        validateLoginForm();


    if(!form){

        return;

    }


    loginInProgress =
        true;


    setLoginButtonState(
        true
    );


    try{

        /* ==================================
           VERIFY AUTH ENGINE
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

        console.log(
            "[ADMIN LOGIN] Authenticating Admin..."
        );


        const result =
            await window.adminLogin({

                email:
                    form.email,

                accessKey:
                    form.accessKey

            });


        /* ==================================
           AUTH FAILURE
        ================================== */

        if(
            !result ||
            result.success !== true
        ){

            console.warn(
                "[ADMIN LOGIN] Authentication failed:",
                result?.error
            );


            alert(
                result?.error ||
                "Administrator authentication failed."
            );


            return;

        }


        /* ==================================
           VERIFY ADMIN PROFILE
        ================================== */

        if(
            !result.admin ||
            !result.admin.id
        ){

            console.error(
                "[ADMIN LOGIN] Auth succeeded but Admin profile is missing."
            );


            /*
               This is a genuine safety failure
               because adminLogin() should only
               return success after admin_users
               verification.
            */

            alert(
                "Authentication succeeded, but administrator verification failed."
            );


            /*
               Cleanup only here because the
               authentication result itself is
               inconsistent.
            */

            if(
                typeof window.adminLogout ===
                "function"
            ){

                try{

                    await window.adminLogout();

                }catch(error){

                    console.warn(
                        "[ADMIN LOGIN] Safety cleanup failed:",
                        error
                    );

                }

            }


            return;

        }


        /* ==================================
           VERIFY SESSION
        ================================== */

        if(
            !result.session ||
            !result.session.user?.id
        ){

            console.error(
                "[ADMIN LOGIN] Admin authentication succeeded without a valid session."
            );


            alert(
                "Administrator authentication did not return a valid session."
            );


            /*
               Cleanup inconsistent auth state.
            */

            if(
                typeof window.adminLogout ===
                "function"
            ){

                try{

                    await window.adminLogout();

                }catch(error){

                    console.warn(
                        "[ADMIN LOGIN] Session cleanup failed:",
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
            result.admin.username ||
            ""
        );


        console.log(
            "[ADMIN LOGIN] Role:",
            result.admin.role_code ||
            ""
        );


        console.log(
            "[ADMIN LOGIN] Auth User:",
            result.user?.email ||
            result.user?.id ||
            ""
        );


        /*
           IMPORTANT:

           No LocalStorage.
           No sessionStorage.
           No admin entry gate.

           Supabase Auth has already persisted
           the Admin session.
        */


        /* ==================================
           FINAL REDIRECT
        ================================== */

        redirectToAdminCenter();


    }catch(error){

        console.error(
            "[ADMIN LOGIN] Login exception:",
            error
        );


        alert(
            error?.message ||
            "Administrator login failed."
        );


    }finally{

        /*
           If redirect is already happening,
           this state change is harmless.

           If login failed, it unlocks the
           button for another attempt.
        */

        loginInProgress =
            false;


        setLoginButtonState(
            false
        );

    }

}


/* ==========================================
   ENTER KEY SUPPORT
========================================== */

function initializeEnterKeySupport(){

    const {

        emailInput,

        keyInput

    } =
        getLoginInputs();


    if(
        !emailInput ||
        !keyInput
    ){

        console.warn(
            "[ADMIN LOGIN] Enter-key fields not ready."
        );

        return;

    }


    const inputs = [

        emailInput,

        keyInput

    ];


    inputs.forEach(

        function(input){

            /*
               Prevent duplicate listeners if
               initialization is called again.
            */

            if(
                input.dataset.adminEnterBound ===
                "true"
            ){

                return;

            }


            input.dataset.adminEnterBound =
                "true";


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


/* ==========================================
   INITIALIZE LOGIN PAGE
========================================== */

function initializeAdminLogin(){

    console.log(
        "✅ ALBUKHR Admin Login Controller Ready"
    );


    /*
       IMPORTANT:

       We check for an existing session only
       for diagnostic purposes.

       We NEVER redirect automatically.

       This is what breaks the redirect loop.
    */

    checkExistingAdminSession()
        .catch(

            error => {

                console.warn(
                    "[ADMIN LOGIN] Session diagnostic failed:",
                    error
                );

            }

        );


    initializeEnterKeySupport();

}


/* ==========================================
   EXPORT
========================================== */

window.login =
    login;


window.checkExistingAdminSession =
    checkExistingAdminSession;


window.initializeAdminLogin =
    initializeAdminLogin;


/* ==========================================
   DOM READY
========================================== */

if(
    document.readyState ===
    "loading"
){

    document.addEventListener(

        "DOMContentLoaded",

        initializeAdminLogin,

        {
            once:true
        }

    );

}else{

    initializeAdminLogin();

}


})(window);
