/* =========================================
   ALBUKHR PROJECT TREASURY ENGINE v5
   NETWORK + ADMIN AUTH SAFE PATCH

   PURPOSE:
   - Project treasury ledger
   - Mainnet / Testnet isolation
   - Admin-authorized treasury mutations
   - Public/core-client treasury reads
   - Compatible API with previous v4 engine

   DEPENDS ON:
   - js/supabase-core.js
   - js/projects-engine.js
   - js/supabase-admin-auth/admin-supabase-auth.js
   - js/supabase-admin-auth/admin-session.js

   DATABASE TABLES:
   - project_treasury
   - project_treasury_transactions

   IMPORTANT:
   - Does NOT use Pi Auth
   - Does NOT use Pi Payment
   - Does NOT modify staking
   - Does NOT modify transactions
   - Does NOT modify capital protection
   - Does NOT modify deployment
   - Does NOT modify project updates
========================================= */

(function(window){

"use strict";

const TREASURY_TABLE = "project_treasury";
const TREASURY_TX_TABLE = "project_treasury_transactions";

function treasurySafeNumber(value, fallback = 0){
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function treasurySafeString(value, fallback = ""){
  if(value === null || value === undefined) return fallback;
  return String(value);
}

function treasuryNowISO(){
  return new Date().toISOString();
}

function getTreasuryNetwork(){
  if(typeof window.getAlbukhrNetwork !== "function"){
    throw new Error("ALBUKHR Network Core is not loaded.");
  }
  const network = window.getAlbukhrNetwork();
  if(network !== "mainnet" && network !== "testnet"){
    throw new Error("Invalid ALBUKHR network.");
  }
  return network;
}

function getTreasuryCoreClient(){
  if(typeof window.getAlbukhrSupabaseClient === "function"){
    const client = window.getAlbukhrSupabaseClient();
    if(client) return client;
  }
  if(window.albukhrSupabase) return window.albukhrSupabase;
  throw new Error("ALBUKHR Supabase Core client not available.");
}

function getTreasuryAdminClient(){
  if(typeof window.getAlbukhrAdminSupabaseClient !== "function") return null;
  try{
    return window.getAlbukhrAdminSupabaseClient();
  }catch(error){
    console.warn("[TREASURY] Admin client unavailable:", error);
    return null;
  }
}

async function getTreasuryCurrentAdmin(){
  if(typeof window.getCurrentAdmin !== "function") return null;
  try{
    const admin = await window.getCurrentAdmin();
    if(!admin) return null;
    if(
      treasurySafeString(admin.status).trim().toLowerCase() !== "active"
    ) return null;
    return admin;
  }catch(error){
    console.warn("[TREASURY] Current admin lookup failed:", error);
    return null;
  }
}

async function requireTreasuryAdminClient(){
  const admin = await getTreasuryCurrentAdmin();
  if(!admin){
    throw new Error(
      "Active administrator session is required for treasury mutation."
    );
  }
  const client = getTreasuryAdminClient();
  if(!client){
    throw new Error("ALBUKHR Admin Supabase client is not available.");
  }
  return { client, admin };
}

function assertProjectsEngine(){
  if(typeof window.getProjectMeta !== "function"){
    throw new Error(
      "projects-engine.js is required before project-treasury.js"
    );
  }
}

async function getTreasuryProjectMeta(projectCode){
  assertProjectsEngine();
  if(!projectCode) return null;
  try{
    const project = await window.getProjectMeta(projectCode);
    return project || null;
  }catch(error){
    console.error("[TREASURY] Project meta error:", error);
    return null;
  }
}

function getProjectId(project){
  return project?.id || project?.project_id || null;
}

function getProjectCode(project){
  return treasurySafeString(
    project?.project_code || project?.code || ""
  ).trim();
}

function getProjectName(project){
  return treasurySafeString(
    project?.project_name || project?.name || ""
  ).trim();
}

function getProjectType(project){
  return treasurySafeString(project?.project_type || "core")
    .trim()
    .toLowerCase();
}

function normalizeTreasuryRow(row = {}){
  return {
    id: row.id ?? null,
    project_id: row.project_id ?? null,
    project_code: treasurySafeString(row.project_code),
    project_name: treasurySafeString(row.project_name),
    project_type: treasurySafeString(row.project_type || "core"),
    liquidity_balance: treasurySafeNumber(row.liquidity_balance, 0),
    total_inflow: treasurySafeNumber(row.total_inflow, 0),
    total_outflow: treasurySafeNumber(row.total_outflow, 0),
    total_reward_funded: treasurySafeNumber(row.total_reward_funded, 0),
    total_internal_withdrawn: treasurySafeNumber(row.total_internal_withdrawn, 0),
    status: treasurySafeString(row.status || "active"),
    network: treasurySafeString(row.network),
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    total_added: treasurySafeNumber(row.total_inflow, 0),
    total_withdrawn: treasurySafeNumber(row.total_outflow, 0),
    last_activity_at: row.updated_at || row.created_at || null,
    raw: row
  };
}

function normalizeTreasuryTxRow(row = {}){
  return {
    id: row.id ?? null,
    project_id: row.project_id ?? null,
    project_code: treasurySafeString(row.project_code),
    project_name: treasurySafeString(row.project_name),
    project_type: treasurySafeString(row.project_type || "core"),
    tx_type: treasurySafeString(row.tx_type),
    amount: treasurySafeNumber(row.amount, 0),
    balance_before: treasurySafeNumber(row.balance_before, 0),
    balance_after: treasurySafeNumber(row.balance_after, 0),
    reference_table: treasurySafeString(row.reference_table),
    reference_id: treasurySafeString(row.reference_id),
    actor_userid: treasurySafeString(row.actor_userid),
    actor_username: treasurySafeString(row.actor_username),
    note: treasurySafeString(row.note),
    meta: row.meta || {},
    network: treasurySafeString(row.network),
    created_at: row.created_at || null,
    raw: row
  };
}

async function fetchProjectTreasuryRow(projectCode){
  if(!projectCode) return { error: "Project code is required" };
  try{
    const network = getTreasuryNetwork();
    const supabase = getTreasuryCoreClient();
    const { data, error } = await supabase
      .from(TREASURY_TABLE)
      .select("*")
      .eq("project_code", projectCode)
      .eq("network", network)
      .maybeSingle();
    if(error){
      return { error: error.message || "Failed to fetch treasury" };
    }
    return {
      success:true,
      data:data ? normalizeTreasuryRow(data) : null
    };
  }catch(error){
    return { error:error?.message || "Treasury fetch failed" };
  }
}

async function createProjectTreasury(projectCode){
  if(!projectCode) return { error:"Project code is required" };
  try{
    const { client:supabase, admin } = await requireTreasuryAdminClient();
    const network = getTreasuryNetwork();
    const project = await getTreasuryProjectMeta(projectCode);
    if(!project) return { error:`Project not found: ${projectCode}` };

    const projectId = getProjectId(project);
    const code = getProjectCode(project);
    const name = getProjectName(project);

    if(!projectId){
      return { error:"Project ID is required for treasury creation." };
    }
    if(!code) return { error:"Project code is missing." };

    const payload = {
      project_id: projectId,
      project_code: code,
      project_name: name || code,
      project_type: getProjectType(project),
      liquidity_balance: 0,
      total_inflow: 0,
      total_outflow: 0,
      total_reward_funded: 0,
      total_internal_withdrawn: 0,
      status: "active",
      network
    };

    const { data, error } = await supabase
      .from(TREASURY_TABLE)
      .insert(payload)
      .select("*")
      .single();

    if(error){
      return { error:error.message || "Failed to create treasury row" };
    }

    return {
      success:true,
      data:normalizeTreasuryRow(data),
      admin_id:admin.id
    };
  }catch(error){
    return { error:error?.message || "Treasury create failed" };
  }
}

async function ensureProjectTreasury(projectCode){
  if(!projectCode) return { error:"Project code is required" };

  const project = await getTreasuryProjectMeta(projectCode);
  if(!project) return { error:`Project not found: ${projectCode}` };

  const existing = await fetchProjectTreasuryRow(projectCode);
  if(existing.error) return { error:existing.error };

  if(existing.data) return { success:true, data:existing.data };

  const admin = await getTreasuryCurrentAdmin();
  if(!admin){
    return {
      error:
        "Project treasury does not exist yet. Active administrator session is required to create it."
    };
  }

  return await createProjectTreasury(projectCode);
}

async function getProjectTreasury(projectCode){
  const result = await ensureProjectTreasury(projectCode);
  if(result.error) return { error:result.error };
  return result.data;
}

async function getProjectLiquidity(projectCode){
  const treasury = await getProjectTreasury(projectCode);
  if(treasury?.error) return 0;
  return treasurySafeNumber(treasury.liquidity_balance, 0);
}

async function insertTreasuryTransaction({
  project_id = null,
  project_code,
  project_name,
  project_type,
  tx_type,
  amount,
  balance_before,
  balance_after,
  reference_table = null,
  reference_id = null,
  actor_userid = "",
  actor_username = "",
  note = "",
  meta = {}
}){
  try{
    const { client:supabase } = await requireTreasuryAdminClient();
    const network = getTreasuryNetwork();

    const payload = {
      project_id,
      project_code:treasurySafeString(project_code),
      project_name:treasurySafeString(project_name),
      project_type:treasurySafeString(project_type || "core"),
      tx_type:treasurySafeString(tx_type),
      amount:treasurySafeNumber(amount, 0),
      balance_before:treasurySafeNumber(balance_before, 0),
      balance_after:treasurySafeNumber(balance_after, 0),
      reference_table:reference_table || null,
      reference_id:reference_id || null,
      actor_userid:treasurySafeString(actor_userid) || null,
      actor_username:treasurySafeString(actor_username) || null,
      note:treasurySafeString(note) || null,
      meta:meta || {},
      network
    };

    const { data, error } = await supabase
      .from(TREASURY_TX_TABLE)
      .insert(payload)
      .select("*")
      .single();

    if(error){
      return {
        error:error.message || "Failed to insert treasury transaction"
      };
    }

    return { success:true, data:normalizeTreasuryTxRow(data) };
  }catch(error){
    return {
      error:error?.message || "Treasury transaction insert failed"
    };
  }
}

async function updateTreasuryRow(projectCode, patch = {}){
  if(!projectCode) return { error:"Project code is required" };

  try{
    const { client:supabase } = await requireTreasuryAdminClient();
    const network = getTreasuryNetwork();

    const safePatch = {
      ...patch,
      network,
      updated_at:treasuryNowISO()
    };

    const { data, error } = await supabase
      .from(TREASURY_TABLE)
      .update(safePatch)
      .eq("project_code", projectCode)
      .eq("network", network)
      .select("*")
      .single();

    if(error){
      return { error:error.message || "Failed to update treasury row" };
    }

    return { success:true, data:normalizeTreasuryRow(data) };
  }catch(error){
    return { error:error?.message || "Treasury update failed" };
  }
}

async function getTreasuryActor(){
  const admin = await getTreasuryCurrentAdmin();

  if(!admin){
    return {
      actor_userid:"system",
      actor_username:"Treasury Engine",
      admin:null
    };
  }

  return {
    actor_userid:treasurySafeString(admin.auth_user_id || admin.id),
    actor_username:treasurySafeString(
      admin.username || admin.email || "Admin"
    ),
    admin
  };
}

async function addProjectLiquidity(projectCode, amount, meta = {}){
  amount = treasurySafeNumber(amount, 0);
  if(!projectCode) return { error:"Project code is required" };
  if(amount <= 0) return { error:"Invalid liquidity amount" };

  try{
    const actor = await getTreasuryActor();
    if(!actor.admin) return { error:"Active administrator session is required." };

    const project = await getTreasuryProjectMeta(projectCode);
    if(!project) return { error:`Project not found: ${projectCode}` };

    const treasury = await getProjectTreasury(projectCode);
    if(treasury?.error) return { error:treasury.error };

    const balanceBefore = treasurySafeNumber(treasury.liquidity_balance, 0);
    const balanceAfter = balanceBefore + amount;

    const updated = await updateTreasuryRow(projectCode, {
      project_id:getProjectId(project),
      project_name:getProjectName(project),
      project_type:getProjectType(project),
      liquidity_balance:balanceAfter,
      total_inflow:treasurySafeNumber(treasury.total_inflow, 0) + amount,
      status:"active"
    });

    if(updated.error) return { error:updated.error };

    const tx = await insertTreasuryTransaction({
      project_id:getProjectId(project),
      project_code:getProjectCode(project),
      project_name:getProjectName(project),
      project_type:getProjectType(project),
      tx_type:"liquidity_add",
      amount,
      balance_before:balanceBefore,
      balance_after:balanceAfter,
      reference_table:meta.reference_table || "project_treasury",
      reference_id:meta.reference_id || updated.data?.id || null,
      actor_userid:meta.actor_userid || actor.actor_userid,
      actor_username:meta.actor_username || actor.actor_username,
      note:meta.note || "Liquidity added",
      meta:meta.meta || {}
    });

    if(tx.error){
      console.error(
        "[TREASURY] Balance updated but transaction ledger insert failed:",
        tx.error
      );
      return {
        success:false,
        partial:true,
        error:
          "Liquidity balance was updated but treasury transaction ledger failed: " +
          tx.error,
        treasury:updated.data,
        transaction:null
      };
    }

    return {
      success:true,
      action:"liquidity_add",
      project_code:getProjectCode(project),
      amount,
      liquidity:balanceAfter,
      treasury:updated.data,
      transaction:tx.data
    };
  }catch(error){
    return { error:error?.message || "Add liquidity failed" };
  }
}

async function projectInternalWithdraw(projectCode, amount, meta = {}){
  amount = treasurySafeNumber(amount, 0);
  if(!projectCode) return { error:"Project code is required" };
  if(amount <= 0) return { error:"Invalid withdraw amount" };

  try{
    const actor = await getTreasuryActor();
    if(!actor.admin) return { error:"Active administrator session is required." };

    const project = await getTreasuryProjectMeta(projectCode);
    if(!project) return { error:`Project not found: ${projectCode}` };

    const treasury = await getProjectTreasury(projectCode);
    if(treasury?.error) return { error:treasury.error };

    const balanceBefore = treasurySafeNumber(treasury.liquidity_balance, 0);
    if(amount > balanceBefore) return { error:"Insufficient project liquidity" };

    const balanceAfter = balanceBefore - amount;

    const updated = await updateTreasuryRow(projectCode, {
      project_id:getProjectId(project),
      project_name:getProjectName(project),
      project_type:getProjectType(project),
      liquidity_balance:balanceAfter,
      total_outflow:treasurySafeNumber(treasury.total_outflow, 0) + amount,
      total_internal_withdrawn:
        treasurySafeNumber(treasury.total_internal_withdrawn, 0) + amount,
      status:"active"
    });

    if(updated.error) return { error:updated.error };

    const tx = await insertTreasuryTransaction({
      project_id:getProjectId(project),
      project_code:getProjectCode(project),
      project_name:getProjectName(project),
      project_type:getProjectType(project),
      tx_type:"internal_withdraw",
      amount,
      balance_before:balanceBefore,
      balance_after:balanceAfter,
      reference_table:meta.reference_table || "project_treasury",
      reference_id:meta.reference_id || updated.data?.id || null,
      actor_userid:meta.actor_userid || actor.actor_userid,
      actor_username:meta.actor_username || actor.actor_username,
      note:meta.note || "Internal project withdraw",
      meta:meta.meta || {}
    });

    if(tx.error){
      console.error("[TREASURY] Withdraw ledger insert failed:", tx.error);
      return {
        success:false,
        partial:true,
        error:
          "Treasury balance was updated but transaction ledger failed: " +
          tx.error,
        treasury:updated.data,
        transaction:null
      };
    }

    return {
      success:true,
      action:"internal_withdraw",
      project_code:getProjectCode(project),
      amount,
      liquidity:balanceAfter,
      treasury:updated.data,
      transaction:tx.data
    };
  }catch(error){
    return { error:error?.message || "Internal withdraw failed" };
  }
}

async function fundRewardFromTreasury(projectCode, amount, meta = {}){
  amount = treasurySafeNumber(amount, 0);
  if(!projectCode) return { error:"Project code is required" };
  if(amount <= 0) return { error:"Invalid reward funding amount" };

  try{
    const actor = await getTreasuryActor();
    if(!actor.admin) return { error:"Active administrator session is required." };

    const project = await getTreasuryProjectMeta(projectCode);
    if(!project) return { error:`Project not found: ${projectCode}` };

    const treasury = await getProjectTreasury(projectCode);
    if(treasury?.error) return { error:treasury.error };

    const balanceBefore = treasurySafeNumber(treasury.liquidity_balance, 0);
    if(amount > balanceBefore) return { error:"Insufficient project liquidity" };

    const balanceAfter = balanceBefore - amount;

    const updated = await updateTreasuryRow(projectCode, {
      project_id:getProjectId(project),
      project_name:getProjectName(project),
      project_type:getProjectType(project),
      liquidity_balance:balanceAfter,
      total_outflow:treasurySafeNumber(treasury.total_outflow, 0) + amount,
      total_reward_funded:
        treasurySafeNumber(treasury.total_reward_funded, 0) + amount,
      status:"active"
    });

    if(updated.error) return { error:updated.error };

    const tx = await insertTreasuryTransaction({
      project_id:getProjectId(project),
      project_code:getProjectCode(project),
      project_name:getProjectName(project),
      project_type:getProjectType(project),
      tx_type:"reward_funding",
      amount,
      balance_before:balanceBefore,
      balance_after:balanceAfter,
      reference_table:meta.reference_table || "project_treasury",
      reference_id:meta.reference_id || updated.data?.id || null,
      actor_userid:meta.actor_userid || actor.actor_userid,
      actor_username:meta.actor_username || actor.actor_username,
      note:meta.note || "Reward funding from treasury",
      meta:meta.meta || {}
    });

    if(tx.error){
      console.error("[TREASURY] Reward ledger insert failed:", tx.error);
      return {
        success:false,
        partial:true,
        error:
          "Treasury balance was updated but transaction ledger failed: " +
          tx.error,
        treasury:updated.data,
        transaction:null
      };
    }

    return {
      success:true,
      action:"reward_funding",
      project_code:getProjectCode(project),
      amount,
      liquidity:balanceAfter,
      treasury:updated.data,
      transaction:tx.data
    };
  }catch(error){
    return { error:error?.message || "Reward funding failed" };
  }
}

async function getProjectTreasuryHistory(projectCode, limit = 50){
  if(!projectCode) return [];
  try{
    const network = getTreasuryNetwork();
    const supabase = getTreasuryCoreClient();
    limit = treasurySafeNumber(limit, 50);
    if(limit <= 0) limit = 50;

    const { data, error } = await supabase
      .from(TREASURY_TX_TABLE)
      .select("*")
      .eq("project_code", projectCode)
      .eq("network", network)
      .order("created_at", { ascending:false })
      .limit(limit);

    if(error){
      console.error("[TREASURY] History error:", error);
      return [];
    }

    return (data || []).map(normalizeTreasuryTxRow);
  }catch(error){
    console.error("[TREASURY] History failed:", error);
    return [];
  }
}

async function getProjectTreasurySnapshot(projectCode, historyLimit = 20){
  const project = await getTreasuryProjectMeta(projectCode);
  if(!project) return { error:`Project not found: ${projectCode}` };

  const treasury = await getProjectTreasury(projectCode);
  if(treasury?.error) return { error:treasury.error };

  const history = await getProjectTreasuryHistory(projectCode, historyLimit);

  return {
    success:true,
    network:getTreasuryNetwork(),
    project,
    treasury,
    history
  };
}

async function getAllProjectTreasuries(){
  try{
    const network = getTreasuryNetwork();
    const supabase = getTreasuryCoreClient();

    const { data, error } = await supabase
      .from(TREASURY_TABLE)
      .select("*")
      .eq("network", network)
      .order("project_name", { ascending:true });

    if(error){
      console.error("[TREASURY] All treasuries error:", error);
      return [];
    }

    return (data || []).map(normalizeTreasuryRow);
  }catch(error){
    console.error("[TREASURY] All treasuries failed:", error);
    return [];
  }
}

async function getProjectTreasuriesByType(projectType){
  const type = treasurySafeString(projectType).trim().toLowerCase();
  if(!type) return [];

  const rows = await getAllProjectTreasuries();
  return rows.filter(
    row =>
      treasurySafeString(row.project_type).trim().toLowerCase() === type
  );
}

async function getCoreProjectTreasuries(){
  return await getProjectTreasuriesByType("core");
}

async function getInternalProjectTreasuries(){
  return await getProjectTreasuriesByType("internal");
}

async function getExternalProjectTreasuries(){
  return await getProjectTreasuriesByType("external");
}

async function getAllTreasurySnapshots(){
  const treasuries = await getAllProjectTreasuries();

  return treasuries.map(row => ({
    project_id:row.project_id,
    project_code:row.project_code,
    project_name:row.project_name,
    project_type:row.project_type,
    liquidity_balance:treasurySafeNumber(row.liquidity_balance, 0),
    total_inflow:treasurySafeNumber(row.total_inflow, 0),
    total_outflow:treasurySafeNumber(row.total_outflow, 0),
    total_reward_funded:treasurySafeNumber(row.total_reward_funded, 0),
    total_internal_withdrawn:
      treasurySafeNumber(row.total_internal_withdrawn, 0),
    total_added:treasurySafeNumber(row.total_inflow, 0),
    total_withdrawn:treasurySafeNumber(row.total_outflow, 0),
    status:row.status || "active",
    network:row.network,
    last_activity_at:row.updated_at || null
  }));
}

async function getTreasuryEngineSummary(projectCode){
  const project = await getTreasuryProjectMeta(projectCode);
  if(!project){
    return { project_code:projectCode, error:"Project not found" };
  }

  const treasury = await getProjectTreasury(projectCode);
  if(treasury?.error){
    return { project_code:projectCode, error:treasury.error };
  }

  return {
    project_id:treasury.project_id,
    project_code:treasury.project_code,
    project_name:treasury.project_name,
    project_type:treasury.project_type,
    liquidity_balance:treasury.liquidity_balance,
    total_inflow:treasury.total_inflow,
    total_outflow:treasury.total_outflow,
    total_reward_funded:treasury.total_reward_funded,
    total_internal_withdrawn:treasury.total_internal_withdrawn,
    total_added:treasury.total_inflow,
    total_withdrawn:treasury.total_outflow,
    status:treasury.status,
    network:treasury.network,
    last_activity_at:treasury.updated_at
  };
}

window.fetchProjectTreasuryRow = fetchProjectTreasuryRow;
window.createProjectTreasury = createProjectTreasury;
window.ensureProjectTreasury = ensureProjectTreasury;
window.getProjectTreasury = getProjectTreasury;
window.getProjectLiquidity = getProjectLiquidity;
window.addProjectLiquidity = addProjectLiquidity;
window.projectInternalWithdraw = projectInternalWithdraw;
window.fundRewardFromTreasury = fundRewardFromTreasury;
window.insertTreasuryTransaction = insertTreasuryTransaction;
window.updateTreasuryRow = updateTreasuryRow;
window.getProjectTreasuryHistory = getProjectTreasuryHistory;
window.getProjectTreasurySnapshot = getProjectTreasurySnapshot;
window.getAllProjectTreasuries = getAllProjectTreasuries;
window.getProjectTreasuriesByType = getProjectTreasuriesByType;
window.getCoreProjectTreasuries = getCoreProjectTreasuries;
window.getInternalProjectTreasuries = getInternalProjectTreasuries;
window.getExternalProjectTreasuries = getExternalProjectTreasuries;
window.getAllTreasurySnapshots = getAllTreasurySnapshots;
window.getTreasuryEngineSummary = getTreasuryEngineSummary;

console.log("✅ ALBUKHR Project Treasury Engine v5 ready");

})(window);
