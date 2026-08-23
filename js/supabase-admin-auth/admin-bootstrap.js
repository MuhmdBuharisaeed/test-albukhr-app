/* ==========================================
ALBUKHR ADMIN BOOTSTRAP ENGINE
Version 3.0

SUPABASE AUTH SESSION IS SOURCE OF TRUTH

DEPENDS ON:

admin-supabase-auth.js

admin-session.js

admin-permissions.js


PURPOSE:

Build unified Admin state

Verify Supabase Auth session

Verify active admin_users profile

Load Admin permissions

Dispatch admin-ready

Prevent authentication race conditions

Prevent self-lockout

No LocalStorage

No sessionStorage

No second Supabase client

No automatic signOut()
on database/runtime errors


SECURITY MODEL:

Supabase Auth  
         ↓  
   Admin Session  
         ↓  
   admin_users  
         ↓  
   Permissions  
         ↓  
   Admin.ready  
         ↓  
   Unified Admin UI

IMPORTANT:

This engine NEVER uses:
localStorage
sessionStorage

This engine NEVER:
creates another Supabase client
calls adminLogout()
signs out because of query errors
redirects because of permission errors

========================================== */

(function(window){

"use strict";

/* ==========================================
ADMIN STATE
========================================== */

const Admin = {

/*  
   Supabase Auth session.  
*/  

session:null,  


/*  
   Supabase Auth user.  
*/  

user:null,  


/*  
   admin_users database record.  
*/  

profile:null,  


/*  
   Normalized admin role.  
*/  

role:null,  


/*  
   Loaded permissions.  
*/  

permissions:[],  


/*  
   True only when the complete Admin  
   bootstrap process succeeded.  
*/  

ready:false,  


/*  
   Current environment.  
*/  

environment:null,  


/*  
   Current network.  
*/  

network:null,  


/*  
   Bootstrap status.  

   Possible values:  

   idle  
   initializing  
   ready  
   no_session  
   admin_not_found  
   database_error  
   runtime_error  
   invalid_admin  
   invalid_role  
*/  

status:"idle",  


/*  
   Last bootstrap error.  
*/  

error:null,  


/*  
   Timestamp of successful bootstrap.  
*/  

initializedAt:null

};

/* ==========================================
CONSTANTS
========================================== */

const ADMIN_TABLE =
"admin_users";

const STATUS_ACTIVE =
"active";

const STATUS = {

IDLE:  
    "idle",  

INITIALIZING:  
    "initializing",  

READY:  
    "ready",  

NO_SESSION:  
    "no_session",  

ADMIN_NOT_FOUND:  
    "admin_not_found",  

DATABASE_ERROR:  
    "database_error",  

RUNTIME_ERROR:  
    "runtime_error",  

INVALID_ADMIN:  
    "invalid_admin",  

INVALID_ROLE:  
    "invalid_role"

};

/* ==========================================
SAFE STRING
========================================== */

function safeString(
value,
fallback = ""
){

if(  
    value === null ||  
    value === undefined  
){  

    return fallback;  

}  


return String(value);

}

/* ==========================================
NORMALIZE ROLE
========================================== */

function normalizeRole(
role
){

return safeString(  
    role  
)  
.trim()  
.toLowerCase();

}

/* ==========================================
RESET ADMIN STATE
========================================== */

function resetAdminState(){

Admin.session =  
    null;  

Admin.user =  
    null;  

Admin.profile =  
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

Admin.error =  
    null;  

Admin.initializedAt =  
    null;

}

/* ==========================================
SET BOOTSTRAP ERROR
========================================== */

function setBootstrapError(
status,
message
){

Admin.ready =  
    false;  

Admin.status =  
    status;  

Admin.error =  
    safeString(  
        message,  
        "Admin bootstrap failed."  
    );

}

/* ==========================================
REDIRECT LOGIN
========================================== */

/*
IMPORTANT:

This function is ONLY called when
there is definitively NO Supabase Auth
session.

It is NOT called for:

RLS errors

database errors

network errors

permission errors

runtime errors

missing admin profile
*/


function redirectLogin(){

try{  

    /*  
       Prevent unnecessary reload loop.  
    */  

    const currentPage =  
        String(  
            window.location.pathname ||  
            ""  
        )  
        .toLowerCase();  


    if(  
        currentPage.endsWith(  
            "/admin-login.html"  
        ) ||  
        currentPage ===  
            "admin-login.html"  
    ){  

        return;  

    }  


    window.location.replace(  
        "admin-login.html"  
    );  


}catch(error){  

    console.error(  
        "[ADMIN BOOTSTRAP] Login redirect failed:",  
        error  
    );  

}

}

/* ==========================================
GET ADMIN SUPABASE CLIENT
========================================== */

function getAdminClient(){

/*  
   IMPORTANT:  

   Bootstrap NEVER creates a client.  

   It only consumes the isolated  
   Admin Supabase Auth Core.  
*/  

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
        "ALBUKHR Admin Supabase client unavailable."  
    );  

}  


return client;

}

