/* =========================================================
   ALBUKHR — STAKING ENGINE v2
   Architecture-ready / Supabase Source of Truth
   =========================================================
   DEPENDS ON:
   - js/supabase-core.js
   - js/network-core.js OR environment-switcher.js exposing
     requireAlbukhrNetwork()
   - js/pi-auth.js exposing ensurePiAuth()
   - Pi payment engine exposing startPiPayment()
   - Optional unified transaction engine exposing recordTx()
   - js/projects/projects-engine.js

   RULES:
   - No LocalStorage persistence
   - No hard-coded Supabase URL/key
   - No direct REST API
   - No project emoji/icon configuration
   - No hard-coded project registry
   - Every stakes query/write is network-aware
   - Project rules/durations come from Projects Engine/Supabase
========================================================= */

"use strict";

(function (window) {
  const TABLE = "stakes";
  let stakingLock = false;

  function getNetwork() {
    if (typeof window.requireAlbukhrNetwork !== "function") {
      throw new Error("ALBUKHR Network Core is not available.");
    }
    return window.requireAlbukhrNetwork();
  }

  function getDB() {
    if (typeof window.requireAlbukhrSupabaseClient !== "function") {
      throw new Error("ALBUKHR Supabase Core is not available.");
    }
    const db = window.requireAlbukhrSupabaseClient();
    if (!db) throw new Error("ALBUKHR Supabase client is not available.");
    return db;
  }

  async function getUser() {
    if (typeof window.ensurePiAuth !== "function") {
      throw new Error("Pi authentication engine is not available.");
    }

    const user = await window.ensurePiAuth();

    if (!user?.uid) {
      throw new Error("Authenticated Pi user is required.");
    }

    return user;
  }

  function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function safeString(value, fallback = "") {
    return value == null ? fallback : String(value);
  }

  function round(value, decimals = 8) {
    const n = safeNumber(value, 0);
    const factor = 10 ** decimals;
    return Math.round(n * factor) / factor;
  }

  function normalizeProjectCode(value) {
    return safeString(value).trim();
  }

  async function getProjectMeta(projectCode) {
    const code = normalizeProjectCode(projectCode);

    if (!code) return null;

    if (typeof window.getProjectMeta === "function") {
      return await window.getProjectMeta(code);
    }

    if (typeof window.getProjectByCode === "function") {
      return await window.getProjectByCode(code);
    }

    throw new Error("Projects Engine is not available.");
  }

  async function getProjectRules(projectCode) {
    if (typeof window.getProjectRules !== "function") {
      throw new Error("Projects Engine rules resolver is not available.");
    }
    return await window.getProjectRules(projectCode);
  }

  async function getProjectDurations(projectCode) {
    if (typeof window.getProjectDurations === "function") {
      const durations = await window.getProjectDurations(projectCode);
      return Array.isArray(durations)
        ? durations.map(Number).filter(Number.isFinite)
        : [];
    }

    const meta = await getProjectMeta(projectCode);
    return Array.isArray(meta?.durations)
      ? meta.durations.map(Number).filter(Number.isFinite)
      : [];
  }

  async function getMinStake(projectCode) {
    const meta = await getProjectMeta(projectCode);
    const rules = await getProjectRules(projectCode);

    const minStake =
      safeNumber(rules?.min_stake, NaN);

    if (Number.isFinite(minStake) && minStake > 0) {
      return minStake;
    }

    const metaMin =
      safeNumber(meta?.min_stake, NaN);

    if (Number.isFinite(metaMin) && metaMin > 0) {
      return metaMin;
    }

    /*
      The legacy engine used 10 Pi, but the new architecture
      intentionally does not hard-code that value. If the DB
      does not contain min_stake, the caller must define the
      project rule in Supabase before staking is enabled.
    */
    return 0;
  }

  async function getRewardRate(projectCode, duration) {
    const rules = await getProjectRules(projectCode);

    /*
      Preferred architecture:
      reward_rate is supplied by the project registry/rules.
      If duration-specific rates are later stored in a dedicated
      project reward-rates table, this resolver can be extended
      without changing the staking API.
    */
    const rate = safeNumber(rules?.reward_rate, 0);

    if (rate <= 0) return 0;

    return rate;
  }

  async function calculateReward(projectCode, amount, duration) {
    const principal = safeNumber(amount, 0);
    if (principal <= 0) return 0;

    const rate = await getRewardRate(projectCode, duration);
    return round(principal * rate);
  }

  async function validateStake({ project, amount, duration }) {
    const code = normalizeProjectCode(project);
    const safeAmount = safeNumber(amount, 0);
    const safeDuration = safeNumber(duration, 0);

    if (!code) return { valid: false, error: "Invalid project." };
    if (safeAmount <= 0) return { valid: false, error: "Invalid amount." };
    if (safeDuration <= 0) return { valid: false, error: "Invalid duration." };

    const meta = await getProjectMeta(code);

    if (!meta) {
      return { valid: false, error: `Project "${code}" was not found.` };
    }

    if (meta.status && String(meta.status).toLowerCase() !== "active") {
      return { valid: false, error: "Project is not active." };
    }

    if (meta.staking_enabled === false) {
      return { valid: false, error: "Staking is disabled for this project." };
    }

    const durations = await getProjectDurations(code);

    if (durations.length && !durations.includes(safeDuration)) {
      return {
        valid: false,
        error: `Duration ${safeDuration} days is not available for this project.`
      };
    }

    const minStake = await getMinStake(code);

    if (minStake <= 0) {
      return {
        valid: false,
        error: "Project minimum stake is not configured."
      };
    }

    if (safeAmount < minStake) {
      return {
        valid: false,
        error: `Minimum stake is ${minStake} Pi.`
      };
    }

    const reward = await calculateReward(code, safeAmount, safeDuration);

    if (reward <= 0) {
      return {
        valid: false,
        error: "Project reward rule is not configured."
      };
    }

    return {
      valid: true,
      project: code,
      amount: safeAmount,
      duration: safeDuration,
      minStake,
      reward
    };
  }

  async function createPendingStake({ user, project, amount, duration }) {
    const network = getNetwork();
    const db = getDB();

    const reward = await calculateReward(project, amount, duration);

    const row = {
      userid: user.uid,
      wallet: user.wallet_address || user.wallet || "",
      project: normalizeProjectCode(project),
      amount: safeNumber(amount),
      duration: safeNumber(duration),
      reward,
      withdrawnReward: 0,
      withdrawnCapital: 0,
      unlockTime: Date.now() + (safeNumber(duration) * 86400000),
      type: "stake",
      status: "pending",
      network,
      payment_id: null,
      txid: null
    };

    const { data, error } = await db
      .from(TABLE)
      .insert(row)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message || "Unable to create pending stake.");
    }

    return data;
  }

  async function updatePendingStake(id, values) {
    if (!id) throw new Error("Stake ID is required.");

    const network = getNetwork();
    const db = getDB();

    const payload = { ...values, network };

    const { data, error } = await db
      .from(TABLE)
      .update(payload)
      .eq("id", id)
      .eq("network", network)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message || "Unable to update stake.");
    }

    return data;
  }

  async function addStake({ project, amount, duration }) {
    if (stakingLock) {
      return { error: "Processing..." };
    }

    stakingLock = true;

    try {
      const user = await getUser();

      const validation = await validateStake({
        project,
        amount,
        duration
      });

      if (!validation.valid) {
        return { error: validation.error };
      }

      const pending = await createPendingStake({
        user,
        project: validation.project,
        amount: validation.amount,
        duration: validation.duration
      });

      let payment;

      try {
        if (typeof window.startPiPayment !== "function") {
          throw new Error("Pi payment engine is not available.");
        }

        payment = await window.startPiPayment({
          amount: validation.amount,
          memo: `Stake in ${validation.project}`,
          stakeId: pending.id
        });
      } catch (error) {
        await updatePendingStake(pending.id, {
          status: "cancelled"
        }).catch(() => {});

        return {
          error: error?.message || "Payment cancelled."
        };
      }

      if (!payment) {
        await updatePendingStake(pending.id, {
          status: "cancelled"
        }).catch(() => {});

        return { error: "Payment failed." };
      }

      const updated = await updatePendingStake(pending.id, {
        payment_id:
          payment.paymentId ||
          payment.identifier ||
          null,
        txid:
          payment.txid ||
          payment.transaction?.txid ||
          payment.paymentId ||
          null,
        status: "paid"
      });

      if (typeof window.recordTx === "function") {
        try {
          await window.recordTx({
            type: "stake",
            project: validation.project,
            amount: validation.amount,
            payment_id: updated.payment_id,
            txid: updated.txid,
            network: getNetwork()
          });
        } catch (error) {
          console.warn("Transaction history record failed:", error);
        }
      }

      return {
        success: true,
        stake: updated,
        payment
      };
    } catch (error) {
      console.error("ALBUKHR STAKING ERROR:", error);

      return {
        error: error?.message || "Unknown staking error."
      };
    } finally {
      stakingLock = false;
    }
  }

  async function getAllStakesMerged() {
    const user = await getUser();
    const network = getNetwork();
    const db = getDB();

    const { data, error } = await db
      .from(TABLE)
      .select("*")
      .eq("userid", user.uid)
      .eq("network", network)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("GET STAKES:", error);
      return [];
    }

    return Array.isArray(data)
      ? data.filter(row => row.status === "paid")
      : [];
  }

  async function getUserStakes() {
    return getAllStakesMerged();
  }

  async function getGlobalStakes() {
    const network = getNetwork();
    const db = getDB();

    const { data, error } = await db
      .from(TABLE)
      .select("*")
      .eq("network", network)
      .eq("status", "paid")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("GLOBAL STAKES:", error);
      return [];
    }

    return Array.isArray(data) ? data : [];
  }

  async function getProjectTotals(project) {
    const code = normalizeProjectCode(project);
    if (!code) {
      return { stake: 0, reward: 0, stakes: [] };
    }

    const stakes = await getAllStakesMerged();

    const projectData = stakes.filter(row =>
      safeString(row.project).trim().toLowerCase() === code.toLowerCase()
    );

    let stake = 0;
    let reward = 0;

    projectData.forEach(row => {
      if (safeString(row.type, "stake") === "stake") {
        stake += safeNumber(row.amount, 0);

        const totalReward = safeNumber(row.reward, 0);
        const withdrawnReward = safeNumber(row.withdrawnReward, 0);

        reward += Math.max(0, totalReward - withdrawnReward);
      }
    });

    return {
      stake: round(stake),
      reward: round(reward),
      stakes: projectData
    };
  }

  /*
    Withdrawals belong to the dedicated withdrawal engine in
    the new architecture. These compatibility functions do
    not mutate stakes directly.
  */
  async function withdrawProjectReward(project, amount) {
    if (typeof window.createWithdrawRequest !== "function") {
      return {
        error: "Withdrawal engine is not available."
      };
    }

    const user = await getUser();
    const safeAmount = safeNumber(amount, 0);

    if (safeAmount <= 0) {
      return { error: "Invalid amount." };
    }

    return window.createWithdrawRequest({
      project: normalizeProjectCode(project),
      amount: safeAmount,
      type: "reward",
      userid: user.uid
    });
  }

  async function withdrawCapital({ project, amount }) {
    if (typeof window.createWithdrawRequest !== "function") {
      return {
        error: "Withdrawal engine is not available."
      };
    }

    const user = await getUser();
    const safeAmount = safeNumber(amount, 0);

    if (safeAmount <= 0) {
      return { error: "Invalid amount." };
    }

    return window.createWithdrawRequest({
      project: normalizeProjectCode(project),
      amount: safeAmount,
      type: "capital",
      userid: user.uid
    });
  }

  async function loadData() {
    return getAllStakesMerged();
  }

  function getStakes() {
    return getAllStakesMerged();
  }

  function getInternalTotals(project) {
    return getProjectTotals(project);
  }

  function getInternalProjectTotals(project) {
    return getProjectTotals(project);
  }

  function addInternalStake(data) {
    return addStake(data);
  }

  window.getMinStake = getMinStake;
  window.getRate = getRewardRate;
  window.calculateStakeReward = calculateReward;
  window.validateStake = validateStake;

  window.createPendingStake = createPendingStake;
  window.updatePendingStake = updatePendingStake;
  window.addStake = addStake;

  window.getAllStakesMerged = getAllStakesMerged;
  window.getUserStakes = getUserStakes;
  window.getGlobalStakes = getGlobalStakes;
  window.getProjectTotals = getProjectTotals;

  window.withdrawProjectReward = withdrawProjectReward;
  window.withdrawCapital = withdrawCapital;

  window.loadData = loadData;
  window.getStakes = getStakes;
  window.getInternalTotals = getInternalTotals;
  window.getInternalProjectTotals = getInternalProjectTotals;
  window.addInternalStake = addInternalStake;

  console.log("ALBUKHR Staking Engine v2 — Architecture Ready");
})(window);
