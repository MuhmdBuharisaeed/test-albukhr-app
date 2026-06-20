/* =========================================
   ALBUKHR PROJECT TREASURY ENGINE v3 FINAL
   SUPABASE TREASURY + TRANSACTION LEDGER
========================================= */

/*
  Wannan file yana aiki da:
  - projects-engine.js
  - smart-liquidity-engine.js

  TABLES:
  1) projects
  2) project_treasury
  3) project_treasury_transactions
*/

/* =========================================
   CONFIG
========================================= */
const TREASURY_TABLE = "project_treasury";
const TREASURY_TX_TABLE = "project_treasury_transactions";

/* =========================================
   SUPABASE CLIENT RESOLUTION
========================================= */
function getTreasurySupabaseClient(){

  if(window.supabaseClient){
    return window.supabaseClient;
  }

  if(window.supabase){
    try{
      if(window.SUPABASE_URL && window.SUPABASE_KEY){
        return window.supabase.createClient(
          window.SUPABASE_URL,
          window.SUPABASE_KEY
        );
      }
    }catch(e){
      console.warn("Treasury supabase client creation failed:", e);
    }
  }

  return null;
}

/* =========================================
   SAFE NUMBER
========================================= */
function treasurySafeNumber(value, fallback = 0){
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/* =========================================
   SAFE STRING
========================================= */
function treasurySafeString(value, fallback = ""){
  if(value === null || value === undefined){
    return fallback;
  }
  return String(value);
}

/* =========================================
   NOW ISO
========================================= */
function treasuryNowISO(){
  return new Date().toISOString();
}

/* =========================================
   REQUIRE PROJECTS ENGINE
========================================= */
function assertProjectsEngine(){

  if(typeof getProjectMeta !== "function"){
    throw new Error(
      "projects-engine.js is required before project-treasury.js"
    );
  }

}

/* =========================================
   NORMALIZE TREASURY ROW
========================================= */
function normalizeTreasuryRow(row = {}){

  return {
    id: row.id ?? null,
    project_code: treasurySafeString(row.project_code),
    project_name: treasurySafeString(row.project_name),
    project_type: treasurySafeString(row.project_type || "core"),
    liquidity_balance: treasurySafeNumber(row.liquidity_balance, 0),
    total_added: treasurySafeNumber(row.total_added, 0),
    total_withdrawn: treasurySafeNumber(row.total_withdrawn, 0),
    total_reward_funded: treasurySafeNumber(row.total_reward_funded, 0),
    status: treasurySafeString(row.status || "active"),
    last_activity_at: row.last_activity_at || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    raw: row
  };

}

/* =========================================
   NORMALIZE TX ROW
========================================= */
function normalizeTreasuryTxRow(row = {}){

  return {
    id: row.id ?? null,
    project_code: treasurySafeString(row.project_code),
    project_name: treasurySafeString(row.project_name),
    project_type: treasurySafeString(row.project_type || "core"),
    tx_type: treasurySafeString(row.tx_type),
    amount: treasurySafeNumber(row.amount, 0),
    balance_before: treasurySafeNumber(row.balance_before, 0),
    balance_after: treasurySafeNumber(row.balance_after, 0),
    actor_userid: treasurySafeString(row.actor_userid),
    actor_username: treasurySafeString(row.actor_username),
    note: treasurySafeString(row.note),
    meta: row.meta || null,
    created_at: row.created_at || null,
    raw: row
  };

}

/* =========================================
   GET PROJECT META
========================================= */
async function getTreasuryProjectMeta(projectCode){

  assertProjectsEngine();

  if(!projectCode){
    return null;
  }

  const project = await getProjectMeta(projectCode);
  return project || null;

}

/* =========================================
   FETCH TREASURY ROW
========================================= */
async function fetchProjectTreasuryRow(projectCode){

  const supabase = getTreasurySupabaseClient();

  if(!supabase){
    return { error:"Supabase client not available" };
  }

  try{

    const { data, error } = await supabase
      .from(TREASURY_TABLE)
      .select("*")
      .eq("project_code", projectCode)
      .maybeSingle();

    if(error){
      return { error:error.message || "Failed to fetch treasury" };
    }

    return {
      success:true,
      data:data ? normalizeTreasuryRow(data) : null
    };

  }catch(e){
    return {
      error:e?.message || "Treasury fetch failed"
    };
  }

}

/* =========================================
   CREATE TREASURY ROW
========================================= */
async function createProjectTreasury(projectCode){

  const supabase = getTreasurySupabaseClient();

  if(!supabase){
    return { error:"Supabase client not available" };
  }

  const project = await getTreasuryProjectMeta(projectCode);

  if(!project){
    return { error:`Project not found: ${projectCode}` };
  }

  const payload = {
    project_code: project.project_code,
    project_name: project.project_name,
    project_type: project.project_type || "core",
    liquidity_balance: 0,
    total_added: 0,
    total_withdrawn: 0,
    total_reward_funded: 0,
    status: "active",
    last_activity_at: treasuryNowISO()
  };

  try{

    const { data, error } = await supabase
      .from(TREASURY_TABLE)
      .insert(payload)
      .select()
      .single();

    if(error){
      return {
        error:error.message || "Failed to create treasury row"
      };
    }

    return {
      success:true,
      data:normalizeTreasuryRow(data)
    };

  }catch(e){
    return {
      error:e?.message || "Treasury create failed"
    };
  }

}

/* =========================================
   ENSURE PROJECT TREASURY
========================================= */
async function ensureProjectTreasury(projectCode){

  if(!projectCode){
    return { error:"Project code is required" };
  }

  const project = await getTreasuryProjectMeta(projectCode);

  if(!project){
    return { error:`Project not found: ${projectCode}` };
  }

  const existing = await fetchProjectTreasuryRow(projectCode);

  if(existing.error){
    return { error:existing.error };
  }

  if(existing.data){
    return {
      success:true,
      data:existing.data
    };
  }

  return await createProjectTreasury(projectCode);

}

/* =========================================
   GET PROJECT TREASURY
========================================= */
async function getProjectTreasury(projectCode){

  const ensured = await ensureProjectTreasury(projectCode);

  if(ensured.error){
    return { error:ensured.error };
  }

  return ensured.data;

}

/* =========================================
   GET PROJECT LIQUIDITY
========================================= */
async function getProjectLiquidity(projectCode){

  const treasury = await getProjectTreasury(projectCode);

  if(treasury?.error){
    return 0;
  }

  return treasurySafeNumber(
    treasury.liquidity_balance,
    0
  );

}

/* =========================================
   INSERT TREASURY TRANSACTION
========================================= */
async function insertTreasuryTransaction({
  project_code,
  project_name,
  project_type,
  tx_type,
  amount,
  balance_before,
  balance_after,
  actor_userid = "",
  actor_username = "",
  note = "",
  meta = null
}){

  const supabase = getTreasurySupabaseClient();

  if(!supabase){
    return { error:"Supabase client not available" };
  }

  const payload = {
    project_code: treasurySafeString(project_code),
    project_name: treasurySafeString(project_name),
    project_type: treasurySafeString(project_type || "core"),
    tx_type: treasurySafeString(tx_type),
    amount: treasurySafeNumber(amount, 0),
    balance_before: treasurySafeNumber(balance_before, 0),
    balance_after: treasurySafeNumber(balance_after, 0),
    actor_userid: treasurySafeString(actor_userid),
    actor_username: treasurySafeString(actor_username),
    note: treasurySafeString(note),
    meta: meta || {},
    created_at: treasuryNowISO()
  };

  try{

    const { data, error } = await supabase
      .from(TREASURY_TX_TABLE)
      .insert(payload)
      .select()
      .single();

    if(error){
      return {
        error:error.message || "Failed to insert treasury transaction"
      };
    }

    return {
      success:true,
      data:normalizeTreasuryTxRow(data)
    };

  }catch(e){
    return {
      error:e?.message || "Treasury transaction insert failed"
    };
  }

}

/* =========================================
   UPDATE TREASURY ROW
========================================= */
async function updateTreasuryRow(projectCode, patch = {}){

  const supabase = getTreasurySupabaseClient();

  if(!supabase){
    return { error:"Supabase client not available" };
  }

  try{

    const { data, error } = await supabase
      .from(TREASURY_TABLE)
      .update({
        ...patch,
        updated_at: treasuryNowISO()
      })
      .eq("project_code", projectCode)
      .select()
      .single();

    if(error){
      return {
        error:error.message || "Failed to update treasury row"
      };
    }

    return {
      success:true,
      data:normalizeTreasuryRow(data)
    };

  }catch(e){
    return {
      error:e?.message || "Treasury update failed"
    };
  }

}

/* =========================================
   ADD LIQUIDITY
========================================= */
async function addProjectLiquidity(projectCode, amount, meta = {}){

  amount = treasurySafeNumber(amount, 0);

  if(!projectCode){
    return { error:"Project code is required" };
  }

  if(amount <= 0){
    return { error:"Invalid liquidity amount" };
  }

  const project = await getTreasuryProjectMeta(projectCode);

  if(!project){
    return { error:`Project not found: ${projectCode}` };
  }

  const treasury = await getProjectTreasury(projectCode);

  if(treasury?.error){
    return { error:treasury.error };
  }

  const balanceBefore =
    treasurySafeNumber(treasury.liquidity_balance);

  const balanceAfter =
    balanceBefore + amount;

  const patch = {
    project_name: project.project_name,
    project_type: project.project_type || "core",
    liquidity_balance: balanceAfter,
    total_added:
      treasurySafeNumber(treasury.total_added) + amount,
    last_activity_at: treasuryNowISO(),
    status: "active"
  };

  const updated = await updateTreasuryRow(projectCode, patch);

  if(updated.error){
    return { error:updated.error };
  }

  const tx = await insertTreasuryTransaction({
    project_code: project.project_code,
    project_name: project.project_name,
    project_type: project.project_type || "core",
    tx_type: "liquidity_add",
    amount,
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    actor_userid: meta.actor_userid || "",
    actor_username: meta.actor_username || "",
    note: meta.note || "Liquidity added",
    meta: meta.meta || {}
  });

  if(tx.error){
    console.warn("Treasury tx insert warning:", tx.error);
  }

  return {
    success:true,
    action:"liquidity_add",
    project_code: project.project_code,
    amount,
    liquidity: balanceAfter,
    treasury: updated.data,
    transaction: tx.data || null
  };

}

/* =========================================
   INTERNAL WITHDRAW
========================================= */
async function projectInternalWithdraw(projectCode, amount, meta = {}){

  amount = treasurySafeNumber(amount, 0);

  if(!projectCode){
    return { error:"Project code is required" };
  }

  if(amount <= 0){
    return { error:"Invalid withdraw amount" };
  }

  const project = await getTreasuryProjectMeta(projectCode);

  if(!project){
    return { error:`Project not found: ${projectCode}` };
  }

  const treasury = await getProjectTreasury(projectCode);

  if(treasury?.error){
    return { error:treasury.error };
  }

  const balanceBefore =
    treasurySafeNumber(treasury.liquidity_balance);

  if(amount > balanceBefore){
    return { error:"Insufficient project liquidity" };
  }

  const balanceAfter =
    balanceBefore - amount;

  const patch = {
    project_name: project.project_name,
    project_type: project.project_type || "core",
    liquidity_balance: balanceAfter,
    total_withdrawn:
      treasurySafeNumber(treasury.total_withdrawn) + amount,
    last_activity_at: treasuryNowISO(),
    status: "active"
  };

  const updated = await updateTreasuryRow(projectCode, patch);

  if(updated.error){
    return { error:updated.error };
  }

  const tx = await insertTreasuryTransaction({
    project_code: project.project_code,
    project_name: project.project_name,
    project_type: project.project_type || "core",
    tx_type: "internal_withdraw",
    amount,
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    actor_userid: meta.actor_userid || "",
    actor_username: meta.actor_username || "",
    note: meta.note || "Internal project withdraw",
    meta: meta.meta || {}
  });

  if(tx.error){
    console.warn("Treasury tx insert warning:", tx.error);
  }

  return {
    success:true,
    action:"internal_withdraw",
    project_code: project.project_code,
    amount,
    liquidity: balanceAfter,
    treasury: updated.data,
    transaction: tx.data || null
  };

}

/* =========================================
   FUND REWARD FROM TREASURY
========================================= */
async function fundRewardFromTreasury(projectCode, amount, meta = {}){

  amount = treasurySafeNumber(amount, 0);

  if(!projectCode){
    return { error:"Project code is required" };
  }

  if(amount <= 0){
    return { error:"Invalid reward funding amount" };
  }

  const project = await getTreasuryProjectMeta(projectCode);

  if(!project){
    return { error:`Project not found: ${projectCode}` };
  }

  const treasury = await getProjectTreasury(projectCode);

  if(treasury?.error){
    return { error:treasury.error };
  }

  const balanceBefore =
    treasurySafeNumber(treasury.liquidity_balance);

  if(amount > balanceBefore){
    return { error:"Insufficient project liquidity" };
  }

  const balanceAfter =
    balanceBefore - amount;

  const patch = {
    project_name: project.project_name,
    project_type: project.project_type || "core",
    liquidity_balance: balanceAfter,
    total_reward_funded:
      treasurySafeNumber(treasury.total_reward_funded) + amount,
    last_activity_at: treasuryNowISO(),
    status: "active"
  };

  const updated = await updateTreasuryRow(projectCode, patch);

  if(updated.error){
    return { error:updated.error };
  }

  const tx = await insertTreasuryTransaction({
    project_code: project.project_code,
    project_name: project.project_name,
    project_type: project.project_type || "core",
    tx_type: "reward_funding",
    amount,
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    actor_userid: meta.actor_userid || "",
    actor_username: meta.actor_username || "",
    note: meta.note || "Reward funding from treasury",
    meta: meta.meta || {}
  });

  if(tx.error){
    console.warn("Treasury tx insert warning:", tx.error);
  }

  return {
    success:true,
    action:"reward_funding",
    project_code: project.project_code,
    amount,
    liquidity: balanceAfter,
    treasury: updated.data,
    transaction: tx.data || null
  };

}

/* =========================================
   GET TREASURY HISTORY
========================================= */
async function getProjectTreasuryHistory(projectCode, limit = 50){

  if(!projectCode){
    return [];
  }

  const supabase = getTreasurySupabaseClient();

  if(!supabase){
    return [];
  }

  limit = treasurySafeNumber(limit, 50);
  if(limit <= 0) limit = 50;

  try{

    const { data, error } = await supabase
      .from(TREASURY_TX_TABLE)
      .select("*")
      .eq("project_code", projectCode)
      .order("created_at", { ascending:false })
      .limit(limit);

    if(error){
      console.error("getProjectTreasuryHistory error:", error);
      return [];
    }

    return (data || []).map(normalizeTreasuryTxRow);

  }catch(e){
    console.error("getProjectTreasuryHistory network error:", e);
    return [];
  }

}

/* =========================================
   GET FULL TREASURY SNAPSHOT
========================================= */
async function getProjectTreasurySnapshot(projectCode, historyLimit = 20){

  const project = await getTreasuryProjectMeta(projectCode);

  if(!project){
    return { error:`Project not found: ${projectCode}` };
  }

  const treasury = await getProjectTreasury(projectCode);

  if(treasury?.error){
    return { error:treasury.error };
  }

  const history =
    await getProjectTreasuryHistory(
      projectCode,
      historyLimit
    );

  return {
    success:true,
    project,
    treasury,
    history
  };

}

/* =========================================
   ADMIN: GET ALL TREASURIES
========================================= */
async function getAllProjectTreasuries(){

  const supabase = getTreasurySupabaseClient();

  if(!supabase){
    return [];
  }

  try{

    const { data, error } = await supabase
      .from(TREASURY_TABLE)
      .select("*")
      .order("project_name", { ascending:true });

    if(error){
      console.error("getAllProjectTreasuries error:", error);
      return [];
    }

    return (data || []).map(normalizeTreasuryRow);

  }catch(e){
    console.error("getAllProjectTreasuries network error:", e);
    return [];
  }

}

/* =========================================
   ADMIN / DEBUG SUMMARY
========================================= */
async function getTreasuryEngineSummary(projectCode){

  const project = await getTreasuryProjectMeta(projectCode);

  if(!project){
    return {
      project_code: projectCode,
      error:"Project not found"
    };
  }

  const treasury = await getProjectTreasury(projectCode);

  if(treasury?.error){
    return {
      project_code: projectCode,
      error:treasury.error
    };
  }

  return {
    project_code: treasury.project_code,
    project_name: treasury.project_name,
    project_type: treasury.project_type,
    liquidity_balance: treasury.liquidity_balance,
    total_added: treasury.total_added,
    total_withdrawn: treasury.total_withdrawn,
    total_reward_funded: treasury.total_reward_funded,
    status: treasury.status,
    last_activity_at: treasury.last_activity_at
  };

   }