/* ==========================================
GET ADMIN ENVIRONMENT
========================================== */

function getAdminEnvironment(){

try{  

    /*  
       Admin Auth Core is authoritative.  
    */  

    if(  
        typeof window.getAlbukhrAdminEnvironment ===  
        "function"  
    ){  

        const environment =  
            window.getAlbukhrAdminEnvironment();  


        if(  
            environment ===  
                "mainnet" ||  
            environment ===  
                "testnet"  
        ){  

            return environment;  

        }  

    }  


}catch(error){  

    console.warn(  
        "[ADMIN BOOTSTRAP] Environment helper failed:",  
        error  
    );  

}  


/*  
   UI-safe hostname fallback.  

   This is NOT used for authentication.  
*/  

try{  

    const hostname =  
        String(  
            window.location.hostname ||  
            ""  
        )  
        .toLowerCase();  


    if(  
        hostname ===  
            "test.albukhr.com" ||  
        hostname.startsWith(  
            "test."  
        )  
    ){  

        return "testnet";  

    }  


    if(  
        hostname ===  
            "app.albukhr.com" ||  
        hostname.startsWith(  
            "app."  
        )  
    ){  

        return "mainnet";  

    }  


}catch(error){  

    console.warn(  
        "[ADMIN BOOTSTRAP] Hostname detection failed:",  
        error  
    );  

}  


/*  
   Approved development fallback.  
*/  

return "mainnet";

}

/* ==========================================
GET ADMIN NETWORK
========================================== */

function getAdminNetwork(){

try{  

    if(  
        typeof window.getAlbukhrAdminNetwork ===  
        "function"  
    ){  

        const network =  
            window.getAlbukhrAdminNetwork();  


        if(network){  

            return network;  

        }  

    }  

}catch(error){  

    console.warn(  
        "[ADMIN BOOTSTRAP] Network helper failed:",  
        error  
    );  

}  


return getAdminEnvironment();

}

/* ==========================================
GET AUTH SESSION
========================================== */

async function getBootstrapSession(){

/*  
   Prefer admin-session.js.  

   It already owns session retrieval.  
*/  

try{  

    if(  
        typeof window.getCurrentSession ===  
        "function"  
    ){  

        const session =  
            await window.getCurrentSession();  


        return session || null;  

    }  

}catch(error){  

    /*  
       IMPORTANT:  

       A runtime/session query failure  
       is NOT treated as "no session".  
    */  

    console.error(  
        "[ADMIN BOOTSTRAP] Admin session engine failed:",  
        error  
    );  


    throw {  

        type:  
            "SESSION_ENGINE_ERROR",  

        original:  
            error  

    };  

}  


/*  
   Safe fallback if admin-session.js  
   has not exposed getCurrentSession().  
*/  

try{  

    const supabase =  
        getAdminClient();  


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
        "[ADMIN BOOTSTRAP] Supabase session query failed:",  
        error  
    );  


    throw {  

        type:  
            "SESSION_QUERY_ERROR",  

        original:  
            error  

    };  

}

}

/* ==========================================
VERIFY ADMIN PROFILE
========================================== */

/*
IMPORTANT:

This function returns a structured result.

It NEVER returns only null.

This allows Bootstrap to distinguish:

ADMIN_NOT_FOUND

from:

DATABASE_ERROR

========================================== */

