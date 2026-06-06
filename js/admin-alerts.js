/* ===============================
   ADMIN ALERTS
=============================== */

const LOW_BALANCE_LIMIT = 100;
const CRITICAL_BALANCE_LIMIT = 20;

/* ===============================
   CHECK LIQUIDITY
=============================== */
async function checkLiquidity(){

  const balance =
    await getWalletBalance();

  const warning =
    document.getElementById(
      "liquidityWarning"
    );

  if(!warning) return;

  if(balance <= CRITICAL_BALANCE_LIMIT){

    warning.style.display = "block";
    warning.style.background = "#c0392b";

    warning.innerHTML =
      "🚨 CRITICAL LIQUIDITY";

    return;
  }

  if(balance <= LOW_BALANCE_LIMIT){

    warning.style.display = "block";
    warning.style.background = "#f39c12";

    warning.innerHTML =
      "⚠️ LOW LIQUIDITY";

    return;
  }

  warning.style.display = "none";
}
