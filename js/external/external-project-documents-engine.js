/* =========================================
   ALBUKHR EXTERNAL PROJECT DOCUMENTS ENGINE
   v1 MAINNET READY
========================================= */

/*
TABLE:
external_project_documents

DEPENDENCIES:
- supabase-core.js
- external-project-engine.js

OPTIONAL:
- external-project-activity-engine.js
*/

/* =========================================
TABLE
========================================= */

const EXTERNAL_DOCUMENTS_TABLE =
"external_project_documents";

/* =========================================
SUPPORTED DOCUMENT TYPES
========================================= */

const DOCUMENT_TYPES = [

"business_registration",

"cac_certificate",

"tin_certificate",

"tax_clearance",

"company_profile",

"whitepaper",

"project_proposal",

"feasibility_study",

"financial_statement",

"bank_statement",

"government_license",

"environmental_certificate",

"insurance",

"kyc",

"wallet_verification",

"passport",

"national_id",

"utility_bill",

"agreement",

"other"

];

/* =========================================
DOCUMENT STATUS
========================================= */

const DOCUMENT_STATUS = [

"pending",

"approved",

"rejected",

"expired",

"archived"

];

/* =========================================
HELPERS
========================================= */

function documentSafeString(value){

    if(value===null ||
       value===undefined){

        return "";

    }

    return String(value).trim();

}

function documentSafeNumber(value){

    const n = Number(value);

    return Number.isFinite(n)

    ? n

    : 0;

}

function documentNow(){

    return new Date().toISOString();

}

/* =========================================
SUPABASE
========================================= */

function getExternalDocumentSupabase(){

    if(

        typeof

        getAlbukhrSupabaseClient

        ===

        "function"

    ){

        return

        getAlbukhrSupabaseClient();

    }

    if(window.albukhrSupabase){

        return

        window.albukhrSupabase;

    }

    return null;

}

/* =========================================
DEPENDENCIES
========================================= */

function assertExternalDocumentDependencies(){

    if(

        typeof

        getExternalProject

        !==

        "function"

    ){

        throw new Error(

        "external-project-engine.js required"

        );

    }

}

/* =========================================
NORMALIZE
========================================= */

function normalizeExternalDocument(doc={}){

    return{

        id:

        doc.id || "",

        project_code:

        documentSafeString(

        doc.project_code

        ),

        document_code:

        documentSafeString(

        doc.document_code

        ),

        title:

        documentSafeString(

        doc.title

        ),

        description:

        documentSafeString(

        doc.description

        ),

        document_type:

        documentSafeString(

        doc.document_type

        ),

        file_name:

        documentSafeString(

        doc.file_name

        ),

        file_url:

        documentSafeString(

        doc.file_url

        ),

        storage_path:

        documentSafeString(

        doc.storage_path

        ),

        mime_type:

        documentSafeString(

        doc.mime_type

        ),

        extension:

        documentSafeString(

        doc.extension

        ),

        file_size:

        documentSafeNumber(

        doc.file_size

        ),

        checksum:

        documentSafeString(

        doc.checksum

        ),

        uploaded_by:

        documentSafeString(

        doc.uploaded_by

        ),

        uploaded_by_name:

        documentSafeString(

        doc.uploaded_by_name

        ),

        status:

        documentSafeString(

        doc.status ||

        "pending"

        ),

        review_note:

        documentSafeString(

        doc.review_note

        ),

        reviewed_by:

        documentSafeString(

        doc.reviewed_by

        ),

        reviewed_at:

        doc.reviewed_at ||

        null,

        expires_at:

        doc.expires_at ||

        null,

        created_at:

        doc.created_at ||

        null,

        updated_at:

        doc.updated_at ||

        null

    };

}

/* =========================================
CREATE OBJECT
========================================= */

function createExternalDocumentObject(

data={}

){

    return{

        project_code:

        documentSafeString(

        data.project_code

        ),

        document_code:

        crypto.randomUUID(),

        title:

        documentSafeString(

        data.title

        ),

        description:

        documentSafeString(

        data.description

        ),

        document_type:

        documentSafeString(

        data.document_type ||

        "other"

        ),

        file_name:

        documentSafeString(

        data.file_name

        ),

        file_url:

        documentSafeString(

        data.file_url

        ),

        storage_path:

        documentSafeString(

        data.storage_path

        ),

        mime_type:

        documentSafeString(

        data.mime_type

        ),

        extension:

        documentSafeString(

        data.extension

        ),

        file_size:

        documentSafeNumber(

        data.file_size

        ),

        checksum:

        documentSafeString(

        data.checksum

        ),

        uploaded_by:

        documentSafeString(

        data.uploaded_by

        ),

        uploaded_by_name:

        documentSafeString(

        data.uploaded_by_name

        ),

        status:

        "pending",

        review_note:"",

        reviewed_by:"",

        reviewed_at:null,

        expires_at:

        data.expires_at ||

        null,

        created_at:

        documentNow(),

        updated_at:

        documentNow()

    };

  }
/* =========================================
UPLOAD / CREATE DOCUMENT
========================================= */

