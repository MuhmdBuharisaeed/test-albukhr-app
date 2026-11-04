'use strict';

// ALBUKHR Testnet Stage Manager UI contract smoke test.
// Static checks only: no network requests and no database writes.

const fs = require('node:fs');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
  'js/testnet-project-staking-stage-admin.js',
  'utf8'
);

const html = fs.readFileSync(
  'admin-dashboard.html',
  'utf8'
);

// Network and hostname isolation.
assert.match(source, /var NETWORK = "testnet"/);
assert.match(source, /var HOST = "test\.albukhr\.com"/);
assert.match(source, /window\.ALBukhrEnvironment/);
assert.match(source, /env\.isKnown\(\)/);
assert.match(source, /env\.isTestnet\(\)/);
assert.match(source, /env\.getNetwork\(\) !== NETWORK/);
assert.match(source, /hostname !== HOST/);

// API restrictions.
assert.match(
  source,
  /https:\/\/test-albukhr-api\.onrender\.com\/staking/
);
assert.match(source, /function environment\(\)/);
assert.match(source, /environment\(\);\s*var allowedPaths/);
assert.match(source, /\/admin\/project-stages/);
assert.match(source, /\/admin\/project-stages\/set/);

// Authentication and authorization.
assert.match(
  source,
  /AUTH\.requireAdmin\(\{\s*redirectOnFailure:\s*false\s*\}\)/
);
assert.match(
  source,
  /clean\(role\)\.toLowerCase\(\) === "super_admin"/
);

// Approved stage validation.
assert.match(source, /setup_pre_operation/);
assert.match(source, /construction_fit_out/);
assert.match(source, /operating_expansion/);
assert.match(source, /function isValidStage\(value\)/);

// Stage assignment safeguards.
assert.match(source, /project\.id/);
assert.match(source, /project\.project_code/);
assert.match(source, /isValidStage\(select\.value\)/);
assert.match(source, /stakingStage:\s*select\.value/);

// Persistent browser storage must not be introduced.
assert.doesNotMatch(source, /localStorage|sessionStorage/);

// Frontend must not call database RPC directly.
assert.doesNotMatch(source, /supabase\.rpc/);

// Staking must remain inactive.
assert.match(source, /Staking remains inactive/i);
assert.doesNotMatch(
  source,
  /staking_policy_active\s*=\s*true/
);

// Updated cache-buster.
assert.match(
  html,
  /testnet-project-staking-stage-admin\.js\?v=20261104-stage-admin-v2/
);

console.log(JSON.stringify({
  checks: 25,
  network: 'testnet',
  host: 'test.albukhr.com',
  authorization: 'super_admin',
  approved_stages: 3,
  direct_database_writes: false,
  browser_storage: false,
  global_staking_activation: false,
  result: 'PASS'
}, null, 2));
