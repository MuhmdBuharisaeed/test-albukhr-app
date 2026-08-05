/* =========================================
   ALBUKHR EXTERNAL PROJECT ENGINE v1
   PART 1
   FOUNDATION
========================================= */

/*
TABLE:
external_projects

DEPENDENCIES

1. supabase-core.js
2. projects-engine.js

This engine is Mainnet Ready.

No localStorage.
No migration required later.
*/

/* =========================================
TABLE
========================================= */

const EXTERNAL_PROJECT_TABLE =
"external_projects";

/* =========================================
SUPABASE CLIENT
========================================= */

function getExternalProjectSupabase(){

    if(typeof window.getAlbukhrSupabaseClient==="function"){

        const client =
        window.getAlbukhrSupabaseClient();

        if(client) return client;

    }

    if(window.albukhrSupabase){

        return window.albukhrSupabase;

    }

    console.warn(
        "Supabase Core not loaded."
    );

    return null;

}

/* =========================================
SAFE HELPERS
========================================= */

function externalSafeNumber(v,d=0){

    const n=Number(v);

    return Number.isFinite(n)
    ?n
    :d;

}

function externalSafeString(v,d=""){

    if(v===null||v===undefined){

        return d;

    }

    return String(v);

}

function externalNow(){

    return new Date().toISOString();

}

function externalUUID(){

    if(
        window.crypto &&
        crypto.randomUUID
    ){

        return crypto.randomUUID();

    }

    return "ext_"+
    Date.now()+
    "_"+
    Math.random()
    .toString(36)
    .substring(2,10);

}

/* =========================================
ASSERT
========================================= */

function assertExternalDependencies(){

    if(
        typeof getProjectMeta!=="function"
    ){

        throw new Error(
            "projects-engine.js required"
        );

    }

}

/* =========================================
NORMALIZE PROJECT
========================================= */

function normalizeExternalProject(row={}){

    return{

        id:
        row.id??null,

        project_code:
        externalSafeString(
            row.project_code
        ),

        project_name:
        externalSafeString(
            row.project_name
        ),

        project_type:
        "external",

        category:
        externalSafeString(
            row.category
        ),

        owner_name:
        externalSafeString(
            row.owner_name
        ),

        owner_email:
        externalSafeString(
            row.owner_email
        ),

        owner_phone:
        externalSafeString(
            row.owner_phone
        ),

        wallet_address:
        externalSafeString(
            row.wallet_address
        ),

        country:
        externalSafeString(
            row.country
        ),

        state:
        externalSafeString(
            row.state
        ),

        city:
        externalSafeString(
            row.city
        ),

        description:
        externalSafeString(
            row.description
        ),

        short_description:
        externalSafeString(
            row.short_description
        ),

        logo_url:
        externalSafeString(
            row.logo_url
        ),

        cover_url:
        externalSafeString(
            row.cover_url
        ),

        website:
        externalSafeString(
            row.website
        ),

        project_status:
        externalSafeString(
            row.project_status,
            "pending"
        ),

        visibility:
        externalSafeString(
            row.visibility,
            "private"
        ),

        review_status:
        externalSafeString(
            row.review_status,
            "pending"
        ),

        approval_status:
        externalSafeString(
            row.approval_status,
            "pending"
        ),

        treasury_enabled:
        Boolean(
            row.treasury_enabled
        ),

        funding_enabled:
        Boolean(
            row.funding_enabled
        ),

        verified:
        Boolean(
            row.verified
        ),

        featured:
        Boolean(
            row.featured
        ),

        created_by:
        externalSafeString(
            row.created_by
        ),

        approved_by:
        externalSafeString(
            row.approved_by
        ),

        rejected_by:
        externalSafeString(
            row.rejected_by
        ),

        approved_at:
        row.approved_at||null,

        rejected_at:
        row.rejected_at||null,

        created_at:
        row.created_at||null,

        updated_at:
        row.updated_at||null,

        raw:row

    };

}

/* =========================================
DEFAULT PROJECT OBJECT
========================================= */

