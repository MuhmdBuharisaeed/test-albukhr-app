const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const loginSource = fs.readFileSync(
  path.join(ROOT, "test-albukhr-app", "js", "login.js"),
  "utf8"
);
const patchSource = fs.readFileSync(
  path.join(ROOT, "PATCH-testnet-liquidity-payment-client.js.txt"),
  "utf8"
);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeLoginContext(options = {}) {
  const status = { textContent: "" };
  const title = { textContent: "" };
  const ownerNotice = { hidden: true, style: {} };
  const loginButton = {
    disabled: false,
    setAttribute() {},
    addEventListener(_name, handler) {
      this.handler = handler;
    },
    querySelector() {
      return null;
    }
  };

  const elements = {
    status,
    loginTitle: title,
    ownerLoginNotice: ownerNotice,
    testnetLoginButton: loginButton
  };

  const stored = new Map();
  const events = [];
  const location = {
    search: "",
    origin: "https://test.albukhr.com",
    replace(value) {
      this.replacedWith = value;
    }
  };

  const win = {
    location,
    sessionStorage: {
      setItem(key, value) {
        stored.set(key, value);
      }
    },
    setTimeout(callback) {
      return setTimeout(callback, 5);
    },
    clearTimeout,
    dispatchEvent(event) {
      events.push(event);
    },
    Pi: {
      init: options.init,
      authenticate: options.authenticate || (async () => ({
        accessToken: "sandbox-access-token",
        user: { uid: "sandbox-uid", username: "sandbox-user" }
      }))
    }
  };

  const document = {
    readyState: "complete",
    getElementById(id) {
      return elements[id] || null;
    },
    addEventListener() {}
  };

  const context = {
    window: win,
    document,
    URL,
    URLSearchParams,
    Promise,
    Error,
    String,
    Object,
    console: {
      warn() {},
      error() {},
      info() {}
    },
    fetch: options.fetch || (async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        session: "testnet-session-token",
        expires_at: "2099-01-01T00:00:00.000Z",
        user: {
          uid: "sandbox-uid",
          username: "sandbox-user",
          wallet_address: null
        }
      })
    }))
  };

  vm.runInNewContext(loginSource, context, {
    filename: "js/login.js"
  });

  return {
    window: win,
    status,
    stored,
    events,
    location
  };
}

function extractPaymentInitializer() {
  const match = patchSource.match(
    /--- REPLACEMENT FUNCTION BEGIN ---\s*([\s\S]*?)\s*--- REPLACEMENT FUNCTION END ---/
  );
  assert.ok(match, "payment initializer replacement must exist");
  return match[1];
}

function makePaymentInitializer(piInit) {
  const events = [];
  const pi = {
    init: piInit,
    authenticate() {},
    createPayment() {}
  };

  const context = {
    Promise,
    Error,
    String,
    Object,
    PI_SDK_VERSION: "2.0",
    PI_SANDBOX: true,
    initialized: false,
    initializationPromise: null,
    clean(value) {
      return String(value == null ? "" : value).trim();
    },
    dispatch(name, detail) {
      events.push({ name, detail: detail || {} });
    },
    validateEnvironment() {},
    requirePiSdk() {
      return pi;
    },
    withAuthTimeout(promise, _milliseconds, errorCode) {
      return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new Error(errorCode));
        }, 5);

        Promise.resolve(promise).then(
          (value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(value);
          },
          (error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(error);
          }
        );
      });
    }
  };

  const initializer = extractPaymentInitializer();
  vm.runInNewContext(
    initializer + "\nthis.initializePiSdk = initializePiSdk;",
    context,
    { filename: "testnet-liquidity-initializePiSdk.js" }
  );

  return { context, events, pi, init: context.initializePiSdk };
}

