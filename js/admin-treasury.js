/* ===============================
   TREASURY ENGINE
=============================== */
function calculateTreasury(txs){

  let totalStake = 0;
  let totalFees = 0;
  let rewardWithdraw = 0;
  let capitalWithdraw = 0;
  let adminLiquidity = 0;

  txs.forEach(tx => {

    const amount = Number(tx.amount) || 0;
    const fee = Number(tx.fee) || 0;

    if(tx.type === "stake"){
      totalStake += amount;
    }

    if(tx.type === "admin-credit"){
      adminLiquidity += amount;
    }

    if(tx.type === "withdraw"){
      rewardWithdraw += amount;
      totalFees += fee;
    }

    if(tx.type === "capital"){
      capitalWithdraw += amount;
      totalFees += fee;
    }

  });

  return {
    treasury:
      totalStake +
      adminLiquidity +
      totalFees -
      rewardWithdraw -
      capitalWithdraw,

    totalStake,
    totalFees,
    rewardWithdraw,
    capitalWithdraw,
    adminLiquidity
  };

}

/* ===============================
   HEALTH STATUS
=============================== */
function getHealth(t){

  if(t.treasury <= 0){
    return "CRITICAL";
  }

  if(t.treasury < 100){
    return "LOW";
  }

  return "HEALTHY";

}

/* ===============================
   SUMMARY CARD
=============================== */
function renderSummary(t){

  document.getElementById("walletStatus")
    .innerText = getHealth(t);

  document.getElementById("adminBalance")
    .innerHTML = `

    <div style="font-size:28px;font-weight:800">
      ${t.treasury.toFixed(2)} Pi
    </div>

    <div style="margin-top:10px;font-size:12px">
      Stake: ${t.totalStake.toFixed(2)} Pi<br>
      Fees: ${t.totalFees.toFixed(2)} Pi<br>
      Reward Withdraw: ${t.rewardWithdraw.toFixed(2)} Pi<br>
      Capital Withdraw: ${t.capitalWithdraw.toFixed(2)} Pi<br>
      Liquidity: ${t.adminLiquidity.toFixed(2)} Pi
    </div>

  `;

}

/* ===============================
   TREASURY OVERVIEW
=============================== */
async function renderTreasuryOverview(){

  document.getElementById("debugInfo")
    .innerText = "Running...";

  const treasury =
    await getWalletBalance();

  document.getElementById("debugInfo")
    .innerText = "Balance = " + treasury;

  document.getElementById("treasuryBalance")
    .innerText =
    treasury.toFixed(2) + " Pi";

  document.getElementById("pendingTotal")
    .innerText = "N/A";

  document.getElementById("approvedTotal")
    .innerText = "N/A";

  document.getElementById("availableLiquidity")
    .innerText =
    treasury.toFixed(2) + " Pi";

}

/* ===============================
   REFRESH TREASURY
=============================== */
async function refreshAdminWallet(){

  const txs = await fetchTransactions();

  const liveBalance =
    await getWalletBalance();

  document.getElementById(
    "adminBalance"
  ).innerHTML = `

    <div style="font-size:28px;font-weight:800">
      ${liveBalance.toFixed(2)} Pi
    </div>

    <div style="margin-top:10px;font-size:12px">
      Live Testnet Wallet Balance
    </div>

  `;

  renderTransactions(txs);

}
