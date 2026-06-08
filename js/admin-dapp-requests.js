const supabase = window.supabase.createClient(
  "https://qexmnghilahsvethlxem.supabase.co",
  "sb_publishable_mSbWlhVKdmSjasKJC50QYw_5wzgRMe2"
);

const listBox = document.getElementById("adminList");

let list = [];

/* =========================
   LOAD REQUESTS
========================= */
async function loadRequests(){

  const { data, error } = await supabase
    .from("dapp_requests")
    .select("*")
    .order("created_at", { ascending:false });

  console.log("DATA =", data);
  console.log("ERROR =", error);

  if(error){

  alert(
    "ERROR: " +
    JSON.stringify(error)
  );

  listBox.innerHTML =
    `<div class="empty">Failed to load requests</div>`;

  return;
  }

  const { data, error } = await supabase
  .from("dapp_requests")
  .select("*")
  .order("created_at", { ascending:false });

if(error){

  alert(
    "ERROR:\n" +
    JSON.stringify(error)
  );

  return;
}

alert(
  "Records found: " +
  data.length
);

list = data || [];

render();

/* =========================
   RENDER
========================= */
function render(){

  listBox.innerHTML = "";

  if(list.length === 0){

    listBox.innerHTML =
      `<div class="empty">No dApp requests yet</div>`;

    return;
  }

  list.forEach((r,i)=>{

    listBox.innerHTML += `
      <div class="card">

        <strong>${r.project_name || "Unnamed Project"}</strong>

        <div class="meta">
          👤 ${r.pi_user || "-"}<br>
          🛠 ${r.service_type || "-"}
        </div>

        <div class="desc">
          <strong>Description:</strong><br>
          ${r.description || "—"}
        </div>

        <div class="receipt-box">
          <strong>💳 Payment Receipt</strong><br>

          ${
            r.receipt_image
            ? `
              <img src="${r.receipt_image}">
              <div style="color:#666;margin-top:4px">
                Ref: ${r.receipt_ref || "—"}
              </div>
            `
            : `<em>No receipt uploaded</em>`
          }

        </div>

        ${
          r.admin_note
          ? `
            <div class="note">
              <strong>Admin note:</strong>
              ${r.admin_note}
            </div>
          `
          : ``
        }

        <div style="margin-top:12px">

          ${
            r.status === "pending"
            ? `
              <button
                class="approve"
                onclick="approve(${i})">
                Approve
              </button>

              <button
                class="reject"
                onclick="rejectReq(${i})">
                Reject
              </button>
            `
            : r.status === "approved"
            ? `
              <button class="btn approved disabled">
                ✓ Approved
              </button>
            `
            : `
              <button class="btn rejected disabled">
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
async function approve(i){

  const request = list[i];

  if(request.status !== "pending")
    return;

  const { error } = await supabase
    .from("dapp_requests")
    .update({
      status:"approved",
      telegram_unlocked:true,
      reviewed_at:new Date().toISOString()
    })
    .eq("id", request.id);

  if(error){

    console.error(error);

    alert("Approval failed");

    return;
  }

  alert("Request approved");

  loadRequests();
}

/* =========================
   REJECT
========================= */
async function rejectReq(i){

  const request = list[i];

  if(request.status !== "pending")
    return;

  const note =
    prompt("Reason for rejection") || "";

  const { error } = await supabase
    .from("dapp_requests")
    .update({
      status:"rejected",
      admin_note:note,
      reviewed_at:new Date().toISOString()
    })
    .eq("id", request.id);

  if(error){

    console.error(error);

    alert("Reject failed");

    return;
  }

  alert("Request rejected");

  loadRequests();
}

/* =========================
   INIT
========================= */
loadRequests();
