/* ===============================
   ADMIN DASHBOARD BOOT
=============================== */

async function startAdminDashboard(){

  try{

    // Projects
    await loadProjects();

    // Wallet Summary
    await refreshAdminWallet();

    // Treasury
    await renderTreasuryOverview();

    // Requests
    await renderPendingRequests();
    await renderApprovedRequests();
    await renderPaidRequests();

    // Stats
    await loadRequestStats();

    console.log(
      "✅ Admin Dashboard Loaded"
    );

  }catch(error){

    console.error(
      "Dashboard Startup Error:",
      error
    );

  }

}

/* ===============================
   AUTO REFRESH
=============================== */

async function refreshDashboard(){

  try{

    await refreshAdminWallet();

    await renderTreasuryOverview();

    await renderPendingRequests();

    await renderApprovedRequests();

    await renderPaidRequests();

    await loadRequestStats();

  }catch(error){

    console.error(
      "Dashboard Refresh Error:",
      error
    );

  }

}

/* ===============================
   DOM READY
=============================== */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    startAdminDashboard();

    setInterval(() => {

      refreshDashboard();

    }, 5000); // refresh every 5 seconds

  }
);
