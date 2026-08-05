/* =========================================
   ALBUKHR EXTERNAL PROJECT MEDIA ENGINE
   PART 1 - FOUNDATION
   Mainnet Ready
========================================= */

const EXTERNAL_MEDIA_TABLE =
"external_project_media";

const EXTERNAL_MEDIA_BUCKET =
"external-project-media";

/* =========================================
SUPABASE
========================================= */

function getExternalMediaSupabase(){

    if(typeof getAlbukhrSupabaseClient==="function"){

        return getAlbukhrSupabaseClient();

    }

    if(window.albukhrSupabase){

        return window.albukhrSupabase;

    }

    return null;

}

/* =========================================
ASSERT
========================================= */

function assertExternalMediaDependencies(){

    if(typeof getExternalProject!=="function"){

        throw new Error(

        "external-project-engine.js required"

        );

    }

}

/* =========================================
HELPERS
========================================= */

function mediaSafeString(

value,

fallback=""

){

    if(value===null||

       value===undefined){

        return fallback;

    }

    return String(value);

}

function mediaSafeNumber(

value,

fallback=0

){

    const n =
    Number(value);

    return Number.isFinite(n)

    ? n

    : fallback;

}

function mediaNow(){

    return new Date()

    .toISOString();

}

/* =========================================
MEDIA TYPES
========================================= */

const MEDIA_TYPES={

    COVER:"cover",

    LOGO:"logo",

    IMAGE:"image",

    GALLERY:"gallery",

    VIDEO:"video",

    DRONE:"drone",

    DOCUMENT_PREVIEW:
    "document_preview",

    BANNER:"banner",

    OTHER:"other"

};

/* =========================================
VISIBILITY
========================================= */

const MEDIA_VISIBILITY={

    PUBLIC:"public",

    PRIVATE:"private",

    TEAM:"team",

    ADMIN:"admin"

};

/* =========================================
STATUS
========================================= */

const MEDIA_STATUS={

    PENDING:"pending",

    APPROVED:"approved",

    REJECTED:"rejected",

    ARCHIVED:"archived"

};

/* =========================================
NORMALIZE
========================================= */

function normalizeExternalMedia(

row={}

){

    return{

        id:
        row.id||null,

        project_code:
        mediaSafeString(
        row.project_code
        ),

        media_type:
        mediaSafeString(
        row.media_type
        ),

        title:
        mediaSafeString(
        row.title
        ),

        description:
        mediaSafeString(
        row.description
        ),

        file_name:
        mediaSafeString(
        row.file_name
        ),

        file_url:
        mediaSafeString(
        row.file_url
        ),

        thumbnail_url:
        mediaSafeString(
        row.thumbnail_url
        ),

        mime_type:
        mediaSafeString(
        row.mime_type
        ),

        file_size:
        mediaSafeNumber(
        row.file_size
        ),

        visibility:
        mediaSafeString(

        row.visibility,

        MEDIA_VISIBILITY.PUBLIC

        ),

        status:
        mediaSafeString(

        row.status,

        MEDIA_STATUS.PENDING

        ),

        uploaded_by:
        mediaSafeString(
        row.uploaded_by
        ),

        uploaded_by_name:
        mediaSafeString(
        row.uploaded_by_name
        ),

        approved_by:
        mediaSafeString(
        row.approved_by
        ),

        approved_by_name:
        mediaSafeString(
        row.approved_by_name
        ),

        review_note:
        mediaSafeString(
        row.review_note
        ),

        approved_at:
        row.approved_at||null,

        created_at:
        row.created_at||null,

        updated_at:
        row.updated_at||null,

        raw:row

    };

}

/* =========================================
CREATE OBJECT
========================================= */

