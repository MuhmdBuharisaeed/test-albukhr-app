'use strict';

// Static source-contract test. Run from the Testnet app repository root.
// It reads source only; it makes no network calls and performs no writes.
const fs = require('node:fs');
const assert = require('node:assert/strict');

const ownerSource = fs.readFileSync('js/testnet-project-owner.js', 'utf8');
const stakingSource = fs.readFileSync('js/testnet-owner-staking.js', 'utf8');
const html = fs.readFileSync('project-owner.html', 'utf8');

assert.match(ownerSource, /albukhr:testnet-owner-project-rendered/);
assert.match(stakingSource, /albukhr:testnet-owner-project-rendered/);
assert.match(stakingSource, /request\("offers"/);
assert.match(stakingSource, /request\("offer-settings"/);
assert.match(stakingSource, /policyPayload\.can_configure !== true/);
assert.match(stakingSource, /staking_policy_active/);
assert.match(stakingSource, /not_provisioned/);
assert.doesNotMatch(stakingSource, /Current staking stage/);
assert.doesNotMatch(stakingSource, /must assign a staking stage/);
assert.match(stakingSource, /universal Testnet risk controls/);
assert.match(html, /js\/testnet-owner-staking\.js\?v=20261104-universal-risk-v1/);

console.log(JSON.stringify({
  structural_checks: 11,
  project_render_event: true,
  owner_offers_endpoint: true,
  owner_save_endpoint: true,
  stage_removed_from_owner_requirements: true,
  deployment_cache_bust: true,
  network_calls: false,
  result: 'PASS'
}, null, 2));
