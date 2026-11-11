'use strict';

// ALBUKHR Testnet Admin Dashboard UI structure regression.
// Static-only checks: no browser, network, API, Supabase or database access.

const fs = require('node:fs');
const assert = require('node:assert/strict');

const html = fs.readFileSync('admin-dashboard.html', 'utf8');
const css = fs.readFileSync('css/testnet-admin-dashboard-ux.css', 'utf8');

const requiredIds = [
  'logoutButton',
  'adminEmail',
  'adminRoles',
  'approvedCount',
  'readyCount',
  'pendingCount',
  'verifiedTotal',
  'ownershipManagementLink',
  'ownerApplicationsReviewLink',
  'ownershipStatus',
  'refreshButton',
  'projectLiquidityTitle',
  'pageStatus',
  'projectRows',
  'emptyState',
  'verificationQueueSummary',
  'paymentQueue',
  'verifyPaymentButton',
  'rulesTitle'
];

for (const id of requiredIds) {
  assert.match(
    html,
    new RegExp(`\\bid="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`),
    `Required dashboard DOM ID must remain: ${id}`
  );
}

const idMatches = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(
  idMatches.length,
  new Set(idMatches).size,
  'Dashboard HTML must not contain duplicate IDs'
);

// Keep all current script references and cache-busters unchanged.
const expectedScripts = [
  'js/core/environment-core.js?v=20260923-admin-owner1',
  'https://sdk.minepi.com/pi-sdk.js',
  'js/testnet-admin-auth.js?v=20260923-admin-owner1',
  'js/testnet-admin-owner-applications-link.js?v=20261030-phase4',
  'js/testnet-liquidity.js?v=20261026-auto-verify2',
  'js/testnet-liquidity-payment.js?v=20261102-admin-cancel1',
  'js/testnet-admin-dashboard.js?v=20261103-project-target1',
  'js/testnet-project-staking-stage-admin.js?v=20261104-stage-admin-v2',
  'js/testnet-project-staking-risk-admin.js?v=20261104-universal-risk-v1',
  'js/testnet-global-transaction-control-admin.js?v=20261106-global-controls-v1'
];
const actualScripts = [...html.matchAll(/<script\s+src="([^"]+)"\s*><\/script>/g)]
  .map(match => match[1]);

assert.deepEqual(
  actualScripts,
  expectedScripts,
  'Existing admin scripts, order and cache-busters must remain unchanged'
);

// Keep the original styles and load the new additive dashboard stylesheet.
assert.match(html, /href="css\/testnet\.css"/);
assert.match(html, /href="css\/testnet-admin\.css"/);
assert.match(
  html,
  /href="css\/testnet-admin-dashboard-ux\.css\?v=20261111-admin-uiux1"/
);
assert.match(html, /<body\b[^>]*data-page="testnet-admin-dashboard"/);
assert.match(html, /data-network="testnet"/);

// The payment section must be a single, standalone section.
assert.equal(
  (html.match(/class="panel action-panel payment-verification-panel"/g) || []).length,
  1,
  'Exactly one payment verification panel must exist'
);
assert.match(html, /id="paymentVerifyTitle"/);
assert.match(html, /id="verificationQueueSummary"/);
assert.match(html, /id="paymentQueue"/);
assert.match(html, /id="verifyPaymentButton"/);
assert.doesNotMatch(
  html,
  /<section[^>]*class="panel action-panel"[^>]*>\s*<section/,
  'Payment verification must not contain a duplicate nested panel'
);

// The modules use main + rules-panel as insertion anchors.
assert.match(html, /<main class="admin-main">/);
assert.match(html, /<section class="panel rules-panel" aria-labelledby="rulesTitle">/);
assert.match(html, /id="rulesTitle"/);

// Lightweight HTML nesting validator for this static page.
const voidTags = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img',
  'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'
]);
const tokens = html.match(/<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>/g) || [];
const stack = [];
const directParents = new Map();

for (const token of tokens) {
  if (token.startsWith('<!--') || /^<!/i.test(token)) continue;

  const closing = token.match(/^<\/\s*([A-Za-z][\w:-]*)\s*>$/);
  if (closing) {
    const name = closing[1].toLowerCase();
    assert.equal(
      stack.at(-1),
      name,
      `Misnested HTML closing tag </${name}>; current open element is <${stack.at(-1) || 'none'}>`
    );
    stack.pop();
    continue;
  }

  const opening = token.match(/^<\s*([A-Za-z][\w:-]*)\b([^>]*)>$/);
  if (!opening) continue;

  const name = opening[1].toLowerCase();
  const attrs = opening[2];
  if (name === 'section' && /class="[^"]*\brules-panel\b/.test(attrs)) {
    directParents.set('rules-panel', stack.at(-1));
  }
  if (name === 'section' && /class="[^"]*\bpayment-verification-panel\b/.test(attrs)) {
    directParents.set('payment-verification-panel', stack.at(-1));
  }

  if (!voidTags.has(name) && !/\/\s*>$/.test(token)) {
    stack.push(name);
  }
}

assert.deepEqual(stack, [], 'All HTML elements must be properly closed');
assert.equal(
  directParents.get('rules-panel'),
  'main',
  'Rules Panel must remain a direct child of main for existing module insertion'
);
assert.equal(
  directParents.get('payment-verification-panel'),
  'main',
  'Payment Verification must remain a direct child of main'
);

// The new CSS must be page-scoped and must not hide or disable admin modules.
assert.match(css, /body\[data-page="testnet-admin-dashboard"\]/);
assert.match(css, /#albukhrTestnetStakingStageManager/);
assert.match(css, /#albukhrTestnetStakingRiskControls/);
assert.match(css, /#albukhrTestnetGlobalTransactionControls/);
assert.doesNotMatch(css, /display\s*:\s*none\b/i);
assert.doesNotMatch(css, /visibility\s*:\s*hidden\b/i);
assert.doesNotMatch(css, /pointer-events\s*:\s*none\b/i);

const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
assert.equal(
  (cssWithoutComments.match(/\{/g) || []).length,
  (cssWithoutComments.match(/\}/g) || []).length,
  'Dashboard UX CSS braces must be balanced'
);

// Financial and security explanations must remain visible in the source.
assert.match(html, /Testnet only/);
assert.match(html, /No Mainnet investment or transaction records are read or changed/);
assert.match(html, /Failed checks remain pending and do not count/);
assert.match(html, /Only projects with <b>approved<\/b> status/);
assert.match(html, /100 PI is the global minimum floor/);

const checks = {
  required_dom_ids: requiredIds.length,
  unique_dom_ids: true,
  existing_script_references_and_order: true,
  payment_panel_structure: true,
  rules_panel_module_anchor: true,
  html_nesting: true,
  stage_risk_global_controls_styling: true,
  dashboard_css_scope: true,
  no_hidden_admin_modules: true,
  security_and_financial_notices: true,
  network_calls: false,
  database_writes: false
};

console.log(JSON.stringify({
  suite: 'ALBUKHR Testnet Admin Dashboard UI Regression',
  checks,
  result: 'PASS'
}, null, 2));
