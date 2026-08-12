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
      Checking authentication...
    </div>
  `;

  try{

    const user = await getCurrentPiUser();

    console.log("=================================");
    console.log("MY DAPP DEBUG");
    console.log("=================================");

    console.log("Current user object:", user);
    console.log("Current UID:", user?.uid);
    console.log("Current username:", user?.username);

    const { data, error } = await supabase
      .from("dapp_requests")
      .select("id, userid, pi_user, project_name, status, created_at")
      .order("created_at", {
        ascending:false
      });

    console.log("ALL dApp REQUESTS:", data);
    console.log("SUPABASE ERROR:", error);

    if(error){

      box.innerHTML = `
        <div class="empty">
          Supabase error: ${escapeHtml(error.message)}
        </div>
      `;

      return;
    }

    const matches = (data || []).filter(
      r => String(r.userid) === String(user?.uid)
    );

    console.log("MATCHING REQUESTS:", matches);

    box.innerHTML = `
      <div class="card">

        <strong>Authentication Diagnostic</strong>

        <p>
          <b>UID:</b><br>
          ${escapeHtml(user?.uid || "NO UID")}
        </p>

        <p>
          <b>Username:</b><br>
          ${escapeHtml(user?.username || "NO USERNAME")}
        </p>

        <p>
          <b>Total Supabase Requests:</b>
          ${data?.length || 0}
        </p>

        <p>
          <b>Requests Matching Current UID:</b>
          ${matches.length}
        </p>

      </div>
    `;

  }catch(err){

    console.error(
      "MY DAPP DEBUG ERROR:",
      err
    );

    box.innerHTML = `
      <div class="empty">
        ${escapeHtml(err?.message || "Unknown error")}
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
