/* =========================================
   ALBUKHR – MY dApp REQUESTS v4
   SUPABASE REST VERSION
   PI dApp ENGINE COMPATIBLE
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
          signal: controller.signal
        }
      );

    } finally {

      clearTimeout(timer);

    }

  }


  /* =========================================
     CURRENT PI USER
  ========================================== */

  async function getCurrentUser() {

    /* ---------------------------------------
       LOCAL STORAGE
    --------------------------------------- */

    try {

      const local =
        localStorage.getItem("pi_user");

      console.log(
        "ALBUKHR localStorage pi_user:",
        local
      );


      if (local) {

        const parsed =
          JSON.parse(local);


        if (parsed?.uid) {

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
       PI GET USER
    --------------------------------------- */

    if (
      window.Pi &&
      typeof Pi.getUser === "function"
    ) {

      try {

        const piUser =
          await Pi.getUser();


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
       SHARED PI AUTH
    --------------------------------------- */

    if (
      typeof window.ensurePiAuth ===
      "function"
    ) {

      try {

        const authUser =
          await window.ensurePiAuth();


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
  ========================================== */

  async function loadMyRequests() {

    showStage(
      "Loading",
      "Loading requests..."
    );


    try {

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
         REST URL
      ------------------------------------- */

      const url =
        `${SUPABASE_URL}/rest/v1/${TABLE}` +
        `?select=*` +
        `&userid=eq.${encodeURIComponent(user.uid)}` +
        `&order=created_at.desc`;


      /* -------------------------------------
         REQUEST
      ------------------------------------- */

      const response =
        await fetchWithTimeout(

          url,

          {

            method:"GET",

            headers:{

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


      renderRequests(data);


    } catch (error) {

      console.error(
        "loadMyRequests fatal error:",
        error
      );


      if (
        error?.name === "AbortError"
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
  ========================================== */

  function renderRequests(requests) {

    if (!box) return;

    box.innerHTML = "";

    requests.forEach(
      request => {

        box.insertAdjacentHTML(
          "beforeend",
          createRequestCard(request)
        );

      }
    );

  }


  /* =========================================
     CREATE SEE MORE BLOCK
  ========================================== */

  function createExpandableText(
    text,
    prefix = "description"
  ) {

    const safeText =
      escapeHtml(text || "—");

    /*
     * Very short text does not need
     * See More.
     */

    if (
      String(text || "").length <= 240
    ) {

      return `
        <div class="desc-content">
          ${safeText}
        </div>
      `;

    }


    const uniqueId =
      `${prefix}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2,8)}`;


    return `

      <div
        id="${uniqueId}"
        class="desc-content collapsed"
      >
        ${safeText}
      </div>

      <button
        type="button"
        class="see-more-btn"
        data-target="${uniqueId}"
        aria-expanded="false"
      >
        See More
      </button>

    `;

  }


  /* =========================================
     CREATE ADMIN NOTE
  ========================================== */

  function createAdminNote(
    note
  ) {

    if (!note) return "";


    const safeNote =
      escapeHtml(note);


    if (
      String(note).length <= 240
    ) {

      return `

        <div class="notice">

          <strong>
            📝 Admin Note:
          </strong>

          <br>

          <div class="notice-content">
            ${safeNote}
          </div>

        </div>

      `;

    }


    const uniqueId =
      `admin_note_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2,8)}`;


    return `

      <div class="notice">

        <strong>
          📝 Admin Note:
        </strong>

        <br>

        <div
          id="${uniqueId}"
          class="notice-content collapsed"
        >
          ${safeNote}
        </div>

        <button
          type="button"
          class="see-more-btn"
          data-target="${uniqueId}"
          aria-expanded="false"
        >
          See More
        </button>

      </div>

    `;

  }


  /* =========================================
     CREATE REQUEST CARD
  ========================================== */

  function createRequestCard(r) {

    /* ---------------------------------------
       STATUS
    --------------------------------------- */

    let statusText =
      "Unknown";

    let statusClass =
      "";


    if (r.status === "pending") {

      statusText =
        "🟡 Under Review";

      statusClass =
        "pending";

    }

    else if (r.status === "approved") {

      statusText =
        "🟢 Approved";

      statusClass =
        "approved";

    }

    else if (r.status === "rejected") {

      statusText =
        "🔴 Rejected";

      statusClass =
        "rejected";

    }

    else {

      statusText =
        escapeHtml(
          r.status || "Unknown"
        );

    }


    /* ---------------------------------------
       TELEGRAM
    --------------------------------------- */

    let telegram = "";


    if (
      r.status === "approved" &&
      r.telegram_unlocked === true
    ) {

      telegram = `

        <a
          class="btn"
          href="https://t.me/+u2cpwJfEBSA4NmNk"
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

    const adminNote =
      createAdminNote(
        r.admin_note
      );


    /* ---------------------------------------
       RECEIPT
    --------------------------------------- */

    let receipt = "";


    if (r.receipt_image) {

      receipt = `

        <img
          src="${escapeHtml(
            r.receipt_image
          )}"
          alt="Payment Receipt"
          loading="lazy"
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

    let receiptRef = "";


    if (r.receipt_ref) {

      receiptRef = `

        <div class="receipt-ref">

          <strong>
            Ref:
          </strong>

          ${escapeHtml(
            r.receipt_ref
          )}

        </div>

      `;

    }


    /* ---------------------------------------
       DATE
    --------------------------------------- */

    let createdAt = "";


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
       DESCRIPTION
    --------------------------------------- */

    const description =
      createExpandableText(
        r.description || "—",
        "description"
      );


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
            r.service_type || "-"
          )}

          <br>

          👤
          ${escapeHtml(
            r.pi_user || "-"
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


        <div class="status ${statusClass}">

          ${statusText}

        </div>


        <!-- DESCRIPTION -->

        <div class="desc">

          <span class="desc-title">
            Description
          </span>

          ${description}

        </div>


        <!-- RECEIPT -->

        <div class="receipt">

          <strong>
            🧾 Payment Receipt
          </strong>

          ${receipt}

          ${receiptRef}

        </div>


        <!-- ADMIN NOTE -->

        ${adminNote}


        <!-- TELEGRAM -->

        ${telegram}

      </div>

    `;

  }


  /* =========================================
     SEE MORE / SEE LESS
  ========================================== */

  function handleSeeMore(event) {

    const button =
      event.target.closest(
        ".see-more-btn"
      );


    if (!button) return;


    const targetId =
      button.dataset.target;


    if (!targetId) return;


    const target =
      document.getElementById(
        targetId
      );


    if (!target) return;


    const expanded =
      button.getAttribute(
        "aria-expanded"
      ) === "true";


    if (expanded) {

      target.classList.add(
        "collapsed"
      );

      button.setAttribute(
        "aria-expanded",
        "false"
      );

      button.textContent =
        "See More";

    } else {

      target.classList.remove(
        "collapsed"
      );

      button.setAttribute(
        "aria-expanded",
        "true"
      );

      button.textContent =
        "See Less";

    }

  }


  /* =========================================
     EVENT DELEGATION
  ========================================== */

  if (box) {

    box.addEventListener(
      "click",
      handleSeeMore
    );

  }


  /* =========================================
     START
  ========================================== */

  function start() {

    console.log(
      "================================="
    );

    console.log(
      "ALBUKHR My dApp Requests v4"
    );

    console.log(
      "Supabase REST mode"
    );

    console.log(
      "See More system enabled"
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
    document.readyState === "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      start
    );

  } else {

    start();

  }


})();
