/* ==========================================
   ALBUKHR
   ADMIN EXTERNAL DASHBOARD
   Version 1.0
========================================== */

(function(window){

"use strict";

/* ==========================================
   DASHBOARD STATE
========================================== */

const Dashboard = {

projects:[],

filteredProjects:[],

selectedProjects:[],

currentProject:null,

currentPage:1,

pageSize:20,

search:"",

status:"all",

category:"all",

statistics:null,

loading:false

};

/* ==========================================
   DOM REFERENCES
========================================== */

const UI = {};

/* ==========================================
   CACHE DOM
========================================== */

function cacheDOM(){

UI.totalProjects =
document.getElementById(
"totalProjects"
);

UI.pendingProjects =
document.getElementById(
"pendingProjects"
);

UI.approvedProjects =
document.getElementById(
"approvedProjects"
);

UI.rejectedProjects =
document.getElementById(
"rejectedProjects"
);

UI.suspendedProjects =
document.getElementById(
"suspendedProjects"
);

UI.totalCapital =
document.getElementById(
"totalCapital"
);

UI.projectTableBody =
document.getElementById(
"projectTableBody"
);

UI.projectSearch =
document.getElementById(
"projectSearch"
);

UI.statusFilter =
document.getElementById(
"statusFilter"
);

UI.categoryFilter =
document.getElementById(
"categoryFilter"
);

UI.refreshButton =
document.getElementById(
"refreshDashboardBtn"
);

}

/* ==========================================
   INITIALIZE
========================================== */

async function initializeExternalDashboard(){

try{

Dashboard.loading = true;

cacheDOM();

bindEvents();

await loadStatistics();

await loadProjects();

}
catch(error){

console.error(

"[External Dashboard]",

error

);

showAlert(

"Dashboard Error",

error.message

);

}
finally{

Dashboard.loading = false;

}

}

/* ==========================================
   LOAD STATISTICS
========================================== */

async function loadStatistics(){

try{

if(

typeof getExternalProjectStatistics

!== "function"

){

console.warn(

"Statistics Engine Missing."

);

return;

}

Dashboard.statistics =

await getExternalProjectStatistics();

renderStatistics();

}
catch(error){

console.error(error);

}

}

/* ==========================================
   LOAD PROJECTS
========================================== */

async function loadProjects(){

try{

if(

typeof getExternalProjects

!== "function"

){

console.warn(

"External Project Engine Missing."

);

Dashboard.projects = [];

Dashboard.filteredProjects = [];

renderProjects();

return;

}

Dashboard.projects =

await getExternalProjects();

Dashboard.filteredProjects =

[...Dashboard.projects];

renderProjects();

}
catch(error){

console.error(error);

}

}

/* ==========================================
   EXPORT
========================================== */

window.Dashboard = Dashboard;

window.initializeExternalDashboard =
initializeExternalDashboard;

})(window);
/* ==========================================
   BIND EVENTS
========================================== */

function bindEvents(){

/* ---------- SEARCH ---------- */

if(UI.projectSearch){

UI.projectSearch.addEventListener(

"input",

(event)=>{

Dashboard.search =

event.target.value
.trim()
.toLowerCase();

applyFilters();

}

);

}

/* ---------- STATUS FILTER ---------- */

if(UI.statusFilter){

UI.statusFilter.addEventListener(

"change",

(event)=>{

Dashboard.status =
event.target.value;

applyFilters();

}

);

}

/* ---------- CATEGORY FILTER ---------- */

if(UI.categoryFilter){

UI.categoryFilter.addEventListener(

"change",

(event)=>{

Dashboard.category =
event.target.value;

applyFilters();

}

);

}

/* ---------- REFRESH ---------- */

if(UI.refreshButton){

UI.refreshButton.addEventListener(

"click",

refreshDashboard

);

}

}

/* ==========================================
   REFRESH DASHBOARD
========================================== */

async function refreshDashboard(){

try{

showLoading(true);

Dashboard.currentPage = 1;

Dashboard.selectedProjects = [];

await loadStatistics();

await loadProjects();

}
catch(error){

console.error(error);

showAlert(

"Refresh Failed",

error.message

);

}
finally{

showLoading(false);

}

}

/* ==========================================
   APPLY FILTERS
========================================== */

