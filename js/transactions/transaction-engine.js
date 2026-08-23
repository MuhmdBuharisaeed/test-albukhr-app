/* =========================================
   ALBUKHR TRANSACTION ENGINE v3
   UNIFIED / NETWORK-AWARE / SUPABASE
   SINGLE SOURCE OF TRUTH

   ARCHITECTURE:
   - js/core/supabase-core.js
   - js/transactions/transaction-engine.js

   PURPOSE:
   - Read unified transaction history from Supabase
   - Keep Mainnet/Testnet isolated
   - Preserve getAllTransactionsUnified() compatibility
   - Never use LocalStorage as transaction persistence
   - Prevent duplicate stake entries when aggregating sources
========================================= */

(function(){

  "use strict";

  const ENGINE_NAME = "ALBUKHR Transaction Engine";
  const ENGINE_VERSION = "3.0.0";

  /* =========================================
     SAFE HELPERS
  ========================================= */

  function safeString(value, fallback = ""){
    if(value === null || value === undefined){
      return fallback;
    }
    return String(value);
  }

  function safeNumber(value, fallback = 0){
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function safeArray(value){
    return Array.isArray(value) ? value : [];
  }

  function normalizeTimestamp(value){
    if(value === null || value === undefined || value === ""){
      return Date.now();
    }

    if(typeof value === "number"){
      return Number.isFinite(value) ? value : Date.now();
    }

    const numeric = Number(value);

    if(Number.isFinite(numeric)){
      return numeric;
    }

    const parsed = new Date(value).getTime();

    return Number.isFinite(parsed)
      ? parsed
      : Date.now();
  }

  function ensureCore(){
    if(
      typeof window.requireAlbukhrSupabaseClient !==
      "function"
    ){
      throw new Error(
        "ALBUKHR Supabase Core is not loaded. " +
        "Load js/core/supabase-core.js before " +
        "js/transactions/transaction-engine.js."
      );
    }

    if(
      typeof window.requireAlbukhrNetwork !==
      "function"
    ){
      throw new Error(
        "ALBUKHR Network Core is not loaded."
      );
    }
  }

  function getClient(){
    ensureCore();
    return window.requireAlbukhrSupabaseClient();
  }

  function getNetwork(){
    ensureCore();
    return window.requireAlbukhrNetwork();
  }

  /* =========================================
     TABLE CONFIGURATION

     The engine reads the existing unified
     `transactions` table first.

     Optional source tables can be supplied
     through configuration without changing
     the public API.
  ========================================== */

  const DEFAULT_CONFIG = {
    transactionsTable: "transactions",
    stakesTable: "stakes",
    externalStakesTable: "external_stakes"
  };

  let transactionConfig = {
    ...DEFAULT_CONFIG
  };

  function configureAlbukhrTransactionEngine(options = {}){
    transactionConfig = {
      ...transactionConfig,
      ...options
    };

    return {
      ...transactionConfig
    };
  }

  /* =========================================
     NORMALIZATION
  ========================================== */

  function normalizeTransaction(row, source = "core"){
    if(!row || typeof row !== "object"){
      return null;
    }

    const amount = safeNumber(
      row.amount,
      0
    );

    const project =
      safeString(
        row.project ||
        row.project_id ||
        row.project_code ||
        ""
      );

    const type =
      safeString(
        row.transaction_type ||
        row.type ||
        "transaction"
      ).toLowerCase();

    const status =
      safeString(
        row.status ||
        row.transaction_status ||
        "Successful"
      );

    const timestamp =
      normalizeTimestamp(
        row.timestamp ||
        row.created_at ||
        row.inserted_at ||
        row.updated_at
      );

    const paymentId =
      safeString(
        row.payment_id ||
        row.paymentId ||
        row.txid ||
        row.transaction_id ||
        ""
      );

    return {
      id:
        row.id ?? null,

      source,

      project,

      amount,

      type,

      status,

      timestamp,

      network:
        safeString(
          row.network ||
          ""
        ),

      payment_id:
        paymentId,

      txid:
        safeString(
          row.txid ||
          ""
        ),

      asset:
        safeString(
          row.asset ||
          "Pi"
        ),

      from_wallet:
        safeString(
          row.from_wallet ||
          ""
        ),

      to_wallet:
        safeString(
          row.to_wallet ||
          ""
        ),

      raw: row
    };
  }

  /* =========================================
     DUPLICATE KEY

     Payment/transaction identifiers are the
     strongest identity. Otherwise use a
     deterministic composite.
  ========================================== */

  function transactionIdentity(tx){
    if(!tx){
      return "";
    }

    const payment =
      safeString(
        tx.payment_id ||
        tx.txid
      ).trim();

    if(payment){
      return `payment:${payment}`;
    }

    const id =
      tx.id !== null &&
      tx.id !== undefined
        ? String(tx.id)
        : "";

    if(id){
      return `source:${tx.source}:id:${id}`;
    }

    return [
      safeString(tx.source),
      safeString(tx.project),
      safeString(tx.type),
      safeNumber(tx.amount),
      safeNumber(tx.timestamp)
    ].join("|");
  }

  function dedupeTransactions(transactions){
    const result = [];
    const seen = new Set();

    for(const tx of safeArray(transactions)){
      const key = transactionIdentity(tx);

      if(key && seen.has(key)){
        continue;
      }

      if(key){
        seen.add(key);
      }

      result.push(tx);
    }

    return result;
  }

  function sortTransactions(transactions){
    return [...safeArray(transactions)].sort(
      (a, b) =>
        normalizeTimestamp(b.timestamp) -
        normalizeTimestamp(a.timestamp)
    );
  }

  /* =========================================
     READ CORE TRANSACTIONS
  ========================================== */

  async function getCoreTransactions(options = {}){
    const client = getClient();
    const network = getNetwork();

    const limit =
      Number.isFinite(Number(options.limit))
        ? Math.max(1, Number(options.limit))
        : 500;

    let query =
      client
        .from(transactionConfig.transactionsTable)
        .select("*")
        .eq("network", network)
        .order("created_at", {
          ascending: false
        })
        .limit(limit);

    if(options.type){
      query = query.eq(
        "transaction_type",
        String(options.type)
      );
    }

    if(options.project){
      query = query.eq(
        "project",
        String(options.project)
      );
    }

    if(options.paymentId){
      query = query.eq(
        "payment_id",
        String(options.paymentId)
      );
    }

    const { data, error } =
      await query;

    if(error){
      throw new Error(
        error.message ||
        "Failed to load transactions."
      );
    }

    return safeArray(data).map(row =>
      normalizeTransaction(row, "core")
    ).filter(Boolean);
  }

  /* =========================================
     READ STAKES

     Stakes are converted into transaction
     records only when they are not already
     represented by a payment/transaction id.
  ========================================== */

  async function getStakeTransactions(options = {}){
    const client = getClient();
    const network = getNetwork();

    const limit =
      Number.isFinite(Number(options.limit))
        ? Math.max(1, Number(options.limit))
        : 500;

    let query =
      client
        .from(transactionConfig.stakesTable)
        .select("*")
        .eq("network", network)
        .order("created_at", {
          ascending: false
        })
        .limit(limit);

    if(options.project){
      query = query.eq(
        "project",
        String(options.project)
      );
    }

    if(options.status){
      query = query.eq(
        "status",
        String(options.status)
      );
    }else{
      /*
        Unified history should normally expose
        successful/paid stakes, not cancelled
        pending records.
      */
      query = query.in(
        "status",
        ["paid", "successful", "success", "completed", "Successful"]
      );
    }

    const { data, error } =
      await query;

    if(error){
      /*
        If the stakes table is unavailable,
        the unified transaction table remains
        authoritative. Do not crash the entire
        transaction history.
      */
      console.warn(
        "ALBUKHR stake source unavailable:",
        error.message || error
      );

      return [];
    }

    return safeArray(data)
      .map(row => {

        const tx = normalizeTransaction(
          {
            ...row,
            transaction_type:
              "stake",
            timestamp:
              row.created_at ||
              row.timestamp,
            payment_id:
              row.payment_id ||
              row.txid ||
              ""
          },
          "staking"
        );

        return tx;
      })
      .filter(Boolean);
  }

  /* =========================================
     READ EXTERNAL STAKES

     This table is optional. If it does not
     exist, return [] and continue safely.
  ========================================== */

  async function getExternalStakeTransactions(options = {}){
    const client = getClient();
    const network = getNetwork();

    const limit =
      Number.isFinite(Number(options.limit))
        ? Math.max(1, Number(options.limit))
        : 500;

    let query =
      client
        .from(transactionConfig.externalStakesTable)
        .select("*")
        .eq("network", network)
        .order("created_at", {
          ascending: false
        })
        .limit(limit);

    if(options.project){
      query = query.eq(
        "project_id",
        String(options.project)
      );
    }

    const { data, error } =
      await query;

    if(error){
      console.warn(
        "ALBUKHR external stake source unavailable:",
        error.message || error
      );

      return [];
    }

    return safeArray(data)
      .map(row =>
        normalizeTransaction(
          {
            ...row,
            project:
              row.project ||
              row.project_id,
            transaction_type:
              "stake",
            timestamp:
              row.created_at ||
              row.timestamp,
            payment_id:
              row.payment_id ||
              row.txid ||
              ""
          },
          "external"
        )
      )
      .filter(Boolean);
  }

  /* =========================================
     UNIFIED TRANSACTION HISTORY

     Public compatibility API:
       getAllTransactionsUnified()

     No LocalStorage.
     Current network is always enforced.
  ========================================== */

  async function getAllTransactionsUnified(options = {}){
    const network = getNetwork();

    const [
      core,
      stakes,
      external
    ] = await Promise.all([
      getCoreTransactions(options),
      getStakeTransactions(options),
      getExternalStakeTransactions(options)
    ]);

    /*
      The transactions table is the canonical
      source for transaction history.

      Therefore stake rows already represented
      by a payment_id/txid are removed from the
      secondary stake sources.
    */
    const corePaymentKeys = new Set();

    core.forEach(tx => {
      const payment =
        safeString(
          tx.payment_id ||
          tx.txid
        ).trim();

      if(payment){
        corePaymentKeys.add(
          `payment:${payment}`
        );
      }
    });

    const secondary =
      [...stakes, ...external]
        .filter(tx => {

          if(
            tx.network &&
            tx.network !== network
          ){
            return false;
          }

          const payment =
            safeString(
              tx.payment_id ||
              tx.txid
            ).trim();

          if(
            payment &&
            corePaymentKeys.has(
              `payment:${payment}`
            )
          ){
            return false;
          }

          return true;
        });

    return sortTransactions(
      dedupeTransactions([
        ...core,
        ...secondary
      ])
    );
  }

  /* =========================================
     FILTERED HISTORY
  ========================================== */

  async function getTransactionsUnified(options = {}){
    return getAllTransactionsUnified(
      options
    );
  }

  async function getUserTransactionsUnified(
    userid,
    options = {}
  ){
    if(!userid){
      return [];
    }

    const client = getClient();
    const network = getNetwork();

    const limit =
      Number.isFinite(Number(options.limit))
        ? Math.max(1, Number(options.limit))
        : 500;

    const { data, error } =
      await client
        .from(transactionConfig.transactionsTable)
        .select("*")
        .eq("network", network)
        .eq("from_wallet", String(userid))
        .order("created_at", {
          ascending: false
        })
        .limit(limit);

    if(error){
      throw new Error(
        error.message ||
        "Failed to load user transactions."
      );
    }

    return sortTransactions(
      safeArray(data)
        .map(row =>
          normalizeTransaction(row, "core")
        )
        .filter(Boolean)
    );
  }

  /* =========================================
     SUMMARY
  ========================================== */

  async function getTransactionSummary(options = {}){
    const transactions =
      await getAllTransactionsUnified(
        options
      );

    const summary = {
      network: getNetwork(),
      count: transactions.length,
      totalAmount: 0,
      stakes: 0,
      payments: 0,
      successful: 0,
      pending: 0,
      failed: 0
    };

    transactions.forEach(tx => {
      const amount =
        safeNumber(tx.amount);

      summary.totalAmount += amount;

      if(tx.type === "stake"){
        summary.stakes += amount;
      }else{
        summary.payments += amount;
      }

      const status =
        safeString(
          tx.status
        ).toLowerCase();

      if(
        ["successful","success","paid","completed"]
          .includes(status)
      ){
        summary.successful++;
      }else if(status === "pending"){
        summary.pending++;
      }else if(
        ["failed","cancelled","canceled","error"]
          .includes(status)
      ){
        summary.failed++;
      }
    });

    return summary;
  }

  /* =========================================
     HEALTH
  ========================================== */

  function albukhrTransactionEngineHealth(){
    let network = null;
    let error = null;

    try{
      network = getNetwork();
    }catch(e){
      error =
        e?.message ||
        "Network unavailable";
    }

    return {
      ready:
        !error &&
        typeof window.requireAlbukhrSupabaseClient ===
          "function",

      engine:
        ENGINE_NAME,

      version:
        ENGINE_VERSION,

      network,

      network_ready:
        !!network,

      transactions_table:
        transactionConfig.transactionsTable,

      stakes_table:
        transactionConfig.stakesTable,

      external_stakes_table:
        transactionConfig.externalStakesTable,

      error
    };
  }

  /* =========================================
     GLOBAL EXPORTS
  ========================================== */

  window.getAllTransactionsUnified =
    getAllTransactionsUnified;

  window.getTransactionsUnified =
    getTransactionsUnified;

  window.getUserTransactionsUnified =
    getUserTransactionsUnified;

  window.getTransactionSummary =
    getTransactionSummary;

  window.configureAlbukhrTransactionEngine =
    configureAlbukhrTransactionEngine;

  window.albukhrTransactionEngineHealth =
    albukhrTransactionEngineHealth;

  /* =========================================
     DEBUG
  ========================================== */

  try{
    console.log(
      `${ENGINE_NAME} v${ENGINE_VERSION} ready — ` +
      `${getNetwork().toUpperCase()}`
    );
  }catch(e){
    console.warn(
      `${ENGINE_NAME} initialization warning:`,
      e?.message || e
    );
  }

})();
