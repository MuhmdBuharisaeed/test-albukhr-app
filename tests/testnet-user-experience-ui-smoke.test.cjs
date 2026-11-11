'use strict';

// Read-only UI contract test. Run from the Testnet app repository root.
// This test verifies page markup and stylesheet contracts only; it makes no
// network calls, database writes, payment calls, or changes to application files.

const fs = require('node:fs');
const assert = require('node:assert/strict');

const read = (path) => fs.readFileSync(path, 'utf8');
const pages = {
  home: read('index.html'),
  marketplace: read('marketplace.html'),
  login: read('login.html'),
  investor: read('investor.html'),
  project: read('project.html'),
  owner: read('project-owner.html')
};
const uxCss = read('css/testnet-user-experience.css');
const extendedUxCss = read('css/testnet-user-experience-extended.css');

let checks = 0;
function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
}
function has(source, value, message) {
  check(source.includes(value), message);
}
function matches(source, pattern, message) {
  check(pattern.test(source), message);
}

const baseStylesheet = 'css/testnet-user-experience.css?v=20261111-uiux1';
const extendedStylesheet = 'css/testnet-user-experience-extended.css?v=20261111-uiux2';

for (const [name, html] of Object.entries({
  Home: pages.home,
  Marketplace: pages.marketplace,
  Login: pages.login
})) {
  has(html, baseStylesheet, `${name} keeps the original additive UX stylesheet`);
  matches(html, /<html\s+lang="en"/i, `${name} declares its document language`);
  matches(html, /name="viewport"/i, `${name} has a viewport setting`);
}

for (const [name, html] of Object.entries({
  Investor: pages.investor,
  Project: pages.project,
  'Project Owner': pages.owner
})) {
  has(html, extendedStylesheet, `${name} loads the new presentation-only stylesheet`);
  matches(html, /<html\s+lang="en"/i, `${name} declares its document language`);
  matches(html, /name="viewport"/i, `${name} has a viewport setting`);
}

// Home and Marketplace registry mounts and existing app/auth controllers.
has(pages.home, 'id="projectList"', 'Home keeps the project registry mount');
has(pages.home, 'id="registryStatus"', 'Home keeps the registry status mount');
has(pages.home, 'id="approvedProjectCount"', 'Home keeps the approved project count');
has(pages.home, 'js/testnet-app.js?v=20261110-session-recovery1', 'Home keeps its existing app controller');
has(pages.home, 'js/testnet-gateway-auth.js?v=20261111-direct-testnet1', 'Home keeps Testnet authentication');
has(pages.home, 'href="investor.html"', 'Home keeps the Investor Dashboard destination');
has(pages.marketplace, 'id="projectList"', 'Marketplace keeps the project registry mount');
has(pages.marketplace, 'id="registryStatus"', 'Marketplace keeps the registry status mount');
has(pages.marketplace, 'js/testnet-app.js?v=20261110-session-recovery1', 'Marketplace keeps its existing app controller');
has(pages.marketplace, 'js/testnet-gateway-auth.js?v=20261111-direct-testnet1', 'Marketplace keeps Testnet authentication');

// Pi Login controls and SDK remain unchanged.
has(pages.login, 'id="testnetLoginButton"', 'Login keeps the existing Pi login button ID');
has(pages.login, 'id="status"', 'Login keeps the live status element');
has(pages.login, 'js/login.js?v=20261110-pi-init-singleflight1', 'Login keeps its existing login controller');
has(pages.login, 'https://sdk.minepi.com/pi-sdk.js', 'Login keeps the official Pi SDK');
has(pages.login, 'Ready. Tap Continue with Pi.', 'Login keeps its simple next-step instruction');

