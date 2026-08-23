/* =========================================
   ALBUKHR ADMIN CONTRIBUTORS
   AUDITED / ARCHITECTURE-ALIGNED
   Supabase through Contributor Engine
   No LocalStorage persistence
========================================= */
"use strict";

const state={contributors:[],filtered:[],loading:false};

const notice=document.getElementById("notice");
const list=document.getElementById("contributorsList");
const inviteOutput=document.getElementById("inviteOutput");
const btnInvite=document.getElementById("generateInviteBtn");
const btnRefresh=document.getElementById("refreshBtn");
const searchInput=document.getElementById("searchInput");
const statusFilter=document.getElementById("statusFilter");
const statTotal=document.getElementById("statTotal");
const statPending=document.getElementById("statPending");
const statApproved=document.getElementById("statApproved");
const statRejected=document.getElementById("statRejected");
const listCount=document.getElementById("listCount");

function showNotice(message,type="success"){
  if(!notice)return;
  notice.style.display="block"; notice.textContent=message;
  if(type==="error"){
    notice.style.background="#ffe9e9"; notice.style.color="#b40000"; notice.style.border="1px solid #ffbcbc";
  }else{
    notice.style.background="#eefdf2"; notice.style.color="#0f7a3d"; notice.style.border="1px solid #b9ebca";
  }
}
function hideNotice(){if(notice){notice.style.display="none";notice.textContent="";}}
function setLoading(button,text){
  if(!button)return;
  button.disabled=true; button.dataset.old=button.innerHTML; button.innerHTML=text;
}
function clearLoading(button){
  if(!button)return;
  button.disabled=false; button.innerHTML=button.dataset.old||button.innerHTML;
}
function safe(value){return value==null?"":String(value)}
function escapeHTML(text){return safe(text).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}
function contributorStatus(item){return safe(item.status).toLowerCase().trim()||"pending"}

function getNetwork(){
  if(window.AlbukhrNetwork&&typeof window.AlbukhrNetwork.getCurrentNetwork==="function")
    return String(window.AlbukhrNetwork.getCurrentNetwork()).toLowerCase();
  if(typeof window.getCurrentNetwork==="function") return String(window.getCurrentNetwork()).toLowerCase();
  const h=location.hostname.toLowerCase();
  if(h==="app.albukhr.com"||h==="www.app.albukhr.com")return"mainnet";
  if(h==="test.albukhr.com"||h==="www.test.albukhr.com")return"testnet";
  return"testnet";
}
function getAdminActor(){
  if(typeof getAdmin==="function"){
    const a=getAdmin();
    if(a)return {email:a.email||"",name:a.username||a.name||"ALBUKHR Admin"};
  }
  const a=window.admin||{};
  return {email:a.email||"",name:a.username||a.name||"ALBUKHR Admin"};
}
function contributorEngine(){
  const x=window.AlbukhrContributorEngine;
  if(!x)throw new Error("Contributor Engine not loaded.");
  return x;
}

function updateStats(){
  const total=state.contributors.length;
  const pending=state.contributors.filter(x=>contributorStatus(x)==="pending").length;
  const approved=state.contributors.filter(x=>contributorStatus(x)==="approved").length;
  const rejected=state.contributors.filter(x=>contributorStatus(x)==="rejected").length;
  if(statTotal)statTotal.textContent=total;
  if(statPending)statPending.textContent=pending;
  if(statApproved)statApproved.textContent=approved;
  if(statRejected)statRejected.textContent=rejected;
  if(listCount)listCount.textContent=`${state.filtered.length} Contributors`;
}

async function copyText(text){
  try{await navigator.clipboard.writeText(String(text));showNotice("Copied successfully.");}
  catch{showNotice("Unable to copy value.","error")}
}

function emptyList(message){
  if(list)list.innerHTML=`<div class="card">${escapeHTML(message)}</div>`;
}

async function fetchContributors(){
  hideNotice(); setLoading(btnRefresh,"Refreshing...");
  state.loading=true;
  try{
    const x=contributorEngine(),network=getNetwork();
    if(typeof x.adminListContributors!=="function")throw new Error("Contributor Engine list API is missing.");
    let rows;
    try{rows=await x.adminListContributors({network});}
    catch(e){
      /* Backward-compatible call for an engine that derives network internally. */
      rows=await x.adminListContributors();
    }
    state.contributors=(Array.isArray(rows)?rows:[]).filter(c=>!c.network||String(c.network).toLowerCase()===network);
    updateStats(); applyFilters();
  }catch(error){
    console.error("[Admin Contributors]",error); state.contributors=[]; updateStats(); emptyList("Unable to load contributors.");
    showNotice(error.message||"Failed to load contributors.","error");
  }finally{state.loading=false;clearLoading(btnRefresh)}
}

async function generateInvite(){
  hideNotice(); setLoading(btnInvite,"Generating...");
  try{
    const x=contributorEngine(),network=getNetwork(),actor=getAdminActor();
    if(typeof x.generateContributorInvite!=="function")throw new Error("Contributor Invite API is missing.");
    const result=await x.generateContributorInvite({createdByEmail:actor.email,createdByName:actor.name,network});
    if(!result?.token)throw new Error("Invite token not returned.");
    const inviteLink=result.invite_url||`${window.location.origin}/submit-albukhrecosystem-form.html?invite=${encodeURIComponent(result.token)}`;
    if(inviteOutput){
      inviteOutput.style.display="block";
      inviteOutput.innerHTML=`<b>Invite Link</b><br><br><input value="${escapeHTML(inviteLink)}" readonly style="width:100%;padding:10px"><br><br><button type="button" id="copyContributorInviteBtn">📋 Copy Invite Link</button><br><br><b>Token:</b> ${escapeHTML(result.token)}`;
      document.getElementById("copyContributorInviteBtn")?.addEventListener("click",()=>copyText(inviteLink));
    }
    showNotice("Contributor Invite Generated Successfully.");
  }catch(error){console.error("[Admin Contributors]",error);showNotice(error.message||"Unable to generate invite.","error")}
  finally{clearLoading(btnInvite)}
}

