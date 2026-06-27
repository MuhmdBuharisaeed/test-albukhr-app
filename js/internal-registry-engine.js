/* =========================================================
   ALBUKHR INTERNAL REGISTRY ENGINE
   VERSION 2.0
   PART 1A
   ENGINE CORE + CONFIG + GLOBAL EXPORT
========================================================= */

(function () {
"use strict";

/* =========================================================
   ENGINE OBJECT
========================================================= */

const InternalRegistryEngine = {};

window.AlbukhrInternalRegistryEngine =
    InternalRegistryEngine;

/* =========================================================
   ENGINE INFO
========================================================= */

const ENGINE_NAME =
    "ALBUKHR Internal Registry Engine";

const ENGINE_VERSION =
    "2.0.0";

const ENGINE_BUILD =
    "PRODUCTION";

/* =========================================================
   SESSION STORAGE KEYS
========================================================= */

const SESSION_KEYS = {

    contributorEmail:
        "albukhr_current_email",

    contributorName:
        "albukhr_current_username",

    contributorRole:
        "albukhr_current_role",

    internalEmail:
        "albukhr_internal_email",

    internalToken:
        "albukhr_internal_token",

    internalProject:
        "albukhr_internal_project",

    internalAccess:
        "albukhr_internal_access"

};

/* =========================================================
   PROJECT STATUS
========================================================= */

const PROJECT_STATUS = {

    PENDING:
        "internal_pending",

    APPROVED:
        "internal_approved",

    REJECTED:
        "internal_rejected"

};

/* =========================================================
   ACCESS FLAGS
========================================================= */

const ACCESS = {

    ALLOWED:
        "allowed",

    DENIED:
        "denied",

    LOCKED:
        "locked"

};

/* =========================================================
   TABLE NAMES
========================================================= */

const TABLES = {

    CONTRIBUTORS:
        "albukhr_contributors",

    INTERNAL_PROJECTS:
        "albukhr_internal_projects",

    INVITES:
        "albukhr_contributor_invites"

};

/* =========================================================
   DEFAULT SETTINGS
========================================================= */

const SETTINGS = {

    approvalCooldownDays:
        7,

    maxProjectName:
        120,

    maxSummary:
        3000,

    maxProblem:
        4000,

    maxSolution:
        4000,

    maxImpact:
        4000

};

/* =========================================================
   ENGINE CACHE
========================================================= */

const CACHE = {

    contributor:
        null,

    access:
        null,

    latestProject:
        null,

    bootstrap:
        null

};

/* =========================================================
   INTERNAL STATE
========================================================= */

const STATE = {

    initialized:
        false,

    bootstrapping:
        false,

    loading:
        false

};

/* =========================================================
   DUPLICATE LOAD PROTECTION
========================================================= */

if(
    window.__ALBUKHR_INTERNAL_ENGINE__
){

    console.warn(
        ENGINE_NAME +
        " already loaded."
    );

    return;

}

window.__ALBUKHR_INTERNAL_ENGINE__ =
    true;

/* =========================================================
   READY LOG
========================================================= */

console.info(

    "%cALBUKHR Internal Registry Engine",

    "color:#0f7a3d;font-weight:bold"

);

console.info({

    version:
        ENGINE_VERSION,

    build:
        ENGINE_BUILD

});

/* =========================================================
   PART 1B
   SUPABASE + CONTRIBUTOR ENGINE + RPC CORE
========================================================= */

/* =========================================================
   SUPABASE CLIENT
========================================================= */

function getSupabaseClient(){

    if(
        window.albukhrSupabase &&
        typeof window.albukhrSupabase.from === "function"
    ){
        return window.albukhrSupabase;
    }

    if(
        typeof window.getAlbukhrSupabaseClient === "function"
    ){
        const client =
            window.getAlbukhrSupabaseClient();

        if(
            client &&
            typeof client.from === "function"
        ){
            return client;
        }
    }

    if(
        window.supabaseClient &&
        typeof window.supabaseClient.from === "function"
    ){
        return window.supabaseClient;
    }

    throw new Error(
        ENGINE_NAME +
        ": Supabase client not initialized."
    );

}

/* =========================================================
   CONTRIBUTOR ENGINE
========================================================= */

function getContributorEngine(){

    if(
        !window.AlbukhrContributorEngine
    ){

        throw new Error(

            ENGINE_NAME +

            ": contributor-engine.js must be loaded before internal-registry-engine.js."

        );

    }

    return window.AlbukhrContributorEngine;

}

/* =========================================================
   RPC WRAPPER
========================================================= */

async function callRpc(
    functionName,
    payload = {}
){

    const supabase =
        getSupabaseClient();

    const {

        data,
        error

    } =
    await supabase.rpc(
        functionName,
        payload
    );

    if(error){

        console.error(
            "[RPC ERROR]",
            functionName,
            error
        );

        throw new Error(

            error.message ||

            ("RPC failed: " + functionName)

        );

    }

    return data;

}

/* =========================================================
   TABLE SELECTOR
========================================================= */

function table(name){

    return getSupabaseClient()

        .from(name);

}

/* =========================================================
   CACHE HELPERS
========================================================= */

function setCache(
    key,
    value
){

    CACHE[key] = value;

}

function getCache(
    key,
    fallback = null
){

    return

        CACHE[key] ??

        fallback;

}

function clearCache(){

    Object.keys(CACHE)

    .forEach(function(key){

        CACHE[key] = null;

    });

}

/* =========================================================
   ENGINE STATE
========================================================= */

function setLoading(value){

    STATE.loading = !!value;

}

function isLoading(){

    return STATE.loading === true;

}

function setInitialized(value){

    STATE.initialized = !!value;

}

function isInitialized(){

    return STATE.initialized === true;

}

/* =========================================================
   DATABASE HEALTH CHECK
========================================================= */

async function pingDatabase(){

    const supabase =
        getSupabaseClient();

    const {

        error

    } = await supabase

        .from(TABLES.CONTRIBUTORS)

        .select("id")

        .limit(1);

    if(error){

        throw new Error(

            "Database connection failed: " +

            error.message

        );

    }

    return true;

}

/* =========================================================
   CONTRIBUTOR LOOKUP
========================================================= */

async function findContributorByEmail(email){

    const cleanEmail =

        normalizeEmail(email);

    if(!cleanEmail){

        return null;

    }

    const {

        data,
        error

    } = await table(

        TABLES.CONTRIBUTORS

    )

    .select("*")

    .ilike(

        "email",

        cleanEmail

    )

    .limit(1)

    .maybeSingle();

    if(error){

        throw new Error(

            error.message ||

            "Unable to load contributor."

        );

    }

    return data || null;

}

/* =========================================================
   CONTRIBUTOR BY ID
========================================================= */

async function findContributorById(id){

    if(!id){

        return null;

    }

    const {

        data,
        error

    } = await table(

        TABLES.CONTRIBUTORS

    )

    .select("*")

    .eq(

        "id",

        id

    )

    .limit(1)

    .maybeSingle();

    if(error){

        throw new Error(

            error.message ||

            "Unable to load contributor."

        );

    }

    return data || null;

       }

 /* =========================================================
   PART 1C
   HELPER FUNCTIONS
========================================================= */

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

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;

}

function safeBool(value){

    return value === true;

}

function safeArray(value){

    return Array.isArray(value)
        ? value
        : [];

}

function safeObject(value){

    return value &&
           typeof value === "object" &&
           !Array.isArray(value)
        ? value
        : {};

}

/* =========================================================
   STRING HELPERS
========================================================= */

function trimOrNull(value){

    const text =
        safeString(value).trim();

    return text.length
        ? text
        : null;

}

function normalizeEmail(value){

    return safeString(value)
        .trim()
        .toLowerCase();

}

function normalizePhone(value){

    return safeString(value)
        .trim();

}

function normalizeStatus(value){

    return safeString(value)
        .trim()
        .toLowerCase();

}

/* =========================================================
   DATE HELPERS
========================================================= */

function nowIso(){

    return new Date().toISOString();

}

function nowTimestamp(){

    return Date.now();

}

function addDays(days){

    const date = new Date();

    date.setDate(
        date.getDate() +
        safeNumber(days)
    );

    return date.toISOString();

}

/* =========================================================
   RANDOM HELPERS
========================================================= */

function randomString(length = 10){

    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

    let result = "";

    for(let i = 0; i < length; i++){

        result += chars[
            Math.floor(
                Math.random() * chars.length
            )
        ];

    }

    return result;

}

function randomInternalToken(){

    return "INT-" +

        Date.now() +

        "-" +

        randomString(8);

}

/* =========================================================
   HTML HELPERS
========================================================= */

function escapeHtml(value){

    return safeString(value)

        .replace(/&/g,"&amp;")

        .replace(/</g,"&lt;")

        .replace(/>/g,"&gt;")

        .replace(/"/g,"&quot;")

        .replace(/'/g,"&#039;");

}

/* =========================================================
   OBJECT HELPERS
========================================================= */

function clone(value){

    return JSON.parse(
        JSON.stringify(value)
    );

}

function isEmpty(value){

    if(value === null) return true;

    if(value === undefined) return true;

    if(value === "") return true;

    if(Array.isArray(value))
        return value.length === 0;

    if(typeof value === "object")
        return Object.keys(value).length === 0;

    return false;

}

/* =========================================================
   LOG HELPERS
========================================================= */

function log(){

    console.log(
        "[ALBUKHR INTERNAL]",
        ...arguments
    );

}

function warn(){

    console.warn(
        "[ALBUKHR INTERNAL]",
        ...arguments
    );

}

function error(){

    console.error(
        "[ALBUKHR INTERNAL]",
        ...arguments
    );

}

/* =========================================================
   PART 1D
   SESSION MANAGER
========================================================= */

/* =========================================================
   CONTRIBUTOR SESSION
========================================================= */

function getCurrentContributorEmail(){

    return normalizeEmail(

        localStorage.getItem(
            SESSION_KEYS.contributorEmail
        ) || ""

    );

}

function getCurrentContributorName(){

    return safeString(

        localStorage.getItem(
            SESSION_KEYS.contributorName
        ) || ""

    ).trim();

}

function getCurrentContributorRole(){

    return safeString(

        localStorage.getItem(
            SESSION_KEYS.contributorRole
        ) || "contributor"

    ).trim();

}

function setCurrentContributor(meta = {}){

    if(meta.email){

        localStorage.setItem(

            SESSION_KEYS.contributorEmail,

            normalizeEmail(meta.email)

        );

    }

    if(meta.name){

        localStorage.setItem(

            SESSION_KEYS.contributorName,

            safeString(meta.name).trim()

        );

    }

    if(meta.role){

        localStorage.setItem(

            SESSION_KEYS.contributorRole,

            safeString(meta.role).trim()

        );

    }

}

function clearCurrentContributor(){

    localStorage.removeItem(
        SESSION_KEYS.contributorEmail
    );

    localStorage.removeItem(
        SESSION_KEYS.contributorName
    );

    localStorage.removeItem(
        SESSION_KEYS.contributorRole
    );

}

/* =========================================================
   INTERNAL SESSION
========================================================= */

function getInternalSessionEmail(){

    return normalizeEmail(

        sessionStorage.getItem(
            SESSION_KEYS.internalEmail
        ) || ""

    );

}

function getInternalSessionToken(){

    return safeString(

        sessionStorage.getItem(
            SESSION_KEYS.internalToken
        ) || ""

    ).trim();

}

function setInternalSession(email){

    const cleanEmail =
        normalizeEmail(email);

    if(cleanEmail){

        sessionStorage.setItem(

            SESSION_KEYS.internalEmail,

            cleanEmail

        );

    }

    sessionStorage.setItem(

        SESSION_KEYS.internalToken,

        randomInternalToken()

    );

}

function clearInternalSession(){

    sessionStorage.removeItem(
        SESSION_KEYS.internalEmail
    );

    sessionStorage.removeItem(
        SESSION_KEYS.internalToken
    );

}

/* =========================================================
   SESSION STATE
========================================================= */

function hasContributorSession(){

    return !!getCurrentContributorEmail();

}

function hasInternalSession(){

    return (

        !!getInternalSessionEmail() &&

        !!getInternalSessionToken()

    );

}

/* =========================================================
   SESSION VALIDATION
========================================================= */

async function validateInternalEntryGate(){

    if(!hasInternalSession()){

        return{

            ok:false,

            allowed:false,

            reason:"missing_internal_session"

        };

    }

    const access =

        await checkInternalAccess(

            getInternalSessionEmail()

        );

    return access;

}

/* =========================================================
   SESSION REFRESH
========================================================= */

async function refreshInternalSession(){

    const email =

        getCurrentContributorEmail();

    if(!email){

        return{

            ok:false,

            allowed:false,

            reason:"missing_contributor"

        };

    }

    const access =

        await checkInternalAccess(
            email
        );

    if(!access.allowed){

        clearInternalSession();

        return access;

    }

    setInternalSession(email);

    return access;

}

/* =========================================================
   SESSION DESTROY
========================================================= */

function destroyAllInternalSessions(){

    clearInternalSession();

    CACHE.bootstrap = null;

    CACHE.contributor = null;

    CACHE.access = null;

    CACHE.latestProject = null;

       }

/* =========================================================
   PART 1E
   ACCESS SECURITY + PAGE BOOTSTRAP
========================================================= */

/* =========================================================
   INTERNAL ACCESS CHECK
========================================================= */

async function checkInternalAccess(email = ""){

    const contributorEngine =
        getContributorEngine();

    const contributorEmail =

        normalizeEmail(email) ||

        getInternalSessionEmail() ||

        getCurrentContributorEmail();

    if(!contributorEmail){

        return{

            ok:false,
            allowed:false,
            reason:"missing_session",
            contributor:null

        };

    }

    const access =

        await contributorEngine.getContributorAccess(
            contributorEmail
        );

    if(!access || !access.contributor){

        return{

            ok:false,
            allowed:false,
            reason:"contributor_not_found",
            contributor:null

        };

    }

    const contributor =
        access.contributor;

    if(
        normalizeStatus(
            contributor.status
        ) !== "approved"
    ){

        return{

            ok:false,
            allowed:false,
            reason:"contributor_not_approved",
            contributor,
            access

        };

    }

    if(

        !access.internal_unlocked &&

        !access.has_internal_access

    ){

        return{

            ok:false,
            allowed:false,
            reason:"internal_access_locked",
            contributor,
            access

        };

    }

    return{

        ok:true,
        allowed:true,
        contributor,
        access

    };

}

/* =========================================================
   PREFILL CONTRIBUTOR FIELDS
========================================================= */

function fillContributorFieldsIfNeeded(
    contributor,
    form = {}
){

    if(!contributor) return;

    if(

        form.creatorName &&

        !form.creatorName.value

    ){

        form.creatorName.value =
            contributor.full_name || "";

    }

    if(

        form.email &&

        !form.email.value

    ){

        form.email.value =
            contributor.email || "";

    }

    if(

        form.internalId &&

        !form.internalId.value

    ){

        form.internalId.value =
            contributor.albukhr_id || "";

    }

}

/* =========================================================
   PAGE BOOTSTRAP
========================================================= */

async function bootstrapInternalRegistryPage(){

    const gate =

        await validateInternalEntryGate();

    if(!gate.allowed){

        return gate;

    }

    const contributor =
        gate.contributor;

    CACHE.contributor =
        contributor;

    CACHE.access =
        gate.access;

    const lock =

        await checkInternalSubmissionLock(
            contributor.email
        );

    CACHE.latestProject =
        lock.project || null;

    CACHE.bootstrap = {

        contributor,

        access:
            gate.access,

        lock

    };

    return{

        ok:true,

        allowed:true,

        contributor,

        access:
            gate.access,

        lock

    };

}

/* =========================================================
   BUTTON HELPERS
========================================================= */

function disableButton(

    button,

    text = "Loading..."

){

    if(!button) return;

    if(!button.dataset.originalText){

        button.dataset.originalText =
            button.innerHTML;

    }

    button.disabled = true;

    button.innerHTML = text;

}

function enableButton(button){

    if(!button) return;

    button.disabled = false;

    button.innerHTML =

        button.dataset.originalText ||

        "Submit";

       }

 
