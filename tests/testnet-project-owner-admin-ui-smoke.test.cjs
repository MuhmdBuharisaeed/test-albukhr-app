"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const htmlPath = path.join(root, "project-owner-admin.html");
const cssPath = path.join(root, "css", "testnet-project-owner-admin-ux.css");

function readFile(filePath) {
  assert.ok(fs.existsSync(filePath), `Required file is missing: ${path.relative(root, filePath)}`);
  return fs.readFileSync(filePath, "utf8");
}

function countMatches(text, pattern) {
  return Array.from(text.matchAll(pattern)).length;
}

function checkHtmlNesting(html) {
  const voidTags = new Set([
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr"
  ]);
  const stack = [];
  const tokenPattern = /<!--[\s\S]*?-->|<![^>]*>|<\/?([a-zA-Z][\w:-]*)\b[^>]*>/g;
  let match;

  while ((match = tokenPattern.exec(html)) !== null) {
    const token = match[0];
    if (token.startsWith("<!--") || token.startsWith("<!")) continue;

    const tag = match[1].toLowerCase();
    const isClosing = /^<\//.test(token);
    const selfClosing = /\/\s*>$/.test(token);

    if (isClosing) {
      const open = stack.pop();
      assert.equal(open, tag, `HTML tag nesting mismatch: closing </${tag}> but expected </${open || "none"}>`);
    } else if (!selfClosing && !voidTags.has(tag)) {
      stack.push(tag);
    }
  }

  assert.deepEqual(stack, [], `Unclosed HTML tags: ${stack.join(", ")}`);
}

function checkCssBraces(css) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let depth = 0;
  for (const char of withoutComments) {
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    assert.ok(depth >= 0, "CSS has an unexpected closing brace");
  }
  assert.equal(depth, 0, "CSS braces are not balanced");
}

const html = readFile(htmlPath);
const css = readFile(cssPath);

// All IDs consumed by the existing owner-admin and identity-link scripts remain present and unique.
const requiredIds = [
  "logoutButton",
  "adminEmail",
  "adminRoles",
  "approvedCount",
  "assignedCount",
  "unassignedCount",
  "verifiedCount",
  "refreshIdentityLinkQueue",
  "identityLinkTitle",
  "identityLinkStatus",
  "identityLinkQueue",
  "ownershipTitle",
  "refreshButton",
  "pageStatus",
  "projectCards",
  "emptyState",
  "historyTitle",
  "historyRows",
  "historyEmpty"
];

const foundIds = Array.from(html.matchAll(/\bid=["']([^"']+)["']/g), (match) => match[1]);
for (const id of requiredIds) {
  assert.ok(foundIds.includes(id), `Required DOM ID is missing: ${id}`);
  assert.equal(foundIds.filter((value) => value === id).length, 1, `DOM ID must be unique: ${id}`);
}

// Testnet environment identity and authoritative ownership/security disclosure remain intact.
assert.match(html, /<body\b[^>]*data-page=["']testnet-project-owner-admin["']/i);
assert.match(html, /data-network=["']testnet["']/i);
assert.match(html, /Ownership source of truth/i);
assert.match(html, /projects\.owner_user_id/);
assert.match(html, /written to the Testnet audit history/i);
assert.match(html, /Server enforced/i);
assert.match(html, /SUPER ADMIN/);

// Existing stylesheet references and all four script references remain exact and in order.
const expectedScripts = [
  "js/core/environment-core.js?v=20260923-owneradmin1",
  "js/testnet-admin-auth.js?v=20260923-owneradmin1",
  "js/testnet-project-owner-admin.js?v=20261101-owner-collapsible1",
  "js/testnet-project-owner-identity-links-admin.js?v=20261102-identity-links1"
];
const foundScripts = Array.from(html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi), (match) => match[1]);
assert.deepEqual(foundScripts, expectedScripts, "Existing script references, cache-busters, or order changed");
assert.equal(countMatches(html, /<script\b/gi), expectedScripts.length, "Unexpected script element added");
assert.equal(countMatches(html, /<script\b[^>]*\bsrc=/gi), expectedScripts.length, "Unexpected inline script or missing external script");

const expectedStylesheets = [
  "css/testnet.css",
  "css/testnet-admin.css",
  "css/testnet-project-owner-admin.css?v=20261102-identity-links1",
  "css/testnet-project-owner-admin-ux.css?v=20261111-owner-uiux1"
];
const foundStylesheets = Array.from(html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi), (match) => match[1]);
assert.deepEqual(foundStylesheets, expectedStylesheets, "Expected stylesheet order or reference changed");

// Structural anchors used by the existing scripts remain in the document.
assert.match(html, /id=["']identityLinkQueue["'][^>]*class=["']identity-link-queue["']/);
assert.match(html, /id=["']projectCards["'][^>]*class=["']owner-project-list["']/);
assert.match(html, /class=["']table-wrap["']/);
assert.match(html, /class=["']history-table["']/);
checkHtmlNesting(html);

// Additive CSS must be page-scoped, responsive, readable, and must not hide admin controls.
assert.match(css, /body\[data-page=["']testnet-project-owner-admin["']\]/);
assert.match(css, /@media\s*\(max-width:\s*520px\)/);
assert.match(css, /\.environment-badge\s*\{/);
assert.match(css, /\.history-table\s*\{/);
assert.match(css, /:focus-visible/);
assert.match(css, /prefers-reduced-motion/);
assert.doesNotMatch(css, /display\s*:\s*none\s*;/i, "UI CSS must not hide admin modules or controls");
assert.doesNotMatch(css, /visibility\s*:\s*hidden\s*;/i, "UI CSS must not hide admin modules or controls");
assert.doesNotMatch(css, /pointer-events\s*:\s*none\s*;/i, "UI CSS must not disable admin controls");
checkCssBraces(css);

console.log("PASS: Testnet Project Ownership Admin UI smoke checks");
console.log(`PASS: ${requiredIds.length} required DOM IDs are present and unique`);
console.log("PASS: Testnet identity, Super Admin boundary, and ownership audit disclosure remain present");
console.log("PASS: Existing JavaScript script references, cache-busters, and order are unchanged");
console.log("PASS: Existing stylesheets remain linked and the additive UX stylesheet is included");
console.log("PASS: Responsive styles do not hide modules or disable controls");
console.log("PASS: HTML structure and CSS braces are balanced");