function createExternalMediaObject(

data={}

){

    return{

        project_code:
        mediaSafeString(
        data.project_code
        ),

        media_type:
        mediaSafeString(

        data.media_type,

        MEDIA_TYPES.IMAGE

        ),

        title:
        mediaSafeString(
        data.title
        ),

        description:
        mediaSafeString(
        data.description
        ),

        file_name:
        mediaSafeString(
        data.file_name
        ),

        file_url:
        mediaSafeString(
        data.file_url
        ),

        thumbnail_url:
        mediaSafeString(
        data.thumbnail_url
        ),

        mime_type:
        mediaSafeString(
        data.mime_type
        ),

        file_size:
        mediaSafeNumber(
        data.file_size
        ),

        visibility:
        mediaSafeString(

        data.visibility,

        MEDIA_VISIBILITY.PUBLIC

        ),

        status:
        mediaSafeString(

        data.status,

        MEDIA_STATUS.PENDING

        ),

        uploaded_by:
        mediaSafeString(
        data.uploaded_by
        ),

        uploaded_by_name:
        mediaSafeString(
        data.uploaded_by_name
        ),

        approved_by:"",
        approved_by_name:"",
        review_note:"",
        approved_at:null,

        created_at:
        mediaNow(),

        updated_at:
        mediaNow()

    };

}

/* =========================================
UPLOAD MEDIA RECORD
========================================= */

async function createExternalMedia(

data={}

){

    assertExternalMediaDependencies();

    const supabase =
    getExternalMediaSupabase();

    if(!supabase){

        return{

            error:"Supabase unavailable"

        };

    }

    const payload =
    createExternalMediaObject(data);

    try{

        const {data:row,error} =

        await supabase

        .from(

            EXTERNAL_MEDIA_TABLE

        )

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

            media:

            normalizeExternalMedia(row)

        };

    }catch(e){

        return{

            error:e.message

        };

    }

}

/* =========================================
GET MEDIA BY ID
========================================= */

async function getExternalMedia(

id

){

    const supabase =
    getExternalMediaSupabase();

    if(!supabase){

        return null;

    }

    try{

        const {data,error} =

        await supabase

        .from(

            EXTERNAL_MEDIA_TABLE

        )

        .select("*")

        .eq("id",id)

        .single();

        if(error){

            return null;

        }

        return normalizeExternalMedia(

            data

        );

    }catch(e){

        return null;

    }

}

/* =========================================
GET PROJECT MEDIA
========================================= */

async function getProjectMedia(

projectCode

){

    const supabase =
    getExternalMediaSupabase();

    if(!supabase){

        return[];

    }

    try{

        const {data,error} =

        await supabase

        .from(

            EXTERNAL_MEDIA_TABLE

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

        );

        if(error){

            return[];

        }

        return(

            data||[]

        ).map(

            normalizeExternalMedia

        );

    }catch(e){

        return[];

    }

}

/* =========================================
GET BY TYPE
========================================= */

async function getProjectMediaByType(

projectCode,

type

){

    const media =

    await getProjectMedia(

        projectCode

    );

    return media.filter(item=>

        item.media_type===type

    );

}

/* =========================================
GET BY STATUS
========================================= */

async function getProjectMediaByStatus(

projectCode,

status

){

    const media =

    await getProjectMedia(

        projectCode

    );

    return media.filter(item=>

        item.status===status

    );

}

/* =========================================
SEARCH MEDIA
========================================= */

async function searchProjectMedia(

projectCode,

keyword=""

){

    keyword =

    mediaSafeString(

        keyword

    )

    .toLowerCase()

    .trim();

    if(!keyword){

        return getProjectMedia(

            projectCode

        );

    }

    const media =

    await getProjectMedia(

        projectCode

    );

    return media.filter(item=>{

        return(

            item.title

            .toLowerCase()

            .includes(keyword)

            ||

            item.description

            .toLowerCase()

            .includes(keyword)

            ||

            item.file_name

            .toLowerCase()

            .includes(keyword)

        );

    });

}

/* =========================================
GET COVER IMAGE
========================================= */

async function getProjectCoverImage(

projectCode

){

    const covers =

    await getProjectMediaByType(

        projectCode,

        MEDIA_TYPES.COVER

    );

    return covers.length

    ? covers[0]

    : null;

}

/* =========================================
GET PROJECT LOGO
========================================= */

async function getProjectLogo(

projectCode

){

    const logos =

    await getProjectMediaByType(

        projectCode,

        MEDIA_TYPES.LOGO

    );

    return logos.length

    ? logos[0]

    : null;

}

/* =========================================
EXPORTS
========================================= */

window.createExternalMedia =
createExternalMedia;

window.getExternalMedia =
getExternalMedia;

window.getProjectMedia =
getProjectMedia;

window.getProjectMediaByType =
getProjectMediaByType;

