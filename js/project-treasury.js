/* =====================================
   ALBUKHR PROJECT TREASURY ENGINE v3
   SUPABASE TREASURY LEDGER ENGINE
===================================== */

const TREASURY_TABLE = "project_treasury";
const TREASURY_TX_TABLE = "project_treasury_transactions";
const PROJECTS_TABLE = "projects";

/* =====================================
   GET SUPABASE CLIENT
===================================== */
function getTreasurySupabase(){

  if(window.supabaseClient){
    return window.supabaseClient;
  }

  if(window.supabase){
    return window.supabase.createClient(
      "https://qexmnghilahsvethlxem.supabase.co",
      "sb_publishable_mSbWlhVKdmSjasKJC50QYw_5wzgRMe2"
    );
  }

  throw new Error("Supabase client not found");
}

/* =====================================
   SAFE NUMBER
===================================== */
function safeNumber(value){
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/* =====================================
   NORMALIZE META
===================================== */
function normalizeTreasuryMeta(meta = {}){

  return {
    reference_table: meta.reference_table || null,
    reference_id: meta.reference_id || null,
    actor_userid: meta.actor_userid || null,
    actor_username: meta.actor_username || null,
    note: meta.note || null,
    meta: meta.meta || {}
  };

}

/* =====================================
   GET PROJECT META
   - first from Supabase projects table
   - fallback to PROJECT_CONFIG if available
===================================== */
async function getProjectMeta(projectCode){

  if(!projectCode){
    return null;
  }

  const supabase = getTreasurySupabase();

  const { data, error } = await supabase
    .from(PROJECTS_TABLE)
    .select("*")
    .eq("project_code", projectCode)
    .maybeSingle();

  if(data){
    return data;
  }

  if(error){
    console.warn("getProjectMeta supabase warning:", error.message);
  }

  // fallback to PROJECT_CONFIG if available
  if(typeof getProjectConfig === "function"){
    const cfg = getProjectConfig(projectCode);

    return {
      project_code: projectCode,
      project_name: cfg.title || projectCode,
      project_type: "core",
      icon: cfg.icon || "📦",
      description: cfg.desc || "",
      info: cfg.info || "",
      min_liquidity: 100,
      reserve_percent: 0.30,
      status: "active"
    };
  }

  return null;
}

/* =====================================
   ENSURE PROJECT TREASURY ROW EXISTS
===================================== */
async function ensureProjectTreasury(projectCode){

  const supabase = getTreasurySupabase();

  const project = await getProjectMeta(projectCode);

  if(!project){
    return {
      error: `Project not found: ${projectCode}`
    };
  }

  // 1) check if treasury row already exists
  const { data: existing, error: existingError } = await supabase
    .from(TREASURY_TABLE)
    .select("*")
    .eq("project_code", projectCode)
    .maybeSingle();

  if(existing){
    return {
      success: true,
      treasury: existing,
      project
    };
  }

  if(existingError && existingError.code !== "PGRST116"){
    console.warn("ensureProjectTreasury existing check:", existingError.message);
  }

  // 2) create treasury row if missing
  const payload = {
    project_id: project.id,
    project_code: project.project_code,
    project_name: project.project_name,
    project_type: project.project_type,
    liquidity_balance: 0,
    total_inflow: 0,
    total_outflow: 0,
    total_reward_funded: 0,
    total_internal_withdrawn: 0
  };

  const { data: inserted, error: insertError } = await supabase
    .from(TREASURY_TABLE)
    .insert(payload)
    .select()
    .single();

  if(insertError){
    console.error("ensureProjectTreasury insert error:", insertError);
    return {
      error: insertError.message || "Unable to create treasury"
    };
  }

  return {
    success: true,
    treasury: inserted,
    project
  };
}

/* =====================================
   GET PROJECT TREASURY
===================================== */
async function getProjectTreasury(projectCode){

  const supabase = getTreasurySupabase();

  const ensured = await ensureProjectTreasury(projectCode);

  if(ensured.error){
    return {
      error: ensured.error
    };
  }

  const { data, error } = await supabase
    .from(TREASURY_TABLE)
    .select("*")
    .eq("project_code", projectCode)
    .maybeSingle();

  if(error){
    console.error("getProjectTreasury error:", error);
    return {
      error: error.message || "Failed to load treasury"
    };
  }

  return data || null;
}

/* =====================================
   GET PROJECT LIQUIDITY
===================================== */
async function getProjectLiquidity(projectCode){

  const treasury = await getProjectTreasury(projectCode);

  if(!treasury || treasury.error){
    return 0;
  }

  return safeNumber(treasury.liquidity_balance);
}

/* =====================================
   INSERT TX RECORD
===================================== */
async function insertTreasuryTransaction({
  project,
  txType,
  amount,
  balanceBefore,
  balanceAfter,
  meta = {}
}){

  const supabase = getTreasurySupabase();

  const cleanMeta = normalizeTreasuryMeta(meta);

  const payload = {
    project_id: project.id,
    project_code: project.project_code,
    project_name: project.project_name,
    project_type: project.project_type,
    tx_type: txType,
    amount: safeNumber(amount),
    balance_before: safeNumber(balanceBefore),
    balance_after: safeNumber(balanceAfter),
    reference_table: cleanMeta.reference_table,
    reference_id: cleanMeta.reference_id,
    actor_userid: cleanMeta.actor_userid,
    actor_username: cleanMeta.actor_username,
    note: cleanMeta.note,
    meta: cleanMeta.meta || {}
  };

  const { error } = await supabase
    .from(TREASURY_TX_TABLE)
    .insert(payload);

  if(error){
    console.error("insertTreasuryTransaction error:", error);
    return {
      error: error.message || "Failed to insert treasury transaction"
    };
  }

  return { success:true };
}

/* =====================================
   ADD LIQUIDITY
   tx_type = liquidity_add
===================================== */
async function addProjectLiquidity(projectCode, amount, meta = {}){

  amount = safeNumber(amount);

  if(amount <= 0){
    return { error:"Invalid liquidity amount" };
  }

  const supabase = getTreasurySupabase();

  const ensured = await ensureProjectTreasury(projectCode);

  if(ensured.error){
    return { error: ensured.error };
  }

  const project = ensured.project;
  const treasury = ensured.treasury;

  const balanceBefore = safeNumber(treasury.liquidity_balance);
  const balanceAfter = balanceBefore + amount;

  const updatePayload = {
    liquidity_balance: balanceAfter,
    total_inflow: safeNumber(treasury.total_inflow) + amount
  };

  const { data: updated, error } = await supabase
    .from(TREASURY_TABLE)
    .update(updatePayload)
    .eq("id", treasury.id)
    .select()
    .single();

  if(error){
    console.error("addProjectLiquidity error:", error);
    return {
      error: error.message || "Failed to add liquidity"
    };
  }

  const tx = await insertTreasuryTransaction({
    project,
    txType: "liquidity_add",
    amount,
    balanceBefore,
    balanceAfter,
    meta
  });

  if(tx?.error){
    return {
      success: true,
      warning: tx.error,
      treasury: updated
    };
  }

  return {
    success: true,
    liquidity: balanceAfter,
    treasury: updated
  };
}

/* =====================================
   INTERNAL HELPER:
   TREASURY DEDUCT
===================================== */
async function treasuryDeduct(projectCode, amount, txType, meta = {}){

  amount = safeNumber(amount);

  if(amount <= 0){
    return { error:"Invalid amount" };
  }

  const supabase = getTreasurySupabase();

  const ensured = await ensureProjectTreasury(projectCode);

  if(ensured.error){
    return { error: ensured.error };
  }

  const project = ensured.project;
  const treasury = ensured.treasury;

  const balanceBefore = safeNumber(treasury.liquidity_balance);

  if(amount > balanceBefore){
    return { error:"Insufficient project liquidity" };
  }

  const balanceAfter = balanceBefore - amount;

  const updatePayload = {
    liquidity_balance: balanceAfter,
    total_outflow: safeNumber(treasury.total_outflow) + amount
  };

  // reward funding
  if(txType === "reward_funding"){
    updatePayload.total_reward_funded =
      safeNumber(treasury.total_reward_funded) + amount;
  }

  // internal withdraw
  if(txType === "internal_withdraw"){
    updatePayload.total_internal_withdrawn =
      safeNumber(treasury.total_internal_withdrawn) + amount;
  }

  const { data: updated, error } = await supabase
    .from(TREASURY_TABLE)
    .update(updatePayload)
    .eq("id", treasury.id)
    .select()
    .single();

  if(error){
    console.error("treasuryDeduct update error:", error);
    return {
      error: error.message || "Failed to deduct treasury"
    };
  }

  const tx = await insertTreasuryTransaction({
    project,
    txType,
    amount,
    balanceBefore,
    balanceAfter,
    meta
  });

  if(tx?.error){
    return {
      success: true,
      warning: tx.error,
      treasury: updated
    };
  }

  return {
    success: true,
    liquidity: balanceAfter,
    treasury: updated
  };
}

/* =====================================
   INTERNAL WITHDRAW
===================================== */
async function projectInternalWithdraw(projectCode, amount, meta = {}){

  return treasuryDeduct(
    projectCode,
    amount,
    "internal_withdraw",
    meta
  );

}

/* =====================================
   FUND REWARD FROM TREASURY
===================================== */
async function fundRewardFromTreasury(projectCode, amount, meta = {}){

  return treasuryDeduct(
    projectCode,
    amount,
    "reward_funding",
    meta
  );

}

/* =====================================
   GET TREASURY HISTORY
===================================== */
async function getProjectTreasuryHistory(projectCode, limit = 50){

  const supabase = getTreasurySupabase();

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

  return data || [];
       }
