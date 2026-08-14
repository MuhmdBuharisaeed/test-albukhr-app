/* =========================================
   ALBUKHR ENVIRONMENT SWITCHER
   MAINNET / TESTNET
   ========================================= */

(() => {

  "use strict";


  /* =========================================
     ENVIRONMENT CONFIG
  ========================================= */

  const ENVIRONMENTS = {

    mainnet: {
      name: "Mainnet",
      url: "https://app.albukhr.com"
    },

    testnet: {
      name: "Testnet",
      url: "https://test.albukhr.com"
    }

  };


  /* =========================================
     DETECT CURRENT ENVIRONMENT
  ========================================= */

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
       Local development fallback
    */

    return "mainnet";

  }


  /* =========================================
     CREATE SWITCHER
  ========================================= */

  function createEnvironmentSwitcher() {

    /*
       Kada a saka shi sau biyu
    */

    if (
      document.getElementById(
        "albukhrEnvironmentSwitcher"
      )
    ) {

      return;

    }


    const current =
      getCurrentEnvironment();


    const target =
      current === "mainnet"
        ? "testnet"
        : "mainnet";


    const switcher =
      document.createElement("button");


    switcher.type =
      "button";


    switcher.id =
      "albukhrEnvironmentSwitcher";


    switcher.className =
      "albukhr-environment-switcher";


    switcher.setAttribute(
      "aria-label",
      `Switch to ${ENVIRONMENTS[target].name}`
    );


    switcher.title =
      `Switch to ${ENVIRONMENTS[target].name}`;


    switcher.innerHTML = `

      <span class="environment-dot"></span>

      <span class="environment-text">
        ${ENVIRONMENTS[current].name}
      </span>

    `;


    /*
       CLICK
    */

    switcher.addEventListener(
      "click",
      () => {

        window.location.href =
          ENVIRONMENTS[target].url;

      }
    );


    /*
       INSERT INTO HEADER
    */

    const headerRight =
      document.querySelector(
        ".header-right"
      );


    if (!headerRight) {

      console.warn(
        "ALBUKHR Environment Switcher: .header-right not found."
      );

      return;

    }


    /*
       Saka shi kafin notification
       domin ya kasance kusa da user/settings area.
    */

    const notification =
      headerRight.querySelector(
        ".notification-btn"
      );


    if (notification) {

      headerRight.insertBefore(
        switcher,
        notification
      );

    } else {

      headerRight.appendChild(
        switcher
      );

    }

  }


  /* =========================================
     START
  ========================================= */

  function initEnvironmentSwitcher() {

    createEnvironmentSwitcher();

  }


  /* =========================================
     DOM READY
  ========================================= */

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
