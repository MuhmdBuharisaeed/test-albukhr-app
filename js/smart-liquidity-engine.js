/* =========================================
   ALBUKHR SMART LIQUIDITY ENGINE v3
   SUPABASE POLICY + TREASURY PROTECTION
========================================= */

/*
  Wannan file yana aiki tare da:
  - project-treasury.js v3
  - projects table
  - project_treasury table
  - project_treasury_transactions table

  Muhimman treasury functions da yake bukata:
  - getProjectMeta(projectCode)
  - ensureProjectTreasury(projectCode)
  - getProjectTreasury(projectCode)
  - getProjectLiquidity(projectCode)
  - addProjectLiquidity(projectCode, amount, meta)
  - projectInternalWithdraw(projectCode, amount, meta)
  - fundRewardFromTreasury(projectCode, amount, meta)
  - getProjectTreasuryHistory(projectCode, limit)
*/

/* =========================================
   DEFAULT GLOBAL RULES
========================================= */
const DEFAULT_RESERVE_PERCENT = 0.30;
const DEFAULT_MIN_PROJECT_LIQUIDITY = 100;
const DEFAULT_REWARD_RATE = 0.02;

/* =========================================
   SAFE NUMBER
========================================= */
function liquiditySafeNumber(value){
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/* =========================================
   NORMALIZE PROJECT RULES
========================================= */
function normalizeLiquidityRules(projectMeta = {}){

  const reservePercent =
    Number(projectMeta.reserve_percent);

  const minLiquidity =
    Number(projectMeta.min_liquidity);

  const rewardRate =
    Number(projectMeta.reward_rate);

  return {
    reserve_percent:
      Number.isFinite(reservePercent)
        ? reservePercent
        : DEFAULT_RESERVE_PERCENT,

    min_liquidity:
      Number.isFinite(minLiquidity)
        ? minLiquidity
        : DEFAULT_MIN_PROJECT_LIQUIDITY,

    reward_rate:
      Number.isFinite(rewardRate)
        ? rewardRate
        : DEFAULT_REWARD_RATE
  };

}

/* =========================================
   GET PROJECT + TREASURY SNAPSHOT
========================================= */
async function getLiquiditySnapshot(projectCode){

  if(!projectCode){
    return { error:"Project code is required" };
  }

  if(typeof getProjectMeta !== "function"){
    return { error:"getProjectMeta() not found. Load project-treasury.js first." };
  }

  if(typeof getProjectTreasury !== "function"){
    return { error:"getProjectTreasury() not found. Load project-treasury.js first." };
  }

  const project = await getProjectMeta(projectCode);

  if(!project){
    return { error:`Project not found: ${projectCode}` };
  }

  const treasury = await getProjectTreasury(projectCode);

  if(treasury?.error){
    return { error: treasury.error };
  }

  const rules = normalizeLiquidityRules(project);
  const liquidity = liquiditySafeNumber(treasury?.liquidity_balance);

  return {
    success:true,
    project,
    treasury,
    rules,
    liquidity
  };

}

/* =========================================
   PROJECT ACTIVE CHECK
========================================= */
async function isProjectActive(projectCode){

  const snap = await getLiquiditySnapshot(projectCode);

  if(snap.error){
    return false;
  }

  const status =
    String(snap.project?.status || "active")
    .toLowerCase();

  return status === "active";

}

/* =========================================
   GET RESERVE AMOUNT
========================================= */
async function getProjectReserveAmount(projectCode){

  const snap = await getLiquiditySnapshot(projectCode);

  if(snap.error){
    return 0;
  }

  return snap.liquidity * snap.rules.reserve_percent;

}

/* =========================================
   GET MINIMUM LIQUIDITY
========================================= */
async function getProjectMinimumLiquidity(projectCode){

  const snap = await getLiquiditySnapshot(projectCode);

  if(snap.error){
    return DEFAULT_MIN_PROJECT_LIQUIDITY;
  }

  return liquiditySafeNumber(
    snap.rules.min_liquidity
  );

}

/* =========================================
   TREASURY STATUS
========================================= */
async function getProjectTreasuryStatus(projectCode){

  const snap = await getLiquiditySnapshot(projectCode);

  if(snap.error){
    return {
      liquidity: 0,
      reserve: 0,
      min_liquidity: DEFAULT_MIN_PROJECT_LIQUIDITY,
      available_to_use: 0,
      reward_rate: DEFAULT_REWARD_RATE,
      project_type: null,
      status: "unknown",
      error: snap.error
    };
  }

  const reserve =
    snap.liquidity * snap.rules.reserve_percent;

  const minLiquidity =
    snap.rules.min_liquidity;

  const availableByReserve =
    Math.max(0, snap.liquidity - reserve);

  const availableByMin =
    Math.max(0, snap.liquidity - minLiquidity);

  const availableToUse =
    Math.min(availableByReserve, availableByMin);

  return {
    liquidity: snap.liquidity,
    reserve,
    min_liquidity: minLiquidity,
    available_to_use: Math.max(0, availableToUse),
    reward_rate: snap.rules.reward_rate,
    project_type: snap.project?.project_type || null,
    status: snap.project?.status || "active",
    treasury: snap.treasury,
    project: snap.project
  };

}

/* =========================================
   MINIMUM LIQUIDITY CHECK
========================================= */
async function hasMinimumLiquidity(projectCode){

  const status =
    await getProjectTreasuryStatus(projectCode);

  if(status.error) return false;

  return liquiditySafeNumber(status.liquidity)
    >= liquiditySafeNumber(status.min_liquidity);

}

/* =========================================
   BASIC LIQUIDITY CHECK
========================================= */
async function checkProjectLiquidity(projectCode, amount){

  amount = liquiditySafeNumber(amount);

  if(amount <= 0){
    return false;
  }

  const status =
    await getProjectTreasuryStatus(projectCode);

  if(status.error){
    return false;
  }

  return liquiditySafeNumber(status.liquidity) >= amount;

}

/* =========================================
   RESERVE PROTECTION CHECK
========================================= */
async function canUseLiquidity(projectCode, amount){

  amount = liquiditySafeNumber(amount);

  if(amount <= 0){
    return {
      allowed:false,
      reason:"Invalid amount"
    };
  }

  const status =
    await getProjectTreasuryStatus(projectCode);

  if(status.error){
    return {
      allowed:false,
      reason:status.error
    };
  }

  if(String(status.status).toLowerCase() !== "active"){
    return {
      allowed:false,
      reason:"Project is not active"
    };
  }

  if(amount > status.liquidity){
    return {
      allowed:false,
      reason:"Insufficient project liquidity"
    };
  }

  if(amount > status.available_to_use){
    return {
      allowed:false,
      reason:"Reserve/minimum liquidity protection active"
    };
  }

  return {
    allowed:true,
    liquidity: status.liquidity,
    reserve: status.reserve,
    min_liquidity: status.min_liquidity,
    available_to_use: status.available_to_use
  };

}

/* =========================================
   RUG-RISK PLACEHOLDER CHECK
========================================= */
async function checkRugRisk(projectCode, amount){

  amount = liquiditySafeNumber(amount);

  const status =
    await getProjectTreasuryStatus(projectCode);

  if(status.error){
    return {
      allowed:false,
      reason:status.error
    };
  }

  // zaka iya kara stricter logic nan gaba
  // misali:
  // - max daily withdraw
  // - suspicious rapid withdrawals
  // - admin approval requirement
  // - contributor lock windows

  return {
    allowed:true,
    reason:"OK",
    project: status.project,
    treasury: status.treasury
  };

}

/* =========================================
   SAFE LIQUIDITY ADD
   - wrapper on top of treasury engine
========================================= */
async function safeAddProjectLiquidity(projectCode, amount, meta = {}){

  amount = liquiditySafeNumber(amount);

  if(amount <= 0){
    return { error:"Invalid liquidity amount" };
  }

  const active = await isProjectActive(projectCode);

  if(!active){
    return { error:"Project is not active" };
  }

  if(typeof addProjectLiquidity !== "function"){
    return { error:"addProjectLiquidity() not found" };
  }

  return await addProjectLiquidity(
    projectCode,
    amount,
    {
      ...meta,
      note:
        meta.note ||
        "Liquidity added through smart-liquidity-engine"
    }
  );

}

/* =========================================
   SAFE INTERNAL WITHDRAW
========================================= */
async function safeProjectInternalWithdraw(projectCode, amount, meta = {}){

  amount = liquiditySafeNumber(amount);

  if(amount <= 0){
    return { error:"Invalid withdraw amount" };
  }

  const active = await isProjectActive(projectCode);

  if(!active){
    return { error:"Project is not active" };
  }

  const liquidityCheck =
    await canUseLiquidity(projectCode, amount);

  if(!liquidityCheck.allowed){
    return { error: liquidityCheck.reason };
  }

  const rugCheck =
    await checkRugRisk(projectCode, amount);

  if(!rugCheck.allowed){
    return { error: rugCheck.reason };
  }

  if(typeof projectInternalWithdraw !== "function"){
    return { error:"projectInternalWithdraw() not found" };
  }

  return await projectInternalWithdraw(
    projectCode,
    amount,
    {
      ...meta,
      note:
        meta.note ||
        "Internal withdraw via smart-liquidity-engine"
    }
  );

}

/* =========================================
   SAFE REWARD FUNDING
========================================= */
async function safeFundRewardFromLiquidity(projectCode, amount, meta = {}){

  amount = liquiditySafeNumber(amount);

  if(amount <= 0){
    return { error:"Invalid reward funding amount" };
  }

  const active = await isProjectActive(projectCode);

  if(!active){
    return { error:"Project is not active" };
  }

  const liquidityCheck =
    await canUseLiquidity(projectCode, amount);

  if(!liquidityCheck.allowed){
    return { error: liquidityCheck.reason };
  }

  if(typeof fundRewardFromTreasury !== "function"){
    return { error:"fundRewardFromTreasury() not found" };
  }

  return await fundRewardFromTreasury(
    projectCode,
    amount,
    {
      ...meta,
      note:
        meta.note ||
        "Reward funding via smart-liquidity-engine"
    }
  );

}

/* =========================================
   AUTO REWARD CALCULATOR
========================================= */
function calculateStakeRewardAmount(stake, rewardRate){

  const amount =
    liquiditySafeNumber(stake?.amount);

  return amount * rewardRate;

}

/* =========================================
   DISTRIBUTE PROJECT REWARDS
   - checks all stakes of one project
   - funds reward from treasury
   - optional recordTx if available
========================================= */
async function distributeProjectRewards(projectCode, options = {}){

  if(typeof getAllStakesMerged !== "function"){
    return {
      error:"getAllStakesMerged() not found"
    };
  }

  const status =
    await getProjectTreasuryStatus(projectCode);

  if(status.error){
    return { error: status.error };
  }

  if(String(status.status).toLowerCase() !== "active"){
    return { error:"Project is not active" };
  }

  const stakes = getAllStakesMerged()
    .filter(stake => {
      return String(stake.project) === String(projectCode);
    });

  if(!stakes.length){
    return {
      success:true,
      funded_total:0,
      distributed_count:0,
      skipped_count:0,
      results:[]
    };
  }

  const rewardRate =
    liquiditySafeNumber(
      options.reward_rate || status.reward_rate || DEFAULT_REWARD_RATE
    );

  let fundedTotal = 0;
  let distributedCount = 0;
  let skippedCount = 0;
  const results = [];

  for(const stake of stakes){

    const reward =
      calculateStakeRewardAmount(
        stake,
        rewardRate
      );

    if(reward <= 0){
      skippedCount++;
      results.push({
        success:false,
        stakeId: stake.id || null,
        project: projectCode,
        amount: 0,
        error:"Invalid stake reward amount"
      });
      continue;
    }

    const funding =
      await safeFundRewardFromLiquidity(
        projectCode,
        reward,
        {
          actor_userid:
            options.actor_userid || "system",
          actor_username:
            options.actor_username || "ALBUKHR Reward Engine",
          note:
            options.note ||
            `Auto reward funding for stake ${stake.id || ""}`,
          meta:{
            stake_id: stake.id || null,
            stake_userid: stake.userid || null,
            reward_rate: rewardRate
          }
        }
      );

    if(funding.error){
      skippedCount++;
      results.push({
        success:false,
        stakeId: stake.id || null,
        project: projectCode,
        amount: reward,
        error: funding.error
      });
      continue;
    }

    distributedCount++;
    fundedTotal += reward;

    // optional external transaction log
    if(typeof recordTx === "function"){
      try{
        recordTx({
          type:"auto-reward",
          project:projectCode,
          amount:reward,
          stakeId:stake.id || null
        });
      }catch(e){
        console.warn("recordTx auto-reward warning:", e);
      }
    }

    results.push({
      success:true,
      stakeId: stake.id || null,
      project: projectCode,
      amount: reward
    });

  }

  return {
    success:true,
    funded_total: fundedTotal,
    distributed_count: distributedCount,
    skipped_count: skippedCount,
    results
  };

}

/* =========================================
   GET AVAILABLE LIQUIDITY FOR ACTION
   - how much can be safely used now
========================================= */
async function getAvailableProjectLiquidity(projectCode){

  const status =
    await getProjectTreasuryStatus(projectCode);

  if(status.error){
    return 0;
  }

  return liquiditySafeNumber(
    status.available_to_use
  );

}

/* =========================================
   ADMIN / DEBUG SUMMARY
========================================= */
async function getLiquidityEngineSummary(projectCode){

  const status =
    await getProjectTreasuryStatus(projectCode);

  if(status.error){
    return {
      project_code: projectCode,
      error: status.error
    };
  }

  return {
    project_code: projectCode,
    project_name: status.project?.project_name || projectCode,
    project_type: status.project_type,
    status: status.status,
    liquidity: status.liquidity,
    reserve: status.reserve,
    min_liquidity: status.min_liquidity,
    available_to_use: status.available_to_use,
    reward_rate: status.reward_rate
  };

     }
