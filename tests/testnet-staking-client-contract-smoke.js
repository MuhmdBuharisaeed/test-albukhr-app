'use strict';

// Read-only source-contract regression test. Run from the Testnet app repo root:
// node tests/testnet-staking-client-contract-smoke.js
const fs = require('node:fs');
const assert = require('node:assert/strict');

const ui = fs.readFileSync('js/testnet-staking.js', 'utf8');
const client = fs.readFileSync('js/testnet-staking-payment-client.js', 'utf8');

const requiredMethods = [
  'getOffers',
  'prepareStake',
  'armPreparedStake',
  'payPreparedStake',
  'cancelPreparedStake',
  'getPendingIntent'
];

const getClientMatch = ui.match(/function getClient\(\)\s*\{[\s\S]*?\n  \}/);
assert.ok(getClientMatch, 'getClient() must exist in the staking UI');
const getClientSource = getClientMatch[0];

for (const method of requiredMethods) {
  assert.match(
    client,
    new RegExp('^\\s*' + method + '\\s*:', 'm'),
    'payment client must export ' + method
  );
  assert.ok(
    getClientSource.includes('"' + method + '"'),
    'getClient() must validate the exported method ' + method
  );
}

assert.doesNotMatch(
  getClientSource,
  /createStake/,
  'getClient() must not require the non-existent createStake() method'
);

assert.match(ui, /client\.prepareStake\(project, amount, Number\(term\.duration_days\)\)/);
assert.match(ui, /client\.armPreparedStake\(\)/);
assert.match(ui, /client\.payPreparedStake\(\)/);
assert.match(ui, /client\.cancelPreparedStake\(\)/);
assert.match(ui, /client\.getPendingIntent\(\)/);

console.log(JSON.stringify({
  result: 'PASS',
  required_methods: requiredMethods,
  obsolete_createStake_requirement: false,
  network_calls: false,
  database_writes: false,
  payment_launched: false
}, null, 2));
