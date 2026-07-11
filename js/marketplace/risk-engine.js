/* =========================================
   ALBUKHR RISK ENGINE v2
   Testnet Ready
========================================= */

async function getProjectRisk(project){

  if(!project){

    return defaultRisk();

  }

  if(typeof getProjectTreasuryStatus !== "function"){

    return defaultRisk();

  }

  let treasury;

  try{

    treasury =
    await getProjectTreasuryStatus(project);

  }catch(error){

    console.error(error);

    return defaultRisk();

  }

  const totalStake =
  Number(treasury.totalStake) || 0;

  const liquidity =
  Number(treasury.liquidity) || 0;

  const investors =
  Number(treasury.investors) || 0;

  const withdrawnCapital =
  Number(treasury.withdrawnCapital) || 0;

  const withdrawnReward =
  Number(treasury.withdrawnReward) || 0;

/* =====================================
   LIQUIDITY SCORE
===================================== */

let liquidityScore = 100;

if(totalStake > 0){

  liquidityScore = Math.min(

    (liquidity / totalStake) * 100,

    100

  );

}

/* =====================================
   INVESTOR SCORE
===================================== */

let investorScore = 30;

if(investors >= 100){

  investorScore = 100;

}else if(investors >= 50){

  investorScore = 90;

}else if(investors >= 20){

  investorScore = 75;

}else if(investors >= 10){

  investorScore = 60;

}

/* =====================================
   WITHDRAW PRESSURE
===================================== */

let withdrawScore = 100;

const withdrawn =

withdrawnCapital +

withdrawnReward;

if(totalStake > 0){

  const pressure =

  (withdrawn / totalStake) * 100;

  if(pressure > 70){

    withdrawScore = 30;

  }else if(pressure > 50){

    withdrawScore = 50;

  }else if(pressure > 30){

    withdrawScore = 70;

  }else if(pressure > 15){

    withdrawScore = 85;

  }

}
/* =====================================
   ROI SCORE
===================================== */

let roi = 0;

if(typeof calculateProjectROI==="function"){

  try{

    roi = Number(
      calculateProjectROI(project)
    ) || 0;

  }catch(e){

    roi = 0;

  }

}

let roiScore = 100;

if(roi >= 50){

  roiScore = 40;

}else if(roi >= 30){

  roiScore = 60;

}else if(roi >= 20){

  roiScore = 80;

}

/* =====================================
   TREASURY HEALTH
===================================== */

let treasuryHealth = "STRONG";

if(liquidityScore < 50){

  treasuryHealth = "WEAK";

}else if(liquidityScore < 80){

  treasuryHealth = "FAIR";

   }

  /* =====================================
   FINAL SCORE
===================================== */

const score =

(liquidityScore * 0.40)

+

(investorScore * 0.20)

+

(withdrawScore * 0.20)

+

(roiScore * 0.20);

let risk = "HIGH";

if(score >= 80){

  risk = "LOW";

}else if(score >= 60){

  risk = "MEDIUM";

}

/* =====================================
   RETURN
===================================== */

return{

  score:Number(score.toFixed(2)),

  risk,

  treasuryHealth,

  liquidityScore,

  investorScore,

  withdrawScore,

  roiScore,

  liquidity,

  totalStake,

  investors,

  withdrawnCapital,

  withdrawnReward

};

}

/* =====================================
   DEFAULT RISK
===================================== */

function defaultRisk(){

  return{

    score:0,

    risk:"UNKNOWN",

    treasuryHealth:"UNKNOWN",

    liquidityScore:0,

    investorScore:0,

    withdrawScore:0,

    roiScore:0,

    liquidity:0,

    totalStake:0,

    investors:0,

    withdrawnCapital:0,

    withdrawnReward:0

  };

}


