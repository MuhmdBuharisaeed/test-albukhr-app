/* =========================================
   TRENDING PROJECTS
========================================= */

async function getTrendingProjects(limit=5){

  const projects =
  await getEconomicIntelligence();

  return [...projects]

    .sort((a,b)=>{

      const scoreA =

        (a.investors*4)+

        (a.liquidity/100)+

        a.profitScore;

      const scoreB =

        (b.investors*4)+

        (b.liquidity/100)+

        b.profitScore;

      return scoreB-scoreA;

    })

    .slice(0,limit);

}

/* =========================================
   FEATURED PROJECTS
========================================= */

async function getFeaturedProjects(limit=3){

  const projects =
  await getEconomicIntelligence();

  return [...projects]

    .sort((a,b)=>{

      return (

        b.sustainability+

        b.profitScore

      )-

      (

        a.sustainability+

        a.profitScore

      );

    })

    .slice(0,limit);

}

/* =========================================
   HIGH LIQUIDITY PROJECTS
========================================= */

async function getHighLiquidityProjects(limit=5){

  const projects =
  await getEconomicIntelligence();

  return [...projects]

    .sort(

      (a,b)=>

      b.liquidity-

      a.liquidity

    )

    .slice(0,limit);

    }

/* =========================================
   LOW RISK PROJECTS
========================================= */

async function getLowRiskProjects(limit=5){

  const projects =
  await getEconomicIntelligence();

  return projects

    .filter(

      p=>p.risk==="LOW"

    )

    .sort(

      (a,b)=>

      b.score-

      a.score

    )

    .slice(0,limit);

}

/* =========================================
   NEW PROJECTS
========================================= */

async function getNewProjects(limit=5){

  const projects =
  await AlbukhrMarketplace.getProjects();

  return [...projects]

    .sort((a,b)=>{

      const timeA =
      new Date(
        a.raw?.created_at ||
        a.raw?.createdAt ||
        0
      ).getTime();

      const timeB =
      new Date(
        b.raw?.created_at ||
        b.raw?.createdAt ||
        0
      ).getTime();

      return timeB-timeA;

    })

    .slice(0,limit);

    }

/* =========================================
   HIGH ROI PROJECTS
========================================= */

async function getHighROIProjects(limit=5){

  const projects =
  await getEconomicIntelligence();

  return [...projects]

    .sort((a,b)=>

      b.roi-a.roi

    )

    .slice(0,limit);

    }

/* =========================================
   FAST GROWING PROJECTS
========================================= */

async function getFastGrowingProjects(limit=5){

  const projects =
  await getEconomicIntelligence();

  return [...projects]

    .sort((a,b)=>{

      const scoreA =

        a.investors+

        (a.liquidity/200);

      const scoreB =

        b.investors+

        (b.liquidity/200);

      return scoreB-scoreA;

    })

    .slice(0,limit);

}

/* =========================================
   RECOMMENDED PROJECTS
========================================= */

async function getRecommendedProjects(limit=5){

  const projects =
  await getInvestmentRecommendations();

  return projects

    .filter(

      p=>p.recommendation==="INVEST"

    )

    .sort((a,b)=>

      b.profitScore-

      a.profitScore

    )

    .slice(0,limit);

}
