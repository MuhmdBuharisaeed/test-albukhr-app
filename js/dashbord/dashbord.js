    /* =========================================
       ALBUKHR UNIVERSAL PROJECT DASHBOARD FINAL
       - Single dashboard
       - Internal / External / Core compatible
       - Resolver-aware
       - Permission-gated actions
       - Supabase project updates compatible
    ========================================= */

    const dashboardEls = {
      projectName: document.getElementById("projectName"),
      projectMetaLine: document.getElementById("projectMetaLine"),
      projectBadges: document.getElementById("projectBadges"),

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
    let dashboardBusy = false;
    let uploadBusy = false;

    /* =========================================
       HELPERS
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
        console.warn("Resolver getCurrentAlbukhrUser warning:", e);
    }

    return {
        email: localStorage.getItem("albukhr_current_email") || "",
        userid: localStorage.getItem("albukhr_current_email") || "",
        username: localStorage.getItem("albukhr_current_username") || "ALBUKHR Admin",
        role: localStorage.getItem("albukhr_current_role") || "project_admin",
        isAdmin: true
    };
    }

    function resetImagePreview(){
      dashboardEls.updateImagePreviewBox.style.display = "none";
      dashboardEls.updateImagePreview.src = "";
      dashboardEls.updateImagePreviewMeta.textContent = "";
    }

    function previewSelectedImage(file){
      if(!file){
        resetImagePreview();
        return;
      }

      const reader = new FileReader();
      reader.onload = function(e){
        dashboardEls.updateImagePreview.src = e.target.result;
        dashboardEls.updateImagePreviewMeta.textContent =
          `${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB`;
        dashboardEls.updateImagePreviewBox.style.display = "block";
      };
      reader.readAsDataURL(file);
    }

    function setCardButtonState(buttonEl, {
      visible = true,
      disabled = false,
      text = ""
    } = {}){
      if(!buttonEl) return;
      buttonEl.style.display = visible ? "" : "none";
      buttonEl.disabled = !!disabled;
      if(text){
        buttonEl.textContent = text;
      }
    }

    function setInputState(inputEl, {
      visible = true,
      disabled = false
    } = {}){
      if(!inputEl) return;
      inputEl.style.display = visible ? "" : "none";
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

    function getProjectTypeFromResolver(project){
      try{
        if(typeof getAlbukhrProjectType === "function"){
          return getAlbukhrProjectType(project);
        }
      }catch(e){
        console.warn("getAlbukhrProjectType warning:", e);
      }

      return safeString(project?.project_type).trim().toLowerCase() || "unknown";
    }

    /* =========================================
       ADMIN GUARD
       NOTE:
       dashboard page remains admin-side for now.
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

      if(typeof getAdmin === "function" && !getAdmin()){
        window.location.href = "admin-login.html";
        return false;
      }

      return true;
    }


    /* =========================================
       RESOLVE CURRENT PROJECT
       - normalize storage first
       - use resolver as primary truth
       - fallback to getProjectMeta only if needed
    ========================================= */
    async function resolveCurrentProject(){
      let resolved = null;
      let projectRef = "";

      try{
        if(typeof normalizeAlbukhrCurrentProjectStorage === "function"){
          await normalizeAlbukhrCurrentProjectStorage();
        }
      }catch(e){
        console.warn("normalizeAlbukhrCurrentProjectStorage warning:", e);
      }

      try{
        if(typeof resolveAlbukhrCurrentProject === "function"){
          resolved = await resolveAlbukhrCurrentProject();
        }
      }catch(e){
        console.warn("resolveAlbukhrCurrentProject warning:", e);
      }

      if(resolved && resolved.project_code){
        projectRef = String(resolved.project_code).trim();
      }

      if(!projectRef){
        projectRef = String(
          localStorage.getItem("albukhr_current_project") || ""
        ).trim();
      }

      if(!projectRef){
        showDashboardAlert("Project missing", "No current project was found.");
        return null;
      }

      if(resolved && resolved.project_code){
        return resolved;
      }

      if(typeof getProjectMeta === "function"){
        const project = await getProjectMeta(projectRef);
        if(project){
          return project;
        }
      }

      showDashboardAlert("Project not found", `Project not found: ${projectRef}`);
      return null;
    }

    /* =========================================
       LOAD TREASURY STATUS
    ========================================= */
    async function getProjectTreasurySummary(project){
      const projectCode = project.project_code;

      if(typeof getProjectTreasuryStatus === "function"){
        const summary = await getProjectTreasuryStatus(projectCode);

        if(summary && !summary.error){
          return {
            project_code: projectCode,
            liquidity: safeNumber(summary.liquidity, 0),
            reserve: safeNumber(summary.reserve, 0),
            reserve_percent: safeNumber(
              summary.reserve_percent,
              project.reserve_percent ?? 0.30
            ),
            min_liquidity: safeNumber(
              summary.min_liquidity,
              project.min_liquidity ?? 100
            ),
            max_usable_liquidity: safeNumber(
              summary.max_usable_liquidity,
              0
            ),
            reward_rate: safeNumber(
              summary.reward_rate,
              project.reward_rate ?? 0
            )
          };
        }
      }

      return {
        project_code: projectCode,
        liquidity: 0,
        reserve: 0,
        reserve_percent: safeNumber(project.reserve_percent, 0.30),
        min_liquidity: safeNumber(project.min_liquidity, 100),
        max_usable_liquidity: 0,
        reward_rate: safeNumber(project.reward_rate, 0)
      };
    }

    /* =========================================
       LOAD ROI
    ========================================= */
    async function getProjectROI(projectCode, fallbackProject = null){
      try{
        if(typeof calculateProjectROI === "function"){
          const roi = await calculateProjectROI(projectCode);
          const n = Number(roi);
          if(Number.isFinite(n)) return n;
        }
      }catch(e){
        console.warn("calculateProjectROI warning:", e);
      }

      return safeNumber(fallbackProject?.roi, 0);
    }

    /* =========================================
       LOAD INVESTORS
    ========================================= */
    async function getProjectInvestorCount(projectCode){
      let allStakes = [];

      try{
        if(typeof getAllStakesMerged === "function"){
          const result = await getAllStakesMerged();
          if(Array.isArray(result)){
            allStakes = result;
          }
        }
      }catch(e){
        console.warn("getAllStakesMerged warning:", e);
      }

      const code = String(projectCode || "").trim().toLowerCase();

      return allStakes.filter(stake => {
        const stakeCode = String(
          stake?.project_code || stake?.project || ""
        ).trim().toLowerCase();

        return stakeCode === code;
      }).length;
    }

    /* =========================================
       LOAD HISTORY
    ========================================= */
    async function getTreasuryHistory(projectCode){
      try{
        if(typeof getProjectTreasuryHistory === "function"){
          const history = await getProjectTreasuryHistory(projectCode, 50);
          return Array.isArray(history) ? history : [];
        }
      }catch(e){
        console.warn("getProjectTreasuryHistory warning:", e);
      }

      return [];
    }

    /* =========================================
       RENDER HEADER
    ========================================= */
    function renderProjectHeader(project){
      const projectType = getProjectTypeFromResolver(project);
      const projectStatus = safeString(project.status || "active").toLowerCase();

      dashboardEls.projectName.textContent =
        project.project_name || project.project_code || "Unknown Project";

      dashboardEls.projectMetaLine.innerHTML = `
        Code: <strong>${escapeHtml(project.project_code || "-")}</strong> •
        Type: <strong>${escapeHtml(formatProjectType(projectType))}</strong>
      `;

      dashboardEls.projectBadges.innerHTML = `
        <span class="badge ${escapeHtml(getProjectTypeBadgeClass(projectType))}">
          ${escapeHtml(formatProjectType(projectType))}
        </span>

        <span class="badge ${escapeHtml(getProjectStatusBadgeClass(projectStatus))}">
          ${escapeHtml(formatProjectStatus(projectStatus))}
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
        formatPi(treasuryStatus.liquidity);

      dashboardEls.reserve.textContent =
        formatPi(treasuryStatus.reserve);

      dashboardEls.usableLiquidity.textContent =
        formatPi(treasuryStatus.max_usable_liquidity);

      dashboardEls.roi.textContent =
        `${safeNumber(roi, 0).toFixed(2)}%`;

      dashboardEls.investors.textContent =
        String(safeNumber(investors, 0));

      const state = computeLiquidityStatus(treasuryStatus);

      dashboardEls.liquidityStatus.textContent = state.label;
      dashboardEls.liquidityStatus.className =
        `big ${state.className}`;
    }

    /* =========================================
       RENDER HISTORY
    ========================================= */
    function renderHistory(history = []){
      if(!Array.isArray(history) || !history.length){
        dashboardEls.history.className = "empty";
        dashboardEls.history.innerHTML = "No treasury activity yet.";
        return;
      }

      const chunks = history.map(tx => {
        const txType = String(tx.tx_type || "transaction")
          .replace(/_/g, " ");

        const amount = safeNumber(tx.amount, 0);
        const note = tx.note || tx.tx_type || "Treasury transaction";
        const createdAt = tx.created_at
          ? new Date(tx.created_at).toLocaleString()
          : "—";

        return `
          <div class="tx">
            <div class="tx-left">
              <div><strong>${escapeHtml(txType)}</strong></div>
              <div class="muted">${escapeHtml(note)}</div>
              <div class="muted">${escapeHtml(createdAt)}</div>
            </div>

            <div class="tx-right">
              ${formatPi(amount)}
            </div>
          </div>
        `;
      });

      dashboardEls.history.className = "";
      dashboardEls.history.innerHTML = chunks.join("");
    }

    /* =========================================
       APPLY DASHBOARD SECTION PERMISSIONS
       - no hard-stop by project type
       - only gate actions
    ========================================= */
    async function applyDashboardSectionPermissions(project){
      const user = await getResolverCurrentUser();
      const projectType = getProjectTypeFromResolver(project);

      let canManageTreasury = false;
      let canUploadUpdate = false;

      try{
        if(typeof canManageAlbukhrProjectTreasury === "function"){
          canManageTreasury = !!canManageAlbukhrProjectTreasury(project, user);
        }
      }catch(e){
        console.warn("canManageAlbukhrProjectTreasury warning:", e);
      }

      try{
        if(typeof canUploadAlbukhrProjectUpdate === "function"){
          canUploadUpdate = !!canUploadAlbukhrProjectUpdate(project, user);
        }
      }catch(e){
        console.warn("canUploadAlbukhrProjectUpdate warning:", e);
      }

      /* Project updates heading */
      if(typeof getAlbukhrProjectUpdateTitle === "function"){
        try{
          dashboardEls.projectUpdatesHeading.textContent =
            getAlbukhrProjectUpdateTitle(project);
        }catch(e){
          dashboardEls.projectUpdatesHeading.textContent = "📸 Project Updates";
        }
      }else{
        dashboardEls.projectUpdatesHeading.textContent = "📸 Project Updates";
      }

      /* -----------------------------------------
         TREASURY CONTROLS
      ----------------------------------------- */
      setInputState(dashboardEls.addAmount, {
        visible: canManageTreasury,
        disabled: !canManageTreasury
      });

      setCardButtonState(dashboardEls.addLiquidityBtn, {
        visible: true,
        disabled: !canManageTreasury,
        text: canManageTreasury ? "Add Liquidity" : "Treasury Access Required"
      });

      setInputState(dashboardEls.withdrawAmount, {
        visible: canManageTreasury,
        disabled: !canManageTreasury
      });

      setCardButtonState(dashboardEls.withdrawLiquidityBtn, {
        visible: true,
        disabled: !canManageTreasury,
        text: canManageTreasury ? "Withdraw Liquidity" : "Treasury Access Required"
      });

      if(canManageTreasury){
        setNote(dashboardEls.addLiquidityNote, "");
        setNote(dashboardEls.withdrawLiquidityNote, "");
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
      setInputState(dashboardEls.projectUpdateTitle, {
        visible: canUploadUpdate,
        disabled: !canUploadUpdate
      });

      setInputState(dashboardEls.projectUpdateImage, {
        visible: canUploadUpdate,
        disabled: !canUploadUpdate
      });

      setInputState(dashboardEls.projectUpdateText, {
        visible: canUploadUpdate,
        disabled: !canUploadUpdate
      });

      setCardButtonState(dashboardEls.uploadProjectUpdateBtn, {
        visible: true,
        disabled: !canUploadUpdate,
        text: canUploadUpdate ? "Upload Update" : "Update Access Required"
      });

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

      /* Stake fallback note */
      if(projectType === "core"){
        renderStakeFallback("Core project stake panel will appear here when stake data is available.");
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
       - universal
       - no internal-only hard stop
    ========================================= */
    async function renderDashboard(){

      if(dashboardBusy) return;
      dashboardBusy = true;

      try{
        dashboardEls.history.className = "loading";
        dashboardEls.history.innerHTML = "Loading treasury history...";

        const project = await resolveCurrentProject();
        if(!project){
          dashboardEls.history.className = "error-box";
          dashboardEls.history.innerHTML = "Project could not be resolved.";
          return;
        }

        currentProject = project;

        renderProjectHeader(project);

          const permissionState =
    await applyDashboardSectionPermissions(project);

        const [treasuryStatus, roi, investors, history] = await Promise.all([
          getProjectTreasurySummary(project),
          getProjectROI(project.project_code, project),
          getProjectInvestorCount(project.project_code),
          getTreasuryHistory(project.project_code)
        ]);

        renderProjectStats({
          treasuryStatus,
          roi,
          investors
        });

        renderHistory(history);

        if(typeof renderProjectStakeUI === "function"){
          Promise.resolve(
            renderProjectStakeUI(
              project.project_code,
              localStorage.getItem("albukhr_current_email")
            )
          ).catch(e => {
            console.warn("renderProjectStakeUI warning:", e);
            renderStakeFallback("Stake panel could not be loaded for this project.");
          });
        }else{
          renderStakeFallback("Stake panel is not available on this page.");
        }

        const typeLabel = formatProjectType(permissionState.projectType);
        const treasuryLabel = permissionState.canManageTreasury
          ? "Treasury enabled"
          : "Treasury read-only";

        const updateLabel = permissionState.canUploadUpdate
          ? "Updates enabled"
          : "Updates read-only";

        dashboardEls.projectMetaLine.innerHTML = `
          Code: <strong>${escapeHtml(project.project_code || "-")}</strong> •
          Type: <strong>${escapeHtml(typeLabel)}</strong> •
          ${escapeHtml(treasuryLabel)} • ${escapeHtml(updateLabel)}
        `;

      }catch(err){
        console.error("Dashboard render error:", err);

        dashboardEls.projectName.textContent = "Project load failed";
        dashboardEls.projectMetaLine.textContent =
          err?.message || "Unknown error";

        dashboardEls.history.className = "error-box";
        dashboardEls.history.innerHTML = `
          Failed to load project dashboard.<br>
          <span class="muted">${escapeHtml(err?.message || "Unknown error")}</span>
        `;
      }finally{
        dashboardBusy = false;
      }
    }

    /* =========================================
   ADD LIQUIDITY
   -------------------------------------------------
   UNIVERSAL DASHBOARD PAYMENT GATE

   IMPORTANT:
   - Dashboard does NOT directly modify treasury.
   - Dashboard does NOT call safeAddProjectLiquidity()
     directly anymore.
   - Real Pi payment must be completed first.
   - The Pi Treasury Payment Adapter becomes the
     bridge between Pi Blockchain and Treasury Engine.

   REQUIRED NEXT ENGINE:
   js/pi-project-treasury-payment.js

   Expected adapter function:
   window.addProjectLiquidityWithPiPayment()
========================================= */
async function addLiquidityAction(){

  if(!currentProject){

    showDashboardAlert(
      "Project missing",
      "Project has not been loaded yet."
    );

    return;

  }


  /* =========================================
     TREASURY PERMISSION
  ========================================= */

  if(
    typeof canManageAlbukhrProjectTreasury === "function"
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


  /* =========================================
     READ AMOUNT
  ========================================= */

  const amount =
    safeNumber(
      dashboardEls.addAmount.value,
      0
    );


  if(amount <= 0){

    showDashboardAlert(
      "Invalid amount",
      "Enter a valid Pi liquidity amount."
    );

    return;

  }


  /* =========================================
     REAL PI PAYMENT ADAPTER REQUIRED
  ========================================= */

  if(
    typeof window.addProjectLiquidityWithPiPayment !==
    "function"
  ){

    console.error(
      "[UNIVERSAL DASHBOARD] Pi Treasury Payment Adapter is not loaded."
    );

    showDashboardAlert(
      "Pi Payment Engine Missing",
      "Real Pi payment processing is not available yet. No treasury balance was changed."
    );

    return;

  }


  /* =========================================
     BUTTON LOCK
  ========================================= */

  const button =
    dashboardEls.addLiquidityBtn;

  const originalText =
    button?.textContent ||
    "Add Liquidity";


  if(button){

    button.disabled = true;

    button.textContent =
      "Processing Pi Payment...";

  }


  try{

    /* =======================================
       ADMIN / PROJECT CONTEXT
       ---------------------------------------
       We deliberately do NOT call the
       treasury engine directly here.
    ======================================= */

    const paymentContext = {

      project_code:
        currentProject.project_code,

      project_name:
        currentProject.project_name ||
        currentProject.project_code,

      project_type:
        currentProject.project_type ||
        "core",

      amount,

      source:
        "universal_project_dashboard",

      action:
        "add_liquidity"

    };


    console.log(
      "[UNIVERSAL DASHBOARD] Starting real Pi liquidity payment:",
      paymentContext
    );


    /* =======================================
       START REAL PI PAYMENT FLOW

       The adapter will later handle:

       Pi SDK
          ↓
       paymentId
          ↓
       server /approve
          ↓
       blockchain
          ↓
       txid
          ↓
       treasury settlement
    ======================================= */

    const result =
      await window.addProjectLiquidityWithPiPayment(
        paymentContext
      );


    /* =======================================
       PAYMENT FAILURE
    ======================================= */

    if(
      !result ||
      result.success !== true
    ){

      throw new Error(
        result?.error ||
        "Pi liquidity payment failed."
      );

    }


    /* =======================================
       SUCCESS
    ======================================= */

    dashboardEls.addAmount.value = "";


    showDashboardAlert(
      "Liquidity Added",
      `Real Pi payment completed successfully.\n\n` +
      `Project: ${
        currentProject.project_name ||
        currentProject.project_code
      }\n` +
      `Amount: ${amount} Pi\n` +
      `TXID: ${result.txid || "Verified"}`
    );


    console.log(
      "✅ [UNIVERSAL DASHBOARD] Pi liquidity payment completed:",
      result
    );


    /* =======================================
       REFRESH TREASURY DISPLAY
    ======================================= */

    await renderDashboard();


  }catch(error){

    console.error(
      "[UNIVERSAL DASHBOARD] Add liquidity payment failed:",
      error
    );


    showDashboardAlert(
      "Add Liquidity Failed",
      error?.message ||
      "Real Pi payment could not be completed. No treasury balance was changed."
    );


  }finally{

    if(button){

      button.disabled = false;

      button.textContent =
        originalText;

    }

  }

      }

/* =========================================
   WITHDRAW LIQUIDITY
   -------------------------------------------------
   UNIVERSAL DASHBOARD PAYMENT GATE

   IMPORTANT:
   - Dashboard does NOT directly call
     safeProjectInternalWithdraw().
   - Dashboard does NOT reduce treasury first.
   - Smart Liquidity rules must pass first.
   - Real Pi blockchain payment must be completed.
   - Treasury settlement happens only after
     verified blockchain payment.

   REQUIRED NEXT ENGINE:
   js/pi-project-treasury-payment.js

   Expected adapter function:
   window.withdrawProjectLiquidityWithPiPayment()
========================================= */
async function withdrawLiquidityAction(){

  if(!currentProject){

    showDashboardAlert(
      "Project missing",
      "Project has not been loaded yet."
    );

    return;

  }


  /* =========================================
     TREASURY PERMISSION
  ========================================= */

  if(
    typeof canManageAlbukhrProjectTreasury === "function"
  ){

    const allowed =
      await canManageAlbukhrProjectTreasury(
        currentProject
      );

    if(!allowed){

      showDashboardAlert(
        "Access denied",
        "You do not have permission to withdraw funds from this project's treasury."
      );

      return;

    }

  }


  /* =========================================
     READ AMOUNT
  ========================================= */

  const amount =
    safeNumber(
      dashboardEls.withdrawAmount.value,
      0
    );


  if(amount <= 0){

    showDashboardAlert(
      "Invalid amount",
      "Enter a valid Pi withdrawal amount."
    );

    return;

  }


  /* =========================================
     PI WITHDRAWAL ADAPTER REQUIRED
  ========================================= */

  if(
    typeof window.withdrawProjectLiquidityWithPiPayment !==
    "function"
  ){

    console.error(
      "[UNIVERSAL DASHBOARD] Pi Treasury Withdrawal Adapter is not loaded."
    );

    showDashboardAlert(
      "Pi Withdrawal Engine Missing",
      "Real Pi withdrawal processing is not available yet. No treasury balance was changed."
    );

    return;

  }


  /* =========================================
     BUTTON LOCK
  ========================================= */

  const button =
    dashboardEls.withdrawLiquidityBtn;

  const originalText =
    button?.textContent ||
    "Withdraw Liquidity";


  if(button){

    button.disabled = true;

    button.textContent =
      "Processing Withdrawal...";

  }


  try{

    /* =======================================
       WITHDRAW CONTEXT

       The adapter will perform:

       Permission
          ↓
       Smart Liquidity
          ↓
       Withdrawal request
          ↓
       Approval
          ↓
       Pi server
          ↓
       Real blockchain payment
          ↓
       TXID
          ↓
       Treasury settlement
    ======================================= */

    const withdrawalContext = {

      project_code:
        currentProject.project_code,

      project_name:
        currentProject.project_name ||
        currentProject.project_code,

      project_type:
        currentProject.project_type ||
        "core",

      amount,

      source:
        "universal_project_dashboard",

      action:
        "withdraw_liquidity"

    };


    console.log(
      "[UNIVERSAL DASHBOARD] Starting real Pi withdrawal:",
      withdrawalContext
    );


    /* =======================================
       START REAL PI WITHDRAWAL FLOW
    ======================================= */

    const result =
      await window.withdrawProjectLiquidityWithPiPayment(
        withdrawalContext
      );


    /* =======================================
       WITHDRAWAL FAILURE
    ======================================= */

    if(
      !result ||
      result.success !== true
    ){

      throw new Error(
        result?.error ||
        "Pi withdrawal failed."
      );

    }


    /* =======================================
       SUCCESS
    ======================================= */

    dashboardEls.withdrawAmount.value = "";


    showDashboardAlert(
      "Withdrawal Completed",
      `Real Pi withdrawal completed successfully.\n\n` +
      `Project: ${
        currentProject.project_name ||
        currentProject.project_code
      }\n` +
      `Amount: ${amount} Pi\n` +
      `TXID: ${result.txid || "Verified"}`
    );


    console.log(
      "✅ [UNIVERSAL DASHBOARD] Pi withdrawal completed:",
      result
    );


    /* =======================================
       REFRESH TREASURY DISPLAY
    ======================================= */

    await renderDashboard();


  }catch(error){

    console.error(
      "[UNIVERSAL DASHBOARD] Pi withdrawal failed:",
      error
    );


    showDashboardAlert(
      "Withdrawal Failed",
      error?.message ||
      "Real Pi withdrawal could not be completed. No treasury balance was changed."
    );


  }finally{

    if(button){

      button.disabled = false;

      button.textContent =
        originalText;

    }

  }

}

    /* =========================================
       VALIDATE UPDATE IMAGE
    ========================================= */
    function validateUpdateImage(file){
      if(!file){
        return {
          ok:false,
          message:"Please select an update image first."
        };
      }

      if(!String(file.type || "").startsWith("image/")){
        return {
          ok:false,
          message:"Please select a valid image file."
        };
      }

      const maxSize = 10 * 1024 * 1024;
      if(file.size > maxSize){
        return {
          ok:false,
          message:"Image is too large. Please use an image below 10MB."
        };
      }

      return { ok:true };
    }

    /* =========================================
       PROJECT UPDATE -> SUPABASE
    ========================================= */
    async function uploadProjectUpdate(){

    alert("uploadProjectUpdate() started");

      if(uploadBusy) return;

      if(!currentProject){
        showDashboardAlert("Project missing", "Project not loaded yet.");
        return;
      }

      if(
    typeof canUploadAlbukhrProjectUpdate === "function" &&
    !(await canUploadAlbukhrProjectUpdate(currentProject))
){
    showDashboardAlert(
        "Access denied",
        "You do not have permission to publish updates for this project."
    );
    return;
      }

      if(typeof uploadProjectUpdateToSupabase !== "function"){
        showDashboardAlert(
          "Project updates engine missing",
          "uploadProjectUpdateToSupabase() is not available. Make sure js/project-updates.js is loaded."
        );
        return;
      }

      const title =
        safeString(dashboardEls.projectUpdateTitle.value).trim();

      const description =
        safeString(dashboardEls.projectUpdateText.value).trim();

      const imageFile =
        dashboardEls.projectUpdateImage.files[0] || null;

      if(!description){
        showDashboardAlert(
          "Description required",
          "Please write the project update description first."
        );
        return;
      }

      const imageCheck = validateUpdateImage(imageFile);
      if(!imageCheck.ok){
        showDashboardAlert("Image required", imageCheck.message);
        return;
      }

      const actor = getCurrentUpdateMeta();

      uploadBusy = true;
      dashboardEls.uploadProjectUpdateBtn.disabled = true;
      dashboardEls.uploadProjectUpdateBtn.textContent = "Uploading...";

      try{
        alert("Before uploadProjectUpdateToSupabase");

const result = await uploadProjectUpdateToSupabase({
    projectCode: currentProject.project_code,
    projectName: currentProject.project_name || currentProject.project_code,
    projectType: currentProject.project_type || "internal",
    title,
    description,
    file: imageFile,
    createdByEmail: actor.email,
    createdByName: actor.name,
    createdByRole: actor.role
});

alert("After uploadProjectUpdateToSupabase");

        if(result?.error){
          throw new Error(result.error);
        }

        dashboardEls.projectUpdateTitle.value = "";
        dashboardEls.projectUpdateText.value = "";
        dashboardEls.projectUpdateImage.value = "";
        resetImagePreview();

        showDashboardAlert(
          "Update uploaded",
          "Project update was published successfully to Transparency."
        );

      }catch(err){

    alert(
        "ERROR:\n\n" +
        (err?.message || JSON.stringify(err))
    );

    console.error("Project update upload error:", err);

    showDashboardAlert(
        "Upload failed",
        err?.message || "Failed to upload project update."
    );

}finally{
        uploadBusy = false;
        dashboardEls.uploadProjectUpdateBtn.disabled = false;
        dashboardEls.uploadProjectUpdateBtn.textContent = "Upload Update";
      }
    }

    /* =========================================
       BIND ACTIONS
    ========================================= */
    function bindDashboardActions(){
      dashboardEls.addLiquidityBtn.addEventListener("click", addLiquidityAction);
      dashboardEls.withdrawLiquidityBtn.addEventListener("click", withdrawLiquidityAction);
      dashboardEls.uploadProjectUpdateBtn.addEventListener("click", uploadProjectUpdate);

      dashboardEls.projectUpdateImage.addEventListener("change", function(){
        const file = this.files && this.files[0] ? this.files[0] : null;
        previewSelectedImage(file);
      });
    }

    /* =========================================
       START
    ========================================= */
    document.addEventListener("DOMContentLoaded", async function(){

      if(!guardAdmin()) return;

      if(typeof loadProjects === "function"){
        try{
          await loadProjects(true);
        }catch(e){
          console.warn("Projects preload warning:", e);
        }
      }

      bindDashboardActions();
      await renderDashboard();

      setInterval(async () => {
        await renderDashboard();
      }, 90000);
    });
