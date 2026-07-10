/* =========================================
   ALBUKHR PROJECT DISCOVERY ENGINE v2
   Testnet → Mainnet Ready
========================================= */
let discoveryCache = [];
let discoveryUpdated = 0;

const DISCOVERY_CACHE_TIME = 10000;

async function getProjectDiscoveryScore(projectCode){

    const metrics =
        await getProjectMetrics(projectCode);

    if(!metrics){
        return 0;
    }

    const liquidityScore =
        Math.min(metrics.liquidity / 10, 100);

    const investorScore =
        Math.min(metrics.investors * 5, 100);

    const roiScore =
        Math.min(metrics.roi * 5, 100);

    const riskScore =
        100 - metrics.riskScore;

    return (

        liquidityScore * 0.35 +

        investorScore * 0.25 +

        roiScore * 0.20 +

        riskScore * 0.20

    );

}

async function getDiscoveryProjects(){

    const metrics =
        await getMarketMetrics();

    const list = [];

    for(const project of metrics){

        list.push({

            ...project,

            discoveryScore:

                await getProjectDiscoveryScore(

                    project.code

                )

        });

    }

    discoveryCache = list;
    discoveryUpdated = Date.now();

    return list;

  }

async function getTrendingProjects(limit=3){

    const list =
        await getDiscoveryProjects();

    return [...list]

        .sort((a,b)=>

            b.discoveryScore -

            a.discoveryScore

        )

        .slice(0,limit);

              }

async function getFeaturedProjects(limit=5){

    const list =
        await getDiscoveryProjects();

    return list

        .filter(project=>

            project.liquidity >= 300 &&

            project.riskLevel === "LOW"

        )

        .slice(0,limit);

}

async function sortByDiscovery(){

    const list =
        await getDiscoveryProjects();

    return [...list]

        .sort((a,b)=>

            b.discoveryScore -

            a.discoveryScore

        );

              }

/* =========================================
   HOT PROJECTS
========================================= */

async function getHotProjects(limit=5){

    const list =
        await getDiscoveryProjects();

    return [...list]

        .sort((a,b)=>

            b.discoveryScore -

            a.discoveryScore

        )

        .slice(0,limit);

}

/* =========================================
   NEWEST PROJECTS
========================================= */

async function getNewestProjects(limit=5){

    const projects =
        await getProjects();

    return [...projects]

        .sort((a,b)=>

            new Date(b.created_at||0)

            -

            new Date(a.created_at||0)

        )

        .slice(0,limit);

      }

/* =========================================
   DISCOVERY DASHBOARD
========================================= */

async function getDiscoveryDashboard(){

    return{

        trending:

            await getTrendingProjects(),

        featured:

            await getFeaturedProjects(),

        hot:

            await getHotProjects(),

        newest:

            await getNewestProjects(),

        safest:

            await getSafestProjects()

    };

      }

/* =========================================
   REFRESH
========================================= */

async function refreshDiscovery(){

    discoveryCache = [];

    discoveryUpdated = 0;

    return await getDiscoveryProjects();

      }

/* =========================================
   EXPORTS
========================================= */

window.getProjectDiscoveryScore =
    getProjectDiscoveryScore;

window.getDiscoveryProjects =
    getDiscoveryProjects;

window.getTrendingProjects =
    getTrendingProjects;

window.getFeaturedProjects =
    getFeaturedProjects;

window.getHotProjects =
    getHotProjects;

window.getNewestProjects =
    getNewestProjects;

window.sortByDiscovery =
    sortByDiscovery;

window.getDiscoveryDashboard =
    getDiscoveryDashboard;

window.refreshDiscovery =
    refreshDiscovery;
