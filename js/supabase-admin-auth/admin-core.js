/* ==========================================
ALBUKHR ADMIN CORE
Version 2.1

PURPOSE:

Central Admin runtime observer

Wait for admin-bootstrap.js

Expose Admin readiness state

Does NOT authenticate directly

Does NOT create Supabase clients

Does NOT modify other engines


DEPENDS ON:

admin-supabase-auth.js

admin-session.js

admin-bootstrap.js
========================================== */


(function(window){

"use strict";

/* ==========================================
INTERNAL STATE
========================================== */

let adminCoreReady = false;

/* ==========================================
HANDLE ADMIN READY
========================================== */

function handleAdminReady(event){

const admin =  
    event?.detail ||  
    window.Admin ||  
    null;  


if(  
    !admin ||  
    !admin.ready  
){  

    console.warn(  
        "[ADMIN CORE] admin-ready received but Admin state is not ready."  
    );  

    return;  

}  


adminCoreReady =  
    true;  


/*  
   Keep the central Admin object untouched.  
   This engine only observes readiness.  
*/  

console.log(  
    "✅ ALBUKHR Admin Core Ready"  
);  


console.log(  
    admin  
);  


/*  
   Optional structured diagnostic.  
*/  

try{  

    console.table({  

        email:  
            admin.user?.email ||  
            admin.session?.user?.email ||  
            "—",  

        username:  
            admin.user?.username ||  
            "—",  

        role:  
            admin.role ||  
            admin.user?.role_code ||  
            "—",  

        status:  
            admin.user?.status ||  
            "—",  

        ready:  
            !!admin.ready  

    });  

}catch(error){  

    console.warn(  
        "[ADMIN CORE] Diagnostic table failed:",  
        error  
    );  

}  


/*  
   Notify any later modules that  
   Admin Core is ready.  

   Different event name prevents  
   collision with admin-bootstrap's  
   original "admin-ready" event.  
*/  

document.dispatchEvent(  

    new CustomEvent(  
        "albukhr-admin-core-ready",  
        {  
            detail:admin  
        }  
    )  

);

}

/* ==========================================
WAIT FOR BOOTSTRAP
========================================== */

document.addEventListener(

"admin-ready",  

handleAdminReady

);

/* ==========================================
LATE-LOAD SAFETY
========================================== */

/*
If admin-bootstrap.js has already
initialized before this engine loads,
we must not wait forever for an event
that has already happened.
*/

function checkExistingAdminState(){

try{  

    if(  
        window.Admin &&  
        window.Admin.ready === true  
    ){  

        handleAdminReady({  

            detail:  
                window.Admin  

        });  

        return true;  

    }  

}catch(error){  

    console.warn(  
        "[ADMIN CORE] Existing Admin state check failed:",  
        error  
    );  

}  


return false;

}

/* ==========================================
EXPORT STATUS
========================================== */

function isAdminCoreReady(){

return adminCoreReady === true;

}

function getAdminCoreState(){

return {  

    ready:  
        adminCoreReady,  

    admin:  
        window.Admin || null  

};

}

window.isAlbukhrAdminCoreReady =
isAdminCoreReady;

window.getAlbukhrAdminCoreState =
getAdminCoreState;

/* ==========================================
INITIALIZE
========================================== */

if(
document.readyState ===
"loading"
){

document.addEventListener(  

    "DOMContentLoaded",  

    checkExistingAdminState,  

    {  
        once:true  
    }  

);

}else{

checkExistingAdminState();

}

/* ==========================================
DEBUG
========================================== */

console.log(
"ALBUKHR Admin Core loaded."
);

})(window);
