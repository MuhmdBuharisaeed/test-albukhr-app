const listBox = document.getElementById("adminList");

/* ==========================
ESCAPE HTML
========================== */
function escapeHtml(text = ""){
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ==========================
STATUS BADGE
========================== */
function getStatusBadge(status){

  if(status === "approved"){
    return `
      <div class="status-badge status-approved">
        🟢 Approved
      </div>
    `;
  }

  if(status === "rejected"){
    return `
      <div class="status-badge status-rejected">
        🔴 Rejected
      </div>
    `;
  }

  return `
    <div class="status-badge status-pending">
      🟡 Pending
    </div>
  `;
}

/* ==========================
LOAD REQUESTS
========================== */
async function loadRequests(){

  listBox.innerHTML =
    "<div class='empty'>Loading requests...</div>";

  try{

    const { data, error } =
      await window.supabaseClient
        .from("dapp_requests")
        .select("*")
        .order("created_at", {
          ascending:false
        });

    if(error){
      console.error(error);

      listBox.innerHTML =
        "<div class='empty'>Failed to load requests.</div>";

      return;
    }

    renderRequests(data || []);

  }catch(err){

    console.error(err);

    listBox.innerHTML =
      "<div class='empty'>Network error while loading requests.</div>";
  }
}

/* ==========================
RENDER REQUESTS
========================== */
function renderRequests(rows){

  if(!Array.isArray(rows) || !rows.length){

    listBox.innerHTML =
      "<div class='empty'>No dApp requests found.</div>";

    return;
  }

  listBox.innerHTML = "";

  rows.forEach(row=>{

    const status =
      (row.status || "pending").toLowerCase();

    const noteId =
      `note_${row.id}`;

    let actionButtons = "";

    if(status === "pending"){
      actionButtons = `
        <div class="action-row">
          <button
            class="btn approve"
            onclick="approveRequest('${row.id}')">
            Approve
          </button>

          <button
            class="btn reject"
            onclick="rejectRequest('${row.id}')">
            Reject
          </button>
        </div>
      `;
    }

    if(status === "approved"){
      actionButtons = `
        <div class="action-row">
          <button class="btn approved disabled">
            Approved
          </button>
        </div>
      `;
    }

    if(status === "rejected"){
      actionButtons = `
        <div class="action-row">
          <button class="btn rejected disabled">
            Rejected
          </button>
        </div>
      `;
    }

    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <div class="req-head">

        <div>
          <div class="req-title">
            ${escapeHtml(row.project_name || "Untitled Project")}
          </div>

          <div class="req-user">
            👤 ${escapeHtml(row.pi_user || "-")}<br>
            🛠 ${escapeHtml(row.service_type || "-")}
          </div>
        </div>

        ${getStatusBadge(status)}

      </div>

      <div class="meta">
        🆔 ${escapeHtml(row.userid || "-")}<br>
        📅 ${
          row.created_at
          ? new Date(row.created_at).toLocaleString()
          : "-"
        }
      </div>

      <div class="desc">
        <strong>Description</strong><br>
        ${escapeHtml(row.description || "No description provided.")}
      </div>

      <div class="receipt-box">
        <div class="receipt-label">
          Payment Receipt
        </div>

        ${
          row.receipt_image
          ? `
            <img
              src="${row.receipt_image}"
              alt="Receipt">
          `
          : `
            <div class="small-muted">
              No receipt image uploaded.
            </div>
          `
        }

        ${
          row.receipt_ref
          ? `
            <div class="receipt-ref">
              <strong>Ref:</strong>
              ${escapeHtml(row.receipt_ref)}
            </div>
          `
          : ""
        }
      </div>

      <div class="note-area">
        <label for="${noteId}">
          Admin Note
        </label>

        <textarea
          id="${noteId}"
          class="note-input"
          placeholder="Write note for user...">${escapeHtml(row.admin_note || "")}</textarea>
      </div>

      ${
        row.admin_note
        ? `
          <div class="admin-note-box">
            <strong>Saved Note:</strong><br>
            ${escapeHtml(row.admin_note)}
          </div>
        `
        : ""
      }

      ${actionButtons}
    `;

    listBox.appendChild(card);
  });
}

/* ==========================
APPROVE REQUEST
========================== */
async function approveRequest(id){

  const noteEl =
    document.getElementById(`note_${id}`);

  const note =
    noteEl ? noteEl.value.trim() : "";

  const ok =
    confirm("Approve this dApp request?");

  if(!ok) return;

  try{

    const { error } =
      await window.supabaseClient
        .from("dapp_requests")
        .update({
          status:"approved",
          telegram_unlocked:true,
          admin_note:note,
          reviewed_at:new Date().toISOString()
        })
        .eq("id", id);

    if(error){
      console.error(error);
      alert(error.message || "Failed to approve request.");
      return;
    }

    loadRequests();

  }catch(err){
    console.error(err);
    alert("Network error while approving request.");
  }
}

/* ==========================
REJECT REQUEST
========================== */
async function rejectRequest(id){

  const noteEl =
    document.getElementById(`note_${id}`);

  const note =
    noteEl ? noteEl.value.trim() : "";

  const ok =
    confirm("Reject this dApp request?");

  if(!ok) return;

  try{

    const { error } =
      await window.supabaseClient
        .from("dapp_requests")
        .update({
          status:"rejected",
          telegram_unlocked:false,
          admin_note:note,
          reviewed_at:new Date().toISOString()
        })
        .eq("id", id);

    if(error){
      console.error(error);
      alert(error.message || "Failed to reject request.");
      return;
    }

    loadRequests();

  }catch(err){
    console.error(err);
    alert("Network error while rejecting request.");
  }
}

/* ==========================
START
========================== */
loadRequests();
