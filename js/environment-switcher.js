/* =========================================
   ALBUKHR ENVIRONMENT SWITCHER
   MAINNET / TESTNET
   SIDE DRAWER HEADER
========================================= */

(() => {

  "use strict";


  /* =========================================
     ENVIRONMENT CONFIG
  ========================================== */

  const ENVIRONMENTS = {

    mainnet: {
      name: "MAINNET",
      url: "https://app.albukhr.com"
    },

    testnet: {
      name: "TESTNET",
      url: "https://test.albukhr.com"
    }

  };


  /* =========================================
     DETECT CURRENT ENVIRONMENT
  ========================================== */

  function getCurrentEnvironment() {

    const hostname =
      window.location.hostname.toLowerCase();


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
       Local / development fallback
    */

    return "mainnet";

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
      getCurrentEnvironment();


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
