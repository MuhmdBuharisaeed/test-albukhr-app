/* =========================================
   ALBUKHR PROJECT TREASURY ENGINE v6
   NETWORK-AWARE / SUPABASE / ADMIN-SAFE

   FOUNDATION:
   - js/core/supabase-core.js
   - shared network foundation exposing getAlbukhrNetwork()
   - js/projects-engine.js
   - js/supabase-admin-auth/admin-supabase-auth.js
   - js/supabase-admin-auth/admin-session.js

   DATABASE:
   - project_treasury
   - project_treasury_transactions

   RULES:
   - Supabase is the persistence source of truth.
   - Every treasury query is isolated by active network.
   - Mutations require an active administrator.
   - Core reads use the shared core Supabase client.
   - Admin mutations use the shared admin Supabase client.
   - No LocalStorage, Pi Auth, Pi Payment, staking, global
     transaction, capital-protection, deployment, or updates logic.
   - Existing v5 public function names are preserved.
========================================= */

(function(window){
  "use strict";

  const ENGINE_VERSION = "6.0.0";
  const TREASURY_TABLE = "project_treasury";
  const TREASURY_TX_TABLE = "project_treasury_transactions";

  const safeNumber = (v, fallback=0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const safeString = (v, fallback="") =>
    v === null || v === undefined ? fallback : String(v);

  const nowISO = () => new Date().toISOString();

  const projectCode = v => safeString(v).trim();

  function getNetwork(){
    if(typeof window.getAlbukhrNetwork !== "function"){
      throw new Error("ALBUKHR Network Core is not loaded.");
    }
    const network = safeString(window.getAlbukhrNetwork())
      .trim().toLowerCase();
    if(network !== "mainnet" && network !== "testnet"){
      throw new Error("Invalid ALBUKHR network.");
    }
    return network;
  }

  function getCoreClient(){
    if(typeof window.getAlbukhrSupabaseClient === "function"){
      const client = window.getAlbukhrSupabaseClient();
      if(client) return client;
    }
    if(window.albukhrSupabase) return window.albukhrSupabase;
    throw new Error("ALBUKHR Supabase Core client not available.");
  }

  function getAdminClient(){
    if(typeof window.getAlbukhrAdminSupabaseClient !== "function"){
      return null;
    }
    try{
      return window.getAlbukhrAdminSupabaseClient() || null;
    }catch(error){
      console.warn("[TREASURY] Admin client unavailable:", error);
      return null;
    }
  }

  async function currentAdmin(){
    if(typeof window.getCurrentAdmin !== "function") return null;
    try{
      const admin = await window.getCurrentAdmin();
      if(!admin) return null;
      if(safeString(admin.status).trim().toLowerCase() !== "active"){
        return null;
      }
      return admin;
    }catch(error){
      console.warn("[TREASURY] Current admin lookup failed:", error);
      return null;
    }
  }

  async function requireAdmin(){
    const admin = await currentAdmin();
    if(!admin){
      throw new Error(
        "Active administrator session is required for treasury mutation."
      );
    }
    const client = getAdminClient();
    if(!client){
      throw new Error("ALBUKHR Admin Supabase client is not available.");
    }
    return {client, admin};
  }

  function assertProjectsEngine(){
    if(typeof window.getProjectMeta !== "function"){
      throw new Error(
        "projects-engine.js is required before project-treasury.js"
      );
    }
  }

  async function getProject(projectCodeValue){
    assertProjectsEngine();
    const code = projectCode(projectCodeValue);
    if(!code) return null;

    try{
      const project = await window.getProjectMeta(code);
      if(!project) return null;

      const pn = safeString(
        project.network || project.environment || project.network_name || ""
      ).trim().toLowerCase();

      if(pn){
        const active = getNetwork();
        const compatible = pn === active ||
          (pn === "production" && active === "mainnet");
        if(!compatible){
          console.warn("[TREASURY] Project network mismatch:", pn, active);
          return null;
        }
      }
      return project;
    }catch(error){
      console.error("[TREASURY] Project meta error:", error);
      return null;
    }
  }

  const getProjectId = p => p?.id || p?.project_id || null;
  const getProjectCode = p => projectCode(p?.project_code || p?.code || "");
  const getProjectName = p =>
    safeString(p?.project_name || p?.name || "").trim();
  const getProjectType = p =>
    safeString(p?.project_type || "core").trim().toLowerCase();

  function normalizeTreasury(row={}){
    return {
      id: row.id ?? null,
      project_id: row.project_id ?? null,
      project_code: safeString(row.project_code),
      project_name: safeString(row.project_name),
      project_type: safeString(row.project_type || "core"),
      liquidity_balance: safeNumber(row.liquidity_balance),
      total_inflow: safeNumber(row.total_inflow),
      total_outflow: safeNumber(row.total_outflow),
      total_reward_funded: safeNumber(row.total_reward_funded),
      total_internal_withdrawn: safeNumber(row.total_internal_withdrawn),
      status: safeString(row.status || "active"),
      network: safeString(row.network),
      created_at: row.created_at || null,
      updated_at: row.updated_at || null,
      total_added: safeNumber(row.total_inflow),
      total_withdrawn: safeNumber(row.total_outflow),
      last_activity_at: row.updated_at || row.created_at || null,
      raw: row
    };
  }

  function normalizeTx(row={}){
    return {
      id: row.id ?? null,
      project_id: row.project_id ?? null,
      project_code: safeString(row.project_code),
      project_name: safeString(row.project_name),
      project_type: safeString(row.project_type || "core"),
      tx_type: safeString(row.tx_type),
      amount: safeNumber(row.amount),
      balance_before: safeNumber(row.balance_before),
      balance_after: safeNumber(row.balance_after),
      reference_table: safeString(row.reference_table),
      reference_id: safeString(row.reference_id),
      actor_userid: safeString(row.actor_userid),
      actor_username: safeString(row.actor_username),
      note: safeString(row.note),
      meta: row.meta || {},
      network: safeString(row.network),
      created_at: row.created_at || null,
      raw: row
    };
  }

  async function fetchProjectTreasuryRow(codeValue){
    const code = projectCode(codeValue);
    if(!code) return {error:"Project code is required"};

    try{
      const network = getNetwork();
      const {data,error} = await getCoreClient()
        .from(TREASURY_TABLE)
        .select("*")
        .eq("project_code", code)
        .eq("network", network)
        .maybeSingle();

      if(error) return {error:error.message || "Failed to fetch treasury"};
      return {success:true, data:data ? normalizeTreasury(data) : null};
    }catch(error){
      return {error:error?.message || "Treasury fetch failed"};
    }
  }

  async function createProjectTreasury(codeValue){
    const input = projectCode(codeValue);
    if(!input) return {error:"Project code is required"};

    try{
      const {client,admin} = await requireAdmin();
      const network = getNetwork();
      const project = await getProject(input);

      if(!project){
        return {error:`Project not found in active network: ${input}`};
      }

      const pid = getProjectId(project);
      const code = getProjectCode(project);
      if(!pid) return {error:"Project ID is required for treasury creation."};
      if(!code) return {error:"Project code is missing."};

      const existing = await fetchProjectTreasuryRow(code);
      if(existing.error) return {error:existing.error};
      if(existing.data){
        return {
          success:true,
          data:existing.data,
          already_exists:true,
          admin_id:admin.id
        };
      }

      const payload = {
        project_id:pid,
        project_code:code,
        project_name:getProjectName(project) || code,
        project_type:getProjectType(project),
        liquidity_balance:0,
        total_inflow:0,
        total_outflow:0,
        total_reward_funded:0,
        total_internal_withdrawn:0,
        status:"active",
        network
      };

      const {data,error} = await client
        .from(TREASURY_TABLE)
        .insert(payload)
        .select("*")
        .single();

      if(error){
        const retry = await fetchProjectTreasuryRow(code);
        if(!retry.error && retry.data){
          return {
            success:true,
            data:retry.data,
            already_exists:true,
            admin_id:admin.id
          };
        }
        return {error:error.message || "Failed to create treasury row"};
      }

      return {
        success:true,
        data:normalizeTreasury(data),
        admin_id:admin.id,
        already_exists:false
      };
    }catch(error){
      return {error:error?.message || "Treasury create failed"};
    }
  }

  async function ensureProjectTreasury(codeValue){
    const code = projectCode(codeValue);
    if(!code) return {error:"Project code is required"};

    const project = await getProject(code);
    if(!project){
      return {error:`Project not found in active network: ${code}`};
    }

    const existing = await fetchProjectTreasuryRow(code);
    if(existing.error) return {error:existing.error};
    if(existing.data) return {success:true,data:existing.data};

    if(!(await currentAdmin())){
      return {
        error:
          "Project treasury does not exist yet. Active administrator session is required to create it."
      };
    }

    return createProjectTreasury(code);
  }

  async function getProjectTreasury(code){
    const result = await ensureProjectTreasury(code);
    return result.error ? {error:result.error} : result.data;
  }

  async function getProjectLiquidity(code){
    const treasury = await getProjectTreasury(code);
    return treasury?.error ? 0 : safeNumber(treasury?.liquidity_balance);
  }

  async function insertTreasuryTransaction(args={}){
    try{
      const {client} = await requireAdmin();
      const network = getNetwork();
      const code = projectCode(args.project_code);
      if(!code) return {error:"Project code is required"};

      const amount = safeNumber(args.amount);
      if(amount <= 0){
        return {error:"Invalid treasury transaction amount"};
      }

      const payload = {
        project_id:args.project_id ?? null,
        project_code:code,
        project_name:safeString(args.project_name),
        project_type:safeString(args.project_type || "core"),
        tx_type:safeString(args.tx_type),
        amount,
        balance_before:safeNumber(args.balance_before),
        balance_after:safeNumber(args.balance_after),
        reference_table:args.reference_table || null,
        reference_id:args.reference_id || null,
        actor_userid:safeString(args.actor_userid) || null,
        actor_username:safeString(args.actor_username) || null,
        note:safeString(args.note) || null,
        meta:args.meta && typeof args.meta === "object" ? args.meta : {},
        network
      };

      const {data,error} = await client
        .from(TREASURY_TX_TABLE)
        .insert(payload)
        .select("*")
        .single();

      if(error){
        return {
          error:error.message || "Failed to insert treasury transaction"
        };
      }
      return {success:true,data:normalizeTx(data)};
    }catch(error){
      return {error:error?.message || "Treasury transaction insert failed"};
    }
  }

  async function updateTreasuryRow(codeValue, patch={}){
    const code = projectCode(codeValue);
    if(!code) return {error:"Project code is required"};

    try{
      const {client} = await requireAdmin();
      const network = getNetwork();
      const safePatch = {...patch,network,updated_at:nowISO()};

      const {data,error} = await client
        .from(TREASURY_TABLE)
        .update(safePatch)
        .eq("project_code",code)
        .eq("network",network)
        .select("*")
        .single();

      if(error){
        return {error:error.message || "Failed to update treasury row"};
      }
      return {success:true,data:normalizeTreasury(data)};
    }catch(error){
      return {error:error?.message || "Treasury update failed"};
    }
  }

  async function getTreasuryActor(){
    const admin = await currentAdmin();
    if(!admin){
      return {
        actor_userid:"system",
        actor_username:"Treasury Engine",
        admin:null
      };
    }
    return {
      actor_userid:safeString(admin.auth_user_id || admin.id),
      actor_username:safeString(admin.username || admin.email || "Admin"),
      admin
    };
  }

  async function mutateTreasury(codeValue, amountValue, meta, mode){
    const code = projectCode(codeValue);
    const amount = safeNumber(amountValue);

    if(!code) return {error:"Project code is required"};
    if(amount <= 0){
      return {
        error:
          mode === "liquidity_add"
            ? "Invalid liquidity amount"
            : mode === "reward_funding"
              ? "Invalid reward funding amount"
              : "Invalid withdraw amount"
      };
    }

    try{
      const actor = await getTreasuryActor();
      if(!actor.admin){
        return {error:"Active administrator session is required."};
      }

      const project = await getProject(code);
      if(!project){
        return {error:`Project not found in active network: ${code}`};
      }

      const treasury = await getProjectTreasury(code);
      if(treasury?.error) return {error:treasury.error};

      const before = safeNumber(treasury.liquidity_balance);
      const isAdd = mode === "liquidity_add";

      if(!isAdd && amount > before){
        return {error:"Insufficient project liquidity"};
      }

      const after = isAdd ? before + amount : before - amount;

      const patch = {
        project_id:getProjectId(project),
        project_name:getProjectName(project),
        project_type:getProjectType(project),
        liquidity_balance:after,
        status:"active"
      };

      if(isAdd){
        patch.total_inflow = safeNumber(treasury.total_inflow) + amount;
      }else{
        patch.total_outflow = safeNumber(treasury.total_outflow) + amount;
        if(mode === "internal_withdraw"){
          patch.total_internal_withdrawn =
            safeNumber(treasury.total_internal_withdrawn) + amount;
        }else if(mode === "reward_funding"){
          patch.total_reward_funded =
            safeNumber(treasury.total_reward_funded) + amount;
        }
      }

      const updated = await updateTreasuryRow(code,patch);
      if(updated.error) return {error:updated.error};

      const tx = await insertTreasuryTransaction({
        project_id:getProjectId(project),
        project_code:getProjectCode(project),
        project_name:getProjectName(project),
        project_type:getProjectType(project),
        tx_type:mode,
        amount,
        balance_before:before,
        balance_after:after,
        reference_table:meta?.reference_table || "project_treasury",
        reference_id:meta?.reference_id || updated.data?.id || null,
        actor_userid:meta?.actor_userid || actor.actor_userid,
        actor_username:meta?.actor_username || actor.actor_username,
        note:
          meta?.note ||
          (mode === "liquidity_add"
            ? "Liquidity added"
            : mode === "internal_withdraw"
              ? "Internal project withdraw"
              : "Reward funding from treasury"),
        meta:meta?.meta || {}
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
            "Treasury balance was updated but transaction ledger failed: " +
            tx.error,
          treasury:updated.data,
          transaction:null
        };
      }

      return {
        success:true,
        action:mode,
        project_code:getProjectCode(project),
        amount,
        liquidity:after,
        treasury:updated.data,
        transaction:tx.data
      };
    }catch(error){
      return {error:error?.message || `${mode} failed`};
    }
  }

  async function addProjectLiquidity(code,amount,meta={}){
    return mutateTreasury(code,amount,meta,"liquidity_add");
  }

  async function projectInternalWithdraw(code,amount,meta={}){
    return mutateTreasury(code,amount,meta,"internal_withdraw");
  }

  async function fundRewardFromTreasury(code,amount,meta={}){
    return mutateTreasury(code,amount,meta,"reward_funding");
  }

  async function getProjectTreasuryHistory(codeValue,limit=50){
    const code = projectCode(codeValue);
    if(!code) return [];

    try{
      const network = getNetwork();
      let safeLimit = Math.floor(safeNumber(limit,50));
      if(safeLimit <= 0) safeLimit = 50;
      if(safeLimit > 500) safeLimit = 500;

      const {data,error} = await getCoreClient()
        .from(TREASURY_TX_TABLE)
        .select("*")
        .eq("project_code",code)
        .eq("network",network)
        .order("created_at",{ascending:false})
        .limit(safeLimit);

      if(error){
        console.error("[TREASURY] History error:",error);
        return [];
      }
      return (data || []).map(normalizeTx);
    }catch(error){
      console.error("[TREASURY] History failed:",error);
      return [];
    }
  }

  async function getProjectTreasurySnapshot(code,historyLimit=20){
    const codeValue = projectCode(code);
    const project = await getProject(codeValue);
    if(!project){
      return {
        error:`Project not found in active network: ${codeValue}`
      };
    }

    const treasury = await getProjectTreasury(codeValue);
    if(treasury?.error) return {error:treasury.error};

    return {
      success:true,
      network:getNetwork(),
      project,
      treasury,
      history:await getProjectTreasuryHistory(codeValue,historyLimit)
    };
  }

  async function getAllProjectTreasuries(){
    try{
      const network = getNetwork();
      const {data,error} = await getCoreClient()
        .from(TREASURY_TABLE)
        .select("*")
        .eq("network",network)
        .order("project_name",{ascending:true});

      if(error){
        console.error("[TREASURY] All treasuries error:",error);
        return [];
      }
      return (data || []).map(normalizeTreasury);
    }catch(error){
      console.error("[TREASURY] All treasuries failed:",error);
      return [];
    }
  }

  async function getProjectTreasuriesByType(typeValue){
    const type = safeString(typeValue).trim().toLowerCase();
    if(!type) return [];
    const rows = await getAllProjectTreasuries();
    return rows.filter(
      row => safeString(row.project_type).trim().toLowerCase() === type
    );
  }

  const getCoreProjectTreasuries = () =>
    getProjectTreasuriesByType("core");
  const getInternalProjectTreasuries = () =>
    getProjectTreasuriesByType("internal");
  const getExternalProjectTreasuries = () =>
    getProjectTreasuriesByType("external");

  async function getAllTreasurySnapshots(){
    const rows = await getAllProjectTreasuries();
    return rows.map(row => ({
      project_id:row.project_id,
      project_code:row.project_code,
      project_name:row.project_name,
      project_type:row.project_type,
      liquidity_balance:safeNumber(row.liquidity_balance),
      total_inflow:safeNumber(row.total_inflow),
      total_outflow:safeNumber(row.total_outflow),
      total_reward_funded:safeNumber(row.total_reward_funded),
      total_internal_withdrawn:safeNumber(row.total_internal_withdrawn),
      total_added:safeNumber(row.total_inflow),
      total_withdrawn:safeNumber(row.total_outflow),
      status:row.status || "active",
      network:row.network,
      last_activity_at:row.updated_at || null
    }));
  }

  async function getTreasuryEngineSummary(code){
    const codeValue = projectCode(code);
    const project = await getProject(codeValue);
    if(!project){
      return {
        project_code:codeValue,
        error:"Project not found in active network"
      };
    }

    const treasury = await getProjectTreasury(codeValue);
    if(treasury?.error){
      return {project_code:codeValue,error:treasury.error};
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

  // Backward-compatible public API.
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

  window.ALBukhrProjectTreasuryEngine = Object.freeze({
    version:ENGINE_VERSION,
    tables:Object.freeze({
      treasury:TREASURY_TABLE,
      transactions:TREASURY_TX_TABLE
    })
  });

  console.log(
    `✅ ALBUKHR Project Treasury Engine v${ENGINE_VERSION} ready`
  );
})(window);
