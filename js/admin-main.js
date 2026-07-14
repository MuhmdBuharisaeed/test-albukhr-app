/* =========================================
   ALBUKHR ADMIN MAIN
========================================= */

const ADMIN_REFRESH_INTERVAL = 60000;

/* =========================================
   LOAD ALL MODULES
========================================= */

async function loadAdminDashboard(){

try{

await Promise.all([

renderTreasuryOverview(),

loadRecentTransactions(),

checkLiquidity(),

loadAnalytics(),

renderPendingRequests(),

renderApprovedRequests(),

renderPaidRequests()

]);

}catch(error){

console.error(

"Admin Dashboard Error:",

error

);

}

}

/* =========================================
   INITIALIZE
========================================= */

document.addEventListener(

"DOMContentLoaded",

async ()=>{

await loadAdminDashboard();

setInterval(

loadAdminDashboard,

ADMIN_REFRESH_INTERVAL

);

});
