/* ALBUKHR TESTNET DIRECT LOGIN v2 — OWNER IDENTITY LINK INTENT
 * Pi access tokens remain memory-only.
 *
 * Default sign-in remains the existing general Testnet flow.
 * The explicit ?purpose=project_owner route asks the backend to create
 * an Admin-reviewed Sandbox UID link request for an existing project owner.
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
  var piInitReady = false;

  function el(id) {
    return document.getElementById(id);
  }

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function isProjectOwnerLogin() {
    try {
      return clean(
        new URLSearchParams(window.location.search).get("purpose")
      ).toLowerCase() === "project_owner";
    } catch (_) {
      return false;
    }
  }

  function currentPurpose() {
    return isProjectOwnerLogin() ? "project_owner" : "general";
  }

  function setStatus(message) {
    var node = el("status");
    if (node) node.textContent = String(message || "");
  }

  function setLoading(loading, label, purpose) {
    var generalButton = el("testnetLoginButton");
    var ownerButton = el("testnetOwnerLoginButton");
    var activeButton = purpose === "project_owner"
      ? (ownerButton || generalButton)
      : generalButton;

    [generalButton, ownerButton].forEach(function (button) {
      if (!button) return;
      button.disabled = !!loading;
      button.setAttribute("aria-busy", loading ? "true" : "false");
    });

    if (activeButton) {
      var text = activeButton.querySelector(".login-text");
      if (text) {
        text.textContent = label || (
          loading
            ? "Verifying Pi…"
            : purpose === "project_owner"
              ? "Continue as Project Owner"
              : "Continue with Pi"
        );
      }
    }
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
    if (piInitReady) return Promise.resolve(true);

    if (!piInitPromise) {
      if (
        !window.Pi ||
        typeof window.Pi.init !== "function" ||
        typeof window.Pi.authenticate !== "function"
      ) {
        return Promise.reject(new Error("PI_SDK_UNAVAILABLE"));
      }

      /*
       * Keep the original Pi.init promise until the SDK itself settles.
       * withTimeout() only limits this caller's wait; it cannot cancel Pi.init().
       * If the wait expires, another click in this page must share the same
       * pending promise instead of starting a second Pi.init() call.
       */
      piInitPromise = Promise.resolve()
        .then(function () {
          return window.Pi.init({
            version: SDK_VERSION,
            sandbox: PI_SANDBOX
          });
        })
        .then(function () {
          piInitReady = true;
          return true;
        }, function (error) {
          piInitReady = false;
          piInitPromise = null;
          throw error;
        });
    }

    return withTimeout(
      piInitPromise,
      12000,
      "PI_SDK_INIT_TIMEOUT"
    );
  }

  function safeReturnTo() {
    var raw = "index.html";

    try {
      raw =
        new URLSearchParams(window.location.search)
          .get("returnTo") || raw;
    } catch (_) {}

    raw = clean(raw);

    if (
      !raw ||
      raw.indexOf("//") === 0 ||
      raw.indexOf("\\") !== -1 ||
      /^[a-z][a-z0-9+.-]*:/i.test(raw)
    ) {
      return "index.html";
    }

    try {
      var url = new URL(raw, window.location.origin);

      if (url.origin !== window.location.origin) {
        return "index.html";
      }

      return url.pathname + url.search + url.hash;
    } catch (_) {
      return "index.html";
    }
  }

  async function authenticateDirectly() {
    if (busy) return;

    var purpose = currentPurpose();
    busy = true;
    setLoading(true, "Opening Pi…", purpose);
    setStatus(
      purpose === "project_owner"
        ? "Starting Testnet Project Owner identity verification."
        : "Initializing Pi SDK in Testnet. Keep this page open."
    );

    try {
      await initializePi();

      setStatus("Pi SDK initialized. Requesting Pi identity approval…");
      setLoading(true, "Verifying Pi…", purpose);

      var authResult = await withTimeout(
        window.Pi.authenticate(
          ["username", "payments", "wallet_address"],
          function onIncompletePaymentFound() {
            // Existing backend recovery flow remains responsible.
            // Never log payment credentials or access tokens here.
          }
        ),
        20000,
        "PI_AUTHENTICATION_TIMEOUT"
      );

      var accessToken = clean(authResult && authResult.accessToken);

      if (!accessToken) {
        throw new Error("PI_ACCESS_TOKEN_REQUIRED");
      }

      setStatus(
        "Pi identity received. ALBUKHR is verifying it with Pi servers…"
      );

      var requestBody = { action: "authenticate" };
      if (purpose === "project_owner") {
        requestBody.purpose = "project_owner";
      }

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
        body: JSON.stringify(requestBody)
      });

      // Do not persist the Pi token in browser storage or URLs.
      authResult = null;
      accessToken = "";

      var payload = null;
      try {
        payload = await response.json();
      } catch (_) {}

      if (
        !response.ok ||
        !payload ||
        payload.ok !== true ||
        !payload.session ||
        !payload.user ||
        !payload.user.uid
      ) {
        var code =
          clean(payload && payload.error) ||
          "TESTNET_DIRECT_AUTH_FAILED";

        if (code === "TESTNET_IDENTITY_LINK_REQUIRED") {
          var requestId = clean(payload && payload.request_id);

          setStatus(
            "Pi identity was verified, but it is not linked to an " +
            "existing ALBUKHR Testnet account. No session was issued. " +
            (requestId
              ? "Admin link-request reference: " + requestId + ". "
              : "") +
            "Contact the ALBUKHR Super Admin for manual verification."
          );

          setLoading(
            false,
            purpose === "project_owner" ? "Continue as Project Owner" : "Continue with Pi",
            purpose
          );
          return;
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

      if (!session.token || !session.pi_uid) {
        throw new Error("TESTNET_SESSION_INVALID");
      }

      /*
       * Owner flow: do not save a temporary Sandbox-only session while
       * the request is pending, rejected, or inconsistent. Save only
       * after the backend confirms that the Sandbox UID is linked to an
       * existing canonical ALBUKHR Testnet owner account.
       */
      if (purpose === "project_owner") {
        var linkStatus = clean(payload.identity_link_status).toLowerCase();
        var requestId = clean(payload.identity_link_request_id);

        if (linkStatus === "pending") {
          setStatus(
            "Your Pi Sandbox identity has been verified and the Owner " +
            "identity-link request is awaiting ALBUKHR Super Admin approval. " +
            (requestId ? "Reference: " + requestId + ". " : "") +
            "Your canonical ALBUKHR Pi UID has not been changed. After Admin " +
            "approval, return to this page and choose Continue as Project Owner again."
          );
          setLoading(false, "Continue as Project Owner", purpose);
          return;
        }

        if (linkStatus === "rejected") {
          setStatus(
            "The Owner identity-link request was rejected. No Owner session " +
            "was saved. Contact the ALBUKHR Super Admin for the review outcome."
          );
          setLoading(false, "Continue as Project Owner", purpose);
          return;
        }

        if (linkStatus === "inconsistent") {
          setStatus(
            "The identity-link record and account mapping do not agree. " +
            "No Owner session was saved. Contact the ALBUKHR Super Admin " +
            "for reconciliation."
          );
          setLoading(false, "Continue as Project Owner", purpose);
          return;
        }

        if (linkStatus !== "linked") {
          setStatus(
            "ALBUKHR did not confirm an approved Owner identity link. " +
            "No Owner session was saved. Contact the ALBUKHR Super Admin."
          );
          setLoading(false, "Continue as Project Owner", purpose);
          return;
        }
      }

      try {
        window.sessionStorage.setItem(
          SESSION_KEY,
          JSON.stringify(session)
        );
      } catch (_) {
        throw new Error("TESTNET_SESSION_STORAGE_UNAVAILABLE");
      }

      setStatus(
        purpose === "project_owner"
          ? "Owner identity link confirmed. Opening Testnet…"
          : "Pi identity verified and Testnet session created. Opening Testnet…"
      );

      setLoading(true, "Opening Testnet…", purpose);
      window.location.replace(safeReturnTo());

    } catch (error) {
      var code =
        clean(error && error.message) ||
        "TESTNET_DIRECT_AUTH_FAILED";

      console.warn("[ALBUKHR TESTNET LOGIN]", code);
      setLoading(false, "Continue with Pi", purpose);

      if (code === "PI_SDK_INIT_TIMEOUT") {
        setStatus(
          "Pi SDK initialization timed out and may still be running in this tab. " +
          "Reload the Testnet page inside Pi Browser before retrying. " +
          "No payment was started."
        );
      } else if (code === "PI_AUTHENTICATION_TIMEOUT") {
        setStatus(
          "Pi identity approval timed out. Retry and complete any Pi prompt."
        );
      } else if (code === "TESTNET_SESSION_STORAGE_UNAVAILABLE") {
        setStatus(
          "This Pi Browser tab could not store the temporary Testnet " +
          "session. Reopen Testnet login in a normal Pi Browser tab."
        );
      } else {
        setStatus(
          "Testnet sign-in failed: " + code +
          ". No Testnet session was issued."
        );
      }
    } finally {
      busy = false;
    }
  }

  function init() {
    var purpose = currentPurpose();
    var ownerNotice = el("ownerLoginNotice");
    var title = el("loginTitle");

    if (ownerNotice) {
      ownerNotice.hidden = purpose !== "project_owner";
      /* The shared .notice rule sets display:flex; explicitly pair it with
       * the hidden state so browsers do not accidentally display it. */
      ownerNotice.style.display = purpose === "project_owner" ? "flex" : "none";
    }
    if (title && purpose === "project_owner") {
      title.textContent = "Verify Project Owner identity";
    }

    var loginButton = el("testnetLoginButton");
    if (loginButton) {
      loginButton.setAttribute(
        "aria-describedby",
        purpose === "project_owner" ? "ownerLoginNotice status" : "status"
      );
    }

    setLoading(
      false,
      purpose === "project_owner"
        ? "Continue as Project Owner"
        : "Continue with Pi",
      purpose
    );

    setStatus(
      purpose === "project_owner"
        ? "Ready to verify your Pi Sandbox identity for an existing ALBUKHR Testnet project-owner account."
        : "Ready to authenticate directly with Pi Testnet."
    );

    var button = el("testnetLoginButton");
    if (button) {
      button.addEventListener("click", authenticateDirectly);
    }
  }

  window.login = authenticateDirectly;

  window.AlbukhrTestnetLogin = Object.freeze({
    start: authenticateDirectly
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})(window, document);