function applyFilters(){

let rows =

[...Dashboard.projects];

/* ---------- SEARCH ---------- */

if(Dashboard.search){

rows = rows.filter(project=>{

const keyword =

Dashboard.search;

return(

(project.title || "")

.toLowerCase()

.includes(keyword)

||

(project.project_code || "")

.toLowerCase()

.includes(keyword)

||

(project.owner_name || "")

.toLowerCase()

.includes(keyword)

||

(project.owner_email || "")

.toLowerCase()

.includes(keyword)

||

(project.category || "")

.toLowerCase()

.includes(keyword)

);

});

}

/* ---------- STATUS ---------- */

if(

Dashboard.status !==

"all"

){

rows = rows.filter(

project=>

project.status ===

Dashboard.status

);

}

/* ---------- CATEGORY ---------- */

if(

Dashboard.category !==

"all"

){

rows = rows.filter(

project=>

project.category ===

Dashboard.category

);

}

Dashboard.filteredProjects = rows;

Dashboard.currentPage = 1;

clearSelection();

renderProjects();

}

/* ==========================================
   CLEAR SELECTION
========================================== */

function clearSelection(){

Dashboard.selectedProjects = [];

const selected =

document.getElementById(

"selectedProjects"

);

if(selected){

selected.textContent =

"0 Selected";

}

}

/* ==========================================
   SHOW / HIDE LOADING
========================================== */

function showLoading(show){

const overlay =

document.getElementById(

"pageLoading"

);

if(!overlay){

return;

}

overlay.style.display =

show

? "flex"

: "none";

}
/* ==========================================
   RENDER STATISTICS
========================================== */

function renderStatistics(){

const stats = Dashboard.statistics || {};

if(UI.totalProjects){

UI.totalProjects.textContent =
stats.total || 0;

}

if(UI.pendingProjects){

UI.pendingProjects.textContent =
stats.pending || 0;

}

if(UI.approvedProjects){

UI.approvedProjects.textContent =
stats.approved || 0;

}

if(UI.rejectedProjects){

UI.rejectedProjects.textContent =
stats.rejected || 0;

}

if(UI.suspendedProjects){

UI.suspendedProjects.textContent =
stats.suspended || 0;

}

if(UI.totalCapital){

UI.totalCapital.textContent =

Number(

stats.total_capital || 0

).toLocaleString();

}

}

/* ==========================================
   RENDER PROJECTS
========================================== */

function renderProjects(){

if(!UI.projectTableBody){

return;

}

const rows =

Dashboard.filteredProjects;

if(!rows.length){

UI.projectTableBody.innerHTML = `

<tr>

<td colspan="8"

style="text-align:center;padding:40px;">

No External Projects Found

</td>

</tr>

`;

return;

}

const start =

(Dashboard.currentPage - 1)

*

Dashboard.pageSize;

const end =

start +

Dashboard.pageSize;

const page =

rows.slice(

start,

end

);

UI.projectTableBody.innerHTML =

page

.map(

renderProjectRow

)

.join("");

renderPagination();

}

/* ==========================================
   PROJECT ROW
========================================== */

function renderProjectRow(project){

return `

<tr>

<td>

${project.project_code || "-"}

</td>

<td>

<strong>

${escapeHtml(

project.title || "-"

)}

</strong>

</td>

<td>

${escapeHtml(

project.category || "-"

)}

</td>

<td>

${escapeHtml(

project.owner_name || "-"

)}

</td>

<td>

${renderStatus(

project.status

)}

</td>

<td>

${formatDate(

project.created_at

)}

</td>

<td>

${Number(

project.amount_requested || 0

).toLocaleString()}

</td>

<td>

<div class="table-actions">

<button

class="action-btn view-btn"

onclick="viewProject(

'${project.id}'

)">

View

</button>

<button

class="action-btn approve-btn"

onclick="approveProject(

'${project.id}'

)">

Approve

</button>

<button

class="action-btn reject-btn"

onclick="rejectProject(

'${project.id}'

)">

Reject

</button>

<button

class="action-btn suspend-btn"

onclick="suspendProject(

'${project.id}'

)">

Suspend

</button>

<button

class="action-btn delete-btn"

onclick="deleteProject(

'${project.id}'

)">

Delete

</button>

</div>

</td>

</tr>

`;

}

