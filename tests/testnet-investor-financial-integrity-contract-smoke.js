"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

const record = read("docs/database/testnet-investor-financial-integrity-hardening-v1.md");
const verification = read("docs/database/testnet-investor-financial-integrity-post-apply-verification.sql");
const sqlSmoke = read("tests/sql/testnet-investor-composite-foreign-key-smoke.sql");
const core = read("js/testnet-investor-financial-core.js");
const ui = read("js/testnet-investor-financial-ui.js");

const requiredConstraints = [
  "users_id_pi_uid_network_key",
  "projects_id_code_network_key",
  "stakes_id_owner_project_network_key",
  "stakes_user_identity_fkey",
  "stakes_project_network_fkey",
  "withdrawal_requests_user_identity_fkey",
  "withdrawal_requests_project_network_fkey",
  "withdrawal_requests_stake_owner_project_fkey"
];

for (const name of requiredConstraints) {
  assert.ok(record.includes(name), `hardening record missing ${name}`);
  assert.ok(verification.includes(name), `post-apply verification missing ${name}`);
}

const requiredIndexes = [
  "stakes_user_identity_idx",
  "stakes_project_network_idx",
  "withdrawal_requests_user_identity_idx",
  "withdrawal_requests_project_network_idx",
  "withdrawal_requests_stake_owner_project_idx"
];
for (const name of requiredIndexes) {
  assert.ok(record.includes(name), `hardening record missing index ${name}`);
  assert.ok(verification.includes(name), `verification missing index ${name}`);
}

assert.match(verification, /has_function_privilege\('anon',[\s\S]*?'EXECUTE'\)/i);
assert.match(verification, /has_function_privilege\('authenticated',[\s\S]*?'EXECUTE'\)/i);
assert.match(verification, /has_function_privilege\('service_role',[\s\S]*?'EXECUTE'\)/i);
assert.match(verification, /staking_policy_active/i);
assert.match(record, /Do not re-run the original DDL patch/i);

assert.match(sqlSmoke, /^BEGIN;/m);
assert.match(sqlSmoke, /^ROLLBACK;/m);
assert.match(sqlSmoke, /CREATE TEMP TABLE ci_users/i);
assert.match(sqlSmoke, /MATCHING_WITHDRAWAL_ACCEPTED/);
assert.match(sqlSmoke, /OWNER_MISMATCH_REJECTED/);
assert.match(sqlSmoke, /PROJECT_MISMATCH_REJECTED/);
assert.match(sqlSmoke, /NETWORK_MISMATCH_REJECTED/);
assert.doesNotMatch(sqlSmoke, /INSERT\s+INTO\s+public\./i);
assert.doesNotMatch(sqlSmoke, /UPDATE\s+public\./i);
assert.doesNotMatch(sqlSmoke, /DELETE\s+FROM\s+public\./i);

assert.match(core, /INVESTOR_IDENTITY_MISSING/);
assert.match(core, /STAKE_OWNER_IDENTITY_MISMATCH/);
assert.match(core, /WITHDRAWAL_OWNER_IDENTITY_MISMATCH/);
assert.match(core, /WITHDRAWAL_PROJECT_IDENTITY_MISMATCH/);
assert.match(ui, /piUid:\s*payload\.user\s*&&\s*payload\.user\.pi_uid/);

console.log("testnet-investor-financial-integrity-contract: all checks passed");
