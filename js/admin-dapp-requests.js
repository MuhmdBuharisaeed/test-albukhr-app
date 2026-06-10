alert("ADMIN PANEL STARTED");

const supabaseUrl =
  "https://qexmnghilahsvethlxem.supabase.co";

const supabaseKey =
  "sb_publishable_mSbWlhVKdmSjasKJC50QYw_5wzgRMe2";

const supabase =
  window.supabase.createClient(
    supabaseUrl,
    supabaseKey
  );

const listBox =
  document.getElementById("adminList");

/* =========================
   LOAD REQUESTS
========================= */
async function loadRequests(){

  listBox.innerHTML =
    `<div class="empty">Loading...</div>`;

  try{

    const { data, error } =
      await supabase
      .from("dapp_requests")
      .select("*")
      .order("created_at", {
        ascending:false
      });

    if(error){
      throw error;
    }

    render(data || []);

  }catch(err){

    console.error(err);

    listBox.innerHTML = `
      <div class="empty">
        Failed to load requests
      </div>
    `;

    alert(
      "Supabase Error:\n" +
      err.message
    );
  }
}

/* =========================
   RENDER
========================= */
function render(list){

  if(!list.length){

    listBox.innerHTML = `
      <div class="empty">
        No dApp requests found
      </div>
    `;

    return;
  }

  listBox.innerHTML = "";

  list.forEach((r,index)=>{

    const status =
      r.status || "pending";

    listBox.innerHTML += `

    <div class="card">

      <strong>
        ${r.project_name || "Unnamed Project"}
      </strong>

      <div class="meta">
        👤 ${r.pi_user || "-"}<br>
        🛠 ${r.service_type || "-"}<br>
        📅 ${r.created_at || "-"}
      </div>

      <div class="desc">
        <strong>Description:</strong><br>
        ${r.description || "—"}
      </div>

      <div class="receipt-box">

        <strong>Receipt</strong><br>

        ${
          r.receipt_image
          ? `
            <img
              src="${r.receipt_image}"
              style="
                width:100%;
                border-radius:10px;
                margin-top:8px;
              "
            >
          `
          : `<em>No receipt uploaded</em>`
        }

        <div style="margin-top:6px">
          Ref:
          ${r.receipt_ref || "—"}
        </div>

      </div>

      ${
        r.admin_note
        ? `
          <div class="note">
            <strong>Admin Note:</strong><br>
            ${r.admin_note}
          </div>
        `
        : ""
      }

      <div style="margin-top:12px">

        ${
          status === "pending"
          ? `
            <button
              class="approve"
              onclick="approveRequest('${r.id}')">
              Approve
            </button>

            <button
              class="reject"
              onclick="rejectRequest('${r.id}')">
              Reject
            </button>
          `
          : status === "approved"
          ? `
            <button
              class="btn approved">
              ✓ Approved
            </button>
          `
          : `
            <button
              class="btn rejected">
              ✗ Rejected
            </button>
          `
        }

      </div>

    </div>

    `;
  });
}

/* =========================
   APPROVE
========================= */
async function approveRequest(id){

  const { error } =
    await supabase
    .from("dapp_requests")
    .update({
      status:"approved",
      telegram_unlocked:true,
      reviewed_at:
        new Date().toISOString()
    })
    .eq("id", id);

  if(error){

    alert(
      "Approval failed:\n" +
      error.message
    );

    return;
  }

  alert("Approved");

  loadRequests();
}

/* =========================
   REJECT
========================= */
async function rejectRequest(id){

  const note =
    prompt(
      "Reason for rejection"
    ) || "";

  const { error } =
    await supabase
    .from("dapp_requests")
    .update({
      status:"rejected",
      admin_note:note,
      reviewed_at:
        new Date().toISOString()
    })
    .eq("id", id);

  if(error){

    alert(
      "Reject failed:\n" +
      error.message
    );

    return;
  }

  alert("Rejected");

  loadRequests();
}

/* =========================
   START
========================= */
loadRequests();
