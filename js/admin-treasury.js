/* =========================================
   ALBUKHR TREASURY OVERVIEW
========================================= */

async function renderTreasuryOverview(){

try{

const balance =
Number(await getWalletBalance()) || 0;

/* Load Pending + Approved Together */

const [

pendingResult,

approvedResult

] = await Promise.all([

supabaseClient
.from("withdraw_requests")
.select("amount")
.eq("status","pending"),

supabaseClient
.from("withdraw_requests")
.select("amount")
.eq("status","approved")

]);

const pendingRows =
pendingResult.data || [];

const approvedRows =
approvedResult.data || [];

const pendingTotal =
pendingRows.reduce(

(sum,row)=>

sum + (Number(row.amount)||0),

0

);

const approvedTotal =
approvedRows.reduce(

(sum,row)=>

sum + (Number(row.amount)||0),

0

);

const availableLiquidity =

balance -

pendingTotal -

approvedTotal;

/* Update Numbers */

const update = (id,value)=>{

const el =
document.getElementById(id);

if(el){

el.textContent = value;

}

};

update(

"adminBalance",

`${balance.toFixed(2)} Pi`

);

update(

"treasuryBalance",

`${balance.toFixed(2)} Pi`

);

update(

"pendingTotal",

`${pendingTotal.toFixed(2)} Pi`

);

update(

"approvedTotal",

`${approvedTotal.toFixed(2)} Pi`

);

update(

"availableLiquidity",

`${availableLiquidity.toFixed(2)} Pi`

);

/* Liquidity Status */

const status =
document.getElementById(
"liquidityStatus"
);

if(status){

if(availableLiquidity <= 20){

status.textContent =
"🔴 CRITICAL";

status.style.color =
"#e53935";

}else if(availableLiquidity <= 100){

status.textContent =
"🟠 WARNING";

status.style.color =
"#f39c12";

}else{

status.textContent =
"🟢 SAFE";

status.style.color =
"#18a558";

}

}

}catch(error){

console.error(

"Treasury Overview Error:",

error

);

}

}
