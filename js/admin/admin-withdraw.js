/* =========================================
   ALBUKHR ADMIN WITHDRAW ENGINE v3
========================================= */

const WITHDRAW_STATE = {

pendingExpanded:false,

approvedExpanded:false,

paidExpanded:false

};

/* =========================================
   SHORT WALLET
========================================= */

function shortWallet(wallet=""){

wallet = String(wallet);

if(wallet.length <= 14){

return wallet;

}

return `${wallet.slice(0,6)}...${wallet.slice(-6)}`;

}

/* =========================================
   FORMAT DATE
========================================= */

function formatDate(date){

if(!date){

return "-";

}

return new Date(date)

.toLocaleString([],{

dateStyle:"medium",

timeStyle:"short"

});

}

/* =========================================
   EMPTY STATE
========================================= */

function renderEmpty(container,message){

container.innerHTML = `

<div class="empty-state">

<div class="icon">

📭

</div>

<h4>

${message}

</h4>

</div>

`;

}

/* =========================================
   REFRESH ALL
========================================= */

async function refreshWithdrawSections(){

await Promise.all([

renderPendingRequests(),

renderApprovedRequests(),

renderPaidRequests()

]);

}

/* =========================================
   ADMIN WALLET V4 — INSTANT REFRESH
========================================= */

function refreshAdminWalletNow(){
    window.location.reload();
}

/* =========================================
   REMOVE CARD (OPTIMISTIC UI)
========================================= */

function removeWithdrawCard(button){

const card =

button.closest(".withdraw-item");

if(!card) return;

card.style.transition =
".25s";

card.style.opacity = "0";

card.style.transform =
"translateX(30px)";

setTimeout(()=>{

card.remove();

},250);

}

/* =========================================
   FETCH REQUESTS
========================================= */

async function fetchRequests(status){

try{

const {data,error} =

await supabaseClient

.from("withdraw_requests")

.select("*")

.eq("status",status)

.order("created_at",{

ascending:false

});

if(error){

throw error;

}

return data || [];

}catch(error){

console.error(

"Withdraw Fetch Error:",

error

);

return [];

}

}

/* =========================================
   RENDER PENDING REQUESTS
========================================= */

