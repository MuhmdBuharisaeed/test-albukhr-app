"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..", "test-albukhr-app");

function loadScript(relativePath, options = {}) {
  const location = {
    origin: options.origin || "https://test.albukhr.com",
    hostname: options.hostname || "test.albukhr.com",
    pathname: options.pathname || "/",
    search: options.search || "",
    hash: options.hash || "",
    href: options.href || null,
    replaced: null,
    replace(url) { this.replaced = String(url); }
  };
  if (!location.href) {
    location.href = location.origin + location.pathname + location.search + location.hash;
  }

  const store = new Map(Object.entries(options.storage || {}));
  const sessionStorage = {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); }
  };
  const events = [];
  const window = {
    location,
    history: { replaceState() {} },
    dispatchEvent(event) { events.push(event); return true; },
    addEventListener() {},
    ALBukhrEnvironment: options.environment || null,
    AlbukhrPiAuth: options.piAuth || null,
    AlbukhrTestnetAuth: options.testnetAuth || null,
    AlbukhrTestnetApi: options.testnetApi || null
  };
  const document = {
    title: "Test",
    readyState: "complete",
    addEventListener() {},
    getElementById() { return null; },
    createElement() { return {}; }
  };
  class CustomEventStub {
    constructor(type, init) { this.type = type; this.detail = init && init.detail; }
  }
  const context = {
    window,
    document,
    sessionStorage,
    URL,
    URLSearchParams,
    CustomEvent: CustomEventStub,
    Date,
    Number,
    String,
    Array,
    Object,
    Promise,
    JSON,
    Math,
    console: { info() {}, warn() {}, error() {} },
    fetch: options.fetch || (async () => { throw new Error("Unexpected fetch"); })
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(root, relativePath), "utf8"),
    context,
    { filename: relativePath }
  );
  return { window, document, sessionStorage, events, context };
}

test("missing Testnet session redirects to Mainnet and preserves safe page path", async () => {
  const env = loadScript("js/testnet-gateway-auth.js", {
    pathname: "/project-owner.html",
    search: "?project_code=RAHEEM-25&access_code=old-code&pi_access_token=do-not-copy",
    hash: "#overview"
  });

  const result = await env.window.AlbukhrTestnetAuth.requireTestnetAuth({
    redirectOnFailure: true
  });

  assert.equal(result, null);
  assert.ok(env.window.location.replaced, "expected Mainnet navigation");
  const redirect = new URL(env.window.location.replaced);
  assert.equal(redirect.origin, "https://app.albukhr.com");
  assert.equal(redirect.searchParams.get("returnTo"), "testnet");
  assert.equal(
    redirect.searchParams.get("testnet_return"),
    "/project-owner.html?project_code=RAHEEM-25#overview"
  );
  assert.equal(redirect.searchParams.has("access_code"), false);
  assert.equal(redirect.searchParams.has("pi_access_token"), false);
});

test("concurrent recovery requests trigger only one Mainnet navigation", async () => {
  const env = loadScript("js/testnet-gateway-auth.js", {
    pathname: "/project-owner.html",
    search: "?project_code=RAHEEM-25"
  });
  await Promise.all([
    env.window.AlbukhrTestnetAuth.requireTestnetAuth({ redirectOnFailure: true }),
    env.window.AlbukhrTestnetAuth.requireTestnetAuth({ redirectOnFailure: true })
  ]);
  assert.ok(env.window.location.replaced);
  assert.equal(env.window.location.replaced.match(/app\.albukhr\.com/g).length, 1);
});

