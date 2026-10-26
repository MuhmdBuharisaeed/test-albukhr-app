#!/usr/bin/env python3
"""Patch the ALBUKHR Testnet admin UI to discover and verify pending payments automatically.

Run from the root of a checkout of MuhmdBuharisaeed/test-albukhr-app.
This script edits only four Testnet UI files and never touches Mainnet source files.
"""
from pathlib import Path
import sys

ROOT = Path.cwd()


def read(path: str) -> str:
    full = ROOT / path
    if not full.is_file():
        raise FileNotFoundError(f"Required file not found: {path} (run this script from the repo root)")
    return full.read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8", newline="\n")


def replace_once(text: str, old: str, new: str, label: str, marker: str | None = None) -> str:
    if marker and marker in text:
        return text
    if new in text:
        return text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match; found {count}. No more files should be edited automatically.")
    return text.replace(old, new, 1)


# 1) Replace manual UUID and verification-reference fields with a server-populated queue.
html_path = "admin-dashboard.html"
html = read(html_path)
old_panel = '''  <section class="panel action-panel" aria-labelledby="paymentVerifyTitle">
    <span class="section-kicker">LIQUIDITY PAYMENT VERIFICATION</span>
    <h2 id="paymentVerifyTitle">Verify an Existing Payment Record</h2>
    <p>The dashboard can start a Testnet <code>add_liquidity</code> payment when liquidity is still below the threshold. After Pi server-side completion, the payment record remains pending verification until an authorized admin verifies it.</p>
    <div class="admin-form-grid">
      <label>Payment record ID<input id="paymentRecordId" type="text" autocomplete="off" placeholder="UUID"></label>
      <label>Verification reference<input id="paymentReference" type="text" autocomplete="off" placeholder="Optional reference"></label>
    </div>
    <button id="verifyPaymentButton" class="primary-admin-button" type="button">Verify &amp; Recompute Liquidity</button>
  </section>'''
new_panel = '''  <section class="panel action-panel" aria-labelledby="paymentVerifyTitle">
    <span class="section-kicker">LIQUIDITY PAYMENT VERIFICATION</span>
    <h2 id="paymentVerifyTitle">Pending Payment Verification</h2>
    <p>Completed Testnet liquidity payments are discovered directly from Supabase. Click once to verify pending records against Pi Platform API; the server obtains payment identifiers automatically. Payments that remain unchecked for 24 hours are also processed by the scheduled verifier. Any payment that fails an authoritative Pi check stays pending.</p>
    <div id="verificationQueueSummary" class="page-status" aria-live="polite">Loading pending Testnet payments…</div>
    <div id="paymentQueue" class="verification-queue" aria-live="polite"></div>
    <button id="verifyPaymentButton" class="primary-admin-button" type="button">Verify Pending Payments</button>
  </section>'''
html = replace_once(html, old_panel, new_panel, "HTML verification panel", marker='id="paymentQueue"')
html = html.replace('js/testnet-liquidity.js?v=20260923-admin1', 'js/testnet-liquidity.js?v=20261026-auto-verify1')
html = html.replace('js/testnet-admin-dashboard.js?v=20260923-admin-owner2', 'js/testnet-admin-dashboard.js?v=20261026-auto-verify1')
if 'id="paymentRecordId"' in html or 'id="paymentReference"' in html:
    raise RuntimeError("Manual UUID/reference inputs remain in admin-dashboard.html")
write(html_path, html)

# 2) Remove the UUID requirement from the Testnet liquidity API client.
client_path = "js/testnet-liquidity.js"
client = read(client_path)
old_client = '''  async function verifyPayment(paymentRecordId, reference){
    return request("POST", {
      action: "verify_payment",
      payment_record_id: clean(paymentRecordId),
      verification_reference: clean(reference)
    });
  }'''
new_client = '''  async function verifyPayment(){
    return request("POST", {action:"verify_payment"});
  }'''
client = replace_once(client, old_client, new_client, "API client verifier", marker='return request("POST", {action:"verify_payment"});')
client = client.replace('/* ALBUKHR TESTNET LIQUIDITY ADMIN API v2 */', '/* ALBUKHR TESTNET LIQUIDITY ADMIN API v3 — AUTO DISCOVERY */')
write(client_path, client)

