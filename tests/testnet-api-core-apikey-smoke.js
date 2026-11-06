"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const supabaseCoreSource = fs.readFileSync(
  path.join(root, "js", "core", "supabase-core.js"), "utf8"
);
const apiCoreSource = fs.readFileSync(
  path.join(root, "js", "testnet-api-core.js"), "utf8"
);

const expectedUrl = "https://vhvkwvngmrlgyzwemttt.supabase.co";
const expectedPublishableKey = "sb_publishable_testnet_smoke_key";
const fetchCalls = [];
let createClientCalls = 0;

const client = {
  storage: {},
  rpc() { return Promise.resolve({ data: null, error: null }); },
  from() { return {}; }
};

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
      createClientCalls += 1;
      assert.strictEqual(url, expectedUrl);
      assert.strictEqual(key, "sb_publishable_5YNtKXSpO1xvPXbpLTo2Nw_mrxDp1qT");
      return client;
    }
  },
  AlbukhrTestnetAuth: {
    getSessionToken: () => "testnet-session-token-only"
  }
};

const context = {
  window,
  console,
  Object,
  String,
  Number,
  URLSearchParams,
  fetch: async (url, options) => {
    fetchCalls.push({ url, options });
    return {
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ ok: true, network: "testnet" })
    };
  }
};

// Build the canonical shared Testnet Supabase Core first.
vm.runInNewContext(supabaseCoreSource, context, {
  filename: "js/core/supabase-core.js"
});

assert.strictEqual(createClientCalls, 1, "exactly one shared Supabase client is created");
assert.strictEqual(window.ALBUKHR_SUPABASE.network, "testnet");
assert.strictEqual(window.ALBUKHR_SUPABASE.url, expectedUrl);
assert.strictEqual(
  window.ALBUKHR_SUPABASE.publishableKey,
  "sb_publishable_5YNtKXSpO1xvPXbpLTo2Nw_mrxDp1qT",
  "shared Core exposes only the configured publishable key"
);

// Load the Testnet API Core and make a harmless mocked GET request.
vm.runInNewContext(apiCoreSource, context, {
  filename: "js/testnet-api-core.js"
});

(async () => {
  const result = await window.AlbukhrTestnetApi.getInvestorData();
  assert.strictEqual(result.network, "testnet");
  assert.strictEqual(fetchCalls.length, 1);

  const call = fetchCalls[0];
  assert.strictEqual(
    call.url,
    expectedUrl + "/functions/v1/testnet-investor-data"
  );
  assert.strictEqual(call.options.method, "GET");
  assert.strictEqual(
    call.options.headers.apikey,
    "sb_publishable_5YNtKXSpO1xvPXbpLTo2Nw_mrxDp1qT"
  );
  assert.strictEqual(
    call.options.headers.Authorization,
    "Bearer testnet-session-token-only"
  );
  assert.strictEqual(call.options.credentials, undefined,
    "browser cookies must not be sent");

  // Caller-supplied values cannot override the API key or session token.
  await window.AlbukhrTestnetApi.request("health-check", {
    method: "GET",
    headers: {
      apikey: "sb_secret_must_not_override",
      Authorization: "Bearer attacker-supplied-token",
      "X-Smoke-Test": "preserved"
    }
  });
  const overrideAttempt = fetchCalls[1].options.headers;
  assert.strictEqual(
    overrideAttempt.apikey,
    "sb_publishable_5YNtKXSpO1xvPXbpLTo2Nw_mrxDp1qT"
  );
  assert.strictEqual(
    overrideAttempt.Authorization,
    "Bearer testnet-session-token-only"
  );
  assert.strictEqual(overrideAttempt["X-Smoke-Test"], "preserved");

  // A missing/misconfigured Core must fail closed before fetch.
  const brokenWindow = {
    location: { hostname: "test.albukhr.com" },
    ALBukhrEnvironment: window.ALBUKHR_SUPABASE && window.ALBukhrEnvironment,
    AlbukhrTestnetAuth: window.AlbukhrTestnetAuth
  };
  const brokenContext = {
    window: brokenWindow,
    console,
    Object,
    String,
    Number,
    URLSearchParams,
    fetch: async () => {
      throw new Error("fetch must not run when the publishable key is absent");
    }
  };
  vm.runInNewContext(apiCoreSource, brokenContext, {
    filename: "js/testnet-api-core-missing-key.js"
  });
  await assert.rejects(
    brokenWindow.AlbukhrTestnetApi.getInvestorData(),
    /TESTNET_SUPABASE_PUBLISHABLE_KEY_UNAVAILABLE/
  );

  console.log(JSON.stringify({
    one_shared_testnet_supabase_client: true,
    publishable_key_exposed_from_shared_core: true,
    required_apikey_header_sent: true,
    testnet_session_bearer_preserved: true,
    cookies_not_sent: true,
    caller_cannot_override_auth_or_apikey: true,
    missing_key_fails_closed: true,
    service_role_key_used: false,
    mainnet_credentials_used: false
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
