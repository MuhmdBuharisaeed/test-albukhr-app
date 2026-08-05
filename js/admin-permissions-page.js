/* ==========================================
   ALBUKHR ADMIN PERMISSIONS PAGE
   Version 1.0
   PART 1
========================================== */

(function(window){

"use strict";

/* ==========================================
   STATE
========================================== */

const PAGE = {

admins:[],

filteredAdmins:[],

logs:[],

permissions:[],

selectedAdmin:null,

selectedRole:"all",

searchText:"",

page:1,

pageSize:20,

loading:false

};

/* ==========================================
   DOM
========================================== */

const DOM = {};

/* ==========================================
   DOM READY
========================================== */

document.addEventListener(

"DOMContentLoaded",

()=>{

DOM.adminName =
document.getElementById("adminName");

DOM.adminRole =
document.getElementById("adminRole");

DOM.tableBody =
document.getElementById(
"permissionsTableBody"
);

DOM.empty =
document.getElementById(
"permissionEmpty"
);

DOM.search =
document.getElementById(
"adminSearch"
);

DOM.totalAdmins =
document.getElementById(
"totalAdmins"
);

DOM.totalRoles =
document.getElementById(
"totalRoles"
);

DOM.totalPermissions =
document.getElementById(
"totalPermissions"
);

DOM.todayActivities =
document.getElementById(
"todayActivities"
);

DOM.loading =
document.getElementById(
"adminLoading"
);

});

/* ==========================================
   CLIENT
========================================== */

function getClient(){

return window.getAlbukhrSupabaseClient();

}

/* ==========================================
   SHOW LOADING
========================================== */

function showLoading(){

if(DOM.loading){

DOM.loading.style.display="flex";

}

PAGE.loading=true;

}

/* ==========================================
   HIDE LOADING
========================================== */

function hideLoading(){

if(DOM.loading){

DOM.loading.style.display="none";

}

PAGE.loading=false;

}

/* ==========================================
   ALERT
========================================== */

function showAlert(

title,

message

){

if(

typeof openAppAlert==="function"

){

openAppAlert(

title,

message

);

return;

}

alert(

title+"\n\n"+message

);

}

/* ==========================================
   ESCAPE HTML
========================================== */

function escapeHtml(text=""){

return String(text)

.replace(/&/g,"&amp;")

.replace(/</g,"&lt;")

.replace(/>/g,"&gt;")

.replace(/"/g,"&quot;")

.replace(/'/g,"&#039;");

}

/* ==========================================
   FORMAT DATE
========================================== */

function formatDate(date){

if(!date){

return "-";

}

return new Date(date)

.toLocaleString();

}

/* ==========================================
   ROLE LABEL
========================================== */

function roleLabel(role){

switch(role){

case "super_admin":

return "Super Admin";

case "finance_admin":

return "Finance Admin";

case "review_admin":

return "Review Admin";

case "viewer_admin":

return "Viewer Admin";

default:

return role;

}

}

/* ==========================================
   STATUS BADGE
========================================== */

function statusBadge(status){

if(status==="active"){

return `

<span class="status active">

Active

</span>

`;

}

return `

<span class="status disabled">

Disabled

</span>

`;

}

/* ==========================================
   RESET FILTER
========================================== */

function resetFilters(){

PAGE.searchText="";

PAGE.selectedRole="all";

PAGE.page=1;

if(DOM.search){

DOM.search.value="";

}

}

/* ==========================================
   EXPORT
========================================== */

window.AdminPermissionPage=PAGE;

window.showLoading=showLoading;

window.hideLoading=hideLoading;

window.showAlert=showAlert;

window.escapeHtml=escapeHtml;

window.formatDate=formatDate;

window.roleLabel=roleLabel;

window.statusBadge=statusBadge;

window.resetFilters=resetFilters;

})(window);

/* ==========================================
   LOAD PAGE
========================================== */

async function loadPermissionPage(){

showLoading();

try{

await loadAdmins();

await loadStatistics();

renderAdminTable();

}catch(error){

console.error(error);

showAlert(

"Loading Error",

error.message

);

}finally{

hideLoading();

}

}

/* ==========================================
   LOAD ADMINS
========================================== */

async function loadAdmins(){

const supabase = getClient();

const {

data,

error

} = await supabase

.from("admin_users")

.select(`

id,
username,
email,
role_code,
status,
created_at,
last_login

`)

.order(

"created_at",

{

ascending:false

}

);

if(error){

throw error;

}

PAGE.admins = data || [];

PAGE.filteredAdmins =

[...PAGE.admins];

}

/* ==========================================
   LOAD STATISTICS
========================================== */

async function loadStatistics(){

const supabase = getClient();

/* TOTAL PERMISSIONS */

const {

count:permissionCount

} = await supabase

.from("admin_permissions")

.select(

"*",

{

count:"exact",

head:true

}

);

/* TODAY LOGS */

const today = new Date();

today.setHours(

0,0,0,0

);

const {

count:todayLogs

} = await supabase

.from("admin_activity_logs")

.select(

"*",

{

count:"exact",

head:true

}

)

.gte(

"created_at",

today.toISOString()

);

const roles =

new Set(

PAGE.admins.map(

item=>item.role_code

)

);

if(DOM.totalAdmins){

DOM.totalAdmins.textContent =

PAGE.admins.length;

}

if(DOM.totalRoles){

DOM.totalRoles.textContent =

roles.size;

}

if(DOM.totalPermissions){

DOM.totalPermissions.textContent =

permissionCount || 0;

}

if(DOM.todayActivities){

DOM.todayActivities.textContent =

todayLogs || 0;

}

}

/* ==========================================
   RENDER TABLE
========================================== */

function renderAdminTable(){

if(!DOM.tableBody){

return;

}

if(

!PAGE.filteredAdmins.length

){

renderEmptyState();

return;

}

DOM.empty.style.display="none";

DOM.tableBody.innerHTML =

PAGE.filteredAdmins

.slice(

0,

PAGE.page *

PAGE.pageSize

)

.map(admin=>`

<tr>

<td>

${escapeHtml(

admin.username || ""

)}

</td>

<td>

${escapeHtml(

admin.email || ""

)}

</td>

<td>

${roleLabel(

admin.role_code

)}

</td>

<td>

${statusBadge(

admin.status

)}

</td>

<td>

${formatDate(

admin.last_login

)}

</td>

<td>

<div class="table-actions">

<button

class="table-btn"

onclick="editAdmin(

'${admin.id}'

)">

✏️

</button>

<button

class="table-btn"

onclick="managePermissions(

'${admin.id}'

)">

🛡️

</button>

<button

class="table-btn danger"

onclick="deleteAdmin(

'${admin.id}'

)">

🗑️

</button>

</div>

</td>

</tr>

`).join("");

}

/* ==========================================
   EMPTY STATE
========================================== */

function renderEmptyState(){

if(DOM.tableBody){

DOM.tableBody.innerHTML="";

}

if(DOM.empty){

DOM.empty.style.display="block";

}

}

/* ==========================================
   EXPORT
========================================== */

window.loadPermissionPage =

loadPermissionPage;

window.loadAdmins =

loadAdmins;

window.loadStatistics =

loadStatistics;

window.renderAdminTable =

renderAdminTable;

window.renderEmptyState =

renderEmptyState;

/* ==========================================
   OPEN ADD ADMIN
========================================== */

function openAdminModal(){

PAGE.selectedAdmin = null;

document.getElementById(
"adminModalTitle"
).textContent = "Add Administrator";

document.getElementById(
"adminEmail"
).value = "";

document.getElementById(
"adminUsername"
).value = "";

document.getElementById(
"adminRoleSelect"
).value = "viewer_admin";

document.getElementById(
"adminStatus"
).value = "active";

document.getElementById(
"adminModal"
).style.display = "flex";

}

/* ==========================================
   EDIT ADMIN
========================================== */

function editAdmin(id){

const admin = PAGE.admins.find(

item => item.id === id

);

if(!admin){

return;

}

PAGE.selectedAdmin = admin;

document.getElementById(
"adminModalTitle"
).textContent = "Edit Administrator";

document.getElementById(
"adminEmail"
).value = admin.email || "";

document.getElementById(
"adminUsername"
).value = admin.username || "";

document.getElementById(
"adminRoleSelect"
).value = admin.role_code;

document.getElementById(
"adminStatus"
).value = admin.status;

document.getElementById(
"adminModal"
).style.display = "flex";

}

/* ==========================================
   CLOSE MODAL
========================================== */

function closeAdminModal(){

document.getElementById(
"adminModal"
).style.display = "none";

PAGE.selectedAdmin = null;

}

/* ==========================================
   SAVE ADMIN
========================================== */

async function saveAdmin(){

showLoading();

try{

const supabase = getClient();

const payload = {

email:

document.getElementById(
"adminEmail"
).value.trim().toLowerCase(),

username:

document.getElementById(
"adminUsername"
).value.trim(),

role_code:

document.getElementById(
"adminRoleSelect"
).value,

status:

document.getElementById(
"adminStatus"
).value

};

if(PAGE.selectedAdmin){

const { error } = await supabase

.from("admin_users")

.update(payload)

.eq(

"id",

PAGE.selectedAdmin.id

);

if(error){

throw error;

}

await logAdminAction({

action:"update_admin",

target:PAGE.selectedAdmin.id,

details:payload

});

}else{

const { error } = await supabase

.from("admin_users")

.insert(payload);

if(error){

throw error;

}

await logAdminAction({

action:"create_admin",

target:payload.email,

details:payload

});

}

closeAdminModal();

await loadPermissionPage();

showAlert(

"Success",

"Administrator saved successfully."

);

}catch(error){

console.error(error);

showAlert(

"Save Failed",

error.message

);

}finally{

hideLoading();

}

}

/* ==========================================
   DELETE ADMIN
========================================== */

async function deleteAdmin(id){

const admin = PAGE.admins.find(

item=>item.id===id

);

if(!admin){

return;

}

if(

!confirm(

`Delete ${admin.username}?`

)

){

return;

}

showLoading();

try{

const supabase = getClient();

const { error } = await supabase

.from("admin_users")

.delete()

.eq(

"id",

id

);

if(error){

throw error;

}

await logAdminAction({

action:"delete_admin",

target:id,

details:{

email:admin.email

}

});

await loadPermissionPage();

showAlert(

"Deleted",

"Administrator removed."

);

}catch(error){

console.error(error);

showAlert(

"Delete Failed",

error.message

);

}finally{

hideLoading();

}

}

/* ==========================================
   MANAGE PERMISSIONS
========================================== */

async function managePermissions(id){

PAGE.selectedAdmin = PAGE.admins.find(

item=>item.id===id

);

document.getElementById(
"permissionModal"
).style.display = "flex";

if(typeof loadPermissionMatrix==="function"){

await loadPermissionMatrix(

PAGE.selectedAdmin

);

}

}

/* ==========================================
   CLOSE PERMISSION MODAL
========================================== */

function closePermissionModal(){

document.getElementById(
"permissionModal"
).style.display="none";

}

/* ==========================================
   VIEW LOGS
========================================== */

async function openLogsModal(){

document.getElementById(
"logsModal"
).style.display="flex";

const logs = await getAdminLogs(100);

PAGE.logs = logs;

const container =

document.getElementById(
"logsContainer"
);

container.innerHTML = logs.map(log=>`

<div class="log-item">

<strong>

${escapeHtml(log.action)}

</strong>

<div>

${escapeHtml(log.target || "")}

</div>

<small>

${formatDate(log.created_at)}

</small>

</div>

`).join("");

}

/* ==========================================
   CLOSE LOGS
========================================== */

function closeLogsModal(){

document.getElementById(
"logsModal"
).style.display="none";

}

/* ==========================================
   EXPORT
========================================== */

window.openAdminModal =
openAdminModal;

window.editAdmin =
editAdmin;

window.closeAdminModal =
closeAdminModal;

window.saveAdmin =
saveAdmin;

window.deleteAdmin =
deleteAdmin;

window.managePermissions =
managePermissions;

window.closePermissionModal =
closePermissionModal;

window.openLogsModal =
openLogsModal;

window.closeLogsModal =
closeLogsModal;

/* ==========================================
   SEARCH
========================================== */

function applySearch(){

PAGE.searchText =

(DOM.search.value || "")

.toLowerCase()

.trim();

PAGE.filteredAdmins =

PAGE.admins.filter(admin=>{

const text =

(

(admin.username || "") +

" " +

(admin.email || "") +

" " +

(admin.role_code || "")

)

.toLowerCase();

const matchSearch =

!PAGE.searchText ||

text.includes(

PAGE.searchText

);

const matchRole =

PAGE.selectedRole==="all" ||

admin.role_code===

PAGE.selectedRole;

return(

matchSearch &&

matchRole

);

});

PAGE.page = 1;

renderAdminTable();

}

/* ==========================================
   ROLE FILTER
========================================== */

function filterRole(role){

PAGE.selectedRole = role;

applySearch();

}

/* ==========================================
   LOAD MORE
========================================== */

function loadMore(){

PAGE.page++;

renderAdminTable();

}

/* ==========================================
   REFRESH
========================================== */

async function refreshPage(){

await loadPermissionPage();

}

/* ==========================================
   AUTO REFRESH
========================================== */

function startAutoRefresh(){

setInterval(

async()=>{

if(PAGE.loading){

return;

}

await loadPermissionPage();

},

60000

);

}

/* ==========================================
   EVENTS
========================================== */

document.addEventListener(

"DOMContentLoaded",

()=>{

/* SEARCH */

if(DOM.search){

DOM.search.addEventListener(

"input",

applySearch

);

}

/* ROLE FILTERS */

document

.querySelectorAll(

"[data-role-filter]"

)

.forEach(button=>{

button.addEventListener(

"click",

()=>{

document

.querySelectorAll(

"[data-role-filter]"

)

.forEach(

item=>item.classList.remove(

"active"

)

);

button.classList.add(

"active"

);

filterRole(

button.dataset.roleFilter

);

}

);

});

/* LOAD MORE */

const loadMoreBtn =

document.getElementById(

"loadMoreAdmins"

);

if(loadMoreBtn){

loadMoreBtn.addEventListener(

"click",

loadMore

);

}

/* REFRESH */

const refreshBtn =

document.getElementById(

"refreshAdmins"

);

if(refreshBtn){

refreshBtn.addEventListener(

"click",

refreshPage

);

}

/* ADD ADMIN */

const addBtn =

document.getElementById(

"addAdminBtn"

);

if(addBtn){

addBtn.addEventListener(

"click",

openAdminModal

);

}

/* SAVE ADMIN */

const saveBtn =

document.getElementById(

"saveAdminBtn"

);

if(saveBtn){

saveBtn.addEventListener(

"click",

saveAdmin

);

}

/* LOGS */

const logsBtn =

document.getElementById(

"viewLogsBtn"

);

if(logsBtn){

logsBtn.addEventListener(

"click",

openLogsModal

);

}

});

/* ==========================================
   PAGE INIT
========================================== */

document.addEventListener(

"admin-ready",

async()=>{

try{

await loadPermissionPage();

startAutoRefresh();

}catch(error){

console.error(

error

);

showAlert(

"Initialization Failed",

error.message

);

}

});

/* ==========================================
   GLOBAL EXPORT
========================================== */

window.applySearch =

applySearch;

window.filterRole =

filterRole;

window.loadMore =

loadMore;

window.refreshPage =

refreshPage;

window.startAutoRefresh =

startAutoRefresh;

})(window);
