/* =========================================
   ALBUKHR EXTERNAL PROJECT COMMENT ENGINE
   PART 1
   Mainnet Ready
========================================= */

/* =========================================
TABLE
========================================= */

const EXTERNAL_COMMENT_TABLE =
"external_project_comments";

/* =========================================
COMMENT STATUS
========================================= */

const COMMENT_STATUS={

ACTIVE:
"active",

HIDDEN:
"hidden",

RESOLVED:
"resolved",

DELETED:
"deleted",

SPAM:
"spam"

};

/* =========================================
COMMENT TYPES
========================================= */

const COMMENT_TYPE={

COMMENT:
"comment",

REPLY:
"reply",

SYSTEM:
"system"

};

/* =========================================
VISIBILITY
========================================= */

const COMMENT_VISIBILITY={

PUBLIC:
"public",

PRIVATE:
"private",

ADMIN:
"admin"

};

/* =========================================
REACTIONS
========================================= */

const COMMENT_REACTION={

LIKE:
"like",

LOVE:
"love",

SUPPORT:
"support"

};

/* =========================================
HELPERS
========================================= */

function commentNow(){

return new Date().toISOString();

}

function commentSafeString(

value,

fallback=""

){

if(

value===null ||

value===undefined

){

return fallback;

}

return String(value);

}

function commentSafeNumber(

value,

fallback=0

){

const n=Number(value);

return Number.isFinite(n)

?n

:fallback;

}

/* =========================================
SUPABASE
========================================= */

function getExternalCommentSupabase(){

if(

typeof

window.getAlbukhrSupabaseClient

==="function"

){

return

window

.getAlbukhrSupabaseClient();

}

if(

window.albukhrSupabase

){

return

window.albukhrSupabase;

}

return null;

}

/* =========================================
DEPENDENCIES
========================================= */

function assertCommentDependencies(){

if(

!getExternalCommentSupabase()

){

throw new Error(

"Supabase client missing"

);

}

}

/* =========================================
NORMALIZE COMMENT
========================================= */

function normalizeExternalComment(

row={}

){

return{

id:
row.id||null,

project_code:
commentSafeString(

row.project_code

),

parent_comment:
row.parent_comment||

null,

comment_type:
commentSafeString(

row.comment_type,

COMMENT_TYPE.COMMENT

),

visibility:
commentSafeString(

row.visibility,

COMMENT_VISIBILITY.PUBLIC

),

status:
commentSafeString(

row.status,

COMMENT_STATUS.ACTIVE

),

author_uid:
commentSafeString(

row.author_uid

),

author_name:
commentSafeString(

row.author_name

),

author_role:
commentSafeString(

row.author_role

),

message:
commentSafeString(

row.message

),

likes:
commentSafeNumber(

row.likes

),

replies:
commentSafeNumber(

row.replies

),

is_pinned:
Boolean(

row.is_pinned

),

is_edited:
Boolean(

row.is_edited

),

edited_at:
row.edited_at||

null,

resolved_by:
commentSafeString(

row.resolved_by

),

resolved_at:
row.resolved_at||

null,

created_at:
row.created_at||

null,

updated_at:
row.updated_at||

null,

raw:row

};

}

/* =========================================
CREATE OBJECT
========================================= */

function createCommentObject(

data={}

){

return{

project_code:

commentSafeString(

data.project_code

),

parent_comment:

data.parent_comment||

null,

comment_type:

commentSafeString(

data.comment_type,

COMMENT_TYPE.COMMENT

),

visibility:

commentSafeString(

data.visibility,

COMMENT_VISIBILITY.PUBLIC

),

status:

COMMENT_STATUS.ACTIVE,

author_uid:

commentSafeString(

data.author_uid

),

author_name:

commentSafeString(

data.author_name

),

author_role:

commentSafeString(

data.author_role

),

message:

commentSafeString(

data.message

),

likes:0,

replies:0,

is_pinned:false,

is_edited:false,

resolved_by:"",

resolved_at:null,

created_at:

commentNow(),

updated_at:

commentNow()

};

}