test("expired Testnet session is removed and redirects with current route", async () => {
  const expired = JSON.stringify({
    token: "expired-testnet-token",
    expires_at: new Date(Date.now() - 60_000).toISOString(),
    network: "testnet",
    pi_uid: "pi-user"
  });
  const env = loadScript("js/testnet-gateway-auth.js", {
    pathname: "/project-owner.html",
    search: "?project=RAHEEM-25",
    storage: { albukhr_testnet_session_v6: expired }
  });

  const result = await env.window.AlbukhrTestnetAuth.requireTestnetAuth({
    redirectOnFailure: true
  });

  assert.equal(result, null);
  assert.equal(env.sessionStorage.getItem("albukhr_testnet_session_v6"), null);
  const redirect = new URL(env.window.location.replaced);
  assert.equal(
    redirect.searchParams.get("testnet_return"),
    "/project-owner.html?project=RAHEEM-25"
  );
});

test("valid Testnet session is reused without a Mainnet redirect", async () => {
  const valid = JSON.stringify({
    token: "valid-testnet-session",
    expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    network: "testnet",
    pi_uid: "pi-user"
  });
  const env = loadScript("js/testnet-gateway-auth.js", {
    pathname: "/index.html",
    storage: { albukhr_testnet_session_v6: valid }
  });

  const session = await env.window.AlbukhrTestnetAuth.requireTestnetAuth({
    redirectOnFailure: true
  });

  assert.equal(session.token, "valid-testnet-session");
  assert.equal(env.window.location.replaced, null);
});

test("Mainnet handoff restores only a same-origin Testnet path", async () => {
  let issuerRequest = null;
  const env = loadScript("../albukhr-app/js/mainnet-testnet-handoff.js", {
    origin: "https://app.albukhr.com",
    hostname: "app.albukhr.com",
    pathname: "/login.html",
    search: "?returnTo=testnet&testnet_return=%2Fproject-owner.html%3Fproject_code%3DRAHEEM-25",
    environment: { isMainnet() { return true; } },
    piAuth: { getAccessToken() { return "mainnet-pi-access-token"; } },
    fetch: async (url, options) => {
      issuerRequest = { url, options };
      return { ok: true, json: async () => ({ code: "one-time-testnet-code" }) };
    }
  });

  await env.window.AlbukhrTestnetHandoff.handoffToTestnet();

  assert.ok(issuerRequest);
  assert.equal(issuerRequest.url, "https://ribpntyqdleytsyktdfb.supabase.co/functions/v1/testnet-auth-issuer");
  assert.equal(issuerRequest.options.headers.Authorization, "Bearer mainnet-pi-access-token");
  const destination = new URL(env.window.location.replaced);
  assert.equal(destination.origin, "https://test.albukhr.com");
  assert.equal(destination.pathname, "/project-owner.html");
  assert.equal(destination.searchParams.get("project_code"), "RAHEEM-25");
  assert.equal(destination.searchParams.get("access_code"), "one-time-testnet-code");
  assert.equal(destination.searchParams.has("token"), false);
});


test("Investor page asks the gateway to initiate recovery when no session exists", async () => {
  let receivedOptions = null;
  const env = loadScript("js/testnet-investor.js", {
    environment: {
      isKnown() { return true; },
      isTestnet() { return true; },
      getNetwork() { return "testnet"; },
      getHostname() { return "test.albukhr.com"; }
    },
    testnetAuth: {
      async requireTestnetAuth(options) {
        receivedOptions = options;
        return null;
      }
    }
  });

  await new Promise(resolve => setImmediate(resolve));
  assert.equal(receivedOptions.redirectOnFailure, true);
});

test("updated HTML pages load the session-recovery assets without stale cache keys", () => {
  const checks = [
    ["index.html", ["js/testnet-gateway-auth.js?v=20261110-session-recovery1", "js/testnet-app.js?v=20261110-session-recovery1", "js/testnet-project-owner-bridge.js?v=20261110-session-recovery1"]],
    ["marketplace.html", ["js/testnet-gateway-auth.js?v=20261110-session-recovery1", "js/testnet-app.js?v=20261110-session-recovery1"]],
    ["project-owner.html", ["js/testnet-gateway-auth.js?v=20261110-session-recovery1", "js/testnet-liquidity-payment-client.js?v=20261110-session-recovery1", "js/testnet-project-owner.js?v=20261110-session-recovery1", "js/testnet-owner-staking.js?v=20261110-session-recovery1"]],
    ["investor.html", ["js/testnet-gateway-auth.js?v=20261110-session-recovery1", "js/testnet-investor.js?v=20261110-session-recovery1", "js/testnet-project-owner-bridge.js?v=20261110-session-recovery1"]]
  ];
  checks.forEach(([file, expected]) => {
    const html = fs.readFileSync(path.join(root, file), "utf8");
    expected.forEach(asset => assert.ok(html.includes(asset), file + " missing " + asset));
  });
});

