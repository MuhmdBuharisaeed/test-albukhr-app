/* =========================================
   ALBUKHR ADMIN DAPP REQUESTS v4
========================================= */


/* =========================================
   DOM
========================================= */

const listBox =
  document.getElementById("adminList");


/* =========================================
   ESCAPE HTML
========================================= */

function escapeHtml(text = ""){

  return String(text)

    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


/* =========================================
   FORMAT DATE
========================================= */

function formatDate(date){

  if(!date){

    return "-";

  }

  return new Date(date)

    .toLocaleString([],{

      dateStyle:"medium",
      timeStyle:"short"

    });

}


/* =========================================
   STATUS BADGE
========================================= */

function getStatusBadge(status){

  if(status === "approved"){

    return `

      <div class="status-badge status-approved">

        <span class="status-dot"></span>

        Approved

      </div>

    `;

  }


  if(status === "rejected"){

    return `

      <div class="status-badge status-rejected">

        <span class="status-dot"></span>

        Rejected

      </div>

    `;

  }


  return `

    <div class="status-badge status-pending">

      <span class="status-dot"></span>

      Pending

    </div>

  `;

}


/* =========================================
   LOADING STATE
========================================= */

function renderLoading(){

  if(!listBox) return;

  listBox.innerHTML = `

    <div class="request-state loading-state">

      <div class="loading-spinner"></div>

      <h4>
        Loading requests...
      </h4>

      <p>
        Please wait while dApp requests are loaded.
      </p>

    </div>

  `;

}


/* =========================================
   EMPTY STATE
========================================= */

function renderEmpty(message){

  if(!listBox) return;

  listBox.innerHTML = `

    <div class="request-state empty-state">

      <div class="state-icon">
        📭
      </div>

      <h4>
        ${escapeHtml(message)}
      </h4>

      <p>
        No dApp requests are currently available.
      </p>

    </div>

  `;

}


/* =========================================
   ERROR STATE
========================================= */

function renderError(message){

  if(!listBox) return;

  listBox.innerHTML = `

    <div class="request-state error-state">

      <div class="state-icon">
        ⚠️
      </div>

      <h4>
        Unable to Load Requests
      </h4>

      <p>
        ${escapeHtml(message)}
      </p>

      <button
        type="button"
        class="retry-btn"
        onclick="loadRequests()"
      >
        Retry
      </button>

    </div>

  `;

}


/* =========================================
   LOAD REQUESTS
========================================= */

async function loadRequests(){

  if(!listBox) return;

  renderLoading();

  try{

    const {

      data,
      error

    } =

      await window.supabaseClient

        .from("dapp_requests")

        .select("*")

        .order("created_at",{

          ascending:false

        });


    if(error){

      console.error(

        "dApp Request Load Error:",

        error

      );

      renderError(

        error.message ||

        "Failed to load requests."

      );

      return;

    }


    renderRequests(data || []);


  }catch(error){

    console.error(

      "dApp Request Network Error:",

      error

    );

    renderError(

      "Network error while loading requests."

    );

  }

}


/* =========================================
   RENDER REQUESTS
========================================= */

function renderRequests(rows){

  if(!Array.isArray(rows) || !rows.length){

    renderEmpty(

      "No dApp Requests Found"

    );

    return;

  }


  listBox.innerHTML = "";


  rows.forEach(row=>{

    const status =

      String(

        row.status ||

        "pending"

      ).toLowerCase();


    const noteId =

      `note_${row.id}`;


    /* =====================================
       ACTION BUTTONS
    ===================================== */

    let actionButtons = "";


    if(status === "pending"){

      actionButtons = `

        <div class="action-row">

          <button
            type="button"
            class="btn approve"
            onclick="approveRequest('${escapeHtml(row.id)}', this)"
          >

            <span class="btn-icon">
              ✓
            </span>

            Approve

          </button>


          <button
            type="button"
            class="btn reject"
            onclick="rejectRequest('${escapeHtml(row.id)}', this)"
          >

            <span class="btn-icon">
              ×
            </span>

            Reject

          </button>

        </div>

      `;

    }


    if(status === "approved"){

      actionButtons = `

        <div class="action-row">

          <button
            type="button"
            class="btn approved disabled"
            disabled
          >

            <span class="btn-icon">
              ✓
            </span>

            Approved

          </button>

        </div>

      `;

    }


    if(status === "rejected"){

      actionButtons = `

        <div class="action-row">

          <button
            type="button"
            class="btn rejected disabled"
            disabled
          >

            <span class="btn-icon">
              ×
            </span>

            Rejected

          </button>

        </div>

      `;

    }


    /* =====================================
       CARD
    ===================================== */

    const card =

      document.createElement("article");


    card.className =

      `dapp-request-card status-${status}`;


    card.dataset.requestId =

      row.id;


    card.innerHTML = `

      <!-- REQUEST HEADER -->

      <div class="req-head">


        <div class="req-heading">


          <div class="req-title">

            ${escapeHtml(

              row.project_name ||

              "Untitled Project"

            )}

          </div>


          <div class="req-user">

            <span>
              👤
            </span>

            ${escapeHtml(

              row.pi_user ||

              "-"

            )}


            <span class="separator">
              •
            </span>


            <span>
              🛠
            </span>

            ${escapeHtml(

              row.service_type ||

              "-"

            )}

          </div>


        </div>


        ${getStatusBadge(status)}


      </div>


      <!-- REQUEST META -->

      <div class="meta">


        <div class="meta-item">

          <span class="meta-icon">
            🆔
          </span>

          <span class="meta-label">
            User ID
          </span>

          <span class="meta-value">

            ${escapeHtml(

              row.userid ||

              "-"

            )}

          </span>

        </div>


        <div class="meta-item">

          <span class="meta-icon">
            📅
          </span>

          <span class="meta-label">
            Submitted
          </span>

          <span class="meta-value">

            ${formatDate(

              row.created_at

            )}

          </span>

        </div>


      </div>


      <!-- DESCRIPTION -->

      <div class="desc">

        <div class="desc-title">
          Description
        </div>

        <div class="desc-content">

          ${escapeHtml(

            row.description ||

            "No description provided."

          )}

        </div>

      </div>


      <!-- RECEIPT -->

      <div class="receipt-box">


        <div class="receipt-label">

          <span>
            🧾
          </span>

          Payment Receipt

        </div>


        ${
          row.receipt_image

          ?

          `

            <div class="receipt-preview">

              <img
                src="${escapeHtml(row.receipt_image)}"
                alt="Payment receipt"
                loading="lazy"
              >

            </div>

          `

          :

          `

            <div class="receipt-empty">

              No receipt image uploaded.

            </div>

          `

        }


        ${
          row.receipt_ref

          ?

          `

            <div class="receipt-ref">

              <strong>
                Reference:
              </strong>

              <span>

                ${escapeHtml(

                  row.receipt_ref

                )}

              </span>

            </div>

          `

          :

          ""

        }


      </div>


      <!-- ADMIN NOTE -->

      <div class="note-area">


        <label
          for="${noteId}"
        >

          Admin Note

        </label>


        <textarea
          id="${noteId}"
          class="note-input"
          placeholder="Write a note for the user..."
        >${escapeHtml(

          row.admin_note ||

          ""

        )}</textarea>


      </div>


      ${
        row.admin_note

        ?

        `

          <div class="admin-note-box">

            <div class="saved-note-title">

              Saved Admin Note

            </div>

            <div class="saved-note-content">

              ${escapeHtml(

                row.admin_note

              )}

            </div>

          </div>

        `

        :

        ""

      }


      <!-- ACTIONS -->

      ${actionButtons}


      ${
        status !== "pending" && row.reviewed_at

        ?

        `

          <div class="reviewed-info">

            Reviewed:

            ${formatDate(

              row.reviewed_at

            )}

          </div>

        `

        :

        ""

      }

    `;


    listBox.appendChild(card);

  });

}


/* =========================================
   GET ADMIN NOTE
========================================= */

function getAdminNote(id){

  const noteEl =

    document.getElementById(

      `note_${id}`

    );


  return noteEl

    ? noteEl.value.trim()

    : "";

}


/* =========================================
   SET BUTTON PROCESSING
========================================= */

function setButtonProcessing(

  button,

  text

){

  if(!button) return;


  button.disabled = true;

  button.classList.add(

    "processing"

  );


  button.dataset.originalText =

    button.innerHTML;


  button.innerHTML = `

    <span class="button-spinner"></span>

    ${text}

  `;

}


/* =========================================
   APPROVE REQUEST
========================================= */

async function approveRequest(

  id,

  button

){

  const note =

    getAdminNote(id);


  const ok =

    confirm(

      "Approve this dApp request?"

    );


  if(!ok) return;


  setButtonProcessing(

    button,

    "Approving..."

  );


  try{

    const {

      error

    } =

      await window.supabaseClient

        .from("dapp_requests")

        .update({

          status:"approved",

          telegram_unlocked:true,

          admin_note:note,

          reviewed_at:

            new Date()

              .toISOString()

        })

        .eq("id", id);


    if(error){

      console.error(

        "Approve Error:",

        error

      );

      alert(

        error.message ||

        "Failed to approve request."

      );


      if(button){

        button.disabled = false;

        button.classList.remove(

          "processing"

        );

        button.innerHTML =

          button.dataset.originalText ||

          "Approve";

      }

      return;

    }


    /*
     * IMMEDIATE REFRESH
     */

    await loadRequests();


  }catch(error){

    console.error(

      "Approve Network Error:",

      error

    );


    alert(

      "Network error while approving request."

    );


    if(button){

      button.disabled = false;

      button.classList.remove(

        "processing"

      );

      button.innerHTML =

        button.dataset.originalText ||

        "Approve";

    }

  }

}


/* =========================================
   REJECT REQUEST
========================================= */

async function rejectRequest(

  id,

  button

){

  const note =

    getAdminNote(id);


  const ok =

    confirm(

      "Reject this dApp request?"

    );


  if(!ok) return;


  setButtonProcessing(

    button,

    "Rejecting..."

  );


  try{

    const {

      error

    } =

      await window.supabaseClient

        .from("dapp_requests")

        .update({

          status:"rejected",

          telegram_unlocked:false,

          admin_note:note,

          reviewed_at:

            new Date()

              .toISOString()

        })

        .eq("id", id);


    if(error){

      console.error(

        "Reject Error:",

        error

      );


      alert(

        error.message ||

        "Failed to reject request."

      );


      if(button){

        button.disabled = false;

        button.classList.remove(

          "processing"

        );

        button.innerHTML =

          button.dataset.originalText ||

          "Reject";

      }

      return;

    }


    /*
     * IMMEDIATE REFRESH
     */

    await loadRequests();


  }catch(error){

    console.error(

      "Reject Network Error:",

      error

    );


    alert(

      "Network error while rejecting request."

    );


    if(button){

      button.disabled = false;

      button.classList.remove(

        "processing"

      );

      button.innerHTML =

        button.dataset.originalText ||

        "Reject";

    }

  }

}


/* =========================================
   AUTO REFRESH
========================================= */

let dappRequestRefreshTimer = null;


function startDappRequestAutoRefresh(){

  if(dappRequestRefreshTimer){

    clearInterval(

      dappRequestRefreshTimer

    );

  }


  dappRequestRefreshTimer =

    setInterval(

      loadRequests,

      300000

    );

}


/* =========================================
   START
========================================= */

document.addEventListener(

  "DOMContentLoaded",

  ()=>{

    loadRequests();

    startDappRequestAutoRefresh();

  }

);


/* =========================================
   PAGE VISIBILITY REFRESH
========================================= */

document.addEventListener(

  "visibilitychange",

  ()=>{

    if(

      document.visibilityState ===

      "visible"

    ){

      loadRequests();

    }

  }

);
