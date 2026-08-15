/* =========================================================
   ALBUKHR ADMIN INTERNAL PROJECTS
   FINAL DOM + DIRECT SUPABASE VERSION
   ---------------------------------------------------------
   Fixes:
   1. DOM elements are resolved AFTER DOMContentLoaded.
   2. Read is direct from albukhr_internal_projects.
   3. Approve/Reject are direct Supabase updates.
   4. NEVER sends reviewed_at.
   5. Read errors are shown visibly on the page.
========================================================= */

const adminInternalProjectState = {
  projects: [],
  filtered: [],
  loading: false
};

let els = {};

function cacheElements(){
  els = {
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

  const missing = Object.entries(els)
    .filter(([,el]) => !el)
    .map(([key]) => key);

  if(missing.length){
    console.warn("ALBUKHR admin missing DOM elements:", missing);
  }
}

function esc(v){
  return String(v ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function getSupabase(){
  const c = window.AlbukhrContributorEngine;
  if(c && typeof c.getSupabaseClient === "function"){
    return c.getSupabaseClient();
  }

  const e = window.AlbukhrInternalRegistryEngine;
  if(e && typeof e.getSupabaseClient === "function"){
    return e.getSupabaseClient();
  }

  if(window.albukhrSupabase &&
     typeof window.albukhrSupabase.from === "function"){
    return window.albukhrSupabase;
  }

  if(window.supabaseClient &&
     typeof window.supabaseClient.from === "function"){
    return window.supabaseClient;
  }

  throw new Error(
    "ALBUKHR Supabase client is not available. " +
    "Check contributor-engine.js / Supabase initialization."
  );
}

function getActor(){
  const a =
    window.admin ||
    window.currentAdmin ||
    window.AlbukhrAdmin ||
    {};

  return {
    email: String(
      a.email ||
      localStorage.getItem("albukhr_current_email") ||
      localStorage.getItem("currentUserEmail") ||
      ""
    ).trim().toLowerCase(),

    name: String(
      a.username ||
      a.name ||
      localStorage.getItem("albukhr_current_username") ||
      localStorage.getItem("currentUserName") ||
      "ALBUKHR Admin"
    ).trim() || "ALBUKHR Admin"
  };
}

function normalizeStatus(s){
  s = String(s || "").trim().toLowerCase();

  if(s === "pending" || s === "internal_pending")
    return "internal_pending";

  if(s === "approved" || s === "internal_approved")
    return "internal_approved";

  if(s === "rejected" || s === "internal_rejected")
    return "internal_rejected";

  return s || "internal_pending";
}

function badge(s){
  s = normalizeStatus(s);

  if(s === "internal_approved")
    return '<span class="badge approved">✓ Approved</span>';

  if(s === "internal_rejected")
    return '<span class="badge rejected">✗ Rejected</span>';

  if(s === "internal_pending")
    return '<span class="badge pending">⏳ Pending</span>';

  return `<span class="badge other">${esc(s)}</span>`;
}

const projectName =
  p => p.project_name || p.projectName || "Unnamed Internal Project";

const projectCreator =
  p => p.creator_name || p.creatorName || "—";

const projectEmail =
  p => String(
    p.creator_email ||
    p.email ||
    p.creatorEmail ||
    ""
  ).trim().toLowerCase();

const projectInternalId =
  p => p.internal_id || p.albukhr_id || p.albukhrId || "—";

const projectCategory = p => p.category || "—";
const projectStage = p => p.stage || "—";
const projectRole = p => p.creator_role || p.role || "—";
const projectSummary = p => p.summary || "—";
const projectProblem = p => p.problem || "—";
const projectSolution = p => p.solution || "—";
const projectImpact = p => p.impact || "—";
const projectFunding = p => p.funding || "—";
const projectRisk = p => p.risk || "—";
const projectConfidentiality = p => p.confidentiality || "—";

const projectRoi = p =>
  p.roi === null || p.roi === undefined || p.roi === ""
    ? "—"
    : String(p.roi);

const projectLiquidity = p =>
  p.initial_liquidity === null ||
  p.initial_liquidity === undefined ||
  p.initial_liquidity === ""
    ? "—"
    : String(p.initial_liquidity);

const dateText =
  v => v ? new Date(v).toLocaleString() : "—";

const reviewedBy =
  p => p.reviewed_by_name ||
       p.approved_by_name ||
       p.rejected_by_name ||
       "—";

const reviewReason =
  p => p.rejection_reason ||
       p.review_note ||
       p.review_reason ||
       "";

function showNotice(message, type = "info"){
  if(!els.pageNotice){
    console[type === "error" ? "error" : "log"](message);
    return;
  }

  els.pageNotice.className = "notice " + type;
  els.pageNotice.textContent = message;
  els.pageNotice.classList.remove("hidden");
}

function setRefreshBusy(busy){
  if(!els.refreshProjectsBtn) return;

  if(busy){
    if(!els.refreshProjectsBtn.dataset.originalText){
      els.refreshProjectsBtn.dataset.originalText =
        els.refreshProjectsBtn.textContent;
    }

    els.refreshProjectsBtn.disabled = true;
    els.refreshProjectsBtn.textContent = "Refreshing...";
  }else{
    els.refreshProjectsBtn.disabled = false;
    els.refreshProjectsBtn.textContent =
      els.refreshProjectsBtn.dataset.originalText ||
      "Refresh Internal Projects";
  }
}

/* =========================================================
   READ DIRECTLY FROM SUPABASE
========================================================= */

async function fetchInternalProjects(){
  try{
    adminInternalProjectState.loading = true;

    setRefreshBusy(true);

    if(els.list){
      els.list.innerHTML =
        '<div class="empty">Loading internal projects...</div>';
    }

    const client = getSupabase();

    const result = await client
      .from("albukhr_internal_projects")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if(result.error){
      throw new Error(
        "Supabase read failed: " + result.error.message
      );
    }

    const data = Array.isArray(result.data)
      ? result.data
      : [];

    console.log(
      "ALBUKHR admin internal projects loaded:",
      data
    );

    adminInternalProjectState.projects = data;

    updateStats(data);
    applyFilters();

    showNotice(
      data.length
        ? `Loaded ${data.length} internal project(s) from Supabase.`
        : "Supabase returned 0 internal projects.",
      data.length ? "success" : "info"
    );

  }catch(error){
    console.error(
      "ALBUKHR admin internal project READ ERROR:",
      error
    );

    adminInternalProjectState.projects = [];
    adminInternalProjectState.filtered = [];

    updateStats([]);

    if(els.list){
      els.list.innerHTML = `
        <div class="empty">
          <b>Failed to load internal projects.</b><br><br>
          ${esc(error?.message || "Unknown Supabase error.")}
        </div>
      `;
    }

    showNotice(
      error?.message ||
      "Unable to load internal project list.",
      "error"
    );

  }finally{
    adminInternalProjectState.loading = false;
    setRefreshBusy(false);
  }
}

/* =========================================================
   APPROVE
   CRITICAL: NO reviewed_at
========================================================= */

async function approveInternalProject(projectId){
  if(!projectId){
    alert("Internal project ID is missing.");
    return;
  }

  if(!confirm("Approve this internal project?")){
    return;
  }

  try{
    const client = getSupabase();
    const a = getActor();
    const now = new Date().toISOString();

    const payload = {
      status: "internal_approved",
      approved_at: now,
      approved_by_email: a.email || null,
      approved_by_name: a.name,

      rejected_at: null,
      rejected_by_email: null,
      rejected_by_name: null,
      rejection_reason: null,

      reviewed_by_email: a.email || null,
      reviewed_by_name: a.name,

      updated_at: now
    };

    /* IMPORTANT:
       reviewed_at is intentionally NOT present.
    */

    const result = await client
      .from("albukhr_internal_projects")
      .update(payload)
      .eq("id", projectId)
      .select("*")
      .single();

    if(result.error){
      throw new Error(
        "Approve failed: " + result.error.message
      );
    }

    await fetchInternalProjects();

    alert("Internal project approved successfully.");

  }catch(error){
    console.error("ALBUKHR approve error:", error);
    alert(error?.message || "Unable to approve internal project.");
  }
}

/* =========================================================
   REJECT
   CRITICAL: NO reviewed_at
========================================================= */

async function rejectInternalProject(projectId){
  if(!projectId){
    alert("Internal project ID is missing.");
    return;
  }

  const reason =
    prompt(
      "Optional rejection reason (you can leave this blank):",
      ""
    ) || "";

  if(!confirm("Reject this internal project?")){
    return;
  }

  try{
    const client = getSupabase();
    const a = getActor();
    const now = new Date().toISOString();

    const payload = {
      status: "internal_rejected",

      rejected_at: now,
      rejected_by_email: a.email || null,
      rejected_by_name: a.name,
      rejection_reason: reason.trim() || null,

      approved_at: null,
      approved_by_email: null,
      approved_by_name: null,

      reviewed_by_email: a.email || null,
      reviewed_by_name: a.name,

      updated_at: now
    };

    /* IMPORTANT:
       reviewed_at is intentionally NOT present.
    */

    const result = await client
      .from("albukhr_internal_projects")
      .update(payload)
      .eq("id", projectId)
      .select("*")
      .single();

    if(result.error){
      throw new Error(
        "Reject failed: " + result.error.message
      );
    }

    await fetchInternalProjects();

    alert("Internal project rejected successfully.");

  }catch(error){
    console.error("ALBUKHR reject error:", error);
    alert(error?.message || "Unable to reject internal project.");
  }
}

/* =========================================================
   STATS
========================================================= */

function updateStats(list){
  if(els.statTotal)
    els.statTotal.textContent = list.length;

  if(els.statPending)
    els.statPending.textContent =
      list.filter(
        p => normalizeStatus(p.status) === "internal_pending"
      ).length;

  if(els.statApproved)
    els.statApproved.textContent =
      list.filter(
        p => normalizeStatus(p.status) === "internal_approved"
      ).length;

  if(els.statRejected)
    els.statRejected.textContent =
      list.filter(
        p => normalizeStatus(p.status) === "internal_rejected"
      ).length;
}

/* =========================================================
   FILTER
========================================================= */

function applyFilters(){
  const q =
    String(els.searchInput?.value || "")
      .trim()
      .toLowerCase();

  const selectedStatus =
    els.statusFilter?.value || "all";

  let list =
    [...adminInternalProjectState.projects];

  if(selectedStatus !== "all"){
    list = list.filter(
      p => normalizeStatus(p.status) === selectedStatus
    );
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
        reviewReason(p)
      ].join(" ").toLowerCase();

      return hay.includes(q);
    });
  }

  adminInternalProjectState.filtered = list;

  renderList();
}