/* =========================================
VALIDATION
========================================= */

function validateComment(

message

){

message=

commentSafeString(

message

).trim();

if(

message.length<2

){

return{

valid:false,

error:

"Comment is too short"

};

}

if(

message.length>5000

){

return{

valid:false,

error:

"Comment is too long"

};

}

return{

valid:true

};

  }
/* =========================================
CREATE COMMENT
========================================= */

async function createExternalComment(data={}){

    assertCommentDependencies();

    const check =
    validateComment(data.message);

    if(!check.valid){

        return{
            error:check.error
        };

    }

    const supabase =
    getExternalCommentSupabase();

    const payload =
    createCommentObject(data);

    try{

        const {data:row,error}=

        await supabase

        .from(EXTERNAL_COMMENT_TABLE)

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

            comment:
            normalizeExternalComment(row)

        };

    }catch(e){

        return{

            error:e.message

        };

    }

}

/* =========================================
REPLY COMMENT
========================================= */

async function replyExternalComment(

parentId,

data={}

){

    data.parent_comment =
    parentId;

    data.comment_type =
    COMMENT_TYPE.REPLY;

    const result =
    await createExternalComment(data);

    if(result.error){

        return result;

    }

    const supabase =
    getExternalCommentSupabase();

    await supabase.rpc(

        "increment_comment_reply",

        {

            comment_id:parentId

        }

    );

    return result;

}

/* =========================================
EDIT COMMENT
========================================= */

async function editExternalComment(

commentId,

message

){

    const check =
    validateComment(message);

    if(!check.valid){

        return{

            error:check.error

        };

    }

    const supabase =
    getExternalCommentSupabase();

    try{

        const {data,error}=

        await supabase

        .from(EXTERNAL_COMMENT_TABLE)

        .update({

            message,

            is_edited:true,

            edited_at:
            commentNow(),

            updated_at:
            commentNow()

        })

        .eq(

            "id",

            commentId

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

            comment:
            normalizeExternalComment(data)

        };

    }catch(e){

        return{

            error:e.message

        };

    }

}

/* =========================================
DELETE COMMENT
SOFT DELETE
========================================= */

async function deleteExternalComment(

commentId

){

    const supabase =
    getExternalCommentSupabase();

    try{

        const {data,error}=

        await supabase

        .from(EXTERNAL_COMMENT_TABLE)

        .update({

            status:
            COMMENT_STATUS.DELETED,

            updated_at:
            commentNow()

        })

        .eq(

            "id",

            commentId

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

            comment:
            normalizeExternalComment(data)

        };

    }catch(e){

        return{

            error:e.message

        };

    }

}

/* =========================================
GET COMMENT
========================================= */

async function getExternalComment(

commentId

){

    const supabase =
    getExternalCommentSupabase();

    try{

        const {data,error}=

        await supabase

        .from(EXTERNAL_COMMENT_TABLE)

        .select("*")

        .eq(

            "id",

            commentId

        )

        .maybeSingle();

        if(error){

            return null;

        }

        return data

        ?normalizeExternalComment(data)

        :null;

    }catch(e){

        return null;

    }

}

/* =========================================
GET PROJECT COMMENTS
========================================= */

async function getProjectComments(

projectCode

){

    const supabase =
    getExternalCommentSupabase();

    try{

        const {data,error}=

        await supabase

        .from(EXTERNAL_COMMENT_TABLE)

        .select("*")

        .eq(

            "project_code",

            projectCode

        )

        .is(

            "parent_comment",

            null

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

            normalizeExternalComment

        );

    }catch(e){

        return[];

    }

}

/* =========================================
GET REPLIES
========================================= */

