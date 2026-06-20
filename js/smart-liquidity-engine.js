/* =========================================
   ALBUKHR SMART LIQUIDITY ENGINE v3 FINAL
   Supabase Treasury + Rule Protection Layer
========================================= */

/*
  DEPENDS ON:
  1) projects-engine.js
  2) project-treasury.js

  REQUIRED FUNCTIONS FROM projects-engine.js:
  - getProjectMeta(projectCode)
  - getProjectRules(projectCode)
  - isProjectActive(projectCode)

  REQUIRED FUNCTIONS FROM project-treasury.js:
  - getProjectTreasury(projectCode)
  - addProjectLiquidity(projectCode, amount, meta)
  - projectInternalWithdraw(projectCode, amount, meta)
  - fundRewardFromTreasury(projectCode, amount, meta)
*/

/* =========================================
   GLOBAL DEFAULTS
========================================= */
const DEFAULT_RESERVE_PERCENT = 0.30;
const DEFAULT_MIN_PROJECT_LIQUIDITY = 100;

/* =========================================
   SAFE HELPERS
========================================= */
function liquiditySafeNumber(value, fallback = 0){
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function liquiditySafeString(value, fallback = ""){
  if(value === null || value === undefined){
    return fallback;
  }
  return String(value);
}

/* =========================================
   ASSERT DEPENDENCIES
========================================= */
function assertLiquidityDependencies(){

  if(typeof getProjectMeta !== "function"){
    throw new Error(
      "projects-engine.js must be loaded before smart-liquidity-engine.js"
    );
  }

  if(typeof getProjectRules !== "function"){
    throw new Error(
      "getProjectRules() is missing from projects-engine.js"
    );
  }

  if(typeof isProjectActive !== "function"){
    throw new Error(
      "isProjectActive() is missing from projects-engine.js"
    );
  }

  if(typeof getProjectTreasury !== "function"){
    throw new Error(
      "project-treasury.js must be loaded before smart-liquidity-engine.js"
    );
  }

  if(typeof addProjectLiquidity !== "function"){
    throw new Error(
      "addProjectLiquidity() is missing from project-treasury.js"
    );
  }

  if(typeof projectInternalWithdraw !== "function"){
    throw new Error(
      "projectInternalWithdraw() is missing from project-treasury.js"
    );
  }

  if(typeof fundRewardFromTreasury !== "function"){
    throw new Error(
      "fundRewardFromTreasury() is missing from project-treasury.js"
    );
  }

}

/* =========================================
   GET PROJECT RULES (NORMALIZED)
========================================= */
async function getLiquidityProjectRules(projectCode){

  assertLiquidityDependencies();

  const meta = await getProjectMeta(projectCode);

  if(!meta){
    return null;
  }

  let rules = {};

  try{
    rules = await getProjectRules(projectCode);
  }catch(e){
    console.warn("getProjectRules failed:", e);
    rules = {};
  }

  const reservePercent = liquiditySafeNumber(
    rules.reserve_percent,
    liquiditySafeNumber(meta.reserve_percent, DEFAULT_RESERVE_PERCENT)
  );

  const minLiquidity = liquiditySafeNumber(
    rules.min_liquidity,
    liquiditySafeNumber(meta.min_liquidity, DEFAULT_MIN_PROJECT_LIQUIDITY)
  );

  const rewardRate = liquiditySafeNumber(
    rules.reward_rate,
    liquiditySafeNumber(meta.reward_rate, 0)
  );

  return {
    project_code: meta.project_code,
    project_name: meta.project_name,
    project_type: meta.project_type || "core",
    status: meta.status || "active",
    reserve_percent: reservePercent,
    min_liquidity: minLiquidity,
    reward_rate: rewardRate
  };

}

/* =========================================
   GET PROJECT LIQUIDITY STATUS
========================================= */
async function getProjectTreasuryStatus(projectCode){

  assertLiquidityDependencies();

  const rules = await getLiquidityProjectRules(projectCode);

  if(!rules){
    return {
      error:`Project not found: ${projectCode}`
    };
  }

  const treasury = await getProjectTreasury(projectCode);

  if(!treasury || treasury.error){
    return {
      error: treasury?.error || "Treasury not available"
    };
  }

  const liquidity =
    liquiditySafeNumber(treasury.liquidity_balance, 0);

  const reserve =
    liquidity * liquiditySafeNumber(rules.reserve_percent, DEFAULT_RESERVE_PERCENT);

  const minLiquidity =
    liquiditySafeNumber(rules.min_liquidity, DEFAULT_MIN_PROJECT_LIQUIDITY);

  const usableAfterReserve =
    Math.max(0, liquidity - reserve);

  const usableAfterMinimum =
    Math.max(0, liquidity - minLiquidity);

  const maxUsable =
    Math.max(0, Math.min(usableAfterReserve, usableAfterMinimum));

  return {
    success:true,
    project_code: rules.project_code,
    project_name: rules.project_name,
    project_type: rules.project_type,
    project_status: rules.status,
    liquidity,
    reserve,
    reserve_percent: rules.reserve_percent,
    min_liquidity: minLiquidity,
    usable_after_reserve: usableAfterReserve,
    usable_after_minimum: usableAfterMinimum,
    max_usable_liquidity: maxUsable,
    reward_rate: rules.reward_rate,
    treasury
  };

}

/* =========================================
   CHECK PROJECT LIQUIDITY
========================================= */
async function checkProjectLiquidity(projectCode, amount){

  amount = liquiditySafeNumber(amount, 0);

  if(!projectCode || amount <= 0){
    return false;
  }

  const status = await getProjectTreasuryStatus(projectCode);

  if(status.error){
    return false;
  }

  return liquiditySafeNumber(status.liquidity, 0) >= amount;

}

/* =========================================
   HAS MINIMUM LIQUIDITY
========================================= */
async function hasMinimumLiquidity(projectCode){

  const status = await getProjectTreasuryStatus(projectCode);

  if(status.error){
    return false;
  }

  return liquiditySafeNumber(status.liquidity, 0) >=
         liquiditySafeNumber(status.min_liquidity, DEFAULT_MIN_PROJECT_LIQUIDITY);

}

/* =========================================
   CAN USE LIQUIDITY
   Checks reserve + minimum liquidity protection
========================================= */
async function canUseLiquidity(projectCode, amount){

  amount = liquiditySafeNumber(amount, 0);

  if(!projectCode || amount <= 0){
    return {
      allowed:false,
      reason:"Invalid amount"
    };
  }

  const active = await isProjectActive(projectCode);

  if(!active){
    return {
      allowed:false,
      reason:"Project is not active"
    };
  }

  const status = await getProjectTreasuryStatus(projectCode);

  if(status.error){
    return {
      allowed:false,
      reason:status.error
    };
  }

  const liquidity =
    liquiditySafeNumber(status.liquidity, 0);

  const reserve =
    liquiditySafeNumber(status.reserve, 0);

  const minLiquidity =
    liquiditySafeNumber(status.min_liquidity, DEFAULT_MIN_PROJECT_LIQUIDITY);

  const balanceAfter = liquidity - amount;

  if(amount > liquidity){
    return {
      allowed:false,
      reason:"Insufficient project liquidity"
    };
  }

  // reserve protection
  if(balanceAfter < reserve){
    return {
      allowed:false,
      reason:"Liquidity reserve protection"
    };
  }

  // minimum liquidity protection
  if(balanceAfter < minLiquidity){
    return {
      allowed:false,
      reason:"Minimum liquidity protection"
    };
  }

  return {
    allowed:true,
    reason:"",
    liquidity,
    reserve,
    min_liquidity:minLiquidity,
    balance_after:balanceAfter
  };

}

/* =========================================
   SAFE ADD PROJECT LIQUIDITY
========================================= */
async function safeAddProjectLiquidity(projectCode, amount, meta = {}){

  amount = liquiditySafeNumber(amount, 0);

  if(!projectCode){
    return { error:"Project code is required" };
  }

  if(amount <= 0){
    return { error:"Invalid liquidity amount" };
  }

  const active = await isProjectActive(projectCode);

  if(!active){
    return { error:"Project is not active" };
  }

  return await addProjectLiquidity(projectCode, amount, meta);

}

/* =========================================
   SAFE INTERNAL WITHDRAW
========================================= */
async function safeProjectInternalWithdraw(projectCode, amount, meta = {}){

  amount = liquiditySafeNumber(amount, 0);

  if(!projectCode){
    return { error:"Project code is required" };
  }

  if(amount <= 0){
    return { error:"Invalid withdraw amount" };
  }

  const active = await isProjectActive(projectCode);

  if(!active){
    return { error:"Project is not active" };
  }

  const guard = await canUseLiquidity(projectCode, amount);

  if(!guard.allowed){
    return { error:guard.reason };
  }

  /* OPTIONAL RUG-RISK HOOK */
  if(typeof checkRugRisk === "function"){
    try{
      const risk = await checkRugRisk(projectCode, amount);

      if(risk && risk.allowed === false){
        return {
          error:risk.reason || "Withdraw blocked by risk engine"
        };
      }
    }catch(e){
      console.warn("checkRugRisk failed:", e);
    }
  }

  return await projectInternalWithdraw(projectCode, amount, meta);

}

/* =========================================
   SAFE FUND REWARD FROM LIQUIDITY
========================================= */
async function safeFundRewardFromLiquidity(projectCode, amount, meta = {}){

  amount = liquiditySafeNumber(amount, 0);

  if(!projectCode){
    return { error:"Project code is required" };
  }

  if(amount <= 0){
    return { error:"Invalid reward funding amount" };
  }

  const active = await isProjectActive(projectCode);

  if(!active){
    return { error:"Project is not active" };
  }

  const guard = await canUseLiquidity(projectCode, amount);

  if(!guard.allowed){
    return { error:guard.reason };
  }

  return await fundRewardFromTreasury(projectCode, amount, meta);

}

/* =========================================
   CALCULATE REWARD BY RULE
========================================= */
async function calculateRewardAmount(projectCode, principalAmount){

  principalAmount = liquiditySafeNumber(principalAmount, 0);

  if(!projectCode || principalAmount <= 0){
    return 0;
  }

  const rules = await getLiquidityProjectRules(projectCode);

  if(!rules){
    return 0;
  }

  const rewardRate =
    liquiditySafeNumber(rules.reward_rate, 0);

  return principalAmount * rewardRate;

}

/* =========================================
   DISTRIBUTE SINGLE STAKE REWARD
   Utility for future contributor engine
========================================= */
async function distributeSingleStakeReward({
  projectCode,
  stakeAmount,
  stakeId = null,
  actor_userid = "system",
  actor_username = "Reward Engine",
  note = "Stake reward distribution"
}){

  stakeAmount = liquiditySafeNumber(stakeAmount, 0);

  if(!projectCode){
    return { error:"Project code is required" };
  }

  if(stakeAmount <= 0){
    return { error:"Invalid stake amount" };
  }

  const reward = await calculateRewardAmount(
    projectCode,
    stakeAmount
  );

  if(reward <= 0){
    return { error:"Reward amount is zero" };
  }

  const funding = await safeFundRewardFromLiquidity(
    projectCode,
    reward,
    {
      actor_userid,
      actor_username,
      note,
      meta:{
        source:"stake_reward_distribution",
        stake_id: stakeId,
        stake_amount: stakeAmount,
        reward_amount: reward
      }
    }
  );

  if(funding.error){
    return { error:funding.error };
  }

  return {
    success:true,
    project_code: projectCode,
    stake_id: stakeId,
    stake_amount: stakeAmount,
    reward_amount: reward,
    funding
  };

}

/* =========================================
   BULK DISTRIBUTE PROJECT REWARDS
   Utility for future contributors system
   stakeRows example:
   [
     { id:1, amount:100 },
     { id:2, amount:50 }
   ]
========================================= */
async function distributeProjectRewards(projectCode, stakeRows = []){

  if(!projectCode){
    return {
      error:"Project code is required"
    };
  }

  if(!Array.isArray(stakeRows) || !stakeRows.length){
    return {
      success:true,
      project_code:projectCode,
      distributed:0,
      total_reward:0,
      rows:[]
    };
  }

  const results = [];
  let distributed = 0;
  let totalReward = 0;

  for(const row of stakeRows){

    const stakeId =
      row?.id ?? row?.stake_id ?? null;

    const stakeAmount =
      liquiditySafeNumber(
        row?.amount,
        0
      );

    if(stakeAmount <= 0){
      results.push({
        stake_id: stakeId,
        success:false,
        error:"Invalid stake amount"
      });
      continue;
    }

    const res = await distributeSingleStakeReward({
      projectCode,
      stakeAmount,
      stakeId,
      actor_userid:"system",
      actor_username:"Reward Engine",
      note:"Bulk project reward distribution"
    });

    if(res.error){
      results.push({
        stake_id: stakeId,
        success:false,
        error:res.error
      });
      continue;
    }

    distributed += 1;
    totalReward += liquiditySafeNumber(
      res.reward_amount,
      0
    );

    results.push({
      stake_id: stakeId,
      success:true,
      reward_amount:res.reward_amount
    });
  }

  return {
    success:true,
    project_code:projectCode,
    distributed,
    total_reward:totalReward,
    rows:results
  };

}

/* =========================================
   ENGINE SUMMARY
========================================= */
async function getSmartLiquiditySummary(projectCode){

  const rules = await getLiquidityProjectRules(projectCode);

  if(!rules){
    return {
      project_code:projectCode,
      error:"Project not found"
    };
  }

  const treasuryStatus =
    await getProjectTreasuryStatus(projectCode);

  if(treasuryStatus.error){
    return {
      project_code:projectCode,
      error:treasuryStatus.error
    };
  }

  return {
    project_code: rules.project_code,
    project_name: rules.project_name,
    project_type: rules.project_type,
    project_status: rules.status,
    liquidity: treasuryStatus.liquidity,
    reserve: treasuryStatus.reserve,
    reserve_percent: treasuryStatus.reserve_percent,
    min_liquidity: treasuryStatus.min_liquidity,
    max_usable_liquidity: treasuryStatus.max_usable_liquidity,
    reward_rate: treasuryStatus.reward_rate
  };

}
