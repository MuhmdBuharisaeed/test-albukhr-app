/* ==========================================
   ALBUKHR ADMIN BOOTSTRAP ENGINE
   Version 2.1
   Direct Supabase Authentication
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

            "Supabase Core not loaded."

        );

    }

    return window.getAlbukhrSupabaseClient();

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

        const supabase = getClient();

        /* ---------- SESSION ---------- */

        const session =

        await getCurrentSession();

        if(!session){

            redirectLogin();

            return false;

        }

        Admin.session = session;

        /* ---------- ADMIN RECORD ---------- */

        const {

            data:admin,

            error

        } = await supabase

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

        .single();

        if(error || !admin){

            console.warn(

                "[BOOTSTRAP] Admin not found.",

                error

            );

            await supabase.auth.signOut();

            redirectLogin();

            return false;

        }

        Admin.user = admin;

        Admin.role = admin.role_code;

        /* ---------- PERMISSIONS ---------- */

        try{

            if(

                typeof getRolePermissions ===

                "function"

            ){

                Admin.permissions =

                await getRolePermissions(

                    admin.role_code

                );

            }

        }catch(e){

            console.warn(

                "[BOOTSTRAP] Permission load failed.",

                e

            );

            Admin.permissions = [];

        }

        /* ---------- READY ---------- */

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

            "✅ ALBUKHR Admin Bootstrap Ready"

        );

        console.table({

            email:admin.email,

            role:admin.role_code,

            status:admin.status

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

window.Admin = Admin;

window.initializeAdmin =

initializeAdmin;

})(window);
