/* =========================================
   ALBUKHR TRANSACTION ENGINE v4
   UNIFIED / NETWORK-AWARE / SUPABASE
   SINGLE SOURCE OF TRUTH

   FILE:
   js/transactions/transaction-engine.js

   FOUNDATION:
   - js/core/environment-switcher.js
   - js/core/supabase-core.js
   - js/core/pi-auth-core.js
   - js/core/pi-payment.js
   - js/core/pi-project-treasury-payment.js

   RULES:
   - Supabase is the source of truth.
   - No LocalStorage transaction persistence.
   - Shared environment resolver is authoritative.
   - Every network-sensitive query is isolated.
   - No second Supabase client or credentials.
   - Payment creation belongs to payment/backend engines.
   - Existing public APIs are preserved.
========================================= */

(function () {
  "use strict";

  const ENGINE_NAME = "ALBUKHR Transaction Engine";
  const ENGINE_VERSION = "4.0.0";

  const DEFAULT_CONFIG = Object.freeze({
    transactionsTable: "transactions",
    stakesTable: "stakes",
    externalStakesTable: "external_stakes"
  });

  let transactionConfig = { ...DEFAULT_CONFIG };

  /* =========================================
     SAFE HELPERS
  ========================================== */

  function safeString(value, fallback = "") {
    if (value === null || value === undefined) return fallback;
    return String(value);
  }

  function safeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizeTimestamp(value) {
    if (value === null || value === undefined || value === "") {
      return Date.now();
    }

    if (value instanceof Date) {
      const parsed = value.getTime();
      return Number.isFinite(parsed) ? parsed : Date.now();
    }

    if (typeof value === "number") {
      return Number.isFinite(value) ? value : Date.now();
    }

    const numeric = Number(value);

    if (Number.isFinite(numeric)) {
      /*
       * Accept both Unix seconds and JavaScript milliseconds.
       */
      if (numeric > 0 && numeric < 100000000000) {
        return numeric * 1000;
      }

      return numeric;
    }

    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : Date.now();
  }

  function normalizeLimit(value, fallback = 500) {
    const number = Number(value);

    if (!Number.isFinite(number)) return fallback;

    return Math.min(
      Math.max(1, Math.floor(number)),
      5000
    );
  }

  /* =========================================
     FOUNDATION
  ========================================== */

  function ensureCore() {
    if (
      typeof window.requireAlbukhrSupabaseClient !== "function"
    ) {
      throw new Error(
        "ALBUKHR Supabase Core is not loaded. Load js/core/supabase-core.js before js/transactions/transaction-engine.js."
      );
    }

    if (
      typeof window.requireAlbukhrNetwork !== "function"
    ) {
      throw new Error(
        "ALBUKHR Network Core is not loaded. Load js/core/environment-switcher.js before js/transactions/transaction-engine.js."
      );
    }
  }

  function getClient() {
    ensureCore();
    return window.requireAlbukhrSupabaseClient();
  }

  function getNetwork() {
    ensureCore();

    const network = window.requireAlbukhrNetwork();

    if (network !== "mainnet" && network !== "testnet") {
      throw new Error(
        "ALBUKHR: transaction operation refused because network is invalid."
      );
    }

    return network;
  }

  /* =========================================
     CONFIGURATION
  ========================================== */

  function configureAlbukhrTransactionEngine(options = {}) {
    if (
      !options ||
      typeof options !== "object" ||
      Array.isArray(options)
    ) {
      throw new Error(
        "Transaction engine configuration must be an object."
      );
    }

    const next = { ...transactionConfig };

    if (options.transactionsTable) {
      next.transactionsTable =
        safeString(options.transactionsTable).trim();
    }

    if (options.stakesTable) {
      next.stakesTable =
        safeString(options.stakesTable).trim();
    }

    if (options.externalStakesTable) {
      next.externalStakesTable =
        safeString(options.externalStakesTable).trim();
    }

    for (const [key, value] of Object.entries(next)) {
      if (!value) {
        throw new Error(
          `ALBUKHR: invalid transaction table configuration for ${key}.`
        );
      }
    }

    transactionConfig = next;
    return { ...transactionConfig };
  }

  function getAlbukhrTransactionEngineConfig() {
    return { ...transactionConfig };
  }

  /* =========================================
     NORMALIZATION
  ========================================== */

  function normalizeTransaction(row, source = "core") {
    if (!row || typeof row !== "object") return null;

    const amount = safeNumber(row.amount, 0);

    const project = safeString(
      row.project ||
      row.project_id ||
      row.project_code ||
      ""
    ).trim();

    const type = safeString(
      row.transaction_type ||
      row.type ||
      "transaction"
    ).trim().toLowerCase();

    const status = safeString(
      row.status ||
      row.transaction_status ||
      "Successful"
    ).trim();

    const timestamp = normalizeTimestamp(
      row.timestamp ||
      row.created_at ||
      row.inserted_at ||
      row.updated_at
    );

    const paymentId = safeString(
      row.payment_id ||
      row.paymentId ||
      row.txid ||
      row.transaction_id ||
      ""
    ).trim();

    const network = safeString(
      row.network || ""
    ).trim().toLowerCase();

    return {
      id: row.id ?? null,
      source,
      project,
      amount,
      type,
      status,
      timestamp,
      network,
      payment_id: paymentId,
      txid: safeString(row.txid || "").trim(),
      asset: safeString(row.asset || "Pi").trim() || "Pi",
      from_wallet: safeString(row.from_wallet || "").trim(),
      to_wallet: safeString(row.to_wallet || "").trim(),
      raw: row
    };
  }

  /* =========================================
     DEDUPLICATION
  ========================================== */

  function transactionIdentity(tx, network) {
    if (!tx) return "";

    const currentNetwork =
      safeString(tx.network || network).trim().toLowerCase();

    const payment = safeString(
      tx.payment_id || tx.txid
    ).trim();

    if (payment) {
      return `payment:${currentNetwork}:${payment}`;
    }

    const id =
      tx.id !== null && tx.id !== undefined
        ? String(tx.id)
        : "";

    if (id) {
      return [
        "source",
        currentNetwork,
        safeString(tx.source),
        "id",
        id
      ].join(":");
    }

    return [
      "fingerprint",
      currentNetwork,
      safeString(tx.source),
      safeString(tx.project),
      safeString(tx.type),
      safeNumber(tx.amount),
      safeNumber(tx.timestamp)
    ].join("|");
  }

  function dedupeTransactions(transactions, network) {
    const result = [];
    const seen = new Set();

    for (const tx of safeArray(transactions)) {
      if (!tx) continue;

      const key = transactionIdentity(tx, network);

      if (key && seen.has(key)) continue;

      if (key) seen.add(key);

      result.push(tx);
    }

    return result;
  }

  function sortTransactions(transactions) {
    return [...safeArray(transactions)].sort(
      (a, b) =>
        normalizeTimestamp(b?.timestamp) -
        normalizeTimestamp(a?.timestamp)
    );
  }

  function enforceCurrentNetwork(transactions, network) {
    return safeArray(transactions).filter(
      tx => !tx?.network || tx.network === network
    );
  }

  /* =========================================
     CORE TRANSACTIONS
  ========================================== */

  async function getCoreTransactions(options = {}) {
    const client = getClient();
    const network = getNetwork();
    const limit = normalizeLimit(options.limit);

    let query = client
      .from(transactionConfig.transactionsTable)
      .select("*")
      .eq("network", network)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (options.type !== undefined) {
      query = query.eq(
        "transaction_type",
        String(options.type)
      );
    }

    if (options.project !== undefined) {
      query = query.eq(
        "project",
        String(options.project)
      );
    }

    if (options.paymentId !== undefined) {
      query = query.eq(
        "payment_id",
        String(options.paymentId)
      );
    }

    if (options.status !== undefined) {
      query = query.eq(
        "status",
        String(options.status)
      );
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(
        error.message || "Failed to load transactions."
      );
    }

    return enforceCurrentNetwork(
      safeArray(data)
        .map(row => normalizeTransaction(row, "core"))
        .filter(Boolean),
      network
    );
  }

  /* =========================================
     STAKES
  ========================================== */

  async function getStakeTransactions(options = {}) {
    const client = getClient();
    const network = getNetwork();
    const limit = normalizeLimit(options.limit);

    let query = client
      .from(transactionConfig.stakesTable)
      .select("*")
      .eq("network", network)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (options.project !== undefined) {
      query = query.eq(
        "project",
        String(options.project)
      );
    }

    if (options.status !== undefined) {
      query = query.eq(
        "status",
        String(options.status)
      );
    } else {
      query = query.in(
        "status",
        [
          "paid",
          "successful",
          "success",
          "completed",
          "Successful"
        ]
      );
    }

    const { data, error } = await query;

    if (error) {
      /*
       * Stakes are secondary. The canonical transactions
       * table remains usable if this table is unavailable.
       */
      console.warn(
        "ALBUKHR stake source unavailable:",
        error.message || error
      );
      return [];
    }

    return enforceCurrentNetwork(
      safeArray(data)
        .map(row =>
          normalizeTransaction(
            {
              ...row,
              transaction_type: "stake",
              timestamp:
                row.created_at ||
                row.timestamp,
              payment_id:
                row.payment_id ||
                row.txid ||
                ""
            },
            "staking"
          )
        )
        .filter(Boolean),
      network
    );
  }

  /* =========================================
     EXTERNAL STAKES
  ========================================== */

  async function getExternalStakeTransactions(options = {}) {
    const client = getClient();
    const network = getNetwork();
    const limit = normalizeLimit(options.limit);

    let query = client
      .from(transactionConfig.externalStakesTable)
      .select("*")
      .eq("network", network)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (options.project !== undefined) {
      query = query.eq(
        "project_id",
        String(options.project)
      );
    }

    if (options.status !== undefined) {
      query = query.eq(
        "status",
        String(options.status)
      );
    }

    const { data, error } = await query;

    if (error) {
      console.warn(
        "ALBUKHR external stake source unavailable:",
        error.message || error
      );
      return [];
    }

    return enforceCurrentNetwork(
      safeArray(data)
        .map(row =>
          normalizeTransaction(
            {
              ...row,
              project:
                row.project ||
                row.project_id,
              transaction_type: "stake",
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
        .filter(Boolean),
      network
    );
  }

  /* =========================================
     UNIFIED HISTORY
  ========================================== */

  async function getAllTransactionsUnified(options = {}) {
    const network = getNetwork();

    const [core, stakes, external] =
      await Promise.all([
        getCoreTransactions(options),
        getStakeTransactions(options),
        getExternalStakeTransactions(options)
      ]);

    /*
     * Canonical transaction records win.
     * Secondary records with the same payment/txid
     * are not added a second time.
     */
    const corePaymentKeys = new Set();

    for (const tx of core) {
      const payment = safeString(
        tx.payment_id || tx.txid
      ).trim();

      if (payment) {
        corePaymentKeys.add(
          `payment:${network}:${payment}`
        );
      }
    }

    const secondary = [...stakes, ...external].filter(tx => {
      if (
        tx?.network &&
        tx.network !== network
      ) {
        return false;
      }

      const payment = safeString(
        tx?.payment_id || tx?.txid
      ).trim();

      if (
        payment &&
        corePaymentKeys.has(
          `payment:${network}:${payment}`
        )
      ) {
        return false;
      }

      return true;
    });

    return sortTransactions(
      dedupeTransactions(
        [...core, ...secondary],
        network
      )
    );
  }

  async function getTransactionsUnified(options = {}) {
    return getAllTransactionsUnified(options);
  }

  /* =========================================
     USER HISTORY
  ========================================== */

  async function getUserTransactionsUnified(
    userid,
    options = {}
  ) {
    const requestedUser =
      userid ||
      options.userId ||
      options.wallet ||
      options.fromWallet;

    if (!requestedUser) return [];

    const client = getClient();
    const network = getNetwork();
    const limit = normalizeLimit(options.limit);

    let query = client
      .from(transactionConfig.transactionsTable)
      .select("*")
      .eq("network", network)
      .eq("from_wallet", String(requestedUser))
      .order("created_at", { ascending: false })
      .limit(limit);

    if (options.type !== undefined) {
      query = query.eq(
        "transaction_type",
        String(options.type)
      );
    }

    if (options.project !== undefined) {
      query = query.eq(
        "project",
        String(options.project)
      );
    }

    if (options.status !== undefined) {
      query = query.eq(
        "status",
        String(options.status)
      );
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(
        error.message ||
        "Failed to load user transactions."
      );
    }

    return sortTransactions(
      enforceCurrentNetwork(
        safeArray(data)
          .map(row =>
            normalizeTransaction(row, "core")
          )
          .filter(Boolean),
        network
      )
    );
  }

  /* =========================================
     SINGLE TRANSACTION
  ========================================== */

  async function getTransactionByPaymentId(paymentId) {
    const normalized =
      safeString(paymentId).trim();

    if (!normalized) return null;

    const client = getClient();
    const network = getNetwork();

    const { data, error } = await client
      .from(transactionConfig.transactionsTable)
      .select("*")
      .eq("network", network)
      .eq("payment_id", normalized)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(
        error.message ||
        "Failed to load transaction."
      );
    }

    if (!data) return null;

    return normalizeTransaction(data, "core");
  }

  /* =========================================
     SUMMARY
  ========================================== */

  async function getTransactionSummary(options = {}) {
    const transactions =
      await getAllTransactionsUnified(options);

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

    for (const tx of transactions) {
      const amount = safeNumber(tx.amount);

      summary.totalAmount += amount;

      if (tx.type === "stake") {
        summary.stakes += amount;
      } else {
        summary.payments += amount;
      }

      const status = safeString(tx.status)
        .trim()
        .toLowerCase();

      if (
        [
          "successful",
          "success",
          "paid",
          "completed"
        ].includes(status)
      ) {
        summary.successful++;
      } else if (status === "pending") {
        summary.pending++;
      } else if (
        [
          "failed",
          "cancelled",
          "canceled",
          "error"
        ].includes(status)
      ) {
        summary.failed++;
      }
    }

    return summary;
  }

  /* =========================================
     HEALTH
  ========================================== */

  function albukhrTransactionEngineHealth() {
    let network = null;
    let error = null;

    try {
      network = getNetwork();
    } catch (e) {
      error =
        e?.message ||
        "Network unavailable";
    }

    let supabaseReady = false;

    if (
      typeof window.requireAlbukhrSupabaseClient ===
      "function"
    ) {
      try {
        supabaseReady =
          !!window.requireAlbukhrSupabaseClient();
      } catch (_) {
        supabaseReady = false;
      }
    }

    return {
      ready:
        !error &&
        supabaseReady,

      engine: ENGINE_NAME,
      version: ENGINE_VERSION,
      network,
      network_ready: !!network,
      supabase_core_ready:
        typeof window.requireAlbukhrSupabaseClient ===
        "function",

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

  window.getTransactionByPaymentId =
    getTransactionByPaymentId;

  window.configureAlbukhrTransactionEngine =
    configureAlbukhrTransactionEngine;

  window.getAlbukhrTransactionEngineConfig =
    getAlbukhrTransactionEngineConfig;

  window.albukhrTransactionEngineHealth =
    albukhrTransactionEngineHealth;

  window.AlbukhrTransactionEngine =
    Object.freeze({
      getAllTransactionsUnified,
      getTransactionsUnified,
      getUserTransactionsUnified,
      getTransactionSummary,
      getTransactionByPaymentId,
      configureAlbukhrTransactionEngine,
      getAlbukhrTransactionEngineConfig,
      health:
        albukhrTransactionEngineHealth
    });

  /* =========================================
     DEBUG
  ========================================== */

  try {
    console.log(
      `${ENGINE_NAME} v${ENGINE_VERSION} ready — ` +
      `${getNetwork().toUpperCase()}`
    );
  } catch (e) {
    console.warn(
      `${ENGINE_NAME} initialization warning:`,
      e?.message || e
    );
  }

})();
