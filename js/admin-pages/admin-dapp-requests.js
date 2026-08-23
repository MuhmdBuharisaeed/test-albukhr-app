/* =========================================
   ALBUKHR ADMIN dAPP REQUESTS
   AUDITED / ARCHITECTURE-ALIGNED
   Data access through dApp Request Engine
   Network-aware / no direct Supabase / no LocalStorage
========================================= */
"use strict";

const listBox=document.getElementById("adminList");

function escapeHtml(text=""){return String(text).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}
function formatDate(date){if(!date)return"-";const d=new Date(date);return Number.isNaN(d.getTime())?"-":d.toLocaleString([],{dateStyle:"medium",timeStyle:"short"})}
function getNetwork(){
  if(window.AlbukhrNetwork&&typeof window.AlbukhrNetwork.getCurrentNetwork==="function")return String(window.AlbukhrNetwork.getCurrentNetwork()).toLowerCase();
  if(typeof window.getCurrentNetwork==="function")return String(window.getCurrentNetwork()).toLowerCase();
  const h=location.hostname.toLowerCase();
  if(h==="app.albukhr.com"||h==="www.app.albukhr.com")return"mainnet";
  if(h==="test.albukhr.com"||h==="www.test.albukhr.com")return"testnet";
  return"testnet";
}
function engine(){
  const x=window.AlbukhrDappRequestEngine||window.AlbukhrDAppRequestEngine;
  if(!x)throw new Error("dApp Request Engine not loaded.");
  return x;
}
function getStatusBadge(status){
  if(status==="approved")return`<div class="status-badge status-approved"><span class="status-dot"></span>Approved</div>`;
  if(status==="rejected")return`<div class="status-badge status-rejected"><span class="status-dot"></span>Rejected</div>`;
  return`<div class="status-badge status-pending"><span class="status-dot"></span>Pending</div>`;
}
function renderLoading(){if(listBox)listBox.innerHTML=`<div class="request-state loading-state"><div class="loading-spinner"></div><h4>Loading requests...</h4><p>Please wait while dApp requests are loaded.</p></div>`}
function renderEmpty(message){if(listBox)listBox.innerHTML=`<div class="request-state empty-state"><div class="state-icon">📭</div><h4>${escapeHtml(message)}</h4><p>No dApp requests are currently available.</p></div>`}
function renderError(message){if(listBox)listBox.innerHTML=`<div class="request-state error-state"><div class="state-icon">⚠️</div><h4>Unable to Load Requests</h4><p>${escapeHtml(message)}</p><button type="button" class="retry-btn" onclick="loadRequests()">Retry</button></div>`}

async function loadRequests(){
  if(!listBox)return;
  renderLoading();
  try{
    const x=engine(),network=getNetwork();
    if(typeof x.adminListDappRequests!=="function")throw new Error("dApp Request Engine list API is missing.");
    let rows;
    try{rows=await x.adminListDappRequests({network,limit:500})}
    catch(e){rows=await x.adminListDappRequests({network})}
    rows=(Array.isArray(rows)?rows:[]).filter(r=>!r.network||String(r.network).toLowerCase()===network);
    renderRequests(rows);
  }catch(error){console.error("[Admin dApp Requests]",error);renderError(error.message||"Failed to load requests.")}
}

