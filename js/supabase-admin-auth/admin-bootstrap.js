/* ==========================================
   ALBUKHR ADMIN BOOTSTRAP ENGINE
   Version 2.1

   SUPABASE SESSION IS SOURCE OF TRUTH

   DEPENDS ON:
   - admin-supabase-auth.js
   - admin-session.js
   - admin-permissions.js

   PURPOSE:
   - Build unified Admin state
   - Verify active admin profile
   - Load permissions
   - Dispatch admin-ready
   - No LocalStorage
   - No sessionStorage login gate

   IMPORTANT:
   - Does NOT use js/supabase-core.js
   - Does NOT use js/auth/supabase-auth.js
   - Does NOT modify ecosystem engines
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

    ready:false,

    environment:null,

    network:null

};


/* ==========================================
   REDIRECT
========================================== */

function redirectLogin(){

    try{

        location.replace(
            "admin-login.html"
        );

    }catch(error){

        console.error(
            "[ADMIN BOOTSTRAP] Redirect failed:",
            error
        );

    }

}


/* ==========================================
   GET ADMIN ENVIRONMENT
========================================== */

function getAdminEnvironment(){

    try{

        if(
            typeof window.getAlbukhrAdminEnvironment ===
            "function"
        ){

            const environment =
                window.getAlbukhrAdminEnvironment();


            if(
                environment === "mainnet" ||
                environment === "testnet"
            ){

                return environment;

            }

        }


        /*
           Fallback to hostname only if the
           Admin Auth Core helper is unavailable.
        */

        const hostname =
            String(
                window.location.hostname || ""
            )
            .toLowerCase();


        if(
            hostname === "test.albukhr.com" ||
            hostname.startsWith("test.")
        ){

            return "testnet";

        }


        if(
            hostname === "app.albukhr.com" ||
            hostname.startsWith("app.")
        ){

            return "mainnet";

        }


        /*
           Approved local/dev fallback.
        */

        return "mainnet";


    }catch(error){

        console.warn(
            "[ADMIN BOOTSTRAP] Environment detection failed:",
            error
        );

        return "mainnet";

    }

}


/* ==========================================
   GET CURRENT SESSION
========================================== */

async function getBootstrapSession(){

    try{

        /*
           Use Admin Session Engine.

           This prevents Bootstrap from creating
           another session implementation.
        */

        if(
            typeof window.getCurrentSession ===
            "function"
        ){

            return await window.getCurrentSession();

        }


        /*
           Fallback only if admin-session.js
           has not exposed the helper.
        */

        if(
            typeof window.getAlbukhrAdminSupabaseClient !==
            "function"
        ){

            throw new Error(
                "ALBUKHR Admin Auth Core not loaded."
            );

        }


        const supabase =
            window.getAlbukhrAdminSupabaseClient();


        if(!supabase){

            throw new Error(
                "ALBUKHR Admin Supabase client unavailable."
            );

        }


        const {

            data,

            error

        } =
            await supabase.auth.getSession();


        if(error){

            throw error;

        }


        return data?.session || null;


    }catch(error){

        console.error(
            "[ADMIN BOOTSTRAP] Session lookup failed:",
            error
        );

        return null;

    }

}


/* ==========================================
   GET CURRENT ADMIN
========================================== */

