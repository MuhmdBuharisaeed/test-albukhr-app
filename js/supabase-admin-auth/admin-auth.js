/* ==========================================
   ALBUKHR ADMIN AUTH ENGINE
   Version 4.0
   ISOLATED ADMIN AUTH
========================================== */

(function(window){

"use strict";

const TABLE = "admin_users";


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
   LOGIN
========================================== */

async function adminLogin({

    email,

    accessKey

}){

    try{

        const supabase =
            getAdminClient();


        /* ==============================
           SUPABASE AUTH
        ============================== */

        const {

            data,

            error

        } =
            await supabase.auth.signInWithPassword({

                email,

                password:accessKey

            });


        if(error){

            return {

                success:false,

                error:
                    error.message

            };

        }


        const user =
            data?.user;


        if(!user?.id){

            await supabase.auth.signOut();

            return {

                success:false,

                error:
                    "Authentication succeeded but no user session was returned."

            };

        }


        /* ==============================
           ADMIN PROFILE
        ============================== */

        const {

            data:admin,

            error:adminError

        } =
            await supabase

                .from(TABLE)

                .select("*")

                .eq(
                    "auth_user_id",
                    user.id
                )

                .eq(
                    "status",
                    "active"
                )

                .maybeSingle();


        if(adminError){

            console.error(
                "[ADMIN AUTH] admin_users:",
                adminError
            );

            await supabase.auth.signOut();

            return {

                success:false,

                error:
                    "Unable to verify administrator profile."

            };

        }


        if(!admin){

            await supabase.auth.signOut();

            return {

                success:false,

                error:
                    "Admin account not found or inactive."

            };

        }


        /* ==============================
           LAST LOGIN
        ============================== */

        const {

            error:updateError

        } =
            await supabase

                .from(TABLE)

                .update({

                    last_login:
                        new Date().toISOString()

                })

                .eq(
                    "id",
                    admin.id
                );


        if(updateError){

            console.warn(
                "[ADMIN AUTH] last_login failed:",
                updateError
            );

        }


        /* ==============================
           AUDIT LOG
        ============================== */

        if(
            typeof window.logAdminAction ===
            "function"
        ){

            try{

                await window.logAdminAction({

                    action:"login",

                    target:"admin_auth",

                    details:{

                        username:
                            admin.username,

                        role:
                            admin.role_code

                    }

                });

            }catch(error){

                console.warn(
                    "[ADMIN AUTH] Audit log failed:",
                    error
                );

            }

        }


        return {

            success:true,

            admin,

            user,

            session:
                data.session || null

        };


    }catch(error){

        console.error(
            "[ADMIN AUTH]",
            error
        );

        return {

            success:false,

            error:
                error?.message ||
                "Login failed."

        };

    }

}


/* ==========================================
   LOGOUT
========================================== */

async function adminLogout(){

    try{

        const admin =
            typeof window.getCurrentAdmin ===
            "function"
                ? await window.getCurrentAdmin()
                : null;


        if(
            admin &&
            typeof window.logAdminAction ===
            "function"
        ){

            try{

                await window.logAdminAction({

                    action:"logout",

                    target:"admin_auth",

                    details:{

                        username:
                            admin.username,

                        role:
                            admin.role_code

                    }

                });

            }catch(error){

                console.warn(
                    "[ADMIN AUTH] Logout log failed:",
                    error
                );

            }

        }


        const supabase =
            getAdminClient();


        await supabase.auth.signOut();


        location.replace(
            "admin-login.html"
        );


    }catch(error){

        console.error(
            "[ADMIN AUTH] Logout:",
            error
        );

        location.replace(
            "admin-login.html"
        );

    }

}


/* ==========================================
   EXPORT
========================================== */

window.adminLogin =
    adminLogin;

window.adminLogout =
    adminLogout;


})(window);
