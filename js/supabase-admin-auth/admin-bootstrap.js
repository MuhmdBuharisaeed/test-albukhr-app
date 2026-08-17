/* ==========================================
   ALBUKHR ADMIN BOOTSTRAP ENGINE
   Version 2.2
   Supabase Session + Admin Profile
========================================== */

(function(window){

"use strict";

/* ==========================================
   ADMIN STATE
========================================== */

const Admin = {

    session:null,

    user:null,

    role:null,

    permissions:[],

    ready:false

};


/* ==========================================
   GET CLIENT
========================================== */

function getClient(){

    if(
        typeof window.getAlbukhrSupabaseClient !==
        "function"
    ){

        throw new Error(
            "ALBUKHR Admin Supabase Auth Core not loaded."
        );

    }

    const client =
        window.getAlbukhrSupabaseClient();

    if(!client){

        throw new Error(
            "ALBUKHR Admin Supabase client unavailable."
        );

    }

    return client;

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
   INITIALIZE ADMIN
========================================== */

async function initializeAdmin(){

    try{

        const supabase =
            getClient();


        /* =====================================
           SESSION
           
           Supabase Auth is the source of truth.
        ===================================== */

        const {

            data:{session},
            error

        } = await supabase.auth.getSession();


        if(error){

            console.error(
                "[BOOTSTRAP] Session error:",
                error
            );

            redirectLogin();

            return false;

        }


        if(!session){

            console.warn(
                "[BOOTSTRAP] No active Supabase session."
            );

            redirectLogin();

            return false;

        }


        const user =
            session.user;


        Admin.session =
            session;


        /* =====================================
           ADMIN DATABASE RECORD
        ===================================== */

        const {

            data:admin,
            error:adminError

        } = await supabase

            .from("admin_users")

            .select("*")

            .eq(
                "auth_user_id",
                user.id
            )

            .eq(
                "status",
                "active"
            )

            .single();


        if(adminError || !admin){

            console.warn(
                "[BOOTSTRAP] Active admin profile not found.",
                adminError
            );

            await supabase.auth.signOut();

            redirectLogin();

            return false;

        }


        /* =====================================
           ADMIN STATE
        ===================================== */

        Admin.user =
            admin;

        Admin.role =
            admin.role_code;


        /* =====================================
           PERMISSIONS
        ===================================== */

        try{

            if(
                typeof getRolePermissions ===
                "function"
            ){

                Admin.permissions =
                    await getRolePermissions(
                        admin.role_code
                    );

            }else{

                console.warn(
                    "[BOOTSTRAP] Permission engine not loaded."
                );

                Admin.permissions = [];

            }

        }catch(e){

            console.warn(
                "[BOOTSTRAP] Permission load failed.",
                e
            );

            Admin.permissions = [];

        }


        /* =====================================
           READY
        ===================================== */

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
                admin.status,

            auth_user_id:
                admin.auth_user_id

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


})(window);
