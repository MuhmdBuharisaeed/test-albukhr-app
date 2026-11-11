const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CACHE_VERSION = '20261111-direct-testnet1';
const PAGES = [
  'index.html',
  'investor.html',
  'marketplace.html',
  'project-owner.html',
  'project.html'
];

test('all normal Testnet entry pages load the direct-recovery gateway version', () => {
  for (const page of PAGES) {
    const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
    assert.match(
      html,
      new RegExp(`js/testnet-gateway-auth\\.js\\?v=${CACHE_VERSION}`),
      `${page} must load the new direct Testnet gateway code`
    );
  }
});

test('Testnet login route remains local and the gateway does not replace the optional Mainnet URL', () => {
  const gateway = fs.readFileSync(
    path.join(ROOT, 'js/testnet-gateway-auth.js'),
    'utf8'
  );
  assert.ok(gateway.includes('var TESTNET_LOGIN_PATH =\n    "/login.html";'));
  assert.match(gateway, /mainnetLogin:\s*MAINNET_LOGIN/);
  assert.match(gateway, /buildTestnetLoginUrl:\s*buildTestnetLoginUrl/);
});
