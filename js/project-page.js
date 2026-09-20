/* ALBUKHR TESTNET PROJECT PAGE v7 */

(function (window, document) {
  "use strict";

  var TESTNET_HOST = "test.albukhr.com";
  var TESTNET_NETWORK = "testnet";

  var initialized = false;
  var loadingPromise = null;

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function getElement(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    var element = getElement(id);

    if (element) {
      element.textContent = String(value == null ? "" : value);
    }

    return element;
  }

  function getEnvironment() {
    var env = window.ALBukhrEnvironment;

    if (
      !env ||
      typeof env.isKnown !== "function" ||
      typeof env.isTestnet !== "function" ||
      typeof env.getNetwork !== "function"
    ) {
      throw new Error(
        "Testnet environment module is unavailable."
      );
    }

    if (
      !env.isKnown() ||
      !env.isTestnet() ||
      env.getNetwork() !== TESTNET_NETWORK
    ) {
      throw new Error(
        "Invalid Testnet environment."
      );
    }

    var hostname = "";

    if (typeof env.getHostname === "function") {
      hostname = clean(env.getHostname()).toLowerCase();
    } else {
      try {
        hostname = clean(
          window.location &&
          window.location.hostname
            ? window.location.hostname
            : ""
        ).toLowerCase();
      } catch (_) {
        hostname = "";
      }
    }

    if (hostname !== TESTNET_HOST) {
      throw new Error(
        "Testnet project page is available only on test.albukhr.com."
      );
    }

    return env;
  }

  function getRegistry() {
    var registry = window.AlbukhrTestnetRegistry;

    if (
      !registry ||
      typeof registry.load !== "function" ||
      typeof registry.resolve !== "function"
    ) {
      throw new Error(
        "Testnet project registry is unavailable."
      );
    }

    return registry;
  }

  function getIdentity() {
    var params = new URLSearchParams(
      window.location.search || ""
    );

    return clean(
      params.get("project") ||
      params.get("slug") ||
      params.get("project_code") ||
      params.get("project_id")
    );
  }

  function hideLogo() {
    var logo = getElement("projectLogo");

    if (!logo) {
      return;
    }

    logo.hidden = true;
    logo.removeAttribute("src");
    logo.alt = "";
  }

  function showLogo(url, name) {
    var logo = getElement("projectLogo");

    if (!logo) {
      return;
    }

    var logoUrl = clean(url);

    if (!logoUrl) {
      hideLogo();
      return;
    }

    logo.src = logoUrl;
    logo.alt = name || "ALBUKHR Project";
    logo.hidden = false;
  }

  function renderNotFound() {
    setText("projectTitle", "Project not found");

    setText(
      "projectAbout",
      "This project is not available in the Testnet registry."
    );

    setText(
      "projectState",
      "TESTNET • PROJECT NOT FOUND"
    );

    hideLogo();

    try {
      document.title = "Project not found • ALBUKHR TESTNET";
    } catch (_) {}
  }

  function renderProject(project) {
    if (!project || typeof project !== "object") {
      renderNotFound();
      return null;
    }

    /*
     * Final defensive network isolation.
     * The registry already filters this, but the project page
     * must never trust an object without checking it again.
     */
    var network = clean(project.network).toLowerCase();

    if (network !== TESTNET_NETWORK) {
      throw new Error(
        "Invalid project network. Expected Testnet."
      );
    }

    var name =
      clean(project.name) ||
      clean(project.title) ||
      "Project";

    var description = clean(project.description);

    var projectType = clean(
      project.project_type ||
      project.projectType ||
      ""
    );

    var status = clean(project.status);

    var projectCode = clean(project.project_code);

    if (!description) {
      description =
        "Registered ALBUKHR Testnet project" +
        (
          projectType
            ? " • " + projectType
            : ""
        );
    }

    setText("projectTitle", name);

    setText(
      "projectAbout",
      description
    );

    setText(
      "projectState",
      "TESTNET • " +
      (status ? status.toUpperCase() : "REGISTERED")
    );

    showLogo(project.logo_url, name);

    try {
      document.title =
        name + " • ALBUKHR TESTNET";
    } catch (_) {}

    /*
     * Preserve useful project identity on the page where
     * the HTML contains the corresponding elements.
     */
    setText("projectCode", projectCode);
    setText("projectType", projectType);
    setText("projectNetwork", TESTNET_NETWORK.toUpperCase());

    return project;
  }

  async function load() {
    getEnvironment();

    var registry = getRegistry();

    var identity = getIdentity();

    if (!identity) {
      renderNotFound();
      return null;
    }

    if (loadingPromise) {
      return loadingPromise;
    }

    loadingPromise = (async function () {
      /*
       * Force a fresh registry read for the project page so that
       * newly approved/updated Testnet projects are not rendered
       * from stale in-memory registry data.
       */
      await registry.load(true);

      var project = registry.resolve(identity);

      if (!project) {
        renderNotFound();
        return null;
      }

      return renderProject(project);
    })();

    try {
      return await loadingPromise;
    } finally {
      loadingPromise = null;
    }
  }

  async function boot() {
    if (initialized) {
      return;
    }

    initialized = true;

    try {
      await load();

      try {
        window.dispatchEvent(
          new CustomEvent(
            "albukhr:testnet-project-loaded"
          )
        );
      } catch (_) {}
    } catch (error) {
      console.error(
        "[ALBUKHR TESTNET PROJECT]",
        error
      );

      hideLogo();

      setText(
        "projectState",
        "Unable to load Testnet project data."
      );

      try {
        window.dispatchEvent(
          new CustomEvent(
            "albukhr:testnet-project-error",
            {
              detail: {
                message: clean(
                  error && error.message
                )
              }
            }
          )
        );
      } catch (_) {}
    }
  }

  var api = {
    load: load,
    boot: boot,
    getIdentity: getIdentity
  };

  try {
    Object.freeze(api);
  } catch (_) {}

  window.AlbukhrTestnetProject = api;

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      boot,
      { once: true }
    );
  } else {
    boot();
  }

})(window, document);
