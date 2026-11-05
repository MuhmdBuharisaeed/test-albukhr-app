'use strict';

// ALBUKHR Testnet Risk Admin UI contract smoke test.
// Static checks only: no network calls and no database writes.
const fs = require('node:fs');
const assert = require('node:assert/strict');

const source = fs.readFileSync('js/testnet-project-staking-risk-admin.js', 'utf8');
const html = fs.readFileSync('admin-dashboard.html', 'utf8');

assert.match(source, /var NETWORK = "testnet"/);
assert.match(source, /var HOST = "test\.albukhr\.com"/);
assert.match(source, /window\.ALBukhrEnvironment/);
assert.doesNotMatch(source, /window\.AlbukhrEnvironment/);
assert.match(source, /AUTH\.requireAdmin\(\{\s*redirectOnFailure:\s*false\s*\}\)/);
assert.match(source, /requireSuperAdmin\(session\)/);
assert.match(source, /\/admin\/project-stages/);
assert.match(source, /\/admin\/policy"/);
assert.match(source, /\/admin\/policy\/provision/);
assert.match(source, /\/admin\/policy\/review/);
assert.match(source, /\/admin\/policy\/enablement/);
assert.match(source, /window\.confirm/);
assert.match(source, /function isPendingReview\(status\)/);
assert.match(source, /value === "pending"/);
assert.match(source, /value === "pending_review"/);
assert.match(source, /else if \(isPendingReview\(policy\.approval_status\)\)/);
assert.match(source, /isPendingReview\(status\)/);
assert.match(source, /isPendingReview\(p\.policy\.approval_status\)/);
assert.match(source, /This panel never enables staking/);
assert.doesNotMatch(source, /staking_policy_active\s*=\s*true/);
assert.match(source, /testnet-project-staking-risk-admin\.js\?v=20261104-universal-risk-v1/);

console.log(JSON.stringify({
  checks: 21,
  network: 'testnet',
  role_gate: 'super_admin',
  pending_statuses: ['pending', 'pending_review'],
  review_controls: 'separate from staking enablement',
  cache_busting: 'universal-risk-v1',
  global_staking_activation: false,
  network_calls: false,
  database_writes: false,
  result: 'PASS'
}, null, 2));
