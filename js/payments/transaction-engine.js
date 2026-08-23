/* =========================================================
   ALBUKHR UNIFIED TRANSACTION ENGINE v4
   =========================================================
   ARCHITECTURE:
   03-payments/transaction-engine.js

   ROLE:
   - Canonical transaction service for ALBUKHR
   - Supabase-first
   - Network-aware
   - Project-code-first
   - Payment/transaction lifecycle management
   - Duplicate transaction protection
   - User-scoped transaction access
   - Legacy compatibility during migration

   DEPENDENCIES:
   - 01-core/database/supabase-core.js
   - 01-core/environment/environment-switcher.js
   - 05-investment/project-resolver.js (optional but recommended)

   IMPORTANT:
   - No localStorage transaction state
   - No localStorage user identity
   - No silent network fallback
   - Mainnet and Testnet must never mix
   - project_code is the canonical project reference
   - Database remains the source of truth

   DATABASE CONTRACT EXPECTED BY THIS ENGINE:
   transactions
     - id
     - userid
     - project
     - amount
     - fee
     - wallet
     - type
     - status
     - txid
     - created_at
     - processed_at
     - network

   NOTE:
   `project` remains the physical database field for backward
   compatibility. At the application/API layer it represents
   the canonical project_code.
========================================================= */