function applyFilters(){
  const keyword=(searchInput?.value||"").toLowerCase().trim();
  const status=statusFilter?.value||"all";
  state.filtered=state.contributors.filter(c=>{
    const text=[c.full_name,c.email,c.phone,c.country,c.albukhr_id,c.skills,c.experience,c.contribution].join(" ").toLowerCase();
    return text.includes(keyword)&&(status==="all"||contributorStatus(c)===status);
  });
  renderList(); updateStats();
}

function renderList(){
  if(!list)return;
  list.innerHTML="";
  if(!state.filtered.length){emptyList("No contributors found.");return;}
  state.filtered.forEach(c=>{
    const card=document.createElement("div");card.className="card";
    const status=contributorStatus(c);
    const badgeColor=status==="approved"?"#0f7a3d":status==="pending"?"#d48b00":"#b71c1c";
    const email=encodeURIComponent(String(c.email||""));
    card.innerHTML=`
      <div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap">
        <img src="${escapeHTML(c.photo_url||"images/avatar.png")}" alt="" style="width:90px;height:90px;border-radius:12px;object-fit:cover;border:1px solid #ddd">
        <div style="flex:1">
          <h3 style="margin:0">${escapeHTML(c.full_name||"Unnamed")}</h3>
          <div style="margin-top:6px;font-size:13px;color:#666">${escapeHTML(c.email||"")}<br>${escapeHTML(c.phone||"")}<br>${escapeHTML(c.country||"")}</div>
          <div style="margin-top:10px"><span style="background:${badgeColor};color:white;padding:5px 12px;border-radius:30px;font-size:12px">${escapeHTML(status.toUpperCase())}</span></div>
          <div style="margin-top:12px;font-size:13px;line-height:1.7"><b>Skills:</b> ${escapeHTML(c.skills||"-")}<br><br><b>Experience:</b> ${escapeHTML(c.experience||"-")}<br><br><b>Contribution:</b> ${escapeHTML(c.contribution||"-")}</div>
          <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
            ${status==="pending"?`<button type="button" onclick="approveContributor('${email}')">Approve</button><button type="button" onclick="rejectContributor('${email}')">Reject</button>`:""}
            ${status==="approved"?`<button type="button" onclick="unlockTelegram('${email}')">Telegram</button><button type="button" onclick="unlockInternal('${email}')">Internal</button><button type="button" onclick="unlockProjectBuilder('${email}')">Project Builder</button>`:""}
          </div>
        </div>
      </div>`;
    list.appendChild(card);
  });
}

function decodeEmail(v){try{return decodeURIComponent(v||"")}catch{return String(v||"")}}

async function contributorAction(method,encodedEmail,success){
  const email=decodeEmail(encodedEmail);
  try{
    const x=contributorEngine();
    if(typeof x[method]!=="function")throw new Error(`Contributor Engine API ${method} is missing.`);
    await x[method](email,{network:getNetwork()}).catch?.(()=>{});
    showNotice(success); await fetchContributors();
  }catch(error){console.error("[Admin Contributors]",error);showNotice(error.message||"Operation failed.","error")}
}

async function approveContributor(email){const e=decodeEmail(email);if(!confirm("Approve this contributor?"))return;try{await contributorEngine().adminApproveContributor(e,{network:getNetwork(),approvedBy:getAdminActor().email});showNotice("Contributor approved successfully.");await fetchContributors()}catch(error){showNotice(error.message||"Unable to approve contributor.","error")}}
async function rejectContributor(email){const e=decodeEmail(email);if(!confirm("Reject this contributor?"))return;try{await contributorEngine().adminRejectContributor(e,{network:getNetwork(),rejectedBy:getAdminActor().email});showNotice("Contributor rejected successfully.");await fetchContributors()}catch(error){showNotice(error.message||"Unable to reject contributor.","error")}}
async function unlockTelegram(email){return contributorAction("adminUnlockTelegram",email,"Telegram unlocked successfully.")}
async function unlockInternal(email){return contributorAction("adminUnlockInternal",email,"Internal access unlocked.")}
async function unlockProjectBuilder(email){return contributorAction("adminUnlockProjectBuilder",email,"Project Builder unlocked.")}

document.addEventListener("DOMContentLoaded",async()=>{
  try{
    if(typeof getAdmin==="function"&&!getAdmin()){location.href="admin-login.html";return}
    if(!window.albukhrSupabase)console.warn("[Admin Contributors] Supabase Core global not exposed; engine remains the data boundary.");
    btnInvite?.addEventListener("click",generateInvite);
    btnRefresh?.addEventListener("click",fetchContributors);
    searchInput?.addEventListener("input",applyFilters);
    statusFilter?.addEventListener("change",applyFilters);
    await fetchContributors();
  }catch(error){console.error(error);showNotice(error.message||"Failed to initialize.","error")}
});

Object.assign(window,{generateInvite,fetchContributors,approveContributor,rejectContributor,unlockTelegram,unlockInternal,unlockProjectBuilder,copyText});
