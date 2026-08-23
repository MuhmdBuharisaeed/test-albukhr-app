/* ==========================================
   ALBUKHR ADMIN EXTERNAL DASHBOARD
   AUDITED / ARCHITECTURE-ALIGNED
   Version 2.0
   Engine-first / network-aware
   No direct Supabase / no LocalStorage
========================================== */
"use strict";

(function(window){
  const Dashboard={
    projects:[],filteredProjects:[],selectedProjects:[],currentProject:null,
    currentPage:1,pageSize:20,search:"",status:"all",category:"all",statistics:null,loading:false
  };
  const UI={};

  function cacheDOM(){
    UI.totalProjects=document.getElementById("totalProjects");
    UI.pendingProjects=document.getElementById("pendingProjects");
    UI.approvedProjects=document.getElementById("approvedProjects");
    UI.rejectedProjects=document.getElementById("rejectedProjects");
    UI.suspendedProjects=document.getElementById("suspendedProjects");
    UI.totalCapital=document.getElementById("totalCapital");
    UI.projectTableBody=document.getElementById("projectTableBody");
    UI.projectSearch=document.getElementById("projectSearch");
    UI.statusFilter=document.getElementById("statusFilter");
    UI.categoryFilter=document.getElementById("categoryFilter");
    UI.refreshButton=document.getElementById("refreshDashboardBtn");
  }

  function network(){
    if(window.AlbukhrNetwork&&typeof window.AlbukhrNetwork.getCurrentNetwork==="function")return String(window.AlbukhrNetwork.getCurrentNetwork()).toLowerCase();
    if(typeof window.getCurrentNetwork==="function")return String(window.getCurrentNetwork()).toLowerCase();
    const h=location.hostname.toLowerCase();
    if(h==="app.albukhr.com"||h==="www.app.albukhr.com")return"mainnet";
    if(h==="test.albukhr.com"||h==="www.test.albukhr.com")return"testnet";
    return"testnet";
  }
  function guard(){
    if(typeof requireRole==="function"){
      const r=requireRole(["super_admin","ecosystem_admin","project_admin","finance_admin"]);
      if(r===false)return false;
    }
    if(typeof getAdmin==="function"&&!getAdmin()){location.href="admin-login.html";return false}
    return true;
  }
  function engine(){
    const x=window.AlbukhrExternalProjectEngine;
    if(!x)throw new Error("External Project Engine not loaded.");
    return x;
  }
  async function callList(){
    const x=engine(),n=network();
    if(typeof x.adminListExternalProjects==="function"){
      try{return await x.adminListExternalProjects({network:n,limit:500})}catch(e){console.warn(e)}
    }
    if(typeof getExternalProjects==="function"){
      /* Legacy engine adapter: the engine must enforce network isolation. */
      return await getExternalProjects({network:n,admin:true});
    }
    throw new Error("External Project list API is missing.");
  }
  async function callStats(){
    const x=engine(),n=network();
    if(typeof x.getExternalProjectStatistics==="function"){
      try{return await x.getExternalProjectStatistics({network:n})}catch(e){console.warn(e)}
    }
    if(typeof getExternalProjectStatistics==="function")return await getExternalProjectStatistics({network:n});
    return null;
  }
  async function loadStatistics(){
    try{Dashboard.statistics=await callStats();renderStatistics()}catch(error){console.error("[External Dashboard] Statistics",error)}
  }
  async function loadProjects(){
    try{
      const rows=await callList();
      Dashboard.projects=(Array.isArray(rows)?rows:[]).filter(p=>!p.network||String(p.network).toLowerCase()===network());
      Dashboard.filteredProjects=[...Dashboard.projects];renderProjects();
    }catch(error){
      console.error("[External Dashboard] Projects",error);Dashboard.projects=[];Dashboard.filteredProjects=[];renderProjects();
      showAlert("Dashboard Error",error.message||"Unable to load external projects.");
    }
  }
  async function initializeExternalDashboard(){
    if(!guard())return;
    Dashboard.loading=true;
    cacheDOM();bindEvents();
    try{await loadStatistics();await loadProjects()}finally{Dashboard.loading=false}
  }
  function bindEvents(){
    UI.projectSearch?.addEventListener("input",e=>{Dashboard.search=e.target.value.trim().toLowerCase();applyFilters()});
    UI.statusFilter?.addEventListener("change",e=>{Dashboard.status=e.target.value;applyFilters()});
    UI.categoryFilter?.addEventListener("change",e=>{Dashboard.category=e.target.value;applyFilters()});
    UI.refreshButton?.addEventListener("click",refreshDashboard);
  }
  async function refreshDashboard(){
    if(Dashboard.loading)return;
    Dashboard.loading=true;showLoading(true);Dashboard.currentPage=1;clearSelection();
    try{await loadStatistics();await loadProjects()}finally{Dashboard.loading=false;showLoading(false)}
  }
  function applyFilters(){
    let rows=[...Dashboard.projects];
    if(Dashboard.search)rows=rows.filter(p=>[p.title,p.project_code,p.owner_name,p.owner_email,p.category].join(" ").toLowerCase().includes(Dashboard.search));
    if(Dashboard.status!=="all")rows=rows.filter(p=>String(p.status)===Dashboard.status);
    if(Dashboard.category!=="all")rows=rows.filter(p=>String(p.category)===Dashboard.category);
    Dashboard.filteredProjects=rows;Dashboard.currentPage=1;clearSelection();renderProjects();
  }
  function clearSelection(){
    Dashboard.selectedProjects=[];
    const selected=document.getElementById("selectedProjects");if(selected)selected.textContent="0 Selected";
  }
  function showLoading(show){const overlay=document.getElementById("pageLoading");if(overlay)overlay.style.display=show?"flex":"none"}
  function renderStatistics(){
    const s=Dashboard.statistics||{};
    if(UI.totalProjects)UI.totalProjects.textContent=s.total||0;
    if(UI.pendingProjects)UI.pendingProjects.textContent=s.pending||0;
    if(UI.approvedProjects)UI.approvedProjects.textContent=s.approved||0;
    if(UI.rejectedProjects)UI.rejectedProjects.textContent=s.rejected||0;
    if(UI.suspendedProjects)UI.suspendedProjects.textContent=s.suspended||0;
    if(UI.totalCapital)UI.totalCapital.textContent=Number(s.total_capital||0).toLocaleString();
  }
  function renderProjects(){
    if(!UI.projectTableBody)return;
    const rows=Dashboard.filteredProjects||[];
    if(!rows.length){UI.projectTableBody.innerHTML='<tr><td colspan="8" style="text-align:center;padding:40px;">No External Projects Found</td></tr>';return}
    const start=(Dashboard.currentPage-1)*Dashboard.pageSize;
    UI.projectTableBody.innerHTML=rows.slice(start,start+Dashboard.pageSize).map(renderProjectRow).join("");
    renderPagination();
  }
  function renderProjectRow(project){
    const id=encodeURIComponent(String(project.id||""));
    return`<tr><td>${escapeHtml(project.project_code||"-")}</td><td><strong>${escapeHtml(project.title||"-")}</strong></td><td>${escapeHtml(project.category||"-")}</td><td>${escapeHtml(project.owner_name||"-")}</td><td>${renderStatus(project.status)}</td><td>${formatDate(project.created_at)}</td><td>${Number(project.amount_requested||0).toLocaleString()}</td><td><div class="table-actions"><button class="action-btn view-btn" onclick="viewProject('${id}')">View</button><button class="action-btn approve-btn" onclick="approveProject('${id}')">Approve</button><button class="action-btn reject-btn" onclick="rejectProject('${id}')">Reject</button><button class="action-btn suspend-btn" onclick="suspendProject('${id}')">Suspend</button><button class="action-btn delete-btn" onclick="deleteProject('${id}')">Delete</button></div></td></tr>`;
  }
  function renderStatus(status){
    const s=String(status||"").toLowerCase(),labels={approved:"Approved",pending:"Pending",rejected:"Rejected",suspended:"Suspended"};
    return`<span class="status-badge status-${escapeHtml(s)}">${escapeHtml(labels[s]||"Unknown")}</span>`;
  }
  function renderPagination(){if(typeof updatePagination==="function")updatePagination(Dashboard.filteredProjects.length,Dashboard.currentPage,Dashboard.pageSize)}
  function decode(v){try{return decodeURIComponent(v||"")}catch{return String(v||"")}}
  async function viewProject(projectId){
    try{
      const id=decode(projectId),x=engine();
      const project=typeof x.adminGetExternalProject==="function"?await x.adminGetExternalProject({projectId:id,network:network()}):typeof getExternalProject==="function"?await getExternalProject(id,{network:network()}):null;
      if(!project)throw new Error("External project was not found.");
      Dashboard.currentProject=project;
      if(typeof openProjectModal==="function")openProjectModal(project);
    }catch(error){console.error(error);showAlert("Project",error.message)}
  }
  async function mutate(action,projectId,reason){
    const x=engine(),id=decode(projectId),a=typeof getAdmin==="function"?getAdmin():null,n=network();
    const common={projectId:id,network:n,reason:reason||"",adminEmail:a?.email||"",adminName:a?.username||a?.name||"ALBUKHR Admin"};
    const map={approve:"adminApproveExternalProject",reject:"adminRejectExternalProject",suspend:"adminSuspendExternalProject",delete:"adminDeleteExternalProject"};
    if(typeof x[map[action]]==="function")return x[map[action]](common);
    const legacy={approve:approveExternalProject,reject:rejectExternalProject,suspend:suspendExternalProject,delete:deleteExternalProject};
    if(typeof legacy[action]==="function")return legacy[action](id,reason);
    throw new Error(`External Project Engine API for ${action} is missing.`);
  }
  async function approveProject(id){
    try{if(!confirm("Approve this external project?"))return;await mutate("approve",id,"");await refreshDashboard();showAlert("Success","Project approved successfully.")}catch(e){showAlert("Approval Failed",e.message)}
  }
  async function rejectProject(id){
    try{const reason=prompt("Enter rejection reason");if(reason===null)return;await mutate("reject",id,reason.trim());await refreshDashboard();showAlert("Rejected","Project rejected successfully.")}catch(e){showAlert("Rejection Failed",e.message)}
  }
  async function suspendProject(id){
    try{const reason=prompt("Enter suspension reason");if(reason===null)return;await mutate("suspend",id,reason.trim());await refreshDashboard();showAlert("Suspended","Project suspended.")}catch(e){showAlert("Suspend Failed",e.message)}
  }
  async function deleteProject(id){
    try{if(!confirm("This action cannot be undone.\n\nDelete project permanently?"))return;await mutate("delete",id,"");await refreshDashboard();showAlert("Deleted","Project deleted successfully.")}catch(e){showAlert("Delete Failed",e.message)}
  }
  function formatDate(date){if(!date)return"-";try{return new Date(date).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"})}catch{return"-"}}
  function escapeHtml(text){return text==null?"":String(text).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}
  function showAlert(title,message){if(typeof showAppAlert==="function")return showAppAlert(title,message);alert(title+"\n\n"+message)}

  Object.assign(window,{Dashboard,initializeExternalDashboard,refreshDashboard,viewProject,approveProject,rejectProject,suspendProject,deleteProject,formatDate,escapeHtml});
})(window);

document.addEventListener("DOMContentLoaded",()=>{if(typeof initializeExternalDashboard==="function")initializeExternalDashboard()});
