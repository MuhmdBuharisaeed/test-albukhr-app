// =======================================
// ALBUKHR TESTNET STAKING ENGINE v2
// Pi Testnet • Supabase Core
// NETWORK ISOLATED
// =======================================
//
// DEPENDS ON:
// 1) js/supabase-core.js
// 2) js/projects-engine.js
// 3) existing Pi authentication/payment helpers
//
// IMPORTANT:
// - No localStorage persistence.
// - Testnet ONLY.
// - Every stakes read/write is filtered by network=testnet.
// - Supabase is the source of truth.
//
// This file intentionally preserves the existing public API:
//   addStake()
//   getStakes()
//   getAllStakesMerged()
//   getGlobalStakes()
//   getProjectTotals()
//   getUserStakes()
//   withdrawProjectReward()
//   withdrawCapital()
//   loadData()
//   getInternalTotals()
//   getInternalProjectTotals()
//   addInternalStake()
// =======================================

const STAKES_TABLE = "stakes";
const STAKING_NETWORK = "testnet";

/* ======================================
   SUPABASE CLIENT
====================================== */

function getStakingSupabaseClient(){

  if(
    typeof window.getAlbukhrSupabaseClient ===
    "function"
  ){

    const client =
      window.getAlbukhrSupabaseClient();

    if(client){
      return client;
    }

  }

  if(window.albukhrSupabase){
    return window.albukhrSupabase;
  }

  console.warn(
    "staking-testnet: ALBUKHR Supabase Core client not found."
  );

  return null;
}


/* ======================================
   SAFE HELPERS
====================================== */

function stakingSafeNumber(
  value,
  fallback=0
){

  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : fallback;

}


function stakingSafeString(
  value,
  fallback=""
){

  if(
    value === null ||
    value === undefined
  ){

    return fallback;

  }

  return String(value);

}


/* ======================================
   CURRENT NETWORK ASSERTION
====================================== */

function assertMainnetStakingNetwork(){

  /*
    The file itself is testnet-only.

    If the shared environment resolver exists,
    refuse to operate when the browser is explicitly
    on testnet.
  */

  if(
    typeof window.getAlbukhrProjectsNetwork ===
    "function"
  ){

    const network =
      window.getAlbukhrProjectsNetwork();

    if(network !== STAKING_NETWORK){

      throw new Error(
        "Mainnet staking engine cannot operate on testnet."
      );

    }

  }

  return STAKING_NETWORK;

}


/* ======================================
   CURRENT USER
====================================== */

function getCurrentUser(){

  try{

    if(
      window.Pi &&
      typeof window.Pi.getUser ===
      "function"
    ){

      const user =
        window.Pi.getUser();

      if(user?.uid){

        return {

          uid:
            user.uid,

          username:
            user.username || "",

          wallet_address:
            user.wallet_address || ""

        };

      }

    }

  }catch(e){

    console.warn(
      "Pi user not ready:",
      e
    );

  }

  /*
    No localStorage fallback.

    Authentication/session state must come from
    the active ALBUKHR/Pi authentication layer.
  */

  return null;

}


/* ======================================
   PROJECT RULES
====================================== */

const PROJECT_RULES = {

  Raheem:{
    minStake:10
  },

  Hauwal:{
    minStake:10
  },

  Barsh:{
    minStake:10
  },

  Khairat:{
    minStake:10
  },

  Urban:{
    minStake:10
  },

  Labbaika:{
    minStake:10
  },

  Azman:{
    minStake:10
  }

};


function getMinStake(project){

  return (
    PROJECT_RULES?.[project]?.minStake ||
    0
  );

}


/* ======================================
   STAKING LOCK
====================================== */

let __stakingLock = false;


/* ======================================
   REWARD RATES
====================================== */

function getRate(
  project,
  duration
){

  const table = {

    Raheem:{
      30:0.01,
      60:0.025,
      90:0.05
    },

    Hauwal:{
      30:0.02,
      60:0.04,
      90:0.08
    },

    Khairat:{
      30:0.025,
      60:0.05,
      90:0.09
    },

    Barsh:{
      30:0.03,
      60:0.06,
      90:0.10
    },

    Labbaika:{
      30:0.02,
      60:0.045,
      90:0.075
    },

    Urban:{
      30:0.12,
      60:0.12,
      90:0.12
    },

    Azman:{
      30:0.04,
      60:0.07,
      90:0.12
    }

  };

  return (
    table?.[project]?.[
      Number(duration)
    ] ||
    0
  );

}