async function renderPendingRequests(){

    const box =
        document.getElementById("pendingRequests");

    if(!box) return;


    /* =========================================
       LOADING
    ========================================= */

    box.innerHTML = `

        <div class="empty-state">

            <div class="withdraw-loading-icon">

                <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >

                    <circle
                        cx="12"
                        cy="12"
                        r="9">
                    </circle>

                    <path
                        d="M12 3a9 9 0 0 1 9 9">
                    </path>

                </svg>

            </div>

            <span>
                Loading pending requests...
            </span>

        </div>

    `;


    /* =========================================
       FETCH
    ========================================= */

    const requests =
        await fetchRequests("pending");


    if(!requests.length){

        renderEmpty(
            box,
            "No Pending Requests"
        );

        return;

    }


    /* =========================================
       LIMIT
    ========================================= */

    const visible =
        WITHDRAW_STATE.pendingExpanded

        ? requests

        : requests.slice(0,3);


    box.innerHTML = "";


    /* =========================================
       RENDER REQUESTS
    ========================================= */

    visible.forEach(req=>{

        const card =
            document.createElement("div");


        card.className =
            "withdraw-item";


        card.innerHTML = `

            <!-- LEFT SIDE -->

            <div class="withdraw-left">


                <!-- PROJECT -->

                <div class="withdraw-user">

                    <svg
                        class="withdraw-row-icon"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >

                        <rect
                            x="3"
                            y="5"
                            width="18"
                            height="15"
                            rx="2">
                        </rect>

                        <path
                            d="M8 5V3h8v2">
                        </path>

                        <path
                            d="M3 10h18">
                        </path>

                    </svg>

                    <span>
                        ${req.project}
                    </span>

                </div>


                <!-- USER -->

                <div class="withdraw-date">

                    <svg
                        class="withdraw-row-icon"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >

                        <circle
                            cx="12"
                            cy="8"
                            r="3.5">
                        </circle>

                        <path
                            d="M5 20c.8-3.5 3.1-5.5 7-5.5s6.2 2 7 5.5">
                        </path>

                    </svg>

                    <span>
                        ${req.userid || "Unknown"}
                    </span>

                </div>


                <!-- WALLET -->

                <div class="withdraw-date">

                    <svg
                        class="withdraw-row-icon"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >

                        <rect
                            x="3"
                            y="6"
                            width="18"
                            height="14"
                            rx="2">
                        </rect>

                        <path
                            d="M3 10h18">
                        </path>

                        <path
                            d="M7 6V4h10v2">
                        </path>

                        <circle
                            cx="16"
                            cy="15"
                            r="1.5">
                        </circle>

                    </svg>

                    <span>
                        ${shortWallet(req.wallet)}
                    </span>

                </div>


                <!-- DATE -->

                <div class="withdraw-date">

                    <svg
                        class="withdraw-row-icon"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >

                        <rect
                            x="4"
                            y="5"
                            width="16"
                            height="16"
                            rx="2">
                        </rect>

                        <path
                            d="M8 3v4">
                        </path>

                        <path
                            d="M16 3v4">
                        </path>

                        <path
                            d="M4 9h16">
                        </path>

                        <path
                            d="M8 13h2">
                        </path>

                        <path
                            d="M14 13h2">
                        </path>

                        <path
                            d="M8 17h2">
                        </path>

                        <path
                            d="M14 17h2">
                        </path>

                    </svg>

                    <span>
                        ${formatDate(req.created_at)}
                    </span>

                </div>


                <!-- STATUS -->

                <span class="status pending">

                    <svg
                        class="status-icon"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >

                        <circle
                            cx="12"
                            cy="12"
                            r="8">
                        </circle>

                        <path
                            d="M12 8v4l3 2">
                        </path>

                    </svg>

                    <span>
                        Pending
                    </span>

                </span>

            </div>


            <!-- RIGHT SIDE -->

            <div class="withdraw-right">


                <!-- AMOUNT -->

                <div class="withdraw-amount">

                    ${Number(req.amount).toFixed(2)} Pi

                </div>


                <!-- TYPE -->

                <div class="withdraw-type">

                    ${req.type}

                </div>


                <!-- ACTIONS -->

                <div class="withdraw-actions">


                    <!-- APPROVE -->

                    <button
                        type="button"
                        class="approve-btn"
                        onclick="approveRequest('${req.id}',this)"
                    >

                        <svg
                            class="withdraw-svg"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >

                            <circle
                                cx="12"
                                cy="12"
                                r="9">
                            </circle>

                            <path
                                d="m8 12 2.5 2.5L16 9">
                            </path>

                        </svg>

                        <span>
                            Approve
                        </span>

                    </button>


                    <!-- REJECT -->

                    <button
                        type="button"
                        class="reject-btn"
                        onclick="rejectRequest('${req.id}',this)"
                    >

                        <svg
                            class="withdraw-svg"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >

                            <circle
                                cx="12"
                                cy="12"
                                r="9">
                            </circle>

                            <path
                                d="m9 9 6 6M15 9l-6 6">
                            </path>

                        </svg>

                        <span>
                            Reject
                        </span>

                    </button>

                </div>

            </div>

        `;


        box.appendChild(card);

    });


    /* =========================================
       SEE MORE / SHOW LESS
    ========================================= */

    if(requests.length > 3){

        const wrap =
            document.createElement("div");


        wrap.className =
            "withdraw-see-more";


        wrap.innerHTML = `

            <button
                type="button"
                class="see-more-btn"
                onclick="
                    WITHDRAW_STATE.pendingExpanded =
                    !WITHDRAW_STATE.pendingExpanded;

                    renderPendingRequests();
                "
            >

                <span>

                    ${
                        WITHDRAW_STATE.pendingExpanded
                        ? "Show Less"
                        : "See More"
                    }

                </span>


                <svg
                    class="see-more-icon"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >

                    <path
                        d="${
                            WITHDRAW_STATE.pendingExpanded
                            ? "m18 15-6-6-6 6"
                            : "m6 9 6 6 6-6"
                        }"
                    ></path>

                </svg>

            </button>

        `;


        box.appendChild(wrap);

    }

}

/* =========================================
   RENDER APPROVED REQUESTS
========================================= */

