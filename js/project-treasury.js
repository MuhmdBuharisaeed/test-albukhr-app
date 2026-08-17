/* =========================================
   ALBUKHR PROJECT TREASURY ENGINE v5
   SCHEMA-COMPATIBLE + NETWORK-AWARE

   SUPPORTED PROJECT TYPES:
   - core
   - internal
   - external

   DATABASE TABLES:
   - projects
   - project_treasury
   - project_treasury_transactions

   IMPORTANT:
   - Uses projects.id -> project_treasury.project_id
   - Uses actual schema:
       total_inflow
       total_outflow
       total_reward_funded
       total_internal_withdrawn
       network

   IMPORTANT:
   This engine manages the Supabase treasury ledger.
   Real Pi blockchain payment settlement is handled
   separately by the ALBUKHR payment server.
========================================= */

(function(){

  "use strict";

  /* =========================================
     TABLE CONFIG
  ========================================= */

  const TREASURY_TABLE =
    "project_treasury";

  const TREASURY_TX_TABLE =
    "project_treasury_transactions";

  const PROJECTS_TABLE =
    "projects";


  /* =========================================
     NETWORK
     ========================================= */

  function treasuryGetNetwork(){

    /*
      Preferred:
      shared environment switcher / global network
    */

    try{

      if(
        typeof window.getAlbukhrNetwork === "function"
      ){

        const network =
          window.getAlbukhrNetwork();

        if(network){
          return normalizeNetwork(network);
        }

      }

    }catch(error){

      console.warn(
        "treasuryGetNetwork getter warning:",
        error
      );

    }


    /*
      Compatibility with possible shared
      environment objects.
    */

    try{

      const candidates = [

        window.ALBKHR_NETWORK,

        window.ALBKHR_ENVIRONMENT,

        window.currentNetwork,

        window.currentEnvironment

      ];

      for(const candidate of candidates){

        if(typeof candidate === "string"){

          const normalized =
            normalizeNetwork(candidate);

          if(normalized){
            return normalized;
          }

        }

      }

    }catch(error){

      console.warn(
        "Treasury network detection warning:",
        error
      );

    }


    /*
      Hostname fallback.

      This does NOT persist anything.
      It only determines the current runtime
      environment.
    */

    try{

      const host =
        String(window.location.hostname || "")
          .toLowerCase();

      if(
        host === "test.albukhr.com" ||
        host.includes("testnet")
      ){
        return "testnet";
      }

      if(
        host === "app.albukhr.com" ||
        host.includes("mainnet")
      ){
        return "mainnet";
      }

    }catch(error){

      console.warn(
        "Treasury hostname detection warning:",
        error
      );

    }


    /*
      Safe default for current development.
    */

    return "testnet";

  }


  function normalizeNetwork(network){

    const value =
      String(network || "")
        .trim()
        .toLowerCase();

    if(
      value === "mainnet" ||
      value === "main"
    ){
      return "mainnet";
    }

    if(
      value === "testnet" ||
      value === "test"
    ){
      return "testnet";
    }

    return "";

  }


  /* =========================================
     SUPABASE CLIENT
  ========================================= */

  function getTreasurySupabaseClient(){

    if(
      typeof window.getAlbukhrSupabaseClient ===
      "function"
    ){

      try{

        const client =
          window.getAlbukhrSupabaseClient();

        if(client){
          return client;
        }

      }catch(error){

        console.error(
          "ALBUKHR Supabase client error:",
          error
        );

      }

    }


    if(window.albukhrSupabase){
      return window.albukhrSupabase;
    }


    console.error(
      "project-treasury: ALBUKHR Supabase client unavailable."
    );

    return null;

  }


  /* =========================================
     SAFE HELPERS
  ========================================= */

  function treasurySafeNumber(
    value,
    fallback = 0
  ){

    const n = Number(value);

    return Number.isFinite(n)
      ? n
      : fallback;

  }


  function treasurySafeString(
    value,
    fallback = ""
  ){

    if(
      value === null ||
      value === undefined
    ){
      return fallback;
    }

    return String(value);

  }


  function treasuryNowISO(){

    return new Date().toISOString();

  }


  function treasuryNormalizeProjectType(type){

    const value =
      treasurySafeString(type)
        .trim()
        .toLowerCase();

    if(value === "core"){
      return "core";
    }

    if(value === "internal"){
      return "internal";
    }

    if(value === "external"){
      return "external";
    }

    return "core";

  }


  /* =========================================
     PROJECTS ENGINE GUARD
  ========================================= */

  function assertProjectsEngine(){

    if(
      typeof getProjectMeta !== "function"
    ){

      throw new Error(
        "projects-engine.js is required before project-treasury.js"
      );

    }

  }


  /* =========================================
     FIND PROJECT

     Primary source:
       projects table

     Why:
       project_treasury.project_id
       is required.
  ========================================= */

  async function getTreasuryProjectMeta(
    projectCode
  ){

    if(!projectCode){
      return null;
    }


    /*
      First use existing projects-engine.js
    */

    if(
      typeof getProjectMeta === "function"
    ){

      try{

        const project =
          await getProjectMeta(projectCode);

        if(project){

          return {
            ...project,

            project_code:
              treasurySafeString(
                project.project_code ||
                projectCode
              ),

            project_name:
              treasurySafeString(
                project.project_name ||
                project.name ||
                projectCode
              ),

            project_type:
              treasuryNormalizeProjectType(
                project.project_type
              ),

            network:
              normalizeNetwork(
                project.network
              ) ||
              treasuryGetNetwork()

          };

        }

      }catch(error){

        console.warn(
          "getProjectMeta warning:",
          error
        );

      }

    }


    /*
      Direct Supabase fallback.
    */

    const supabase =
      getTreasurySupabaseClient();

    if(!supabase){
      return null;
    }


    const network =
      treasuryGetNetwork();


    try{

      const { data, error } =
        await supabase
          .from(PROJECTS_TABLE)
          .select("*")
          .eq(
            "project_code",
            projectCode
          )
          .eq(
            "network",
            network
          )
          .maybeSingle();


      if(error){

        console.error(
          "Project lookup error:",
          error
        );

        return null;

      }


      if(!data){
        return null;
      }


      return {

        ...data,

        project_code:
          treasurySafeString(
            data.project_code
          ),

        project_name:
          treasurySafeString(
            data.project_name ||
            projectCode
          ),

        project_type:
          treasuryNormalizeProjectType(
            data.project_type
          ),

        network:
          normalizeNetwork(data.network) ||
          network

      };

    }catch(error){

      console.error(
        "getTreasuryProjectMeta error:",
        error
      );

      return null;

    }

  }


  /* =========================================
     NORMALIZE TREASURY ROW
  ========================================= */

  function normalizeTreasuryRow(
    row = {}
  ){

    return {

      id:
        row.id ?? null,

      project_id:
        row.project_id ?? null,

      project_code:
        treasurySafeString(
          row.project_code
        ),

      project_name:
        treasurySafeString(
          row.project_name
        ),

      project_type:
        treasuryNormalizeProjectType(
          row.project_type
        ),

      liquidity_balance:
        treasurySafeNumber(
          row.liquidity_balance,
          0
        ),

      /*
        Actual DB column
      */

      total_inflow:
        treasurySafeNumber(
          row.total_inflow,
          0
        ),

      total_outflow:
        treasurySafeNumber(
          row.total_outflow,
          0
        ),

      total_reward_funded:
        treasurySafeNumber(
          row.total_reward_funded,
          0
        ),

      total_internal_withdrawn:
        treasurySafeNumber(
          row.total_internal_withdrawn,
          0
        ),

      network:
        normalizeNetwork(
          row.network
        ) || treasuryGetNetwork(),

      created_at:
        row.created_at || null,

      updated_at:
        row.updated_at || null,

      /*
        Compatibility aliases.

        Existing dashboard / old engines may
        still expect these names.
      */

      total_added:
        treasurySafeNumber(
          row.total_inflow,
          0
        ),

      total_withdrawn:
        treasurySafeNumber(
          row.total_outflow,
          0
        ),

      last_activity_at:
        row.updated_at || null,

      status:
        treasurySafeString(
          row.status || "active"
        ),

      raw: row

    };

  }


  /* =========================================
     NORMALIZE TREASURY TRANSACTION
  ========================================= */

  function normalizeTreasuryTxRow(
    row = {}
  ){

    return {

      id:
        row.id ?? null,

      project_id:
        row.project_id ?? null,

      project_code:
        treasurySafeString(
          row.project_code
        ),

      project_name:
        treasurySafeString(
          row.project_name
        ),

      project_type:
        treasuryNormalizeProjectType(
          row.project_type
        ),

      tx_type:
        treasurySafeString(
          row.tx_type
        ),

      amount:
        treasurySafeNumber(
          row.amount,
          0
        ),

      balance_before:
        treasurySafeNumber(
          row.balance_before,
          0
        ),

      balance_after:
        treasurySafeNumber(
          row.balance_after,
          0
        ),

      reference_table:
        treasurySafeString(
          row.reference_table
        ),

      reference_id:
        treasurySafeString(
          row.reference_id
        ),

      actor_userid:
        treasurySafeString(
          row.actor_userid
        ),

      actor_username:
        treasurySafeString(
          row.actor_username
        ),

      note:
        treasurySafeString(
          row.note
        ),

      meta:
        row.meta || {},

      network:
        normalizeNetwork(
          row.network
        ) || treasuryGetNetwork(),

      created_at:
        row.created_at || null,

      raw: row

    };

  }


  /* =========================================
     FETCH TREASURY ROW
  ========================================= */

  async function fetchProjectTreasuryRow(
    projectCode
  ){

    if(!projectCode){

      return {
        error:"Project code is required"
      };

    }


    const supabase =
      getTreasurySupabaseClient();

    if(!supabase){

      return {
        error:
          "Supabase core client not available"
      };

    }


    const project =
      await getTreasuryProjectMeta(
        projectCode
      );

    if(!project){

      return {
        error:
          `Project not found: ${projectCode}`
      };

    }


    const network =
      normalizeNetwork(project.network) ||
      treasuryGetNetwork();


    try{

      /*
        project_id is the strongest identifier.
      */

      let query =
        supabase
          .from(TREASURY_TABLE)
          .select("*")
          .eq(
            "project_id",
            project.id
          )
          .eq(
            "network",
            network
          );


      const { data, error } =
        await query.maybeSingle();


      if(error){

        return {
          error:
            error.message ||
            "Failed to fetch treasury"
        };

      }


      return {

        success:true,

        data:
          data
            ? normalizeTreasuryRow(data)
            : null

      };

    }catch(error){

      return {
        error:
          error?.message ||
          "Treasury fetch failed"
      };

    }

  }


  /* =========================================
     CREATE TREASURY ROW
  ========================================= */

  async function createProjectTreasury(
    projectCode
  ){

    const supabase =
      getTreasurySupabaseClient();

    if(!supabase){

      return {
        error:
          "Supabase core client not available"
      };

    }


    const project =
      await getTreasuryProjectMeta(
        projectCode
      );

    if(!project){

      return {
        error:
          `Project not found: ${projectCode}`
      };

    }


    if(!project.id){

      return {
        error:
          `Project ID missing for ${projectCode}`
      };

    }


    const network =
      normalizeNetwork(project.network) ||
      treasuryGetNetwork();


    const payload = {

      project_id:
        project.id,

      project_code:
        project.project_code,

      project_name:
        project.project_name,

      project_type:
        treasuryNormalizeProjectType(
          project.project_type
        ),

      liquidity_balance: 0,

      total_inflow: 0,

      total_outflow: 0,

      total_reward_funded: 0,

      total_internal_withdrawn: 0,

      network

    };


    try{

      const { data, error } =
        await supabase
          .from(TREASURY_TABLE)
          .insert(payload)
          .select("*")
          .single();


      if(error){

        /*
          Race-safe fallback:
          another request may have created
          the row at the same time.
        */

        const existing =
          await fetchProjectTreasuryRow(
            projectCode
          );

        if(
          existing &&
          existing.data
        ){

          return {
            success:true,
            data:existing.data
          };

        }


        return {
          error:
            error.message ||
            "Failed to create treasury row"
        };

      }


      return {

        success:true,

        data:
          normalizeTreasuryRow(data)

      };

    }catch(error){

      return {
        error:
          error?.message ||
          "Treasury create failed"
      };

    }

  }


  /* =========================================
     ENSURE PROJECT TREASURY
  ========================================= */

  async function ensureProjectTreasury(
    projectCode
  ){

    if(!projectCode){

      return {
        error:
          "Project code is required"
      };

    }


    const project =
      await getTreasuryProjectMeta(
        projectCode
      );

    if(!project){

      return {
        error:
          `Project not found: ${projectCode}`
      };

    }


    const existing =
      await fetchProjectTreasuryRow(
        projectCode
      );


    if(existing.error){

      return {
        error:existing.error
      };

    }


    if(existing.data){

      return {
        success:true,
        data:existing.data
      };

    }


    return await createProjectTreasury(
      projectCode
    );

  }


  /* =========================================
     GET PROJECT TREASURY
  ========================================= */

  async function getProjectTreasury(
    projectCode
  ){

    const ensured =
      await ensureProjectTreasury(
        projectCode
      );

    if(ensured.error){

      return {
        error:ensured.error
      };

    }

    return ensured.data;

  }


  /* =========================================
     GET PROJECT LIQUIDITY
  ========================================= */

  async function getProjectLiquidity(
    projectCode
  ){

    const treasury =
      await getProjectTreasury(
        projectCode
      );

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

    meta = null,

    network = ""

  }){

    const supabase =
      getTreasurySupabaseClient();

    if(!supabase){

      return {
        error:
          "Supabase core client not available"
      };

    }


    const actualNetwork =
      normalizeNetwork(network) ||
      treasuryGetNetwork();


    if(!project_id){

      /*
        Resolve project_id when caller did not
        provide it.
      */

      const project =
        await getTreasuryProjectMeta(
          project_code
        );

      if(project?.id){
        project_id = project.id;
      }

    }


    if(!project_id){

      return {
        error:
          "project_id is required for treasury transaction"
      };

    }


    const payload = {

      project_id,

      project_code:
        treasurySafeString(
          project_code
        ),

      project_name:
        treasurySafeString(
          project_name
        ),

      project_type:
        treasuryNormalizeProjectType(
          project_type
        ),

      tx_type:
        treasurySafeString(
          tx_type
        ),

      amount:
        treasurySafeNumber(
          amount,
          0
        ),

      balance_before:
        treasurySafeNumber(
          balance_before,
          0
        ),

      balance_after:
        treasurySafeNumber(
          balance_after,
          0
        ),

      reference_table:
        reference_table || null,

      reference_id:
        reference_id
          ? String(reference_id)
          : null,

      actor_userid:
        treasurySafeString(
          actor_userid
        ),

      actor_username:
        treasurySafeString(
          actor_username
        ),

      note:
        treasurySafeString(
          note
        ),

      meta:
        meta || {},

      network:
        actualNetwork

    };


    try{

      const { data, error } =
        await supabase
          .from(TREASURY_TX_TABLE)
          .insert(payload)
          .select("*")
          .single();


      if(error){

        return {
          error:
            error.message ||
            "Failed to insert treasury transaction"
        };

      }


      return {

        success:true,

        data:
          normalizeTreasuryTxRow(data)

      };

    }catch(error){

      return {
        error:
          error?.message ||
          "Treasury transaction insert failed"
      };

    }

  }


  /* =========================================
     UPDATE TREASURY ROW
  ========================================= */

  async function updateTreasuryRow(
    projectCode,
    patch = {}
  ){

    const supabase =
      getTreasurySupabaseClient();

    if(!supabase){

      return {
        error:
          "Supabase core client not available"
      };

    }


    const project =
      await getTreasuryProjectMeta(
        projectCode
      );

    if(!project){

      return {
        error:
          `Project not found: ${projectCode}`
      };

    }


    const network =
      normalizeNetwork(project.network) ||
      treasuryGetNetwork();


    /*
      IMPORTANT:
      Do not allow callers to accidentally
      change project identity/network.
    */

    const safePatch = {

      ...patch,

      project_id:
        project.id,

      project_code:
        project.project_code,

      project_name:
        project.project_name,

      project_type:
        treasuryNormalizeProjectType(
          project.project_type
        ),

      network,

      updated_at:
        treasuryNowISO()

    };


    /*
      Remove legacy fields if some caller
      accidentally sends them.
    */

    delete safePatch.total_added;
    delete safePatch.total_withdrawn;
    delete safePatch.last_activity_at;


    try{

      const { data, error } =
        await supabase
          .from(TREASURY_TABLE)
          .update(safePatch)
          .eq(
            "project_id",
            project.id
          )
          .eq(
            "network",
            network
          )
          .select("*")
          .single();


      if(error){

        return {
          error:
            error.message ||
            "Failed to update treasury row"
        };

      }


      return {

        success:true,

        data:
          normalizeTreasuryRow(data)

      };

    }catch(error){

      return {
        error:
          error?.message ||
          "Treasury update failed"
      };

    }

  }


  /* =========================================
     ADD LIQUIDITY
     -----------------------------------------
     LEDGER OPERATION ONLY.

     Real Pi blockchain settlement should call
     this AFTER verified payment settlement.
  ========================================= */

  async function addProjectLiquidity(
    projectCode,
    amount,
    meta = {}
  ){

    amount =
      treasurySafeNumber(
        amount,
        0
      );


    if(!projectCode){

      return {
        error:
          "Project code is required"
      };

    }


    if(amount <= 0){

      return {
        error:
          "Invalid liquidity amount"
      };

    }


    const project =
      await getTreasuryProjectMeta(
        projectCode
      );

    if(!project){

      return {
        error:
          `Project not found: ${projectCode}`
      };

    }


    const treasury =
      await getProjectTreasury(
        projectCode
      );

    if(treasury?.error){

      return {
        error:
          treasury.error
      };

    }


    const balanceBefore =
      treasurySafeNumber(
        treasury.liquidity_balance,
        0
      );


    const balanceAfter =
      balanceBefore + amount;


    const updated =
      await updateTreasuryRow(
        projectCode,
        {

          liquidity_balance:
            balanceAfter,

          total_inflow:
            treasurySafeNumber(
              treasury.total_inflow,
              0
            ) + amount

        }
      );


    if(updated.error){

      return {
        error:
          updated.error
      };

    }


    const tx =
      await insertTreasuryTransaction({

        project_id:
          project.id,

        project_code:
          project.project_code,

        project_name:
          project.project_name,

        project_type:
          project.project_type,

        tx_type:
          "liquidity_add",

        amount,

        balance_before:
          balanceBefore,

        balance_after:
          balanceAfter,

        reference_table:
          meta.reference_table ||
          null,

        reference_id:
          meta.reference_id ||
          null,

        actor_userid:
          meta.actor_userid ||
          "",

        actor_username:
          meta.actor_username ||
          "",

        note:
          meta.note ||
          "Liquidity added",

        meta:
          meta.meta ||
          {},

        network:
          project.network

      });


    /*
      Ledger insertion is important.
      If it fails, attempt to rollback the
      treasury balance to avoid silent mismatch.
    */

    if(tx.error){

      console.error(
        "Treasury transaction insert failed. Attempting rollback:",
        tx.error
      );


      await updateTreasuryRow(
        projectCode,
        {

          liquidity_balance:
            balanceBefore,

          total_inflow:
            treasurySafeNumber(
              treasury.total_inflow,
              0
            )

        }
      );


      return {
        error:
          `Liquidity ledger failed: ${tx.error}`
      };

    }


    return {

      success:true,

      action:
        "liquidity_add",

      project_code:
        project.project_code,

      project_id:
        project.id,

      network:
        project.network,

      amount,

      liquidity:
        balanceAfter,

      treasury:
        updated.data,

      transaction:
        tx.data

    };

  }


  /* =========================================
     INTERNAL WITHDRAW
     -----------------------------------------
     LEDGER OPERATION ONLY.

     Real Pi payout should be executed by
     server.js after approval/authorization.
  ========================================= */

  async function projectInternalWithdraw(
    projectCode,
    amount,
    meta = {}
  ){

    amount =
      treasurySafeNumber(
        amount,
        0
      );


    if(!projectCode){

      return {
        error:
          "Project code is required"
      };

    }


    if(amount <= 0){

      return {
        error:
          "Invalid withdraw amount"
      };

    }


    const project =
      await getTreasuryProjectMeta(
        projectCode
      );

    if(!project){

      return {
        error:
          `Project not found: ${projectCode}`
      };

    }


    const treasury =
      await getProjectTreasury(
        projectCode
      );

    if(treasury?.error){

      return {
        error:
          treasury.error
      };

    }


    const balanceBefore =
      treasurySafeNumber(
        treasury.liquidity_balance,
        0
      );


    if(amount > balanceBefore){

      return {
        error:
          "Insufficient project liquidity"
      };

    }


    const balanceAfter =
      balanceBefore - amount;


    const updated =
      await updateTreasuryRow(
        projectCode,
        {

          liquidity_balance:
            balanceAfter,

          total_outflow:
            treasurySafeNumber(
              treasury.total_outflow,
              0
            ) + amount,

          total_internal_withdrawn:
            treasurySafeNumber(
              treasury.total_internal_withdrawn,
              0
            ) + amount

        }
      );


    if(updated.error){

      return {
        error:
          updated.error
      };

    }


    const tx =
      await insertTreasuryTransaction({

        project_id:
          project.id,

        project_code:
          project.project_code,

        project_name:
          project.project_name,

        project_type:
          project.project_type,

        tx_type:
          "internal_withdraw",

        amount,

        balance_before:
          balanceBefore,

        balance_after:
          balanceAfter,

        reference_table:
          meta.reference_table ||
          null,

        reference_id:
          meta.reference_id ||
          null,

        actor_userid:
          meta.actor_userid ||
          "",

        actor_username:
          meta.actor_username ||
          "",

        note:
          meta.note ||
          "Internal project withdraw",

        meta:
          meta.meta ||
          {},

        network:
          project.network

      });


    if(tx.error){

      console.error(
        "Treasury transaction insert failed. Attempting rollback:",
        tx.error
      );


      await updateTreasuryRow(
        projectCode,
        {

          liquidity_balance:
            balanceBefore,

          total_outflow:
            treasurySafeNumber(
              treasury.total_outflow,
              0
            ),

          total_internal_withdrawn:
            treasurySafeNumber(
              treasury.total_internal_withdrawn,
              0
            )

        }
      );


      return {
        error:
          `Withdraw ledger failed: ${tx.error}`
      };

    }


    return {

      success:true,

      action:
        "internal_withdraw",

      project_code:
        project.project_code,

      project_id:
        project.id,

      network:
        project.network,

      amount,

      liquidity:
        balanceAfter,

      treasury:
        updated.data,

      transaction:
        tx.data

    };

  }


  /* =========================================
     FUND REWARD FROM TREASURY
  ========================================= */

  async function fundRewardFromTreasury(
    projectCode,
    amount,
    meta = {}
  ){

    amount =
      treasurySafeNumber(
        amount,
        0
      );


    if(!projectCode){

      return {
        error:
          "Project code is required"
      };

    }


    if(amount <= 0){

      return {
        error:
          "Invalid reward funding amount"
      };

    }


    const project =
      await getTreasuryProjectMeta(
        projectCode
      );

    if(!project){

      return {
        error:
          `Project not found: ${projectCode}`
      };

    }


    const treasury =
      await getProjectTreasury(
        projectCode
      );

    if(treasury?.error){

      return {
        error:
          treasury.error
      };

    }


    const balanceBefore =
      treasurySafeNumber(
        treasury.liquidity_balance,
        0
      );


    if(amount > balanceBefore){

      return {
        error:
          "Insufficient project liquidity"
      };

    }


    const balanceAfter =
      balanceBefore - amount;


    const updated =
      await updateTreasuryRow(
        projectCode,
        {

          liquidity_balance:
            balanceAfter,

          total_outflow:
            treasurySafeNumber(
              treasury.total_outflow,
              0
            ) + amount,

          total_reward_funded:
            treasurySafeNumber(
              treasury.total_reward_funded,
              0
            ) + amount

        }
      );


    if(updated.error){

      return {
        error:
          updated.error
      };

    }


    const tx =
      await insertTreasuryTransaction({

        project_id:
          project.id,

        project_code:
          project.project_code,

        project_name:
          project.project_name,

        project_type:
          project.project_type,

        tx_type:
          "reward_funding",

        amount,

        balance_before:
          balanceBefore,

        balance_after:
          balanceAfter,

        reference_table:
          meta.reference_table ||
          null,

        reference_id:
          meta.reference_id ||
          null,

        actor_userid:
          meta.actor_userid ||
          "system",

        actor_username:
          meta.actor_username ||
          "Reward Engine",

        note:
          meta.note ||
          "Reward funding from treasury",

        meta:
          meta.meta ||
          {},

        network:
          project.network

      });


    if(tx.error){

      console.error(
        "Reward treasury transaction failed. Attempting rollback:",
        tx.error
      );


      await updateTreasuryRow(
        projectCode,
        {

          liquidity_balance:
            balanceBefore,

          total_outflow:
            treasurySafeNumber(
              treasury.total_outflow,
              0
            ),

          total_reward_funded:
            treasurySafeNumber(
              treasury.total_reward_funded,
              0
            )

        }
      );


      return {
        error:
          `Reward ledger failed: ${tx.error}`
      };

    }


    return {

      success:true,

      action:
        "reward_funding",

      project_code:
        project.project_code,

      project_id:
        project.id,

      network:
        project.network,

      amount,

      liquidity:
        balanceAfter,

      treasury:
        updated.data,

      transaction:
        tx.data

    };

  }


  /* =========================================
     GET TREASURY HISTORY
  ========================================= */

  async function getProjectTreasuryHistory(
    projectCode,
    limit = 50
  ){

    if(!projectCode){
      return [];
    }


    const supabase =
      getTreasurySupabaseClient();

    if(!supabase){
      return [];
    }


    const project =
      await getTreasuryProjectMeta(
        projectCode
      );

    if(!project){
      return [];
    }


    const network =
      normalizeNetwork(project.network) ||
      treasuryGetNetwork();


    limit =
      treasurySafeNumber(
        limit,
        50
      );


    if(limit <= 0){
      limit = 50;
    }


    try{

      const { data, error } =
        await supabase
          .from(TREASURY_TX_TABLE)
          .select("*")
          .eq(
            "project_id",
            project.id
          )
          .eq(
            "network",
            network
          )
          .order(
            "created_at",
            {
              ascending:false
            }
          )
          .limit(limit);


      if(error){

        console.error(
          "getProjectTreasuryHistory error:",
          error
        );

        return [];

      }


      return (data || [])
        .map(normalizeTreasuryTxRow);

    }catch(error){

      console.error(
        "getProjectTreasuryHistory network error:",
        error
      );

      return [];

    }

  }


  /* =========================================
     GET FULL TREASURY SNAPSHOT
  ========================================= */

  async function getProjectTreasurySnapshot(
    projectCode,
    historyLimit = 20
  ){

    const project =
      await getTreasuryProjectMeta(
        projectCode
      );

    if(!project){

      return {
        error:
          `Project not found: ${projectCode}`
      };

    }


    const treasury =
      await getProjectTreasury(
        projectCode
      );

    if(treasury?.error){

      return {
        error:
          treasury.error
      };

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
     GET ALL TREASURIES
     NETWORK ISOLATED
  ========================================= */

  async function getAllProjectTreasuries(){

    const supabase =
      getTreasurySupabaseClient();

    if(!supabase){
      return [];
    }


    const network =
      treasuryGetNetwork();


    try{

      const { data, error } =
        await supabase
          .from(TREASURY_TABLE)
          .select("*")
          .eq(
            "network",
            network
          )
          .order(
            "project_name",
            {
              ascending:true
            }
          );


      if(error){

        console.error(
          "getAllProjectTreasuries error:",
          error
        );

        return [];

      }


      return (data || [])
        .map(normalizeTreasuryRow);

    }catch(error){

      console.error(
        "getAllProjectTreasuries network error:",
        error
      );

      return [];

    }

  }


  /* =========================================
     GET TREASURIES BY TYPE
  ========================================= */

  async function getProjectTreasuriesByType(
    projectType
  ){

    const type =
      treasurySafeString(
        projectType
      )
        .trim()
        .toLowerCase();


    if(!type){
      return [];
    }


    const rows =
      await getAllProjectTreasuries();


    return rows.filter(row => {

      return treasurySafeString(
        row.project_type
      )
        .trim()
        .toLowerCase() === type;

    });

  }


  async function getCoreProjectTreasuries(){

    return await getProjectTreasuriesByType(
      "core"
    );

  }


  async function getInternalProjectTreasuries(){

    return await getProjectTreasuriesByType(
      "internal"
    );

  }


  async function getExternalProjectTreasuries(){

    return await getProjectTreasuriesByType(
      "external"
    );

  }


  /* =========================================
     BULK SNAPSHOT
  ========================================= */

  async function getAllTreasurySnapshots(){

    const treasuries =
      await getAllProjectTreasuries();


    return treasuries.map(row => {

      return {

        project_id:
          row.project_id,

        project_code:
          row.project_code,

        project_name:
          row.project_name,

        project_type:
          row.project_type,

        network:
          row.network,

        liquidity_balance:
          treasurySafeNumber(
            row.liquidity_balance,
            0
          ),

        total_inflow:
          treasurySafeNumber(
            row.total_inflow,
            0
          ),

        total_outflow:
          treasurySafeNumber(
            row.total_outflow,
            0
          ),

        total_reward_funded:
          treasurySafeNumber(
            row.total_reward_funded,
            0
          ),

        total_internal_withdrawn:
          treasurySafeNumber(
            row.total_internal_withdrawn,
            0
          ),

        /*
          Compatibility fields
        */

        total_added:
          treasurySafeNumber(
            row.total_inflow,
            0
          ),

        total_withdrawn:
          treasurySafeNumber(
            row.total_outflow,
            0
          ),

        status:
          row.status ||
          "active",

        last_activity_at:
          row.last_activity_at ||
          row.updated_at ||
          null

      };

    });

  }


  /* =========================================
     ADMIN / DEBUG SUMMARY
  ========================================= */

  async function getTreasuryEngineSummary(
    projectCode
  ){

    const project =
      await getTreasuryProjectMeta(
        projectCode
      );


    if(!project){

      return {

        project_code:
          projectCode,

        error:
          "Project not found"

      };

    }


    const treasury =
      await getProjectTreasury(
        projectCode
      );


    if(treasury?.error){

      return {

        project_code:
          projectCode,

        error:
          treasury.error

      };

    }


    return {

      project_id:
        treasury.project_id,

      project_code:
        treasury.project_code,

      project_name:
        treasury.project_name,

      project_type:
        treasury.project_type,

      network:
        treasury.network,

      liquidity_balance:
        treasury.liquidity_balance,

      total_inflow:
        treasury.total_inflow,

      total_outflow:
        treasury.total_outflow,

      total_reward_funded:
        treasury.total_reward_funded,

      total_internal_withdrawn:
        treasury.total_internal_withdrawn,

      status:
        treasury.status,

      last_activity_at:
        treasury.last_activity_at

    };

  }


  /* =========================================
     GLOBAL EXPORTS
  ========================================= */

  window.fetchProjectTreasuryRow =
    fetchProjectTreasuryRow;

  window.createProjectTreasury =
    createProjectTreasury;

  window.ensureProjectTreasury =
    ensureProjectTreasury;


  window.getProjectTreasury =
    getProjectTreasury;

  window.getProjectLiquidity =
    getProjectLiquidity;


  window.addProjectLiquidity =
    addProjectLiquidity;

  window.projectInternalWithdraw =
    projectInternalWithdraw;

  window.fundRewardFromTreasury =
    fundRewardFromTreasury;


  window.insertTreasuryTransaction =
    insertTreasuryTransaction;

  window.updateTreasuryRow =
    updateTreasuryRow;


  window.getProjectTreasuryHistory =
    getProjectTreasuryHistory;

  window.getProjectTreasurySnapshot =
    getProjectTreasurySnapshot;


  window.getAllProjectTreasuries =
    getAllProjectTreasuries;

  window.getProjectTreasuriesByType =
    getProjectTreasuriesByType;

  window.getCoreProjectTreasuries =
    getCoreProjectTreasuries;

  window.getInternalProjectTreasuries =
    getInternalProjectTreasuries;

  window.getExternalProjectTreasuries =
    getExternalProjectTreasuries;

  window.getAllTreasurySnapshots =
    getAllTreasurySnapshots;


  window.getTreasuryEngineSummary =
    getTreasuryEngineSummary;


  /*
    Expose network helper for other ALBUKHR
    engines if needed.
  */

  window.getAlbukhrTreasuryNetwork =
    treasuryGetNetwork;


  console.log(
    "ALBUKHR Project Treasury Engine v5 loaded | network:",
    treasuryGetNetwork()
  );

})();
