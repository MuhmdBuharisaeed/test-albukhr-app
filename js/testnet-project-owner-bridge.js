/* ALBUKHR TESTNET PROJECT OWNER PAGE VISIBILITY BRIDGE v1.2
 * Multi-project selector: never silently auto-selects the first project.
 * Keeps project ownership, authentication, and Dock Navigation unchanged.
 */
(function (window, document) {
  "use strict";

  var OWNER_API =
    "https://vhvkwvngmrlgyzwemttt.supabase.co/functions/v1/testnet-project-owner";

  var initialized = false;
  var requestInFlight = false;
  var ownedProjects = [];
  var controlWrap = null;
  var trigger = null;
  var menu = null;

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function getAuth() {
    return window.AlbukhrTestnetAuth || null;
  }

  function getHeaderContainer() {
    /* Header-only insertion. The existing ALBUKHR Dock Navigation is untouched. */
    return (
      document.querySelector(".header-actions") ||
      document.querySelector(".owner-header-actions") ||
      document.querySelector('header > div[aria-label*="navigation" i]') ||
      document.querySelector("header")
    );
  }

  function closeMenu(returnFocus) {
    if (!menu || !trigger) return;
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (returnFocus) trigger.focus();
  }

  function removeMenu() {
    if (menu && menu.parentNode) menu.parentNode.removeChild(menu);
    menu = null;
    if (trigger) {
      trigger.setAttribute("aria-expanded", "false");
      trigger.removeAttribute("aria-haspopup");
      trigger.removeAttribute("aria-controls");
    }
  }

  function projectUrl(project) {
    var reference = clean(project.project_code) || clean(project.id);
    return "project-owner.html?project=" + encodeURIComponent(reference);
  }

  function makeMenuItem(project) {
    var link = document.createElement("a");
    link.className = "testnet-owner-project-option";
    link.href = projectUrl(project);
    link.setAttribute("role", "menuitem");

    var name = document.createElement("strong");
    name.className = "testnet-owner-project-option-name";
    name.textContent = project.name;

    var meta = document.createElement("span");
    meta.className = "testnet-owner-project-option-meta";
    meta.textContent = [
      project.project_code,
      clean(project.project_type).toUpperCase()
    ].filter(Boolean).join(" · ");

    link.appendChild(name);
    link.appendChild(meta);
    return link;
  }

  function openMenu() {
    if (!menu || !trigger) return;
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    var first = menu.querySelector("a[role='menuitem']");
    if (first) first.focus();
  }

  function toggleMenu() {
    if (!menu) return;
    if (menu.hidden) openMenu();
    else closeMenu(false);
  }

  function handleTriggerClick(event) {
    event.preventDefault();
    if (!ownedProjects.length) return;

    if (ownedProjects.length === 1) {
      window.location.assign(projectUrl(ownedProjects[0]));
      return;
    }

    toggleMenu();
  }

  function ensureControl() {
    var header = getHeaderContainer();
    if (!header) return null;

    if (controlWrap && controlWrap.isConnected) return controlWrap;

    controlWrap = document.getElementById("testnetProjectOwnerControl");
    if (controlWrap) {
      trigger = controlWrap.querySelector("#testnetProjectOwnerPageButton");
      menu = controlWrap.querySelector("#testnetOwnerProjectMenu");
      return controlWrap;
    }

    controlWrap = document.createElement("div");
    controlWrap.id = "testnetProjectOwnerControl";
    controlWrap.className = "testnet-owner-control-wrap";

    trigger = document.createElement("button");
    trigger.id = "testnetProjectOwnerPageButton";
    trigger.className = "testnet-owner-page-button";
    trigger.type = "button";
    trigger.hidden = true;
    trigger.textContent = "Project Owner";
    trigger.setAttribute("aria-label", "Open Project Owner dashboard");
    trigger.setAttribute("title", "Project Owner");
    trigger.addEventListener("click", handleTriggerClick);

    controlWrap.appendChild(trigger);
    header.insertBefore(controlWrap, header.firstChild);
    return controlWrap;
  }

  function renderProjectControl(projects) {
    var wrap = ensureControl();
    if (!wrap || !trigger) return;

    ownedProjects = projects.slice().sort(function (a, b) {
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

    if (!ownedProjects.length) {
      removeMenu();
      trigger.hidden = true;
      return;
    }

    trigger.hidden = false;

    if (ownedProjects.length === 1) {
      removeMenu();
      trigger.textContent = "Project Owner";
      trigger.setAttribute("aria-label", "Open Project Owner dashboard for " + ownedProjects[0].name);
      trigger.setAttribute("title", ownedProjects[0].name);
      return;
    }

    trigger.textContent = "Project Owner (" + ownedProjects.length + ")";
    trigger.setAttribute("aria-label", "Choose one of " + ownedProjects.length + " Project Owner dashboards");
    trigger.setAttribute("title", "Choose a project");
    trigger.setAttribute("aria-haspopup", "menu");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", "testnetOwnerProjectMenu");

    removeMenu();
    menu = document.createElement("div");
    menu.id = "testnetOwnerProjectMenu";
    menu.className = "testnet-owner-project-menu";
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", "Choose a Project Owner dashboard");
    menu.hidden = true;

    var heading = document.createElement("div");
    heading.className = "testnet-owner-project-menu-heading";
    heading.textContent = "Choose a project";
    menu.appendChild(heading);

    ownedProjects.forEach(function (project) {
      menu.appendChild(makeMenuItem(project));
    });

    wrap.appendChild(menu);
  }

  function normalizeOwnedProjects(payload) {
    var list = payload && Array.isArray(payload.projects) ? payload.projects : [];

    return list.map(function (item) {
      var project = item && item.project && typeof item.project === "object"
        ? item.project
        : item;

      if (!project || typeof project !== "object") return null;

      var id = clean(project.id);
      if (!id) return null;

      return {
        id: id,
        project_code: clean(project.project_code) || id,
        name: clean(project.name) || clean(project.project_code) || "Project",
        project_type: clean(project.project_type),
        status: clean(project.status),
        network: clean(project.network)
      };
    }).filter(Boolean);
  }

  async function resolveOwnerAccess() {
    if (requestInFlight) return;

    var auth = getAuth();
    if (
      !auth ||
      typeof auth.requireTestnetAuth !== "function" ||
      typeof auth.getSessionToken !== "function"
    ) return;

    requestInFlight = true;

    try {
      var session = await auth.requireTestnetAuth({ redirectOnFailure: false });
      if (!session) return;

      var token = clean(auth.getSessionToken());
      if (!token) return;

      var response = await fetch(OWNER_API, {
        method: "GET",
        cache: "no-store",
        headers: {
          "Accept": "application/json",
          "X-Testnet-Session": token
        }
      });

      if (!response.ok) {
        renderProjectControl([]);
        return;
      }

      var payload = await response.json();
      var projects = normalizeOwnedProjects(payload);
      renderProjectControl(projects);

      window.dispatchEvent(new CustomEvent(
        "albukhr:testnet-project-owner-page-authorized",
        {
          detail: {
            projects: projects,
            selectedProject: projects.length === 1 ? projects[0] : null,
            requiresProjectSelection: projects.length > 1
          }
        }
      ));
    } catch (error) {
      console.warn("[ALBUKHR TESTNET OWNER PAGE BRIDGE]", error);
      /* Keep any previously rendered owner control; do not expose unauthenticated access. */
    } finally {
      requestInFlight = false;
    }
  }

  function handleDocumentClick(event) {
    if (!controlWrap || !menu || menu.hidden) return;
    if (!controlWrap.contains(event.target)) closeMenu(false);
  }

  function handleDocumentKeydown(event) {
    if (event.key === "Escape" && menu && !menu.hidden) closeMenu(true);
  }

  function initialize() {
    if (initialized) return;
    initialized = true;

    ensureControl();
    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleDocumentKeydown);

    window.setTimeout(resolveOwnerAccess, 0);
    window.addEventListener("albukhr:testnet-auth-success", resolveOwnerAccess);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})(window, document);
