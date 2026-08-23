/* ==========================================
   ALBUKHR UNIVERSAL PROJECT DASHBOARD
   Version 4.0

   NEW ARCHITECTURE / SUPABASE MIGRATION

   PURPOSE:
   - One dashboard for Core / Internal / External projects
   - Project Resolver is the project-context authority
   - Admin Bootstrap is the authentication/identity authority
   - Permission engines gate treasury and update actions
   - Supabase remains the application source of truth
   - Pi payment adapters remain responsible for blockchain settlement

   IMPORTANT:
   - NO localStorage
   - NO sessionStorage
   - NO legacy getAdmin()
   - NO legacy current-user storage
   - NO second Supabase client
   - NO direct treasury mutation
   - NO authentication/sign-out logic
   - NO project-type hard stop
========================================== */

(function(window){

"use strict";

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
let refreshTimer = null;
let startupPromise = null;

const REFRESH_INTERVAL = 90000;
const DASHBOARD_ROLES = [
    "super_admin",
    "ecosystem_admin",
    "project_admin",
    "finance_admin"
];

function safeString(value, fallback = ""){
    if(value === null || value === undefined) return fallback;
    return String(value);
}

function safeNumber(value, fallback = 0){
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function formatPi(value){
    return `${safeNumber(value).toFixed(2)} Pi`;
}

function escapeHtml(text = ""){
    return safeString(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showDashboardAlert(title, message){
    if(typeof window.openAppAlert === "function"){
        window.openAppAlert(title, message);
        return;
    }
    window.alert(`${title}\n\n${message}`);
}

/* ==========================================
   ADMIN STATE
   Supabase Auth / Admin Bootstrap only
========================================== */

function getAdminState(){
    try{
        if(typeof window.getAdminState === "function"){
            return window.getAdminState() || {};
        }
    }catch(error){
        console.warn("[UNIVERSAL DASHBOARD] Admin state error:", error);
    }

    return {};
}

function getAdminMeta(){
    const state = getAdminState();
    const user = state.user || {};
    const profile = state.profile || {};

    return {
        userid: safeString(user.id),
        email: safeString(user.email),
        username: safeString(
            profile.username ||
            user.user_metadata?.username ||
            user.email ||
            "ALBUKHR Admin"
        ),
        role: safeString(state.role || profile.role_code),
        environment: safeString(state.environment),
        network: safeString(state.network)
    };
}

function adminReady(){
    const state = getAdminState();
    return !!(
        state.ready === true &&
        state.user?.id &&
        state.profile
    );
}

function adminRoleAllowed(){
    const meta = getAdminMeta();
    const role = meta.role.trim().toLowerCase();

    if(role === "super_admin") return true;
    return DASHBOARD_ROLES.includes(role);
}

async function ensureAdminReady(){
    if(typeof window.initializeAdmin === "function"){
        try{
            await window.initializeAdmin();
        }catch(error){
            console.error("[UNIVERSAL DASHBOARD] Admin bootstrap failed:", error);
        }
    }

    return adminReady();
}

/* ==========================================
   PROJECT RESOLUTION
   Resolver is the only current-project source
========================================== */

function getProjectType(project){
    try{
        if(typeof window.getAlbukhrProjectType === "function"){
            return window.getAlbukhrProjectType(project);
        }
    }catch(error){
        console.warn("[UNIVERSAL DASHBOARD] Project type resolver failed:", error);
    }

    return safeString(project?.project_type).trim().toLowerCase() || "unknown";
}

async function resolveCurrentProject(){
    if(typeof window.resolveAlbukhrCurrentProject !== "function"){
        throw new Error("ALBUKHR Project Resolver is not loaded.");
    }

    let project;

    try{
        project = await window.resolveAlbukhrCurrentProject();
    }catch(error){
        throw new Error(
            error?.message ||
            "Unable to resolve the current ALBUKHR project."
        );
    }

    if(!project?.project_code){
        throw new Error("No current ALBUKHR project could be resolved.");
    }

    return project;
}

/* ==========================================
   UI HELPERS
========================================== */

function setButton(button, visible, disabled, text){
    if(!button) return;
    button.style.display = visible ? "" : "none";
    button.disabled = !!disabled;
    if(text) button.textContent = text;
}

function setInput(input, visible, disabled){
    if(!input) return;
    input.style.display = visible ? "" : "none";
    input.disabled = !!disabled;
}

function setNote(element, text){
    if(!element) return;
    element.textContent = text || "";
    element.style.display = text ? "block" : "none";
}

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
    reader.onload = function(event){
        if(dashboardEls.updateImagePreview){
            dashboardEls.updateImagePreview.src = event.target.result;
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

function formatProjectType(type){
    const value = safeString(type).trim().toLowerCase();
    if(value === "core") return "Core";
    if(value === "internal") return "Internal";
    if(value === "external") return "External";
    return "Unknown";
}

function formatProjectStatus(status){
    const value = safeString(status).trim().toLowerCase();
    if(value === "active") return "Active";
    if(value === "inactive") return "Inactive";
    if(value === "archived") return "Archived";
    return value || "Unknown";
}

function projectTypeClass(type){
    const value = safeString(type).trim().toLowerCase();
    return ["core", "internal", "external"].includes(value) ? value : "internal";
}

function projectStatusClass(status){
    const value = safeString(status).trim().toLowerCase();
    return ["active", "inactive", "archived"].includes(value) ? value : "inactive";
}

/* ==========================================
   RENDER HEADER / STATS / HISTORY
========================================== */

function renderProjectHeader(project){
    const type = getProjectType(project);
    const status = safeString(project.status || "active").toLowerCase();

    if(dashboardEls.projectName){
        dashboardEls.projectName.textContent =
            project.project_name || project.project_code || "Unknown Project";
    }

    if(dashboardEls.projectMetaLine){
        dashboardEls.projectMetaLine.innerHTML =
            `Code: <strong>${escapeHtml(project.project_code || "-")}</strong> • ` +
            `Type: <strong>${escapeHtml(formatProjectType(type))}</strong>`;
    }

    if(dashboardEls.projectBadges){
        dashboardEls.projectBadges.innerHTML =
            `<span class="badge ${projectTypeClass(type)}">${escapeHtml(formatProjectType(type))}</span>` +
            `<span class="badge ${projectStatusClass(status)}">${escapeHtml(formatProjectStatus(status))}</span>`;
    }
}

function renderStats(status, roi, investors){
    if(dashboardEls.liquidity){
        dashboardEls.liquidity.textContent = formatPi(status.liquidity);
    }
    if(dashboardEls.reserve){
        dashboardEls.reserve.textContent = formatPi(status.reserve);
    }
    if(dashboardEls.usableLiquidity){
        dashboardEls.usableLiquidity.textContent = formatPi(status.max_usable_liquidity);
    }
    if(dashboardEls.roi){
        dashboardEls.roi.textContent = `${safeNumber(roi).toFixed(2)}%`;
    }
    if(dashboardEls.investors){
        dashboardEls.investors.textContent = String(safeNumber(investors));
    }

    const liquidity = safeNumber(status.liquidity);
    const minimum = safeNumber(status.min_liquidity, 100);
    const usable = safeNumber(status.max_usable_liquidity);
    let label = "STRONG";
    let className = "status-strong";

    if(liquidity < minimum){
        label = "LOW";
        className = "status-low";
    }else if(usable <= 0){
        label = "SAFE";
        className = "status-safe";
    }

    if(dashboardEls.liquidityStatus){
        dashboardEls.liquidityStatus.textContent = label;
        dashboardEls.liquidityStatus.className = `big ${className}`;
    }
}

function renderHistory(history){
    if(!dashboardEls.history) return;

    if(!Array.isArray(history) || !history.length){
        dashboardEls.history.className = "empty";
        dashboardEls.history.innerHTML = "No treasury activity yet.";
        return;
    }

    dashboardEls.history.className = "";
    dashboardEls.history.innerHTML = history.map(tx => {
        const txType = safeString(tx.tx_type || "transaction").replace(/_/g, " ");
        const amount = safeNumber(tx.amount);
        const note = tx.note || tx.tx_type || "Treasury transaction";
        const created = tx.created_at ? new Date(tx.created_at).toLocaleString() : "—";

        return `
            <div class="tx">
                <div class="tx-left">
                    <div><strong>${escapeHtml(txType)}</strong></div>
                    <div class="muted">${escapeHtml(note)}</div>
                    <div class="muted">${escapeHtml(created)}</div>
                </div>
                <div class="tx-right">${formatPi(amount)}</div>
            </div>
        `;
    }).join("");
}

/* ==========================================
   DATA LOADERS
========================================== */

async function getTreasurySummary(project){
    if(typeof window.getProjectTreasuryStatus === "function"){
        const summary = await window.getProjectTreasuryStatus(project.project_code);
        if(summary && !summary.error){
            return {
                project_code: project.project_code,
                liquidity: safeNumber(summary.liquidity),
                reserve: safeNumber(summary.reserve),
                reserve_percent: safeNumber(summary.reserve_percent, project.reserve_percent ?? 0.30),
                min_liquidity: safeNumber(summary.min_liquidity, project.min_liquidity ?? 100),
                max_usable_liquidity: safeNumber(summary.max_usable_liquidity),
                reward_rate: safeNumber(summary.reward_rate, project.reward_rate ?? 0)
            };
        }
    }

    return {
        project_code: project.project_code,
        liquidity: 0,
        reserve: 0,
        reserve_percent: safeNumber(project.reserve_percent, 0.30),
        min_liquidity: safeNumber(project.min_liquidity, 100),
        max_usable_liquidity: 0,
        reward_rate: safeNumber(project.reward_rate)
    };
}

async function getROI(project){
    try{
        if(typeof window.calculateProjectROI === "function"){
            const result = await window.calculateProjectROI(project.project_code);
            if(Number.isFinite(Number(result))) return Number(result);
        }
    }catch(error){
        console.warn("[UNIVERSAL DASHBOARD] ROI failed:", error);
    }
    return safeNumber(project.roi);
}

async function getInvestorCount(projectCode){
    try{
        if(typeof window.getAllStakesMerged === "function"){
            const stakes = await window.getAllStakesMerged();
            if(Array.isArray(stakes)){
                const code = safeString(projectCode).trim().toLowerCase();
                return stakes.filter(stake =>
                    safeString(stake?.project_code || stake?.project)
                        .trim().toLowerCase() === code
                ).length;
            }
        }
    }catch(error){
        console.warn("[UNIVERSAL DASHBOARD] Investor count failed:", error);
    }
    return 0;
}

async function getTreasuryHistory(projectCode){
    try{
        if(typeof window.getProjectTreasuryHistory === "function"){
            const result = await window.getProjectTreasuryHistory(projectCode, 50);
            return Array.isArray(result) ? result : [];
        }
    }catch(error){
        console.warn("[UNIVERSAL DASHBOARD] Treasury history failed:", error);
    }
    return [];
}

/* ==========================================
   RESOURCE PERMISSIONS
========================================== */

async function canManageTreasury(project){
    const state = getAdminState();
    if(!state.ready || !state.user?.id) return false;
    if(safeString(state.role).toLowerCase() === "super_admin") return true;

    if(typeof window.canManageAlbukhrProjectTreasury !== "function") return false;

    try{
        return !!await window.canManageAlbukhrProjectTreasury(project, state.user);
    }catch(error){
        console.warn("[UNIVERSAL DASHBOARD] Treasury permission failed:", error);
        return false;
    }
}

async function canUploadUpdate(project){
    const state = getAdminState();
    if(!state.ready || !state.user?.id) return false;
    if(safeString(state.role).toLowerCase() === "super_admin") return true;

    if(typeof window.canUploadAlbukhrProjectUpdate !== "function") return false;

    try{
        return !!await window.canUploadAlbukhrProjectUpdate(project, state.user);
    }catch(error){
        console.warn("[UNIVERSAL DASHBOARD] Update permission failed:", error);
        return false;
    }
}

async function applyPermissions(project){
    const treasuryAllowed = await canManageTreasury(project);
    const updateAllowed = await canUploadUpdate(project);

    if(dashboardEls.projectUpdatesHeading){
        if(typeof window.getAlbukhrProjectUpdateTitle === "function"){
            try{
                dashboardEls.projectUpdatesHeading.textContent =
                    window.getAlbukhrProjectUpdateTitle(project);
            }catch(e){
                dashboardEls.projectUpdatesHeading.textContent = "📸 Project Updates";
            }
        }else{
            dashboardEls.projectUpdatesHeading.textContent = "📸 Project Updates";
        }
    }

    setInput(dashboardEls.addAmount, true, !treasuryAllowed);
    setButton(
        dashboardEls.addLiquidityBtn,
        true,
        !treasuryAllowed,
        treasuryAllowed ? "Add Liquidity" : "Treasury Access Required"
    );
    setInput(dashboardEls.withdrawAmount, true, !treasuryAllowed);
    setButton(
        dashboardEls.withdrawLiquidityBtn,
        true,
        !treasuryAllowed,
        treasuryAllowed ? "Withdraw Liquidity" : "Treasury Access Required"
    );

    setNote(
        dashboardEls.addLiquidityNote,
        treasuryAllowed ? "" :
            "Treasury actions are restricted to authorized ALBUKHR treasury administrators."
    );
    setNote(
        dashboardEls.withdrawLiquidityNote,
        treasuryAllowed ? "" :
            "Withdraw actions are restricted to authorized ALBUKHR treasury administrators."
    );

    setInput(dashboardEls.projectUpdateTitle, true, !updateAllowed);
    setInput(dashboardEls.projectUpdateImage, true, !updateAllowed);
    setInput(dashboardEls.projectUpdateText, true, !updateAllowed);
    setButton(
        dashboardEls.uploadProjectUpdateBtn,
        true,
        !updateAllowed,
        updateAllowed ? "Upload Update" : "Update Access Required"
    );

    setNote(
        dashboardEls.projectUpdatesNote,
        updateAllowed
            ? "This update will be published to the ALBUKHR Transparency feed."
            : "Publishing updates for this project is restricted to authorized project owners or ALBUKHR admins."
    );

    if(!updateAllowed) resetImagePreview();

    return {
        projectType: getProjectType(project),
        canManageTreasury: treasuryAllowed,
        canUploadUpdate: updateAllowed,
        admin: getAdminMeta()
    };
}

/* ==========================================
   MAIN RENDER
========================================== */

async function renderDashboard(){
    if(dashboardBusy) return false;
    dashboardBusy = true;

    try{
        if(dashboardEls.history){
            dashboardEls.history.className = "loading";
            dashboardEls.history.innerHTML = "Loading treasury history...";
        }

        const project = await resolveCurrentProject();
        currentProject = project;
        renderProjectHeader(project);

        const permissionState = await applyPermissions(project);

        const [treasury, roi, investors, history] = await Promise.all([
            getTreasurySummary(project),
            getROI(project),
            getInvestorCount(project.project_code),
            getTreasuryHistory(project.project_code)
        ]);

        renderStats(treasury, roi, investors);
        renderHistory(history);

        if(typeof window.renderProjectStakeUI === "function"){
            const meta = getAdminMeta();
            Promise.resolve(
                window.renderProjectStakeUI(project.project_code, meta.email)
            ).catch(error => {
                console.warn("[UNIVERSAL DASHBOARD] Stake UI failed:", error);
                if(dashboardEls.projectStakeBox){
                    dashboardEls.projectStakeBox.innerHTML =
                        '<div class="muted">Stake panel could not be loaded for this project.</div>';
                }
            });
        }else if(dashboardEls.projectStakeBox){
            dashboardEls.projectStakeBox.innerHTML =
                '<div class="muted">Stake panel is not available on this page.</div>';
        }

        if(dashboardEls.projectMetaLine){
            dashboardEls.projectMetaLine.innerHTML =
                `Code: <strong>${escapeHtml(project.project_code || "-")}</strong> • ` +
                `Type: <strong>${escapeHtml(formatProjectType(permissionState.projectType))}</strong> • ` +
                `${permissionState.canManageTreasury ? "Treasury enabled" : "Treasury read-only"} • ` +
                `${permissionState.canUploadUpdate ? "Updates enabled" : "Updates read-only"}`;
        }

        return true;
    }catch(error){
        console.error("[UNIVERSAL DASHBOARD] Render failed:", error);

        if(dashboardEls.projectName){
            dashboardEls.projectName.textContent = "Project load failed";
        }
        if(dashboardEls.projectMetaLine){
            dashboardEls.projectMetaLine.textContent =
                error?.message || "Unknown error";
        }
        if(dashboardEls.history){
            dashboardEls.history.className = "error-box";
            dashboardEls.history.innerHTML =
                `Failed to load project dashboard.<br><span class="muted">${escapeHtml(error?.message || "Unknown error")}</span>`;
        }
        return false;
    }finally{
        dashboardBusy = false;
    }
}

/* ==========================================
   TREASURY ACTIONS
========================================== */

async function addLiquidityAction(){
    if(!currentProject){
        showDashboardAlert("Project missing", "Project has not been loaded yet.");
        return;
    }

    if(!(await canManageTreasury(currentProject))){
        showDashboardAlert("Access denied", "You do not have permission to manage this project's treasury.");
        return;
    }

    const amount = safeNumber(dashboardEls.addAmount?.value);
    if(amount <= 0){
        showDashboardAlert("Invalid amount", "Enter a valid Pi liquidity amount.");
        return;
    }

    if(typeof window.addProjectLiquidityWithPiPayment !== "function"){
        showDashboardAlert(
            "Pi Payment Engine Missing",
            "Real Pi payment processing is not available yet. No treasury balance was changed."
        );
        return;
    }

    const button = dashboardEls.addLiquidityBtn;
    const original = button?.textContent || "Add Liquidity";
    if(button){
        button.disabled = true;
        button.textContent = "Processing Pi Payment...";
    }

    try{
        const admin = getAdminMeta();
        const result = await window.addProjectLiquidityWithPiPayment({
            project_code: currentProject.project_code,
            project_name: currentProject.project_name || currentProject.project_code,
            project_type: currentProject.project_type || getProjectType(currentProject),
            amount,
            source: "universal_project_dashboard",
            action: "add_liquidity",
            actor_userid: admin.userid,
            actor_email: admin.email,
            actor_role: admin.role,
            environment: admin.environment,
            network: admin.network
        });

        if(!result || result.success !== true){
            throw new Error(result?.error || "Pi liquidity payment failed.");
        }

        if(dashboardEls.addAmount) dashboardEls.addAmount.value = "";

        showDashboardAlert(
            "Liquidity Added",
            `Real Pi payment completed successfully.\n\nProject: ${currentProject.project_name || currentProject.project_code}\nAmount: ${amount} Pi\nTXID: ${result.txid || "Verified"}`
        );

        await renderDashboard();
    }catch(error){
        console.error("[UNIVERSAL DASHBOARD] Add liquidity failed:", error);
        showDashboardAlert(
            "Add Liquidity Failed",
            error?.message || "Real Pi payment could not be completed. No treasury balance was changed."
        );
    }finally{
        if(button){
            button.disabled = false;
            button.textContent = original;
        }
    }
}

async function withdrawLiquidityAction(){
    if(!currentProject){
        showDashboardAlert("Project missing", "Project has not been loaded yet.");
        return;
    }

    if(!(await canManageTreasury(currentProject))){
        showDashboardAlert("Access denied", "You do not have permission to withdraw funds from this project's treasury.");
        return;
    }

    const amount = safeNumber(dashboardEls.withdrawAmount?.value);
    if(amount <= 0){
        showDashboardAlert("Invalid amount", "Enter a valid Pi withdrawal amount.");
        return;
    }

    if(typeof window.withdrawProjectLiquidityWithPiPayment !== "function"){
        showDashboardAlert(
            "Pi Withdrawal Engine Missing",
            "Real Pi withdrawal processing is not available yet. No treasury balance was changed."
        );
        return;
    }

    const button = dashboardEls.withdrawLiquidityBtn;
    const original = button?.textContent || "Withdraw Liquidity";
    if(button){
        button.disabled = true;
        button.textContent = "Processing Withdrawal...";
    }

    try{
        const admin = getAdminMeta();
        const result = await window.withdrawProjectLiquidityWithPiPayment({
            project_code: currentProject.project_code,
            project_name: currentProject.project_name || currentProject.project_code,
            project_type: currentProject.project_type || getProjectType(currentProject),
            amount,
            source: "universal_project_dashboard",
            action: "withdraw_liquidity",
            actor_userid: admin.userid,
            actor_email: admin.email,
            actor_role: admin.role,
            environment: admin.environment,
            network: admin.network
        });

        if(!result || result.success !== true){
            throw new Error(result?.error || "Pi withdrawal failed.");
        }

        if(dashboardEls.withdrawAmount) dashboardEls.withdrawAmount.value = "";

        showDashboardAlert(
            "Withdrawal Completed",
            `Real Pi withdrawal completed successfully.\n\nProject: ${currentProject.project_name || currentProject.project_code}\nAmount: ${amount} Pi\nTXID: ${result.txid || "Verified"}`
        );

        await renderDashboard();
    }catch(error){
        console.error("[UNIVERSAL DASHBOARD] Withdrawal failed:", error);
        showDashboardAlert(
            "Withdrawal Failed",
            error?.message || "Real Pi withdrawal could not be completed. No treasury balance was changed."
        );
    }finally{
        if(button){
            button.disabled = false;
            button.textContent = original;
        }
    }
}

/* ==========================================
   PROJECT UPDATES
========================================== */

function validateUpdateImage(file){
    if(!file) return { ok:false, message:"Please select an update image first." };
    if(!safeString(file.type).startsWith("image/")){
        return { ok:false, message:"Please select a valid image file." };
    }
    if(file.size > 10 * 1024 * 1024){
        return { ok:false, message:"Image is too large. Please use an image below 10MB." };
    }
    return { ok:true };
}

async function uploadProjectUpdate(){
    if(uploadBusy) return;

    if(!currentProject){
        showDashboardAlert("Project missing", "Project not loaded yet.");
        return;
    }

    if(!(await canUploadUpdate(currentProject))){
        showDashboardAlert("Access denied", "You do not have permission to publish updates for this project.");
        return;
    }

    if(typeof window.uploadProjectUpdateToSupabase !== "function"){
        showDashboardAlert(
            "Project updates engine missing",
            "uploadProjectUpdateToSupabase() is not available. Make sure the project updates engine is loaded."
        );
        return;
    }

    const title = safeString(dashboardEls.projectUpdateTitle?.value).trim();
    const description = safeString(dashboardEls.projectUpdateText?.value).trim();
    const file = dashboardEls.projectUpdateImage?.files?.[0] || null;

    if(!description){
        showDashboardAlert("Description required", "Please write the project update description first.");
        return;
    }

    const imageCheck = validateUpdateImage(file);
    if(!imageCheck.ok){
        showDashboardAlert("Image required", imageCheck.message);
        return;
    }

    uploadBusy = true;
    if(dashboardEls.uploadProjectUpdateBtn){
        dashboardEls.uploadProjectUpdateBtn.disabled = true;
        dashboardEls.uploadProjectUpdateBtn.textContent = "Uploading...";
    }

    try{
        const admin = getAdminMeta();
        const result = await window.uploadProjectUpdateToSupabase({
            projectCode: currentProject.project_code,
            projectName: currentProject.project_name || currentProject.project_code,
            projectType: currentProject.project_type || getProjectType(currentProject),
            title,
            description,
            file,
            createdByEmail: admin.email,
            createdByName: admin.username,
            createdByRole: admin.role,
            createdByUserId: admin.userid,
            environment: admin.environment,
            network: admin.network
        });

        if(result?.error){
            throw new Error(result.error);
        }

        if(dashboardEls.projectUpdateTitle) dashboardEls.projectUpdateTitle.value = "";
        if(dashboardEls.projectUpdateText) dashboardEls.projectUpdateText.value = "";
        if(dashboardEls.projectUpdateImage) dashboardEls.projectUpdateImage.value = "";
        resetImagePreview();

        showDashboardAlert(
            "Update uploaded",
            "Project update was published successfully to Transparency."
        );
    }catch(error){
        console.error("[UNIVERSAL DASHBOARD] Project update upload failed:", error);
        showDashboardAlert(
            "Upload failed",
            error?.message || "Failed to upload project update."
        );
    }finally{
        uploadBusy = false;
        if(dashboardEls.uploadProjectUpdateBtn){
            dashboardEls.uploadProjectUpdateBtn.disabled = false;
            dashboardEls.uploadProjectUpdateBtn.textContent = "Upload Update";
        }
    }
}

/* ==========================================
   EVENTS / REFRESH
========================================== */

function bindActions(){
    if(dashboardEls.addLiquidityBtn){
        dashboardEls.addLiquidityBtn.addEventListener("click", addLiquidityAction);
    }
    if(dashboardEls.withdrawLiquidityBtn){
        dashboardEls.withdrawLiquidityBtn.addEventListener("click", withdrawLiquidityAction);
    }
    if(dashboardEls.uploadProjectUpdateBtn){
        dashboardEls.uploadProjectUpdateBtn.addEventListener("click", uploadProjectUpdate);
    }
    if(dashboardEls.projectUpdateImage){
        dashboardEls.projectUpdateImage.addEventListener("change", function(){
            previewSelectedImage(this.files?.[0] || null);
        });
    }
}

function startRefresh(){
    if(refreshTimer) clearInterval(refreshTimer);
    refreshTimer = window.setInterval(() => {
        if(!document.hidden && adminReady()){
            renderDashboard();
        }
    }, REFRESH_INTERVAL);
}

function stopRefresh(){
    if(refreshTimer){
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
}

/* ==========================================
   STARTUP
========================================== */

async function startUniversalDashboard(){
    if(startupPromise) return startupPromise;

    startupPromise = (async function(){
        const ready = await ensureAdminReady();

        if(!ready){
            console.warn(
                "[UNIVERSAL DASHBOARD] Admin Bootstrap is not ready. Dashboard remains fail-closed."
            );
            return false;
        }

        if(!adminRoleAllowed()){
            console.warn(
                "[UNIVERSAL DASHBOARD] Current Admin role is not authorized for dashboard access."
            );
            return false;
        }

        bindActions();
        await renderDashboard();
        startRefresh();
        return true;
    })();

    try{
        return await startupPromise;
    }finally{
        startupPromise = null;
    }
}

/* ==========================================
   PUBLIC API
========================================== */

window.AlbukhrUniversalProjectDashboard = {
    getCurrentProject: () => currentProject,
    getAdminMeta,
    resolveProject: resolveCurrentProject,
    render: renderDashboard,
    refresh: renderDashboard,
    start: startUniversalDashboard,
    stopRefresh
};

window.startUniversalProjectDashboard = startUniversalDashboard;
window.renderUniversalProjectDashboard = renderDashboard;

/* ==========================================
   ADMIN READY EVENT
========================================== */

document.addEventListener("admin-ready", function(){
    startUniversalDashboard().catch(error => {
        console.error(
            "[UNIVERSAL DASHBOARD] admin-ready startup failed:",
            error
        );
    });
});

/* ==========================================
   DOM READY
========================================== */

function startup(){
    startUniversalDashboard().catch(error => {
        console.error(
            "[UNIVERSAL DASHBOARD] Startup failure:",
            error
        );
    });
}

if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", startup, { once:true });
}else{
    setTimeout(startup, 0);
}

console.log(
    "✅ ALBUKHR Universal Project Dashboard 4.0 Loaded"
);

})(window);
