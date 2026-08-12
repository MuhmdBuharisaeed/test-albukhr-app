/* =========================================
   ALBUKHR – MY dApp REQUESTS
   SUPABASE REST VERSION
   Compatible with PI dApp ENGINE
========================================= */

(() => {

  "use strict";


  /* =========================================
     CONFIG
  ========================================== */

  const SUPABASE_URL =
    "https://qexmnghilahsvethlxem.supabase.co";

  const SUPABASE_KEY =
    "sb_publishable_mSbWlhVKdmSjasKJC50QYw_5wzgRMe2";

  const TABLE =
    "dapp_requests";

  const REQUEST_TIMEOUT =
    15000;


  /* =========================================
     DOM
  ========================================== */

  const box =
    document.getElementById("list");


  /* =========================================
     HTML ESCAPE
  ========================================== */

  function escapeHtml(text = "") {

    return String(text)

      .replace(/&/g, "&amp;")

      .replace(/</g, "&lt;")

      .replace(/>/g, "&gt;")

      .replace(/"/g, "&quot;")

      .replace(/'/g, "&#039;");

  }


  /* =========================================
     UI MESSAGE
  ========================================== */

  function showStage(
    title,
    message
  ) {

    if (!box) return;

    box.innerHTML = `
      <div class="empty">

        <strong>
          ${escapeHtml(title)}
        </strong>

        <br><br>

        ${escapeHtml(message)}

      </div>
    `;

  }


  /* =========================================
     FETCH WITH TIMEOUT
  ========================================== */

  async function fetchWithTimeout(
    url,
    options = {},
    timeout = REQUEST_TIMEOUT
  ) {

    const controller =
      new AbortController();

    const timer =
      setTimeout(
        () => controller.abort(),
        timeout
      );

    try {

      return await fetch(
        url,
        {
          ...options,
          signal:
            controller.signal
        }
      );

    } finally {

      clearTimeout(timer);

    }

  }


  /* =========================================
     GET CURRENT PI USER
     
     SAME AUTHORITY AS OLD ENGINE:
     
     1. localStorage
     2. Pi.getUser()
     3. ensurePiAuth()
  ========================================= */

  async function getCurrentUser() {

    /* ---------------------------------------
       STEP 1
       LOCAL STORAGE
    --------------------------------------- */

    try {

      const local =
        localStorage.getItem(
          "pi_user"
        );

      console.log(
        "ALBUKHR localStorage pi_user:",
        local
      );


      if (local) {

        const parsed =
          JSON.parse(local);


        if (parsed?.uid) {

          console.log(
            "ALBUKHR local user found:",
            parsed.uid
          );


          return {

            uid:
              parsed.uid,

            username:
              parsed.username || ""

          };

        }

      }

    } catch (error) {

      console.warn(
        "localStorage pi_user parse failed:",
        error
      );

    }


    /* ---------------------------------------
       STEP 2
       PI GET USER
    --------------------------------------- */

    if (
      window.Pi &&
      typeof Pi.getUser ===
        "function"
    ) {

      try {

        console.log(
          "Trying Pi.getUser()..."
        );


        const piUser =
          await Pi.getUser();


        console.log(
          "Pi.getUser result:",
          piUser
        );


        if (piUser?.uid) {

          const user = {

            uid:
              piUser.uid,

            username:
              piUser.username || ""

          };


          localStorage.setItem(
            "pi_user",
            JSON.stringify(user)
          );


          return user;

        }

      } catch (error) {

        console.warn(
          "Pi.getUser failed:",
          error
        );

      }

    }


    /* ---------------------------------------
       STEP 3
       SHARED PI AUTH
    --------------------------------------- */

    if (
      typeof window.ensurePiAuth ===
      "function"
    ) {

      try {

        console.log(
          "Trying ensurePiAuth()..."
        );


        const authUser =
          await window.ensurePiAuth();


        console.log(
          "ensurePiAuth result:",
          authUser
        );


        if (authUser?.uid) {

          const user = {

            uid:
              authUser.uid,

            username:
              authUser.username || ""

          };


          localStorage.setItem(
            "pi_user",
            JSON.stringify(user)
          );


          return user;

        }

      } catch (error) {

        console.error(
          "ensurePiAuth failed:",
          error
        );

      }

    }


    return null;

  }


  /* =========================================
     LOAD USER REQUESTS
     
     DIRECT SUPABASE REST API
     
     NO window.albukhrSupabase
     NO window.supabase.createClient()
  ========================================= */

  async function loadMyRequests() {

    showStage(
      "Loading",
      "Loading requests..."
    );


    try {

      /* -------------------------------------
         USER
      ------------------------------------- */

      const user =
        await getCurrentUser();


      if (!user?.uid) {

        showStage(
          "Login Required",
          "Please login with Pi Browser."
        );

        return;

      }


      console.log(
        "ALBUKHR current Pi UID:",
        user.uid
      );


      /* -------------------------------------
         BUILD REST URL
      ------------------------------------- */

      const url =
        `${SUPABASE_URL}/rest/v1/${TABLE}` +
        `?select=*` +
        `&userid=eq.${encodeURIComponent(user.uid)}` +
        `&order=created_at.desc`;


      console.log(
        "ALBUKHR Supabase request URL:",
        url
      );


      /* -------------------------------------
         SUPABASE REST REQUEST
      ------------------------------------- */

      const response =
        await fetchWithTimeout(

          url,

          {

            method:
              "GET",

            headers: {

              "apikey":
                SUPABASE_KEY,

              "Authorization":
                `Bearer ${SUPABASE_KEY}`,

              "Accept":
                "application/json"

            }

          }

        );


      /* -------------------------------------
         HTTP ERROR
      ------------------------------------- */

      if (!response.ok) {

        const errorText =
          await response.text();


        console.error(
          "Supabase REST error:",
          response.status,
          errorText
        );


        showStage(
          "Failed to Load",
          `Supabase returned HTTP ${response.status}.`
        );


        return;

      }


      /* -------------------------------------
         JSON
      ------------------------------------- */

      const data =
        await response.json();


      console.log(
        "ALBUKHR dapp_requests result:",
        data
      );


      /* -------------------------------------
         NO DATA
      ------------------------------------- */

      if (
        !Array.isArray(data) ||
        data.length === 0
      ) {

        showStage(
          "No Requests",
          "You have not submitted any dApp request yet."
        );


        return;

      }


      /* -------------------------------------
         RENDER
      ------------------------------------- */

      renderRequests(data);


    } catch (error) {

      console.error(
        "loadMyRequests fatal error:",
        error
      );


      if (
        error?.name ===
        "AbortError"
      ) {

        showStage(
          "Connection Timeout",
          "Supabase took too long to respond. Please try again."
        );


        return;

      }


      showStage(
        "Something Went Wrong",
        "Unable to load your dApp requests. Please try again."
      );

    }

  }


  /* =========================================
     RENDER REQUESTS
  ========================================= */

  function renderRequests(
    requests
  ) {

    if (!box) return;


    box.innerHTML = "";


    requests.forEach(
      (request) => {

        box.insertAdjacentHTML(
          "beforeend",
          createRequestCard(
            request
          )
        );

      }
    );

  }


  /* =========================================
     CREATE REQUEST CARD
  ========================================= */

  function createRequestCard(
    r
  ) {

    /* ---------------------------------------
       STATUS
    --------------------------------------- */

    let statusText =
      "Unknown";

    let statusClass =
      "";


    if (
      r.status ===
      "pending"
    ) {

      statusText =
        "🟡 Under Review";

      statusClass =
        "pending";

    }

    else if (
      r.status ===
      "approved"
    ) {

      statusText =
        "🟢 Approved";

      statusClass =
        "approved";

    }

    else if (
      r.status ===
      "rejected"
    ) {

      statusText =
        "🔴 Rejected";

      statusClass =
        "rejected";

    }

    else {

      statusText =
        escapeHtml(
          r.status ||
          "Unknown"
        );

    }


    /* ---------------------------------------
       TELEGRAM
    --------------------------------------- */

    let telegram =
      "";


    if (
      r.status ===
      "approved" &&
      r.telegram_unlocked ===
      true
    ) {

      telegram = `

        <a
          class="btn"
          href="https://t.me/+7A6IMz9PutMzZjVk"
          target="_blank"
          rel="noopener noreferrer"
        >

          🔓 Join Private Telegram Group

        </a>

      `;

    }


    /* ---------------------------------------
       ADMIN NOTE
    --------------------------------------- */

    let adminNote =
      "";


    if (r.admin_note) {

      adminNote = `

        <div class="notice">

          <strong>
            📝 Admin Note:
          </strong>

          <br>

          ${escapeHtml(
            r.admin_note
          )}

        </div>

      `;

    }


    /* ---------------------------------------
       RECEIPT IMAGE
    --------------------------------------- */

    let receipt =
      "";


    if (r.receipt_image) {

      receipt = `

        <img
          src="${escapeHtml(
            r.receipt_image
          )}"
          alt="Payment Receipt"
          style="
            max-width:100%;
            height:auto;
            border-radius:10px;
            margin-top:8px;
          "
        >

      `;

    } else {

      receipt = `

        <em>
          No receipt image
        </em>

      `;

    }


    /* ---------------------------------------
       RECEIPT REFERENCE
    --------------------------------------- */

    let receiptRef =
      "";


    if (r.receipt_ref) {

      receiptRef = `

        <div
          style="
            font-size:12px;
            color:#666;
            margin-top:6px;
          "
        >

          Ref:
          ${escapeHtml(
            r.receipt_ref
          )}

        </div>

      `;

    }


    /* ---------------------------------------
       DATE
    --------------------------------------- */

    let createdAt =
      "";


    if (r.created_at) {

      try {

        createdAt =
          new Date(
            r.created_at
          ).toLocaleString();

      } catch (_) {

        createdAt =
          escapeHtml(
            r.created_at
          );

      }

    }


    /* ---------------------------------------
       CARD
    --------------------------------------- */

    return `

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
            r.service_type ||
            "-"
          )}

          <br>

          👤
          ${escapeHtml(
            r.pi_user ||
            "-"
          )}

          ${
            createdAt
              ? `
                <br>
                🕒
                ${escapeHtml(
                  createdAt
                )}
              `
              : ""
          }

        </div>


        <div
          class="status ${statusClass}"
        >

          ${statusText}

        </div>


        <div class="desc">

          <strong>
            Description:
          </strong>

          <br>

          ${escapeHtml(
            r.description ||
            "—"
          )}

        </div>


        <div class="receipt">

          <strong>
            Payment Receipt:
          </strong>

          <br>

          ${receipt}

          ${receiptRef}

        </div>


        ${adminNote}

        ${telegram}

      </div>

    `;

  }


  /* =========================================
     START
  ========================================== */

  function start() {

    console.log(
      "================================="
    );

    console.log(
      "ALBUKHR My dApp Requests started"
    );

    console.log(
      "Supabase REST mode"
    );

    console.log(
      "Table:",
      TABLE
    );

    console.log(
      "================================="
    );


    loadMyRequests();

  }


  /* =========================================
     DOM READY
  ========================================== */

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      start
    );

  } else {

    start();

  }


})();
