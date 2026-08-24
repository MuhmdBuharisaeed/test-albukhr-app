/* =========================================================
   ALBUKHR ECOSYSTEM TREASURY ENGINE v3
   Supabase-First • Network-Isolated • Foundation-Driven
   Compatibility-Safe • No LocalStorage
========================================================= */

(function (window) {
  "use strict";

  const AlbukhrEcosystemTreasury = {};
  window.AlbukhrEcosystemTreasury = AlbukhrEcosystemTreasury;

  /* =======================================================
     CONFIG
  ======================================================= */

  const CONFIG = Object.freeze({
    TABLE: "ecosystem_treasury",
    TX_TABLE: "ecosystem_treasury_transactions",
    TREASURY_CODE: "ALBUKHR_MAIN",
    DEFAULT_TREASURY_NAME: "ALBUKHR Ecosystem Treasury",
    DEFAULT_STATUS: "active",
    DEFAULT_WALLET_SOURCE: "pi_testnet_admin_wallet"
  });

  /*
    IMPORTANT:
    DEFAULT_WALLET_SOURCE is retained for database compatibility only.
    This engine does NOT infer the active network from this value.
    The active network comes from js/core/environment-switcher.js.
  */

  const UPDATE_FIELDS = Object.freeze([
    "treasury_name",
    "wallet_balance",
    "available_liquidity",
    "locked_liquidity",
    "pending_requests_total",
    "approved_outflow_total",
    "total_inflow",
    "total_outflow",
    "treasury_status",
    "wallet_source",
    "last_wallet_sync_at",
    "last_activity_at",
    "notes",
    "meta",
    "updated_at"
  ]);

  /* =======================================================
     FOUNDATION DEPENDENCIES
     Canonical foundations:
       js/core/environment-switcher.js
       js/core/pi-auth-core.js
       js/core/pi-payment.js
       js/core/pi-project-treasury-payment.js
       js/core/supabase-core.js

     This domain engine does not create a Supabase client,
     does not persist auth/network state, and does not use
     LocalStorage as a source of truth.
  ======================================================= */

  function getClient() {
    if (typeof window.getSupabaseClient !== "function") {
      return null;
    }

    try {
      const client = window.getSupabaseClient();
      return client || null;
    } catch (_) {
      return null;
    }
  }

  function requireClient() {
    const client = getClient();

    if (!client) {
      throw new Error(
        "Supabase client unavailable. Load js/core/supabase-core.js first."
      );
    }

    return client;
  }

  /* =======================================================
     NETWORK
     The environment foundation is the network source of truth.

     SECURITY RULE:
     Never silently fall back to testnet. An unknown network
     must stop the operation rather than risk cross-network
     reads/writes.
  ======================================================= */

  function resolveFoundationNetwork() {
    try {
      if (
        window.AlbukhrEnvironment &&
        typeof window.AlbukhrEnvironment.getNetwork === "function"
      ) {
        const value = window.AlbukhrEnvironment.getNetwork();
        if (value !== null && value !== undefined && value !== "") {
          return String(value).trim().toLowerCase();
        }
      }

      if (typeof window.getCurrentNetwork === "function") {
        const value = window.getCurrentNetwork();
        if (value !== null && value !== undefined && value !== "") {
          return String(value).trim().toLowerCase();
        }
      }

      return "";
    } catch (_) {
      return "";
    }
  }

  function networkValue() {
    const network = resolveFoundationNetwork();

    if (network !== "mainnet" && network !== "testnet") {
      throw new Error(
        "Active ALBUKHR network is unavailable. Load js/core/environment-switcher.js first."
      );
    }

    return network;
  }

  function getCurrentNetworkSafe() {
    try {
      return networkValue();
    } catch (_) {
      return null;
    }
  }

  function requireNetwork() {
    return networkValue();
  }

  /* =======================================================
     SAFE HELPERS
  ======================================================= */

  function safeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function safeString(value, fallback = "") {
    if (value === null || value === undefined) return fallback;
    return String(value);
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function buildNetworkPayload(payload = {}) {
    return {
      ...payload,
      network: requireNetwork()
    };
  }

  function pickUpdateFields(patch = {}) {
    const output = {};

    UPDATE_FIELDS.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(patch, field)) {
        output[field] = patch[field];
      }
    });

    return output;
  }

  /* =======================================================
     DEPENDENCIES
  ======================================================= */

  function assertCoreDependencies() {
    if (typeof window.getSupabaseClient !== "function") {
      throw new Error(
        "js/core/supabase-core.js must be loaded before ecosystem-treasury-engine.js"
      );
    }

    if (
      !window.AlbukhrEnvironment &&
      typeof window.getCurrentNetwork !== "function"
    ) {
      throw new Error(
        "js/core/environment-switcher.js must be loaded before ecosystem-treasury-engine.js"
      );
    }

    requireNetwork();
    requireClient();
  }

  function assertProjectTreasuryDependencies() {
    assertCoreDependencies();

    if (typeof window.getProjectMeta !== "function") {
      throw new Error(
        "projects-engine.js must be loaded before ecosystem-treasury-engine.js"
      );
    }

    if (typeof window.addProjectLiquidity !== "function") {
      throw new Error(
        "project-treasury.js must be loaded before ecosystem-treasury-engine.js"
      );
    }
  }

  /* =======================================================
     NORMALIZATION
  ======================================================= */

  function normalizeTreasuryRow(row = {}) {
    return {
      id: row.id ?? null,
      network: safeString(row.network, getCurrentNetworkSafe() || ""),

      treasury_code: safeString(
        row.treasury_code,
        CONFIG.TREASURY_CODE
      ),

      treasury_name: safeString(
        row.treasury_name,
        CONFIG.DEFAULT_TREASURY_NAME
      ),

      wallet_balance: safeNumber(row.wallet_balance),
      available_liquidity: safeNumber(row.available_liquidity),
      locked_liquidity: safeNumber(row.locked_liquidity),

      pending_requests_total: safeNumber(row.pending_requests_total),
      approved_outflow_total: safeNumber(row.approved_outflow_total),
      total_inflow: safeNumber(row.total_inflow),
      total_outflow: safeNumber(row.total_outflow),

      treasury_status: safeString(
        row.treasury_status,
        CONFIG.DEFAULT_STATUS
      ),

      wallet_source: safeString(
        row.wallet_source,
        CONFIG.DEFAULT_WALLET_SOURCE
      ),

      last_wallet_sync_at: row.last_wallet_sync_at || null,
      last_activity_at: row.last_activity_at || null,
      created_at: row.created_at || null,
      updated_at: row.updated_at || null,

      notes: safeString(row.notes),
      meta: row.meta && typeof row.meta === "object" ? row.meta : {},
      raw: row
    };
  }

  function normalizeTxRow(row = {}) {
    return {
      id: row.id ?? null,
      network: safeString(row.network, getCurrentNetworkSafe() || ""),

      treasury_code: safeString(
        row.treasury_code,
        CONFIG.TREASURY_CODE
      ),

      tx_type: safeString(row.tx_type),

      amount: safeNumber(row.amount),
      balance_before: safeNumber(row.balance_before),
      balance_after: safeNumber(row.balance_after),

      liquidity_before: safeNumber(row.liquidity_before),
      liquidity_after: safeNumber(row.liquidity_after),

      related_project_code: safeString(row.related_project_code),
      related_project_name: safeString(row.related_project_name),
      related_request_id: safeString(row.related_request_id),

      actor_userid: safeString(row.actor_userid),
      actor_username: safeString(row.actor_username),
      note: safeString(row.note),

      meta: row.meta && typeof row.meta === "object" ? row.meta : {},
      created_at: row.created_at || null,
      raw: row
    };
  }

  /* =======================================================
     FETCH
  ======================================================= */

  async function fetchTreasuryRow() {
    try {
      assertCoreDependencies();

      const supabase = requireClient();
      const network = requireNetwork();

      const { data, error } = await supabase
        .from(CONFIG.TABLE)
        .select("*")
        .eq("treasury_code", CONFIG.TREASURY_CODE)
        .eq("network", network)
        .maybeSingle();

      if (error) {
        return {
          error: error.message || "Failed to fetch ecosystem treasury"
        };
      }

      return {
        success: true,
        network,
        data: data ? normalizeTreasuryRow(data) : null
      };
    } catch (error) {
      return {
        error:
          error?.message ||
          "Ecosystem treasury fetch failed"
      };
    }
  }

  /* =======================================================
     ENSURE
  ======================================================= */

  async function ensureTreasury() {
    const existing = await fetchTreasuryRow();

    if (existing.error) return { error: existing.error };

    if (existing.data) {
      return {
        success: true,
        network: existing.network,
        data: existing.data
      };
    }

    try {
      const supabase = requireClient();
      const network = requireNetwork();
      const timestamp = nowISO();

      const payload = buildNetworkPayload({
        treasury_code: CONFIG.TREASURY_CODE,
        treasury_name: CONFIG.DEFAULT_TREASURY_NAME,

        wallet_balance: 0,
        available_liquidity: 0,
        locked_liquidity: 0,

        pending_requests_total: 0,
        approved_outflow_total: 0,
        total_inflow: 0,
        total_outflow: 0,

        treasury_status: CONFIG.DEFAULT_STATUS,
        wallet_source: CONFIG.DEFAULT_WALLET_SOURCE,

        last_wallet_sync_at: timestamp,
        last_activity_at: timestamp,

        notes: "Auto-created ecosystem treasury row",
        meta: {
          auto_created: true,
          engine: "ecosystem-treasury-engine",
          network
        }
      });

      const { data, error } = await supabase
        .from(CONFIG.TABLE)
        .insert(payload)
        .select()
        .single();

      if (error) {
        /*
          If another caller created the same network row between
          fetch() and insert(), re-read it instead of reporting a
          false failure.
        */
        const retry = await fetchTreasuryRow();

        if (!retry.error && retry.data) {
          return {
            success: true,
            network,
            data: retry.data
          };
        }

        return {
          error:
            error.message ||
            "Failed to create ecosystem treasury"
        };
      }

      return {
        success: true,
        network,
        data: normalizeTreasuryRow(data)
      };
    } catch (error) {
      return {
        error:
          error?.message ||
          "Ecosystem treasury create failed"
      };
    }
  }

  /* =======================================================
     PUBLIC GET
  ======================================================= */

  async function getEcosystemTreasury() {
    const result = await ensureTreasury();

    return result.error
      ? { error: result.error }
      : result.data;
  }

  /* =======================================================
     UPDATE
     Protected fields (network / treasury_code) cannot be
     overwritten by callers.
  ======================================================= */

  async function updateEcosystemTreasury(patch = {}) {
    try {
      assertCoreDependencies();

      const supabase = requireClient();
      const network = requireNetwork();
      const safePatch = pickUpdateFields(patch);

      if (Object.keys(safePatch).length === 0) {
        return {
          error: "No valid ecosystem treasury fields supplied for update"
        };
      }

      safePatch.updated_at = nowISO();

      const { data, error } = await supabase
        .from(CONFIG.TABLE)
        .update(safePatch)
        .eq("treasury_code", CONFIG.TREASURY_CODE)
        .eq("network", network)
        .select()
        .single();

      if (error) {
        return {
          error:
            error.message ||
            "Failed to update ecosystem treasury"
        };
      }

      return {
        success: true,
        network,
        data: normalizeTreasuryRow(data)
      };
    } catch (error) {
      return {
        error:
          error?.message ||
          "Ecosystem treasury update failed"
      };
    }
  }

  /* =======================================================
     LEDGER INSERT
  ======================================================= */

  async function insertEcosystemTreasuryTransaction(options = {}) {
    try {
      assertCoreDependencies();

      const supabase = requireClient();

      const payload = buildNetworkPayload({
        treasury_code: CONFIG.TREASURY_CODE,
        tx_type: safeString(options.tx_type),

        amount: safeNumber(options.amount),
        balance_before: safeNumber(options.balance_before),
        balance_after: safeNumber(options.balance_after),

        liquidity_before: safeNumber(options.liquidity_before),
        liquidity_after: safeNumber(options.liquidity_after),

        related_project_code: safeString(options.related_project_code),
        related_project_name: safeString(options.related_project_name),
        related_request_id: safeString(options.related_request_id),

        actor_userid: safeString(options.actor_userid),
        actor_username: safeString(options.actor_username),
        note: safeString(options.note),

        meta:
          options.meta && typeof options.meta === "object"
            ? options.meta
            : {},

        created_at: nowISO()
      });

      const { data, error } = await supabase
        .from(CONFIG.TX_TABLE)
        .insert(payload)
        .select()
        .single();

      if (error) {
        return {
          error:
            error.message ||
            "Failed to insert ecosystem treasury transaction"
        };
      }

      return {
        success: true,
        network: payload.network,
        data: normalizeTxRow(data)
      };
    } catch (error) {
      return {
        error:
          error?.message ||
          "Ecosystem treasury transaction insert failed"
      };
    }
  }

  /* =======================================================
     WALLET SYNC
  ======================================================= */

  async function syncEcosystemWalletBalance(balance, meta = {}) {
    try {
      assertCoreDependencies();

      balance = safeNumber(balance, -1);

      if (balance < 0) {
        return { error: "Invalid wallet balance" };
      }

      const treasury = await getEcosystemTreasury();

      if (treasury?.error) return { error: treasury.error };

      const network = requireNetwork();

      const walletBefore = safeNumber(treasury.wallet_balance);
      const availableBefore = safeNumber(
        treasury.available_liquidity
      );
      const locked = safeNumber(treasury.locked_liquidity);

      const availableAfter = Math.max(0, balance - locked);

      const updated = await updateEcosystemTreasury({
        wallet_balance: balance,
        available_liquidity: availableAfter,
        last_wallet_sync_at: nowISO(),
        last_activity_at: nowISO(),
        treasury_status:
          treasury.treasury_status || CONFIG.DEFAULT_STATUS,
        notes: meta.note || treasury.notes || ""
      });

      if (updated.error) return { error: updated.error };

      const tx = await insertEcosystemTreasuryTransaction({
        tx_type: "wallet_sync",
        amount: balance,
        balance_before: walletBefore,
        balance_after: balance,
        liquidity_before: availableBefore,
        liquidity_after: availableAfter,
        actor_userid: meta.actor_userid,
        actor_username: meta.actor_username,
        note: meta.note || "Wallet balance synced",
        meta: {
          ...(meta.meta || {}),
          sync_type: "wallet_balance_sync",
          locked_liquidity: locked
        }
      });

      if (tx.error) {
        console.warn(
          "Ecosystem wallet sync ledger warning:",
          tx.error
        );
      }

      return {
        success: true,
        action: "wallet_sync",
        network,
        wallet_balance: balance,
        available_liquidity: availableAfter,
        treasury: updated.data,
        transaction: tx.data || null
      };
    } catch (error) {
      return {
        error:
          error?.message ||
          "Ecosystem wallet sync failed"
      };
    }
  }

  /* =======================================================
     CREDIT
  ======================================================= */

  async function creditEcosystemTreasury(amount, meta = {}) {
    try {
      assertCoreDependencies();

      amount = safeNumber(amount);

      if (amount <= 0) {
        return { error: "Invalid credit amount" };
      }

      const treasury = await getEcosystemTreasury();

      if (treasury?.error) return { error: treasury.error };

      const walletBefore = safeNumber(treasury.wallet_balance);
      const availableBefore = safeNumber(
        treasury.available_liquidity
      );

      const walletAfter = walletBefore + amount;
      const availableAfter = availableBefore + amount;

      const updated = await updateEcosystemTreasury({
        wallet_balance: walletAfter,
        available_liquidity: availableAfter,
        total_inflow:
          safeNumber(treasury.total_inflow) + amount,
        last_activity_at: nowISO()
      });

      if (updated.error) return { error: updated.error };

      const tx = await insertEcosystemTreasuryTransaction({
        tx_type: "manual_credit",
        amount,
        balance_before: walletBefore,
        balance_after: walletAfter,
        liquidity_before: availableBefore,
        liquidity_after: availableAfter,
        actor_userid: meta.actor_userid,
        actor_username: meta.actor_username,
        note: meta.note || "Manual treasury credit",
        meta: meta.meta || {}
      });

      if (tx.error) {
        console.warn(
          "Ecosystem credit ledger warning:",
          tx.error
        );
      }

      return {
        success: true,
        action: "manual_credit",
        network: requireNetwork(),
        amount,
        treasury: updated.data,
        transaction: tx.data || null
      };
    } catch (error) {
      return {
        error:
          error?.message ||
          "Ecosystem treasury credit failed"
      };
    }
  }

  /* =======================================================
     DEBIT
  ======================================================= */

  async function debitEcosystemTreasury(amount, meta = {}) {
    try {
      assertCoreDependencies();

      amount = safeNumber(amount);

      if (amount <= 0) {
        return { error: "Invalid debit amount" };
      }

      const treasury = await getEcosystemTreasury();

      if (treasury?.error) return { error: treasury.error };

      const walletBefore = safeNumber(treasury.wallet_balance);
      const availableBefore = safeNumber(
        treasury.available_liquidity
      );

      if (amount > availableBefore) {
        return {
          error:
            "Insufficient available ecosystem liquidity"
        };
      }

      const walletAfter = walletBefore - amount;
      const availableAfter = availableBefore - amount;

      const updated = await updateEcosystemTreasury({
        wallet_balance: walletAfter,
        available_liquidity: availableAfter,
        total_outflow:
          safeNumber(treasury.total_outflow) + amount,
        last_activity_at: nowISO()
      });

      if (updated.error) return { error: updated.error };

      const tx = await insertEcosystemTreasuryTransaction({
        tx_type: "manual_debit",
        amount,
        balance_before: walletBefore,
        balance_after: walletAfter,
        liquidity_before: availableBefore,
        liquidity_after: availableAfter,
        actor_userid: meta.actor_userid,
        actor_username: meta.actor_username,
        note: meta.note || "Manual treasury debit",
        meta: meta.meta || {}
      });

      if (tx.error) {
        console.warn(
          "Ecosystem debit ledger warning:",
          tx.error
        );
      }

      return {
        success: true,
        action: "manual_debit",
        network: requireNetwork(),
        amount,
        treasury: updated.data,
        transaction: tx.data || null
      };
    } catch (error) {
      return {
        error:
          error?.message ||
          "Ecosystem treasury debit failed"
      };
    }
  }

  /* =======================================================
     LOCK
  ======================================================= */

  async function lockEcosystemLiquidity(amount, meta = {}) {
    try {
      assertCoreDependencies();

      amount = safeNumber(amount);

      if (amount <= 0) {
        return { error: "Invalid lock amount" };
      }

      const treasury = await getEcosystemTreasury();

      if (treasury?.error) return { error: treasury.error };

      const availableBefore = safeNumber(
        treasury.available_liquidity
      );
      const lockedBefore = safeNumber(
        treasury.locked_liquidity
      );
      const walletBalance = safeNumber(
        treasury.wallet_balance
      );

      if (amount > availableBefore) {
        return {
          error:
            "Insufficient available liquidity to lock"
        };
      }

      const availableAfter = availableBefore - amount;
      const lockedAfter = lockedBefore + amount;

      const updated = await updateEcosystemTreasury({
        available_liquidity: availableAfter,
        locked_liquidity: lockedAfter,
        last_activity_at: nowISO()
      });

      if (updated.error) return { error: updated.error };

      const tx = await insertEcosystemTreasuryTransaction({
        tx_type: "liquidity_lock",
        amount,
        balance_before: walletBalance,
        balance_after: walletBalance,
        liquidity_before: availableBefore,
        liquidity_after: availableAfter,
        actor_userid: meta.actor_userid,
        actor_username: meta.actor_username,
        note: meta.note || "Liquidity locked",
        meta: {
          ...(meta.meta || {}),
          locked_before: lockedBefore,
          locked_after: lockedAfter
        }
      });

      if (tx.error) {
        console.warn(
          "Ecosystem lock ledger warning:",
          tx.error
        );
      }

      return {
        success: true,
        action: "liquidity_lock",
        network: requireNetwork(),
        amount,
        treasury: updated.data,
        transaction: tx.data || null
      };
    } catch (error) {
      return {
        error:
          error?.message ||
          "Ecosystem liquidity lock failed"
      };
    }
  }

  /* =======================================================
     UNLOCK
  ======================================================= */

  async function unlockEcosystemLiquidity(amount, meta = {}) {
    try {
      assertCoreDependencies();

      amount = safeNumber(amount);

      if (amount <= 0) {
        return { error: "Invalid unlock amount" };
      }

      const treasury = await getEcosystemTreasury();

      if (treasury?.error) return { error: treasury.error };

      const availableBefore = safeNumber(
        treasury.available_liquidity
      );
      const lockedBefore = safeNumber(
        treasury.locked_liquidity
      );
      const walletBalance = safeNumber(
        treasury.wallet_balance
      );

      if (amount > lockedBefore) {
        return {
          error: "Insufficient locked liquidity"
        };
      }

      const availableAfter = availableBefore + amount;
      const lockedAfter = lockedBefore - amount;

      const updated = await updateEcosystemTreasury({
        available_liquidity: availableAfter,
        locked_liquidity: lockedAfter,
        last_activity_at: nowISO()
      });

      if (updated.error) return { error: updated.error };

      const tx = await insertEcosystemTreasuryTransaction({
        tx_type: "liquidity_unlock",
        amount,
        balance_before: walletBalance,
        balance_after: walletBalance,
        liquidity_before: availableBefore,
        liquidity_after: availableAfter,
        actor_userid: meta.actor_userid,
        actor_username: meta.actor_username,
        note: meta.note || "Liquidity unlocked",
        meta: {
          ...(meta.meta || {}),
          locked_before: lockedBefore,
          locked_after: lockedAfter
        }
      });

      if (tx.error) {
        console.warn(
          "Ecosystem unlock ledger warning:",
          tx.error
        );
      }

      return {
        success: true,
        action: "liquidity_unlock",
        network: requireNetwork(),
        amount,
        treasury: updated.data,
        transaction: tx.data || null
      };
    } catch (error) {
      return {
        error:
          error?.message ||
          "Ecosystem liquidity unlock failed"
      };
    }
  }

  /* =======================================================
     FUND PROJECT
     ecosystem treasury -> project treasury
  ======================================================= */

  async function fundProjectFromEcosystem(
    projectCode,
    amount,
    meta = {}
  ) {
    try {
      assertProjectTreasuryDependencies();

      amount = safeNumber(amount);

      if (!projectCode) {
        return { error: "Project code is required" };
      }

      if (amount <= 0) {
        return { error: "Invalid funding amount" };
      }

      const network = requireNetwork();
      const project = await window.getProjectMeta(projectCode);

      if (!project) {
        return {
          error: `Project not found: ${projectCode}`
        };
      }

      /*
        If the project engine exposes network metadata, reject a
        cross-network project instead of relying on a caller hint.
      */
      if (
        project.network &&
        String(project.network).toLowerCase() !== network
      ) {
        return {
          error:
            `Project ${projectCode} belongs to ` +
            `${project.network}, not ${network}`
        };
      }

      const treasury = await getEcosystemTreasury();

      if (treasury?.error) {
        return { error: treasury.error };
      }

      if (treasury.treasury_status !== "active") {
        return {
          error: "Ecosystem treasury is not active"
        };
      }

      const walletBefore = safeNumber(
        treasury.wallet_balance
      );
      const availableBefore = safeNumber(
        treasury.available_liquidity
      );

      if (amount > availableBefore) {
        return {
          error:
            "Insufficient available ecosystem liquidity"
        };
      }

      /*
        Preserve the established bridge order:
        project treasury is funded first, then ecosystem treasury
        is reduced. If the second step fails, return an explicit
        partial-operation result for reconciliation.
      */
      const projectFunding = await window.addProjectLiquidity(
        project.project_code,
        amount,
        {
          actor_userid: meta.actor_userid || "",
          actor_username: meta.actor_username || "",
          note:
            meta.note ||
            `Funding from ecosystem treasury to ${project.project_name}`,
          meta: {
            ...(meta.meta || {}),
            source: "ecosystem_treasury",
            treasury_code: CONFIG.TREASURY_CODE,
            network
          }
        }
      );

      if (projectFunding?.error) {
        return { error: projectFunding.error };
      }

      const walletAfter = walletBefore - amount;
      const availableAfter = availableBefore - amount;

      const updated = await updateEcosystemTreasury({
        wallet_balance: walletAfter,
        available_liquidity: availableAfter,
        approved_outflow_total:
          safeNumber(
            treasury.approved_outflow_total
          ) + amount,
        total_outflow:
          safeNumber(treasury.total_outflow) + amount,
        last_activity_at: nowISO()
      });

      if (updated.error) {
        return {
          error:
            "Project treasury was funded, but ecosystem treasury update failed. " +
            "Manual reconciliation is required: " +
            updated.error,
          partial: true,
          network,
          project_funding: projectFunding
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
        actor_userid: meta.actor_userid,
        actor_username: meta.actor_username,
        note:
          meta.note ||
          `Project funding to ${project.project_name}`,
        meta: {
          ...(meta.meta || {}),
          project_type:
            project.project_type || "core",
          treasury_code: CONFIG.TREASURY_CODE
        }
      });

      if (tx.error) {
        console.warn(
          "Ecosystem project funding ledger warning:",
          tx.error
        );
      }

      return {
        success: true,
        action: "project_funding",
        network,
        project_code: project.project_code,
        project_name: project.project_name,
        amount,
        ecosystem_treasury: updated.data,
        project_funding: projectFunding,
        transaction: tx.data || null
      };
    } catch (error) {
      return {
        error:
          error?.message ||
          "Ecosystem project funding failed"
      };
    }
  }

  /* =======================================================
     PROJECT REFUND
  ======================================================= */

  async function refundProjectToEcosystem(
    projectCode,
    amount,
    meta = {}
  ) {
    try {
      assertProjectTreasuryDependencies();

      amount = safeNumber(amount);

      if (!projectCode) {
        return { error: "Project code is required" };
      }

      if (amount <= 0) {
        return { error: "Invalid refund amount" };
      }

      const network = requireNetwork();
      const project = await window.getProjectMeta(projectCode);

      if (!project) {
        return {
          error: `Project not found: ${projectCode}`
        };
      }

      if (
        project.network &&
        String(project.network).toLowerCase() !== network
      ) {
        return {
          error:
            `Project ${projectCode} belongs to ` +
            `${project.network}, not ${network}`
        };
      }

      const treasury = await getEcosystemTreasury();

      if (treasury?.error) {
        return { error: treasury.error };
      }

      const walletBefore = safeNumber(
        treasury.wallet_balance
      );
      const availableBefore = safeNumber(
        treasury.available_liquidity
      );

      const walletAfter = walletBefore + amount;
      const availableAfter = availableBefore + amount;

      const updated = await updateEcosystemTreasury({
        wallet_balance: walletAfter,
        available_liquidity: availableAfter,
        total_inflow:
          safeNumber(treasury.total_inflow) + amount,
        last_activity_at: nowISO()
      });

      if (updated.error) {
        return { error: updated.error };
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
        actor_userid: meta.actor_userid,
        actor_username: meta.actor_username,
        note:
          meta.note ||
          `Project refund from ${project.project_name}`,
        meta: {
          ...(meta.meta || {}),
          network
        }
      });

      if (tx.error) {
        console.warn(
          "Ecosystem project refund ledger warning:",
          tx.error
        );
      }

      return {
        success: true,
        action: "project_refund",
        network,
        amount,
        treasury: updated.data,
        transaction: tx.data || null
      };
    } catch (error) {
      return {
        error:
          error?.message ||
          "Ecosystem project refund failed"
      };
    }
  }

  /* =======================================================
     PENDING REQUEST TOTALS
  ======================================================= */

  async function setPendingRequestsTotal(amount) {
    try {
      assertCoreDependencies();

      amount = Math.max(0, safeNumber(amount));

      const treasury = await getEcosystemTreasury();

      if (treasury?.error) {
        return { error: treasury.error };
      }

      return updateEcosystemTreasury({
        pending_requests_total: amount,
        last_activity_at: nowISO()
      });
    } catch (error) {
      return {
        error:
          error?.message ||
          "Failed to set pending requests total"
      };
    }
  }

  async function incrementPendingRequestsTotal(amount) {
    try {
      assertCoreDependencies();

      amount = safeNumber(amount);

      if (amount <= 0) {
        return { error: "Invalid pending amount" };
      }

      const treasury = await getEcosystemTreasury();

      if (treasury?.error) {
        return { error: treasury.error };
      }

      return updateEcosystemTreasury({
        pending_requests_total:
          safeNumber(
            treasury.pending_requests_total
          ) + amount,
        last_activity_at: nowISO()
      });
    } catch (error) {
      return {
        error:
          error?.message ||
          "Failed to increment pending requests total"
      };
    }
  }

  async function decrementPendingRequestsTotal(amount) {
    try {
      assertCoreDependencies();

      amount = safeNumber(amount);

      if (amount <= 0) {
        return { error: "Invalid pending amount" };
      }

      const treasury = await getEcosystemTreasury();

      if (treasury?.error) {
        return { error: treasury.error };
      }

      return updateEcosystemTreasury({
        pending_requests_total: Math.max(
          0,
          safeNumber(
            treasury.pending_requests_total
          ) - amount
        ),
        last_activity_at: nowISO()
      });
    } catch (error) {
      return {
        error:
          error?.message ||
          "Failed to decrement pending requests total"
      };
    }
  }

  /* =======================================================
     HISTORY
  ======================================================= */

  async function getEcosystemTreasuryHistory(limit = 50) {
    try {
      assertCoreDependencies();

      const supabase = requireClient();
      const network = requireNetwork();

      limit = Math.max(1, Math.floor(safeNumber(limit, 50)));

      const { data, error } = await supabase
        .from(CONFIG.TX_TABLE)
        .select("*")
        .eq("treasury_code", CONFIG.TREASURY_CODE)
        .eq("network", network)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error(
          "getEcosystemTreasuryHistory error:",
          error
        );

        return [];
      }

      return (data || []).map(normalizeTxRow);
    } catch (error) {
      console.error(
        "getEcosystemTreasuryHistory network error:",
        error
      );

      return [];
    }
  }

  /* =======================================================
     SNAPSHOT
  ======================================================= */

  async function getEcosystemTreasurySnapshot(
    historyLimit = 20
  ) {
    const treasury = await getEcosystemTreasury();

    if (treasury?.error) {
      return { error: treasury.error };
    }

    const history =
      await getEcosystemTreasuryHistory(historyLimit);

    return {
      success: true,
      network: requireNetwork(),
      treasury,
      history
    };
  }

  /* =======================================================
     SUMMARY
  ======================================================= */

  async function getEcosystemTreasurySummary() {
    const treasury = await getEcosystemTreasury();

    if (treasury?.error) {
      return { error: treasury.error };
    }

    return {
      network: requireNetwork(),
      treasury_code: treasury.treasury_code,
      treasury_name: treasury.treasury_name,
      wallet_balance: treasury.wallet_balance,
      available_liquidity: treasury.available_liquidity,
      locked_liquidity: treasury.locked_liquidity,
      pending_requests_total:
        treasury.pending_requests_total,
      approved_outflow_total:
        treasury.approved_outflow_total,
      total_inflow: treasury.total_inflow,
      total_outflow: treasury.total_outflow,
      treasury_status: treasury.treasury_status,
      last_wallet_sync_at:
        treasury.last_wallet_sync_at,
      last_activity_at:
        treasury.last_activity_at
    };
  }

  /* =======================================================
     PUBLIC API
  ======================================================= */

  Object.assign(AlbukhrEcosystemTreasury, {
    config: {
      ...CONFIG,
      getNetwork: getCurrentNetworkSafe
    },

    getClient,

    getCurrentNetwork: getCurrentNetworkSafe,

    fetch: fetchTreasuryRow,
    ensure: ensureTreasury,
    get: getEcosystemTreasury,
    update: updateEcosystemTreasury,

    insertTransaction:
      insertEcosystemTreasuryTransaction,

    syncWallet:
      syncEcosystemWalletBalance,

    credit:
      creditEcosystemTreasury,

    debit:
      debitEcosystemTreasury,

    lockLiquidity:
      lockEcosystemLiquidity,

    unlockLiquidity:
      unlockEcosystemLiquidity,

    fundProject:
      fundProjectFromEcosystem,

    refundProject:
      refundProjectToEcosystem,

    setPendingRequestsTotal,
    incrementPendingRequestsTotal,
    decrementPendingRequestsTotal,

    history:
      getEcosystemTreasuryHistory,

    snapshot:
      getEcosystemTreasurySnapshot,

    summary:
      getEcosystemTreasurySummary
  });

  /* =======================================================
     BACKWARD-COMPATIBLE GLOBAL ALIASES
  ======================================================= */

  window.getEcosystemTreasurySupabaseClient = getClient;
  window.fetchEcosystemTreasuryRow = fetchTreasuryRow;
  window.ensureEcosystemTreasury = ensureTreasury;
  window.getEcosystemTreasury = getEcosystemTreasury;
  window.updateEcosystemTreasury = updateEcosystemTreasury;

  window.insertEcosystemTreasuryTransaction =
    insertEcosystemTreasuryTransaction;

  window.syncEcosystemWalletBalance =
    syncEcosystemWalletBalance;

  window.creditEcosystemTreasury =
    creditEcosystemTreasury;

  window.debitEcosystemTreasury =
    debitEcosystemTreasury;

  window.lockEcosystemLiquidity =
    lockEcosystemLiquidity;

  window.unlockEcosystemLiquidity =
    unlockEcosystemLiquidity;

  window.fundProjectFromEcosystem =
    fundProjectFromEcosystem;

  window.refundProjectToEcosystem =
    refundProjectToEcosystem;

  window.setPendingRequestsTotal =
    setPendingRequestsTotal;

  window.incrementPendingRequestsTotal =
    incrementPendingRequestsTotal;

  window.decrementPendingRequestsTotal =
    decrementPendingRequestsTotal;

  window.getEcosystemTreasuryHistory =
    getEcosystemTreasuryHistory;

  window.getEcosystemTreasurySnapshot =
    getEcosystemTreasurySnapshot;

  window.getEcosystemTreasurySummary =
    getEcosystemTreasurySummary;

})(window);