/* ======================================
   CREATE PENDING STAKE
====================================== */

async function createPendingStake({

  user,

  project,

  amount,

  duration

}){

  assertMainnetStakingNetwork();

  const supabase =
    getStakingSupabaseClient();

  if(!supabase){

    throw new Error(
      "Supabase client not available"
    );

  }

  const reward =
    Number(amount) *
    getRate(
      project,
      Number(duration)
    );

  const payload = {

    userid:
      user.uid,

    wallet:
      user.wallet_address || "",

    project,

    amount:
      Number(amount),

    duration:
      Number(duration),

    reward,

    withdrawnReward:
      0,

    withdrawnCapital:
      0,

    unlockTime:
      Date.now() +
      (
        Number(duration) *
        86400000
      ),

    type:
      "stake",

    status:
      "pending",

    network:
      STAKING_NETWORK,

    payment_id:
      null,

    txid:
      null

  };

  const {
    data,
    error
  } =
    await supabase

      .from(STAKES_TABLE)

      .insert(payload)

      .select()

      .single();

  if(error){

    throw new Error(
      error.message ||
      "Failed to create pending stake"
    );

  }

  return data;

}


/* ======================================
   UPDATE PENDING STAKE
====================================== */

async function updatePendingStake(
  id,
  values
){

  assertMainnetStakingNetwork();

  const supabase =
    getStakingSupabaseClient();

  if(!supabase){

    throw new Error(
      "Supabase client not available"
    );

  }

  if(!id){

    throw new Error(
      "Stake id is required"
    );

  }

  const safeValues = {

    ...values,

    /*
      Prevent accidental cross-network mutation.
    */

    network:
      STAKING_NETWORK

  };

  const {
    data,
    error
  } =
    await supabase

      .from(STAKES_TABLE)

      .update(safeValues)

      .eq(
        "id",
        id
      )

      .eq(
        "network",
        STAKING_NETWORK
      )

      .select()

      .maybeSingle();

  if(error){

    throw new Error(
      error.message ||
      "Failed to update stake"
    );

  }

  if(!data){

    throw new Error(
      "Stake not found in testnet"
    );

  }

  return data;

}


/* ======================================
   ADD STAKE (TESTNET)
====================================== */