/* =========================================================
   RENDER
========================================================= */

function renderList(){
  const list =
    adminInternalProjectState.filtered || [];

  if(els.listCount){
    els.listCount.textContent =
      `${list.length} record${list.length === 1 ? "" : "s"}`;
  }

  if(!els.list){
    console.error(
      "ALBUKHR: #list element was not found."
    );
    return;
  }

  if(!list.length){
    els.list.innerHTML =
      '<div class="empty">No internal projects found for the current filter.</div>';
    return;
  }

  els.list.innerHTML = list.map(p => {
    const st = normalizeStatus(p.status);
    const id = String(p.id || "");
    const rr = reviewReason(p);

    const actions =
      st === "internal_pending"
        ? `
          <button
            class="approve"
            onclick="approveInternalProject('${esc(id)}')"
          >✓ Approve</button>

          <button
            class="reject"
            onclick="rejectInternalProject('${esc(id)}')"
          >✕ Reject</button>
        `
        : st === "internal_approved"
          ? '<span class="badge approved">✓ Approved</span>'
          : st === "internal_rejected"
            ? '<span class="badge rejected">✗ Rejected</span>'
            : "";

    const review =
      st !== "internal_pending" || rr
        ? `
          <div class="review-box">
            <div class="review-title">Review Record</div>
            <div class="meta">
              <b>Status:</b> ${esc(st)}<br>
              <b>Reviewed By:</b> ${esc(reviewedBy(p))}<br>
              <b>Approved At:</b> ${esc(dateText(p.approved_at))}<br>
              <b>Rejected At:</b> ${esc(dateText(p.rejected_at))}
              ${
                rr
                  ? `<br><b>Reason:</b> ${esc(rr)}`
                  : ""
              }
            </div>
          </div>
        `
        : "";

    return `
      <div class="project-card">

        <div class="project-top">
          <div>
            <h3 class="project-name">
              ${esc(projectName(p))}
            </h3>

            <div class="meta">
              📧 ${esc(projectEmail(p) || "—")}<br>
              👤 ${esc(projectCreator(p))}<br>
              🆔 ${esc(projectInternalId(p))}<br>
              🕒 Submitted: ${esc(dateText(p.created_at))}
            </div>
          </div>

          <div>
            ${badge(st)}
          </div>
        </div>

        <div class="info-grid">

          <div class="info-box">
            <div class="info-label">Category</div>
            <div class="info-value">
              ${esc(projectCategory(p))}
            </div>
          </div>

          <div class="info-box">
            <div class="info-label">Stage</div>
            <div class="info-value">
              ${esc(projectStage(p))}
            </div>
          </div>

          <div class="info-box">
            <div class="info-label">Role</div>
            <div class="info-value">
              ${esc(projectRole(p))}
            </div>
          </div>

          <div class="info-box">
            <div class="info-label">Funding</div>
            <div class="info-value">
              ${esc(projectFunding(p))}
            </div>
          </div>

          <div class="info-box">
            <div class="info-label">Risk</div>
            <div class="info-value">
              ${esc(projectRisk(p))}
            </div>
          </div>

          <div class="info-box">
            <div class="info-label">Confidentiality</div>
            <div class="info-value">
              ${esc(projectConfidentiality(p))}
            </div>
          </div>

          <div class="info-box">
            <div class="info-label">Expected ROI (%)</div>
            <div class="info-value">
              ${esc(projectRoi(p))}
            </div>
          </div>

          <div class="info-box">
            <div class="info-label">Initial Liquidity (Pi)</div>
            <div class="info-value">
              ${esc(projectLiquidity(p))}
            </div>
          </div>

          <div class="info-box">
            <div class="info-label">Contributor Email</div>
            <div class="info-value">
              ${esc(projectEmail(p) || "—")}
            </div>
          </div>

        </div>

        <div class="block">
          <b>Project Summary</b><br>
          ${esc(projectSummary(p))}
        </div>

        <div class="block">
          <b>Problem Statement</b><br>
          ${esc(projectProblem(p))}
        </div>

        <div class="block">
          <b>Solution / Innovation</b><br>
          ${esc(projectSolution(p))}
        </div>

        <div class="block">
          <b>Expected Impact</b><br>
          ${esc(projectImpact(p))}
        </div>

        ${review}

        <div class="actions">
          ${actions}
        </div>

      </div>
    `;
  }).join("");
}

/* =========================================================
   INIT
========================================================= */

function bindEvents(){
  if(els.refreshProjectsBtn){
    els.refreshProjectsBtn.addEventListener(
      "click",
      fetchInternalProjects
    );
  }

  if(els.searchInput){
    els.searchInput.addEventListener(
      "input",
      applyFilters
    );
  }

  if(els.statusFilter){
    els.statusFilter.addEventListener(
      "change",
      applyFilters
    );
  }
}

window.approveInternalProject =
  approveInternalProject;

window.rejectInternalProject =
  rejectInternalProject;

window.fetchInternalProjects =
  fetchInternalProjects;

document.addEventListener("DOMContentLoaded", async () => {
  try{
    cacheElements();
    bindEvents();
    await fetchInternalProjects();
  }catch(error){
    console.error(
      "ALBUKHR admin internal initialization error:",
      error
    );

    showNotice(
      error?.message ||
      "Failed to initialize admin internal projects.",
      "error"
    );
  }
});
