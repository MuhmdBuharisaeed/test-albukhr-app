/* =========================================
   ALBUKHR WITHDRAW ENGINE v4
   USER DOMAIN ENGINE
   NETWORK-AWARE / SUPABASE CORE
   =========================================

   LOCATION:
   - js/withdrawals/withdraw-engine.js

   FOUNDATION:
   - js/core/environment-switcher.js
   - js/core/pi-auth-core.js
   - js/core/pi-payment.js
   - js/core/pi-project-treasury-payment.js
   - js/core/supabase-core.js

   RULES:
   - No LocalStorage
   - No independent Supabase client
   - Shared Pi authentication only
   - MAINNET/TESTNET isolation on every read/write
   - Creates withdrawal REQUESTS only
========================================= */

(function () {
  "use strict";

  const ENGINE_VERSION = "4.0.0";
  const TABLE_NAME = "withdraw_requests";
  const ACTIVE_STATUSES = Object.freeze(["pending", "approved"]);
  const SELECT_COLUMNS =
    "id,userid,project,amount,fee,receive,wallet,type,status,created_at,network";

  function getFoundation() {
    if (typeof window.requireAlbukhrSupabaseClient !== "function") {
      throw new Error(
        "ALBUKHR Supabase Core is not available. Load js/core/supabase-core.js first."
      );
    }

    if (typeof window.requireAlbukhrNetwork !== "function") {
      throw new Error(
        "ALBUKHR Environment Core is not available. Load js/core/environment-switcher.js first."
      );
    }

    if (typeof window.withAlbukhrNetwork !== "function") {
      throw new Error(
        "ALBUKHR network payload helper is not available."
      );
    }

    if (typeof window.assertAlbukhrNetworkValue !== "function") {
      throw new Error(
        "ALBUKHR network validation helper is not available."
      );
    }

    return {
      db: window.requireAlbukhrSupabaseClient(),
      network: window.requireAlbukhrNetwork()
    };
  }

  async function getAuthenticatedUser() {
    if (typeof window.AlbukhrPiAuth?.ensurePiAuth === "function") {
      const user = await window.AlbukhrPiAuth.ensurePiAuth();
      if (user?.uid) return user;
    }

    if (typeof window.ensurePiAuth === "function") {
      const user = await window.ensurePiAuth();
      if (user?.uid) return user;
    }

    throw new Error(
      "ALBUKHR Pi Auth Core is not available. Please load js/core/pi-auth-core.js."
    );
  }

  function cleanString(value) {
    return String(value ?? "").trim();
  }

  function validateInput({ project, amount, wallet, type }) {
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new Error("Invalid withdrawal amount.");
    }

    const cleanProject = cleanString(project);
    if (!cleanProject) throw new Error("Project is required.");

    const cleanWallet = cleanString(wallet);
    if (!cleanWallet) throw new Error("Wallet address is required.");

    if (type !== "reward" && type !== "capital") {
      throw new Error("Invalid withdrawal type.");
    }

    return {
      amount: numericAmount,
      project: cleanProject,
      wallet: cleanWallet,
      type
    };
  }

  function calculateWithdrawal(amount) {
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new Error("Invalid withdrawal amount.");
    }

    const fee = numericAmount * 0.01;
    const receive = numericAmount;

    return {
      amount: numericAmount,
      fee,
      receive,
      total_deduction: numericAmount + fee
    };
  }

  async function hasActiveWithdrawal(db, userid, network) {
    if (!userid) throw new Error("Authenticated user ID is required.");

    window.assertAlbukhrNetworkValue(network);

    const result = await db
      .from(TABLE_NAME)
      .select("id,status,network")
      .eq("userid", userid)
      .eq("network", network)
      .in("status", ACTIVE_STATUSES)
      .limit(1);

    if (result.error) {
      throw new Error(
        result.error.message ||
        "Unable to check existing withdrawal requests."
      );
    }

    return Array.isArray(result.data) && result.data.length > 0;
  }

  async function createWithdrawRequest({
    project,
    amount,
    wallet,
    type
  } = {}) {
    try {
      const foundation = getFoundation();
      const user = await getAuthenticatedUser();

      const input = validateInput({
        project,
        amount,
        wallet,
        type
      });

      const calculation = calculateWithdrawal(input.amount);

      const duplicate = await hasActiveWithdrawal(
        foundation.db,
        user.uid,
        foundation.network
      );

      if (duplicate) {
        return {
          success: false,
          network: foundation.network,
          error:
            "You already have a pending or approved withdrawal request."
        };
      }

      const payload = window.withAlbukhrNetwork({
        userid: user.uid,
        project: input.project,
        amount: calculation.amount,
        fee: calculation.fee,
        receive: calculation.receive,
        wallet: input.wallet,
        type: input.type,
        status: "pending"
      });

      window.assertAlbukhrNetworkValue(payload.network);

      const result = await foundation.db
        .from(TABLE_NAME)
        .insert([payload])
        .select(SELECT_COLUMNS)
        .single();

      if (result.error) {
        return {
          success: false,
          network: foundation.network,
          error:
            result.error.message ||
            "Unable to submit withdrawal request."
        };
      }

      return {
        success: true,
        network: foundation.network,
        request: result.data
      };
    } catch (error) {
      console.error("ALBUKHR WITHDRAW ENGINE ERROR:", error);

      return {
        success: false,
        error: error?.message || "Withdrawal request failed."
      };
    }
  }

  async function getMyWithdrawRequests({ status = null } = {}) {
    try {
      const foundation = getFoundation();
      const user = await getAuthenticatedUser();

      let query = foundation.db
        .from(TABLE_NAME)
        .select(SELECT_COLUMNS)
        .eq("userid", user.uid)
        .eq("network", foundation.network)
        .order("created_at", { ascending: false });

      if (status !== null) {
        const cleanStatus = cleanString(status);
        if (!cleanStatus) {
          throw new Error("Withdrawal status cannot be empty.");
        }
        query = query.eq("status", cleanStatus);
      }

      const result = await query;

      if (result.error) {
        throw new Error(
          result.error.message ||
          "Unable to load withdrawal requests."
        );
      }

      return {
        success: true,
        network: foundation.network,
        requests: Array.isArray(result.data) ? result.data : []
      };
    } catch (error) {
      console.error("GET WITHDRAW REQUESTS ERROR:", error);

      return {
        success: false,
        requests: [],
        error:
          error?.message ||
          "Unable to load withdrawal requests."
      };
    }
  }

  async function getWithdrawalRequest(id) {
    try {
      const cleanId = cleanString(id);
      if (!cleanId) {
        throw new Error("Withdrawal request ID is required.");
      }

      const foundation = getFoundation();
      const user = await getAuthenticatedUser();

      const result = await foundation.db
        .from(TABLE_NAME)
        .select(SELECT_COLUMNS)
        .eq("id", cleanId)
        .eq("userid", user.uid)
        .eq("network", foundation.network)
        .maybeSingle();

      if (result.error) {
        throw new Error(
          result.error.message ||
          "Unable to load withdrawal request."
        );
      }

      return {
        success: true,
        network: foundation.network,
        request: result.data || null
      };
    } catch (error) {
      console.error("GET WITHDRAW REQUEST ERROR:", error);

      return {
        success: false,
        request: null,
        error:
          error?.message ||
          "Unable to load withdrawal request."
      };
    }
  }

  function health() {
    let network = null;
    let networkError = null;

    try {
      network = typeof window.requireAlbukhrNetwork === "function"
        ? window.requireAlbukhrNetwork()
        : null;
    } catch (error) {
      networkError =
        error?.message || "ALBUKHR network unavailable.";
    }

    const supabaseReady =
      typeof window.requireAlbukhrSupabaseClient === "function";

    const authReady =
      typeof window.AlbukhrPiAuth?.ensurePiAuth === "function" ||
      typeof window.ensurePiAuth === "function";

    return {
      ready: Boolean(
        network &&
        !networkError &&
        supabaseReady &&
        authReady
      ),
      version: ENGINE_VERSION,
      table: TABLE_NAME,
      network,
      supabase_core_ready: supabaseReady,
      pi_auth_core_ready: authReady,
      network_error: networkError
    };
  }

  const WithdrawEngine = Object.freeze({
    createWithdrawRequest,
    getMyWithdrawRequests,
    getWithdrawalRequest,
    calculateWithdrawal,
    health
  });

  window.AlbukhrWithdrawEngine = WithdrawEngine;

  /* Existing page-facing compatibility API. */
  window.createWithdrawRequest = createWithdrawRequest;

  try {
    window.dispatchEvent(
      new CustomEvent("albukhrWithdrawEngineReady", {
        detail: { version: ENGINE_VERSION }
      })
    );
  } catch (_) {}

  console.log(
    `ALBUKHR Withdraw Engine v${ENGINE_VERSION} loaded.`
  );
})();
