/* =========================================================
   ALBUKHR INTERNAL REGISTRY ENGINE
   PATCH 1
   ENGINE CORE + HELPERS + SESSION + ACCESS + RPC CORE
========================================================= */

(function () {
"use strict";

/* =========================================================
   GLOBAL EXPORT
========================================================= */
const InternalRegistryEngine = {};
window.AlbukhrInternalRegistryEngine = InternalRegistryEngine;

/* =========================================================
   CONFIG
========================================================= */
const ENGINE_NAME = "ALBUKHR Internal Registry Engine";

const SESSION_KEYS = {
    contributorEmail: "albukhr_current_email",
    contributorName: "albukhr_current_username",

    internalEmail: "albukhr_internal_email",
    internalToken: "albukhr_internal_token"
};

/* =========================================================
   SUPABASE RESOLVER
========================================================= */
function getSupabaseClient(){

    const client =
        window.supabaseClient ||
        window.albukhrSupabase ||
        window.supabase ||
        null;

    if(!client){
        throw new Error(
            ENGINE_NAME +
            ": Supabase client not found. Load js/supabase-core.js first."
        );
    }

    return client;
}

/* =========================================================
   CONTRIBUTOR ENGINE
========================================================= */
function getContributorEngine(){

    if(!window.AlbukhrContributorEngine){
        throw new Error(
            ENGINE_NAME +
            ": contributor-engine.js must be loaded first."
        );
    }

    return window.AlbukhrContributorEngine;
}

/* =========================================================
   BASIC HELPERS
========================================================= */
function safeString(value,fallback=""){
    if(value===null || value===undefined) return fallback;
    return String(value);
}

function safeBool(value){
    return value===true;
}

function safeNumber(value,fallback=0){
    const n=Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function trimOrNull(value){
    const v=safeString(value).trim();
    return v ? v : null;
}

function normalizeEmail(value){
    return safeString(value)
        .trim()
        .toLowerCase();
}

function nowIso(){
    return new Date().toISOString();
}

/* =========================================================
   SESSION
========================================================= */

function getCurrentContributorEmail(){

    return normalizeEmail(
        localStorage.getItem(
            SESSION_KEYS.contributorEmail
        ) || ""
    );

}

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

    if(email){

        sessionStorage.setItem(
            SESSION_KEYS.internalEmail,
            normalizeEmail(email)
        );

    }

    sessionStorage.setItem(
        SESSION_KEYS.internalToken,
        "INT-" +
        Date.now() +
        "-" +
        Math.random().toString(36).slice(2,10)
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
   NORMALIZERS
========================================================= */

function normalizeContributor(raw={}){

    return{

        id:raw.id || null,

        full_name:
            raw.full_name ||
            raw.fullName ||
            "",

        email:
            normalizeEmail(
                raw.email || ""
            ),

        phone:
            raw.phone || "",

        country:
            raw.country || "",

        albukhr_id:
            raw.albukhr_id ||
            raw.albukhrId ||
            "",

        status:
            safeString(
                raw.status || ""
            ).toLowerCase(),

        telegram_unlocked:
            safeBool(
                raw.telegram_unlocked
            ),

        internal_unlocked:
            safeBool(
                raw.internal_unlocked
            ),

        project_creation_unlocked:
            safeBool(
                raw.project_creation_unlocked
            )

    };

}

/* =========================================================
   RPC
========================================================= */

async function callRpc(
    fnName,
    payload={}
){

    const supabase=getSupabaseClient();

    const {
        data,
        error
    }=
    await supabase.rpc(
        fnName,
        payload
    );

    if(error){

        throw new Error(
            error.message ||
            (
                "RPC failed: "+
                fnName
            )
        );

    }

    return data;

}

/* =========================================================
   CONTRIBUTOR LOOKUP
========================================================= */

async function findContributorByEmail(email){

    const supabase=getSupabaseClient();

    const cleanEmail=
        normalizeEmail(email);

    if(!cleanEmail){
        return null;
    }

    const{
        data,
        error
    }=
    await supabase
        .from(
            "albukhr_contributors"
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

    return data
        ? normalizeContributor(data)
        : null;

}

/* =========================================================
   ACCESS CHECK
========================================================= */

async function checkInternalAccess(email=""){

    const engine=
        getContributorEngine();

    const contributorEmail=
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

    const access=
        await engine.getContributorAccess(
            contributorEmail
        );

    const contributor=
        normalizeContributor(
            access.contributor || {}
        );

    if(!contributor.email){

        return{

            ok:false,
            allowed:false,
            reason:"contributor_not_found",
            contributor:null

        };

    }

    if(contributor.status!=="approved"){

        return{

            ok:false,
            allowed:false,
            reason:"not_approved",
            contributor

        };

    }

    if(
        !(
            access.internal_unlocked ||
            access.has_internal_access
        )
    ){

        return{

            ok:false,
            allowed:false,
            reason:"internal_locked",
            contributor

        };

    }

    return{

        ok:true,
        allowed:true,
        reason:"",
        contributor,
        access

    };

}

/* =========================================================
   INTERNAL SESSION VALIDATION
========================================================= */

async function validateInternalEntry(){

    const token=
        getInternalSessionToken();

    const email=
        getInternalSessionEmail();

    if(
        !token ||
        !email
    ){

        return{

            ok:false,
            allowed:false,
            reason:"missing_internal_session"

        };

    }

    return await checkInternalAccess(email);

}

/* =========================================================
   PATCH 2A
   INTERNAL PROJECT NORMALIZER + LATEST PROJECT LOOKUP
========================================================= */

function normalizeInternalProjectRecord(raw = {}){

    return{

        id: raw.id || null,

        /* ==========================
           PROJECT
        ========================== */

        project_name:
            raw.project_name ||
            raw.projectName ||
            "",

        project_code:
            raw.project_code || "",

        category:
            raw.category || "",

        stage:
            raw.stage || "",

        /* ==========================
           CREATOR
        ========================== */

        creator_name:
            raw.creator_name ||
            raw.creatorName ||
            "",

        creator_role:
            raw.creator_role ||
            raw.role ||
            "",

        internal_id:
            raw.internal_id ||
            raw.albukhr_id ||
            raw.albukhrId ||
            "",

        creator_email:
            normalizeEmail(
                raw.creator_email ||
                raw.email ||
                ""
            ),

        creator_phone:
            raw.creator_phone ||
            raw.phone ||
            "",

        /* ==========================
           DESCRIPTION
        ========================== */

        summary:
            raw.summary || "",

        problem:
            raw.problem || "",

        solution:
            raw.solution || "",

        impact:
            raw.impact || "",

        /* ==========================
           INTERNAL
        ========================== */

        funding:
            raw.funding || "",

        risk:
            raw.risk || "",

        confidentiality:
            raw.confidentiality || "",

        roi:
            safeNumber(raw.roi,0),

        initial_liquidity:
            safeNumber(
                raw.initial_liquidity ??
                raw.liquidity,
                0
            ),

        /* ==========================
           STATUS
        ========================== */

        status:
            raw.status ||
            "internal_pending",

        project_approved:
            raw.project_approved ??
            null,

        /* ==========================
           DATES
        ========================== */

        created_at:
            raw.created_at || null,

        updated_at:
            raw.updated_at || null,

        approved_at:
            raw.approved_at || null,

        rejected_at:
            raw.rejected_at || null,

        reviewed_at:
            raw.reviewed_at || null,

        /* ==========================
           REVIEW
        ========================== */

        approved_by_email:
            raw.approved_by_email || "",

        approved_by_name:
            raw.approved_by_name || "",

        rejected_by_email:
            raw.rejected_by_email || "",

        rejected_by_name:
            raw.rejected_by_name || "",

        reviewed_by_email:
            raw.reviewed_by_email || "",

        reviewed_by_name:
            raw.reviewed_by_name || "",

        rejection_reason:

            raw.rejection_reason ||

            raw.review_reason ||

            raw.review_note ||

            ""

    };

}

/* =========================================================
   GET LATEST INTERNAL PROJECT
========================================================= */

async function getLatestInternalProjectByEmail(email){

    const supabase =
        getSupabaseClient();

    const contributorEmail =
        normalizeEmail(email);

    if(!contributorEmail){
        return null;
    }

    const {

        data,
        error

    } = await supabase

        .from(
            "albukhr_internal_projects"
        )

        .select("*")

        .ilike(
            "creator_email",
            contributorEmail
        )

        .order(
            "created_at",
            {
                ascending:false
            }
        )

        .limit(1)

        .maybeSingle();

    if(error){

        throw new Error(

            error.message ||

            "Unable to load contributor internal projects."

        );

    }

    return data

        ? normalizeInternalProjectRecord(data)

        : null;

       }

 /* =========================================================
   PATCH 2B
   INTERNAL SUBMISSION LOCK ENGINE
========================================================= */

async function checkInternalSubmissionLock(email = ""){

    const contributorEmail =

        normalizeEmail(email) ||

        getInternalSessionEmail() ||

        getCurrentContributorEmail();

    if(!contributorEmail){

        return{

            ok:false,
            locked:true,
            reason:"missing_email",
            message:"Contributor email not found."

        };

    }

    const latest =
        await getLatestInternalProjectByEmail(
            contributorEmail
        );

    if(!latest){

        return{

            ok:true,
            locked:false,
            reason:"",
            message:"",
            project:null

        };

    }

    const status =
        safeString(
            latest.status
        )
        .trim()
        .toLowerCase();

    /* =====================================
       Previous project still pending
    ===================================== */

    if(

        status==="internal_pending" ||

        status==="pending"

    ){

        return{

            ok:true,

            locked:true,

            reason:"internal_pending_exists",

            message:
                "Your previous internal project is still under review.",

            project:latest

        };

    }

    /* =====================================
       7 DAY COOLDOWN
    ===================================== */

    if(

        status==="internal_approved" ||

        status==="approved"

    ){

        const approvedDate =

            latest.approved_at ||

            latest.reviewed_at ||

            latest.updated_at ||

            latest.created_at;

        if(approvedDate){

            const approvedTime =

                new Date(
                    approvedDate
                ).getTime();

            const unlockTime =

                approvedTime +

                (7 * 24 * 60 * 60 * 1000);

            if(

                Number.isFinite(unlockTime) &&

                Date.now() < unlockTime

            ){

                return{

                    ok:true,

                    locked:true,

                    reason:"approval_cooldown_active",

                    unlock_at:
                        new Date(
                            unlockTime
                        ).toISOString(),

                    message:
                        "You can submit another internal project after the cooldown period.",

                    project:latest

                };

            }

        }

    }

    /* =====================================
       ALLOW SUBMISSION
    ===================================== */

    return{

        ok:true,

        locked:false,

        reason:"",

        message:"",

        project:latest

    };

       }

 /* =========================================================
   PATCH 2C
   INTERNAL PROJECT VALIDATION ENGINE
========================================================= */

function validateInternalProjectPayload(payload = {}){

    const errors = [];

    /* =====================================
       REQUIRED FIELDS
    ===================================== */

    if(!trimOrNull(payload.projectName)){
        errors.push("Project name is required.");
    }

    if(!trimOrNull(payload.category)){
        errors.push("Project category is required.");
    }

    if(!trimOrNull(payload.stage)){
        errors.push("Project stage is required.");
    }

    if(!trimOrNull(payload.creatorName)){
        errors.push("Creator name is required.");
    }

    if(!trimOrNull(payload.creatorRole)){
        errors.push("Creator role is required.");
    }

    if(!trimOrNull(payload.internalId)){
        errors.push("Albukhr Internal ID is required.");
    }

    if(!normalizeEmail(payload.creatorEmail)){
        errors.push("Creator email is required.");
    }

    if(!trimOrNull(payload.summary)){
        errors.push("Project summary is required.");
    }

    if(!trimOrNull(payload.problem)){
        errors.push("Problem statement is required.");
    }

    if(!trimOrNull(payload.solution)){
        errors.push("Solution is required.");
    }

    /* =====================================
       NUMERIC VALIDATION
    ===================================== */

    if(payload.roi !== undefined){

        const roi = Number(payload.roi);

        if(!Number.isFinite(roi)){
            errors.push("ROI must be a valid number.");
        }

    }

    if(payload.initialLiquidity !== undefined){

        const liquidity = Number(payload.initialLiquidity);

        if(!Number.isFinite(liquidity)){
            errors.push("Initial liquidity must be a valid number.");
        }

        if(liquidity < 0){
            errors.push("Initial liquidity cannot be negative.");
        }

    }

    /* =====================================
       STATUS
    ===================================== */

    return{

        ok: errors.length === 0,

        errors,

        firstError:
            errors.length
                ? errors[0]
                : ""

    };

    }

/* =========================================================
   PATCH 2D
   INTERNAL PROJECT SUBMISSION ENGINE
========================================================= */

async function submitInternalProject(payload = {}){

    /* ==========================
       ACCESS CHECK
    ========================== */

    const access = await checkInternalAccess(
        payload.creatorEmail
    );

    if(!access.allowed){

        throw new Error(
            access.reason ||
            "Internal registry access denied."
        );

    }

    /* ==========================
       BUILD CLEAN PAYLOAD
    ========================== */

    const cleanPayload = {

        projectName:
            trimOrNull(payload.projectName),

        category:
            trimOrNull(payload.category),

        stage:
            trimOrNull(payload.stage),

        creatorName:
            trimOrNull(payload.creatorName),

        creatorRole:
            trimOrNull(payload.creatorRole),

        internalId:
            trimOrNull(payload.internalId),

        creatorEmail:
            normalizeEmail(
                payload.creatorEmail ||
                access.contributor.email
            ),

        creatorPhone:
            trimOrNull(payload.creatorPhone),

        summary:
            trimOrNull(payload.summary),

        problem:
            trimOrNull(payload.problem),

        solution:
            trimOrNull(payload.solution),

        impact:
            trimOrNull(payload.impact),

        funding:
            trimOrNull(payload.funding),

        risk:
            trimOrNull(payload.risk),

        confidentiality:
            trimOrNull(payload.confidentiality),

        roi:
            safeNumber(payload.roi,0),

        initialLiquidity:
            safeNumber(
                payload.initialLiquidity,
                0
            )

    };

    /* ==========================
       VALIDATION
    ========================== */

    const validation =
        validateInternalProjectPayload(
            cleanPayload
        );

    if(!validation.ok){

        throw new Error(
            validation.firstError
        );

    }

    /* ==========================
       LOCK CHECK
    ========================== */

    const lockState =
        await checkInternalSubmissionLock(
            cleanPayload.creatorEmail
        );

    if(lockState.locked){

        throw new Error(
            lockState.message
        );

    }

    /* ==========================
       RPC SUBMIT
    ========================== */

    const result =
        await callRpc(
            "albukhr_submit_internal_project",
            {

                p_project_name:
                    cleanPayload.projectName,

                p_category:
                    cleanPayload.category,

                p_stage:
                    cleanPayload.stage,

                p_creator_name:
                    cleanPayload.creatorName,

                p_creator_role:
                    cleanPayload.creatorRole,

                p_internal_id:
                    cleanPayload.internalId,

                p_creator_email:
                    cleanPayload.creatorEmail,

                p_creator_phone:
                    cleanPayload.creatorPhone,

                p_summary:
                    cleanPayload.summary,

                p_problem:
                    cleanPayload.problem,

                p_solution:
                    cleanPayload.solution,

                p_impact:
                    cleanPayload.impact,

                p_funding:
                    cleanPayload.funding,

                p_risk:
                    cleanPayload.risk,

                p_confidentiality:
                    cleanPayload.confidentiality,

                p_roi:
                    cleanPayload.roi,

                p_initial_liquidity:
                    cleanPayload.initialLiquidity

            }
        );

    return{

        ok:true,

        message:
            result?.message ||
            "Internal project submitted successfully.",

        project:
            normalizeInternalProjectRecord(
                result?.project ||
                result ||
                {}
            )

    };

}

/* =========================================================
   FORM HELPER
========================================================= */

async function submitInternalProjectFromForm(form = {}){

    return await submitInternalProject({

        projectName:
            form.projectName?.value,

        category:
            form.category?.value,

        stage:
            form.stage?.value,

        creatorName:
            form.creatorName?.value,

        creatorRole:
            form.role?.value,

        internalId:
            form.internalId?.value,

        creatorEmail:
            form.email?.value,

        creatorPhone:
            form.phone?.value,

        summary:
            form.summary?.value,

        problem:
            form.problem?.value,

        solution:
            form.solution?.value,

        impact:
            form.impact?.value,

        funding:
            form.funding?.value,

        risk:
            form.risk?.value,

        confidentiality:
            form.confidentiality?.value,

        roi:
            form.roi?.value,

        initialLiquidity:
            form.liquidity?.value

    });

       }

 /* =========================================================
   PATCH 3A
   INTERNAL ADMIN HELPERS
========================================================= */

/* =========================================================
   ADMIN META
========================================================= */

function getInternalAdminMeta(){

    return{

        email:

            normalizeEmail(

                localStorage.getItem(
                    "albukhr_current_email"
                ) ||

                localStorage.getItem(
                    "currentUserEmail"
                ) ||

                ""

            ),

        name:

            safeString(

                localStorage.getItem(
                    "albukhr_current_username"
                ) ||

                localStorage.getItem(
                    "currentUserName"
                ) ||

                "ALBUKHR Admin"

            ).trim(),

        role:

            safeString(

                localStorage.getItem(
                    "albukhr_current_role"
                ) ||

                "admin"

            ).trim()

    };

}

/* =========================================================
   ADMIN PROJECT NORMALIZER
========================================================= */

function normalizeAdminInternalProject(raw={}){

    return{

        id:
            raw.id || null,

        /* Project */

        project_name:
            raw.project_name ||
            raw.projectName ||
            "",

        project_code:
            raw.project_code ||
            "",

        category:
            raw.category ||
            "",

        stage:
            raw.stage ||
            "",

        /* Creator */

        creator_name:
            raw.creator_name ||
            raw.creatorName ||
            "",

        creator_role:
            raw.creator_role ||
            raw.role ||
            "",

        internal_id:
            raw.internal_id ||
            raw.albukhr_id ||
            raw.albukhrId ||
            "",

        creator_email:

            normalizeEmail(

                raw.creator_email ||

                raw.email ||

                ""

            ),

        creator_phone:

            raw.creator_phone ||

            raw.phone ||

            "",

        /* Description */

        summary:
            raw.summary || "",

        problem:
            raw.problem || "",

        solution:
            raw.solution || "",

        impact:
            raw.impact || "",

        /* Internal */

        funding:
            raw.funding || "",

        risk:
            raw.risk || "",

        confidentiality:
            raw.confidentiality || "",

        roi:
            safeNumber(raw.roi,0),

        initial_liquidity:
            safeNumber(
                raw.initial_liquidity ??
                raw.liquidity,
                0
            ),

        /* Review */

        status:
            raw.status ||
            "internal_pending",

        approved_at:
            raw.approved_at ||
            null,

        rejected_at:
            raw.rejected_at ||
            null,

        reviewed_at:
            raw.reviewed_at ||
            null,

        created_at:
            raw.created_at ||
            null,

        updated_at:
            raw.updated_at ||
            null,

        approved_by_email:
            raw.approved_by_email ||
            "",

        approved_by_name:
            raw.approved_by_name ||
            "",

        rejected_by_email:
            raw.rejected_by_email ||
            "",

        rejected_by_name:
            raw.rejected_by_name ||
            "",

        reviewed_by_email:
            raw.reviewed_by_email ||
            "",

        reviewed_by_name:
            raw.reviewed_by_name ||
            "",

        rejection_reason:

            raw.rejection_reason ||

            raw.review_reason ||

            raw.review_note ||

            ""

    };

}

/* =========================================================
   ADMIN STATUS NORMALIZER
========================================================= */

function normalizeInternalStatus(status){

    const s =

        safeString(status)
        .trim()
        .toLowerCase();

    switch(s){

        case "pending":
            return "internal_pending";

        case "approved":
            return "internal_approved";

        case "rejected":
            return "internal_rejected";

        default:
            return s || "internal_pending";

    }

}

/* =========================================================
   INTERNAL PROJECT EXISTS
========================================================= */

function hasInternalProject(project){

    return !!(

        project &&

        project.id

    );

               }

 /* =========================================================
   PATCH 3B
   ADMIN LIST INTERNAL PROJECTS
========================================================= */

async function adminListInternalProjects({

    status = "",
    limit = 500

} = {}){

    const supabase =
        getSupabaseClient();

    const normalizedStatus =
        status
            ? normalizeInternalStatus(status)
            : "";

    /* =====================================
       Preferred RPC
    ===================================== */

    try{

        const result =
            await callRpc(
                "albukhr_admin_list_internal_projects",
                {

                    p_status:
                        normalizedStatus || null,

                    p_limit:
                        safeNumber(limit,500)

                }
            );

        const rows =

            Array.isArray(result)

                ? result

                : Array.isArray(
                    result?.projects
                )

                ? result.projects

                : [];

        return rows.map(
            normalizeAdminInternalProject
        );

    }

    catch(err){

        console.warn(

            "albukhr_admin_list_internal_projects RPC unavailable. Falling back to direct table read.",

            err

        );

    }

    /* =====================================
       Direct Table Read
    ===================================== */

    let query =

        supabase

        .from(
            "albukhr_internal_projects"
        )

        .select("*")

        .order(
            "created_at",
            {
                ascending:false
            }
        )

        .limit(
            safeNumber(limit,500)
        );

    if(normalizedStatus){

        query =
            query.eq(
                "status",
                normalizedStatus
            );

    }

    const {

        data,
        error

    } = await query;

    if(error){

        throw new Error(

            error.message ||

            "Unable to load internal projects."

        );

    }

    return

        (Array.isArray(data)

            ? data

            : []

        ).map(

            normalizeAdminInternalProject

        );

         }

 /* =========================================================
   PATCH 3C
   ADMIN APPROVE INTERNAL PROJECT
========================================================= */

async function adminApproveInternalProject(input = {}){

    const supabase = getSupabaseClient();

    let projectId = "";
    let approvedByEmail = "";
    let approvedByName = "";
    let approvedByRole = "";

    /* =====================================
       SUPPORT BOTH SIGNATURES
    ===================================== */

    if(typeof input === "string"){

        projectId = input.trim();

    }else{

        projectId = safeString(
            input.projectId ||
            input.id
        ).trim();

        approvedByEmail = normalizeEmail(
            input.approvedBy ||
            input.approvedByEmail ||
            ""
        );

        approvedByName = safeString(
            input.approvedByName
        ).trim();

        approvedByRole = safeString(
            input.approvedByRole
        ).trim();

    }

    if(!projectId){
        throw new Error(
            "Internal project ID is required."
        );
    }

    const actor = getInternalAdminMeta();

    approvedByEmail =
        approvedByEmail ||
        actor.email;

    approvedByName =
        approvedByName ||
        actor.name ||
        "ALBUKHR Admin";

    approvedByRole =
        approvedByRole ||
        actor.role ||
        "admin";

    /* =====================================
       RPC
    ===================================== */

    try{

        const result =
            await callRpc(
                "albukhr_admin_approve_internal_project",
                {

                    p_project_id:
                        projectId,

                    p_approved_by_email:
                        approvedByEmail,

                    p_approved_by_name:
                        approvedByName,

                    p_approved_by_role:
                        approvedByRole

                }
            );

        return{

            ok:true,

            project:
                normalizeAdminInternalProject(
                    result?.project ||
                    result ||
                    {}
                )

        };

    }

    catch(err){

        console.warn(

            "RPC approve unavailable, using direct update.",

            err

        );

    }

    /* =====================================
       DIRECT UPDATE
    ===================================== */

    const now =
        nowIso();

    const {

        data,
        error

    } = await supabase

        .from(
            "albukhr_internal_projects"
        )

        .update({

            status:
                "internal_approved",

            approved_at:
                now,

            reviewed_at:
                now,

            updated_at:
                now,

            approved_by_email:
                approvedByEmail,

            approved_by_name:
                approvedByName,

            reviewed_by_email:
                approvedByEmail,

            reviewed_by_name:
                approvedByName,

            rejected_at:
                null,

            rejected_by_email:
                null,

            rejected_by_name:
                null,

            rejection_reason:
                null

        })

        .eq(
            "id",
            projectId
        )

        .select()

        .single();

    if(error){

        throw new Error(

            error.message ||

            "Failed to approve internal project."

        );

    }

    return{

        ok:true,

        project:
            normalizeAdminInternalProject(
                data
            )

    };

}

 /* =========================================================
   PATCH 3D
   ADMIN REJECT INTERNAL PROJECT
========================================================= */

async function adminRejectInternalProject(input = {}){

    const supabase = getSupabaseClient();

    let projectId = "";
    let reason = "";
    let rejectedByEmail = "";
    let rejectedByName = "";
    let rejectedByRole = "";

    /* =====================================
       SUPPORT BOTH SIGNATURES
    ===================================== */

    if(typeof input === "string"){

        projectId = input.trim();

    }else{

        projectId = safeString(
            input.projectId ||
            input.id
        ).trim();

        reason = safeString(
            input.reason
        ).trim();

        rejectedByEmail = normalizeEmail(
            input.rejectedBy ||
            input.rejectedByEmail ||
            ""
        );

        rejectedByName = safeString(
            input.rejectedByName
        ).trim();

        rejectedByRole = safeString(
            input.rejectedByRole
        ).trim();

    }

    if(!projectId){
        throw new Error(
            "Internal project ID is required."
        );
    }

    const actor = getInternalAdminMeta();

    rejectedByEmail =
        rejectedByEmail ||
        actor.email;

    rejectedByName =
        rejectedByName ||
        actor.name ||
        "ALBUKHR Admin";

    rejectedByRole =
        rejectedByRole ||
        actor.role ||
        "admin";

    /* =====================================
       RPC
    ===================================== */

    try{

        const result =
            await callRpc(
                "albukhr_admin_reject_internal_project",
                {

                    p_project_id:
                        projectId,

                    p_rejected_by_email:
                        rejectedByEmail,

                    p_rejected_by_name:
                        rejectedByName,

                    p_rejected_by_role:
                        rejectedByRole,

                    p_reason:
                        reason || null

                }
            );

        return{

            ok:true,

            project:
                normalizeAdminInternalProject(
                    result?.project ||
                    result ||
                    {}
                )

        };

    }

    catch(err){

        console.warn(

            "RPC reject unavailable, using direct update.",

            err

        );

    }

    /* =====================================
       DIRECT UPDATE
    ===================================== */

    const now =
        nowIso();

    const {

        data,
        error

    } = await supabase

        .from(
            "albukhr_internal_projects"
        )

        .update({

            status:
                "internal_rejected",

            rejected_at:
                now,

            reviewed_at:
                now,

            updated_at:
                now,

            rejected_by_email:
                rejectedByEmail,

            rejected_by_name:
                rejectedByName,

            reviewed_by_email:
                rejectedByEmail,

            reviewed_by_name:
                rejectedByName,

            rejection_reason:
                reason || null,

            approved_at:
                null,

            approved_by_email:
                null,

            approved_by_name:
                null

        })

        .eq(
            "id",
            projectId
        )

        .select()

        .single();

    if(error){

        throw new Error(

            error.message ||

            "Failed to reject internal project."

        );

    }

    return{

        ok:true,

        project:
            normalizeAdminInternalProject(
                data
            )

    };

           }

 /* =========================================================
   PATCH 4A
   EXPORTS TO ENGINE NAMESPACE
========================================================= */

/* ---------- Session ---------- */

InternalRegistryEngine.getSupabaseClient =
    getSupabaseClient;

InternalRegistryEngine.setInternalSession =
    setInternalSession;

InternalRegistryEngine.clearInternalSession =
    clearInternalSession;

InternalRegistryEngine.getInternalSessionEmail =
    getInternalSessionEmail;

InternalRegistryEngine.getInternalSessionToken =
    getInternalSessionToken;

InternalRegistryEngine.getCurrentContributorEmail =
    getCurrentContributorEmail;


/* ---------- Contributor ---------- */

InternalRegistryEngine.findContributorByEmail =
    findContributorByEmail;

InternalRegistryEngine.checkInternalAccess =
    checkInternalAccess;

InternalRegistryEngine.validateInternalEntryGate =
    validateInternalEntryGate;


/* ---------- Lock Engine ---------- */

InternalRegistryEngine.getLatestInternalProjectByEmail =
    getLatestInternalProjectByEmail;

InternalRegistryEngine.checkInternalSubmissionLock =
    checkInternalSubmissionLock;


/* ---------- Submission ---------- */

InternalRegistryEngine.validateInternalProjectPayload =
    validateInternalProjectPayload;

InternalRegistryEngine.submitInternalProject =
    submitInternalProject;

InternalRegistryEngine.submitInternalProjectFromForm =
    submitInternalProjectFromForm;


/* ---------- Bootstrap ---------- */

InternalRegistryEngine.bootstrapInternalRegistryPage =
    bootstrapInternalRegistryPage;

InternalRegistryEngine.fillContributorFieldsIfNeeded =
    fillContributorFieldsIfNeeded;


/* ---------- UI Helpers ---------- */

InternalRegistryEngine.disableButton =
    disableButton;

InternalRegistryEngine.enableButton =
    enableButton;


/* ---------- Admin ---------- */

InternalRegistryEngine.getInternalAdminMeta =
    getInternalAdminMeta;

InternalRegistryEngine.adminListInternalProjects =
    adminListInternalProjects;

InternalRegistryEngine.adminApproveInternalProject =
    adminApproveInternalProject;

InternalRegistryEngine.adminRejectInternalProject =
    adminRejectInternalProject;

 /* =========================================================
   PATCH 4B
   LEGACY GLOBAL WRAPPERS
   ---------------------------------------------------------
   Backward compatibility for existing pages.
========================================================= */

/* ---------- Session ---------- */

window.setInternalSession =
    setInternalSession;

window.clearInternalSession =
    clearInternalSession;

window.getInternalSessionEmail =
    getInternalSessionEmail;

window.getInternalSessionToken =
    getInternalSessionToken;


/* ---------- Contributor ---------- */

window.findContributorByEmail =
    findContributorByEmail;

window.checkInternalAccess =
    checkInternalAccess;

window.validateInternalEntryGate =
    validateInternalEntryGate;


/* ---------- Lock ---------- */

window.checkInternalSubmissionLock =
    checkInternalSubmissionLock;

window.getLatestInternalProjectByEmail =
    getLatestInternalProjectByEmail;


/* ---------- Submission ---------- */

window.submitInternalProject =
    submitInternalProject;

window.submitInternalProjectFromForm =
    submitInternalProjectFromForm;

window.validateInternalProjectPayload =
    validateInternalProjectPayload;


/* ---------- Bootstrap ---------- */

window.bootstrapInternalRegistryPage =
    bootstrapInternalRegistryPage;

window.fillContributorFieldsIfNeeded =
    fillContributorFieldsIfNeeded;


/* ---------- UI Helpers ---------- */

window.disableInternalButton =
    disableButton;

window.enableInternalButton =
    enableButton;


/* ---------- Admin ---------- */

window.getInternalAdminMeta =
    getInternalAdminMeta;

window.adminListInternalProjects =
    adminListInternalProjects;

window.adminApproveInternalProject =
    adminApproveInternalProject;

window.adminRejectInternalProject =
    adminRejectInternalProject;

 /* =========================================================
   PATCH 4C
   PRODUCTION CLEANUP
   ---------------------------------------------------------
   Final production hardening
========================================================= */

/* =========================================================
   VERSION
========================================================= */

InternalRegistryEngine.VERSION =
    "1.0.0";

InternalRegistryEngine.BUILD =
    "SUPABASE-PRODUCTION";

InternalRegistryEngine.ENGINE_NAME =
    ENGINE_NAME;


/* =========================================================
   DUPLICATE LOADER PROTECTION
========================================================= */

if(window.__ALBUKHR_INTERNAL_REGISTRY_ENGINE_LOADED__){

    console.warn(
        ENGINE_NAME +
        " already loaded."
    );

}else{

    window.__ALBUKHR_INTERNAL_REGISTRY_ENGINE_LOADED__ =
        true;

}


/* =========================================================
   FREEZE PUBLIC API
========================================================= */

try{

    Object.freeze(
        InternalRegistryEngine
    );

}catch(err){

    console.warn(
        "Unable to freeze InternalRegistryEngine.",
        err
    );

}


/* =========================================================
   READY LOG
========================================================= */

console.info(

    "%cALBUKHR Internal Registry Engine Ready",

    "color:#0f7a3d;font-weight:bold"

);

console.info({

    version:
        InternalRegistryEngine.VERSION,

    build:
        InternalRegistryEngine.BUILD

});


/* =========================================================
   END OF ENGINE
========================================================= */
})();
