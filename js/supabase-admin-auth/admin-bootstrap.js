/* ==========================================
   ALBUKHR ADMIN BOOTSTRAP ENGINE
   Version 2.0
   SUPABASE SESSION IS SOURCE OF TRUTH
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
   GET ADMIN CLIENT
========================================== */

function getAdminClient(){

    if(
        typeof window.getAlbukhrAdminSupabaseClient !==
        "function"
    ){

        throw new Error(
            "ALBUKHR Admin Supabase Auth Core not loaded."
        );

    }

    return window.getAlbukhrAdminSupabaseClient();

}


/* ==========================================
   REDIRECT
========================================== */

function redirectLogin(){

    location.replace(
        "admin-login.html"
    );

}


/* ==========================================
   INITIALIZE
========================================== */

async function initializeAdmin(){

    try{

        const supabase =
            getAdminClient();


        /* ==============================
           SUPABASE SESSION
        ============================== */

        const {

            data:{session},

            error

        } =
            await supabase.auth.getSession();


        if(
            error ||
            !session?.user?.id
        ){

            console.warn(
                "[ADMIN BOOTSTRAP] No valid session."
            );

            redirectLogin();

            return false;

        }


        Admin.session =
            session;


        /* ==============================
           ADMIN DATABASE RECORD
        ============================== */

        const {

            data:admin,

            error:adminError

        } =
            await supabase

                .from("admin_users")

                .select("*")

                .eq(
                    "auth_user_id",
                    session.user.id
                )

                .eq(
                    "status",
                    "active"
                )

                .maybeSingle();


        if(
            adminError ||
            !admin
        ){

            console.warn(
                "[ADMIN BOOTSTRAP] Admin not found.",
                adminError
            );

            await supabase.auth.signOut();

            redirectLogin();

            return false;

        }


        Admin.user =
            admin;

        Admin.role =
            admin.role_code;


        /* ==============================
           PERMISSIONS
        ============================== */

        if(
            typeof window.getRolePermissions ===
            "function"
        ){

            try{

                Admin.permissions =
                    await window.getRolePermissions(
                        admin.role_code
                    );

            }catch(error){

                console.warn(
                    "[ADMIN BOOTSTRAP] Permission load failed:",
                    error
                );

                Admin.permissions = [];

            }

        }


        /* ==============================
           READY
        ============================== */

        Admin.ready =
            true;

        window.Admin =
            Admin;


        document.dispatchEvent(

            new CustomEvent(

                "admin-ready",

                {

                    detail:Admin

                }

            )

        );


        console.log(
            "✅ ALBUKHR Admin Bootstrap Ready"
        );


        console.table({

            email:
                admin.email,

            role:
                admin.role_code,

            status:
                admin.status

        });


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
   EXPORT
========================================== */

window.Admin =
    Admin;

window.initializeAdmin =
    initializeAdmin;


/* ==========================================
   START
========================================== */

if(
    document.readyState ===
    "loading"
){

    document.addEventListener(
        "DOMContentLoaded",
        initializeAdmin
    );

}else{

    initializeAdmin();

}


})(window);
