/* =========================================
   ALBUKHR EXTERNAL PROJECT ACTIVITY ENGINE
   v4 — MAINNET READY
   PART 1
========================================= */

/*
  TABLE:
  external_project_activity_logs

  PURPOSE:
  - Audit trail
  - Security logging
  - Admin activity
  - Project timeline
  - Compliance history

  DEPENDS ON:
  - js/supabase-core.js

  IMPORTANT:
  Engine din ba ya dogara da wani external-project
  engine kai tsaye. Saboda haka sauran engines za su
  iya kiran logExternalProjectActivity() ba tare da
  circular dependency ba.
*/

/* =========================================
   TABLE CONFIG
========================================= */

const EXTERNAL_ACTIVITY_TABLE =
  "external_project_activity_logs";

/* =========================================
   ACTIVITY STATUS
========================================= */

const ACTIVITY_STATUS = {

  SUCCESS: "success",

  FAILED: "failed",

  WARNING: "warning",

  INFO: "info"

};

/* =========================================
   ACTIVITY TYPES
========================================= */

const ACTIVITY_TYPE = {

  PROJECT_CREATED:
    "project_created",

  PROJECT_UPDATED:
    "project_updated",

  PROJECT_APPROVED:
    "project_approved",

  PROJECT_REJECTED:
    "project_rejected",

  PROJECT_SUSPENDED:
    "project_suspended",

  PROJECT_RESTORED:
    "project_restored",

  PROJECT_ARCHIVED:
    "project_archived",

  TEAM_ADDED:
    "team_added",

  TEAM_REMOVED:
    "team_removed",

  DOCUMENT_UPLOADED:
    "document_uploaded",

  DOCUMENT_UPDATED:
    "document_updated",

  DOCUMENT_DELETED:
    "document_deleted",

  MEDIA_UPLOADED:
    "media_uploaded",

  MEDIA_DELETED:
    "media_deleted",

  REVIEW_SUBMITTED:
    "review_submitted",

  REVIEW_APPROVED:
    "review_approved",

  REVIEW_REJECTED:
    "review_rejected",

  COMMENT_ADDED:
    "comment_added",

  COMMENT_UPDATED:
    "comment_updated",

  COMMENT_DELETED:
    "comment_deleted",

  UPDATE_CREATED:
    "update_created",

  UPDATE_PUBLISHED:
    "update_published",

  UPDATE_ARCHIVED:
    "update_archived",

  FUNDING_RECEIVED:
    "funding_received",

  FUNDING_UPDATED:
    "funding_updated",

  WALLET_CREATED:
    "wallet_created",

  WALLET_UPDATED:
    "wallet_updated",

  ACCESS_GRANTED:
    "access_granted",

  ACCESS_REVOKED:
    "access_revoked",

  ADMIN_ACTION:
    "admin_action",

  COMPLIANCE_ACTION:
    "compliance_action",

  TREASURY_ACTION:
    "treasury_action",

  LIQUIDITY_ACTION:
    "liquidity_action",

  INVESTOR_ACTION:
    "investor_action",

  LOGIN:
    "login",

  LOGOUT:
    "logout",

  SECURITY_EVENT:
    "security_event",

  SYSTEM_EVENT:
    "system_event"

};

/* =========================================
   ACTIVITY CACHE
========================================= */

const ACTIVITY_CACHE_KEY =
  "albukhr_external_project_activity";

/* =========================================
   SAFE HELPERS
========================================= */