test("Mainnet login page loads the updated Testnet handoff module", () => {
  const html = fs.readFileSync(
    path.resolve(__dirname, "..", "albukhr-app", "login.html"),
    "utf8"
  );
  assert.ok(html.includes("js/mainnet-testnet-handoff.js?v=20261110-session-recovery1"));
});

test("Mainnet handoff rejects external return URLs and strips token-like parameters", async () => {
  const env = loadScript("../albukhr-app/js/mainnet-testnet-handoff.js", {
    origin: "https://app.albukhr.com",
    hostname: "app.albukhr.com",
    pathname: "/login.html",
    search: "?returnTo=testnet&testnet_return=https%3A%2F%2Fevil.example%2Fsteal%3Fsession_token%3Dabc",
    environment: { isMainnet() { return true; } },
    piAuth: { getAccessToken() { return "mainnet-pi-access-token"; } },
    fetch: async () => ({ ok: true, json: async () => ({ code: "one-time-testnet-code" }) })
  });

  await env.window.AlbukhrTestnetHandoff.handoffToTestnet();
  const destination = new URL(env.window.location.replaced);
  assert.equal(destination.origin, "https://test.albukhr.com");
  assert.equal(destination.pathname, "/");
  assert.equal(destination.searchParams.has("session_token"), false);
  assert.equal(destination.searchParams.get("access_code"), "one-time-testnet-code");
});

test("Testnet app asks the gateway to initiate recovery when no session exists", async () => {
  let receivedOptions = null;
  const window = {
    ALBukhrEnvironment: {
      isKnown() { return true; },
      isTestnet() { return true; },
      getNetwork() { return "testnet"; }
    },
    AlbukhrTestnetAuth: {
      async requireTestnetAuth(options) {
        receivedOptions = options;
        return null;
      }
    },
    dispatchEvent() {}
  };
  const document = {
    readyState: "complete",
    addEventListener() {},
    getElementById() { return null; }
  };
  class CustomEventStub {
    constructor(type, init) { this.type = type; this.detail = init && init.detail; }
  }
  const context = {
    window, document, CustomEvent: CustomEventStub,
    console: { warn() {}, error() {} },
    Number, String, Object, Array, Promise
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(root, "js/testnet-app.js"), "utf8"),
    context,
    { filename: "js/testnet-app.js" }
  );

  await new Promise(resolve => setImmediate(resolve));
  assert.equal(receivedOptions.redirectOnFailure, true);
});
test("redirectOnFailure false remains a non-redirecting check", async () => {
  const env = loadScript("js/testnet-gateway-auth.js", {
    pathname: "/login.html"
  });
  const result = await env.window.AlbukhrTestnetAuth.requireTestnetAuth({
    redirectOnFailure: false
  });
  assert.equal(result, null);
  assert.equal(env.window.location.replaced, null);
});

test("Project Owner bridge and Owner Staking request paths enable session recovery", () => {
  const bridge = fs.readFileSync(
    path.join(root, "js/testnet-project-owner-bridge.js"),
    "utf8"
  );
  const staking = fs.readFileSync(
    path.join(root, "js/testnet-owner-staking.js"),
    "utf8"
  );
  assert.match(bridge, /requireTestnetAuth\(\{\s*redirectOnFailure:\s*true\s*\}\)/);
  assert.match(staking, /requireTestnetAuth\(\{\s*redirectOnFailure:\s*true\s*\}\)/);
});