function createExternalProjectObject(data={}){

    return{

        project_code:
        externalSafeString(
            data.project_code,
            externalUUID()
        ),

        project_name:
        externalSafeString(
            data.project_name
        ),

        category:
        externalSafeString(
            data.category
        ),

        owner_name:
        externalSafeString(
            data.owner_name
        ),

        owner_email:
        externalSafeString(
            data.owner_email
        ),

        owner_phone:
        externalSafeString(
            data.owner_phone
        ),

        wallet_address:
        externalSafeString(
            data.wallet_address
        ),

        country:
        externalSafeString(
            data.country
        ),

        state:
        externalSafeString(
            data.state
        ),

        city:
        externalSafeString(
            data.city
        ),

        description:
        externalSafeString(
            data.description
        ),

        short_description:
        externalSafeString(
            data.short_description
        ),

        logo_url:
        externalSafeString(
            data.logo_url
        ),

        cover_url:
        externalSafeString(
            data.cover_url
        ),

        website:
        externalSafeString(
            data.website
        ),

        project_type:
        "external",

        project_status:
        "pending",

        approval_status:
        "pending",

        review_status:
        "pending",

        visibility:
        "private",

        treasury_enabled:false,

        funding_enabled:false,

        verified:false,

        featured:false,

        created_by:
        externalSafeString(
            data.created_by
        ),

        approved_by:null,

        rejected_by:null,

        approved_at:null,

        rejected_at:null,

        created_at:
        externalNow(),

        updated_at:
        externalNow()

    };

      }
/* =========================================
   CREATE EXTERNAL PROJECT
========================================= */

async function createExternalProject(data={}){

    assertExternalDependencies();

    const supabase =
    getExternalProjectSupabase();

    if(!supabase){

        return{
            error:"Supabase not available"
        };

    }

    const payload =
    createExternalProjectObject(data);

    try{

        const {data:row,error} =
        await supabase
        .from(EXTERNAL_PROJECT_TABLE)
        .insert(payload)
        .select()
        .single();

        if(error){

            return{
                error:error.message
            };

        }

        return{

            success:true,

            project:
            normalizeExternalProject(row)

        };

    }catch(e){

        return{

            error:
            e.message

        };

    }

}

/* =========================================
GET PROJECT
========================================= */

async function getExternalProject(projectCode){

    if(!projectCode){

        return null;

    }

    const supabase =
    getExternalProjectSupabase();

    if(!supabase){

        return null;

    }

    try{

        const {data,error} =
        await supabase
        .from(EXTERNAL_PROJECT_TABLE)
        .select("*")
        .eq(
            "project_code",
            projectCode
        )
        .maybeSingle();

        if(error){

            console.error(error);

            return null;

        }

        if(!data){

            return null;

        }

        return normalizeExternalProject(data);

    }catch(e){

        console.error(e);

        return null;

    }

}

/* =========================================
GET PROJECT BY ID
========================================= */

async function getExternalProjectById(id){

    if(!id){

        return null;

    }

    const supabase =
    getExternalProjectSupabase();

    if(!supabase){

        return null;

    }

    try{

        const {data,error} =
        await supabase
        .from(EXTERNAL_PROJECT_TABLE)
        .select("*")
        .eq("id",id)
        .maybeSingle();

        if(error){

            console.error(error);

            return null;

        }

        if(!data){

            return null;

        }

        return normalizeExternalProject(data);

    }catch(e){

        console.error(e);

        return null;

    }

}

/* =========================================
GET ALL PROJECTS
========================================= */

async function getAllExternalProjects(){

    const supabase =
    getExternalProjectSupabase();

    if(!supabase){

        return[];

    }

    try{

        const {data,error} =
        await supabase
        .from(EXTERNAL_PROJECT_TABLE)
        .select("*")
        .order(
            "created_at",
            {
                ascending:false
            }
        );

        if(error){

            console.error(error);

            return[];

        }

        return(data||[])
        .map(
            normalizeExternalProject
        );

    }catch(e){

        console.error(e);

        return[];

    }

}

