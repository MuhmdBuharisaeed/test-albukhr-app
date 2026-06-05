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

  const treasury =
    await getWalletBalance();

  const { data: pending } = await supabase
    .from("withdraw_requests")
    .select("amount")
    .eq("status","pending");

  let pendingTotal = 0;

  (pending || []).forEach(r=>{
    pendingTotal += Number(r.amount) || 0;
  });

  const { data: approved } = await supabase
    .from("withdraw_requests")
    .select("amount")
    .eq("status","approved");

  let approvedTotal = 0;

  (approved || []).forEach(r=>{
    approvedTotal += Number(r.amount) || 0;
  });

  const liquidity =
    treasury -
    pendingTotal -
    approvedTotal;

  let status = "🟢 SAFE";

  if(liquidity < 100){
    status = "🟡 WARNING";
  }

  if(liquidity < 20){
    status = "🔴 DANGER";
  }

  document.getElementById("treasuryBalance")
    .innerText =
    treasury.toFixed(2) + " Pi";

  document.getElementById("pendingTotal")
    .innerText =
    pendingTotal.toFixed(2) + " Pi";

  document.getElementById("approvedTotal")
    .innerText =
    approvedTotal.toFixed(2) + " Pi";

  document.getElementById("availableLiquidity")
    .innerText =
    liquidity.toFixed(2) + " Pi";

  document.getElementById("liquidityStatus")
    .innerText =
    status;

}

/* ===============================
   REFRESH TREASURY
=============================== */
async function refreshAdminWallet(){

  const txs = await fetchTransactions();

  const treasury =
    calculateTreasury(txs);

  renderSummary(treasury);
  renderTransactions(txs);

}
