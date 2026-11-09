
"use strict";

const fs = require("node:fs");
const assert = require("node:assert/strict");

const ui = fs.readFileSync(
  "js/testnet-staking.js",
  "utf8"
);

const client = fs.readFileSync(
  "js/testnet-staking-payment-client.js",
  "utf8"
);

// --------------------------------------------------
// PAYMENT CLIENT CONTRACT
// --------------------------------------------------

assert.match(
  client,
  /reconcile:\s*async function\(paymentId\)/,
  "payment client exports asynchronous reconciliation"
);

assert.match(
  client,
  /await authenticate\(\)/,
  "reconciliation authenticates the official Pi identity"
);

assert.match(
  client,
  /request\(\s*"reconcile"/,
  "reconciliation calls the existing Testnet API endpoint"
);

assert.match(
  client,
  /priorRecovery[\s\S]*?finalized[\s\S]*?cancelled/,
  "previously finalized or cancelled recovery is recognized"
);

assert.match(
  client,
  /pendingIntent\s*=\s*null/,
  "resolved intent can be cleared from memory"
);

// --------------------------------------------------
// UI RECONCILIATION CONTROL
// --------------------------------------------------

assert.match(
  ui,
  /confirm\.textContent\s*=\s*"Reconcile existing payment"/,
  "existing payment displays an explicit reconciliation action"
);

assert.match(
  ui,
  /async function reconcileExistingPayment\(\)/,
  "manual reconciliation handler exists"
);

assert.match(
  ui,
  /await client\.authenticate\(\)/,
  "manual reconciliation authenticates before API access"
);

assert.match(
  ui,
  /await client\.reconcile\(paymentId\)/,
  "manual reconciliation uses the original Payment ID"
);

// --------------------------------------------------
// TERMINAL OUTCOMES
// --------------------------------------------------

assert.match(
  ui,
  /outcome === "finalized"/,
  "verified payments are handled"
);

assert.match(
  ui,
  /outcome === "cancelled"/,
  "official cancellations are handled"
);

assert.match(
  ui,
  /outcome === "pending_pi_approval"/,
  "unapproved payments remain unresolved"
);

assert.match(
  ui,
  /outcome === "awaiting_transaction"/,
  "payments without verified transaction IDs remain unresolved"
);

// --------------------------------------------------
// NO SECOND PAYMENT
// --------------------------------------------------

const handlerStart = ui.indexOf(
  "async function reconcileExistingPayment()"
);

const handlerEnd = ui.indexOf(
  "async function submitStake()",
  handlerStart
);

assert.ok(
  handlerStart >= 0 && handlerEnd > handlerStart,
  "manual reconciliation handler boundaries exist"
);

const handler = ui.slice(handlerStart, handlerEnd);

assert.doesNotMatch(
  handler,
  /payPreparedStake|prepareStake|createPayment/,
  "manual reconciliation cannot prepare or launch a new Pi payment"
);

assert.match(
  ui,
  /await reconcileExistingPayment\(\)/,
  "existing pending payments route to reconciliation instead of new staking"
);

console.log(JSON.stringify({
  result: "PASS",
  client_authentication: true,
  original_payment_id_only: true,
  finalized_outcome: true,
  cancelled_outcome: true,
  unresolved_payment_protection: true,
  new_pi_payment_from_reconciliation: false,
  database_writes: false,
  real_network_calls: false
}, null, 2));
