/* ALBUKHR Projects Engine v3 — Logo-First
   Schema-compatible with current public.projects table.
   Requires js/supabase-core.js.
*/
(function(window){
"use strict";

const TABLE = "projects";
let cache = [];
let loaded = false;
let loading = false;
let lastLoadedAt = null;
let lastSource = "none";

function client(){
  if(typeof window.getAlbukhrSupabaseClient === "function"){
    const c = window.getAlbukhrSupabaseClient();
    if(c) return c;
  }
  return window.albukhrSupabase || null;
}
function str(v,d=""){ return v == null ? d : String(v); }
function num(v,d=0){ const n=Number(v); return Number.isFinite(n)?n:d; }

function type(v){
  v=str(v).trim().toLowerCase();
  return ["core","internal","external"].includes(v) ? v : "core";
}
function status(v){
  v=str(v).trim().toLowerCase();
  if(v==="disabled") return "inactive";
  return ["active","inactive","archived"].includes(v) ? v : "active";
}
function durations(v){
  if(Array.isArray(v)){
    const a=v.map(Number).filter(n=>Number.isFinite(n)&&n>0);
    if(a.length) return a;
  }
  if(typeof v==="string" && v.trim()){
    const a=v.split(",").map(x=>Number(x.trim()))
      .filter(n=>Number.isFinite(n)&&n>0);
    if(a.length) return a;
  }
  return [30,60,90];
}
function mime(v){
  v=str(v).trim().toLowerCase();
  return v==="image/png"||v==="image/jpeg" ? v : "";
}
function logoValid(r){
  const m=mime(r.logo_mime_type);
  const s=Number(r.logo_size_bytes);
  const w=Number(r.logo_width);
  const h=Number(r.logo_height);
  return !!m && Number.isFinite(s)&&s>0&&s<=1048576 &&
         Number.isFinite(w)&&Number.isFinite(h)&&w>=400&&h>=400 &&
         !!str(r.logo_url).trim() || (
           !!m && Number.isFinite(s)&&s>0&&s<=1048576 &&
           Number.isFinite(w)&&Number.isFinite(h)&&w>=400&&h>=400 &&
           !!str(r.logo_path).trim()
         );
}
function normalize(r={}){
  const code=str(r.project_code||r.code||r.slug).trim();
  const name=str(r.project_name||r.title||code||"Unnamed Project").trim();
  return {
    id:r.id??null,
    project_code:code,
    project_name:name,
    title:name,
    project_type:type(r.project_type),
    status:status(r.status),
    icon:str(r.icon,""),
    description:str(r.description||r.desc,"ALBUKHR Project"),
    info:str(r.info,"Project information not available."),
    durations:durations(r.durations),
    reserve_percent:num(r.reserve_percent,.30),
    min_liquidity:num(r.min_liquidity,100),
    reward_rate:num(r.reward_rate,.02),
    is_visible:r.is_visible===false?false:true,
    treasury_enabled:r.treasury_enabled===false?false:true,
    staking_enabled:r.staking_enabled===false?false:true,
    contributions_enabled:r.contributions_enabled===false?false:true,
    logo_url:str(r.logo_url).trim(),
    logo_path:str(r.logo_path).trim(),
    logo_mime_type:mime(r.logo_mime_type)||null,
    logo_size_bytes:r.logo_size_bytes??null,
    logo_width:r.logo_width??null,
    logo_height:r.logo_height??null,
    logo_required:true,
    logo_present:!!(str(r.logo_url).trim()||str(r.logo_path).trim()),
    logo_valid:logoValid(r),
    created_at:r.created_at||null,
    updated_at:r.updated_at||null,
    raw:r
  };
}
function sort(rows){ return [...rows].sort((a,b)=>str(a.project_name).localeCompare(str(b.project_name),undefined,{sensitivity:"base"})); }

async function fetchProjectsFromSupabase(){
  const c=client();
  if(!c) return {success:false,error:"Supabase Core client not available"};
  try{
    const {data,error}=await c.from(TABLE).select("*").order("project_name",{ascending:true});
    if(error) return {success:false,error:error.message||"Failed to load projects"};
    return {success:true,data:sort((data||[]).map(normalize).filter(p=>p.project_code))};
  }catch(e){ return {success:false,error:e?.message||"Projects fetch failed"}; }
}
async function loadProjects(force=false){
  if(loaded&&!force) return cache;
  if(loading&&!force) return cache;
  loading=true;
  const r=await fetchProjectsFromSupabase();
  cache=r.success?r.data:[];
  loaded=true; loading=false; lastLoadedAt=Date.now();
  lastSource=r.success?"supabase":"error";
  if(!r.success) console.warn("projects-engine-v3:",r.error);
  return cache;
}
async function refreshProjectsCache(){ return loadProjects(true); }
async function getAllProjects(o={}){
  let rows=[...(await loadProjects(!!o.forceRefresh))];
  if(o.visibleOnly) rows=rows.filter(p=>p.is_visible!==false);
  if(o.activeOnly) rows=rows.filter(p=>p.status==="active");
  if(o.logoReadyOnly) rows=rows.filter(p=>p.logo_valid===true);
  if(o.treasuryEnabledOnly) rows=rows.filter(p=>p.treasury_enabled!==false);
  if(o.stakingEnabledOnly) rows=rows.filter(p=>p.staking_enabled!==false);
  if(o.contributionsEnabledOnly) rows=rows.filter(p=>p.contributions_enabled!==false);
  return rows;
}
async function getProjects(o={}){return getAllProjects(o);}
async function getActiveProjects(o={}){return getAllProjects({...o,activeOnly:true});}
async function getMarketplaceProjects(o={}){return getAllProjects({...o,activeOnly:true,visibleOnly:true,logoReadyOnly:true});}
async function getProjectsByType(t,o={}){const rows=await getAllProjects(o);t=type(t);return rows.filter(p=>p.project_type===t);}
async function getCoreProjects(o={}){return getProjectsByType("core",o);}
async function getInternalProjects(o={}){return getProjectsByType("internal",o);}
async function getExternalProjects(o={}){return getProjectsByType("external",o);}
async function groupProjectsByType(o={}){const r=await getAllProjects(o);return {core:r.filter(p=>p.project_type==="core"),internal:r.filter(p=>p.project_type==="internal"),external:r.filter(p=>p.project_type==="external")};}
async function getProjectByCode(code){if(!code)return null;const c=str(code).trim().toLowerCase();return (await getAllProjects()).find(p=>str(p.project_code).trim().toLowerCase()===c)||null;}
async function getProjectMeta(c){return getProjectByCode(c);}
async function getProject(c){return getProjectByCode(c);}
async function getProjectLogo(c){const p=await getProjectByCode(c);return p?.logo_url||null;}
async function getProjectLogoUrl(c){return getProjectLogo(c);}
async function getProjectLogoPath(c){const p=await getProjectByCode(c);return p?.logo_path||null;}
async function isProjectLogoReady(c){const p=await getProjectByCode(c);return !!p&&p.logo_valid===true;}
async function hasProjectLogo(c){const p=await getProjectByCode(c);return !!p&&p.logo_present===true;}
async function getProjectTitle(c){const p=await getProjectByCode(c);return p?.project_name||c||"Unknown Project";}
async function getProjectName(c){return getProjectTitle(c);}
async function getProjectIcon(){return "";} // legacy only; emoji is no longer project identity
async function getProjectDescription(c){const p=await getProjectByCode(c);return p?.description||"ALBUKHR Project";}
async function getProjectInfo(c){const p=await getProjectByCode(c);return p?.info||"Project information not available.";}
async function getProjectDurations(c){const p=await getProjectByCode(c);return p?.durations||[30,60,90];}
async function getProjectType(c){const p=await getProjectByCode(c);return p?.project_type||null;}
async function getProjectStatus(c){const p=await getProjectByCode(c);return p?.status||null;}
async function projectExists(c){return !!(await getProjectByCode(c));}
async function isProjectActive(c){const p=await getProjectByCode(c);return !!p&&p.status==="active";}
async function isProjectVisible(c){const p=await getProjectByCode(c);return !!p&&p.is_visible!==false;}
async function isCoreProject(c){const p=await getProjectByCode(c);return !!p&&p.project_type==="core";}
async function isInternalProject(c){const p=await getProjectByCode(c);return !!p&&p.project_type==="internal";}
async function isExternalProject(c){const p=await getProjectByCode(c);return !!p&&p.project_type==="external";}
async function isProjectTreasuryEnabled(c){const p=await getProjectByCode(c);return !!p&&p.treasury_enabled!==false;}
async function isProjectStakingEnabled(c){const p=await getProjectByCode(c);return !!p&&p.staking_enabled!==false;}
async function isProjectContributionsEnabled(c){const p=await getProjectByCode(c);return !!p&&p.contributions_enabled!==false;}
async function getProjectRules(c){const p=await getProjectByCode(c);return {reserve_percent:num(p?.reserve_percent,.30),min_liquidity:num(p?.min_liquidity,100),reward_rate:num(p?.reward_rate,.02)};}
async function getProjectsEngineSummary(){const a=await getAllProjects(),g=await groupProjectsByType();return {total:a.length,core:g.core.length,internal:g.internal.length,external:g.external.length,logo_ready:a.filter(p=>p.logo_valid).length,logo_missing:a.filter(p=>!p.logo_valid).length,loaded,loading,last_loaded_at:lastLoadedAt,source:lastSource};}

Object.assign(window,{
  loadProjects,refreshProjectsCache,getProjects,getAllProjects,getActiveProjects,getMarketplaceProjects,
  getProjectsByType,getCoreProjects,getInternalProjects,getExternalProjects,groupProjectsByType,
  getProjectByCode,getProjectMeta,getProject,getProjectTitle,getProjectName,getProjectIcon,
  getProjectLogo,getProjectLogoUrl,getProjectLogoPath,isProjectLogoReady,hasProjectLogo,
  getProjectDescription,getProjectInfo,getProjectDurations,getProjectType,getProjectStatus,projectExists,
  isProjectActive,isProjectVisible,isCoreProject,isInternalProject,isExternalProject,
  isProjectTreasuryEnabled,isProjectStakingEnabled,isProjectContributionsEnabled,
  getProjectRules,getProjectsEngineSummary
});

window.addEventListener("DOMContentLoaded",()=>loadProjects().catch(e=>console.warn("Projects preload warning:",e)));
console.log("ALBUKHR Projects Engine v3 — Logo-First Ready");

})(window);
