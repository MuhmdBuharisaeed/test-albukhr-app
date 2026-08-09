/* ALBUKHR EXTERNAL PROJECT ACCESS ENGINE v4 FINAL
   Supabase table: external_project_access
   Depends on: supabase-core.js + external-project-engine.js
*/

const EXTERNAL_ACCESS_TABLE = "external_project_access";
const DEFAULT_ACCESS_ROLE = "viewer";
const DEFAULT_ACCESS_STATUS = "active";

function accessClient(){
  if(typeof window.getAlbukhrSupabaseClient === "function"){
    const c = window.getAlbukhrSupabaseClient();
    if(c) return c;
  }
  return window.albukhrSupabase || null;
}

function accessString(v,f=""){ return v===null||v===undefined?f:String(v); }
function accessNumber(v,f=0){ const n=Number(v); return Number.isFinite(n)?n:f; }
function accessNow(){ return new Date().toISOString(); }

function accessArray(v){
  if(Array.isArray(v)) return v;
  if(typeof v==="string"){
    try{ const x=JSON.parse(v); if(Array.isArray(x)) return x; }catch(e){}
    return v.split(",").map(x=>x.trim()).filter(Boolean);
  }
  return [];
}

function accessObject(v){
  if(v && typeof v==="object" && !Array.isArray(v)) return v;
  if(typeof v==="string"){
    try{
      const x=JSON.parse(v);
      if(x && typeof x==="object" && !Array.isArray(x)) return x;
    }catch(e){}
  }
  return {};
}

function assertExternalAccessDependencies(){
  if(!accessClient()){
    throw new Error("supabase-core.js must be loaded before external-project-access-engine.js");
  }
  if(
    typeof getExternalProjectByCode !== "function" &&
    typeof getExternalProject !== "function"
  ){
    throw new Error("external-project-engine.js must be loaded before external-project-access-engine.js");
  }
}

async function resolveExternalProject(projectCode){
  if(!projectCode) return null;
  try{
    if(typeof getExternalProjectByCode==="function"){
      const p=await getExternalProjectByCode(projectCode);
      if(p && !p.error) return p;
    }
    if(typeof getExternalProject==="function"){
      const p=await getExternalProject(projectCode);
      if(p && !p.error) return p;
    }
  }catch(e){ console.warn("External project resolution failed:",e); }
  return null;
}

function normalizeExternalProjectAccessRow(row={}){
  return {
    id:row.id??null,
    project_code:accessString(row.project_code),
    project_name:accessString(row.project_name),
    project_type:accessString(row.project_type||"external"),
    user_id:accessString(row.user_id??row.userid??row.userId),
    username:accessString(row.username??row.user_name??row.userName),
    wallet_address:accessString(row.wallet_address??row.wallet??row.walletAddress),
    role:accessString(row.role||DEFAULT_ACCESS_ROLE),
    permissions:accessArray(row.permissions),
    status:accessString(row.status||DEFAULT_ACCESS_STATUS),
    start_date:row.start_date||null,
    expiry_date:row.expiry_date||null,
    granted_by:accessString(row.granted_by??row.grantedBy),
    granted_by_username:accessString(row.granted_by_username??row.grantedByUsername),
    note:accessString(row.note),
    metadata:accessObject(row.metadata??row.meta),
    created_at:row.created_at||null,
    updated_at:row.updated_at||null,
    raw:row
  };
}

function evaluateExternalProjectAccessStatus(row){
  const status=accessString(row?.status||DEFAULT_ACCESS_STATUS).trim().toLowerCase();
  const now=Date.now();
  const start=row?.start_date?new Date(row.start_date).getTime():null;
  const expiry=row?.expiry_date?new Date(row.expiry_date).getTime():null;

  if(status==="revoked") return {valid:false,reason:"Access has been revoked"};
  if(["suspended","disabled","inactive"].includes(status))
    return {valid:false,reason:`Access status is ${status}`};
  if(start && Number.isFinite(start) && now<start)
    return {valid:false,reason:"Access has not started yet"};
  if(expiry && Number.isFinite(expiry) && now>expiry)
    return {valid:false,reason:"Access has expired"};

  return {valid:true,reason:""};
}

