'use strict';

// Runtime regression test for Testnet pending-stake recovery after page reload.
// Run from the Testnet app repo root:
// node tests/testnet-staking-recovery-client-smoke.js
//
// The API and Pi SDK are mocked. This test makes no network request and never
// starts a real Pi payment.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

async function main() {
  const source = fs.readFileSync('js/testnet-staking-payment-client.js', 'utf8');
  const requests = [];
  let piPaymentLaunches = 0;

  const recoveredRow = {
    id: 'intent-recovered-001',
    project_id: 'project-raheem-25',
    project_code: 'RAHEEM-25',
    amount: 100,
    duration_days: 30,
    reward_rate: 0.05,
    reward_amount: 5,
    payment_id: null,
    status: 'pending_payment',
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    payment_started_at: new Date().toISOString(),
    payment_armed: true
  };

  const window = {
    location: { hostname: 'test.albukhr.com' },
    ALBukhrEnvironment: {
      isKnown() { return true; },
      isTestnet() { return true; },
      getNetwork() { return 'testnet'; },
      getHostname() { return 'test.albukhr.com'; }
    },
    AlbukhrTestnetAuth: {
      async requireTestnetAuth() {
        return { network: 'testnet', user: { uid: 'mock-pi-uid' } };
      },
      getSessionToken() {
        return 'mock-testnet-session';
      }
    },
    Pi: {
      init() { return Promise.resolve(); },
      authenticate() {
        return Promise.resolve({
          accessToken: 'mock-pi-access-token',
          user: { uid: 'mock-pi-uid', username: 'test-owner' }
        });
      },
      createPayment() {
        piPaymentLaunches += 1;
        throw new Error('Pi payment must not launch in this recovery test');
      }
    },
    dispatchEvent() { return true; }
  };

  const context = {
    window,
    fetch: async function mockFetch(url, options) {
      requests.push({ url: String(url), options: options || {} });

      assert.equal(options.method, 'POST');
      assert.equal(options.headers['X-Testnet-Session'], 'mock-testnet-session');
      assert.equal(options.headers.Authorization, undefined);

      const body = JSON.parse(options.body);
      assert.equal(body.projectId, 'project-raheem-25');
      assert.equal(body.projectCode, 'RAHEEM-25');

      return {
        ok: true,
        status: 200,
        async json() {
          return {
            success: true,
            network: 'testnet',
            intent: recoveredRow
          };
        }
      };
    },
    CustomEvent: function CustomEvent(type, init) {
      this.type = type;
      this.detail = init && init.detail;
    },
    console
  };

  vm.runInNewContext(source, context, {
    filename: 'js/testnet-staking-payment-client.js'
  });

  const client = window.AlbukhrTestnetStakingPayment;
  assert.ok(client, 'Testnet staking payment client must initialize');
  assert.equal(client.network, 'testnet');

  const project = {
    id: 'project-raheem-25',
    project_code: 'RAHEEM-25',
    name: 'Raheem Pharmacy'
  };

  const pending = await client.restorePendingStake(project);

  assert.equal(requests.length, 1, 'recovery must make exactly one pending-intent read');
  assert.match(requests[0].url, /\/staking\/pending$/);
  assert.equal(pending.id, 'intent-recovered-001');
  assert.equal(pending.project_id, project.id);
  assert.equal(pending.project_code, project.project_code);
  assert.equal(pending.amount, 100);
  assert.equal(pending.duration_days, 30);
  assert.equal(pending.payment_armed, true);
  assert.equal(pending.payment_launched, true,
    'a recovered armed intent must be considered possibly launched after reload');
  assert.equal(pending.recovered, true);

  assert.throws(
    () => client.payPreparedStake(),
    /PI_PAYMENT_RECONCILIATION_REQUIRED/,
    'a recovered armed intent must require reconciliation instead of a second Pi payment'
  );

  assert.equal(piPaymentLaunches, 0,
    'Pi.createPayment() must not run for an armed intent recovered after reload');

  assert.doesNotMatch(source, /\b(?:localStorage|sessionStorage)\s*\.\s*(?:getItem|setItem|removeItem|clear)\s*\(/,
    'persistent browser storage APIs must not be used for auth or pending intent state');

  console.log(JSON.stringify({
    result: 'PASS',
    recovered_testnet_intent: true,
    project_binding_verified: true,
    armed_intent_marked_as_possibly_launched: true,
    second_pi_payment_blocked: true,
    pi_create_payment_calls: piPaymentLaunches,
    api_calls: requests.length,
    persistent_browser_storage_used: false,
    real_network_request: false
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