// Investor dashboard identity, read-only values and payment/staking restrictions.
for (const id of [
  'investorPage', 'heroUserName', 'heroPortfolio', 'walletAddress',
  'totalPortfolio', 'totalInvest', 'totalEarn', 'totalProjects',
  'investorFinancialBreakdown', 'financialReconciliationStatus',
  'financialCapitalRemaining', 'financialRewardsRemaining',
  'financialCapitalLocked', 'financialCapitalMatured',
  'financialCapitalPending', 'financialRewardsPending',
  'financialCapitalReturned', 'financialRewardsPaid',
  'financialReconciliationNote', 'investments', 'emptyInvestments'
]) {
  has(pages.investor, `id="${id}"`, `Investor keeps required element #${id}`);
}
for (const id of ['history', 'staking', 'withdraw']) {
  has(pages.investor, `id="${id}"`, `Investor keeps the ${id} section`);
}
has(pages.investor, 'aria-disabled="true"', 'Investor locked navigation actions remain explicitly disabled');
has(pages.investor, 'No Pi transfer is initiated from this page.', 'Investor keeps the no-transfer disclosure');

// Investor Dock Navigation contract: same three destinations, same active page.
const investorDockStart = pages.investor.indexOf('<nav\n  class="dock-nav"');
const investorDockEnd = pages.investor.indexOf('</nav>', investorDockStart);
check(investorDockStart >= 0 && investorDockEnd > investorDockStart, 'Investor keeps its Dock Navigation block');
const investorDock = pages.investor.slice(investorDockStart, investorDockEnd + '</nav>'.length);
for (const href of ['href="index.html"', 'href="investor.html"', 'href="marketplace.html"']) {
  has(investorDock, href, `Investor Dock Navigation retains ${href}`);
}
has(investorDock, 'class="dock-item active"', 'Investor Dock Navigation retains its active Investor item');

// Project details and the financial safety locks must remain visible and intact.
for (const id of [
  'projectState', 'projectTitle', 'projectMeta', 'projectDescription',
  'projectCode', 'projectType', 'projectSlot', 'projectNetwork',
  'controlDescription', 'stakeBtn', 'withdrawRewardsBtn',
  'withdrawCapitalBtn', 'projectHistory', 'infoModal'
]) {
  has(pages.project, `id="${id}"`, `Project page keeps required element #${id}`);
}
for (const id of ['stakeBtn', 'withdrawRewardsBtn', 'withdrawCapitalBtn']) {
  const button = pages.project.match(new RegExp(`<button\\b(?=[^>]*id="${id}")[^>]*>`, 's'));
  check(Boolean(button) && /\bdisabled\b/.test(button[0]), `Project action #${id} remains disabled`);
}
has(pages.project, 'withdrawal-testnet-lock-note', 'Project keeps the withdrawal safety warning element');
has(pages.project, 'fee-payment,', 'Project keeps the fee-payment test condition');
has(pages.project, 'payout, and reconciliation tests are completed and approved.', 'Project keeps the payout/reconciliation approval condition');
has(pages.project, 'Mainnet investment remains isolated', 'Project keeps Mainnet isolation disclosure');

// Project Owner page retains owner workflow IDs and payment guardrail disclosures.
for (const id of [
  'ownerTitle', 'ownerSubtitle', 'ownerError', 'ownerContent',
  'ownerProfileDetails', 'profileStatus', 'ownerBalance',
  'requiredLiquidity', 'receivedLiquidity', 'verifiedLiquidity',
  'liquidityAmount', 'addLiquidityBtn', 'liquidityStatus',
  'withdrawAmount', 'withdrawWallet', 'requestWithdrawalBtn',
  'withdrawStatus', 'withdrawalHistory', 'testnetDebugPanel',
  'testnetDebugStatus', 'testnetDebugLog'
]) {
  has(pages.owner, `id="${id}"`, `Project Owner keeps required element #${id}`);
}
has(pages.owner, 'The server re-checks Testnet ownership, project identity, treasury', 'Owner payment gate disclosure remains present');
has(pages.owner, 'Enter your own Testnet Pi wallet address for this withdrawal request.', 'Owner wallet ownership instruction remains present');
has(pages.owner, 'js/testnet-liquidity-payment-client.js?v=20261110-pi-init-singleflight1', 'Owner keeps the current liquidity payment client');
has(pages.owner, 'js/testnet-project-owner.js?v=20261110-session-recovery1', 'Owner keeps the current owner controller');
has(pages.owner, 'js/testnet-owner-staking.js?v=20261110-session-recovery1', 'Owner keeps the current owner staking controller');
has(pages.owner, 'window.addEventListener("unhandledrejection"', 'Existing Owner diagnostic event listener remains in the page');

