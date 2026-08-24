/* =========================================================
   ALBUKHR — STAKING ENGINE v3
   USER DOMAIN ENGINE / NEW ARCHITECTURE

   FILE:
   js/staking/staking-engine.js

   FOUNDATION:
   - js/core/environment-switcher.js
   - js/core/pi-auth-core.js
   - js/core/pi-payment.js
   - js/core/supabase-core.js

   DOMAIN DEPENDENCIES:
   - js/projects/projects-engine.js
   - Dedicated withdrawal engine (for withdrawal requests)
   - Optional unified transaction engine (recordTx)

   ARCHITECTURE RULES:
   - Supabase is the source of truth for stake records.
   - No LocalStorage persistence.
   - No hard-coded Supabase URL/key.
   - No direct Supabase REST calls.
   - Network comes only from the shared environment foundation.
   - Pi authentication comes only from the shared Pi Auth Core.
   - Pi payments go through the shared Pi Payment Engine.
   - Project identity/rules come from the Projects Engine.
   - No project emoji/icon configuration.
   - No hard-coded project registry.
   - Every stake read/write is network-scoped.
   - Withdrawal mutation belongs to the withdrawal engine.
   - This engine does not directly mutate withdrawal balances.
========================================================= */

"use strict";

(function (window) {

  const TABLE = "stakes";

  let stakingLock = false;

  /* =========================================================
     FOUNDATION: NETWORK
  ========================================================= */

  function getNetwork() {

    if (
      typeof window.requireAlbukhrNetwork !==
      "function"
    ) {
      throw new Error(
        "ALBUKHR Environment Foundation is not available. Load js/core/environment-switcher.js first."
      );
    }

    const network =
      window.requireAlbukhrNetwork();

    if (
      network !== "mainnet" &&
      network !== "testnet"
    ) {
      throw new Error(
        "ALBUKHR staking operation refused: invalid network."
      );
    }

    return network;
  }


  /* =========================================================
     FOUNDATION: SUPABASE
  ========================================================= */

  function getDB() {

    if (
      typeof window.requireAlbukhrSupabaseClient !==
      "function"
    ) {
      throw new Error(
        "ALBUKHR Supabase Core is not available. Load js/core/supabase-core.js first."
      );
    }

    const db =
      window.requireAlbukhrSupabaseClient();

    if (!db) {
      throw new Error(
        "ALBUKHR Supabase client is not available."
      );
    }

    return db;
  }


  /* =========================================================
     FOUNDATION: PI AUTH
  ========================================================= */

  async function getUser() {

    /*
     * Preferred new foundation API.
     */
    if (
      window.AlbukhrPiAuth &&
      typeof window.AlbukhrPiAuth.ensurePiAuth ===
      "function"
    ) {

      const user =
        await window.AlbukhrPiAuth.ensurePiAuth();

      if (!user?.uid) {
        throw new Error(
          "Authenticated Pi user is required."
        );
      }

      return user;
    }

    /*
     * Compatibility alias exposed by
     * pi-auth-core.js during migration.
     */
    if (
      typeof window.ensurePiAuth ===
      "function"
    ) {

      const user =
        await window.ensurePiAuth();

      if (!user?.uid) {
        throw new Error(
          "Authenticated Pi user is required."
        );
      }

      return user;
    }

    throw new Error(
      "ALBUKHR Pi Auth Core is not available. Load js/core/pi-auth-core.js first."
    );
  }


  /* =========================================================
     HELPERS
  ========================================================= */

  function safeNumber(
    value,
    fallback = 0
  ) {

    const n =
      Number(value);

    return Number.isFinite(n)
      ? n
      : fallback;
  }


  function safeString(
    value,
    fallback = ""
  ) {

    return value === null ||
      value === undefined
      ? fallback
      : String(value);
  }


  function round(
    value,
    decimals = 8
  ) {

    const n =
      safeNumber(value, 0);

    const factor =
      10 ** decimals;

    return (
      Math.round(
        n * factor
      ) / factor
    );
  }


  function normalizeProjectCode(
    value
  ) {

    return safeString(
      value
    ).trim();
  }


  function getPaymentEngine() {

    if (
      window.AlbukhrPiPayment &&
      typeof window.AlbukhrPiPayment.startPiPayment ===
      "function"
    ) {
      return window.AlbukhrPiPayment;
    }

    if (
      typeof window.startPiPayment ===
      "function"
    ) {
      return {
        startPiPayment:
          window.startPiPayment
      };
    }

    throw new Error(
      "ALBUKHR Pi Payment Engine is not available. Load js/core/pi-payment.js first."
    );
  }


  /* =========================================================
     PROJECTS ENGINE
  ========================================================= */

  async function getProjectMeta(
    projectCode
  ) {

    const code =
      normalizeProjectCode(
        projectCode
      );

    if (!code) {
      return null;
    }

    if (
      typeof window.getProjectMeta ===
      "function"
    ) {

      return await window.getProjectMeta(
        code
      );
    }

    if (
      typeof window.getProjectByCode ===
      "function"
    ) {

      return await window.getProjectByCode(
        code
      );
    }

    throw new Error(
      "ALBUKHR Projects Engine is not available."
    );
  }


  async function getProjectRules(
    projectCode
  ) {

    if (
      typeof window.getProjectRules !==
      "function"
    ) {

      throw new Error(
        "ALBUKHR Projects Engine rules resolver is not available."
      );
    }

    return await window.getProjectRules(
      projectCode
    );
  }


  async function getProjectDurations(
    projectCode
  ) {

    if (
      typeof window.getProjectDurations ===
      "function"
    ) {

      const durations =
        await window.getProjectDurations(
          projectCode
        );

      return Array.isArray(durations)
        ? durations
            .map(Number)
            .filter(Number.isFinite)
        : [];
    }

    const meta =
      await getProjectMeta(
        projectCode
      );

    return Array.isArray(
      meta?.durations
    )
      ? meta.durations
          .map(Number)
          .filter(Number.isFinite)
      : [];
  }


  async function getMinStake(
    projectCode
  ) {

    const meta =
      await getProjectMeta(
        projectCode
      );

    const rules =
      await getProjectRules(
        projectCode
      );

    const ruleMin =
      safeNumber(
        rules?.min_stake,
        NaN
      );

    if (
      Number.isFinite(ruleMin) &&
      ruleMin > 0
    ) {
      return ruleMin;
    }

    const metaMin =
      safeNumber(
        meta?.min_stake,
        NaN
      );

    if (
      Number.isFinite(metaMin) &&
      metaMin > 0
    ) {
      return metaMin;
    }

    /*
     * Deliberately no legacy 10 Pi fallback.
     * The new architecture requires the project
     * registry/rules layer to define this value.
     */
    return 0;
  }


  async function getRewardRate(
    projectCode,
    duration
  ) {

    const rules =
      await getProjectRules(
        projectCode
      );

    /*
     * Current Projects Engine contract:
     * reward_rate is the resolved rate supplied
     * by the project rules layer.
     *
     * The duration argument remains part of the
     * public API so the Projects Engine can later
     * expose duration-specific rules without
     * changing the staking API.
     */
    const rate =
      safeNumber(
        rules?.reward_rate,
        0
      );

    if (rate <= 0) {
      return 0;
    }

    return rate;
  }


  async function calculateReward(
    projectCode,
    amount,
    duration
  ) {

    const principal =
      safeNumber(
        amount,
        0
      );

    if (principal <= 0) {
      return 0;
    }

    const rate =
      await getRewardRate(
        projectCode,
        duration
      );

    return round(
      principal * rate
    );
  }


  /* =========================================================
     STAKE VALIDATION
  ========================================================= */

  async function validateStake({
    project,
    amount,
    duration
  } = {}) {

    const code =
      normalizeProjectCode(
        project
      );

    const safeAmount =
      safeNumber(
        amount,
        0
      );

    const safeDuration =
      safeNumber(
        duration,
        0
      );

    if (!code) {
      return {
        valid: false,
        error: "Invalid project."
      };
    }

    if (safeAmount <= 0) {
      return {
        valid: false,
        error: "Invalid amount."
      };
    }

    if (safeDuration <= 0) {
      return {
        valid: false,
        error: "Invalid duration."
      };
    }

    const meta =
      await getProjectMeta(
        code
      );

    if (!meta) {
      return {
        valid: false,
        error:
          `Project "${code}" was not found.`
      };
    }

    if (
      meta.status &&
      String(
        meta.status
      ).toLowerCase() !== "active"
    ) {
      return {
        valid: false,
        error:
          "Project is not active."
      };
    }

    if (
      meta.staking_enabled === false
    ) {
      return {
        valid: false,
        error:
          "Staking is disabled for this project."
      };
    }

    const durations =
      await getProjectDurations(
        code
      );

    if (
      durations.length &&
      !durations.includes(
        safeDuration
      )
    ) {
      return {
        valid: false,
        error:
          `Duration ${safeDuration} days is not available for this project.`
      };
    }

    const minStake =
      await getMinStake(
        code
      );

    if (minStake <= 0) {
      return {
        valid: false,
        error:
          "Project minimum stake is not configured."
      };
    }

    if (
      safeAmount < minStake
    ) {
      return {
        valid: false,
        error:
          `Minimum stake is ${minStake} Pi.`
      };
    }

    const reward =
      await calculateReward(
        code,
        safeAmount,
        safeDuration
      );

    if (reward <= 0) {
      return {
        valid: false,
        error:
          "Project reward rule is not configured."
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


  /* =========================================================
     PENDING STAKE
     ========================================================= */

  async function createPendingStake({
    user,
    project,
    amount,
    duration
  } = {}) {

    if (!user?.uid) {
      throw new Error(
        "Authenticated user is required."
      );
    }

    const network =
      getNetwork();

    const db =
      getDB();

    const code =
      normalizeProjectCode(
        project
      );

    const safeAmount =
      safeNumber(
        amount,
        0
      );

    const safeDuration =
      safeNumber(
        duration,
        0
      );

    const reward =
      await calculateReward(
        code,
        safeAmount,
        safeDuration
      );

    const row = {

      userid:
        String(user.uid),

      wallet:
        user.wallet_address ||
        user.wallet ||
        "",

      project:
        code,

      amount:
        safeAmount,

      duration:
        safeDuration,

      reward,

      withdrawnReward:
        0,

      withdrawnCapital:
        0,

      unlockTime:
        Date.now() +
        (
          safeDuration *
          86400000
        ),

      type:
        "stake",

      status:
        "pending",

      network,

      payment_id:
        null,

      txid:
        null
    };

    const {
      data,
      error
    } =
      await db
        .from(TABLE)
        .insert(row)
        .select("*")
        .single();

    if (error) {
      throw new Error(
        error.message ||
        "Unable to create pending stake."
      );
    }

    return data;
  }


  async function updatePendingStake(
    id,
    values = {}
  ) {

    if (!id) {
      throw new Error(
        "Stake ID is required."
      );
    }

    const network =
      getNetwork();

    const db =
      getDB();

    /*
     * Never permit a caller to move a stake
     * between networks.
     */
    const payload = {
      ...values,
      network
    };

    const {
      data,
      error
    } =
      await db
        .from(TABLE)
        .update(payload)
        .eq("id", id)
        .eq("network", network)
        .select("*")
        .single();

    if (error) {
      throw new Error(
        error.message ||
        "Unable to update stake."
      );
    }

    return data;
  }


  /* =========================================================
     ADD STAKE
  ========================================================= */

  async function addStake({
    project,
    amount,
    duration
  } = {}) {

    if (stakingLock) {
      return {
        error:
          "Processing..."
      };
    }

    stakingLock = true;

    let pending = null;

    try {

      const user =
        await getUser();

      const validation =
        await validateStake({
          project,
          amount,
          duration
        });

      if (!validation.valid) {
        return {
          error:
            validation.error
        };
      }

      const network =
        getNetwork();

      /*
       * Create the pending record before the
       * payment starts so the payment can carry
       * the stake ID as metadata.
       */
      pending =
        await createPendingStake({
          user,
          project:
            validation.project,
          amount:
            validation.amount,
          duration:
            validation.duration
        });

      const paymentEngine =
        getPaymentEngine();

      let payment;

      try {

        payment =
          await paymentEngine.startPiPayment({

            amount:
              validation.amount,

            memo:
              `Stake in ${validation.project}`,

            metadata: {

              stakeId:
                pending.id,

              project:
                validation.project,

              duration:
                validation.duration,

              network,

              type:
                "stake"
            }

          });

      } catch (error) {

        /*
         * A cancelled/failed payment leaves
         * the pending row auditable rather than
         * deleting it.
         */
        await updatePendingStake(
          pending.id,
          {
            status:
              "cancelled"
          }
        ).catch(() => {});

        return {
          error:
            error?.message ||
            "Payment cancelled."
        };
      }

      if (!payment) {

        await updatePendingStake(
          pending.id,
          {
            status:
              "cancelled"
          }
        ).catch(() => {});

        return {
          error:
            "Payment failed."
        };
      }

      const paymentId =
        payment.paymentId ||
        payment.identifier ||
        null;

      const txid =
        payment.txid ||
        payment.transaction?.txid ||
        null;

      if (!paymentId) {

        await updatePendingStake(
          pending.id,
          {
            status:
              "payment_completed_missing_id"
          }
        ).catch(() => {});

        return {
          error:
            "Payment completed but no payment ID was returned."
        };
      }

      /*
       * Do not fall back from txid to paymentId.
       * They are different identifiers.
       */
      if (!txid) {

        await updatePendingStake(
          pending.id,
          {
            payment_id:
              paymentId,

            status:
              "payment_completed_missing_txid"
          }
        ).catch(() => {});

        return {
          error:
            "Payment completed but no transaction ID was returned."
        };
      }

      const updated =
        await updatePendingStake(
          pending.id,
          {
            payment_id:
              paymentId,

            txid,

            status:
              "paid"
          }
        );

      /*
       * Optional transaction history integration.
       * The stake remains the primary source of truth.
       */
      if (
        typeof window.recordTx ===
        "function"
      ) {

        try {

          await window.recordTx({

            type:
              "stake",

            project:
              validation.project,

            amount:
              validation.amount,

            payment_id:
              paymentId,

            txid,

            network
          });

        } catch (error) {

          console.warn(
            "ALBUKHR transaction history record failed:",
            error
          );
        }
      }

      return {
        success:
          true,

        stake:
          updated,

        payment
      };

    } catch (error) {

      console.error(
        "ALBUKHR STAKING ERROR:",
        error
      );

      /*
       * If a pending row exists and the flow
       * failed before successful payment
       * completion, attempt to keep its state
       * auditable.
       */
      if (pending?.id) {

        await updatePendingStake(
          pending.id,
          {
            status:
              "failed"
          }
        ).catch(() => {});
      }

      return {
        error:
          error?.message ||
          "Unknown staking error."
      };

    } finally {

      stakingLock = false;
    }
  }


  /* =========================================================
     USER STAKES
  ========================================================= */

  async function getAllStakesMerged() {

    const user =
      await getUser();

    const network =
      getNetwork();

    const db =
      getDB();

    const {
      data,
      error
    } =
      await db
        .from(TABLE)
        .select("*")
        .eq(
          "userid",
          user.uid
        )
        .eq(
          "network",
          network
        )
        .order(
          "created_at",
          {
            ascending:
              false
          }
        );

    if (error) {

      console.error(
        "ALBUKHR GET STAKES:",
        error
      );

      return [];
    }

    return Array.isArray(data)
      ? data.filter(
          row =>
            row.status ===
            "paid"
        )
      : [];
  }


  async function getUserStakes() {
    return getAllStakesMerged();
  }


  /* =========================================================
     GLOBAL STAKES
     ========================================================= */

  async function getGlobalStakes() {

    const network =
      getNetwork();

    const db =
      getDB();

    const {
      data,
      error
    } =
      await db
        .from(TABLE)
        .select("*")
        .eq(
          "network",
          network
        )
        .eq(
          "status",
          "paid"
        )
        .order(
          "created_at",
          {
            ascending:
              false
          }
        );

    if (error) {

      console.error(
        "ALBUKHR GLOBAL STAKES:",
        error
      );

      return [];
    }

    return Array.isArray(data)
      ? data
      : [];
  }


  /* =========================================================
     PROJECT TOTALS
     ========================================================= */

  async function getProjectTotals(
    project
  ) {

    const code =
      normalizeProjectCode(
        project
      );

    if (!code) {
      return {
        stake:
          0,

        reward:
          0,

        stakes:
          []
      };
    }

    /*
     * This function intentionally uses the
     * authenticated user's stakes. Global
     * aggregation is provided by getGlobalStakes().
     */
    const stakes =
      await getAllStakesMerged();

    const projectData =
      stakes.filter(
        row =>
          safeString(
            row.project
          )
            .trim()
            .toLowerCase() ===
          code.toLowerCase()
      );

    let stake = 0;
    let reward = 0;

    projectData.forEach(
      row => {

        if (
          safeString(
            row.type,
            "stake"
          ) ===
          "stake"
        ) {

          stake +=
            safeNumber(
              row.amount,
              0
            );

          const totalReward =
            safeNumber(
              row.reward,
              0
            );

          const withdrawnReward =
            safeNumber(
              row.withdrawnReward,
              0
            );

          reward +=
            Math.max(
              0,
              totalReward -
              withdrawnReward
            );
        }
      }
    );

    return {

      stake:
        round(stake),

      reward:
        round(reward),

      stakes:
        projectData
    };
  }


  /* =========================================================
     WITHDRAWAL COMPATIBILITY ADAPTERS
     ========================================================= */

  async function withdrawProjectReward(
    project,
    amount
  ) {

    if (
      typeof window.createWithdrawRequest !==
      "function"
    ) {

      return {
        error:
          "Withdrawal engine is not available."
      };
    }

    const user =
      await getUser();

    const network =
      getNetwork();

    const safeAmount =
      safeNumber(
        amount,
        0
      );

    if (safeAmount <= 0) {
      return {
        error:
          "Invalid amount."
      };
    }

    return window.createWithdrawRequest({
      project:
        normalizeProjectCode(
          project
        ),

      amount:
        safeAmount,

      type:
        "reward",

      userid:
        user.uid,

      network
    });
  }


  async function withdrawCapital({
    project,
    amount
  } = {}) {

    if (
      typeof window.createWithdrawRequest !==
      "function"
    ) {

      return {
        error:
          "Withdrawal engine is not available."
      };
    }

    const user =
      await getUser();

    const network =
      getNetwork();

    const safeAmount =
      safeNumber(
        amount,
        0
      );

    if (safeAmount <= 0) {
      return {
        error:
          "Invalid amount."
      };
    }

    return window.createWithdrawRequest({
      project:
        normalizeProjectCode(
          project
        ),

      amount:
        safeAmount,

      type:
        "capital",

      userid:
        user.uid,

      network
    });
  }


  /* =========================================================
     COMPATIBILITY API
  ========================================================= */

  async function loadData() {
    return getAllStakesMerged();
  }


  function getStakes() {
    return getAllStakesMerged();
  }


  function getInternalTotals(
    project
  ) {
    return getProjectTotals(
      project
    );
  }


  function getInternalProjectTotals(
    project
  ) {
    return getProjectTotals(
      project
    );
  }


  function addInternalStake(
    data
  ) {
    return addStake(
      data
    );
  }


  /* =========================================================
     PUBLIC API
  ========================================================= */

  const StakingEngine = {

    getNetwork,

    getMinStake,

    getRate:
      getRewardRate,

    calculateStakeReward:
      calculateReward,

    validateStake,

    createPendingStake,

    updatePendingStake,

    addStake,

    getAllStakesMerged,

    getUserStakes,

    getGlobalStakes,

    getProjectTotals,

    withdrawProjectReward,

    withdrawCapital,

    loadData,

    getStakes,

    getInternalTotals,

    getInternalProjectTotals,

    addInternalStake
  };


  window.AlbukhrStaking =
    StakingEngine;


  /*
   * Existing public API compatibility.
   */
  window.getMinStake =
    getMinStake;

  window.getRate =
    getRewardRate;

  window.calculateStakeReward =
    calculateReward;

  window.validateStake =
    validateStake;

  window.createPendingStake =
    createPendingStake;

  window.updatePendingStake =
    updatePendingStake;

  window.addStake =
    addStake;

  window.getAllStakesMerged =
    getAllStakesMerged;

  window.getUserStakes =
    getUserStakes;

  window.getGlobalStakes =
    getGlobalStakes;

  window.getProjectTotals =
    getProjectTotals;

  window.withdrawProjectReward =
    withdrawProjectReward;

  window.withdrawCapital =
    withdrawCapital;

  window.loadData =
    loadData;

  window.getStakes =
    getStakes;

  window.getInternalTotals =
    getInternalTotals;

  window.getInternalProjectTotals =
    getInternalProjectTotals;

  window.addInternalStake =
    addInternalStake;


  /*
   * Engine readiness signal.
   */
  try {

    window.dispatchEvent(
      new CustomEvent(
        "albukhrStakingEngineReady"
      )
    );

  } catch (_) {
    /* Ignore event dispatch errors. */
  }


  console.log(
    "ALBUKHR Staking Engine v3 — User Architecture Ready"
  );

})(window);
