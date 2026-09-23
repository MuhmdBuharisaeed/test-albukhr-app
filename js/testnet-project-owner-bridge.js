/* ALBUKHR TESTNET PROJECT OWNER PAGE VISIBILITY BRIDGE v1 */
(function (window, document) {
  "use strict";

  var OWNER_API =
    "https://vhvkwvngmrlgyzwemttt.supabase.co/functions/v1/testnet-project-owner";

  var initialized = false;
  var requestInFlight = false;

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function getAuth() {
    return window.AlbukhrTestnetAuth || null;
  }

  function getHeaderContainer() {
    return (
      document.querySelector(".header-actions") ||
      document.querySelector("header .header-actions") ||
      null
    );
  }

  function removeExistingButton() {
    var existing = document.getElementById("testnetProjectOwnerPageButton");
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
  }

  function ensureButton() {
    var header = getHeaderContainer();

    if (!header) {
      return null;
    }

    var existing = document.getElementById("testnetProjectOwnerPageButton");

    if (existing) {
      return existing;
    }

    var link = document.createElement("a");
    link.id = "testnetProjectOwnerPageButton";
    link.className = "testnet-owner-page-button";
    link.hidden = true;
    link.href = "project-owner.html";
    link.textContent = "Project Owner";
    link.setAttribute(
      "aria-label",
      "Open Project Owner controls"
    );
    link.setAttribute(
      "title",
      "Project Owner"
    );

    /*
     * Insert without touching the existing Dock Navigation
     * or replacing any header controls.
     */
    header.insertBefore(link, header.firstChild);

    return link;
  }

  function normalizeOwnedProjects(payload) {
    var list =
      payload &&
      Array.isArray(payload.projects)
        ? payload.projects
        : [];

    return list
      .map(function (item) {
        var project =
          item &&
          item.project &&
          typeof item.project === "object"
            ? item.project
            : item;

        if (!project || typeof project !== "object") {
          return null;
        }

        var id = clean(project.id);

        if (!id) {
          return null;
        }

        return {
          id: id,
          project_code:
            clean(project.project_code) || id,
          name:
            clean(project.name) || "Project"
        };
      })
      .filter(Boolean);
  }

  function chooseProject(projects) {
    if (!projects.length) {
      return null;
    }

    /*
     * The current ALBUKHR ownership model normally binds one project
     * to an owner. If an owner later controls more than one project,
     * preserve deterministic behavior by opening the first project
     * returned by the server rather than exposing an unscoped page.
     */
    return projects[0];
  }

  async function resolveOwnerAccess() {
    if (requestInFlight) {
      return;
    }

    var auth = getAuth();

    if (
      !auth ||
      typeof auth.requireTestnetAuth !== "function" ||
      typeof auth.getSessionToken !== "function"
    ) {
      return;
    }

    requestInFlight = true;

    try {
      var session =
        await auth.requireTestnetAuth({
          redirectOnFailure: false
        });

      if (!session) {
        return;
      }

      var token =
        clean(auth.getSessionToken());

      if (!token) {
        return;
      }

      var response =
        await fetch(
          OWNER_API,
          {
            method: "GET",
            headers: {
              "Accept": "application/json",
              "X-Testnet-Session": token
            }
          }
        );

      if (!response.ok) {
        return;
      }

      var payload =
        await response.json();

      var projects =
        normalizeOwnedProjects(payload);

      var project =
        chooseProject(projects);

      if (!project) {
        return;
      }

      var button =
        ensureButton();

      if (!button) {
        return;
      }

      button.href =
        "project-owner.html?project=" +
        encodeURIComponent(
          project.project_code || project.id
        );

      button.textContent =
        projects.length > 1
          ? "Project Owner (" + projects.length + ")"
          : "Project Owner";

      button.setAttribute(
        "aria-label",
        projects.length > 1
          ? "Open Project Owner controls for your first owned project"
          : "Open Project Owner controls"
      );

      button.hidden = false;

      window.dispatchEvent(
        new CustomEvent(
          "albukhr:testnet-project-owner-page-authorized",
          {
            detail: {
              projects: projects,
              selectedProject: project
            }
          }
        )
      );
    } catch (error) {
      /*
       * Owner access is additive. Failure keeps the existing page
       * unchanged and simply leaves the owner control hidden.
       */
      console.warn(
        "[ALBUKHR TESTNET OWNER PAGE BRIDGE]",
        error
      );
    } finally {
      requestInFlight = false;
    }
  }

  function initialize() {
    if (initialized) {
      return;
    }

    initialized = true;

    ensureButton();

    /*
     * Resolve after the existing Testnet modules have had a chance
     * to establish the temporary Testnet session.
     */
    window.setTimeout(
      resolveOwnerAccess,
      0
    );

    window.addEventListener(
      "albukhr:testnet-auth-success",
      function () {
        resolveOwnerAccess();
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
