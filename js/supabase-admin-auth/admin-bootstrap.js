/* ==========================================
   ALBUKHR ADMIN BOOTSTRAP ENGINE
   Version 1.0
========================================== */

(function(window){

"use strict";

let Admin = {

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

        /* Supabase Core */

        if(
            typeof getAlbukhrSupabaseClient !== "function"
        ){

            throw new Error(
                "Supabase Core not loaded."
            );

        }

        /* Session */

        const session =
        await getCurrentSession();

        if(!session){

            redirectLogin();

            return false;

        }

        Admin.session =
        session;

        /* Current Admin */

        const admin =
        await getCurrentAdmin();

        if(!admin){

            redirectLogin();

            return false;

        }

        Admin.user = admin;

        Admin.role =
        admin.role_code;

        /* Permissions */

        const permissions =
        await getRolePermissions(
            admin.role_code
        );

        Admin.permissions =
        permissions;

        /* Router */

        if(
            typeof getRequiredPermission ===
            "function"
        ){

            const permission =
            getRequiredPermission();

            if(permission){

                const allowed =
                await hasPermission(
                    permission
                );

                if(!allowed){

                    redirectDashboard();

                    return false;

                }

            }

        }

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

        return true;

    }catch(error){

        console.error(

            "[ADMIN BOOTSTRAP]",

            error

        );

        redirectLogin();

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

function redirectDashboard(){

    location.replace(

        "unified-admin-buttons.html"

    );

}


/* ==========================================
   EXPORT
========================================== */

window.initializeAdmin =
initializeAdmin;

window.Admin = Admin;

})(window);
