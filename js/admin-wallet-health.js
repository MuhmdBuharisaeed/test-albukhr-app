/* ===============================
   WALLET HEALTH
=============================== */

async function renderWalletHealth(){

  const balance =
    await getWalletBalance();

  let status = "🟢 HEALTHY";
  let color = "#27ae60";

  if(balance < 100){

    status = "🟡 LOW";
    color = "#f39c12";

  }

  if(balance < 20){

    status = "🔴 CRITICAL";
    color = "#c0392b";

  }

  const statusBox =
    document.getElementById("walletHealth");

  if(statusBox){

    statusBox.innerText = status;
    statusBox.style.color = color;

  }

}
