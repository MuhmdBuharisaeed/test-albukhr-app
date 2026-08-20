/* =========================================================
   ALBUKHR UNIFIED TRANSACTION ENGINE v3
   MAINNET-READY / TESTNET-SAFE
   ---------------------------------------------------------
   ARCHITECTURE:
   - Supabase = SINGLE SOURCE OF TRUTH
   - NO localStorage transaction storage
   - Supabase Auth = current user source
   - Mainnet/Testnet isolation
   - project_code compatible
   - Safe transaction recording
   - Safe transaction querying
   - Safe status updates
   - Duplicate txid protection
   - User-scoped reads
   - Admin/global reads
   ---------------------------------------------------------
   REQUIRED:
   - js/supabase-core.js
   - shared environment/network engine
   - Supabase `transactions` table
========================================================= */

(function(window){

  "use strict";

  /* =======================================================
     CONFIGURATION
  ======================================================= */

  const TRANSACTION_ENGINE_VERSION = "3.0.0";

  const TABLE_NAME = "transactions";

  /*
    IMPORTANT:
    The database currently contains successful records
    using status = "paid".

    Therefore "paid" is the canonical successful status
    used by this engine.
  */
  const STATUS = Object.freeze({

    PENDING: "pending",

    PAID: "paid",

    FAILED: "failed"

  });

  const TRANSACTION_TYPES = Object.freeze({

    CAPITAL: "capital",

    REWARD: "reward",

    STAKE: "stake",

    WITHDRAW: "withdraw",

    FEE: "fee",

    REFUND: "refund"

  });


  /* =======================================================
     SAFE HELPERS
  ======================================================= */

  function safeString(value, fallback = ""){

    if(value === null || value === undefined){

      return fallback;

    }

    return String(value).trim();

  }


  function safeNumber(value, fallback = 0){

    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : fallback;

  }


  function normalizeNetwork(value){

    const network =
      safeString(value).toLowerCase();

    if(
      network === "mainnet" ||
      network === "testnet"
    ){

      return network;

    }

    return "";

  }


  function normalizeType(value){

    const type =
      safeString(value).toLowerCase();

    if(
      Object.values(TRANSACTION_TYPES)
        .includes(type)
    ){

      return type;

    }

    return type || "";

  }


  function normalizeStatus(value){

    const status =
      safeString(value).toLowerCase();

    if(
      status === STATUS.PENDING ||
      status === STATUS.PAID ||
      status === STATUS.FAILED
    ){

      return status;

    }

    return "";

  }


  /* =======================================================
     SUPABASE CLIENT
  ======================================================= */

  function getSupabaseClient(){

    /*
      Preferred ALBUKHR shared client.
    */

    if(window.supabaseClient){

      return window.supabaseClient;

    }


    if(window.supabaseCore?.client){

      return window.supabaseCore.client;

    }


    if(window.SUPABASE_CLIENT){

      return window.SUPABASE_CLIENT;

    }


    /*
      Some existing ALBUKHR pages may expose the client
      directly as `supabase`.
    */

    if(
      window.supabase &&
      typeof window.supabase.from === "function"
    ){

      return window.supabase;

    }


    throw new Error(
      "ALBUKHR Supabase client is not initialized. " +
      "Load js/supabase-core.js first."
    );

  }


  /* =======================================================
     NETWORK RESOLUTION
     -------------------------------------------------------
     Mainnet/Testnet MUST NEVER MIX.
  ======================================================= */

  function getCurrentNetwork(){

    /*
      Preferred shared environment engine.
    */

    try{

      if(
        typeof window.getCurrentNetwork === "function"
      ){

        const network =
          normalizeNetwork(
            window.getCurrentNetwork()
          );

        if(network){

          return network;

        }

      }

    }catch(error){

      console.warn(
        "getCurrentNetwork() failed:",
        error
      );

    }


    /*
      Alternative shared environment APIs.
    */

    try{

      if(
        typeof window.getEnvironment === "function"
      ){

        const environment =
          window.getEnvironment();

        const network =
          normalizeNetwork(
            typeof environment === "string"
              ? environment
              : environment?.network
          );

        if(network){

          return network;

        }

      }

    }catch(error){

      console.warn(
        "getEnvironment() failed:",
        error
      );

    }


    /*
      URL fallback.

      Mainnet:
      app.albukhr.com

      Testnet:
      test.albukhr.com
    */

    try{

      const host =
        safeString(
          window.location?.hostname
        ).toLowerCase();


      if(
        host === "test.albukhr.com" ||
        host.startsWith("test.")
      ){

        return "testnet";

      }


      if(
        host === "app.albukhr.com" ||
        host.startsWith("app.")
      ){

        return "mainnet";

      }

    }catch(error){

      console.warn(
        "Network URL detection failed:",
        error
      );

    }


    /*
      NEVER silently default a transaction to testnet
      or mainnet.

      This prevents accidental cross-network writes.
    */

    throw new Error(
      "Unable to determine ALBUKHR network. " +
      "Transaction blocked for safety."
    );

  }


  /* =======================================================
     CURRENT AUTH USER
     -------------------------------------------------------
     Supabase Auth is the source of truth.
     NO pi_user localStorage.
  ======================================================= */

  async function getCurrentAuthUser(){

    const client =
      getSupabaseClient();

    const {
      data,
      error
    } =
      await client.auth.getUser();


    if(error){

      console.error(
        "Supabase auth getUser failed:",
        error
      );

      return null;

    }


    return data?.user || null;

  }


  /* =======================================================
     CURRENT USER CONTEXT
  ======================================================= */

  async function getCurrentUser(){

    const user =
      await getCurrentAuthUser();


    if(!user){

      return null;

    }


    const metadata =
      user.user_metadata || {};


    return {

      uid: user.id,

      userid: user.id,

      email:
        user.email || "",

      username:
        metadata.username ||
        metadata.user_name ||
        "",

      wallet:
        metadata.wallet ||
        metadata.pi_wallet ||
        metadata.wallet_address ||
        "",

      authUser: user

    };

  }


  /* =======================================================
     USER REQUIREMENT
  ======================================================= */

  async function requireCurrentUser(){

    const user =
      await getCurrentUser();


    if(!user){

      return {

        ok: false,

        error:
          "User is not authenticated"

      };

    }


    return {

      ok: true,

      user

    };

  }


  /* =======================================================
     TRANSACTION NORMALIZER
  ======================================================= */

  function normalizeTransaction(row = {}){

    return {

      id:
        row.id ?? null,

      userid:
        safeString(row.userid),

      project:
        safeString(
          row.project
        ),

      amount:
        safeNumber(
          row.amount,
          0
        ),

      fee:
        safeNumber(
          row.fee,
          0
        ),

      wallet:
        safeString(
          row.wallet
        ),

      type:
        normalizeType(
          row.type
        ),

      status:
        normalizeStatus(
          row.status
        ) || safeString(row.status),

      txid:
        safeString(
          row.txid
        ),

      created_at:
        row.created_at || null,

      processed_at:
        row.processed_at || null,

      network:
        normalizeNetwork(
          row.network
        )

    };

  }


  /* =======================================================
     VALIDATE TRANSACTION INPUT
  ======================================================= */

  function validateTransactionInput({

    type,

    project,

    amount,

    fee = 0,

    wallet = "",

    txid = "",

    status = STATUS.PAID,

    network = ""

  } = {}){


    if(!normalizeType(type)){

      return {

        valid:false,

        error:
          "Transaction type is required"

      };

    }


    if(
      !safeString(project)
    ){

      return {

        valid:false,

        error:
          "Project is required"

      };

    }


    const normalizedAmount =
      safeNumber(amount, 0);


    if(normalizedAmount <= 0){

      return {

        valid:false,

        error:
          "Transaction amount must be greater than zero"

      };

    }


    const normalizedFee =
      safeNumber(fee, 0);


    if(normalizedFee < 0){

      return {

        valid:false,

        error:
          "Transaction fee cannot be negative"

      };

    }


    const normalizedStatus =
      normalizeStatus(status);


    if(!normalizedStatus){

      return {

        valid:false,

        error:
          "Invalid transaction status"

      };

    }


    const normalizedNetwork =
      normalizeNetwork(network);


    if(!normalizedNetwork){

      return {

        valid:false,

        error:
          "Invalid transaction network"

      };

    }


    return {

      valid:true,

      values:{

        type:
          normalizeType(type),

        project:
          safeString(project),

        amount:
          normalizedAmount,

        fee:
          normalizedFee,

        wallet:
          safeString(wallet),

        txid:
          safeString(txid),

        status:
          normalizedStatus,

        network:
          normalizedNetwork

      }

    };

  }


  /* =======================================================
     GET USER TRANSACTIONS
     -------------------------------------------------------
     User sees ONLY:
       userid = current authenticated user
       network = current network
  ======================================================= */

  async function getTransactions({

    limit = 100,

    offset = 0,

    type = "",

    project = "",

    status = "",

    newestFirst = true

  } = {}){


    const auth =
      await requireCurrentUser();


    if(!auth.ok){

      return [];

    }


    const client =
      getSupabaseClient();

    const network =
      getCurrentNetwork();


    let query =
      client
        .from(TABLE_NAME)
        .select("*")
        .eq("userid", auth.user.uid)
        .eq("network", network);


    if(type){

      query =
        query.eq(
          "type",
          normalizeType(type)
        );

    }


    if(project){

      query =
        query.eq(
          "project",
          safeString(project)
        );

    }


    if(status){

      query =
        query.eq(
          "status",
          normalizeStatus(status)
        );

    }


    query =
      query
        .order(
          "created_at",
          {
            ascending: !newestFirst
          }
        )
        .range(
          Math.max(0, offset),
          Math.max(
            0,
            offset + Math.max(1, limit) - 1
          )
        );


    const {
      data,
      error
    } =
      await query;


    if(error){

      console.error(
        "getTransactions failed:",
        error
      );

      return [];

    }


    return Array.isArray(data)
      ? data.map(normalizeTransaction)
      : [];

  }


  /* =======================================================
     GET TRANSACTION BY ID
  ======================================================= */

  async function getTransactionById(id){

    const auth =
      await requireCurrentUser();


    if(!auth.ok){

      return {

        error:
          auth.error

      };

    }


    const transactionId =
      safeString(id);


    if(!transactionId){

      return {

        error:
          "Transaction ID is required"

      };

    }


    const client =
      getSupabaseClient();

    const network =
      getCurrentNetwork();


    const {
      data,
      error
    } =
      await client
        .from(TABLE_NAME)
        .select("*")
        .eq("id", transactionId)
        .eq("userid", auth.user.uid)
        .eq("network", network)
        .maybeSingle();


    if(error){

      console.error(
        "getTransactionById failed:",
        error
      );

      return {

        error:
          error.message ||
          "Failed to load transaction"

      };

    }


    return data
      ? normalizeTransaction(data)
      : null;

  }


  /* =======================================================
     FIND BY TXID
     -------------------------------------------------------
     Important for Pi payment verification.
  ======================================================= */

  async function getTransactionByTxid(txid){

    const transactionId =
      safeString(txid);


    if(!transactionId){

      return null;

    }


    const auth =
      await requireCurrentUser();


    if(!auth.ok){

      return null;

    }


    const client =
      getSupabaseClient();

    const network =
      getCurrentNetwork();


    const {
      data,
      error
    } =
      await client
        .from(TABLE_NAME)
        .select("*")
        .eq("txid", transactionId)
        .eq("network", network)
        .maybeSingle();


    if(error){

      console.error(
        "getTransactionByTxid failed:",
        error
      );

      return null;

    }


    return data
      ? normalizeTransaction(data)
      : null;

  }


  /* =======================================================
     CHECK DUPLICATE TXID
  ======================================================= */

  async function transactionExistsByTxid(txid){

    const transaction =
      await getTransactionByTxid(txid);

    return !!transaction;

  }


  /* =======================================================
     RECORD TRANSACTION
     -------------------------------------------------------
     Supabase INSERT
  ======================================================= */

  async function recordTx({

    type,

    project,

    amount,

    fee = 0,

    wallet = "",

    txid = "",

    status = STATUS.PAID,

    meta = {}

  } = {}){


    const auth =
      await requireCurrentUser();


    if(!auth.ok){

      return {

        error:
          auth.error

      };

    }


    const network =
      getCurrentNetwork();


    /*
      Prevent duplicate blockchain/payment records.
    */

    if(txid){

      const exists =
        await transactionExistsByTxid(txid);


      if(exists){

        return {

          error:
            "Transaction already exists",

          duplicate:true

        };

      }

    }


    const validation =
      validateTransactionInput({

        type,

        project,

        amount,

        fee,

        wallet,

        txid,

        status,

        network

      });


    if(!validation.valid){

      return {

        error:
          validation.error

      };

    }


    const values =
      validation.values;


    /*
      IMPORTANT:
      The current transactions table has NO `meta`
      column.

      Therefore meta is NOT inserted into transactions.

      If future architecture requires transaction metadata,
      create a dedicated transaction_metadata table instead
      of violating the canonical transactions schema.
    */


    const payload = {

      userid:
        auth.user.uid,

      project:
        values.project,

      amount:
        values.amount,

      fee:
        values.fee,

      wallet:
        values.wallet ||
        auth.user.wallet ||
        "",

      type:
        values.type,

      status:
        values.status,

      txid:
        values.txid || null,

      network:
        network

    };


    const client =
      getSupabaseClient();


    const {
      data,
      error
    } =
      await client
        .from(TABLE_NAME)
        .insert(payload)
        .select("*")
        .single();


    if(error){

      console.error(
        "recordTx failed:",
        error
      );


      return {

        error:
          error.message ||
          "Failed to record transaction",

        code:
          error.code || null,

        details:
          error.details || null,

        hint:
          error.hint || null

      };

    }


    return normalizeTransaction(data);

  }


  /* =======================================================
     RECORD PENDING TRANSACTION
  ======================================================= */

  async function recordPendingTx({

    type,

    project,

    amount,

    fee = 0,

    wallet = "",

    txid = ""

  } = {}){


    return await recordTx({

      type,

      project,

      amount,

      fee,

      wallet,

      txid,

      status:
        STATUS.PENDING

    });

  }


  /* =======================================================
     MARK TRANSACTION PAID
  ======================================================= */

  async function markTransactionPaid(id){

    return await updateTransactionStatus(
      id,
      STATUS.PAID
    );

  }


  /* =======================================================
     MARK TRANSACTION FAILED
  ======================================================= */

  async function markTransactionFailed(id){

    return await updateTransactionStatus(
      id,
      STATUS.FAILED
    );

  }


  /* =======================================================
     UPDATE TRANSACTION STATUS
  ======================================================= */

  async function updateTransactionStatus(
    id,
    status
  ){

    const auth =
      await requireCurrentUser();


    if(!auth.ok){

      return {

        error:
          auth.error

      };

    }


    const transactionId =
      safeString(id);


    if(!transactionId){

      return {

        error:
          "Transaction ID is required"

      };

    }


    const normalizedStatus =
      normalizeStatus(status);


    if(!normalizedStatus){

      return {

        error:
          "Invalid transaction status"

      };

    }


    const network =
      getCurrentNetwork();

    const client =
      getSupabaseClient();


    const {
      data,
      error
    } =
      await client
        .from(TABLE_NAME)
        .update({

          status:
            normalizedStatus,

          processed_at:
            normalizedStatus === STATUS.PAID
              ? new Date().toISOString()
              : null

        })
        .eq(
          "id",
          transactionId
        )
        .eq(
          "userid",
          auth.user.uid
        )
        .eq(
          "network",
          network
        )
        .select("*")
        .single();


    if(error){

      console.error(
        "updateTransactionStatus failed:",
        error
      );

      return {

        error:
          error.message ||
          "Failed to update transaction"

      };

    }


    return normalizeTransaction(data);

  }


  /* =======================================================
     GET TRANSACTIONS BY PROJECT
  ======================================================= */

  async function getTxByProject(
    project,
    options = {}
  ){

    return await getTransactions({

      ...options,

      project

    });

  }


  /* =======================================================
     GET TRANSACTIONS BY TYPE
  ======================================================= */

  async function getTxByType(
    type,
    options = {}
  ){

    return await getTransactions({

      ...options,

      type

    });

  }


  /* =======================================================
     GET TRANSACTIONS BY STATUS
  ======================================================= */

  async function getTxByStatus(
    status,
    options = {}
  ){

    return await getTransactions({

      ...options,

      status

    });

  }


  /* =======================================================
     RECENT TRANSACTIONS
  ======================================================= */

  async function getRecentTx(
    limit = 20
  ){

    return await getTransactions({

      limit,

      newestFirst:true

    });

  }


  /* =======================================================
     USER TRANSACTION TOTALS
  ======================================================= */

  async function getUserTransactionTotals(){

    const transactions =
      await getTransactions({

        limit:1000

      });


    let totalCapital = 0;

    let totalRewards = 0;

    let totalWithdrawals = 0;

    let totalFees = 0;


    transactions.forEach(tx=>{

      const amount =
        safeNumber(
          tx.amount,
          0
        );


      const fee =
        safeNumber(
          tx.fee,
          0
        );


      totalFees += fee;


      if(
        tx.status !== STATUS.PAID
      ){

        return;

      }


      if(
        tx.type === TRANSACTION_TYPES.CAPITAL ||
        tx.type === TRANSACTION_TYPES.STAKE
      ){

        totalCapital += amount;

      }


      if(
        tx.type === TRANSACTION_TYPES.REWARD
      ){

        totalRewards += amount;

      }


      if(
        tx.type === TRANSACTION_TYPES.WITHDRAW
      ){

        totalWithdrawals += amount;

      }

    });


    return {

      network:
        getCurrentNetwork(),

      totalTransactions:
        transactions.length,

      totalCapital:
        totalCapital,

      totalRewards:
        totalRewards,

      totalWithdrawals:
        totalWithdrawals,

      totalFees:
        totalFees

    };

  }


  /* =======================================================
     PROJECT TRANSACTION TOTALS
  ======================================================= */

  async function getProjectTransactionTotals(
    project
  ){

    const transactions =
      await getTxByProject(
        project,
        {
          limit:1000
        }
      );


    let capital = 0;

    let rewards = 0;

    let withdrawals = 0;

    let fees = 0;


    transactions.forEach(tx=>{

      const amount =
        safeNumber(
          tx.amount,
          0
        );


      const fee =
        safeNumber(
          tx.fee,
          0
        );


      fees += fee;


      if(
        tx.status !== STATUS.PAID
      ){

        return;

      }


      if(
        tx.type === TRANSACTION_TYPES.CAPITAL ||
        tx.type === TRANSACTION_TYPES.STAKE
      ){

        capital += amount;

      }


      if(
        tx.type === TRANSACTION_TYPES.REWARD
      ){

        rewards += amount;

      }


      if(
        tx.type === TRANSACTION_TYPES.WITHDRAW
      ){

        withdrawals += amount;

      }

    });


    return {

      network:
        getCurrentNetwork(),

      project:
        safeString(project),

      totalTransactions:
        transactions.length,

      capital,

      rewards,

      withdrawals,

      fees

    };

  }


  /* =======================================================
     TRANSACTION ENGINE HEALTH
  ======================================================= */

  async function getTransactionEngineStatus(){

    let network = "";

    let user = null;

    let supabaseReady = false;


    try{

      network =
        getCurrentNetwork();

    }catch(error){

      network = "";

    }


    try{

      getSupabaseClient();

      supabaseReady = true;

    }catch(error){

      supabaseReady = false;

    }


    try{

      user =
        await getCurrentUser();

    }catch(error){

      user = null;

    }


    return {

      engine:
        "ALBUKHR Unified Transaction Engine",

      version:
        TRANSACTION_ENGINE_VERSION,

      table:
        TABLE_NAME,

      supabase:
        supabaseReady,

      authenticated:
        !!user,

      userid:
        user?.uid || null,

      network:
        network || null,

      localStorageTransactions:
        false,

      networkIsolation:
        true

    };

  }


  /* =======================================================
     PUBLIC API
  ======================================================= */

  const API = {

    version:
      TRANSACTION_ENGINE_VERSION,

    TABLE_NAME,

    STATUS,

    TRANSACTION_TYPES,


    safeString,

    safeNumber,

    normalizeNetwork,

    normalizeType,

    normalizeStatus,


    getSupabaseClient,

    getCurrentNetwork,

    getCurrentAuthUser,

    getCurrentUser,

    requireCurrentUser,


    normalizeTransaction,

    validateTransactionInput,


    getTransactions,

    getTransactionById,

    getTransactionByTxid,

    transactionExistsByTxid,


    recordTx,

    recordPendingTx,


    markTransactionPaid,

    markTransactionFailed,

    updateTransactionStatus,


    getTxByProject,

    getTxByType,

    getTxByStatus,

    getRecentTx,


    getUserTransactionTotals,

    getProjectTransactionTotals,


    getTransactionEngineStatus

  };


  /* =======================================================
     GLOBAL NAMESPACE
  ======================================================= */

  window.ALBUKHR_TRANSACTION_ENGINE =
    API;


  /* =======================================================
     LEGACY / DIRECT GLOBAL COMPATIBILITY
     -------------------------------------------------------
     Existing pages can continue calling these functions
     while migrating to the new namespace.
  ======================================================= */

  window.getTransactions =
    getTransactions;

  window.recordTx =
    recordTx;

  window.recordPendingTx =
    recordPendingTx;

  window.getTxByProject =
    getTxByProject;

  window.getTxByType =
    getTxByType;

  window.getTxByStatus =
    getTxByStatus;

  window.getRecentTx =
    getRecentTx;

  window.getTransactionById =
    getTransactionById;

  window.getTransactionByTxid =
    getTransactionByTxid;

  window.transactionExistsByTxid =
    transactionExistsByTxid;

  window.updateTransactionStatus =
    updateTransactionStatus;

  window.markTransactionPaid =
    markTransactionPaid;

  window.markTransactionFailed =
    markTransactionFailed;

  window.getUserTransactionTotals =
    getUserTransactionTotals;

  window.getProjectTransactionTotals =
    getProjectTransactionTotals;

  window.getTransactionEngineStatus =
    getTransactionEngineStatus;


})(window);