async function addStake({

  project,

  amount,

  duration

}){

  if(__stakingLock){

    return {
      error:
        "Processing..."
    };

  }

  __stakingLock = true;

  try{

    /* ===============================
       NETWORK
    =============================== */

    assertMainnetStakingNetwork();


    /* ===============================
       GET USER
    =============================== */

    let user = null;

    try{

      if(
        typeof ensurePiAuth ===
        "function"
      ){

        user =
          await ensurePiAuth();

      }

    }catch(e){

      console.warn(
        "ensurePiAuth failed:",
        e
      );

    }

    if(!user?.uid){

      user =
        getCurrentUser();

    }

    if(!user?.uid){

      return {
        error:
          "Login required"
      };

    }


    /* ===============================
       VALIDATION
    =============================== */

    const safeAmount =
      Number(amount);

    const safeDuration =
      Number(duration);

    if(!project){

      return {
        error:
          "Invalid project"
      };

    }

    if(
      !Number.isFinite(
        safeAmount
      ) ||
      safeAmount <= 0
    ){

      return {
        error:
          "Invalid amount"
      };

    }

    if(
      !Number.isFinite(
        safeDuration
      ) ||
      safeDuration <= 0
    ){

      return {
        error:
          "Invalid duration"
      };

    }

    if(
      safeAmount <
      getMinStake(project)
    ){

      return {
        error:
          "Minimum stake not reached"
      };

    }


    /* ===============================
       PROJECT VALIDATION
    =============================== */

    if(
      typeof getProjectMeta ===
      "function"
    ){

      const projectMeta =
        await getProjectMeta(
          project
        );

      if(!projectMeta){

        return {
          error:
            "Invalid project"
        };

      }

      if(
        projectMeta.network &&
        projectMeta.network !==
        STAKING_NETWORK
      ){

        return {
          error:
            "Project belongs to another network"
        };

      }

      if(
        projectMeta.status !==
        "active"
      ){

        return {
          error:
            "Project is not active"
        };

      }

      if(
        projectMeta.staking_enabled ===
        false
      ){

        return {
          error:
            "Staking is disabled for this project"
        };

      }

    }


    /* ===============================
       CREATE PENDING
    =============================== */

    const pending =
      await createPendingStake({

        user,

        project,

        amount:
          safeAmount,

        duration:
          safeDuration

      });


    /* ===============================
       PI PAYMENT
    =============================== */

    let payment;

    try{

      if(
        typeof startPiPayment !==
        "function"
      ){

        throw new Error(
          "Pi payment engine is not available"
        );

      }

      payment =
        await startPiPayment({

          amount:
            safeAmount,

          memo:
            `Stake in ${project}`,

          stakeId:
            pending.id

        });

    }catch(error){

      await updatePendingStake(

        pending.id,

        {
          status:
            "cancelled"
        }

      );

      return {

        error:
          error?.message ||
          "Payment cancelled"

      };

    }


    /* ===============================
       PAYMENT FAILED
    =============================== */

    if(!payment){

      await updatePendingStake(

        pending.id,

        {
          status:
            "cancelled"
        }

      );

      return {

        error:
          "Payment failed"

      };

    }


    /* ===============================
       PAYMENT SUCCESS
    =============================== */

    const updated =
      await updatePendingStake(

        pending.id,

        {

          payment_id:
            payment.paymentId ||
            payment.identifier ||
            null,

          txid:
            payment.txid ||
            payment.transaction?.txid ||
            payment.paymentId ||
            null,

          status:
            "paid",

          network:
            STAKING_NETWORK

        }

      );


    /*
      DO NOT call the old recordTx() here.

      The previous implementation could route transaction
      history through localStorage. Until the dedicated
      network-aware transaction ledger is connected,
      staking must not create a second persistent source
      of truth.
    */


    return {

      success:
        true,

      network:
        STAKING_NETWORK,

      stake:
        updated,

      payment

    };

  }catch(error){

    console.error(
      "TESTNET STAKING ERROR:",
      error
    );

    return {

      error:
        error?.message ||
        "Unknown staking error"

    };

  }finally{

    __stakingLock =
      false;

  }

}


/* ======================================
   GET ALL STAKES FOR CURRENT USER
====================================== */

async function getAllStakesMerged(){

  assertMainnetStakingNetwork();

  const user =
    getCurrentUser();

  if(!user?.uid){

    return [];

  }

  const supabase =
    getStakingSupabaseClient();

  if(!supabase){

    return [];

  }

  try{

    const {
      data,
      error
    } =
      await supabase

        .from(STAKES_TABLE)

        .select("*")

        .eq(
          "userid",
          user.uid
        )

        .eq(
          "network",
          STAKING_NETWORK
        )

        .order(
          "created_at",
          {
            ascending:false
          }
        );

    if(error){

      throw new Error(
        error.message
      );

    }

    return Array.isArray(data)

      ? data.filter(
          stake =>
            stake.status ===
            "paid"
        )

      : [];

  }catch(error){

    console.error(
      "GET TESTNET STAKES:",
      error
    );

    return [];

  }

}


/* ======================================
   GLOBAL STAKES
====================================== */

async function getGlobalStakes(){

  assertMainnetStakingNetwork();

  const supabase =
    getStakingSupabaseClient();

  if(!supabase){

    return [];

  }

  try{

    const {
      data,
      error
    } =
      await supabase

        .from(STAKES_TABLE)

        .select("*")

        .eq(
          "network",
          STAKING_NETWORK
        )

        .eq(
          "status",
          "paid"
        )

        .order(
          "created_at",
          {
            ascending:false
          }
        );

    if(error){

      throw new Error(
        error.message
      );

    }

    return Array.isArray(data)
      ? data
      : [];

  }catch(error){

    console.error(
      "GLOBAL TESTNET STAKES:",
      error
    );

    return [];

  }

}


