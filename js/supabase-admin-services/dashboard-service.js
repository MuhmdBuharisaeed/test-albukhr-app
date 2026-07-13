/* ==========================================
   ALBUKHR DASHBOARD SERVICE
   Version 4.0
========================================== */

(function(window){

"use strict";

/* ==========================================
   TABLES
========================================== */

const TABLES = {

    ADMINS:
    "admin_users",

    LOGS:
    "admin_activity_logs",

    CONTRIBUTORS:
    "albukhr_contributors",

    PROJECTS:
    "albukhr_project_registry",

    TRANSACTIONS:
    "transactions",

    STAKES:
    "stakes",

    DAPPS:
    "dapp_requests",

    WITHDRAWS:
    "withdraw_requests",

    TREASURY:
    "ecosystem_treasury"

};

/* ==========================================
   CLIENT
========================================== */

function client(){

    return getAlbukhrSupabaseClient();

}

/* ==========================================
   SAFE COUNT
========================================== */

async function count(table, filter = null){

    try{

        let query =
        client()
        .from(table)
        .select("*",{

            head:true,
            count:"exact"

        });

        if(filter){

            query =
            filter(query);

        }

        const {

            count,
            error

        } = await query;

        if(error){

            console.error(error);

            return 0;

        }

        return count || 0;

    }catch(error){

        console.error(error);

        return 0;

    }

}

/* ==========================================
   TRANSACTIONS
========================================== */

async function getPendingTransactions(){

    return await count(

        TABLES.TRANSACTIONS,

        q=>q.eq(
            "status",
            "pending"
        )

    );

}

/* ==========================================
   WITHDRAWS
========================================== */

async function getPendingWithdrawRequests(){

    return await count(

        TABLES.WITHDRAWS,

        q=>q.eq(
            "status",
            "pending"
        )

    );

}

/* ==========================================
   DAPPS
========================================== */

async function getPendingDapps(){

    return await count(

        TABLES.DAPPS,

        q=>q.eq(
            "status",
            "pending"
        )

    );

}

/* ==========================================
   CONTRIBUTORS
========================================== */

async function getContributorCount(){

    return await count(

        TABLES.CONTRIBUTORS

    );

}

/* ==========================================
   PROJECTS
========================================== */

async function getProjectCount(){

    return await count(

        TABLES.PROJECTS

    );

}

/* ==========================================
   ADMINS
========================================== */

async function getActiveAdmins(){

    return await count(

        TABLES.ADMINS,

        q=>q.eq(
            "status",
            "active"
        )

    );

}

/* ==========================================
   TREASURY
========================================== */

async function getTreasuryStatus(){

    try{

        const {

            data,
            error

        } = await client()

        .from(TABLES.TREASURY)

        .select("*")

        .single();

        if(error){

            return null;

        }

        return data;

    }catch(error){

        console.error(error);

        return null;

    }

}

/* ==========================================
   RECENT LOGS
========================================== */

async function getRecentAdminLogs(limit = 10){

    try{

        const {

            data,
            error

        } = await client()

        .from(TABLES.LOGS)

        .select("*")

        .order(
            "created_at",
            {
                ascending:false
            }
        )

        .limit(limit);

        if(error){

            return [];

        }

        return data || [];

    }catch(error){

        console.error(error);

        return [];

    }

}

/* ==========================================
   DASHBOARD
========================================== */

async function load(){

    return{

        admins:
        await getActiveAdmins(),

        contributors:
        await getContributorCount(),

        projects:
        await getProjectCount(),

        pendingTransactions:
        await getPendingTransactions(),

        pendingWithdraws:
        await getPendingWithdrawRequests(),

        pendingDapps:
        await getPendingDapps(),

        treasury:
        await getTreasuryStatus(),

        recentLogs:
        await getRecentAdminLogs()

    };

}

/* ==========================================
   EXPORT
========================================== */

window.DashboardService = {

    load,

    getPendingTransactions,

    getPendingWithdrawRequests,

    getPendingDapps,

    getContributorCount,

    getProjectCount,

    getActiveAdmins,

    getTreasuryStatus,

    getRecentAdminLogs

};

})(window);
