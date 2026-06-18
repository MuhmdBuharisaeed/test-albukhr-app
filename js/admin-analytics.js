/* ===============================
   ADMIN ANALYTICS
=============================== */

/* ===============================
   LOAD ANALYTICS
=============================== */
async function loadAnalytics(){

  const payments =
    await getWalletPayments();

  let received = 0;
  let sent = 0;

let totalFees = 0;

const { data: fees } =
  await supabaseClient
    .from("transactions")
    .select("fee")
    .eq("status","paid");

(fees || []).forEach(tx=>{

  totalFees +=
    Number(tx.fee || 0);

});

  payments.forEach(tx => {

    const amount =
      Number(tx.amount || 0);

    if(tx.to === ALBUKHR_WALLET){

      received += amount;

    }else if(tx.from === ALBUKHR_WALLET){

      sent += amount;

    }

  });

  const totalTransactions =
    payments.length;

  const netFlow =
    received - sent;

  renderAnalytics({
  received,
  sent,
  totalTransactions,
  netFlow,
  totalFees
});

}

/* ===============================
   RENDER ANALYTICS
=============================== */
function renderAnalytics(data){

  const receivedBox =
    document.getElementById(
      "totalReceived"
    );

  const sentBox =
    document.getElementById(
      "totalSent"
    );

  const txBox =
    document.getElementById(
      "totalTransactions"
    );

  const flowBox =
    document.getElementById(
      "netFlow"
    );

 const feeBox =
  document.getElementById(
    "totalFees"
  );
   
  if(receivedBox){
    receivedBox.innerText =
      data.received.toFixed(2) + " Pi";
  }

  if(sentBox){
    sentBox.innerText =
      data.sent.toFixed(2) + " Pi";
  }

  if(txBox){
    txBox.innerText =
      data.totalTransactions;
  }

  if(flowBox){

    flowBox.innerText =
      data.netFlow.toFixed(2) + " Pi";

  if(feeBox){

  feeBox.innerText =
    (data.totalFees || 0)
      .toFixed(2) + " Pi";

  }   
     
    flowBox.style.color =
      data.netFlow >= 0
      ? "green"
      : "red";

  }

}
