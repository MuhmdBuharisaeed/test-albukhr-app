/* ==========================================
ALBUKHR ADMIN AUTH ENGINE
Version 2.1
ISOLATED ADMIN AUTH

LOCATION:
js/supabase-admin-auth/admin-auth.js

DEPENDS ON:

admin-supabase-auth.js

admin-session.js

admin-logs.js (optional)


IMPORTANT:

Uses ONLY Admin Supabase Auth Client

Does NOT use ecosystem Supabase Core

Does NOT use js/auth/supabase-auth.js

Does NOT use js/supabase-core.js

Does NOT modify staking/liquidity/treasury engines
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


const client =  
    window.getAlbukhrAdminSupabaseClient();  


if(!client){  

    throw new Error(  
        "ALBUKHR Admin Supabase Auth Core not initialized."  
    );  

}  


return client;

}

/* ==========================================
GET ADMIN ENVIRONMENT
========================================== */

function getAdminEnvironment(){

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
   Do NOT silently invent an environment.  

   If the Admin Auth Core cannot determine  
   the environment, authentication is refused.  
*/  

throw new Error(  
    "ALBUKHR Admin environment could not be determined."  
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

    /* ==============================  
       VALIDATE INPUT  
    ============================== */  

    const safeEmail =  
        String(email || "")  
            .trim()  
            .toLowerCase();  


    const safeAccessKey =  
        String(accessKey || "")  
            .trim();  


    if(!safeEmail){  

        return {  

            success:false,  

            error:  
                "Administrator email is required."  

        };  

    }  


    if(!safeAccessKey){  

        return {  

            success:false,  

            error:  
                "Access key is required."  

        };  

    }  


    /* ==============================  
       ADMIN ENVIRONMENT  
    ============================== */  

    const environment =  
        getAdminEnvironment();  


    console.log(  
        "[ADMIN AUTH] Environment:",  
        environment  
    );  


    /* ==============================  
       ADMIN SUPABASE CLIENT  
    ============================== */  

    const supabase =  
        getAdminClient();  


    /* ==============================  
       CLEAR STALE ADMIN SESSION  
    ============================== */  

    /*  
       We deliberately do NOT call  
       signOut() before every login.  

       The Admin Auth Core owns the  
       persistent session.  

       Supabase signInWithPassword()  
       will replace the authenticated  
       session when credentials are valid.  
    */  


    /* ==============================  
       SUPABASE AUTH  
    ============================== */  

    const {  

        data,  

        error  

    } =  
        await supabase.auth.signInWithPassword({  

            email:  
                safeEmail,  

            password:  
                safeAccessKey  

        });  


    if(error){  

        console.error(  
            "[ADMIN AUTH] Supabase login failed:",  
            error  
        );  


        return {  

            success:false,  

            error:  
                error.message ||  
                "Invalid administrator credentials."  

        };  

    }  


    /* ==============================  
       AUTH USER  
    ============================== */  

    const user =  
        data?.user;  


    const session =  
        data?.session;  


    if(  
        !user?.id ||  
        !session  
    ){  

        /*  
           Authentication must result in  
           a valid user + session.  

           If not, immediately clear the  
           incomplete authentication state.  
        */  

        try{  

            await supabase.auth.signOut();  

        }catch(signOutError){  

            console.warn(  
                "[ADMIN AUTH] Cleanup failed:",  
                signOutError  
            );  

        }  


        return {  

            success:false,  

            error:  
                "Authentication succeeded but no valid admin session was returned."  

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
            "[ADMIN AUTH] Admin profile lookup failed:",  
            adminError  
        );  


        try{  

            await supabase.auth.signOut();  

        }catch(signOutError){  

            console.warn(  
                "[ADMIN AUTH] Session cleanup failed:",  
                signOutError  
            );  

        }  


        return {  

            success:false,  

            error:  
                "Unable to verify administrator profile."  

        };  

    }  


    if(!admin){  

        try{  

            await supabase.auth.signOut();  

        }catch(signOutError){  

            console.warn(  
                "[ADMIN AUTH] Session cleanup failed:",  
                signOutError  
            );  

        }  


        return {  

            success:false,  

            error:  
                "Admin account not found or inactive."  

        };  

    }  


    /* ==============================  
       ROLE  
    ============================== */  

    const role =  
        String(  
            admin.role_code || ""  
        )  
        .trim()  
        .toLowerCase();  


    if(!role){  

        console.error(  
            "[ADMIN AUTH] Admin role missing."  
        );  


        try{  

            await supabase.auth.signOut();  

        }catch(signOutError){  

            console.warn(  
                "[ADMIN AUTH] Session cleanup failed:",  
                signOutError  
            );  

        }  


        return {  

            success:false,  

            error:  
                "Administrator role is not configured."  

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

        /*  
           last_login is audit metadata.  

           It should NOT invalidate an  
           otherwise valid authentication.  
        */  

        console.warn(  
            "[ADMIN AUTH] last_login update failed:",  
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

                action:  
                    "login",  

                target:  
                    "admin_auth",  

                details:{  

                    username:  
                        admin.username,  

                    role:  
                        role,  

                    environment:  
                        environment  

                }  

            });  

        }catch(error){  

            /*  
               Audit failure must not destroy  
               a valid authenticated session.  
            */  

            console.warn(  
                "[ADMIN AUTH] Audit log failed:",  
                error  
            );  

        }  

    }  


    /* ==============================  
       SUCCESS  
    ============================== */  

    return {  

        success:true,  

        admin,  

        user,  

        session,  

        environment,  

        network:  
            environment  

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

    const supabase =  
        getAdminClient();  


    /* ==============================  
       GET CURRENT ADMIN  
    ============================== */  

    let admin = null;  


    if(  
        typeof window.getCurrentAdmin ===  
        "function"  
    ){  

        try{  

            admin =  
                await window.getCurrentAdmin();  

        }catch(error){  

            console.warn(  
                "[ADMIN AUTH] Current admin lookup failed:",  
                error  
            );  

        }  

    }  


    /* ==============================  
       AUDIT LOG  
    ============================== */  

    if(  
        admin &&  
        typeof window.logAdminAction ===  
        "function"  
    ){  

        try{  

            const environment =  
                getAdminEnvironment();  


            await window.logAdminAction({  

                action:  
                    "logout",  

                target:  
                    "admin_auth",  

                details:{  

                    username:  
                        admin.username,  

                    role:  
                        admin.role_code,  

                    environment:  
                        environment  

                }  

            });  

        }catch(error){  

            console.warn(  
                "[ADMIN AUTH] Logout audit failed:",  
                error  
            );  

        }  

    }  


    /* ==============================  
       SIGN OUT  
    ============================== */  

    const {  

        error  

    } =  
        await supabase.auth.signOut();  


    if(error){  

        console.error(  
            "[ADMIN AUTH] Supabase logout failed:",  
            error  
        );  

    }  


    /* ==============================  
       CLEAR ADMIN ENTRY MARKER  
    ============================== */  

    try{  

        sessionStorage.removeItem(  
            "albukhr_admin_entry"  
        );  

    }catch(error){  

        console.warn(  
            "[ADMIN AUTH] Session marker cleanup failed:",  
            error  
        );  

    }  


    /* ==============================  
       REDIRECT  
    ============================== */  

    location.replace(  
        "admin-login.html"  
    );  


}catch(error){  

    console.error(  
        "[ADMIN AUTH] Logout:",  
        error  
    );  


    /*  
       Even if cleanup fails,  
       do not leave the administrator  
       stranded inside the protected area.  
    */  

    try{  

        sessionStorage.removeItem(  
            "albukhr_admin_entry"  
        );  

    }catch(e){}  


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

window.getAdminEnvironmentForAuth =
getAdminEnvironment;

})(window);
