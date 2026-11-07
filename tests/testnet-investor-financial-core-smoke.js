"use strict";

const assert = require("node:assert/strict");
const core = require("../js/testnet-investor-financial-core.js");

function stake(id, overrides = {}) {
  return Object.assign({
    id,
    project_id: "project-" + id,
    project_code: "PROJECT-" + id,
    pi_uid: "pi-user-1",
    network: "testnet",
    amount: "100.0000000",
    duration_days: 30,
    reward_rate: "5.0000000",
    reward_amount: "10.0000000",
    status: "active",
    start_at: "2026-01-01T00:00:00Z",
    unlock_at: "2026-02-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z"
  }, overrides);
}

function withdrawal(id, stakeId, type, amount, status, overrides = {}) {
  return Object.assign({
    id,
    stake_id: stakeId,
    pi_uid: "pi-user-1",
    project_id: "project-" + stakeId,
    project_code: "PROJECT-" + stakeId,
    network: "testnet",
    withdrawal_type: type,
    requested_amount: amount,
    fee_amount: "0.0000000",
    net_amount: amount,
    status,
    txid: status === "completed" ? "test-tx-" + id : null,
    created_at: "2026-01-10T00:00:00Z"
  }, overrides);
}

// Empty investor: zero totals, no reconciliation errors.
{
  const result = core.calculate({
    piUid: "pi-user-1",
    stakes: [],
    withdrawals: [],
    asOf: "2026-01-15T00:00:00Z"
  });
  assert.equal(result.ok, true);
  assert.equal(result.summary.portfolio, "0");
  assert.equal(result.summary.invested, "0");
  assert.equal(result.summary.earnings, "0");
  assert.equal(result.summary.stake_count, 0);
}

// Completed payouts reduce balances; open requests reserve availability;
// failed/rejected requests do not reduce the settled portfolio.
{
  const result = core.calculate({
    piUid: "pi-user-1",
    asOf: "2026-01-15T00:00:00Z",
    stakes: [
      stake("locked", { project_code: "ALPHA", amount: "100", reward_amount: "10", unlock_at: "2026-02-01T00:00:00Z" }),
      stake("matured", { project_code: "BETA", amount: "50", reward_amount: "5", unlock_at: "2026-01-01T00:00:00Z" })
    ],
    withdrawals: [
      withdrawal("w-cap-paid", "locked", "capital", "20", "completed", { project_code: "ALPHA" }),
      withdrawal("w-reward-paid", "locked", "reward", "2", "completed", { project_code: "ALPHA" }),
      withdrawal("w-cap-open", "locked", "capital", "10", "processing", { fee_amount: "1", project_code: "ALPHA" }),
      withdrawal("w-reward-open", "locked", "reward", "3", "pending", { project_code: "ALPHA" }),
      withdrawal("w-cap-matured-open", "matured", "capital", "5", "approved", { project_code: "BETA" }),
      withdrawal("w-failed", "locked", "capital", "7", "failed", { project_code: "ALPHA" }),
      withdrawal("w-rejected", "matured", "reward", "1", "rejected", { project_code: "BETA" })
    ]
  });

  assert.equal(result.ok, true);
  assert.equal(result.summary.gross_invested, "150");
  assert.equal(result.summary.capital_returned, "20");
  assert.equal(result.summary.rewards_paid, "2");
  assert.equal(result.summary.capital_remaining, "130");
  assert.equal(result.summary.rewards_remaining, "13");
  assert.equal(result.summary.portfolio, "143");
  assert.equal(result.summary.capital_locked, "80");
  assert.equal(result.summary.capital_matured, "50");
  assert.equal(result.summary.capital_pending_withdrawal, "16");
  assert.equal(result.summary.reward_pending_withdrawal, "3");
  assert.equal(result.summary.available_capital, "45");
  assert.equal(result.summary.available_rewards, "10");
  assert.equal(result.summary.available_total, "55");
  assert.equal(result.summary.active_projects, 2);
  assert.equal(result.positions[0].capital_remaining, "80");
  assert.equal(result.positions[1].capital_remaining, "50");
}

// A capital stake is not available until unlock_at; rewards are not gated by
// unlock_at in the current withdrawal SQL.
{
  const result = core.calculate({
    piUid: "pi-user-1",
    asOf: "2026-01-15T00:00:00Z",
    stakes: [stake("s1", { amount: "25.1234567", reward_amount: "1.2345678" })],
    withdrawals: []
  });
  assert.equal(result.summary.capital_locked, "25.1234567");
  assert.equal(result.summary.available_capital, "0");
  assert.equal(result.summary.available_rewards, "1.2345678");
}

