/* =========================================
   ALBUKHR SMART LIQUIDITY ENGINE v4 FINAL
   Rule Layer on Top of Project Treasury
========================================= */

/*
  DEPENDS ON:
  1) js/projects-engine.js
  2) js/project-treasury.js

  REQUIRED FROM projects-engine.js:
  - getProjectMeta(projectCode)
  - getProjectRules(projectCode)
  - isProjectActive(projectCode)

  REQUIRED FROM project-treasury.js:
  - getProjectTreasury(projectCode)
  - addProjectLiquidity(projectCode, amount, meta)
  - projectInternalWithdraw(projectCode, amount, meta)
  - fundRewardFromTreasury(projectCode, amount, meta)
  - getAllProjectTreasuries()
*/

/* =========================================
   GLOBAL DEFAULTS
========================================= */
const DEFAULT_RESERVE_PERCENT = 0.30;
const DEFAULT_MIN_PROJECT_LIQUIDITY = 100;
const DEFAULT_REWARD_RATE = 0.02;

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

function liquidityRound(value, decimals = 8){
  const n = liquiditySafeNumber(value, 0);
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
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
   GET NORMALIZED PROJECT RULES
========================================= */
async function getLiquidityProjectRules(projectCode){

  assertLiquidityDependencies();

  if(!projectCode){
    return null;
  }

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
    liquiditySafeNumber(meta.reward_rate, DEFAULT_REWARD_RATE)
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
   GET TREASURY STATUS
========================================= */
async function getProjectTreasuryStatus(projectCode){

  assertLiquidityDependencies();

  if(!projectCode){
    return {
      error:"Project code is required"
    };
  }

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

  const reservePercent =
    liquiditySafeNumber(rules.reserve_percent, DEFAULT_RESERVE_PERCENT);

  const minLiquidity =
    liquiditySafeNumber(rules.min_liquidity, DEFAULT_MIN_PROJECT_LIQUIDITY);

  const reserve =
    liquidityRound(liquidity * reservePercent);

  const usableAfterReserve =
    Math.max(0, liquidityRound(liquidity - reserve));

  const usableAfterMinimum =
    Math.max(0, liquidityRound(liquidity - minLiquidity));

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
    reserve_percent: reservePercent,
    min_liquidity: minLiquidity,

    usable_after_reserve: usableAfterReserve,
    usable_after_minimum: usableAfterMinimum,
    max_usable_liquidity: liquidityRound(maxUsable),

    reward_rate: liquiditySafeNumber(rules.reward_rate, DEFAULT_REWARD_RATE),

    treasury
  };

}

/* =========================================
   CHECK RAW LIQUIDITY ONLY
   - kawai shin akwai isasshen balance?
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
   CHECK MINIMUM LIQUIDITY
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
   Checks:
   - project active
   - enough liquidity
   - reserve protection
   - minimum liquidity protection
========================================= */
async function canUseLiquidity(projectCode, amount){

  amount = liquiditySafeNumber(amount, 0);

  if(!projectCode){
    return {
      allowed:false,
      reason:"Project code is required"
    };
  }

  if(amount <= 0){
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

  const balanceAfter =
    liquidityRound(liquidity - amount);

  if(amount > liquidity){
    return {
      allowed:false,
      reason:"Insufficient project liquidity"
    };
  }

  if(balanceAfter < reserve){
    return {
      allowed:false,
      reason:"Liquidity reserve protection"
    };
  }

  if(balanceAfter < minLiquidity){
    return {
      allowed:false,
      reason:"Minimum liquidity protection"
    };
  }

  return {
    allowed:true,
    reason:"",
    project_code: status.project_code,
    project_name: status.project_name,
    project_type: status.project_type,
    liquidity,
    reserve,
    min_liquidity: minLiquidity,
    balance_after: balanceAfter,
    max_usable_liquidity:
      liquiditySafeNumber(status.max_usable_liquidity, 0)
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
   CALCULATE REWARD AMOUNT
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
    liquiditySafeNumber(rules.reward_rate, DEFAULT_REWARD_RATE);

  return liquidityRound(principalAmount * rewardRate);

}

/* =========================================
   DISTRIBUTE SINGLE STAKE REWARD
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
    total_reward:liquidityRound(totalReward),
    rows:results
  };

}

/* =========================================
   DASHBOARD SUMMARY FOR ONE PROJECT
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

/* =========================================
   GET ALL SMART LIQUIDITY SUMMARIES
   - good for ecosystem dashboards
========================================= */
async function getAllSmartLiquiditySummaries(){

  if(typeof getAllProjects !== "function"){
    console.warn("getAllProjects() not found in projects-engine.js");
    return [];
  }

  const projects = await getAllProjects({
    visibleOnly:false,
    activeOnly:false
  });

  const rows = [];

  for(const project of projects){

    const summary = await getSmartLiquiditySummary(
      project.project_code
    );

    if(summary && !summary.error){
      rows.push(summary);
    }else{
      rows.push({
        project_code: project.project_code,
        project_name: project.project_name,
        project_type: project.project_type || "core",
        project_status: project.status || "active",
        liquidity: 0,
        reserve: 0,
        reserve_percent:
          liquiditySafeNumber(project.reserve_percent, DEFAULT_RESERVE_PERCENT),
        min_liquidity:
          liquiditySafeNumber(project.min_liquidity, DEFAULT_MIN_PROJECT_LIQUIDITY),
        max_usable_liquidity: 0,
        reward_rate:
          liquiditySafeNumber(project.reward_rate, DEFAULT_REWARD_RATE),
        error: summary?.error || "Treasury summary unavailable"
      });
    }
  }

  return rows;

}

/* =========================================
   GROUP SMART LIQUIDITY BY PROJECT TYPE
========================================= */
async function getSmartLiquidityGroupedByType(){

  const rows = await getAllSmartLiquiditySummaries();

  return {
    core: rows.filter(r => r.project_type === "core"),
    internal: rows.filter(r => r.project_type === "internal"),
    external: rows.filter(r => r.project_type === "external")
  };

}

/* =========================================
   ECOSYSTEM LIQUIDITY TOTALS
========================================= */
async function getEcosystemLiquidityTotals(){

  const rows = await getAllSmartLiquiditySummaries();

  let totalLiquidity = 0;
  let totalReserve = 0;
  let totalUsable = 0;

  let coreLiquidity = 0;
  let internalLiquidity = 0;
  let externalLiquidity = 0;

  rows.forEach(row => {

    const liquidity = liquiditySafeNumber(row.liquidity, 0);
    const reserve = liquiditySafeNumber(row.reserve, 0);
    const usable = liquiditySafeNumber(row.max_usable_liquidity, 0);

    totalLiquidity += liquidity;
    totalReserve += reserve;
    totalUsable += usable;

    if(row.project_type === "core"){
      coreLiquidity += liquidity;
    }

    if(row.project_type === "internal"){
      internalLiquidity += liquidity;
    }

    if(row.project_type === "external"){
      externalLiquidity += liquidity;
    }

  });

  return {
    total_projects: rows.length,

    total_liquidity: liquidityRound(totalLiquidity),
    total_reserve: liquidityRound(totalReserve),
    total_usable_liquidity: liquidityRound(totalUsable),

    core_liquidity: liquidityRound(coreLiquidity),
    internal_liquidity: liquidityRound(internalLiquidity),
    external_liquidity: liquidityRound(externalLiquidity)
  };

}

/* =========================================
   GLOBAL EXPORTS
========================================= */
window.getLiquidityProjectRules = getLiquidityProjectRules;
window.getProjectTreasuryStatus = getProjectTreasuryStatus;

window.checkProjectLiquidity = checkProjectLiquidity;
window.hasMinimumLiquidity = hasMinimumLiquidity;
window.canUseLiquidity = canUseLiquidity;

window.safeAddProjectLiquidity = safeAddProjectLiquidity;
window.safeProjectInternalWithdraw = safeProjectInternalWithdraw;
window.safeFundRewardFromLiquidity = safeFundRewardFromLiquidity;

window.calculateRewardAmount = calculateRewardAmount;
window.distributeSingleStakeReward = distributeSingleStakeReward;
window.distributeProjectRewards = distributeProjectRewards;

window.getSmartLiquiditySummary = getSmartLiquiditySummary;
window.getAllSmartLiquiditySummaries = getAllSmartLiquiditySummaries;
window.getSmartLiquidityGroupedByType = getSmartLiquidityGroupedByType;
window.getEcosystemLiquidityTotals = getEcosystemLiquidityTotals;
