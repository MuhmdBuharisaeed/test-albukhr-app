const listBox = document.getElementById("adminList");

/* ==========================
LOAD REQUESTS
========================== */
async function loadRequests(){

listBox.innerHTML =
"<div class='empty'>Loading...</div>";

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
  "<div class='empty'>Failed to load requests</div>";

  return;
}

render(data || []);

}catch(err){

console.error(err);

listBox.innerHTML =
"<div class='empty'>Network error</div>";

}

}

/* ==========================
RENDER
========================== */
function render(rows){

if(!rows.length){

listBox.innerHTML =
"<div class='empty'>No requests found</div>";

return;

}

listBox.innerHTML = "";

rows.forEach(row=>{

const card =
document.createElement("div");

card.className = "card";

let actions = "";

if(row.status === "pending"){

  actions = `
    <button
      class="approve"
      onclick="approveRequest(${row.id})">
      Approve
    </button>

    <button
      class="reject"
      onclick="rejectRequest(${row.id})">
      Reject
    </button>
  `;
}

if(row.status === "approved"){

  actions = `
    <button
      class="btn approved">
      Approved
    </button>
  `;
}

if(row.status === "rejected"){

  actions = `
    <button
      class="btn rejected">
      Rejected
    </button>
  `;
}

card.innerHTML = `

  <strong>
    ${row.project_name || "-"}
  </strong>

  <div class="meta">
    👤 ${row.pi_user || "-"}
  </div>

  <div class="meta">
    🛠 ${row.service_type || "-"}
  </div>

  <div class="meta">
    📅 ${new Date(
      row.created_at
    ).toLocaleString()}
  </div>

  <div class="desc">
    ${row.description || ""}
  </div>

  <div class="receipt-box">

    <div>
      Ref:
      ${row.receipt_ref || "-"}
    </div>

    ${
      row.receipt_image
      ? `
      <img
        src="${row.receipt_image}">
      `
      : ""
    }

  </div>

  ${
    row.admin_note
    ? `
    <div class="note">
      ${row.admin_note}
    </div>
    `
    : ""
  }

  <div style="margin-top:10px">
    ${actions}
  </div>

`;

listBox.appendChild(card);

});

}

/* ==========================
APPROVE
========================== */
async function approveRequest(id){

const note =
prompt("Admin note (optional):") || "";

const { error } =
await window.supabaseClient
.from("dapp_requests")
.update({
status:"approved",
admin_note:note,
reviewed_at:
new Date().toISOString()
})
.eq("id", id);

if(error){

alert(error.message);

return;

}

loadRequests();

}

/* ==========================
REJECT
========================== */
async function rejectRequest(id){

const note =
prompt("Reason for rejection:") || "";

const { error } =
await window.supabaseClient
.from("dapp_requests")
.update({
status:"rejected",
admin_note:note,
reviewed_at:
new Date().toISOString()
})
.eq("id", id);

if(error){

alert(error.message);

return;

}

loadRequests();

}

/* ==========================
START
========================== */
loadRequests();
