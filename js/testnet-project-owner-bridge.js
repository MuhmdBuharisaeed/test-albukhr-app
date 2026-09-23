/* ALBUKHR TESTNET PROJECT OWNER VISIBILITY BRIDGE v1 */
(function (window, document) {
  "use strict";

  var OWNER_API =
    "https://vhvkwvngmrlgyzwemttt.supabase.co/functions/v1/testnet-project-owner";

  var checkedProjectId = "";

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function getAuth() {
    return window.AlbukhrTestnetAuth || null;
  }

  function hideLiquidityPanel() {
    var panel =
      document.querySelector('[data-project-panel="liquidity"]');

    if (panel) {
      panel.hidden = true;
    }
  }

  function showLiquidityPanel() {
    var panel =
      document.querySelector('[data-project-panel="liquidity"]');

    if (panel) {
      panel.hidden = false;
    }
  }

  function ensureOwnerButton() {
    var identity =
      document.querySelector(".project-identity");

    if (!identity || document.getElementById("projectOwnerButton")) {
      return null;
    }

    var wrapper = document.createElement("div");
    wrapper.className = "project-owner-action-wrap";

    var link = document.createElement("a");
    link.id = "projectOwnerButton";
    link.className = "project-owner-button";
    link.hidden = true;
    link.textContent = "Project Owner";
    link.href = "project-owner.html";

    wrapper.appendChild(link);
    identity.appendChild(wrapper);

    return link;
  }

  async function checkOwner(project) {
    var projectId = clean(project && project.id);

    if (!projectId || projectId === checkedProjectId) {
      return;
    }

    checkedProjectId = projectId;

    hideLiquidityPanel();

    var ownerButton = ensureOwnerButton();

    if (ownerButton) {
      ownerButton.hidden = true;
    }

    var auth = getAuth();

    if (
      !auth ||
      typeof auth.requireTestnetAuth !== "function" ||
      typeof auth.getSessionToken !== "function"
    ) {
      return;
    }

    var session;

    try {
      session =
        await auth.requireTestnetAuth({
          redirectOnFailure: false
        });
    } catch (error) {
      console.warn(
        "[ALBUKHR TESTNET OWNER BRIDGE] Testnet auth failed.",
        error
      );
      return;
    }

    if (!session) {
      return;
    }

    var token = clean(
      auth.getSessionToken()
    );

    if (!token) {
      return;
    }

    var url =
      OWNER_API +
      "?project_id=" +
      encodeURIComponent(projectId);

    try {
      var response =
        await fetch(url, {
          method: "GET",
          headers: {
            "Accept": "application/json",
            "X-Testnet-Session": token
          }
        });

      if (!response.ok) {
        return;
      }

      var body = await response.json();

      var owned =
        body &&
        Array.isArray(body.projects) &&
        body.projects.length > 0 &&
        body.projects[0] &&
        String(body.projects[0].project.id || "") === projectId;

      if (!owned) {
        return;
      }

      if (ownerButton) {
        ownerButton.href =
          "project-owner.html?project=" +
          encodeURIComponent(project.project_code || projectId);

        ownerButton.hidden = false;
      }

      /*
       * Existing liquidity panel is shown only after the
       * server confirms project-owner access.
       */
      showLiquidityPanel();

      window.dispatchEvent(
        new CustomEvent(
          "albukhr:testnet-project-owner-authorized",
          {
            detail: {
              project: project,
              owner: body.owner || null
            }
          }
        )
      );

    } catch (error) {
      console.warn(
        "[ALBUKHR TESTNET OWNER BRIDGE]",
        error
      );
    }
  }

  function initialize() {
    hideLiquidityPanel();
    ensureOwnerButton();

    window.addEventListener(
      "albukhr:testnet-project-loaded",
      function (event) {
        checkOwner(
          event.detail &&
          event.detail.project
        );
      }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }

})(window, document);
