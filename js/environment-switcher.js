/* =========================================
   ALBUKHR ENVIRONMENT SWITCHER
   MAINNET <-> TESTNET
========================================= */

(() => {

  "use strict";

  /* =========================================
     ENVIRONMENT CONFIG
  ========================================== */

  const ENVIRONMENTS = {

    mainnet: {
      name: "MAINNET",
      host: "app.albukhr.com"
    },

    testnet: {
      name: "TESTNET",
      host: "test.albukhr.com"
    }

  };


  /* =========================================
     DETECT CURRENT ENVIRONMENT
  ========================================== */

  function getCurrentEnvironment() {

    const hostname =
      window.location.hostname.toLowerCase();

    if (
      hostname === ENVIRONMENTS.mainnet.host
    ) {

      return "mainnet";

    }

    if (
      hostname === ENVIRONMENTS.testnet.host
    ) {

      return "testnet";

    }

    /*
      Fallback for localhost/dev/unknown host
    */

    return "testnet";

  }


  /* =========================================
     GET TARGET ENVIRONMENT
  ========================================== */

  function getTargetEnvironment() {

    const current =
      getCurrentEnvironment();

    return current === "mainnet"
      ? "testnet"
      : "mainnet";

  }


  /* =========================================
     BUILD TARGET URL
     
     IMPORTANT:
     Preserve:
     - pathname
     - query string
     - hash
  ========================================== */

  function buildTargetUrl() {

    const target =
      getTargetEnvironment();

    const targetHost =
      ENVIRONMENTS[target].host;

    return (
      "https://" +
      targetHost +
      window.location.pathname +
      window.location.search +
      window.location.hash
    );

  }


  /* =========================================
     SWITCH ENVIRONMENT
  ========================================== */

  function switchEnvironment() {

    const current =
      getCurrentEnvironment();

    const target =
      getTargetEnvironment();

    console.log(
      "ALBUKHR Environment:",
      current.toUpperCase(),
      "→",
      target.toUpperCase()
    );

    const targetUrl =
      buildTargetUrl();

    console.log(
      "ALBUKHR Environment Target:",
      targetUrl
    );

    window.location.href =
      targetUrl;

  }


  /* =========================================
     PUBLIC API
  ========================================== */

  window.AlbukhrEnvironment = {

    getCurrentEnvironment,

    getTargetEnvironment,

    buildTargetUrl,

    switchEnvironment

  };


  /* =========================================
     INITIAL LOG
  ========================================== */

  console.log(
    "ALBUKHR Environment Switcher loaded:",
    getCurrentEnvironment().toUpperCase()
  );


})();