async function renderApprovedRequests(){

    const box =
        document.getElementById("approvedRequests");

    if(!box) return;


    /* =========================================
       LOADING
    ========================================= */

    box.innerHTML = `

        <div class="empty-state">

            <div class="withdraw-loading-icon">

                <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >

                    <circle
                        cx="12"
                        cy="12"
                        r="9">
                    </circle>

                    <path
                        d="M12 3a9 9 0 0 1 9 9">
                    </path>

                </svg>

            </div>

            <span>
                Loading approved requests...
            </span>

        </div>

    `;


    /* =========================================
       FETCH
    ========================================= */

    const requests =
        await fetchRequests("approved");


    if(!requests.length){

        renderEmpty(
            box,
            "No Approved Requests"
        );

        return;

    }


    /* =========================================
       LIMIT
    ========================================= */

    const visible =
        WITHDRAW_STATE.approvedExpanded

        ? requests

        : requests.slice(0,3);


    box.innerHTML = "";


    /* =========================================
       RENDER APPROVED REQUESTS
    ========================================= */

    visible.forEach(req=>{

        const card =
            document.createElement("div");


        card.className =
            "withdraw-item";


        card.innerHTML = `

            <!-- LEFT SIDE -->

            <div class="withdraw-left">


                <!-- PROJECT -->

                <div class="withdraw-user">

                    <svg
                        class="withdraw-row-icon"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >

                        <rect
                            x="3"
                            y="5"
                            width="18"
                            height="15"
                            rx="2">
                        </rect>

                        <path
                            d="M8 5V3h8v2">
                        </path>

                        <path
                            d="M3 10h18">
                        </path>

                    </svg>

                    <span>
                        ${req.project}
                    </span>

                </div>


                <!-- USER -->

                <div class="withdraw-date">

                    <svg
                        class="withdraw-row-icon"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >

                        <circle
                            cx="12"
                            cy="8"
                            r="3.5">
                        </circle>

                        <path
                            d="M5 20c.8-3.5 3.1-5.5 7-5.5s6.2 2 7 5.5">
                        </path>

                    </svg>

                    <span>
                        ${req.userid || "Unknown"}
                    </span>

                </div>


                <!-- WALLET -->

                <div class="withdraw-date">

                    <svg
                        class="withdraw-row-icon"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >

                        <rect
                            x="3"
                            y="6"
                            width="18"
                            height="14"
                            rx="2">
                        </rect>

                        <path
                            d="M3 10h18">
                        </path>

                        <path
                            d="M7 6V4h10v2">
                        </path>

                        <circle
                            cx="16"
                            cy="15"
                            r="1.5">
                        </circle>

                    </svg>

                    <span>
                        ${shortWallet(req.wallet)}
                    </span>

                </div>


                <!-- DATE -->

                <div class="withdraw-date">

                    <svg
                        class="withdraw-row-icon"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >

                        <rect
                            x="4"
                            y="5"
                            width="16"
                            height="16"
                            rx="2">
                        </rect>

                        <path
                            d="M8 3v4">
                        </path>

                        <path
                            d="M16 3v4">
                        </path>

                        <path
                            d="M4 9h16">
                        </path>

                        <path
                            d="M8 13h2">
                        </path>

                        <path
                            d="M14 13h2">
                        </path>

                        <path
                            d="M8 17h2">
                        </path>

                        <path
                            d="M14 17h2">
                        </path>

                    </svg>

                    <span>
                        ${formatDate(req.created_at)}
                    </span>

                </div>


                <!-- APPROVED STATUS -->

                <span class="status approved">

                    <svg
                        class="status-icon"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >

                        <circle
                            cx="12"
                            cy="12"
                            r="8">
                        </circle>

                        <path
                            d="m8 12 2.5 2.5L16 9">
                        </path>

                    </svg>

                    <span>
                        Approved
                    </span>

                </span>

            </div>


            <!-- RIGHT SIDE -->

            <div class="withdraw-right">


                <!-- AMOUNT -->

                <div class="withdraw-amount">

                    ${Number(req.amount).toFixed(2)} Pi

                </div>


                <!-- TYPE -->

                <div class="withdraw-type">

                    ${req.type}

                </div>


                <!-- PAY ACTION -->

                <div class="withdraw-actions">

                    <button
                        type="button"
                        class="pay-btn"
                        onclick="payRequest('${req.id}',this)"
                    >

                        <svg
                            class="withdraw-svg"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >

                            <rect
                                x="3"
                                y="6"
                                width="18"
                                height="14"
                                rx="2">
                            </rect>

                            <path
                                d="M3 10h18">
                            </path>

                            <path
                                d="M7 6V4h10v2">
                            </path>

                            <circle
                                cx="16"
                                cy="15"
                                r="1.5">
                            </circle>

                        </svg>

                        <span>
                            Pay Now
                        </span>

                    </button>

                </div>

            </div>

        `;


        box.appendChild(card);

    });


    /* =========================================
       SEE MORE / SHOW LESS
    ========================================= */

    if(requests.length > 3){

        const wrap =
            document.createElement("div");


        wrap.className =
            "withdraw-see-more";


        wrap.innerHTML = `

            <button
                type="button"
                class="see-more-btn"
                onclick="
                    WITHDRAW_STATE.approvedExpanded =
                    !WITHDRAW_STATE.approvedExpanded;

                    renderApprovedRequests();
                "
            >

                <span>

                    ${
                        WITHDRAW_STATE.approvedExpanded
                        ? "Show Less"
                        : "See More"
                    }

                </span>


                <svg
                    class="see-more-icon"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >

                    <path
                        d="${
                            WITHDRAW_STATE.approvedExpanded
                            ? "m18 15-6-6-6 6"
                            : "m6 9 6 6-6 6"
                        }"
                    ></path>

                </svg>

            </button>

        `;


        box.appendChild(wrap);

    }

}

