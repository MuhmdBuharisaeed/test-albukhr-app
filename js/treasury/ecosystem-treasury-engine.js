/* =========================================================
   ALBUKHR ECOSYSTEM TREASURY ENGINE v2
   Supabase-First • Network-Aware • Compatibility-Safe
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

  /* =======================================================
     SUPABASE
     Canonical source: js/supabase-core.js
     No second client is created here.
  ======================================================= */

  function getClient() {
    if (typeof window.getSupabaseClient === "function") {
      const client = window.getSupabaseClient();
      if (client) return client;
    }

    if (window.supabaseClient) {
      return window.supabaseClient;
    }

    return null;
  }

  function requireClient() {
    const client = getClient();
    if (!client) {
      throw new Error(
        "Supabase client unavailable. Load js/supabase-core.js first."
      );
    }
    return client;
  }

  /* =======================================================
     NETWORK
     Uses the central environment/network state.
  ======================================================= */

  function getCurrentNetwork() {
    try {
      if (typeof window.getCurrentNetwork === "function") {
        const value = window.getCurrentNetwork();
        if (value) return String(value).toLowerCase();
      }

      if (
        window.AlbukhrEnvironment &&
        typeof window.AlbukhrEnvironment.getNetwork === "function"
      ) {
        const value = window.AlbukhrEnvironment.getNetwork();
        if (value) return String(value).toLowerCase();
      }

      if (window.ALBUKHR_NETWORK) {
        return String(window.ALBUKHR_NETWORK).toLowerCase();
      }

      const host = String(window.location?.hostname || "").toLowerCase();

      if (host === "test.albukhr.com" || host.startsWith("test.")) {
        return "testnet";
      }

      if (host === "app.albukhr.com" || host.startsWith("app.")) {
        return "mainnet";
      }

      return "testnet";
    } catch (_) {
      return "testnet";
    }
  }

  function networkValue() {
    const network = getCurrentNetwork();
    return network === "mainnet" ? "mainnet" : "testnet";
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
      network: networkValue()
    };
  }

  /* =======================================================
     DEPENDENCIES
  ======================================================= */

  function assertDependencies() {
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
      network: safeString(row.network, networkValue()),

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
      meta: row.meta || {},
      raw: row
    };
  }

  function normalizeTxRow(row = {}) {
    return {
      id: row.id ?? null,
      network: safeString(row.network, networkValue()),

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
      meta: row.meta || {},
      created_at: row.created_at || null,
      raw: row
    };
  }

  /* =======================================================
     FETCH
  ======================================================= */

  async function fetchTreasuryRow() {
    try {
      const supabase = requireClient();
      const network = networkValue();

      const { data, error } = await supabase
        .from(CONFIG.TABLE)
        .select("*")
        .eq("treasury_code", CONFIG.TREASURY_CODE)
        .eq("network", network)
        .maybeSingle();

      if (error) {
        return { error: error.message || "Failed to fetch ecosystem treasury" };
      }

      return {
        success: true,
        data: data ? normalizeTreasuryRow(data) : null
      };
    } catch (error) {
      return {
        error: error?.message || "Ecosystem treasury fetch failed"
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
      return { success: true, data: existing.data };
    }

    try {
      const supabase = requireClient();
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
          engine: "ecosystem-treasury-engine"
        }
      });

      const { data, error } = await supabase
        .from(CONFIG.TABLE)
        .insert(payload)
        .select()
        .single();

      if (error) {
        return {
          error: error.message || "Failed to create ecosystem treasury"
        };
      }

      return {
        success: true,
        data: normalizeTreasuryRow(data)
      };
    } catch (error) {
      return {
        error: error?.message || "Ecosystem treasury create failed"
      };
    }
  }

  /* =======================================================
     PUBLIC GET
  ======================================================= */

  async function getEcosystemTreasury() {
    const result = await ensureTreasury();
    return result.error ? { error: result.error } : result.data;
  }

  /* =======================================================
     UPDATE
  ======================================================= */

  async function updateEcosystemTreasury(patch = {}) {
    try {
      const supabase = requireClient();

      const safePatch = {
        ...patch,
        network: networkValue(),
        updated_at: nowISO()
      };

      const { data, error } = await supabase
        .from(CONFIG.TABLE)
        .update(safePatch)
        .eq("treasury_code", CONFIG.TREASURY_CODE)
        .eq("network", networkValue())
        .select()
        .single();

      if (error) {
        return {
          error: error.message || "Failed to update ecosystem treasury"
        };
      }

      return {
        success: true,
        data: normalizeTreasuryRow(data)
      };
    } catch (error) {
      return {
        error: error?.message || "Ecosystem treasury update failed"
      };
    }
  }

  /* =======================================================
     LEDGER INSERT
  ======================================================= */

  async function insertEcosystemTreasuryTransaction(options = {}) {
    try {
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

        meta: options.meta || {},
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
    balance = safeNumber(balance, -1);

    if (balance < 0) {
      return { error: "Invalid wallet balance" };
    }

    const treasury = await getEcosystemTreasury();

    if (treasury?.error) return { error: treasury.error };

    const walletBefore = safeNumber(treasury.wallet_balance);
    const availableBefore = safeNumber(treasury.available_liquidity);
    const locked = safeNumber(treasury.locked_liquidity);

    const availableAfter = Math.max(0, balance - locked);

    const updated = await updateEcosystemTreasury({
      wallet_balance: balance,
      available_liquidity: availableAfter,
      last_wallet_sync_at: nowISO(),
      last_activity_at: nowISO(),
      treasury_status: treasury.treasury_status || CONFIG.DEFAULT_STATUS,
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
      console.warn("Ecosystem wallet sync ledger warning:", tx.error);
    }

    return {
      success: true,
      action: "wallet_sync",
      network: networkValue(),
      wallet_balance: balance,
      available_liquidity: availableAfter,
      treasury: updated.data,
      transaction: tx.data || null
    };
  }

  /* =======================================================
     CREDIT
  ======================================================= */

  async function creditEcosystemTreasury(amount, meta = {}) {
    amount = safeNumber(amount);

    if (amount <= 0) return { error: "Invalid credit amount" };

    const treasury = await getEcosystemTreasury();
    if (treasury?.error) return { error: treasury.error };

    const walletBefore = safeNumber(treasury.wallet_balance);
    const availableBefore = safeNumber(treasury.available_liquidity);

    const walletAfter = walletBefore + amount;
    const availableAfter = availableBefore + amount;

    const updated = await updateEcosystemTreasury({
      wallet_balance: walletAfter,
      available_liquidity: availableAfter,
      total_inflow: safeNumber(treasury.total_inflow) + amount,
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
      console.warn("Ecosystem credit ledger warning:", tx.error);
    }

    return {
      success: true,
      action: "manual_credit",
      network: networkValue(),
      amount,
      treasury: updated.data,
      transaction: tx.data || null
    };
  }

  /* =======================================================
     DEBIT
  ======================================================= */

  async function debitEcosystemTreasury(amount, meta = {}) {
    amount = safeNumber(amount);

    if (amount <= 0) return { error: "Invalid debit amount" };

    const treasury = await getEcosystemTreasury();
    if (treasury?.error) return { error: treasury.error };

    const walletBefore = safeNumber(treasury.wallet_balance);
    const availableBefore = safeNumber(treasury.available_liquidity);

    if (amount > availableBefore) {
      return { error: "Insufficient available ecosystem liquidity" };
    }

    const walletAfter = walletBefore - amount;
    const availableAfter = availableBefore - amount;

    const updated = await updateEcosystemTreasury({
      wallet_balance: walletAfter,
      available_liquidity: availableAfter,
      total_outflow: safeNumber(treasury.total_outflow) + amount,
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
      console.warn("Ecosystem debit ledger warning:", tx.error);
    }

    return {
      success: true,
      action: "manual_debit",
      network: networkValue(),
      amount,
      treasury: updated.data,
      transaction: tx.data || null
    };
  }

  /* =======================================================
     LOCK
  ======================================================= */

  async function lockEcosystemLiquidity(amount, meta = {}) {
    amount = safeNumber(amount);

    if (amount <= 0) return { error: "Invalid lock amount" };

    const treasury = await getEcosystemTreasury();
    if (treasury?.error) return { error: treasury.error };

    const availableBefore = safeNumber(treasury.available_liquidity);
    const lockedBefore = safeNumber(treasury.locked_liquidity);
    const walletBalance = safeNumber(treasury.wallet_balance);

    if (amount > availableBefore) {
      return { error: "Insufficient available liquidity to lock" };
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
      console.warn("Ecosystem lock ledger warning:", tx.error);
    }

    return {
      success: true,
      action: "liquidity_lock",
      network: networkValue(),
      amount,
      treasury: updated.data,
      transaction: tx.data || null
    };
  }

  /* =======================================================
     UNLOCK
  ======================================================= */

  async function unlockEcosystemLiquidity(amount, meta = {}) {
    amount = safeNumber(amount);

    if (amount <= 0) return { error: "Invalid unlock amount" };

    const treasury = await getEcosystemTreasury();
    if (treasury?.error) return { error: treasury.error };

    const availableBefore = safeNumber(treasury.available_liquidity);
    const lockedBefore = safeNumber(treasury.locked_liquidity);
    const walletBalance = safeNumber(treasury.wallet_balance);

    if (amount > lockedBefore) {
      return { error: "Insufficient locked liquidity" };
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
      console.warn("Ecosystem unlock ledger warning:", tx.error);
    }

    return {
      success: true,
      action: "liquidity_unlock",
      network: networkValue(),
      amount,
      treasury: updated.data,
      transaction: tx.data || null
    };
  }

  /* =======================================================
     FUND PROJECT
     ecosystem treasury -> project treasury
  ======================================================= */

  async function fundProjectFromEcosystem(projectCode, amount, meta = {}) {
    assertDependencies();

    amount = safeNumber(amount);

    if (!projectCode) return { error: "Project code is required" };
    if (amount <= 0) return { error: "Invalid funding amount" };

    const project = await window.getProjectMeta(projectCode);

    if (!project) {
      return { error: `Project not found: ${projectCode}` };
    }

    const treasury = await getEcosystemTreasury();

    if (treasury?.error) return { error: treasury.error };

    if (treasury.treasury_status !== "active") {
      return { error: "Ecosystem treasury is not active" };
    }

    const walletBefore = safeNumber(treasury.wallet_balance);
    const availableBefore = safeNumber(treasury.available_liquidity);

    if (amount > availableBefore) {
      return { error: "Insufficient available ecosystem liquidity" };
    }

    /*
      Preserve the established bridge order:
      project treasury is funded first, then ecosystem ledger/balance
      is reduced. If the second step fails, we return an explicit
      partial-operation error instead of hiding the inconsistency.
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
          network: networkValue()
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
        safeNumber(treasury.approved_outflow_total) + amount,
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
        project_type: project.project_type || "core",
        treasury_code: CONFIG.TREASURY_CODE
      }
    });

    if (tx.error) {
      console.warn("Ecosystem project funding ledger warning:", tx.error);
    }

    return {
      success: true,
      action: "project_funding",
      network: networkValue(),
      project_code: project.project_code,
      project_name: project.project_name,
      amount,
      ecosystem_treasury: updated.data,
      project_funding: projectFunding,
      transaction: tx.data || null
    };
  }

  /* =======================================================
     PROJECT REFUND
  ======================================================= */

  async function refundProjectToEcosystem(projectCode, amount, meta = {}) {
    amount = safeNumber(amount);

    if (!projectCode) return { error: "Project code is required" };
    if (amount <= 0) return { error: "Invalid refund amount" };

    const project = await window.getProjectMeta(projectCode);

    if (!project) {
      return { error: `Project not found: ${projectCode}` };
    }

    const treasury = await getEcosystemTreasury();
    if (treasury?.error) return { error: treasury.error };

    const walletBefore = safeNumber(treasury.wallet_balance);
    const availableBefore = safeNumber(treasury.available_liquidity);

    const walletAfter = walletBefore + amount;
    const availableAfter = availableBefore + amount;

    const updated = await updateEcosystemTreasury({
      wallet_balance: walletAfter,
      available_liquidity: availableAfter,
      total_inflow: safeNumber(treasury.total_inflow) + amount,
      last_activity_at: nowISO()
    });

    if (updated.error) return { error: updated.error };

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
        network: networkValue()
      }
    });

    if (tx.error) {
      console.warn("Ecosystem project refund ledger warning:", tx.error);
    }

    return {
      success: true,
      action: "project_refund",
      network: networkValue(),
      amount,
      treasury: updated.data,
      transaction: tx.data || null
    };
  }

  /* =======================================================
     PENDING REQUEST TOTALS
  ======================================================= */

  async function setPendingRequestsTotal(amount) {
    amount = Math.max(0, safeNumber(amount));

    const treasury = await getEcosystemTreasury();
    if (treasury?.error) return { error: treasury.error };

    return updateEcosystemTreasury({
      pending_requests_total: amount,
      last_activity_at: nowISO()
    });
  }

  async function incrementPendingRequestsTotal(amount) {
    amount = safeNumber(amount);

    if (amount <= 0) {
      return { error: "Invalid pending amount" };
    }

    const treasury = await getEcosystemTreasury();
    if (treasury?.error) return { error: treasury.error };

    return updateEcosystemTreasury({
      pending_requests_total:
        safeNumber(treasury.pending_requests_total) + amount,
      last_activity_at: nowISO()
    });
  }

  async function decrementPendingRequestsTotal(amount) {
    amount = safeNumber(amount);

    if (amount <= 0) {
      return { error: "Invalid pending amount" };
    }

    const treasury = await getEcosystemTreasury();
    if (treasury?.error) return { error: treasury.error };

    return updateEcosystemTreasury({
      pending_requests_total: Math.max(
        0,
        safeNumber(treasury.pending_requests_total) - amount
      ),
      last_activity_at: nowISO()
    });
  }

  /* =======================================================
     HISTORY
  ======================================================= */

  async function getEcosystemTreasuryHistory(limit = 50) {
    try {
      const supabase = requireClient();
      limit = Math.max(1, safeNumber(limit, 50));

      const { data, error } = await supabase
        .from(CONFIG.TX_TABLE)
        .select("*")
        .eq("treasury_code", CONFIG.TREASURY_CODE)
        .eq("network", networkValue())
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

  async function getEcosystemTreasurySnapshot(historyLimit = 20) {
    const treasury = await getEcosystemTreasury();

    if (treasury?.error) return { error: treasury.error };

    const history =
      await getEcosystemTreasuryHistory(historyLimit);

    return {
      success: true,
      network: networkValue(),
      treasury,
      history
    };
  }

  /* =======================================================
     SUMMARY
  ======================================================= */

  async function getEcosystemTreasurySummary() {
    const treasury = await getEcosystemTreasury();

    if (treasury?.error) return { error: treasury.error };

    return {
      network: networkValue(),
      treasury_code: treasury.treasury_code,
      treasury_name: treasury.treasury_name,
      wallet_balance: treasury.wallet_balance,
      available_liquidity: treasury.available_liquidity,
      locked_liquidity: treasury.locked_liquidity,
      pending_requests_total: treasury.pending_requests_total,
      approved_outflow_total: treasury.approved_outflow_total,
      total_inflow: treasury.total_inflow,
      total_outflow: treasury.total_outflow,
      treasury_status: treasury.treasury_status,
      last_wallet_sync_at: treasury.last_wallet_sync_at,
      last_activity_at: treasury.last_activity_at
    };
  }

  /* =======================================================
     PUBLIC API
  ======================================================= */

  Object.assign(AlbukhrEcosystemTreasury, {
    config: {
      ...CONFIG,
      getNetwork: networkValue
    },

    getClient,
    getCurrentNetwork: networkValue,

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
     Existing engines can keep calling the old names.
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