async function getBootstrapAdmin(){

    try{

        /*
           Use Admin Session Engine as the
           authoritative admin profile lookup.
        */

        if(
            typeof window.getCurrentAdmin ===
            "function"
        ){

            return await window.getCurrentAdmin();

        }


        /*
           Fallback only if admin-session.js
           is unavailable.
        */

        const session =
            await getBootstrapSession();


        if(!session?.user?.id){

            return null;

        }


        if(
            typeof window.getAlbukhrAdminSupabaseClient !==
            "function"
        ){

            throw new Error(
                "ALBUKHR Admin Auth Core not loaded."
            );

        }


        const supabase =
            window.getAlbukhrAdminSupabaseClient();


        if(!supabase){

            throw new Error(
                "ALBUKHR Admin Supabase client unavailable."
            );

        }


        const {

            data,

            error

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


        if(error){

            console.error(
                "[ADMIN BOOTSTRAP] Admin profile lookup failed:",
                error
            );

            return null;

        }


        return data || null;


    }catch(error){

        console.error(
            "[ADMIN BOOTSTRAP] Admin lookup failed:",
            error
        );

        return null;

    }

}


/* ==========================================
   LOAD PERMISSIONS
========================================== */

async function loadAdminPermissions(
    roleCode
){

    if(!roleCode){

        return [];

    }


    if(
        typeof window.getRolePermissions !==
        "function"
    ){

        console.warn(
            "[ADMIN BOOTSTRAP] Permission engine not loaded."
        );

        return [];

    }


    try{

        const permissions =
            await window.getRolePermissions(
                roleCode
            );


        if(!Array.isArray(permissions)){

            return [];

        }


        return permissions;

    }catch(error){

        console.warn(
            "[ADMIN BOOTSTRAP] Permission load failed:",
            error
        );

        return [];

    }

}


/* ==========================================
   RESET ADMIN STATE
========================================== */

function resetAdminState(){

    Admin.session =
        null;

    Admin.user =
        null;

    Admin.role =
        null;

    Admin.permissions =
        [];

    Admin.ready =
        false;

    Admin.environment =
        null;

    Admin.network =
        null;

}


/* ==========================================
   INITIALIZE ADMIN
========================================== */

async function initializeAdmin(){

    /*
       Prevent duplicate initialization.
    */

    if(Admin.ready){

        return true;

    }


    try{

        /* ==============================
           ENVIRONMENT
        ============================== */

        const environment =
            getAdminEnvironment();


        Admin.environment =
            environment;


        Admin.network =
            environment;


        /* ==============================
           SESSION
        ============================== */

        const session =
            await getBootstrapSession();


        if(
            !session?.user?.id
        ){

            console.warn(
                "[ADMIN BOOTSTRAP] No valid Admin Supabase session."
            );


            resetAdminState();


            redirectLogin();


            return false;

        }


        Admin.session =
            session;


        Admin.user =
            session.user;


        /* ==============================
           ADMIN DATABASE PROFILE
        ============================== */

        const admin =
            await getBootstrapAdmin();


        if(!admin){

            console.warn(
                "[ADMIN BOOTSTRAP] Active admin profile not found."
            );


            /*
               The Supabase Auth user exists,
               but it is not an active ALBUKHR
               administrator.

               Therefore authentication must
               be terminated.
            */

            try{

                if(
                    typeof window.getAlbukhrAdminSupabaseClient ===
                    "function"
                ){

                    const supabase =
                        window.getAlbukhrAdminSupabaseClient();


                    if(supabase){

                        await supabase.auth.signOut();

                    }

                }

            }catch(signOutError){

                console.warn(
                    "[ADMIN BOOTSTRAP] Sign-out cleanup failed:",
                    signOutError
                );

            }


            resetAdminState();


            redirectLogin();


            return false;

        }


        /* ==============================
           ADMIN STATE
        ============================== */

        Admin.user =
            admin;


        Admin.role =
            String(
                admin.role_code || ""
            )
            .trim()
            .toLowerCase();


        if(!Admin.role){

            console.error(
                "[ADMIN BOOTSTRAP] Admin role is missing."
            );


            resetAdminState();


            redirectLogin();


            return false;

        }


        /* ==============================
           PERMISSIONS
        ============================== */

        Admin.permissions =
            await loadAdminPermissions(
                Admin.role
            );


        /* ==============================
           READY
        ============================== */

        Admin.ready =
            true;


        /*
           Export the final Admin state.
        */

        window.Admin =
            Admin;


        /* ==============================
           ADMIN READY EVENT
        ============================== */

        document.dispatchEvent(

            new CustomEvent(

                "admin-ready",

                {

                    detail:Admin

                }

            )

        );


        /* ==============================
           DEBUG
        ============================== */

        console.log(
            "✅ ALBUKHR Admin Bootstrap Ready"
        );


        console.table({

            email:
                admin.email || "",

            username:
                admin.username || "",

            role:
                Admin.role,

            status:
                admin.status || "",

            environment:
                Admin.environment,

            permissions:
                Admin.permissions.length

        });


        return true;


    }catch(error){

        console.error(
            "[ADMIN BOOTSTRAP]",
            error
        );


        resetAdminState();


        redirectLogin();


        return false;

    }

}


/* ==========================================
   GET ADMIN STATE
========================================== */

function getAdminState(){

    return Admin;

}


/* ==========================================
   IS ADMIN READY
========================================== */

function isAdminReady(){

    return Admin.ready === true;

}


/* ==========================================
   EXPORT
========================================== */

window.Admin =
    Admin;


window.initializeAdmin =
    initializeAdmin;


window.getAdminState =
    getAdminState;


window.isAdminReady =
    isAdminReady;


/* ==========================================
   START
========================================== */

if(
    document.readyState ===
    "loading"
){

    document.addEventListener(

        "DOMContentLoaded",

        function(){

            initializeAdmin();

        },

        {
            once:true
        }

    );

}else{

    initializeAdmin();

}


})(window);
