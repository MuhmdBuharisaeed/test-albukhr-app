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

/* =========================================
   HERO
========================================= */

const user =
AlbukhrEcosystem.currentUser?.() || {};

document.getElementById(
"heroUserName"
).innerText =

user.username ||
user.name ||
"Investor";

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

/* HERO PORTFOLIO */

const heroPortfolio =
document.getElementById(
"heroPortfolio"
);

if(heroPortfolio){

heroPortfolio.innerText =
totalPortfolio.toFixed(2) + " Pi";

}

const todayProfit =
document.getElementById("todayProfit");

if(todayProfit){

todayProfit.innerHTML =
`+${totalEarn.toFixed(2)} Pi`;

}

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

<div class="investment-top">

    <div class="investment-project">

        <div class="investment-icon">

            <img src="images/projects/default.png"
                 alt="${project}">

        </div>

        <div>

            <div class="investment-name">
                ${project}
            </div>

            <div class="investment-status">

                <span class="status-dot">
                    ● Active
                </span>

                <span class="project-badge">
                    Core Project
                </span>

            </div>

        </div>

    </div>

    <div class="investment-profit">

        <b>
            ${data.earn.toFixed(2)} Pi
        </b>

        <span>
            Current Earnings
        </span>

    </div>

</div>

<div class="investment-grid">

    <div>

        <span>Invested</span>

        <b>
            ${data.invest.toFixed(2)} Pi
        </b>

    </div>

    <div>

        <span>Earnings</span>

        <b>
            ${data.earn.toFixed(2)} Pi
        </b>

    </div>

    <div>

        <span>ROI</span>

        <b>
            ${
                data.invest > 0
                ? ((data.earn / data.invest) * 100).toFixed(2)
                : "0.00"
            }%
        </b>

    </div>

    <div>

        <span>Records</span>

        <b>${data.count}</b>

    </div>

</div>

<div class="progress-header">

    <span>
        Project Progress
    </span>

    <span>85%</span>

</div>

<div class="investment-progress">

    <div
        class="investment-progress-bar"
        style="width:85%">
    </div>

</div>

<button
class="investment-btn"
onclick="location.href='project.html?project=${encodeURIComponent(project)}'">

View Details →

</button>

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

/* =====================================
   ALBUKHR PREMIUM HERO
===================================== */

let portfolioVisible = true;

/* Greeting */

(function(){

const greeting =
document.getElementById("greetingText");

if(greeting){

const hour = new Date().getHours();

if(hour < 12){

greeting.textContent =
"Good Morning,";

}else if(hour < 18){

greeting.textContent =
"Good Afternoon,";

}else{

greeting.textContent =
"Good Evening,";

}

}

})();

/* Balance Toggle */

const eyeBtn =
document.getElementById("toggleBalance");

if(eyeBtn){

eyeBtn.onclick = ()=>{

const balance =
document.getElementById("heroPortfolio");

portfolioVisible =
!portfolioVisible;

if(portfolioVisible){

renderInvestorDashboard();

eyeBtn.innerHTML =
'<i class="fa-solid fa-eye"></i>';

}else{

balance.textContent =
"••••••";

eyeBtn.innerHTML =
'<i class="fa-solid fa-eye-slash"></i>';

}

};

}