// Missing network is accepted only for this server-scoped endpoint response;
// an explicit Mainnet row is excluded and flags reconciliation.
{
  const result = core.calculate({
    piUid: "pi-user-1",
    asOf: "2026-01-15T00:00:00Z",
    stakes: [
      stake("testnet-no-network", { network: undefined }),
      stake("foreign", { network: "mainnet" })
    ],
    withdrawals: []
  });
  assert.equal(result.summary.stake_count, 1);
  assert.equal(result.summary.gross_invested, "100");
  assert.equal(result.ok, false);
  assert.ok(result.warnings.some(x => x.indexOf("NON_TESTNET_STAKE_EXCLUDED") === 0));
}

// A completed request without a txid is not treated as paid. It stays
// reserved and requires reconciliation.
{
  const result = core.calculate({
    piUid: "pi-user-1",
    asOf: "2026-01-15T00:00:00Z",
    stakes: [stake("s1", { unlock_at: "2026-01-01T00:00:00Z" })],
    withdrawals: [withdrawal("w-no-tx", "s1", "capital", "30", "completed", { txid: null })]
  });
  assert.equal(result.ok, false);
  assert.equal(result.summary.capital_remaining, "100");
  assert.equal(result.summary.capital_pending_withdrawal, "30");
  assert.equal(result.summary.available_capital, "70");
  assert.ok(result.warnings.some(x => x.indexOf("COMPLETED_WITHDRAWAL_MISSING_TXID") === 0));
}

// Over-withdrawal is clamped to zero and flagged; it cannot create a negative
// investor balance.
{
  const result = core.calculate({
    piUid: "pi-user-1",
    asOf: "2026-01-15T00:00:00Z",
    stakes: [stake("s1")],
    withdrawals: [withdrawal("w-over", "s1", "capital", "120", "completed")]
  });
  assert.equal(result.ok, false);
  assert.equal(result.summary.capital_remaining, "0");
  assert.ok(result.warnings.some(x => x.indexOf("CAPITAL_WITHDRAWALS_EXCEED_STAKE") === 0));
}

// Duplicate withdrawal IDs are ignored after first occurrence and flagged.
{
  const result = core.calculate({
    piUid: "pi-user-1",
    asOf: "2026-01-15T00:00:00Z",
    stakes: [stake("s1")],
    withdrawals: [
      withdrawal("same-id", "s1", "capital", "10", "completed"),
      withdrawal("same-id", "s1", "capital", "10", "completed")
    ]
  });
  assert.equal(result.summary.capital_remaining, "90");
  assert.equal(result.ok, false);
  assert.ok(result.warnings.some(x => x.indexOf("DUPLICATE_WITHDRAWAL_ID") === 0));
}

// A withdrawal owner must match both the parent stake and signed-in investor.
{
  const result = core.calculate({
    piUid: "pi-user-1",
    asOf: "2026-01-15T00:00:00Z",
    stakes: [stake("s1")],
    withdrawals: [withdrawal("w-owner-mismatch", "s1", "capital", "10", "completed", { pi_uid: "pi-user-2" })]
  });
  assert.equal(result.ok, false);
  assert.equal(result.summary.capital_returned, "0");
  assert.ok(result.warnings.some(x => x.indexOf("WITHDRAWAL_OWNER_IDENTITY_MISMATCH") === 0));
}

// A withdrawal cannot move a request across project identities.
{
  const result = core.calculate({
    piUid: "pi-user-1",
    asOf: "2026-01-15T00:00:00Z",
    stakes: [stake("s1")],
    withdrawals: [withdrawal("w-project-mismatch", "s1", "capital", "10", "completed", { project_id: "foreign-project", project_code: "FOREIGN" })]
  });
  assert.equal(result.ok, false);
  assert.equal(result.summary.capital_returned, "0");
  assert.ok(result.warnings.some(x => x.indexOf("WITHDRAWAL_PROJECT_IDENTITY_MISMATCH") === 0));
}

// A stake belonging to another investor is excluded from the portfolio.
{
  const result = core.calculate({
    piUid: "pi-user-1",
    asOf: "2026-01-15T00:00:00Z",
    stakes: [stake("foreign-owner", { pi_uid: "pi-user-2" })],
    withdrawals: []
  });
  assert.equal(result.ok, false);
  assert.equal(result.summary.stake_count, 0);
  assert.equal(result.summary.portfolio, "0");
  assert.ok(result.warnings.some(x => x.indexOf("STAKE_OWNER_IDENTITY_MISMATCH") === 0));
}


// Closed requests do not affect balances, but mismatched links still require review.
{
  const result = core.calculate({
    piUid: "pi-user-1",
    asOf: "2026-01-15T00:00:00Z",
    stakes: [stake("s1")],
    withdrawals: [withdrawal("w-closed-project-mismatch", "s1", "capital", "10", "failed", {
      project_id: "foreign-project",
      project_code: "FOREIGN"
    })]
  });
  assert.equal(result.ok, false);
  assert.equal(result.summary.capital_returned, "0");
  assert.ok(result.warnings.some(x => x.indexOf("WITHDRAWAL_PROJECT_IDENTITY_MISMATCH") === 0));
}

console.log("testnet-investor-financial-core v1.1: all smoke tests passed");
