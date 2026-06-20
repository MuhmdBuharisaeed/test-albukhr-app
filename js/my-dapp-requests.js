const supabase = window.supabase.createClient(
  "https://qexmnghilahsvethlxem.supabase.co",
  "sb_publishable_mSbWlhVKdmSjasKJC50QYw_5wzgRMe2"
);

const box = document.getElementById("list");

/* =========================
   ESCAPE HTML
========================= */
function escapeHtml(text = ""){
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* =========================
   GET USER
   MU GUJI ensurePiAuth NAN
========================= */
async function getCurrentPiUser(){

  let user = null;

  /* 1) Farko duba localStorage */
  try{
    const localUser = JSON.parse(localStorage.getItem("pi_user"));
    if(localUser?.uid){
      user = localUser;
    }
  }catch(e){
    console.warn("localStorage pi_user parse failed:", e);
  }

  /* 2) Idan babu, sai mu gwada Pi.getUser() */
  if(!user?.uid && window.Pi && typeof Pi.getUser === "function"){
    try{
      const piUser = await Pi.getUser();
      if(piUser?.uid){
        user = {
          uid: piUser.uid,
          username: piUser.username || ""
        };

        localStorage.setItem("pi_user", JSON.stringify(user));
      }
    }catch(e){
      console.warn("Pi.getUser failed:", e);
    }
  }

  return user;
}

/* =========================
   LOAD MY REQUESTS
========================= */
async function loadMyRequests(){

  box.innerHTML = `
    <div class="empty">
      Loading requests...
    </div>
  `;

  try{

    const user = await getCurrentPiUser();

    if(!user?.uid){
      box.innerHTML = `
        <div class="empty">
          Please login with Pi Browser.
        </div>
      `;
      return;
    }

    console.log("Current user uid:", user.uid);

    const { data, error } = await supabase
      .from("dapp_requests")
      .select("*")
      .eq("userid", user.uid)
      .order("created_at", { ascending:false });

    console.log("Supabase result:", data, error);

    if(error){
      console.error("loadMyRequests error:", error);

      box.innerHTML = `
        <div class="empty">
          Failed to load requests.
        </div>
      `;
      return;
    }

    if(!data || !data.length){
      box.innerHTML = `
        <div class="empty">
          You have not submitted any dApp request yet.
        </div>
      `;
      return;
    }

    box.innerHTML = "";

    data.forEach(r=>{

      let telegram = "";
      let adminNote = "";
      let statusText = "";
      let statusClass = "";

      /* STATUS */
      if(r.status === "pending"){
        statusText = "🟡 Under Review";
        statusClass = "pending";
      }else if(r.status === "approved"){
        statusText = "🟢 Approved";
        statusClass = "approved";
      }else if(r.status === "rejected"){
        statusText = "🔴 Rejected";
        statusClass = "rejected";
      }else{
        statusText = escapeHtml(r.status || "Unknown");
        statusClass = "";
      }

      /* TELEGRAM LINK */
      if(r.status === "approved" && r.telegram_unlocked){
        telegram = `
          <a class="btn"
             href="https://t.me/+7A6IMz9PutMzZjVk"
             target="_blank">
             🔓 Join Private Telegram Group
          </a>
        `;
      }

      /* ADMIN NOTE */
      if(r.admin_note){
        adminNote = `
          <div class="notice">
            <strong>📝 Admin Note:</strong><br>
            ${escapeHtml(r.admin_note)}
          </div>
        `;
      }

      box.innerHTML += `
        <div class="card">

          <strong>${escapeHtml(r.project_name || "Untitled Project")}</strong>

          <div class="meta">
            🛠 ${escapeHtml(r.service_type || "-")}<br>
            👤 ${escapeHtml(r.pi_user || "-")}
          </div>

          <div class="status ${statusClass}">
            ${statusText}
          </div>

          <div class="desc">
            <strong>Description:</strong><br>
            ${escapeHtml(r.description || "—")}
          </div>

          <div class="receipt">
            <strong>Payment Receipt:</strong><br>

            ${
              r.receipt_image
              ? `<img src="${r.receipt_image}" alt="Receipt">`
              : `<em>No receipt image</em>`
            }

            ${
              r.receipt_ref
              ? `
                <div style="font-size:12px;color:#666;margin-top:6px">
                  Ref: ${escapeHtml(r.receipt_ref)}
                </div>
              `
              : ""
            }
          </div>

          ${adminNote}
          ${telegram}

        </div>
      `;
    });

  }catch(err){
    console.error("loadMyRequests fatal error:", err);

    box.innerHTML = `
      <div class="empty">
        Something went wrong while loading requests.
      </div>
    `;
  }
}

/* =========================
   START
========================= */
window.addEventListener("DOMContentLoaded", ()=>{
  loadMyRequests();
});
