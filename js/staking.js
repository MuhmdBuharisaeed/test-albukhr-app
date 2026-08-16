// =======================================
// ALBUKHR TESTNET STAKING ENGINE v2
// Pi Testnet • Supabase
// Network-isolated / Supabase source of truth
// =======================================

/*
  DEPENDS ON:
  - Supabase Core
  - Pi authentication / ensurePiAuth()
  - Pi payment engine / startPiPayment()

  NETWORK:
  - TESTNET ONLY

  IMPORTANT:
  This engine intentionally does NOT use LocalStorage for
  persistent staking data.

  Existing public function names are preserved for compatibility:
  - addStake()
  - getAllStakesMerged()
  - getGlobalStakes()
  - getProjectTotals()
  - getUserStakes()
  - withdrawProjectReward()
  - withdrawCapital()
  - loadData()
  - getStakes()
  - getInternalTotals()
  - getInternalProjectTotals()
  - addInternalStake()
*/

/* ======================================
   CONFIG
====================================== */

const STAKING_NETWORK = "testnet";

const SUPABASE_URL =
  "https://qexmnghilahsvethlxem.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_mSbWlhVKdmSjasKJC50QYw_5wzgRMe2";

/* ======================================
   SUPABASE CLIENT
   Prefer ALBUKHR Supabase Core.
   Direct REST remains as compatibility
   with the existing staking architecture.
====================================== */

