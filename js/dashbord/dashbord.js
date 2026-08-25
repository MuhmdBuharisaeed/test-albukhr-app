/* =========================================
   ALBUKHR UNIVERSAL PROJECT DASHBOARD v3 FINAL
   - Single dashboard
   - Internal / External / Core compatible
   - Resolver-aware
   - Permission-gated actions
   - Supabase project registry v3 compatible
   - Network-aware
   - Project logo/image compatible
   - Supabase project updates compatible

   REQUIRED ARCHITECTURE:
   js/supabase-core.js
   js/projects-engine.js
   js/project-treasury.js
   js/project-updates.js
   resolver / permission engines

   NOTE:
   - public.projects is the project metadata source of truth.
   - Project images use logo_url / logo_path metadata.
   - No generated emoji is used for project presentation.
   - Dock Navigation is intentionally untouched.
========================================= */

/* =========================================
   ELEMENTS
========================================= */
const dashboardEls = {
  projectName: document.getElementById("projectName"),
  projectMetaLine: document.getElementById("projectMetaLine"),
  projectBadges: document.getElementById("projectBadges"),

  projectLogo: document.getElementById("projectLogo"),
  projectLogoWrap: document.getElementById("projectLogoWrap"),
  projectLogoFallback: document.getElementById("projectLogoFallback"),

  liquidity: document.getElementById("liquidity"),
  reserve: document.getElementById("reserve"),
  roi: document.getElementById("roi"),
  investors: document.getElementById("investors"),
  liquidityStatus: document.getElementById("liquidityStatus"),
  usableLiquidity: document.getElementById("usableLiquidity"),

  history: document.getElementById("history"),
  projectStakeBox: document.getElementById("projectStakeBox"),

  addAmount: document.getElementById("addAmount"),
  withdrawAmount: document.getElementById("withdrawAmount"),

  addLiquidityBtn: document.getElementById("addLiquidityBtn"),
  withdrawLiquidityBtn: document.getElementById("withdrawLiquidityBtn"),
  uploadProjectUpdateBtn: document.getElementById("uploadProjectUpdateBtn"),

  addLiquidityCard: document.getElementById("addLiquidityCard"),
  withdrawLiquidityCard: document.getElementById("withdrawLiquidityCard"),
  projectUpdatesCard: document.getElementById("projectUpdatesCard"),

  addLiquidityNote: document.getElementById("addLiquidityNote"),
  withdrawLiquidityNote: document.getElementById("withdrawLiquidityNote"),
  projectUpdatesHeading: document.getElementById("projectUpdatesHeading"),
  projectUpdatesNote: document.getElementById("projectUpdatesNote"),

  projectUpdateTitle: document.getElementById("projectUpdateTitle"),
  projectUpdateImage: document.getElementById("projectUpdateImage"),
  projectUpdateText: document.getElementById("projectUpdateText"),

  updateImagePreviewBox: document.getElementById("updateImagePreviewBox"),
  updateImagePreview: document.getElementById("updateImagePreview"),
  updateImagePreviewMeta: document.getElementById("updateImagePreviewMeta")
};

let currentProject = null;
let currentProjectNetwork = null;
let dashboardBusy = false;
let uploadBusy = false;
let dashboardEventsBound = false;

/* =========================================
   SAFE HELPERS
========================================= */
function safeString(value, fallback = ""){
  if(value === null || value === undefined) return fallback;
  return String(value);
}

