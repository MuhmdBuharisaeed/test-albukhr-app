/* =========================================
   ALBUKHR ADMIN TRANSACTIONS v3
========================================= */

/* =========================================
   GET WALLET PAYMENTS
========================================= */

async function getWalletPayments(){

try{

const response = await fetch(

`https://api.testnet.minepi.com/accounts/${ALBUKHR_WALLET}/payments?limit=20&order=desc`

);

if(!response.ok){

throw new Error("Unable to fetch payments.");

}

const data = await response.json();

return data?._embedded?.records || [];

}catch(error){

console.error(

"Payments Error:",

error

);

return [];

}

}

/* =========================================
   SHORT WALLET
========================================= */

function shortWallet(wallet=""){

if(wallet.length <= 14){

return wallet;

}

return `${wallet.slice(0,6)}...${wallet.slice(-6)}`;

}

/* =========================================
   FORMAT DATE
========================================= */

function formatDate(date){

return new Date(date)

.toLocaleString([],{

dateStyle:"medium",

timeStyle:"short"

});

}

/* =========================================
   LOAD RECENT TRANSACTIONS
========================================= */

async function loadRecentTransactions(){

const box =

document.getElementById(

"adminTxList"

);

if(!box) return;

box.innerHTML =

`<div class="empty-state">

Loading transactions...

</div>`;

const records =

await getWalletPayments();

if(!records.length){

box.innerHTML =

`<div class="empty-state">

<div class="icon">

📭

</div>

<h4>

No Transactions

</h4>

<p>

No wallet activity found.

</p>

</div>`;

return;

}

box.innerHTML = "";

records.forEach(tx=>{

const sent =

tx.from === ALBUKHR_WALLET;

const amount =

Number(tx.amount) || 0;

const asset =

tx.asset_type==="native"

? "Pi"

: (tx.asset_code || "");

const wallet =

sent ? tx.to : tx.from;

const icon =

sent ? "📤" : "📥";

const title =

sent ? "Sent" : "Received";

const amountColor =

sent

? "#e53935"

: "#18a558";

const card =

document.createElement("div");

card.className =

"tx-card";

card.innerHTML = `

<div class="tx-left">

<div class="tx-icon">

${icon}

</div>

<div class="tx-info">

<div class="tx-title">

${title}

</div>

<div class="tx-meta">

${shortWallet(wallet)}

</div>

<div class="tx-meta">

${formatDate(tx.created_at)}

</div>

</div>

</div>

<div class="tx-right">

<div

class="tx-amount"

style="color:${amountColor};">

${amount.toFixed(2)} ${asset}

</div>

<div class="tx-time">

${shortWallet(tx.id)}

</div>

</div>

`;

box.appendChild(card);

});

}