function getMainnetStakingSupabaseClient(){

  if(
    typeof window.getAlbukhrSupabaseClient === "function"
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

  return null;
}

/* ======================================
   SAFE HELPERS
====================================== */

function stakingSafeNumber(value, fallback = 0){

  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : fallback;

}

function stakingSafeString(value, fallback = ""){

  if(
    value === null ||
    value === undefined
  ){
    return fallback;
  }

  return String(value);

}

/* ======================================
   NETWORK GUARDS
====================================== */

function assertMainnetNetwork(network){

  if(
    stakingSafeString(network)
      .trim()
      .toLowerCase() !== STAKING_NETWORK
  ){
    throw new Error(
      `Mainnet staking engine received invalid network: ${network}`
    );
  }

}

function mainnetQuery(){

  return `network=eq.${STAKING_NETWORK}`;

}

/* ======================================
   CURRENT USER
   No LocalStorage fallback.
====================================== */

async function getCurrentMainnetUser(){

  /*
    Preferred authentication source.
  */

  try{

    if(
      typeof ensurePiAuth === "function"
    ){

      const user =
        await ensurePiAuth();

      if(user?.uid){

        return {
          uid:user.uid,
          username:user.username || "",
          wallet_address:
            user.wallet_address ||
            user.wallet ||
            ""
        };

      }

    }

  }catch(e){

    console.warn(
      "ensurePiAuth failed:",
      e
    );

  }

  /*
    Pi SDK fallback.
  */

  try{

    if(
      window.Pi &&
      typeof window.Pi.getUser === "function"
    ){

      const user =
        await window.Pi.getUser();

      if(user?.uid){

        return {
          uid:user.uid,
          username:user.username || "",
          wallet_address:
            user.wallet_address ||
            user.wallet ||
            ""
        };

      }

    }

  }catch(e){

    console.warn(
      "Pi user not ready:",
      e
    );

  }

  return null;

}

/*
  Legacy-compatible function name.

  IMPORTANT:
  No LocalStorage is used.
*/

async function getCurrentUser(){

  return await getCurrentMainnetUser();

}

/* ======================================
   PROJECT RULES
   PRESERVED FROM CURRENT MAINNET ENGINE
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
   PRESERVED FROM CURRENT ENGINE
====================================== */

function getRate(project,duration){

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
    table?.[project]?.[Number(duration)] ||
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

  assertMainnetNetwork(STAKING_NETWORK);

  const safeAmount =
    stakingSafeNumber(amount,0);

  const safeDuration =
    stakingSafeNumber(duration,0);

  const reward =
    safeAmount *
    getRate(
      project,
      safeDuration
    );

  const payload = {

    userid:user.uid,

    wallet:
      user.wallet_address || "",

    project,

    amount:safeAmount,

    duration:safeDuration,

    reward,

    withdrawnReward:0,

    withdrawnCapital:0,

    unlockTime:
      Date.now() +
      (
        safeDuration *
        86400000
      ),

    type:"stake",

    status:"pending",

    network:STAKING_NETWORK,

    payment_id:null,

    txid:null

  };

  const res =
    await fetch(
      `${SUPABASE_URL}/rest/v1/stakes`,
      {
        method:"POST",

        headers:{
          "Content-Type":
            "application/json",

          "apikey":
            SUPABASE_KEY,

          "Authorization":
            `Bearer ${SUPABASE_KEY}`,

          "Prefer":
            "return=representation"
        },

        body:
          JSON.stringify(payload)
      }
    );

  if(!res.ok){

    throw new Error(
      await res.text()
    );

  }

  const rows =
    await res.json();

  return rows?.[0] || null;

}

/* ======================================
   UPDATE PENDING STAKE
   TESTNET NETWORK FILTER IS MANDATORY
====================================== */

async function updatePendingStake(
  id,
  values
){

  if(!id){

    throw new Error(
      "Stake ID is required"
    );

  }

  assertMainnetNetwork(STAKING_NETWORK);

  const safeValues = {
    ...values,
    network:STAKING_NETWORK
  };

  const res =
    await fetch(

      `${SUPABASE_URL}/rest/v1/stakes?id=eq.${encodeURIComponent(id)}&${mainnetQuery()}`,

      {

        method:"PATCH",

        headers:{
          "Content-Type":
            "application/json",

          "apikey":
            SUPABASE_KEY,

          "Authorization":
            `Bearer ${SUPABASE_KEY}`,

          "Prefer":
            "return=representation"
        },

        body:
          JSON.stringify(safeValues)

      }

    );

  if(!res.ok){

    throw new Error(
      await res.text()
    );

  }

  return true;

}

/* ======================================
   ADD STAKE (MAINNET)
====================================== */

async function addStake({

  project,
  amount,
  duration

}){

  if(__stakingLock){

    return {
      error:"Processing..."
    };

  }

  __stakingLock = true;

  try{

    /* ===============================
       GET USER
    =============================== */

    const user =
      await getCurrentMainnetUser();

    if(!user?.uid){

      return {
        error:"Login required"
      };

    }

    /* ===============================
       VALIDATION
    =============================== */

    const safeAmount =
      stakingSafeNumber(amount,0);

    const safeDuration =
      stakingSafeNumber(duration,0);

    if(!project){

      return {
        error:"Invalid project"
      };

    }

    if(
      !Number.isFinite(safeAmount) ||
      safeAmount <= 0
    ){

      return {
        error:"Invalid amount"
      };

    }

    if(
      safeDuration <= 0
    ){

      return {
        error:"Invalid duration"
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

    if(
      getRate(
        project,
        safeDuration
      ) <= 0
    ){

      return {
        error:
          "Invalid staking duration for this project"
      };

    }

    /* ===============================
       CREATE PENDING STAKE
    =============================== */

    const pending =
      await createPendingStake({

        user,

        project,

        amount:safeAmount,

        duration:safeDuration

      });

    if(!pending?.id){

      return {
        error:
          "Failed to create pending stake"
      };

    }

    /* ===============================
       PI PAYMENT
    =============================== */

    let payment;

    try{

      if(
        typeof startPiPayment !== "function"
      ){

        throw new Error(
          "Pi payment engine is not available"
        );

      }

      payment =
        await startPiPayment({

          amount:safeAmount,

          memo:
            `Stake in ${project}`,

          stakeId:
            pending.id

        });

    }catch(error){

      await updatePendingStake(

        pending.id,

        {
          status:"cancelled"
        }

      );

      return {
        error:
          error?.message ||
          "Payment cancelled"
      };

    }

    /* ===============================
       PAYMENT RESULT VALIDATION
    =============================== */

    if(!payment){

      await updatePendingStake(

        pending.id,

        {
          status:"cancelled"
        }

      );

      return {
        error:"Payment failed"
      };

    }

    /* ===============================
       MARK STAKE PAID
    =============================== */

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

        status:"paid",

        network:
          STAKING_NETWORK

      }

    );

    /* ===============================
       OPTIONAL TRANSACTION HISTORY
       Only if existing transaction
       engine is available.
    =============================== */

    if(
      typeof recordTx === "function"
    ){

      try{

        recordTx({

          type:"stake",

          project,

          amount:safeAmount,

          timestamp:Date.now(),

          network:
            STAKING_NETWORK

        });

      }catch(e){

        console.warn(
          "recordTx failed:",
          e
        );

      }

    }

    return {

      success:true,

      network:
        STAKING_NETWORK,

      payment

    };

  }catch(error){

    console.error(
      "TESTNET addStake error:",
      error
    );

    return {

      error:
        error?.message ||
        "Unknown staking error"

    };

  }finally{

    __stakingLock = false;

  }

}

/* ======================================
   GET ALL USER STAKES (TESTNET)
====================================== */

async function getAllStakesMerged(){

  const user =
    await getCurrentMainnetUser();

  if(!user?.uid){

    return [];

  }

  assertMainnetNetwork(
    STAKING_NETWORK
  );

  try{

    const url =
      `${SUPABASE_URL}/rest/v1/stakes` +
      `?select=*` +
      `&userid=eq.${encodeURIComponent(user.uid)}` +
      `&${mainnetQuery()}` +
      `&order=created_at.desc`;

    const res =
      await fetch(
        url,
        {
          headers:{
            "apikey":
              SUPABASE_KEY,

            "Authorization":
              `Bearer ${SUPABASE_KEY}`
          }
        }
      );

    if(!res.ok){

      throw new Error(
        await res.text()
      );

    }

    const data =
      await res.json();

    return Array.isArray(data)

      ? data.filter(
          stake =>
            stake.status === "paid"
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
   GLOBAL STAKES (TESTNET)
====================================== */

async function getGlobalStakes(){

  assertMainnetNetwork(
    STAKING_NETWORK
  );

  try{

    const res =
      await fetch(

        `${SUPABASE_URL}/rest/v1/stakes?select=*&${mainnetQuery()}&status=eq.paid`,

        {

          headers:{
            "apikey":
              SUPABASE_KEY,

            "Authorization":
              `Bearer ${SUPABASE_KEY}`
          }

        }

      );

    if(!res.ok){

      throw new Error(
        await res.text()
      );

    }

    const data =
      await res.json();

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
   PROJECT TOTALS (TESTNET)
====================================== */

async function getProjectTotals(project){

  const stakes =
    await getAllStakesMerged();

  const projectData =
    stakes.filter(stake =>

      String(
        stake.project
      )
      .trim()
      .toLowerCase()

      ===

      String(project)
      .trim()
      .toLowerCase()

    );

  let stake = 0;
  let reward = 0;

  projectData.forEach(s => {

    const amount =
      stakingSafeNumber(
        s.amount,
        0
      );

    if(s.type === "stake"){

      stake += amount;

      const total =
        stakingSafeNumber(
          s.reward,
          0
        );

      const withdrawn =
        stakingSafeNumber(
          s.withdrawnReward,
          0
        );

      reward += Math.max(
        0,
        total - withdrawn
      );

    }

  });

  return {

    stake,

    reward,

    stakes:
      projectData

  };

}

/* ======================================
   USER STAKES (TESTNET)
====================================== */

async function getUserStakes(){

  return await getAllStakesMerged();

}

/* ======================================
   WITHDRAW PROJECT REWARD (TESTNET)
   Network is included in BOTH reads
   and writes.
====================================== */

async function withdrawProjectReward(
  project,
  amount
){

  const user =
    await getCurrentMainnetUser();

  if(!user?.uid){

    return {
      error:"Login required"
    };

  }

  let remaining =
    stakingSafeNumber(
      amount,
      0
    );

  if(
    !Number.isFinite(remaining) ||
    remaining <= 0
  ){

    return {
      error:"Invalid amount"
    };

  }

  assertMainnetNetwork(
    STAKING_NETWORK
  );

  try{

    const res =
      await fetch(

        `${SUPABASE_URL}/rest/v1/stakes` +
        `?select=*` +
        `&userid=eq.${encodeURIComponent(user.uid)}` +
        `&project=eq.${encodeURIComponent(project)}` +
        `&${mainnetQuery()}` +
        `&status=eq.paid` +
        `&order=created_at.asc`,

        {

          headers:{
            "apikey":
              SUPABASE_KEY,

            "Authorization":
              `Bearer ${SUPABASE_KEY}`
          }

        }

      );

    if(!res.ok){

      throw new Error(
        await res.text()
      );

    }

    const stakes =
      await res.json();

    for(const stake of stakes){

      if(remaining <= 0){
        break;
      }

      const reward =
        stakingSafeNumber(
          stake.reward,
          0
        );

      const withdrawn =
        stakingSafeNumber(
          stake.withdrawnReward,
          0
        );

      const available =
        Math.max(
          0,
          reward - withdrawn
        );

      if(available <= 0){
        continue;
      }

      const take =
        Math.min(
          available,
          remaining
        );

      const update =
        await fetch(

          `${SUPABASE_URL}/rest/v1/stakes` +
          `?id=eq.${encodeURIComponent(stake.id)}` +
          `&${mainnetQuery()}`,

          {

            method:"PATCH",

            headers:{
              "Content-Type":
                "application/json",

              "apikey":
                SUPABASE_KEY,

              "Authorization":
                `Bearer ${SUPABASE_KEY}`,

              "Prefer":
                "return=representation"
            },

            body:
              JSON.stringify({

                withdrawnReward:
                  withdrawn + take,

                network:
                  STAKING_NETWORK

              })

          }

        );

      if(!update.ok){

        throw new Error(
          await update.text()
        );

      }

      remaining -= take;

    }

    if(remaining > 0){

      return {
        error:"Insufficient reward"
      };

    }

    return {

      success:true,

      network:
        STAKING_NETWORK,

      amount:
        stakingSafeNumber(
          amount,
          0
        )

    };

  }catch(e){

    console.error(
      "TESTNET reward withdrawal error:",
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
   WITHDRAW CAPITAL (TESTNET)
   Network is included in BOTH reads
   and writes.
====================================== */

async function withdrawCapital({

  project,
  amount

}){

  const user =
    await getCurrentMainnetUser();

  if(!user?.uid){

    return {
      error:"Login required"
    };

  }

  let remaining =
    stakingSafeNumber(
      amount,
      0
    );

  if(
    !Number.isFinite(remaining) ||
    remaining <= 0
  ){

    return {
      error:"Invalid amount"
    };

  }

  assertMainnetNetwork(
    STAKING_NETWORK
  );

  try{

    const res =
      await fetch(

        `${SUPABASE_URL}/rest/v1/stakes` +
        `?select=*` +
        `&userid=eq.${encodeURIComponent(user.uid)}` +
        `&project=eq.${encodeURIComponent(project)}` +
        `&${mainnetQuery()}` +
        `&status=eq.paid` +
        `&order=created_at.asc`,

        {

          headers:{
            "apikey":
              SUPABASE_KEY,

            "Authorization":
              `Bearer ${SUPABASE_KEY}`
          }

        }

      );

    if(!res.ok){

      throw new Error(
        await res.text()
      );

    }

    const stakes =
      await res.json();

    const now =
      Date.now();

    for(const stake of stakes){

      if(remaining <= 0){
        break;
      }

      /* LOCK CHECK */

      const unlockTime =
        stakingSafeNumber(
          stake.unlockTime,
          0
        );

      if(now < unlockTime){
        continue;
      }

      /* AVAILABLE CAPITAL */

      const available =
        Math.max(

          0,

          stakingSafeNumber(
            stake.amount,
            0
          )

          -

          stakingSafeNumber(
            stake.withdrawnCapital,
            0
          )

        );

      if(available <= 0){
        continue;
      }

      const take =
        Math.min(
          available,
          remaining
        );

      const update =
        await fetch(

          `${SUPABASE_URL}/rest/v1/stakes` +
          `?id=eq.${encodeURIComponent(stake.id)}` +
          `&${mainnetQuery()}`,

          {

            method:"PATCH",

            headers:{
              "Content-Type":
                "application/json",

              "apikey":
                SUPABASE_KEY,

              "Authorization":
                `Bearer ${SUPABASE_KEY}`,

              "Prefer":
                "return=representation"
            },

            body:
              JSON.stringify({

                withdrawnCapital:
                  stakingSafeNumber(
                    stake.withdrawnCapital,
                    0
                  ) + take,

                network:
                  STAKING_NETWORK

              })

          }

        );

      if(!update.ok){

        throw new Error(
          await update.text()
        );

      }

      remaining -= take;

    }

    if(remaining > 0){

      return {
        error:
          "Insufficient unlocked capital"
      };

    }

    return {

      success:true,

      network:
        STAKING_NETWORK,

      amount:
        stakingSafeNumber(
          amount,
          0
        )

    };

  }catch(e){

    console.error(
      "TESTNET capital withdrawal error:",
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
      "TESTNET LOAD DATA:",
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

console.log(
  "✅ ALBUKHR Testnet Staking Engine v2 loaded | network:",
  STAKING_NETWORK
);