/* =========================================
   RENDER PAID REQUESTS
========================================= */

async function renderPaidRequests(){

const box =
document.getElementById("paidRequests");

if(!box) return;

box.innerHTML =

`<div class="empty-state">

Loading paid withdrawals...

</div>`;

const requests =
await fetchRequests("paid");

if(!requests.length){

renderEmpty(

box,

"No Paid Withdrawals"

);

return;

}

const visible =

WITHDRAW_STATE.paidExpanded

? requests

: requests.slice(0,3);

box.innerHTML = "";

visible.forEach(req=>{

const card =
document.createElement("div");

card.className =
"withdraw-item";

card.innerHTML = `

<div class="withdraw-left">

<div class="withdraw-user">

📦 ${req.project}

</div>

<div class="withdraw-date">

👤 ${req.userid || "Unknown"}

</div>

<div class="withdraw-date">

💼 ${shortWallet(req.wallet)}

</div>

<div class="withdraw-date">

📅 ${formatDate(req.processed_at || req.created_at)}

</div>

<span class="status paid">

Paid

</span>

</div>

<div class="withdraw-right">

<div class="withdraw-amount">

${Number(req.amount).toFixed(2)} Pi

</div>

<div class="withdraw-type">

${req.type}

</div>

<div class="withdraw-date">

Tx:

${shortWallet(req.txid || "Pending")}

</div>

</div>

`;

box.appendChild(card);

});

/* See More */

if(requests.length > 3){

const wrap =
document.createElement("div");

wrap.style.textAlign="center";

wrap.style.marginTop="14px";

wrap.innerHTML = `

<button

class="see-more-btn"

onclick="

WITHDRAW_STATE.paidExpanded=

!WITHDRAW_STATE.paidExpanded;

renderPaidRequests();

">

${

WITHDRAW_STATE.paidExpanded

?

"Show Less"

:

"See More"

}

</button>

`;

box.appendChild(wrap);

}

   }

/* =========================================
   APPROVE REQUEST
========================================= */