async function verifyAdminProfile(
session
){

if(  
    !session?.user?.id  
){  

    return {  

        success:false,  

        status:  
            STATUS.NO_SESSION,  

        admin:null,  

        error:null  

    };  

}  


try{  

    const supabase =  
        getAdminClient();  


    const {  

        data,  

        error  

    } =  
        await supabase  

            .from(  
                ADMIN_TABLE  
            )  

            .select("*")  

            .eq(  
                "auth_user_id",  
                session.user.id  
            )  

            .eq(  
                "status",  
                STATUS_ACTIVE  
            )  

            .maybeSingle();  


    /*  
       DATABASE / RLS / NETWORK ERROR  
    */  

    if(error){  

        console.error(  
            "[ADMIN BOOTSTRAP] admin_users query failed:",  
            error  
        );  


        return {  

            success:false,  

            status:  
                STATUS.DATABASE_ERROR,  

            admin:null,  

            error:error  

        };  

    }  


    /*  
       No active profile.  

       This is authorization information,  
       NOT proof that the Supabase Auth  
       session is invalid.  
    */  

    if(!data){  

        console.warn(  
            "[ADMIN BOOTSTRAP] No active admin_users profile found."  
        );  


        return {  

            success:false,  

            status:  
                STATUS.ADMIN_NOT_FOUND,  

            admin:null,  

            error:null  

        };  

    }  


    return {  

        success:true,  

        status:  
            STATUS.READY,  

        admin:data,  

        error:null  

    };  


}catch(error){  

    console.error(  
        "[ADMIN BOOTSTRAP] Admin profile verification exception:",  
        error  
    );  


    return {  

        success:false,  

        status:  
            STATUS.RUNTIME_ERROR,  

        admin:null,  

        error:error  

    };  

}

}

/* ==========================================
LOAD PERMISSIONS
========================================== */

async function loadAdminPermissions(
roleCode
){

const role =  
    normalizeRole(  
        roleCode  
    );  


if(!role){  

    return {  

        success:false,  

        permissions:[],  

        status:  
            STATUS.INVALID_ROLE  

    };  

}  


/*  
   Super Admin has complete access.  

   No permission table query is required.  
*/  

if(  
    role ===  
    "super_admin"  
){  

    return {  

        success:true,  

        permissions:[  
            "*"  
        ],  

        status:  
            STATUS.READY  

    };  

}  


/*  
   Permission engine must already be  
   available.  
*/  

if(  
    typeof window.getRolePermissions !==  
    "function"  
){  

    console.warn(  
        "[ADMIN BOOTSTRAP] Permission engine unavailable."  
    );  


    /*  
       IMPORTANT:  

       Do NOT destroy authentication.  

       The Admin session/profile remains valid.  
    */  

    return {  

        success:false,  

        permissions:[],  

        status:  
            STATUS.RUNTIME_ERROR,  

        error:  
            new Error(  
                "Admin permission engine not loaded."  
            )  

    };  

}  


try{  

    const permissions =  
        await window.getRolePermissions(  
            role  
        );  


    if(  
        !Array.isArray(  
            permissions  
        )  
    ){  

        return {  

            success:false,  

            permissions:[],  

            status:  
                STATUS.RUNTIME_ERROR,  

            error:  
                new Error(  
                    "Invalid permission response."  
                )  

        };  

    }  


    const normalized = [  

        ...new Set(  

            permissions  

                .map(  
                    permission =>  
                        safeString(  
                            permission  
                        )  
                        .trim()  
                        .toLowerCase()  
                )  

                .filter(Boolean)  

        )  

    ];  


    return {  

        success:true,  

        permissions:  
            normalized,  

        status:  
            STATUS.READY  

    };  


}catch(error){  

    console.warn(  
        "[ADMIN BOOTSTRAP] Permission loading failed:",  
        error  
    );  


    /*  
       IMPORTANT:  

       Permission failure does NOT invalidate  
       the authenticated Admin session.  
    */  

    return {  

        success:false,  

        permissions:[],  

        status:  
            STATUS.RUNTIME_ERROR,  

        error:error  

    };  

}

}

/* ==========================================
BUILD ADMIN STATE
========================================== */

function buildAdminState({

session,  

admin,  

permissions,  

environment,  

network

}){

Admin.session =  
    session;  


Admin.user =  
    session?.user || null;  


Admin.profile =  
    admin;  


Admin.role =  
    normalizeRole(  
        admin?.role_code  
    );  


Admin.permissions =  
    Array.isArray(  
        permissions  
    )  
        ? permissions  
        : [];  


Admin.environment =  
    environment;  


Admin.network =  
    network;  


Admin.ready =  
    true;  


Admin.status =  
    STATUS.READY;  


Admin.error =  
    null;  


Admin.initializedAt =  
    new Date().toISOString();

}

