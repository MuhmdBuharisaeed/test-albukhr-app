/* ===============================
   SUPABASE INIT
=============================== */
const supabase = window.supabase.createClient(
  "https://qexmnghilahsvethlxem.supabase.co",
  "YOUR_PUBLIC_KEY"
);

/* ===============================
   FETCH TRANSACTIONS
=============================== */
async function fetchTransactions(){

  const { data, error } = await supabase
    .from("transactions")
    .select("id, project, amount, type, fee, wallet, created_at")
    .order("created_at", { ascending: false });

  if(error){
    console.error("Fetch TX error:", error);
    return [];
  }

  return data || [];
}

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

  const treasury =
    totalStake +
    adminLiquidity +
    totalFees -
    rewardWithdraw -
    capitalWithdraw;

  return {
    treasury,
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

  if(t.treasury <= 0) return "CRITICAL";
  if(t.treasury < 100) return "LOW";

  return "HEALTHY";
}

/* ===============================
   RENDER SUMMARY
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
   RENDER TRANSACTIONS
=============================== */
function renderTransactions(txs){

  const box = document.getElementById("adminTxList");
  box.innerHTML = "";

  if(!txs.length){
    box.innerHTML = "<small>No withdrawals yet</small>";
    return;
  }

  txs
  .filter(tx => tx.type === "withdraw" || tx.type === "capital")
  .forEach(tx => {

    box.innerHTML += `
    <div class="tx">
      <strong>${tx.project}</strong><br>

      Type: ${tx.type}<br>
      Amount: -${Number(tx.amount).toFixed(2)} Pi<br>
      Fee: ${Number(tx.fee || 0).toFixed(2)} Pi<br>

      Wallet:
      ${tx.wallet || "internal"}<br>

      <small>
      ${new Date(tx.created_at).toLocaleString()}
      </small>
    </div>
    `;

  });

}

/* ===============================
   ADMIN ADD LIQUIDITY
=============================== */
async function adminAddWallet(){

  const project =
    document.getElementById("adminProject").value;

  const amount =
    Number(document.getElementById("adminAmount").value);

  const type =
    document.getElementById("adminType").value;

  if(!project){
    alert("Select project");
    return;
  }

  if(!amount || amount <= 0){
    alert("Invalid amount");
    return;
  }

  const { error } = await supabase
    .from("transactions")
    .insert([{
      project,
      amount,
      type: type === "reward"
        ? "admin-credit"
        : type,
      fee: 0,
      wallet: "admin",
      created_at: new Date()
    }]);

  if(error){
    console.error(error);
    alert("Insert failed");
    return;
  }

  alert("Wallet updated");
  refresh();
}

/* ===============================
   MAIN REFRESH
=============================== */
async function refresh(){

  const txs = await fetchTransactions();

  const treasury = calculateTreasury(txs);

  renderSummary(treasury);
  renderTransactions(txs);

}

/* ===============================
   INIT
=============================== */
document.addEventListener("DOMContentLoaded", ()=>{

  refresh();

  setInterval(refresh, 5000);

});
