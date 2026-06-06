document.addEventListener(
  "DOMContentLoaded",
  () => {

    renderTreasuryOverview();

    loadRecentTransactions();

    checkLiquidity();

    setInterval(() => {

      renderTreasuryOverview();

      loadRecentTransactions();

      checkLiquidity();

    }, 5000);

  }
);
