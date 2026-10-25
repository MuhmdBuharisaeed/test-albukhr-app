/* ALBUKHR TESTNET DIRECT LOGIN v1
 * Pi access tokens stay memory-only and are sent only to the Testnet
 * direct-auth endpoint for server-side validation against Pi /v2/me.
 */
(function (window, document) {
  "use strict";

  var DIRECT_AUTH_URL =
    "https://vhvkwvngmrlgyzwemttt.supabase.co/functions/v1/testnet-direct-auth";
  var SESSION_KEY = "albukhr_testnet_session_v6";
  var SDK_VERSION = "2.0";
  var PI_SANDBOX = true;
  var busy = false;
  var piInitPromise = null;

  function el(id) { return document.getElementById(id); }
  function clean(value) { return String(value == null ? "" : value).trim(); }

  function setStatus(message) {
    var node = el("status");
    if (node) node.textContent = String(message || "");
  }

  function setLoading(loading, label) {
    var button = el("testnetLoginButton");
    if (!button) return;
    button.disabled = !!loading;
    button.setAttribute("aria-busy", loading ? "true" : "false");
    var text = button.querySelector(".login-text");
    if (text) text.textContent = label || (loading ? "Verifying Pi…" : "Continue with Pi");
  }

  function withTimeout(promise, milliseconds, code) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = window.setTimeout(function () {
        if (settled) return;
        settled = true;
        reject(new Error(code));
      }, milliseconds);
      Promise.resolve(promise).then(function (value) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(value);
      }, function (error) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        reject(error);
      });
    });
  }

  function initializePi() {
    if (piInitPromise) return piInitPromise;
    if (!window.Pi || typeof window.Pi.init !== "function" || typeof window.Pi.authenticate !== "function") {
      return Promise.reject(new Error("PI_SDK_UNAVAILABLE"));
    }
    piInitPromise = withTimeout(
      Promise.resolve().then(function () {
        return window.Pi.init({ version: SDK_VERSION, sandbox: PI_SANDBOX });
      }),
      12000,
      "PI_SDK_INIT_TIMEOUT"
    ).catch(function (error) {
      piInitPromise = null;
      throw error;
    });
    return piInitPromise;
  }

  function safeReturnTo() {
    var raw = "index.html";
    try {
      raw = new URLSearchParams(window.location.search).get("returnTo") || raw;
    } catch (_) {}
    raw = clean(raw);
    if (!raw || raw.indexOf("//") === 0 || raw.indexOf("\\") !== -1 || /^[a-z][a-z0-9+.-]*:/i.test(raw)) {
      return "index.html";
    }
    try {
      var url = new URL(raw, window.location.origin);
      if (url.origin !== window.location.origin) return "index.html";
      return url.pathname + url.search + url.hash;
    } catch (_) {
      return "index.html";
    }
  }

  async function authenticateDirectly() {
    if (busy) return;
    busy = true;
    setLoading(true, "Opening Pi…");
    setStatus("Initializing Pi SDK in Testnet. Keep this page open.");

    try {
      await initializePi();
      setStatus("Pi SDK initialized. Requesting Pi identity approval…");
      setLoading(true, "Verifying Pi…");

      var authResult = await withTimeout(
        window.Pi.authenticate(
          ["username", "payments", "wallet_address"],
          function onIncompletePaymentFound() {
            // Payment recovery remains in the existing payment backend flow.
            // Do not log the payment object or any credentials here.
          }
        ),
        20000,
        "PI_AUTHENTICATION_TIMEOUT"
      );

      var accessToken = clean(authResult && authResult.accessToken);
      if (!accessToken) throw new Error("PI_ACCESS_TOKEN_REQUIRED");

      setStatus("Pi identity received. ALBUKHR is verifying it with Pi servers…");
      var response = await fetch(DIRECT_AUTH_URL, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        headers: {
          "Authorization": "Bearer " + accessToken,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ action: "authenticate" })
      });

      // Do not retain accessToken outside this function; it is never written
      // to localStorage, sessionStorage, a URL, or diagnostic output.
      authResult = null;
      accessToken = "";

      var payload = null;
      try { payload = await response.json(); } catch (_) {}

      if (!response.ok || !payload || payload.ok !== true || !payload.session || !payload.user || !payload.user.uid) {
        var code = clean(payload && payload.error) || "TESTNET_DIRECT_AUTH_FAILED";
        if (code === "TESTNET_IDENTITY_LINK_REQUIRED") {
          var requestId = clean(payload && payload.request_id);
          setStatus(
            "Pi identity was verified, but it is not yet linked to an existing ALBUKHR Testnet account. No session was issued. " +
            (requestId ? "Admin link-request reference: " + requestId + ". " : "") +
            "Please share this reference with the ALBUKHR Super Admin for manual verification."
          );
          setLoading(false, "Continue with Pi");
          return;
        }
        if (code === "TESTNET_IDENTITY_LINK_REJECTED") {
          throw new Error("TESTNET_IDENTITY_LINK_REJECTED");
        }
        throw new Error(code);
      }

      var session = {
        token: clean(payload.session),
        expires_at: payload.expires_at || null,
        network: "testnet",
        pi_uid: clean(payload.user.uid),
        username: clean(payload.user.username) || null,
        wallet_address: clean(payload.user.wallet_address) || null
      };
      if (!session.token || !session.pi_uid) throw new Error("TESTNET_SESSION_INVALID");

      try {
        window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      } catch (_) {
        throw new Error("TESTNET_SESSION_STORAGE_UNAVAILABLE");
      }

      setStatus("Pi identity verified and Testnet session created. Opening ALBUKHR Testnet…");
      setLoading(true, "Opening Testnet…");
      window.location.replace(safeReturnTo());
    } catch (error) {
      var code = clean(error && error.message) || "TESTNET_DIRECT_AUTH_FAILED";
      console.warn("[ALBUKHR TESTNET LOGIN]", code);
      setLoading(false, "Continue with Pi");
      if (code === "PI_SDK_INIT_TIMEOUT") {
        setStatus("Pi SDK initialization timed out. Confirm you are using Pi Browser and open test.albukhr.com directly, then retry. No payment was started.");
      } else if (code === "PI_AUTHENTICATION_TIMEOUT") {
        setStatus("Pi identity approval timed out. Retry the sign-in and complete any Pi prompt.");
      } else if (code === "TESTNET_SESSION_STORAGE_UNAVAILABLE") {
        setStatus("This Pi Browser tab could not store the temporary Testnet session. Reopen the Testnet login page in a normal Pi Browser tab and retry.");
      } else {
        setStatus("Testnet sign-in failed: " + code + ". No Testnet session was issued.");
      }
    } finally {
      busy = false;
    }
  }

  function init() {
    setLoading(false, "Continue with Pi");
    setStatus("Ready to authenticate directly with Pi Testnet.");
    var button = el("testnetLoginButton");
    if (button) button.addEventListener("click", authenticateDirectly);
  }

  window.login = authenticateDirectly;
  window.AlbukhrTestnetLogin = Object.freeze({ start: authenticateDirectly });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})(window, document);
