/* =========================================
   ALBUKHR EXTERNAL PROJECT REVIEW ENGINE
   PART 1
   Mainnet Ready
========================================= */

/* =========================================
TABLES
========================================= */

const EXTERNAL_REVIEW_TABLE =
"external_project_reviews";

const EXTERNAL_REVIEW_HISTORY_TABLE =
"external_project_review_history";

/* =========================================
REVIEW STATUS
========================================= */

const REVIEW_STATUS={

PENDING:
"pending",

UNDER_REVIEW:
"under_review",

APPROVED:
"approved",

REJECTED:
"rejected",

RETURNED:
"returned",

ON_HOLD:
"on_hold",

ESCALATED:
"escalated"

};

/* =========================================
REVIEW STAGES
========================================= */

const REVIEW_STAGE={

SUBMISSION:
"submission",

DOCUMENT:
"document",

COMPLIANCE:
"compliance",

TECHNICAL:
"technical",

FINANCIAL:
"financial",

LEGAL:
"legal",

RISK:
"risk",

FINAL:
"final"

};

/* =========================================
ADMIN ROLES
========================================= */

const REVIEW_ROLE={

SUPER_ADMIN:
"super_admin",

REVIEW_ADMIN:
"review_admin",

FINANCE_ADMIN:
"finance_admin",

COMPLIANCE_ADMIN:
"compliance_admin",

LEGAL_ADMIN:
"legal_admin",

TECHNICAL_ADMIN:
"technical_admin"

};

/* =========================================
HELPERS
========================================= */

function reviewNow(){

return new Date().toISOString();

}