/* =========================================
GET PROJECT COUNT
========================================= */

async function getExternalProjectCount(){

    const supabase =
    getExternalProjectSupabase();

    if(!supabase){

        return 0;

    }

    try{

        const{
            count,
            error
        }=
        await supabase
        .from(EXTERNAL_PROJECT_TABLE)
        .select(
            "*",
            {
                count:"exact",
                head:true
            }
        );

        if(error){

            return 0;

        }

        return count||0;

    }catch(e){

        return 0;

    }

}

/* =========================================
SEARCH PROJECTS
========================================= */

async function searchExternalProjects(keyword=""){

    keyword =
    externalSafeString(keyword)
    .trim();

    if(!keyword){

        return getAllExternalProjects();

    }

    const supabase =
    getExternalProjectSupabase();

    if(!supabase){

        return[];

    }

    try{

        const {data,error} =
        await supabase
        .from(EXTERNAL_PROJECT_TABLE)
        .select("*")
        .or(

`project_name.ilike.%${keyword}%,
description.ilike.%${keyword}%,
owner_name.ilike.%${keyword}%,
category.ilike.%${keyword}%`

        );

        if(error){

            console.error(error);

            return[];

        }

        return(data||[])
        .map(
            normalizeExternalProject
        );

    }catch(e){

        console.error(e);

        return[];

    }

}

/* =========================================
GET PROJECTS PAGINATION
========================================= */

async function getExternalProjectsPage(

page=1,

pageSize=20

){

    page =
    Math.max(1,Number(page));

    pageSize =
    Math.max(1,Number(pageSize));

    const from =
    (page-1)*pageSize;

    const to =
    from+
    pageSize-
    1;

    const supabase =
    getExternalProjectSupabase();

    if(!supabase){

        return[];

    }

    try{

        const {data,error} =
        await supabase
        .from(EXTERNAL_PROJECT_TABLE)
        .select("*")
        .range(
            from,
            to
        )
        .order(
            "created_at",
            {
                ascending:false
            }
        );

        if(error){

            console.error(error);

            return[];

        }

        return(data||[])
        .map(
            normalizeExternalProject
        );

    }catch(e){

        console.error(e);

        return[];

    }

}

/* =========================================
EXPORTS
========================================= */

window.createExternalProject =
createExternalProject;

window.getExternalProject =
getExternalProject;

window.getExternalProjectById =
getExternalProjectById;

window.getAllExternalProjects =
getAllExternalProjects;

window.getExternalProjectCount =
getExternalProjectCount;

window.searchExternalProjects =
searchExternalProjects;

window.getExternalProjectsPage =
getExternalProjectsPage;

/* =========================================
   UPDATE EXTERNAL PROJECT
========================================= */

async function updateExternalProject(
projectCode,
updates={}
){

    if(!projectCode){

        return{
            error:"Project code required"
        };

    }

    const supabase =
    getExternalProjectSupabase();

    if(!supabase){

        return{
            error:"Supabase unavailable"
        };

    }

    updates.updated_at =
    externalNow();

    try{

        const {data,error} =
        await supabase
        .from(EXTERNAL_PROJECT_TABLE)
        .update(updates)
        .eq(
            "project_code",
            projectCode
        )
        .select()
        .single();

        if(error){

            return{
                error:error.message
            };

        }

        return{

            success:true,

            project:
            normalizeExternalProject(data)

        };

    }catch(e){

        return{

            error:e.message

        };

    }

}

/* =========================================
APPROVE PROJECT
========================================= */

async function approveExternalProject(

projectCode,

adminUser="system"

){

    return await updateExternalProject(

        projectCode,

        {

            approval_status:
            "approved",

            review_status:
            "approved",

            project_status:
            "active",

            approved_by:
            adminUser,

            approved_at:
            externalNow(),

            updated_at:
            externalNow()

        }

    );

}

/* =========================================
REJECT PROJECT
========================================= */

