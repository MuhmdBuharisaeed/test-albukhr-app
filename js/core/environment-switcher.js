/* =========================================
   ALBUKHR ENVIRONMENT SWITCHER v3
   MAINNET / TESTNET
   SIDE DRAWER HEADER

   ARCHITECTURE:
   - Shared environment resolver
   - Hostname is the network source of truth
   - No LocalStorage persistence
   - No independent Supabase client
   - No changes to Dock Navigation
   - Switcher belongs only in the Side Drawer header

   NETWORKS:
   MAINNET -> https://app.albukhr.com
   TESTNET -> https://test.albukhr.com

   DOM CONTRACT:
   - #environmentSwitcher
   - #environmentDot
   - #environmentLabel

   GLOBAL API:
   - getCurrentEnvironment()
   - getAlbukhrNetwork()
   - requireAlbukhrNetwork()
   - isAlbukhrMainnet()
   - isAlbukhrTestnet()
   - getAlbukhrEnvironmentConfig()
   - getAlbukhrNetworkUrl()
   - getAlbukhrNetworkName()
   - ALBUKHR_ENVIRONMENTS
========================================= */

(() => {

  "use strict";

  /* =========================================
     ENVIRONMENT CONFIG
  ========================================== */

  const ENVIRONMENTS = Object.freeze({

    mainnet: Object.freeze({
      key: "mainnet",
      name: "MAINNET",
      url: "https://app.albukhr.com"
    }),

    testnet: Object.freeze({
      key: "testnet",
      name: "TESTNET",
      url: "https://test.albukhr.com"
    })

  });


  /* =========================================
     NORMALIZE HOSTNAME
  ========================================== */

  function getHostname() {

    try {

      return String(
        window.location.hostname || ""
      )
        .trim()
        .toLowerCase();

    } catch (error) {

      return "";

    }

  }


  /* =========================================
     DETECT CURRENT ENVIRONMENT
     HOSTNAME IS THE SOURCE OF TRUTH

     IMPORTANT:
     Unknown/local hosts remain MAINNET-compatible
     for backward compatibility with existing ALBUKHR
     development behaviour.

     Production isolation is enforced by recognized
     production hostnames and by requireAlbukhrNetwork()
     in data engines.
  ========================================== */

  function getCurrentEnvironment() {

    const hostname = getHostname();

    if (
      hostname === "test.albukhr.com" ||
      hostname.startsWith("test.")
    ) {

      return "testnet";

    }

    if (
      hostname === "app.albukhr.com" ||
      hostname.startsWith("app.")
    ) {

      return "mainnet";

    }

    return "mainnet";

  }


  /* =========================================
     AUTHORITATIVE NETWORK API
  ========================================== */

  function getAlbukhrNetwork() {

    const network =
      getCurrentEnvironment();

    if (
      network !== "mainnet" &&
      network !== "testnet"
    ) {

      throw new Error(
        "ALBUKHR: invalid network detected."
      );

    }

    return network;

  }


  function requireAlbukhrNetwork() {

    const network =
      getAlbukhrNetwork();

    if (
      network !== "mainnet" &&
      network !== "testnet"
    ) {

      throw new Error(
        "ALBUKHR: MAINNET/TESTNET network is required."
      );

    }

    return network;

  }


  function isAlbukhrMainnet() {

    return getAlbukhrNetwork() === "mainnet";

  }


  function isAlbukhrTestnet() {

    return getAlbukhrNetwork() === "testnet";

  }


  function getAlbukhrEnvironmentConfig() {

    const network =
      getAlbukhrNetwork();

    const environment =
      ENVIRONMENTS[network];

    return {

      network: environment.key,
      name: environment.name,
      url: environment.url

    };

  }


  function getAlbukhrNetworkUrl(network) {

    const key =
      network === undefined
        ? getAlbukhrNetwork()
        : String(network)
            .trim()
            .toLowerCase();

    if (!ENVIRONMENTS[key]) {

      throw new Error(
        `ALBUKHR: unsupported network "${key}".`
      );

    }

    return ENVIRONMENTS[key].url;

  }


  function getAlbukhrNetworkName(network) {

    const key =
      network === undefined
        ? getAlbukhrNetwork()
        : String(network)
            .trim()
            .toLowerCase();

    if (!ENVIRONMENTS[key]) {

      throw new Error(
        `ALBUKHR: unsupported network "${key}".`
      );

    }

    return ENVIRONMENTS[key].name;

  }


  /* =========================================
     UPDATE EXISTING SIDE-DRAWER SWITCHER

     This function does not create or move UI.
     It only binds the existing drawer element.
  ========================================== */

  function updateEnvironmentSwitcher() {

    const switcher =
      document.getElementById(
        "environmentSwitcher"
      );

    const dot =
      document.getElementById(
        "environmentDot"
      );

    const label =
      document.getElementById(
        "environmentLabel"
      );

    if (
      !switcher ||
      !dot ||
      !label
    ) {

      console.warn(
        "ALBUKHR Environment Switcher: drawer elements not found."
      );

      return false;

    }

    const current =
      getAlbukhrNetwork();

    const target =
      current === "mainnet"
        ? "testnet"
        : "mainnet";


    /* =====================================
       LABEL
    ===================================== */

    label.textContent =
      ENVIRONMENTS[current].name;


    /* =====================================
       ENVIRONMENT CLASSES
    ===================================== */

    switcher.classList.remove(
      "mainnet",
      "testnet"
    );

    switcher.classList.add(
      current
    );

    dot.classList.remove(
      "mainnet",
      "testnet"
    );

    dot.classList.add(
      current
    );


    /* =====================================
       DATA ATTRIBUTES
    ===================================== */

    switcher.dataset.network =
      current;

    switcher.dataset.targetNetwork =
      target;


    /* =====================================
       ACCESSIBILITY
    ===================================== */

    switcher.setAttribute(
      "role",
      "button"
    );

    switcher.setAttribute(
      "aria-label",
      `Switch to ${ENVIRONMENTS[target].name}`
    );

    switcher.setAttribute(
      "aria-current",
      current
    );

    switcher.title =
      `Switch to ${ENVIRONMENTS[target].name}`;


    /* =====================================
       CLICK HANDLER

       Destination is always derived from
       the authoritative current hostname.
    ===================================== */

    switcher.onclick =
      function(event) {

        if (event) {

          event.preventDefault();

        }

        const targetNetwork =
          switcher.dataset.targetNetwork;

        const targetUrl =
          getAlbukhrNetworkUrl(
            targetNetwork
          );

        switcher.disabled = true;

        window.location.assign(
          targetUrl
        );

      };


    return true;

  }


  /* =========================================
     PUBLIC UI REFRESH
  ========================================== */

  function refreshEnvironmentSwitcher() {

    return updateEnvironmentSwitcher();

  }


  /* =========================================
     START
  ========================================== */

  function initEnvironmentSwitcher() {

    updateEnvironmentSwitcher();

  }


  /* =========================================
     GLOBAL EXPORTS

     Read-only network information.
     No network state is persisted locally.
  ========================================== */

  window.getCurrentEnvironment =
    getCurrentEnvironment;

  window.getAlbukhrNetwork =
    getAlbukhrNetwork;

  window.requireAlbukhrNetwork =
    requireAlbukhrNetwork;

  window.isAlbukhrMainnet =
    isAlbukhrMainnet;

  window.isAlbukhrTestnet =
    isAlbukhrTestnet;

  window.getAlbukhrEnvironmentConfig =
    getAlbukhrEnvironmentConfig;

  window.getAlbukhrNetworkUrl =
    getAlbukhrNetworkUrl;

  window.getAlbukhrNetworkName =
    getAlbukhrNetworkName;

  window.refreshAlbukhrEnvironmentSwitcher =
    refreshEnvironmentSwitcher;

  window.ALBUKHR_ENVIRONMENTS =
    ENVIRONMENTS;


  /* =========================================
     DOM READY
  ========================================== */

  if (
    document.readyState === "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      initEnvironmentSwitcher,
      { once: true }
    );

  } else {

    initEnvironmentSwitcher();

  }

})();
