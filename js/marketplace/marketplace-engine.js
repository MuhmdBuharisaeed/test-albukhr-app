/* =========================================================
   ALBUKHR MARKETPLACE ENGINE — NEW ARCHITECTURE
   Target: js/marketplace/marketplace-engine.js

   Foundation:
   - js/core/environment-switcher.js
   - js/core/supabase-core.js
   - js/core/pi-auth-core.js
   - js/core/pi-payment.js
   - js/core/pi-project-treasury-payment.js

   Rules:
   - Supabase Core is the only Supabase client source.
   - Network Core/environment-switcher is authoritative.
   - All network-sensitive reads are isolated by network.
   - No localStorage/sessionStorage.
   - Marketplace never owns Pi payment execution.
   - Marketplace never writes treasury records directly.
   - Investment delegates to AlbukhrEcosystem.invest().
========================================================= */
"use strict";
(() => {
  const ENGINE="ALBUKHR Marketplace Engine", CACHE=10000;
  let marketCache=[],marketNet=null,marketAt=0;
  let discoveryCache=[],discoveryNet=null,discoveryAt=0;
  let coreCache=[],coreNet=null,coreAt=0;

  function network(){
    if(typeof window.requireAlbukhrNetwork!=="function") throw new Error(`${ENGINE}: Network Core unavailable.`);
    const n=window.requireAlbukhrNetwork();
    if(n!=="mainnet"&&n!=="testnet") throw new Error(`${ENGINE}: invalid network.`);
    return n;
  }
  function db(){
    if(typeof window.requireAlbukhrSupabaseClient!=="function") throw new Error(`${ENGINE}: Supabase Core unavailable.`);
    const c=window.requireAlbukhrSupabaseClient();
    if(!c||typeof c.from!=="function") throw new Error(`${ENGINE}: invalid shared Supabase client.`);
    return c;
  }
  const str=(v,d="")=>v==null?d:String(v);
  const num=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n:d;};
  const arr=v=>Array.isArray(v)?v:[];
  const norm=v=>str(v).trim().toLowerCase();
  function code(p){return typeof p==="string"||typeof p==="number"?str(p):str(p?.project_code??p?.projectCode??p?.code??p?.key??"");}
  function title(p){return str((p?.project_name??p?.projectName??p?.title??p?.name??code(p))||"Unnamed Project");}
  function type(p){return norm(p?.project_type??p?.projectType??p?.type??"external");}
  function roi(p){return num(p?.reward_rate??p?.rewardRate??p?.roi??p?.reward);}
  function minimum(p){return num(p?.minimum??p?.min_stake??p?.minStake??p?.minimum_stake,1);}
  function reserve(p){let n=num(p?.reserve_percent??p?.reservePercent??p?.reserve,10);if(n>0&&n<=1)n*=100;return Math.max(0,Math.min(n,100));}
  function find(list,c){const x=norm(c);return arr(list).find(p=>norm(code(p))===x)||null;}
  function copy(list){return arr(list).map(x=>({...x}));}

  async function getProjects(options={}){
    const active=options.activeOnly!==false;
    if(window.AlbukhrProjects&&typeof window.AlbukhrProjects.getAll==="function") return arr(await window.AlbukhrProjects.getAll({activeOnly:active,forceRefresh:!!options.forceRefresh}));
    if(window.AlbukhrProjectEngine&&typeof window.AlbukhrProjectEngine.getAll==="function") return arr(await window.AlbukhrProjectEngine.getAll({activeOnly:active,forceRefresh:!!options.forceRefresh}));
    let q=db().from("projects").select("*").eq("network",network());
    if(active)q=q.eq("status","active");
    const {data,error}=await q;if(error)throw error;return arr(data);
  }
  async function getProject(c){
    if(!norm(c))return null;
    if(window.AlbukhrProjects&&typeof window.AlbukhrProjects.get==="function"){const p=await window.AlbukhrProjects.get(c);if(p)return p;}
    if(window.AlbukhrProjectEngine&&typeof window.AlbukhrProjectEngine.get==="function"){const p=await window.AlbukhrProjectEngine.get(c);if(p)return p;}
    return find(await getProjects({activeOnly:false}),c);
  }
  const getActiveProjects=()=>getProjects({activeOnly:true});
  const getAllProjects=()=>getProjects({activeOnly:false});

  async function getProjectTreasuryStatus(c){
    const p=code(c);if(!p)return {liquidity:0,totalStake:0,totalReward:0,withdrawnCapital:0,withdrawnReward:0,investors:0,activeStakes:0};
    const n=network(),client=db();
    const [s,w]=await Promise.all([
      client.from("stakes").select("amount,reward,withdrawnCapital,withdrawnReward,userid,status,created_at").eq("project",p).eq("network",n).eq("status","paid"),
      client.from("withdraw_requests").select("amount,type,status,userid,created_at").eq("project",p).eq("network",n)
    ]);
    if(s.error)throw s.error;if(w.error)throw w.error;
    let totalStake=0,totalReward=0,withdrawnCapital=0,withdrawnReward=0;const investors=new Set();
    for(const x of arr(s.data)){totalStake+=num(x.amount);totalReward+=num(x.reward);withdrawnCapital+=num(x.withdrawnCapital);withdrawnReward+=num(x.withdrawnReward);if(x.userid)investors.add(str(x.userid));}
    for(const x of arr(w.data)){if(norm(x.status)!=="paid")continue;const a=num(x.amount);if(norm(x.type)==="capital")withdrawnCapital+=a;if(norm(x.type)==="reward")withdrawnReward+=a;}
    return {liquidity:Math.max(0,totalStake-withdrawnCapital),totalStake,totalReward,withdrawnCapital,withdrawnReward,investors:investors.size,activeStakes:arr(s.data).length};
  }
  const getProjectLiquidity=async c=>num((await getProjectTreasuryStatus(c)).liquidity);
  async function getProjectTreasuryHistory(c){
    const p=code(c);if(!p)return[];const n=network(),client=db();
    const [s,w]=await Promise.all([
      client.from("stakes").select("amount,userid,status,created_at").eq("project",p).eq("network",n).eq("status","paid"),
      client.from("withdraw_requests").select("amount,type,userid,status,created_at").eq("project",p).eq("network",n)
    ]);if(s.error)throw s.error;if(w.error)throw w.error;
    const h=[...arr(s.data).map(x=>({type:"stake",amount:num(x.amount),status:x.status,userid:x.userid,created_at:x.created_at})),...arr(w.data).map(x=>({type:norm(x.type)||"withdrawal",amount:num(x.amount),status:x.status,userid:x.userid,created_at:x.created_at}))];
    return h.sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
  }
  async function getAllTreasury(){const out={};for(const p of await getAllProjects()){const c=code(p);if(c)out[c]=await getProjectTreasuryStatus(c);}return out;}
  const refreshTreasury=getAllTreasury;

  const LiquidityPool={};
  LiquidityPool.getPaidStakes=async c=>{const {data,error}=await db().from("stakes").select("*").eq("project",code(c)).eq("network",network()).eq("status","paid");if(error)throw error;return arr(data);};
  LiquidityPool.getTotalLiquidity=async c=>(await getProjectTreasuryStatus(c)).totalStake;
  LiquidityPool.getWithdrawnCapital=async c=>(await getProjectTreasuryStatus(c)).withdrawnCapital;
  LiquidityPool.getLiquidity=getProjectLiquidity;
  LiquidityPool.getReserve=async c=>{const p=await getProject(c),l=await getProjectLiquidity(c);return l*reserve(p)/100;};
  LiquidityPool.getAvailable=async c=>Math.max(0,await getProjectLiquidity(c)-await LiquidityPool.getReserve(c));
  LiquidityPool.getUtilization=async c=>{const l=await getProjectLiquidity(c),a=await LiquidityPool.getAvailable(c);return l<=0?0:Number((((l-a)/l)*100).toFixed(2));};
  LiquidityPool.getHealth=async c=>{const l=await getProjectLiquidity(c),a=await LiquidityPool.getAvailable(c);if(l<=0)return{status:"EMPTY",score:0};const p=a/l*100;return{status:p>=90?"EXCELLENT":p>=70?"GOOD":p>=50?"MEDIUM":"CRITICAL",score:Number(p.toFixed(2))};};
  LiquidityPool.getStatus=async c=>{const [l,r,a,u,h]=await Promise.all([LiquidityPool.getLiquidity(c),LiquidityPool.getReserve(c),LiquidityPool.getAvailable(c),LiquidityPool.getUtilization(c),LiquidityPool.getHealth(c)]);return{project:code(c),liquidity:l,reserve:r,available:a,utilization:u,health:h};};
  LiquidityPool.summary=async()=>{let l=0,r=0,a=0;const ps=await getAllProjects();for(const p of ps){const x=await LiquidityPool.getStatus(code(p));l+=x.liquidity;r+=x.reserve;a+=x.available;}return{projects:ps.length,liquidity:l,reserve:r,available:a};};
  window.LiquidityPool=LiquidityPool;

  function defaultRisk(){return{score:0,risk:"UNKNOWN",treasuryHealth:"UNKNOWN",liquidityScore:0,investorScore:0,withdrawScore:0,roiScore:0,liquidity:0,totalStake:0,investors:0,withdrawnCapital:0,withdrawnReward:0};}
  async function calculateProjectROI(c){return roi(await getProject(c));}
  async function getProjectRisk(c){
    const p=code(c);if(!p)return defaultRisk();let t;try{t=await getProjectTreasuryStatus(p);}catch(e){console.error(`${ENGINE}: risk treasury failed`,e);return defaultRisk();}
    const ts=num(t.totalStake),l=num(t.liquidity),i=num(t.investors),wc=num(t.withdrawnCapital),wr=num(t.withdrawnReward);
    const liquidityScore=ts>0?Math.min(l/ts*100,100):100;
    let investorScore=30;if(i>=100)investorScore=100;else if(i>=50)investorScore=90;else if(i>=20)investorScore=75;else if(i>=10)investorScore=60;
    let withdrawScore=100;const pressure=ts>0?(wc+wr)/ts*100:0;if(pressure>70)withdrawScore=30;else if(pressure>50)withdrawScore=50;else if(pressure>30)withdrawScore=70;else if(pressure>15)withdrawScore=85;
    const r=await calculateProjectROI(p);let roiScore=100;if(r>=50)roiScore=40;else if(r>=30)roiScore=60;else if(r>=20)roiScore=80;
    const score=liquidityScore*.4+investorScore*.2+withdrawScore*.2+roiScore*.2;
    return{score:Number(score.toFixed(2)),risk:score>=80?"LOW":score>=60?"MEDIUM":"HIGH",treasuryHealth:liquidityScore<50?"WEAK":liquidityScore<80?"FAIR":"STRONG",liquidityScore,investorScore,withdrawScore,roiScore,liquidity:l,totalStake:ts,investors:i,withdrawnCapital:wc,withdrawnReward:wr};
  }

  async function getEconomicMetrics(c){
    const p=await getProject(c);if(!p)return null;const [t,r,rr]=await Promise.all([getProjectTreasuryStatus(c),getProjectRisk(c),calculateProjectROI(c)]);const l=num(t.liquidity),i=num(t.investors),ts=num(t.totalStake);let need=0;if(l<500)need+=40;if(i>=20)need+=20;if(ts>l)need+=40;need=Math.min(need,100);let profit=Math.min(rr*2+Math.min(i,50)+Math.min(l/100,30),100);let sustainability=Math.max(0,Math.min(100,100-num(r.score)+Math.min(l/100,20)));return{...p,code:code(p),title:title(p),type:type(p),liquidity:l,investors:i,totalStake:ts,roi:rr,risk:r.risk,riskScore:r.score,treasuryHealth:r.treasuryHealth,withdrawnCapital:num(t.withdrawnCapital),withdrawnReward:num(t.withdrawnReward),liquidityNeed:need,profitScore:profit,sustainability};}
  async function getEconomicIntelligence(){const out=[];for(const p of await getAllProjects()){const x=await getEconomicMetrics(code(p));if(x)out.push(x);}return out;}
  const getLiquidityPriority=async(l=5)=>(await getEconomicIntelligence()).sort((a,b)=>b.liquidityNeed-a.liquidityNeed).slice(0,l);
  const getTopProfitProjects=async(l=5)=>(await getEconomicIntelligence()).sort((a,b)=>b.profitScore-a.profitScore).slice(0,l);
  const getHighRiskProjects=async(l=5)=>(await getEconomicIntelligence()).filter(x=>x.risk==="HIGH").slice(0,l);
  const getStrongestProjects=async(l=5)=>(await getEconomicIntelligence()).sort((a,b)=>b.sustainability-a.sustainability).slice(0,l);
  async function getInvestmentRecommendations(){return(await getEconomicIntelligence()).map(p=>({...p,recommendation:p.risk==="LOW"&&p.sustainability>=80&&p.profitScore>=70?"INVEST":p.risk==="HIGH"||p.sustainability<40?"AVOID":"HOLD"}));}

  async function getProjectMetrics(c){const p=await getProject(c);if(!p)return null;const[t,r]=await Promise.all([getProjectTreasuryStatus(c),getProjectRisk(c)]);return{code:code(p),title:title(p),type:type(p),liquidity:num(t.liquidity),investors:num(t.investors),totalStake:num(t.totalStake),totalReward:num(t.totalReward),roi:roi(p),riskScore:num(r.score),riskLevel:r.risk||"UNKNOWN"};}
  async function getMarketMetrics(force=false){const n=network(),now=Date.now();if(!force&&marketNet===n&&marketCache.length&&now-marketAt<CACHE)return copy(marketCache);const out=[];for(const p of await getAllProjects()){const x=await getProjectMetrics(code(p));if(x)out.push(x);}marketCache=out;marketNet=n;marketAt=now;return copy(out);}
  const getTopROIProjects=async(l=5)=>(await getMarketMetrics()).sort((a,b)=>b.roi-a.roi).slice(0,l);
  const getHighestLiquidityProjects=async(l=5)=>(await getMarketMetrics()).sort((a,b)=>b.liquidity-a.liquidity).slice(0,l);
  const getMostInvestedProjects=async(l=5)=>(await getMarketMetrics()).sort((a,b)=>b.investors-a.investors).slice(0,l);
  const getSafestProjects=async(l=5)=>(await getMarketMetrics()).sort((a,b)=>a.riskScore-b.riskScore).slice(0,l);
  async function getMarketLeaderboard(sort="default"){const d=[...await getMarketMetrics()];switch(norm(sort)){case"roi":d.sort((a,b)=>b.roi-a.roi);break;case"liquidity":d.sort((a,b)=>b.liquidity-a.liquidity);break;case"investors":d.sort((a,b)=>b.investors-a.investors);break;case"risk":d.sort((a,b)=>a.riskScore-b.riskScore);break;default:d.sort((a,b)=>str(a.title).localeCompare(str(b.title)));}return d;}
  async function getMarketSummary(){const d=await getMarketMetrics();const t=d.reduce((a,x)=>(a.liquidity+=num(x.liquidity),a.stake+=num(x.totalStake),a.investors+=num(x.investors),a.roi+=num(x.roi),a.risk+=num(x.riskScore),a),{liquidity:0,stake:0,investors:0,roi:0,risk:0});return{projects:d.length,liquidity:t.liquidity,stake:t.stake,investors:t.investors,averageROI:d.length?t.roi/d.length:0,averageRisk:d.length?t.risk/d.length:0};}
  async function searchMarketProjects(k=""){const s=norm(k),d=await getMarketMetrics();return s?d.filter(p=>norm(p.code).includes(s)||norm(p.title).includes(s)||norm(p.type).includes(s)):d;}
  const refreshMarketRanking=()=>{marketCache=[];marketNet=null;marketAt=0;return getMarketMetrics(true);};

  async function getProjectDiscoveryScore(c){const m=await getProjectMetrics(c);if(!m)return 0;return Math.min(m.liquidity/10,100)*.35+Math.min(m.investors*5,100)*.25+Math.min(m.roi*5,100)*.2+(100-m.riskScore)*.2;}
  async function getDiscoveryProjects(force=false){const n=network(),now=Date.now();if(!force&&discoveryNet===n&&discoveryCache.length&&now-discoveryAt<CACHE)return copy(discoveryCache);const out=[];for(const m of await getMarketMetrics(force))out.push({...m,discoveryScore:await getProjectDiscoveryScore(m.code)});discoveryCache=out;discoveryNet=n;discoveryAt=now;return copy(out);}
  const getTrendingProjects=async(l=5)=>(await getDiscoveryProjects()).sort((a,b)=>b.discoveryScore-a.discoveryScore).slice(0,l);
  const getFeaturedProjects=async(l=5)=>(await getDiscoveryProjects()).filter(p=>p.liquidity>=300&&p.riskLevel==="LOW").sort((a,b)=>b.discoveryScore-a.discoveryScore).slice(0,l);
  const getHotProjects=getTrendingProjects;
  async function sortByDiscovery(){return(await getDiscoveryProjects()).sort((a,b)=>b.discoveryScore-a.discoveryScore);}
  async function getNewestProjects(l=5){return(await getAllProjects()).sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,l);}
  async function getDiscoveryDashboard(){const[t,f,h,n,s]=await Promise.all([getTrendingProjects(),getFeaturedProjects(),getHotProjects(),getNewestProjects(),getSafestProjects()]);return{trending:t,featured:f,hot:h,newest:n,safest:s};}
  const refreshDiscovery=()=>{discoveryCache=[];discoveryNet=null;discoveryAt=0;return getDiscoveryProjects(true);};

  const ProjectModeration={};const MIN_LIQUIDITY=100,MAX_RISK_SCORE=75,MAX_REWARD_RATE=20;
  ProjectModeration.evaluate=async c=>{const p=await getProject(c);if(!p)return null;const[t,r]=await Promise.all([getProjectTreasuryStatus(c),getProjectRisk(c)]),flags=[];if(t.liquidity<MIN_LIQUIDITY)flags.push({code:"LOW_LIQUIDITY",message:"Project liquidity is below minimum."});if(roi(p)>MAX_REWARD_RATE)flags.push({code:"HIGH_REWARD",message:"Reward rate exceeds safe limit."});if(r.score>MAX_RISK_SCORE)flags.push({code:"HIGH_RISK",message:"Project risk is above acceptable level."});let status=flags.length?"review":"approved";if(r.risk==="HIGH"&&t.liquidity<MIN_LIQUIDITY)status="blocked";return{code:code(p),title:title(p),status,flags,liquidity:t.liquidity,rewardRate:roi(p),investors:t.investors,totalStake:t.totalStake,risk:r,score:r.score};};
  ProjectModeration.evaluateAll=async()=>{const out=[];for(const p of await getAllProjects()){const x=await ProjectModeration.evaluate(code(p));if(x)out.push(x);}return out;};
  ProjectModeration.getApproved=async()=> (await ProjectModeration.evaluateAll()).filter(x=>x.status==="approved");
  ProjectModeration.getReviewQueue=async()=> (await ProjectModeration.evaluateAll()).filter(x=>x.status==="review");
  ProjectModeration.getBlocked=async()=> (await ProjectModeration.evaluateAll()).filter(x=>x.status==="blocked");
  ProjectModeration.summary=async()=>{const d=await ProjectModeration.evaluateAll();return{approved:d.filter(x=>x.status==="approved").length,review:d.filter(x=>x.status==="review").length,blocked:d.filter(x=>x.status==="blocked").length,total:d.length};};
  window.ProjectModeration=ProjectModeration;

  const CoreProjects={};
  CoreProjects.getAll=async(force=false)=>{const n=network(),now=Date.now();if(!force&&coreNet===n&&coreCache.length&&now-coreAt<CACHE)return copy(coreCache);coreCache=(await getProjects({activeOnly:false,forceRefresh:force})).filter(p=>type(p)==="core");coreNet=n;coreAt=now;return copy(coreCache);};
  CoreProjects.get=async c=>find(await CoreProjects.getAll(),c);
  CoreProjects.exists=async c=>!!(await CoreProjects.get(c));
  CoreProjects.count=async()=> (await CoreProjects.getAll()).length;
  CoreProjects.summary=async()=>{const d=await CoreProjects.getAll(),r=d.reduce((s,p)=>s+roi(p),0),l=d.reduce((s,p)=>s+num(p.liquidity),0);return{projects:d.length,averageROI:d.length?Number((r/d.length).toFixed(4)):0,liquidity:l};};
  CoreProjects.refresh=()=>{coreCache=[];coreNet=null;coreAt=0;return CoreProjects.getAll(true);};
  window.CoreProjects=CoreProjects;

  async function invest(payload={}){
    if(!payload.project)throw new Error("Project is required.");
    const p=await getProject(payload.project);if(!p)throw new Error("Project not found.");
    const amount=num(payload.amount);if(amount<=0)throw new Error("Investment amount must be greater than zero.");
    if(amount<minimum(p))throw new Error(`Minimum investment is ${minimum(p)} Pi.`);
    if(!window.AlbukhrEcosystem||typeof window.AlbukhrEcosystem.invest!=="function")throw new Error("ALBUKHR investment engine is unavailable.");
    const n=network();if(payload.network&&norm(payload.network)!==n)throw new Error(`Network mismatch: current environment is ${n}.`);
    return window.AlbukhrEcosystem.invest({...payload,project:code(p),amount,network:n});
  }

  const API={getProjects,getProject,getActiveProjects,getAllProjects,getProjectTreasuryStatus,getProjectTreasuryHistory,getProjectLiquidity,getAllTreasury,refreshTreasury,getProjectRisk,calculateProjectROI,getEconomicMetrics,getEconomicIntelligence,getLiquidityPriority,getTopProfitProjects,getHighRiskProjects,getStrongestProjects,getInvestmentRecommendations,getProjectMetrics,getMarketMetrics,getMarketSummary,getTopROIProjects,getHighestLiquidityProjects,getMostInvestedProjects,getSafestProjects,getMarketLeaderboard,searchMarketProjects,refreshMarketRanking,getProjectDiscoveryScore,getDiscoveryProjects,getTrendingProjects,getFeaturedProjects,getHotProjects,getNewestProjects,sortByDiscovery,getDiscoveryDashboard,refreshDiscovery,invest};
  window.AlbukhrMarketplace=API;
  window.AlbukhrMarketplaceUI={escapeHTML:v=>str(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"),getProjectByCode:find,calculateROI:(a,r)=>(num(a)*num(r)/100).toFixed(2),invest};
  Object.assign(window,API);
  window.AlbukhrMarketplaceHealth=()=>{let n=null,nr=false,sr=false;try{n=network();nr=true;}catch(_){}try{sr=!!db();}catch(_){}return{ready:nr&&sr,network:n,network_core_ready:nr,supabase_core_ready:sr,investment_engine_ready:!!(window.AlbukhrEcosystem&&typeof window.AlbukhrEcosystem.invest==="function"),project_engine_ready:!!(window.AlbukhrProjects||window.AlbukhrProjectEngine),local_storage_used:false,session_storage_used:false};};
  try{console.info(`${ENGINE} loaded (${network()}).`);}catch(_){console.info(`${ENGINE} loaded; network resolves on use.`);}
})();
