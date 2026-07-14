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

/* =========================================
   APPROVE REQUEST
========================================= */

async function approveRequest(id){

try{

const { data:req, error } =

await supabaseClient

.from("withdraw_requests")

.select("*")

.eq("id",id)

.single();

if(error || !req){

showAlert(

"Error",

"Request not found",

"error"

);

return;

}

/* Fraud Check */

const { data:stakes } =

await supabaseClient

.from("stakes")

.select("*")

.eq("userid",req.userid)

.eq("project",req.project);

let totalReward = 0;

(stakes || []).forEach(stake=>{

const reward =

Number(stake.reward || 0);

const withdrawn =

Number(stake.withdrawnReward || 0);

totalReward +=

Math.max(0,reward-withdrawn);

});

if(

req.type==="reward"

&&

Number(req.amount) > totalReward

){

showAlert(

"Fraud Detected",

"Requested reward exceeds available reward.",

"error"

);

return;

}

/* Fee */

const fee =

Number(req.amount) * 0.01;

const receive =

Number(req.amount) - fee;

/* Create Transaction */

const { error:txError } =

await supabaseClient

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

created_at:new Date().toISOString()

});

if(txError){

throw txError;

}

/* Update Request */

const { error:updateError } =

await supabaseClient

.from("withdraw_requests")

.update({

status:"approved"

})

.eq("id",id);

if(updateError){

throw updateError;

}

showAlert(

"Approved",

"Withdraw request approved.",

"success"

);

await refreshWithdrawSections();

renderTreasuryOverview();

loadAnalytics();

}catch(error){

console.error(error);

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

async function rejectRequest(id){

try{

const { error } =

await supabaseClient

.from("withdraw_requests")

.update({

status:"rejected",

processed_at:new Date().toISOString()

})

.eq("id",id);

if(error){

throw error;

}

showAlert(

"Rejected",

"Withdraw request rejected.",

"success"

);

await refreshWithdrawSections();

renderTreasuryOverview();

loadAnalytics();

}catch(error){

console.error(error);

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