async function rejectExternalProject(

projectCode,

adminUser="system",

reason=""

){

    return await updateExternalProject(

        projectCode,

        {

            approval_status:
            "rejected",

            review_status:
            "rejected",

            project_status:
            "rejected",

            rejected_by:
            adminUser,

            rejected_reason:
            reason,

            rejected_at:
            externalNow(),

            updated_at:
            externalNow()

        }

    );

}

/* =========================================
SEND BACK TO REVIEW
========================================= */

async function returnExternalProjectToReview(

projectCode

){

    return await updateExternalProject(

        projectCode,

        {

            approval_status:
            "pending",

            review_status:
            "pending",

            project_status:
            "pending",

            updated_at:
            externalNow()

        }

    );

}

/* =========================================
VERIFY PROJECT
========================================= */

async function verifyExternalProject(

projectCode,

verified=true

){

    return await updateExternalProject(

        projectCode,

        {

            verified:
            Boolean(verified),

            updated_at:
            externalNow()

        }

    );

}

/* =========================================
FEATURE PROJECT
========================================= */

async function featureExternalProject(

projectCode,

featured=true

){

    return await updateExternalProject(

        projectCode,

        {

            featured:
            Boolean(featured),

            updated_at:
            externalNow()

        }

    );

}

/* =========================================
ENABLE TREASURY
========================================= */

async function enableExternalTreasury(

projectCode

){

    return await updateExternalProject(

        projectCode,

        {

            treasury_enabled:true,

            updated_at:
            externalNow()

        }

    );

}

/* =========================================
ENABLE FUNDING
========================================= */

async function enableExternalFunding(

projectCode

){

    return await updateExternalProject(

        projectCode,

        {

            funding_enabled:true,

            updated_at:
            externalNow()

        }

    );

}

/* =========================================
DISABLE FUNDING
========================================= */

async function disableExternalFunding(

projectCode

){

    return await updateExternalProject(

        projectCode,

        {

            funding_enabled:false,

            updated_at:
            externalNow()

        }

    );

}

/* =========================================
ARCHIVE PROJECT
========================================= */

async function archiveExternalProject(

projectCode

){

    return await updateExternalProject(

        projectCode,

        {

            project_status:
            "archived",

            visibility:
            "private",

            updated_at:
            externalNow()

        }

    );

}

/* =========================================
RESTORE PROJECT
========================================= */

async function restoreExternalProject(

projectCode

){

    return await updateExternalProject(

        projectCode,

        {

            project_status:
            "active",

            visibility:
            "public",

            updated_at:
            externalNow()

        }

    );

}

/* =========================================
EXPORTS
========================================= */

window.updateExternalProject =
updateExternalProject;

window.approveExternalProject =
approveExternalProject;

window.rejectExternalProject =
rejectExternalProject;

window.returnExternalProjectToReview =
returnExternalProjectToReview;

window.verifyExternalProject =
verifyExternalProject;

window.featureExternalProject =
featureExternalProject;

window.enableExternalTreasury =
enableExternalTreasury;

window.enableExternalFunding =
enableExternalFunding;

window.disableExternalFunding =
disableExternalFunding;

window.archiveExternalProject =
archiveExternalProject;

window.restoreExternalProject =
restoreExternalProject;

/* =========================================
DELETE PROJECT (SOFT DELETE)
========================================= */

async function deleteExternalProject(projectCode){

    if(!projectCode){

        return{
            error:"Project code required"
        };

    }

    return await updateExternalProject(

        projectCode,

        {

            project_status:"deleted",

            visibility:"private",

            deleted_at:externalNow(),

            updated_at:externalNow()

        }

    );

}

/* =========================================
PERMANENT DELETE
========================================= */

async function permanentlyDeleteExternalProject(projectCode){

    const supabase =
    getExternalProjectSupabase();

    if(!supabase){

        return{
            error:"Supabase unavailable"
        };

    }

    try{

        const {error} =
        await supabase
        .from(EXTERNAL_PROJECT_TABLE)
        .delete()
        .eq(
            "project_code",
            projectCode
        );

        if(error){

            return{
                error:error.message
            };

        }

        return{

            success:true

        };

    }catch(e){

        return{

            error:e.message

        };

    }

}

