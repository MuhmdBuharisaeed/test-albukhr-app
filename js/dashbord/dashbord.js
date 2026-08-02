/* =========================================
   ALBUKHR ECOSYSTEM
   UNIVERSAL PROJECT DASHBOARD
   SUPABASE + PI PAYMENT VERSION

   FILE:
   js/dashboard/dashboard.js

   PART 1
   -----------------------------------------
   • Global State
   • DOM References
   • Configuration
   • Helpers
   • API Layer
========================================= */

"use strict";

/* =========================================
   DOM REFERENCES
========================================= */

const dashboardEls = {

    projectName:
        document.getElementById("projectName"),

    projectMetaLine:
        document.getElementById("projectMetaLine"),

    projectBadges:
        document.getElementById("projectBadges"),

    liquidity:
        document.getElementById("liquidity"),

    reserve:
        document.getElementById("reserve"),

    roi:
        document.getElementById("roi"),

    investors:
        document.getElementById("investors"),

    liquidityStatus:
        document.getElementById("liquidityStatus"),

    usableLiquidity:
        document.getElementById("usableLiquidity"),

    history:
        document.getElementById("history"),

    projectStakeBox:
        document.getElementById("projectStakeBox"),

    addAmount:
        document.getElementById("addAmount"),

    withdrawAmount:
        document.getElementById("withdrawAmount"),

    addLiquidityBtn:
        document.getElementById("addLiquidityBtn"),

    withdrawLiquidityBtn:
        document.getElementById("withdrawLiquidityBtn"),

    uploadProjectUpdateBtn:
        document.getElementById("uploadProjectUpdateBtn"),

    addLiquidityCard:
        document.getElementById("addLiquidityCard"),

    withdrawLiquidityCard:
        document.getElementById("withdrawLiquidityCard"),

    projectUpdatesCard:
        document.getElementById("projectUpdatesCard"),

    addLiquidityNote:
        document.getElementById("addLiquidityNote"),

    withdrawLiquidityNote:
        document.getElementById("withdrawLiquidityNote"),

    projectUpdatesHeading:
        document.getElementById("projectUpdatesHeading"),

    projectUpdatesNote:
        document.getElementById("projectUpdatesNote"),

    projectUpdateTitle:
        document.getElementById("projectUpdateTitle"),

    projectUpdateImage:
        document.getElementById("projectUpdateImage"),

    projectUpdateText:
        document.getElementById("projectUpdateText"),

    updateImagePreviewBox:
        document.getElementById("updateImagePreviewBox"),

    updateImagePreview:
        document.getElementById("updateImagePreview"),

    updateImagePreviewMeta:
        document.getElementById("updateImagePreviewMeta")

};

/* =========================================
   DASHBOARD STATE
========================================= */

const DashboardState = {

    project: null,

    treasury: null,

    roi: 0,

    investors: 0,

    history: [],

    permissions: {},

    busy: false,

    uploadBusy: false,

    initialized: false

};

/* =========================================
   GLOBAL CONFIG
========================================= */

const DashboardConfig = {

    refreshInterval: 90000,

    maxUploadSize:
        10 * 1024 * 1024,

    paymentMemo:
        "ALBUKHR Liquidity",

    paymentMetadataVersion: 1

};

/* =========================================
   SERVER CONFIG
========================================= */

const PaymentServer = {

    baseUrl:
        window.ALBUKHR_PAYMENT_SERVER ||
        "https://YOUR-PAYMENT-SERVER.com",

    approve:
        "/approve",

    complete:
        "/complete",

    withdraw:
        "/withdraw",

    payWithdraw:
        "/pay-withdraw"

};

/* =========================================
   HELPERS
========================================= */

function safeString(value, fallback = ""){

    if(value === null) return fallback;

    if(value === undefined) return fallback;

    return String(value);

}

function safeNumber(value, fallback = 0){

    const n = Number(value);

    return Number.isFinite(n)
        ? n
        : fallback;

}

