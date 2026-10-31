/* Additive link visibility only; never re-redeems Admin access codes. */
(function (window, document) {
  "use strict";
  var link = document.getElementById("ownerApplicationsReviewLink");
  var auth = window.AlbukhrTestnetAdminAuth;
  if (!link || !auth || typeof auth.getSession !== "function") return;

  function revealWhenAuthorized() {
    try {
      // The existing Testnet Admin dashboard owns authentication and
      // one-time admin_code redemption. Observe its resulting session only.
      var session = auth.getSession();
      var admin = session && session.admin ? session.admin : {};
      var roles = Array.isArray(admin.roles) ? admin.roles : [];
      if (session && session.network === "testnet" && roles.indexOf("super_admin") !== -1) {
        link.hidden = false;
        return true;
      }
    } catch (_) {
      link.hidden = true;
    }
    return false;
  }

  if (revealWhenAuthorized()) return;
  var attempts = 0;
  var timer = window.setInterval(function () {
    attempts += 1;
    if (revealWhenAuthorized() || attempts >= 120) window.clearInterval(timer);
  }, 100);
})(window, document);