/* =========================================
FILTER HELPERS
========================================= */

async function getPendingExternalProjects(){

    const rows =
    await getAllExternalProjects();

    return rows.filter(

        p=>p.approval_status==="pending"

    );

}

async function getApprovedExternalProjects(){

    const rows =
    await getAllExternalProjects();

    return rows.filter(

        p=>p.approval_status==="approved"

    );

}

async function getRejectedExternalProjects(){

    const rows =
    await getAllExternalProjects();

    return rows.filter(

        p=>p.approval_status==="rejected"

    );

}

async function getArchivedExternalProjects(){

    const rows =
    await getAllExternalProjects();

    return rows.filter(

        p=>p.project_status==="archived"

    );

}

async function getDeletedExternalProjects(){

    const rows =
    await getAllExternalProjects();

    return rows.filter(

        p=>p.project_status==="deleted"

    );

}

/* =========================================
OWNER FILTER
========================================= */

async function getProjectsByOwner(owner){

    owner =
    externalSafeString(owner)
    .trim()
    .toLowerCase();

    const rows =
    await getAllExternalProjects();

    return rows.filter(

        p=>

        externalSafeString(
            p.owner_name
        )
        .toLowerCase()==owner

    );

}

/* =========================================
CATEGORY FILTER
========================================= */

async function getProjectsByCategory(category){

    category =
    externalSafeString(category)
    .trim()
    .toLowerCase();

    const rows =
    await getAllExternalProjects();

    return rows.filter(

        p=>

        externalSafeString(
            p.category
        )
        .toLowerCase()==category

    );

}

/* =========================================
COUNTRY FILTER
========================================= */

async function getProjectsByCountry(country){

    country =
    externalSafeString(country)
    .trim()
    .toLowerCase();

    const rows =
    await getAllExternalProjects();

    return rows.filter(

        p=>

        externalSafeString(
            p.country
        )
        .toLowerCase()==country

    );

}

/* =========================================
PROJECT SUMMARY
========================================= */

async function getExternalProjectSummary(){

    const rows =
    await getAllExternalProjects();

    return{

        total:
        rows.length,

        pending:
        rows.filter(

        p=>p.approval_status==="pending"

        ).length,

        approved:
        rows.filter(

        p=>p.approval_status==="approved"

        ).length,

        rejected:
        rows.filter(

        p=>p.approval_status==="rejected"

        ).length,

        archived:
        rows.filter(

        p=>p.project_status==="archived"

        ).length,

        deleted:
        rows.filter(

        p=>p.project_status==="deleted"

        ).length,

        verified:
        rows.filter(

        p=>p.verified

        ).length,

        featured:
        rows.filter(

        p=>p.featured

        ).length

    };

}

/* =========================================
DASHBOARD DATA
========================================= */

async function getExternalDashboardData(){

    const projects =
    await getAllExternalProjects();

    const summary =
    await getExternalProjectSummary();

    return{

        success:true,

        summary,

        projects

    };

}

/* =========================================
EXPORTS
========================================= */

window.deleteExternalProject =
deleteExternalProject;

window.permanentlyDeleteExternalProject =
permanentlyDeleteExternalProject;

window.getPendingExternalProjects =
getPendingExternalProjects;

window.getApprovedExternalProjects =
getApprovedExternalProjects;

window.getRejectedExternalProjects =
getRejectedExternalProjects;

window.getArchivedExternalProjects =
getArchivedExternalProjects;

window.getDeletedExternalProjects =
getDeletedExternalProjects;

window.getProjectsByOwner =
getProjectsByOwner;

window.getProjectsByCategory =
getProjectsByCategory;

window.getProjectsByCountry =
getProjectsByCountry;

window.getExternalProjectSummary =
getExternalProjectSummary;

window.getExternalDashboardData =
getExternalDashboardData;
