/* =========================================
   ALBUKHR PROJECT MODERATION ENGINE v2
   Testnet → Mainnet Ready
========================================= */

(function(window){

"use strict";

const ProjectModeration = {};

/* =========================================
   CONFIG
========================================= */

const MIN_LIQUIDITY = 100;
const MAX_RISK_SCORE = 75;
const MAX_REWARD_RATE = 0.20;

/* =========================================
   EVALUATE PROJECT
========================================= */

ProjectModeration.evaluate = async function(projectCode){

if(!projectCode){
return null;
}

/* LOAD PROJECT */

const project =
await AlbukhrMarketplace.getProject(projectCode);

if(!project){
return null;
}

/* RISK */

const risk =
project.risk || {
risk:"HIGH",
score:0
};

/* TREASURY */

const liquidity =
Number(project.liquidity)||0;

/* REWARD */

const rewardRate =
Number(project.rewardRate)||0;

/* INVESTORS */

const investors =
Number(project.investors)||0;

/* STAKE */

const totalStake =
Number(project.totalStake)||0;

/* FLAGS */

const flags=[];

/* LIQUIDITY */

if(liquidity < MIN_LIQUIDITY){

flags.push({

code:"LOW_LIQUIDITY",

message:
"Project liquidity is below minimum."

});

}

/* ROI */

if(rewardRate > MAX_REWARD_RATE){

flags.push({

code:"HIGH_REWARD",

message:
"Reward rate exceeds safe limit."

});

}

/* RISK */

if(risk.score < MAX_RISK_SCORE){

flags.push({

code:"HIGH_RISK",

message:
"Project risk is above acceptable level."

});

}

/* STATUS */

let status="approved";

if(flags.length){

status="review";

}

if(
risk.risk==="HIGH" &&
liquidity<MIN_LIQUIDITY
){

status="blocked";

}

/* RETURN */

return{

code:project.code,

title:project.title,

status,

flags,

liquidity,

rewardRate,

investors,

totalStake,

risk,

score:risk.score

};

};

/* =========================================
   EVALUATE ALL PROJECTS
========================================= */

ProjectModeration.evaluateAll =
async function(){

const projects =
await AlbukhrMarketplace.getProjects();

const results=[];

for(const project of projects){

results.push(

await ProjectModeration.evaluate(
project.code
)

);

}

return results;

};

/* =========================================
   APPROVED
========================================= */

ProjectModeration.getApproved =
async function(){

const list =
await ProjectModeration.evaluateAll();

return list.filter(
p=>p.status==="approved"
);

};

/* =========================================
   REVIEW
========================================= */

ProjectModeration.getReviewQueue =
async function(){

const list =
await ProjectModeration.evaluateAll();

return list.filter(
p=>p.status==="review"
);

};

/* =========================================
   BLOCKED
========================================= */

ProjectModeration.getBlocked =
async function(){

const list =
await ProjectModeration.evaluateAll();

return list.filter(
p=>p.status==="blocked"
);

};

/* =========================================
   SUMMARY
========================================= */

ProjectModeration.summary =
async function(){

const list =
await ProjectModeration.evaluateAll();

return{

approved:
list.filter(p=>p.status==="approved").length,

review:
list.filter(p=>p.status==="review").length,

blocked:
list.filter(p=>p.status==="blocked").length,

total:list.length

};

};

window.ProjectModeration =
ProjectModeration;

})(window);
