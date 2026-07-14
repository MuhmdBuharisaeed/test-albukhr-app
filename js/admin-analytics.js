/* =========================================
   ALBUKHR ADMIN ANALYTICS
========================================= */

async function loadAnalytics(){

try{

const payments =
await getWalletPayments() || [];

let received = 0;

let sent = 0;

let totalFees = 0;

/* Fees */

const { data: fees } =
await supabaseClient

.from("transactions")

.select("fee")

.eq("status","paid");

(fees || []).forEach(tx=>{

totalFees +=
Number(tx.fee) || 0;

});

/* Payments */

payments.forEach(tx=>{

const amount =
Number(tx.amount) || 0;

if(tx.to === ALBUKHR_WALLET){

received += amount;

}else if(tx.from === ALBUKHR_WALLET){

sent += amount;

}

});

renderAnalytics({

received,

sent,

totalTransactions:
payments.length,

netFlow:
received - sent,

totalFees

});

}catch(error){

console.error(

"Analytics Error:",

error

);

}

}

/* =========================================
   RENDER ANALYTICS
========================================= */

function renderAnalytics(data){

const receivedBox =
document.getElementById("totalReceived");

const sentBox =
document.getElementById("totalSent");

const txBox =
document.getElementById("totalTransactions");

const flowBox =
document.getElementById("netFlow");

const feeBox =
document.getElementById("totalFees");

/* Received */

if(receivedBox){

receivedBox.textContent =

`${data.received.toFixed(2)} Pi`;

}

/* Sent */

if(sentBox){

sentBox.textContent =

`${data.sent.toFixed(2)} Pi`;

}

/* Transactions */

if(txBox){

txBox.textContent =

data.totalTransactions;

}

/* Net Flow */

if(flowBox){

flowBox.textContent =

`${data.netFlow.toFixed(2)} Pi`;

flowBox.style.color =

data.netFlow >= 0

? "#18a558"

: "#e53935";

}

/* Fees */

if(feeBox){

feeBox.textContent =

`${(data.totalFees || 0).toFixed(2)} Pi`;

}

   }