/* ======================================
   PROJECT TOTALS
====================================== */

async function getProjectTotals(
  project
){

  const stakes =
    await getAllStakesMerged();

  const projectData =
    stakes.filter(
      stake =>
        String(
          stake.project
        )
          .trim()
          .toLowerCase() ===
        String(
          project
        )
          .trim()
          .toLowerCase()
    );

  let stake =
    0;

  let reward =
    0;

  projectData.forEach(
    s => {

      const amount =
        Number(s.amount) ||
        0;

      if(
        s.type ===
        "stake"
      ){

        stake +=
          amount;

        const total =
          Number(
            s.reward
          ) || 0;

        const withdrawn =
          Number(
            s.withdrawnReward
          ) || 0;

        reward +=
          Math.max(
            0,
            total -
            withdrawn
          );

      }

    }
  );

  return {

    stake,

    reward,

    stakes:
      projectData

  };

}


/* ======================================
   USER STAKES
====================================== */

async function getUserStakes(){

  return await getAllStakesMerged();

}


/* ======================================
   WITHDRAW PROJECT REWARD
====================================== */

async function withdrawProjectReward(
  project,
  amount
){

  assertMainnetStakingNetwork();

  let user = null;

  try{

    if(
      typeof ensurePiAuth ===
      "function"
    ){

      user =
        await ensurePiAuth();

    }

  }catch(e){

    console.warn(
      "ensurePiAuth failed:",
      e
    );

  }

  if(!user?.uid){

    user =
      getCurrentUser();

  }

  if(!user?.uid){

    return {
      error:
        "Login required"
    };

  }

  let remaining =
    Number(amount);

  if(
    !Number.isFinite(
      remaining
    ) ||
    remaining <= 0
  ){

    return {
      error:
        "Invalid amount"
    };

  }

  const supabase =
    getStakingSupabaseClient();

  if(!supabase){

    return {
      error:
        "Supabase client not available"
    };

  }

  try{

    const {
      data:stakes,
      error
    } =
      await supabase

        .from(STAKES_TABLE)

        .select("*")

        .eq(
          "userid",
          user.uid
        )

        .eq(
          "project",
          project
        )

        .eq(
          "network",
          STAKING_NETWORK
        )

        .eq(
          "status",
          "paid"
        )

        .order(
          "created_at",
          {
            ascending:true
          }
        );

    if(error){

      throw new Error(
        error.message
      );

    }

    for(
      const stake of
      stakes || []
    ){

      if(
        remaining <= 0
      ){

        break;

      }

      const reward =
        Number(
          stake.reward
        ) || 0;

      const withdrawn =
        Number(
          stake.withdrawnReward
        ) || 0;

      const available =
        Math.max(
          0,
          reward -
          withdrawn
        );

      if(
        available <= 0
      ){

        continue;

      }

      const take =
        Math.min(
          available,
          remaining
        );

      const updated =
        await supabase

          .from(STAKES_TABLE)

          .update({

            withdrawnReward:
              withdrawn +
              take

          })

          .eq(
            "id",
            stake.id
          )

          .eq(
            "userid",
            user.uid
          )

          .eq(
            "project",
            project
          )

          .eq(
            "network",
            STAKING_NETWORK
          )

          .eq(
            "status",
            "paid"
          )

          .select()
          .maybeSingle();

      if(updated.error){

        throw new Error(
          updated.error.message
        );

      }

      if(!updated.data){

        throw new Error(
          "Reward update affected no testnet stake"
        );

      }

      remaining -=
        take;

    }

    if(
      remaining > 0
    ){

      return {

        error:
          "Insufficient reward"

      };

    }

    return {

      success:
        true,

      network:
        STAKING_NETWORK,

      amount:
        Number(amount)

    };

  }catch(e){

    console.error(
      "TESTNET REWARD WITHDRAW:",
      e
    );

    return {

      error:
        e?.message ||
        "Reward withdrawal failed"

    };

  }

}


/* ======================================
   WITHDRAW CAPITAL
====================================== */

