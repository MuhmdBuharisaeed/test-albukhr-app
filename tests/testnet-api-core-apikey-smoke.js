"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const coreSource = fs.readFileSync(path.join(root, "js", "core", "supabase-core.js"), "utf8");
const apiSource = fs.readFileSync(path.join(root, "js", "testnet-api-core.js"), "utf8");
const expectedUrl = "https://vhvkwvngmrlgyzwemttt.supabase.co";
const expectedKey = "sb_publishable_testnet_smoke_key";
const calls = [];
let clients = 0;

const window = {
  location: { hostname: "test.albukhr.com" },
  ALBukhrEnvironment: {
    isKnown: () => true,
    isTestnet: () => true,
    getNetwork: () => "testnet",
    getSupabaseUrl: () => expectedUrl,
    getHostname: () => "test.albukhr.com"
  },
  supabase: {
    createClient(url, key) {
      clients += 1;
      assert.strictEqual(url, expectedUrl);
      assert.strictEqual(key, "sb_publishable_5YNtKXSpO1xvPXbpLTo2Nw_mrxDp1qT");
      return { storage: {}, rpc() {}, from() {} };
    }
  },
  AlbukhrTestnetAuth: { getSessionToken: () => "testnet-session-token-only" }
};

const context = {
  window,
  console,
  Object,
  String,
  Number,
  URLSearchParams,
  fetch: async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ ok: true, network: "testnet" })
    };
  }
};

vm.runInNewContext(coreSource, context, { filename: "js/core/supabase-core.js" });
assert.strictEqual(clients, 1, "one canonical Testnet Supabase client only");
assert.strictEqual(window.ALBUKHR_SUPABASE.network, "testnet");

// Replace only the mocked publishable key in the test sandbox.
window.ALBUKHR_SUPABASE = Object.freeze(Object.assign({}, window.ALBUKHR_SUPABASE, {
  publishableKey: expectedKey
}));
vm.runInNewContext(apiSource, context, { filename: "js/testnet-api-core.js" });

(async () => {
  const result = await window.AlbukhrTestnetApi.getInvestorData();
  assert.strictEqual(result.network, "testnet");
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].url, expectedUrl + "/functions/v1/testnet-investor-data");
  assert.strictEqual(calls[0].options.headers.apikey, expectedKey);
  assert.strictEqual(calls[0].options.headers["X-Testnet-Session"], "testnet-session-token-only");
  assert.strictEqual(calls[0].options.headers.Authorization, undefined,
    "custom ALBUKHR session must not be sent as a Supabase JWT");
  assert.strictEqual(calls[0].options.credentials, undefined,
    "browser cookies must not be sent");

  await window.AlbukhrTestnetApi.request("smoke", {
    method: "GET",
    headers: {
      apikey: "sb_secret_attacker_key",
      Authorization: "Bearer attacker-jwt",
      "X-Testnet-Session": "attacker-session",
      "X-Smoke-Test": "preserved"
    }
  });
  const headers = calls[1].options.headers;
  assert.strictEqual(headers.apikey, expectedKey);
  assert.strictEqual(headers["X-Testnet-Session"], "testnet-session-token-only");
  assert.strictEqual(headers.Authorization, undefined);
  assert.strictEqual(headers["X-Smoke-Test"], "preserved");

  const brokenWindow = {
    location: { hostname: "test.albukhr.com" },
    ALBukhrEnvironment: window.ALBukhrEnvironment,
    AlbukhrTestnetAuth: window.AlbukhrTestnetAuth
  };
  const brokenContext = {
    window: brokenWindow,
    console,
    Object,
    String,
    Number,
    URLSearchParams,
    fetch: async () => { throw new Error("fetch must not run without the key"); }
  };
  vm.runInNewContext(apiSource, brokenContext, { filename: "api-core-missing-key.js" });
  await assert.rejects(
    brokenWindow.AlbukhrTestnetApi.getInvestorData(),
    /TESTNET_SUPABASE_PUBLISHABLE_KEY_UNAVAILABLE/
  );

  console.log(JSON.stringify({
    shared_testnet_supabase_core: true,
    publishable_apikey_header: true,
    custom_session_uses_x_testnet_session: true,
    no_custom_session_in_authorization: true,
    caller_cannot_override_credentials: true,
    missing_key_fails_closed: true,
    service_role_key_used: false,
    mainnet_credentials_used: false
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
