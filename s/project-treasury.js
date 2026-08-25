/* =========================================
   ALBUKHR PROJECT TREASURY ENGINE v5
   NETWORK-AWARE SUPABASE TREASURY ENGINE

   ARCHITECTURE:
   environment-switcher.js
          ↓
   supabase-core.js
          ↓
   projects-engine.js
          ↓
   project-treasury.js

   TABLES:
   - project_treasury
   - project_treasury_transactions

   SUPPORTED PROJECT TYPES:
   - core
   - internal
   - external

   RULES:
   - No LocalStorage
   - No direct Supabase credentials
   - Network is resolved from ALBUKHR Supabase Core
   - All treasury reads are network-scoped
   - All treasury writes are network-scoped
   - Never cross-read/cross-write Mainnet and Testnet
========================================= */

(function(){
  "use strict";

  const TREASURY_TABLE = "project_treasury";
  const TREASURY_TX_TABLE = "project_treasury_transactions";

  function treasurySafeNumber(value, fallback = 0){
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function treasurySafeString(value, fallback = ""){
    return value === null || value === undefined ? fallback : String(value);
  }

  function treasuryNowISO(){
    return new Date().toISOString();
  }

  function getTreasurySupabaseClient(){
    if(typeof window.requireAlbukhrSupabaseClient === "function"){
      return window.requireAlbukhrSupabaseClient();
    }

    if(typeof window.getAlbukhrSupabaseClient === "function"){
      const client = window.getAlbukhrSupabaseClient();
      if(client) return client;
    }

    throw new Error(
      "ALBUKHR Supabase Core client is unavailable. Load supabase-core.js first."
    );
  }

  function getTreasuryNetwork(){
    if(typeof window.requireAlbukhrNetwork !== "function"){
      throw new Error(
        "ALBUKHR network core is unavailable. Load environment-switcher.js before project-treasury.js."
      );
    }
    return window.requireAlbukhrNetwork();
  }

  function assertProjectsEngine(){
    if(typeof window.getProjectMeta !== "function"){
      throw new Error(
        "projects-engine.js is required before project-treasury.js"
      );
    }
  }

  function normalizeTreasuryRow(row = {}){
    return {
      id: row.id ?? null,
      project_code: treasurySafeString(row.project_code),
      project_name: treasurySafeString(row.project_name),
      project_type: treasurySafeString(row.project_type || "core"),
      network: treasurySafeString(row.network || ""),
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

  function normalizeTreasuryTxRow(row = {}){
    return {
      id: row.id ?? null,
      project_code: treasurySafeString(row.project_code),
      project_name: treasurySafeString(row.project_name),
      project_type: treasurySafeString(row.project_type || "core"),
      network: treasurySafeString(row.network || ""),
      tx_type: treasurySafeString(row.tx_type),
      amount: treasurySafeNumber(row.amount, 0),
      balance_before: treasurySafeNumber(row.balance_before, 0),
      balance_after: treasurySafeNumber(row.balance_after, 0),
      actor_userid: treasurySafeString(row.actor_userid),
      actor_username: treasurySafeString(row.actor_username),
      note: treasurySafeString(row.note),
      meta: row.meta || {},
      created_at: row.created_at || null,
      raw: row
    };
  }

  async function getTreasuryProjectMeta(projectCode){
    assertProjectsEngine();

    if(!projectCode) return null;

    try{
      const project = await window.getProjectMeta(projectCode);
      return project || null;
    }catch(error){
      console.error("getTreasuryProjectMeta:", error);
      return null;
    }
  }

  async function fetchProjectTreasuryRow(projectCode){
    if(!projectCode){
      return { error:"Project code is required" };
    }

    try{
      const supabase = getTreasurySupabaseClient();
      const network = getTreasuryNetwork();

      const { data, error } = await supabase
        .from(TREASURY_TABLE)
        .select("*")
        .eq("project_code", projectCode)
        .eq("network", network)
        .maybeSingle();

      if(error){
        return { error:error.message || "Failed to fetch treasury" };
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
    if(!projectCode){
      return { error:"Project code is required" };
    }

    try{
      const supabase = getTreasurySupabaseClient();
      const network = getTreasuryNetwork();
      const project = await getTreasuryProjectMeta(projectCode);

      if(!project){
        return { error:`Project not found: ${projectCode}` };
      }

      const payload = {
        project_code: project.project_code,
        project_name: project.project_name,
        project_type: project.project_type || "core",
        network,
        liquidity_balance: 0,
        total_added: 0,
        total_withdrawn: 0,
        total_reward_funded: 0,
        status: "active",
        last_activity_at: treasuryNowISO()
      };

      const { data, error } = await supabase
        .from(TREASURY_TABLE)
        .insert(payload)
        .select()
        .single();

      if(error){
        return { error:error.message || "Failed to create treasury row" };
      }

      return { success:true, data:normalizeTreasuryRow(data) };
    }catch(error){
      return { error:error?.message || "Treasury create failed" };
    }
  }

  async function ensureProjectTreasury(projectCode){
    if(!projectCode){
      return { error:"Project code is required" };
    }

    const project = await getTreasuryProjectMeta(projectCode);
    if(!project){
      return { error:`Project not found: ${projectCode}` };
    }

    const existing = await fetchProjectTreasuryRow(projectCode);
    if(existing.error) return { error:existing.error };

    if(existing.data){
      return { success:true, data:existing.data };
    }

    return await createProjectTreasury(projectCode);
  }

  async function getProjectTreasury(projectCode){
    const ensured = await ensureProjectTreasury(projectCode);
    if(ensured.error) return { error:ensured.error };
    return ensured.data;
  }

  async function getProjectLiquidity(projectCode){
    const treasury = await getProjectTreasury(projectCode);
    if(treasury?.error) return 0;
    return treasurySafeNumber(treasury.liquidity_balance, 0);
  }

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
    try{
      const supabase = getTreasurySupabaseClient();
      const network = getTreasuryNetwork();

      const payload = {
        project_code: treasurySafeString(project_code),
        project_name: treasurySafeString(project_name),
        project_type: treasurySafeString(project_type || "core"),
        network,
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

      return { success:true, data:normalizeTreasuryTxRow(data) };
    }catch(error){
      return {
        error:error?.message || "Treasury transaction insert failed"
      };
    }
  }

  async function updateTreasuryRow(projectCode, patch = {}){
    if(!projectCode){
      return { error:"Project code is required" };
    }

    try{
      const supabase = getTreasurySupabaseClient();
      const network = getTreasuryNetwork();

      /* Network is authoritative and cannot be changed by callers. */
      const safePatch = { ...patch };
      delete safePatch.network;
      delete safePatch.id;
      delete safePatch.created_at;

      safePatch.updated_at = treasuryNowISO();

      const { data, error } = await supabase
        .from(TREASURY_TABLE)
        .update(safePatch)
        .eq("project_code", projectCode)
        .eq("network", network)
        .select()
        .single();

      if(error){
        return {
          error:error.message || "Failed to update treasury row"
        };
      }

      return { success:true, data:normalizeTreasuryRow(data) };
    }catch(error){
      return { error:error?.message || "Treasury update failed" };
    }
  }

  async function addProjectLiquidity(projectCode, amount, meta = {}){
    amount = treasurySafeNumber(amount, 0);

    if(!projectCode) return { error:"Project code is required" };
    if(amount <= 0) return { error:"Invalid liquidity amount" };

    const project = await getTreasuryProjectMeta(projectCode);
    if(!project) return { error:`Project not found: ${projectCode}` };

    const treasury = await getProjectTreasury(projectCode);
    if(treasury?.error) return { error:treasury.error };

    const balanceBefore = treasurySafeNumber(treasury.liquidity_balance, 0);
    const balanceAfter = balanceBefore + amount;

    const updated = await updateTreasuryRow(projectCode, {
      project_name:project.project_name,
      project_type:project.project_type || "core",
      liquidity_balance:balanceAfter,
      total_added:treasurySafeNumber(treasury.total_added, 0) + amount,
      last_activity_at:treasuryNowISO(),
      status:"active"
    });

    if(updated.error) return { error:updated.error };

    const tx = await insertTreasuryTransaction({
      project_code:project.project_code,
      project_name:project.project_name,
      project_type:project.project_type || "core",
      tx_type:"liquidity_add",
      amount,
      balance_before:balanceBefore,
      balance_after:balanceAfter,
      actor_userid:meta.actor_userid || "",
      actor_username:meta.actor_username || "",
      note:meta.note || "Liquidity added",
      meta:meta.meta || {}
    });

    if(tx.error){
      console.warn("Treasury transaction warning:", tx.error);
    }

    return {
      success:true,
      action:"liquidity_add",
      project_code:project.project_code,
      amount,
      liquidity:balanceAfter,
      treasury:updated.data,
      transaction:tx.data || null
    };
  }

  async function projectInternalWithdraw(projectCode, amount, meta = {}){
    amount = treasurySafeNumber(amount, 0);

    if(!projectCode) return { error:"Project code is required" };
    if(amount <= 0) return { error:"Invalid withdraw amount" };

    const project = await getTreasuryProjectMeta(projectCode);
    if(!project) return { error:`Project not found: ${projectCode}` };

    const treasury = await getProjectTreasury(projectCode);
    if(treasury?.error) return { error:treasury.error };

    const balanceBefore = treasurySafeNumber(treasury.liquidity_balance, 0);

    if(amount > balanceBefore){
      return { error:"Insufficient project liquidity" };
    }

    const balanceAfter = balanceBefore - amount;

    const updated = await updateTreasuryRow(projectCode, {
      project_name:project.project_name,
      project_type:project.project_type || "core",
      liquidity_balance:balanceAfter,
      total_withdrawn:
        treasurySafeNumber(treasury.total_withdrawn, 0) + amount,
      last_activity_at:treasuryNowISO(),
      status:"active"
    });

    if(updated.error) return { error:updated.error };

    const tx = await insertTreasuryTransaction({
      project_code:project.project_code,
      project_name:project.project_name,
      project_type:project.project_type || "core",
      tx_type:"internal_withdraw",
      amount,
      balance_before:balanceBefore,
      balance_after:balanceAfter,
      actor_userid:meta.actor_userid || "",
      actor_username:meta.actor_username || "",
      note:meta.note || "Internal project withdraw",
      meta:meta.meta || {}
    });

    if(tx.error){
      console.warn("Treasury transaction warning:", tx.error);
    }

    return {
      success:true,
      action:"internal_withdraw",
      project_code:project.project_code,
      amount,
      liquidity:balanceAfter,
      treasury:updated.data,
      transaction:tx.data || null
    };
  }

  async function fundRewardFromTreasury(projectCode, amount, meta = {}){
    amount = treasurySafeNumber(amount, 0);

    if(!projectCode) return { error:"Project code is required" };
    if(amount <= 0) return { error:"Invalid reward funding amount" };

    const project = await getTreasuryProjectMeta(projectCode);
    if(!project) return { error:`Project not found: ${projectCode}` };

    const treasury = await getProjectTreasury(projectCode);
    if(treasury?.error) return { error:treasury.error };

    const balanceBefore = treasurySafeNumber(treasury.liquidity_balance, 0);

    if(amount > balanceBefore){
      return { error:"Insufficient project liquidity" };
    }

    const balanceAfter = balanceBefore - amount;

    const updated = await updateTreasuryRow(projectCode, {
      project_name:project.project_name,
      project_type:project.project_type || "core",
      liquidity_balance:balanceAfter,
      total_reward_funded:
        treasurySafeNumber(treasury.total_reward_funded, 0) + amount,
      last_activity_at:treasuryNowISO(),
      status:"active"
    });

    if(updated.error) return { error:updated.error };

    const tx = await insertTreasuryTransaction({
      project_code:project.project_code,
      project_name:project.project_name,
      project_type:project.project_type || "core",
      tx_type:"reward_funding",
      amount,
      balance_before:balanceBefore,
      balance_after:balanceAfter,
      actor_userid:meta.actor_userid || "",
      actor_username:meta.actor_username || "",
      note:meta.note || "Reward funding from treasury",
      meta:meta.meta || {}
    });

    if(tx.error){
      console.warn("Treasury transaction warning:", tx.error);
    }

    return {
      success:true,
      action:"reward_funding",
      project_code:project.project_code,
      amount,
      liquidity:balanceAfter,
      treasury:updated.data,
      transaction:tx.data || null
    };
  }

  async function getProjectTreasuryHistory(projectCode, limit = 50){
    if(!projectCode) return [];

    try{
      const supabase = getTreasurySupabaseClient();
      const network = getTreasuryNetwork();

      limit = Math.max(1, Math.floor(treasurySafeNumber(limit, 50)));

      const { data, error } = await supabase
        .from(TREASURY_TX_TABLE)
        .select("*")
        .eq("project_code", projectCode)
        .eq("network", network)
        .order("created_at", { ascending:false })
        .limit(limit);

      if(error){
        console.error("getProjectTreasuryHistory:", error);
        return [];
      }

      return (data || []).map(normalizeTreasuryTxRow);
    }catch(error){
      console.error("getProjectTreasuryHistory:", error);
      return [];
    }
  }

  async function getProjectTreasurySnapshot(projectCode, historyLimit = 20){
    const project = await getTreasuryProjectMeta(projectCode);

    if(!project){
      return { error:`Project not found: ${projectCode}` };
    }

    const treasury = await getProjectTreasury(projectCode);
    if(treasury?.error) return { error:treasury.error };

    const history = await getProjectTreasuryHistory(
      projectCode,
      historyLimit
    );

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
      const supabase = getTreasurySupabaseClient();
      const network = getTreasuryNetwork();

      const { data, error } = await supabase
        .from(TREASURY_TABLE)
        .select("*")
        .eq("network", network)
        .order("project_name", { ascending:true });

      if(error){
        console.error("getAllProjectTreasuries:", error);
        return [];
      }

      return (data || []).map(normalizeTreasuryRow);
    }catch(error){
      console.error("getAllProjectTreasuries:", error);
      return [];
    }
  }

  async function getProjectTreasuriesByType(projectType){
    const type = treasurySafeString(projectType).trim().toLowerCase();
    if(!type) return [];

    const rows = await getAllProjectTreasuries();

    return rows.filter(row =>
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
      project_code:row.project_code,
      project_name:row.project_name,
      project_type:row.project_type,
      network:row.network,
      liquidity_balance:treasurySafeNumber(row.liquidity_balance, 0),
      total_added:treasurySafeNumber(row.total_added, 0),
      total_withdrawn:treasurySafeNumber(row.total_withdrawn, 0),
      total_reward_funded:treasurySafeNumber(row.total_reward_funded, 0),
      status:row.status || "active",
      last_activity_at:row.last_activity_at || null
    }));
  }

  async function getTreasuryEngineSummary(projectCode){
    const project = await getTreasuryProjectMeta(projectCode);

    if(!project){
      return {
        project_code:projectCode,
        error:"Project not found"
      };
    }

    const treasury = await getProjectTreasury(projectCode);

    if(treasury?.error){
      return {
        project_code:projectCode,
        error:treasury.error
      };
    }

    return {
      network:getTreasuryNetwork(),
      project_code:treasury.project_code,
      project_name:treasury.project_name,
      project_type:treasury.project_type,
      liquidity_balance:treasury.liquidity_balance,
      total_added:treasury.total_added,
      total_withdrawn:treasury.total_withdrawn,
      total_reward_funded:treasury.total_reward_funded,
      status:treasury.status,
      last_activity_at:treasury.last_activity_at
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

  console.log("ALBUKHR Project Treasury Engine v5 loaded.");

})();
