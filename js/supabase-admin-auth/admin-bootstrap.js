/* ==========================================
   ALBUKHR ADMIN BOOTSTRAP ENGINE
   Version 2.0
========================================== */

(function(window){

"use strict";

const Admin = {

    session:null,

    user:null,

    role:null,

    permissions:[],

    ready:false

};

/* ==========================================
   INIT
========================================== */

async function initializeAdmin(){

    try{

        /* ---------- Auth ---------- */

        if(!window.AlbukhrAuth){

            throw new Error(
                "AlbukhrAuth not initialized."
            );

        }

        /* ---------- Session ---------- */

        const session =
        await getCurrentSession();

        if(!session){

            redirectLogin();

            return false;

        }

        Admin.session = session;

        /* ---------- Current Admin ---------- */

        const admin =
        await getCurrentAdmin();

        if(!admin){

            redirectLogin();

            return false;

        }

        Admin.user = admin;

        Admin.role = admin.role_code;

        /* ---------- Permissions ---------- */

        try{

            Admin.permissions =
            await getRolePermissions(
                admin.role_code
            );

        }catch(error){

            console.warn(
                "[BOOTSTRAP] Permissions unavailable.",
                error
            );

            Admin.permissions = [];

        }

        /* ---------- Ready ---------- */

        Admin.ready = true;

        window.Admin = Admin;

        document.dispatchEvent(

            new CustomEvent(

                "admin-ready",

                {

                    detail:Admin

                }

            )

        );

        console.log(
            "✅ Admin Bootstrap Ready"
        );

        return true;

    }catch(error){

        console.error(
            "[ADMIN BOOTSTRAP]",
            error
        );

        /* Redirect idan SESSION ce kawai ta ɓace */

        if(
            error.message &&
            (
                error.message.includes("session") ||
                error.message.includes("Auth")
            )
        ){

            redirectLogin();

        }

        return false;

    }

}

/* ==========================================
   HELPERS
========================================== */

function redirectLogin(){

    location.replace(
        "admin-login.html"
    );

}

/* ==========================================
   EXPORT
========================================== */

window.Admin = Admin;

window.initializeAdmin =
initializeAdmin;

document.addEventListener(

    "DOMContentLoaded",

    initializeAdmin

);

})(window);
