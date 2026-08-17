/* ==========================================
   ALBUKHR ADMIN LOGIN CONTROLLER
   Version 2.0
========================================== */

(function(window){

"use strict";


/* ==========================================
   AUTO SESSION REDIRECT
========================================== */

document.addEventListener(

    "DOMContentLoaded",

    async function(){

        try{

            const admin =
                await getCurrentAdmin();

            if(admin){

                location.replace(
                    "unified-admin-buttons.html"
                );

            }

        }catch(error){

            console.warn(
                "[ADMIN LOGIN] Session check:",
                error
            );

        }

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


    const email =
        emailInput.value
            .trim()
            .toLowerCase();

    const key =
        keyInput.value
            .trim();


    if(!email){

        alert(
            "Administrator Email Required"
        );

        emailInput.focus();

        return;

    }


    if(!key){

        alert(
            "Access Key Required"
        );

        keyInput.focus();

        return;

    }


    btn.disabled =
        true;

    btn.textContent =
        "Signing In...";


    try{

        const result =
            await adminLogin({

                email,

                accessKey:key

            });


        if(!result?.success){

            alert(
                result?.error ||
                "Login failed."
            );

            return;

        }


        /*
          IMPORTANT:
          Supabase Auth has already persisted
          the Admin session.

          No sessionStorage gate.
        */

        location.replace(
            "unified-admin-buttons.html"
        );


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

        btn.disabled =
            false;

        btn.textContent =
            "Access Control Center";

    }

}


window.login =
    login;


})(window);
