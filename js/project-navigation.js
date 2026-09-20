/* ALBUKHR TESTNET PROJECT NAVIGATION v6 */
(function (window, document) {
  "use strict";

  /*
   * ALBUKHR PROJECT NAVIGATION
   *
   * Responsibilities:
   * - Resolve project identity from project cards.
   * - Navigate to the canonical Testnet project detail page.
   * - Support project-code, slug, id and project-key identities.
   * - Support existing ALBUKHR card classes.
   *
   * Supported cards:
   *   .project-card
   *   .popular-card
   *   .asset-item
   *
   * Navigation:
   *   project.html?project=<encoded-project-key>
   *
   * This module does NOT:
   * - query Supabase;
   * - create a Supabase client;
   * - authenticate users;
   * - modify project data;
   * - perform investment transactions.
   */

  var CARD_SELECTOR =
    ".project-card, .popular-card, .asset-item";

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

  /*
   * ------------------------------------------------------------------
   * Project identity extraction
   * ------------------------------------------------------------------
   */

  function getCardIdentity(card) {
    if (!card) {
      return "";
    }

    /*
     * Preferred explicit project identity attributes.
     */
    var key =
      clean(card.dataset.projectCode) ||
      clean(card.dataset.projectSlug) ||
      clean(card.dataset.projectId) ||
      clean(card.dataset.projectKey);

    if (key) {
      return key;
    }

    /*
     * Compatibility with markup that uses explicit attributes
     * instead of dataset access.
     */
    key =
      clean(
        card.getAttribute(
          "data-project-code"
        )
      ) ||
      clean(
        card.getAttribute(
          "data-project-slug"
        )
      ) ||
      clean(
        card.getAttribute(
          "data-project-id"
        )
      ) ||
      clean(
        card.getAttribute(
          "data-project-key"
        )
      );

    if (key) {
      return key;
    }

    /*
     * Legacy/card-title fallback.
     *
     * This is intentionally last because title text is less reliable
     * than an explicit project identity.
     */
    var titleNode =
      card.querySelector(
        "h3, .popular-name, .asset-name, " +
        ".project-title, .project-name"
      );

    return titleNode
      ? clean(titleNode.textContent)
      : "";
  }

  /*
   * ------------------------------------------------------------------
   * PROJECT_CONFIG resolution
   * ------------------------------------------------------------------
   *
   * Some ALBUKHR pages may already have a project catalog available.
   * When present, use it to convert a title/slug/code into the
   * canonical project key.
   *
   * We do not require PROJECT_CONFIG to exist because Testnet
   * registry-driven pages can navigate without it.
   */

  function resolveFromConfig(identity) {
    var catalog =
      window.PROJECT_CONFIG;

    if (
      !catalog ||
      typeof catalog !== "object"
    ) {
      return null;
    }

    var wanted =
      lower(identity);

    if (!wanted) {
      return null;
    }

    var entries =
      Object.entries(catalog);

    for (
      var i = 0;
      i < entries.length;
      i += 1
    ) {
      var catalogKey =
        entries[i][0];

      var config =
        entries[i][1];

      if (!config) {
        continue;
      }

      var candidates = [
        catalogKey,
        config.slug,
        config.project_code,
        config.project_id,
        config.id,
        config.title,
        config.name
      ];

      for (
        var j = 0;
        j < candidates.length;
        j += 1
      ) {
        if (
          lower(candidates[j]) ===
          wanted
        ) {
          return {
            key: catalogKey,
            config: config
          };
        }
      }
    }

    return null;
  }

  /*
   * ------------------------------------------------------------------
   * Canonical project key
   * ------------------------------------------------------------------
   */

  function resolveKey(identity) {
    var value =
      clean(identity);

    if (!value) {
      return "";
    }

    /*
     * Prefer the authoritative project registry if it is already
     * loaded and exposes a resolver.
     */
    var registry =
      window.AlbukhrTestnetRegistry;

    if (
      registry &&
      typeof registry.resolve === "function"
    ) {
      try {
        var project =
          registry.resolve(value);

        if (project) {
          return (
            clean(project.project_code) ||
            clean(project.slug) ||
            clean(project.id) ||
            value
          );
        }
      } catch (_) {}
    }

    /*
     * Then use PROJECT_CONFIG when available.
     */
    var resolved =
      resolveFromConfig(value);

    if (resolved) {
      var config =
        resolved.config;

      return (
        clean(config.project_code) ||
        clean(config.slug) ||
        clean(config.project_id) ||
        clean(config.id) ||
        clean(resolved.key)
      );
    }

    /*
     * Finally preserve the supplied identity.
     */
    return value;
  }

  /*
   * ------------------------------------------------------------------
   * URL builder
   * ------------------------------------------------------------------
   */

  function buildProjectUrl(identity) {
    var key =
      resolveKey(identity);

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
   * Navigation
   * ------------------------------------------------------------------
   */

  function navigate(cardOrIdentity) {
    var identity = "";

    if (
      cardOrIdentity &&
      typeof cardOrIdentity === "object" &&
      cardOrIdentity.nodeType === 1
    ) {
      identity =
        getCardIdentity(
          cardOrIdentity
        );
    } else {
      identity =
        clean(cardOrIdentity);
    }

    if (!identity) {
      return false;
    }

    var url =
      buildProjectUrl(identity);

    if (!url) {
      return false;
    }

    window.location.assign(
      url
    );

    return true;
  }

  /*
   * ------------------------------------------------------------------
   * Interactive-element guard
   * ------------------------------------------------------------------
   */

  function isInteractiveTarget(target) {
    if (!target) {
      return false;
    }

    return !!target.closest(
      "a, button, input, textarea, select, " +
      "option, summary, [role='button'], " +
      "[contenteditable='true']"
    );
  }

  /*
   * ------------------------------------------------------------------
   * Click handling
   * ------------------------------------------------------------------
   */

  function handleClick(event) {
    var target =
      event.target;

    if (!target || !target.closest) {
      return;
    }

    /*
     * Do not override buttons, links, form controls, etc.
     */
    if (
      isInteractiveTarget(target)
    ) {
      return;
    }

    var card =
      target.closest(
        CARD_SELECTOR
      );

    if (!card) {
      return;
    }

    var identity =
      getCardIdentity(card);

    if (!identity) {
      return;
    }

    var url =
      buildProjectUrl(identity);

    if (!url) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    window.location.assign(
      url
    );
  }

  /*
   * ------------------------------------------------------------------
   * Keyboard handling
   * ------------------------------------------------------------------
   */

  function handleKeydown(event) {
    if (
      event.key !== "Enter" &&
      event.key !== " "
    ) {
      return;
    }

    var target =
      event.target;

    if (!target || !target.closest) {
      return;
    }

    /*
     * Do not hijack keyboard interaction inside controls.
     */
    if (
      isInteractiveTarget(target)
    ) {
      return;
    }

    var card =
      target.closest(
        CARD_SELECTOR
      );

    if (!card) {
      return;
    }

    var identity =
      getCardIdentity(card);

    if (!identity) {
      return;
    }

    var url =
      buildProjectUrl(identity);

    if (!url) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    window.location.assign(
      url
    );
  }

  /*
   * ------------------------------------------------------------------
   * Event listeners
   * ------------------------------------------------------------------
   *
   * Capture phase is retained because some dynamically generated
   * project cards may have their own click handlers.
   */
  document.addEventListener(
    "click",
    handleClick,
    true
  );

  document.addEventListener(
    "keydown",
    handleKeydown,
    true
  );

  /*
   * ------------------------------------------------------------------
   * Public API
   * ------------------------------------------------------------------
   */

  var api = {
    navigate: navigate,
    getCardIdentity: getCardIdentity,
    resolveKey: resolveKey,
    buildProjectUrl: buildProjectUrl
  };

  try {
    Object.freeze(api);
  } catch (_) {}

  window.AlbukhrProjectNavigation =
    api;

})(window, document);
