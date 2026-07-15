/* ==========================================
   ALBUKHR ADMIN AUTH ENGINE
   Version 4.0
========================================== */

(function(window){

"use strict";

const ADMIN_TABLE = "admin_users";

/* ==========================================
   AUTH
========================================== */

function getAuth(){

    if(window.AlbukhrAuth){

        return window.AlbukhrAuth;

    }

    throw new Error(
        "AlbukhrAuth not initialized."
    );

}

/* ==========================================
   LOGIN
========================================== */

async function adminLogin({

    email,

    accessKey

}){

    try{

        /* Auth Login */

        const {

            data,

            error

        } = await getAuth()

        .signIn(

            email,

            accessKey

        );

        if(error){

            return{

                error:error.message

            };

        }

        const user = data.user;

        /* Admin Record */

        const {

            data:admin,

            error:adminError

        } = await getAuth()

        .client

        .from(ADMIN_TABLE)

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

            await getAuth()

            .signOut();

            return{

                error:

                "Admin account not found or inactive."

            };

        }

        /* Last Login */

        await getAuth()

        .client

        .from(ADMIN_TABLE)

        .update({

            last_login:

            new Date()

            .toISOString()

        })

        .eq(

            "id",

            admin.id

        );

        /* Activity Log */

        if(

            typeof logAdminAction ===

            "function"

        ){

            await logAdminAction({

                action:"login",

                target:"admin_auth",

                details:{

                    username:

                    admin.username,

                    role:

                    admin.role_code

                }

            });

        }

        return{

            success:true,

            admin

        };

    }catch(error){

        console.error(

            "[ADMIN LOGIN]",

            error

        );

        return{

            error:

            error.message ||

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

        typeof getCurrentAdmin ===

        "function"

        ? await getCurrentAdmin()

        : null;

        if(

            admin &&

            typeof logAdminAction ===

            "function"

        ){

            await logAdminAction({

                action:"logout",

                target:"admin_auth",

                details:{

                    username:

                    admin.username,

                    role:

                    admin.role_code

                }

            });

        }

        await getAuth()

        .signOut();

        location.replace(

            "admin-login.html"

        );

    }catch(error){

        console.error(

            "[ADMIN LOGOUT]",

            error

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
