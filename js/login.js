/* ALBUKHR TESTNET LOGIN v5 */
(function (window, document) {
  "use strict";

  /*
   * ALBUKHR TESTNET LOGIN
   *
   * Testnet does not authenticate Pi directly.
   *
   * Flow:
   *
   * Testnet Login
   *      ↓
   * Mainnet Login
   *      ↓
   * Pi identity verification
   *      ↓
   * Mainnet → Testnet secure handoff
   *      ↓
   * Testnet access
   *
   * IMPORTANT:
   * - No Pi access token is stored here.
   * - No Pi access token is placed in the Testnet URL.
   * - No LocalStorage is used.
   */

  var MAINNET_LOGIN =
    "https://app.albukhr.com/login.html?returnTo=testnet";

  var REDIRECT_DELAY = 250;

  var initialized = false;
  var redirecting = false;

  function el(id) {
    return document.getElementById(id);
  }

  function setStatus(message) {
    var node = el("status");

    if (!node) {
      return;
    }

    node.textContent = String(message || "");
  }

  function setLoading(loading, label) {
    var button = el("testnetLoginButton");

    if (!button) {
      return;
    }

    button.disabled = !!loading;

    var text = button.querySelector(".login-text");

    if (text) {
      text.textContent = String(
        label || (loading ? "Opening Mainnet..." : "Continue with Pi")
      );
    }

    if (loading) {
      button.setAttribute("aria-busy", "true");
    } else {
      button.removeAttribute("aria-busy");
    }
  }

  function goMainnet() {
    if (redirecting) {
      return;
    }

    redirecting = true;

    setLoading(true, "Opening Mainnet...");

    setStatus(
      "Testnet uses secure Mainnet identity verification. " +
      "No Pi access token is sent to Testnet."
    );

    window.setTimeout(function () {
      window.location.replace(MAINNET_LOGIN);
    }, REDIRECT_DELAY);
  }

  function start() {
    goMainnet();
  }

  function init() {
    if (initialized) {
      return;
    }

    initialized = true;

    redirecting = false;

    setLoading(false, "Continue with Pi");

    setStatus(
      "Continue to Mainnet to verify your Pi identity."
    );
  }

  /*
   * Public compatibility API.
   *
   * Existing login.html uses window.login().
   */
  window.login = start;

  /*
   * Expose the Testnet Login API.
   */
  try {
    window.AlbukhrTestnetLogin = Object.freeze({
      start: start,
      goMainnet: goMainnet
    });
  } catch (_) {
    window.AlbukhrTestnetLogin = {
      start: start,
      goMainnet: goMainnet
    };
  }

  /*
   * Initialize exactly once after the DOM is available.
   */
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }

})(window, document);
