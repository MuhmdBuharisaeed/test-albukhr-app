document.addEventListener(
  "DOMContentLoaded",
  () => {

    renderTreasuryOverview();

    loadRecentTransactions();

    checkLiquidity();

    loadAnalytics();

    await renderWalletHealth();

    setInterval(() => {

      renderTreasuryOverview();

      loadRecentTransactions();

      checkLiquidity();

      loadAnalytics();

      await renderWalletHealth();

    }, 5000);

  }
);
