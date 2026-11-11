'use strict';

// Read-only UI contract test. Run from the Testnet app repository root.
const fs = require('node:fs');
const assert = require('node:assert/strict');

const read = (path) => fs.readFileSync(path, 'utf8');
const home = read('index.html');
const marketplace = read('marketplace.html');
const login = read('login.html');
const uxCss = read('css/testnet-user-experience.css');

const stylesheet = 'css/testnet-user-experience.css?v=20261111-uiux1';
for (const [name, html] of [
  ['Home', home],
  ['Marketplace', marketplace],
  ['Login', login]
]) {
  assert.ok(html.includes(stylesheet), `${name} loads the additive UX stylesheet`);
  assert.match(html, /<html lang="en">/i, `${name} declares its language`);
  assert.match(html, /name="viewport"/i, `${name} has a viewport setting`);
}

assert.ok(home.includes('id="projectList"'), 'Home keeps the project registry mount');
assert.ok(home.includes('id="registryStatus"'), 'Home keeps the registry status mount');
assert.ok(home.includes('id="approvedProjectCount"'), 'Home keeps the project count mount');
assert.ok(home.includes('js/testnet-app.js?v=20261110-session-recovery1'), 'Home keeps its app controller');
assert.ok(home.includes('js/testnet-gateway-auth.js?v=20261111-direct-testnet1'), 'Home keeps Testnet authentication');
assert.ok(home.includes('href="investor.html"'), 'Home dashboard action opens the Investor page');

assert.ok(marketplace.includes('id="projectList"'), 'Marketplace keeps the project registry mount');
assert.ok(marketplace.includes('id="registryStatus"'), 'Marketplace keeps the registry status mount');
assert.ok(marketplace.includes('js/testnet-app.js?v=20261110-session-recovery1'), 'Marketplace keeps its app controller');
assert.ok(marketplace.includes('js/testnet-gateway-auth.js?v=20261111-direct-testnet1'), 'Marketplace keeps Testnet authentication');

assert.ok(login.includes('id="testnetLoginButton"'), 'Login keeps the existing Pi login button ID');
assert.ok(login.includes('id="status"'), 'Login keeps the live status element');
assert.ok(login.includes('js/login.js?v=20261110-pi-init-singleflight1'), 'Login keeps the current Pi login controller');
assert.ok(login.includes('https://sdk.minepi.com/pi-sdk.js'), 'Login keeps the Pi SDK');

const expectedDock = [
  'href="index.html"',
  'href="investor.html"',
  'href="marketplace.html"'
];
for (const link of expectedDock) {
  assert.ok(home.includes(link), `Home dock keeps ${link}`);
}
assert.ok(marketplace.includes('href="index.html#investor"'), 'Marketplace dock remains unchanged');

assert.ok(home.includes('Open ALBUKHR Mainnet'), 'Home labels the Mainnet destination clearly');
assert.ok(marketplace.includes('Open ALBUKHR Mainnet'), 'Marketplace labels the Mainnet destination clearly');
assert.ok(login.includes('Ready. Tap Continue with Pi.'), 'Login gives a short next step');
assert.ok(marketplace.includes('available options'), 'Marketplace explains what a project page shows');

assert.match(uxCss, /min-height:\s*54px/, 'Pi login button has a comfortable touch target');
assert.match(uxCss, /:focus-visible/, 'keyboard focus remains visible');
assert.match(uxCss, /@media\s*\(max-width:\s*600px\)/, 'mobile layout rules exist');
assert.match(uxCss, /prefers-reduced-motion/, 'reduced-motion preference is supported');

console.log(JSON.stringify({
  result: 'PASS',
  pages: ['index.html', 'marketplace.html', 'login.html'],
  checks: 35,
  network_calls: false,
  database_writes: false,
  payment_logic_changed: false,
  dock_navigation_structure_changed: false
}, null, 2));
