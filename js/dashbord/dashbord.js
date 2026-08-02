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