async function approveRequest(id, button){

    try{

        if(button){

            button.disabled = true;

            button.innerHTML = `
                <svg
                    class="withdraw-svg withdraw-spinner"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <circle
                        cx="12"
                        cy="12"
                        r="9">
                    </circle>

                    <path
                        d="M12 3a9 9 0 0 1 9 9">
                    </path>
                </svg>

                <span>Approving...</span>
            `;
        }

        /* GET REQUEST */

        const {
            data:req,
            error
        } = await supabaseClient

            .from("withdraw_requests")

            .select("*")

            .eq("id",id)

            .single();

        if(error || !req){

            if(button){

                button.disabled = false;

                button.innerHTML = `
                    <svg
                        class="withdraw-svg"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <circle
                            cx="12"
                            cy="12"
                            r="9">
                        </circle>

                        <path
                            d="m8 12 2.5 2.5L16 9">
                        </path>
                    </svg>

                    <span>Approve</span>
                `;
            }

            showAlert(
                "Error",
                "Request not found",
                "error"
            );

            return;
        }


        /* =================================
           FRAUD CHECK
        ================================= */

        const {
            data:stakes
        } = await supabaseClient

            .from("stakes")

            .select("*")

            .eq("userid",req.userid)

            .eq("project",req.project);


        let totalReward = 0;


        (stakes || []).forEach(stake=>{

            const reward =
                Number(stake.reward || 0);

            const withdrawn =
                Number(
                    stake.withdrawnReward || 0
                );

            totalReward +=
                Math.max(
                    0,
                    reward - withdrawn
                );

        });


        if(
            req.type === "reward" &&
            Number(req.amount) > totalReward
        ){

            if(button){

                button.disabled = false;

                button.innerHTML = `
                    <svg
                        class="withdraw-svg"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <circle
                            cx="12"
                            cy="12"
                            r="9">
                        </circle>

                        <path
                            d="m8 12 2.5 2.5L16 9">
                        </path>
                    </svg>

                    <span>Approve</span>
                `;
            }

            showAlert(
                "Fraud Detected",
                "Requested reward exceeds available reward.",
                "error"
            );

            return;
        }


        /* =================================
           FEE
        ================================= */

        const fee =
            Number(req.amount) * 0.01;

        const receive =
            Number(req.amount) - fee;


        /* =================================
           CREATE TRANSACTION
        ================================= */

        const {
            error:txError
        } = await supabaseClient

            .from("transactions")

            .insert({

                userid:req.userid,

                project:req.project,

                wallet:req.wallet,

                amount:receive,

                fee,

                type:req.type,

                status:"approved",

                txid:null,

                created_at:
                    new Date().toISOString()

            });


        if(txError){

            throw txError;

        }


        /* =================================
           UPDATE WITHDRAW REQUEST
        ================================= */

        const {
            error:updateError
        } = await supabaseClient

            .from("withdraw_requests")

            .update({

                status:"approved"

            })

            .eq("id",id);


        if(updateError){

            throw updateError;

        }


        /* =================================
           V4 — INSTANT PAGE REFRESH
           
           IMPORTANT:
           Reload happens ONLY after both
           database operations succeed.
        ================================= */

        refreshAdminWalletNow();

    }

    catch(error){

        console.error(
            "Approve Request Error:",
            error
        );


        if(button){

            button.disabled = false;

            button.innerHTML = `
                <svg
                    class="withdraw-svg"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <circle
                        cx="12"
                        cy="12"
                        r="9">
                    </circle>

                    <path
                        d="m8 12 2.5 2.5L16 9">
                    </path>
                </svg>

                <span>Approve</span>
            `;

        }


        showAlert(
            "Approve Failed",
            error.message,
            "error"
        );

    }

     }

/* =========================================
   REJECT REQUEST
========================================= */

async function rejectRequest(id,button){

    try{

        if(button){

            button.disabled = true;

            button.innerHTML = `
                <svg
                    class="withdraw-svg withdraw-spinner"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <circle
                        cx="12"
                        cy="12"
                        r="9">
                    </circle>

                    <path
                        d="M12 3a9 9 0 0 1 9 9">
                    </path>
                </svg>

                <span>Rejecting...</span>
            `;

        }


        const {
            error
        } = await supabaseClient

            .from("withdraw_requests")

            .update({

                status:"rejected",

                processed_at:
                    new Date().toISOString()

            })

            .eq("id",id);


        if(error){

            throw error;

        }


        /* =================================
           V4 — INSTANT PAGE REFRESH
        ================================= */

        refreshAdminWalletNow();

    }

    catch(error){

        console.error(
            "Reject Request Error:",
            error
        );


        if(button){

            button.disabled = false;

            button.innerHTML = `
                <svg
                    class="withdraw-svg"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <circle
                        cx="12"
                        cy="12"
                        r="9">
                    </circle>

                    <path
                        d="m9 9 6 6M15 9l-6 6">
                    </path>
                </svg>

                <span>Reject</span>
            `;

        }


        showAlert(
            "Reject Failed",
            error.message,
            "error"
        );

    }

}

