/* ==========================================
   ALBUKHR SUPABASE ADMIN LOG ENGINE
   Version 3.1
========================================== */

(function(window){

"use strict";

const TABLE = "admin_activity_logs";

/* ==========================================
   GET CLIENT
========================================== */

function getClient(){

    if(typeof window.getAlbukhrSupabaseClient === "function"){

        const client =
        window.getAlbukhrSupabaseClient();

        if(client){
            return client;
        }

    }

    throw new Error(
        "ALBUKHR Supabase Core not initialized."
    );

}

/* ==========================================
   WRITE LOG
========================================== */

async function logAdminAction({

    action,

    target = null,

    details = {},

    ipAddress = null

}){

    try{

        const supabase = getClient();

        /* CURRENT USER */

        const {

            data:{user},

            error:userError

        } = await supabase.auth.getUser();

        if(userError){

            throw userError;

        }

        if(!user){

            return{

                error:"No authenticated admin."

            };

        }

        /* INSERT */

        const { error } = await supabase

        .from(TABLE)

        .insert({

            admin_id:user.id,

            action,

            target,

            details,

            ip_address:ipAddress

        });

        if(error){

            throw error;

        }

        return{

            success:true

        };

    }catch(error){

        console.error(

            "[ADMIN LOG]",

            error

        );

        return{

            error:error.message

        };

    }

}

/* ==========================================
   GET ALL LOGS
========================================== */

async function getAdminLogs(limit = 100){

    try{

        const supabase =
        getClient();

        const {

            data,

            error

        } = await supabase

        .from(TABLE)

        .select("*")

        .order(

            "created_at",

            {

                ascending:false

            }

        )

        .limit(limit);

        if(error){

            throw error;

        }

        return data || [];

    }catch(error){

        console.error(error);

        return [];

    }

}

/* ==========================================
   GET MY LOGS
========================================== */

async function getMyAdminLogs(limit = 50){

    try{

        const supabase =
        getClient();

        const {

            data:{user},

            error:userError

        } = await supabase.auth.getUser();

        if(userError){

            throw userError;

        }

        if(!user){

            return [];

        }

        const {

            data,

            error

        } = await supabase

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

        .limit(limit);

        if(error){

            throw error;

        }

        return data || [];

    }catch(error){

        console.error(error);

        return [];

    }

}

/* ==========================================
   CLEAR OLD LOGS
   (OPTIONAL MAINTENANCE)
========================================== */

async function clearOldLogs(days = 90){

    try{

        const supabase =
        getClient();

        const date =
        new Date();

        date.setDate(

            date.getDate() - days

        );

        const { error } = await supabase

        .from(TABLE)

        .delete()

        .lt(

            "created_at",

            date.toISOString()

        );

        if(error){

            throw error;

        }

        return{

            success:true

        };

    }catch(error){

        console.error(error);

        return{

            error:error.message

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

window.clearOldLogs =
clearOldLogs;

})(window);