/* ==========================================
DISPATCH ADMIN READY
========================================== */

function dispatchAdminReady(){

try{  

    document.dispatchEvent(  

        new CustomEvent(  

            "admin-ready",  

            {  

                detail:  
                    Admin  

            }  

        )  

    );  


}catch(error){  

    console.warn(  
        "[ADMIN BOOTSTRAP] admin-ready event failed:",  
        error  
    );  

}

}

/* ==========================================
LOG ADMIN STATE
========================================== */

function logAdminState(){

try{  

    console.log(  
        "✅ ALBUKHR Admin Bootstrap Ready"  
    );  


    console.table({  

        email:  
            Admin.profile?.email ||  
            Admin.user?.email ||  
            "",  

        username:  
            Admin.profile?.username ||  
            "",  

        role:  
            Admin.role ||  
            "",  

        status:  
            Admin.profile?.status ||  
            "",  

        environment:  
            Admin.environment ||  
            "",  

        network:  
            Admin.network ||  
            "",  

        permissions:  
            Admin.permissions.length,  

        ready:  
            Admin.ready  

    });  


}catch(error){  

    console.warn(  
        "[ADMIN BOOTSTRAP] Debug output failed:",  
        error  
    );  

}

}

/* ==========================================
INITIALIZATION LOCK
========================================== */

let initializationPromise =
null;

/* ==========================================
INITIALIZE ADMIN
========================================== */

