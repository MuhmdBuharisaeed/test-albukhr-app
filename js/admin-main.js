document.addEventListener(
  "DOMContentLoaded",
  () => {

    renderTreasuryOverview();

    loadRecentTransactions();

    checkLiquidity();

    loadAnalytics();

    setInterval(() => {

      renderTreasuryOverview();

      loadRecentTransactions();

      checkLiquidity();

      loadAnalytics();

    }, 50000);

  }
);
