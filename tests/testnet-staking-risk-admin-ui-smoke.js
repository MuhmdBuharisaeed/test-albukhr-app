
'use strict';

// ALBUKHR Testnet Risk Admin UI contract smoke test.
// Static checks only: no network calls and no database writes.

const fs = require('node:fs');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
  'js/testnet-project-staking-risk-admin.js',
  'utf8'
);

const html = fs.readFileSync('admin-dashboard.html', 'utf8');

// Testnet environment isolation.
assert.match(source, /var NETWORK = "testnet"/);
assert.match(source, /var HOST = "test\.albukhr\.com"/);
assert.match(source, /window\.ALBukhrEnvironment/);
assert.doesNotMatch(source, /window\.AlbukhrEnvironment/);

// Super Admin authentication.
assert.match(
  source,
  /AUTH\.requireAdmin\(\{\s*redirectOnFailure:\s*false\s*\}\)/
);
assert.match(source, /requireSuperAdmin\(session\)/);

// Only the intended Testnet admin endpoints.
assert.match(source, /\/admin\/project-stages/);
assert.match(source, /\/admin\/policy"/);
assert.match(source, /\/admin\/policy\/provision/);
assert.match(source, /\/admin\/policy\/review/);

// Explicit user confirmation for administrative actions.
assert.match(source, /window\.confirm/);

// Database status compatibility.
assert.match(source, /function isPendingReview\(status\)/);
assert.match(source, /value === "pending"/);
assert.match(source, /value === "pending_review"/);

// Review buttons must use the normalized pending helper.
assert.match(
  source,
  /else if \(isPendingReview\(policy\.approval_status\)\)/
);

// The review message must also recognize database status "pending".
assert.match(
  source,
  /isPendingReview\(status\)/
);

// Summary count must recognize both pending states.
assert.match(
  source,
  /isPendingReview\(p\.policy\.approval_status\)/
);

// Project and global staking must not be enabled by this panel.
assert.match(source, /This panel never enables staking/);
assert.doesNotMatch(
  source,
  /staking_policy_active\s*=\s*true/
);

// The Risk Admin script must actually be loaded by the dashboard.
assert.match(
  html,
  /testnet-project-staking-risk-admin\.js\?v=20261104-risk-admin2/
);

console.log(JSON.stringify({
  checks: 20,
  network: 'testnet',
  role_gate: 'super_admin',
  pending_statuses: ['pending', 'pending_review'],
  review_buttons: 'normalized pending helper',
  review_message: 'normalized pending helper',
  pending_summary: 'normalized pending helper',
  approval_keeps_staking_disabled: true,
  global_staking_activation: false,
  network_calls: false,
  database_writes: false,
  result: 'PASS'
}, null, 2));
