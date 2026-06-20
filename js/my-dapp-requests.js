alert("MY-DAPP-REQUESTS JS LOADED");
console.log("MY-DAPP-REQUESTS JS LOADED");

const supabase = window.supabase.createClient(
  "https://qexmnghilahsvethlxem.supabase.co",
  "sb_publishable_mSbWlhVKdmSjasKJC50QYw_5wzgRMe2"
);

const box = document.getElementById("list");

function escapeHtml(text = ""){
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function getCurrentPiUser(){

  alert("STEP 1: getCurrentPiUser started");

  // localStorage first
  try{
    const local = localStorage.getItem("pi_user");
    alert("STEP 2: localStorage = " + local);

    if(local){
      const parsed = JSON.parse(local);

      if(parsed?.uid){
        alert("STEP 3: user found in localStorage");
        return parsed;
      }
    }
  }catch(e){
    alert("STEP 2 ERROR: " + e.message);
  }

  // Pi.getUser fallback
  if(window.Pi && typeof Pi.getUser === "function"){
    try{
      alert("STEP 4: calling Pi.getUser()");
      const u = await Pi.getUser();
      alert("STEP 5: Pi.getUser finished");

      if(u?.uid){
        const user = {
          uid: u.uid,
          username: u.username || ""
        };

        localStorage.setItem("pi_user", JSON.stringify(user));
        alert("STEP 6: user saved from Pi.getUser");
        return user;
      }

    }catch(e){
      alert("STEP 4 ERROR: " + e.message);
    }
  }else{
    alert("STEP 4: Pi.getUser not available");
  }

  alert("STEP 7: no user found");
  return null;
}

async function loadMyRequests(){

  box.innerHTML = `
    <div class="empty">Loading requests...</div>
  `;

  try{

    alert("A: loadMyRequests started");

    if(typeof initPi === "function"){
      alert("B: initPi exists, starting...");
      await initPi();
      alert("C: initPi finished");
    }else{
      alert("B: initPi NOT found");
    }

    const user = await getCurrentPiUser();
    alert("D: user result = " + JSON.stringify(user));

    if(!user?.uid){
      box.innerHTML = `
        <div class="empty">
          Please login with Pi Browser.
        </div>
      `;
      return;
    }

    alert("E: starting Supabase query");

    const { data, error } = await supabase
      .from("dapp_requests")
      .select("*")
      .eq("userid", user.uid)
      .order("created_at", { ascending:false });

    alert("F: Supabase query finished");

    if(error){
      alert("G: Supabase error = " + error.message);
      console.error(error);

      box.innerHTML = `
        <div class="empty">
          Failed to load requests.
        </div>
      `;
      return;
    }

    alert("H: rows = " + (data ? data.length : 0));

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

      if(r.status === "approved" && r.telegram_unlocked === true){
        telegram = `
          <a class="btn"
             href="https://t.me/+7A6IMz9PutMzZjVk"
             target="_blank">
             🔓 Join Private Telegram Group
          </a>
        `;
      }

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

    alert("I: render finished");

  }catch(err){
    alert("FATAL ERROR: " + err.message);
    console.error(err);

    box.innerHTML = `
      <div class="empty">
        Something went wrong while loading your requests.
      </div>
    `;
  }
}

window.addEventListener("DOMContentLoaded", ()=>{
  loadMyRequests();
});