async function createExternalDocument(data={}){

    assertExternalDocumentDependencies();

    const supabase =
    getExternalDocumentSupabase();

    if(!supabase){

        return{
            error:"Supabase unavailable"
        };

    }

    const document =
    createExternalDocumentObject(data);

    const project =
    await getExternalProject(
        document.project_code
    );

    if(!project){

        return{
            error:"Project not found"
        };

    }

    try{

        const {data:row,error} =
        await supabase
        .from(
            EXTERNAL_DOCUMENTS_TABLE
        )
        .insert(document)
        .select()
        .single();

        if(error){

            return{
                error:error.message
            };

        }

        return{

            success:true,

            document:
            normalizeExternalDocument(row)

        };

    }catch(e){

        return{

            error:e.message

        };

    }

}

/* =========================================
GET DOCUMENT
========================================= */

async function getExternalDocument(id){

    const supabase =
    getExternalDocumentSupabase();

    if(!supabase){

        return null;

    }

    try{

        const {data,error} =
        await supabase
        .from(
            EXTERNAL_DOCUMENTS_TABLE
        )
        .select("*")
        .eq("id",id)
        .maybeSingle();

        if(error){

            return null;

        }

        if(!data){

            return null;

        }

        return normalizeExternalDocument(data);

    }catch(e){

        return null;

    }

}

/* =========================================
GET PROJECT DOCUMENTS
========================================= */

async function getProjectDocuments(

projectCode

){

    const supabase =
    getExternalDocumentSupabase();

    if(!supabase){

        return [];

    }

    try{

        const {data,error} =
        await supabase
        .from(
            EXTERNAL_DOCUMENTS_TABLE
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

            return [];

        }

        return (data||[])

        .map(

            normalizeExternalDocument

        );

    }catch(e){

        return [];

    }

}

/* =========================================
GET DOCUMENTS BY TYPE
========================================= */

async function getDocumentsByType(

projectCode,

type

){

    const docs =
    await getProjectDocuments(
        projectCode
    );

    type =
    documentSafeString(type)
    .toLowerCase();

    return docs.filter(doc=>

        doc.document_type
        .toLowerCase()

        ===

        type

    );

}

/* =========================================
SEARCH DOCUMENTS
========================================= */

async function searchProjectDocuments(

projectCode,

keyword=""

){

    const docs =
    await getProjectDocuments(
        projectCode
    );

    keyword =
    documentSafeString(keyword)
    .toLowerCase();

    if(!keyword){

        return docs;

    }

    return docs.filter(doc=>{

        return(

        doc.title
        .toLowerCase()
        .includes(keyword)

        ||

        doc.description
        .toLowerCase()
        .includes(keyword)

        ||

        doc.document_type
        .toLowerCase()
        .includes(keyword)

        ||

        doc.file_name
        .toLowerCase()
        .includes(keyword)

        );

    });

}

/* =========================================
GET DOCUMENTS BY STATUS
========================================= */

async function getDocumentsByStatus(

projectCode,

status

){

    const docs =
    await getProjectDocuments(
        projectCode
    );

    status =
    documentSafeString(status)
    .toLowerCase();

    return docs.filter(doc=>

        doc.status
        .toLowerCase()

        ===

        status

    );

}

/* =========================================
EXPORTS
========================================= */

window.createExternalDocument =
createExternalDocument;

window.getExternalDocument =
getExternalDocument;

window.getProjectDocuments =
getProjectDocuments;

window.getDocumentsByType =
getDocumentsByType;

window.searchProjectDocuments =
searchProjectDocuments;

window.getDocumentsByStatus =
getDocumentsByStatus;

/* =========================================
UPDATE DOCUMENT
========================================= */

async function updateExternalDocument(

id,

updates={}

){

    const supabase =
    getExternalDocumentSupabase();

    if(!supabase){

        return{

            error:"Supabase unavailable"

        };

    }

    updates.updated_at =
    documentNow();

    try{

        const {data,error} =
        await supabase
        .from(
            EXTERNAL_DOCUMENTS_TABLE
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

            document:
            normalizeExternalDocument(data)

        };

    }catch(e){

        return{

            error:e.message

        };

    }

}

/* =========================================
APPROVE DOCUMENT
========================================= */

async function approveExternalDocument(

id,

adminId="",

adminName="",

note=""

){

    return await updateExternalDocument(

        id,

        {

            status:"approved",

            reviewed_by:adminId,

            reviewed_by_name:adminName,

            review_note:note,

            reviewed_at:documentNow()

        }

    );

}

/* =========================================
REJECT DOCUMENT
========================================= */

async function rejectExternalDocument(

id,

adminId="",

adminName="",

note=""

){

    return await updateExternalDocument(

        id,

        {

            status:"rejected",

            reviewed_by:adminId,

            reviewed_by_name:adminName,

            review_note:note,

            reviewed_at:documentNow()

        }

    );

}

/* =========================================
ARCHIVE DOCUMENT
========================================= */

async function archiveExternalDocument(

id

){

    return await updateExternalDocument(

        id,

        {

            status:"archived"

        }

    );

}

/* =========================================
RESTORE DOCUMENT
========================================= */

