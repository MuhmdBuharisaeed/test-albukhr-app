/* ==========================================
   ALBUKHR ADMIN PERMISSIONS PAGE
   AUDIT + FIX — NEW ADMIN ARCHITECTURE
   Supabase-first / Engine-based / Network-aware
========================================== */

(function(window){

"use strict";

/*
 * ARCHITECTURE CONTRACT
 * ---------------------
 * Admin pages do NOT query Supabase directly.
 *
 * Required:
 *   1. js/supabase-admin-auth/...      -> Admin Auth/session
 *   2. Admin Permissions Engine       -> admin_users / permissions / logs
 *   3. Network engine                  -> mainnet/testnet isolation
 *
 * Expected global engine:
 *   window.AlbukhrAdminPermissionsEngine
 *
 * The page deliberately fails closed when the engine is missing.
 * It must never fall back to a direct Supabase query.
 */

/* ==========================================
   STATE
========================================== */

const PAGE = {

  admins: [],
  filteredAdmins: [],
  logs: [],
  permissions: [],
  selectedAdmin: null,

  selectedRole: "all",
  searchText: "",

  page: 1,
  pageSize: 20,

  loading: false,
  initialized: false,
  autoRefreshTimer: null,

  network: null

};

/* ==========================================
   DOM
========================================== */

const DOM = {};

function cacheDOM(){

  DOM.adminName =
    document.getElementById("adminName");

  DOM.adminRole =
    document.getElementById("adminRole");

  DOM.tableBody =
    document.getElementById("permissionsTableBody");

  DOM.empty =
    document.getElementById("permissionEmpty");

  DOM.search =
    document.getElementById("adminSearch");

  DOM.totalAdmins =
    document.getElementById("totalAdmins");

  DOM.totalRoles =
    document.getElementById("totalRoles");

  DOM.totalPermissions =
    document.getElementById("totalPermissions");

  DOM.todayActivities =
    document.getElementById("todayActivities");

  DOM.loading =
    document.getElementById("adminLoading");

  DOM.network =
    document.getElementById("adminNetwork");

}

/* ==========================================
   HELPERS
========================================== */

function escapeHtml(text = ""){

  return String(text ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");

}

function safeString(value, fallback = ""){

  return (
    value === null ||
    value === undefined ||
    value === ""
  )
    ? fallback
    : String(value);

}

function formatDate(date){

  if(!date){
    return "-";
  }

  const parsed = new Date(date);

  if(Number.isNaN(parsed.getTime())){
    return "-";
  }

  return parsed.toLocaleString();

}

function roleLabel(role){

  switch(String(role || "")){

    case "super_admin":
      return "Super Admin";

    case "ecosystem_admin":
      return "Ecosystem Admin";

    case "project_admin":
      return "Project Admin";

    case "finance_admin":
      return "Finance Admin";

    case "review_admin":
      return "Review Admin";

    case "viewer_admin":
      return "Viewer Admin";

    default:
      return safeString(role,"Unknown");

  }

}

function statusBadge(status){

  const normalized =
    String(status || "")
      .toLowerCase()
      .trim();

  if(normalized === "active"){

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
   NETWORK
========================================== */

function getCurrentNetwork(){

  /*
   * Prefer the shared ALBUKHR network layer.
   * No network is guessed.
   */

  try{

    if(
      window.AlbukhrNetwork &&
      typeof window.AlbukhrNetwork.getCurrentNetwork === "function"
    ){

      return window.AlbukhrNetwork.getCurrentNetwork();

    }

    if(
      window.getCurrentNetwork &&
      typeof window.getCurrentNetwork === "function"
    ){

      return window.getCurrentNetwork();

    }

  }catch(error){

    console.error(
      "[Admin Permissions] Network detection failed:",
      error
    );

  }

  /*
   * Host fallback is only used to identify the environment;
   * database access remains engine-controlled.
   */

  const host =
    String(window.location.hostname || "")
      .toLowerCase();

  if(host === "app.albukhr.com"){
    return "mainnet";
  }

  if(host === "test.albukhr.com"){
    return "testnet";
  }

  throw new Error(
    "Unknown ALBUKHR environment. Admin permissions access refused."
  );

}

function ensureNetwork(){

  const network = getCurrentNetwork();

  if(
    network !== "mainnet" &&
    network !== "testnet"
  ){

    throw new Error(
      "Invalid ALBUKHR network."
    );

  }

  PAGE.network = network;

  if(DOM.network){
    DOM.network.textContent =
      network === "mainnet"
        ? "MAINNET"
        : "TESTNET";
  }

  return network;

}

/* ==========================================
   ADMIN AUTH
========================================== */

function getCurrentAdmin(){

  /*
   * Admin Auth is the source of truth.
   * Do not use LocalStorage as an authentication gate.
   */

  if(
    typeof window.getAdmin === "function"
  ){

    const admin = window.getAdmin();

    if(admin){
      return admin;
    }

  }

  if(
    window.AlbukhrAdminAuth &&
    typeof window.AlbukhrAdminAuth.getAdmin === "function"
  ){

    const admin =
      window.AlbukhrAdminAuth.getAdmin();

    if(admin){
      return admin;
    }

  }

  throw new Error(
    "Active Admin Auth session not found."
  );

}

function requirePermissionsAdmin(){

  const admin = getCurrentAdmin();

  const role =
    String(
      admin.role_code ||
      admin.role ||
      ""
    ).toLowerCase();

  /*
   * Permission management is restricted.
   * Prefer the project's existing role guard.
   */

  if(
    typeof window.requireRole === "function"
  ){

    window.requireRole([
      "super_admin",
      "ecosystem_admin"
    ]);

  }else if(
    role !== "super_admin" &&
    role !== "ecosystem_admin"
  ){

    throw new Error(
      "You do not have permission to manage administrators."
    );

  }

  if(DOM.adminName){
    DOM.adminName.textContent =
      admin.username ||
      admin.name ||
      admin.email ||
      "Administrator";
  }

  if(DOM.adminRole){
    DOM.adminRole.textContent =
      roleLabel(
        admin.role_code ||
        admin.role
      );
  }

  return admin;

}

/* ==========================================
   ENGINE
========================================== */

function getPermissionsEngine(){

  const engine =
    window.AlbukhrAdminPermissionsEngine;

  if(!engine){

    throw new Error(
      "AlbukhrAdminPermissionsEngine is not loaded. " +
      "Load the Admin Permissions Engine before this page."
    );

  }

  return engine;

}

function callEngine(methodNames, ...args){

  const engine =
    getPermissionsEngine();

  for(const method of methodNames){

    if(
      typeof engine[method] === "function"
    ){

      return engine[method](
        ...args,
        {
          network: PAGE.network
        }
      );

    }

  }

  throw new Error(
    "Admin Permissions Engine method is missing: " +
    methodNames.join(" / ")
  );

}

/* ==========================================
   LOADING
========================================== */

function showLoading(){

  if(DOM.loading){
    DOM.loading.style.display = "flex";
  }

  PAGE.loading = true;

}

function hideLoading(){

  if(DOM.loading){
    DOM.loading.style.display = "none";
  }

  PAGE.loading = false;

}

/* ==========================================
   ALERT
========================================== */

function showAlert(title,message){

  if(
    typeof window.openAppAlert === "function"
  ){

    window.openAppAlert(
      title,
      message
    );

    return;

  }

  if(
    typeof window.showAppAlert === "function"
  ){

    window.showAppAlert(
      title,
      message
    );

    return;

  }

  alert(
    title + "\n\n" + message
  );

}

/* ==========================================
   RESET FILTER
========================================== */

function resetFilters(){

  PAGE.searchText = "";
  PAGE.selectedRole = "all";
  PAGE.page = 1;

  if(DOM.search){
    DOM.search.value = "";
  }

  PAGE.filteredAdmins =
    [...PAGE.admins];

  renderAdminTable();

}

/* ==========================================
   LOAD ADMINS
========================================== */

async function loadAdmins(){

  const rows =
    await callEngine(
      [
        "adminListAdmins",
        "listAdmins",
        "getAdmins"
      ],
      {
        status: "",
        limit: 500
      }
    );

  PAGE.admins =
    Array.isArray(rows)
      ? rows
      : Array.isArray(rows?.data)
        ? rows.data
        : [];

  PAGE.filteredAdmins =
    [...PAGE.admins];

}

/* ==========================================
   LOAD STATISTICS
========================================== */

async function loadStatistics(){

  let stats = null;

  try{

    stats =
      await callEngine(
        [
          "getAdminStatistics",
          "adminGetStatistics",
          "getStatistics"
        ]
      );

  }catch(error){

    /*
     * Statistics may not exist in older engine builds.
     * We can still derive safe admin counts from the loaded list,
     * but permission/log totals must come from the engine.
     */

    console.warn(
      "[Admin Permissions] Statistics engine method unavailable:",
      error
    );

  }

  const normalized =
    stats?.data ||
    stats ||
    {};

  const roles =
    new Set(
      PAGE.admins
        .map(item =>
          item.role_code ||
          item.role
        )
        .filter(Boolean)
    );

  if(DOM.totalAdmins){

    DOM.totalAdmins.textContent =
      Number(
        normalized.total_admins ??
        PAGE.admins.length
      );

  }

  if(DOM.totalRoles){

    DOM.totalRoles.textContent =
      Number(
        normalized.total_roles ??
        roles.size
      );

  }

  if(DOM.totalPermissions){

    DOM.totalPermissions.textContent =
      Number(
        normalized.total_permissions ??
        0
      );

  }

  if(DOM.todayActivities){

    DOM.todayActivities.textContent =
      Number(
        normalized.today_activities ??
        normalized.today_logs ??
        0
      );

  }

}

/* ==========================================
   LOAD PAGE
========================================== */

async function loadPermissionPage(){

  if(PAGE.loading){
    return;
  }

  showLoading();

  try{

    ensureNetwork();
    requirePermissionsAdmin();

    await loadAdmins();
    await loadStatistics();

    applySearch();

    PAGE.initialized = true;

  }catch(error){

    console.error(
      "[Admin Permissions]",
      error
    );

    showAlert(
      "Loading Error",
      error.message ||
      "Unable to load admin permissions."
    );

  }finally{

    hideLoading();

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

  if(DOM.empty){
    DOM.empty.style.display = "none";
  }

  const end =
    PAGE.page *
    PAGE.pageSize;

  const rows =
    PAGE.filteredAdmins
      .slice(0,end);

  DOM.tableBody.innerHTML =
    rows.map(admin => {

      const id =
        encodeURIComponent(
          safeString(admin.id)
        );

      return `

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
            ${escapeHtml(
              roleLabel(
                admin.role_code ||
                admin.role
              )
            )}
          </td>

          <td>
            ${statusBadge(
              admin.status
            )}
          </td>

          <td>
            ${escapeHtml(
              formatDate(
                admin.last_login
              )
            )}
          </td>

          <td>

            <div class="table-actions">

              <button
                type="button"
                class="table-btn"
                onclick="editAdmin('${id}')"
                aria-label="Edit administrator"
              >
                ✏️
              </button>

              <button
                type="button"
                class="table-btn"
                onclick="managePermissions('${id}')"
                aria-label="Manage permissions"
              >
                🛡️
              </button>

              <button
                type="button"
                class="table-btn danger"
                onclick="deleteAdmin('${id}')"
                aria-label="Delete administrator"
              >
                🗑️
              </button>

            </div>

          </td>

        </tr>

      `;

    })
    .join("");

}

/* ==========================================
   EMPTY STATE
========================================== */

function renderEmptyState(){

  if(DOM.tableBody){
    DOM.tableBody.innerHTML = "";
  }

  if(DOM.empty){
    DOM.empty.style.display = "block";
  }

}

/* ==========================================
   OPEN ADD ADMIN
========================================== */

function openAdminModal(){

  requirePermissionsAdmin();

  PAGE.selectedAdmin = null;

  const title =
    document.getElementById(
      "adminModalTitle"
    );

  const email =
    document.getElementById(
      "adminEmail"
    );

  const username =
    document.getElementById(
      "adminUsername"
    );

  const role =
    document.getElementById(
      "adminRoleSelect"
    );

  const status =
    document.getElementById(
      "adminStatus"
    );

  const modal =
    document.getElementById(
      "adminModal"
    );

  if(title){
    title.textContent =
      "Add Administrator";
  }

  if(email){
    email.value = "";
  }

  if(username){
    username.value = "";
  }

  if(role){
    role.value =
      "viewer_admin";
  }

  if(status){
    status.value =
      "active";
  }

  if(modal){
    modal.style.display =
      "flex";
  }

}

/* ==========================================
   EDIT ADMIN
========================================== */

function editAdmin(encodedId){

  requirePermissionsAdmin();

  const id =
    decodeURIComponent(
      encodedId || ""
    );

  const admin =
    PAGE.admins.find(
      item =>
        String(item.id) === id
    );

  if(!admin){
    return;
  }

  PAGE.selectedAdmin =
    admin;

  const title =
    document.getElementById(
      "adminModalTitle"
    );

  const email =
    document.getElementById(
      "adminEmail"
    );

  const username =
    document.getElementById(
      "adminUsername"
    );

  const role =
    document.getElementById(
      "adminRoleSelect"
    );

  const status =
    document.getElementById(
      "adminStatus"
    );

  const modal =
    document.getElementById(
      "adminModal"
    );

  if(title){
    title.textContent =
      "Edit Administrator";
  }

  if(email){
    email.value =
      admin.email || "";
  }

  if(username){
    username.value =
      admin.username || "";
  }

  if(role){
    role.value =
      admin.role_code ||
      admin.role ||
      "viewer_admin";
  }

  if(status){
    status.value =
      admin.status ||
      "active";
  }

  if(modal){
    modal.style.display =
      "flex";
  }

}

/* ==========================================
   CLOSE ADMIN MODAL
========================================== */

function closeAdminModal(){

  const modal =
    document.getElementById(
      "adminModal"
    );

  if(modal){
    modal.style.display =
      "none";
  }

  PAGE.selectedAdmin =
    null;

}

/* ==========================================
   SAVE ADMIN
========================================== */

async function saveAdmin(){

  requirePermissionsAdmin();

  showLoading();

  try{

    const payload = {

      email:
        safeString(
          document.getElementById(
            "adminEmail"
          )?.value
        )
        .trim()
        .toLowerCase(),

      username:
        safeString(
          document.getElementById(
            "adminUsername"
          )?.value
        ).trim(),

      role_code:
        safeString(
          document.getElementById(
            "adminRoleSelect"
          )?.value
        ).trim(),

      status:
        safeString(
          document.getElementById(
            "adminStatus"
          )?.value
        ).trim()

    };

    if(!payload.email){
      throw new Error(
        "Administrator email is required."
      );
    }

    if(!payload.username){
      throw new Error(
        "Administrator username is required."
      );
    }

    if(!payload.role_code){
      throw new Error(
        "Administrator role is required."
      );
    }

    if(PAGE.selectedAdmin){

      await callEngine(
        [
          "adminUpdateAdmin",
          "updateAdmin"
        ],
        {
          adminId:
            PAGE.selectedAdmin.id,
          payload
        }
      );

      await logAdminAction({
        action: "update_admin",
        target:
          PAGE.selectedAdmin.id,
        details: payload
      });

    }else{

      await callEngine(
        [
          "adminCreateAdmin",
          "createAdmin"
        ],
        {
          payload
        }
      );

      await logAdminAction({
        action: "create_admin",
        target:
          payload.email,
        details: payload
      });

    }

    closeAdminModal();

    await loadPermissionPage();

    showAlert(
      "Success",
      "Administrator saved successfully."
    );

  }catch(error){

    console.error(
      "[Admin Permissions] Save:",
      error
    );

    showAlert(
      "Save Failed",
      error.message ||
      "Unable to save administrator."
    );

  }finally{

    hideLoading();

  }

}

/* ==========================================
   DELETE ADMIN
========================================== */

async function deleteAdmin(encodedId){

  requirePermissionsAdmin();

  const id =
    decodeURIComponent(
      encodedId || ""
    );

  const admin =
    PAGE.admins.find(
      item =>
        String(item.id) === id
    );

  if(!admin){
    return;
  }

  if(
    !confirm(
      `Delete ${admin.username || admin.email}?`
    )
  ){
    return;
  }

  showLoading();

  try{

    await callEngine(
      [
        "adminDeleteAdmin",
        "deleteAdmin"
      ],
      {
        adminId: id
      }
    );

    await logAdminAction({
      action: "delete_admin",
      target: id,
      details: {
        email:
          admin.email || ""
      }
    });

    await loadPermissionPage();

    showAlert(
      "Deleted",
      "Administrator removed."
    );

  }catch(error){

    console.error(
      "[Admin Permissions] Delete:",
      error
    );

    showAlert(
      "Delete Failed",
      error.message ||
      "Unable to remove administrator."
    );

  }finally{

    hideLoading();

  }

}

/* ==========================================
   MANAGE PERMISSIONS
========================================== */

async function managePermissions(encodedId){

  requirePermissionsAdmin();

  const id =
    decodeURIComponent(
      encodedId || ""
    );

  PAGE.selectedAdmin =
    PAGE.admins.find(
      item =>
        String(item.id) === id
    );

  if(!PAGE.selectedAdmin){
    return;
  }

  const modal =
    document.getElementById(
      "permissionModal"
    );

  if(modal){
    modal.style.display =
      "flex";
  }

  /*
   * Existing permission matrix UI remains compatible.
   * The matrix loader itself must be engine-backed.
   */

  if(
    typeof window.loadPermissionMatrix ===
    "function"
  ){

    await window.loadPermissionMatrix(
      PAGE.selectedAdmin,
      {
        network: PAGE.network
      }
    );

  }else if(
    typeof window.AlbukhrAdminPermissionsEngine
      ?.loadPermissionMatrix ===
    "function"
  ){

    await window.AlbukhrAdminPermissionsEngine
      .loadPermissionMatrix(
        PAGE.selectedAdmin,
        {
          network: PAGE.network
        }
      );

  }else{

    throw new Error(
      "Permission Matrix Engine is not loaded."
    );

  }

}

/* ==========================================
   CLOSE PERMISSION MODAL
========================================== */

function closePermissionModal(){

  const modal =
    document.getElementById(
      "permissionModal"
    );

  if(modal){
    modal.style.display =
      "none";
  }

}

/* ==========================================
   LOG ADMIN ACTION
========================================== */

async function logAdminAction(payload){

  const engine =
    getPermissionsEngine();

  const methods = [
    "logAdminAction",
    "adminLogAction",
    "createActivityLog"
  ];

  for(const method of methods){

    if(
      typeof engine[method] ===
      "function"
    ){

      return engine[method](
        {
          ...payload,
          network: PAGE.network
        }
      );

    }

  }

  /*
   * Logging is security/audit data.
   * Do not silently write directly to Supabase.
   */

  console.warn(
    "[Admin Permissions] Audit-log engine method unavailable."
  );

  return null;

}

/* ==========================================
   VIEW LOGS
========================================== */

async function openLogsModal(){

  requirePermissionsAdmin();

  const modal =
    document.getElementById(
      "logsModal"
    );

  if(modal){
    modal.style.display =
      "flex";
  }

  try{

    const result =
      await callEngine(
        [
          "adminListActivityLogs",
          "listActivityLogs",
          "getAdminLogs"
        ],
        {
          limit: 100
        }
      );

    PAGE.logs =
      Array.isArray(result)
        ? result
        : Array.isArray(result?.data)
          ? result.data
          : [];

    const container =
      document.getElementById(
        "logsContainer"
      );

    if(!container){
      return;
    }

    container.innerHTML =
      PAGE.logs.map(log => `

        <div class="log-item">

          <strong>
            ${escapeHtml(
              log.action || ""
            )}
          </strong>

          <div>
            ${escapeHtml(
              log.target || ""
            )}
          </div>

          <small>
            ${escapeHtml(
              formatDate(
                log.created_at
              )
            )}
          </small>

        </div>

      `).join("");

  }catch(error){

    console.error(
      "[Admin Permissions] Logs:",
      error
    );

    showAlert(
      "Logs Error",
      error.message ||
      "Unable to load administrator activity logs."
    );

  }

}

/* ==========================================
   CLOSE LOGS
========================================== */

function closeLogsModal(){

  const modal =
    document.getElementById(
      "logsModal"
    );

  if(modal){
    modal.style.display =
      "none";
  }

}

/* ==========================================
   SEARCH
========================================== */

function applySearch(){

  PAGE.searchText =
    safeString(
      DOM.search?.value
    )
    .toLowerCase()
    .trim();

  PAGE.filteredAdmins =
    PAGE.admins.filter(admin => {

      const text = (

        safeString(
          admin.username
        ) +

        " " +

        safeString(
          admin.email
        ) +

        " " +

        safeString(
          admin.role_code ||
          admin.role
        )

      ).toLowerCase();

      const matchSearch =
        !PAGE.searchText ||
        text.includes(
          PAGE.searchText
        );

      const matchRole =
        PAGE.selectedRole === "all" ||
        (
          admin.role_code ||
          admin.role
        ) === PAGE.selectedRole;

      return (
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

  PAGE.selectedRole =
    safeString(
      role,
      "all"
    );

  applySearch();

}

/* ==========================================
   LOAD MORE
========================================== */

function loadMore(){

  if(
    PAGE.page *
      PAGE.pageSize >=
    PAGE.filteredAdmins.length
  ){

    return;

  }

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

  if(PAGE.autoRefreshTimer){

    clearInterval(
      PAGE.autoRefreshTimer
    );

  }

  PAGE.autoRefreshTimer =
    setInterval(
      async()=>{

        if(PAGE.loading){
          return;
        }

        try{

          await loadPermissionPage();

        }catch(error){

          console.error(
            "[Admin Permissions] Auto refresh:",
            error
          );

        }

      },
      60000
    );

}

/* ==========================================
   STOP AUTO REFRESH
========================================== */

function stopAutoRefresh(){

  if(PAGE.autoRefreshTimer){

    clearInterval(
      PAGE.autoRefreshTimer
    );

    PAGE.autoRefreshTimer =
      null;

  }

}

/* ==========================================
   EVENTS
========================================== */

function bindEvents(){

  if(DOM.search){

    DOM.search.addEventListener(
      "input",
      applySearch
    );

  }

  document
    .querySelectorAll(
      "[data-role-filter]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        ()=>{

          document
            .querySelectorAll(
              "[data-role-filter]"
            )
            .forEach(item =>
              item.classList.remove(
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

}

/* ==========================================
   PAGE READY
========================================== */

function initializePage(){

  cacheDOM();

  bindEvents();

}

/*
 * admin-ready is preferred because Admin Auth
 * must be ready before protected data is requested.
 */

document.addEventListener(
  "admin-ready",
  async()=>{

    try{

      if(!PAGE.initialized){
        initializePage();
      }

      await loadPermissionPage();

      startAutoRefresh();

    }catch(error){

      console.error(
        "[Admin Permissions] Initialization:",
        error
      );

      showAlert(
        "Initialization Failed",
        error.message ||
        "Unable to initialize Admin Permissions."
      );

    }

  }
);

/*
 * Keep a safe DOM-ready initialization for pages
 * where the admin shell dispatches admin-ready slightly later.
 */

document.addEventListener(
  "DOMContentLoaded",
  ()=>{

    initializePage();

  }
);

/* ==========================================
   VISIBILITY REFRESH
========================================== */

document.addEventListener(
  "visibilitychange",
  ()=>{

    if(
      document.visibilityState ===
      "visible" &&
      PAGE.initialized &&
      !PAGE.loading
    ){

      loadPermissionPage()
        .catch(error =>
          console.error(
            "[Admin Permissions] Visibility refresh:",
            error
          )
        );

    }

  }
);

/* ==========================================
   GLOBAL EXPORTS
========================================== */

window.AdminPermissionPage =
  PAGE;

window.showLoading =
  showLoading;

window.hideLoading =
  hideLoading;

window.showAlert =
  showAlert;

window.escapeHtml =
  escapeHtml;

window.formatDate =
  formatDate;

window.roleLabel =
  roleLabel;

window.statusBadge =
  statusBadge;

window.resetFilters =
  resetFilters;

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

window.stopAutoRefresh =
  stopAutoRefresh;

})(window);
