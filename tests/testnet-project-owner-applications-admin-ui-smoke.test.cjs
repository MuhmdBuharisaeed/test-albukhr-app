"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const htmlPath = path.join(root, "project-owner-applications-admin.html");
const cssPath = path.join(root, "css", "testnet-project-owner-applications-admin-ux.css");

function read(file) {
  assert.ok(fs.existsSync(file), `Required file is missing: ${path.relative(root, file)}`);
  return fs.readFileSync(file, "utf8");
}

function checkHtmlNesting(html) {
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  const stack = [];
  const pattern = /<!--[\s\S]*?-->|<![^>]*>|<\/?([a-zA-Z][\w:-]*)\b[^>]*>/g;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const token = match[0];
    if (token.startsWith("<!--") || token.startsWith("<!")) continue;
    const tag = match[1].toLowerCase();
    if (/^<\//.test(token)) {
      const opened = stack.pop();
      assert.equal(opened, tag, `HTML nesting mismatch at </${tag}>; expected </${opened || "none"}>`);
    } else if (!/^<.*\/\s*>$/.test(token) && !voidTags.has(tag)) {
      stack.push(tag);
    }
  }
  assert.deepEqual(stack, [], `Unclosed HTML tags: ${stack.join(", ")}`);
}

function checkCss(css) {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let depth = 0;
  for (const char of source) {
    if (char === "{") depth++;
    if (char === "}") depth--;
    assert.ok(depth >= 0, "Unexpected closing CSS brace");
  }
  assert.equal(depth, 0, "CSS braces are unbalanced");
}

const html = read(htmlPath);
const css = read(cssPath);

const requiredIds = ["queueStatus", "refreshQueue", "applicationQueue"];
const ids = Array.from(html.matchAll(/\bid=["']([^"']+)["']/g), match => match[1]);
for (const id of requiredIds) {
  assert.ok(ids.includes(id), `Required DOM ID missing: ${id}`);
  assert.equal(ids.filter(value => value === id).length, 1, `DOM ID is not unique: ${id}`);
}

const scripts = Array.from(html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi), match => match[1]);
assert.deepEqual(scripts, [
  "js/core/environment-core.js?v=20260921-project3",
  "js/testnet-admin-auth.js?v=20261030-phase4",
  "js/testnet-project-owner-applications-admin.js?v=20261101-collapsible1"
], "Existing script paths, cache-busters, or order changed");
assert.equal(Array.from(html.matchAll(/<script\b/gi)).length, 3, "Unexpected script element added");

assert.match(html, /css\/testnet-project-owner-applications-admin\.css\?v=20261101-collapsible1/);
assert.match(html, /css\/testnet-project-owner-applications-admin-ux\.css\?v=20261111-owner-apps-uiux1/);
assert.match(html, /id=["']queueStatus["'][^>]*role=["']status["']/);
assert.match(html, /id=["']applicationQueue["'][^>]*aria-live=["']polite["']/);

for (const state of ["submitted", "resubmitted", "changes_requested", "approved", "rejected"]) {
  assert.match(css, new RegExp(`\\.application-status\\[data-status=["']${state}["']\\]`), `Missing distinct status style: ${state}`);
}
assert.match(css, /:focus-visible/);
assert.match(css, /prefers-reduced-motion/);
assert.doesNotMatch(css, /display\s*:\s*none\s*;/i, "UX CSS must not hide controls or modules");
assert.doesNotMatch(css, /visibility\s*:\s*hidden\s*;/i, "UX CSS must not hide controls or modules");
assert.doesNotMatch(css, /pointer-events\s*:\s*none\s*;/i, "UX CSS must not disable controls");
checkHtmlNesting(html);
checkCss(css);

console.log("PASS: Testnet Project Owner Applications Admin UI smoke checks");
console.log(`PASS: ${requiredIds.length} required DOM IDs are present and unique`);
console.log("PASS: Existing authentication and application-admin script references are unchanged");
console.log("PASS: Existing page stylesheet and additive UX stylesheet are linked");
console.log("PASS: All five known application statuses have distinct visual styles");
console.log("PASS: Responsive/accessibility rules do not hide or disable controls");
console.log("PASS: HTML nesting and CSS braces are valid");