async function restoreExternalDocument(

id

){

    return await updateExternalDocument(

        id,

        {

            status:"pending",

            reviewed_by:"",

            reviewed_by_name:"",

            review_note:"",

            reviewed_at:null

        }

    );

}

/* =========================================
DELETE DOCUMENT
========================================= */

async function deleteExternalDocument(

id

){

    const supabase =
    getExternalDocumentSupabase();

    if(!supabase){

        return{

            error:"Supabase unavailable"

        };

    }

    try{

        const {error} =
        await supabase
        .from(
            EXTERNAL_DOCUMENTS_TABLE
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
CHANGE DOCUMENT TYPE
========================================= */

async function changeDocumentType(

id,

type

){

    return await updateExternalDocument(

        id,

        {

            document_type:
            documentSafeString(type)

        }

    );

}

/* =========================================
CHANGE EXPIRY DATE
========================================= */

async function changeDocumentExpiry(

id,

expiresAt

){

    return await updateExternalDocument(

        id,

        {

            expires_at:
            expiresAt

        }

    );

}

/* =========================================
EXPORTS
========================================= */

window.updateExternalDocument =
updateExternalDocument;

window.approveExternalDocument =
approveExternalDocument;

window.rejectExternalDocument =
rejectExternalDocument;

window.archiveExternalDocument =
archiveExternalDocument;

window.restoreExternalDocument =
restoreExternalDocument;

window.deleteExternalDocument =
deleteExternalDocument;

window.changeDocumentType =
changeDocumentType;

window.changeDocumentExpiry =
changeDocumentExpiry;

/* =========================================
DOCUMENT STATISTICS
========================================= */

async function getProjectDocumentStatistics(

projectCode

){

    const docs =
    await getProjectDocuments(projectCode);

    const stats={

        total:0,

        pending:0,

        approved:0,

        rejected:0,

        archived:0,

        expired:0,

        total_size:0

    };

    const now =
    new Date().getTime();

    docs.forEach(doc=>{

        stats.total++;

        stats.total_size +=
        documentSafeNumber(
            doc.file_size
        );

        switch(doc.status){

            case "pending":
            stats.pending++;
            break;

            case "approved":
            stats.approved++;
            break;

            case "rejected":
            stats.rejected++;
            break;

            case "archived":
            stats.archived++;
            break;

        }

        if(

            doc.expires_at

            &&

            new Date(

                doc.expires_at

            ).getTime()

            <

            now

        ){

            stats.expired++;

        }

    });

    return stats;

}

/* =========================================
GET EXPIRED DOCUMENTS
========================================= */

async function getExpiredDocuments(

projectCode

){

    const docs =
    await getProjectDocuments(projectCode);

    const now =
    new Date().getTime();

    return docs.filter(doc=>{

        if(!doc.expires_at)
        return false;

        return (

        new Date(
        doc.expires_at
        ).getTime()

        <

        now

        );

    });

}

/* =========================================
RECENT DOCUMENTS
========================================= */

async function getRecentDocuments(

projectCode,

limit=10

){

    const docs =
    await getProjectDocuments(projectCode);

    return docs.slice(0,limit);

}

/* =========================================
DOCUMENT DASHBOARD
========================================= */

async function getProjectDocumentDashboard(

projectCode

){

    const documents =
    await getProjectDocuments(projectCode);

    const statistics =
    await getProjectDocumentStatistics(

        projectCode

    );

    const recent =
    await getRecentDocuments(

        projectCode,

        10

    );

    const expired =
    await getExpiredDocuments(

        projectCode

    );

    return{

        statistics,

        recent,

        expired,

        documents

    };

}

/* =========================================
GROUP DOCUMENTS
========================================= */

async function groupDocumentsByType(

projectCode

){

    const docs =
    await getProjectDocuments(projectCode);

    const groups={};

    docs.forEach(doc=>{

        const type =
        doc.document_type ||
        "other";

        if(!groups[type]){

            groups[type]=[];

        }

        groups[type].push(doc);

    });

    return groups;

}

/* =========================================
VERIFY REQUIRED DOCUMENTS
========================================= */

async function verifyRequiredDocuments(

projectCode,

requiredTypes=[]

){

    const docs =
    await getProjectDocuments(projectCode);

    const approved =
    docs.filter(doc=>

        doc.status==="approved"

    );

    const existing =
    approved.map(doc=>

        doc.document_type

    );

    const missing=[];

    requiredTypes.forEach(type=>{

        if(

            !existing.includes(type)

        ){

            missing.push(type);

        }

    });

    return{

        verified:

        missing.length===0,

        missing,

        uploaded:

        existing

    };

}

/* =========================================
EXPORTS
========================================= */

window.getProjectDocumentStatistics =
getProjectDocumentStatistics;

window.getExpiredDocuments =
getExpiredDocuments;

window.getRecentDocuments =
getRecentDocuments;

window.getProjectDocumentDashboard =
getProjectDocumentDashboard;

window.groupDocumentsByType =
groupDocumentsByType;

window.verifyRequiredDocuments =
verifyRequiredDocuments;
