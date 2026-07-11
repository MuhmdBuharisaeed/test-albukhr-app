/* =========================================
   ALBUKHR ECONOMIC INTELLIGENCE ENGINE v2
   Testnet Ready
========================================= */

async function getEconomicMetrics(project){

  if(!project){

    return null;

  }

  const treasury =
  await getProjectTreasuryStatus(project);

  const risk =
  await getProjectRisk(project);

  let roi = 0;

  if(typeof calculateProjectROI==="function"){

    try{

      roi =
      Number(
        calculateProjectROI(project)
      ) || 0;

    }catch(e){

      roi = 0;

    }

  }

  const liquidity =
  Number(treasury.liquidity)||0;

  const investors =
  Number(treasury.investors)||0;

  const totalStake =
  Number(treasury.totalStake)||0;

  const withdrawnCapital =
  Number(treasury.withdrawnCapital)||0;

  const withdrawnReward =
  Number(treasury.withdrawnReward)||0;

/* =====================================
   LIQUIDITY NEED
===================================== */

let liquidityNeed = 0;

if(liquidity < 500){

  liquidityNeed += 40;

}

if(investors >= 20){

  liquidityNeed += 20;

}

if(totalStake > liquidity){

  liquidityNeed += 40;

}

liquidityNeed =

Math.min(liquidityNeed,100);

/* =====================================
   PROFIT SCORE
===================================== */

let profitScore = 0;

profitScore += roi * 2;

profitScore +=

Math.min(investors,50);

profitScore +=

Math.min(

liquidity / 100,

30

);

profitScore =

Math.min(

profitScore,

100

);

/* =====================================
   SUSTAINABILITY
===================================== */

let sustainability =

100 -

risk.score;

sustainability +=

Math.min(

liquidity / 100,

20

);

sustainability =

Math.max(

0,

Math.min(

100,

sustainability

)

);

return{

  project,

  liquidity,

  investors,

  totalStake,

  roi,

  risk:risk.risk,

  riskScore:risk.score,

  treasuryHealth:
  risk.treasuryHealth,

  withdrawnCapital,

  withdrawnReward,

  liquidityNeed,

  profitScore,

  sustainability

};

}

/* =========================================
   COLLECT ALL PROJECT INTELLIGENCE
========================================= */

async function getEconomicIntelligence(){

  let projects = [];

  if(

    window.AlbukhrMarketplace &&

    typeof AlbukhrMarketplace.getProjects === "function"

  ){

    projects =

    await AlbukhrMarketplace.getProjects();

  }

  if(!Array.isArray(projects)){

    return [];

  }

  const list = [];

  for(const project of projects){

    const metrics =

    await getEconomicMetrics(

      project.key ||

      project.code

    );

    if(metrics){

      list.push(metrics);

    }

  }

  return list;

}

/* =========================================
   LIQUIDITY PRIORITY
========================================= */

async function getLiquidityPriority(limit=5){

  const data =

  await getEconomicIntelligence();

  return [...data]

    .sort(

      (a,b)=>

      b.liquidityNeed-

      a.liquidityNeed

    )

    .slice(0,limit);

}

/* =========================================
   TOP PROFIT PROJECTS
========================================= */

async function getTopProfitProjects(limit=5){

  const data =

  await getEconomicIntelligence();

  return [...data]

    .sort(

      (a,b)=>

      b.profitScore-

      a.profitScore

    )

    .slice(0,limit);

   }

/* =========================================
   HIGH RISK PROJECTS
========================================= */

async function getHighRiskProjects(limit=5){

  const data =

  await getEconomicIntelligence();

  return data

    .filter(

      p=>p.risk==="HIGH"

    )

    .slice(0,limit);

}

/* =========================================
   STRONGEST PROJECTS
========================================= */

async function getStrongestProjects(limit=5){

  const data =

  await getEconomicIntelligence();

  return [...data]

    .sort(

      (a,b)=>

      b.sustainability-

      a.sustainability

    )

    .slice(0,limit);

}

/* =========================================
   INVESTMENT RECOMMENDATIONS
========================================= */

async function getInvestmentRecommendations(){

  const projects =

  await getEconomicIntelligence();

  return projects.map(project=>{

    let recommendation =

    "HOLD";

    if(

      project.risk==="LOW"

      &&

      project.sustainability>=80

      &&

      project.profitScore>=70

    ){

      recommendation="INVEST";

    }

    else if(

      project.risk==="HIGH"

      ||

      project.sustainability<40

    ){

      recommendation="AVOID";

    }

    return{

      ...project,

      recommendation

    };

  });

}
