/* =========================================
   ALBUKHR ADMIN TRANSACTIONS v4
========================================= */


/* =========================================
   GET WALLET PAYMENTS
========================================= */

async function getWalletPayments(){

  try{

    const response = await fetch(

      `https://api.testnet.minepi.com/accounts/${ALBUKHR_WALLET}/payments?limit=20&order=desc`

    );

    if(!response.ok){

      throw new Error("Unable to fetch payments.");

    }

    const data = await response.json();

    return data?._embedded?.records || [];

  }catch(error){

    console.error(
      "Payments Error:",
      error
    );

    return [];

  }

}


/* =========================================
   SHORT WALLET
========================================= */

function shortWallet(wallet = ""){

  if(wallet.length <= 14){

    return wallet;

  }

  return `${wallet.slice(0,6)}...${wallet.slice(-6)}`;

}


/* =========================================
   FORMAT DATE
========================================= */

function formatDate(date){

  return new Date(date)

    .toLocaleString([],{

      dateStyle:"medium",
      timeStyle:"short"

    });

}


/* =========================================
   ESCAPE HTML
========================================= */

function escapeHTML(value = ""){

  return String(value)

    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");

}


/* =========================================
   SENT SVG ICON
========================================= */

function sentTransactionIcon(){

  return `

    <svg
      class="transaction-type-svg sent-svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >

      <path
        d="M12 19V5"
      ></path>

      <path
        d="M6.5 10.5L12 5l5.5 5.5"
      ></path>

      <path
        d="M5 19h14"
      ></path>

    </svg>

  `;

}


/* =========================================
   RECEIVED SVG ICON
========================================= */

function receivedTransactionIcon(){

  return `

    <svg
      class="transaction-type-svg received-svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >

      <path
        d="M12 5v14"
      ></path>

      <path
        d="M6.5 13.5L12 19l5.5-5.5"
      ></path>

      <path
        d="M5 5h14"
      ></path>

    </svg>

  `;

}


/* =========================================
   EMPTY TRANSACTION STATE
========================================= */

function transactionEmptyState(

  type = "all"

){

  if(type === "sent"){

    return `

      <div class="transaction-empty">

        <div class="transaction-empty-icon">

          ${sentTransactionIcon()}

        </div>

        <h4>
          No Sent Transactions
        </h4>

        <p>
          No outgoing wallet transactions found.
        </p>

      </div>

    `;

  }


  if(type === "received"){

    return `

      <div class="transaction-empty">

        <div class="transaction-empty-icon">

          ${receivedTransactionIcon()}

        </div>

        <h4>
          No Received Transactions
        </h4>

        <p>
          No incoming wallet transactions found.
        </p>

      </div>

    `;

  }


  return `

    <div class="transaction-empty">

      <div class="transaction-empty-icon">

        <svg
          class="transaction-type-svg"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >

          <rect
            x="5"
            y="3"
            width="14"
            height="18"
            rx="2"
          ></rect>

          <path
            d="M8 8h8"
          ></path>

          <path
            d="M8 12h8"
          ></path>

          <path
            d="M8 16h5"
          ></path>

        </svg>

      </div>

      <h4>
        No Transactions
      </h4>

      <p>
        No wallet activity found.
      </p>

    </div>

  `;

}


/* =========================================
   CREATE TRANSACTION CARD
========================================= */

function createTransactionCard(

  tx,
  type

){

  const sent = type === "sent";

  const amount =
    Number(tx.amount) || 0;

  const asset =
    tx.asset_type === "native"

      ? "Pi"

      : (tx.asset_code || "");


  const wallet =
    sent

      ? tx.to

      : tx.from;


  const safeWallet =
    escapeHTML(
      shortWallet(wallet || "")
    );


  const safeDate =
    escapeHTML(
      formatDate(tx.created_at)
    );


  const safeId =
    escapeHTML(
      shortWallet(tx.id || "")
    );


  const amountColor =
    sent

      ? "#d83b3b"

      : "#159447";


  const icon =
    sent

      ? sentTransactionIcon()

      : receivedTransactionIcon();


  const title =
    sent

      ? "Sent"

      : "Received";


  const card =
    document.createElement("article");


  card.className =

    `tx-card ${

      sent

        ? "tx-sent"

        : "tx-received"

    }`;


  card.innerHTML = `

    <div class="tx-left">

      <div class="tx-icon">

        ${icon}

      </div>


      <div class="tx-info">

        <div class="tx-title">

          ${title}

        </div>


        <div class="tx-meta">

          ${safeWallet}

        </div>


        <div class="tx-meta">

          ${safeDate}

        </div>

      </div>

    </div>


    <div class="tx-right">

      <div
        class="tx-amount"
        style="color:${amountColor};"
      >

        ${amount.toFixed(2)} ${escapeHTML(asset)}

      </div>


      <div class="tx-time">

        ${safeId}

      </div>

    </div>

  `;


  return card;

}