function buildExternalProjectAccessPayload({
  project=null,projectCode=null,user_id,username="",wallet_address="",
  role=DEFAULT_ACCESS_ROLE,permissions=[],status=DEFAULT_ACCESS_STATUS,
  start_date=null,expiry_date=null,granted_by="",granted_by_username="",
  note="",metadata={}
}={}){
  return {
    project_code:accessString(projectCode||project?.project_code),
    project_name:accessString(project?.project_name),
    project_type:accessString(project?.project_type||"external"),
    user_id:accessString(user_id),
    username:accessString(username),
    wallet_address:accessString(wallet_address),
    role:accessString(role||DEFAULT_ACCESS_ROLE),
    permissions:accessArray(permissions),
    status:accessString(status||DEFAULT_ACCESS_STATUS),
    start_date:start_date||null,
    expiry_date:expiry_date||null,
    granted_by:accessString(granted_by),
    granted_by_username:accessString(granted_by_username),
    note:accessString(note),
    metadata:accessObject(metadata)
  };
}

async function getExternalProjectAccessById(accessId){
  if(!accessId) return {error:"Access ID is required"};
  const supabase=accessClient();
  if(!supabase) return {error:"Supabase core client not available"};

  try{
    const {data,error}=await supabase.from(EXTERNAL_ACCESS_TABLE)
      .select("*").eq("id",accessId).maybeSingle();
    if(error) return {error:error.message||"Failed to fetch external project access"};
    if(!data) return {error:"External project access record not found"};
    return {success:true,data:normalizeExternalProjectAccessRow(data)};
  }catch(e){
    return {error:e?.message||"External project access fetch failed"};
  }
}

async function getExternalProjectAccess({
  projectCode=null,user_id=null,username=null,wallet_address=null,
  role=null,status=null,includeExpired=false,limit=100
}={}){
  const supabase=accessClient();
  if(!supabase) return [];

  let q=supabase.from(EXTERNAL_ACCESS_TABLE).select("*")
    .order("created_at",{ascending:false});

  if(projectCode) q=q.eq("project_code",projectCode);
  if(user_id) q=q.eq("user_id",user_id);
  if(username) q=q.eq("username",username);
  if(wallet_address) q=q.eq("wallet_address",wallet_address);
  if(role) q=q.eq("role",role);
  if(status) q=q.eq("status",status);

  limit=accessNumber(limit,100); if(limit<=0) limit=100;
  q=q.limit(limit);

  try{
    const {data,error}=await q;
    if(error){ console.error("getExternalProjectAccess:",error); return []; }

    let rows=(data||[]).map(normalizeExternalProjectAccessRow);
    if(!includeExpired)
      rows=rows.filter(r=>evaluateExternalProjectAccessStatus(r).valid);
    return rows;
  }catch(e){
    console.error("getExternalProjectAccess network error:",e);
    return [];
  }
}

async function getExternalProjectUserAccess(user_id,options={}){
  if(!user_id) return [];
  return getExternalProjectAccess({...options,user_id});
}

async function getAllExternalProjectAccess(projectCode,options={}){
  if(!projectCode) return [];
  return getExternalProjectAccess({...options,projectCode});
}

async function hasExternalProjectAccess(projectCode,user_id){
  if(!projectCode||!user_id) return false;
  const rows=await getExternalProjectAccess({projectCode,user_id,includeExpired:false});
  return rows.length>0;
}

async function hasExternalProjectPermission(projectCode,user_id,permission,options={}){
  if(!projectCode||!user_id||!permission) return false;
  const wanted=accessString(permission).trim().toLowerCase();
  const rows=await getExternalProjectAccess({
    ...options,projectCode,user_id,includeExpired:false
  });
  return rows.some(row=>{
    const p=accessArray(row.permissions).map(x=>accessString(x).trim().toLowerCase());
    return p.includes("*")||p.includes("all")||p.includes(wanted);
  });
}

