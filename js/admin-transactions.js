/* ==========================================
   ALBUKHR MAINNET ADMIN WITHDRAW ENGINE
   PART 1
========================================== */

/* ==========================================
   GLOBAL STATE
========================================== */

const NETWORK = "mainnet";

let pendingExpanded = false;
let approvedExpanded = false;
let paidExpanded = false;
let transactionsExpanded = false;

let __loadingPending = false;
let __loadingApproved = false;
let __loadingPaid = false;

/* ==========================================
   HELPERS
========================================== */

function formatPi(value){

return (
Number(value || 0)
.toFixed(2) + " Pi"
);

}

function formatDate(value){

if(!value) return "-";

return new Date(value)
.toLocaleString();

}

function safeHTML(text){

return String(text || "")
.replaceAll("<","&lt;")
.replaceAll(">","&gt;");

}

/* ==========================================
   LOADING
========================================== */

function setLoading(id,text="Loading..."){

const box =
document.getElementById(id);

if(box){

box.innerHTML =
`<small>${text}</small>`;

}

}

/* ==========================================
   FETCH PENDING REQUESTS
========================================== */

async function fetchWithdrawRequests(){

try{

const { data, error } =
await supabaseClient
.from("withdraw_requests")
.select("*")
.eq("network",NETWORK)
.eq("status","pending")
.order("created_at",{
ascending:false
});

if(error){

console.error(error);

return [];

}

return Array.isArray(data)
? data
: [];

}catch(err){

console.error(err);

return [];

}

}

/* ==========================================
   DUPLICATE CHECK
========================================== */

async function requestAlreadyApproved(id){

const { data } =
await supabaseClient
.from("withdraw_requests")
.select("status")
.eq("id",id)
.single();

if(!data) return false;

return (
data.status==="approved" ||
data.status==="paid"
);

}

/* ==========================================
   RENDER PENDING REQUESTS
   PART 2
========================================== */

async function renderPendingRequests(){

if(__loadingPending) return;

__loadingPending = true;

setLoading(
"pendingRequests",
"Loading pending requests..."
);

const box =
document.getElementById(
"pendingRequests"
);

const requests =
await fetchWithdrawRequests();

if(!requests.length){

box.innerHTML = `
<div class="tx">
<small>
No pending withdrawal requests.
</small>
</div>
`;

__loadingPending = false;
return;

}

box.innerHTML = "";

const visible =
pendingExpanded
? requests
: requests.slice(0,3);

visible.forEach(req=>{

box.innerHTML += `

<div class="tx">

<strong>
${safeHTML(req.project)}
</strong>

<br>

Type:
${safeHTML(req.type)}

<br>

Amount:
${formatPi(req.amount)}

<br>

Wallet:

<br>

<small>

${safeHTML(req.wallet)}

</small>

<br>

User:

<br>

<small>

${safeHTML(req.userid)}

</small>

<br>

Requested:

<br>

<small>

${formatDate(req.created_at)}

</small>

<br><br>

<button
class="btn unlock"
onclick="approveRequest('${req.id}')">

✅ Approve

</button>

<button
class="btn lock"
onclick="rejectRequest('${req.id}')">

❌ Reject

</button>

</div>

`;

});

/* ===============================
SEE MORE
=============================== */

if(requests.length>3){

box.innerHTML += `

<div
style="
text-align:center;
margin-top:15px;
">

<button
class="btn"

onclick="togglePendingRequests()">

${pendingExpanded
? "Show Less"
: "See More"}

</button>

</div>

`;

}

__loadingPending = false;

}

/* ==========================================
   TOGGLE
========================================== */

function togglePendingRequests(){

pendingExpanded =
!pendingExpanded;

renderPendingRequests();

   }

/* ==========================================
   APPROVE REQUEST
   PART 3
========================================== */

