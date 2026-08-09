/* =========================================================
   ALBUKHR ADMIN INTERNAL PROJECTS
   FINAL SUPABASE VERSION
========================================================= */

const adminInternalProjectState = {
  projects: [],
  filtered: [],
  loading: false
};

const els = {
  list: document.getElementById("list"),
  refreshProjectsBtn: document.getElementById("refreshProjectsBtn"),
  pageNotice: document.getElementById("pageNotice"),
  searchInput: document.getElementById("searchInput"),
  statusFilter: document.getElementById("statusFilter"),
  statTotal: document.getElementById("statTotal"),
  statPending: document.getElementById("statPending"),
  statApproved: document.getElementById("statApproved"),
  statRejected: document.getElementById("statRejected"),
  listCount: document.getElementById("listCount")
};

/* =========================================================
   HELPERS
========================================================= */
function safeText(v, fallback = "—"){
  if(v === null || v === undefined || v === "") return fallback;
  return String(v);
}

function escapeHtml(value){
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setBtnBusy(btn, busy, busyText = "Please wait..."){
  if(!btn) return;
  if(busy){
    if(!btn.dataset.originalText){
      btn.dataset.originalText = btn.textContent;
    }
    btn.disabled = true;
    btn.textContent = busyText;
  }else{
    btn.disabled = false;
    btn.textContent = btn.dataset.originalText || btn.textContent;
  }
}

function showPageNotice(message, type = "info"){
  els.pageNotice.className = "notice " + type;
  els.pageNotice.textContent = message;
  els.pageNotice.classList.remove("hidden");
}

function hidePageNotice(){
  els.pageNotice.className = "notice info hidden";
  els.pageNotice.textContent = "";
}

function copyText(text, successMessage = "Copied successfully"){
  navigator.clipboard.writeText(text);
  alert(successMessage);
}

function getInternalEngine(){
  const engine = window.AlbukhrInternalRegistryEngine;
  if(!engine){
    throw new Error("AlbukhrInternalRegistryEngine not found. Load js/internal-registry-engine.js first.");
  }
  return engine;
}

function normalizeProjectStatus(status){
  const s = String(status || "").trim().toLowerCase();

  if(s === "internal_pending" || s === "pending") return "internal_pending";
  if(s === "internal_approved" || s === "approved") return "internal_approved";
  if(s === "internal_rejected" || s === "rejected") return "internal_rejected";

  return s || "internal_pending";
}

function statusBadge(status){
  const s = normalizeProjectStatus(status);

  if(s === "internal_approved"){
    return `<span class="badge approved">✓ Approved</span>`;
  }

  if(s === "internal_rejected"){
    return `<span class="badge rejected">✗ Rejected</span>`;
  }

  if(s === "internal_pending"){
    return `<span class="badge pending">⏳ Pending</span>`;
  }

  return `<span class="badge other">${escapeHtml(s)}</span>`;
}

function projectName(p){
  return p.project_name || p.projectName || "Unnamed Internal Project";
}

function projectCreator(p){
  return p.creator_name || p.creatorName || "—";
}

function projectEmail(p){
  return (p.email || "").toLowerCase();
}

function projectInternalId(p){
  return p.internal_id || p.albukhr_id || p.albukhrId || "—";
}

function projectCategory(p){
  return p.category || "—";
}

function projectStage(p){
  return p.stage || "—";
}

function projectSummary(p){
  return p.summary || "—";
}

function projectProblem(p){
  return p.problem || "—";
}

function projectSolution(p){
  return p.solution || "—";
}

function projectImpact(p){
  return p.impact || "—";
}

function projectFunding(p){
  return p.funding || "—";
}

function projectRisk(p){
  return p.risk || "—";
}

function projectConfidentiality(p){
  return p.confidentiality || "—";
}

function projectRole(p){
  return p.role || "—";
}

function projectRoi(p){
  if(p.roi === null || p.roi === undefined || p.roi === "") return "—";
  return String(p.roi);
}

function projectLiquidity(p){
  if(p.initial_liquidity === null || p.initial_liquidity === undefined || p.initial_liquidity === ""){
    return "—";
  }
  return String(p.initial_liquidity);
}

function projectStatus(p){
  return normalizeProjectStatus(p.status);
}

function projectCreatedAt(p){
  return p.created_at ? new Date(p.created_at).toLocaleString() : "—";
}

function projectApprovedAt(p){
  return p.approved_at ? new Date(p.approved_at).toLocaleString() : "—";
}

function projectRejectedAt(p){
  return p.rejected_at ? new Date(p.rejected_at).toLocaleString() : "—";
}

function projectReviewedBy(p){
  return p.reviewed_by_name || p.approved_by_name || p.rejected_by_name || "—";
}

function projectReviewReason(p){
  return p.rejection_reason || p.review_note || p.review_reason || "";
}

/* =========================================================
   FALLBACK DIRECT SUPABASE HELPERS
========================================================= */
async function directListInternalProjects(){
  const contributorEngine = window.AlbukhrContributorEngine;
  if(!contributorEngine || typeof contributorEngine.getSupabaseClient !== "function"){
    throw new Error("AlbukhrContributorEngine.getSupabaseClient() not found.");
  }

  const supabase = contributorEngine.getSupabaseClient();

  const { data, error } = await supabase
    .from("albukhr_internal_projects")
    .select("*")
    .order("created_at", { ascending:false });

  if(error){
    throw new Error(error.message || "Failed to load internal projects.");
  }

  return Array.isArray(data) ? data : [];
}

async function directApproveInternalProject(projectId){
  const contributorEngine = window.AlbukhrContributorEngine;
  if(!contributorEngine || typeof contributorEngine.getSupabaseClient !== "function"){
    throw new Error("AlbukhrContributorEngine.getSupabaseClient() not found.");
  }

  const supabase = contributorEngine.getSupabaseClient();

  const actorEmail =
    admin?.email ||
    localStorage.getItem("albukhr_current_email") ||
    localStorage.getItem("currentUserEmail") ||
    "";

  const actorName =
    admin?.username ||
    localStorage.getItem("albukhr_current_username") ||
    localStorage.getItem("currentUserName") ||
    "ALBUKHR Admin";

  const { data, error } = await supabase
    .from("albukhr_internal_projects")
    .update({
      status: "internal_approved",
      approved_at: new Date().toISOString(),
      rejected_at: null,
      approved_by_email: actorEmail,
      approved_by_name: actorName,
      reviewed_by_email: actorEmail,
      reviewed_by_name: actorName,
      rejection_reason: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", projectId)
    .select()
    .single();

  if(error){
    throw new Error(error.message || "Failed to approve internal project.");
  }

  return data;
}

async function directRejectInternalProject(projectId, reason = ""){
  const contributorEngine = window.AlbukhrContributorEngine;
  if(!contributorEngine || typeof contributorEngine.getSupabaseClient !== "function"){
    throw new Error("AlbukhrContributorEngine.getSupabaseClient() not found.");
  }

  const supabase = contributorEngine.getSupabaseClient();

  const actorEmail =
    admin?.email ||
    localStorage.getItem("albukhr_current_email") ||
    localStorage.getItem("currentUserEmail") ||
    "";

  const actorName =
    admin?.username ||
    localStorage.getItem("albukhr_current_username") ||
    localStorage.getItem("currentUserName") ||
    "ALBUKHR Admin";

  const { data, error } = await supabase
    .from("albukhr_internal_projects")
    .update({
      status: "internal_rejected",
      rejected_at: new Date().toISOString(),
      approved_at: null,
      rejected_by_email: actorEmail,
      rejected_by_name: actorName,
      reviewed_by_email: actorEmail,
      reviewed_by_name: actorName,
      rejection_reason: reason || null,
      updated_at: new Date().toISOString()
    })
    .eq("id", projectId)
    .select()
    .single();

  if(error){
    throw new Error(error.message || "Failed to reject internal project.");
  }

  return data;
}

/* =========================================================
   STATS + FILTER
========================================================= */
function updateStats(list){
  const total = list.length;
  const pending = list.filter(p => projectStatus(p) === "internal_pending").length;
  const approved = list.filter(p => projectStatus(p) === "internal_approved").length;
  const rejected = list.filter(p => projectStatus(p) === "internal_rejected").length;

  els.statTotal.textContent = total;
  els.statPending.textContent = pending;
  els.statApproved.textContent = approved;
  els.statRejected.textContent = rejected;
}

function applyFilters(){
  const q = (els.searchInput.value || "").trim().toLowerCase();
  const status = els.statusFilter.value || "all";

  let list = [...adminInternalProjectState.projects];

  if(status !== "all"){
    list = list.filter(p => projectStatus(p) === status);
  }

  if(q){
    list = list.filter(p => {
      const hay = [
        projectName(p),
        projectCreator(p),
        projectEmail(p),
        projectInternalId(p),
        projectCategory(p),
        projectStage(p),
        projectRole(p),
        projectSummary(p),
        projectProblem(p),
        projectSolution(p),
        projectImpact(p),
        projectFunding(p),
        projectRisk(p),
        projectConfidentiality(p),
        projectReviewReason(p)
      ].join(" ").toLowerCase();

      return hay.includes(q);
    });
  }

  adminInternalProjectState.filtered = list;
  renderList();
}

/* =========================================================
   FETCH PROJECTS
========================================================= */
async function fetchInternalProjects(){
  try{
    adminInternalProjectState.loading = true;
    hidePageNotice();
    setBtnBusy(els.refreshProjectsBtn, true, "Refreshing...");
    els.list.innerHTML = `<div class="empty">Loading internal projects...</div>`;

    const engine = getInternalEngine();
    let list = [];

    if(typeof engine.adminListInternalProjects === "function"){
      list = await engine.adminListInternalProjects({
  status: "",
  limit: 500
});
    }else{
      list = await directListInternalProjects();
    }

    adminInternalProjectState.projects = Array.isArray(list) ? list : [];

    updateStats(adminInternalProjectState.projects);
    applyFilters();

  }catch(err){
    console.error("Internal project fetch error:", err);
    els.list.innerHTML = `<div class="empty">Failed to load internal projects.</div>`;
    alert(err?.message || "Unable to load internal project list.");
  }finally{
    adminInternalProjectState.loading = false;
    setBtnBusy(els.refreshProjectsBtn, false);
  }
}

/* =========================================================
   REVIEW ACTIONS
========================================================= */
async function approveInternalProject(projectId){
  if(!confirm("Approve this internal project?")) return;

  try{
    const engine = getInternalEngine();

    if(typeof engine.adminApproveInternalProject === "function"){
      await engine.adminApproveInternalProject({
        projectId,
        approvedBy: admin?.email || admin?.username || "admin"
      });
    }else{
      await directApproveInternalProject(projectId);
    }

    await fetchInternalProjects();
    alert("Internal project approved successfully.");

  }catch(err){
    console.error("Approve internal project error:", err);
    alert(err?.message || "Unable to approve internal project.");
  }
}

async function rejectInternalProject(projectId){
  const reason = prompt("Optional rejection reason (you can leave this blank):", "") || "";

  if(!confirm("Reject this internal project?")) return;

  try{
    const engine = getInternalEngine();

    if(typeof engine.adminRejectInternalProject === "function"){
      await engine.adminRejectInternalProject({
        projectId,
        reason,
        rejectedBy: admin?.email || admin?.username || "admin"
      });
    }else{
      await directRejectInternalProject(projectId, reason);
    }

    await fetchInternalProjects();
    alert("Internal project rejected successfully.");

  }catch(err){
    console.error("Reject internal project error:", err);
    alert(err?.message || "Unable to reject internal project.");
  }
}

function copyInternalProjectId(id){
  if(!id || id === "—") return;
  copyText(id, "Albukhr Internal ID copied: " + id);
}

/* =========================================================
   RENDER
========================================================= */
function renderList(){
  const list = adminInternalProjectState.filtered || [];
  els.listCount.textContent = `${list.length} record${list.length === 1 ? "" : "s"}`;

  if(!list.length){
    els.list.innerHTML = `<div class="empty">No internal projects found for the current filter.</div>`;
    return;
  }

  els.list.innerHTML = list.map(p => {
    const status = projectStatus(p);
    const internalId = projectInternalId(p);
    const reviewReason = projectReviewReason(p);

    const pendingActions = status === "internal_pending"
      ? `
        <button class="approve" onclick="approveInternalProject('${String(p.id).replace(/'/g, "\\'")}')">
          Approve
        </button>
        <button class="reject" onclick="rejectInternalProject('${String(p.id).replace(/'/g, "\\'")}')">
          Reject
        </button>
      `
      : status === "internal_approved"
        ? `<span class="badge approved">✓ Approved</span>`
        : status === "internal_rejected"
          ? `<span class="badge rejected">✗ Rejected</span>`
          : "";

    const reviewBox = (
      status === "internal_approved" ||
      status === "internal_rejected" ||
      reviewReason
    ) ? `
      <div class="review-box">
        <div class="review-title">Review Record</div>
        <div class="meta">
          <b>Status:</b> ${escapeHtml(status)}<br>
          <b>Reviewed By:</b> ${escapeHtml(projectReviewedBy(p))}<br>
          <b>Approved At:</b> ${escapeHtml(projectApprovedAt(p))}<br>
          <b>Rejected At:</b> ${escapeHtml(projectRejectedAt(p))}
          ${reviewReason ? `<br><b>Reason:</b> ${escapeHtml(reviewReason)}` : ""}
        </div>
      </div>
    ` : "";

    return `
      <div class="project-card">
        <div class="project-top">
          <div>
            <h3 class="project-name">${escapeHtml(projectName(p))}</h3>

            <div class="meta">
              📧 ${escapeHtml(projectEmail(p) || "—")}<br>
              👤 ${escapeHtml(projectCreator(p))}<br>
              🆔 ${escapeHtml(internalId)} ${
                internalId && internalId !== "—"
                  ? `<button class="copy-btn small" onclick="copyInternalProjectId('${String(internalId).replace(/'/g, "\\'")}')" style="margin-left:6px">Copy</button>`
                  : ""
              }<br>
              🕒 Submitted: ${escapeHtml(projectCreatedAt(p))}
            </div>
          </div>

          <div>
            ${statusBadge(status)}
          </div>
        </div>

        <div class="info-grid">
          <div class="info-box">
            <div class="info-label">Category</div>
            <div class="info-value">${escapeHtml(projectCategory(p))}</div>
          </div>

          <div class="info-box">
            <div class="info-label">Stage</div>
            <div class="info-value">${escapeHtml(projectStage(p))}</div>
          </div>

          <div class="info-box">
            <div class="info-label">Role</div>
            <div class="info-value">${escapeHtml(projectRole(p))}</div>
          </div>

          <div class="info-box">
            <div class="info-label">Funding</div>
            <div class="info-value">${escapeHtml(projectFunding(p))}</div>
          </div>

          <div class="info-box">
            <div class="info-label">Risk</div>
            <div class="info-value">${escapeHtml(projectRisk(p))}</div>
          </div>

          <div class="info-box">
            <div class="info-label">Confidentiality</div>
            <div class="info-value">${escapeHtml(projectConfidentiality(p))}</div>
          </div>

          <div class="info-box">
            <div class="info-label">Expected ROI (%)</div>
            <div class="info-value">${escapeHtml(projectRoi(p))}</div>
          </div>

          <div class="info-box">
            <div class="info-label">Initial Liquidity (Pi)</div>
            <div class="info-value">${escapeHtml(projectLiquidity(p))}</div>
          </div>

          <div class="info-box">
            <div class="info-label">Contributor Email</div>
            <div class="info-value">${escapeHtml(projectEmail(p) || "—")}</div>
          </div>
        </div>

        <div class="block">
          <b>Project Summary</b><br>
          ${escapeHtml(projectSummary(p))}
        </div>

        <div class="block">
          <b>Problem Statement</b><br>
          ${escapeHtml(projectProblem(p))}
        </div>

        <div class="block">
          <b>Solution / Innovation</b><br>
          ${escapeHtml(projectSolution(p))}
        </div>

        <div class="block">
          <b>Expected Impact</b><br>
          ${escapeHtml(projectImpact(p))}
        </div>

        ${reviewBox}

        <div class="actions">
          ${pendingActions}
        </div>
      </div>
    `;
  }).join("");
}

/* =========================================================
   BIND EVENTS
========================================================= */
function bindEvents(){
  els.refreshProjectsBtn.addEventListener("click", fetchInternalProjects);
  els.searchInput.addEventListener("input", applyFilters);
  els.statusFilter.addEventListener("change", applyFilters);
}

/* expose globals for inline buttons */
window.copyInternalProjectId = copyInternalProjectId;
window.approveInternalProject = approveInternalProject;
window.rejectInternalProject = rejectInternalProject;

/* =========================================================
   INIT
========================================================= */
document.addEventListener("DOMContentLoaded", async function(){
  try{
    bindEvents();

    if(!window.AlbukhrContributorEngine){
      throw new Error("js/contributor-engine.js failed to load.");
    }

    if(!window.AlbukhrInternalRegistryEngine){
      throw new Error("js/internal-registry-engine.js failed to load.");
    }

    await fetchInternalProjects();

  }catch(err){
    console.error("Admin internal projects init error:", err);
    alert(err?.message || "Failed to initialize internal project admin panel.");
  }
});
