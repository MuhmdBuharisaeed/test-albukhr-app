/* =========================================
   ALBUKHR ECOSYSTEM TREASURY ENGINE v1 FINAL
   SUPABASE ECOSYSTEM WALLET + LEDGER + FUNDING
========================================= */

/*
  DEPENDS ON:
  1) supabase-core.js
  2) projects-engine.js
  3) project-treasury.js

  TABLES:
  - ecosystem_treasury
  - ecosystem_treasury_transactions

  PURPOSE:
  - main ALBUKHR wallet treasury source of truth
  - funding projects from ecosystem treasury
  - wallet balance sync
  - ecosystem transaction ledger
*/

/* =========================================
   CONFIG
========================================= */
const ECOSYSTEM_TREASURY_TABLE = "ecosystem_treasury";
const ECOSYSTEM_TREASURY_TX_TABLE = "ecosystem_treasury_transactions";
const ECOSYSTEM_TREASURY_CODE = "ALBUKHR_MAIN";

/* =========================================
   SUPABASE CLIENT
========================================= */
function getEcosystemTreasurySupabaseClient(){

  if(window.getSupabaseClient){
    const client = window.getSupabaseClient();
    if(client) return client;
  }

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
      console.warn("Ecosystem treasury supabase client creation failed:", e);
    }
  }

  return null;
}

