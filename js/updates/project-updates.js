/* =========================================
   ALBUKHR PROJECT UPDATES ENGINE v2
   USER-FOUNDATION / NETWORK-ISOLATED
   Target: js/engines/project-updates.js

   DEPENDS ON:
   - js/core/environment-switcher.js
   - js/core/supabase-core.js
   - js/core/pi-auth-core.js
   - project registry exposing getProjectMeta()

   RULES:
   - Pi Auth Core is the user identity source.
   - Network Core is the network source of truth.
   - Supabase Core is the only DB client.
   - No LocalStorage / SessionStorage persistence.
   - Mainnet/Testnet queries and writes are isolated.
   - Storage paths are network-scoped.
   - Existing public API names are preserved.

   DATABASE REQUIREMENT:
   project_updates, project_update_comments and
   project_update_reactions must contain `network`.
========================================= */
(function(window){
"use strict";

if(window.__ALBUKHR_PROJECT_UPDATES_ENGINE_LOADED__) return;
window.__ALBUKHR_PROJECT_UPDATES_ENGINE_LOADED__=true;

const BUCKET="project-updates";
const FEED_LIMIT=50;
const COMMENT_LIMIT=50;
const VERSION="2.0.0";

function network(){
  if(typeof window.requireAlbukhrNetwork!=="function")
    throw new Error("ALBUKHR Network Core is unavailable.");
  const n=String(window.requireAlbukhrNetwork()).trim().toLowerCase();
  if(n!=="mainnet"&&n!=="testnet") throw new Error("ALBUKHR: invalid network.");
  return n;
}

function db(){
  if(typeof window.requireAlbukhrSupabaseClient!=="function")
    throw new Error("ALBUKHR Supabase Core is unavailable.");
  const c=window.requireAlbukhrSupabaseClient();
  if(!c||typeof c.from!=="function"||!c.storage||typeof c.storage.from!=="function")
    throw new Error("ALBUKHR Supabase Core returned an invalid client.");
  return c;
}

function s(v,d=""){return v==null?d:String(v);}
function n(v,d=0){const x=Number(v);return Number.isFinite(x)?x:d;}
function a(v){return Array.isArray(v)?v:[];}
function email(v){return s(v).trim().toLowerCase();}
function role(v){return s(v||"user").trim()||"user";}
function dateMs(v){const x=new Date(v||Date.now()).getTime();return Number.isFinite(x)?x:Date.now();}
function type(v){v=s(v).trim().toLowerCase();return ["core","internal","external"].includes(v)?v:"internal";}
function vote(v){return s(v).trim().toLowerCase();}
function validVote(v){return v==="like"||v==="dislike";}
function typeLabel(v){return ({core:"Core Project",internal:"Internal Project",external:"External Project"})[type(v)]||"Project";}
function badge(v){return ({core:"core-badge",internal:"internal-badge",external:"external-badge"})[type(v)]||"internal-badge";}
function fileName(v){return s(v).replace(/\s+/g,"-").replace(/[^a-zA-Z0-9._-]/g,"").toLowerCase();}
function withNetwork(payload={}){
  const current=network();
  if(payload.network!=null&&s(payload.network).trim().toLowerCase()!==current)
    throw new Error(`Network mismatch: current environment is ${current}, requested ${payload.network}.`);
  return {...payload,network:current};
}
function filter(q){return q.eq("network",network());}
function userSync(){
  return window.AlbukhrPiAuth&&typeof window.AlbukhrPiAuth.getCurrentUser==="function"
    ? window.AlbukhrPiAuth.getCurrentUser()||null:null;
}
async function user(){
  if(typeof window.ensurePiAuth!=="function") throw new Error("ALBUKHR Pi Auth Core is unavailable.");
  const u=await window.ensurePiAuth();
  if(!u?.uid) throw new Error("User authentication is required for this operation.");
  const current=network();
  if(u.network&&s(u.network).trim().toLowerCase()!==current)
    throw new Error(`User/network mismatch: authenticated user belongs to ${u.network}, current environment is ${current}.`);
  return u;
}
function viewerMeta(){
  const u=userSync();
  return {uid:s(u?.uid).trim(),username:s(u?.username).trim()||"ALBUKHR User",wallet_address:s(u?.wallet_address).trim(),email:"",name:s(u?.username).trim()||"ALBUKHR User",role:"user",network:s(u?.network).trim().toLowerCase()||network()};
}
async function resolveViewerMeta(){
  const u=await user();
  return {uid:s(u.uid).trim(),username:s(u.username).trim(),wallet_address:s(u.wallet_address).trim(),email:"",name:s(u.username).trim()||"ALBUKHR User",role:"user",network:network()};
}
function dispatch(detail={}){try{window.dispatchEvent(new CustomEvent("projectFeedUpdated",{detail:{...detail,network:network()}}));}catch(_) {}}

async function resolveProjectMeta(code){
  code=s(code).trim(); if(!code) throw new Error("Project code is required.");
  if(typeof window.getProjectMeta!=="function") return {project_code:code,project_name:code,project_type:"internal",status:"active",network:network()};
  const p=await window.getProjectMeta(code);
  if(!p) return {project_code:code,project_name:code,project_type:"internal",status:"active",network:network()};
  const current=network();
  if(p.network&&s(p.network).trim().toLowerCase()!==current) throw new Error(`Project "${code}" belongs to ${p.network}, not ${current}.`);
  return {...p,network:current,project_code:s(p.project_code||code),project_name:s(p.project_name||p.name||code),project_type:type(p.project_type),status:s(p.status||"active").toLowerCase()};
}
function storagePath(projectType,projectCode,name){
  const code=s(projectCode||"unknown-project").trim().replace(/\s+/g,"_").replace(/[^a-zA-Z0-9_-]/g,"_");
  return `${network()}/${type(projectType)}/${code}/${Date.now()}-${fileName(name||"project-update")}`;
}
function publicUrl(path){const {data}=db().storage.from(BUCKET).getPublicUrl(path);return data?.publicUrl||"";}

async function uploadProjectUpdateImage(file,{projectCode="",projectType="internal"}={}){
  if(!file) throw new Error("Update image file is required.");
  if(!s(projectCode).trim()) throw new Error("Project code is required.");
  const path=storagePath(projectType,projectCode,file.name||"project-update.jpg");
  const {error}=await db().storage.from(BUCKET).upload(path,file,{upsert:false,cacheControl:"3600"});
  if(error) throw new Error(error.message||"Failed to upload update image.");
  return {path,publicUrl:publicUrl(path),network:network()};
}

async function createProjectUpdate(payload={}){
  const code=s(payload.project_code).trim(), name=s(payload.project_name).trim();
  if(!code) throw new Error("project_code is required.");
  if(!name) throw new Error("project_name is required.");
  const row=withNetwork({project_code:code,project_name:name,project_type:type(payload.project_type),title:s(payload.title).trim()||null,description:s(payload.description).trim(),image_url:s(payload.image_url).trim()||null,created_by_email:s(payload.created_by_email).trim()||null,created_by_name:s(payload.created_by_name).trim()||null,created_by_role:s(payload.created_by_role).trim()||null,created_by_uid:s(payload.created_by_uid).trim()||null,is_visible:payload.is_visible===false?false:true});
  const {data,error}=await db().from("project_updates").insert(row).select("*").single();
  if(error) throw new Error(error.message||"Failed to create project update.");
  dispatch({type:"create",update:data}); return data;
}

async function uploadProjectUpdateToSupabase({projectCode="",projectName="",projectType="internal",title="",description="",file=null,imageFile=null,createdByEmail="",createdByName="",createdByRole="",createdByUid=""}={}){
  projectCode=s(projectCode).trim(); projectName=s(projectName).trim(); const picked=imageFile||file||null;
  if(!projectCode) throw new Error("Project code is required.");
  if(!projectName) throw new Error("Project name is required.");
  if(!picked) throw new Error("Project update image is required.");
  const image=await uploadProjectUpdateImage(picked,{projectCode,projectType});
  const update=await createProjectUpdate({project_code:projectCode,project_name:projectName,project_type:projectType,title,description,image_url:image.publicUrl,created_by_email:createdByEmail,created_by_name:createdByName,created_by_role:createdByRole,created_by_uid:createdByUid,is_visible:true});
  return {update,image};
}

async function fetchProjectUpdates({projectCode="",projectType="",visibleOnly=true,limit=FEED_LIMIT}={}){
  limit=n(limit,FEED_LIMIT);if(limit<=0)limit=FEED_LIMIT;
  let q=db().from("project_updates").select("*").order("created_at",{ascending:false}).limit(limit); q=filter(q);
  if(visibleOnly)q=q.eq("is_visible",true); if(projectCode)q=q.eq("project_code",s(projectCode).trim()); if(projectType)q=q.eq("project_type",type(projectType));
  const {data,error}=await q;if(error)throw new Error(error.message||"Failed to fetch project updates."); return a(data);
}

async function fetchProjectUpdateComments(updateId,{visibleOnly=true,limit=COMMENT_LIMIT}={}){
  updateId=s(updateId).trim();if(!updateId)throw new Error("updateId is required."); limit=n(limit,COMMENT_LIMIT);if(limit<=0)limit=COMMENT_LIMIT;
  let q=db().from("project_update_comments").select("*").eq("update_id",updateId).order("created_at",{ascending:true}).limit(limit);q=filter(q);if(visibleOnly)q=q.eq("is_visible",true);
  const {data,error}=await q;if(error)throw new Error(error.message||"Failed to fetch update comments.");return a(data);
}
async function fetchCommentsMapForUpdates(ids=[]){
  ids=a(ids).map(x=>s(x).trim()).filter(Boolean);if(!ids.length)return {};
  let q=db().from("project_update_comments").select("*").in("update_id",ids).eq("is_visible",true).order("created_at",{ascending:true});q=filter(q);
  const {data,error}=await q;if(error)throw new Error(error.message||"Failed to fetch comments map.");const map={};a(data).forEach(c=>{const k=s(c.update_id).trim();(map[k]||(map[k]=[])).push(c);});return map;
}
function normalizeCommentRow(c={}){return {...c,id:s(c.id).trim(),update_id:s(c.update_id).trim(),network:s(c.network).trim().toLowerCase(),text:s(c.comment_text).trim(),comment_text:s(c.comment_text).trim(),commenter_uid:s(c.commenter_uid).trim(),commenter_name:s(c.commenter_name).trim()||"User",commenter_role:s(c.commenter_role).trim()||"user",created_at:c.created_at||null,time_ms:dateMs(c.created_at)};}

async function addProjectUpdateComment({updateId="",commentText="",commenterEmail="",commenterName="",commenterRole="user",commenterUid="",isVisible=true}={}){
  updateId=s(updateId).trim();commentText=s(commentText).trim();if(!updateId)throw new Error("updateId is required.");if(!commentText)throw new Error("Comment text is required.");
  const row=withNetwork({update_id:updateId,comment_text:commentText,commenter_email:email(commenterEmail)||null,commenter_name:s(commenterName).trim()||null,commenter_role:role(commenterRole),commenter_uid:s(commenterUid).trim()||null,is_visible:isVisible===false?false:true});
  const {data,error}=await db().from("project_update_comments").insert(row).select("*").single();if(error)throw new Error(error.message||"Failed to add comment.");dispatch({type:"comment",updateId,comment:data});return data;
}
async function postTransparencyComment(updateId,commentText,viewerMeta=null){const v=viewerMeta||await resolveViewerMeta();return addProjectUpdateComment({updateId,commentText,commenterEmail:s(v.email),commenterName:s(v.name||v.username),commenterRole:role(v.role),commenterUid:s(v.uid),isVisible:true});}

async function getUserReactionForUpdate(updateId,reactorEmail){updateId=s(updateId).trim();reactorEmail=email(reactorEmail);if(!updateId||!reactorEmail)return null;let q=db().from("project_update_reactions").select("*").eq("update_id",updateId).eq("reactor_email",reactorEmail);q=filter(q);const {data,error}=await q.maybeSingle();if(error)throw new Error(error.message||"Failed to fetch user reaction.");return data||null;}
async function fetchReactionsMapForUpdates(ids=[],viewerEmail=""){
  ids=a(ids).map(x=>s(x).trim()).filter(Boolean);if(!ids.length)return {counts:{},userVotes:{}};let q=db().from("project_update_reactions").select("*").in("update_id",ids);q=filter(q);const {data,error}=await q;if(error)throw new Error(error.message||"Failed to fetch update reactions.");const counts={},userVotes={},viewer=email(viewerEmail);
  a(data).forEach(r=>{const id=s(r.update_id).trim(),v=vote(r.vote_type);if(!counts[id])counts[id]={like:0,dislike:0};if(v==="like")counts[id].like++;if(v==="dislike")counts[id].dislike++;if(viewer&&email(r.reactor_email)===viewer)userVotes[id]=v;});return {counts,userVotes};
}
async function toggleProjectUpdateReaction({updateId="",reactorEmail="",reactorName="",reactorRole="user",reactorUid="",voteType="like"}={}){
  updateId=s(updateId).trim();reactorEmail=email(reactorEmail);voteType=vote(voteType);if(!updateId)throw new Error("updateId is required.");if(!reactorEmail)throw new Error("reactorEmail is required by the current reaction schema.");if(!validVote(voteType))throw new Error("voteType must be like or dislike.");
  const existing=await getUserReactionForUpdate(updateId,reactorEmail);
  if(existing&&vote(existing.vote_type)===voteType){let q=db().from("project_update_reactions").delete().eq("id",existing.id);q=filter(q);const {error}=await q;if(error)throw new Error(error.message||"Failed to remove reaction.");dispatch({type:"reaction-remove",updateId,voteType});return {action:"removed",vote:null};}
  if(existing){let q=db().from("project_update_reactions").update({vote_type:voteType,reactor_name:s(reactorName).trim()||existing.reactor_name||null,reactor_role:role(reactorRole),reactor_uid:s(reactorUid).trim()||existing.reactor_uid||null}).eq("id",existing.id);q=filter(q);const {data,error}=await q.select("*").single();if(error)throw new Error(error.message||"Failed to update reaction.");dispatch({type:"reaction-update",updateId,voteType,reaction:data});return {action:"updated",vote:voteType,reaction:data};}
  const row=withNetwork({update_id:updateId,reactor_email:reactorEmail,reactor_name:s(reactorName).trim()||null,reactor_role:role(reactorRole),reactor_uid:s(reactorUid).trim()||null,vote_type:voteType});const {data,error}=await db().from("project_update_reactions").insert(row).select("*").single();if(error)throw new Error(error.message||"Failed to add reaction.");dispatch({type:"reaction-add",updateId,voteType,reaction:data});return {action:"added",vote:voteType,reaction:data};
}
async function toggleTransparencyReaction(updateId,voteType,viewerMeta=null){const v=viewerMeta||await resolveViewerMeta();return toggleProjectUpdateReaction({updateId,reactorEmail:s(v.email),reactorName:s(v.name||v.username),reactorRole:role(v.role),reactorUid:s(v.uid),voteType});}

function normalizeUpdateRow(u={},o={}){const t=type(u.project_type),c=a(o.comments).map(normalizeCommentRow);return {...u,id:s(u.id).trim(),network:s(u.network).trim().toLowerCase(),project_code:s(u.project_code).trim(),project_name:s(u.project_name).trim(),project_type:t,project_type_label:typeLabel(t),title:s(u.title).trim(),description:s(u.description).trim(),image_url:s(u.image_url).trim(),created_by_email:s(u.created_by_email).trim(),created_by_name:s(u.created_by_name).trim(),created_by_role:s(u.created_by_role).trim(),created_by_uid:s(u.created_by_uid).trim(),created_at:u.created_at||null,updated_at:u.updated_at||null,is_visible:!!u.is_visible,comments:c,comments_count:c.length,like_count:n(o.likeCount,0),dislike_count:n(o.dislikeCount,0),user_vote:o.userVote||null,type_badge_class:badge(t),time_ms:dateMs(u.created_at),project:s(u.project_name).trim(),type:typeLabel(t),image:s(u.image_url).trim(),time:dateMs(u.created_at)};}
async function fetchProjectUpdatesFeed({projectCode="",projectType="",visibleOnly=true,limit=FEED_LIMIT,viewerEmail=""}={}){const updates=await fetchProjectUpdates({projectCode,projectType,visibleOnly,limit}),ids=updates.map(x=>s(x.id).trim()).filter(Boolean),[cm,rx]=await Promise.all([fetchCommentsMapForUpdates(ids),fetchReactionsMapForUpdates(ids,viewerEmail)]);return updates.map(u=>{const id=s(u.id).trim(),r=rx.counts[id]||{like:0,dislike:0};return normalizeUpdateRow(u,{comments:cm[id]||[],likeCount:r.like,dislikeCount:r.dislike,userVote:rx.userVotes[id]||null});});}
async function fetchTransparencyFeed(options={}){return fetchProjectUpdatesFeed(options);}

async function getProjectUpdateStats(updateId){updateId=s(updateId).trim();if(!updateId)throw new Error("updateId is required.");let r=db().from("project_update_reactions").select("vote_type").eq("update_id",updateId);let c=db().from("project_update_comments").select("id").eq("update_id",updateId).eq("is_visible",true);[r,c]=[filter(r),filter(c)];const [rr,cr]=await Promise.all([r,c]);if(rr.error)throw new Error(rr.error.message||"Failed to fetch reactions stats.");if(cr.error)throw new Error(cr.error.message||"Failed to fetch comments stats.");let likes=0,dislikes=0;a(rr.data).forEach(x=>{const v=vote(x.vote_type);if(v==="like")likes++;if(v==="dislike")dislikes++;});return {likes,dislikes,comments:a(cr.data).length,network:network()};}
async function deleteProjectUpdate(updateId){updateId=s(updateId).trim();if(!updateId)throw new Error("updateId is required.");let q=db().from("project_updates").delete().eq("id",updateId);q=filter(q);const {error}=await q;if(error)throw new Error(error.message||"Failed to delete project update.");dispatch({type:"delete",updateId});return true;}
async function setProjectUpdateVisibility(updateId,isVisible=true){updateId=s(updateId).trim();if(!updateId)throw new Error("updateId is required.");let q=db().from("project_updates").update({is_visible:!!isVisible}).eq("id",updateId);q=filter(q);const {data,error}=await q.select("*").single();if(error)throw new Error(error.message||"Failed to update visibility.");dispatch({type:"visibility",updateId,update:data});return data;}

/* Explicit-input migration only: never reads browser storage. */
async function migrateLegacyLocalProjectFeedToSupabase({legacyFeed=[],createdByEmail="",createdByName="",createdByRole="system",createdByUid=""}={}){let migrated=0,skipped=0;for(const item of a(legacyFeed)){try{const code=s(item?.project_code||item?.project).trim();if(!code){skipped++;continue;}const p=await resolveProjectMeta(code);await createProjectUpdate({project_code:p.project_code,project_name:p.project_name,project_type:p.project_type,title:item?.title||null,description:item?.description||"",image_url:item?.image||item?.image_url||null,created_by_email:createdByEmail||null,created_by_name:createdByName||null,created_by_role:createdByRole||"system",created_by_uid:createdByUid||null,is_visible:true});migrated++;}catch(e){console.warn("Legacy feed migration skipped:",e);skipped++;}}return {migrated,skipped,source:"explicit-input-only",localStorage_read:false};}

function albukhrProjectUpdatesHealth(){let net=null,err=null;try{net=network();}catch(e){err=e?.message||"Network unavailable.";}return {version:VERSION,ready:!err&&typeof window.requireAlbukhrSupabaseClient==="function",network:net,network_ready:!err,pi_auth_core_ready:!!window.AlbukhrPiAuth,supabase_core_ready:typeof window.requireAlbukhrSupabaseClient==="function",bucket:BUCKET,localStorage_persistence:false,network_isolated:true,network_error:err};}

const API={version:VERSION,bucket:BUCKET,requireNetwork:network,getTransparencyViewerMeta:viewerMeta,resolveTransparencyViewerMeta:resolveViewerMeta,resolveProjectMeta,uploadProjectUpdateImage,createProjectUpdate,uploadProjectUpdateToSupabase,fetchProjectUpdates,fetchProjectUpdateComments,fetchCommentsMapForUpdates,fetchReactionsMapForUpdates,fetchProjectUpdatesFeed,fetchTransparencyFeed,addProjectUpdateComment,postTransparencyComment,getUserReactionForUpdate,toggleProjectUpdateReaction,toggleTransparencyReaction,getProjectUpdateStats,deleteProjectUpdate,setProjectUpdateVisibility,migrateLegacyLocalProjectFeedToSupabase,normalizeUpdateRow,normalizeCommentRow,formatProjectTypeLabel:typeLabel,getTypeBadgeClass:badge,albukhrProjectUpdatesHealth};
window.ALBUKHR_PROJECT_UPDATES=API;
Object.assign(window,{getTransparencyViewerMeta:viewerMeta,resolveTransparencyViewerMeta:resolveViewerMeta,uploadProjectUpdateToSupabase,fetchProjectUpdatesFeed,fetchTransparencyFeed,fetchProjectUpdates,fetchProjectUpdateComments,addProjectUpdateComment,postTransparencyComment,toggleProjectUpdateReaction,toggleTransparencyReaction,getProjectUpdateStats,deleteProjectUpdate,setProjectUpdateVisibility,resolveProjectMeta});
try{window.dispatchEvent(new CustomEvent("albukhrProjectUpdatesReady",{detail:{version:VERSION,network:network()}}));}catch(_){}

})(window);
