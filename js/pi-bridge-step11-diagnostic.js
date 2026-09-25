/* ALBUKHR PI BRIDGE STEP 11 — ISOLATED DIAGNOSTIC */
(function (window, document) {
  "use strict";

  var startedAt = Date.now();
  var statusNode = document.getElementById("status");
  var logNode = document.getElementById("log");
  var initBtn = document.getElementById("initBtn");
  var featuresBtn = document.getElementById("featuresBtn");
  var usernameBtn = document.getElementById("usernameBtn");
  var paymentsBtn = document.getElementById("paymentsBtn");
  var initialized = false;
  var initResult = null;

  function elapsed() { return (Date.now() - startedAt) + "ms"; }
  function clean(v) { return String(v == null ? "" : v).trim(); }
  function safeError(error) {
    return {
      name: clean(error && error.name) || "Error",
      message: clean(error && error.message) || String(error || "Unknown error")
    };
  }
  function setStatus(text) {
    if (statusNode) statusNode.textContent = text;
  }
  function log(event, data) {
    var line = "[" + elapsed() + "] " + event;
    if (data !== undefined) {
      try { line += "\n" + JSON.stringify(data); }
      catch (_) { line += "\n[unserializable]"; }
    }
    if (logNode) {
      logNode.textContent += (logNode.textContent ? "\n" : "") + line;
      logNode.scrollTop = logNode.scrollHeight;
    }
    console.log("[ALBUKHR STEP11]", event, data === undefined ? "" : data);
  }

  function sdk() {
    if (!window.Pi) throw new Error("PI_SDK_NOT_PRESENT");
    if (typeof window.Pi.init !== "function") throw new Error("PI_INIT_NOT_AVAILABLE");
    return window.Pi;
  }

  function initPi() {
    try {
      var pi = sdk();
      log("PI_CHECK", {
        host: window.location.host,
        origin: window.location.origin,
        piPresent: true,
        userAgent: navigator.userAgent
      });
      if (initialized) {
        log("PI_INIT_ALREADY_DONE", initResult);
        setStatus("PI_INIT_ALREADY_DONE");
        return pi;
      }
      initResult = pi.init({ version: "2.0", sandbox: false });
      initialized = true;
      log("PI_INIT_RETURNED", { version: "2.0", sandbox: false, returnValueType: typeof initResult });
      setStatus("PI_INIT_OK");
      return pi;
    } catch (error) {
      initialized = false;
      log("PI_INIT_ERROR", safeError(error));
      setStatus("PI_INIT_ERROR");
      throw error;
    }
  }

  async function nativeFeatures() {
    try {
      if (!initialized) initPi();
      var pi = sdk();
      if (typeof pi.nativeFeaturesList !== "function") throw new Error("PI_NATIVE_FEATURES_NOT_AVAILABLE");
      log("NATIVE_FEATURES_CALLED");
      var features = await pi.nativeFeaturesList();
      log("NATIVE_FEATURES_RESOLVED", {
        features: Array.isArray(features) ? features : [],
        isArray: Array.isArray(features)
      });
      setStatus("NATIVE_FEATURES_OK");
      return features;
    } catch (error) {
      log("NATIVE_FEATURES_ERROR", safeError(error));
      setStatus("NATIVE_FEATURES_ERROR");
      throw error;
    }
  }

  async function authenticate(scopes, label) {
    try {
      if (!initialized) initPi();
      var pi = sdk();
      if (typeof pi.authenticate !== "function") throw new Error("PI_AUTHENTICATE_NOT_AVAILABLE");
      log("AUTH_CALLED", { label: label, scopes: scopes });
      var result = await pi.authenticate(scopes, function (payment) {
        log("INCOMPLETE_PAYMENT_CALLBACK", {
          identifierPresent: !!(payment && payment.identifier),
          hasPaymentObject: !!payment
        });
      });
      log("AUTH_RESOLVED", {
        label: label,
        userPresent: !!(result && result.user),
        uidPresent: !!(result && result.user && result.user.uid),
        usernamePresent: !!(result && result.user && result.user.username),
        accessTokenPresent: !!(result && result.accessToken)
      });
      setStatus(label + " AUTH_OK");
      return result;
    } catch (error) {
      log("AUTH_ERROR", { label: label, error: safeError(error) });
      setStatus(label + " AUTH_ERROR");
      throw error;
    }
  }

  function bind(button, fn) {
    button.addEventListener("click", async function () {
      button.disabled = true;
      try { await fn(); }
      catch (_) {}
      finally { button.disabled = false; }
    });
  }

  bind(initBtn, async function () { initPi(); });
  bind(featuresBtn, nativeFeatures);
  bind(usernameBtn, function () { return authenticate(["username"], "USERNAME_ONLY"); });
  bind(paymentsBtn, function () { return authenticate(["username", "payments"], "USERNAME_PAYMENTS"); });

  log("STEP11_READY", {
    host: window.location.host,
    origin: window.location.origin,
    piPresent: !!window.Pi,
    paymentCreated: false,
    accessTokenDisplayed: false
  });
})(window, document);
