/* ==========================================
ALBUKHR SUPABASE ADMIN LOG ENGINE
Version 2.1

LOCATION:
js/supabase-admin-auth/admin-logs.js

PURPOSE:

Admin authentication activity logs

Login / logout audit trail

Admin activity history

Uses isolated Admin Supabase client


DEPENDS ON:

admin-supabase-auth.js

Supabase JS SDK


IMPORTANT:

Does NOT use js/supabase-core.js

Does NOT use js/auth/supabase-auth.js

Does NOT use LocalStorage

Does NOT use sessionStorage

Does NOT modify staking engines

Does NOT modify treasury engines

Does NOT modify liquidity engines

Does NOT modify transaction engines
========================================== */


(function(window){

"use strict";

const TABLE =
"admin_activity_logs";

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
GET CURRENT AUTH USER
========================================== */

async function getAuthenticatedAdminUser(){

const supabase =  
    getAdminClient();  


const {  

    data,  

    error  

} =  
    await supabase.auth.getUser();  


if(error){  

    throw error;  

}  


if(!data?.user){  

    return null;  

}  


return data.user;

}

/* ==========================================
WRITE ADMIN LOG
========================================== */

async function logAdminAction({

action,  

target = null,  

details = {},  

ipAddress = null

} = {}){

try{  

    /* ----------------------------------  
       VALIDATE ACTION  
    ---------------------------------- */  

    const safeAction =  
        String(  
            action ?? ""  
        )  
        .trim();  


    if(!safeAction){  

        return {  

            success:false,  

            error:  
                "Admin log action is required."  

        };  

    }  


    /* ----------------------------------  
       ADMIN CLIENT  
    ---------------------------------- */  

    const supabase =  
        getAdminClient();  


    /* ----------------------------------  
       CURRENT AUTH USER  
    ---------------------------------- */  

    const user =  
        await getAuthenticatedAdminUser();  


    if(!user?.id){  

        return {  

            success:false,  

            error:  
                "No authenticated admin."  

        };  

    }  


    /* ----------------------------------  
       NORMALIZE DETAILS  
    ---------------------------------- */  

    let safeDetails =  
        details;  


    if(  
        safeDetails === null ||  
        typeof safeDetails !== "object"  
    ){  

        safeDetails = {};  

    }  


    /* ----------------------------------  
       INSERT LOG  
    ---------------------------------- */  

    const {  

        data,  

        error  

    } =  
        await supabase  

            .from(TABLE)  

            .insert({  

                admin_id:  
                    user.id,  

                action:  
                    safeAction,  

                target:  
                    target,  

                details:  
                    safeDetails,  

                ip_address:  
                    ipAddress  

            })  

            .select("*")  
            .maybeSingle();  


    if(error){  

        throw error;  

    }  


    return {  

        success:true,  

        data:  
            data || null  

    };  


}catch(error){  

    console.error(  
        "[ADMIN LOG] Write failed:",  
        error  
    );  


    return {  

        success:false,  

        error:  
            error?.message ||  
            "Failed to write Admin activity log."  

    };  

}

}

/* ==========================================
GET ALL ADMIN LOGS
========================================== */

async function getAdminLogs(
limit = 100
){

try{  

    const supabase =  
        getAdminClient();  


    const safeLimit =  
        Math.min(  
            Math.max(  
                Number(limit) || 100,  
                1  
            ),  
            500  
        );  


    const {  

        data,  

        error  

    } =  
        await supabase  

            .from(TABLE)  

            .select("*")  

            .order(  
                "created_at",  
                {  
                    ascending:false  
                }  
            )  

            .limit(  
                safeLimit  
            );  


    if(error){  

        throw error;  

    }  


    return Array.isArray(data)  
        ? data  
        : [];  


}catch(error){  

    console.error(  
        "[ADMIN LOG] Get all logs failed:",  
        error  
    );  


    return [];  

}

}

/* ==========================================
GET MY ADMIN LOGS
========================================== */

async function getMyAdminLogs(
limit = 50
){

try{  

    const supabase =  
        getAdminClient();  


    const user =  
        await getAuthenticatedAdminUser();  


    if(!user?.id){  

        return [];  

    }  


    const safeLimit =  
        Math.min(  
            Math.max(  
                Number(limit) || 50,  
                1  
            ),  
            500  
        );  


    const {  

        data,  

        error  

    } =  
        await supabase  

            .from(TABLE)  

            .select("*")  

            .eq(  
                "admin_id",  
                user.id  
            )  

            .order(  
                "created_at",  
                {  
                    ascending:false  
                }  
            )  

            .limit(  
                safeLimit  
            );  


    if(error){  

        throw error;  

    }  


    return Array.isArray(data)  
        ? data  
        : [];  


}catch(error){  

    console.error(  
        "[ADMIN LOG] Get my logs failed:",  
        error  
    );  


    return [];  

}

}

/* ==========================================
GET LOGS BY ADMIN
========================================== */

async function getAdminLogsByAdmin(
adminId,
limit = 100
){

try{  

    const safeAdminId =  
        String(  
            adminId ?? ""  
        )  
        .trim();  


    if(!safeAdminId){  

        return [];  

    }  


    const supabase =  
        getAdminClient();  


    const safeLimit =  
        Math.min(  
            Math.max(  
                Number(limit) || 100,  
                1  
            ),  
            500  
        );  


    const {  

        data,  

        error  

    } =  
        await supabase  

            .from(TABLE)  

            .select("*")  

            .eq(  
                "admin_id",  
                safeAdminId  
            )  

            .order(  
                "created_at",  
                {  
                    ascending:false  
                }  
            )  

            .limit(  
                safeLimit  
            );  


    if(error){  

        throw error;  

    }  


    return Array.isArray(data)  
        ? data  
        : [];  


}catch(error){  

    console.error(  
        "[ADMIN LOG] Get admin logs failed:",  
        error  
    );  


    return [];  

}

}

/* ==========================================
CLEAR OLD LOGS
OPTIONAL MAINTENANCE
========================================== */

async function clearOldLogs(
days = 90
){

try{  

    const safeDays =  
        Number(days);  


    if(  
        !Number.isFinite(  
            safeDays  
        ) ||  
        safeDays <= 0  
    ){  

        return {  

            success:false,  

            error:  
                "Invalid log retention period."  

        };  

    }  


    const supabase =  
        getAdminClient();  


    const date =  
        new Date();  


    date.setDate(  
        date.getDate() -  
        safeDays  
    );  


    const {  

        error  

    } =  
        await supabase  

            .from(TABLE)  

            .delete()  

            .lt(  
                "created_at",  
                date.toISOString()  
            );  


    if(error){  

        throw error;  

    }  


    return {  

        success:true  

    };  


}catch(error){  

    console.error(  
        "[ADMIN LOG] Clear old logs failed:",  
        error  
    );  


    return {  

        success:false,  

        error:  
            error?.message ||  
            "Failed to clear old Admin logs."  

    };  

}

}

/* ==========================================
EXPORT
========================================== */

window.logAdminAction =
logAdminAction;

window.getAdminLogs =
getAdminLogs;

window.getMyAdminLogs =
getMyAdminLogs;

window.getAdminLogsByAdmin =
getAdminLogsByAdmin;

window.clearOldLogs =
clearOldLogs;

/* ==========================================
READY
========================================== */

console.log(
"✅ ALBUKHR Admin Log Engine Ready"
);

})(window);