/* =========================================
   LOAD RECENT TRANSACTIONS
========================================= */

async function loadRecentTransactions(){

  const box =

    document.getElementById(
      "adminTxList"
    );


  if(!box) return;


  /* =======================================
     LOADING STATE
  ======================================= */

  box.innerHTML = `

    <div class="transactions-loading">

      <div class="loading-spinner"></div>

      <p>
        Loading transactions...
      </p>

    </div>

  `;


  /* =======================================
     GET RECORDS
  ======================================= */

  const records =

    await getWalletPayments();


  /* =======================================
     NO RECORDS
  ======================================= */

  if(!records.length){

    box.innerHTML =

      transactionEmptyState();

    return;

  }


  /* =======================================
     SEPARATE SENT / RECEIVED
  ======================================= */

  const sentRecords = [];

  const receivedRecords = [];


  records.forEach(tx => {

    const sent =

      tx.from === ALBUKHR_WALLET;


    if(sent){

      sentRecords.push(tx);

    }else{

      receivedRecords.push(tx);

    }

  });


  /* =======================================
     TRANSACTION LAYOUT
  ======================================= */

  box.innerHTML = `

    <div class="transactions-columns">


      <!-- =================================
           SENT
      ================================== -->

      <section
        class="transaction-column sent-column"
      >

        <div class="transaction-column-header">

          <div class="transaction-column-icon sent-column-icon">

            ${sentTransactionIcon()}

          </div>

          <div>

            <h4>
              Sent Transactions
            </h4>

            <span>
              Outgoing wallet activity
            </span>

          </div>

          <span
            class="transaction-count sent-count"
          >
            ${sentRecords.length}
          </span>

        </div>


        <div
          class="transaction-column-list"
          id="sentTransactionsList"
        >

        </div>

      </section>


      <!-- =================================
           RECEIVED
      ================================== -->

      <section
        class="transaction-column received-column"
      >

        <div class="transaction-column-header">

          <div class="transaction-column-icon received-column-icon">

            ${receivedTransactionIcon()}

          </div>

          <div>

            <h4>
              Received Transactions
            </h4>

            <span>
              Incoming wallet activity
            </span>

          </div>

          <span
            class="transaction-count received-count"
          >
            ${receivedRecords.length}
          </span>

        </div>


        <div
          class="transaction-column-list"
          id="receivedTransactionsList"
        >

        </div>

      </section>


    </div>

  `;


  /* =======================================
     SENT CONTAINER
  ======================================= */

  const sentBox =

    document.getElementById(
      "sentTransactionsList"
    );


  /* =======================================
     RECEIVED CONTAINER
  ======================================= */

  const receivedBox =

    document.getElementById(
      "receivedTransactionsList"
    );


  /* =======================================
     RENDER SENT
  ======================================= */

  if(sentRecords.length){

    sentRecords.forEach(tx => {

      sentBox.appendChild(

        createTransactionCard(
          tx,
          "sent"
        )

      );

    });

  }else{

    sentBox.innerHTML =

      transactionEmptyState(
        "sent"
      );

  }


  /* =======================================
     RENDER RECEIVED
  ======================================= */

  if(receivedRecords.length){

    receivedRecords.forEach(tx => {

      receivedBox.appendChild(

        createTransactionCard(
          tx,
          "received"
        )

      );

    });

  }else{

    receivedBox.innerHTML =

      transactionEmptyState(
        "received"
      );

  }

       }
