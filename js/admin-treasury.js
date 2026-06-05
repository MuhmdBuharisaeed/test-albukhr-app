async function renderTreasuryOverview(){

  const balance =
    await getWalletBalance();

  document.getElementById(
    "treasuryBalance"
  ).innerText =
    balance.toFixed(2) + " Pi";

  document.getElementById(
    "availableLiquidity"
  ).innerText =
    balance.toFixed(2) + " Pi";

  document.getElementById(
    "liquidityStatus"
  ).innerText =
    balance > 20
      ? "🟢 SAFE"
      : "🔴 LOW";

}