async function approveRequest(id){

try{

const approved =
await requestAlreadyApproved(id);

if(approved){

alert(
"This request has already been processed."
);

return;

}

const { data:req, error } =
await supabaseClient
.from("withdraw_requests")
.select("*")
.eq("id",id)
.eq("network",NETWORK)
.single();

if(error || !req){

alert("Request not found.");

return;

}

/* ===============================
   LOAD USER STAKES
=============================== */

const { data:stakes, error:stakeError } =
await supabaseClient
.from("stakes")
.select("*")
.eq("userid",req.userid)
.eq("project",req.project)
.eq("network",NETWORK);

if(stakeError){

console.error(stakeError);

alert("Unable to verify stake.");

return;

}

/* ===============================
   FRAUD CHECK
=============================== */

if(req.type==="reward"){

let available = 0;

(stakes||[]).forEach(s=>{

available += Math.max(
0,
(Number(s.reward)||0)
-
(Number(s.withdrawnReward)||0)
);

});

if(Number(req.amount)>available){

alert(
"Fraud detected.\nReward exceeds available balance."
);

return;

}

}

if(req.type==="capital"){

let available = 0;

(stakes||[]).forEach(s=>{

available += Math.max(
0,
(Number(s.amount)||0)
-
(Number(s.withdrawnCapital)||0)
);

});

if(Number(req.amount)>available){

alert(
"Fraud detected.\nCapital exceeds available balance."
);

return;

}

}

/* ===============================
   CALCULATE FEE
=============================== */

const fee =
Number(req.amount)*0.01;

const receive =
Number(req.amount)-fee;

/* ===============================
   CREATE TRANSACTION
=============================== */

const { error:txError } =
await supabaseClient
.from("transactions")
.insert({

userid:req.userid,

project:req.project,

wallet:req.wallet,

type:req.type,

amount:receive,

fee:fee,

status:"approved",

network:NETWORK,

txid:null,

created_at:
new Date().toISOString()

});

if(txError){

console.error(txError);

alert(txError.message);

return;

}

/* ===============================
   UPDATE REQUEST
=============================== */

const { error:updateError } =
await supabaseClient
.from("withdraw_requests")
.update({

status:"approved",

fee:fee,

receive:receive

})
.eq("id",id);

if(updateError){

console.error(updateError);

alert(updateError.message);

return;

}

alert("Request Approved Successfully ✅");

await renderPendingRequests();
await renderApprovedRequests();
await renderPaidRequests();

}catch(err){

console.error(err);

alert(err.message);

}

}

/* ==========================================
   REJECT REQUEST
========================================== */

async function rejectRequest(id){

const ok =
confirm(
"Reject this withdrawal request?"
);

if(!ok) return;

const { error } =
await supabaseClient
.from("withdraw_requests")
.update({

status:"rejected"

})
.eq("id",id)
.eq("network",NETWORK);

if(error){

console.error(error);

alert(error.message);

return;

}

alert("Request Rejected.");

await renderPendingRequests();

   }

/* ==========================================
   PART 4
   APPROVED REQUESTS
========================================== */

/* ==========================================
   FETCH APPROVED REQUESTS
========================================== */

async function fetchApprovedRequests(){

try{

const { data, error } =
await supabaseClient
.from("withdraw_requests")
.select("*")
.eq("network",NETWORK)
.eq("status","approved")
.order("created_at",{
ascending:false
});

if(error){

console.error(error);

return [];

}

return Array.isArray(data)
? data
: [];

}catch(err){

console.error(err);

return [];

}

}

/* ==========================================
   RENDER APPROVED
========================================== */

async function renderApprovedRequests(){

if(__loadingApproved) return;

__loadingApproved = true;

setLoading(
"approvedRequests",
"Loading approved requests..."
);

const box =
document.getElementById(
"approvedRequests"
);

const requests =
await fetchApprovedRequests();

if(!requests.length){

box.innerHTML = `
<div class="tx">
<small>
No approved requests.
</small>
</div>
`;

__loadingApproved = false;
return;

}

box.innerHTML = "";

const visible =
approvedExpanded
? requests
: requests.slice(0,3);

visible.forEach(req=>{

box.innerHTML += `

<div class="tx">

<strong>

${safeHTML(req.project)}

</strong>

<br>

Type:
${safeHTML(req.type)}

<br>

Amount:
${formatPi(req.amount)}

<br>

Fee:
${formatPi(req.fee)}

<br>

Receive:
${formatPi(req.receive)}

<br>

Wallet

<br>

<small>

${safeHTML(req.wallet)}

</small>

<br>

Approved:

<br>

<small>

${formatDate(req.updated_at)}

</small>

<br><br>

<button
class="btn unlock"
onclick="payRequest('${req.id}')">

💸 Pay Now

</button>

</div>

`;

});

if(requests.length>3){

box.innerHTML += `

<div
style="
text-align:center;
margin-top:15px;
">

<button
class="btn"

onclick="toggleApprovedRequests()">

${approvedExpanded
? "Show Less"
: "See More"}

</button>

</div>

`;

}

__loadingApproved = false;

}

/* ==========================================
   TOGGLE
========================================== */