/* =========================================
   SAFE HELPERS
========================================= */
function ecosystemTreasurySafeNumber(value, fallback = 0){
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function ecosystemTreasurySafeString(value, fallback = ""){
  if(value === null || value === undefined){
    return fallback;
  }
  return String(value);
}

function ecosystemTreasuryNowISO(){
  return new Date().toISOString();
}

/* =========================================
   ASSERT DEPENDENCIES
========================================= */
function assertEcosystemTreasuryDependencies(){

  if(typeof getProjectMeta !== "function"){
    throw new Error(
      "projects-engine.js must be loaded before ecosystem-treasury.js"
    );
  }

  if(typeof addProjectLiquidity !== "function"){
    throw new Error(
      "project-treasury.js must be loaded before ecosystem-treasury.js"
    );
  }

}

/* =========================================
   NORMALIZE TREASURY ROW
========================================= */
function normalizeEcosystemTreasuryRow(row = {}){

  return {
    id: row.id ?? null,
    treasury_code: ecosystemTreasurySafeString(row.treasury_code, ECOSYSTEM_TREASURY_CODE),
    treasury_name: ecosystemTreasurySafeString(row.treasury_name, "ALBUKHR Ecosystem Treasury"),

    wallet_balance: ecosystemTreasurySafeNumber(row.wallet_balance, 0),
    available_liquidity: ecosystemTreasurySafeNumber(row.available_liquidity, 0),
    locked_liquidity: ecosystemTreasurySafeNumber(row.locked_liquidity, 0),

    pending_requests_total: ecosystemTreasurySafeNumber(row.pending_requests_total, 0),
    approved_outflow_total: ecosystemTreasurySafeNumber(row.approved_outflow_total, 0),
    total_inflow: ecosystemTreasurySafeNumber(row.total_inflow, 0),
    total_outflow: ecosystemTreasurySafeNumber(row.total_outflow, 0),

    treasury_status: ecosystemTreasurySafeString(row.treasury_status, "active"),
    wallet_source: ecosystemTreasurySafeString(row.wallet_source, "pi_testnet_admin_wallet"),

    last_wallet_sync_at: row.last_wallet_sync_at || null,
    last_activity_at: row.last_activity_at || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,

    notes: ecosystemTreasurySafeString(row.notes, ""),
    meta: row.meta || {},
    raw: row
  };

}

/* =========================================
   NORMALIZE TREASURY TX ROW
========================================= */
function normalizeEcosystemTreasuryTxRow(row = {}){

  return {
    id: row.id ?? null,
    treasury_code: ecosystemTreasurySafeString(row.treasury_code, ECOSYSTEM_TREASURY_CODE),
    tx_type: ecosystemTreasurySafeString(row.tx_type),

    amount: ecosystemTreasurySafeNumber(row.amount, 0),
    balance_before: ecosystemTreasurySafeNumber(row.balance_before, 0),
    balance_after: ecosystemTreasurySafeNumber(row.balance_after, 0),

    liquidity_before: ecosystemTreasurySafeNumber(row.liquidity_before, 0),
    liquidity_after: ecosystemTreasurySafeNumber(row.liquidity_after, 0),

    related_project_code: ecosystemTreasurySafeString(row.related_project_code),
    related_project_name: ecosystemTreasurySafeString(row.related_project_name),
    related_request_id: ecosystemTreasurySafeString(row.related_request_id),

    actor_userid: ecosystemTreasurySafeString(row.actor_userid),
    actor_username: ecosystemTreasurySafeString(row.actor_username),
    note: ecosystemTreasurySafeString(row.note),
    meta: row.meta || {},
    created_at: row.created_at || null,
    raw: row
  };

}

/* =========================================
   FETCH MAIN TREASURY ROW
========================================= */
async function fetchEcosystemTreasuryRow(){

  const supabase = getEcosystemTreasurySupabaseClient();

  if(!supabase){
    return { error:"Supabase client not available" };
  }

  try{

    const { data, error } = await supabase
      .from(ECOSYSTEM_TREASURY_TABLE)
      .select("*")
      .eq("treasury_code", ECOSYSTEM_TREASURY_CODE)
      .maybeSingle();

    if(error){
      return { error:error.message || "Failed to fetch ecosystem treasury" };
    }

    return {
      success:true,
      data:data ? normalizeEcosystemTreasuryRow(data) : null
    };

  }catch(e){
    return {
      error:e?.message || "Ecosystem treasury fetch failed"
    };
  }

}

/* =========================================
   ENSURE MAIN TREASURY ROW
========================================= */
async function ensureEcosystemTreasury(){

  const existing = await fetchEcosystemTreasuryRow();

  if(existing.error){
    return { error:existing.error };
  }

  if(existing.data){
    return {
      success:true,
      data:existing.data
    };
  }

  // normally SQL seed should already create it
  // but in case missing, auto-create fallback row
  const supabase = getEcosystemTreasurySupabaseClient();

  if(!supabase){
    return { error:"Supabase client not available" };
  }

  const payload = {
    treasury_code: ECOSYSTEM_TREASURY_CODE,
    treasury_name: "ALBUKHR Ecosystem Treasury",
    wallet_balance: 0,
    available_liquidity: 0,
    locked_liquidity: 0,
    pending_requests_total: 0,
    approved_outflow_total: 0,
    total_inflow: 0,
    total_outflow: 0,
    treasury_status: "active",
    wallet_source: "pi_testnet_admin_wallet",
    last_wallet_sync_at: ecosystemTreasuryNowISO(),
    last_activity_at: ecosystemTreasuryNowISO(),
    notes: "Auto-created ecosystem treasury row",
    meta: {
      auto_created: true
    }
  };

  try{

    const { data, error } = await supabase
      .from(ECOSYSTEM_TREASURY_TABLE)
      .insert(payload)
      .select()
      .single();

    if(error){
      return {
        error:error.message || "Failed to create ecosystem treasury"
      };
    }

    return {
      success:true,
      data:normalizeEcosystemTreasuryRow(data)
    };

  }catch(e){
    return {
      error:e?.message || "Ecosystem treasury create failed"
    };
  }

}

/* =========================================
   GET ECOSYSTEM TREASURY
========================================= */
async function getEcosystemTreasury(){

  const ensured = await ensureEcosystemTreasury();

  if(ensured.error){
    return { error:ensured.error };
  }

  return ensured.data;

}

/* =========================================
   UPDATE ECOSYSTEM TREASURY
========================================= */
async function updateEcosystemTreasury(patch = {}){

  const supabase = getEcosystemTreasurySupabaseClient();

  if(!supabase){
    return { error:"Supabase client not available" };
  }

  try{

    const { data, error } = await supabase
      .from(ECOSYSTEM_TREASURY_TABLE)
      .update({
        ...patch,
        updated_at: ecosystemTreasuryNowISO()
      })
      .eq("treasury_code", ECOSYSTEM_TREASURY_CODE)
      .select()
      .single();

    if(error){
      return {
        error:error.message || "Failed to update ecosystem treasury"
      };
    }

    return {
      success:true,
      data:normalizeEcosystemTreasuryRow(data)
    };

  }catch(e){
    return {
      error:e?.message || "Ecosystem treasury update failed"
    };
  }

}

/* =========================================
   INSERT ECOSYSTEM TREASURY TRANSACTION
========================================= */
async function insertEcosystemTreasuryTransaction({
  tx_type,
  amount = 0,

  balance_before = 0,
  balance_after = 0,

  liquidity_before = 0,
  liquidity_after = 0,

  related_project_code = "",
  related_project_name = "",
  related_request_id = "",

  actor_userid = "",
  actor_username = "",
  note = "",
  meta = {}
}){

  const supabase = getEcosystemTreasurySupabaseClient();

  if(!supabase){
    return { error:"Supabase client not available" };
  }

  const payload = {
    treasury_code: ECOSYSTEM_TREASURY_CODE,
    tx_type: ecosystemTreasurySafeString(tx_type),

    amount: ecosystemTreasurySafeNumber(amount, 0),
    balance_before: ecosystemTreasurySafeNumber(balance_before, 0),
    balance_after: ecosystemTreasurySafeNumber(balance_after, 0),

    liquidity_before: ecosystemTreasurySafeNumber(liquidity_before, 0),
    liquidity_after: ecosystemTreasurySafeNumber(liquidity_after, 0),

    related_project_code: ecosystemTreasurySafeString(related_project_code),
    related_project_name: ecosystemTreasurySafeString(related_project_name),
    related_request_id: ecosystemTreasurySafeString(related_request_id),

    actor_userid: ecosystemTreasurySafeString(actor_userid),
    actor_username: ecosystemTreasurySafeString(actor_username),
    note: ecosystemTreasurySafeString(note),
    meta: meta || {},
    created_at: ecosystemTreasuryNowISO()
  };

  try{

    const { data, error } = await supabase
      .from(ECOSYSTEM_TREASURY_TX_TABLE)
      .insert(payload)
      .select()
      .single();

    if(error){
      return {
        error:error.message || "Failed to insert ecosystem treasury transaction"
      };
    }

    return {
      success:true,
      data:normalizeEcosystemTreasuryTxRow(data)
    };

  }catch(e){
    return {
      error:e?.message || "Ecosystem treasury transaction insert failed"
    };
  }

}

/* =========================================
   SYNC WALLET BALANCE
   This is the main function for setting
   ALBUKHR wallet balance from real source
========================================= */
async function syncEcosystemWalletBalance(balance, meta = {}){

  balance = ecosystemTreasurySafeNumber(balance, -1);

  if(balance < 0){
    return { error:"Invalid wallet balance" };
  }

  const treasury = await getEcosystemTreasury();

  if(treasury?.error){
    return { error:treasury.error };
  }

  const walletBefore =
    ecosystemTreasurySafeNumber(treasury.wallet_balance, 0);

  const availableBefore =
    ecosystemTreasurySafeNumber(treasury.available_liquidity, 0);

  const locked =
    ecosystemTreasurySafeNumber(treasury.locked_liquidity, 0);

  // available = wallet balance - locked
  let newAvailable = balance - locked;
  if(newAvailable < 0) newAvailable = 0;

  const patch = {
    wallet_balance: balance,
    available_liquidity: newAvailable,
    last_wallet_sync_at: ecosystemTreasuryNowISO(),
    last_activity_at: ecosystemTreasuryNowISO(),
    treasury_status: treasury.treasury_status || "active",
    notes: meta.note || treasury.notes || ""
  };

  const updated = await updateEcosystemTreasury(patch);

  if(updated.error){
    return { error:updated.error };
  }

  const tx = await insertEcosystemTreasuryTransaction({
    tx_type: "wallet_sync",
    amount: balance,
    balance_before: walletBefore,
    balance_after: balance,
    liquidity_before: availableBefore,
    liquidity_after: newAvailable,
    actor_userid: meta.actor_userid || "",
    actor_username: meta.actor_username || "",
    note: meta.note || "Wallet balance synced",
    meta: {
      ...(meta.meta || {}),
      sync_type: "wallet_balance_sync",
      locked_liquidity: locked
    }
  });

  if(tx.error){
    console.warn("Ecosystem wallet sync tx warning:", tx.error);
  }

  return {
    success:true,
    action:"wallet_sync",
    wallet_balance: balance,
    available_liquidity: newAvailable,
    treasury: updated.data,
    transaction: tx.data || null
  };

}

/* =========================================
   MANUAL CREDIT
   Adds treasury inflow
========================================= */
async function creditEcosystemTreasury(amount, meta = {}){

  amount = ecosystemTreasurySafeNumber(amount, 0);

  if(amount <= 0){
    return { error:"Invalid credit amount" };
  }

  const treasury = await getEcosystemTreasury();

  if(treasury?.error){
    return { error:treasury.error };
  }

  const walletBefore =
    ecosystemTreasurySafeNumber(treasury.wallet_balance, 0);

  const availableBefore =
    ecosystemTreasurySafeNumber(treasury.available_liquidity, 0);

  const walletAfter = walletBefore + amount;
  const availableAfter = availableBefore + amount;

  const patch = {
    wallet_balance: walletAfter,
    available_liquidity: availableAfter,
    total_inflow:
      ecosystemTreasurySafeNumber(treasury.total_inflow, 0) + amount,
    last_activity_at: ecosystemTreasuryNowISO()
  };

  const updated = await updateEcosystemTreasury(patch);

  if(updated.error){
    return { error:updated.error };
  }

  const tx = await insertEcosystemTreasuryTransaction({
    tx_type: "manual_credit",
    amount,
    balance_before: walletBefore,
    balance_after: walletAfter,
    liquidity_before: availableBefore,
    liquidity_after: availableAfter,
    actor_userid: meta.actor_userid || "",
    actor_username: meta.actor_username || "",
    note: meta.note || "Manual treasury credit",
    meta: meta.meta || {}
  });

  if(tx.error){
    console.warn("Ecosystem credit tx warning:", tx.error);
  }

  return {
    success:true,
    action:"manual_credit",
    amount,
    treasury: updated.data,
    transaction: tx.data || null
  };

}

/* =========================================
   MANUAL DEBIT
   Reduces treasury liquidity
========================================= */
async function debitEcosystemTreasury(amount, meta = {}){

  amount = ecosystemTreasurySafeNumber(amount, 0);

  if(amount <= 0){
    return { error:"Invalid debit amount" };
  }

  const treasury = await getEcosystemTreasury();

  if(treasury?.error){
    return { error:treasury.error };
  }

  const walletBefore =
    ecosystemTreasurySafeNumber(treasury.wallet_balance, 0);

  const availableBefore =
    ecosystemTreasurySafeNumber(treasury.available_liquidity, 0);

  if(amount > availableBefore){
    return { error:"Insufficient available ecosystem liquidity" };
  }

  const walletAfter = walletBefore - amount;
  const availableAfter = availableBefore - amount;

  const patch = {
    wallet_balance: walletAfter,
    available_liquidity: availableAfter,
    total_outflow:
      ecosystemTreasurySafeNumber(treasury.total_outflow, 0) + amount,
    last_activity_at: ecosystemTreasuryNowISO()
  };

  const updated = await updateEcosystemTreasury(patch);

  if(updated.error){
    return { error:updated.error };
  }

  const tx = await insertEcosystemTreasuryTransaction({
    tx_type: "manual_debit",
    amount,
    balance_before: walletBefore,
    balance_after: walletAfter,
    liquidity_before: availableBefore,
    liquidity_after: availableAfter,
    actor_userid: meta.actor_userid || "",
    actor_username: meta.actor_username || "",
    note: meta.note || "Manual treasury debit",
    meta: meta.meta || {}
  });

  if(tx.error){
    console.warn("Ecosystem debit tx warning:", tx.error);
  }

  return {
    success:true,
    action:"manual_debit",
    amount,
    treasury: updated.data,
    transaction: tx.data || null
  };

}

/* =========================================
   LOCK LIQUIDITY
========================================= */
async function lockEcosystemLiquidity(amount, meta = {}){

  amount = ecosystemTreasurySafeNumber(amount, 0);

  if(amount <= 0){
    return { error:"Invalid lock amount" };
  }

  const treasury = await getEcosystemTreasury();

  if(treasury?.error){
    return { error:treasury.error };
  }

  const availableBefore =
    ecosystemTreasurySafeNumber(treasury.available_liquidity, 0);

  const lockedBefore =
    ecosystemTreasurySafeNumber(treasury.locked_liquidity, 0);

  const walletBalance =
    ecosystemTreasurySafeNumber(treasury.wallet_balance, 0);

  if(amount > availableBefore){
    return { error:"Insufficient available liquidity to lock" };
  }

  const availableAfter = availableBefore - amount;
  const lockedAfter = lockedBefore + amount;

  const patch = {
    available_liquidity: availableAfter,
    locked_liquidity: lockedAfter,
    last_activity_at: ecosystemTreasuryNowISO()
  };

  const updated = await updateEcosystemTreasury(patch);

  if(updated.error){
    return { error:updated.error };
  }

  const tx = await insertEcosystemTreasuryTransaction({
    tx_type: "liquidity_lock",
    amount,
    balance_before: walletBalance,
    balance_after: walletBalance,
    liquidity_before: availableBefore,
    liquidity_after: availableAfter,
    actor_userid: meta.actor_userid || "",
    actor_username: meta.actor_username || "",
    note: meta.note || "Liquidity locked",
    meta: {
      ...(meta.meta || {}),
      locked_before: lockedBefore,
      locked_after: lockedAfter
    }
  });

  if(tx.error){
    console.warn("Ecosystem lock tx warning:", tx.error);
  }

  return {
    success:true,
    action:"liquidity_lock",
    amount,
    treasury: updated.data,
    transaction: tx.data || null
  };

}

/* =========================================
   UNLOCK LIQUIDITY
========================================= */
async function unlockEcosystemLiquidity(amount, meta = {}){

  amount = ecosystemTreasurySafeNumber(amount, 0);

  if(amount <= 0){
    return { error:"Invalid unlock amount" };
  }

  const treasury = await getEcosystemTreasury();

  if(treasury?.error){
    return { error:treasury.error };
  }

  const availableBefore =
    ecosystemTreasurySafeNumber(treasury.available_liquidity, 0);

  const lockedBefore =
    ecosystemTreasurySafeNumber(treasury.locked_liquidity, 0);

  const walletBalance =
    ecosystemTreasurySafeNumber(treasury.wallet_balance, 0);

  if(amount > lockedBefore){
    return { error:"Insufficient locked liquidity" };
  }

  const availableAfter = availableBefore + amount;
  const lockedAfter = lockedBefore - amount;

  const patch = {
    available_liquidity: availableAfter,
    locked_liquidity: lockedAfter,
    last_activity_at: ecosystemTreasuryNowISO()
  };

  const updated = await updateEcosystemTreasury(patch);

  if(updated.error){
    return { error:updated.error };
  }

  const tx = await insertEcosystemTreasuryTransaction({
    tx_type: "liquidity_unlock",
    amount,
    balance_before: walletBalance,
    balance_after: walletBalance,
    liquidity_before: availableBefore,
    liquidity_after: availableAfter,
    actor_userid: meta.actor_userid || "",
    actor_username: meta.actor_username || "",
    note: meta.note || "Liquidity unlocked",
    meta: {
      ...(meta.meta || {}),
      locked_before: lockedBefore,
      locked_after: lockedAfter
    }
  });

  if(tx.error){
    console.warn("Ecosystem unlock tx warning:", tx.error);
  }

  return {
    success:true,
    action:"liquidity_unlock",
    amount,
    treasury: updated.data,
    transaction: tx.data || null
  };

}

/* =========================================
   FUND PROJECT FROM ECOSYSTEM TREASURY
   This is the most important bridge:
   ecosystem treasury -> project treasury
========================================= */
async function fundProjectFromEcosystem(projectCode, amount, meta = {}){

  assertEcosystemTreasuryDependencies();

  amount = ecosystemTreasurySafeNumber(amount, 0);

  if(!projectCode){
    return { error:"Project code is required" };
  }

  if(amount <= 0){
    return { error:"Invalid funding amount" };
  }

  const project = await getProjectMeta(projectCode);

  if(!project){
    return { error:`Project not found: ${projectCode}` };
  }

  const treasury = await getEcosystemTreasury();

  if(treasury?.error){
    return { error:treasury.error };
  }

  if(treasury.treasury_status !== "active"){
    return { error:"Ecosystem treasury is not active" };
  }

  const walletBefore =
    ecosystemTreasurySafeNumber(treasury.wallet_balance, 0);

  const availableBefore =
    ecosystemTreasurySafeNumber(treasury.available_liquidity, 0);

  if(amount > availableBefore){
    return { error:"Insufficient available ecosystem liquidity" };
  }

  /* STEP 1: add to project treasury first */
  const projectFunding = await addProjectLiquidity(
    project.project_code,
    amount,
    {
      actor_userid: meta.actor_userid || "",
      actor_username: meta.actor_username || "",
      note: meta.note || `Funding from ecosystem treasury to ${project.project_name}`,
      meta: {
        ...(meta.meta || {}),
        source: "ecosystem_treasury",
        treasury_code: ECOSYSTEM_TREASURY_CODE
      }
    }
  );

  if(projectFunding?.error){
    return { error:projectFunding.error };
  }

  /* STEP 2: reduce ecosystem treasury */
  const walletAfter = walletBefore - amount;
  const availableAfter = availableBefore - amount;

  const patch = {
    wallet_balance: walletAfter,
    available_liquidity: availableAfter,
    approved_outflow_total:
      ecosystemTreasurySafeNumber(treasury.approved_outflow_total, 0) + amount,
    total_outflow:
      ecosystemTreasurySafeNumber(treasury.total_outflow, 0) + amount,
    last_activity_at: ecosystemTreasuryNowISO()
  };

  const updated = await updateEcosystemTreasury(patch);

  if(updated.error){
    return {
      error:
        "Project treasury funded but ecosystem treasury update failed: " +
        updated.error
    };
  }

  const tx = await insertEcosystemTreasuryTransaction({
    tx_type: "project_funding",
    amount,
    balance_before: walletBefore,
    balance_after: walletAfter,
    liquidity_before: availableBefore,
    liquidity_after: availableAfter,
    related_project_code: project.project_code,
    related_project_name: project.project_name,
    actor_userid: meta.actor_userid || "",
    actor_username: meta.actor_username || "",
    note: meta.note || `Project funding to ${project.project_name}`,
    meta: {
      ...(meta.meta || {}),
      project_type: project.project_type || "core",
      treasury_code: ECOSYSTEM_TREASURY_CODE
    }
  });

  if(tx.error){
    console.warn("Ecosystem project funding tx warning:", tx.error);
  }

  return {
    success:true,
    action:"project_funding",
    project_code: project.project_code,
    project_name: project.project_name,
    amount,
    ecosystem_treasury: updated.data,
    project_funding,
    transaction: tx.data || null
  };

}

/* =========================================
   REFUND FROM PROJECT TO ECOSYSTEM
   useful later if project returns liquidity
========================================= */
async function refundProjectToEcosystem(projectCode, amount, meta = {}){

  amount = ecosystemTreasurySafeNumber(amount, 0);

  if(!projectCode){
    return { error:"Project code is required" };
  }

  if(amount <= 0){
    return { error:"Invalid refund amount" };
  }

  const project = await getProjectMeta(projectCode);

  if(!project){
    return { error:`Project not found: ${projectCode}` };
  }

  const treasury = await getEcosystemTreasury();

  if(treasury?.error){
    return { error:treasury.error };
  }

  const walletBefore =
    ecosystemTreasurySafeNumber(treasury.wallet_balance, 0);

  const availableBefore =
    ecosystemTreasurySafeNumber(treasury.available_liquidity, 0);

  const walletAfter = walletBefore + amount;
  const availableAfter = availableBefore + amount;

  const patch = {
    wallet_balance: walletAfter,
    available_liquidity: availableAfter,
    total_inflow:
      ecosystemTreasurySafeNumber(treasury.total_inflow, 0) + amount,
    last_activity_at: ecosystemTreasuryNowISO()
  };

  const updated = await updateEcosystemTreasury(patch);

  if(updated.error){
    return { error:updated.error };
  }

  const tx = await insertEcosystemTreasuryTransaction({
    tx_type: "project_refund",
    amount,
    balance_before: walletBefore,
    balance_after: walletAfter,
    liquidity_before: availableBefore,
    liquidity_after: availableAfter,
    related_project_code: project.project_code,
    related_project_name: project.project_name,
    actor_userid: meta.actor_userid || "",
    actor_username: meta.actor_username || "",
    note: meta.note || `Project refund from ${project.project_name}`,
    meta: meta.meta || {}
  });

  if(tx.error){
    console.warn("Ecosystem project refund tx warning:", tx.error);
  }

  return {
    success:true,
    action:"project_refund",
    amount,
    treasury: updated.data,
    transaction: tx.data || null
  };

}

/* =========================================
   REQUEST TOTAL HELPERS
   for future treasury request system
========================================= */
async function setPendingRequestsTotal(amount){

  amount = ecosystemTreasurySafeNumber(amount, 0);
  if(amount < 0) amount = 0;

  const treasury = await getEcosystemTreasury();

  if(treasury?.error){
    return { error:treasury.error };
  }

  return await updateEcosystemTreasury({
    pending_requests_total: amount,
    last_activity_at: ecosystemTreasuryNowISO()
  });

}

async function incrementPendingRequestsTotal(amount){

  amount = ecosystemTreasurySafeNumber(amount, 0);
  if(amount <= 0){
    return { error:"Invalid pending amount" };
  }

  const treasury = await getEcosystemTreasury();

  if(treasury?.error){
    return { error:treasury.error };
  }

  return await updateEcosystemTreasury({
    pending_requests_total:
      ecosystemTreasurySafeNumber(treasury.pending_requests_total, 0) + amount,
    last_activity_at: ecosystemTreasuryNowISO()
  });

}

async function decrementPendingRequestsTotal(amount){

  amount = ecosystemTreasurySafeNumber(amount, 0);
  if(amount <= 0){
    return { error:"Invalid pending amount" };
  }

  const treasury = await getEcosystemTreasury();

  if(treasury?.error){
    return { error:treasury.error };
  }

  const next =
    ecosystemTreasurySafeNumber(treasury.pending_requests_total, 0) - amount;

  return await updateEcosystemTreasury({
    pending_requests_total: Math.max(0, next),
    last_activity_at: ecosystemTreasuryNowISO()
  });

}

/* =========================================
   HISTORY
========================================= */
async function getEcosystemTreasuryHistory(limit = 50){

  const supabase = getEcosystemTreasurySupabaseClient();

  if(!supabase){
    return [];
  }

  limit = ecosystemTreasurySafeNumber(limit, 50);
  if(limit <= 0) limit = 50;

  try{

    const { data, error } = await supabase
      .from(ECOSYSTEM_TREASURY_TX_TABLE)
      .select("*")
      .eq("treasury_code", ECOSYSTEM_TREASURY_CODE)
      .order("created_at", { ascending:false })
      .limit(limit);

    if(error){
      console.error("getEcosystemTreasuryHistory error:", error);
      return [];
    }

    return (data || []).map(normalizeEcosystemTreasuryTxRow);

  }catch(e){
    console.error("getEcosystemTreasuryHistory network error:", e);
    return [];
  }

}

/* =========================================
   SNAPSHOT
========================================= */
async function getEcosystemTreasurySnapshot(historyLimit = 20){

  const treasury = await getEcosystemTreasury();

  if(treasury?.error){
    return { error:treasury.error };
  }

  const history = await getEcosystemTreasuryHistory(historyLimit);

  return {
    success:true,
    treasury,
    history
  };

}

/* =========================================
   SUMMARY
========================================= */
async function getEcosystemTreasurySummary(){

  const treasury = await getEcosystemTreasury();

  if(treasury?.error){
    return { error:treasury.error };
  }

  return {
    treasury_code: treasury.treasury_code,
    treasury_name: treasury.treasury_name,
    wallet_balance: treasury.wallet_balance,
    available_liquidity: treasury.available_liquidity,
    locked_liquidity: treasury.locked_liquidity,
    pending_requests_total: treasury.pending_requests_total,
    approved_outflow_total: treasury.approved_outflow_total,
    total_inflow: treasury.total_inflow,
    total_outflow: treasury.total_outflow,
    treasury_status: treasury.treasury_status,
    last_wallet_sync_at: treasury.last_wallet_sync_at,
    last_activity_at: treasury.last_activity_at
  };

                                         }