# 3) Render pending records returned by the Testnet admin Edge Function and verify them in one click.
dashboard_path = "js/testnet-admin-dashboard.js"
js = read(dashboard_path)
js = js.replace('/* ALBUKHR TESTNET ADMIN DASHBOARD v4 — OWNER/AUTH PAYMENT SEPARATION */', '/* ALBUKHR TESTNET ADMIN DASHBOARD v5 — AUTOMATIC PAYMENT DISCOVERY */')
queue_renderer = '''  function renderVerificationQueue(){
    var host=el("paymentQueue"), summary=el("verificationQueueSummary");
    if(!host) return;
    host.replaceChildren();
    var pending=[];
    rows.forEach(function(row){
      var project=row.project||{};
      (Array.isArray(row.payments)?row.payments:[]).forEach(function(payment){
        if(clean(payment.network).toLowerCase()!=="testnet") return;
        if(clean(payment.action)!=="add_liquidity") return;
        if(clean(payment.pi_status).toLowerCase()!=="completed") return;
        if(clean(payment.verification_status).toLowerCase()!=="pending") return;
        pending.push({
          projectName:clean(project.name||project.project_code||"Project"),
          projectCode:clean(project.project_code||"—"),
          amount:Number(payment.amount||0),
          createdAt:clean(payment.created_at)
        });
      });
    });
    pending.sort(function(a,b){
      var at=Date.parse(a.createdAt)||0, bt=Date.parse(b.createdAt)||0;
      return at-bt;
    });
    if(summary){
      summary.textContent=pending.length
        ? pending.length+" completed Testnet payment"+(pending.length===1?"":"s")+" awaiting verification. UUIDs are loaded automatically."
        : "No completed, pending Testnet liquidity payments are currently in the queue.";
    }
    if(!pending.length){
      var empty=document.createElement("div");
      empty.className="verification-empty";
      empty.textContent="No manual UUID entry is required. Refresh to check the latest Testnet records.";
      host.appendChild(empty);
      return;
    }
    pending.forEach(function(payment){
      var card=document.createElement("article"); card.className="verification-item";
      var left=document.createElement("div"); left.className="verification-item-name";
      var name=document.createElement("strong"); name.textContent=payment.projectName;
      var code=document.createElement("small"); code.textContent=payment.projectCode;
      var meta=document.createElement("span"); meta.className="verification-item-meta";
      var date=payment.createdAt?new Date(payment.createdAt):null;
      meta.textContent="Created: "+(date&&!Number.isNaN(date.getTime())?date.toLocaleString():"date unavailable");
      left.appendChild(name); left.appendChild(code); left.appendChild(meta);
      var amount=document.createElement("strong"); amount.className="verification-item-amount";
      amount.textContent=pi(payment.amount);
      card.appendChild(left); card.appendChild(amount); host.appendChild(card);
    });
  }

'''
js = replace_once(js, '  function render(){', queue_renderer + '  function render(){', "insert payment queue renderer", marker='function renderVerificationQueue(){')
js = replace_once(js,
'''    el("emptyState").hidden=rows.length>0;
  }''',
'''    el("emptyState").hidden=rows.length>0;
    renderVerificationQueue();
  }''',
"refresh pending queue from project list", marker='renderVerificationQueue();')
js = replace_once(js,
'''    var recordId=clean(result && result.record && result.record.id);
    if(recordId && el("paymentRecordId")) el("paymentRecordId").value=recordId;
    status(recordId ? "Pi payment completed. Verification is pending. Payment record ID has been placed below." : "Pi payment completed. Verification is pending.");
    await load();''',
'''    await load();
    status("Pi payment callback completed. The record is detected from Supabase automatically; verification still depends on Pi Platform checks.");''',
"remove manual UUID assignment after funding", marker='The record is detected from Supabase automatically;')
old_verify = '''  async function verifyPayment(){
    var record=el("paymentRecordId"), reference=el("paymentReference");
    var id=clean(record&&record.value), ref=clean(reference&&reference.value);
    if(!id){ status("Enter a liquidity payment record ID.",true); return; }
    try{
      el("verifyPaymentButton").disabled=true;
      status("Verifying liquidity payment record…");
      await window.AlbukhrTestnetLiquidity.verifyPayment(id,ref);
      if(record) record.value=""; if(reference) reference.value="";
      await load();
    }catch(error){ console.error(error); status("Payment verification failed: "+(error.message||error),true); }
    finally{ el("verifyPaymentButton").disabled=false; }
  }'''
