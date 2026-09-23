/* ALBUKHR TESTNET ADMIN BRIDGE v1
 *
 * Purpose:
 * - Expose a convenient Admin Dashboard link to an already authorized Testnet admin.
 * - Reuse the existing testnet-admin-auth.js security/session boundary.
 * - Keep the link hidden for normal visitors.
 * - Never modify the ALBUKHR Dock Navigation.
 *
 * IMPORTANT:
 * This bridge is navigation only. admin-dashboard.html still performs its own
 * authenticated server-side/admin-session checks.
 */
(function(window, document){
  "use strict";

  var initialized = false;
  var LINK_ID = "albukhrTestnetAdminDashboardLink";

  function clean(value){
    return String(value == null ? "" : value).trim();
  }

  function findHost(){
    return (
      document.querySelector(".header-actions") ||
      document.querySelector("header > div[aria-label=\"Testnet marketplace navigation\"]") ||
      document.querySelector("header > div:last-of-type") ||
      document.querySelector("header")
    );
  }

  function createLink(){
    var existing = document.getElementById(LINK_ID);
    if(existing) return existing;

    var host = findHost();
    if(!host) return null;

    var link = document.createElement("a");
    link.id = LINK_ID;
    link.className = "testnet-admin-dashboard-link";
    link.href = "admin-dashboard.html";
    link.textContent = "Admin Dashboard";
    link.setAttribute("aria-label", "Open ALBUKHR Testnet Admin Dashboard");
    link.setAttribute("title", "Open Testnet Admin Dashboard");
    link.dataset.testnetAdminLink = "true";

    host.appendChild(link);
    return link;
  }

  async function init(){
    if(initialized) return;
    initialized = true;

    try{
      var auth = window.AlbukhrTestnetAdminAuth;

      if(!auth || typeof auth.requireAdmin !== "function"){
        return;
      }

      /*
       * redirectOnFailure:false is critical here:
       * normal visitors must stay on their current page.
       *
       * When an authorized admin reaches the page with ?admin_code=...,
       * the existing auth module may redeem that code and establish the
       * same Testnet admin session used by admin-dashboard.html.
       */
      var session = await auth.requireAdmin({
        redirectOnFailure: false
      });

      if(!session){
        return;
      }

      createLink();
    }catch(error){
      /*
       * This bridge must never block or redirect the main app because
       * navigation convenience failed. The Admin Dashboard remains
       * independently protected.
       */
      console.debug("[ALBUKHR TESTNET ADMIN BRIDGE]", clean(error && error.message));
    }
  }

  window.AlbukhrTestnetAdminBridge = Object.freeze({
    init: init
  });

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init, {once:true});
  }else{
    init();
  }
})(window, document);
