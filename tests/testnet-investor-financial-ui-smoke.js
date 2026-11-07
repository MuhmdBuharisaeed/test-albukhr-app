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
let cards = [];

const document = {
  readyState: "loading",
  getElementById(id) { return nodes.get(id) || null; },
  createElement() { return new Element(); },
  addEventListener(name, callback) { if (name === "DOMContentLoaded") readyHandler = callback; },
  querySelectorAll(selector) { return selector === "#investments .investment-card" ? cards : []; }
};

const payload = {
  network: "testnet",
  stakes: [],
  withdrawals: [],
  projects: []
};
const summary = {
  portfolio: "117.25", capital_remaining: "100", rewards_remaining: "17.25",
  capital_locked: "60", capital_matured: "40", capital_pending_withdrawal: "3",
  reward_pending_withdrawal: "2", capital_returned: "5", rewards_paid: "1",
  active_projects: 1, stake_count: 1, reconciled: true, warnings: []
};
const position = {
  id: "stake-1", project_code: "ALPHA", capital_remaining: "100",
  reward_remaining: "17.25", capital_pending_withdrawal: "3",
  reward_pending_withdrawal: "2", capital_matured: false,
  amount: "100", reward_amount: "17.25"
};

const card = new Element();
card.className = "investment-card";
card.dataset.projectCode = "ALPHA";
card.values = new Element();
const originalCapitalBlock = new Element();
originalCapitalBlock.span = new Element();
originalCapitalBlock.span.textContent = "Invested";
const originalRewardBlock = new Element();
originalRewardBlock.span = new Element();
originalRewardBlock.span.textContent = "Reward";
card.values.children = [originalCapitalBlock, originalRewardBlock];
cards = [card];

const investor = {
  boot: async () => payload,
  renderInvestments(rows) {
    assert.equal(rows.length, 1);
    assert.equal(rows[0].amount, "100");
    assert.equal(rows[0].reward_amount, "17.25");
  }
};
const core = {
  calculate(input) {
    assert.deepEqual(input.stakes, []);
    assert.deepEqual(input.withdrawals, []);
    return { ok: true, network: "testnet", summary, positions: [position], warnings: [] };
  }
};

const window = {
  AlbukhrTestnetInvestor: investor,
  AlbukhrTestnetFinancialCore: core
};
const source = fs.readFileSync(
  require.resolve("../js/testnet-investor-financial-ui.js"),
  "utf8"
);
vm.runInNewContext(source, { window, document, console, Map, BigInt, Date, Object, String, Number, Array });
assert.equal(typeof readyHandler, "function");

(async () => {
  await readyHandler();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(nodes.get("totalPortfolio").textContent, "117.25 π");
  assert.equal(nodes.get("totalInvest").textContent, "100.00 π");
  assert.equal(nodes.get("totalEarn").textContent, "17.25 π");
  assert.equal(nodes.get("financialCapitalPending").textContent, "3.00 π");
  assert.equal(nodes.get("financialReconciliationStatus").textContent, "RECONCILED");
  assert.equal(card.values.children.length, 5);
  assert.equal(originalCapitalBlock.span.textContent, "Capital remaining");
  assert.equal(originalRewardBlock.span.textContent, "Rewards remaining");
  assert.equal(card.values.children[2].children[1].textContent, "3.00 π");
  assert.equal(card.values.children[3].children[1].textContent, "2.00 π");
  assert.equal(nodes.get("investments").attributes["aria-busy"], "false");
  console.log("testnet-investor-financial-ui: all smoke tests passed");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
