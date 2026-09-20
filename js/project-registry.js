/* ALBUKHR TESTNET PROJECT REGISTRY v6 */
(function (window, document) {
  "use strict";

  /*
   * ALBUKHR TESTNET PROJECT REGISTRY
   *
   * Source of truth:
   *   Testnet Supabase public project registry RPC
   *
   * RPC:
   *   get_public_project_registry
   *
   * Rules:
   * - Testnet only.
   * - Never read Mainnet project data.
   * - Never write project data.
   * - Project identity comes from the registry.
   * - project_code / slug / id are used for navigation.
   * - logo_url is read from the registry.
   */

  var RPC =
    "get_public_project_registry";

  var NETWORK =
    "testnet";

  var projects = [];

  var loaded = false;

  var loadingPromise = null;

  /*
   * ------------------------------------------------------------------
   * Utilities
   * ------------------------------------------------------------------
   */

  function clean(value) {
    return String(
      value == null ? "" : value
    ).trim();
  }

  function lower(value) {
    return clean(value).toLowerCase();
  }

  function getCore() {
    var core =
      window.ALBUKHR_SUPABASE;

    if (!core) {
      throw new Error(
        "ALBUKHR Testnet Supabase Core is unavailable."
      );
    }

    if (
      core.network !== NETWORK
    ) {
      throw new Error(
        "ALBUKHR Supabase Core is not configured for Testnet."
      );
    }

    if (
      typeof core.rpc !== "function"
    ) {
      throw new Error(
        "ALBUKHR Supabase Core RPC interface is unavailable."
      );
    }

    return core;
  }

  /*
   * ------------------------------------------------------------------
   * Environment validation
   * ------------------------------------------------------------------
   */

  function validateEnvironment() {
    var env =
      window.ALBukhrEnvironment;

    if (
      !env ||
      typeof env.isKnown !== "function" ||
      typeof env.isTestnet !== "function" ||
      typeof env.getNetwork !== "function"
    ) {
      throw new Error(
        "ALBUKHR Testnet Environment Core is unavailable."
      );
    }

    if (
      !env.isKnown() ||
      !env.isTestnet() ||
      env.getNetwork() !== NETWORK
    ) {
      throw new Error(
        "Invalid ALBUKHR Testnet environment."
      );
    }

    return env;
  }

  /*
   * ------------------------------------------------------------------
   * Registry row validation
   * ------------------------------------------------------------------
   */

  function isTestnetProject(project) {
    if (!project) {
      return false;
    }

    return (
      lower(project.network) === NETWORK
    );
  }

  function normalizeProject(project) {
    if (!project || !isTestnetProject(project)) {
      return null;
    }

    return project;
  }

  function normalizeProjects(data) {
    if (!Array.isArray(data)) {
      return [];
    }

    var result = [];

    for (
      var i = 0;
      i < data.length;
      i += 1
    ) {
      var project =
        normalizeProject(data[i]);

      if (project) {
        result.push(project);
      }
    }

    return result;
  }

  /*
   * ------------------------------------------------------------------
   * Load public Testnet project registry
   * ------------------------------------------------------------------
   */

  async function load(force) {
    force = force === true;

    /*
     * Return the already loaded registry unless an explicit
     * refresh was requested.
     */
    if (
      loaded &&
      !force
    ) {
      return projects.slice();
    }

    /*
     * Prevent duplicate simultaneous RPC requests.
     */
    if (
      loadingPromise &&
      !force
    ) {
      return loadingPromise;
    }

    loadingPromise =
      (async function () {
        validateEnvironment();

        var core =
          getCore();

        var response =
          await core.rpc(
            RPC,
            {
              p_network: NETWORK
            }
          );

        var data =
          response && response.data;

        var error =
          response && response.error;

        if (error) {
          throw error;
        }

        var normalized =
          normalizeProjects(data);

        projects =
          normalized;

        loaded =
          true;

        /*
         * Notify pages/modules that the registry is ready.
         */
        try {
          window.dispatchEvent(
            new CustomEvent(
              "albukhr:testnet-registry-ready",
              {
                detail: {
                  projects:
                    projects.slice(),
                  network:
                    NETWORK,
                  count:
                    projects.length
                }
              }
            )
          );
        } catch (_) {}

        return projects.slice();
      })();

    try {
      return await loadingPromise;
    } finally {
      loadingPromise = null;
    }
  }

  /*
   * ------------------------------------------------------------------
   * Project identity resolution
   * ------------------------------------------------------------------
   */

  function resolve(identity) {
    var query =
      lower(identity);

    if (!query) {
      return null;
    }

    for (
      var i = 0;
      i < projects.length;
      i += 1
    ) {
      var project =
        projects[i];

      var candidates = [
        project && project.id,
        project && project.project_id,
        project && project.project_code,
        project && project.slug,
        project && project.name,
        project && project.title
      ];

      for (
        var j = 0;
        j < candidates.length;
        j += 1
      ) {
        if (
          lower(candidates[j]) ===
          query
        ) {
          return project;
        }
      }
    }

    return null;
  }

  /*
   * ------------------------------------------------------------------
   * Project URL
   * ------------------------------------------------------------------
   */

  function url(project) {
    if (!project) {
      return null;
    }

    /*
     * project_code is the preferred canonical navigation identity.
     * slug and id are fallback identities.
     */
    var key =
      clean(project.project_code) ||
      clean(project.slug) ||
      clean(project.id);

    if (!key) {
      return null;
    }

    return (
      "project.html?project=" +
      encodeURIComponent(key)
    );
  }

  /*
   * ------------------------------------------------------------------
   * Logo handling
   * ------------------------------------------------------------------
   */

  function getLogoUrl(project) {
    if (!project) {
      return "";
    }

    return clean(
      project.logo_url
    );
  }

  /*
   * A project logo is mandatory in the ALBUKHR registry.
   *
   * We do NOT create an emoji, letter, or artificial project icon
   * as a substitute. If the registry has no logo_url, the image
   * area remains empty and a diagnostic class is applied.
   */
  function createLogo(project, name) {
    var wrapper =
      document.createElement("div");

    wrapper.className =
      "project-logo-wrap";

    var logoUrl =
      getLogoUrl(project);

    if (logoUrl) {
      var image =
        document.createElement("img");

      image.className =
        "project-logo";

      image.loading =
        "lazy";

      image.decoding =
        "async";

      image.alt =
        name + " logo";

      image.src =
        logoUrl;

      image.addEventListener(
        "error",
        function () {
          wrapper.classList.add(
            "logo-load-error"
          );

          image.hidden =
            true;
        },
        { once: true }
      );

      wrapper.appendChild(
        image
      );
    } else {
      /*
       * No fake logo is generated.
       *
       * This allows the missing-logo state to be visible to
       * development/admin validation instead of hiding a registry
       * data problem behind a placeholder icon.
       */
      wrapper.classList.add(
        "logo-missing"
      );

      wrapper.setAttribute(
        "aria-label",
        "Project logo unavailable"
      );
    }

    return wrapper;
  }

  /*
   * ------------------------------------------------------------------
   * Render project cards
   * ------------------------------------------------------------------
   */

  function render(container, list) {
    if (!container) {
      return;
    }

    var source =
      Array.isArray(list)
        ? list
        : projects;

    /*
     * Only render valid Testnet projects.
     */
    var renderList =
      normalizeProjects(
        source
      );

    container.replaceChildren();

    for (
      var i = 0;
      i < renderList.length;
      i += 1
    ) {
      var project =
        renderList[i];

      var card =
        document.createElement("article");

      card.className =
        "project-card";

      /*
       * Navigation data consumed by project-navigation.js.
       */
      var projectCode =
        clean(project.project_code);

      var projectId =
        clean(project.id);

      var projectSlug =
        clean(project.slug);

      if (projectCode) {
        card.dataset.projectCode =
          projectCode;
      }

      if (projectId) {
        card.dataset.projectId =
          projectId;
      }

      if (projectSlug) {
        card.dataset.projectSlug =
          projectSlug;
      }

      /*
       * Project name.
       */
      var name =
        clean(project.name) ||
        clean(project.title) ||
        "Project";

      /*
       * Project body.
       */
      var body =
        document.createElement("div");

      body.className =
        "project-body";

      /*
       * Logo.
       */
      var logo =
        createLogo(
          project,
          name
        );

      /*
       * Title.
       */
      var title =
        document.createElement("h3");

      title.textContent =
        name;

      /*
       * Metadata.
       */
      var meta =
        document.createElement("p");

      var projectType =
        clean(
          project.project_type
        ).toUpperCase();

      var slot =
        project.core_slot == null ||
        project.core_slot === ""
          ? "—"
          : String(
              project.core_slot
            );

      meta.textContent =
        (
          projectType ||
          "PROJECT"
        ) +
        " • Core Slot " +
        slot;

      /*
       * Status.
       */
      var status =
        document.createElement("span");

      status.className =
        "status";

      var registryStatus =
        clean(project.status)
          .toUpperCase();

      status.textContent =
        "TESTNET • " +
        (
          registryStatus ||
          "UNKNOWN"
        );

      /*
       * Assemble card.
       */
      body.appendChild(title);
      body.appendChild(meta);
      body.appendChild(status);

      card.appendChild(logo);
      card.appendChild(body);

      /*
       * Accessibility.
       *
       * The shared project-navigation.js handles actual navigation.
       * We only provide keyboard semantics here if navigation data
       * exists.
       */
      var navigationKey =
        projectCode ||
        projectSlug ||
        projectId;

      if (navigationKey) {
        card.setAttribute(
          "role",
          "link"
        );

        card.setAttribute(
          "tabindex",
          "0"
        );

        card.addEventListener(
          "keydown",
          function (event) {
            if (
              event.key !== "Enter" &&
              event.key !== " "
            ) {
              return;
            }

            event.preventDefault();

            var target =
              event.currentTarget;

            var targetKey =
              target.dataset.projectCode ||
              target.dataset.projectSlug ||
              target.dataset.projectId;

            var targetUrl =
              url(
                resolve(targetKey)
              );

            if (targetUrl) {
              window.location.assign(
                targetUrl
              );
            }
          }
        );
      }

      container.appendChild(
        card
      );
    }

    /*
     * Registry render completed.
     */
    try {
      container.dispatchEvent(
        new CustomEvent(
          "albukhr:testnet-registry-rendered",
          {
            detail: {
              count:
                renderList.length
            }
          }
        )
      );
    } catch (_) {}

    return renderList.length;
  }

  /*
   * ------------------------------------------------------------------
   * Registry accessors
   * ------------------------------------------------------------------
   */

  function getAll() {
    return projects.slice();
  }

  function getCount() {
    return projects.length;
  }

  function isLoaded() {
    return loaded;
  }

  /*
   * ------------------------------------------------------------------
   * Public API
   * ------------------------------------------------------------------
   */

  var api = {
    load: load,
    resolve: resolve,
    url: url,
    render: render,
    getAll: getAll,
    getCount: getCount,
    isLoaded: isLoaded,
    getLogoUrl: getLogoUrl
  };

  try {
    Object.freeze(api);
  } catch (_) {}

  window.AlbukhrTestnetRegistry =
    api;

})(window, document);
