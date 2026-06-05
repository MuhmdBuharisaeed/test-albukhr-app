document.addEventListener(
  "DOMContentLoaded",
  () => {

    renderTreasuryOverview();

    setInterval(() => {

      renderTreasuryOverview();

    }, 5000);

  }
);
