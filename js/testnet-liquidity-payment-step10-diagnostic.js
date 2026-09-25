/* ALBUKHR TESTNET PAYMENT STEP 10 — DIRECT BRIDGE DIAGNOSTIC */
(function (window, document) {
  "use strict";

  var statusNode;
  var logNode;
  var events = [];
  var started = Date.now();

  function clean(v) {
    return String(v == null ? "" : v).trim();
  }

  function errorInfo(e) {
    return {
      name: clean(e && e.name) || "Error",
      message: clean(e && e.message) || "Unknown error"
    };
  }

  function log(stage, detail) {
    var row = {
      ms: Date.now() - started,
      stage: stage,
      detail: detail || {}
    };

    events.push(row);
    console.info("[ALBUKHR STEP 10]", row);

    if (statusNode) statusNode.textContent = stage;

    if (logNode) {
      logNode.textContent = events.map(function (x) {
        var d = "";
        try { d = JSON.stringify(x.detail); } catch (_) {}
        return "[" + x.ms + "ms] " + x.stage +
          (d && d !== "{}" ? " " + d : "");
      }).join("\n");
    }
  }

  function makeButton(label, handler) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.cssText =
      "display:block;width:100%;margin:8px 0;padding:14px;" +
      "border:0;border-radius:10px;background:#0f7a3d;color:#fff;" +
      "font-weight:700;";
    b.addEventListener("click", handler);
    return b;
  }

  function getPi() {
    if (!window.Pi) throw new Error("WINDOW_PI_MISSING");
    if (typeof Pi.init !== "function") throw new Error("PI_INIT_MISSING");
    if (typeof Pi.authenticate !== "function") {
      throw new Error("PI_AUTHENTICATE_MISSING");
    }
    if (typeof Pi.createPayment !== "function") {
      throw new Error("PI_CREATE_PAYMENT_MISSING");
    }
    return Pi;
  }

  function build() {
    var box = document.createElement("section");
    box.style.cssText =
      "margin:16px;padding:16px;border:1px solid #cfe5d8;" +
      "border-radius:14px;background:#f8fcfa;font-family:system-ui,sans-serif;";

    var h = document.createElement("h2");
    h.textContent = "Pi Bridge Step 10";
    h.style.margin = "0 0 8px";

    var p = document.createElement("p");
    p.textContent =
      "Diagnostic only. No payment is created and no access token is displayed.";
    p.style.fontSize = "13px";

    statusNode = document.createElement("div");
    statusNode.style.cssText =
      "padding:10px;background:#fff;border-radius:8px;font-weight:700;";
    statusNode.textContent = "Ready";

    logNode = document.createElement("pre");
    logNode.style.cssText =
      "white-space:pre-wrap;max-height:300px;overflow:auto;" +
      "padding:10px;background:#111;color:#d7f7e2;font-size:11px;";

    box.appendChild(h);
    box.appendChild(p);
    box.appendChild(statusNode);
    box.appendChild(makeButton("1. Initialize Pi", init));
    box.appendChild(makeButton("2. Direct Pi Authenticate", directAuth));
    box.appendChild(makeButton("3. ALBUKHR Client Authenticate", clientAuth));
    box.appendChild(logNode);

    document.body.appendChild(box);
    log("STEP10_READY");
  }

  function init() {
    try {
      log("PI_CHECK_START", {
        hostname: window.location.hostname,
        origin: window.location.origin,
        piPresent: !!window.Pi
      });

      var sdk = getPi();

      sdk.init({
        version: "2.0",
        sandbox: false
      });

      log("PI_INIT_RETURNED", {
        version: "2.0",
        sandbox: false
      });
    } catch (e) {
      log("PI_INIT_ERROR", errorInfo(e));
    }
  }

  async function directAuth() {
    try {
      log("DIRECT_AUTH_CALLED");

      var sdk = getPi();

      sdk.init({
        version: "2.0",
        sandbox: false
      });

      log("DIRECT_AUTH_INIT_RETURNED");

      var result = await sdk.authenticate(
        ["username", "payments"],
        function (payment) {
          log("INCOMPLETE_PAYMENT_FOUND", {
            present: !!payment
          });
        }
      );

      log("DIRECT_AUTH_RESOLVED", {
        userPresent: !!(result && result.user),
        uidPresent: !!(result && result.user && result.user.uid),
        usernamePresent: !!(result && result.user && result.user.username),
        accessTokenPresent: !!(result && result.accessToken)
      });
    } catch (e) {
      log("DIRECT_AUTH_ERROR", errorInfo(e));
    }
  }

  async function clientAuth() {
    try {
      log("CLIENT_AUTH_CALLED");

      var client = window.AlbukhrTestnetLiquidityPayment;

      if (!client || typeof client.authenticate !== "function") {
        throw new Error("LIQUIDITY_PAYMENT_CLIENT_UNAVAILABLE");
      }

      var result = await client.authenticate();

      log("CLIENT_AUTH_RESOLVED", {
        userPresent: !!(result && result.user),
        uidPresent: !!(result && result.user && result.user.uid)
      });
    } catch (e) {
      log("CLIENT_AUTH_ERROR", errorInfo(e));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build, { once: true });
  } else {
    build();
  }
})(window, document);