function formatPi(value){

    return `${safeNumber(value).toFixed(2)} Pi`;

}

function escapeHtml(text){

    return safeString(text)

        .replace(/&/g,"&amp;")

        .replace(/</g,"&lt;")

        .replace(/>/g,"&gt;")

        .replace(/"/g,"&quot;")

        .replace(/'/g,"&#039;");

}

function delay(ms){

    return new Promise(resolve=>{

        setTimeout(resolve,ms);

    });

}

/* =========================================
   CURRENT USER
========================================= */

function getCurrentUser(){

    return {

        email:

            localStorage.getItem(
                "albukhr_current_email"
            ) ||

            "",

        username:

            localStorage.getItem(
                "albukhr_current_username"
            ) ||

            "Unknown",

        role:

            localStorage.getItem(
                "albukhr_current_role"
            ) ||

            "viewer"

    };

}

/* =========================================
   ALERT
========================================= */

function dashboardAlert(title,message){

    if(typeof openAppAlert==="function"){

        openAppAlert(title,message);

        return;

    }

    alert(title+"\n\n"+message);

}

/* =========================================
   API WRAPPER
========================================= */

const DashboardAPI = {

    async post(endpoint,payload={}){

        const response =
            await fetch(
                PaymentServer.baseUrl + endpoint,
                {

                    method:"POST",

                    headers:{
                        "Content-Type":
                        "application/json"
                    },

                    body:
                    JSON.stringify(payload)

                }
            );

        const json =
            await response.json();

        if(!response.ok){

            throw new Error(

                json.error ||

                "Server Error"

            );

        }

        return json;

    }

};

/* =========================================
   PI PAYMENT ENGINE PLACEHOLDER

   Part 2 zai fara daga nan.
/* =========================================
   ALBUKHR PAYMENT ENGINE

   PART 2
========================================= */

const AlbukhrPaymentEngine = {

    /* =====================================
       START LIQUIDITY PAYMENT
    ===================================== */

    async addLiquidity({

        project,

        amount

    }){

        if(!window.Pi){

            throw new Error(
                "Pi SDK not loaded."
            );

        }

        if(!project){

            throw new Error(
                "Project not found."
            );

        }

        if(amount <= 0){

            throw new Error(
                "Invalid amount."
            );

        }

        const paymentData = {

            amount:
                Number(amount),

            memo:
                DashboardConfig.paymentMemo,

            metadata:{

                version:
                    DashboardConfig.paymentMetadataVersion,

                action:
                    "ADD_LIQUIDITY",

                project_code:
                    project.project_code,

                project_name:
                    project.project_name,

                created_at:
                    new Date().toISOString()

            }

        };

        return new Promise((resolve,reject)=>{

            Pi.createPayment(

                paymentData,

                {

                    onReadyForServerApproval:

                    async function(paymentId){

                        try{

                            const result =
                                await DashboardAPI.post(

                                    PaymentServer.approve,

                                    {

                                        paymentId

                                    }

                                );

                            resolve({

                                stage:
                                    "approved",

                                paymentId,

                                server:
                                    result

                            });

                        }

                        catch(error){

                            reject(error);

                        }

                    },

                    onReadyForServerCompletion:

                    async function(

                        paymentId,

                        txid

                    ){

                        try{

                            const result =
                                await DashboardAPI.post(

                                    PaymentServer.complete,

                                    {

                                        paymentId,

                                        txid

                                    }

                                );

                            resolve({

                                stage:
                                    "completed",

                                paymentId,

                                txid,

                                server:
                                    result

                            });

                        }

                        catch(error){

                            reject(error);

                        }

                    },

                    onCancel:

                    function(){

                        reject(

                            new Error(

                                "Payment cancelled."

                            )

                        );

                    },

                    onError:

                    function(error){

                        reject(error);

                    }

                }

            );

        });

    },

    /* =====================================
       VERIFY PAYMENT
    ===================================== */

    async verifyPayment(

        paymentId

    ){

        if(!paymentId){

            throw new Error(

                "Payment ID missing."

            );

        }

        return DashboardAPI.post(

            PaymentServer.complete,

            {

                paymentId

            }

        );

    },

    /* =====================================
       PLACEHOLDER

       Part 3
       Treasury Update
       Supabase Save
       Transaction Log
    ===================================== */

    async afterSuccessfulPayment(

        paymentResult

    ){

        return paymentResult;

    }

};

/* =========================================
   PART 3
   TREASURY INTEGRATION
   SUPABASE
========================================= */

/* =========================================
   TRANSACTION LOGGER
========================================= */

const DashboardTreasury = {

    async recordLiquidityDeposit({

        project,

        amount,

        paymentId,

        txid

    }){

        if(typeof recordProjectTreasuryTransaction !== "function"){

            console.warn(
                "recordProjectTreasuryTransaction() not found."
            );

            return;

        }

        return await recordProjectTreasuryTransaction({

            project_code:
                project.project_code,

            tx_type:
                "liquidity_deposit",

            amount:
                Number(amount),

            payment_id:
                paymentId,

            txid:
                txid,

            source:
                "pi_payment",

            actor:
                getCurrentUser().email,

            note:
                "Liquidity added from Project Dashboard"

        });

    },

    /* =====================================
       UPDATE TREASURY
    ===================================== */

    async updateLiquidity({

        project,

        amount

    }){

        if(typeof safeAddProjectLiquidity !== "function"){

            console.warn(
                "safeAddProjectLiquidity() missing."
            );

            return;

        }

        return await safeAddProjectLiquidity(

            project.project_code,

            Number(amount),

            {

                actor_userid:

                    getCurrentUser().email,

                actor_username:

                    getCurrentUser().username,

                actor_role:

                    getCurrentUser().role,

                note:

                    "Pi Payment Liquidity",

                meta:{

                    source:
                        "dashboard",

                    payment:
                        "pi"

                }

            }

        );

    }

};

/* =========================================
   AFTER PAYMENT
========================================= */

AlbukhrPaymentEngine.afterSuccessfulPayment =

async function({

    paymentId,

    txid,

    amount,

    project

}){

    await DashboardTreasury.recordLiquidityDeposit({

        project,

        amount,

        paymentId,

        txid

    });

    await DashboardTreasury.updateLiquidity({

        project,

        amount

    });

    await renderDashboard();

    dashboardAlert(

        "Liquidity Added",

        `${formatPi(amount)} successfully added to ${project.project_name}.`

    );

};

/* =========================================
   ADD LIQUIDITY ACTION
========================================= */

async function addLiquidityAction(){

    if(DashboardState.busy){

        return;

    }

    DashboardState.busy = true;

    try{

        if(!DashboardState.project){

            throw new Error(

                "Project not loaded."

            );

        }

        const amount =

            safeNumber(

                dashboardEls.addAmount.value,

                0

            );

        if(amount <= 0){

            throw new Error(

                "Enter valid amount."

            );

        }

        dashboardEls.addLiquidityBtn.disabled = true;

        dashboardEls.addLiquidityBtn.textContent =
            "Opening Pi Payment...";

        const payment =

            await AlbukhrPaymentEngine.addLiquidity({

                project:
                    DashboardState.project,

                amount

            });

        dashboardEls.addLiquidityBtn.textContent =
            "Finalizing...";

        await AlbukhrPaymentEngine.afterSuccessfulPayment({

            paymentId:
                payment.paymentId,

            txid:
                payment.txid ||

                "",

            amount,

            project:
                DashboardState.project

        });

        dashboardEls.addAmount.value = "";

    }

    catch(error){

        console.error(error);

        dashboardAlert(

            "Liquidity Failed",

            error.message ||

            "Unknown Error"

        );

    }

    finally{

        dashboardEls.addLiquidityBtn.disabled = false;

        dashboardEls.addLiquidityBtn.textContent =
            "Add Liquidity";

        DashboardState.busy = false;

    }

}

/* =========================================
   PART 4

   Withdraw Engine

   Escrow Ready

   Approval Ready

   Risk Engine Hook

========================================= */

/* =========================================
   PART 4
   WITHDRAW ENGINE
   ESCROW READY
========================================= */

const AlbukhrWithdrawalEngine = {

    /* =====================================
       CREATE WITHDRAW REQUEST
    ===================================== */

    async request({

        project,

        amount

    }){

        if(!project){

            throw new Error(
                "Project not loaded."
            );

        }

        if(amount <= 0){

            throw new Error(
                "Invalid withdraw amount."
            );

        }

        if(typeof createWithdrawRequest !== "function"){

            throw new Error(
                "createWithdrawRequest() not available."
            );

        }

        const user = getCurrentUser();

        return await createWithdrawRequest({

            project_code:
                project.project_code,

            amount:
                Number(amount),

            requester:
                user.email,

            requester_name:
                user.username,

            requester_role:
                user.role,

            request_type:
                "project_liquidity",

            source:
                "dashboard"

        });

    },

    /* =====================================
       CHECK STATUS
    ===================================== */

    async getStatus(requestId){

        return await DashboardAPI.post(

            PaymentServer.withdraw,

            {

                requestId

            }

        );

    },

    /* =====================================
       PAY APPROVED REQUEST
    ===================================== */

    async pay(requestId){

        return await DashboardAPI.post(

            PaymentServer.payWithdraw,

            {

                requestId

            }

        );

    }

};

/* =========================================
   WITHDRAW ACTION
========================================= */

async function withdrawLiquidityAction(){

    if(DashboardState.busy){

        return;

    }

    DashboardState.busy = true;

    try{

        if(!DashboardState.project){

            throw new Error(
                "Project not loaded."
            );

        }

        const amount = safeNumber(

            dashboardEls.withdrawAmount.value,

            0

        );

        if(amount <= 0){

            throw new Error(
                "Enter valid withdraw amount."
            );

        }

        dashboardEls.withdrawLiquidityBtn.disabled = true;

        dashboardEls.withdrawLiquidityBtn.textContent =
            "Submitting...";

        /* ===============================
           STEP 1
           CREATE REQUEST
        =============================== */

        const request =

            await AlbukhrWithdrawalEngine.request({

                project:
                    DashboardState.project,

                amount

            });

        dashboardEls.withdrawAmount.value = "";

        dashboardAlert(

            "Withdraw Submitted",

            "Your withdraw request has been submitted for ALBUKHR approval."

        );

        /* ===============================
           OPTIONAL AUTO CHECK
        =============================== */

        if(request?.id){

            console.log(

                "Withdraw Request ID:",

                request.id

            );

        }

    }

    catch(error){

        console.error(error);

        dashboardAlert(

            "Withdraw Failed",

            error.message ||

            "Unknown Error"

        );

    }

    finally{

        dashboardEls.withdrawLiquidityBtn.disabled = false;

        dashboardEls.withdrawLiquidityBtn.textContent =
            "Withdraw Liquidity";

        DashboardState.busy = false;

    }

}

/* =========================================
   ESCROW HOOKS
========================================= */

const EscrowHooks = {

    beforeWithdraw:

        async function(request){

            return true;

        },

    afterApproval:

        async function(request){

            return true;

        },

    beforePayment:

        async function(request){

            return true;

        },

    afterPayment:

        async function(result){

            return true;

        }

};

/* =========================================
   FUTURE POLICY ENGINE

   Future modules can hook here:

   ✓ Escrow Engine
   ✓ AI Risk Engine
   ✓ Treasury Rules
   ✓ DAO Voting
   ✓ Timelock
   ✓ Multi Signature
   ✓ Daily Limits
   ✓ AML / Compliance
========================================= */

/* =========================================
   PART 5

   Dashboard Loader
   Resolver
   Treasury Summary
   ROI
   Investors
   History Rendering

========================================= */
/* =========================================
   PART 5A
   PROJECT LOADER
   SUPABASE + RESOLVER
========================================= */

/* =========================================
   PROJECT CACHE
========================================= */

let ProjectCache = [];

/* =========================================
   LOAD ALL PROJECTS
========================================= */

async function loadProjects(forceReload = false){

    if(
        ProjectCache.length &&
        !forceReload
    ){
        return ProjectCache;
    }

    const { data, error } =
        await supabase
            .from("projects")
            .select("*")
            .order("project_name");

    if(error){

        console.error(
            "Projects Load Error:",
            error
        );

        ProjectCache = [];

        return [];

    }

    ProjectCache = data || [];

    return ProjectCache;

}

/* =========================================
   GET PROJECT META
========================================= */

async function getProjectMeta(projectCode){

    if(!projectCode){

        return null;

    }

    const projects =
        await loadProjects();

    return (

        projects.find(project =>

            String(
                project.project_code
            ).trim().toLowerCase()

            ===

            String(
                projectCode
            ).trim().toLowerCase()

        )

        ||

        null

    );

}

/* =========================================
   RESOLVE CURRENT PROJECT
========================================= */

async function resolveCurrentProject(){

    let project = null;

    try{

        if(
            typeof normalizeAlbukhrCurrentProjectStorage
            === "function"
        ){

            await normalizeAlbukhrCurrentProjectStorage();

        }

    }catch(error){

        console.warn(error);

    }

    try{

        if(
            typeof resolveAlbukhrCurrentProject
            === "function"
        ){

            project =
                await resolveAlbukhrCurrentProject();

        }

    }catch(error){

        console.warn(error);

    }

    if(
        project &&
        project.project_code
    ){

        DashboardState.project =
            project;

        return project;

    }

    const currentProjectCode =

        localStorage.getItem(
            "albukhr_current_project"
        )

        ||

        sessionStorage.getItem(
            "albukhr_current_project"
        )

        ||

        "";

    if(!currentProjectCode){

        throw new Error(
            "Current project not found."
        );

    }

    project =
        await getProjectMeta(
            currentProjectCode
        );

    if(!project){

        throw new Error(
            "Project does not exist."
        );

    }

    DashboardState.project =
        project;

    return project;

}

/* =========================================
   PROJECT TYPE
========================================= */

function getProjectType(project){

    if(
        typeof getAlbukhrProjectType
        === "function"
    ){

        return getAlbukhrProjectType(
            project
        );

    }

    return String(

        project?.project_type ||

        "internal"

    )

    .trim()

    .toLowerCase();

}

/* =========================================
   HEADER
========================================= */

function renderProjectHeader(project){

    dashboardEls.projectName.textContent =

        project.project_name ||

        project.project_code ||

        "Unknown Project";

    dashboardEls.projectMetaLine.innerHTML =

        `Code:
        <strong>

        ${escapeHtml(
            project.project_code
        )}

        </strong>

        •

        Type:

        <strong>

        ${escapeHtml(
            getProjectType(project)
        )}

        </strong>`;

    dashboardEls.projectBadges.innerHTML =

        `

        <span class="badge">

        ${escapeHtml(
            getProjectType(project)
        )}

        </span>

        <span class="badge">

        ${escapeHtml(

            project.status ||

            "active"

        )}

        </span>

        `;

    }
/* =========================================
   PART 5B
   TREASURY SUMMARY
   ROI
   INVESTORS
   STATS
========================================= */

/* =========================================
   TREASURY SUMMARY
========================================= */

async function getProjectTreasurySummary(project){

    if(!project){

        return null;

    }

    try{

        if(
            typeof getProjectTreasuryStatus ===
            "function"
        ){

            const summary =

                await getProjectTreasuryStatus(

                    project.project_code

                );

            if(summary){

                DashboardState.treasury =
                    summary;

                return summary;

            }

        }

    }

    catch(error){

        console.warn(error);

    }

    DashboardState.treasury = {

        liquidity:0,

        reserve:0,

        reserve_percent:

            safeNumber(

                project.reserve_percent,

                30

            ),

        min_liquidity:

            safeNumber(

                project.min_liquidity,

                100

            ),

        max_usable_liquidity:0,

        reward_rate:

            safeNumber(

                project.reward_rate,

                0

            )

    };

    return DashboardState.treasury;

}

/* =========================================
   ROI
========================================= */

async function getProjectROI(project){

    try{

        if(

            typeof calculateProjectROI ===

            "function"

        ){

            const roi =

                await calculateProjectROI(

                    project.project_code

                );

            DashboardState.roi =

                safeNumber(

                    roi,

                    0

                );

            return DashboardState.roi;

        }

    }

    catch(error){

        console.warn(error);

    }

    DashboardState.roi =

        safeNumber(

            project.roi,

            0

        );

    return DashboardState.roi;

}

/* =========================================
   INVESTORS
========================================= */

async function getProjectInvestorCount(project){

    try{

        if(

            typeof getAllStakesMerged ===

            "function"

        ){

            const stakes =

                await getAllStakesMerged();

            DashboardState.investors =

                stakes.filter(stake=>{

                    return String(

                        stake.project_code ||

                        stake.project ||

                        ""

                    )

                    .trim()

                    .toLowerCase()

                    ===

                    String(

                        project.project_code

                    )

                    .trim()

                    .toLowerCase();

                }).length;

            return DashboardState.investors;

        }

    }

    catch(error){

        console.warn(error);

    }

    DashboardState.investors = 0;

    return 0;

}

/* =========================================
   LIQUIDITY STATUS
========================================= */

function computeLiquidityStatus(){

    const treasury =

        DashboardState.treasury ||

        {};

    const liquidity =

        safeNumber(

            treasury.liquidity,

            0

        );

    const minimum =

        safeNumber(

            treasury.min_liquidity,

            100

        );

    const usable =

        safeNumber(

            treasury.max_usable_liquidity,

            0

        );

    if(liquidity < minimum){

        return{

            label:"LOW",

            className:

                "status-low"

        };

    }

    if(usable <= 0){

        return{

            label:"SAFE",

            className:

                "status-safe"

        };

    }

    return{

        label:"STRONG",

        className:

            "status-strong"

    };

}

/* =========================================
   STATS
========================================= */

function renderProjectStats(){

    const treasury =

        DashboardState.treasury ||

        {};

    dashboardEls.liquidity.textContent =

        formatPi(

            treasury.liquidity

        );

    dashboardEls.reserve.textContent =

        formatPi(

            treasury.reserve

        );

    dashboardEls.usableLiquidity.textContent =

        formatPi(

            treasury.max_usable_liquidity

        );

    dashboardEls.roi.textContent =

        `${safeNumber(

            DashboardState.roi,

            0

        ).toFixed(2)}%`;

    dashboardEls.investors.textContent =

        DashboardState.investors;

    const state =

        computeLiquidityStatus();

    dashboardEls.liquidityStatus.textContent =

        state.label;

    dashboardEls.liquidityStatus.className =

        `big ${state.className}`;

}

/* =========================================
   LOAD DASHBOARD STATS
========================================= */

async function loadDashboardStats(){

    if(

        !DashboardState.project

    ){

        return;

    }

    await Promise.all([

        getProjectTreasurySummary(

            DashboardState.project

        ),

        getProjectROI(

            DashboardState.project

        ),

        getProjectInvestorCount(

            DashboardState.project

        )

    ]);

    renderProjectStats();

                       }
/* =========================================
   PART 5C
   HISTORY
   DASHBOARD RENDERER
========================================= */

/* =========================================
   TREASURY HISTORY
========================================= */

async function getTreasuryHistory(project){

    if(!project){

        DashboardState.history = [];

        return [];

    }

    try{

        if(
            typeof getProjectTreasuryHistory ===
            "function"
        ){

            const history =

                await getProjectTreasuryHistory(

                    project.project_code,

                    50

                );

            DashboardState.history =

                Array.isArray(history)

                ? history

                : [];

            return DashboardState.history;

        }

    }

    catch(error){

        console.warn(error);

    }

    DashboardState.history = [];

    return [];

}

/* =========================================
   HISTORY RENDERER
========================================= */

function renderHistory(){

    if(
        !DashboardState.history.length
    ){

        dashboardEls.history.className =

            "empty";

        dashboardEls.history.innerHTML =

            "No treasury activity yet.";

        return;

    }

    dashboardEls.history.className = "";

    dashboardEls.history.innerHTML =

        DashboardState.history

        .map(item=>{

            const amount =

                safeNumber(

                    item.amount,

                    0

                );

            const type =

                safeString(

                    item.tx_type ||

                    item.type ||

                    "transaction"

                )

                .replace(/_/g," ");

            const note =

                safeString(

                    item.note ||

                    type

                );

            const created =

                item.created_at

                ?

                new Date(

                    item.created_at

                ).toLocaleString()

                :

                "—";

            return `

            <div class="tx">

                <div class="tx-left">

                    <strong>

                        ${escapeHtml(type)}

                    </strong>

                    <div class="muted">

                        ${escapeHtml(note)}

                    </div>

                    <div class="muted">

                        ${escapeHtml(created)}

                    </div>

                </div>

                <div class="tx-right">

                    ${formatPi(amount)}

                </div>

            </div>

            `;

        })

        .join("");

}

/* =========================================
   STAKE PANEL
========================================= */

async function loadStakePanel(){

    if(
        typeof renderProjectStakeUI ===
        "function"
    ){

        try{

            await renderProjectStakeUI(

                DashboardState.project.project_code,

                getCurrentUser().email

            );

            return;

        }

        catch(error){

            console.warn(error);

        }

    }

    dashboardEls.projectStakeBox.innerHTML =

        `<div class="muted">

            Stake panel unavailable.

        </div>`;

}

/* =========================================
   DASHBOARD
========================================= */

async function renderDashboard(){

    if(
        DashboardState.busy
    ){

        return;

    }

    DashboardState.busy = true;

    try{

        dashboardEls.projectName.textContent =

            "Loading...";

        dashboardEls.projectMetaLine.textContent =

            "Preparing project dashboard...";

        dashboardEls.history.className =

            "loading";

        dashboardEls.history.innerHTML =

            "Loading treasury history...";

        /* -------------------------------
           PROJECT
        ------------------------------- */

        const project =

            await resolveCurrentProject();

        DashboardState.project = project;

        renderProjectHeader(project);

        /* -------------------------------
           STATS
        ------------------------------- */

        await loadDashboardStats();

        /* -------------------------------
           HISTORY
        ------------------------------- */

        await getTreasuryHistory(project);

        renderHistory();

        /* -------------------------------
           STAKE PANEL
        ------------------------------- */

        await loadStakePanel();

        DashboardState.initialized = true;

    }

    catch(error){

        console.error(error);

        dashboardEls.projectName.textContent =

            "Project Load Failed";

        dashboardEls.projectMetaLine.textContent =

            error.message ||

            "Unknown Error";

        dashboardEls.history.className =

            "error-box";

        dashboardEls.history.innerHTML =

            `<div>

                ${escapeHtml(

                    error.message ||

                    "Dashboard failed."

                )}

            </div>`;

    }

    finally{

        DashboardState.busy = false;

    }

}
/* =========================================
   PART 5D
   FINAL INITIALIZATION
========================================= */

/* =========================================
   IMAGE PREVIEW
========================================= */

function resetImagePreview(){

    dashboardEls.updateImagePreview.src = "";

    dashboardEls.updateImagePreviewMeta.textContent = "";

    dashboardEls.updateImagePreviewBox.style.display =
        "none";

}

function previewSelectedImage(file){

    if(!file){

        resetImagePreview();

        return;

    }

    const reader = new FileReader();

    reader.onload = function(e){

        dashboardEls.updateImagePreview.src =
            e.target.result;

        dashboardEls.updateImagePreviewMeta.textContent =

            `${file.name}

            •

            ${(file.size/1024/1024).toFixed(2)} MB`;

        dashboardEls.updateImagePreviewBox.style.display =
            "block";

    };

    reader.readAsDataURL(file);

}

/* =========================================
   PERMISSIONS
========================================= */

async function applyDashboardPermissions(){

    if(!DashboardState.project){

        return;

    }

    const user = getCurrentUser();

    let treasuryAccess = true;

    let updateAccess = true;

    try{

        if(
            typeof canManageAlbukhrProjectTreasury ===
            "function"
        ){

            treasuryAccess =
                canManageAlbukhrProjectTreasury(

                    DashboardState.project,

                    user

                );

        }

    }catch(error){

        console.warn(error);

    }

    try{

        if(
            typeof canUploadAlbukhrProjectUpdate ===
            "function"
        ){

            updateAccess =
                canUploadAlbukhrProjectUpdate(

                    DashboardState.project,

                    user

                );

        }

    }catch(error){

        console.warn(error);

    }

    dashboardEls.addLiquidityBtn.disabled =
        !treasuryAccess;

    dashboardEls.withdrawLiquidityBtn.disabled =
        !treasuryAccess;

    dashboardEls.projectUpdateTitle.disabled =
        !updateAccess;

    dashboardEls.projectUpdateImage.disabled =
        !updateAccess;

    dashboardEls.projectUpdateText.disabled =
        !updateAccess;

    dashboardEls.uploadProjectUpdateBtn.disabled =
        !updateAccess;

    DashboardState.permissions = {

        treasury:
            treasuryAccess,

        updates:
            updateAccess

    };

}

/* =========================================
   BIND EVENTS
========================================= */

function bindDashboardActions(){

    dashboardEls.addLiquidityBtn.addEventListener(

        "click",

        addLiquidityAction

    );

    dashboardEls.withdrawLiquidityBtn.addEventListener(

        "click",

        withdrawLiquidityAction

    );

    if(
        typeof uploadProjectUpdate ===
        "function"
    ){

        dashboardEls.uploadProjectUpdateBtn
        .addEventListener(

            "click",

            uploadProjectUpdate

        );

    }

    dashboardEls.projectUpdateImage
    .addEventListener(

        "change",

        function(){

            previewSelectedImage(

                this.files[0]

            );

        }

    );

}

/* =========================================
   REFRESH
========================================= */

async function refreshDashboard(){

    try{

        await renderDashboard();

        await applyDashboardPermissions();

    }

    catch(error){

        console.error(

            "Dashboard Refresh:",

            error

        );

    }

}

/* =========================================
   START
========================================= */

document.addEventListener(

    "DOMContentLoaded",

    async function(){

        try{

            if(
                typeof guardAdmin ===
                "function"
            ){

                if(

                    !guardAdmin()

                ){

                    return;

                }

            }

            await loadProjects(true);

            bindDashboardActions();

            await refreshDashboard();

            setInterval(

                refreshDashboard,

                DashboardConfig.refreshInterval

            );

            console.log(

                "ALBUKHR Dashboard Ready"

            );

        }

        catch(error){

            console.error(error);

            dashboardAlert(

                "Dashboard Error",

                error.message ||

                "Initialization failed."

            );

        }

    }

);

/* =========================================
   END OF
   ALBUKHR UNIVERSAL DASHBOARD
========================================= */
