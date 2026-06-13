/* ===============================
   ADMIN TRANSACTIONS
=============================== */

/* ===============================
   LOAD PAYMENTS
=============================== */
async function getWalletPayments(){

  try{

    const response = await fetch(
      `https://api.testnet.minepi.com/accounts/${ALBUKHR_WALLET}/payments?limit=20&order=desc`
    );

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

/* ===============================
   RENDER TRANSACTIONS
=============================== */
async function loadRecentTransactions(){

  const box =
    document.getElementById("adminTxList");

  if(!box) return;

  box.innerHTML =
    "<small>Loading...</small>";

  const records =
    await getWalletPayments();

  if(!records.length){

    box.innerHTML =
      "<small>No transactions found</small>";

    return;

  }

  box.innerHTML = "";


   const visible =
  transactionsExpanded
    ? transactions
    : transactions.slice(0,3);

visible.forEach(tx => {

   if(transactions.length > 3){

  box.innerHTML += `
    <div style="text-align:center;margin-top:10px;">
      <button onclick="
        transactionsExpanded=!transactionsExpanded;
        renderTransactions();
      ">
        ${transactionsExpanded ? "Show Less" : "See More"}
      </button>
    </div>
  `;
   }


    const amount =
      Number(tx.amount || 0);

    const asset =
      tx.asset_type === "native"
      ? "Pi"
      : tx.asset_code;

    const date =
      new Date(
        tx.created_at
      ).toLocaleString();

    const type =
      tx.from === ALBUKHR_WALLET
      ? "📤 SENT"
      : "📥 RECEIVED";

    const wallet =
      tx.from === ALBUKHR_WALLET
      ? tx.to
      : tx.from;

    box.innerHTML += `

      <div class="tx">

        <strong>${type}</strong><br>

        Amount:
        ${amount.toFixed(2)} ${asset}<br>

        Wallet:
        ${wallet}<br>

        <small>
          ${date}
        </small>

      </div>

    `;

  });

}
