document.addEventListener(
  "DOMContentLoaded",
  () => {

    renderTreasuryOverview();

    loadRecentTransactions();

    setInterval(() => {

      renderTreasuryOverview();

      loadRecentTransactions();

    }, 5000);

  }
);
