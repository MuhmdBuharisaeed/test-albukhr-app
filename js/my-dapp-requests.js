/* =========================================
   ALBUKHR – MY dApp REQUESTS v4
   USER REQUEST HISTORY
========================================= */

(() => {

  "use strict";

  const TABLE = "dapp_requests";

  const box = document.getElementById("list");

  let loading = false;


  /* =========================================
     DOM
  ========================================= */

  function $(id) {
    return document.getElementById(id);
  }


  /* =========================================
     ESCAPE HTML
  ========================================= */

  function escapeHtml(value = "") {

    return String(value)

      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  }


  /* =========================================
     STATUS
  ========================================= */

  function getStatus(status) {

    const value =
      String(status || "unknown")
        .toLowerCase();

    if (value === "pending") {

      return {
        text: "🟡 Under Review",
        className: "pending"
      };

    }

    if (value === "approved") {

      return {
        text: "🟢 Approved",
        className: "approved"
      };

    }

    if (value === "rejected") {

      return {
        text: "🔴 Rejected",
        className: "rejected"
      };

    }

    return {
      text: escapeHtml(
        status || "Unknown"
      ),
      className: ""
    };

  }


  /* =========================================
     LOADING
  ========================================= */

  function renderLoading(message) {

    if (!box) return;

    box.innerHTML = `

      <div class="empty">

        <div>
          ⏳
        </div>

        <strong>
          ${escapeHtml(message)}
        </strong>

      </div>

    `;

  }


  /* =========================================
     EMPTY
  ========================================= */

  function renderEmpty() {

    if (!box) return;

    box.innerHTML = `

      <div class="empty">

        <div>
          📭
        </div>

        <strong>
          You have not submitted any dApp request yet.
        </strong>

      </div>

    `;

  }


  /* =========================================
     ERROR
  ========================================= */

  function renderError(message, details = "") {

    if (!box) return;

    box.innerHTML = `

      <div class="empty">

        <div>
          ⚠️
        </div>

        <strong>
          Unable to Load Requests
        </strong>

        <p>
          ${escapeHtml(message)}
        </p>

        ${
          details
            ? `
              <small>
                ${escapeHtml(details)}
              </small>
            `
            : ""
        }

        <button
          type="button"
          class="btn"
          id="retryMyDappRequests"
          style="margin-top:12px"
        >
          Retry
        </button>

      </div>

    `;


    const retry =
      $("retryMyDappRequests");


    if (retry) {

      retry.addEventListener(
        "click",
        loadMyRequests
      );

    }

  }


  /* =========================================
     SUPABASE
  ========================================= */

  function getSupabaseClient() {

    const client =
      window.albukhrSupabase;


    if (
      !client ||
      typeof client.from !== "function"
    ) {

      throw new Error(
        "ALBUKHR Supabase client is not ready."
      );

    }


    return client;

  }


  /* =========================================
     PI USER
  ========================================= */

  async function getCurrentPiUser() {

    renderLoading(
      "Authenticating with Pi..."
    );


    /*
     * IMPORTANT:
     * First use existing pi_user.
     */

    try {

      const stored =
        localStorage.getItem("pi_user");


      if (stored) {

        const parsed =
          JSON.parse(stored);


        if (parsed?.uid) {

          console.log(
            "Using stored Pi user:",
            {
              uid: parsed.uid,
              username:
                parsed.username || ""
            }
          );


          return {

            uid:
              parsed.uid,

            username:
              parsed.username || "",

            wallet_address:
              parsed.wallet_address || ""

          };

        }

      }

    } catch (error) {

      console.warn(
        "Unable to parse stored Pi user:",
        error
      );

    }


    /*
     * FALLBACK:
     * Shared authentication only.
     */

    if (
      typeof window.ensurePiAuth !==
      "function"
    ) {

      throw new Error(
        "Pi authentication system is not available."
      );

    }


    const user =
      await window.ensurePiAuth();


    if (!user?.uid) {

      throw new Error(
        "Pi authentication completed without a UID."
      );

    }


    console.log(
      "Pi authentication user:",
      {
        uid: user.uid,
        username:
          user.username || ""
      }
    );


    return user;

  }


  /* =========================================
     QUERY MY REQUESTS
  ========================================= */

  async function queryMyRequests(uid) {

    renderLoading(
      "Connecting to ALBUKHR..."
    );


    const supabase =
      getSupabaseClient();


    console.log(
      "Supabase client ready."
    );


    console.log(
      "Querying table:",
      TABLE
    );


    console.log(
      "Filtering userid:",
      uid
    );


    renderLoading(
      "Loading your requests..."
    );


    const {

      data,
      error

    } = await supabase

      .from(TABLE)

      .select("*")

      .eq("userid", uid)

      .order(
        "created_at",
        {
          ascending: false
        }
      );


    console.log(
      "Supabase query response:",
      {
        data,
        error
      }
    );


    if (error) {

      console.error(
        "MY dApp REQUESTS SUPABASE ERROR",
        {
          message:
            error.message,

          details:
            error.details,

          hint:
            error.hint,

          code:
            error.code
        }
      );


      const details = [

        error.code
          ? `Code: ${error.code}`
          : "",

        error.details
          ? error.details
          : ""

      ]
        .filter(Boolean)
        .join(" | ");


      throw new Error(
        details
          ? `${error.message} — ${details}`
          : error.message ||
            "Supabase query failed."
      );

    }


    return Array.isArray(data)
      ? data
      : [];

  }


  /* =========================================
     TELEGRAM
  ========================================= */

  function renderTelegram(row) {

    if (
      String(row.status)
        .toLowerCase() !==
      "approved"
    ) {

      return "";

    }


    if (
      row.telegram_unlocked !== true
    ) {

      return "";

    }


    return `

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


  /* =========================================
     ADMIN NOTE
  ========================================= */

  function renderAdminNote(row) {

    if (!row.admin_note) {

      return "";

    }


    return `

      <div class="notice">

        <strong>
          📝 Admin Note:
        </strong>

        <br>

        ${escapeHtml(
          row.admin_note
        )}

      </div>

    `;

  }


  /* =========================================
     RECEIPT
  ========================================= */

  function renderReceipt(row) {

    return `

      <div class="receipt">

        <strong>
          Payment Receipt:
        </strong>

        <br>

        ${
          row.receipt_image

            ?

            `
              <img
                src="${escapeHtml(
                  row.receipt_image
                )}"
                alt="Payment Receipt"
                loading="lazy"
              >
            `

            :

            `
              <em>
                No receipt image
              </em>
            `
        }


        ${
          row.receipt_ref

            ?

            `
              <div
                style="
                  font-size:12px;
                  color:#666;
                  margin-top:6px
                "
              >
                Ref:
                ${escapeHtml(
                  row.receipt_ref
                )}
              </div>
            `

            :

            ""
        }

      </div>

    `;

  }


  /* =========================================
     RENDER CARD
  ========================================= */

  function renderRequest(row) {

    const status =
      getStatus(row.status);


    return `

      <div class="card">

        <strong>
          ${escapeHtml(
            row.project_name ||
            "Untitled Project"
          )}
        </strong>


        <div class="meta">

          🛠
          ${escapeHtml(
            row.service_type ||
            "-"
          )}

          <br>

          👤
          ${escapeHtml(
            row.pi_user ||
            "-"
          )}

        </div>


        <div
          class="status ${status.className}"
        >

          ${status.text}

        </div>


        <div class="desc">

          <strong>
            Description:
          </strong>

          <br>

          ${escapeHtml(
            row.description ||
            "—"
          )}

        </div>


        ${renderReceipt(row)}


        ${renderAdminNote(row)}


        ${renderTelegram(row)}

      </div>

    `;

  }


  /* =========================================
     RENDER LIST
  ========================================= */

  function renderRequests(rows) {

    if (
      !Array.isArray(rows) ||
      rows.length === 0
    ) {

      renderEmpty();

      return;

    }


    box.innerHTML = "";


    const fragment =
      document.createDocumentFragment();


    rows.forEach(row => {

      const wrapper =
        document.createElement(
          "div"
        );


      wrapper.innerHTML =
        renderRequest(row);


      while (
        wrapper.firstElementChild
      ) {

        fragment.appendChild(
          wrapper.firstElementChild
        );

      }

    });


    box.appendChild(
      fragment
    );

  }


  /* =========================================
     LOAD
  ========================================= */

  async function loadMyRequests() {

    if (!box) {

      console.error(
        "#list element was not found."
      );

      return;

    }


    if (loading) {

      return;

    }


    loading = true;


    try {

      const user =
        await getCurrentPiUser();


      if (!user?.uid) {

        throw new Error(
          "No Pi user UID is available. Please login with Pi Browser."
        );

      }


      console.log(
        "Current authenticated UID:",
        user.uid
      );


      const rows =
        await queryMyRequests(
          user.uid
        );


      renderRequests(
        rows
      );


    } catch (error) {

      console.error(
        "loadMyRequests fatal error:",
        error
      );


      renderError(
        error?.message ||
        "Something went wrong while loading requests."
      );


    } finally {

      loading = false;

    }

  }


  /* =========================================
     GLOBAL EXPORT
  ========================================= */

  window.loadMyRequests =
    loadMyRequests;


  /* =========================================
     START
  ========================================= */

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      loadMyRequests
    );

  } else {

    loadMyRequests();

  }

})();
