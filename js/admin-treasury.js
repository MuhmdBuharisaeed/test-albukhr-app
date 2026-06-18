async function renderTreasuryOverview(){

  const balance =
    await getWalletBalance();

  /* =========================
     PENDING TOTAL
  ========================= */

  const { data: pendingRows } =
    await supabaseClient
      .from("withdraw_requests")
      .select("amount")
      .eq("status","pending");

  let pendingTotal = 0;

  (pendingRows || []).forEach(r=>{

    pendingTotal +=
      Number(r.amount) || 0;

  });

  /* =========================
     APPROVED TOTAL
  ========================= */

  const { data: approvedRows } =
    await supabaseClient
      .from("withdraw_requests")
      .select("amount")
      .eq("status","approved");

  let approvedTotal = 0;

  (approvedRows || []).forEach(r=>{

    approvedTotal +=
      Number(r.amount) || 0;

  });

  /* =========================
     AVAILABLE LIQUIDITY
  ========================= */

  const availableLiquidity =
    balance -
    pendingTotal -
    approvedTotal;

  /* =========================
     TOP CARD
  ========================= */

  document.getElementById(
    "adminBalance"
  ).innerText =
    balance.toFixed(2) + " Pi";

  /* =========================
     TREASURY CARD
  ========================= */

  document.getElementById(
    "treasuryBalance"
  ).innerText =
    balance.toFixed(2) + " Pi";

  document.getElementById(
    "pendingTotal"
  ).innerText =
    pendingTotal.toFixed(2) + " Pi";

  document.getElementById(
    "approvedTotal"
  ).innerText =
    approvedTotal.toFixed(2) + " Pi";

  document.getElementById(
    "availableLiquidity"
  ).innerText =
    availableLiquidity.toFixed(2) + " Pi";

  document.getElementById(
    "liquidityStatus"
  ).innerText =
    availableLiquidity > 20
      ? "🟢 SAFE"
      : "🔴 LOW";

}
