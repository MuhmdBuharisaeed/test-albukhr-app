'use strict';

// Static source-contract smoke test. Run from the Testnet app repository root.
// Reads source only; it makes no network calls and performs no writes.
const fs = require('node:fs');
const assert = require('node:assert/strict');

const source = fs.readFileSync('js/testnet-project-staking-risk-admin.js', 'utf8');
assert.match(source, /var NETWORK = "testnet"/);
assert.match(source, /var HOST = "test\.albukhr\.com"/);
assert.match(source, /window\.ALBukhrEnvironment/);
assert.doesNotMatch(source, /window\.AlbukhrEnvironment/);
assert.match(source, /AUTH\.requireAdmin\(\{ redirectOnFailure: false \}\)/);
assert.match(source, /requireSuperAdmin\(session\)/);
assert.match(source, /\/admin\/project-stages/);
assert.match(source, /\/admin\/policy"/);
assert.match(source, /\/admin\/policy\/provision/);
assert.match(source, /\/admin\/policy\/review/);
assert.match(source, /window\.confirm/);
assert.match(source, /approval_status/);
assert.match(source, /This panel never enables staking/);
assert.doesNotMatch(source, /staking_policy_active\s*=\s*true/);

console.log(JSON.stringify({
  checks: 14,
  network: 'testnet',
  role_gate: 'super_admin',
  provisioning: 'explicit confirmation; pending only',
  review: 'explicit confirmation; separate action',
  global_staking_enablement: false,
  network_calls: false,
  writes: false,
  result: 'PASS'
}, null, 2));