function toggleApprovedRequests(){

approvedExpanded =
!approvedExpanded;

renderApprovedRequests();

}

/* ==========================================
   PAY REQUEST
========================================== */

async function payRequest(id){

const ok =
confirm(
"Send Pi payment now?"
);

if(!ok) return;

try{

const response =
await fetch(

"https://albukhr-api.onrender.com/pay-withdraw",

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

const result =
await response.json();

if(!result.success){

alert(
result.error ||
"Payment failed."
);

return;

}

alert(
"Payment sent successfully."
);

await renderPendingRequests();

await renderApprovedRequests();

await renderPaidRequests();

}catch(err){

console.error(err);

alert(err.message);

}

}

/* ==========================================
   PART 5
   PAID REQUESTS
========================================== */

/* ==========================================
   FETCH PAID REQUESTS
========================================== */

async function fetchPaidRequests(){

try{

const { data, error } =
await supabaseClient
.from("withdraw_requests")
.select("*")
.eq("network",NETWORK)
.eq("status","paid")
.order("processed_at",{
ascending:false
});

if(error){

console.error(error);

return [];

}

return Array.isArray(data)
? data
: [];

}catch(err){

console.error(err);

return [];

}

}

/* ==========================================
   RENDER PAID REQUESTS
========================================== */

async function renderPaidRequests(){

if(__loadingPaid) return;

__loadingPaid = true;

setLoading(
"paidRequests",
"Loading paid withdrawals..."
);

const box =
document.getElementById(
"paidRequests"
);

const requests =
await fetchPaidRequests();

if(!requests.length){

box.innerHTML = `
<div class="tx">
<small>
No paid withdrawals.
</small>
</div>
`;

__loadingPaid = false;
return;

}

box.innerHTML = "";

const visible =
paidExpanded
? requests
: requests.slice(0,3);

visible.forEach(req=>{

box.innerHTML += `

<div class="tx">

<strong>

${safeHTML(req.project)}

</strong>

<br>

Type:
${safeHTML(req.type)}

<br>

Amount:
${formatPi(req.amount)}

<br>

Fee:
${formatPi(req.fee)}

<br>

Receive:
${formatPi(req.receive)}

<br>

Wallet

<br>

<small>

${safeHTML(req.wallet)}

</small>

<br>

TXID

<br>

<small
style="
word-break:break-all;
color:#0f7a3d;
">

${safeHTML(req.txid || "-")}

</small>

<br>

Paid At

<br>

<small>

${formatDate(req.processed_at)}

</small>

</div>

`;

});

if(requests.length>3){

box.innerHTML += `

<div
style="
text-align:center;
margin-top:15px;
">

<button
class="btn"
onclick="togglePaidRequests()">

${paidExpanded
? "Show Less"
: "See More"}

</button>

</div>

`;

}

__loadingPaid = false;

}

/* ==========================================
   TOGGLE PAID
========================================== */

function togglePaidRequests(){

paidExpanded =
!paidExpanded;

renderPaidRequests();

                }

/* ==========================================
   PART 6
   REWARD SETTLEMENT ENGINE
========================================== */

async function markRewardAsPaid(
userid,
project,
amount
){

let remaining =
Number(amount);

const { data:stakes, error } =
await supabaseClient
.from("stakes")
.select("*")
.eq("userid",userid)
.eq("project",project)
.eq("network",NETWORK)
.order("created_at",{
ascending:true
});

if(error){

console.error(error);

return{
error:error.message
};

}

if(!stakes?.length){

return{
error:"No reward stakes found."
};

}

for(const stake of stakes){

const reward =
Number(stake.reward)||0;

const withdrawn =
Number(stake.withdrawnReward)||0;

const available =
Math.max(
0,
reward-withdrawn
);

if(available<=0){
continue;
}

const take =
Math.min(
remaining,
available
);

const { error:updateError } =
await supabaseClient
.from("stakes")
.update({

withdrawnReward:
withdrawn+take

})
.eq("id",stake.id)
.eq("network",NETWORK);

if(updateError){

console.error(updateError);

return{
error:updateError.message
};

}

remaining -= take;

if(remaining<=0){
break;
}

}

if(remaining>0){

return{

error:
"Insufficient reward balance."

};

}

return{

success:true

};

}

/* ==========================================
   GET AVAILABLE REWARD
========================================== */

async function getAvailableReward(
userid,
project
){

const { data,error } =
await supabaseClient
.from("stakes")
.select("*")
.eq("userid",userid)
.eq("project",project)
.eq("network",NETWORK);

if(error){

return 0;

}

let total = 0;

(data||[]).forEach(stake=>{

const reward =
Number(stake.reward)||0;

const withdrawn =
Number(
stake.withdrawnReward
)||0;

total += Math.max(
0,
reward-withdrawn
);

});

return total;

}

/* ==========================================
   PART 7
   CAPITAL SETTLEMENT ENGINE
========================================== */

async function markCapitalAsPaid(
userid,
project,
amount
){

let remaining =
Number(amount);

const { data:stakes, error } =
await supabaseClient
.from("stakes")
.select("*")
.eq("userid",userid)
.eq("project",project)
.eq("network",NETWORK)
.order("created_at",{
ascending:true
});

if(error){

console.error(error);

return{
error:error.message
};

}

if(!stakes?.length){

return{
error:"No capital stakes found."
};

}

for(const stake of stakes){

const amountStaked =
Number(stake.amount)||0;

const withdrawn =
Number(
stake.withdrawnCapital
)||0;

const available =
Math.max(
0,
amountStaked-withdrawn
);

/* LOCK CHECK */

const unlockTime =
Number(stake.unlockTime)||0;

if(
unlockTime>0 &&
Date.now()<unlockTime
){

continue;

}

if(available<=0){
continue;
}

const take =
Math.min(
remaining,
available
);

const { error:updateError } =
await supabaseClient
.from("stakes")
.update({

withdrawnCapital:
withdrawn+take

})
.eq("id",stake.id)
.eq("network",NETWORK);

if(updateError){

console.error(updateError);

return{
error:updateError.message
};

}

remaining -= take;

if(remaining<=0){
break;
}

}

if(remaining>0){

return{

error:
"Insufficient unlocked capital."

};

}

return{

success:true

};

}

/* ==========================================
   GET AVAILABLE CAPITAL
========================================== */

async function getAvailableCapital(
userid,
project
){

const { data,error } =
await supabaseClient
.from("stakes")
.select("*")
.eq("userid",userid)
.eq("project",project)
.eq("network",NETWORK);

if(error){

console.error(error);

return 0;

}

let total = 0;

const now = Date.now();

(data||[]).forEach(stake=>{

const unlockTime =
Number(stake.unlockTime)||0;

if(
unlockTime &&
now<unlockTime
){

/* ==========================================
   PART 8
   FINAL PAYMENT SETTLEMENT
========================================== */

async function finalizePaidRequest(
requestId,
txid
){

try{

/* ===============================
LOAD REQUEST
=============================== */

const { data:req, error } =
await supabaseClient
.from("withdraw_requests")
.select("*")
.eq("id",requestId)
.eq("network",NETWORK)
.single();

if(error || !req){

return{
error:
"Withdraw request not found."
};

}

/* ===============================
ALREADY PAID
=============================== */

if(req.status==="paid"){

return{
success:true
};

}

/* ===============================
UPDATE REQUEST
=============================== */

const { error:updateError } =
await supabaseClient
.from("withdraw_requests")
.update({

status:"paid",

txid:txid,

processed_at:
new Date().toISOString()

})
.eq("id",requestId)
.eq("network",NETWORK);

if(updateError){

return{
error:updateError.message
};

}

/* ===============================
UPDATE TRANSACTION
=============================== */

await supabaseClient
.from("transactions")
.update({

status:"paid",

txid:txid,

processed_at:
new Date().toISOString()

})
.eq("userid",req.userid)
.eq("wallet",req.wallet)
.eq("status","approved")
.eq("network",NETWORK);

/* ===============================
SETTLEMENT
=============================== */

if(req.type==="reward"){

const reward =
await markRewardAsPaid(

req.userid,

req.project,

Number(req.amount)+
Number(req.fee||0)

);

if(reward?.error){

return reward;

}

}

if(req.type==="capital"){

const capital =
await markCapitalAsPaid(

req.userid,

req.project,

Number(req.amount)+
Number(req.fee||0)

);

if(capital?.error){

return capital;

}

}

/* ===============================
REFRESH UI
=============================== */

await renderPendingRequests();

await renderApprovedRequests();

await renderPaidRequests();

return{

success:true,

txid

};

}catch(err){

console.error(err);

return{

error:err.message

};

}

}

/* ==========================================
   REFRESH ALL PANELS
========================================== */

async function refreshWithdrawPanels(){

await renderPendingRequests();

await renderApprovedRequests();

await renderPaidRequests();

   }

