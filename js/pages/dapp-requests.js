/* =========================================================
   ALBUKHR – MY dApp REQUESTS
   NEW ARCHITECTURE / SUPABASE CORE VERSION

   ROLE
   ---------------------------------------------------------
   Page/controller layer for the My dApp Requests page.

   NEW ARCHITECTURE LOCATION
   ---------------------------------------------------------
   js/pages/dapp-requests.js

   DEPENDENCIES
   ---------------------------------------------------------
   1. js/supabase-core.js
      Expected shared client:
        window.AlbukhrSupabase
        .getClient()

   2. Shared Pi authentication engine
      Expected:
        window.AlbukhrPiAuth
        .getCurrentUser()
      or:
        window.AlbukhrPiAuth
        .ensureAuthenticated()

   3. Shared environment engine (when network is present
      in the dapp_requests schema):
        window.AlbukhrEnvironment
        .getNetwork()

   IMPORTANT
   ---------------------------------------------------------
   - No localStorage is used.
   - No Supabase URL/key is hard-coded here.
   - Authentication is not recreated here.
   - This file is UI/page logic only.
   - Database remains the source of truth.
========================================================= */

(() => {
  "use strict";

  const TABLE = "dapp_requests";
  const REQUEST_TIMEOUT = 15000;

  const box = document.getElementById("list");

  /* =========================================================
     HTML SAFETY
  ========================================================= */

  function escapeHtml(value = "") {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /* =========================================================
     UI
  ========================================================= */

  function showStage(title, message) {
    if (!box) return;

    box.innerHTML = `
      <div class="empty">
        <strong>${escapeHtml(title)}</strong>
        <br><br>
        ${escapeHtml(message)}
      </div>
    `;
  }

  /* =========================================================
     SHARED SUPABASE CLIENT
  ========================================================= */

  function getSupabaseClient() {
    const core = window.AlbukhrSupabase;

    if (!core) {
      throw new Error(
        "ALBUKHR Supabase Core is unavailable. Load js/supabase-core.js first."
      );
    }

    if (typeof core.getClient === "function") {
      const client = core.getClient();

      if (client) {
        return client;
      }
    }

    if (core.client) {
      return core.client;
    }

    throw new Error(
      "ALBUKHR Supabase Core did not expose a Supabase client."
    );
  }

  /* =========================================================
     NETWORK RESOLUTION
  ========================================================= */

  function getCurrentNetwork() {
    const environment = window.AlbukhrEnvironment;

    if (!environment) {
      return null;
    }

    try {
      if (typeof environment.getNetwork === "function") {
        const network = environment.getNetwork();

        if (network) {
          return String(network).toLowerCase();
        }
      }

      if (typeof environment.currentNetwork === "function") {
        const network = environment.currentNetwork();

        if (network) {
          return String(network).toLowerCase();
        }
      }

      if (typeof environment.network === "string") {
        return environment.network.toLowerCase();
      }
    } catch (error) {
      console.warn(
        "ALBUKHR environment lookup failed:",
        error
      );
    }

    return null;
  }

  /* =========================================================
     SHARED PI AUTH
  ========================================================= */

  async function getCurrentUser() {
    const auth = window.AlbukhrPiAuth;

    if (!auth) {
      throw new Error(
        "ALBUKHR Pi Auth Engine is unavailable. Load js/core/pi-auth.js first."
      );
    }

    let user = null;

    if (typeof auth.getCurrentUser === "function") {
      user = await auth.getCurrentUser();
    }

    if (!user && typeof auth.ensureAuthenticated === "function") {
      user = await auth.ensureAuthenticated();
    }

    if (!user && typeof auth.ensureAuth === "function") {
      user = await auth.ensureAuth();
    }

    if (!user?.uid) {
      return null;
    }

    return {
      uid: String(user.uid),
      username: String(
        user.username ||
        user.pi_username ||
        ""
      )
    };
  }

  /* =========================================================
     QUERY
  ========================================================= */

  async function queryRequests(user) {
    const supabase = getSupabaseClient();
    const network = getCurrentNetwork();

    let query = supabase
      .from(TABLE)
      .select("*")
      .eq("userid", user.uid)
      .order("created_at", { ascending: false });

    /*
     * Network isolation is applied only when the shared
     * environment engine provides a network value.
     *
     * This intentionally does not invent a schema column.
     * If dapp_requests has a `network` column, the active
     * network is enforced. If the table does not yet have
     * that column, the query remains compatible with the
     * existing schema until the migration is completed.
     */
    if (network) {
      query = query.eq("network", network);
    }

    const result = await query;

    if (result.error) {
      /*
       * If network filtering fails because the existing
       * table has no network column, retry the user-scoped
       * query. This is a compatibility bridge, not a new
       * source of truth.
       */
      if (
        network &&
        /column .*network.*does not exist/i.test(
          String(result.error.message || "")
        )
      ) {
        console.warn(
          "dapp_requests has no network column yet; continuing with user-scoped query."
        );

        const fallback = await supabase
          .from(TABLE)
          .select("*")
          .eq("userid", user.uid)
          .order("created_at", { ascending: false });

        if (fallback.error) {
          throw fallback.error;
        }

        return Array.isArray(fallback.data)
          ? fallback.data
          : [];
      }

      throw result.error;
    }

    return Array.isArray(result.data)
      ? result.data
      : [];
  }

  /* =========================================================
     LOAD REQUESTS
  ========================================================= */

  async function loadMyRequests() {
    showStage(
      "Loading",
      "Loading requests..."
    );

    try {
      const user = await getCurrentUser();

      if (!user?.uid) {
        showStage(
          "Login Required",
          "Please login with Pi Browser."
        );
        return;
      }

      const requests = await queryRequests(user);

      if (
        !Array.isArray(requests) ||
        requests.length === 0
      ) {
        showStage(
          "No Requests",
          "You have not submitted any dApp request yet."
        );
        return;
      }

      renderRequests(requests);

    } catch (error) {
      console.error(
        "ALBUKHR My dApp Requests error:",
        error
      );

      const message = String(
        error?.message || ""
      );

      if (
        /timeout|timed out/i.test(message)
      ) {
        showStage(
          "Connection Timeout",
          "The request took too long to complete. Please try again."
        );
        return;
      }

      showStage(
        "Something Went Wrong",
        "Unable to load your dApp requests. Please try again."
      );
    }
  }

  /* =========================================================
     RENDER
  ========================================================= */

  function renderRequests(requests) {
    if (!box) return;

    box.innerHTML = "";

    requests.forEach(request => {
      box.insertAdjacentHTML(
        "beforeend",
        createRequestCard(request)
      );
    });
  }

  /* =========================================================
     EXPANDABLE TEXT
  ========================================================= */

  function createExpandableText(
    text,
    prefix = "description"
  ) {
    const value = String(text || "—");
    const safeText = escapeHtml(value);

    if (value.length <= 240) {
      return `
        <div class="desc-content">
          ${safeText}
        </div>
      `;
    }

    const uniqueId =
      `${prefix}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`;

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

  /* =========================================================
     ADMIN NOTE
  ========================================================= */

  function createAdminNote(note) {
    if (!note) return "";

    const value = String(note);
    const safeNote = escapeHtml(value);

    if (value.length <= 240) {
      return `
        <div class="notice">
          <strong>📝 Admin Note:</strong>
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
        .slice(2, 8)}`;

    return `
      <div class="notice">
        <strong>📝 Admin Note:</strong>
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

  /* =========================================================
     REQUEST CARD
  ========================================================= */

  function createRequestCard(request) {
    const r = request || {};

    let statusText = "Unknown";
    let statusClass = "";

    if (r.status === "pending") {
      statusText = "🟡 Under Review";
      statusClass = "pending";
    } else if (r.status === "approved") {
      statusText = "🟢 Approved";
      statusClass = "approved";
    } else if (r.status === "rejected") {
      statusText = "🔴 Rejected";
      statusClass = "rejected";
    } else {
      statusText = escapeHtml(
        r.status || "Unknown"
      );
    }

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

    const adminNote =
      createAdminNote(r.admin_note);

    let receipt = "";

    if (r.receipt_image) {
      receipt = `
        <img
          src="${escapeHtml(r.receipt_image)}"
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

    let receiptRef = "";

    if (r.receipt_ref) {
      receiptRef = `
        <div class="receipt-ref">
          <strong>Ref:</strong>
          ${escapeHtml(r.receipt_ref)}
        </div>
      `;
    }

    let createdAt = "";

    if (r.created_at) {
      const date = new Date(r.created_at);

      createdAt = Number.isNaN(date.getTime())
        ? String(r.created_at)
        : date.toLocaleString();
    }

    const description =
      createExpandableText(
        r.description || "—",
        "description"
      );

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
                ${escapeHtml(createdAt)}
              `
              : ""
          }

        </div>

        <div class="status ${escapeHtml(statusClass)}">
          ${statusText}
        </div>

        <div class="desc">

          <span class="desc-title">
            Description
          </span>

          ${description}

        </div>

        <div class="receipt">

          <strong>
            🧾 Payment Receipt
          </strong>

          ${receipt}

          ${receiptRef}

        </div>

        ${adminNote}

        ${telegram}

      </div>
    `;
  }

  /* =========================================================
     SEE MORE / SEE LESS
  ========================================================= */

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
      document.getElementById(targetId);

    if (!target) return;

    const expanded =
      button.getAttribute(
        "aria-expanded"
      ) === "true";

    if (expanded) {
      target.classList.add("collapsed");

      button.setAttribute(
        "aria-expanded",
        "false"
      );

      button.textContent =
        "See More";
    } else {
      target.classList.remove("collapsed");

      button.setAttribute(
        "aria-expanded",
        "true"
      );

      button.textContent =
        "See Less";
    }
  }

  /* =========================================================
     EVENT DELEGATION
  ========================================================= */

  if (box) {
    box.addEventListener(
      "click",
      handleSeeMore
    );
  }

  /* =========================================================
     PUBLIC API
  ========================================================= */

  window.AlbukhrDappRequests = {
    load: loadMyRequests,
    reload: loadMyRequests
  };

  /*
   * Compatibility alias for existing page code.
   * This does not recreate the old authentication or
   * REST architecture.
   */
  window.loadMyRequests =
    loadMyRequests;

  /* =========================================================
     START
  ========================================================= */

  function start() {
    console.log(
      "================================="
    );

    console.log(
      "ALBUKHR My dApp Requests"
    );

    console.log(
      "NEW ARCHITECTURE"
    );

    console.log(
      "Supabase Core mode"
    );

    console.log(
      "Shared Pi Auth mode"
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

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      start,
      { once: true }
    );
  } else {
    start();
  }

})();