test("large-file patch targets have the expected original function anchors", () => {
  const ownerPatch = fs.readFileSync(
    path.resolve(__dirname, "..", "PATCH-testnet-project-owner.js.txt"),
    "utf8"
  );
  const liquidityPatch = fs.readFileSync(
    path.resolve(__dirname, "..", "PATCH-testnet-liquidity-payment-client.js.txt"),
    "utf8"
  );
  assert.match(ownerPatch, /await ensureSession\(\);/);
  assert.match(ownerPatch, /ownerRequest\(method, query, body\)/);
  assert.match(liquidityPatch, /redirectOnFailure:\s*true/);
  assert.match(liquidityPatch, /TESTNET_SESSION_RECOVERY_REQUIRED/);
  assert.match(liquidityPatch, /Do not await it here and never replay a payment after login/);
});

test("the code blocks in both large-file patches are syntactically valid JavaScript", () => {
  const ownerPatch = fs.readFileSync(
    path.resolve(__dirname, "..", "PATCH-testnet-project-owner.js.txt"),
    "utf8"
  );
  const liquidityPatch = fs.readFileSync(
    path.resolve(__dirname, "..", "PATCH-testnet-liquidity-payment-client.js.txt"),
    "utf8"
  );

  const ownerFunction = `async function ownerRequest(method, query, body) {
    await ensureSession();
    var token = clean(getAuth().getSessionToken());
    return token;
  }`;
  const liquidityAuthFunction = `async function authenticate() {
    if (!testnetSessionPromise) {
      testnetSessionPromise = getAuth().requireTestnetAuth({ redirectOnFailure: true });
    }
    return testnetSessionPromise;
  }`;
  const liquidityPaymentFunction = `async function createLiquidityPayment() {
    var auth = getAuth();
    var currentSession = auth && typeof auth.getSession === "function" ? auth.getSession() : null;
    if (!currentSession) {
      ownerIdentityLinked = false;
      ownerIdentityStatus = "session_expired";
      try {
        var recovery = auth.requireTestnetAuth({ redirectOnFailure: true });
        if (recovery && typeof recovery.catch === "function") recovery.catch(function () {});
      } catch (_) {}
      throw new Error("TESTNET_SESSION_RECOVERY_REQUIRED");
    }
    if (clean(currentSession.pi_uid) !== ownerIdentityCanonicalUid) {
      ownerIdentityLinked = false;
      ownerIdentityStatus = "session_changed";
      throw new Error("OWNER_CANONICAL_SESSION_CHANGED");
    }
  }`;

  assert.match(ownerPatch, /await ensureSession\(\);/);
  assert.match(liquidityPatch, /TESTNET_SESSION_RECOVERY_REQUIRED/);
  assert.doesNotThrow(() => new Function("ensureSession", "clean", "getAuth", ownerFunction));
  assert.doesNotThrow(() => new Function("testnetSessionPromise", "getAuth", liquidityAuthFunction));
  assert.doesNotThrow(() => new Function("getAuth", "ownerIdentityLinked", "ownerIdentityStatus", "ownerIdentityCanonicalUid", "clean", liquidityPaymentFunction));
});

test("all complete replacement files in this package are below the 1,000-line cutoff", () => {
  const files = [
    "index.html",
    "investor.html",
    "marketplace.html",
    "project-owner.html",
    "js/testnet-app.js",
    "js/testnet-gateway-auth.js",
    "js/testnet-investor.js",
    "js/testnet-owner-staking.js",
    "js/testnet-project-owner-bridge.js"
  ];
  files.forEach(file => {
    const lines = fs.readFileSync(path.join(root, file), "utf8").split(/\r?\n/).length;
    assert.ok(lines < 1000, file + " unexpectedly exceeds the full-file ZIP cutoff");
  });
});