/* =========================================
   PAY REQUEST
========================================= */

async function payRequest(id, button){

try{

if(button){

button.disabled = true;
button.innerHTML = "⏳ Processing...";

}

/* Call Payment API */

const response = await fetch(

"https://test-albukhr-api.onrender.com/pay-withdraw",

{

method:"POST",

headers:{

"Content-Type":"application/json"

},

body:JSON.stringify({

requestId:id

})

}

);

const result = await response.json();

if(!result.success){

throw new Error(

result.error ||

"Payment failed."

);

}

/* Load Request */

const { data:req, error } =

await supabaseClient

.from("withdraw_requests")

.select("*")

.eq("id",id)

.single();

if(error || !req){

throw new Error(

"Request not found."

);

}

/* Mark Reward */

if(req.type==="reward"){

const paid =

await markRewardAsPaid(

req.userid,

req.project,

Number(req.amount)+

Number(req.fee||0)

);

if(paid.error){

throw new Error(

paid.error

);

}

}

/* Mark Capital */

if(req.type==="capital"){

const paid =

await markCapitalAsPaid(

req.userid,

req.project,

Number(req.amount)+

Number(req.fee||0)

);

if(paid.error){

throw new Error(

paid.error

);

}

}

/* Update Withdraw */

const { error:updateError } =

await supabaseClient

.from("withdraw_requests")

.update({

status:"paid",

txid:

result.txid ||

result.transactionId ||

null,

processed_at:

new Date().toISOString()

})

.eq("id",id);

if(updateError){

throw updateError;

}

showAlert(

"Payment Complete",

"Withdraw has been paid successfully.",

"success"

);

removeWithdrawCard(button);
   
await refreshWithdrawSections();

renderTreasuryOverview();

loadAnalytics();

loadRecentTransactions();

}catch(error){

console.error(error);

if(button){

button.disabled = false;

button.innerHTML =

"💸 Pay Now";

}

showAlert(

"Payment Failed",

error.message,

"error"

);

}

}

/* =========================================
   MARK REWARD AS PAID
========================================= */

async function markRewardAsPaid(userid, project, amount){

let remaining = Number(amount);

const { data: stakes, error } =

await supabaseClient

.from("stakes")

.select("*")

.eq("userid", userid)

.eq("project", project)

.order("created_at",{ ascending:true });

if(error){

return {

error:error.message

};

}

for(const stake of (stakes || [])){

const reward =
Number(stake.reward) || 0;

const withdrawn =
Number(stake.withdrawnReward) || 0;

const available =
reward - withdrawn;

if(available <= 0){

continue;

}

const take =
Math.min(remaining, available);

const { error:updateError } =

await supabaseClient

.from("stakes")

.update({

withdrawnReward:

withdrawn + take

})

.eq("id", stake.id);

if(updateError){

return {

error:updateError.message

};

}

remaining -= take;

if(remaining <= 0){

break;

}

}

if(remaining > 0){

return {

error:"Insufficient reward balance."

};

}

return {

success:true

};

}

/* =========================================
   MARK CAPITAL AS PAID
========================================= */

async function markCapitalAsPaid(userid, project, amount){

let remaining = Number(amount);

const { data: stakes, error } =

await supabaseClient

.from("stakes")

.select("*")

.eq("userid", userid)

.eq("project", project)

.order("created_at",{ ascending:true });

if(error){

return {

error:error.message

};

}

for(const stake of (stakes || [])){

const capital =
Number(stake.amount) || 0;

const withdrawn =
Number(stake.withdrawnCapital) || 0;

const available =
capital - withdrawn;

if(available <= 0){

continue;

}

const take =
Math.min(remaining, available);

const { error:updateError } =

await supabaseClient

.from("stakes")

.update({

withdrawnCapital:

withdrawn + take

})

.eq("id", stake.id);

if(updateError){

return {

error:updateError.message

};

}

remaining -= take;

if(remaining <= 0){

break;

}

}

if(remaining > 0){

return {

error:"Insufficient capital balance."

};

}

return {

success:true

};

  }
