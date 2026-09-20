/* ALBUKHR TESTNET APP — BOOT + REGISTRY v6 */
(function (window, document) {
  "use strict";

  /*
   * ALBUKHR TESTNET APPLICATION BOOT
   *
   * Responsibilities:
   * - Verify the current Testnet session.
   * - Start the Testnet application only after authentication.
   * - Load the Testnet public project registry.
   * - Update registry status/count UI.
   * - Keep authentication failures separate from registry failures.
   *
   * This file does NOT:
   * - create a Supabase client;
   * - authenticate Pi directly;
   * - access Mainnet data;
   * - perform investments;
   * - perform staking;
   * - perform withdrawals;
   * - perform payments.
   */

  var booted = false;
  var bootPromise = null;

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

  function getErrorMessage(error, fallback) {
    if (
      error &&
      typeof error.message === "string" &&
      error.message.trim()
    ) {
      return error.message.trim();
    }

    return fallback || "Unknown Testnet error.";
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
   * Registry UI helpers
   * ------------------------------------------------------------------
   */

  function setRegistryStatus(
    message,
    type
  ) {
    var node =
      document.getElementById(
        "registryStatus"
      );

    if (node) {
      node.textContent =
        clean(message);

      /*
       * Useful for CSS/state handling without changing the
       * existing visual structure.
       */
      if (type) {
        node.dataset.status =
          String(type).toLowerCase();
      }
    }

    try {
      window.dispatchEvent(
        new CustomEvent(
          "albukhr:testnet-registry-status",
          {
            detail: {
              message:
                clean(message),
              type:
                type || "INFO"
            }
          }
        )
      );
    } catch (_) {}
  }

  function setProjectCount(count) {
    var node =
      document.getElementById(
        "approvedProjectCount"
      );

    if (node) {
      node.textContent =
        String(
          Number.isFinite(count)
            ? count
            : 0
        );
    }
  }

  function setRegistryBusy(
    busy
  ) {
    var container =
      document.getElementById(
        "projectList"
      );

    if (!container) {
      return;
    }

    if (busy) {
      container.setAttribute(
        "aria-busy",
        "true"
      );
    } else {
      container.setAttribute(
        "aria-busy",
        "false"
      );
    }
  }

  /*
   * ------------------------------------------------------------------
   * Registry empty/error rendering
   * ------------------------------------------------------------------
   */

  function renderRegistryMessage(
    container,
    title,
    message
  ) {
    if (!container) {
      return;
    }

    /*
     * Do not inject registry/error text through innerHTML.
     */
    container.replaceChildren();

    var box =
      document.createElement("div");

    box.className =
      "registry-empty";

    var heading =
      document.createElement("strong");

    heading.textContent =
      clean(title);

    var paragraph =
      document.createElement("p");

    paragraph.textContent =
      clean(message);

    box.appendChild(
      heading
    );

    box.appendChild(
      paragraph
    );

    container.appendChild(
      box
    );
  }

  /*
   * ------------------------------------------------------------------
   * Registry loading
   * ------------------------------------------------------------------
   */

  async function loadRegistry() {
    validateEnvironment();

    var registry =
      window.AlbukhrTestnetRegistry;

    if (
      !registry ||
      typeof registry.load !== "function" ||
      typeof registry.render !== "function"
    ) {
      throw new Error(
        "Testnet project registry module is unavailable."
      );
    }

    var container =
      document.getElementById(
        "projectList"
      );

    if (!container) {
      throw new Error(
        "Testnet project registry container is unavailable."
      );
    }

    setRegistryBusy(
      true
    );

    setRegistryStatus(
      "Loading approved Testnet projects…",
      "LOADING"
    );

    try {
      var projects =
        await registry.load();

      if (
        !Array.isArray(projects)
      ) {
        throw new Error(
          "Testnet project registry returned an invalid response."
        );
      }

      /*
       * Registry module already performs the strict Testnet filter.
       *
       * We keep this additional guard here because this module is
       * the application boot boundary.
       */
      var testnetProjects =
        projects.filter(
          function (project) {
            return (
              project &&
              clean(
                project.network
              ).toLowerCase() ===
                "testnet"
            );
          }
        );

      setProjectCount(
        testnetProjects.length
      );

      registry.render(
        container,
        testnetProjects
      );

      if (
        testnetProjects.length > 0
      ) {
        setRegistryStatus(
          "OK • " +
            testnetProjects.length +
            " project" +
            (
              testnetProjects.length === 1
                ? ""
                : "s"
            ),
          "OK"
        );
      } else {
        setRegistryStatus(
          "No approved Testnet projects found.",
          "EMPTY"
        );

        renderRegistryMessage(
          container,
          "No approved projects",
          "The Testnet registry returned no approved or active projects."
        );
      }

      try {
        window.dispatchEvent(
          new CustomEvent(
            "albukhr:testnet-registry-loaded",
            {
              detail: {
                projects:
                  testnetProjects.slice(),
                count:
                  testnetProjects.length,
                network:
                  "testnet"
              }
            }
          )
        );
      } catch (_) {}

      return testnetProjects;

    } catch (error) {
      console.error(
        "[ALBUKHR TESTNET REGISTRY]",
        error
      );

      setProjectCount(
        0
      );

      setRegistryStatus(
        "Registry error • " +
          getErrorMessage(
            error,
            "Unable to load projects."
          ),
        "ERROR"
      );

      renderRegistryMessage(
        container,
        "Unable to load approved projects",
        "Authentication succeeded, but the Testnet project registry could not be loaded."
      );

      try {
        window.dispatchEvent(
          new CustomEvent(
            "albukhr:testnet-registry-error",
            {
              detail: {
                error:
                  error,
                network:
                  "testnet"
              }
            }
          )
        );
      } catch (_) {}

      throw error;

    } finally {
      setRegistryBusy(
        false
      );
    }
  }

  /*
   * ------------------------------------------------------------------
   * Application boot
   * ------------------------------------------------------------------
   */

  async function boot() {
    /*
     * Prevent duplicate boot calls.
     */
    if (booted) {
      return bootPromise;
    }

    if (bootPromise) {
      return bootPromise;
    }

    bootPromise =
      (async function () {
        try {
          /*
           * Environment must be valid before any application
           * authentication or registry operation begins.
           */
          validateEnvironment();

          /*
           * Testnet authentication module must already be loaded.
           */
          if (
            !window.AlbukhrTestnetAuth ||
            typeof
              window.AlbukhrTestnetAuth
                .requireTestnetAuth !==
              "function"
          ) {
            throw new Error(
              "Testnet authentication module is unavailable."
            );
          }

          /*
           * Do not automatically redirect here.
           *
           * login.html is responsible for sending the user to
           * Mainnet authentication when needed.
           */
          var session =
            await window.AlbukhrTestnetAuth
              .requireTestnetAuth({
                redirectOnFailure:
                  false
              });

          if (!session) {
            /*
             * No authenticated Testnet session.
             *
             * This is not a registry error and must not be presented
             * as one.
             */
            console.warn(
              "[ALBUKHR TESTNET] Authentication is not ready."
            );

            try {
              window.dispatchEvent(
                new CustomEvent(
                  "albukhr:testnet-auth-required",
                  {
                    detail: {
                      network:
                        "testnet"
                    }
                  }
                )
              );
            } catch (_) {}

            return null;
          }

          /*
           * Authentication succeeded.
           */
          try {
            window.dispatchEvent(
              new CustomEvent(
                "albukhr:testnet-authenticated",
                {
                  detail: {
                    session:
                      session
                  }
                }
              )
            );
          } catch (_) {}

          /*
           * Registry loading happens only after Testnet authentication.
           */
          try {
            await loadRegistry();
          } catch (error) {
            /*
             * Keep the authenticated application state alive.
             *
             * A registry failure is a registry failure, not an
             * authentication failure.
             */
            console.error(
              "[ALBUKHR TESTNET REGISTRY BOOT]",
              error
            );
          }

          booted =
            true;

          return session;

        } catch (error) {
          console.error(
            "[ALBUKHR TESTNET BOOT]",
            error
          );

          try {
            window.dispatchEvent(
              new CustomEvent(
                "albukhr:testnet-boot-error",
                {
                  detail: {
                    error:
                      error,
                    message:
                      getErrorMessage(
                        error,
                        "Unexpected Testnet boot error."
                      )
                  }
                }
              )
            );
          } catch (_) {}

          /*
           * Do not create a diagnostic overlay.
           * The page's existing UI remains responsible for presenting
           * its own state.
           */
          return null;

        } finally {
          bootPromise =
            null;
        }
      })();

    return bootPromise;
  }

  /*
   * ------------------------------------------------------------------
   * Public API
   * ------------------------------------------------------------------
   */

  var api = {
    boot:
      boot,

    loadRegistry:
      loadRegistry
  };

  try {
    Object.freeze(api);
  } catch (_) {}

  window.AlbukhrTestnetApp =
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
      boot,
      {
        once: true
      }
    );
  } else {
    boot();
  }

})(window, document);
