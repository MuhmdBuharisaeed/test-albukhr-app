const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto').webcrypto;
const ts = require('typescript');

const sourcePath = path.join(
  __dirname,
  '..',
  'supabase',
  'functions',
  'testnet-direct-auth',
  'index.ts',
);
const source = fs.readFileSync(sourcePath, 'utf8')
  .replace(/^import .*;\s*$/gm, '');
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.None,
    strict: false,
  },
  reportDiagnostics: true,
});
const syntaxErrors = (transpiled.diagnostics || []).filter(
  (item) => item.category === ts.DiagnosticCategory.Error,
);
assert.equal(syntaxErrors.length, 0, 'TypeScript transpilation must not report syntax errors');

class FakeQuery {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.operation = 'select';
    this.payload = null;
    this.filters = [];
    this.columns = '*';
    this.maxRows = null;
  }
  select(columns) {
    this.columns = columns || '*';
    return this;
  }
  insert(payload) {
    this.operation = 'insert';
    this.payload = payload;
    return this;
  }
  update(payload) {
    this.operation = 'update';
    this.payload = payload;
    return this;
  }
  eq(column, value) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  is(column, value) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  order() { return this; }
  limit(value) { this.maxRows = value; return this; }
  async maybeSingle() { return this.execute(true); }
  async single() { return this.execute(true); }
  then(resolve, reject) { return this.execute(false).then(resolve, reject); }

  async execute(single) {
    const rows = this.db.tables[this.table] || (this.db.tables[this.table] = []);
    if (this.operation === 'insert') {
      const payloads = Array.isArray(this.payload) ? this.payload : [this.payload];
      const inserted = [];
      for (const item of payloads) {
        if (this.table === 'users') {
          if (this.db.failUserInsert) {
            return { data: null, error: { code: 'XX000', message: 'simulated write failure' } };
          }
          if (this.db.raceUserInsert && !this.db.raceApplied) {
            this.db.raceApplied = true;
            rows.push(this.db.makeUser(item));
            return { data: null, error: { code: '23505', message: 'concurrent unique insert' } };
          }
          const duplicate = rows.some((row) =>
            row.pi_uid === item.pi_uid ||
            (item.testnet_pi_uid && row.testnet_pi_uid === item.testnet_pi_uid)
          );
          if (duplicate) return { data: null, error: { code: '23505', message: 'unique violation' } };
          const row = this.db.makeUser(item);
          rows.push(row);
          inserted.push(row);
        } else {
          const row = { id: `${this.table}-${rows.length + 1}`, ...item };
          rows.push(row);
          inserted.push(row);
        }
      }
      return { data: single ? (inserted[0] || null) : inserted, error: null };
    }

    const matches = rows.filter((row) => this.filters.every((filter) => filter(row)));
    if (this.operation === 'update') {
      for (const row of matches) Object.assign(row, this.payload);
      const selected = this.maxRows === 1 ? matches.slice(0, 1) : matches;
      return { data: single ? (selected[0] || null) : selected, error: null };
    }
    const selected = this.maxRows === null ? matches : matches.slice(0, this.maxRows);
    return { data: single ? (selected[0] || null) : selected, error: null };
  }
}

class FakeDb {
  constructor(options = {}) {
    this.tables = {
      users: options.users ? structuredClone(options.users) : [],
      testnet_sessions: [],
      testnet_identity_link_requests: [],
      testnet_admin_sessions: [],
      projects: [],
    };
    this.raceUserInsert = !!options.raceUserInsert;
    this.raceApplied = false;
    this.failUserInsert = !!options.failUserInsert;
  }
  from(table) { return new FakeQuery(this, table); }
  makeUser(item) {
    const now = new Date().toISOString();
    return {
      id: `testnet-user-${this.tables.users.length + 1}`,
      first_login_at: now,
      last_login_at: now,
      login_count: 1,
      created_at: now,
      updated_at: now,
      ...item,
    };
  }
}

function makeApp(options = {}) {
  const db = new FakeDb(options);
  let handler = null;
  const piUser = options.piUser || { uid: 'sandbox-uid-001', username: 'testuser' };
  const context = {
    console,
    crypto,
    TextEncoder,
    Uint8Array,
    Array,
    String,
    Number,
    Date,
    Math,
    Promise,
    Error,
    AbortController,
    setTimeout,
    clearTimeout,
    btoa,
    Response,
    fetch: async (url, init) => {
      assert.equal(String(url), 'https://api.minepi.com/v2/me');
      assert.equal(init.headers.Authorization, 'Bearer sandbox-access-token');
      return new Response(JSON.stringify(piUser), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
    createClient: () => db,
    Deno: {
      env: { get: (key) => key === 'SUPABASE_URL' ? 'https://test-project.supabase.co' : 'test-service-role' },
      serve: (fn) => { handler = fn; },
    },
  };
  context.globalThis = context;
  vm.runInNewContext(transpiled.outputText, context, { timeout: 3000 });
  assert.equal(typeof handler, 'function', 'Deno.serve handler must be registered');
  return { db, handler, piUser };
}

async function postAuth(app, purpose = 'general', origin = 'https://test.albukhr.com') {
  const request = new Request('https://test-project.supabase.co/functions/v1/testnet-direct-auth', {
    method: 'POST',
    headers: {
      origin,
      authorization: 'Bearer sandbox-access-token',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ action: 'authenticate', purpose }),
  });
  const response = await app.handler(request);
  return { response, body: await response.json() };
}

test('new general Testnet sign-in provisions a Sandbox-scoped users row and session', async () => {
  const app = makeApp();
  const { response, body } = await postAuth(app);
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.network, 'testnet');
  assert.equal(body.user.uid, app.piUser.uid);
  assert.equal(body.user.testnet_pi_uid, app.piUser.uid);
  assert.equal(app.db.tables.users.length, 1);
  assert.equal(app.db.tables.users[0].network, 'testnet');
  assert.equal(app.db.tables.users[0].pi_uid, app.piUser.uid);
  assert.equal(app.db.tables.users[0].testnet_pi_uid, app.piUser.uid);
  assert.equal(app.db.tables.testnet_sessions.length, 1);
  assert.equal(app.db.tables.testnet_sessions[0].network, 'testnet');
  assert.equal(app.db.tables.testnet_sessions[0].pi_uid, app.piUser.uid);
  assert.equal(app.db.tables.testnet_sessions[0].testnet_pi_uid, app.piUser.uid);
});