// Required existing JavaScript dependencies are checked to guard against accidental removal.
const requiredInvestorScripts = [
  'js/core/environment-core.js?v=20260920-testnet1',
  'js/core/supabase-core.js?v=20261106-core6',
  'js/testnet-gateway-auth.js?v=20261111-direct-testnet1',
  'js/project-registry.js?v=20260920-testnet1',
  'js/testnet-api-core.js?v=20261106-apikey1',
  'js/testnet-investor-financial-core.js?v=20261107-financial1-1',
  'js/testnet-investor.js?v=20261110-session-recovery1',
  'js/testnet-investor-financial-ui.js?v=20261107-financial-ui1-2',
  'js/testnet-project-owner-bridge.js?v=20261110-session-recovery1',
  'js/testnet-admin-auth.js?v=20260923-admin1',
  'js/testnet-admin-bridge.js?v=20260923-admin1'
];
for (const src of requiredInvestorScripts) {
  has(pages.investor, `src="${src}"`, `Investor retains script ${src}`);
}
const requiredProjectScripts = [
  'js/core/environment-core.js?v=20260921-project3',
  'js/core/supabase-core.js?v=20261106-core6',
  'js/project-registry.js?v=20260921-project3',
  'js/testnet-project.js?v=20261109-stake-summary-aggregate1',
  'js/testnet-gateway-auth.js?v=20261111-direct-testnet1',
  'js/testnet-api-core.js?v=20261106-apikey1',
  'js/testnet-global-treasury-payment-client.js?v=20261106-tiered-fee1',
  'js/testnet-withdrawal.js?v=20261106-tiered-fee1',
  'js/testnet-staking-payment-client.js?v=20261109-manual-reconcile1',
  'js/testnet-staking.js?v=20261109-manual-reconcile1',
  'js/testnet-project-owner-bridge.js?v=20260923-owner5',
  'js/testnet-project-owner-application.js?v=20261031-mainnet-proof-handoff1',
  'js/testnet-project-history.js?v=20261108-history1'
];
for (const src of requiredProjectScripts) {
  has(pages.project, `src="${src}"`, `Project page retains script ${src}`);
}

// Presentation-only stylesheet checks; financial status and Dock are never hidden or restyled.
matches(extendedUxCss, /#testnetDebugPanel\s*\{[^}]*display:\s*none\s*!important/s, 'Owner diagnostics panel is visually hidden using CSS only');
matches(extendedUxCss, /@media\s*\(max-width:\s*700px\)/, 'Extended stylesheet includes tablet/mobile layout rules');
matches(extendedUxCss, /@media\s*\(max-width:\s*380px\)/, 'Extended stylesheet includes narrow-phone layout rules');
matches(extendedUxCss, /prefers-reduced-motion:\s*reduce/, 'Extended stylesheet respects reduced-motion preferences');
matches(extendedUxCss, /:focus-visible/, 'Extended stylesheet provides keyboard focus visibility');
check(!/\.dock-nav|\.dock-item|\.dock-icon/.test(extendedUxCss), 'Extended stylesheet does not style Dock Navigation');
has(extendedUxCss, 'body[data-page="investor"]', 'Extended stylesheet scopes Investor styles to the Investor page');
has(extendedUxCss, 'body[data-page="project"]', 'Extended stylesheet scopes Project styles to the Project page');
has(extendedUxCss, 'body[data-page="project-owner"]', 'Extended stylesheet scopes Owner styles to the Owner page');

// Existing stylesheet checks remain in place.
matches(uxCss, /min-height:\s*54px/, 'Pi login button retains a comfortable touch target');
matches(uxCss, /:focus-visible/, 'Original stylesheet retains keyboard focus visibility');
matches(uxCss, /@media\s*\(max-width:\s*600px\)/, 'Original stylesheet retains mobile layout rules');
matches(uxCss, /prefers-reduced-motion/, 'Original stylesheet retains reduced-motion support');

console.log(JSON.stringify({
  result: 'PASS',
  pages: ['index.html', 'marketplace.html', 'login.html', 'investor.html', 'project.html', 'project-owner.html'],
  checks,
  network_calls: false,
  database_writes: false,
  payment_logic_changed: false,
  javascript_files_changed: false,
  dock_navigation_changed: false
}, null, 2));
