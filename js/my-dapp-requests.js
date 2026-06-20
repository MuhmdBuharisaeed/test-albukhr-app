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
   GET CURRENT PI USER
   IMPORTANT:
   A NAN BA ZA MU KIRA ensurePiAuth() BA
========================= */
async function getCurrentPiUser(){

  // 1) localStorage first
  try{
    const local = localStorage.getItem("pi_user");

    if(local){
      const parsed = JSON.parse(local);

      if(parsed?.uid){
        return parsed;
      }
    }
  }catch(e){
    console.warn("localStorage parse failed:", e);
  }

  // 2) try Pi.getUser only
  if(window.Pi && Pi.getUser){
    try{
      const u = await Pi.getUser();

      if(u?.uid){

        const user = {
          uid: u.uid,
          username: u.username || ""
        };

        localStorage.setItem(
          "pi_user",
          JSON.stringify(user)
        );

        return user;
      }
    }catch(e){
      console.warn("Pi.getUser failed:", e);
    }
  }

  // 3) no ensurePiAuth here
  return null;
}

/* =========================
   LOAD MY REQUESTS
========================= */
async function loadMyRequests(){

  try{

    box.innerHTML = `
      <div class="empty">
        Loading requests...
      </div>
    `;

    const user = await getCurrentPiUser();

    if(!user?.uid){

      box.innerHTML = `
        <div class="empty">
          Please login with Pi Browser.
        </div>
      `;

      return;
    }

    console.log("MY REQUEST USER:", user);

    const { data, error } = await supabase
      .from("dapp_requests")
      .select("*")
      .eq("userid", user.uid)
      .order("created_at", { ascending:false });

    console.log("MY REQUEST DATA:", data);
    console.log("MY REQUEST ERROR:", error);

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

      /* =========================
         STATUS
      ========================= */
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

      /* =========================
         TELEGRAM LINK
      ========================= */
      if(r.status === "approved" && r.telegram_unlocked === true){
        telegram = `
          <a class="btn"
             href="https://t.me/+7A6IMz9PutMzZjVk"
             target="_blank">
             🔓 Join Private Telegram Group
          </a>
        `;
      }

      /* =========================
         ADMIN NOTE
      ========================= */
      if(r.admin_note && String(r.admin_note).trim() !== ""){
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

    console.error("my-dapp fatal error:", err);

    box.innerHTML = `
      <div class="empty">
        Something went wrong while loading your requests.
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
