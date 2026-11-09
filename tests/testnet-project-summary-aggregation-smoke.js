"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

async function main() {
  const sourcePath = path.join(__dirname, "..", "js", "testnet-project.js");
  const source = fs.readFileSync(sourcePath, "utf8");
  const nodes = Object.create(null);
  const listeners = Object.create(null);

  function node(id) {
    if (!nodes[id]) {
      nodes[id] = {
        id,
        textContent: "",
        hidden: false,
        dataset: Object.create(null),
        attributes: Object.create(null),
        setAttribute(name, value) { this.attributes[name] = String(value); },
        removeAttribute(name) { delete this.attributes[name]; },
        addEventListener() {},
        querySelector() { return null; },
        focus() {}
      };
    }
    return nodes[id];
  }

  const project = {
    id: "raheem-testnet-project-id",
    project_code: "RAHEEM-25",
    slug: "raheem-pharmacy",
    name: "RAHEEM PHARMACY",
    project_type: "core",
    status: "approved",
    network: "testnet"
  };

  const document = {
    readyState: "complete",
    title: "",
    getElementById: node,
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {}
  };

  const window = {
    location: { search: "?project=RAHEEM-25" },
    ALBukhrEnvironment: {
      isKnown: () => true,
      isTestnet: () => true,
      getNetwork: () => "testnet"
    },
    ALBUKHR_SUPABASE: { network: "testnet" },
    AlbukhrTestnetRegistry: {
      load: async () => [project],
      resolve: () => project
    },
    addEventListener(name, callback) {
      (listeners[name] ||= []).push(callback);
    },
    dispatchEvent(event) {
      (listeners[event.type] || []).forEach((callback) => callback(event));
      return true;
    },
    setTimeout() { return 0; }
  };

  class CustomEvent {
    constructor(type, options) {
      this.type = type;
      this.detail = options && options.detail;
    }
  }

  const context = {
    window,
    document,
    CustomEvent,
    URLSearchParams,
    console: { warn() {}, error() {} },
    Number,
    Date,
    Object,
    String,
    Array,
    Math,
    isFinite
  };

  vm.runInNewContext(source, context, { filename: "js/testnet-project.js" });
  await window.AlbukhrTestnetProject.load();

  const payload = {
    network: "testnet",
    stakes: [
      {
        id: "stake-new-15",
        project_id: project.id,
        project_code: "RAHEEM-25",
        network: "testnet",
        amount: "15.0000000",
        reward_amount: "0.1500000",
        status: "active",
        created_at: "2026-11-09T05:07:55.282Z"
      },
      {
        id: "stake-old-10",
        project_id: project.id,
        project_code: "RAHEEM-25",
        network: "testnet",
        amount: "10.0000000",
        reward_amount: "0.1000000",
        status: "active",
        created_at: "2026-11-08T18:54:58.475Z"
      },
      {
        id: "other-project-stake",
        project_id: "another-project-id",
        project_code: "OTHER-01",
        network: "testnet",
        amount: "100.0000000",
        reward_amount: "10.0000000",
        status: "active"
      },
      {
        id: "mainnet-stake",
        project_id: project.id,
        project_code: "RAHEEM-25",
        network: "mainnet",
        amount: "999.0000000",
        reward_amount: "99.0000000",
        status: "active"
      }
    ],
    withdrawals: []
  };

  window.AlbukhrTestnetProject.renderInvestorState(payload);
  assert.equal(node("aStake").textContent, "25.00 Pi");
  assert.equal(node("aStakeNote").textContent, "2 active Testnet stakes");
  assert.equal(node("aReward").textContent, "0.25 Pi");
  assert.equal(node("aRewardNote").textContent, "Available Testnet reward across 2 stakes");

  const maturedStake = {
    id: "stake-matured-5",
    project_id: project.id,
    project_code: "RAHEEM-25",
    network: "testnet",
    amount: "5.0000000",
    reward_amount: "0.0500000",
    status: "completed",
    created_at: "2026-11-07T10:00:00.000Z"
  };
  payload.stakes.push(maturedStake);
  window.AlbukhrTestnetProject.renderInvestorState(payload);
  assert.equal(node("aStake").textContent, "25.00 Pi");
  assert.equal(node("aReward").textContent, "0.30 Pi");
  assert.equal(node("aRewardNote").textContent, "Available Testnet reward across 3 stakes");

  payload.withdrawals = [
    {
      stake_id: "stake-new-15",
      withdrawal_type: "reward",
      requested_amount: "0.05",
      status: "pending"
    },
    {
      stake_id: "stake-old-10",
      withdrawal_type: "reward",
      requested_amount: "0.02",
      status: "approved"
    }
  ];
  window.AlbukhrTestnetProject.renderInvestorState(payload);
  assert.equal(node("aStake").textContent, "25.00 Pi");
  assert.equal(node("aReward").textContent, "0.23 Pi");

  payload.stakes = [maturedStake];
  payload.withdrawals = [];
  window.AlbukhrTestnetProject.renderInvestorState(payload);
  assert.equal(node("aStake").textContent, "0.00 Pi");
  assert.equal(node("aStakeNote").textContent, "No active Testnet stake");
  assert.equal(node("aReward").textContent, "0.05 Pi");

  console.log("PASS: multiple active stakes are aggregated by project.");
  console.log("PASS: rewards are summed per stake after reserved/completed withdrawals.");
  console.log("PASS: matured stakes do not inflate active principal but retain eligible unpaid rewards.");
  console.log("PASS: other projects and Mainnet records are excluded.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