test("Testnet direct login does not call Pi.init twice after a caller timeout", async () => {
  const initDeferred = deferred();
  let initCalls = 0;
  let authenticateCalls = 0;

  const fixture = makeLoginContext({
    init() {
      initCalls += 1;
      return initDeferred.promise;
    },
    authenticate: async () => {
      authenticateCalls += 1;
      return {
        accessToken: "sandbox-access-token",
        user: { uid: "sandbox-uid", username: "sandbox-user" }
      };
    }
  });

  await fixture.window.AlbukhrTestnetLogin.start();
  assert.equal(initCalls, 1);
  assert.match(fixture.status.textContent, /Reload the Testnet page/i);

  await fixture.window.AlbukhrTestnetLogin.start();
  assert.equal(initCalls, 1, "a second click must share the still-pending Pi.init promise");

  initDeferred.resolve();
  await delay(0);

  await fixture.window.AlbukhrTestnetLogin.start();

  assert.equal(initCalls, 1, "late completion must be reused, not reinitialized");
  assert.equal(authenticateCalls, 1);
  assert.ok(fixture.stored.has("albukhr_testnet_session_v6"));
  assert.equal(fixture.location.replacedWith, "/index.html");
});

test("Testnet direct login permits retry after Pi.init genuinely rejects", async () => {
  let initCalls = 0;
  const fixture = makeLoginContext({
    init() {
      initCalls += 1;
      if (initCalls === 1) return Promise.reject(new Error("PI_BRIDGE_REJECTED"));
      return Promise.resolve();
    }
  });

  await fixture.window.AlbukhrTestnetLogin.start();
  assert.equal(initCalls, 1);
  assert.match(fixture.status.textContent, /PI_BRIDGE_REJECTED/);

  await fixture.window.AlbukhrTestnetLogin.start();
  assert.equal(initCalls, 2);
  assert.ok(fixture.stored.has("albukhr_testnet_session_v6"));
});

test("Project Owner Pi initializer shares a pending Pi.init after timeout", async () => {
  const initDeferred = deferred();
  let initCalls = 0;
  const fixture = makePaymentInitializer(() => {
    initCalls += 1;
    return initDeferred.promise;
  });

  await assert.rejects(fixture.init(), /PI_SDK_INIT_TIMEOUT/);
  assert.equal(initCalls, 1);

  await assert.rejects(fixture.init(), /PI_SDK_INIT_TIMEOUT/);
  assert.equal(initCalls, 1, "timeout must not clear the unresolved SDK promise");

  initDeferred.resolve();
  await delay(0);

  const readyPi = await fixture.init();
  assert.equal(readyPi, fixture.pi);
  assert.equal(initCalls, 1);
  assert.equal(fixture.context.initialized, true);
  assert.ok(fixture.events.some((event) => event.name === "albukhr:testnet-liquidity-pi-initialized"));
});

test("Project Owner Pi initializer allows retry after a genuine SDK rejection", async () => {
  let initCalls = 0;
  const fixture = makePaymentInitializer(() => {
    initCalls += 1;
    if (initCalls === 1) return Promise.reject(new Error("PI_BRIDGE_REJECTED"));
    return Promise.resolve();
  });

  await assert.rejects(fixture.init(), /PI_BRIDGE_REJECTED/);
  assert.equal(initCalls, 1);
  assert.equal(fixture.context.initializationPromise, null);

  const readyPi = await fixture.init();
  assert.equal(readyPi, fixture.pi);
  assert.equal(initCalls, 2);
});

test("HTML pages reference the new Pi initialization cache keys", () => {
  const loginHtml = fs.readFileSync(
    path.join(ROOT, "test-albukhr-app", "login.html"),
    "utf8"
  );
  const ownerHtml = fs.readFileSync(
    path.join(ROOT, "test-albukhr-app", "project-owner.html"),
    "utf8"
  );

  assert.match(loginHtml, /js\/login\.js\?v=20261110-pi-init-singleflight1/);
  assert.match(ownerHtml, /js\/testnet-liquidity-payment-client\.js\?v=20261110-pi-init-singleflight1/);
});

test("patch preserves Testnet sandbox mode and never changes payment callbacks", () => {
  assert.match(patchSource, /sandbox: PI_SANDBOX/);
  assert.match(patchSource, /var pi = await initializePiSdk\(\);/);
  assert.match(patchSource, /DO NOT CHANGE:[\s\S]*Pi\.createPayment\(\)/);
});
