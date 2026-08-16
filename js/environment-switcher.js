/* =========================================
   ALBUKHR ENVIRONMENT SWITCHER v2
   MAINNET / TESTNET
   SIDE DRAWER HEADER

   PURPOSE:
   - Detect the active ALBUKHR network
   - Provide one authoritative network resolver
   - Keep environment switching in the Side Drawer header
   - Expose network helpers for Supabase/data engines

   NETWORKS:
   MAINNET → https://app.albukhr.com
   TESTNET → https://test.albukhr.com

   IMPORTANT:
   This file does NOT persist the selected network in LocalStorage.
   The hostname is the source of truth.
========================================= */

(() => {

  "use strict";


  /* =========================================
     ENVIRONMENT CONFIG
  ========================================== */

  const ENVIRONMENTS = Object.freeze({

    mainnet: Object.freeze({
      name: "MAINNET",
      url: "https://app.albukhr.com"
    }),

    testnet: Object.freeze({
      name: "TESTNET",
      url: "https://test.albukhr.com"
    })

  });


  /* =========================================
     DETECT CURRENT ENVIRONMENT
     HOSTNAME IS THE SOURCE OF TRUTH
  ========================================== */

  function getCurrentEnvironment() {

    const hostname =
      String(
        window.location.hostname || ""
      )
        .trim()
        .toLowerCase();


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


    /*
       Development/local fallback.

       Existing ALBUKHR behaviour is preserved:
       unknown/local hosts resolve to MAINNET.

       Production network isolation still depends on
       the real app/test hostnames.
    */

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

    return getAlbukhrNetwork() ===
      "mainnet";

  }


  function isAlbukhrTestnet() {

    return getAlbukhrNetwork() ===
      "testnet";

  }


  function getAlbukhrEnvironmentConfig() {

    const network =
      getAlbukhrNetwork();

    return {
      network,
      name:
        ENVIRONMENTS[network].name,
      url:
        ENVIRONMENTS[network].url
    };

  }


  /* =========================================
     UPDATE EXISTING SWITCHER
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

      return;

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
       RESET ENVIRONMENT CLASSES
    ===================================== */

    switcher.classList.remove(
      "mainnet",
      "testnet"
    );


    switcher.classList.add(
      current
    );


    /* =====================================
       OPTIONAL DOT STATE
    ===================================== */

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
      "aria-label",
      `Switch to ${ENVIRONMENTS[target].name}`
    );


    switcher.title =
      `Switch to ${ENVIRONMENTS[target].name}`;


    /* =====================================
       CLICK
    ===================================== */

    switcher.onclick =
      function () {

        switcher.disabled = true;


        window.location.href =
          ENVIRONMENTS[target].url;

      };

  }


  /* =========================================
     START
  ========================================== */

  function initEnvironmentSwitcher() {

    updateEnvironmentSwitcher();

  }


  /* =========================================
     GLOBAL EXPORTS

     These are intentionally read-only APIs.
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

  window.ALBUKHR_ENVIRONMENTS =
    ENVIRONMENTS;


  /* =========================================
     DOM READY
  ========================================== */

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      initEnvironmentSwitcher
    );

  } else {

    initEnvironmentSwitcher();

  }


})();