function renderDescription(text,id){
  const plainText=String(text||"");const safeText=escapeHtml(plainText||"No description provided.");const limit=180;
  if(plainText.length<=limit)return`<div class="desc"><div class="desc-title">Description</div><div class="desc-content">${safeText}</div></div>`;
  return`<div class="desc description-collapsed" id="description_${escapeHtml(id)}"><div class="desc-title">Description</div><div class="desc-content"><span class="description-preview">${escapeHtml(plainText.slice(0,limit).trim())}...</span><span class="description-full" style="display:none">${safeText}</span></div><button type="button" class="description-toggle" onclick="toggleDescription('${escapeHtml(id)}',this)">See More</button></div>`;
}
function renderRequests(rows){
  if(!rows.length){renderEmpty("No dApp Requests Found");return}
  listBox.innerHTML="";
  rows.forEach(row=>{
    const status=String(row.status||"pending").toLowerCase(),noteId=`note_${row.id}`;
    let actionButtons="";
    if(status==="pending")actionButtons=`<div class="action-row"><button type="button" class="btn approve" onclick="approveRequest('${escapeHtml(row.id)}',this)"><span class="btn-icon">✓</span>Approve</button><button type="button" class="btn reject" onclick="rejectRequest('${escapeHtml(row.id)}',this)"><span class="btn-icon">×</span>Reject</button></div>`;
    else actionButtons=`<div class="action-row"><button type="button" class="btn ${status==="approved"?"approved":"rejected"} disabled" disabled>${status==="approved"?"✓ Approved":"× Rejected"}</button></div>`;
    const card=document.createElement("article");card.className=`dapp-request-card status-${escapeHtml(status)}`;card.dataset.requestId=row.id;
    card.innerHTML=`
      <div class="req-head"><div class="req-heading"><div class="req-title">${escapeHtml(row.project_name||"Untitled Project")}</div><div class="req-user"><span>👤</span>${escapeHtml(row.pi_user||"-")} <span class="separator">•</span><span>🛠</span>${escapeHtml(row.service_type||"-")}</div></div>${getStatusBadge(status)}</div>
      <div class="meta"><div class="meta-item"><span class="meta-icon">🆔</span><span class="meta-label">User ID</span><span class="meta-value">${escapeHtml(row.userid||"-")}</span></div><div class="meta-item"><span class="meta-icon">📅</span><span class="meta-label">Submitted</span><span class="meta-value">${formatDate(row.created_at)}</span></div><div class="meta-item"><span class="meta-label">Network</span><span class="meta-value">${escapeHtml(row.network||getNetwork())}</span></div></div>
      ${renderDescription(row.description,row.id)}
      <div class="receipt-box"><div class="receipt-label"><span>🧾</span>Payment Receipt</div>${row.receipt_image?`<div class="receipt-preview"><img src="${escapeHtml(row.receipt_image)}" alt="Payment receipt" loading="lazy"></div>`:`<div class="receipt-empty">No receipt image uploaded.</div>`}${row.receipt_ref?`<div class="receipt-ref"><strong>Reference:</strong> <span>${escapeHtml(row.receipt_ref)}</span></div>`:""}</div>
      <div class="note-area"><label for="${escapeHtml(noteId)}">Admin Note</label><textarea id="${escapeHtml(noteId)}" class="note-input" placeholder="Write a note for the user...">${escapeHtml(row.admin_note||"")}</textarea></div>
      ${row.admin_note?`<div class="admin-note-box"><div class="saved-note-title">Saved Admin Note</div><div class="saved-note-content">${escapeHtml(row.admin_note)}</div></div>`:""}
      ${actionButtons}
      ${status!=="pending"&&row.reviewed_at?`<div class="reviewed-info">Reviewed: ${formatDate(row.reviewed_at)}</div>`:""}`;
    listBox.appendChild(card);
  });
}
function getAdminNote(id){const el=document.getElementById(`note_${id}`);return el?el.value.trim():""}
function setButtonProcessing(button,text){if(!button)return;button.disabled=true;button.classList.add("processing");button.dataset.originalText=button.innerHTML;button.innerHTML=`<span class="button-spinner"></span>${text}`}
function restoreButton(button){if(!button)return;button.disabled=false;button.classList.remove("processing");button.innerHTML=button.dataset.originalText||button.innerHTML}

async function reviewRequest(id,button,status){
  if(!confirm(`${status==="approved"?"Approve":"Reject"} this dApp request?`))return;
  setButtonProcessing(button,status==="approved"?"Approving...":"Rejecting...");
  try{
    const x=engine(),network=getNetwork();
    if(typeof x.adminReviewDappRequest!=="function")throw new Error("dApp Request Engine review API is missing.");
    const actor=typeof getAdmin==="function"?getAdmin():null;
    await x.adminReviewDappRequest({requestId:id,status,adminNote:getAdminNote(id),reviewedAt:new Date().toISOString(),network,reviewedByEmail:actor?.email||"",reviewedByName:actor?.username||actor?.name||"ALBUKHR Admin"});
    await loadRequests();
  }catch(error){console.error("[Admin dApp Requests]",error);alert(error.message||`Failed to ${status} request.`);restoreButton(button)}
}
async function approveRequest(id,button){return reviewRequest(id,button,"approved")}
async function rejectRequest(id,button){return reviewRequest(id,button,"rejected")}

let dappRequestRefreshTimer=null;
function startDappRequestAutoRefresh(){
  if(dappRequestRefreshTimer)clearInterval(dappRequestRefreshTimer);
  dappRequestRefreshTimer=setInterval(loadRequests,300000);
}
function toggleDescription(id,button){
  const box=document.getElementById(`description_${id}`);if(!box||!button)return;
  const preview=box.querySelector(".description-preview"),full=box.querySelector(".description-full");if(!preview||!full)return;
  const expanded=box.classList.contains("description-expanded");
  preview.style.display=expanded?"inline":"none";full.style.display=expanded?"none":"inline";
  box.classList.toggle("description-expanded",!expanded);button.textContent=expanded?"See More":"See Less";
}
document.addEventListener("DOMContentLoaded",()=>{loadRequests();startDappRequestAutoRefresh()});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")loadRequests()});
Object.assign(window,{loadRequests,approveRequest,rejectRequest,toggleDescription});
