/* =========================================================
   ALBUKHR UNIFIED TRANSACTION ENGINE v3
   ---------------------------------------------------------
   SUPABASE-FIRST / NETWORK-AWARE / USER-SAFE
   ---------------------------------------------------------
   SOURCE OF TRUTH:
      Supabase

   DEPENDS ON:
      1) js/supabase-core.js
      2) ALBUKHR authentication/session engine
      3) Supabase public.transactions table

   ARCHITECTURE:
      - No LocalStorage persistence
      - No LocalStorage user identity
      - No cross-user transaction access
      - No cross-network transaction access
      - project_code first
      - Mainnet/Testnet isolated by `network`
========================================================= */

(function(window){

"use strict";

/* =========================================================
   CONFIG
========================================================= */

const ENGINE_NAME = "ALBUKHR Unified Transaction Engine";

const ENGINE_VERSION = "3.0.0";

const TABLE_NAME = "transactions";

const NETWORKS = Object.freeze({
    MAINNET: "mainnet",
    TESTNET: "testnet"
});

/* =========================================================
   INTERNAL CACHE
   ---------------------------------------------------------
   Cache is NOT the source of truth.
   It is only a runtime optimization.
========================================================= */

const CACHE = {
    transactions: [],
    loaded: false,
    loading: false,
    network: null,
    userId: null,
    lastLoadedAt: 0
};

const CACHE_TTL = 10000;

/* =========================================================
   SAFE HELPERS
========================================================= */

function safeString(value, fallback = ""){
    if(value === null || value === undefined){
        return fallback;
    }

    return String(value);
}

function safeNumber(value, fallback = 0){

    const n = Number(value);

    return Number.isFinite(n)
        ? n
        : fallback;
}

function normalizeString(value){
    return safeString(value)
        .trim()
        .toLowerCase();
}

function roundAmount(value, decimals = 7){

    const amount = safeNumber(value, 0);

    const factor = Math.pow(10, decimals);

    return Math.round(amount * factor) / factor;
}

function isValidAmount(value){

    const amount = Number(value);

    return Number.isFinite(amount) && amount > 0;

}

/* =========================================================
   SUPABASE CLIENT
========================================================= */

function getAlbukhrSupabase(){

    /*
      Primary architecture:
      js/supabase-core.js should expose one of these.

      We intentionally do NOT create another Supabase client
      inside this engine.
    */

    if(typeof window.getSupabaseClient === "function"){

        const client = window.getSupabaseClient();

        if(client){
            return client;
        }

    }

    if(window.supabaseClient){
        return window.supabaseClient;
    }

    if(window.ALBUKHR_SUPABASE){
        return window.ALBUKHR_SUPABASE;
    }

    if(window.supabase && typeof window.supabase.from === "function"){
        return window.supabase;
    }

    throw new Error(
        "ALBUKHR Unified Transaction Engine: Supabase client is not available. Load js/supabase-core.js first."
    );

}

/* =========================================================
   NETWORK RESOLUTION
========================================================= */

function getAlbukhrNetwork(){

    /*
      First preference:
      shared ALBUKHR environment/network engine.
    */

    if(typeof window.getCurrentNetwork === "function"){

        const network = normalizeString(
            window.getCurrentNetwork()
        );

        if(
            network === NETWORKS.MAINNET ||
            network === NETWORKS.TESTNET
        ){
            return network;
        }

    }

    if(typeof window.getCurrentEnvironment === "function"){

        const environment = normalizeString(
            window.getCurrentEnvironment()
        );

        if(environment === "mainnet"){
            return NETWORKS.MAINNET;
        }

        if(environment === "testnet"){
            return NETWORKS.TESTNET;
        }

    }

    /*
      Safe URL-based determination.
      This is only environment detection, NOT storage.
    */

    const hostname =
        normalizeString(window.location?.hostname);

    if(
        hostname === "test.albukhr.com" ||
        hostname.startsWith("test.")
    ){
        return NETWORKS.TESTNET;
    }

    if(
        hostname === "app.albukhr.com" ||
        hostname.startsWith("app.")
    ){
        return NETWORKS.MAINNET;
    }

    /*
      Development environment defaults to testnet.
      This prevents accidental writes to mainnet.
    */

    if(
        hostname === "dev.albukhr.com" ||
        hostname.startsWith("dev.") ||
        hostname === "localhost" ||
        hostname === "127.0.0.1"
    ){
        return NETWORKS.TESTNET;
    }

    /*
      FAIL CLOSED.
      Unknown environment must never silently become mainnet.
    */

    throw new Error(
        "ALBUKHR network could not be determined safely."
    );

}

/* =========================================================
   ASSERT NETWORK
========================================================= */

function assertValidNetwork(network){

    const value =
        normalizeString(network);

    if(
        value !== NETWORKS.MAINNET &&
        value !== NETWORKS.TESTNET
    ){

        throw new Error(
            `Invalid ALBUKHR network: ${network}`
        );

    }

    return value;

}

/* =========================================================
   CURRENT AUTHENTICATED USER
========================================================= */

async function getCurrentAuthenticatedUser(){

    const supabase =
        getAlbukhrSupabase();

    if(
        !supabase.auth ||
        typeof supabase.auth.getUser !== "function"
    ){

        throw new Error(
            "Supabase Auth is not available."
        );

    }

    const {
        data,
        error
    } = await supabase.auth.getUser();

    if(error){
        throw error;
    }

    return data?.user || null;

}

/* =========================================================
   CURRENT USER ID
========================================================= */

async function getCurrentUserId(){

    const user =
        await getCurrentAuthenticatedUser();

    if(!user){
        return null;
    }

    return user.id || null;

}

/* =========================================================
   TRANSACTION NORMALIZER
========================================================= */

function normalizeTransaction(row = {}){

    return {

        id:
            row.id ?? null,

        payment_id:
            row.payment_id || null,

        user_id:
            row.user_id ||
            row.userid ||
            null,

        userid:
            row.user_id ||
            row.userid ||
            null,

        project_code:
            row.project_code ||
            row.project ||
            null,

        project:
            row.project_code ||
            row.project ||
            null,

        type:
            row.transaction_type ||
            row.type ||
            null,

        transaction_type:
            row.transaction_type ||
            row.type ||
            null,

        amount:
            roundAmount(row.amount),

        asset:
            row.asset || "PI",

        from_wallet:
            row.from_wallet || null,

        to_wallet:
            row.to_wallet || null,

        status:
            row.status || "successful",

        meta:
            row.meta || {},

        network:
            row.network || null,

        created_at:
            row.created_at || null,

        inserted_at:
            row.inserted_at || null

    };

}

/* =========================================================
   CACHE RESET
========================================================= */

function clearTransactionCache(){

    CACHE.transactions = [];

    CACHE.loaded = false;

    CACHE.loading = false;

    CACHE.network = null;

    CACHE.userId = null;

    CACHE.lastLoadedAt = 0;

}

/* =========================================================
   LOAD USER TRANSACTIONS
   ---------------------------------------------------------
   Supabase is the source of truth.
========================================================= */

async function getTransactions(options = {}){

    const {

        forceRefresh = false,

        limit = null,

        transactionType = null,

        projectCode = null,

        status = null,

        from = null,

        to = null

    } = options;

    const network =
        assertValidNetwork(
            getAlbukhrNetwork()
        );

    const userId =
        await getCurrentUserId();

    if(!userId){

        clearTransactionCache();

        return [];

    }

    const now = Date.now();

    const cacheValid =

        CACHE.loaded &&

        CACHE.network === network &&

        CACHE.userId === userId &&

        (now - CACHE.lastLoadedAt) < CACHE_TTL;

    /*
      Cache can only be used when there are no
      additional query filters.
    */

    const hasFilters =
        transactionType ||
        projectCode ||
        status ||
        from ||
        to ||
        limit;

    if(
        !forceRefresh &&
        cacheValid &&
        !hasFilters
    ){

        return [...CACHE.transactions];

    }

    if(CACHE.loading && !hasFilters){

        return [...CACHE.transactions];

    }

    if(!hasFilters){

        CACHE.loading = true;

    }

    try{

        const supabase =
            getAlbukhrSupabase();

        /*
          USER + NETWORK FILTER ARE ALWAYS APPLIED.
        */

        let query =
            supabase
                .from(TABLE_NAME)
                .select("*")
                .eq("user_id", userId)
                .eq("network", network)
                .order("created_at", {
                    ascending:false
                });

        if(transactionType){

            query =
                query.eq(
                    "transaction_type",
                    transactionType
                );

        }

        if(projectCode){

            query =
                query.eq(
                    "project_code",
                    projectCode
                );

        }

        if(status){

            query =
                query.eq(
                    "status",
                    status
                );

        }

        if(from){

            query =
                query.gte(
                    "created_at",
                    from
                );

        }

        if(to){

            query =
                query.lte(
                    "created_at",
                    to
                );

        }

        if(limit){

            query =
                query.limit(
                    Math.max(
                        1,
                        Number(limit)
                    )
                );

        }

        const {
            data,
            error
        } = await query;

        if(error){
            throw error;
        }

        const rows =
            Array.isArray(data)
                ? data.map(normalizeTransaction)
                : [];

        if(!hasFilters){

            CACHE.transactions = rows;

            CACHE.loaded = true;

            CACHE.network = network;

            CACHE.userId = userId;

            CACHE.lastLoadedAt = Date.now();

        }

        return rows;

    }finally{

        if(!hasFilters){

            CACHE.loading = false;

        }

    }

}

/* =========================================================
   RECORD TRANSACTION
========================================================= */

async function recordTx({

    type,

    transaction_type = null,

    project = null,

    project_code = null,

    amount,

    meta = {},

    payment_id = null,

    from_wallet = null,

    to_wallet = null,

    asset = "PI",

    status = "successful",

    created_at = null

} = {}){

    const user =
        await getCurrentAuthenticatedUser();

    if(!user){

        return {
            error:"User not logged in"
        };

    }

    const network =
        assertValidNetwork(
            getAlbukhrNetwork()
        );

    const finalType =
        transaction_type ||
        type ||
        "";

    if(!finalType){

        return {
            error:"Transaction type is required"
        };

    }

    if(!isValidAmount(amount)){

        return {
            error:"Invalid transaction amount"
        };

    }

    const finalProjectCode =
        safeString(
            project_code ||
            project ||
            ""
        ).trim() || null;

    const supabase =
        getAlbukhrSupabase();

    const transaction = {

        user_id:user.id,

        network,

        payment_id:
            payment_id || null,

        project_code:
            finalProjectCode,

        from_wallet:
            from_wallet || null,

        to_wallet:
            to_wallet || null,

        amount:
            roundAmount(amount),

        asset:
            safeString(asset, "PI"),

        transaction_type:
            finalType,

        status:
            safeString(
                status,
                "successful"
            ),

        meta:
            meta && typeof meta === "object"
                ? meta
                : {},

        created_at:
            created_at || new Date().toISOString()

    };

    const {
        data,
        error
    } = await supabase
        .from(TABLE_NAME)
        .insert(transaction)
        .select("*")
        .single();

    if(error){

        console.error(
            "ALBUKHR transaction insert failed:",
            error
        );

        return {
            error:error.message || "Transaction recording failed"
        };

    }

    clearTransactionCache();

    return normalizeTransaction(data);

}

/* =========================================================
   GET TRANSACTIONS BY PROJECT
========================================================= */

async function getTxByProject(
    projectCode,
    options = {}
){

    if(!projectCode){
        return [];
    }

    return await getTransactions({

        ...options,

        projectCode:
            safeString(projectCode).trim(),

        forceRefresh:
            options.forceRefresh ?? true

    });

}

/* =========================================================
   GET TRANSACTIONS BY TYPE
========================================================= */

async function getTxByType(
    type,
    options = {}
){

    if(!type){
        return [];
    }

    return await getTransactions({

        ...options,

        transactionType:
            safeString(type).trim(),

        forceRefresh:
            options.forceRefresh ?? true

    });

}

/* =========================================================
   RECENT TRANSACTIONS
========================================================= */

async function getRecentTx(
    limit = 20,
    options = {}
){

    const rows =
        await getTransactions({

            ...options,

            limit:

                Math.max(
                    1,
                    Number(limit) || 20
                ),

            forceRefresh:
                options.forceRefresh ?? true

        });

    return rows
        .slice()
        .sort(
            (a,b) =>
                new Date(b.created_at || 0)
                -
                new Date(a.created_at || 0)
        );

}

/* =========================================================
   GET TRANSACTION BY ID
========================================================= */

async function getTransactionById(id){

    if(!id){
        return null;
    }

    const userId =
        await getCurrentUserId();

    if(!userId){
        return null;
    }

    const network =
        assertValidNetwork(
            getAlbukhrNetwork()
        );

    const supabase =
        getAlbukhrSupabase();

    const {
        data,
        error
    } = await supabase
        .from(TABLE_NAME)
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .eq("network", network)
        .maybeSingle();

    if(error){

        console.error(
            "getTransactionById failed:",
            error
        );

        return null;

    }

    return data
        ? normalizeTransaction(data)
        : null;

}

/* =========================================================
   GET TRANSACTION BY PAYMENT ID
========================================================= */

async function getTransactionByPaymentId(
    paymentId
){

    if(!paymentId){
        return null;
    }

    const userId =
        await getCurrentUserId();

    if(!userId){
        return null;
    }

    const network =
        assertValidNetwork(
            getAlbukhrNetwork()
        );

    const supabase =
        getAlbukhrSupabase();

    const {
        data,
        error
    } = await supabase
        .from(TABLE_NAME)
        .select("*")
        .eq("payment_id", paymentId)
        .eq("user_id", userId)
        .eq("network", network)
        .maybeSingle();

    if(error){

        console.error(
            "getTransactionByPaymentId failed:",
            error
        );

        return null;

    }

    return data
        ? normalizeTransaction(data)
        : null;

}

/* =========================================================
   TRANSACTION TOTALS
========================================================= */

async function getTransactionTotals(options = {}){

    const rows =
        await getTransactions(options);

    const totals = {

        count:0,

        amount:0,

        stake:0,

        reward:0,

        withdraw:0,

        capital:0

    };

    rows.forEach(tx => {

        const amount =
            safeNumber(tx.amount, 0);

        totals.count += 1;

        totals.amount += amount;

        const type =
            normalizeString(
                tx.transaction_type ||
                tx.type
            );

        if(type === "stake"){
            totals.stake += amount;
        }

        if(type === "reward"){
            totals.reward += amount;
        }

        if(
            type === "withdraw" ||
            type === "withdrawal"
        ){
            totals.withdraw += amount;
        }

        if(type === "capital"){
            totals.capital += amount;
        }

    });

    totals.amount =
        roundAmount(totals.amount);

    totals.stake =
        roundAmount(totals.stake);

    totals.reward =
        roundAmount(totals.reward);

    totals.withdraw =
        roundAmount(totals.withdraw);

    totals.capital =
        roundAmount(totals.capital);

    return totals;

}

/* =========================================================
   PROJECT TRANSACTION SUMMARY
========================================================= */

async function getProjectTransactionSummary(
    projectCode
){

    if(!projectCode){

        return {
            project_code:null,
            count:0,
            total:0,
            stake:0,
            reward:0,
            withdraw:0,
            capital:0
        };

    }

    const totals =
        await getTransactionTotals({
            projectCode,
            forceRefresh:true
        });

    return {

        project_code:
            projectCode,

        count:
            totals.count,

        total:
            totals.amount,

        stake:
            totals.stake,

        reward:
            totals.reward,

        withdraw:
            totals.withdraw,

        capital:
            totals.capital

    };

}

/* =========================================================
   REFRESH
========================================================= */

async function refreshTransactions(){

    clearTransactionCache();

    return await getTransactions({
        forceRefresh:true
    });

}

/* =========================================================
   CURRENT NETWORK INFO
========================================================= */

function getTransactionEngineNetwork(){

    return assertValidNetwork(
        getAlbukhrNetwork()
    );

}

/* =========================================================
   ENGINE STATUS
========================================================= */

async function getTransactionEngineStatus(){

    let user = null;

    try{

        user =
            await getCurrentAuthenticatedUser();

    }catch(e){

        return {

            ready:false,

            version:ENGINE_VERSION,

            engine:ENGINE_NAME,

            network:null,

            authenticated:false,

            error:e.message

        };

    }

    let network = null;

    try{

        network =
            getTransactionEngineNetwork();

    }catch(e){

        return {

            ready:false,

            version:ENGINE_VERSION,

            engine:ENGINE_NAME,

            network:null,

            authenticated:!!user,

            error:e.message

        };

    }

    let supabaseReady = false;

    try{

        supabaseReady =
            !!getAlbukhrSupabase();

    }catch{

        supabaseReady = false;

    }

    return {

        ready:
            !!user &&
            supabaseReady &&
            !!network,

        version:
            ENGINE_VERSION,

        engine:
            ENGINE_NAME,

        network,

        authenticated:
            !!user,

        user_id:
            user?.id || null,

        supabase:
            supabaseReady

    };

}

/* =========================================================
   PUBLIC API
========================================================= */

window.ALBUKHR_TRANSACTION_ENGINE = {

    version:
        ENGINE_VERSION,

    engine:
        ENGINE_NAME,

    table:
        TABLE_NAME,

    NETWORKS,

    safeString,

    safeNumber,

    roundAmount,

    getAlbukhrSupabase,

    getAlbukhrNetwork,

    getCurrentAuthenticatedUser,

    getCurrentUserId,

    clearTransactionCache,

    getTransactions,

    recordTx,

    getTxByProject,

    getTxByType,

    getRecentTx,

    getTransactionById,

    getTransactionByPaymentId,

    getTransactionTotals,

    getProjectTransactionSummary,

    refreshTransactions,

    getTransactionEngineNetwork,

    getTransactionEngineStatus

};

/* =========================================================
   LEGACY / GLOBAL COMPATIBILITY EXPORTS
========================================================= */

window.getTransactions =
    getTransactions;

window.recordTx =
    recordTx;

window.getTxByProject =
    getTxByProject;

window.getTxByType =
    getTxByType;

window.getRecentTx =
    getRecentTx;

window.getTransactionById =
    getTransactionById;

window.getTransactionByPaymentId =
    getTransactionByPaymentId;

window.getTransactionTotals =
    getTransactionTotals;

window.getProjectTransactionSummary =
    getProjectTransactionSummary;

window.refreshTransactions =
    refreshTransactions;

window.getTransactionEngineNetwork =
    getTransactionEngineNetwork;

window.getTransactionEngineStatus =
    getTransactionEngineStatus;

})(window);