function safeNumber(value, fallback = 0){
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatPi(value){
  return `${safeNumber(value, 0).toFixed(2)} Pi`;
}

function escapeHtml(text = ""){
  return safeString(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeNetwork(value){
  const network = safeString(value).trim().toLowerCase();

  if(network === "mainnet") return "mainnet";
  if(network === "testnet") return "testnet";

  return "";
}

function getDashboardNetwork(){
  try{
    if(typeof window.getAlbukhrProjectsNetwork === "function"){
      const network = normalizeNetwork(
        window.getAlbukhrProjectsNetwork()
      );

      if(network) return network;
    }
  }catch(e){
    console.warn("getAlbukhrProjectsNetwork warning:", e);
  }

  try{
    if(typeof window.getCurrentAlbukhrNetwork === "function"){
      const network = normalizeNetwork(
        window.getCurrentAlbukhrNetwork()
      );

      if(network) return network;
    }
  }catch(e){
    console.warn("getCurrentAlbukhrNetwork warning:", e);
  }

  const host = safeString(window.location?.hostname).toLowerCase();

  if(host === "app.albukhr.com" || host.endsWith(".app.albukhr.com")){
    return "mainnet";
  }

  if(host === "test.albukhr.com" || host.endsWith(".test.albukhr.com")){
    return "testnet";
  }

  return "testnet";
}

function formatProjectType(type){
  const t = safeString(type).trim().toLowerCase();

  if(t === "core") return "Core";
  if(t === "internal") return "Internal";
  if(t === "external") return "External";

  return "Unknown";
}

function formatProjectStatus(status){
  const s = safeString(status).trim().toLowerCase();

  if(s === "active") return "Active";
  if(s === "inactive") return "Inactive";
  if(s === "archived") return "Archived";

  return s || "Unknown";
}

function getProjectTypeBadgeClass(type){
  const t = safeString(type).trim().toLowerCase();

  if(t === "core") return "core";
  if(t === "internal") return "internal";
  if(t === "external") return "external";

  return "internal";
}

function getProjectStatusBadgeClass(status){
  const s = safeString(status).trim().toLowerCase();

  if(s === "active") return "active";
  if(s === "inactive") return "inactive";
  if(s === "archived") return "archived";

  return "inactive";
}

function computeLiquidityStatus(status = {}){
  const liquidity = safeNumber(status.liquidity, 0);
  const minLiquidity = safeNumber(status.min_liquidity, 100);
  const usable = safeNumber(status.max_usable_liquidity, 0);

  if(liquidity < minLiquidity){
    return {
      label:"LOW",
      className:"status-low"
    };
  }

  if(usable <= 0){
    return {
      label:"SAFE",
      className:"status-safe"
    };
  }

  return {
    label:"STRONG",
    className:"status-strong"
  };
}

function showDashboardAlert(title, message){
  if(typeof openAppAlert === "function"){
    openAppAlert(title, message);
    return;
  }

  alert(`${title}\n\n${message}`);
}

/* =========================================
   CURRENT USER / ACTOR
   These are compatibility fallbacks only.
   Resolver remains primary where available.
========================================= */
function getCurrentAdminMeta(){
  return {
    actor_userid:
      localStorage.getItem("albukhr_current_email") ||
      localStorage.getItem("currentUserEmail") ||
      "admin",

    actor_username:
      localStorage.getItem("albukhr_current_username") ||
      localStorage.getItem("currentUserName") ||
      "ALBUKHR Admin",

    actor_role:
      localStorage.getItem("albukhr_current_role") ||
      "project_admin"
  };
}

function getCurrentUpdateMeta(){
  return {
    email:
      localStorage.getItem("albukhr_current_email") ||
      localStorage.getItem("currentUserEmail") ||
      "",

    name:
      localStorage.getItem("albukhr_current_username") ||
      localStorage.getItem("currentUserName") ||
      "ALBUKHR Admin",

    role:
      localStorage.getItem("albukhr_current_role") ||
      "project_admin"
  };
}

async function getResolverCurrentUser(){
  try{
    if(
      typeof ALBUKHR_PROJECT_RESOLVER !== "undefined" &&
      typeof ALBUKHR_PROJECT_RESOLVER.getCurrentAlbukhrUser === "function"
    ){
      return await ALBUKHR_PROJECT_RESOLVER.getCurrentAlbukhrUser();
    }
  }catch(e){
    console.warn(
      "Resolver getCurrentAlbukhrUser warning:",
      e
    );
  }

  return {
    email:
      localStorage.getItem("albukhr_current_email") || "",

    userid:
      localStorage.getItem("albukhr_current_email") || "",

    username:
      localStorage.getItem("albukhr_current_username") ||
      "ALBUKHR Admin",

    role:
      localStorage.getItem("albukhr_current_role") ||
      "project_admin",

    isAdmin:true
  };
}

/* =========================================
   PROJECT TYPE / RESOLVER
========================================= */
function getProjectTypeFromResolver(project){
  try{
    if(typeof getAlbukhrProjectType === "function"){
      const type = getAlbukhrProjectType(project);

      if(type){
        return safeString(type).trim().toLowerCase();
      }
    }
  }catch(e){
    console.warn(
      "getAlbukhrProjectType warning:",
      e
    );
  }

  return safeString(
    project?.project_type
  ).trim().toLowerCase() || "unknown";
}

/* =========================================
   LOGO / IMAGE
   Canonical fields:
   logo_url
   logo_path

   No emoji generation.
========================================= */
function getProjectLogoUrl(project){
  if(!project) return "";

  const directUrl = safeString(
    project.logo_url
  ).trim();

  if(directUrl){
    return directUrl;
  }

  const compatibilityUrl = safeString(
    project.cover_image
  ).trim();

  if(compatibilityUrl){
    return compatibilityUrl;
  }

  return "";
}

function renderProjectLogo(project){
  const logoUrl = getProjectLogoUrl(project);

  const img = dashboardEls.projectLogo;
  const wrap = dashboardEls.projectLogoWrap;
  const fallback = dashboardEls.projectLogoFallback;

  if(!img){
    return;
  }

  if(!logoUrl){
    img.removeAttribute("src");

    if(wrap){
      wrap.style.display = "none";
    }

    if(fallback){
      fallback.style.display = "none";
    }

    return;
  }

  img.alt =
    `${safeString(
      project?.project_name ||
      project?.project_code ||
      "ALBUKHR Project"
    )} logo`;

  img.src = logoUrl;

  if(wrap){
    wrap.style.display = "";
  }

  if(fallback){
    fallback.style.display = "none";
  }

  img.onerror = function(){
    img.removeAttribute("src");

    if(wrap){
      wrap.style.display = "none";
    }

    if(fallback){
      fallback.style.display = "none";
    }

    console.warn(
      "Project logo could not be loaded:",
      logoUrl
    );
  };
}

/* =========================================
   IMAGE PREVIEW FOR PROJECT UPDATE
========================================= */
function resetImagePreview(){
  if(dashboardEls.updateImagePreviewBox){
    dashboardEls.updateImagePreviewBox.style.display = "none";
  }

  if(dashboardEls.updateImagePreview){
    dashboardEls.updateImagePreview.src = "";
  }

  if(dashboardEls.updateImagePreviewMeta){
    dashboardEls.updateImagePreviewMeta.textContent = "";
  }
}

function previewSelectedImage(file){
  if(!file){
    resetImagePreview();
    return;
  }

  const reader = new FileReader();

  reader.onload = function(e){
    if(dashboardEls.updateImagePreview){
      dashboardEls.updateImagePreview.src =
        e.target.result;
    }

    if(dashboardEls.updateImagePreviewMeta){
      dashboardEls.updateImagePreviewMeta.textContent =
        `${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB`;
    }

    if(dashboardEls.updateImagePreviewBox){
      dashboardEls.updateImagePreviewBox.style.display = "block";
    }
  };

  reader.readAsDataURL(file);
}

/* =========================================
   ELEMENT STATE HELPERS
========================================= */
function setCardButtonState(
  buttonEl,
  {
    visible = true,
    disabled = false,
    text = ""
  } = {}
){
  if(!buttonEl) return;

  buttonEl.style.display =
    visible ? "" : "none";

  buttonEl.disabled = !!disabled;

  if(text){
    buttonEl.textContent = text;
  }
}

function setInputState(
  inputEl,
  {
    visible = true,
    disabled = false
  } = {}
){
  if(!inputEl) return;

  inputEl.style.display =
    visible ? "" : "none";

  inputEl.disabled = !!disabled;
}

function setNote(el, text = ""){
  if(!el) return;

  el.textContent = text || "";
  el.style.display = text ? "block" : "none";
}

function renderStakeFallback(message){
  if(!dashboardEls.projectStakeBox) return;

  dashboardEls.projectStakeBox.innerHTML =
    `<div class="muted">${escapeHtml(message)}</div>`;
}

/* =========================================
   ADMIN GUARD
========================================= */
function guardAdmin(){
  if(typeof requireRole === "function"){
    requireRole([
      "super_admin",
      "ecosystem_admin",
      "project_admin",
      "finance_admin"
    ]);
  }

  if(
    typeof getAdmin === "function" &&
    !getAdmin()
  ){
    window.location.href =
      "admin-login.html";

    return false;
  }

  return true;
}

/* =========================================
   RESOLVE CURRENT PROJECT
   projects-engine v3 is primary.
   Network is checked before accepting result.
========================================= */
async function resolveCurrentProject(){
  const currentNetwork =
    getDashboardNetwork();

  let resolved = null;
  let projectRef = "";

  try{
    if(
      typeof normalizeAlbukhrCurrentProjectStorage ===
      "function"
    ){
      await normalizeAlbukhrCurrentProjectStorage();
    }
  }catch(e){
    console.warn(
      "normalizeAlbukhrCurrentProjectStorage warning:",
      e
    );
  }

  try{
    if(
      typeof resolveAlbukhrCurrentProject ===
      "function"
    ){
      resolved =
        await resolveAlbukhrCurrentProject();
    }
  }catch(e){
    console.warn(
      "resolveAlbukhrCurrentProject warning:",
      e
    );
  }

  if(
    resolved &&
    resolved.project_code
  ){
    projectRef =
      safeString(
        resolved.project_code
      ).trim();
  }

  if(!projectRef){
    projectRef =
      safeString(
        localStorage.getItem(
          "albukhr_current_project"
        )
      ).trim();
  }

  if(!projectRef){
    showDashboardAlert(
      "Project missing",
      "No current project was found."
    );

    return null;
  }

  /* -----------------------------------------
     Primary lookup through projects-engine v3.
     Pass network explicitly where supported.
  ----------------------------------------- */
  if(
    typeof getProjectByCode ===
    "function"
  ){
    try{
      const project =
        await getProjectByCode(
          projectRef,
          { network:currentNetwork }
        );

      if(project){
        if(
          normalizeNetwork(project.network) !==
          currentNetwork
        ){
          console.error(
            "Project network mismatch.",
            {
              expected:currentNetwork,
              received:project.network,
              project:project.project_code
            }
          );

          showDashboardAlert(
            "Network mismatch",
            "The selected project does not belong to the current ALBUKHR network."
          );

          return null;
        }

        return project;
      }
    }catch(e){
      console.warn(
        "getProjectByCode network lookup warning:",
        e
      );
    }
  }

  /* -----------------------------------------
     Resolver result is accepted only if its
     network matches current environment.
  ----------------------------------------- */
  if(
    resolved &&
    resolved.project_code
  ){
    const resolvedNetwork =
      normalizeNetwork(
        resolved.network
      );

    if(
      resolvedNetwork &&
      resolvedNetwork !== currentNetwork
    ){
      showDashboardAlert(
        "Network mismatch",
        "The selected project belongs to another ALBUKHR network."
      );

      return null;
    }

    if(
      normalizeNetwork(resolved.network) ===
      currentNetwork ||
      !resolved.network
    ){
      return resolved;
    }
  }

  /* -----------------------------------------
     Legacy fallback.
     Still restricted to current network when
     the project metadata engine supports it.
  ----------------------------------------- */
  if(typeof getProjectMeta === "function"){
    try{
      const project =
        await getProjectMeta(
          projectRef,
          { network:currentNetwork }
        );

      if(project){
        if(
          normalizeNetwork(project.network) &&
          normalizeNetwork(project.network) !==
          currentNetwork
        ){
          showDashboardAlert(
            "Network mismatch",
            "The selected project belongs to another ALBUKHR network."
          );

          return null;
        }

        return project;
      }
    }catch(e){
      console.warn(
        "getProjectMeta fallback warning:",
        e
      );
    }
  }

  showDashboardAlert(
    "Project not found",
    `Project not found in ${currentNetwork}: ${projectRef}`
  );

  return null;
}

/* =========================================
   LOAD TREASURY STATUS
========================================= */
async function getProjectTreasurySummary(project){
  const projectCode =
    project.project_code;

  if(
    typeof getProjectTreasuryStatus ===
    "function"
  ){
    const summary =
      await getProjectTreasuryStatus(
        projectCode
      );

    if(
      summary &&
      !summary.error
    ){
      return {
        project_code:projectCode,

        liquidity:safeNumber(
          summary.liquidity,
          0
        ),

        reserve:safeNumber(
          summary.reserve,
          0
        ),

        reserve_percent:safeNumber(
          summary.reserve_percent,
          project.reserve_percent ?? 0.30
        ),

        min_liquidity:safeNumber(
          summary.min_liquidity,
          project.min_liquidity ?? 100
        ),

        max_usable_liquidity:safeNumber(
          summary.max_usable_liquidity,
          0
        ),

        reward_rate:
          summary.reward_rate === null ||
          summary.reward_rate === undefined
            ? (
                project.reward_rate === null ||
                project.reward_rate === undefined
                  ? 0
                  : safeNumber(project.reward_rate, 0)
              )
            : safeNumber(
                summary.reward_rate,
                0
              )
      };
    }
  }

  return {
    project_code:projectCode,
    liquidity:0,
    reserve:0,
    reserve_percent:safeNumber(
      project.reserve_percent,
      0.30
    ),
    min_liquidity:safeNumber(
      project.min_liquidity,
      100
    ),
    max_usable_liquidity:0,
    reward_rate:
      project.reward_rate === null ||
      project.reward_rate === undefined
        ? 0
        : safeNumber(project.reward_rate, 0)
  };
}

/* =========================================
   LOAD ROI
========================================= */
async function getProjectROI(
  projectCode,
  fallbackProject = null
){
  try{
    if(
      typeof calculateProjectROI ===
      "function"
    ){
      const roi =
        await calculateProjectROI(
          projectCode
        );

      const n = Number(roi);

      if(Number.isFinite(n)){
        return n;
      }
    }
  }catch(e){
    console.warn(
      "calculateProjectROI warning:",
      e
    );
  }

  return safeNumber(
    fallbackProject?.roi,
    0
  );
}

/* =========================================
   LOAD INVESTORS
========================================= */
async function getProjectInvestorCount(
  projectCode
){
  let allStakes = [];

  try{
    if(
      typeof getAllStakesMerged ===
      "function"
    ){
      const result =
        await getAllStakesMerged();

      if(Array.isArray(result)){
        allStakes = result;
      }
    }
  }catch(e){
    console.warn(
      "getAllStakesMerged warning:",
      e
    );
  }

  const code =
    safeString(projectCode)
      .trim()
      .toLowerCase();

  return allStakes.filter(stake => {
    const stakeCode =
      safeString(
        stake?.project_code ||
        stake?.project
      )
      .trim()
      .toLowerCase();

    return stakeCode === code;
  }).length;
}

/* =========================================
   LOAD HISTORY
========================================= */
async function getTreasuryHistory(
  projectCode
){
  try{
    if(
      typeof getProjectTreasuryHistory ===
      "function"
    ){
      const history =
        await getProjectTreasuryHistory(
          projectCode,
          50
        );

      return Array.isArray(history)
        ? history
        : [];
    }
  }catch(e){
    console.warn(
      "getProjectTreasuryHistory warning:",
      e
    );
  }

  return [];
}

/* =========================================
   RENDER HEADER
========================================= */
function renderProjectHeader(project){
  const projectType =
    getProjectTypeFromResolver(
      project
    );

  const projectStatus =
    safeString(
      project.status || "active"
    ).toLowerCase();

  const projectNetwork =
    normalizeNetwork(
      project.network
    );

  dashboardEls.projectName.textContent =
    project.project_name ||
    project.project_code ||
    "Unknown Project";

  renderProjectLogo(project);

  dashboardEls.projectMetaLine.innerHTML = `
    Code: <strong>${escapeHtml(
      project.project_code || "-"
    )}</strong> •
    Type: <strong>${escapeHtml(
      formatProjectType(projectType)
    )}</strong> •
    Network: <strong>${escapeHtml(
      projectNetwork || getDashboardNetwork()
    )}</strong>
  `;

  dashboardEls.projectBadges.innerHTML = `
    <span class="badge ${escapeHtml(
      getProjectTypeBadgeClass(projectType)
    )}">
      ${escapeHtml(
        formatProjectType(projectType)
      )}
    </span>

    <span class="badge ${escapeHtml(
      getProjectStatusBadgeClass(projectStatus)
    )}">
      ${escapeHtml(
        formatProjectStatus(projectStatus)
      )}
    </span>
  `;
}

/* =========================================
   RENDER STATS
========================================= */
function renderProjectStats({
  treasuryStatus,
  roi,
  investors
}){
  dashboardEls.liquidity.textContent =
    formatPi(
      treasuryStatus.liquidity
    );

  dashboardEls.reserve.textContent =
    formatPi(
      treasuryStatus.reserve
    );

  dashboardEls.usableLiquidity.textContent =
    formatPi(
      treasuryStatus.max_usable_liquidity
    );

  dashboardEls.roi.textContent =
    `${safeNumber(
      roi,
      0
    ).toFixed(2)}%`;

  dashboardEls.investors.textContent =
    String(
      safeNumber(
        investors,
        0
      )
    );

  const state =
    computeLiquidityStatus(
      treasuryStatus
    );

  dashboardEls.liquidityStatus.textContent =
    state.label;

  dashboardEls.liquidityStatus.className =
    `big ${state.className}`;
}

/* =========================================
   RENDER HISTORY
========================================= */
function renderHistory(history = []){
  if(
    !Array.isArray(history) ||
    !history.length
  ){
    dashboardEls.history.className =
      "empty";

    dashboardEls.history.innerHTML =
      "No treasury activity yet.";

    return;
  }

  const chunks =
    history.map(tx => {
      const txType =
        safeString(
          tx.tx_type ||
          "transaction"
        ).replace(
          /_/g,
          " "
        );

      const amount =
        safeNumber(
          tx.amount,
          0
        );

      const note =
        tx.note ||
        tx.tx_type ||
        "Treasury transaction";

      const createdAt =
        tx.created_at
          ? new Date(
              tx.created_at
            ).toLocaleString()
          : "—";

      return `
        <div class="tx">
          <div class="tx-left">
            <div>
              <strong>${escapeHtml(
                txType
              )}</strong>
            </div>

            <div class="muted">
              ${escapeHtml(
                note
              )}
            </div>

            <div class="muted">
              ${escapeHtml(
                createdAt
              )}
            </div>
          </div>

          <div class="tx-right">
            ${formatPi(amount)}
          </div>
        </div>
      `;
    });

  dashboardEls.history.className = "";
  dashboardEls.history.innerHTML =
    chunks.join("");
}

/* =========================================
   APPLY DASHBOARD SECTION PERMISSIONS
========================================= */
async function applyDashboardSectionPermissions(
  project
){
  const user =
    await getResolverCurrentUser();

  const projectType =
    getProjectTypeFromResolver(
      project
    );

  let canManageTreasury = false;
  let canUploadUpdate = false;

  try{
    if(
      typeof canManageAlbukhrProjectTreasury ===
      "function"
    ){
      canManageTreasury =
        !!await canManageAlbukhrProjectTreasury(
          project,
          user
        );
    }
  }catch(e){
    console.warn(
      "canManageAlbukhrProjectTreasury warning:",
      e
    );
  }

  try{
    if(
      typeof canUploadAlbukhrProjectUpdate ===
      "function"
    ){
      canUploadUpdate =
        !!await canUploadAlbukhrProjectUpdate(
          project,
          user
        );
    }
  }catch(e){
    console.warn(
      "canUploadAlbukhrProjectUpdate warning:",
      e
    );
  }

  /* -----------------------------------------
     Project updates heading
  ----------------------------------------- */
  if(
    dashboardEls.projectUpdatesHeading
  ){
    if(
      typeof getAlbukhrProjectUpdateTitle ===
      "function"
    ){
      try{
        dashboardEls.projectUpdatesHeading.textContent =
          getAlbukhrProjectUpdateTitle(
            project
          );
      }catch(e){
        dashboardEls.projectUpdatesHeading.textContent =
          "Project Updates";
      }
    }else{
      dashboardEls.projectUpdatesHeading.textContent =
        "Project Updates";
    }
  }

  /* -----------------------------------------
     TREASURY CONTROLS
  ----------------------------------------- */
  setInputState(
    dashboardEls.addAmount,
    {
      visible:canManageTreasury,
      disabled:!canManageTreasury
    }
  );

  setCardButtonState(
    dashboardEls.addLiquidityBtn,
    {
      visible:true,
      disabled:!canManageTreasury,
      text:canManageTreasury
        ? "Add Liquidity"
        : "Treasury Access Required"
    }
  );

  setInputState(
    dashboardEls.withdrawAmount,
    {
      visible:canManageTreasury,
      disabled:!canManageTreasury
    }
  );

  setCardButtonState(
    dashboardEls.withdrawLiquidityBtn,
    {
      visible:true,
      disabled:!canManageTreasury,
      text:canManageTreasury
        ? "Withdraw Liquidity"
        : "Treasury Access Required"
    }
  );

  if(canManageTreasury){
    setNote(
      dashboardEls.addLiquidityNote,
      ""
    );

    setNote(
      dashboardEls.withdrawLiquidityNote,
      ""
    );
  }else{
    setNote(
      dashboardEls.addLiquidityNote,
      "Treasury actions are restricted to authorized ALBUKHR treasury administrators."
    );

    setNote(
      dashboardEls.withdrawLiquidityNote,
      "Withdraw actions are restricted to authorized ALBUKHR treasury administrators."
    );
  }

  /* -----------------------------------------
     PROJECT UPDATES CONTROLS
  ----------------------------------------- */
  setInputState(
    dashboardEls.projectUpdateTitle,
    {
      visible:canUploadUpdate,
      disabled:!canUploadUpdate
    }
  );

  setInputState(
    dashboardEls.projectUpdateImage,
    {
      visible:canUploadUpdate,
      disabled:!canUploadUpdate
    }
  );

  setInputState(
    dashboardEls.projectUpdateText,
    {
      visible:canUploadUpdate,
      disabled:!canUploadUpdate
    }
  );

  setCardButtonState(
    dashboardEls.uploadProjectUpdateBtn,
    {
      visible:true,
      disabled:!canUploadUpdate,
      text:canUploadUpdate
        ? "Upload Update"
        : "Update Access Required"
    }
  );

  if(canUploadUpdate){
    setNote(
      dashboardEls.projectUpdatesNote,
      "This update will be published to the ALBUKHR Transparency feed."
    );
  }else{
    setNote(
      dashboardEls.projectUpdatesNote,
      "Publishing updates for this project is restricted to authorized project owners or ALBUKHR admins."
    );

    resetImagePreview();
  }

  if(
    projectType === "core" &&
    dashboardEls.projectStakeBox &&
    typeof renderProjectStakeUI !==
    "function"
  ){
    renderStakeFallback(
      "Stake panel is not available on this page."
    );
  }

  return {
    user,
    projectType,
    canManageTreasury,
    canUploadUpdate
  };
}

/* =========================================
   RENDER DASHBOARD
========================================= */
async function renderDashboard(){
  if(dashboardBusy) return;

  dashboardBusy = true;

  try{
    if(dashboardEls.history){
      dashboardEls.history.className =
        "loading";

      dashboardEls.history.innerHTML =
        "Loading treasury history...";
    }

    const project =
      await resolveCurrentProject();

    if(!project){
      if(dashboardEls.history){
        dashboardEls.history.className =
          "error-box";

        dashboardEls.history.innerHTML =
          "Project could not be resolved.";
      }

      return;
    }

    const currentNetwork =
      getDashboardNetwork();

    const projectNetwork =
      normalizeNetwork(
        project.network
      );

    if(
      projectNetwork &&
      projectNetwork !== currentNetwork
    ){
      throw new Error(
        `Project network mismatch: expected ${currentNetwork}, received ${projectNetwork}.`
      );
    }

    currentProject = project;
    currentProjectNetwork =
      projectNetwork || currentNetwork;

    renderProjectHeader(
      project
    );

    const permissionState =
      await applyDashboardSectionPermissions(
        project
      );

    const [
      treasuryStatus,
      roi,
      investors,
      history
    ] = await Promise.all([
      getProjectTreasurySummary(
        project
      ),

      getProjectROI(
        project.project_code,
        project
      ),

      getProjectInvestorCount(
        project.project_code
      ),

      getTreasuryHistory(
        project.project_code
      )
    ]);

    renderProjectStats({
      treasuryStatus,
      roi,
      investors
    });

    renderHistory(
      history
    );

    /* -----------------------------------------
       Stake UI
       Preserve existing engine integration.
    ----------------------------------------- */
    if(
      typeof renderProjectStakeUI ===
      "function"
    ){
      Promise.resolve(
        renderProjectStakeUI(
          project.project_code,
          getCurrentUpdateMeta().email
        )
      ).catch(e => {
        console.warn(
          "renderProjectStakeUI warning:",
          e
        );

        renderStakeFallback(
          "Stake panel could not be loaded for this project."
        );
      });
    }else{
      renderStakeFallback(
        "Stake panel is not available on this page."
      );
    }

    const typeLabel =
      formatProjectType(
        permissionState.projectType
      );

    const treasuryLabel =
      permissionState.canManageTreasury
        ? "Treasury enabled"
        : "Treasury read-only";

    const updateLabel =
      permissionState.canUploadUpdate
        ? "Updates enabled"
        : "Updates read-only";

    dashboardEls.projectMetaLine.innerHTML = `
      Code: <strong>${escapeHtml(
        project.project_code || "-"
      )}</strong> •
      Type: <strong>${escapeHtml(
        typeLabel
      )}</strong> •
      Network: <strong>${escapeHtml(
        currentProjectNetwork
      )}</strong> •
      ${escapeHtml(treasuryLabel)} •
      ${escapeHtml(updateLabel)}
    `;

  }catch(err){
    console.error(
      "Dashboard render error:",
      err
    );

    if(dashboardEls.projectName){
      dashboardEls.projectName.textContent =
        "Project load failed";
    }

    if(dashboardEls.projectMetaLine){
      dashboardEls.projectMetaLine.textContent =
        err?.message ||
        "Unknown error";
    }

    if(dashboardEls.history){
      dashboardEls.history.className =
        "error-box";

      dashboardEls.history.innerHTML = `
        Failed to load project dashboard.<br>
        <span class="muted">
          ${escapeHtml(
            err?.message ||
            "Unknown error"
          )}
        </span>
      `;
    }
  }finally{
    dashboardBusy = false;
  }
}

/* =========================================
   VERIFY PROJECT BEFORE MUTATION
========================================= */
function ensureCurrentProjectNetwork(){
  if(!currentProject){
    showDashboardAlert(
      "Project missing",
      "Project not loaded yet."
    );

    return false;
  }

  const currentNetwork =
    getDashboardNetwork();

  const projectNetwork =
    normalizeNetwork(
      currentProject.network
    );

  if(
    projectNetwork &&
    projectNetwork !== currentNetwork
  ){
    showDashboardAlert(
      "Network mismatch",
      "This project does not belong to the current ALBUKHR network."
    );

    return false;
  }

  return true;
}

/* =========================================
   ADD LIQUIDITY
========================================= */
async function addLiquidityAction(){
  if(!ensureCurrentProjectNetwork()){
    return;
  }

  if(
    typeof canManageAlbukhrProjectTreasury ===
    "function"
  ){
    const allowed =
      await canManageAlbukhrProjectTreasury(
        currentProject
      );

    if(!allowed){
      showDashboardAlert(
        "Access denied",
        "You do not have permission to manage this project's treasury."
      );

      return;
    }
  }

  const amount =
    safeNumber(
      dashboardEls.addAmount?.value,
      0
    );

  if(amount <= 0){
    showDashboardAlert(
      "Invalid amount",
      "Enter a valid liquidity amount."
    );

    return;
  }

  if(
    typeof safeAddProjectLiquidity !==
    "function"
  ){
    showDashboardAlert(
      "Engine missing",
      "safeAddProjectLiquidity() is not available."
    );

    return;
  }

  try{
    const actorMeta = {
      ...getCurrentAdminMeta(),

      note:
        "Manual liquidity add from project dashboard",

      meta:{
        source:
          "project_dashboard_add_liquidity",

        network:
          currentProjectNetwork,

        project_code:
          currentProject.project_code
      }
    };

    const result =
      await safeAddProjectLiquidity(
        currentProject.project_code,
        amount,
        actorMeta
      );

    if(result?.error){
      throw new Error(
        result.error
      );
    }

    if(dashboardEls.addAmount){
      dashboardEls.addAmount.value = "";
    }

    showDashboardAlert(
      "Success",
      "Liquidity added successfully."
    );

    await renderDashboard();

  }catch(err){
    console.error(
      "Add liquidity error:",
      err
    );

    showDashboardAlert(
      "Add Liquidity Failed",
      err?.message ||
      "Failed to add liquidity."
    );
  }
}

/* =========================================
   WITHDRAW LIQUIDITY
========================================= */
async function withdrawLiquidityAction(){
  if(!ensureCurrentProjectNetwork()){
    return;
  }

  if(
    typeof canManageAlbukhrProjectTreasury ===
    "function"
  ){
    const allowed =
      await canManageAlbukhrProjectTreasury(
        currentProject
      );

    if(!allowed){
      showDashboardAlert(
        "Access denied",
        "You do not have permission to withdraw treasury funds from this project."
      );

      return;
    }
  }

  const amount =
    safeNumber(
      dashboardEls.withdrawAmount?.value,
      0
    );

  if(amount <= 0){
    showDashboardAlert(
      "Invalid amount",
      "Enter a valid withdraw amount."
    );

    return;
  }

  if(
    typeof safeProjectInternalWithdraw !==
    "function"
  ){
    showDashboardAlert(
      "Engine missing",
      "safeProjectInternalWithdraw() is not available."
    );

    return;
  }

  try{
    const actorMeta = {
      ...getCurrentAdminMeta(),

      note:
        "Manual internal withdraw from project dashboard",

      meta:{
        source:
          "project_dashboard_internal_withdraw",

        network:
          currentProjectNetwork,

        project_code:
          currentProject.project_code
      }
    };

    const result =
      await safeProjectInternalWithdraw(
        currentProject.project_code,
        amount,
        actorMeta
      );

    if(result?.error){
      throw new Error(
        result.error
      );
    }

    if(dashboardEls.withdrawAmount){
      dashboardEls.withdrawAmount.value = "";
    }

    showDashboardAlert(
      "Success",
      "Liquidity withdrawn successfully."
    );

    await renderDashboard();

  }catch(err){
    console.error(
      "Withdraw liquidity error:",
      err
    );

    showDashboardAlert(
      "Withdraw Failed",
      err?.message ||
      "Failed to withdraw liquidity."
    );
  }
}

/* =========================================
   VALIDATE UPDATE IMAGE
========================================= */
function validateUpdateImage(file){
  if(!file){
    return {
      ok:false,
      message:
        "Please select an update image first."
    };
  }

  if(
    !safeString(
      file.type
    ).startsWith("image/")
  ){
    return {
      ok:false,
      message:
        "Please select a valid image file."
    };
  }

  const maxSize =
    10 * 1024 * 1024;

  if(file.size > maxSize){
    return {
      ok:false,
      message:
        "Image is too large. Please use an image below 10MB."
    };
  }

  return {
    ok:true
  };
}

/* =========================================
   PROJECT UPDATE -> SUPABASE
========================================= */
async function uploadProjectUpdate(){
  if(uploadBusy) return;

  if(!ensureCurrentProjectNetwork()){
    return;
  }

  if(
    typeof canUploadAlbukhrProjectUpdate ===
    "function"
  ){
    const allowed =
      await canUploadAlbukhrProjectUpdate(
        currentProject
      );

    if(!allowed){
      showDashboardAlert(
        "Access denied",
        "You do not have permission to publish updates for this project."
      );

      return;
    }
  }

  if(
    typeof uploadProjectUpdateToSupabase !==
    "function"
  ){
    showDashboardAlert(
      "Project updates engine missing",
      "uploadProjectUpdateToSupabase() is not available. Make sure js/project-updates.js is loaded."
    );

    return;
  }

  const title =
    safeString(
      dashboardEls.projectUpdateTitle?.value
    ).trim();

  const description =
    safeString(
      dashboardEls.projectUpdateText?.value
    ).trim();

  const imageFile =
    dashboardEls.projectUpdateImage?.files?.[0] ||
    null;

  if(!description){
    showDashboardAlert(
      "Description required",
      "Please write the project update description first."
    );

    return;
  }

  const imageCheck =
    validateUpdateImage(
      imageFile
    );

  if(!imageCheck.ok){
    showDashboardAlert(
      "Image required",
      imageCheck.message
    );

    return;
  }

  const actor =
    getCurrentUpdateMeta();

  uploadBusy = true;

  if(
    dashboardEls.uploadProjectUpdateBtn
  ){
    dashboardEls.uploadProjectUpdateBtn.disabled =
      true;

    dashboardEls.uploadProjectUpdateBtn.textContent =
      "Uploading...";
  }

  try{
    const result =
      await uploadProjectUpdateToSupabase({
        projectCode:
          currentProject.project_code,

        projectName:
          currentProject.project_name ||
          currentProject.project_code,

        projectType:
          currentProject.project_type ||
          "internal",

        network:
          currentProjectNetwork,

        title,
        description,
        file:imageFile,

        createdByEmail:
          actor.email,

        createdByName:
          actor.name,

        createdByRole:
          actor.role
      });

    if(result?.error){
      throw new Error(
        result.error
      );
    }

    if(
      dashboardEls.projectUpdateTitle
    ){
      dashboardEls.projectUpdateTitle.value =
        "";
    }

    if(
      dashboardEls.projectUpdateText
    ){
      dashboardEls.projectUpdateText.value =
        "";
    }

    if(
      dashboardEls.projectUpdateImage
    ){
      dashboardEls.projectUpdateImage.value =
        "";
    }

    resetImagePreview();

    showDashboardAlert(
      "Update uploaded",
      "Project update was published successfully to Transparency."
    );

    window.dispatchEvent(
      new CustomEvent(
        "projectFeedUpdated",
        {
          detail:{
            project_code:
              currentProject.project_code,

            network:
              currentProjectNetwork
          }
        }
      )
    );

  }catch(err){
    console.error(
      "Project update upload error:",
      err
    );

    showDashboardAlert(
      "Upload failed",
      err?.message ||
      "Failed to upload project update."
    );

  }finally{
    uploadBusy = false;

    if(
      dashboardEls.uploadProjectUpdateBtn
    ){
      dashboardEls.uploadProjectUpdateBtn.disabled =
        false;

      dashboardEls.uploadProjectUpdateBtn.textContent =
        "Upload Update";
    }
  }
}

/* =========================================
   BIND ACTIONS
========================================= */
function bindDashboardActions(){
  if(dashboardEventsBound){
    return;
  }

  dashboardEventsBound = true;

  if(
    dashboardEls.addLiquidityBtn
  ){
    dashboardEls.addLiquidityBtn.addEventListener(
      "click",
      addLiquidityAction
    );
  }

  if(
    dashboardEls.withdrawLiquidityBtn
  ){
    dashboardEls.withdrawLiquidityBtn.addEventListener(
      "click",
      withdrawLiquidityAction
    );
  }

  if(
    dashboardEls.uploadProjectUpdateBtn
  ){
    dashboardEls.uploadProjectUpdateBtn.addEventListener(
      "click",
      uploadProjectUpdate
    );
  }

  if(
    dashboardEls.projectUpdateImage
  ){
    dashboardEls.projectUpdateImage.addEventListener(
      "change",
      function(){
        const file =
          this.files &&
          this.files[0]
            ? this.files[0]
            : null;

        previewSelectedImage(file);
      }
    );
  }
}

/* =========================================
   NETWORK CHANGE SUPPORT
   If environment switcher dispatches a network
   event, clear project state and reload.
========================================= */
window.addEventListener(
  "albukhrNetworkChanged",
  async function(){
    currentProject = null;
    currentProjectNetwork = null;

    try{
      if(
        typeof refreshProjectsCache ===
        "function"
      ){
        await refreshProjectsCache({
          network:getDashboardNetwork()
        });
      }
    }catch(e){
      console.warn(
        "Dashboard project cache refresh warning:",
        e
      );
    }

    await renderDashboard();
  }
);

/* =========================================
   START
========================================= */
document.addEventListener(
  "DOMContentLoaded",
  async function(){

    if(!guardAdmin()){
      return;
    }

    if(
      typeof loadProjects ===
      "function"
    ){
      try{
        await loadProjects(
          true,
          {
            network:
              getDashboardNetwork()
          }
        );
      }catch(e){
        console.warn(
          "Projects preload warning:",
          e
        );
      }
    }

    bindDashboardActions();

    await renderDashboard();

    setInterval(
      async () => {
        await renderDashboard();
      },
      90000
    );
  }
);
