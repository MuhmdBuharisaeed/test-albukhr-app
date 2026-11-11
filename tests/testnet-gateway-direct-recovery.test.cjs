const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'testnet-gateway-auth.js'),
  'utf8',
);

function makeGateway(options = {}) {
  let currentUrl = new URL(options.href || 'https://test.albukhr.com/index.html');
  const redirects = [];
  const storage = new Map();
  const events = [];
  let fetchCall = null;

  const location = {
    get href() { return currentUrl.toString(); },
    get hostname() { return currentUrl.hostname; },
    get search() { return currentUrl.search; },
    get pathname() { return currentUrl.pathname; },
    replace(value) { redirects.push(String(value)); },
  };
  const sessionStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); },
  };
  const window = {
    location,
    sessionStorage,
    history: {
      replaceState(_state, _title, value) {
        currentUrl = new URL(String(value), currentUrl);
      },
    },
    dispatchEvent(event) { events.push(event); return true; },
  };
  const context = {
    window,
    document: { title: 'ALBUKHR Testnet', },
    sessionStorage,
    console: { info() {}, warn() {}, error() {}, debug() {} },
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    URL,
    URLSearchParams,
    Array,
    Object,
    Date,
    Number,
    String,
    Promise,
    Error,
    fetch: async (url, init) => {
      fetchCall = { url: String(url), init };
      if (options.fetchResponse) return options.fetchResponse;
      return new Response(JSON.stringify({ ok: false, error: 'ACCESS_CODE_USED' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  };
  context.globalThis = context;
  vm.runInNewContext(source, context, { timeout: 3000 });
  return {
    api: window.AlbukhrTestnetAuth,
    redirects,
    storage,
    events,
    get currentUrl() { return currentUrl; },
    get fetchCall() { return fetchCall; },
    location,
  };
}

test('missing Testnet session redirects to same-origin Testnet login, not Mainnet', async () => {
  const app = makeGateway({
    href: 'https://test.albukhr.com/project-owner.html?project_id=p-123&token=should-not-leak#owner',
  });
  const result = await app.api.requireTestnetAuth({ redirectOnFailure: true });
  assert.equal(result, null);
  assert.equal(app.redirects.length, 1);
  const destination = new URL(app.redirects[0]);
  assert.equal(destination.origin, 'https://test.albukhr.com');
  assert.equal(destination.pathname, '/login.html');
  assert.equal(destination.searchParams.get('returnTo'), '/project-owner.html?project_id=p-123#owner');
  assert.equal(destination.searchParams.has('token'), false);
  assert.equal(app.redirects[0].includes('app.albukhr.com'), false);
});

test('redirectOnFailure false remains passive and does not navigate', async () => {
  const app = makeGateway();
  const result = await app.api.requireTestnetAuth({ redirectOnFailure: false });
  assert.equal(result, null);
  assert.equal(app.redirects.length, 0);
});

test('valid existing Testnet session is returned without any redirect', async () => {
  const app = makeGateway();
  app.storage.set('albukhr_testnet_session_v6', JSON.stringify({
    token: 'testnet-session-token',
    network: 'testnet',
    pi_uid: 'sandbox-uid',
    username: 'testuser',
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  }));
  const result = await app.api.requireTestnetAuth({ redirectOnFailure: true });
  assert.equal(result.token, 'testnet-session-token');
  assert.equal(result.network, 'testnet');
  assert.equal(app.redirects.length, 0);
});

test('optional Mainnet handoff access code is still redeemed by the existing gateway', async () => {
  const app = makeGateway({
    href: 'https://test.albukhr.com/index.html?access_code=one-time-access-code',
    fetchResponse: new Response(JSON.stringify({
      ok: true,
      session: 'redeemed-testnet-session',
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      user: { uid: 'canonical-testnet-uid', username: 'testuser', network: 'testnet' },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  });
  const result = await app.api.requireTestnetAuth({ redirectOnFailure: true });
  assert.equal(result.token, 'redeemed-testnet-session');
  assert.equal(result.pi_uid, 'canonical-testnet-uid');
  assert.equal(app.fetchCall.url, 'https://vhvkwvngmrlgyzwemttt.supabase.co/functions/v1/testnet-auth-gateway');
  assert.equal(app.fetchCall.init.headers['Content-Type'], 'text/plain;charset=UTF-8');
  assert.deepEqual(JSON.parse(app.fetchCall.init.body), {
    action: 'redeem',
    code: 'one-time-access-code',
  });
  assert.equal(app.redirects.length, 0);
  assert.equal(app.currentUrl.searchParams.has('access_code'), false);
});

test('failed or expired Mainnet handoff code falls back to direct Testnet login', async () => {
  const app = makeGateway({
    href: 'https://test.albukhr.com/investor.html?access_code=expired-code&tab=portfolio',
  });
  const result = await app.api.requireTestnetAuth({ redirectOnFailure: true });
  assert.equal(result, null);
  assert.equal(app.redirects.length, 1);
  const destination = new URL(app.redirects[0]);
  assert.equal(destination.origin, 'https://test.albukhr.com');
  assert.equal(destination.pathname, '/login.html');
  assert.equal(destination.searchParams.get('returnTo'), '/investor.html?tab=portfolio');
  assert.equal(app.redirects[0].includes('expired-code'), false);
  assert.equal(app.redirects[0].includes('app.albukhr.com'), false);
});

test('the optional Mainnet login URL remains available to explicit switch/navigation flows', async () => {
  const app = makeGateway();
  assert.equal(app.api.mainnetLogin, 'https://app.albukhr.com/login.html?returnTo=testnet');
  const direct = new URL(app.api.buildTestnetLoginUrl());
  assert.equal(direct.origin, 'https://test.albukhr.com');
  assert.equal(direct.pathname, '/login.html');
});

test('a non-Testnet host is not redirected to either authentication flow', async () => {
  const app = makeGateway({ href: 'https://app.albukhr.com/index.html' });
  const result = await app.api.requireTestnetAuth({ redirectOnFailure: true });
  assert.equal(result, null);
  assert.equal(app.redirects.length, 0);
});
