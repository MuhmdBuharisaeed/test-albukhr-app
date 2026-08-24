/* =========================================================
   ALBUKHR UNIFIED TRANSACTION ENGINE v5
   =========================================================
   ARCHITECTURE:
     js/engines/transaction-engine.js

   ROLE:
   - Canonical user transaction service for ALBUKHR
   - Supabase-first
   - Pi-auth-core user identity
   - Strict Mainnet/Testnet isolation
   - Project-code-first
   - Payment/transaction lifecycle management
   - Duplicate transaction protection
   - User-scoped transaction access
   - Legacy global compatibility during migration

   FOUNDATION DEPENDENCIES:
   - js/core/environment-switcher.js
   - js/core/supabase-core.js
   - js/core/pi-auth-core.js

   OPTIONAL:
   - Project registry/resolver exposing getProjectByCode(),
     getProjectMeta(), or resolveAlbukhrProject()

   ARCHITECTURE RULES:
   - No LocalStorage transaction state
   - No LocalStorage user identity
   - No Supabase Auth identity as the user source
   - Pi Auth Core is the authoritative browser user identity
   - Network Core is the authoritative network source
   - Supabase Core is the authoritative database client
   - Mainnet and Testnet must never mix
   - project_code is canonical at the application layer
   - physical DB compatibility field remains `project`
   - No unrestricted browser-wide transaction lookup
   - Database/RLS remains the final authorization boundary

   DATABASE CONTRACT:
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
    "5.0.0";

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


  function lower(value){
    return safeString(value).toLowerCase();
  }


  /* =======================================================
     NETWORK
     -------------------------------------------------------
     Network Core is authoritative.
     No independent hostname/network resolver is maintained
     here. This prevents domain engines from drifting away
     from the foundation.
  ======================================================= */

  function getCurrentNetwork(){

    if(
      typeof window.requireAlbukhrNetwork !==
      "function"
    ){
      throw new Error(
        "ALBUKHR Network Core is unavailable. " +
        "Load js/core/environment-switcher.js and " +
        "js/core/supabase-core.js first."
      );
    }

    const network =
      window.requireAlbukhrNetwork();

    if(
      network !== NETWORKS.MAINNET &&
      network !== NETWORKS.TESTNET
    ){
      throw new Error(
        "ALBUKHR network is invalid."
      );
    }

    return network;
  }


  async function requireNetwork(){
    return getCurrentNetwork();
  }


  function normalizeNetwork(value){
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


  function assertNetworkValue(network){

    const normalized =
      normalizeNetwork(network);

    if(!normalized){
      throw new Error(
        "Invalid ALBUKHR network value."
      );
    }

    const current =
      getCurrentNetwork();

    if(normalized !== current){
      throw new Error(
        `Network mismatch: current environment is ${current}, requested ${normalized}.`
      );
    }

    return true;
  }


  /* =======================================================
     SUPABASE
     -------------------------------------------------------
     Supabase Core is the only database-client source.
  ======================================================= */

  function getSupabaseClient(){

    if(
      typeof window.requireAlbukhrSupabaseClient !==
      "function"
    ){
      throw new Error(
        "ALBUKHR Supabase Core is unavailable. " +
        "Load js/core/supabase-core.js first."
      );
    }

    const client =
      window.requireAlbukhrSupabaseClient();

    if(
      !client ||
      typeof client.from !== "function"
    ){
      throw new Error(
        "ALBUKHR Supabase Core returned an invalid client."
      );
    }

    return client;
  }


  function getSupabaseClientLegacy(){

    return getSupabaseClient();

  }


  /* =======================================================
     PI USER / AUTH
     -------------------------------------------------------
     Pi Auth Core is authoritative.
     Supabase Auth is NOT used for browser user identity.
  ======================================================= */

  async function getCurrentAuthUser(){

    if(
      typeof window.ensurePiAuth !==
      "function"
    ){
      throw new Error(
        "ALBUKHR Pi Auth Core is unavailable. " +
        "Load js/core/pi-auth-core.js first."
      );
    }

    const user =
      await window.ensurePiAuth();

    if(!user?.uid){
      return null;
    }

    return user;
  }


  function normalizePiUser(user){

    if(!user?.uid){
      return null;
    }

    return {
      uid:
        safeString(user.uid),

      userid:
        safeString(user.uid),

      username:
        safeString(user.username),

      wallet:
        safeString(
          user.wallet_address ||
          user.wallet
        ),

      wallet_address:
        safeString(
          user.wallet_address ||
          user.wallet
        ),

      network:
        normalizeNetwork(
          user.network
        ) || getCurrentNetwork(),

      raw:
        user
    };
  }


  async function getCurrentUser(){

    const authUser =
      await getCurrentAuthUser();

    return normalizePiUser(
      authUser
    );
  }


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

    const network =
      getCurrentNetwork();

    /*
     * A Pi Auth Core user is bound to the current
     * ALBUKHR environment. Refuse cross-network context.
     */
    if(
      user.network &&
      normalizeNetwork(user.network) &&
      normalizeNetwork(user.network) !== network
    ){

      return {
        ok: false,
        error:
          `Authenticated user network mismatch: current environment is ${network}.`
      };

    }

    return {
      ok: true,
      user: {
        ...user,
        network
      }
    };
  }


  /* =======================================================
     PROJECT CODE
  ======================================================= */

  function normalizeProjectCode(value){

    if(
      value &&
      typeof value === "object"
    ){
      return safeString(
        value.project_code ||
        value.code ||
        value.slug
      );
    }

    return safeString(value);
  }


  async function resolveProjectCode(projectRef){

    const direct =
      normalizeProjectCode(
        projectRef
      );

    if(!direct){
      return "";
    }

    /*
     * Prefer the current project registry/resolver when it
     * is available. No local project identity is invented.
     */

    const resolver =
      window.ALBUKHR_PROJECT_RESOLVER;

    if(
      resolver &&
      typeof resolver.resolveAlbukhrProject ===
      "function"
    ){

      try{

        const project =
          await resolver.resolveAlbukhrProject(
            direct
          );

        const code =
          normalizeProjectCode(
            project
          );

        if(code){
          return code;
        }

      }catch(error){

        console.warn(
          "[ALBUKHR TRANSACTION] Project resolver failed:",
          error
        );

      }
    }


    if(
      typeof window.getProjectByCode ===
      "function"
    ){

      try{

        const project =
          await window.getProjectByCode(
            direct
          );

        const code =
          normalizeProjectCode(
            project
          );

        if(code){
          return code;
        }

      }catch(error){

        console.warn(
          "[ALBUKHR TRANSACTION] getProjectByCode failed:",
          error
        );

      }
    }


    if(
      typeof window.getProjectMeta ===
      "function"
    ){

      try{

        const project =
          await window.getProjectMeta(
            direct
          );

        const code =
          normalizeProjectCode(
            project
          );

        if(code){
          return code;
        }

      }catch(error){

        console.warn(
          "[ALBUKHR TRANSACTION] getProjectMeta failed:",
          error
        );

      }
    }


    /*
     * Compatibility:
     * retain an explicitly supplied project reference.
     * The engine never creates a fake project code.
     */

    return direct;
  }


  /* =======================================================
     TYPE / STATUS
  ======================================================= */

  function normalizeType(value){

    const type =
      lower(value);

    return Object.values(
      TRANSACTION_TYPES
    ).includes(type)
      ? type
      : "";
  }


  function normalizeStatus(value){

    const status =
      lower(value);

    return Object.values(
      STATUS
    ).includes(status)
      ? status
      : "";
  }


  /* =======================================================
     TRANSACTION NORMALIZER
  ======================================================= */

  function normalizeTransaction(row = {}){

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

      project_code:
        projectCode,

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
        ) ||
        safeString(
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
        ),

      raw:
        row
    };
  }


  /* =======================================================
     VALIDATION
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
      normalizeStatus(
        status
      );

    if(!normalizedStatus){

      return {
        valid: false,
        error:
          "Invalid transaction status."
      };

    }


    const normalizedNetwork =
      normalizeNetwork(
        network
      );

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
     DATABASE PAYLOAD
  ======================================================= */

  function buildTransactionPayload(
    values,
    user
  ){

    if(
      !values ||
      !user?.userid
    ){
      throw new Error(
        "Transaction payload requires an authenticated user."
      );
    }

    assertNetworkValue(
      values.network
    );

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
        user.wallet_address ||
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
     USER TRANSACTION QUERY BASE
  ======================================================= */

  function createUserTransactionQuery(
    client,
    userid,
    network
  ){

    if(!userid){
      throw new Error(
        "User ID is required for transaction access."
      );
    }

    assertNetworkValue(
      network
    );

    return client
      .from(TABLE_NAME)
      .select("*")
      .eq(
        "userid",
        userid
      )
      .eq(
        "network",
        network
      );
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
      getCurrentNetwork();

    const client =
      getSupabaseClient();

    let query =
      createUserTransactionQuery(
        client,
        auth.user.userid,
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
          "Transaction ID is required."
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
     GET TRANSACTION BY TXID
     -------------------------------------------------------
     User-scoped by design.
  ======================================================= */

  async function getTransactionByTxid(txid){

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
      getCurrentNetwork();

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
     FIND TRANSACTION BY TXID
     -------------------------------------------------------
     Browser-safe compatibility API.
     It intentionally remains user-scoped.
     Unrestricted/global transaction verification belongs
     to the payment/backend boundary, not this user engine.
  ======================================================= */

  async function findTransactionByTxid(txid){

    return await getTransactionByTxid(
      txid
    );
  }


  /* =======================================================
     DUPLICATE TXID CHECK
  ======================================================= */

  async function transactionExistsByTxid(txid){

    const transaction =
      await getTransactionByTxid(
        txid
      );

    return !!transaction;
  }


  /* =======================================================
     RECORD TRANSACTION
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
      getCurrentNetwork();


    const canonicalProjectCode =
      await resolveProjectCode(
        project_code ||
        project
      );


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
     * Application-level duplicate protection.
     * Database-level unique constraints remain necessary
     * for race-condition protection.
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

          duplicate:
            true,

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

      const message =
        safeString(
          error.message
        );


      if(
        error.code === "23505" ||
        lower(message).includes(
          "duplicate"
        )
      ){

        return {

          error:
            "Transaction already exists.",

          duplicate:
            true

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
          error.code ||
          null,

        details:
          error.details ||
          null,

        hint:
          error.hint ||
          null

      };
    }


    return normalizeTransaction(
      data
    );
  }


  /* =======================================================
     RECORD PENDING
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
      getCurrentNetwork();


    const payload = {

      status:
        normalizedStatus,

      processed_at:
        normalizedStatus === STATUS.PAID
          ? new Date().toISOString()
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
     STATUS HELPERS
  ======================================================= */

  async function markTransactionPaid(id){

    return await updateTransactionStatus(
      id,
      STATUS.PAID
    );
  }


  async function markTransactionFailed(id){

    return await updateTransactionStatus(
      id,
      STATUS.FAILED
    );
  }


  /* =======================================================
     FILTER HELPERS
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


  async function getTxByType(
    type,
    options = {}
  ){

    return await getTransactions({

      ...options,

      type

    });
  }


  async function getTxByStatus(
    status,
    options = {}
  ){

    return await getTransactions({

      ...options,

      status

    });
  }


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
     USER TOTALS
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

        if(
          transaction.status !==
          STATUS.PAID
        ){
          return;
        }


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
        getCurrentNetwork(),

      totalTransactions:
        transactions.length,

      totalCapital,

      totalRewards,

      totalWithdrawals,

      totalFees

    };
  }


  /* =======================================================
     PROJECT TOTALS
  ======================================================= */

  async function getProjectTransactionTotals(
    projectCode
  ){

    const canonicalProjectCode =
      await resolveProjectCode(
        projectCode
      );


    const network =
      getCurrentNetwork();


    if(!canonicalProjectCode){

      return {

        network,

        project_code:
          "",

        project:
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

        if(
          transaction.status !==
          STATUS.PAID
        ){
          return;
        }


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

      network,

      project_code:
        canonicalProjectCode,

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
     ENGINE HEALTH
  ======================================================= */

  async function getTransactionEngineStatus(){

    let network = null;
    let networkError = null;

    let user = null;
    let userError = null;

    let supabaseReady = false;
    let supabaseError = null;


    try{

      network =
        getCurrentNetwork();

    }catch(error){

      networkError =
        error?.message ||
        "Network unavailable";

    }


    try{

      getSupabaseClient();

      supabaseReady =
        true;

    }catch(error){

      supabaseReady =
        false;

      supabaseError =
        error?.message ||
        "Supabase unavailable";

    }


    try{

      user =
        await getCurrentUser();

    }catch(error){

      userError =
        error?.message ||
        "Authentication unavailable";

    }


    const projectResolverReady =
      !!(
        window.ALBUKHR_PROJECT_RESOLVER ||
        typeof window.getProjectByCode ===
          "function" ||
        typeof window.getProjectMeta ===
          "function"
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

      supabase_error:
        supabaseError,

      authenticated:
        !!user,

      userid:
        user?.userid ||
        null,

      username:
        user?.username ||
        null,

      wallet:
        user?.wallet ||
        null,

      network:
        network,

      network_error:
        networkError,

      auth_error:
        userError,

      piAuthCore:
        typeof window.ensurePiAuth ===
          "function",

      projectResolver:
        projectResolverReady,

      localStorageTransactions:
        false,

      localStorageUserIdentity:
        false,

      networkIsolation:
        true,

      projectCodeFirst:
        true,

      supabaseFirst:
        true,

      userScoped:
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

    assertNetworkValue,

    normalizeType,

    normalizeStatus,

    normalizeProjectCode,


    getSupabaseClient,

    getSupabaseClientLegacy,

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


  /*
   * Compatibility namespace.
   */
  window.AlbukhrTransactionEngine =
    API;


  /* =======================================================
     LEGACY GLOBAL COMPATIBILITY
     -------------------------------------------------------
     These aliases are wrappers around the same canonical
     engine. They do not create another transaction system.
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


  /* =======================================================
     READY EVENT
  ======================================================= */

  try{

    window.dispatchEvent(
      new CustomEvent(
        "albukhrTransactionEngineReady",
        {
          detail: {
            name:
              ENGINE_NAME,

            version:
              ENGINE_VERSION
          }
        }
      )
    );

  }catch(_){

    /* Non-critical compatibility event. */

  }

})(window);
