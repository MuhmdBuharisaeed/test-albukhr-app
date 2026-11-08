"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

class MockNode {
  constructor(tagName) {
    this.tagName = tagName;
    this.className = "";
    this.textContent = "";
    this.children = [];
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  replaceChildren(...children) {
    this.children = children;
  }
}

function collectText(node) {
  return [node.textContent || ""]
    .concat((node.children || []).map(collectText))
    .join(" ");
}

async function main() {
  const eventHandlers = new Map();
  const historyNode = new MockNode("div");
  const statsEvents = [];
  const apiCalls = [];

  const window = {
    CustomEvent: class CustomEvent {
      constructor(type, options) {
        this.type = type;
        this.detail = options && options.detail;
      }
    },
    addEventListener(type, callback) {
      if (!eventHandlers.has(type)) eventHandlers.set(type, []);
      eventHandlers.get(type).push(callback);
    },
    dispatchEvent(event) {
      const handlers = eventHandlers.get(event.type) || [];
      handlers.forEach(callback => callback(event));
      if (event.type === "albukhr:testnet-investor-data-loaded") {
        statsEvents.push(event.detail.payload);
      }
      return true;
    },
    AlbukhrTestnetAuth: {
      async requireTestnetAuth(options) {
        assert.equal(options.redirectOnFailure, false);
        return { network: "testnet", pi_uid: "testnet-user-uid" };
      }
    },
    AlbukhrTestnetApi: {
      network: "testnet",
      async getInvestorData() {
        apiCalls.push("GET investor-data");
        return {
          ok: true,
          network: "testnet",
          user: { pi_uid: "testnet-user-uid" },
          stakes: [
            {
              id: "stake-1",
              network: "testnet",
              project_code: "RAHEEM-25",
              amount: "10.0000000",
              duration_days: 30,
              reward_rate: "0.01000000",
              reward_amount: "0.1000000",
              status: "active",
              start_at: "2026-11-08T18:54:58Z",
              unlock_at: "2026-12-08T18:54:58Z"
            },
            {
              id: "mainnet-stake-must-not-render",
              network: "mainnet",
              project_code: "RAHEEM-25",
              amount: "999",
              duration_days: 30,
              status: "active"
            }
          ],
          withdrawals: []
        };
      }
    }
  };

  const document = {
    getElementById(id) {
      return id === "projectHistory" ? historyNode : null;
    },
    createElement(tagName) {
      return new MockNode(tagName);
    }
  };

  const sourcePath = path.join(__dirname, "..", "js", "testnet-project-history.js");
  const source = fs.readFileSync(sourcePath, "utf8");
  vm.runInNewContext(source, { window, document, console }, {
    filename: "testnet-project-history.js"
  });

  window.dispatchEvent(new window.CustomEvent("albukhr:testnet-project-loaded", {
    detail: {
      project: {
        network: "testnet",
        project_code: "RAHEEM-25",
        id: "project-raheem",
        name: "RAHEEM PHARMACY"
      }
    }
  }));

  await window.AlbukhrTestnetProjectHistory.refresh();

  const rendered = collectText(historyNode);
  assert.match(rendered, /Testnet stake/);
  assert.match(rendered, /10\.00 Pi/);
  assert.match(rendered, /30 days/);
  assert.doesNotMatch(rendered, /mainnet-stake-must-not-render/);
  assert.doesNotMatch(rendered, /999/);
  assert.equal(apiCalls.length, 1, "only the read-only investor-data GET is expected");
  assert.equal(statsEvents.length, 1, "the existing project summary bridge should receive the payload");
  assert.equal(window.AlbukhrTestnetProjectHistory.getRows().length, 1);

  console.log("SMOKE_OK history_rows=1 network_isolation=PASS read_only_api=PASS summary_bridge=PASS");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
