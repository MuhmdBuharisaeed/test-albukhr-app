/* =========================================
   ALBUKHR ENVIRONMENT SWITCHER v2
   NETWORK IDENTITY PROVIDER
   MAINNET / TESTNET
   SIDE DRAWER HEADER
========================================= */

(() => {
  "use strict";

  const ENVIRONMENTS = Object.freeze({
    mainnet: Object.freeze({
      name: "MAINNET",
      network: "mainnet",
      url: "https://app.albukhr.com"
    }),
    testnet: Object.freeze({
      name: "TESTNET",
      network: "testnet",
      url: "https://test.albukhr.com"
    })
  });

  let __albukhrEnvironment = null;

  function detectEnvironment() {
    const hostname =
      String(window.location.hostname || "").trim().toLowerCase();

    if (
      hostname === "app.albukhr.com" ||
      hostname.startsWith("app.")
    ) {
      return "mainnet";
    }

    if (
      hostname === "test.albukhr.com" ||
      hostname.startsWith("test.")
    ) {
      return "testnet";
    }

    /*
      SECURITY:
      Unknown/local/development hosts MUST NOT
      silently become MAINNET.
    */
    return null;
  }

  function getCurrentEnvironment() {
    if (__albukhrEnvironment) {
      return __albukhrEnvironment;
    }

    __albukhrEnvironment = detectEnvironment();
    return __albukhrEnvironment;
  }

  function getAlbukhrNetwork() {
    const environment = getCurrentEnvironment();

    if (!environment) {
      return null;
    }

    return ENVIRONMENTS[environment].network;
  }

  function getAlbukhrEnvironment() {
    const environment = getCurrentEnvironment();

    if (!environment) {
      return {
        environment: null,
        network: null,
        name: "UNKNOWN",
        url: null,
        hostname: window.location.hostname || ""
      };
    }

    return {
      environment,
      network: ENVIRONMENTS[environment].network,
      name: ENVIRONMENTS[environment].name,
      url: ENVIRONMENTS[environment].url,
      hostname: window.location.hostname || ""
    };
  }

  function isAlbukhrMainnet() {
    return getAlbukhrNetwork() === "mainnet";
  }

  function isAlbukhrTestnet() {
    return getAlbukhrNetwork() === "testnet";
  }

  function requireAlbukhrNetwork() {
    const network = getAlbukhrNetwork();

    if (
      network !== "mainnet" &&
      network !== "testnet"
    ) {
      throw new Error(
        "ALBUKHR network could not be determined safely. " +
        "Refusing network-sensitive operation on unknown host."
      );
    }

    return network;
  }

  function updateEnvironmentSwitcher() {
    const switcher =
      document.getElementById("environmentSwitcher");

    const dot =
      document.getElementById("environmentDot");

    const label =
      document.getElementById("environmentLabel");

    /*
      Some pages may not contain the drawer.
      Network API must still remain available.
    */
    if (!switcher || !dot || !label) {
      return;
    }

    const current = getCurrentEnvironment();

    if (!current) {
      label.textContent = "UNKNOWN";

      switcher.classList.remove(
        "mainnet",
        "testnet"
      );

      switcher.classList.add("unknown");

      dot.classList.remove(
        "mainnet",
        "testnet"
      );

      dot.classList.add("unknown");

      switcher.setAttribute(
        "aria-label",
        "Network could not be determined"
      );

      switcher.title =
        "Network could not be determined";

      switcher.onclick = null;
      switcher.disabled = true;

      console.warn(
        "ALBUKHR Environment Switcher: " +
        "unknown host. Network switching disabled."
      );

      return;
    }

    const target =
      current === "mainnet"
        ? "testnet"
        : "mainnet";

    label.textContent =
      ENVIRONMENTS[current].name;

    switcher.classList.remove(
      "mainnet",
      "testnet",
      "unknown"
    );

    switcher.classList.add(current);

    dot.classList.remove(
      "mainnet",
      "testnet",
      "unknown"
    );

    dot.classList.add(current);

    switcher.setAttribute(
      "aria-label",
      `Switch to ${ENVIRONMENTS[target].name}`
    );

    switcher.title =
      `Switch to ${ENVIRONMENTS[target].name}`;

    switcher.disabled = false;

    switcher.onclick = function () {
      switcher.disabled = true;

      window.location.href =
        ENVIRONMENTS[target].url;
    };
  }

  function initEnvironmentSwitcher() {
    const environment =
      getCurrentEnvironment();

    if (environment) {
      console.log(
        `ALBUKHR Network: ${environment.toUpperCase()}`
      );
    } else {
      console.warn(
        "ALBUKHR Network: UNKNOWN HOST"
      );
    }

    updateEnvironmentSwitcher();
  }

  /*
    GLOBAL NETWORK API
  */
  window.ALBUKHR_ENVIRONMENTS =
    ENVIRONMENTS;

  window.ALBUKHR_ENVIRONMENT =
    getCurrentEnvironment();

  window.ALBUKHR_NETWORK =
    getAlbukhrNetwork();

  window.getAlbukhrNetwork =
    getAlbukhrNetwork;

  window.getAlbukhrEnvironment =
    getAlbukhrEnvironment;

  window.isAlbukhrMainnet =
    isAlbukhrMainnet;

  window.isAlbukhrTestnet =
    isAlbukhrTestnet;

  window.requireAlbukhrNetwork =
    requireAlbukhrNetwork;

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initEnvironmentSwitcher
    );
  } else {
    initEnvironmentSwitcher();
  }

})();