new_verify = '''  async function verifyPayment(){
    var button=el("verifyPaymentButton");
    try{
      button.disabled=true;
      status("Checking pending Testnet payments against Pi Platform API…");
      var result=await window.AlbukhrTestnetLiquidity.verifyPayment();
      await load();
      var considered=Number(result&&result.considered||0);
      var verified=Number(result&&result.verified||0);
      var pendingCount=Number(result&&result.pending_or_failed||0);
      if(considered===0){
        status("No completed pending payment records were found. Nothing was changed.",false);
      }else if(verified>0 && pendingCount===0){
        status("Pi Platform verification succeeded for "+verified+" payment"+(verified===1?"":"s")+"; Testnet liquidity was recomputed.",false);
      }else if(verified>0){
        status("Verified "+verified+" payment"+(verified===1?"":"s")+"; "+pendingCount+" remain pending because one or more authoritative Pi checks did not pass.",true);
      }else{
        status("Checked "+considered+" payment"+(considered===1?"":"s")+"; none passed all Pi Platform checks. The records remain pending.",true);
      }
    }catch(error){
      console.error(error);
      status("Payment verification failed: "+(error.message||error),true);
    }finally{
      button.disabled=false;
    }
  }'''
js = replace_once(js, old_verify, new_verify, "UUID-free Verify button handler", marker='var result=await window.AlbukhrTestnetLiquidity.verifyPayment();')
if 'paymentRecordId' in js or 'paymentReference' in js:
    raise RuntimeError("Dashboard JavaScript still references manual UUID/reference inputs")
write(dashboard_path, js)

# 4) Styles for the detected-payment queue.
css_path = "css/testnet-admin.css"
css = read(css_path)
if ".verification-queue{" not in css:
    css += '''

/* Automatic Testnet liquidity verification queue */
.verification-queue{display:grid;gap:8px;margin:12px 0}
.verification-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 12px;border:1px solid #e0ece5;border-radius:12px;background:#fbfefc}
.verification-item-name{display:grid;gap:3px;min-width:0}
.verification-item-name strong{color:#24392d;font-size:11px;overflow-wrap:anywhere}
.verification-item-name small{color:#7a877f;font-size:9px}
.verification-item-meta{color:#839087;font-size:9px;line-height:1.4}
.verification-item-amount{color:#0f7a3d;font-size:12px;white-space:nowrap;font-variant-numeric:tabular-nums}
.verification-empty{padding:12px;border:1px dashed #dce9e1;border-radius:12px;background:#fbfefc;color:#718078;font-size:10px;line-height:1.5}
'''
write(css_path, css)

# Postconditions: don't silently leave the manual-ID workflow in place.
final_html = read(html_path)
final_js = read(dashboard_path)
final_client = read(client_path)
if 'id="paymentRecordId"' in final_html or 'id="paymentReference"' in final_html:
    raise RuntimeError("Post-check failed: manual ID inputs remain")
if 'id="paymentQueue"' not in final_html or 'function renderVerificationQueue()' not in final_js:
    raise RuntimeError("Post-check failed: payment queue is not wired")
if 'window.AlbukhrTestnetLiquidity.verifyPayment()' not in final_js:
    raise RuntimeError("Post-check failed: Verify button is not UUID-free")
if 'payment_record_id: clean(paymentRecordId)' in final_client:
    raise RuntimeError("Post-check failed: API client still submits manual UUID")
print("Patched Testnet UI only:")
for path in [html_path, dashboard_path, client_path, css_path]:
    print(" -", path)
print("No Mainnet files were modified.")
