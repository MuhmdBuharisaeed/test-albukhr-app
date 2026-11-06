"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const uiPath = path.join(root, "js", "testnet-withdrawal.js");
const htmlPath = path.join(root, "project.html");
const ui = fs.readFileSync(uiPath, "utf8");
const html = fs.readFileSync(htmlPath, "utf8");

// Static safety checks: no client-side percentage formula or legacy endpoint.
assert(!/FEE_RATE|MIN_FEE|function\s+feeFor|amount\s*\*\s*0\.01/.test(ui),
  "UI must not calculate the outflow fee locally");
assert(ui.includes("getTreasuryClient().prepareWithdrawal"),
  "UI must request the official fee quote through the Treasury client");
assert(ui.includes("client.payFee"),
  "UI must use the official Pi U2A fee-payment client");
assert(ui.includes("client.executeWithdrawal"),
  "UI must delegate payout to the server Treasury router");
assert(ui.includes("sender_total_debit"),
  "UI must validate and display the server-computed total debit");
assert(ui.includes("fee_policy_version"),
  "UI must identify the server fee policy version");
assert(ui.includes("WITHDRAWAL_FLOW_ENABLED"),
  "UI must have a separate controlled-test feature gate");
assert(ui.includes("window.ALBukhrTestnetGlobalTreasuryWithdrawalEnabled === true"),
  "withdrawal UI must remain disabled unless the explicit gate is true");
assert(ui.includes("Do not submit another payment or payout"),
  "uncertain fee or payout outcomes must fail closed and require reconciliation");

// Correct script order and Testnet-only integration.
const treasuryClientTag = 'src="js/testnet-global-treasury-payment-client.js?v=20261106-tiered-fee1"';
const withdrawalUiTag = 'src="js/testnet-withdrawal.js?v=20261106-tiered-fee1"';
assert(html.includes(treasuryClientTag), "project.html must load the Treasury payment client");
assert(html.includes(withdrawalUiTag), "project.html must load the updated withdrawal UI");
assert(html.indexOf(treasuryClientTag) < html.indexOf(withdrawalUiTag),
  "Treasury client must load before the withdrawal UI");
assert(!html.includes("js/testnet-withdrawal-api.js"),
  "project.html must not load the legacy withdrawal API client");
assert(html.includes("sdk.minepi.com/pi-sdk.js"), "Pi SDK must remain available for controlled U2A testing");
assert(html.includes("withdrawal-testnet-lock-note"), "page must explain that withdrawals remain locked");

// Dynamic unit check with a minimal browser shim. The feature flag is absent,
// so initialization must stay locked and must not call any network/Pi APIs.
const elements = {
  withdrawRewardsBtn: { disabled: false, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; },
    querySelector() { return { textContent: "" }; } },
  withdrawCapitalBtn: { disabled: false, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; },
    querySelector() { return { textContent: "" }; } }
};
const document = {
  readyState: "complete",
  getElementById(id) { return elements[id] || null; },
  addEventListener() {},
  querySelectorAll() { return []; }
};
const window = {
  document,
  location: { hostname: "test.albukhr.com", search: "" },
  setTimeout() { throw new Error("timer must not be used by smoke test"); },
  addEventListener() {},
  dispatchEvent() {},
  ALBukhrEnvironment: { isKnown: () => true, isTestnet: () => true, getNetwork: () => "testnet" }
};
const sandbox = { window, document, console, URLSearchParams, Date, Number, String, Math, Array, Object, Error, CustomEvent: function () {} };
vm.runInNewContext(ui, sandbox, { filename: "testnet-withdrawal.js" });
assert.strictEqual(window.AlbukhrTestnetWithdrawal.enabled, false,
  "feature gate must default to disabled");
assert.strictEqual(elements.withdrawRewardsBtn.disabled, true,
  "reward withdrawal button must remain disabled");
assert.strictEqual(elements.withdrawCapitalBtn.disabled, true,
  "capital withdrawal button must remain disabled");

const validQuote = {
  id: "fee-1", network: "testnet", source_type: "staker_withdrawal", source_id: "withdrawal-1",
  requested_amount: 10, recipient_amount: 10, fee_amount: 0.02,
  sender_total_debit: 10.02, fee_status: "payment_pending", fee_policy_version: 1,
  fee_basis: "complete_tier_fee"
};
assert.strictEqual(
  window.AlbukhrTestnetWithdrawal.validateFeeQuote(validQuote, "withdrawal-1").fee_amount,
  0.02,
  "valid server fee quote must be accepted"
);
assert.throws(
  () => window.AlbukhrTestnetWithdrawal.validateFeeQuote({ ...validQuote, sender_total_debit: 10.01 }, "withdrawal-1"),
  /TESTNET_FEE_QUOTE_INVALID/,
  "tampered total debit must be rejected"
);
assert.strictEqual(
  window.AlbukhrTestnetWithdrawal.feeBasisDescription("complete_tier_fee"),
  "Fee assessed for each complete 5 Pi tier.",
  "tier fee basis must be explained correctly"
);

console.log(JSON.stringify({
  server_authoritative_fee_ui: true,
  tiered_fee_quote_fields_validated: true,
  payment_and_payout_delegated_to_testnet_treasury_client: true,
  uncertain_outcome_requires_reconciliation: true,
  withdrawal_feature_gate_default_off: true,
  withdrawal_buttons_remain_disabled: true,
  valid_fee_quote_accepted: true,
  tampered_fee_quote_rejected: true,
  legacy_withdrawal_client_removed_from_project_page: true,
  real_pi_payment_or_payout: false
}, null, 2));