function reviewSafeString(

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

function reviewSafeNumber(

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

function getExternalReviewSupabase(){

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

function assertReviewDependencies(){

if(

!getExternalReviewSupabase()

){

throw new Error(

"Supabase not available"

);

}

}

/* =========================================
NORMALIZE REVIEW
========================================= */

function normalizeExternalReview(

row={}

){

return{

id:
row.id||null,

project_code:
reviewSafeString(

row.project_code

),

review_stage:
reviewSafeString(

row.review_stage,

REVIEW_STAGE.SUBMISSION

),

review_status:
reviewSafeString(

row.review_status,

REVIEW_STATUS.PENDING

),

reviewer_uid:
reviewSafeString(

row.reviewer_uid

),

reviewer_name:
reviewSafeString(

row.reviewer_name

),

review_role:
reviewSafeString(

row.review_role

),

score:
reviewSafeNumber(

row.score

),

risk_score:
reviewSafeNumber(

row.risk_score

),

remarks:
reviewSafeString(

row.remarks

),

reviewed_at:
row.reviewed_at||

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
NORMALIZE HISTORY
========================================= */

function normalizeReviewHistory(

row={}

){

return{

id:
row.id||null,

review_id:
row.review_id||null,

project_code:
reviewSafeString(

row.project_code

),

action:
reviewSafeString(

row.action

),

old_status:
reviewSafeString(

row.old_status

),

new_status:
reviewSafeString(

row.new_status

),

performed_by:
reviewSafeString(

row.performed_by

),

performed_name:
reviewSafeString(

row.performed_name

),

performed_role:
reviewSafeString(

row.performed_role

),

remarks:
reviewSafeString(

row.remarks

),

created_at:
row.created_at||

null,

raw:row

};

}

/* =========================================
CREATE REVIEW OBJECT
========================================= */

function createReviewObject(

data={}

){

return{

project_code:

reviewSafeString(

data.project_code

),

review_stage:

reviewSafeString(

data.review_stage,

REVIEW_STAGE.SUBMISSION

),

review_status:

REVIEW_STATUS.PENDING,

reviewer_uid:

reviewSafeString(

data.reviewer_uid

),

reviewer_name:

reviewSafeString(

data.reviewer_name

),

review_role:

reviewSafeString(

data.review_role

),

score:0,

risk_score:0,

remarks:"",

created_at:

reviewNow(),

updated_at:

reviewNow()

};

  }

/* =========================================
CREATE REVIEW
========================================= */

async function createExternalReview(data={}){

    assertReviewDependencies();

    const supabase =
    getExternalReviewSupabase();

    const payload =
    createReviewObject(data);

    try{

        const {data:row,error}=

        await supabase

        .from(EXTERNAL_REVIEW_TABLE)

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

            review:
            normalizeExternalReview(row)

        };

    }catch(e){

        return{

            error:e.message

        };

    }

}

/* =========================================
ASSIGN REVIEWER
========================================= */

async function assignReviewer(

reviewId,

reviewer={}

){

    const supabase =
    getExternalReviewSupabase();

    try{

        const {data,error}=

        await supabase

        .from(EXTERNAL_REVIEW_TABLE)

        .update({

            reviewer_uid:
            reviewer.uid||"",

            reviewer_name:
            reviewer.name||"",

            review_role:
            reviewer.role||"",

            review_status:
            REVIEW_STATUS.UNDER_REVIEW,

            updated_at:
            reviewNow()

        })

        .eq("id",reviewId)

        .select()

        .single();

        if(error){

            return{

                error:error.message

            };

        }

        return{

            success:true,

            review:
            normalizeExternalReview(data)

        };

    }catch(e){

        return{

            error:e.message

        };

    }

}

/* =========================================
GET REVIEW
========================================= */

async function getExternalReview(id){

    const supabase =
    getExternalReviewSupabase();

    try{

        const {data,error}=

        await supabase

        .from(EXTERNAL_REVIEW_TABLE)

        .select("*")

        .eq("id",id)

        .maybeSingle();

        if(error){

            return null;

        }

        return data

        ?normalizeExternalReview(data)

        :null;

    }catch(e){

        return null;

    }

}

/* =========================================
GET PROJECT REVIEWS
========================================= */

async function getProjectReviews(

projectCode

){

    const supabase =
    getExternalReviewSupabase();

    try{

        const {data,error}=

        await supabase

        .from(EXTERNAL_REVIEW_TABLE)

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

            normalizeExternalReview

        );

    }catch(e){

        return[];

    }

}

/* =========================================
GET PENDING REVIEWS
========================================= */

async function getPendingReviews(){

    const supabase =
    getExternalReviewSupabase();

    try{

        const {data,error}=

        await supabase

        .from(EXTERNAL_REVIEW_TABLE)

        .select("*")

        .eq(

            "review_status",

            REVIEW_STATUS.PENDING

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

            normalizeExternalReview

        );

    }catch(e){

        return[];

    }

}

/* =========================================
GET STAGE REVIEWS
========================================= */

async function getStageReviews(

stage

){

    const supabase =
    getExternalReviewSupabase();

    try{

        const {data,error}=

        await supabase

        .from(EXTERNAL_REVIEW_TABLE)

        .select("*")

        .eq(

            "review_stage",

            stage

        );

        if(error){

            return[];

        }

        return(

            data||[]

        ).map(

            normalizeExternalReview

        );

    }catch(e){

        return[];

    }

}

/* =========================================
GET ROLE REVIEWS
========================================= */

async function getRoleReviews(

role

){

    const supabase =
    getExternalReviewSupabase();

    try{

        const {data,error}=

        await supabase

        .from(EXTERNAL_REVIEW_TABLE)

        .select("*")

        .eq(

            "review_role",

            role

        );

        if(error){

            return[];

        }

        return(

            data||[]

        ).map(

            normalizeExternalReview

        );

    }catch(e){

        return[];

    }

}

/* =========================================
SEARCH
========================================= */

async function searchProjectReviews(

keyword

){

    const reviews =
    await getPendingReviews();

    keyword =
    reviewSafeString(keyword)

    .toLowerCase();

    return reviews.filter(r=>{

        return(

            r.project_code

            .toLowerCase()

            .includes(keyword)

            ||

            r.reviewer_name

            .toLowerCase()

            .includes(keyword)

            ||

            r.review_stage

            .toLowerCase()

            .includes(keyword)

        );

    });

}

/* =========================================
REVIEW QUEUE
========================================= */

async function getReviewQueue(){

    return await getPendingReviews();

}

/* =========================================
EXPORTS
========================================= */

window.createExternalReview =
createExternalReview;

window.assignReviewer =
assignReviewer;

window.getExternalReview =
getExternalReview;

window.getProjectReviews =
getProjectReviews;

window.getPendingReviews =
getPendingReviews;

window.getStageReviews =
getStageReviews;

window.getRoleReviews =
getRoleReviews;

window.searchProjectReviews =
searchProjectReviews;

window.getReviewQueue =
getReviewQueue;

/* =========================================
UPDATE REVIEW STATUS
========================================= */

async function updateReviewStatus(

reviewId,

status,

remarks="",

admin={}

){

    const supabase =
    getExternalReviewSupabase();

    const current =
    await getExternalReview(reviewId);

    if(!current){

        return{

            error:"Review not found"

        };

    }

    try{

        const {data,error}=

        await supabase

        .from(EXTERNAL_REVIEW_TABLE)

        .update({

            review_status:status,

            remarks:remarks,

            reviewed_at:reviewNow(),

            updated_at:reviewNow()

        })

        .eq("id",reviewId)

        .select()

        .single();

        if(error){

            return{

                error:error.message

            };

        }

        /* Save History */

        await createReviewHistory({

            review_id:reviewId,

            project_code:

            current.project_code,

            action:status,

            old_status:

            current.review_status,

            new_status:status,

            performed_by:

            admin.uid||"",

            performed_name:

            admin.name||"",

            performed_role:

            admin.role||"",

            remarks

        });

        return{

            success:true,

            review:

            normalizeExternalReview(data)

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

async function approveReview(

reviewId,

admin={},

remarks=""

){

    return updateReviewStatus(

        reviewId,

        REVIEW_STATUS.APPROVED,

        remarks,

        admin

    );

}

/* =========================================
REJECT
========================================= */

async function rejectReview(

reviewId,

admin={},

remarks=""

){

    return updateReviewStatus(

        reviewId,

        REVIEW_STATUS.REJECTED,

        remarks,

        admin

    );

}

/* =========================================
RETURN FOR CORRECTION
========================================= */

async function returnReview(

reviewId,

admin={},

remarks=""

){

    return updateReviewStatus(

        reviewId,

        REVIEW_STATUS.RETURNED,

        remarks,

        admin

    );

}

/* =========================================
PUT ON HOLD
========================================= */

async function holdReview(

reviewId,

admin={},

remarks=""

){

    return updateReviewStatus(

        reviewId,

        REVIEW_STATUS.ON_HOLD,

        remarks,

        admin

    );

}

/* =========================================
ESCALATE
========================================= */

async function escalateReview(

reviewId,

admin={},

remarks=""

){

    return updateReviewStatus(

        reviewId,

        REVIEW_STATUS.ESCALATED,

        remarks,

        admin

    );

}

/* =========================================
CREATE HISTORY
========================================= */

async function createReviewHistory(

payload

){

    const supabase =
    getExternalReviewSupabase();

    try{

        const {data,error}=

        await supabase

        .from(

            EXTERNAL_REVIEW_HISTORY_TABLE

        )

        .insert({

            ...payload,

            created_at:

            reviewNow()

        })

        .select()

        .single();

        if(error){

            return{

                error:error.message

            };

        }

        return{

            success:true,

            history:

            normalizeReviewHistory(data)

        };

    }catch(e){

        return{

            error:e.message

        };

    }

}

/* =========================================
GET HISTORY
========================================= */

async function getReviewHistory(

reviewId

){

    const supabase =
    getExternalReviewSupabase();

    try{

        const {data,error}=

        await supabase

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

        );

        if(error){

            return[];

        }

        return(

            data||[]

        ).map(

            normalizeReviewHistory

        );

    }catch(e){

        return[];

    }

}

/* =========================================
NEXT STAGE
========================================= */

async function moveReviewToStage(

reviewId,

stage

){

    const supabase =
    getExternalReviewSupabase();

    try{

        const {data,error}=

        await supabase

        .from(

            EXTERNAL_REVIEW_TABLE

        )

        .update({

            review_stage:stage,

            updated_at:

            reviewNow()

        })

        .eq(

            "id",

            reviewId

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

            review:

            normalizeExternalReview(data)

        };

    }catch(e){

        return{

            error:e.message

        };

    }

}

/* =========================================
EXPORTS
========================================= */

window.updateReviewStatus =
updateReviewStatus;

window.approveReview =
approveReview;

window.rejectReview =
rejectReview;

window.returnReview =
returnReview;

window.holdReview =
holdReview;

window.escalateReview =
escalateReview;

window.createReviewHistory =
createReviewHistory;

window.getReviewHistory =
getReviewHistory;

window.moveReviewToStage =
moveReviewToStage;

/* =========================================
DASHBOARD SUMMARY
========================================= */

async function getReviewDashboardSummary(){

    const supabase =
    getExternalReviewSupabase();

    if(!supabase){

        return null;

    }

    try{

        const {data,error}=

        await supabase

        .from(EXTERNAL_REVIEW_TABLE)

        .select("*");

        if(error){

            return null;

        }

        const rows=data||[];

        return{

            total:
            rows.length,

            pending:
            rows.filter(r=>

                r.review_status===

                REVIEW_STATUS.PENDING

            ).length,

            under_review:
            rows.filter(r=>

                r.review_status===

                REVIEW_STATUS.UNDER_REVIEW

            ).length,

            approved:
            rows.filter(r=>

                r.review_status===

                REVIEW_STATUS.APPROVED

            ).length,

            rejected:
            rows.filter(r=>

                r.review_status===

                REVIEW_STATUS.REJECTED

            ).length,

            returned:
            rows.filter(r=>

                r.review_status===

                REVIEW_STATUS.RETURNED

            ).length,

            on_hold:
            rows.filter(r=>

                r.review_status===

                REVIEW_STATUS.ON_HOLD

            ).length,

            escalated:
            rows.filter(r=>

                r.review_status===

                REVIEW_STATUS.ESCALATED

            ).length

        };

    }catch(e){

        return null;

    }

}

/* =========================================
REVIEWER PERFORMANCE
========================================= */

async function getReviewerPerformance(

reviewerUid

){

    const supabase =
    getExternalReviewSupabase();

    try{

        const {data,error}=

        await supabase

        .from(EXTERNAL_REVIEW_TABLE)

        .select("*")

        .eq(

            "reviewer_uid",

            reviewerUid

        );

        if(error){

            return null;

        }

        const rows=data||[];

        return{

            reviewer_uid:
            reviewerUid,

            total_reviews:
            rows.length,

            approved:
            rows.filter(r=>

                r.review_status===

                REVIEW_STATUS.APPROVED

            ).length,

            rejected:
            rows.filter(r=>

                r.review_status===

                REVIEW_STATUS.REJECTED

            ).length,

            pending:
            rows.filter(r=>

                r.review_status===

                REVIEW_STATUS.PENDING

            ).length

        };

    }catch(e){

        return null;

    }

}

/* =========================================
FINAL APPROVAL CHECK
========================================= */

async function canProjectBeApproved(

projectCode

){

    const reviews=

    await getProjectReviews(

        projectCode

    );

    if(!reviews.length){

        return false;

    }

    return reviews.every(r=>

        r.review_status===

        REVIEW_STATUS.APPROVED

    );

}

/* =========================================
PROJECT SCORE
========================================= */

async function calculateProjectReviewScore(

projectCode

){

    const reviews=

    await getProjectReviews(

        projectCode

    );

    if(!reviews.length){

        return 0;

    }

    let total=0;

    reviews.forEach(r=>{

        total+=

        reviewSafeNumber(

            r.score

        );

    });

    return Math.round(

        total/

        reviews.length

    );

}

/* =========================================
RISK SCORE
========================================= */

async function calculateProjectRiskScore(

projectCode

){

    const reviews=

    await getProjectReviews(

        projectCode

    );

    if(!reviews.length){

        return 0;

    }

    let total=0;

    reviews.forEach(r=>{

        total+=

        reviewSafeNumber(

            r.risk_score

        );

    });

    return Math.round(

        total/

        reviews.length

    );

}

/* =========================================
AUDIT
========================================= */

async function getReviewAuditTrail(

projectCode

){

    const reviews=

    await getProjectReviews(

        projectCode

    );

    let history=[];

    for(

        const review

        of reviews

    ){

        const rows=

        await getReviewHistory(

            review.id

        );

        history.push(

            ...rows

        );

    }

    history.sort(

        (a,b)=>

        new Date(

            b.created_at

        )

        -

        new Date(

            a.created_at

        )

    );

    return history;

}

/* =========================================
WORKFLOW COMPLETION
========================================= */

async function getWorkflowCompletion(

projectCode

){

    const reviews=

    await getProjectReviews(

        projectCode

    );

    const stages=[

        REVIEW_STAGE.SUBMISSION,

        REVIEW_STAGE.DOCUMENT,

        REVIEW_STAGE.COMPLIANCE,

        REVIEW_STAGE.TECHNICAL,

        REVIEW_STAGE.FINANCIAL,

        REVIEW_STAGE.LEGAL,

        REVIEW_STAGE.RISK,

        REVIEW_STAGE.FINAL

    ];

    let completed=0;

    stages.forEach(stage=>{

        const found=

        reviews.find(r=>

            r.review_stage===stage &&

            r.review_status===

            REVIEW_STATUS.APPROVED

        );

        if(found){

            completed++;

        }

    });

    return{

        completed,

        total:

        stages.length,

        percent:

        Math.round(

            completed/

            stages.length

            *100

        )

    };

}

/* =========================================
EXPORTS
========================================= */

window.getReviewDashboardSummary=
getReviewDashboardSummary;

window.getReviewerPerformance=
getReviewerPerformance;

window.canProjectBeApproved=
canProjectBeApproved;

window.calculateProjectReviewScore=
calculateProjectReviewScore;

window.calculateProjectRiskScore=
calculateProjectRiskScore;

window.getReviewAuditTrail=
getReviewAuditTrail;

window.getWorkflowCompletion=
getWorkflowCompletion;