window.getProjectMediaByStatus =
getProjectMediaByStatus;

window.searchProjectMedia =
searchProjectMedia;

window.getProjectCoverImage =
getProjectCoverImage;

window.getProjectLogo =
getProjectLogo;

/* =========================================
UPDATE MEDIA
========================================= */

async function updateExternalMedia(

id,

updates={}

){

    const supabase =
    getExternalMediaSupabase();

    if(!supabase){

        return{

            error:"Supabase unavailable"

        };

    }

    updates.updated_at =
    mediaNow();

    try{

        const {data,error}=

        await supabase

        .from(
            EXTERNAL_MEDIA_TABLE
        )

        .update(updates)

        .eq("id",id)

        .select()

        .single();

        if(error){

            return{

                error:error.message

            };

        }

        return{

            success:true,

            media:
            normalizeExternalMedia(data)

        };

    }catch(e){

        return{

            error:e.message

        };

    }

}

/* =========================================
APPROVE
========================================= */

async function approveExternalMedia(

id,

admin={},

note=""

){

    return updateExternalMedia(

        id,

        {

            status:
            MEDIA_STATUS.APPROVED,

            approved_by:
            admin.uid||"",

            approved_by_name:
            admin.name||"",

            review_note:
            note,

            approved_at:
            mediaNow()

        }

    );

}

/* =========================================
REJECT
========================================= */

async function rejectExternalMedia(

id,

admin={},

note=""

){

    return updateExternalMedia(

        id,

        {

            status:
            MEDIA_STATUS.REJECTED,

            approved_by:
            admin.uid||"",

            approved_by_name:
            admin.name||"",

            review_note:
            note,

            approved_at:
            mediaNow()

        }

    );

}

/* =========================================
ARCHIVE
========================================= */

async function archiveExternalMedia(

id

){

    return updateExternalMedia(

        id,

        {

            status:
            MEDIA_STATUS.ARCHIVED

        }

    );

}

/* =========================================
RESTORE
========================================= */

async function restoreExternalMedia(

id

){

    return updateExternalMedia(

        id,

        {

            status:
            MEDIA_STATUS.APPROVED

        }

    );

}

/* =========================================
DELETE
========================================= */

