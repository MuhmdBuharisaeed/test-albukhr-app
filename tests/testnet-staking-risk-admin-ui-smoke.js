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
assert.match(source, /STAKING_POLICY_SUPER_ADMIN_REQUIRED/);

// The Risk Admin panel uses the universal-risk endpoints, not legacy stage routes.
assert.match(source, /"\/admin\/risk-projects"/);
assert.match(source, /"\/admin\/policy"/);
assert.match(source, /"\/admin\/policy\/provision"/);
assert.match(source, /"\/admin\/policy\/review"/);
assert.match(source, /"\/admin\/policy\/enablement"/);
assert.doesNotMatch(source, /"\/admin\/project-stages(?:\/set)?"/);

// Provisioning is pending-only and requires an active project treasury/positive target.
const canProvisionMatch = source.match(
  /function canProvision\([\s\S]*?\n  function renderCard\(/
);
assert.ok(canProvisionMatch, 'canProvision helper must exist');
assert.match(canProvisionMatch[0], /result\.can_provision === true/);
assert.match(canProvisionMatch[0], /!policy/);
assert.match(canProvisionMatch[0], /treasury_status/);
assert.match(canProvisionMatch[0], /required_liquidity/);
assert.doesNotMatch(canProvisionMatch[0], /staking_stage/);
assert.match(source, /Provisioning creates pending controls only/);
assert.match(source, /approval does not enable staking/);
assert.match(source, /function isPendingReview\(status\)/);
assert.match(source, /value === "pending"/);
assert.match(source, /value === "pending_review"/);
assert.match(source, /isPendingReview\(policy\.approval_status\)/);

// Project-level staking enablement is a distinct Super Admin action.
// It must not silently activate the global Testnet staking switch.
assert.match(source, /Enable project staking/);
assert.match(source, /Disable project staking/);
assert.match(source, /Global Testnet staking remains a separate control/);
assert.match(source, /reason\.length < 10/);
assert.match(source, /reason\.length > 500/);
assert.match(source, /perform\(project, "enablement"/);
assert.doesNotMatch(source, /staking_policy_active\s*=\s*true/);
assert.doesNotMatch(source, /staking_stage/);

// Verify cache-busting at the HTML script reference, not inside the JS source.
assert.match(
  html,
  /<script src="js\/testnet-project-staking-risk-admin\.js\?v=20261104-universal-risk-v1">/
);
// The legacy Stage Manager remains separately loaded for backward compatibility.
assert.match(html, /js\/testnet-project-staking-stage-admin\.js/);

console.log(JSON.stringify({
  checks: 31,
  network: 'testnet',
  role_gate: 'super_admin',
  universal_risk_endpoints: true,
  pending_review_statuses: ['pending', 'pending_review'],
  project_level_enablement: 'separate from global staking activation',
  legacy_stage_manager_preserved: true,
  cache_busting: 'universal-risk-v1',
  global_staking_activation: false,
  network_calls: false,
  database_writes: false,
  result: 'PASS'
}, null, 2));
