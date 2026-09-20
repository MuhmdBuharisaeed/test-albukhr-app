/* ALBUKHR TESTNET PROJECT PAGE v6 */
(function (window, document) {
  "use strict";

  /*
   * ALBUKHR TESTNET PROJECT PAGE
   *
   * Responsibilities:
   * - Resolve the requested project identity from the URL.
   * - Read the project from the Testnet public registry.
   * - Render project identity, metadata and logo.
   * - Keep Testnet investment controls locked until enabled.
   * - Provide project information modal and registry refresh.
   *
   * This file does NOT:
   * - dynamically load Environment Core;
   * - dynamically load Supabase Core;
   * - access Mainnet;
   * - create a Supabase client;
   * - perform investments;
   * - perform staking;
   * - perform withdrawals;
   * - perform payments.
   */

  var initialized = false;
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

  function element(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    var node =
      element(id);

    if (node) {
      node.textContent =
        clean(value);
    }
  }

  function getErrorMessage(
    error,
    fallback
  ) {
    if (
      error &&
      typeof error.message === "string" &&
      error.message.trim()
    ) {
      return error.message.trim();
    }

    return (
      fallback ||
      "Unable to load Testnet project."
    );
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
      env.getNetwork() !== "testnet"
    ) {
      throw new Error(
        "Invalid ALBUKHR Testnet environment."
      );
    }

    return env;
  }

  /*
   * ------------------------------------------------------------------
   * Project identity
   * ------------------------------------------------------------------
   */

  function getIdentity() {
    var params;

    try {
      params =
        new URLSearchParams(
          window.location.search
        );
    } catch (_) {
      return "";
    }

    return clean(
      params.get("project") ||
      params.get("project_code") ||
      params.get("slug") ||
      params.get("project_id")
    );
  }

  /*
   * ------------------------------------------------------------------
   * Project not-found state
   * ------------------------------------------------------------------
   */

  function notFound() {
    setText(
      "projectTitle",
      "Project not found"
    );

    setText(
      "projectState",
      "TESTNET • NOT FOUND"
    );

    setText(
      "projectMeta",
      "This project is not available in the Testnet registry."
    );

    setText(
      "projectDescription",
      "The requested project could not be resolved against the approved Testnet project registry."
    );

    setText(
      "projectCode",
      "—"
    );

    setText(
      "projectType",
      "—"
    );

    setText(
      "projectSlot",
      "—"
    );

    setText(
      "projectNetwork",
      "TESTNET"
    );

    var image =
      element("projectLogo");

    var fallback =
      element("logoFallback");

    if (image) {
      image.hidden =
        true;

      image.removeAttribute(
        "src"
      );
    }

    if (fallback) {
      fallback.hidden =
        false;
    }

    document.title =
      "Project not found • ALBUKHR TESTNET";
  }

  /*
   * ------------------------------------------------------------------
   * Logo rendering
   * ------------------------------------------------------------------
   */

  function renderLogo(
    project,
    name
  ) {
    var image =
      element("projectLogo");

    var fallback =
      element("logoFallback");

    if (!image) {
      return;
    }

    var logo =
      clean(
        project &&
        project.logo_url
      );

    /*
     * Every ALBUKHR project should have a registry logo.
     *
     * We do not create an emoji or artificial project logo when
     * logo_url is missing.
     */
    if (!logo) {
      image.hidden =
        true;

      image.removeAttribute(
        "src"
      );

      if (fallback) {
        fallback.hidden =
          true;

        fallback.setAttribute(
          "aria-hidden",
          "true"
        );
      }

      return;
    }

    /*
     * Clear the previous image before assigning the new project logo.
     */
    image.hidden =
      true;

    image.alt =
      name + " logo";

    image.onload =
      function () {
        image.hidden =
          false;

        if (fallback) {
          fallback.hidden =
            true;
        }
      };

    image.onerror =
      function () {
        image.hidden =
          true;

        image.removeAttribute(
          "src"
        );

        if (fallback) {
          fallback.hidden =
            true;
        }
      };

    image.src =
      logo;
  }

  /*
   * ------------------------------------------------------------------
   * Project rendering
   * ------------------------------------------------------------------
   */

  function render(project) {
    if (!project) {
      notFound();
      return;
    }

    var name =
      clean(project.name) ||
      clean(project.title) ||
      "Project";

    var code =
      clean(project.project_code) ||
      "—";

    var type =
      clean(project.project_type)
        .toUpperCase() ||
      "—";

    var slot =
      project.core_slot == null ||
      project.core_slot === ""
        ? "—"
        : String(
            project.core_slot
          );

    var status =
      clean(project.status)
        .toUpperCase() ||
      "APPROVED";

    var network =
      clean(project.network)
        .toUpperCase() ||
      "TESTNET";

    /*
     * Defensive network validation.
     *
     * This page must never render a Mainnet registry row.
     */
    if (
      network.toLowerCase() !==
      "testnet"
    ) {
      throw new Error(
        "PROJECT_NETWORK_INVALID: requested project is not a Testnet project."
      );
    }

    setText(
      "projectTitle",
      name
    );

    setText(
      "projectState",
      "TESTNET • " +
        status
    );

    setText(
      "projectMeta",
      type +
        " • Core Slot " +
        slot
    );

    setText(
      "projectDescription",
      clean(project.description) ||
        "Registered ALBUKHR project available for controlled Testnet exploration."
    );

    setText(
      "projectCode",
      code
    );

    setText(
      "projectType",
      type
    );

    setText(
      "projectSlot",
      slot
    );

    setText(
      "projectNetwork",
      network
    );

    document.title =
      name +
      " • ALBUKHR TESTNET";

    renderLogo(
      project,
      name
    );

    /*
     * Testnet controls remain locked.
     *
     * These IDs are retained so a future transaction module can
     * activate them only after the Testnet transaction gateway
     * is explicitly enabled.
     */
    setText(
      "aStake",
      "LOCKED"
    );

    setText(
      "aReward",
      "LOCKED"
    );

    setText(
      "investmentState",
      "LOCKED"
    );
  }

  /*
   * ------------------------------------------------------------------
   * Load project
   * ------------------------------------------------------------------
   */

  async function load() {
    /*
     * Prevent duplicate simultaneous loads.
     */
    if (loadingPromise) {
      return loadingPromise;
    }

    loadingPromise =
      (async function () {
        var identity =
          getIdentity();

        try {
          validateEnvironment();

          /*
           * The HTML page already loads the shared Testnet Supabase
           * Core. This module must not create another client.
           */
          if (
            !window.ALBUKHR_SUPABASE
          ) {
            throw new Error(
              "SUPABASE_CORE_MISSING: Testnet Supabase Core is unavailable."
            );
          }

          if (
            window.ALBUKHR_SUPABASE.network !==
            "testnet"
          ) {
            throw new Error(
              "SUPABASE_NETWORK_INVALID: Supabase Core is not configured for Testnet."
            );
          }

          /*
           * Registry module must already be loaded by project.html.
           */
          if (
            !window.AlbukhrTestnetRegistry ||
            typeof
              window.AlbukhrTestnetRegistry
                .load !== "function" ||
            typeof
              window.AlbukhrTestnetRegistry
                .resolve !== "function"
          ) {
            throw new Error(
              "PROJECT_REGISTRY_MODULE_MISSING: Testnet Project Registry module is unavailable."
            );
          }

          /*
           * A project identity is mandatory.
           */
          if (!identity) {
            notFound();

            return null;
          }

          setText(
            "projectState",
            "TESTNET • LOADING"
          );

          setText(
            "projectMeta",
            "Loading registered project…"
          );

          /*
           * Refresh the registry so the detail page can resolve the
           * current approved/active Testnet project identity.
           */
          var projects =
            await window
              .AlbukhrTestnetRegistry
              .load(true);

          if (
            !Array.isArray(projects)
          ) {
            throw new Error(
              "PROJECT_REGISTRY_INVALID: registry returned an invalid response."
            );
          }

          /*
           * Resolve only against the registry that was loaded from
           * the Testnet RPC.
           */
          var project =
            window
              .AlbukhrTestnetRegistry
              .resolve(identity);

          if (!project) {
            notFound();

            return null;
          }

          /*
           * Final defensive network check.
           */
          if (
            clean(project.network)
              .toLowerCase() !==
            "testnet"
          ) {
            throw new Error(
              "PROJECT_NETWORK_INVALID: resolved project is not a Testnet project."
            );
          }

          render(
            project
          );

          try {
            window.dispatchEvent(
              new CustomEvent(
                "albukhr:testnet-project-loaded",
                {
                  detail: {
                    project:
                      project,
                    identity:
                      identity
                  }
                }
              )
            );
          } catch (_) {}

          return project;

        } catch (error) {
          console.error(
            "[ALBUKHR TESTNET PROJECT]",
            error
          );

          setText(
            "projectState",
            "TESTNET • UNAVAILABLE"
          );

          setText(
            "projectMeta",
            "Unable to load the Testnet project registry."
          );

          setText(
            "projectDescription",
            getErrorMessage(
              error,
              "The Testnet project data could not be loaded."
            )
          );

          /*
           * Keep the project identity visible when possible.
           */
          if (identity) {
            setText(
              "projectCode",
              identity
            );
          }

          setText(
            "projectType",
            "—"
          );

          setText(
            "projectSlot",
            "—"
          );

          setText(
            "projectNetwork",
            "TESTNET"
          );

          document.title =
            "Project unavailable • ALBUKHR TESTNET";

          try {
            window.dispatchEvent(
              new CustomEvent(
                "albukhr:testnet-project-error",
                {
                  detail: {
                    error:
                      error,
                    identity:
                      identity
                  }
                }
              )
            );
          } catch (_) {}

          return null;

        } finally {
          loadingPromise =
            null;
        }
      })();

    return loadingPromise;
  }

  /*
   * ------------------------------------------------------------------
   * Information modal
   * ------------------------------------------------------------------
   */

  function initInfoModal() {
    var modal =
      element("infoModal");

    var infoButton =
      element("infoButton");

    var closeButton =
      element("closeInfo");

    var okButton =
      element("infoOk");

    function open() {
      if (!modal) {
        return;
      }

      modal.hidden =
        false;

      if (infoButton) {
        infoButton.setAttribute(
          "aria-expanded",
          "true"
        );
      }

      /*
       * Move focus to the close control when available.
       */
      if (closeButton) {
        try {
          closeButton.focus();
        } catch (_) {}
      }
    }

    function close() {
      if (!modal) {
        return;
      }

      modal.hidden =
        true;

      if (infoButton) {
        infoButton.setAttribute(
          "aria-expanded",
          "false"
        );

        try {
          infoButton.focus();
        } catch (_) {}
      }
    }

    if (infoButton) {
      infoButton.addEventListener(
        "click",
        open
      );
    }

    if (closeButton) {
      closeButton.addEventListener(
        "click",
        close
      );
    }

    if (okButton) {
      okButton.addEventListener(
        "click",
        close
      );
    }

    if (modal) {
      modal.addEventListener(
        "click",
        function (event) {
          if (
            event.target ===
            modal
          ) {
            close();
          }
        }
      );
    }

    document.addEventListener(
      "keydown",
      function (event) {
        if (
          event.key === "Escape" &&
          modal &&
          !modal.hidden
        ) {
          close();
        }
      }
    );

    return {
      open: open,
      close: close
    };
  }

  /*
   * ------------------------------------------------------------------
   * Refresh
   * ------------------------------------------------------------------
   */

  function initRefresh() {
    var refresh =
      element("refreshBtn");

    if (!refresh) {
      return;
    }

    refresh.addEventListener(
      "click",
      async function () {
        if (
          refresh.disabled
        ) {
          return;
        }

        refresh.disabled =
          true;

        refresh.setAttribute(
          "aria-busy",
          "true"
        );

        refresh.textContent =
          "↻ Loading…";

        try {
          await load();
        } finally {
          refresh.disabled =
            false;

          refresh.removeAttribute(
            "aria-busy"
          );

          refresh.textContent =
            "↻ Refresh";
        }
      }
    );
  }

  /*
   * ------------------------------------------------------------------
   * Initialization
   * ------------------------------------------------------------------
   */

  function init() {
    if (initialized) {
      return;
    }

    initialized =
      true;

    initInfoModal();

    initRefresh();

    /*
     * Load the project after the page DOM is ready.
     */
    load();
  }

  /*
   * ------------------------------------------------------------------
   * Public API
   * ------------------------------------------------------------------
   */

  var api = {
    load: load
  };

  try {
    Object.freeze(api);
  } catch (_) {}

  window.AlbukhrTestnetProject =
    api;

  /*
   * ------------------------------------------------------------------
   * DOM initialization
   * ------------------------------------------------------------------
   */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true
      }
    );
  } else {
    init();
  }

})(window, document);
