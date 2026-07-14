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

box.innerHTML =

`<div class="empty-state">

Loading pending requests...

</div>`;

const requests =
await fetchRequests("pending");

if(!requests.length){

renderEmpty(

box,

"No Pending Requests"

);

return;

}

const visible =

WITHDRAW_STATE.pendingExpanded

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

📅 ${formatDate(req.created_at)}

</div>

<span class="status pending">

Pending

</span>

</div>

<div class="withdraw-right">

<div class="withdraw-amount">

${Number(req.amount).toFixed(2)} Pi

</div>

<div class="withdraw-type">

${req.type}

</div>

<div class="withdraw-actions">

<button

class="approve-btn"

onclick="approveRequest('${req.id}')">

✅ Approve

</button>

<button

class="reject-btn"

onclick="rejectRequest('${req.id}')">

❌ Reject

</button>

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

WITHDRAW_STATE.pendingExpanded=

!WITHDRAW_STATE.pendingExpanded;

renderPendingRequests();

">

${

WITHDRAW_STATE.pendingExpanded

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
   RENDER APPROVED REQUESTS
========================================= */

async function renderApprovedRequests(){

const box =
document.getElementById("approvedRequests");

if(!box) return;

box.innerHTML =

`<div class="empty-state">

Loading approved requests...

</div>`;

const requests =
await fetchRequests("approved");

if(!requests.length){

renderEmpty(

box,

"No Approved Requests"

);

return;

}

const visible =

WITHDRAW_STATE.approvedExpanded

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

📅 ${formatDate(req.created_at)}

</div>

<span class="status approved">

Approved

</span>

</div>

<div class="withdraw-right">

<div class="withdraw-amount">

${Number(req.amount).toFixed(2)} Pi

</div>

<div class="withdraw-type">

${req.type}

</div>

<div class="withdraw-actions">

<button

class="pay-btn"

onclick="payRequest('${req.id}',this)">

💸 Pay Now

</button>

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

WITHDRAW_STATE.approvedExpanded=

!WITHDRAW_STATE.approvedExpanded;

renderApprovedRequests();

">

${

WITHDRAW_STATE.approvedExpanded

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