test('repeated direct sign-in reuses the same Testnet user and creates a fresh session', async () => {
  const app = makeApp();
  const first = await postAuth(app);
  const second = await postAuth(app);
  assert.equal(first.response.status, 200);
  assert.equal(second.response.status, 200);
  assert.equal(app.db.tables.users.length, 1);
  assert.equal(app.db.tables.testnet_sessions.length, 2);
  assert.equal(second.body.user.uid, app.piUser.uid);
});

test('an existing exact Testnet UID is safely self-linked without creating a second user', async () => {
  const app = makeApp({
    users: [{
      id: 'legacy-testnet-user',
      pi_uid: 'sandbox-uid-001',
      username: 'legacy-user',
      wallet_address: null,
      network: 'testnet',
      testnet_pi_uid: null,
    }],
  });
  const { response, body } = await postAuth(app);
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(app.db.tables.users.length, 1);
  assert.equal(app.db.tables.users[0].testnet_pi_uid, app.piUser.uid);
  assert.equal(app.db.tables.testnet_sessions.length, 1);
});

test('an approved Sandbox-to-canonical mapping remains attached to its canonical user', async () => {
  const app = makeApp({
    users: [{
      id: 'canonical-testnet-user',
      pi_uid: 'canonical-testnet-uid',
      username: 'canonical-user',
      wallet_address: null,
      network: 'testnet',
      testnet_pi_uid: 'sandbox-uid-001',
    }],
  });
  const { response, body } = await postAuth(app);
  assert.equal(response.status, 200);
  assert.equal(body.user.uid, 'canonical-testnet-uid');
  assert.equal(body.user.testnet_pi_uid, app.piUser.uid);
  assert.equal(app.db.tables.users.length, 1);
  assert.equal(app.db.tables.testnet_sessions[0].pi_uid, 'canonical-testnet-uid');
  assert.equal(app.db.tables.testnet_sessions[0].testnet_pi_uid, app.piUser.uid);
});

test('concurrent unique-insert race re-reads and uses the winning Sandbox mapping', async () => {
  const app = makeApp({ raceUserInsert: true });
  const { response, body } = await postAuth(app);
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(app.db.tables.users.length, 1);
  assert.equal(app.db.tables.users[0].testnet_pi_uid, app.piUser.uid);
  assert.equal(app.db.tables.testnet_sessions.length, 1);
});

test('existing account linked to a different Sandbox UID is not overwritten', async () => {
  const app = makeApp({
    users: [{
      id: 'existing-owner-user',
      pi_uid: 'sandbox-uid-001',
      username: 'existing-owner',
      wallet_address: null,
      network: 'testnet',
      testnet_pi_uid: 'different-sandbox-uid',
    }],
  });
  const { response, body } = await postAuth(app);
  assert.equal(response.status, 409);
  assert.equal(body.error, 'TESTNET_USER_ALREADY_LINKED');
  assert.equal(app.db.tables.users[0].testnet_pi_uid, 'different-sandbox-uid');
  assert.equal(app.db.tables.testnet_sessions.length, 0);
});

test('Project Owner unlinked identity stays on the existing Admin-reviewed link path', async () => {
  const app = makeApp();
  const { response, body } = await postAuth(app, 'project_owner');
  assert.equal(response.status, 200);
  assert.equal(body.identity_link_status, 'pending');
  assert.equal(body.identity_link_required_for_existing_owner, true);
  assert.equal(app.db.tables.users.length, 0, 'Owner flow must not create a general user row');
  assert.equal(app.db.tables.testnet_identity_link_requests.length, 1);
});

test('non-unique database insert failure does not create a session or bypass identity storage', async () => {
  const app = makeApp({ failUserInsert: true });
  const { response, body } = await postAuth(app);
  assert.equal(response.status, 500);
  assert.equal(body.error, 'TESTNET_USER_CREATE_FAILED');
  assert.equal(app.db.tables.users.length, 0);
  assert.equal(app.db.tables.testnet_sessions.length, 0);
});

test('foreign browser origin is rejected before Pi verification or database writes', async () => {
  const app = makeApp();
  const { response, body } = await postAuth(app, 'general', 'https://app.albukhr.com');
  assert.equal(response.status, 403);
  assert.equal(body.error, 'CORS_ORIGIN_NOT_ALLOWED');
  assert.equal(app.db.tables.users.length, 0);
  assert.equal(app.db.tables.testnet_sessions.length, 0);
});
