/* =========================================================
   ALBUKHR STAKING ENGINE v2
   NETWORK-AWARE • SUPABASE CORE • PI PAYMENT READY

   ARCHITECTURE:
   environment-switcher.js
          ↓
   supabase-core.js
          ↓
   staking.js
          ↓
   page controllers / index.html

   RULES:
   - NO LocalStorage persistence
   - NO direct Supabase credentials
   - Uses the shared ALBUKHR Supabase client
   - Uses the authoritative ALBUKHR network
   - Mainnet/Testnet are isolated by the network column
   - Pi authentication/payment remain external integrations
========================================================= */

(function () {
  "use strict";

  /* =======================================================
     DEPENDENCY CHECKS
  ======================================================= */

  function requireNetwork() {
    if (typeof window.requireAlbukhrNetwork !== "function") {
      throw new Error(
        "ALBUKHR Network Core is not loaded. Load environment-switcher.js before staking.js."
      );
    }

    return window.requireAlbukhrNetwork();
  }

  function requireSupabase() {
    if (typeof window.requireAlbukhrSupabaseClient !== "function") {
      throw new Error(
        "ALBUKHR Supabase Core is not loaded. Load js/supabase-core.js before staking.js."
      );
    }

    return window.requireAlbukhrSupabaseClient();
  }

  function safeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalizeProject(project) {
    return String(project ?? "").trim();
  }

  function sameProject(a, b) {
    return normalizeProject(a).toLowerCase() ===
      normalizeProject(b).toLowerCase();
  }

  /* =======================================================
     CURRENT USER

     IMPORTANT:
     This engine deliberately does NOT read or write
     authentication data from LocalStorage.

     Preferred source:
       ensurePiAuth()

     Fallback:
       Pi.getUser()

     No persistent browser storage is used here.
  ======================================================= */

  async function getCurrentUser() {
    try {
      if (typeof window.ensurePiAuth === "function") {
        const user = await window.ensurePiAuth();

        if (user?.uid) {
          return {
            uid: user.uid,
            username: user.username || "",
            wallet_address:
              user.wallet_address ||
              user.walletAddress ||
              ""
          };
        }
      }
    } catch (error) {
      console.warn(
        "ALBUKHR staking: ensurePiAuth() was not ready.",
        error
      );
    }

    try {
      if (
        window.Pi &&
        typeof window.Pi.getUser === "function"
      ) {
        const user = await window.Pi.getUser();

        if (user?.uid) {
          return {
            uid: user.uid,
            username: user.username || "",
            wallet_address:
              user.wallet_address ||
              user.walletAddress ||
              ""
          };
        }
      }
    } catch (error) {
      console.warn(
        "ALBUKHR staking: Pi user was not available.",
        error
      );
    }

    return null;
  }

  /* =======================================================
     PROJECT RULES
  ======================================================= */

  const PROJECT_RULES = Object.freeze({
    Raheem:  { minStake: 10 },
    Hauwal:  { minStake: 10 },
    Barsh:   { minStake: 10 },
    Khairat: { minStake: 10 },
    Urban:   { minStake: 10 },
    Labbaika:{ minStake: 10 },
    Azman:   { minStake: 10 }
  });

  function getMinStake(project) {
    const key = normalizeProject(project);
    return PROJECT_RULES[key]?.minStake || 0;
  }

  /* =======================================================
     REWARD RATES
  ======================================================= */

  const REWARD_RATES = Object.freeze({
    Raheem: {
      30: 0.01,
      60: 0.025,
      90: 0.05
    },

    Hauwal: {
      30: 0.02,
      60: 0.04,
      90: 0.08
    },

    Khairat: {
      30: 0.025,
      60: 0.05,
      90: 0.09
    },

    Barsh: {
      30: 0.03,
      60: 0.06,
      90: 0.10
    },

    Labbaika: {
      30: 0.02,
      60: 0.045,
      90: 0.075
    },

    Urban: {
      30: 0.12,
      60: 0.12,
      90: 0.12
    },

    Azman: {
      30: 0.04,
      60: 0.07,
      90: 0.12
    }
  });

  function getRate(project, duration) {
    const key = normalizeProject(project);
    const days = Number(duration);

    return safeNumber(
      REWARD_RATES[key]?.[days],
      0
    );
  }

  function isSupportedDuration(project, duration) {
    return getRate(project, duration) > 0;
  }

  /* =======================================================
     STAKING LOCK
  ======================================================= */

  let __stakingLock = false;

  /* =======================================================
     CREATE PENDING STAKE
  ======================================================= */

  async function createPendingStake({
    user,
    project,
    amount,
    duration
  }) {
    const network = requireNetwork();
    const supabase = requireSupabase();

    const safeProject = normalizeProject(project);
    const safeAmount = safeNumber(amount);
    const safeDuration = safeNumber(duration);

    const reward =
      safeAmount *
      getRate(safeProject, safeDuration);

    const unlockTime =
      Date.now() +
      safeDuration * 86400000;

    /*
      Use the shared Supabase client.

      Do not manually append network here:
      albukhrInsert() adds the authoritative current
      network automatically.
    */
    const { data, error } =
      await supabase
        .from("stakes")
        .insert({
          userid: user.uid,
          wallet: user.wallet_address || "",
          project: safeProject,
          amount: safeAmount,
          duration: safeDuration,
          reward,
          withdrawnReward: 0,
          withdrawnCapital: 0,
          unlockTime,
          type: "stake",
          status: "pending",
          network
        })
        .select()
        .single();

    if (error) {
      throw new Error(
        error.message ||
        "Failed to create pending stake."
      );
    }

    return data;
  }

  /* =======================================================
     UPDATE PENDING STAKE
  ======================================================= */

  async function updatePendingStake(id, values) {
    if (!id) {
      throw new Error(
        "Stake ID is required."
      );
    }

    const supabase = requireSupabase();
    const network = requireNetwork();

    /*
      Network is included in the WHERE condition so a
      stake from another environment can never be modified.
    */
    const updateValues = {
      ...values,
      network
    };

    const { data, error } =
      await supabase
        .from("stakes")
        .update(updateValues)
        .eq("id", id)
        .eq("network", network)
        .select()
        .maybeSingle();

    if (error) {
      throw new Error(
        error.message ||
        "Failed to update stake."
      );
    }

    if (!data) {
      throw new Error(
        "Stake was not found in the current ALBUKHR network."
      );
    }

    return data;
  }

  /* =======================================================
     ADD STAKE

     Flow:
       1. Resolve current network
       2. Authenticate Pi user
       3. Validate project/amount/duration
       4. Create pending Supabase stake
       5. Start Pi payment
       6. Mark stake paid
       7. Record transaction if engine exists
  ======================================================= */

  async function addStake({
    project,
    amount,
    duration
  }) {
    if (__stakingLock) {
      return {
        error: "Processing..."
      };
    }

    __stakingLock = true;

    let pending = null;

    try {
      const network = requireNetwork();

      /* -----------------------------------------------
         USER
      ------------------------------------------------ */

      const user =
        await getCurrentUser();

      if (!user?.uid) {
        return {
          error: "Login required"
        };
      }

      /* -----------------------------------------------
         VALIDATION
      ------------------------------------------------ */

      const safeProject =
        normalizeProject(project);

      const safeAmount =
        safeNumber(amount);

      const safeDuration =
        safeNumber(duration);

      if (!safeProject) {
        return {
          error: "Invalid project"
        };
      }

      if (
        !Number.isFinite(safeAmount) ||
        safeAmount <= 0
      ) {
        return {
          error: "Invalid amount"
        };
      }

      const minStake =
        getMinStake(safeProject);

      if (minStake <= 0) {
        return {
          error: "Unsupported project"
        };
      }

      if (safeAmount < minStake) {
        return {
          error:
            `Minimum stake is ${minStake} Pi`
        };
      }

      if (!isSupportedDuration(
        safeProject,
        safeDuration
      )) {
        return {
          error:
            "Invalid staking duration"
        };
      }

      /* -----------------------------------------------
         CREATE PENDING STAKE
      ------------------------------------------------ */

      pending =
        await createPendingStake({
          user,
          project: safeProject,
          amount: safeAmount,
          duration: safeDuration
        });

      /* -----------------------------------------------
         PI PAYMENT

         startPiPayment() belongs to the Pi/payment
         integration layer. This engine does not replace it.
      ------------------------------------------------ */

      if (
        typeof window.startPiPayment !==
        "function"
      ) {
        await updatePendingStake(
          pending.id,
          {
            status: "cancelled"
          }
        );

        return {
          error:
            "Pi payment engine is not available."
        };
      }

      let payment;

      try {
        payment =
          await window.startPiPayment({
            amount: safeAmount,
            memo:
              `Stake in ${safeProject}`,
            stakeId: pending.id,
            network
          });

      } catch (error) {
        await updatePendingStake(
          pending.id,
          {
            status: "cancelled"
          }
        );

        return {
          error:
            error?.message ||
            "Payment cancelled"
        };
      }

      /* -----------------------------------------------
         PAYMENT FAILURE
      ------------------------------------------------ */

      if (!payment) {
        await updatePendingStake(
          pending.id,
          {
            status: "cancelled"
          }
        );

        return {
          error: "Payment failed"
        };
      }

      /* -----------------------------------------------
         PAYMENT SUCCESS
      ------------------------------------------------ */

      const paymentId =
        payment.paymentId ||
        payment.identifier ||
        payment.id ||
        null;

      const txid =
        payment.txid ||
        payment.transaction?.txid ||
        payment.transaction?.tx_id ||
        paymentId ||
        null;

      await updatePendingStake(
        pending.id,
        {
          payment_id: paymentId,
          txid,
          status: "paid",
          network
        }
      );

      /* -----------------------------------------------
         TRANSACTION ENGINE
      ------------------------------------------------ */

      if (
        typeof window.recordTx ===
        "function"
      ) {
        try {
          await window.recordTx({
            type: "stake",
            project: safeProject,
            amount: safeAmount,
            timestamp: Date.now(),
            network
          });
        } catch (error) {
          /*
            Payment/stake is already confirmed.
            A transaction-history failure must not turn a
            successful stake into a false failure.
          */
          console.warn(
            "ALBUKHR staking: recordTx() failed after stake confirmation.",
            error
          );
        }
      }

      return {
        success: true,
        network,
        stake: pending,
        payment
      };

    } catch (error) {
      console.error(
        "ALBUKHR staking addStake():",
        error
      );

      if (pending?.id) {
        try {
          await updatePendingStake(
            pending.id,
            {
              status: "cancelled"
            }
          );
        } catch (cancelError) {
          console.error(
            "Could not cancel pending stake:",
            cancelError
          );
        }
      }

      return {
        error:
          error?.message ||
          "Unknown staking error"
      };

    } finally {
      __stakingLock = false;
    }
  }

  /* =======================================================
     GET USER STAKES
  ======================================================= */

  async function getAllStakesMerged() {
    try {
      const user =
        await getCurrentUser();

      if (!user?.uid) {
        return [];
      }

      const supabase =
        requireSupabase();

      const network =
        requireNetwork();

      const { data, error } =
        await supabase
          .from("stakes")
          .select("*")
          .eq("userid", user.uid)
          .eq("network", network)
          .order("created_at", {
            ascending: false
          });

      if (error) {
        throw new Error(
          error.message ||
          "Failed to load user stakes."
        );
      }

      return Array.isArray(data)
        ? data.filter(
            stake =>
              stake.status === "paid"
          )
        : [];

    } catch (error) {
      console.error(
        "ALBUKHR GET STAKES:",
        error
      );

      return [];
    }
  }

  /* =======================================================
     GLOBAL STAKES
  ======================================================= */

  async function getGlobalStakes() {
    try {
      const supabase =
        requireSupabase();

      const network =
        requireNetwork();

      const { data, error } =
        await supabase
          .from("stakes")
          .select("*")
          .eq("network", network)
          .eq("status", "paid")
          .order("created_at", {
            ascending: false
          });

      if (error) {
        throw new Error(
          error.message ||
          "Failed to load global stakes."
        );
      }

      return Array.isArray(data)
        ? data
        : [];

    } catch (error) {
      console.error(
        "ALBUKHR GLOBAL STAKES:",
        error
      );

      return [];
    }
  }

  /* =======================================================
     PROJECT TOTALS
  ======================================================= */

  async function getProjectTotals(project) {
    const stakes =
      await getAllStakesMerged();

    const projectData =
      stakes.filter(stake =>
        sameProject(
          stake.project,
          project
        )
      );

    let stake = 0;
    let reward = 0;

    projectData.forEach(stakeRow => {
      const amount =
        safeNumber(
          stakeRow.amount
        );

      const totalReward =
        safeNumber(
          stakeRow.reward
        );

      const withdrawnReward =
        safeNumber(
          stakeRow.withdrawnReward
        );

      if (
        stakeRow.type === "stake"
      ) {
        stake += amount;

        reward += Math.max(
          0,
          totalReward -
          withdrawnReward
        );
      }
    });

    return {
      stake,
      reward,
      stakes: projectData
    };
  }

  /* =======================================================
     USER STAKES
  ======================================================= */

  async function getUserStakes() {
    return getAllStakesMerged();
  }

  /* =======================================================
     WITHDRAW PROJECT REWARD

     This function only updates reward accounting.
     Actual Pi payout/transfer remains the responsibility
     of the appropriate withdrawal/payment engine.
  ======================================================= */

  async function withdrawProjectReward(
    project,
    amount
  ) {
    try {
      const user =
        await getCurrentUser();

      if (!user?.uid) {
        return {
          error: "Login required"
        };
      }

      const requested =
        safeNumber(amount);

      if (
        !Number.isFinite(requested) ||
        requested <= 0
      ) {
        return {
          error: "Invalid amount"
        };
      }

      const supabase =
        requireSupabase();

      const network =
        requireNetwork();

      const { data: stakes, error } =
        await supabase
          .from("stakes")
          .select("*")
          .eq("userid", user.uid)
          .eq("project", project)
          .eq("network", network)
          .eq("status", "paid")
          .order("created_at", {
            ascending: true
          });

      if (error) {
        throw new Error(
          error.message ||
          "Failed to load reward stakes."
        );
      }

      const rows =
        Array.isArray(stakes)
          ? stakes
          : [];

      /*
        First calculate the total available amount.
        This prevents partial updates followed by an
        "Insufficient reward" error.
      */
      const availableTotal =
        rows.reduce(
          (total, stake) => {
            const reward =
              safeNumber(
                stake.reward
              );

            const withdrawn =
              safeNumber(
                stake.withdrawnReward
              );

            return total +
              Math.max(
                0,
                reward - withdrawn
              );
          },
          0
        );

      if (
        availableTotal <
        requested
      ) {
        return {
          error:
            "Insufficient reward"
        };
      }

      let remaining =
        requested;

      for (const stake of rows) {
        if (remaining <= 0) {
          break;
        }

        const reward =
          safeNumber(
            stake.reward
          );

        const withdrawn =
          safeNumber(
            stake.withdrawnReward
          );

        const available =
          Math.max(
            0,
            reward - withdrawn
          );

        if (available <= 0) {
          continue;
        }

        const take =
          Math.min(
            available,
            remaining
          );

        const newWithdrawn =
          withdrawn + take;

        const { error: updateError } =
          await supabase
            .from("stakes")
            .update({
              withdrawnReward:
                newWithdrawn
            })
            .eq("id", stake.id)
            .eq("userid", user.uid)
            .eq("network", network);

        if (updateError) {
          throw new Error(
            updateError.message ||
            "Failed to update reward withdrawal."
          );
        }

        remaining -= take;
      }

      if (remaining > 0) {
        throw new Error(
          "Reward withdrawal could not be completed."
        );
      }

      return {
        success: true,
        network,
        amount: requested
      };

    } catch (error) {
      console.error(
        "ALBUKHR WITHDRAW REWARD:",
        error
      );

      return {
        error:
          error?.message ||
          "Reward withdrawal failed"
      };
    }
  }

  /* =======================================================
     WITHDRAW CAPITAL

     Capital can only be accounted as withdrawable when
     the individual stake's unlockTime has passed.

     Actual Pi transfer remains external.
  ======================================================= */

  async function withdrawCapital({
    project,
    amount
  }) {
    try {
      const user =
        await getCurrentUser();

      if (!user?.uid) {
        return {
          error: "Login required"
        };
      }

      const requested =
        safeNumber(amount);

      if (
        !Number.isFinite(requested) ||
        requested <= 0
      ) {
        return {
          error: "Invalid amount"
        };
      }

      const supabase =
        requireSupabase();

      const network =
        requireNetwork();

      const { data: stakes, error } =
        await supabase
          .from("stakes")
          .select("*")
          .eq("userid", user.uid)
          .eq("project", project)
          .eq("network", network)
          .eq("status", "paid")
          .order("created_at", {
            ascending: true
          });

      if (error) {
        throw new Error(
          error.message ||
          "Failed to load capital stakes."
        );
      }

      const rows =
        Array.isArray(stakes)
          ? stakes
          : [];

      const now =
        Date.now();

      const unlockedRows =
        rows.filter(stake => {
          const unlockTime =
            safeNumber(
              stake.unlockTime
            );

          const available =
            safeNumber(
              stake.amount
            ) -
            safeNumber(
              stake.withdrawnCapital
            );

          return (
            now >= unlockTime &&
            available > 0
          );
        });

      const availableTotal =
        unlockedRows.reduce(
          (total, stake) =>
            total +
            Math.max(
              0,
              safeNumber(stake.amount) -
              safeNumber(stake.withdrawnCapital)
            ),
          0
        );

      if (
        availableTotal <
        requested
      ) {
        return {
          error:
            "Insufficient unlocked capital"
        };
      }

      let remaining =
        requested;

      for (const stake of unlockedRows) {
        if (remaining <= 0) {
          break;
        }

        const capital =
          safeNumber(
            stake.amount
          );

        const withdrawn =
          safeNumber(
            stake.withdrawnCapital
          );

        const available =
          Math.max(
            0,
            capital - withdrawn
          );

        if (available <= 0) {
          continue;
        }

        const take =
          Math.min(
            available,
            remaining
          );

        const newWithdrawn =
          withdrawn + take;

        const { error: updateError } =
          await supabase
            .from("stakes")
            .update({
              withdrawnCapital:
                newWithdrawn
            })
            .eq("id", stake.id)
            .eq("userid", user.uid)
            .eq("network", network);

        if (updateError) {
          throw new Error(
            updateError.message ||
            "Failed to update capital withdrawal."
          );
        }

        remaining -= take;
      }

      if (remaining > 0) {
        throw new Error(
          "Capital withdrawal could not be completed."
        );
      }

      return {
        success: true,
        network,
        amount: requested
      };

    } catch (error) {
      console.error(
        "ALBUKHR WITHDRAW CAPITAL:",
        error
      );

      return {
        error:
          error?.message ||
          "Capital withdrawal failed"
      };
    }
  }

  /* =======================================================
     LOAD DATA
  ======================================================= */

  async function loadData() {
    try {
      const stakes =
        await getAllStakesMerged();

      console.log(
        "ALBUKHR STAKES:",
        {
          network: requireNetwork(),
          count: stakes.length
        }
      );

      return stakes;

    } catch (error) {
      console.error(
        "ALBUKHR LOAD DATA:",
        error
      );

      return [];
    }
  }

  /* =======================================================
     BACKWARD-COMPATIBLE HELPERS
  ======================================================= */

  function getStakes() {
    return getAllStakesMerged();
  }

  function getInternalTotals() {
    return getGlobalStakes();
  }

  function getInternalProjectTotals(project) {
    return getProjectTotals(project);
  }

  function addInternalStake(data) {
    return addStake(data);
  }

  /* =======================================================
     PUBLIC API
  ======================================================= */

  window.getCurrentAlbukhrStakingUser =
    getCurrentUser;

  window.getAlbukhrStakingMinStake =
    getMinStake;

  window.getAlbukhrStakingRate =
    getRate;

  window.getAlbukhrStakingProjectRules =
    () => PROJECT_RULES;

  window.getAlbukhrStakingRewardRates =
    () => REWARD_RATES;

  window.createAlbukhrPendingStake =
    createPendingStake;

  window.updateAlbukhrPendingStake =
    updatePendingStake;

  window.addStake =
    addStake;

  window.getAllStakesMerged =
    getAllStakesMerged;

  window.getGlobalStakes =
    getGlobalStakes;

  window.getProjectTotals =
    getProjectTotals;

  window.getUserStakes =
    getUserStakes;

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

  /* =======================================================
     DIAGNOSTIC
  ======================================================= */

  try {
    console.log(
      "ALBUKHR Staking Engine v2 loaded. " +
      "Supabase Core + network-aware mode active."
    );
  } catch (_) {}

})();