(function(window){

  "use strict";


  /* =======================================================
     ENGINE IDENTITY
  ======================================================= */

  const ENGINE_NAME =
    "ALBUKHR Unified Transaction Engine";

  const ENGINE_VERSION =
    "4.0.0";

  const TABLE_NAME =
    "transactions";


  /* =======================================================
     TRANSACTION STATUS
  ======================================================= */

  const STATUS = Object.freeze({

    PENDING: "pending",

    PAID: "paid",

    FAILED: "failed"

  });


  /* =======================================================
     TRANSACTION TYPES
  ======================================================= */

  const TRANSACTION_TYPES = Object.freeze({

    CAPITAL: "capital",

    REWARD: "reward",

    STAKE: "stake",

    WITHDRAW: "withdraw",

    FEE: "fee",

    REFUND: "refund"

  });


  /* =======================================================
     NETWORKS
  ======================================================= */

  const NETWORKS = Object.freeze({

    MAINNET: "mainnet",

    TESTNET: "testnet"

  });


  /* =======================================================
     SAFE HELPERS
  ======================================================= */

  function safeString(
    value,
    fallback = ""
  ){

    if(
      value === null ||
      value === undefined
    ){

      return fallback;

    }

    return String(value).trim();

  }


  function safeNumber(
    value,
    fallback = 0
  ){

    const number =
      Number(value);

    return Number.isFinite(number)
      ? number
      : fallback;

  }


  function lower(
    value
  ){

    return safeString(
      value
    )
      .toLowerCase();

  }


  /* =======================================================
     NETWORK NORMALIZER
  ======================================================= */

  function normalizeNetwork(
    value
  ){

    const network =
      lower(value);


    if(
      network === NETWORKS.MAINNET ||
      network === "main"
    ){

      return NETWORKS.MAINNET;

    }


    if(
      network === NETWORKS.TESTNET ||
      network === "test"
    ){

      return NETWORKS.TESTNET;

    }


    return "";

  }


  /* =======================================================
     TRANSACTION TYPE NORMALIZER
  ======================================================= */

  function normalizeType(
    value
  ){

    const type =
      lower(value);


    return Object.values(
      TRANSACTION_TYPES
    ).includes(type)

      ? type

      : "";

  }


  /* =======================================================
     STATUS NORMALIZER
  ======================================================= */

  function normalizeStatus(
    value
  ){

    const status =
      lower(value);


    return Object.values(
      STATUS
    ).includes(status)

      ? status

      : "";

  }


  /* =======================================================
     SUPABASE CLIENT
     -------------------------------------------------------
     SINGLE DATABASE ENTRY POINT
  ======================================================= */

  function getSupabaseClient(){

    /*
      Preferred shared ALBUKHR client.
    */

    if(
      window.supabaseCore?.client
    ){

      return window.supabaseCore.client;

    }


    if(
      window.supabaseClient
    ){

      return window.supabaseClient;

    }


    if(
      window.SUPABASE_CLIENT
    ){

      return window.SUPABASE_CLIENT;

    }


    /*
      Compatibility only.
    */

    if(
      window.supabase &&
      typeof window.supabase.from === "function"
    ){

      return window.supabase;

    }


    throw new Error(
      "ALBUKHR Supabase client is unavailable. " +
      "Load 01-core/database/supabase-core.js first."
    );

  }


  /* =======================================================
     NETWORK RESOLUTION
     -------------------------------------------------------
     IMPORTANT:
     This function intentionally supports both synchronous
     and asynchronous shared environment engines.
  ======================================================= */

  async function getCurrentNetwork(){

    /*
      1. Canonical project/environment resolver
    */

    try{

      if(
        window.ALBUKHR_PROJECT_RESOLVER &&
        typeof
          window.ALBUKHR_PROJECT_RESOLVER
            .getCurrentAlbukhrNetwork ===
          "function"
      ){

        const network =
          await window.ALBUKHR_PROJECT_RESOLVER
            .getCurrentAlbukhrNetwork();


        const normalized =
          normalizeNetwork(network);


        if(normalized){

          return normalized;

        }

      }

    }catch(error){

      console.warn(
        "[ALBUKHR TRANSACTION] Project resolver " +
        "network resolution failed:",
        error
      );

    }


    /*
      2. Shared environment function
    */

    try{

      if(
        typeof window.getCurrentNetwork ===
        "function"
      ){

        const result =
          await window.getCurrentNetwork();


        const normalized =
          normalizeNetwork(result);


        if(normalized){

          return normalized;

        }

      }

    }catch(error){

      console.warn(
        "[ALBUKHR TRANSACTION] Shared network " +
        "resolution failed:",
        error
      );

    }


    /*
      3. ALBUKHR environment object
    */

    try{

      const environment =
        window.ALBUKHR_NETWORK ||
        window.ALBUKHR_ENVIRONMENT;


      if(environment){

        const value =
          typeof environment === "string"

            ? environment

            : (
                environment.network ||
                environment.current ||
                environment.name
              );


        const normalized =
          normalizeNetwork(value);


        if(normalized){

          return normalized;

        }

      }

    }catch(error){

      console.warn(
        "[ALBUKHR TRANSACTION] Environment object " +
        "resolution failed:",
        error
      );

    }


    /*
      4. Hostname fallback
    */

    try{

      const hostname =
        lower(
          window.location?.hostname
        );


      if(
        hostname === "test.albukhr.com" ||
        hostname.startsWith("test.")
      ){

        return NETWORKS.TESTNET;

      }


      if(
        hostname === "app.albukhr.com" ||
        hostname.startsWith("app.")
      ){

        return NETWORKS.MAINNET;

      }

    }catch(error){

      console.warn(
        "[ALBUKHR TRANSACTION] Hostname network " +
        "resolution failed:",
        error
      );

    }


    /*
      SECURITY:
      Never silently choose a network.
    */

    throw new Error(
      "Unable to determine ALBUKHR network. " +
      "Transaction operation blocked for safety."
    );

  }


  /* =======================================================
     ASSERT NETWORK
  ======================================================= */

  async function requireNetwork(){

    const network =
      await getCurrentNetwork();


    if(
      !normalizeNetwork(network)
    ){

      throw new Error(
        "ALBUKHR network could not be verified."
      );

    }


    return network;

  }


  /* =======================================================
     CURRENT AUTH USER
     -------------------------------------------------------
     Supabase Auth is authoritative.
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
        "[ALBUKHR TRANSACTION] Supabase auth error:",
        error
      );

      return null;

    }


    return data?.user || null;

  }


  /* =======================================================
     USER CONTEXT
  ======================================================= */

  async function getCurrentUser(){

    const authUser =
      await getCurrentAuthUser();


    if(!authUser){

      return null;

    }


    const metadata =
      authUser.user_metadata || {};


    return {

      uid:
        safeString(
          authUser.id
        ),

      userid:
        safeString(
          authUser.id
        ),

      email:
        safeString(
          authUser.email
        ),

      username:
        safeString(
          metadata.username ||
          metadata.user_name
        ),

      wallet:
        safeString(
          metadata.wallet ||
          metadata.pi_wallet ||
          metadata.wallet_address
        ),

      authUser

    };

  }


  /* =======================================================
     REQUIRE AUTHENTICATED USER
  ======================================================= */

  async function requireCurrentUser(){

    const user =
      await getCurrentUser();


    if(!user){

      return {

        ok: false,

        error:
          "User is not authenticated."

      };

    }


    return {

      ok: true,

      user

    };

  }


  /* =======================================================
     PROJECT CODE NORMALIZATION
     -------------------------------------------------------
     project_code is canonical at engine level.
  ======================================================= */

  function normalizeProjectCode(
    value
  ){

    return safeString(
      value
    );

  }


  /* =======================================================
     RESOLVE PROJECT CODE
     -------------------------------------------------------
     Accept:
       - project_code
       - legacy project
       - project object
       - project name/code through resolver
  ======================================================= */

  async function resolveProjectCode(
    projectRef
  ){

    if(
      projectRef &&
      typeof projectRef === "object"
    ){

      const directCode =
        normalizeProjectCode(
          projectRef.project_code ||
          projectRef.code
        );


      if(directCode){

        return directCode;

      }

    }


    const direct =
      normalizeProjectCode(
        projectRef
      );


    if(!direct){

      return "";

    }


    /*
      If resolver is available, use its canonical
      project-code-first resolution.
    */

    try{

      const resolver =
        window.ALBUKHR_PROJECT_RESOLVER;


      if(
        resolver &&
        typeof resolver.resolveAlbukhrProject ===
        "function"
      ){

        const project =
          await resolver.resolveAlbukhrProject(
            direct
          );


        if(project?.project_code){

          return normalizeProjectCode(
            project.project_code
          );

        }

      }

    }catch(error){

      console.warn(
        "[ALBUKHR TRANSACTION] Project resolver " +
        "lookup failed:",
        error
      );

    }


    /*
      Compatibility:
      If no resolver is available, retain the supplied
      project reference rather than inventing a code.
    */

    return direct;

  }


  /* =======================================================
     TRANSACTION NORMALIZER
  ======================================================= */

  function normalizeTransaction(
    row = {}
  ){

    const projectCode =
      normalizeProjectCode(
        row.project_code ||
        row.project
      );


    return {

      id:
        row.id ?? null,

      userid:
        safeString(
          row.userid
        ),

      /*
        Canonical application-level property.
      */

      project_code:
        projectCode,

      /*
        Legacy compatibility property.
      */

      project:
        projectCode,

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
        ) ||
        safeString(
          row.status
        ),

      txid:
        safeString(
          row.txid
        ),

      created_at:
        row.created_at ||
        null,

      processed_at:
        row.processed_at ||
        null,

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

    project_code,

    project,

    amount,

    fee = 0,

    wallet = "",

    txid = "",

    status = STATUS.PAID,

    network = ""

  } = {}){

    const normalizedType =
      normalizeType(type);


    if(!normalizedType){

      return {

        valid: false,

        error:
          "Transaction type is required."

      };

    }


    const projectCode =
      normalizeProjectCode(
        project_code ||
        project
      );


    if(!projectCode){

      return {

        valid: false,

        error:
          "project_code is required."

      };

    }


    const normalizedAmount =
      safeNumber(
        amount,
        0
      );


    if(
      normalizedAmount <= 0
    ){

      return {

        valid: false,

        error:
          "Transaction amount must be greater than zero."

      };

    }


    const normalizedFee =
      safeNumber(
        fee,
        0
      );


    if(
      normalizedFee < 0
    ){

      return {

        valid: false,

        error:
          "Transaction fee cannot be negative."

      };

    }


    const normalizedStatus =
      normalizeStatus(status);


    if(!normalizedStatus){

      return {

        valid: false,

        error:
          "Invalid transaction status."

      };

    }


    const normalizedNetwork =
      normalizeNetwork(network);


    if(!normalizedNetwork){

      return {

        valid: false,

        error:
          "A valid ALBUKHR network is required."

      };

    }


    return {

      valid: true,

      values: {

        type:
          normalizedType,

        project_code:
          projectCode,

        amount:
          normalizedAmount,

        fee:
          normalizedFee,

        wallet:
          safeString(
            wallet
          ),

        txid:
          safeString(
            txid
          ),

        status:
          normalizedStatus,

        network:
          normalizedNetwork

      }

    };

  }


  /* =======================================================
     BUILD DATABASE PAYLOAD
     -------------------------------------------------------
     Physical DB column remains `project`.
     Application API uses `project_code`.
  ======================================================= */

  function buildTransactionPayload(
    values,
    user
  ){

    return {

      userid:
        user.userid,

      project:
        values.project_code,

      amount:
        values.amount,

      fee:
        values.fee,

      wallet:
        values.wallet ||
        user.wallet ||
        "",

      type:
        values.type,

      status:
        values.status,

      txid:
        values.txid ||
        null,

      network:
        values.network

    };

  }


  /* =======================================================
     GET USER TRANSACTIONS
  ======================================================= */

  async function getTransactions({

    limit = 100,

    offset = 0,

    type = "",

    project_code = "",

    project = "",

    status = "",

    newestFirst = true

  } = {}){

    const auth =
      await requireCurrentUser();


    if(!auth.ok){

      return [];

    }


    const network =
      await requireNetwork();


    const client =
      getSupabaseClient();


    let query =
      client
        .from(TABLE_NAME)
        .select("*")
        .eq(
          "userid",
          auth.user.userid
        )
        .eq(
          "network",
          network
        );


    if(type){

      const normalizedType =
        normalizeType(type);


      if(!normalizedType){

        return [];

      }


      query =
        query.eq(
          "type",
          normalizedType
        );

    }


    const requestedProject =
      normalizeProjectCode(
        project_code ||
        project
      );


    if(requestedProject){

      const canonicalProject =
        await resolveProjectCode(
          requestedProject
        );


      query =
        query.eq(
          "project",
          canonicalProject
        );

    }


    if(status){

      const normalizedStatus =
        normalizeStatus(status);


      if(!normalizedStatus){

        return [];

      }


      query =
        query.eq(
          "status",
          normalizedStatus
        );

    }


    const safeLimit =
      Math.min(
        1000,
        Math.max(
          1,
          Number(limit) || 100
        )
      );


    const safeOffset =
      Math.max(
        0,
        Number(offset) || 0
      );


    query =
      query
        .order(
          "created_at",
          {
            ascending:
              !newestFirst
          }
        )
        .range(
          safeOffset,
          safeOffset +
          safeLimit -
          1
        );


    const {
      data,
      error
    } =
      await query;


    if(error){

      console.error(
        "[ALBUKHR TRANSACTION] getTransactions failed:",
        error
      );

      return [];

    }


    return Array.isArray(data)

      ? data.map(
          normalizeTransaction
        )

      : [];

  }


  /* =======================================================
     GET TRANSACTION BY ID
  ======================================================= */

  async function getTransactionById(
    id
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
          "Transaction ID is required."

      };

    }


    const network =
      await requireNetwork();


    const client =
      getSupabaseClient();


    const {
      data,
      error
    } =
      await client
        .from(TABLE_NAME)
        .select("*")
        .eq(
          "id",
          transactionId
        )
        .eq(
          "userid",
          auth.user.userid
        )
        .eq(
          "network",
          network
        )
        .maybeSingle();


    if(error){

      console.error(
        "[ALBUKHR TRANSACTION] getTransactionById failed:",
        error
      );

      return {

        error:
          error.message ||
          "Failed to load transaction."

      };

    }


    return data
      ? normalizeTransaction(data)
      : null;

  }


  /* =======================================================
     FIND TRANSACTION BY TXID
     -------------------------------------------------------
     User-scoped.
  ======================================================= */

  async function getTransactionByTxid(
    txid
  ){

    const normalizedTxid =
      safeString(txid);


    if(!normalizedTxid){

      return null;

    }


    const auth =
      await requireCurrentUser();


    if(!auth.ok){

      return null;

    }


    const network =
      await requireNetwork();


    const client =
      getSupabaseClient();


    const {
      data,
      error
    } =
      await client
        .from(TABLE_NAME)
        .select("*")
        .eq(
          "txid",
          normalizedTxid
        )
        .eq(
          "network",
          network
        )
        .eq(
          "userid",
          auth.user.userid
        )
        .maybeSingle();


    if(error){

      console.error(
        "[ALBUKHR TRANSACTION] getTransactionByTxid failed:",
        error
      );

      return null;

    }


    return data
      ? normalizeTransaction(data)
      : null;

  }


  /* =======================================================
     FIND TRANSACTION BY TXID — GLOBAL
     -------------------------------------------------------
     This is intentionally separate from the user-scoped
     function.

     Useful for payment verification engines.

     Database RLS must permit the intended server/admin
     path. The browser must NOT receive unrestricted
     transaction visibility merely because this function
     exists.
  ======================================================= */

  async function findTransactionByTxid(
    txid
  ){

    const normalizedTxid =
      safeString(txid);


    if(!normalizedTxid){

      return null;

    }


    const network =
      await requireNetwork();


    const client =
      getSupabaseClient();


    const {
      data,
      error
    } =
      await client
        .from(TABLE_NAME)
        .select("*")
        .eq(
          "txid",
          normalizedTxid
        )
        .eq(
          "network",
          network
        )
        .maybeSingle();


    if(error){

      console.error(
        "[ALBUKHR TRANSACTION] global TXID lookup failed:",
        error
      );

      return null;

    }


    return data
      ? normalizeTransaction(data)
      : null;

  }


  /* =======================================================
     DUPLICATE TXID CHECK
  ======================================================= */

  async function transactionExistsByTxid(
    txid
  ){

    const transaction =
      await getTransactionByTxid(
        txid
      );


    return !!transaction;

  }


  /* =======================================================
     RECORD TRANSACTION
     -------------------------------------------------------
     Canonical transaction write.
  ======================================================= */

  async function recordTx({

    type,

    project_code = "",

    project = "",

    amount,

    fee = 0,

    wallet = "",

    txid = "",

    status = STATUS.PAID

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
      await requireNetwork();


    const canonicalProjectCode =
      await resolveProjectCode(
        project_code ||
        project
      );


    /*
      Validate before database write.
    */

    const validation =
      validateTransactionInput({

        type,

        project_code:
          canonicalProjectCode,

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
      Duplicate protection.

      This is application-level protection.

      A database UNIQUE constraint on the appropriate
      transaction identity should also exist at the
      database layer for complete race-condition safety.
    */

    if(values.txid){

      const existing =
        await getTransactionByTxid(
          values.txid
        );


      if(existing){

        return {

          error:
            "Transaction already exists.",

          duplicate: true,

          transaction:
            existing

        };

      }

    }


    const payload =
      buildTransactionPayload(
        values,
        auth.user
      );


    const client =
      getSupabaseClient();


    const {
      data,
      error
    } =
      await client
        .from(TABLE_NAME)
        .insert(
          payload
        )
        .select("*")
        .single();


    if(error){

      /*
        Handle a database-level duplicate gracefully.
      */

      const message =
        safeString(
          error.message
        );


      if(
        error.code === "23505" ||
        lower(message)
          .includes("duplicate")
      ){

        return {

          error:
            "Transaction already exists.",

          duplicate: true

        };

      }


      console.error(
        "[ALBUKHR TRANSACTION] recordTx failed:",
        error
      );


      return {

        error:
          message ||
          "Failed to record transaction.",

        code:
          error.code || null,

        details:
          error.details || null,

        hint:
          error.hint || null

      };

    }


    return normalizeTransaction(
      data
    );

  }


  /* =======================================================
     RECORD PENDING TRANSACTION
  ======================================================= */

  async function recordPendingTx(
    options = {}
  ){

    return await recordTx({

      ...options,

      status:
        STATUS.PENDING

    });

  }


  /* =======================================================
     UPDATE TRANSACTION STATUS
     -------------------------------------------------------
     User-scoped status update.
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
          "Transaction ID is required."

      };

    }


    const normalizedStatus =
      normalizeStatus(
        status
      );


    if(!normalizedStatus){

      return {

        error:
          "Invalid transaction status."

      };

    }


    const network =
      await requireNetwork();


    const payload = {

      status:
        normalizedStatus,

      processed_at:
        normalizedStatus === STATUS.PAID

          ? new Date()
              .toISOString()

          : null

    };


    const client =
      getSupabaseClient();


    const {
      data,
      error
    } =
      await client
        .from(TABLE_NAME)
        .update(
          payload
        )
        .eq(
          "id",
          transactionId
        )
        .eq(
          "userid",
          auth.user.userid
        )
        .eq(
          "network",
          network
        )
        .select("*")
        .single();


    if(error){

      console.error(
        "[ALBUKHR TRANSACTION] status update failed:",
        error
      );

      return {

        error:
          error.message ||
          "Failed to update transaction."

      };

    }


    return normalizeTransaction(
      data
    );

  }


  /* =======================================================
     MARK PAID
  ======================================================= */

  async function markTransactionPaid(
    id
  ){

    return await updateTransactionStatus(
      id,
      STATUS.PAID
    );

  }


  /* =======================================================
     MARK FAILED
  ======================================================= */

  async function markTransactionFailed(
    id
  ){

    return await updateTransactionStatus(
      id,
      STATUS.FAILED
    );

  }


  /* =======================================================
     GET TRANSACTIONS BY PROJECT
  ======================================================= */

  async function getTxByProject(
    projectCode,
    options = {}
  ){

    return await getTransactions({

      ...options,

      project_code:
        projectCode

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

      newestFirst:
        true

    });

  }


  /* =======================================================
     USER TRANSACTION TOTALS
  ======================================================= */

  async function getUserTransactionTotals(){

    const transactions =
      await getTransactions({

        limit:
          1000

      });


    let totalCapital = 0;

    let totalRewards = 0;

    let totalWithdrawals = 0;

    let totalFees = 0;


    transactions.forEach(
      transaction => {

        const amount =
          safeNumber(
            transaction.amount
          );


        const fee =
          safeNumber(
            transaction.fee
          );


        totalFees +=
          fee;


        if(
          transaction.status !==
          STATUS.PAID
        ){

          return;

        }


        if(
          transaction.type ===
            TRANSACTION_TYPES.CAPITAL ||

          transaction.type ===
            TRANSACTION_TYPES.STAKE
        ){

          totalCapital +=
            amount;

        }


        if(
          transaction.type ===
          TRANSACTION_TYPES.REWARD
        ){

          totalRewards +=
            amount;

        }


        if(
          transaction.type ===
          TRANSACTION_TYPES.WITHDRAW
        ){

          totalWithdrawals +=
            amount;

        }

      }
    );


    return {

      network:
        await getCurrentNetwork(),

      totalTransactions:
        transactions.length,

      totalCapital,

      totalRewards,

      totalWithdrawals,

      totalFees

    };

  }


  /* =======================================================
     PROJECT TRANSACTION TOTALS
  ======================================================= */

  async function getProjectTransactionTotals(
    projectCode
  ){

    const canonicalProjectCode =
      await resolveProjectCode(
        projectCode
      );


    if(!canonicalProjectCode){

      return {

        network:
          await getCurrentNetwork(),

        project_code:
          "",

        totalTransactions:
          0,

        capital:
          0,

        rewards:
          0,

        withdrawals:
          0,

        fees:
          0

      };

    }


    const transactions =
      await getTxByProject(
        canonicalProjectCode,
        {
          limit:
            1000
        }
      );


    let capital = 0;

    let rewards = 0;

    let withdrawals = 0;

    let fees = 0;


    transactions.forEach(
      transaction => {

        const amount =
          safeNumber(
            transaction.amount
          );


        const fee =
          safeNumber(
            transaction.fee
          );


        fees +=
          fee;


        if(
          transaction.status !==
          STATUS.PAID
        ){

          return;

        }


        if(
          transaction.type ===
            TRANSACTION_TYPES.CAPITAL ||

          transaction.type ===
            TRANSACTION_TYPES.STAKE
        ){

          capital +=
            amount;

        }


        if(
          transaction.type ===
          TRANSACTION_TYPES.REWARD
        ){

          rewards +=
            amount;

        }


        if(
          transaction.type ===
          TRANSACTION_TYPES.WITHDRAW
        ){

          withdrawals +=
            amount;

        }

      }
    );


    return {

      network:
        await getCurrentNetwork(),

      project_code:
        canonicalProjectCode,

      /*
        Legacy compatibility.
      */

      project:
        canonicalProjectCode,

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

    let supabaseReady =
      false;

    let projectResolverReady =
      false;


    try{

      network =
        await getCurrentNetwork();

    }catch(error){

      network = "";

    }


    try{

      getSupabaseClient();

      supabaseReady =
        true;

    }catch(error){

      supabaseReady =
        false;

    }


    try{

      user =
        await getCurrentUser();

    }catch(error){

      user =
        null;

    }


    projectResolverReady =
      !!(
        window.ALBUKHR_PROJECT_RESOLVER
      );


    return {

      engine:
        ENGINE_NAME,

      version:
        ENGINE_VERSION,

      table:
        TABLE_NAME,

      supabase:
        supabaseReady,

      authenticated:
        !!user,

      userid:
        user?.userid ||
        null,

      network:
        network ||
        null,

      projectResolver:
        projectResolverReady,

      localStorageTransactions:
        false,

      networkIsolation:
        true,

      projectCodeFirst:
        true,

      supabaseFirst:
        true

    };

  }


  /* =======================================================
     PUBLIC API
  ======================================================= */

  const API = {

    name:
      ENGINE_NAME,

    version:
      ENGINE_VERSION,

    TABLE_NAME,

    NETWORKS,

    STATUS,

    TRANSACTION_TYPES,


    safeString,

    safeNumber,

    normalizeNetwork,

    normalizeType,

    normalizeStatus,

    normalizeProjectCode,


    getSupabaseClient,

    getCurrentNetwork,

    requireNetwork,


    getCurrentAuthUser,

    getCurrentUser,

    requireCurrentUser,


    resolveProjectCode,


    normalizeTransaction,

    validateTransactionInput,

    buildTransactionPayload,


    getTransactions,

    getTransactionById,

    getTransactionByTxid,

    findTransactionByTxid,

    transactionExistsByTxid,


    recordTx,

    recordPendingTx,


    updateTransactionStatus,

    markTransactionPaid,

    markTransactionFailed,


    getTxByProject,

    getTxByType,

    getTxByStatus,

    getRecentTx,


    getUserTransactionTotals,

    getProjectTransactionTotals,


    getTransactionEngineStatus

  };


  /* =======================================================
     CANONICAL NAMESPACE
  ======================================================= */

  window.ALBUKHR_TRANSACTION_ENGINE =
    API;


  /* =======================================================
     LEGACY GLOBAL COMPATIBILITY
     -------------------------------------------------------
     Temporary compatibility while HTML and older engines
     are migrated to the new architecture.
  ======================================================= */

  window.getTransactions =
    getTransactions;


  window.getTransactionById =
    getTransactionById;


  window.getTransactionByTxid =
    getTransactionByTxid;


  window.findTransactionByTxid =
    findTransactionByTxid;


  window.transactionExistsByTxid =
    transactionExistsByTxid;


  window.recordTx =
    recordTx;


  window.recordPendingTx =
    recordPendingTx;


  window.updateTransactionStatus =
    updateTransactionStatus;


  window.markTransactionPaid =
    markTransactionPaid;


  window.markTransactionFailed =
    markTransactionFailed;


  window.getTxByProject =
    getTxByProject;


  window.getTxByType =
    getTxByType;


  window.getTxByStatus =
    getTxByStatus;


  window.getRecentTx =
    getRecentTx;


  window.getUserTransactionTotals =
    getUserTransactionTotals;


  window.getProjectTransactionTotals =
    getProjectTransactionTotals;


  window.getTransactionEngineStatus =
    getTransactionEngineStatus;


})(window);
