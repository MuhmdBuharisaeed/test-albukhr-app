let lastScroll = 0;
let threshold = 10;

const dock =
document.querySelector(".dock-nav");

window.addEventListener("scroll",()=>{

const current =
window.pageYOffset;

if(Math.abs(current-lastScroll)<=threshold)
return;

if(current > lastScroll){

/* scroll down */
dock.classList.add("hide");

}else{

/* scroll up */
dock.classList.remove("hide");

}

lastScroll = current;

});


const current = location.pathname.split("/").pop();

document.querySelectorAll(".dock-item").forEach(link=>{

if(link.getAttribute("href") === current){

link.classList.add("active");

}

});


async function renderInvestorDashboard(){

const container =
document.getElementById("investments");

container.innerHTML = `
<div class="invest-card"
style="text-align:center;color:#777;">
Loading investments...
</div>
`;

try{

const stakes =
await getAllStakesMerged();

if(!Array.isArray(stakes)){

throw new Error(
"Invalid investment data."
);

}

let totalInvest = 0;
let totalEarn = 0;
let totalPortfolio = 0;

const map = {};

stakes.forEach(s=>{

const amount =
Number(s.amount) || 0;

const reward =
Number(s.reward) || 0;

const withdrawn =
Number(s.withdrawnReward) || 0;

const remaining =
Math.max(0,reward-withdrawn);

const projectName =
(s.project || "Unnamed Project").trim();

totalInvest += amount;

totalPortfolio += amount;

if(s.type==="stake"){

totalEarn += remaining;

}

if(!map[projectName]){

map[projectName]={

invest:0,

earn:0,

status:"Active",

count:0

};

}

map[projectName].invest += amount;

map[projectName].count++;

if(s.type==="stake"){

map[projectName].earn += remaining;

}

});

document.getElementById(
"totalPortfolio"
).innerText =
totalPortfolio.toFixed(2)+" Pi";

document.getElementById(
"totalInvest"
).innerText =
totalInvest.toFixed(2)+" Pi";

document.getElementById(
"totalEarn"
).innerText =
totalEarn.toFixed(2)+" Pi";

document.getElementById(
"totalProjects"
).innerText =
Object.keys(map).length;

container.innerHTML="";

if(Object.keys(map).length===0){

container.innerHTML=`

<div class="invest-card"
style="text-align:center;">

<h3>No investments yet</h3>

<p style="color:#666;">

Start by exploring
approved projects.

</p>

<button
class="wallet-btn"
onclick="location.href='marketplace.html'">

Explore Marketplace

</button>

</div>

`;

return;

}

Object.entries(map).forEach(

([project,data])=>{

const card =
document.createElement("div");

card.className =
"invest-card";

card.innerHTML = `

<div class="invest-header">

<div>${project}</div>

<div style="
color:#0f7a3d;
font-weight:700;">

${data.earn.toFixed(2)} Pi

</div>

</div>

<div class="row">

<div>Invested</div>

<div>

${data.invest.toFixed(2)} Pi

</div>

</div>

<div class="row">

<div>Earnings</div>

<div style="
color:#0f7a3d;">

${data.earn.toFixed(2)} Pi

</div>

</div>

<div class="row">

<div>Status</div>

<div style="
color:#1c7c3f;
font-weight:700;">

${data.status}

</div>

</div>

<div class="row">

<div>Records</div>

<div>

${data.count}

</div>

</div>

<div
style="
margin-top:12px;
">

<div
style="
font-size:12px;
margin-bottom:6px;
color:#777;
">

Investment Progress

</div>

<div
style="
height:8px;
background:#e5e5e5;
border-radius:999px;
overflow:hidden;
">

<div
style="
width:100%;
height:100%;
background:#0f7a3d;
">

</div>

</div>

</div>

`;

container.appendChild(card);

});

}catch(error){

console.error(
"Investor Dashboard Error:",
error
);

container.innerHTML = `

<div class="invest-card"
style="text-align:center;">

<h3>

Unable to load investments

</h3>

<p
style="color:#666;">

Please check your
internet connection
or try again later.

</p>

<button
class="wallet-btn"
onclick="renderInvestorDashboard()">

Retry

</button>

</div>

`;

}

}

renderInvestorDashboard();
