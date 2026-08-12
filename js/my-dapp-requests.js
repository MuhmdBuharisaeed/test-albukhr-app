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

function showStage(title, message){

  box.innerHTML = `
    <div class="empty">

      <strong>${escapeHtml(title)}</strong>

      <br><br>

      ${escapeHtml(message)}

    </div>
  `;

}

/* =========================================
   TIMEOUT WRAPPER
========================================= */

function withTimeout(promise, ms, label){

  return Promise.race([

    promise,

    new Promise((_, reject)=>{

      setTimeout(()=>{

        reject(
          new Error(
            label + " timed out after " + ms + "ms"
          )
        );

      }, ms);

    })

  ]);

}

/* =========================================
   AUTH DIAGNOSTIC
========================================= */

async function getCurrentPiUser(){

  showStage(
    "STEP 1",
    "Checking local Pi user..."
  );

  let user = null;

  /* ===============================
     LOCAL STORAGE
  =============================== */

  try{

    const raw =
      localStorage.getItem("pi_user");

    console.log("localStorage pi_user:", raw);

    if(raw){

      const localUser =
        JSON.parse(raw);

      if(localUser?.uid){

        user = localUser;

      }

    }

  }catch(e){

    console.warn(
      "localStorage error:",
      e
    );

  }

  /* ===============================
     LOCAL USER FOUND
  =============================== */

  if(user?.uid){

    showStage(
      "STEP 2",
      "Local Pi user found. UID: " +
      user.uid
    );

    return user;

  }

  /* ===============================
     NO LOCAL USER
  =============================== */

  showStage(
    "STEP 2",
    "No local Pi user found. Checking Pi SDK..."
  );

  /* ===============================
     PI SDK
  =============================== */

  if(!window.Pi){

    throw new Error(
      "Pi SDK is not available on this page."
    );

  }

  if(
    typeof Pi.getUser !== "function"
  ){

    throw new Error(
      "Pi.getUser() is not available in this Pi SDK."
    );

  }

  showStage(
    "STEP 3",
    "Calling Pi.getUser()..."
  );

  let piUser;

  try{

    piUser =
      await withTimeout(
        Pi.getUser(),
        8000,
        "Pi.getUser()"
      );

  }catch(e){

    throw new Error(
      e?.message ||
      "Pi.getUser() failed."
    );

  }

  console.log(
    "Pi.getUser result:",
    piUser
  );

  if(!piUser?.uid){

    throw new Error(
      "Pi.getUser() returned no UID."
    );

  }

  user = {

    uid: piUser.uid,

    username:
      piUser.username || ""

  };

  localStorage.setItem(
    "pi_user",
    JSON.stringify(user)
  );

  return user;

}

/* =========================================
   LOAD REQUESTS
========================================= */

async function loadMyRequests(){

  showStage(
    "STARTING",
    "Preparing My dApp Requests..."
  );

  try{

    /* ===============================
       AUTH
    =============================== */

    const user =
      await getCurrentPiUser();

    showStage(
      "STEP 4",
      "Pi user loaded. UID: " +
      user.uid +
      "\n\nConnecting to Supabase..."
    );

    /* ===============================
       SUPABASE
    =============================== */

    const result =
      await withTimeout(

        supabase
          .from("dapp_requests")
          .select(
            "id, userid, pi_user, project_name, service_type, status, created_at"
          )
          .order(
            "created_at",
            {
              ascending:false
            }
          ),

        10000,

        "Supabase request"

      );

    const {
      data,
      error
    } = result;

    if(error){

      throw new Error(
        "Supabase error: " +
        error.message
      );

    }

    showStage(
      "STEP 5",
      "Supabase connected.\n\n" +
      "Total requests found: " +
      (data?.length || 0) +
      "\n\nCurrent UID:\n" +
      user.uid
    );

    /* ===============================
       FILTER
    =============================== */

    const matches =
      (data || []).filter(
        row =>
          String(row.userid) ===
          String(user.uid)
      );

    console.log(
      "Current user:",
      user
    );

    console.log(
      "All requests:",
      data
    );

    console.log(
      "Matching requests:",
      matches
    );

    /* ===============================
       FINAL RESULT
    =============================== */

    if(!matches.length){

      box.innerHTML = `

        <div class="empty">

          <strong>
            No requests found for this account.
          </strong>

          <br><br>

          UID:

          <br>

          ${escapeHtml(user.uid)}

          <br><br>

          Supabase records:

          ${data?.length || 0}

        </div>

      `;

      return;

    }

    box.innerHTML = "";

    matches.forEach(r=>{

      box.innerHTML += `

        <div class="card">

          <strong>
            ${escapeHtml(
              r.project_name ||
              "Untitled Project"
            )}
          </strong>

          <div class="meta">

            🛠
            ${escapeHtml(
              r.service_type || "-"
            )}

            <br>

            👤
            ${escapeHtml(
              r.pi_user || "-"
            )}

          </div>

          <div class="status">

            ${escapeHtml(
              r.status || "pending"
            )}

          </div>

        </div>

      `;

    });

  }catch(error){

    console.error(
      "MY DAPP ERROR:",
      error
    );

    box.innerHTML = `

      <div class="empty">

        <strong>
          ❌ Diagnostic stopped
        </strong>

        <br><br>

        ${escapeHtml(
          error?.message ||
          "Unknown error"
        )}

      </div>

    `;

  }

}

/* =========================================
   START
========================================= */

window.addEventListener(
  "DOMContentLoaded",
  ()=>{
    loadMyRequests();
  }
);
