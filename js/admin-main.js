document.addEventListener(
  "DOMContentLoaded",
  () => {

    renderTreasuryOverview();
    loadRecentTransactions();
    checkLiquidity();
    loadAnalytics();

    // Withdraw Sections
    renderPendingRequests();
    renderApprovedRequests();
    renderPaidRequests();

    setInterval(() => {

      renderTreasuryOverview();
      loadRecentTransactions();
      checkLiquidity();
      loadAnalytics();

      // Refresh Withdraw Sections
      renderPendingRequests();
      renderApprovedRequests();
      renderPaidRequests();

    }, 60000);

  }
);
