/* ALBUKHR ADMIN INTERNAL PROJECTS
   FINAL DIRECT SUPABASE REVIEW VERSION
   IMPORTANT: Approve/Reject do NOT call the old engine methods.
   They NEVER send reviewed_at.
*/

const adminInternalProjectState={projects:[],filtered:[],loading:false};

const els={
 list:document.getElementById("list"),
 refreshProjectsBtn:document.getElementById("refreshProjectsBtn"),
 pageNotice:document.getElementById("pageNotice"),
 searchInput:document.getElementById("searchInput"),
 statusFilter:document.getElementById("statusFilter"),
 statTotal:document.getElementById("statTotal"),
 statPending:document.getElementById("statPending"),
 statApproved:document.getElementById("statApproved"),
 statRejected:document.getElementById("statRejected"),
 listCount:document.getElementById("listCount")
};

function esc(v){
 return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;")
  .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

function supabase(){
 const c=window.AlbukhrContributorEngine;
 if(c&&typeof c.getSupabaseClient==="function") return c.getSupabaseClient();
 const e=window.AlbukhrInternalRegistryEngine;
 if(e&&typeof e.getSupabaseClient==="function") return e.getSupabaseClient();
 if(window.albukhrSupabase&&typeof window.albukhrSupabase.from==="function") return window.albukhrSupabase;
 if(window.supabaseClient&&typeof window.supabaseClient.from==="function") return window.supabaseClient;
 throw new Error("ALBUKHR Supabase client is not available.");
}

function actor(){
 const a=window.admin||window.currentAdmin||window.AlbukhrAdmin||{};
 return {
  email:String(a.email||localStorage.getItem("albukhr_current_email")||localStorage.getItem("currentUserEmail")||"").trim().toLowerCase(),
  name:String(a.username||a.name||localStorage.getItem("albukhr_current_username")||localStorage.getItem("currentUserName")||"ALBUKHR Admin").trim()||"ALBUKHR Admin"
 };
}

function status(s){
 s=String(s||"").trim().toLowerCase();
 if(s==="pending"||s==="internal_pending") return "internal_pending";
 if(s==="approved"||s==="internal_approved") return "internal_approved";
 if(s==="rejected"||s==="internal_rejected") return "internal_rejected";
 return s||"internal_pending";
}

function badge(s){
 s=status(s);
 if(s==="internal_approved") return '<span class="badge approved">✓ Approved</span>';
 if(s==="internal_rejected") return '<span class="badge rejected">✗ Rejected</span>';
 if(s==="internal_pending") return '<span class="badge pending">⏳ Pending</span>';
 return '<span class="badge other">'+esc(s)+'</span>';
}

const name=p=>p.project_name||p.projectName||"Unnamed Internal Project";
const creator=p=>p.creator_name||p.creatorName||"—";
const email=p=>String(p.creator_email||p.email||p.creatorEmail||"").trim().toLowerCase();
const iid=p=>p.internal_id||p.albukhr_id||p.albukhrId||"—";
const category=p=>p.category||"—";
const stage=p=>p.stage||"—";
const role=p=>p.creator_role||p.role||"—";
const summary=p=>p.summary||"—";
const problem=p=>p.problem||"—";
const solution=p=>p.solution||"—";
const impact=p=>p.impact||"—";
const funding=p=>p.funding||"—";
const risk=p=>p.risk||"—";
const confidentiality=p=>p.confidentiality||"—";
const roi=p=>p.roi==null||p.roi===""?"—":String(p.roi);
const liquidity=p=>p.initial_liquidity==null||p.initial_liquidity===""?"—":String(p.initial_liquidity);
const dt=v=>v?new Date(v).toLocaleString():"—";
const reviewedBy=p=>p.reviewed_by_name||p.approved_by_name||p.rejected_by_name||"—";
const reason=p=>p.rejection_reason||p.review_note||p.review_reason||"";

function notice(msg,type="info"){
 if(!els.pageNotice)return;
 els.pageNotice.className="notice "+type;
 els.pageNotice.textContent=msg;
 els.pageNotice.classList.remove("hidden");
}

async function fetchInternalProjects(){
 try{
  adminInternalProjectState.loading=true;
  if(els.refreshProjectsBtn){els.refreshProjectsBtn.disabled=true;els.refreshProjectsBtn.textContent="Refreshing...";}
  if(els.list)els.list.innerHTML='<div class="empty">Loading internal projects...</div>';

  const {data,error}=await supabase().from("albukhr_internal_projects")
   .select("*").order("created_at",{ascending:false}).limit(500);

  if(error)throw new Error(error.message||"Failed to load internal projects.");

  adminInternalProjectState.projects=Array.isArray(data)?data:[];
  updateStats(adminInternalProjectState.projects);
  applyFilters();
  notice(adminInternalProjectState.projects.length?`Loaded ${adminInternalProjectState.projects.length} internal project(s).`:"No internal projects are currently available.","success");
 }catch(e){
  console.error(e);
  adminInternalProjectState.projects=[];
  adminInternalProjectState.filtered=[];
  updateStats([]);
  if(els.list)els.list.innerHTML='<div class="empty">Failed to load internal projects.</div>';
  notice(e?.message||"Unable to load internal project list.","error");
 }finally{
  adminInternalProjectState.loading=false;
  if(els.refreshProjectsBtn){els.refreshProjectsBtn.disabled=false;els.refreshProjectsBtn.textContent="Refresh Internal Projects";}
 }
}

/* =========================================================
   APPROVE — DIRECT SUPABASE ONLY
   NO reviewed_at
========================================================= */
async function approveInternalProject(projectId){
 if(!projectId)return alert("Internal project ID is missing.");
 if(!confirm("Approve this internal project?"))return;

 try{
  const a=actor(), now=new Date().toISOString();

  const payload={
   status:"internal_approved",
   approved_at:now,
   approved_by_email:a.email||null,
   approved_by_name:a.name,
   rejected_at:null,
   rejected_by_email:null,
   rejected_by_name:null,
   rejection_reason:null,
   reviewed_by_email:a.email||null,
   reviewed_by_name:a.name,
   updated_at:now
  };

  /* NEVER add reviewed_at here. */
  const {data,error}=await supabase().from("albukhr_internal_projects")
   .update(payload).eq("id",projectId).select("*").single();

  if(error)throw new Error(error.message||"Failed to approve internal project.");

  console.log("ALBUKHR approved:",data);
  await fetchInternalProjects();
  alert("Internal project approved successfully.");
 }catch(e){
  console.error("Approve error:",e);
  alert(e?.message||"Unable to approve internal project.");
 }
}

/* =========================================================
   REJECT — DIRECT SUPABASE ONLY
   NO reviewed_at
========================================================= */
async function rejectInternalProject(projectId){
 if(!projectId)return alert("Internal project ID is missing.");
 const r=prompt("Optional rejection reason (you can leave this blank):","")||"";
 if(!confirm("Reject this internal project?"))return;

 try{
  const a=actor(), now=new Date().toISOString();

  const payload={
   status:"internal_rejected",
   rejected_at:now,
   rejected_by_email:a.email||null,
   rejected_by_name:a.name,
   rejection_reason:r.trim()||null,
   approved_at:null,
   approved_by_email:null,
   approved_by_name:null,
   reviewed_by_email:a.email||null,
   reviewed_by_name:a.name,
   updated_at:now
  };

  /* NEVER add reviewed_at here. */
  const {data,error}=await supabase().from("albukhr_internal_projects")
   .update(payload).eq("id",projectId).select("*").single();

  if(error)throw new Error(error.message||"Failed to reject internal project.");

  console.log("ALBUKHR rejected:",data);
  await fetchInternalProjects();
  alert("Internal project rejected successfully.");
 }catch(e){
  console.error("Reject error:",e);
  alert(e?.message||"Unable to reject internal project.");
 }
}

function updateStats(list){
 if(els.statTotal)els.statTotal.textContent=list.length;
 if(els.statPending)els.statPending.textContent=list.filter(p=>status(p.status)==="internal_pending").length;
 if(els.statApproved)els.statApproved.textContent=list.filter(p=>status(p.status)==="internal_approved").length;
 if(els.statRejected)els.statRejected.textContent=list.filter(p=>status(p.status)==="internal_rejected").length;
}

function applyFilters(){
 const q=String(els.searchInput?.value||"").trim().toLowerCase();
 const st=els.statusFilter?.value||"all";
 let list=[...adminInternalProjectState.projects];

 if(st!=="all")list=list.filter(p=>status(p.status)===st);

 if(q)list=list.filter(p=>[
  name(p),creator(p),email(p),iid(p),category(p),stage(p),role(p),
  summary(p),problem(p),solution(p),impact(p),funding(p),risk(p),
  confidentiality(p),reason(p)
 ].join(" ").toLowerCase().includes(q));

 adminInternalProjectState.filtered=list;
 renderList();
}

function renderList(){
 const list=adminInternalProjectState.filtered||[];
 if(els.listCount)els.listCount.textContent=`${list.length} record${list.length===1?"":"s"}`;

 if(!els.list)return;
 if(!list.length){
  els.list.innerHTML='<div class="empty">No internal projects found for the current filter.</div>';
  return;
 }

 els.list.innerHTML=list.map(p=>{
  const st=status(p.status), id=String(p.id||""), rr=reason(p);

  const actions=st==="internal_pending"
   ? `<button class="approve" onclick="approveInternalProject('${esc(id)}')">✓ Approve</button>
      <button class="reject" onclick="rejectInternalProject('${esc(id)}')">✕ Reject</button>`
   : st==="internal_approved"
   ? '<span class="badge approved">✓ Approved</span>'
   : st==="internal_rejected"
   ? '<span class="badge rejected">✗ Rejected</span>':"";

  const review=(st!=="internal_pending"||rr)?`
   <div class="review-box">
    <div class="review-title">Review Record</div>
    <div class="meta">
     <b>Status:</b> ${esc(st)}<br>
     <b>Reviewed By:</b> ${esc(reviewedBy(p))}<br>
     <b>Approved At:</b> ${esc(dt(p.approved_at))}<br>
     <b>Rejected At:</b> ${esc(dt(p.rejected_at))}
     ${rr?`<br><b>Reason:</b> ${esc(rr)}`:""}
    </div>
   </div>`:"";

  return `<div class="project-card">
   <div class="project-top">
    <div>
     <h3 class="project-name">${esc(name(p))}</h3>
     <div class="meta">
      📧 ${esc(email(p)||"—")}<br>
      👤 ${esc(creator(p))}<br>
      🆔 ${esc(iid(p))}<br>
      🕒 Submitted: ${esc(dt(p.created_at))}
     </div>
    </div>
    <div>${badge(st)}</div>
   </div>

   <div class="info-grid">
    <div class="info-box"><div class="info-label">Category</div><div class="info-value">${esc(category(p))}</div></div>
    <div class="info-box"><div class="info-label">Stage</div><div class="info-value">${esc(stage(p))}</div></div>
    <div class="info-box"><div class="info-label">Role</div><div class="info-value">${esc(role(p))}</div></div>
    <div class="info-box"><div class="info-label">Funding</div><div class="info-value">${esc(funding(p))}</div></div>
    <div class="info-box"><div class="info-label">Risk</div><div class="info-value">${esc(risk(p))}</div></div>
    <div class="info-box"><div class="info-label">Confidentiality</div><div class="info-value">${esc(confidentiality(p))}</div></div>
    <div class="info-box"><div class="info-label">Expected ROI (%)</div><div class="info-value">${esc(roi(p))}</div></div>
    <div class="info-box"><div class="info-label">Initial Liquidity (Pi)</div><div class="info-value">${esc(liquidity(p))}</div></div>
    <div class="info-box"><div class="info-label">Contributor Email</div><div class="info-value">${esc(email(p)||"—")}</div></div>
   </div>

   <div class="block"><b>Project Summary</b><br>${esc(summary(p))}</div>
   <div class="block"><b>Problem Statement</b><br>${esc(problem(p))}</div>
   <div class="block"><b>Solution / Innovation</b><br>${esc(solution(p))}</div>
   <div class="block"><b>Expected Impact</b><br>${esc(impact(p))}</div>

   ${review}

   <div class="actions">${actions}</div>
  </div>`;
 }).join("");
}

function bindEvents(){
 if(els.refreshProjectsBtn)els.refreshProjectsBtn.addEventListener("click",fetchInternalProjects);
 if(els.searchInput)els.searchInput.addEventListener("input",applyFilters);
 if(els.statusFilter)els.statusFilter.addEventListener("change",applyFilters);
}

window.approveInternalProject=approveInternalProject;
window.rejectInternalProject=rejectInternalProject;
window.fetchInternalProjects=fetchInternalProjects;

document.addEventListener("DOMContentLoaded",async()=>{
 try{
  bindEvents();
  await fetchInternalProjects();
 }catch(e){
  console.error("ALBUKHR admin internal init:",e);
  notice(e?.message||"Failed to initialize admin internal projects.","error");
 }
});