/* ==========================================
   STATUS BADGE
========================================== */

function renderStatus(status){

switch(status){

case "approved":

return `

<span class="status-badge status-approved">

Approved

</span>

`;

case "pending":

return `

<span class="status-badge status-pending">

Pending

</span>

`;

case "rejected":

return `

<span class="status-badge status-rejected">

Rejected

</span>

`;

case "suspended":

return `

<span class="status-badge status-suspended">

Suspended

</span>

`;

default:

return `

<span class="status-badge">

Unknown

</span>

`;

}

}

/* ==========================================
   PAGINATION
========================================== */

function renderPagination(){

if(

typeof updatePagination ===

"function"

){

updatePagination(

Dashboard.filteredProjects.length,

Dashboard.currentPage,

Dashboard.pageSize

);

}

  }
/* ==========================================
   VIEW PROJECT
========================================== */

async function viewProject(projectId){

try{

if(typeof getExternalProject !== "function"){

throw new Error(

"External Project Engine not available."

);

}

const project =

await getExternalProject(projectId);

Dashboard.currentProject = project;

if(typeof openProjectModal === "function"){

openProjectModal(project);

}

}
catch(error){

console.error(error);

showAlert(

"Project",

error.message

);

}

}

/* ==========================================
   APPROVE PROJECT
========================================== */

async function approveProject(projectId){

try{

if(!confirm(

"Approve this external project?"

)){

return;

}

await approveExternalProject(projectId);

await refreshDashboard();

showAlert(

"Success",

"Project approved successfully."

);

}
catch(error){

console.error(error);

showAlert(

"Approval Failed",

error.message

);

}

}

/* ==========================================
   REJECT PROJECT
========================================== */

async function rejectProject(projectId){

try{

const reason =

prompt(

"Enter rejection reason"

);

if(reason === null){

return;

}

await rejectExternalProject(

projectId,

reason.trim()

);

await refreshDashboard();

showAlert(

"Rejected",

"Project rejected successfully."

);

}
catch(error){

console.error(error);

showAlert(

"Rejection Failed",

error.message

);

}

}

/* ==========================================
   SUSPEND PROJECT
========================================== */

async function suspendProject(projectId){

try{

const reason =

prompt(

"Enter suspension reason"

);

if(reason === null){

return;

}

await suspendExternalProject(

projectId,

reason.trim()

);

await refreshDashboard();

showAlert(

"Suspended",

"Project suspended."

);

}
catch(error){

console.error(error);

showAlert(

"Suspend Failed",

error.message

);

}

}

/* ==========================================
   DELETE PROJECT
========================================== */

async function deleteProject(projectId){

try{

const ok = confirm(

"This action cannot be undone.\n\nDelete project permanently?"

);

if(!ok){

return;

}

await deleteExternalProject(projectId);

await refreshDashboard();

showAlert(

"Deleted",

"Project deleted successfully."

);

}
catch(error){

console.error(error);

showAlert(

"Delete Failed",

error.message

);

}

}

/* ==========================================
   FORMAT DATE
========================================== */

function formatDate(date){

if(!date){

return "-";

}

try{

return new Date(date)

.toLocaleDateString(

undefined,

{

year:"numeric",

month:"short",

day:"numeric"

}

);

}
catch{

return "-";

}

}

/* ==========================================
   ESCAPE HTML
========================================== */

function escapeHtml(text){

if(text === null || text === undefined){

return "";

}

return String(text)

.replace(/&/g,"&amp;")

.replace(/</g,"&lt;")

.replace(/>/g,"&gt;")

.replace(/"/g,"&quot;")

.replace(/'/g,"&#039;");

}

/* ==========================================
   SIMPLE ALERT
========================================== */

function showAlert(title,message){

if(

typeof showAppAlert ===

"function"

){

showAppAlert(title,message);

return;

}

alert(title + "\n\n" + message);

}

/* ==========================================
   EXPORT
========================================== */

window.refreshDashboard =
refreshDashboard;

window.viewProject =
viewProject;

window.approveProject =
approveProject;

window.rejectProject =
rejectProject;

window.suspendProject =
suspendProject;

window.deleteProject =
deleteProject;

window.formatDate =
formatDate;

window.escapeHtml =
escapeHtml;
