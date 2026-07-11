/* =====================================
   ALBUKHR PROJECT TREASURY ENGINE v2
   Testnet Ready
===================================== */

const TREASURY_NETWORK = "testnet";

/* =====================================
   GET PROJECT LIQUIDITY
===================================== */

async function getProjectLiquidity(project){

  if(!project){
    return 0;
  }

  try{

    /* ===== TOTAL PAID STAKES ===== */

    const stakeRes = await fetch(

      `${SUPABASE_URL}/rest/v1/stakes?` +

      `select=amount` +

      `&project=eq.${project}` +

      `&network=eq.${TREASURY_NETWORK}` +

      `&status=eq.paid`,

      {

        headers:{

          "apikey":SUPABASE_KEY,

          "Authorization":
          `Bearer ${SUPABASE_KEY}`

        }

      }

    );

    if(!stakeRes.ok){

      throw new Error(
        await stakeRes.text()
      );

    }

    const stakes =
    await stakeRes.json();

    let totalStake = 0;

    stakes.forEach(s=>{

      totalStake +=
      Number(s.amount) || 0;

    });

    /* ===== PAID CAPITAL ===== */

    const withdrawRes = await fetch(

      `${SUPABASE_URL}/rest/v1/withdraw_requests?` +

      `select=amount` +

      `&project=eq.${project}` +

      `&network=eq.${TREASURY_NETWORK}` +

      `&type=eq.capital` +

      `&status=eq.paid`,

      {

        headers:{

          "apikey":SUPABASE_KEY,

          "Authorization":
          `Bearer ${SUPABASE_KEY}`

        }

      }

    );

    if(!withdrawRes.ok){

      throw new Error(
        await withdrawRes.text()
      );

    }

    const withdrawals =
    await withdrawRes.json();

    let withdrawn = 0;

    withdrawals.forEach(w=>{

      withdrawn +=
      Number(w.amount) || 0;

    });

    return Math.max(
      0,
      totalStake - withdrawn
    );

  }catch(error){

    console.error(

      "TREASURY:",

      error

    );

    return 0;

  }

}

/* =====================================
   PROJECT TREASURY STATUS
===================================== */

async function getProjectTreasuryStatus(project){

  if(!project){

    return{

      liquidity:0,

      totalStake:0,

      totalReward:0,

      withdrawnCapital:0,

      withdrawnReward:0,

      investors:0,

      activeStakes:0

    };

  }

  try{

    const res = await fetch(

      `${SUPABASE_URL}/rest/v1/stakes?`+

      `select=*`+

      `&project=eq.${project}`+

      `&network=eq.${TREASURY_NETWORK}`+

      `&status=eq.paid`,

      {

        headers:{

          "apikey":SUPABASE_KEY,

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

    let totalStake = 0;

    let totalReward = 0;

    let withdrawnCapital = 0;

    let withdrawnReward = 0;

    const investors =
    new Set();

    stakes.forEach(s=>{

      totalStake +=
      Number(s.amount)||0;

      totalReward +=
      Number(s.reward)||0;

      withdrawnCapital +=
      Number(s.withdrawnCapital)||0;

      withdrawnReward +=
      Number(s.withdrawnReward)||0;

      if(s.userid){

        investors.add(s.userid);

      }

    });

    return{

      liquidity:

        Math.max(
          0,
          totalStake-withdrawnCapital
        ),

      totalStake,

      totalReward,

      withdrawnCapital,

      withdrawnReward,

      investors:

        investors.size,

      activeStakes:

        stakes.length

    };

  }catch(error){

    console.error(

      "TREASURY STATUS:",

      error

    );

    return{

      liquidity:0,

      totalStake:0,

      totalReward:0,

      withdrawnCapital:0,

      withdrawnReward:0,

      investors:0,

      activeStakes:0

    };

  }

      }

/* =====================================
   PROJECT TREASURY HISTORY
===================================== */

async function getProjectTreasuryHistory(project){

  if(!project){
    return [];
  }

  try{

    const [stakesRes, withdrawRes] = await Promise.all([

      fetch(

        `${SUPABASE_URL}/rest/v1/stakes?select=*&project=eq.${project}&network=eq.${TREASURY_NETWORK}&status=eq.paid`,

        {

          headers:{

            "apikey":SUPABASE_KEY,

            "Authorization":
            `Bearer ${SUPABASE_KEY}`

          }

        }

      ),

      fetch(

        `${SUPABASE_URL}/rest/v1/withdraw_requests?select=*&project=eq.${project}&network=eq.${TREASURY_NETWORK}`,

        {

          headers:{

            "apikey":SUPABASE_KEY,

            "Authorization":
            `Bearer ${SUPABASE_KEY}`

          }

        }

      )

    ]);

    const stakes =
    stakesRes.ok
      ? await stakesRes.json()
      : [];

    const withdraws =
    withdrawRes.ok
      ? await withdrawRes.json()
      : [];

    const history = [

      ...stakes.map(s=>({

        type:"stake",

        amount:Number(s.amount)||0,

        status:s.status,

        userid:s.userid,

        created_at:s.created_at

      })),

      ...withdraws.map(w=>({

        type:w.type,

        amount:Number(w.amount)||0,

        status:w.status,

        userid:w.userid,

        created_at:w.created_at

      }))

    ];

    history.sort((a,b)=>

      new Date(b.created_at) -

      new Date(a.created_at)

    );

    return history;

  }catch(error){

    console.error(error);

    return [];

  }

}

/* =====================================
   ALL PROJECT TREASURY
===================================== */

async function getAllTreasury(){

  const treasury = {};

  if(typeof PROJECT_CONFIG!=="object"){

    return treasury;

  }

  const projects =
  Object.keys(PROJECT_CONFIG);

  for(const project of projects){

    treasury[project] =

      await getProjectTreasuryStatus(project);

  }

  return treasury;

}

/* =====================================
   ALL PROJECT TREASURY
===================================== */

async function getAllTreasury(){

  const treasury = {};

  if(typeof PROJECT_CONFIG!=="object"){

    return treasury;

  }

  const projects =
  Object.keys(PROJECT_CONFIG);

  for(const project of projects){

    treasury[project] =

      await getProjectTreasuryStatus(project);

  }

  return treasury;

  /* =====================================
   REFRESH TREASURY
===================================== */

async function refreshTreasury(){

  return await getAllTreasury();

}
