/* =========================================
   ALBUKHR SMART LIQUIDITY ENGINE v2
   Liquidity + Reward Funding Engine
========================================= */

const TREASURY_KEY = "albukhr_project_treasury_v2";
const RESERVE_PERCENT = 0.30;
const MIN_PROJECT_LIQUIDITY = 100;

/* =========================================
   SAFE STORAGE
========================================= */

function getTreasury(){

  try{
    return JSON.parse(
      localStorage.getItem(TREASURY_KEY)
    ) || {};
  }catch{
    return {};
  }

}

function saveTreasury(data){

  localStorage.setItem(
    TREASURY_KEY,
    JSON.stringify(data)
  );

}

/* =========================================
   CREATE PROJECT TREASURY
========================================= */

function createProjectTreasury(project){

  const treasury = getTreasury();

  if(!treasury[project]){

    treasury[project] = {
      liquidity:0,
      created:Date.now()
    };

    saveTreasury(treasury);
  }

}

/* =========================================
   ADD LIQUIDITY (PROJECT OWNER)
========================================= */

function addProjectLiquidity(project, amount){

  amount = Number(amount);

  if(!amount || amount <= 0){
    return {error:"Invalid liquidity amount"};
  }

  const treasury = getTreasury();

  if(!treasury[project]){
    createProjectTreasury(project);
  }

  treasury[project].liquidity += amount;

  saveTreasury(treasury);

  if(typeof recordTransaction === "function"){
    recordTx({
      type:"liquidity-add",
      project,
      amount
    });
  }

  return {
    success:true,
    liquidity:treasury[project].liquidity
  };

}

/* =========================================
   LIQUIDITY CHECK
========================================= */

function checkProjectLiquidity(project, amount){

  const treasury = getTreasury();

  if(!treasury[project]) return false;

  return treasury[project].liquidity >= Number(amount);

}

/* =========================================
   RESERVE PROTECTION
========================================= */

function canUseLiquidity(project, amount){

  const treasury = getTreasury();

  if(!treasury[project]) return false;

  const liquidity = treasury[project].liquidity;

  const reserve = liquidity * RESERVE_PERCENT;

  if(amount > (liquidity - reserve)){
    return false;
  }

  return true;

}

/* =========================================
   FUND REWARD FROM TREASURY
========================================= */

function fundRewardFromLiquidity(project, amount){

  amount = Number(amount);

  const treasury = getTreasury();

  if(!treasury[project]){
    return {error:"Project treasury missing"};
  }

  if(!canUseLiquidity(project, amount)){
    return {error:"Liquidity reserve protection"};
  }

  treasury[project].liquidity -= amount;

  if(treasury[project].liquidity < 0){
    treasury[project].liquidity = 0;
  }

  saveTreasury(treasury);

  if(typeof recordTransaction === "function"){
    recordTx({
      type:"reward-funding",
      project,
      amount
    });
  }

  return {
    success:true,
    funded:amount
  };

}

/* =========================================
   AUTO REWARD DISTRIBUTION
========================================= */

function distributeProjectRewards(project){

  if(typeof getAllStakesMerged !== "function")
    return;

  const stakes =
  getAllStakesMerged()
  .filter(s => s.project === project);

  if(!stakes.length) return;

  stakes.forEach(stake => {

    const reward =
    (Number(stake.amount) || 0) * 0.02;

    const funding =
    fundRewardFromLiquidity(project, reward);

    if(!funding.error){

      if(typeof recordTransaction === "function"){
        recordTx({
          type:"auto-reward",
          project,
          amount:reward,
          stakeId:stake.id
        });
      }

    }

  });

}

/* =========================================
   TREASURY STATUS
========================================= */

function getProjectTreasuryStatus(project){

  const treasury = getTreasury();

  if(!treasury[project]){
    return {
      liquidity:0,
      reserve:0
    };
  }

  const liquidity = treasury[project].liquidity;

  const reserve = liquidity * RESERVE_PERCENT;

  return {
    liquidity,
    reserve
  };

                          }

/* =========================================
   INTERNAL WITHDRAW (PROJECT OWNER)
========================================= */

function projectInternalWithdraw(project, amount){

amount = Number(amount);

/* BASIC VALIDATION */

if(!amount || amount <= 0){
return {error:"Invalid withdraw amount"};
}

const treasury = getTreasury();

if(!treasury[project]){
return {error:"Project treasury missing"};
}

/* RESERVE PROTECTION */

if(!canUseLiquidity(project, amount)){
return {error:"Reserve protection active"};
}

/* MINIMUM LIQUIDITY PROTECTION */

if(
treasury[project].liquidity - amount 
< MIN_PROJECT_LIQUIDITY
){
return {error:"Minimum liquidity protection"};
}

/* ANTI RUG PROTECTION */

if(typeof checkRugRisk === "function"){

const risk = checkRugRisk(project, amount);

if(!risk.allowed){
return {error:risk.reason};
}

}

/* EXECUTE WITHDRAW */

treasury[project].liquidity -= amount;

if(treasury[project].liquidity < 0){
treasury[project].liquidity = 0;
}

saveTreasury(treasury);

/* RECORD TRANSACTION */

if(typeof recordTransaction === "function"){
recordTx({
type:"internal-withdraw",
project,
amount
});
}

return {
success:true,
liquidity:treasury[project].liquidity
};

}

/* ===============================
MINIMUM LIQUIDITY
=============================== */
function hasMinimumLiquidity(project){

const status =
getProjectTreasuryStatus(project);

let liquidity = Number(status.liquidity || 0);

/* CORE PROJECT AUTO LIQUIDITY */

const CORE_PROJECTS = [
"Barsh",
"Labbaika",
"Raheem",
"Urban",
"Khairat",
"Azman",
"Hauwal"
];

if(CORE_PROJECTS.includes(project)){
liquidity = Math.max(liquidity,100);
}

return liquidity >= MIN_PROJECT_LIQUIDITY;

}