async function initializeAdmin(){

/*  
   If already ready, return immediately.  

   IMPORTANT:  
   Do not query Supabase repeatedly  
   every time another engine asks.  
*/  

if(  
    Admin.ready === true  
){  

    return true;  

}  


/*  
   If another bootstrap is already  
   running, wait for the same promise.  

   This prevents race conditions.  
*/  

if(  
    initializationPromise  
){  

    return initializationPromise;  

}  


initializationPromise =  
    (async function(){  

        Admin.status =  
            STATUS.INITIALIZING;  


        Admin.error =  
            null;  


        try{  

            /* ==============================  
               ENVIRONMENT  
            ============================== */  

            const environment =  
                getAdminEnvironment();  


            const network =  
                getAdminNetwork();  


            Admin.environment =  
                environment;  


            Admin.network =  
                network;  


            /* ==============================  
               SUPABASE AUTH SESSION  
            ============================== */  

            let session;  


            try{  

                session =  
                    await getBootstrapSession();  

            }catch(sessionError){  

                /*  
                   A session engine/query error  
                   is NOT proof of logout.  
                */  

                const message =  
                    sessionError?.original?.message ||  
                    sessionError?.message ||  
                    "Unable to verify Admin session.";  


                setBootstrapError(  
                    STATUS.DATABASE_ERROR,  
                    message  
                );  


                console.error(  
                    "[ADMIN BOOTSTRAP] Session verification failed. Session preserved."  
                );  


                return false;  

            }  


            /* ==============================  
               NO SESSION  
            ============================== */  

            if(  
                !session?.user?.id  
            ){  

                resetAdminState();  


                Admin.status =  
                    STATUS.NO_SESSION;  


                Admin.error =  
                    "No active Supabase Admin session.";  


                /*  
                   ONLY HERE do we redirect.  

                   This is a definite authentication  
                   absence.  
                */  

                redirectLogin();  


                return false;  

            }  


            /*  
               Store valid Auth session immediately.  
            */  

            Admin.session =  
                session;  


            Admin.user =  
                session.user;  


            /* ==============================  
               ADMIN PROFILE  
            ============================== */  

            const profileResult =  
                await verifyAdminProfile(  
                    session  
                );  


            /* ==============================  
               DATABASE ERROR  
            ============================== */  

            if(  
                profileResult.status ===  
                STATUS.DATABASE_ERROR  
            ){  

                setBootstrapError(  

                    STATUS.DATABASE_ERROR,  

                    profileResult.error?.message ||  
                    "Unable to verify administrator profile."  

                );  


                /*  
                   CRITICAL:  

                   DO NOT:  
                   - signOut  
                   - redirect  
                   - destroy Auth session  
                */  

                console.error(  
                    "[ADMIN BOOTSTRAP] Database error. Supabase Auth session preserved."  
                );  


                return false;  

            }  


            /* ==============================  
               RUNTIME ERROR  
            ============================== */  

            if(  
                profileResult.status ===  
                STATUS.RUNTIME_ERROR  
            ){  

                setBootstrapError(  

                    STATUS.RUNTIME_ERROR,  

                    profileResult.error?.message ||  
                    "Administrator verification failed."  

                );  


                /*  
                   Preserve authentication.  
                */  

                console.error(  
                    "[ADMIN BOOTSTRAP] Runtime error. Supabase Auth session preserved."  
                );  


                return false;  

            }  


            /* ==============================  
               ADMIN NOT FOUND  
            ============================== */  

            if(  
                profileResult.status ===  
                STATUS.ADMIN_NOT_FOUND  
            ){  

                /*  
                   IMPORTANT SECURITY DECISION:  

                   The Auth session is valid,  
                   but this user has no active  
                   admin_users profile.  

                   We DO NOT signOut automatically.  

                   We also DO NOT redirect repeatedly.  

                   The page can fail closed because  
                   Admin.ready remains false.  
                */  

                setBootstrapError(  

                    STATUS.ADMIN_NOT_FOUND,  

                    "Authenticated user is not an active ALBUKHR administrator."  

                );  


                console.warn(  
                    "[ADMIN BOOTSTRAP] Authenticated user is not an active Admin."  
                );  


                return false;  

            }  


            /* ==============================  
               INVALID PROFILE RESULT  
            ============================== */  

            if(  
                !profileResult.success ||  
                !profileResult.admin  
            ){  

                setBootstrapError(  

                    STATUS.INVALID_ADMIN,  

                    "Administrator profile could not be verified."  

                );  


                console.error(  
                    "[ADMIN BOOTSTRAP] Invalid administrator profile result."  
                );  


                return false;  

            }  


            const admin =  
                profileResult.admin;  


            /* ==============================  
               ROLE  
            ============================== */  

            const role =  
                normalizeRole(  
                    admin.role_code  
                );  


            if(!role){  

                setBootstrapError(  

                    STATUS.INVALID_ROLE,  

                    "Administrator role is missing."  

                );  


                /*  
                   DO NOT signOut.  

                   This is an authorization/data  
                   problem, not necessarily an  
                   authentication problem.  
                */  

                console.error(  
                    "[ADMIN BOOTSTRAP] Admin role is missing."  
                );  


                return false;  

            }  


            /* ==============================  
               PERMISSIONS  
            ============================== */  

            const permissionResult =  
                await loadAdminPermissions(  
                    role  
                );  


            /*  
               Permission failure is NOT treated  
               as authentication failure.  

               We can still construct a valid  
               Admin identity with zero permissions.  

               UI will fail closed.  
            */  

            const permissions =  
                permissionResult.success  
                    ? permissionResult.permissions  
                    : [];  


            /* ==============================  
               BUILD FINAL STATE  
            ============================== */  

            buildAdminState({  

                session,  

                admin,  

                permissions,  

                environment,  

                network  

            });  


            /* ==============================  
               EXPORT STATE  
            ============================== */  

            window.Admin =  
                Admin;  


            /* ==============================  
               READY EVENT  
            ============================== */  

            dispatchAdminReady();  


            /* ==============================  
               DEBUG  
            ============================== */  

            logAdminState();  


            return true;  


        }catch(error){  

            /*  
               FINAL SAFETY NET.  

               NEVER convert an unexpected  
               runtime error into signOut().  
            */  

            console.error(  
                "[ADMIN BOOTSTRAP] Unexpected error:",  
                error  
            );  


            Admin.ready =  
                false;  


            Admin.status =  
                STATUS.RUNTIME_ERROR;  


            Admin.error =  
                error?.message ||  
                "Unexpected Admin bootstrap error.";  


            /*  
               IMPORTANT:  

               NO:  
                   supabase.auth.signOut()  

               NO:  
                   adminLogout()  

               NO:  
                   redirectLogin()  

               because this error does not prove  
               the Supabase Auth session is invalid.  
            */  

            return false;  

        }  

    })();  


try{  

    return await initializationPromise;  

}finally{  

    /*  
       Keep the promise if Admin is ready.  

       If bootstrap failed, release the lock  
       so a later manual retry is possible.  
    */  

    if(  
        Admin.ready !== true  
    ){  

        initializationPromise =  
            null;  

    }  

}

}