async function hasExternalProjectRole(projectCode,user_id,role){
  if(!projectCode||!user_id||!role) return false;
  const wanted=accessString(role).trim().toLowerCase();
  const rows=await getExternalProjectAccess({projectCode,user_id,includeExpired:false});
  return rows.some(r=>accessString(r.role).trim().toLowerCase()===wanted);
}

async function grantExternalProjectAccess(options={}){
  const {
    projectCode,user_id,username="",wallet_address="",
    role=DEFAULT_ACCESS_ROLE,permissions=[],status=DEFAULT_ACCESS_STATUS,
    start_date=null,expiry_date=null,granted_by="",granted_by_username="",
    note="",metadata={}
  }=options;

  if(!projectCode) return {error:"Project code is required"};
  if(!user_id) return {error:"User ID is required"};

  const project=await resolveExternalProject(projectCode);
  if(!project) return {error:`External project not found: ${projectCode}`};

  const supabase=accessClient();
  if(!supabase) return {error:"Supabase core client not available"};

  const existing=await getExternalProjectAccess({
    projectCode,user_id,includeExpired:true,limit:100
  });

  const active=existing.find(r=>evaluateExternalProjectAccessStatus(r).valid);
  if(active){
    return {error:"User already has active access to this project",existing:active};
  }

  const payload=buildExternalProjectAccessPayload({
    project,projectCode,user_id,username,wallet_address,role,permissions,
    status,start_date,expiry_date,granted_by,granted_by_username,note,metadata
  });

  try{
    const {data,error}=await supabase.from(EXTERNAL_ACCESS_TABLE)
      .insert(payload).select().single();
    if(error) return {error:error.message||"Failed to grant external project access"};
    return {success:true,action:"grant",data:normalizeExternalProjectAccessRow(data)};
  }catch(e){
    return {error:e?.message||"External project access grant failed"};
  }
}

async function updateExternalProjectAccess(accessId,patch={}){
  if(!accessId) return {error:"Access ID is required"};
  if(!patch||typeof patch!=="object"||Array.isArray(patch))
    return {error:"Invalid access update payload"};

  const supabase=accessClient();
  if(!supabase) return {error:"Supabase core client not available"};

  const allowed=[
    "role","permissions","status","start_date","expiry_date",
    "note","metadata","username","wallet_address"
  ];
  const clean={};

  for(const field of allowed){
    if(Object.prototype.hasOwnProperty.call(patch,field)){
      clean[field]=field==="permissions"
        ? accessArray(patch[field])
        : field==="metadata"
          ? accessObject(patch[field])
          : patch[field];
    }
  }

  if(!Object.keys(clean).length) return {error:"No valid fields supplied for update"};
  clean.updated_at=accessNow();

  try{
    const {data,error}=await supabase.from(EXTERNAL_ACCESS_TABLE)
      .update(clean).eq("id",accessId).select().single();
    if(error) return {error:error.message||"Failed to update external project access"};
    return {success:true,action:"update",data:normalizeExternalProjectAccessRow(data)};
  }catch(e){
    return {error:e?.message||"External project access update failed"};
  }
}

async function revokeExternalProjectAccess(accessId,options={}){
  if(!accessId) return {error:"Access ID is required"};
  const supabase=accessClient();
  if(!supabase) return {error:"Supabase core client not available"};

  const patch={status:"revoked",updated_at:accessNow()};
  if(options.note!==undefined) patch.note=accessString(options.note);
  if(options.metadata!==undefined) patch.metadata=accessObject(options.metadata);

  try{
    const {data,error}=await supabase.from(EXTERNAL_ACCESS_TABLE)
      .update(patch).eq("id",accessId).select().single();
    if(error) return {error:error.message||"Failed to revoke external project access"};
    return {success:true,action:"revoke",data:normalizeExternalProjectAccessRow(data)};
  }catch(e){
    return {error:e?.message||"External project access revoke failed"};
  }
}