async function deleteExternalMedia(

id

){

    const supabase =
    getExternalMediaSupabase();

    if(!supabase){

        return{

            error:"Supabase unavailable"

        };

    }

    try{

        const media =
        await getExternalMedia(id);

        if(!media){

            return{

                error:"Media not found"

            };

        }

        /* Delete Storage File */

        if(media.file_name){

            await supabase

            .storage

            .from(

                EXTERNAL_MEDIA_BUCKET

            )

            .remove([

                media.file_name

            ]);

        }

        /* Delete Record */

        const {error}=

        await supabase

        .from(

            EXTERNAL_MEDIA_TABLE

        )

        .delete()

        .eq("id",id);

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
REPLACE FILE
========================================= */

async function replaceExternalMediaFile(

id,

fileUrl,

fileName,

fileSize,

mimeType

){

    return updateExternalMedia(

        id,

        {

            file_url:fileUrl,

            file_name:fileName,

            file_size:fileSize,

            mime_type:mimeType

        }

    );

}

/* =========================================
UPDATE THUMBNAIL
========================================= */

async function updateMediaThumbnail(

id,

thumbnail

){

    return updateExternalMedia(

        id,

        {

            thumbnail_url:
            thumbnail

        }

    );

}

/* =========================================
EXPORTS
========================================= */

window.updateExternalMedia =
updateExternalMedia;

window.approveExternalMedia =
approveExternalMedia;

window.rejectExternalMedia =
rejectExternalMedia;

window.archiveExternalMedia =
archiveExternalMedia;

window.restoreExternalMedia =
restoreExternalMedia;

window.deleteExternalMedia =
deleteExternalMedia;

window.replaceExternalMediaFile =
replaceExternalMediaFile;

window.updateMediaThumbnail =
updateMediaThumbnail;

/* =========================================
   FEATURED MEDIA
========================================= */

async function getFeaturedProjectMedia(projectCode){

    const media =
    await getProjectMedia(projectCode);

    return media.filter(item=>{

        return(

            item.status===MEDIA_STATUS.APPROVED &&

            (
                item.media_type===MEDIA_TYPES.COVER ||

                item.media_type===MEDIA_TYPES.BANNER ||

                item.media_type===MEDIA_TYPES.LOGO
            )

        );

    });

}

/* =========================================
   GALLERY
========================================= */

async function getProjectGallery(projectCode){

    const media =
    await getProjectMedia(projectCode);

    return media.filter(item=>{

        return(

            item.status===MEDIA_STATUS.APPROVED &&

            (

                item.media_type===MEDIA_TYPES.IMAGE ||

                item.media_type===MEDIA_TYPES.GALLERY ||

                item.media_type===MEDIA_TYPES.DRONE ||

                item.media_type===MEDIA_TYPES.VIDEO

            )

        );

    });

}

/* =========================================
   DASHBOARD SUMMARY
========================================= */

async function getProjectMediaSummary(projectCode){

    const media =
    await getProjectMedia(projectCode);

    return{

        total:

        media.length,

        approved:

        media.filter(m=>

            m.status===MEDIA_STATUS.APPROVED

        ).length,

        pending:

        media.filter(m=>

            m.status===MEDIA_STATUS.PENDING

        ).length,

        rejected:

        media.filter(m=>

            m.status===MEDIA_STATUS.REJECTED

        ).length,

        archived:

        media.filter(m=>

            m.status===MEDIA_STATUS.ARCHIVED

        ).length

    };

}

/* =========================================
   TYPE SUMMARY
========================================= */

async function getProjectMediaTypeSummary(

projectCode

){

    const media =
    await getProjectMedia(projectCode);

    const summary={};

    media.forEach(item=>{

        if(!summary[item.media_type]){

            summary[item.media_type]=0;

        }

        summary[item.media_type]++;

    });

    return summary;

}

/* =========================================
   STORAGE SIZE
========================================= */

async function getProjectMediaStorageSize(

projectCode

){

    const media =
    await getProjectMedia(projectCode);

    let total=0;

    media.forEach(item=>{

        total +=

        mediaSafeNumber(

            item.file_size

        );

    });

    return total;

}

/* =========================================
   DUPLICATE CHECK
========================================= */

async function mediaExists(

projectCode,

fileName

){

    const media =
    await getProjectMedia(projectCode);

    return media.some(item=>{

        return(

            item.file_name===fileName

        );

    });

}

/* =========================================
   LAST MEDIA
========================================= */

async function getLatestProjectMedia(

projectCode,

limit=10

){

    const media =
    await getProjectMedia(projectCode);

    return media.slice(

        0,

        limit

    );

}

/* =========================================
   APPROVED MEDIA ONLY
========================================= */

async function getApprovedProjectMedia(

projectCode

){

    return getProjectMediaByStatus(

        projectCode,

        MEDIA_STATUS.APPROVED

    );

}

/* =========================================
   PUBLIC GALLERY
========================================= */

async function getPublicGallery(

projectCode

){

    const media =
    await getApprovedProjectMedia(

        projectCode

    );

    return media.filter(item=>{

        return(

            item.visibility===

            MEDIA_VISIBILITY.PUBLIC

        );

    });

}

/* =========================================
   DASHBOARD COUNTERS
========================================= */

async function getExternalMediaCounters(){

    const supabase =
    getExternalMediaSupabase();

    if(!supabase){

        return null;

    }

    try{

        const {count}=

        await supabase

        .from(

            EXTERNAL_MEDIA_TABLE

        )

        .select(

            "*",

            {

                count:"exact",

                head:true

            }

        );

        return{

            total:

            count||0

        };

    }catch(e){

        return null;

    }

}

/* =========================================
   EXPORTS
========================================= */

window.getFeaturedProjectMedia =
getFeaturedProjectMedia;

window.getProjectGallery =
getProjectGallery;

window.getProjectMediaSummary =
getProjectMediaSummary;

window.getProjectMediaTypeSummary =
getProjectMediaTypeSummary;

window.getProjectMediaStorageSize =
getProjectMediaStorageSize;

window.mediaExists =
mediaExists;

window.getLatestProjectMedia =
getLatestProjectMedia;

window.getApprovedProjectMedia =
getApprovedProjectMedia;

window.getPublicGallery =
getPublicGallery;

window.getExternalMediaCounters =
getExternalMediaCounters;
