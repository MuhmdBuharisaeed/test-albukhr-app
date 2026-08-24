/* =========================================================
   ALBUKHR ENVIRONMENT SWITCHER v4
   js/core/environment-switcher.js

   FOUNDATION RULES
   - Hostname is the only network source of truth.
   - MAINNET: https://app.albukhr.com
   - TESTNET: https://test.albukhr.com
   - No LocalStorage/sessionStorage network state.
   - No Supabase client.
   - UI is updated only when the existing drawer elements exist.
   - Does not create, move, or modify Dock Navigation.
========================================================= */

(() => {
  "use strict";

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

  function getHostname() {
    try {
      return String(window.location.hostname || "").trim().toLowerCase();
    } catch (_) {
      return "";
    }
  }

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

    /*
     * Local/dev/unknown hosts intentionally remain mainnet-compatible.
     * A production testnet deployment must use test.albukhr.com.
     */
    return "mainnet";
  }

  function getAlbukhrNetwork() {
    const network = getCurrentEnvironment();

    if (!ENVIRONMENTS[network]) {
      throw new Error("ALBUKHR: invalid network detected.");
    }

    return network;
  }

  function requireAlbukhrNetwork() {
    return getAlbukhrNetwork();
  }

  function isAlbukhrMainnet() {
    return getAlbukhrNetwork() === "mainnet";
  }

  function isAlbukhrTestnet() {
    return getAlbukhrNetwork() === "testnet";
  }

  function getAlbukhrEnvironmentConfig() {
    const network = getAlbukhrNetwork();
    const env = ENVIRONMENTS[network];

    return Object.freeze({
      network: env.key,
      name: env.name,
      url: env.url
    });
  }

  function normalizeNetwork(network) {
    const key = network === undefined
      ? getAlbukhrNetwork()
      : String(network).trim().toLowerCase();

    if (!ENVIRONMENTS[key]) {
      throw new Error(`ALBUKHR: unsupported network "${key}".`);
    }

    return key;
  }

  function getAlbukhrNetworkUrl(network) {
    return ENVIRONMENTS[normalizeNetwork(network)].url;
  }

  function getAlbukhrNetworkName(network) {
    return ENVIRONMENTS[normalizeNetwork(network)].name;
  }

  function updateEnvironmentSwitcher() {
    const switcher = document.getElementById("environmentSwitcher");
    const dot = document.getElementById("environmentDot");
    const label = document.getElementById("environmentLabel");

    /*
     * The engine never creates UI. A page without the drawer switcher
     * simply receives no UI binding.
     */
    if (!switcher || !dot || !label) {
      return false;
    }

    const current = getAlbukhrNetwork();
    const target = current === "mainnet" ? "testnet" : "mainnet";

    label.textContent = ENVIRONMENTS[current].name;

    switcher.classList.remove("mainnet", "testnet");
    switcher.classList.add(current);

    dot.classList.remove("mainnet", "testnet");
    dot.classList.add(current);

    switcher.dataset.network = current;
    switcher.dataset.targetNetwork = target;

    switcher.setAttribute("role", "button");
    switcher.setAttribute(
      "aria-label",
      `Switch to ${ENVIRONMENTS[target].name}`
    );
    switcher.setAttribute("aria-current", current);
    switcher.title = `Switch to ${ENVIRONMENTS[target].name}`;

    if (switcher.dataset.albukhrEnvironmentBound !== "true") {
      switcher.addEventListener("click", (event) => {
        event.preventDefault();

        if (switcher.dataset.switching === "true") return;

        const targetNetwork = switcher.dataset.targetNetwork;
        const targetUrl = getAlbukhrNetworkUrl(targetNetwork);

        switcher.dataset.switching = "true";
        switcher.setAttribute("aria-busy", "true");

        window.location.assign(targetUrl);
      });

      switcher.dataset.albukhrEnvironmentBound = "true";
    }

    return true;
  }

  function refreshAlbukhrEnvironmentSwitcher() {
    return updateEnvironmentSwitcher();
  }

  window.getCurrentEnvironment = getCurrentEnvironment;
  window.getAlbukhrNetwork = getAlbukhrNetwork;
  window.requireAlbukhrNetwork = requireAlbukhrNetwork;
  window.isAlbukhrMainnet = isAlbukhrMainnet;
  window.isAlbukhrTestnet = isAlbukhrTestnet;
  window.getAlbukhrEnvironmentConfig = getAlbukhrEnvironmentConfig;
  window.getAlbukhrNetworkUrl = getAlbukhrNetworkUrl;
  window.getAlbukhrNetworkName = getAlbukhrNetworkName;
  window.refreshAlbukhrEnvironmentSwitcher =
    refreshAlbukhrEnvironmentSwitcher;
  window.ALBUKHR_ENVIRONMENTS = ENVIRONMENTS;

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      updateEnvironmentSwitcher,
      { once: true }
    );
  } else {
    updateEnvironmentSwitcher();
  }
})();