async function searchExternalProjectAccess(filters={}){
  const {
    projectCode=null,user_id=null,username=null,wallet_address=null,
    role=null,status=null,search="",includeExpired=false,limit=100
  }=filters;

  let rows=await getExternalProjectAccess({
    projectCode,user_id,username,wallet_address,role,status,
    includeExpired:true,limit
  });

  const term=accessString(search).trim().toLowerCase();
  if(term){
    rows=rows.filter(r=>[
      r.project_code,r.project_name,r.user_id,r.username,
      r.wallet_address,r.role,r.status
    ].map(accessString).join(" ").toLowerCase().includes(term));
  }

  if(!includeExpired)
    rows=rows.filter(r=>evaluateExternalProjectAccessStatus(r).valid);

  return rows;
}

async function getExternalProjectAccessStatus(accessId){
  const result=await getExternalProjectAccessById(accessId);
  if(result.error) return result;
  const state=evaluateExternalProjectAccessStatus(result.data);
  return {
    success:true,access_id:accessId,valid:state.valid,
    reason:state.reason,access:result.data
  };
}

async function getExternalProjectAccessSummary(projectCode){
  if(!projectCode) return {error:"Project code is required"};

  const rows=await getAllExternalProjectAccess(projectCode,{
    includeExpired:true,limit:1000
  });

  let active=0,expired=0,revoked=0,suspended=0;
  const byRole={};

  for(const row of rows){
    const state=evaluateExternalProjectAccessStatus(row);
    const status=accessString(row.status).trim().toLowerCase();

    if(status==="revoked") revoked++;
    else if(["suspended","disabled","inactive"].includes(status)) suspended++;
    else if(row.expiry_date && new Date(row.expiry_date).getTime()<Date.now()) expired++;
    else if(state.valid) active++;

    const role=accessString(row.role||DEFAULT_ACCESS_ROLE);
    byRole[role]=(byRole[role]||0)+1;
  }

  return {
    success:true,project_code:projectCode,
    total_access_records:rows.length,active,expired,revoked,suspended,
    by_role:byRole
  };
}

async function expireExternalProjectAccessRecords(projectCode=null){
  const supabase=accessClient();
  if(!supabase) return {error:"Supabase core client not available"};

  const rows=await getExternalProjectAccess({
    projectCode,status:"active",includeExpired:true,limit:1000
  });

  const expired=rows.filter(r=>{
    if(!r.expiry_date) return false;
    const t=new Date(r.expiry_date).getTime();
    return Number.isFinite(t)&&t<Date.now();
  });

  let updated=0; const errors=[];
  for(const row of expired){
    const {error}=await supabase.from(EXTERNAL_ACCESS_TABLE)
      .update({status:"expired",updated_at:accessNow()}).eq("id",row.id);
    if(error) errors.push({access_id:row.id,error:error.message});
    else updated++;
  }

  return {
    success:true,project_code:projectCode,checked:rows.length,
    expired_found:expired.length,updated,errors
  };
}

/* GLOBAL EXPORTS */
window.getExternalProjectAccessById=getExternalProjectAccessById;
window.getExternalProjectAccess=getExternalProjectAccess;
window.getExternalProjectUserAccess=getExternalProjectUserAccess;
window.getAllExternalProjectAccess=getAllExternalProjectAccess;
window.hasExternalProjectAccess=hasExternalProjectAccess;
window.hasExternalProjectPermission=hasExternalProjectPermission;
window.hasExternalProjectRole=hasExternalProjectRole;
window.grantExternalProjectAccess=grantExternalProjectAccess;
window.updateExternalProjectAccess=updateExternalProjectAccess;
window.revokeExternalProjectAccess=revokeExternalProjectAccess;
window.searchExternalProjectAccess=searchExternalProjectAccess;
window.getExternalProjectAccessStatus=getExternalProjectAccessStatus;
window.getExternalProjectAccessSummary=getExternalProjectAccessSummary;
window.expireExternalProjectAccessRecords=expireExternalProjectAccessRecords;
window.buildExternalProjectAccessPayload=buildExternalProjectAccessPayload;
window.normalizeExternalProjectAccessRow=normalizeExternalProjectAccessRow;
window.evaluateExternalProjectAccessStatus=evaluateExternalProjectAccessStatus;
