/* ALBUKHR TESTNET AUTH GATEWAY v6 */
(function (window, document) {
  "use strict";

  /*
   * ALBUKHR TESTNET AUTH GATEWAY
   *
   * Secure flow:
   *
   *   Testnet
   *      ↓
   *   Mainnet Pi verification
   *      ↓
   *   Mainnet Testnet-Auth Issuer
   *      ↓
   *   One-time opaque access code
   *      ↓
   *   Testnet Auth Gateway
   *      ↓
   *   Short-lived Testnet session
   *
   * Security rules:
   * - Never send the Mainnet Pi access token to Testnet.
   * - Never store the Pi access token in browser storage.
   * - Never put the Pi access token in a URL.
   * - Testnet only accepts the one-time gateway access code.
   * - Gateway requests do not send browser credentials/cookies.
   * - The Testnet session is temporary browser-session state only.
   *
   * NOTE:
   * sessionStorage is intentionally used only for the temporary
   * Testnet gateway session. It is NOT used as the application
   * source of truth and is NOT used for persistent application data.
   */

  var GATEWAY_URL =
    "https://vhvkwvngmrlgyzwemttt.supabase.co/functions/v1/testnet-auth-gateway";

  var MAINNET_LOGIN =
    "https://app.albukhr.com/login.html?returnTo=testnet";

  var TESTNET_HOST =
    "test.albukhr.com";

  var TESTNET_NETWORK =
    "testnet";

  /*
   * Session storage key.
   *
   * This stores only the short-lived Testnet session returned by
   * the Testnet gateway.
   */
  var SESSION_KEY =
    "albukhr_testnet_session_v6";

  var session = null;

  /*
   * ------------------------------------------------------------------
   * Utilities
   * ------------------------------------------------------------------
   */

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function isObject(value) {
    return !!value && typeof value === "object";
  }

  function currentHost() {
    try {
      return clean(
        window.location &&
        window.location.hostname
          ? window.location.hostname
          : ""
      )
        .toLowerCase()
        .replace(/\.$/, "");
    } catch (_) {
      return "";
    }
  }

  function isTestnetHost() {
    return currentHost() === TESTNET_HOST;
  }

  function emit(type, detail) {
    var payload = Object.assign(
      {
        type: type,
        at: new Date().toISOString()
      },
      detail || {}
    );

    /*
     * Do not expose access codes, session tokens or Pi tokens
     * in diagnostics.
     */
    try {
      console.info(
        "[ALBUKHR TESTNET AUTH]",
        payload
      );
    } catch (_) {}

    try {
      window.dispatchEvent(
        new CustomEvent(
          "albukhr:testnet-auth-diagnostic",
          {
            detail: payload
          }
        )
      );
    } catch (_) {}
  }

  /*
   * ------------------------------------------------------------------
   * Session validation
   * ------------------------------------------------------------------
   */

  function normalizeSession(value) {
    if (!isObject(value)) {
      return null;
    }

    var token = clean(value.token);

    if (!token) {
      return null;
    }

    if (value.network !== TESTNET_NETWORK) {
      return null;
    }

    /*
     * If an expiry is supplied, it must still be valid.
     */
    if (value.expires_at) {
      var expiry = new Date(value.expires_at).getTime();

      if (!Number.isFinite(expiry) || expiry <= Date.now()) {
        return null;
      }
    }

    return {
      token: token,
      expires_at: value.expires_at || null,
      network: TESTNET_NETWORK,
      pi_uid: clean(value.pi_uid) || null,
      username: clean(value.username) || null,
      wallet_address: clean(value.wallet_address) || null
    };
  }

  function saveSession(value) {
    var normalized = normalizeSession(value);

    if (!normalized) {
      throw new Error(
        "Invalid Testnet session received from gateway."
      );
    }

    try {
      session = Object.freeze(normalized);
    } catch (_) {
      session = normalized;
    }

    /*
     * sessionStorage is temporary browser-session state only.
     *
     * It is deliberately NOT LocalStorage.
     */
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify(normalized)
      );
    } catch (_) {
      /*
       * The in-memory session remains usable if sessionStorage
       * is unavailable.
       */
    }

    return session;
  }

  function loadSession() {
    if (session) {
      var current = normalizeSession(session);

      if (current) {
        return current;
      }

      session = null;
    }

    var raw = null;

    try {
      raw = sessionStorage.getItem(SESSION_KEY);
    } catch (_) {
      raw = null;
    }

    if (!raw) {
      return null;
    }

    try {
      var parsed = JSON.parse(raw);
      var normalized = normalizeSession(parsed);

      if (!normalized) {
        try {
          sessionStorage.removeItem(SESSION_KEY);
        } catch (_) {}

        return null;
      }

      try {
        session = Object.freeze(normalized);
      } catch (_) {
        session = normalized;
      }

      return session;
    } catch (_) {
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch (_) {}

      return null;
    }
  }

  function clearSession() {
    session = null;

    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (_) {}
  }

  /*
   * ------------------------------------------------------------------
   * Access-code URL cleanup
   * ------------------------------------------------------------------
   */

  function removeAccessCodeFromUrl() {
    try {
      var url = new URL(window.location.href);

      url.searchParams.delete("access_code");

      /*
       * Preserve every other query parameter and hash.
       */
      window.history.replaceState(
        {},
        document.title,
        url.pathname +
          (url.search ? url.search : "") +
          (url.hash ? url.hash : "")
      );
    } catch (error) {
      emit(
        "URL_CLEANUP_FAILED",
        {
          message:
            error && error.message
              ? error.message
              : "Could not remove access_code from URL."
        }
      );
    }
  }

  /*
   * ------------------------------------------------------------------
   * Gateway response parsing
   * ------------------------------------------------------------------
   */

  async function readResponse(response) {
    var raw = "";

    try {
      raw = await response.text();
    } catch (error) {
      var readError = new Error(
        "Could not read the Testnet gateway response."
      );

      readError.cause = error;
      readError.status = response.status;

      throw readError;
    }

    var body = null;

    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch (_) {
        body = null;
      }
    }

    return {
      raw: raw,
      body: body
    };
  }

  /*
   * ------------------------------------------------------------------
   * Redeem one-time Testnet access code
   * ------------------------------------------------------------------
   */

  async function redeem(code) {
    var value = clean(code);

    if (!value) {
      emit(
        "NO_ACCESS_CODE",
        {
          message:
            "No Testnet access code is present."
        }
      );

      return null;
    }

    if (!isTestnetHost()) {
      var hostError = new Error(
        "Testnet authentication can only run on test.albukhr.com."
      );

      emit(
        "INVALID_TESTNET_HOST",
        {
          message: hostError.message,
          host: currentHost()
        }
      );

      throw hostError;
    }

    emit(
      "REDEEM_START",
      {
        message:
          "Redeeming the one-time Testnet access code.",
        gateway: GATEWAY_URL
      }
    );

    var response;

    try {
      /*
       * IMPORTANT:
       *
       * credentials:"include" is intentionally NOT used.
       *
       * The gateway uses the access code in the request body and
       * does not require browser cookies.
       *
       * text/plain is retained because it avoids the unnecessary
       * JSON Content-Type CORS preflight that caused the previous
       * Pi Browser "Failed to fetch" problem.
       *
       * The body itself remains JSON text and is therefore still
       * compatible with Edge Function req.json().
       */
      response = await fetch(
        GATEWAY_URL,
        {
          method: "POST",
          mode: "cors",

          headers: {
            "Content-Type":
              "text/plain;charset=UTF-8",
            "Accept":
              "application/json"
          },

          body: JSON.stringify({
            action: "redeem",
            code: value
          })
        }
      );
    } catch (error) {
      var fetchError = new Error(
        error && error.message
          ? error.message
          : "Testnet gateway request failed."
      );

      fetchError.code =
        "GATEWAY_UNREACHABLE";

      emit(
        "GATEWAY_UNREACHABLE",
        {
          message: fetchError.message,
          gateway: GATEWAY_URL
        }
      );

      throw fetchError;
    }

    var parsedResponse;

    try {
      parsedResponse =
        await readResponse(response);
    } catch (error) {
      emit(
        "GATEWAY_RESPONSE_READ_FAILED",
        {
          status: response.status,
          message:
            error && error.message
              ? error.message
              : "Could not read gateway response.",
          gateway: GATEWAY_URL
        }
      );

      throw error;
    }

    var body = parsedResponse.body;
    var raw = parsedResponse.raw;

    /*
     * The gateway must explicitly confirm success and return
     * a Testnet session.
     */
    if (
      !response.ok ||
      !body ||
      body.ok !== true ||
      !clean(body.session)
    ) {
      var message =
        clean(body && body.error) ||
        clean(body && body.message) ||
        ("HTTP_" + response.status);

      var gatewayError =
        new Error(message);

      gatewayError.status =
        response.status;

      gatewayError.body =
        body || null;

      gatewayError.code =
        message;

      emit(
        "REDEEM_FAILED",
        {
          status: response.status,
          message: message,
          gateway: GATEWAY_URL
        }
      );

      throw gatewayError;
    }

    /*
     * Gateway user metadata is informational identity context.
     * The gateway session token is the actual Testnet session.
     */
    var user =
      isObject(body.user)
        ? body.user
        : {};

    var receivedSession = {
      token: clean(body.session),

      expires_at:
        body.expires_at || null,

      network:
        TESTNET_NETWORK,

      pi_uid:
        clean(user.uid) || null,

      username:
        clean(user.username) || null,

      wallet_address:
        clean(user.wallet_address) || null
    };

    var saved;

    try {
      saved = saveSession(
        receivedSession
      );
    } catch (error) {
      emit(
        "INVALID_GATEWAY_SESSION",
        {
          message:
            error && error.message
              ? error.message
              : "Gateway returned an invalid session."
        }
      );

      throw error;
    }

    /*
     * Remove the one-time access code from the browser URL
     * immediately after successful redemption.
     */
    removeAccessCodeFromUrl();

    emit(
      "REDEEM_SUCCESS",
      {
        message:
          "Testnet access code redeemed and Testnet session created.",
        username:
          clean(user.username),
        expires_at:
          clean(body.expires_at)
      }
    );

    try {
      window.dispatchEvent(
        new CustomEvent(
          "albukhr:testnet-auth-success",
          {
            detail: {
              session: saved
            }
          }
        )
      );
    } catch (_) {}

    return saved;
  }

  /*
   * ------------------------------------------------------------------
   * Testnet authentication requirement
   * ------------------------------------------------------------------
   */

  async function requireTestnetAuth(options) {
    var opts = options || {};

    if (!isTestnetHost()) {
      emit(
        "INVALID_TESTNET_HOST",
        {
          message:
            "Testnet authentication is running on an invalid host.",
          host: currentHost()
        }
      );

      return null;
    }

    /*
     * First priority:
     * redeem a newly issued one-time access code.
     */
    var code = "";

    try {
      code =
        clean(
          new URLSearchParams(
            window.location.search
          ).get("access_code")
        );
    } catch (_) {
      code = "";
    }

    if (code) {
      try {
        return await redeem(code);
      } catch (error) {
        clearSession();

        emit(
          "AUTH_REQUIRED_AFTER_REDEEM_FAILURE",
          {
            message:
              error && error.message
                ? error.message
                : "Testnet authentication failed."
          }
        );

        if (
          opts.redirectOnFailure === true
        ) {
          window.location.replace(
            MAINNET_LOGIN
          );
        }

        return null;
      }
    }

    /*
     * Second priority:
     * use an existing valid short-lived Testnet session.
     */
    var existing = loadSession();

    if (existing) {
      emit(
        "SESSION_FOUND",
        {
          message:
            "A valid Testnet session already exists.",
          username:
            clean(existing.username),
          expires_at:
            clean(existing.expires_at)
        }
      );

      return existing;
    }

    /*
     * No access code and no valid session.
     */
    emit(
      "SESSION_REQUIRED",
      {
        message:
          "No Testnet session exists. Start from Mainnet Login to obtain a Testnet access code."
      }
    );

    if (
      opts.redirectOnFailure === true
    ) {
      window.location.replace(
        MAINNET_LOGIN
      );
    }

    return null;
  }

  /*
   * ------------------------------------------------------------------
   * Session helpers
   * ------------------------------------------------------------------
   */

  function getSession() {
    return loadSession();
  }

  function getSessionToken() {
    var current =
      loadSession();

    return current
      ? clean(current.token)
      : "";
  }

  function logout() {
    /*
     * The current gateway does not require a server-side logout.
     * Clearing the temporary browser session is therefore sufficient
     * for this client-side Testnet auth layer.
     */
    clearSession();

    emit(
      "LOGGED_OUT",
      {
        message:
          "Temporary Testnet browser session cleared."
      }
    );
  }

  /*
   * ------------------------------------------------------------------
   * Public API
   * ------------------------------------------------------------------
   */

  var api = {
    redeem: redeem,

    requireTestnetAuth:
      requireTestnetAuth,

    getSession:
      getSession,

    getSessionToken:
      getSessionToken,

    logout:
      logout,

    gatewayUrl:
      GATEWAY_URL,

    mainnetLogin:
      MAINNET_LOGIN
  };

  try {
    Object.freeze(api);
  } catch (_) {}

  window.AlbukhrTestnetAuth =
    api;

  emit(
    "AUTH_MODULE_READY",
    {
      message:
        "Testnet gateway authentication module loaded."
    }
  );

})(window, document);
