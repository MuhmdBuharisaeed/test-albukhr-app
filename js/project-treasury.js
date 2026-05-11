/* =====================================
   ALBUKHR PROJECT TREASURY ENGINE v1
===================================== */

const TREASURY_KEY = "albukhr_project_treasury_v1";

/* ===== STORAGE ===== */

function getTreasury(){
  try{
    return JSON.parse(localStorage.getItem(TREASURY_KEY)) || {};
  }catch{
    return {};
  }
}

function saveTreasury(data){
  localStorage.setItem(TREASURY_KEY, JSON.stringify(data));
}

/* ===== ENSURE PROJECT ===== */

function ensureProject(project){

  const treasury = getTreasury();

  if(!treasury[project]){
    treasury[project] = {
      liquidity:0,
      withdrawn:0,
      transactions:[]
    };
  }

  saveTreasury(treasury);

}

/* =====================================
   ADD LIQUIDITY
===================================== */

function addProjectLiquidity(project, amount){

  amount = Number(amount);

  if(!amount || amount <= 0){
    return {error:"Invalid liquidity amount"};
  }

  const treasury = getTreasury();

  ensureProject(project);

  treasury[project].liquidity += amount;

  treasury[project].transactions.push({
    type:"liquidity-add",
    amount:amount,
    timestamp:Date.now()
  });

  saveTreasury(treasury);

  return {success:true};

}

/* =====================================
   INTERNAL WITHDRAW
===================================== */

function projectInternalWithdraw(project, amount){

  amount = Number(amount);

  if(!amount || amount <= 0){
    return {error:"Invalid withdraw amount"};
  }

  const treasury = getTreasury();

  ensureProject(project);

  if(amount > treasury[project].liquidity){
    return {error:"Insufficient project liquidity"};
  }

  treasury[project].liquidity -= amount;
  treasury[project].withdrawn += amount;

  treasury[project].transactions.push({
    type:"internal-withdraw",
    amount:amount,
    timestamp:Date.now()
  });

  saveTreasury(treasury);

  return {success:true};

}

/* =====================================
   GET BALANCE
===================================== */

function getProjectLiquidity(project){

  const treasury = getTreasury();

  if(!treasury[project]) return 0;

  return treasury[project].liquidity;

}

/* =====================================
   TRANSACTION HISTORY
===================================== */

function getProjectTreasuryHistory(project){

  const treasury = getTreasury();

  if(!treasury[project]) return [];

  return treasury[project].transactions
    .sort((a,b)=>b.timestamp-a.timestamp);

}
