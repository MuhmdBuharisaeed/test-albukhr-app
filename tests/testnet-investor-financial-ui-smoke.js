"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

class Element {
  constructor(id = "") {
    this.id = id;
    this.textContent = "";
    this.className = "";
    this.dataset = {};
    this.children = [];
    this.attributes = {};
  }
  appendChild(child) { this.children.push(child); return child; }
  querySelector(selector) {
    if (selector === ".investment-values") return this.values || null;
    if (selector === "span") return this.span || null;
    return null;
  }
  setAttribute(name, value) { this.attributes[name] = value; }
}

const source = fs.readFileSync(
  require.resolve("../js/testnet-investor-financial-ui.js"),
  "utf8"
);

async function runCase({ summary, positions, expectedStatus, expectedNote }) {
  const ids = [
    "financialReconciliationStatus", "financialReconciliationNote",
    "totalPortfolio", "totalInvest", "totalEarn", "heroPortfolio",
    "totalProjects", "financialCapitalRemaining", "financialRewardsRemaining",
    "financialCapitalLocked", "financialCapitalMatured", "financialCapitalPending",
    "financialRewardsPending", "financialCapitalReturned", "financialRewardsPaid",
    "investments"
  ];
  const nodes = new Map(ids.map(id => [id, new Element(id)]));
  let readyHandler;
  const cards = [];
  const document = {
    readyState: "loading",
    getElementById(id) { return nodes.get(id) || null; },
    createElement() { return new Element(); },
    addEventListener(name, callback) { if (name === "DOMContentLoaded") readyHandler = callback; },
    querySelectorAll(selector) { return selector === "#investments .investment-card" ? cards : []; }
  };
  const payload = { network: "testnet", stakes: [], withdrawals: [], projects: [] };
  const investor = {
    boot: async () => payload,
    renderInvestments(rows) { assert.equal(rows.length, positions.length); }
  };
  const core = {
    calculate(input) {
      assert.deepEqual(input.stakes, []);
      assert.deepEqual(input.withdrawals, []);
      return { ok: summary.reconciled, network: "testnet", summary, positions, warnings: summary.warnings || [] };
    }
  };
  const window = { AlbukhrTestnetInvestor: investor, AlbukhrTestnetFinancialCore: core };
  vm.runInNewContext(source, { window, document, console, Map, BigInt, Date, Object, String, Number, Array });
  assert.equal(typeof readyHandler, "function");
  await readyHandler();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(nodes.get("financialReconciliationStatus").textContent, expectedStatus);
  assert.ok(nodes.get("financialReconciliationNote").textContent.includes(expectedNote));
  assert.equal(nodes.get("investments").attributes["aria-busy"], "false");
  return nodes;
}

(async () => {
  const populated = await runCase({
    summary: {
      portfolio: "117.25", capital_remaining: "100", rewards_remaining: "17.25",
      capital_locked: "60", capital_matured: "40", capital_pending_withdrawal: "3",
      reward_pending_withdrawal: "2", capital_returned: "5", rewards_paid: "1",
      active_projects: 1, stake_count: 1, completed_withdrawal_count: 1,
      pending_withdrawal_count: 1, reconciled: true, warnings: []
    },
    positions: [{ id: "stake-1", capital_remaining: "100", reward_remaining: "17.25" }],
    expectedStatus: "RECONCILED",
    expectedNote: "available Testnet stake and withdrawal records"
  });
  assert.equal(populated.get("totalPortfolio").textContent, "117.25 π");
  assert.equal(populated.get("totalInvest").textContent, "100.00 π");
  assert.equal(populated.get("totalEarn").textContent, "17.25 π");

  const empty = await runCase({
    summary: {
      portfolio: "0", capital_remaining: "0", rewards_remaining: "0",
      capital_locked: "0", capital_matured: "0", capital_pending_withdrawal: "0",
      reward_pending_withdrawal: "0", capital_returned: "0", rewards_paid: "0",
      active_projects: 0, stake_count: 0, completed_withdrawal_count: 0,
      pending_withdrawal_count: 0, reconciled: true, warnings: []
    },
    positions: [],
    expectedStatus: "NO ACTIVITY",
    expectedNote: "No Testnet investment or withdrawal records were found"
  });
  assert.equal(empty.get("totalPortfolio").textContent, "0.00 π");
  assert.equal(empty.get("financialCapitalRemaining").textContent, "0.00 π");

  console.log("testnet-investor-financial-ui v1.1: all smoke tests passed");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