async function getCommentReplies(

commentId

){

    const supabase =
    getExternalCommentSupabase();

    try{

        const {data,error}=

        await supabase

        .from(EXTERNAL_COMMENT_TABLE)

        .select("*")

        .eq(

            "parent_comment",

            commentId

        )

        .order(

            "created_at",

            {

                ascending:true

            }

        );

        if(error){

            return[];

        }

        return(

            data||[]

        ).map(

            normalizeExternalComment

        );

    }catch(e){

        return[];

    }

}

/* =========================================
SEARCH COMMENTS
========================================= */

async function searchProjectComments(

projectCode,

keyword

){

    const rows =
    await getProjectComments(

        projectCode

    );

    keyword =
    commentSafeString(keyword)

    .toLowerCase();

    return rows.filter(c=>{

        return(

            c.message

            .toLowerCase()

            .includes(keyword)

            ||

            c.author_name

            .toLowerCase()

            .includes(keyword)

        );

    });

}

/* =========================================
EXPORTS
========================================= */

window.createExternalComment =
createExternalComment;

window.replyExternalComment =
replyExternalComment;

window.editExternalComment =
editExternalComment;

window.deleteExternalComment =
deleteExternalComment;

window.getExternalComment =
getExternalComment;

window.getProjectComments =
getProjectComments;

window.getCommentReplies =
getCommentReplies;

window.searchProjectComments =
searchProjectComments;
/* =========================================
   PIN COMMENT
========================================= */

async function pinExternalComment(commentId){

    const supabase =
    getExternalCommentSupabase();

    try{

        const {data,error}=

        await supabase

        .from(EXTERNAL_COMMENT_TABLE)

        .update({

            is_pinned:true,

            updated_at:
            commentNow()

        })

        .eq("id",commentId)

        .select()

        .single();

        if(error){

            return{
                error:error.message
            };

        }

        return{

            success:true,

            comment:
            normalizeExternalComment(data)

        };

    }catch(e){

        return{
            error:e.message
        };

    }

}

/* =========================================
   UNPIN COMMENT
========================================= */

async function unpinExternalComment(commentId){

    const supabase =
    getExternalCommentSupabase();

    try{

        const {data,error}=

        await supabase

        .from(EXTERNAL_COMMENT_TABLE)

        .update({

            is_pinned:false,

            updated_at:
            commentNow()

        })

        .eq("id",commentId)

        .select()

        .single();

        if(error){

            return{
                error:error.message
            };

        }

        return{

            success:true,

            comment:
            normalizeExternalComment(data)

        };

    }catch(e){

        return{
            error:e.message
        };

    }

}

/* =========================================
   RESOLVE COMMENT
========================================= */

async function resolveExternalComment(

commentId,

adminName="admin"

){

    const supabase =
    getExternalCommentSupabase();

    try{

        const {data,error}=

        await supabase

        .from(EXTERNAL_COMMENT_TABLE)

        .update({

            status:
            COMMENT_STATUS.RESOLVED,

            resolved_by:
            adminName,

            resolved_at:
            commentNow(),

            updated_at:
            commentNow()

        })

        .eq("id",commentId)

        .select()

        .single();

        if(error){

            return{
                error:error.message
            };

        }

        return{

            success:true,

            comment:
            normalizeExternalComment(data)

        };

    }catch(e){

        return{
            error:e.message
        };

    }

}

/* =========================================
   HIDE COMMENT
========================================= */

async function hideExternalComment(commentId){

    const supabase =
    getExternalCommentSupabase();

    try{

        const {data,error}=

        await supabase

        .from(EXTERNAL_COMMENT_TABLE)

        .update({

            status:
            COMMENT_STATUS.HIDDEN,

            updated_at:
            commentNow()

        })

        .eq("id",commentId)

        .select()

        .single();

        if(error){

            return{
                error:error.message
            };

        }

        return{

            success:true,

            comment:
            normalizeExternalComment(data)

        };

    }catch(e){

        return{
            error:e.message
        };

    }

}

/* =========================================
   UNHIDE COMMENT
========================================= */