/* ==========================================
RETRY BOOTSTRAP
========================================== */

/*
Useful after a temporary network/database
failure.

This does NOT logout the Admin.
*/

async function retryAdminBootstrap(){

if(  
    Admin.ready === true  
){  

    return true;  

}  


initializationPromise =  
    null;  


return await initializeAdmin();

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

return (  
    Admin.ready === true  
);

}

/* ==========================================
IS AUTHENTICATED
========================================== */

function isAdminAuthenticated(){

return !!(  
    Admin.session?.user?.id  
);

}

/* ==========================================
GET ADMIN PROFILE
========================================== */

function getAdminProfile(){

return (  
    Admin.profile ||  
    null  
);

}

/* ==========================================
GET ADMIN ROLE
========================================== */

function getAdminRole(){

return (  
    Admin.role ||  
    null  
);

}

/* ==========================================
GET ADMIN PERMISSIONS
========================================== */

function getAdminPermissions(){

return Array.isArray(  
    Admin.permissions  
)  
    ? [  
        ...Admin.permissions  
    ]  
    : [];

}

/* ==========================================
GET BOOTSTRAP STATUS
========================================== */

function getAdminBootstrapStatus(){

return Admin.status;

}

/* ==========================================
GET BOOTSTRAP ERROR
========================================== */

function getAdminBootstrapError(){

return Admin.error;

}

/* ==========================================
HAS ADMIN PERMISSION
========================================== */

function bootstrapHasPermission(
permission
){

const required =  
    safeString(  
        permission  
    )  
    .trim()  
    .toLowerCase();  


if(!required){  

    return false;  

}  


/*  
   Never authorize from an unready  
   Admin state.  
*/  

if(  
    Admin.ready !== true  
){  

    return false;  

}  


/*  
   Super Admin.  
*/  

if(  
    Admin.role ===  
    "super_admin"  
){  

    return true;  

}  


const permissions =  
    getAdminPermissions();  


if(  
    permissions.includes("*")  
){  

    return true;  

}  


return permissions.includes(  
    required  
);

}

/* ==========================================
EXPORT
========================================== */

window.Admin =
Admin;

window.initializeAdmin =
initializeAdmin;

window.retryAdminBootstrap =
retryAdminBootstrap;

window.getAdminState =
getAdminState;

window.isAdminReady =
isAdminReady;

window.isAdminAuthenticated =
isAdminAuthenticated;

window.getAdminProfile =
getAdminProfile;

window.getAdminRole =
getAdminRole;

window.getAdminPermissions =
getAdminPermissions;

window.getAdminBootstrapStatus =
getAdminBootstrapStatus;

window.getAdminBootstrapError =
getAdminBootstrapError;

window.bootstrapHasPermission =
bootstrapHasPermission;

/* ==========================================
STARTUP
========================================== */

function startAdminBootstrap(){

/*  
   Do not run twice.  
*/  

if(  
    Admin.ready === true ||  
    Admin.status ===  
        STATUS.INITIALIZING  
){  

    return;  

}  


initializeAdmin()  
    .catch(  
        error => {  

            /*  
               initializeAdmin already has  
               internal protection.  

               This is only an additional  
               safety boundary.  
            */  

            console.error(  
                "[ADMIN BOOTSTRAP] Startup failure:",  
                error  
            );  

        }  
    );

}

/* ==========================================
DOM READY
========================================== */

if(
document.readyState ===
"loading"
){

document.addEventListener(  

    "DOMContentLoaded",  

    function(){  

        /*  
           Give Admin Session/Auth Core  
           time to initialize first.  
        */  

        setTimeout(  
            startAdminBootstrap,  
            0  
        );  

    },  

    {  
        once:true  
    }  

);

}else{

setTimeout(  
    startAdminBootstrap,  
    0  
);

}

/* ==========================================
READY LOG
========================================== */

console.log(
"✅ ALBUKHR Admin Bootstrap Engine 3.0 Loaded"
);

/* ==========================================
END
========================================== */

})(window);
