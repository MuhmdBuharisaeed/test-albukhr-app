"use strict";

const assert = require("node:assert/strict");
const financialCore = require("../js/testnet-investor-financial-core.js");
const financialUi = require("../js/testnet-investor-financial-ui.js");

function fakeElement(id) {
  return {
    id: id || "",
    children: [],
    hidden: false,
    textContent: "",
    attributes: {},
    appendChild(child) { this.children.push(child); return child; },
    removeChild(child) { this.children = this.children.filter(x => x !== child); },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    get firstChild() { return this.children.length ? this.children[0] : null; }
  };
}

function makeWindow(api) {
  const listeners = {};
  return {
    AlbukhrTestnetFinancialCore: financialCore,
    AlbukhrTestnetApi: Object.freeze(api),
    addEventListener(name, callback) {
      (listeners[name] || (listeners[name] = [])).push(callback);
    },
    dispatch(name, event) {
      (listeners[name] || []).forEach(callback => callback(event));
    }
  };
}

function makeDocument() {
  const section = fakeElement("investorFinancialOverview");
  const grid = fakeElement("investorFinancialMetrics");
  const warning = fakeElement("investorFinancialWarning");
  const investments = fakeElement("investments");
  const nodes = {
    investorFinancialOverview: section,
    investorFinancialMetrics: grid,
    investorFinancialWarning: warning,
    investments
  };
  return {
    nodes,
    createElement() { return fakeElement(); },
    getElementById(id) { return nodes[id] || null; },
    querySelectorAll() { return []; },
    querySelector() { return null; }
  };
}

(async function run() {
  const fixture = {
    ok: true,
    network: "testnet",
    user: { username: "Test Investor", network: "testnet" },
    summary: {},
    projects: [],
    stakes: [{
      id: "stake-1",
      project_id: "project-1",
      project_code: "PROJECT-1",
      network: "testnet",
      amount: "100.0000000",
      reward_amount: "10.0000000",
      duration_days: 30,
      reward_rate: "5.0000000",
      status: "active",
      unlock_at: "2026-01-01T00:00:00Z",
      created_at: "2025-12-01T00:00:00Z"
    }],
    withdrawals: [{
      id: "withdrawal-1",
      stake_id: "stake-1",
      network: "testnet",
      withdrawal_type: "capital",
      requested_amount: "20.0000000",
      fee_amount: "0.0000000",
      status: "completed",
      txid: "test-tx-1"
    }]
  };

  const window = makeWindow({
    network: "testnet",
    baseUrl: "https://test.example.invalid",
    async getInvestorData() { return fixture; }
  });
  const document = makeDocument();

  const installed = financialUi.install(window, document);
  assert.ok(installed);
  assert.equal(installed.network, "testnet");

  const payload = await window.AlbukhrTestnetApi.getInvestorData();
  assert.equal(payload.network, "testnet");
  assert.equal(payload.summary.portfolio, "90");
  assert.equal(payload.summary.invested, "80");
  assert.equal(payload.summary.earnings, "10");
  assert.equal(payload.stakes[0].amount, "80");
  assert.equal(payload.stakes[0].reward_amount, "10");
  assert.equal(payload.stakes[0].original_amount, "100.0000000");
  assert.equal(installed.getLastCalculation().summary.capital_returned, "20");

  window.dispatch("albukhr:testnet-investor-loaded", {
    detail: { network: "testnet" }
  });

  assert.equal(document.nodes.investorFinancialMetrics.children.length, 6);
  assert.equal(document.nodes.investments.attributes["aria-busy"], "false");
  assert.equal(document.nodes.investorFinancialOverview.hidden, false);

  const mainnetPayload = Object.assign({}, fixture, { network: "mainnet" });
  assert.throws(() => installed.enrichPayload(mainnetPayload), /INVALID_TESTNET_INVESTOR_NETWORK/);

  window.dispatch("albukhr:testnet-investor-error", { detail: { message: "TESTNET_API_ERROR" } });
  assert.equal(document.nodes.investorFinancialOverview.hidden, true);

  console.log("testnet-investor-financial-ui: all smoke tests passed");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