async function unhideExternalComment(commentId){

    const supabase =
    getExternalCommentSupabase();

    try{

        const {data,error}=

        await supabase

        .from(EXTERNAL_COMMENT_TABLE)

        .update({

            status:
            COMMENT_STATUS.ACTIVE,

            updated_at:
            commentNow()

        })

        .eq("id",commentId)

        .select()

        .single();

        if(error){

            return{
                error:error.message
            };

        }

        return{

            success:true,

            comment:
            normalizeExternalComment(data)

        };

    }catch(e){

        return{
            error:e.message
        };

    }

}

/* =========================================
   MARK AS SPAM
========================================= */

async function markCommentSpam(commentId){

    const supabase =
    getExternalCommentSupabase();

    try{

        const {data,error}=

        await supabase

        .from(EXTERNAL_COMMENT_TABLE)

        .update({

            status:
            COMMENT_STATUS.SPAM,

            updated_at:
            commentNow()

        })

        .eq("id",commentId)

        .select()

        .single();

        if(error){

            return{
                error:error.message
            };

        }

        return{

            success:true,

            comment:
            normalizeExternalComment(data)

        };

    }catch(e){

        return{
            error:e.message
        };

    }

}

/* =========================================
   RESTORE COMMENT
========================================= */

async function restoreExternalComment(commentId){

    const supabase =
    getExternalCommentSupabase();

    try{

        const {data,error}=

        await supabase

        .from(EXTERNAL_COMMENT_TABLE)

        .update({

            status:
            COMMENT_STATUS.ACTIVE,

            updated_at:
            commentNow()

        })

        .eq("id",commentId)

        .select()

        .single();

        if(error){

            return{
                error:error.message
            };

        }

        return{

            success:true,

            comment:
            normalizeExternalComment(data)

        };

    }catch(e){

        return{
            error:e.message
        };

    }

}

/* =========================================
   LIKE COMMENT
========================================= */

async function likeExternalComment(commentId){

    const comment =
    await getExternalComment(commentId);

    if(!comment){

        return{
            error:"Comment not found"
        };

    }

    const supabase =
    getExternalCommentSupabase();

    const likes =
    comment.likes+1;

    const {data,error}=

    await supabase

    .from(EXTERNAL_COMMENT_TABLE)

    .update({

        likes,

        updated_at:
        commentNow()

    })

    .eq("id",commentId)

    .select()

    .single();

    if(error){

        return{
            error:error.message
        };

    }

    return{

        success:true,

        comment:
        normalizeExternalComment(data)

    };

}

/* =========================================
   UNLIKE COMMENT
========================================= */

async function unlikeExternalComment(commentId){

    const comment =
    await getExternalComment(commentId);

    if(!comment){

        return{
            error:"Comment not found"
        };

    }

    const likes =
    Math.max(

        0,

        comment.likes-1

    );

    const supabase =
    getExternalCommentSupabase();

    const {data,error}=

    await supabase

    .from(EXTERNAL_COMMENT_TABLE)

    .update({

        likes,

        updated_at:
        commentNow()

    })

    .eq("id",commentId)

    .select()

    .single();

    if(error){

        return{
            error:error.message
        };

    }

    return{

        success:true,

        comment:
        normalizeExternalComment(data)

    };

}

/* =========================================
   EXPORTS
========================================= */

window.pinExternalComment =
pinExternalComment;

window.unpinExternalComment =
unpinExternalComment;

window.resolveExternalComment =
resolveExternalComment;

window.hideExternalComment =
hideExternalComment;

window.unhideExternalComment =
unhideExternalComment;

window.markCommentSpam =
markCommentSpam;

window.restoreExternalComment =
restoreExternalComment;

window.likeExternalComment =
likeExternalComment;

window.unlikeExternalComment =
unlikeExternalComment;
/* =========================================
   COMMENT STATISTICS
========================================= */