async function withdrawCapital({

  project,

  amount

}){

  assertMainnetStakingNetwork();

  let user = null;

  try{

    if(
      typeof ensurePiAuth ===
      "function"
    ){

      user =
        await ensurePiAuth();

    }

  }catch(e){

    console.warn(
      "ensurePiAuth failed:",
      e
    );

  }

  if(!user?.uid){

    user =
      getCurrentUser();

  }

  if(!user?.uid){

    return {

      error:
        "Login required"

    };

  }

  let remaining =
    Number(amount);

  if(
    !Number.isFinite(
      remaining
    ) ||
    remaining <= 0
  ){

    return {

      error:
        "Invalid amount"

    };

  }

  const supabase =
    getStakingSupabaseClient();

  if(!supabase){

    return {

      error:
        "Supabase client not available"

    };

  }

  try{

    const {
      data:stakes,
      error
    } =
      await supabase

        .from(STAKES_TABLE)

        .select("*")

        .eq(
          "userid",
          user.uid
        )

        .eq(
          "project",
          project
        )

        .eq(
          "network",
          STAKING_NETWORK
        )

        .eq(
          "status",
          "paid"
        )

        .order(
          "created_at",
          {
            ascending:true
          }
        );

    if(error){

      throw new Error(
        error.message
      );

    }

    const now =
      Date.now();

    for(
      const stake of
      stakes || []
    ){

      if(
        remaining <= 0
      ){

        break;

      }

      const unlockTime =
        Number(
          stake.unlockTime
        ) || 0;

      if(
        now <
        unlockTime
      ){

        continue;

      }

      const available =
        Math.max(

          0,

          (
            Number(
              stake.amount
            ) || 0
          ) -
          (
            Number(
              stake.withdrawnCapital
            ) || 0
          )

        );

      if(
        available <= 0
      ){

        continue;

      }

      const withdrawnCapital =
        Number(
          stake.withdrawnCapital
        ) || 0;

      const take =
        Math.min(
          available,
          remaining
        );

      const updated =
        await supabase

          .from(STAKES_TABLE)

          .update({

            withdrawnCapital:
              withdrawnCapital +
              take

          })

          .eq(
            "id",
            stake.id
          )

          .eq(
            "userid",
            user.uid
          )

          .eq(
            "project",
            project
          )

          .eq(
            "network",
            STAKING_NETWORK
          )

          .eq(
            "status",
            "paid"
          )

          .select()
          .maybeSingle();

      if(updated.error){

        throw new Error(
          updated.error.message
        );

      }

      if(!updated.data){

        throw new Error(
          "Capital update affected no testnet stake"
        );

      }

      remaining -=
        take;

    }

    if(
      remaining > 0
    ){

      return {

        error:
          "Insufficient unlocked capital"

      };

    }

    return {

      success:
        true,

      network:
        STAKING_NETWORK,

      amount:
        Number(amount)

    };

  }catch(e){

    console.error(
      "TESTNET CAPITAL WITHDRAW:",
      e
    );

    return {

      error:
        e?.message ||
        "Capital withdrawal failed"

    };

  }

}


/* ======================================
   LOAD DATA
====================================== */

async function loadData(){

  try{

    const stakes =
      await getAllStakesMerged();

    console.log(
      "TESTNET STAKES:",
      stakes
    );

    return stakes;

  }catch(error){

    console.error(
      "LOAD TESTNET STAKES:",
      error
    );

    return [];

  }

}


/* ======================================
   LEGACY HELPERS
====================================== */

function getStakes(){

  return getAllStakesMerged();

}


function getInternalTotals(){

  return getProjectTotals();

}


function getInternalProjectTotals(
  project
){

  return getProjectTotals(
    project
  );

}


function addInternalStake(
  data
){

  return addStake(
    data
  );

}


/* ======================================
   GLOBAL EXPORTS
====================================== */

window.STAKING_NETWORK =
  STAKING_NETWORK;

window.getCurrentUser =
  getCurrentUser;

window.getMinStake =
  getMinStake;

window.getRate =
  getRate;

window.createPendingStake =
  createPendingStake;

window.updatePendingStake =
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
