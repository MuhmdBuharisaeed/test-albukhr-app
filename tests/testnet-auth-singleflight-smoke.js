'use strict';

// Runtime regression test for the Testnet browser auth module.
// Run from the Testnet app repo root:
// node tests/testnet-auth-singleflight-smoke.js
// The gateway call is mocked; no network request or real access code is used.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

async function main() {
  const source = fs.readFileSync('js/testnet-gateway-auth.js', 'utf8');
  const storage = new Map();
  const listeners = Object.create(null);
  let currentUrl = new URL('https://test.albukhr.com/project.html?access_code=smoke-test-code&project=RAHEEM-25');
  let fetchCount = 0;
  let releaseFetch;
  const fetchGate = new Promise(resolve => { releaseFetch = resolve; });

  const window = {
    get location() { return currentUrl; },
    set location(value) { currentUrl = value instanceof URL ? value : new URL(String(value), currentUrl); },
    history: {
      replaceState(_state, _title, path) {
        currentUrl = new URL(path, currentUrl);
      }
    },
    dispatchEvent(event) {
      (listeners[event.type] || []).forEach(fn => fn(event));
      return true;
    },
    addEventListener(type, fn) {
      (listeners[type] || (listeners[type] = [])).push(fn);
    }
  };

  const document = {
    readyState: 'loading',
    title: 'ALBUKHR Testnet Smoke Test',
    addEventListener() {}
  };

  const sessionStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); }
  };

  const context = {
    window,
    document,
    sessionStorage,
    URL,
    URLSearchParams,
    CustomEvent: function CustomEvent(type, init) {
      this.type = type;
      this.detail = init && init.detail;
    },
    fetch: async function mockFetch(url, options) {
      fetchCount += 1;
      assert.match(String(url), /testnet-auth-gateway$/);
      assert.equal(options.method, 'POST');
      const requestBody = JSON.parse(options.body);
      assert.equal(requestBody.action, 'redeem');
      assert.equal(requestBody.code, 'smoke-test-code');
      await fetchGate;
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({
            ok: true,
            session: 'mock-testnet-session-token',
            expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            user: {
              uid: 'mock-pi-uid',
              username: 'test-owner',
              wallet_address: 'G' + 'A'.repeat(55),
              network: 'testnet'
            }
          });
        }
      };
    },
    console: { info() {}, warn() {}, error() {} }
  };

  vm.runInNewContext(source, context, { filename: 'js/testnet-gateway-auth.js' });
  const auth = window.AlbukhrTestnetAuth;
  assert.ok(auth, 'Testnet auth module must initialize');

  const first = auth.requireTestnetAuth({ redirectOnFailure: false });
  const second = auth.requireTestnetAuth({ redirectOnFailure: false });

  assert.equal(fetchCount, 1, 'concurrent callers must share a single gateway redemption');
  releaseFetch();

  const sessions = await Promise.all([first, second]);
  assert.equal(fetchCount, 1, 'only one one-time access-code request may be sent');
  assert.ok(sessions[0] && sessions[1], 'both callers must receive the redeemed session');
  assert.equal(sessions[0].token, 'mock-testnet-session-token');
  assert.equal(sessions[1].token, 'mock-testnet-session-token');
  assert.equal(sessions[0].network, 'testnet');
  assert.equal(sessions[1].network, 'testnet');
  assert.equal(currentUrl.searchParams.get('access_code'), null, 'access code must be removed from URL after success');
  assert.equal(currentUrl.searchParams.get('project'), 'RAHEEM-25', 'unrelated project query parameter must be preserved');

  const third = await auth.requireTestnetAuth({ redirectOnFailure: false });
  assert.equal(fetchCount, 1, 'a saved valid session must be reused without another redemption');
  assert.equal(third.token, 'mock-testnet-session-token');

  console.log(JSON.stringify({
    result: 'PASS',
    concurrent_callers: 2,
    gateway_redeem_requests: fetchCount,
    same_testnet_session_returned: true,
    access_code_removed_from_url: true,
    unrelated_query_preserved: true,
    no_real_network_request: true,
    no_pi_payment: true
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