async function getProjectCommentStats(projectCode){

    const comments =
    await getProjectComments(projectCode);

    let totalReplies = 0;
    let totalLikes = 0;
    let active = 0;
    let hidden = 0;
    let spam = 0;
    let resolved = 0;
    let pinned = 0;

    for(const comment of comments){

        totalReplies +=
        comment.reply_count || 0;

        totalLikes +=
        comment.likes || 0;

        if(comment.is_pinned){
            pinned++;
        }

        switch(comment.status){

            case COMMENT_STATUS.ACTIVE:
                active++;
                break;

            case COMMENT_STATUS.HIDDEN:
                hidden++;
                break;

            case COMMENT_STATUS.SPAM:
                spam++;
                break;

            case COMMENT_STATUS.RESOLVED:
                resolved++;
                break;

        }

    }

    return{

        project_code:projectCode,

        total_comments:
        comments.length,

        total_replies:
        totalReplies,

        total_likes:
        totalLikes,

        active,

        hidden,

        spam,

        resolved,

        pinned

    };

}

/* =========================================
   RECENT COMMENTS
========================================= */

async function getRecentProjectComments(

projectCode,

limit=10

){

    const comments =
    await getProjectComments(projectCode);

    return comments

    .sort(

        (a,b)=>

        new Date(b.created_at)

        -

        new Date(a.created_at)

    )

    .slice(0,limit);

}

/* =========================================
   TOP COMMENTS
========================================= */

async function getTopComments(

projectCode,

limit=10

){

    const comments =
    await getProjectComments(projectCode);

    return comments

    .sort(

        (a,b)=>

        (b.likes||0)

        -

        (a.likes||0)

    )

    .slice(0,limit);

}

/* =========================================
   TOP COMMENTERS
========================================= */

async function getTopCommenters(

projectCode

){

    const comments =
    await getProjectComments(projectCode);

    const users={};

    comments.forEach(c=>{

        if(!users[c.author_uid]){

            users[c.author_uid]={

                uid:c.author_uid,

                name:c.author_name,

                comments:0,

                likes:0

            };

        }

        users[c.author_uid]
        .comments++;

        users[c.author_uid]
        .likes += c.likes||0;

    });

    return Object.values(users)

    .sort(

        (a,b)=>

        b.comments-a.comments

    );

}

/* =========================================
   DASHBOARD SUMMARY
========================================= */

async function getProjectCommentDashboard(

projectCode

){

    return{

        stats:

        await getProjectCommentStats(

            projectCode

        ),

        recent:

        await getRecentProjectComments(

            projectCode,

            10

        ),

        top:

        await getTopComments(

            projectCode,

            5

        ),

        users:

        await getTopCommenters(

            projectCode

        )

    };

}

/* =========================================
   PAGINATION
========================================= */

async function paginateComments(

projectCode,

page=1,

size=20

){

    const comments =
    await getProjectComments(projectCode);

    const start =
    (page-1)*size;

    const end =
    start+size;

    return{

        page,

        page_size:size,

        total:
        comments.length,

        pages:
        Math.ceil(

            comments.length/size

        ),

        rows:
        comments.slice(

            start,

            end

        )

    };

}

/* =========================================
   COMMENT EXISTS
========================================= */

async function commentExists(commentId){

    const row =
    await getExternalComment(commentId);

    return !!row;

}

/* =========================================
   TOTAL COMMENTS
========================================= */

async function getTotalProjectComments(

projectCode

){

    const comments =
    await getProjectComments(projectCode);

    return comments.length;

}

/* =========================================
   EXPORTS
========================================= */

window.getProjectCommentStats =
getProjectCommentStats;

window.getRecentProjectComments =
getRecentProjectComments;

window.getTopComments =
getTopComments;

window.getTopCommenters =
getTopCommenters;

window.getProjectCommentDashboard =
getProjectCommentDashboard;

window.paginateComments =
paginateComments;

window.commentExists =
commentExists;

window.getTotalProjectComments =
getTotalProjectComments;