function activitySafeString(
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

/* ========================================= */

function activitySafeNumber(
  value,
  fallback = 0
){

  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : fallback;

}

/* ========================================= */

function activityNow(){

  return new Date().toISOString();

}

/* ========================================= */

function activityId(){

  return (

    "ACT-" +

    Date.now() +

    "-" +

    Math.random()

      .toString(36)

      .substring(2,10)

  );

}

/* =========================================
   SUPABASE CLIENT
========================================= */

function getExternalActivitySupabase(){

  if(
    typeof window
      .getAlbukhrSupabaseClient
      === "function"
  ){

    const client =
      window.getAlbukhrSupabaseClient();

    if(client){

      return client;

    }

  }

  if(window.albukhrSupabase){

    return window.albukhrSupabase;

  }

  return null;

}

/* =========================================
   LOCAL CACHE
========================================= */

function getExternalActivityCache(){

  try{

    const rows =
      JSON.parse(

        localStorage.getItem(

          ACTIVITY_CACHE_KEY

        )

      );

    return Array.isArray(rows)

      ? rows

      : [];

  }catch{

    return [];

  }

}

/* ========================================= */

function saveExternalActivityCache(
  rows
){

  if(!Array.isArray(rows)){

    return;

  }

  localStorage.setItem(

    ACTIVITY_CACHE_KEY,

    JSON.stringify(rows)

  );

}

/* =========================================
   NORMALIZE ACTIVITY
========================================= */

function normalizeExternalActivity(
  row = {}
){

  return {

    id:
      row.id ||
      activityId(),

    project_code:
      activitySafeString(
        row.project_code
      ),

    project_name:
      activitySafeString(
        row.project_name
      ),

    project_type:
      activitySafeString(
        row.project_type,
        "external"
      ),

    activity_type:
      activitySafeString(
        row.activity_type,
        ACTIVITY_TYPE.SYSTEM_EVENT
      ),

    status:
      activitySafeString(
        row.status,
        ACTIVITY_STATUS.INFO
      ),

    actor_userid:
      activitySafeString(
        row.actor_userid
      ),

    actor_username:
      activitySafeString(
        row.actor_username
      ),

    actor_role:
      activitySafeString(
        row.actor_role
      ),

    target_type:
      activitySafeString(
        row.target_type
      ),

    target_id:
      activitySafeString(
        row.target_id
      ),

    description:
      activitySafeString(
        row.description
      ),

    note:
      activitySafeString(
        row.note
      ),

    ip_address:
      activitySafeString(
        row.ip_address
      ),

    user_agent:
      activitySafeString(
        row.user_agent
      ),

    metadata:
      row.metadata &&
      typeof row.metadata === "object"

        ? row.metadata

        : {},

    created_at:
      row.created_at ||
      activityNow(),

    raw:
      row

  };

}

/* =========================================
   CREATE ACTIVITY LOG
========================================= */

async function logExternalProjectActivity(
  payload = {}
){

  const activity =
    normalizeExternalActivity({

      ...payload,

      id:
        payload.id ||
        activityId(),

      project_type:
        payload.project_type ||
        "external",

      created_at:
        payload.created_at ||
        activityNow()

    });

  const supabase =
    getExternalActivitySupabase();

  /*
    SUPABASE AVAILABLE
  */

  if(supabase){

    try{

      const {
        data,
        error
      } = await supabase

        .from(
          EXTERNAL_ACTIVITY_TABLE
        )

        .insert({

          id:
            activity.id,

          project_code:
            activity.project_code,

          project_name:
            activity.project_name,

          project_type:
            activity.project_type,

          activity_type:
            activity.activity_type,

          status:
            activity.status,

          actor_userid:
            activity.actor_userid,

          actor_username:
            activity.actor_username,

          actor_role:
            activity.actor_role,

          target_type:
            activity.target_type,

          target_id:
            activity.target_id,

          description:
            activity.description,

          note:
            activity.note,

          ip_address:
            activity.ip_address,

          user_agent:
            activity.user_agent,

          metadata:
            activity.metadata,

          created_at:
            activity.created_at

        })

        .select()

        .single();

      if(error){

        throw error;

      }

      return {

        success:true,

        data:
          normalizeExternalActivity(
            data
          )

      };

    }catch(error){

      console.warn(

        "External activity Supabase log failed:",

        error

      );

    }

  }

  /*
    LOCAL FALLBACK
  */

  const rows =
    getExternalActivityCache();

  rows.unshift(activity);

  saveExternalActivityCache(rows);

  return {

    success:true,

    offline:true,

    data:activity

  };

}

/* =========================================
   QUICK ACTIVITY LOGGER
========================================= */

async function recordExternalActivity(
  projectCode,
  activityType,
  description = "",
  options = {}
){

  return await logExternalProjectActivity({

    project_code:
      projectCode,

    project_name:
      options.project_name || "",

    project_type:
      "external",

    activity_type:
      activityType,

    status:
      options.status ||
      ACTIVITY_STATUS.SUCCESS,

    actor_userid:
      options.actor_userid ||
      "",

    actor_username:
      options.actor_username ||
      "",

    actor_role:
      options.actor_role ||
      "",

    target_type:
      options.target_type ||
      "",

    target_id:
      options.target_id ||
      "",

    description,

    note:
      options.note ||
      "",

    ip_address:
      options.ip_address ||
      "",

    user_agent:
      options.user_agent ||
      "",

    metadata:
      options.metadata ||
      {}

  });

    }
/* =========================================================
   ALBUKHR EXTERNAL PROJECTS ENGINE
   PART 2/4
   CORE PROJECT REGISTRY + CRUD + NORMALIZATION
   ========================================================= */

/*
   DEPENDS ON:
   - js/supabase-core.js

   REQUIRED SUPABASE TABLE:
   - external_projects

   DESIGN GOAL:
   - No hard-coded project records
   - Supabase becomes source of truth
   - Works automatically after table creation
   - Supports core/internal/external ecosystem integration
*/

/* =========================================================
   TABLE CONFIG
   ========================================================= */

const EXTERNAL_PROJECTS_TABLE = "external_projects";


/* =========================================================
   SUPABASE CLIENT
   ========================================================= */

function getExternalProjectsSupabase(){

  if(
    typeof window.getAlbukhrSupabaseClient === "function"
  ){

    const client =
      window.getAlbukhrSupabaseClient();

    if(client){
      return client;
    }

  }

  if(window.albukhrSupabase){

    return window.albukhrSupabase;

  }

  console.error(
    "ALBUKHR External Projects Engine: " +
    "Supabase client not available."
  );

  return null;

}


/* =========================================================
   SAFE HELPERS
   ========================================================= */

function externalSafeString(
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


function externalSafeNumber(
  value,
  fallback = 0
){

  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : fallback;

}


function externalSafeBoolean(
  value,
  fallback = false
){

  if(typeof value === "boolean"){

    return value;

  }

  if(
    value === "true" ||
    value === 1 ||
    value === "1"
  ){

    return true;

  }

  if(
    value === "false" ||
    value === 0 ||
    value === "0"
  ){

    return false;

  }

  return fallback;

}


function externalNow(){

  return new Date().toISOString();

}


/* =========================================================
   NORMALIZE EXTERNAL PROJECT
   ========================================================= */

function normalizeExternalProject(
  row = {}
){

  return {

    id:
      row.id ?? null,

    project_code:
      externalSafeString(
        row.project_code
      ),

    project_name:
      externalSafeString(
        row.project_name
      ),

    slug:
      externalSafeString(
        row.slug
      ),

    description:
      externalSafeString(
        row.description
      ),

    short_description:
      externalSafeString(
        row.short_description
      ),

    category:
      externalSafeString(
        row.category
      ),

    sector:
      externalSafeString(
        row.sector
      ),

    project_type:
      externalSafeString(
        row.project_type,
        "external"
      ),

    status:
      externalSafeString(
        row.status,
        "draft"
      ),

    visibility:
      externalSafeString(
        row.visibility,
        "private"
      ),

    owner_userid:
      externalSafeString(
        row.owner_userid
      ),

    owner_username:
      externalSafeString(
        row.owner_username
      ),

    owner_wallet:
      externalSafeString(
        row.owner_wallet
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

    currency:
      externalSafeString(
        row.currency,
        "PI"
      ),

    target_amount:
      externalSafeNumber(
        row.target_amount
      ),

    minimum_funding:
      externalSafeNumber(
        row.minimum_funding
      ),

    maximum_funding:
      externalSafeNumber(
        row.maximum_funding
      ),

    current_funding:
      externalSafeNumber(
        row.current_funding
      ),

    funding_status:
      externalSafeString(
        row.funding_status,
        "open"
      ),

    start_date:
      row.start_date || null,

    end_date:
      row.end_date || null,

    approved_at:
      row.approved_at || null,

    published_at:
      row.published_at || null,

    created_at:
      row.created_at || null,

    updated_at:
      row.updated_at || null,

    raw:
      row

  };

}


/* =========================================================
   VALIDATE PROJECT CODE
   ========================================================= */

function validateExternalProjectCode(
  projectCode
){

  const code =
    externalSafeString(
      projectCode
    ).trim();

  if(!code){

    return {

      valid:false,

      error:
        "Project code is required"

    };

  }

  if(
    !/^[A-Za-z0-9_-]+$/.test(code)
  ){

    return {

      valid:false,

      error:
        "Invalid project code"

    };

  }

  return {

    valid:true,

    projectCode:code

  };

}


/* =========================================================
   GET CURRENT ADMIN / USER
   ========================================================= */

function getExternalActor(){

  let user = null;

  try{

    if(
      typeof getAdmin === "function"
    ){

      user =
        getAdmin();

    }

  }catch(e){}

  if(user){

    return {

      userid:
        user.userid ||
        user.uid ||
        user.id ||
        "",

      username:
        user.username ||
        user.name ||
        "",

      wallet:
        user.wallet ||
        user.wallet_address ||
        ""

    };

  }

  try{

    const piUser =
      JSON.parse(
        localStorage.getItem(
          "pi_user"
        )
      );

    if(piUser){

      return {

        userid:
          piUser.uid ||
          piUser.id ||
          "",

        username:
          piUser.username ||
          "",

        wallet:
          piUser.wallet_address ||
          ""

      };

    }

  }catch(e){}

  return {

    userid:"",
    username:"",
    wallet:""

  };

}


/* =========================================================
   GET PROJECT BY ID
   ========================================================= */

async function getExternalProjectById(
  id
){

  if(!id){

    return {

      error:
        "Project ID is required"

    };

  }

  const supabase =
    getExternalProjectsSupabase();

  if(!supabase){

    return {

      error:
        "Supabase client unavailable"

    };

  }

  try{

    const {
      data,
      error
    } = await supabase

      .from(
        EXTERNAL_PROJECTS_TABLE
      )

      .select("*")

      .eq(
        "id",
        id
      )

      .maybeSingle();

    if(error){

      return {

        error:
          error.message ||
          "Failed to fetch project"

      };

    }

    if(!data){

      return {

        error:
          "External project not found"

      };

    }

    return {

      success:true,

      data:
        normalizeExternalProject(
          data
        )

    };

  }catch(error){

    return {

      error:
        error?.message ||
        "Project fetch failed"

    };

  }

}


/* =========================================================
   GET PROJECT BY CODE
   ========================================================= */

async function getExternalProject(
  projectCode
){

  const validation =
    validateExternalProjectCode(
      projectCode
    );

  if(!validation.valid){

    return {

      error:
        validation.error

    };

  }

  const supabase =
    getExternalProjectsSupabase();

  if(!supabase){

    return {

      error:
        "Supabase client unavailable"

    };

  }

  try{

    const {
      data,
      error
    } = await supabase

      .from(
        EXTERNAL_PROJECTS_TABLE
      )

      .select("*")

      .eq(
        "project_code",
        validation.projectCode
      )

      .maybeSingle();

    if(error){

      return {

        error:
          error.message ||
          "Failed to fetch external project"

      };

    }

    if(!data){

      return {

        error:
          `External project not found: ${validation.projectCode}`

      };

    }

    return {

      success:true,

      data:
        normalizeExternalProject(
          data
        )

    };

  }catch(error){

    return {

      error:
        error?.message ||
        "External project fetch failed"

    };

  }

}


/* =========================================================
   PROJECT EXISTS
   ========================================================= */

async function externalProjectExists(
  projectCode
){

  const result =
    await getExternalProject(
      projectCode
    );

  return Boolean(
    result &&
    result.success &&
    result.data
  );

}


/* =========================================================
   GET ALL EXTERNAL PROJECTS
   ========================================================= */

async function getAllExternalProjects(
  options = {}
){

  const supabase =
    getExternalProjectsSupabase();

  if(!supabase){

    return [];

  }

  const {

    status = null,

    visibility = null,

    funding_status = null,

    owner_userid = null,

    search = null,

    activeOnly = false,

    publishedOnly = false,

    limit = 100,

    offset = 0

  } = options;


  try{

    let query =
      supabase

        .from(
          EXTERNAL_PROJECTS_TABLE
        )

        .select("*");


    /* STATUS */

    if(status){

      query =
        query.eq(
          "status",
          status
        );

    }


    /* VISIBILITY */

    if(visibility){

      query =
        query.eq(
          "visibility",
          visibility
        );

    }


    /* FUNDING STATUS */

    if(funding_status){

      query =
        query.eq(
          "funding_status",
          funding_status
        );

    }


    /* OWNER */

    if(owner_userid){

      query =
        query.eq(
          "owner_userid",
          owner_userid
        );

    }


    /* ACTIVE ONLY */

    if(activeOnly){

      query =
        query.eq(
          "status",
          "active"
        );

    }


    /* PUBLISHED ONLY */

    if(publishedOnly){

      query =
        query
          .not(
            "published_at",
            "is",
            null
          );

    }


    /* SEARCH */

    if(search){

      const safe =
        String(search)
          .replace(/,/g,"");

      query =
        query.or(

          `project_name.ilike.%${safe}%,` +
          `project_code.ilike.%${safe}%,` +
          `category.ilike.%${safe}%,` +
          `sector.ilike.%${safe}%`

        );

    }


    /* ORDER */

    query =
      query.order(
        "created_at",
        {
          ascending:false
        }
      );


    /* PAGINATION */

    const safeLimit =
      Math.max(
        1,
        Math.min(
          500,
          externalSafeNumber(
            limit,
            100
          )
        )
      );

    const safeOffset =
      Math.max(
        0,
        externalSafeNumber(
          offset,
          0
        )
      );

    query =
      query.range(
        safeOffset,
        safeOffset +
        safeLimit -
        1
      );


    const {
      data,
      error
    } = await query;


    if(error){

      console.error(
        "getAllExternalProjects:",
        error
      );

      return [];

    }


    return (
      data || []
    ).map(
      normalizeExternalProject
    );


  }catch(error){

    console.error(
      "External projects query failed:",
      error
    );

    return [];

  }

}


/* =========================================================
   GET PUBLIC EXTERNAL PROJECTS
   ========================================================= */

async function getPublicExternalProjects(){

  return await getAllExternalProjects({

    status:
      "active",

    visibility:
      "public",

    publishedOnly:
      true

  });

}


/* =========================================================
   GET OWNER PROJECTS
   ========================================================= */

async function getMyExternalProjects(){

  const actor =
    getExternalActor();

  if(!actor.userid){

    return [];

  }

  return await getAllExternalProjects({

    owner_userid:
      actor.userid

  });

}


/* =========================================================
   CREATE EXTERNAL PROJECT
   ========================================================= */

async function createExternalProject(
projectData = {}
){

  const supabase =
    getExternalProjectsSupabase();

  if(!supabase){

    return {

      error:
        "Supabase client unavailable"

    };

  }


  const projectCode =
    externalSafeString(
      projectData.project_code
    ).trim();


  if(!projectCode){

    return {

      error:
        "Project code is required"

    };

  }


  const existing =
    await externalProjectExists(
      projectCode
    );

  if(existing){

    return {

      error:
        "Project code already exists"

    };

  }


  const actor =
    getExternalActor();


  const payload = {

    project_code:
      projectCode,

    project_name:
      externalSafeString(
        projectData.project_name
      ).trim(),

    slug:
      externalSafeString(
        projectData.slug
      ).trim(),

    description:
      externalSafeString(
        projectData.description
      ),

    short_description:
      externalSafeString(
        projectData.short_description
      ),

    category:
      externalSafeString(
        projectData.category
      ),

    sector:
      externalSafeString(
        projectData.sector
      ),

    project_type:
      "external",

    status:
      projectData.status ||
      "draft",

    visibility:
      projectData.visibility ||
      "private",

    owner_userid:
      projectData.owner_userid ||
      actor.userid,

    owner_username:
      projectData.owner_username ||
      actor.username,

    owner_wallet:
      projectData.owner_wallet ||
      actor.wallet,

    country:
      externalSafeString(
        projectData.country
      ),

    state:
      externalSafeString(
        projectData.state
      ),

    city:
      externalSafeString(
        projectData.city
      ),

    currency:
      projectData.currency ||
      "PI",

    target_amount:
      externalSafeNumber(
        projectData.target_amount
      ),

    minimum_funding:
      externalSafeNumber(
        projectData.minimum_funding
      ),

    maximum_funding:
      externalSafeNumber(
        projectData.maximum_funding
      ),

    current_funding:
      0,

    funding_status:
      "open",

    start_date:
      projectData.start_date ||
      null,

    end_date:
      projectData.end_date ||
      null,

    created_at:
      externalNow(),

    updated_at:
      externalNow()

  };


  if(!payload.project_name){

    return {

      error:
        "Project name is required"

    };

  }


  try{

    const {
      data,
      error
    } = await supabase

      .from(
        EXTERNAL_PROJECTS_TABLE
      )

      .insert(
        payload
      )

      .select("*")

      .single();


    if(error){

      return {

        error:
          error.message ||
          "Failed to create external project"

      };

    }


    return {

      success:true,

      data:
        normalizeExternalProject(
          data
        )

    };


  }catch(error){

    return {

      error:
        error?.message ||
        "External project creation failed"

    };

  }

}


/* =========================================================
   UPDATE EXTERNAL PROJECT
   ========================================================= */

async function updateExternalProject(
projectCode,
updates = {}
){

  const validation =
    validateExternalProjectCode(
      projectCode
    );

  if(!validation.valid){

    return {

      error:
        validation.error

    };

  }


  const supabase =
    getExternalProjectsSupabase();

  if(!supabase){

    return {

      error:
        "Supabase client unavailable"

    };

  }


  const allowedFields = [

    "project_name",
    "slug",
    "description",
    "short_description",
    "category",
    "sector",
    "status",
    "visibility",

    "country",
    "state",
    "city",

    "currency",

    "target_amount",
    "minimum_funding",
    "maximum_funding",

    "funding_status",

    "start_date",
    "end_date",

    "approved_at",
    "published_at"

  ];


  const patch = {};


  allowedFields.forEach(
    field => {

      if(
        Object.prototype.hasOwnProperty.call(
          updates,
          field
        )
      ){

        patch[field] =
          updates[field];

      }

    }
  );


  if(
    Object.keys(patch).length === 0
  ){

    return {

      error:
        "No valid project fields supplied"

    };

  }


  patch.updated_at =
    externalNow();


  try{

    const {
      data,
      error
    } = await supabase

      .from(
        EXTERNAL_PROJECTS_TABLE
      )

      .update(
        patch
      )

      .eq(
        "project_code",
        validation.projectCode
      )

      .select("*")

      .single();


    if(error){

      return {

        error:
          error.message ||
          "Failed to update project"

      };

    }


    return {

      success:true,

      data:
        normalizeExternalProject(
          data
        )

    };


  }catch(error){

    return {

      error:
        error?.message ||
        "External project update failed"

    };

  }

}


/* =========================================================
   CHANGE PROJECT STATUS
   ========================================================= */

async function setExternalProjectStatus(
projectCode,
status
){

  const allowed = [

    "draft",
    "pending_review",
    "under_review",
    "approved",
    "rejected",
    "active",
    "paused",
    "suspended",
    "completed",
    "cancelled",
    "archived"

  ];


  const safeStatus =
    externalSafeString(
      status
    ).trim().toLowerCase();


  if(
    !allowed.includes(
      safeStatus
    )
  ){

    return {

      error:
        "Invalid external project status"

    };

  }


  return await updateExternalProject(

    projectCode,

    {

      status:
        safeStatus

    }

  );

}


/* =========================================================
   PUBLISH PROJECT
   ========================================================= */

async function publishExternalProject(
projectCode
){

  return await updateExternalProject(

    projectCode,

    {

      status:
        "active",

      visibility:
        "public",

      published_at:
        externalNow()

    }

  );

}


/* =========================================================
   PAUSE PROJECT
   ========================================================= */

async function pauseExternalProject(
projectCode
){

  return await updateExternalProject(

    projectCode,

    {

      status:
        "paused"

    }

  );

}


/* =========================================================
   ARCHIVE PROJECT
   ========================================================= */

async function archiveExternalProject(
projectCode
){

  return await updateExternalProject(

    projectCode,

    {

      status:
        "archived"

    }

  );

}


/* =========================================================
   DELETE PROJECT
   IMPORTANT:
   Physical deletion should normally be controlled by
   Supabase RLS / admin permissions.
   ========================================================= */

async function deleteExternalProject(
projectCode
){

  const validation =
    validateExternalProjectCode(
      projectCode
    );

  if(!validation.valid){

    return {

      error:
        validation.error

    };

  }


  const supabase =
    getExternalProjectsSupabase();

  if(!supabase){

    return {

      error:
        "Supabase client unavailable"

    };

  }


  try{

    const {
      error
    } = await supabase

      .from(
        EXTERNAL_PROJECTS_TABLE
      )

      .delete()

      .eq(
        "project_code",
        validation.projectCode
      );


    if(error){

      return {

        error:
          error.message ||
          "Project deletion failed"

      };

    }


    return {

      success:true,

      project_code:
        validation.projectCode

    };


  }catch(error){

    return {

      error:
        error?.message ||
        "External project deletion failed"

    };

  }

}


/* =========================================================
   PROJECT FUNDING PROGRESS
   ========================================================= */

async function getExternalProjectFundingProgress(
projectCode
){

  const result =
    await getExternalProject(
      projectCode
    );

  if(result.error){

    return result;

  }


  const project =
    result.data;


  const target =
    externalSafeNumber(
      project.target_amount
    );

  const current =
    externalSafeNumber(
      project.current_funding
    );


  const percentage =
    target > 0

      ? Math.min(
          100,
          (current / target) * 100
        )

      : 0;


  return {

    success:true,

    project_code:
      project.project_code,

    target_amount:
      target,

    current_funding:
      current,

    remaining:
      Math.max(
        0,
        target - current
      ),

    percentage:
      Number(
        percentage.toFixed(4)
      ),

    funding_status:
      project.funding_status

  };

}


/* =========================================================
   ENGINE HEALTH
   ========================================================= */

async function checkExternalProjectsEngine(){

  const supabase =
    getExternalProjectsSupabase();

  if(!supabase){

    return {

      healthy:false,

      error:
        "Supabase client unavailable"

    };

  }


  try{

    const {
      error
    } = await supabase

      .from(
        EXTERNAL_PROJECTS_TABLE
      )

      .select(
        "id",
        {
          count:"exact",
          head:true
        }
      );


    if(error){

      return {

        healthy:false,

        error:
          error.message

      };

    }


    return {

      healthy:true,

      table:
        EXTERNAL_PROJECTS_TABLE,

      timestamp:
        externalNow()

    };


  }catch(error){

    return {

      healthy:false,

      error:
        error?.message ||
        "Engine health check failed"

    };

  }

}


/* =========================================================
   GLOBAL EXPORTS
   ========================================================= */

window.normalizeExternalProject =
  normalizeExternalProject;

window.getExternalProject =
  getExternalProject;

window.getExternalProjectById =
  getExternalProjectById;

window.externalProjectExists =
  externalProjectExists;

window.getAllExternalProjects =
  getAllExternalProjects;

window.getPublicExternalProjects =
  getPublicExternalProjects;

window.getMyExternalProjects =
  getMyExternalProjects;

window.createExternalProject =
  createExternalProject;

window.updateExternalProject =
  updateExternalProject;

window.setExternalProjectStatus =
  setExternalProjectStatus;

window.publishExternalProject =
  publishExternalProject;

window.pauseExternalProject =
  pauseExternalProject;

window.archiveExternalProject =
  archiveExternalProject;

window.deleteExternalProject =
  deleteExternalProject;

window.getExternalProjectFundingProgress =
  getExternalProjectFundingProgress;

window.checkExternalProjectsEngine =
  checkExternalProjectsEngine;
/* =========================================================
   ALBUKHR EXTERNAL PROJECTS ENGINE
   PART 3 — OPERATIONS ENGINE
   =========================================================

   SUPPORTS:

   external_projects
   external_project_team
   external_project_documents
   external_project_media
   external_project_reviews
   external_project_review_history
   external_project_comments
   external_project_updates
   external_project_activity_logs

   DEPENDS ON:

   1. supabase-core.js
   2. projects-engine.js

   DESIGN:

   - Supabase is the source of truth.
   - No localStorage dependency.
   - External project records are isolated by project_id.
   - Every important action can generate an activity log.
   - Functions return predictable {success, data, error} objects.
*/

/* =========================================================
   TABLE CONFIG
   ========================================================= */

const EXTERNAL_PROJECT_TABLE =
  "external_projects";

const EXTERNAL_TEAM_TABLE =
  "external_project_team";

const EXTERNAL_DOCUMENTS_TABLE =
  "external_project_documents";

const EXTERNAL_MEDIA_TABLE =
  "external_project_media";

const EXTERNAL_REVIEWS_TABLE =
  "external_project_reviews";

const EXTERNAL_REVIEW_HISTORY_TABLE =
  "external_project_review_history";

const EXTERNAL_COMMENTS_TABLE =
  "external_project_comments";

const EXTERNAL_UPDATES_TABLE =
  "external_project_updates";

const EXTERNAL_ACTIVITY_TABLE =
  "external_project_activity_logs";


/* =========================================================
   SUPABASE CLIENT
   ========================================================= */

function getExternalProjectSupabase(){

  if(
    typeof window.getAlbukhrSupabaseClient ===
    "function"
  ){

    const client =
      window.getAlbukhrSupabaseClient();

    if(client){
      return client;
    }

  }

  if(window.albukhrSupabase){
    return window.albukhrSupabase;
  }

  console.error(
    "ALBUKHR Supabase client unavailable."
  );

  return null;

}


/* =========================================================
   SAFE HELPERS
   ========================================================= */

function externalSafeString(
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


function externalSafeNumber(
  value,
  fallback = 0
){

  const n =
    Number(value);

  return Number.isFinite(n)
    ? n
    : fallback;

}


function externalNow(){

  return new Date().toISOString();

}


/* =========================================================
   ERROR RESPONSE
   ========================================================= */

function externalError(
  message,
  extra = {}
){

  return {

    success:false,

    error:
      externalSafeString(
        message,
        "External project operation failed"
      ),

    ...extra

  };

}


/* =========================================================
   SUCCESS RESPONSE
   ========================================================= */

function externalSuccess(
  data = null,
  extra = {}
){

  return {

    success:true,

    data,

    ...extra

  };

}


/* =========================================================
   PROJECT ID VALIDATION
   ========================================================= */

function requireExternalProjectId(
  projectId
){

  if(
    projectId === null ||
    projectId === undefined ||
    projectId === ""
  ){

    return externalError(
      "External project ID is required"
    );

  }

  return null;

}


/* =========================================================
   GENERIC TABLE FETCH
   ========================================================= */

async function externalFetchRows(
  table,
  filters = {},
  options = {}
){

  const supabase =
    getExternalProjectSupabase();

  if(!supabase){

    return externalError(
      "Supabase client unavailable"
    );

  }

  try{

    let query =
      supabase
        .from(table)
        .select(
          options.select || "*"
        );

    Object.entries(filters)
      .forEach(([column,value])=>{

        if(
          value !== null &&
          value !== undefined
        ){

          query =
            query.eq(
              column,
              value
            );

        }

      });


    if(options.order){

      query =
        query.order(
          options.order.column,
          {
            ascending:
              options.order.ascending !== false
          }
        );

    }


    if(
      Number.isFinite(
        Number(options.limit)
      )
    ){

      query =
        query.limit(
          Number(options.limit)
        );

    }


    const {
      data,
      error
    } = await query;


    if(error){

      return externalError(
        error.message ||
        "Failed to fetch records"
      );

    }


    return externalSuccess(
      Array.isArray(data)
        ? data
        : []
    );

  }catch(error){

    return externalError(
      error?.message ||
      "External fetch failed"
    );

  }

}


/* =========================================================
   GET EXTERNAL PROJECT
   ========================================================= */

async function getExternalProject(
  projectId
){

  const invalid =
    requireExternalProjectId(
      projectId
    );

  if(invalid){
    return invalid;
  }

  const supabase =
    getExternalProjectSupabase();

  if(!supabase){

    return externalError(
      "Supabase client unavailable"
    );

  }

  try{

    const {
      data,
      error
    } = await supabase
      .from(
        EXTERNAL_PROJECT_TABLE
      )
      .select("*")
      .eq(
        "id",
        projectId
      )
      .maybeSingle();


    if(error){

      return externalError(
        error.message
      );

    }


    if(!data){

      return externalError(
        "External project not found"
      );

    }


    return externalSuccess(
      data
    );

  }catch(error){

    return externalError(
      error?.message
    );

  }

}


/* =========================================================
   GET PROJECT BY CODE
   ========================================================= */

async function getExternalProjectByCode(
  projectCode
){

  if(!projectCode){

    return externalError(
      "Project code is required"
    );

  }

  const supabase =
    getExternalProjectSupabase();

  if(!supabase){

    return externalError(
      "Supabase client unavailable"
    );

  }

  try{

    const {
      data,
      error
    } = await supabase
      .from(
        EXTERNAL_PROJECT_TABLE
      )
      .select("*")
      .eq(
        "project_code",
        projectCode
      )
      .maybeSingle();


    if(error){

      return externalError(
        error.message
      );

    }


    if(!data){

      return externalError(
        "External project not found"
      );

    }


    return externalSuccess(
      data
    );

  }catch(error){

    return externalError(
      error?.message
    );

  }

}


/* =========================================================
   LIST EXTERNAL PROJECTS
   ========================================================= */

async function getAllExternalProjects(
  options = {}
){

  const filters = {};

  if(
    options.status !== undefined
  ){

    filters.status =
      options.status;

  }

  if(
    options.project_type !== undefined
  ){

    filters.project_type =
      options.project_type;

  }


  return await externalFetchRows(
    EXTERNAL_PROJECT_TABLE,
    filters,
    {
      order:{
        column:
          options.orderColumn ||
          "created_at",

        ascending:
          options.ascending === true
      },

      limit:
        options.limit || null

    }
  );

}


/* =========================================================
   CREATE EXTERNAL PROJECT
   ========================================================= */

async function createExternalProject(
  projectData = {},
  actor = {}
){

  const supabase =
    getExternalProjectSupabase();

  if(!supabase){

    return externalError(
      "Supabase client unavailable"
    );

  }


  if(
    !projectData.project_code
  ){

    return externalError(
      "project_code is required"
    );

  }


  if(
    !projectData.project_name
  ){

    return externalError(
      "project_name is required"
    );

  }


  try{

    const payload = {
      ...projectData
    };


    if(
      payload.created_at === undefined
    ){

      payload.created_at =
        externalNow();

    }


    const {
      data,
      error
    } = await supabase
      .from(
        EXTERNAL_PROJECT_TABLE
      )
      .insert(
        payload
      )
      .select()
      .single();


    if(error){

      return externalError(
        error.message
      );

    }


    const project =
      data;


    await logExternalProjectActivity({

      projectId:
        project.id,

      actor_userid:
        actor.actor_userid || "",

      actor_username:
        actor.actor_username || "",

      action:
        "project_created",

      entity_type:
        "external_project",

      entity_id:
        project.id,

      note:
        "External project created",

      meta:{
        project_code:
          project.project_code
      }

    });


    return externalSuccess(
      project
    );

  }catch(error){

    return externalError(
      error?.message
    );

  }

}


/* =========================================================
   UPDATE EXTERNAL PROJECT
   ========================================================= */

async function updateExternalProject(
  projectId,
  patch = {},
  actor = {}
){

  const invalid =
    requireExternalProjectId(
      projectId
    );

  if(invalid){
    return invalid;
  }


  if(
    !patch ||
    typeof patch !== "object"
  ){

    return externalError(
      "Invalid project update"
    );

  }


  const supabase =
    getExternalProjectSupabase();

  if(!supabase){

    return externalError(
      "Supabase client unavailable"
    );

  }


  try{

    const {
      data,
      error
    } = await supabase
      .from(
        EXTERNAL_PROJECT_TABLE
      )
      .update({
        ...patch,

        updated_at:
          externalNow()

      })
      .eq(
        "id",
        projectId
      )
      .select()
      .single();


    if(error){

      return externalError(
        error.message
      );

    }


    await logExternalProjectActivity({

      projectId,

      actor_userid:
        actor.actor_userid || "",

      actor_username:
        actor.actor_username || "",

      action:
        "project_updated",

      entity_type:
        "external_project",

      entity_id:
        projectId,

      note:
        "External project updated",

      meta:{
        fields:
          Object.keys(patch)
      }

    });


    return externalSuccess(
      data
    );

  }catch(error){

    return externalError(
      error?.message
    );

  }

}


/* =========================================================
   PROJECT TEAM
   ========================================================= */

async function getExternalProjectTeam(
  projectId
){

  const invalid =
    requireExternalProjectId(
      projectId
    );

  if(invalid){
    return invalid;
  }


  return await externalFetchRows(
    EXTERNAL_TEAM_TABLE,
    {
      project_id:
        projectId
    },
    {
      order:{
        column:
          "created_at",

        ascending:true
      }
    }
  );

}


/* =========================================================
   ADD TEAM MEMBER
   ========================================================= */

async function addExternalProjectTeamMember(
  projectId,
  memberData = {},
  actor = {}
){

  const invalid =
    requireExternalProjectId(
      projectId
    );

  if(invalid){
    return invalid;
  }


  const supabase =
    getExternalProjectSupabase();

  if(!supabase){

    return externalError(
      "Supabase client unavailable"
    );

  }


  try{

    const payload = {

      ...memberData,

      project_id:
        projectId

    };


    const {
      data,
      error
    } = await supabase
      .from(
        EXTERNAL_TEAM_TABLE
      )
      .insert(payload)
      .select()
      .single();


    if(error){

      return externalError(
        error.message
      );

    }


    await logExternalProjectActivity({

      projectId,

      actor_userid:
        actor.actor_userid || "",

      actor_username:
        actor.actor_username || "",

      action:
        "team_member_added",

      entity_type:
        "team",

      entity_id:
        data.id,

      note:
        "External project team member added"

    });


    return externalSuccess(
      data
    );

  }catch(error){

    return externalError(
      error?.message
    );

  }

}


/* =========================================================
   REMOVE TEAM MEMBER
   ========================================================= */

async function removeExternalProjectTeamMember(
  projectId,
  memberId,
  actor = {}
){

  const invalid =
    requireExternalProjectId(
      projectId
    );

  if(invalid){
    return invalid;
  }


  if(!memberId){

    return externalError(
      "Team member ID is required"
    );

  }


  const supabase =
    getExternalProjectSupabase();

  if(!supabase){

    return externalError(
      "Supabase client unavailable"
    );

  }


  try{

    const {
      data,
      error
    } = await supabase
      .from(
        EXTERNAL_TEAM_TABLE
      )
      .delete()
      .eq(
        "id",
        memberId
      )
      .eq(
        "project_id",
        projectId
      )
      .select()
      .maybeSingle();


    if(error){

      return externalError(
        error.message
      );

    }


    await logExternalProjectActivity({

      projectId,

      actor_userid:
        actor.actor_userid || "",

      actor_username:
        actor.actor_username || "",

      action:
        "team_member_removed",

      entity_type:
        "team",

      entity_id:
        memberId,

      note:
        "External project team member removed"

    });


    return externalSuccess(
      data
    );

  }catch(error){

    return externalError(
      error?.message
    );

  }

}


/* =========================================================
   DOCUMENTS
   ========================================================= */

async function getExternalProjectDocuments(
  projectId
){

  const invalid =
    requireExternalProjectId(
      projectId
    );

  if(invalid){
    return invalid;
  }


  return await externalFetchRows(
    EXTERNAL_DOCUMENTS_TABLE,
    {
      project_id:
        projectId
    },
    {
      order:{
        column:
          "created_at",

        ascending:false
      }
    }
  );

}


/* =========================================================
   ADD DOCUMENT
   ========================================================= */

async function addExternalProjectDocument(
  projectId,
  documentData = {},
  actor = {}
){

  const invalid =
    requireExternalProjectId(
      projectId
    );

  if(invalid){
    return invalid;
  }


  const supabase =
    getExternalProjectSupabase();

  if(!supabase){

    return externalError(
      "Supabase client unavailable"
    );

  }


  try{

    const payload = {

      ...documentData,

      project_id:
        projectId

    };


    const {
      data,
      error
    } = await supabase
      .from(
        EXTERNAL_DOCUMENTS_TABLE
      )
      .insert(payload)
      .select()
      .single();


    if(error){

      return externalError(
        error.message
      );

    }


    await logExternalProjectActivity({

      projectId,

      actor_userid:
        actor.actor_userid || "",

      actor_username:
        actor.actor_username || "",

      action:
        "document_added",

      entity_type:
        "document",

      entity_id:
        data.id,

      note:
        "External project document added"

    });


    return externalSuccess(
      data
    );

  }catch(error){

    return externalError(
      error?.message
    );

  }

}


/* =========================================================
   MEDIA
   ========================================================= */

async function getExternalProjectMedia(
  projectId
){

  const invalid =
    requireExternalProjectId(
      projectId
    );

  if(invalid){
    return invalid;
  }


  return await externalFetchRows(
    EXTERNAL_MEDIA_TABLE,
    {
      project_id:
        projectId
    },
    {
      order:{
        column:
          "created_at",

        ascending:false
      }
    }
  );

}


/* =========================================================
   ADD MEDIA RECORD
   ========================================================= */

async function addExternalProjectMedia(
  projectId,
  mediaData = {},
  actor = {}
){

  const invalid =
    requireExternalProjectId(
      projectId
    );

  if(invalid){
    return invalid;
  }


  const supabase =
    getExternalProjectSupabase();

  if(!supabase){

    return externalError(
      "Supabase client unavailable"
    );

  }


  try{

    const payload = {

      ...mediaData,

      project_id:
        projectId

    };


    const {
      data,
      error
    } = await supabase
      .from(
        EXTERNAL_MEDIA_TABLE
      )
      .insert(payload)
      .select()
      .single();


    if(error){

      return externalError(
        error.message
      );

    }


    await logExternalProjectActivity({

      projectId,

      actor_userid:
        actor.actor_userid || "",

      actor_username:
        actor.actor_username || "",

      action:
        "media_added",

      entity_type:
        "media",

      entity_id:
        data.id,

      note:
        "External project media added"

    });


    return externalSuccess(
      data
    );

  }catch(error){

    return externalError(
      error?.message
    );

  }

}


/* =========================================================
   REVIEWS
   ========================================================= */

async function getExternalProjectReviews(
  projectId
){

  const invalid =
    requireExternalProjectId(
      projectId
    );

  if(invalid){
    return invalid;
  }


  return await externalFetchRows(
    EXTERNAL_REVIEWS_TABLE,
    {
      project_id:
        projectId
    },
    {
      order:{
        column:
          "created_at",

        ascending:false
      }
    }
  );

}


/* =========================================================
   CREATE REVIEW
   ========================================================= */

async function createExternalProjectReview(
  projectId,
  reviewData = {},
  actor = {}
){

  const invalid =
    requireExternalProjectId(
      projectId
    );

  if(invalid){
    return invalid;
  }


  const supabase =
    getExternalProjectSupabase();

  if(!supabase){

    return externalError(
      "Supabase client unavailable"
    );

  }


  try{

    const payload = {

      ...reviewData,

      project_id:
        projectId

    };


    const {
      data,
      error
    } = await supabase
      .from(
        EXTERNAL_REVIEWS_TABLE
      )
      .insert(payload)
      .select()
      .single();


    if(error){

      return externalError(
        error.message
      );

    }


    await logExternalProjectActivity({

      projectId,

      actor_userid:
        actor.actor_userid || "",

      actor_username:
        actor.actor_username || "",

      action:
        "review_created",

      entity_type:
        "review",

      entity_id:
        data.id,

      note:
        "External project review created"

    });


    return externalSuccess(
      data
    );

  }catch(error){

    return externalError(
      error?.message
    );

  }

}


/* =========================================================
   REVIEW HISTORY
   ========================================================= */

async function getExternalProjectReviewHistory(
  projectId
){

  const invalid =
    requireExternalProjectId(
      projectId
    );

  if(invalid){
    return invalid;
  }


  return await externalFetchRows(
    EXTERNAL_REVIEW_HISTORY_TABLE,
    {
      project_id:
        projectId
    },
    {
      order:{
        column:
          "created_at",

        ascending:false
      }
    }
  );

}


/* =========================================================
   COMMENTS
   ========================================================= */

async function getExternalProjectComments(
  projectId
){

  const invalid =
    requireExternalProjectId(
      projectId
    );

  if(invalid){
    return invalid;
  }


  return await externalFetchRows(
    EXTERNAL_COMMENTS_TABLE,
    {
      project_id:
        projectId
    },
    {
      order:{
        column:
          "created_at",

        ascending:true
      }
    }
  );

}


/* =========================================================
   ADD COMMENT
   ========================================================= */

async function addExternalProjectComment(
  projectId,
  commentData = {},
  actor = {}
){

  const invalid =
    requireExternalProjectId(
      projectId
    );

  if(invalid){
    return invalid;
  }


  const supabase =
    getExternalProjectSupabase();

  if(!supabase){

    return externalError(
      "Supabase client unavailable"
    );

  }


  try{

    const payload = {

      ...commentData,

      project_id:
        projectId

    };


    const {
      data,
      error
    } = await supabase
      .from(
        EXTERNAL_COMMENTS_TABLE
      )
      .insert(payload)
      .select()
      .single();


    if(error){

      return externalError(
        error.message
      );

    }


    await logExternalProjectActivity({

      projectId,

      actor_userid:
        actor.actor_userid || "",

      actor_username:
        actor.actor_username || "",

      action:
        "comment_added",

      entity_type:
        "comment",

      entity_id:
        data.id,

      note:
        "External project comment added"

    });


    return externalSuccess(
      data
    );

  }catch(error){

    return externalError(
      error?.message
    );

  }

}


/* =========================================================
   PROJECT UPDATES
   ========================================================= */

async function getExternalProjectUpdates(
  projectId
){

  const invalid =
    requireExternalProjectId(
      projectId
    );

  if(invalid){
    return invalid;
  }


  return await externalFetchRows(
    EXTERNAL_UPDATES_TABLE,
    {
      project_id:
        projectId
    },
    {
      order:{
        column:
          "created_at",

        ascending:false
      }
    }
  );

}


/* =========================================================
   CREATE PROJECT UPDATE
   ========================================================= */

async function createExternalProjectUpdate(
  projectId,
  updateData = {},
  actor = {}
){

  const invalid =
    requireExternalProjectId(
      projectId
    );

  if(invalid){
    return invalid;
  }


  const supabase =
    getExternalProjectSupabase();

  if(!supabase){

    return externalError(
      "Supabase client unavailable"
    );

  }


  try{

    const payload = {

      ...updateData,

      project_id:
        projectId

    };


    const {
      data,
      error
    } = await supabase
      .from(
        EXTERNAL_UPDATES_TABLE
      )
      .insert(payload)
      .select()
      .single();


    if(error){

      return externalError(
        error.message
      );

    }


    await logExternalProjectActivity({

      projectId,

      actor_userid:
        actor.actor_userid || "",

      actor_username:
        actor.actor_username || "",

      action:
        "project_update_created",

      entity_type:
        "update",

      entity_id:
        data.id,

      note:
        "External project update published"

    });


    return externalSuccess(
      data
    );

  }catch(error){

    return externalError(
      error?.message
    );

  }

}


/* =========================================================
   ACTIVITY LOG
   ========================================================= */

async function logExternalProjectActivity({
  projectId,
  actor_userid = "",
  actor_username = "",
  action = "",
  entity_type = "",
  entity_id = null,
  note = "",
  meta = {}
} = {}){

  if(!projectId){

    return externalError(
      "Project ID is required for activity log"
    );

  }


  const supabase =
    getExternalProjectSupabase();

  if(!supabase){

    return externalError(
      "Supabase client unavailable"
    );

  }


  try{

    const payload = {

      project_id:
        projectId,

      actor_userid:
        externalSafeString(
          actor_userid
        ),

      actor_username:
        externalSafeString(
          actor_username
        ),

      action:
        externalSafeString(
          action
        ),

      entity_type:
        externalSafeString(
          entity_type
        ),

      entity_id:
        entity_id,

      note:
        externalSafeString(
          note
        ),

      meta:
        meta || {},

      created_at:
        externalNow()

    };


    const {
      data,
      error
    } = await supabase
      .from(
        EXTERNAL_ACTIVITY_TABLE
      )
      .insert(payload)
      .select()
      .single();


    if(error){

      return externalError(
        error.message
      );

    }


    return externalSuccess(
      data
    );

  }catch(error){

    return externalError(
      error?.message
    );

  }

}


/* =========================================================
   GET ACTIVITY LOG
   ========================================================= */

async function getExternalProjectActivityLogs(
  projectId,
  limit = 100
){

  const invalid =
    requireExternalProjectId(
      projectId
    );

  if(invalid){
    return invalid;
  }


  return await externalFetchRows(
    EXTERNAL_ACTIVITY_TABLE,
    {
      project_id:
        projectId
    },
    {
      order:{
        column:
          "created_at",

        ascending:false
      },

      limit

    }
  );

}


/* =========================================================
   COMPLETE PROJECT OPERATIONS SNAPSHOT
   ========================================================= */

async function getExternalProjectOperationsSnapshot(
  projectId
){

  const invalid =
    requireExternalProjectId(
      projectId
    );

  if(invalid){
    return invalid;
  }


  const project =
    await getExternalProject(
      projectId
    );

  if(project.error){
    return project;
  }


  const [
    team,
    documents,
    media,
    reviews,
    reviewHistory,
    comments,
    updates,
    activity
  ] = await Promise.all([

    getExternalProjectTeam(
      projectId
    ),

    getExternalProjectDocuments(
      projectId
    ),

    getExternalProjectMedia(
      projectId
    ),

    getExternalProjectReviews(
      projectId
    ),

    getExternalProjectReviewHistory(
      projectId
    ),

    getExternalProjectComments(
      projectId
    ),

    getExternalProjectUpdates(
      projectId
    ),

    getExternalProjectActivityLogs(
      projectId
    )

  ]);


  return externalSuccess({

    project:
      project.data,

    team:
      team.data || [],

    documents:
      documents.data || [],

    media:
      media.data || [],

    reviews:
      reviews.data || [],

    review_history:
      reviewHistory.data || [],

    comments:
      comments.data || [],

    updates:
      updates.data || [],

    activity_logs:
      activity.data || []

  });

}


/* =========================================================
   GLOBAL EXPORTS
   ========================================================= */

window.getExternalProject =
  getExternalProject;

window.getExternalProjectByCode =
  getExternalProjectByCode;

window.getAllExternalProjects =
  getAllExternalProjects;

window.createExternalProject =
  createExternalProject;

window.updateExternalProject =
  updateExternalProject;


window.getExternalProjectTeam =
  getExternalProjectTeam;

window.addExternalProjectTeamMember =
  addExternalProjectTeamMember;

window.removeExternalProjectTeamMember =
  removeExternalProjectTeamMember;


window.getExternalProjectDocuments =
  getExternalProjectDocuments;

window.addExternalProjectDocument =
  addExternalProjectDocument;


window.getExternalProjectMedia =
  getExternalProjectMedia;

window.addExternalProjectMedia =
  addExternalProjectMedia;


window.getExternalProjectReviews =
  getExternalProjectReviews;

window.createExternalProjectReview =
  createExternalProjectReview;


window.getExternalProjectReviewHistory =
  getExternalProjectReviewHistory;


window.getExternalProjectComments =
  getExternalProjectComments;

window.addExternalProjectComment =
  addExternalProjectComment;


window.getExternalProjectUpdates =
  getExternalProjectUpdates;

window.createExternalProjectUpdate =
  createExternalProjectUpdate;


window.logExternalProjectActivity =
  logExternalProjectActivity;

window.getExternalProjectActivityLogs =
  getExternalProjectActivityLogs;


window.getExternalProjectOperationsSnapshot =
  getExternalProjectOperationsSnapshot;
/* =========================================================
   ALBUKHR EXTERNAL PROJECT REVIEWS ENGINE v1
   SUPABASE
   =========================================================

   TABLES:
   1) external_project_reviews
   2) external_project_review_history

   DEPENDS ON:
   - js/supabase-core.js
   - js/external-project-engine.js

   PURPOSE:
   - Create project reviews
   - Update reviews
   - Approve / reject reviews
   - Review history
   - Fetch project reviews
   - Fetch user's reviews
   - Calculate review statistics
   - Full admin review snapshot
   ========================================================= */


/* =========================================================
   TABLE CONFIG
========================================================= */

const EXTERNAL_REVIEWS_TABLE =
  "external_project_reviews";

const EXTERNAL_REVIEW_HISTORY_TABLE =
  "external_project_review_history";


/* =========================================================
   SUPABASE CLIENT
========================================================= */

function getExternalReviewsSupabase(){

  if(
    typeof window.getAlbukhrSupabaseClient ===
    "function"
  ){

    const client =
      window.getAlbukhrSupabaseClient();

    if(client){
      return client;
    }

  }

  if(window.albukhrSupabase){
    return window.albukhrSupabase;
  }

  console.warn(
    "External Reviews Engine: Supabase client unavailable."
  );

  return null;

}


/* =========================================================
   SAFE HELPERS
========================================================= */

function externalReviewNumber(
  value,
  fallback = 0
){

  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : fallback;

}


function externalReviewString(
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


function externalReviewNow(){

  return new Date().toISOString();

}


/* =========================================================
   PROJECT ENGINE CHECK
========================================================= */

function assertExternalReviewDependencies(){

  if(
    typeof getExternalProject !==
    "function" &&
    typeof getExternalProjectByCode !==
    "function"
  ){

    console.warn(
      "external-project-engine.js should be loaded before external-project-reviews-engine.js"
    );

  }

}


/* =========================================================
   PROJECT LOOKUP
========================================================= */

async function getReviewProject(
  projectCode
){

  assertExternalReviewDependencies();

  if(!projectCode){
    return null;
  }

  try{

    if(
      typeof getExternalProjectByCode ===
      "function"
    ){

      const project =
        await getExternalProjectByCode(
          projectCode
        );

      if(project){
        return project;
      }

    }

  }catch(e){

    console.warn(
      "getExternalProjectByCode failed:",
      e
    );

  }

  try{

    if(
      typeof getExternalProject ===
      "function"
    ){

      const project =
        await getExternalProject(
          projectCode
        );

      if(project){
        return project;
      }

    }

  }catch(e){

    console.warn(
      "getExternalProject failed:",
      e
    );

  }

  return null;

}


/* =========================================================
   NORMALIZE REVIEW
========================================================= */

function normalizeExternalReview(
  row = {}
){

  return {

    id:
      row.id ?? null,

    project_id:
      row.project_id ?? null,

    project_code:
      externalReviewString(
        row.project_code
      ),

    reviewer_userid:
      externalReviewString(
        row.reviewer_userid ||
        row.userid ||
        row.user_id
      ),

    reviewer_username:
      externalReviewString(
        row.reviewer_username ||
        row.username
      ),

    rating:
      externalReviewNumber(
        row.rating,
        0
      ),

    title:
      externalReviewString(
        row.title
      ),

    review:
      externalReviewString(
        row.review ||
        row.comment ||
        row.content
      ),

    status:
      externalReviewString(
        row.status,
        "pending"
      ),

    admin_note:
      externalReviewString(
        row.admin_note
      ),

    approved_at:
      row.approved_at || null,

    rejected_at:
      row.rejected_at || null,

    created_at:
      row.created_at || null,

    updated_at:
      row.updated_at || null,

    raw:
      row

  };

}


/* =========================================================
   NORMALIZE HISTORY
========================================================= */

function normalizeExternalReviewHistory(
  row = {}
){

  return {

    id:
      row.id ?? null,

    review_id:
      row.review_id ?? null,

    project_id:
      row.project_id ?? null,

    project_code:
      externalReviewString(
        row.project_code
      ),

    action:
      externalReviewString(
        row.action
      ),

    old_status:
      externalReviewString(
        row.old_status
      ),

    new_status:
      externalReviewString(
        row.new_status
      ),

    old_rating:
      externalReviewNumber(
        row.old_rating,
        0
      ),

    new_rating:
      externalReviewNumber(
        row.new_rating,
        0
      ),

    actor_userid:
      externalReviewString(
        row.actor_userid
      ),

    actor_username:
      externalReviewString(
        row.actor_username
      ),

    note:
      externalReviewString(
        row.note
      ),

    meta:
      row.meta || {},

    created_at:
      row.created_at || null,

    raw:
      row

  };

}


/* =========================================================
   CREATE REVIEW
========================================================= */

async function createExternalProjectReview({

  projectCode,

  project_id = null,

  reviewer_userid = "",

  reviewer_username = "",

  rating,

  title = "",

  review = "",

  status = "pending",

  meta = {}

} = {}){

  if(!projectCode){

    return {
      error:
        "Project code is required"
    };

  }

  const safeRating =
    externalReviewNumber(
      rating,
      0
    );

  if(
    safeRating < 1 ||
    safeRating > 5
  ){

    return {
      error:
        "Rating must be between 1 and 5"
    };

  }

  if(
    !reviewer_userid
  ){

    return {
      error:
        "Reviewer user ID is required"
    };

  }

  const supabase =
    getExternalReviewsSupabase();

  if(!supabase){

    return {
      error:
        "Supabase client unavailable"
    };

  }

  const project =
    await getReviewProject(
      projectCode
    );

  if(
    !project &&
    typeof getReviewProject !==
    "function"
  ){

    return {
      error:
        "External project not found"
    };

  }

  const payload = {

    project_id:
      project_id ||
      project?.id ||
      null,

    project_code:
      projectCode,

    reviewer_userid:
      reviewer_userid,

    reviewer_username:
      reviewer_username,

    rating:
      safeRating,

    title:
      externalReviewString(title),

    review:
      externalReviewString(review),

    status:
      status || "pending",

    admin_note:
      "",

    created_at:
      externalReviewNow(),

    updated_at:
      externalReviewNow()

  };

  try{

    const {
      data,
      error
    } = await supabase

      .from(
        EXTERNAL_REVIEWS_TABLE
      )

      .insert(payload)

      .select()

      .single();

    if(error){

      return {
        error:
          error.message ||
          "Failed to create external project review"
      };

    }

    const normalized =
      normalizeExternalReview(
        data
      );

    await insertExternalReviewHistory({

      review_id:
        normalized.id,

      project_id:
        normalized.project_id,

      project_code:
        normalized.project_code,

      action:
        "created",

      old_status:
        "",

      new_status:
        normalized.status,

      old_rating:
        0,

      new_rating:
        normalized.rating,

      actor_userid:
        reviewer_userid,

      actor_username:
        reviewer_username,

      note:
        "External project review created",

      meta

    });

    return {

      success:true,

      review:
        normalized

    };

  }catch(e){

    console.error(
      "createExternalProjectReview:",
      e
    );

    return {
      error:
        e?.message ||
        "Review creation failed"
    };

  }

}


/* =========================================================
   GET REVIEW BY ID
========================================================= */

async function getExternalProjectReview(
  reviewId
){

  if(!reviewId){

    return {
      error:
        "Review ID is required"
    };

  }

  const supabase =
    getExternalReviewsSupabase();

  if(!supabase){

    return {
      error:
        "Supabase client unavailable"
    };

  }

  try{

    const {
      data,
      error
    } = await supabase

      .from(
        EXTERNAL_REVIEWS_TABLE
      )

      .select("*")

      .eq(
        "id",
        reviewId
      )

      .maybeSingle();

    if(error){

      return {
        error:
          error.message
      };

    }

    return {

      success:true,

      data:
        data
          ? normalizeExternalReview(data)
          : null

    };

  }catch(e){

    return {
      error:
        e?.message ||
        "Failed to fetch review"
    };

  }

}


/* =========================================================
   GET PROJECT REVIEWS
========================================================= */

async function getExternalProjectReviews(
  projectCode,
  options = {}
){

  if(!projectCode){
    return [];
  }

  const supabase =
    getExternalReviewsSupabase();

  if(!supabase){
    return [];
  }

  const status =
    options.status || null;

  const limit =
    Math.max(
      1,
      externalReviewNumber(
        options.limit,
        100
      )
    );

  try{

    let query =
      supabase

        .from(
          EXTERNAL_REVIEWS_TABLE
        )

        .select("*")

        .eq(
          "project_code",
          projectCode
        )

        .order(
          "created_at",
          {
            ascending:false
          }
        )

        .limit(limit);

    if(status){

      query =
        query.eq(
          "status",
          status
        );

    }

    const {
      data,
      error
    } = await query;

    if(error){

      console.error(
        "getExternalProjectReviews:",
        error
      );

      return [];

    }

    return (
      data || []
    ).map(
      normalizeExternalReview
    );

  }catch(e){

    console.error(e);

    return [];

  }

}


/* =========================================================
   GET APPROVED REVIEWS
========================================================= */

async function getApprovedExternalProjectReviews(
  projectCode,
  limit = 100
){

  return await getExternalProjectReviews(

    projectCode,

    {
      status:"approved",
      limit

    }

  );

}


/* =========================================================
   GET USER REVIEWS
========================================================= */

async function getUserExternalProjectReviews(
  reviewer_userid,
  limit = 100
){

  if(!reviewer_userid){
    return [];
  }

  const supabase =
    getExternalReviewsSupabase();

  if(!supabase){
    return [];
  }

  try{

    const {
      data,
      error
    } = await supabase

      .from(
        EXTERNAL_REVIEWS_TABLE
      )

      .select("*")

      .eq(
        "reviewer_userid",
        reviewer_userid
      )

      .order(
        "created_at",
        {
          ascending:false
        }
      )

      .limit(
        Math.max(
          1,
          externalReviewNumber(
            limit,
            100
          )
        )
      );

    if(error){

      console.error(
        "getUserExternalProjectReviews:",
        error
      );

      return [];

    }

    return (
      data || []
    ).map(
      normalizeExternalReview
    );

  }catch(e){

    console.error(e);

    return [];

  }

}


/* =========================================================
   UPDATE REVIEW
========================================================= */

async function updateExternalProjectReview(
  reviewId,
  patch = {},
  actor = {}
){

  if(!reviewId){

    return {
      error:
        "Review ID is required"
    };

  }

  const supabase =
    getExternalReviewsSupabase();

  if(!supabase){

    return {
      error:
        "Supabase client unavailable"
    };

  }

  const existing =
    await getExternalProjectReview(
      reviewId
    );

  if(existing.error){

    return existing;

  }

  if(!existing.data){

    return {
      error:
        "Review not found"
    };

  }

  const allowed = {

    rating:
      patch.rating,

    title:
      patch.title,

    review:
      patch.review,

    admin_note:
      patch.admin_note,

    status:
      patch.status,

    updated_at:
      externalReviewNow()

  };

  Object.keys(allowed).forEach(
    key => {

      if(
        allowed[key] ===
        undefined
      ){

        delete allowed[key];

      }

    }
  );

  if(
    allowed.rating !==
    undefined
  ){

    const rating =
      externalReviewNumber(
        allowed.rating,
        0
      );

    if(
      rating < 1 ||
      rating > 5
    ){

      return {
        error:
          "Rating must be between 1 and 5"
      };

    }

    allowed.rating =
      rating;

  }

  try{

    const {
      data,
      error
    } = await supabase

      .from(
        EXTERNAL_REVIEWS_TABLE
      )

      .update(
        allowed
      )

      .eq(
        "id",
        reviewId
      )

      .select()

      .single();

    if(error){

      return {
        error:
          error.message
      };

    }

    const updated =
      normalizeExternalReview(
        data
      );

    await insertExternalReviewHistory({

      review_id:
        updated.id,

      project_id:
        updated.project_id,

      project_code:
        updated.project_code,

      action:
        "updated",

      old_status:
        existing.data.status,

      new_status:
        updated.status,

      old_rating:
        existing.data.rating,

      new_rating:
        updated.rating,

      actor_userid:
        actor.actor_userid || "",

      actor_username:
        actor.actor_username || "",

      note:
        actor.note ||
        "External project review updated",

      meta:
        actor.meta || {}

    });

    return {

      success:true,

      review:
        updated

    };

  }catch(e){

    return {
      error:
        e?.message ||
        "Review update failed"
    };

  }

}


/* =========================================================
   APPROVE REVIEW
========================================================= */

async function approveExternalProjectReview(
  reviewId,
  actor = {}
){

  const existing =
    await getExternalProjectReview(
      reviewId
    );

  if(existing.error){
    return existing;
  }

  if(!existing.data){

    return {
      error:
        "Review not found"
    };

  }

  return await updateExternalProjectReview(

    reviewId,

    {

      status:
        "approved",

      admin_note:
        actor.note ||
        ""

    },

    {

      ...actor,

      note:
        actor.note ||
        "External project review approved"

    }

  );

}


/* =========================================================
   REJECT REVIEW
========================================================= */

async function rejectExternalProjectReview(
  reviewId,
  actor = {}
){

  const existing =
    await getExternalProjectReview(
      reviewId
    );

  if(existing.error){
    return existing;
  }

  if(!existing.data){

    return {
      error:
        "Review not found"
    };

  }

  return await updateExternalProjectReview(

    reviewId,

    {

      status:
        "rejected",

      admin_note:
        actor.note ||
        ""

    },

    {

      ...actor,

      note:
        actor.note ||
        "External project review rejected"

    }

  );

}


/* =========================================================
   DELETE REVIEW
========================================================= */

async function deleteExternalProjectReview(
  reviewId,
  actor = {}
){

  if(!reviewId){

    return {
      error:
        "Review ID is required"
    };

  }

  const supabase =
    getExternalReviewsSupabase();

  if(!supabase){

    return {
      error:
        "Supabase client unavailable"
    };

  }

  const existing =
    await getExternalProjectReview(
      reviewId
    );

  if(existing.error){
    return existing;
  }

  if(!existing.data){

    return {
      error:
        "Review not found"
    };

  }

  try{

    const {
      error
    } = await supabase

      .from(
        EXTERNAL_REVIEWS_TABLE
      )

      .delete()

      .eq(
        "id",
        reviewId
      );

    if(error){

      return {
        error:
          error.message
      };

    }

    await insertExternalReviewHistory({

      review_id:
        existing.data.id,

      project_id:
        existing.data.project_id,

      project_code:
        existing.data.project_code,

      action:
        "deleted",

      old_status:
        existing.data.status,

      new_status:
        "deleted",

      old_rating:
        existing.data.rating,

      new_rating:
        0,

      actor_userid:
        actor.actor_userid || "",

      actor_username:
        actor.actor_username || "",

      note:
        actor.note ||
        "External project review deleted",

      meta:
        actor.meta || {}

    });

    return {
      success:true,
      deleted:true,
      review_id:reviewId
    };

  }catch(e){

    return {
      error:
        e?.message ||
        "Review deletion failed"
    };

  }

}


/* =========================================================
   INSERT REVIEW HISTORY
========================================================= */

async function insertExternalReviewHistory({

  review_id = null,

  project_id = null,

  project_code = "",

  action = "",

  old_status = "",

  new_status = "",

  old_rating = 0,

  new_rating = 0,

  actor_userid = "",

  actor_username = "",

  note = "",

  meta = {}

} = {}){

  const supabase =
    getExternalReviewsSupabase();

  if(!supabase){

    return {
      error:
        "Supabase client unavailable"
    };

  }

  const payload = {

    review_id,

    project_id,

    project_code,

    action,

    old_status,

    new_status,

    old_rating:
      externalReviewNumber(
        old_rating
      ),

    new_rating:
      externalReviewNumber(
        new_rating
      ),

    actor_userid,

    actor_username,

    note,

    meta,

    created_at:
      externalReviewNow()

  };

  try{

    const {
      data,
      error
    } = await supabase

      .from(
        EXTERNAL_REVIEW_HISTORY_TABLE
      )

      .insert(payload)

      .select()

      .single();

    if(error){

      console.warn(
        "Review history insert warning:",
        error.message
      );

      return {
        error:
          error.message
      };

    }

    return {

      success:true,

      data:
        normalizeExternalReviewHistory(
          data
        )

    };

  }catch(e){

    console.warn(
      "Review history failed:",
      e
    );

    return {
      error:
        e?.message ||
        "History insert failed"
    };

  }

}


/* =========================================================
   GET REVIEW HISTORY
========================================================= */

async function getExternalProjectReviewHistory(
  reviewId,
  limit = 100
){

  if(!reviewId){
    return [];
  }

  const supabase =
    getExternalReviewsSupabase();

  if(!supabase){
    return [];
  }

  try{

    const {
      data,
      error
    } = await supabase

      .from(
        EXTERNAL_REVIEW_HISTORY_TABLE
      )

      .select("*")

      .eq(
        "review_id",
        reviewId
      )

      .order(
        "created_at",
        {
          ascending:false
        }
      )

      .limit(
        Math.max(
          1,
          externalReviewNumber(
            limit,
            100
          )
        )
      );

    if(error){

      console.error(
        "getExternalProjectReviewHistory:",
        error
      );

      return [];

    }

    return (
      data || []
    ).map(
      normalizeExternalReviewHistory
    );

  }catch(e){

    console.error(e);

    return [];

  }

}


/* =========================================================
   PROJECT REVIEW STATISTICS
========================================================= */

async function getExternalProjectReviewStats(
  projectCode
){

  const reviews =
    await getApprovedExternalProjectReviews(
      projectCode,
      1000
    );

  let total = 0;

  let sum = 0;

  const distribution = {

    1:0,
    2:0,
    3:0,
    4:0,
    5:0

  };

  reviews.forEach(
    row => {

      const rating =
        Math.round(
          externalReviewNumber(
            row.rating,
            0
          )
        );

      if(
        rating >= 1 &&
        rating <= 5
      ){

        total += 1;

        sum += rating;

        distribution[rating] += 1;

      }

    }
  );

  const average =
    total > 0
      ? sum / total
      : 0;

  return {

    success:true,

    project_code:
      projectCode,

    total_reviews:
      total,

    average_rating:
      Math.round(
        average * 100
      ) / 100,

    rating_distribution:
      distribution

  };

}


/* =========================================================
   FULL PROJECT REVIEW SNAPSHOT
========================================================= */

async function getExternalProjectReviewSnapshot(
  projectCode
){

  if(!projectCode){

    return {
      error:
        "Project code is required"
    };

  }

  const project =
    await getReviewProject(
      projectCode
    );

  const reviews =
    await getExternalProjectReviews(
      projectCode
    );

  const approved =
    reviews.filter(
      r =>
        r.status ===
        "approved"
    );

  const pending =
    reviews.filter(
      r =>
        r.status ===
        "pending"
    );

  const rejected =
    reviews.filter(
      r =>
        r.status ===
        "rejected"
    );

  const stats =
    await getExternalProjectReviewStats(
      projectCode
    );

  return {

    success:true,

    project,

    project_code:
      projectCode,

    reviews,

    approved_reviews:
      approved,

    pending_reviews:
      pending,

    rejected_reviews:
      rejected,

    statistics:
      stats

  };

}


/* =========================================================
   GLOBAL REVIEW SUMMARY
========================================================= */

async function getExternalReviewEngineSummary(){

  const supabase =
    getExternalReviewsSupabase();

  if(!supabase){

    return {
      error:
        "Supabase client unavailable"
    };

  }

  try{

    const {
      data,
      error
    } = await supabase

      .from(
        EXTERNAL_REVIEWS_TABLE
      )

      .select(
        "id,project_code,rating,status,created_at"
      );

    if(error){

      return {
        error:
          error.message
      };

    }

    const rows =
      data || [];

    return {

      success:true,

      total_reviews:
        rows.length,

      pending:
        rows.filter(
          r =>
            r.status ===
            "pending"
        ).length,

      approved:
        rows.filter(
          r =>
            r.status ===
            "approved"
        ).length,

      rejected:
        rows.filter(
          r =>
            r.status ===
            "rejected"
        ).length,

      average_rating:
        rows.length
          ? Math.round(
              (
                rows.reduce(
                  (
                    sum,
                    r
                  ) =>
                    sum +
                    externalReviewNumber(
                      r.rating
                    ),
                  0
                ) /
                rows.length
              ) * 100
            ) / 100
          : 0

    };

  }catch(e){

    return {
      error:
        e?.message ||
        "Review engine summary failed"
    };

  }

}


/* =========================================================
   GLOBAL EXPORTS
========================================================= */

window.createExternalProjectReview =
  createExternalProjectReview;

window.getExternalProjectReview =
  getExternalProjectReview;

window.getExternalProjectReviews =
  getExternalProjectReviews;

window.getApprovedExternalProjectReviews =
  getApprovedExternalProjectReviews;

window.getUserExternalProjectReviews =
  getUserExternalProjectReviews;

window.updateExternalProjectReview =
  updateExternalProjectReview;

window.approveExternalProjectReview =
  approveExternalProjectReview;

window.rejectExternalProjectReview =
  rejectExternalProjectReview;

window.deleteExternalProjectReview =
  deleteExternalProjectReview;

window.insertExternalReviewHistory =
  insertExternalReviewHistory;

window.getExternalProjectReviewHistory =
  getExternalProjectReviewHistory;

window.getExternalProjectReviewStats =
  getExternalProjectReviewStats;

window.getExternalProjectReviewSnapshot =
  getExternalProjectReviewSnapshot;

window.getExternalReviewEngineSummary =
  getExternalReviewEngineSummary;
