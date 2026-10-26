/* ALBUKHR TESTNET ADMIN DASHBOARD v4 — OWNER/AUTH PAYMENT SEPARATION */
(function(window, document){
  "use strict";

  var initialized = false;
  var rows = [];

  function el(id){ return document.getElementById(id); }
  function clean(v){ return String(v == null ? "" : v).trim(); }
  function pi(v){ var n = Number(v); if(!Number.isFinite(n)) n=0; return n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:4}) + " Pi"; }
  function status(message, error){ var n=el("pageStatus"); if(n){ n.textContent=clean(message); n.className="page-status"+(error?" error":""); } }

  function isSuperAdmin(session){
    var roles = session && session.admin && session.admin.roles;
    return Array.isArray(roles) && roles.some(function(role){ return clean(role).toLowerCase()==="super_admin"; });
  }

  function setupOwnershipAccess(session){
    var link=el("ownershipManagementLink"), note=el("ownershipStatus");
    var allowed=isSuperAdmin(session);
    if(link) link.hidden=!allowed;
    if(note){
      note.textContent=allowed
        ? "Super Admin access confirmed. Project ownership and team identity management is available."
        : "Project ownership management is restricted to Super Admin.";
      note.className="page-status"+(allowed?"":" error");
    }
  }

  function renderVerificationQueue(){
  var host = el("paymentQueue");
  var summary = el("verificationQueueSummary");

  if (!host) return;

  host.replaceChildren();

  var pending = [];

  rows.forEach(function(row){
    var project = row.project || {};

    (Array.isArray(row.payments) ? row.payments : [])
      .forEach(function(payment){

        if (clean(payment.network).toLowerCase() !== "testnet") return;
        if (clean(payment.action) !== "add_liquidity") return;
        if (clean(payment.pi_status).toLowerCase() !== "completed") return;
        if (clean(payment.verification_status).toLowerCase() !== "pending") return;

        pending.push({
          projectName: clean(
            project.name || project.project_code || "Project"
          ),
          projectCode: clean(project.project_code || "—"),
          amount: Number(payment.amount || 0),
          createdAt: clean(payment.created_at)
        });
      });
  });

  pending.sort(function(a, b){
    return (Date.parse(a.createdAt) || 0) -
           (Date.parse(b.createdAt) || 0);
  });

  if (summary) {
    summary.textContent = pending.length
      ? pending.length + " completed Testnet payment(s) awaiting verification."
      : "No completed, pending Testnet liquidity payments are currently in the queue.";
  }

  if (!pending.length) {
    var empty = document.createElement("div");
    empty.className = "verification-empty";
    empty.textContent =
      "No manual UUID entry is required. Refresh to check the latest Testnet records.";

    host.appendChild(empty);
    return;
  }

  pending.forEach(function(payment){
    var card = document.createElement("article");
    card.className = "verification-item";

    var left = document.createElement("div");
    left.className = "verification-item-name";

    var name = document.createElement("strong");
    name.textContent = payment.projectName;

    var code = document.createElement("small");
    code.textContent = payment.projectCode;

    var meta = document.createElement("span");
    meta.className = "verification-item-meta";

    var date = payment.createdAt
      ? new Date(payment.createdAt)
      : null;

    meta.textContent = "Created: " +
      (date && !Number.isNaN(date.getTime())
        ? date.toLocaleString()
        : "date unavailable");

    left.appendChild(name);
    left.appendChild(code);
    left.appendChild(meta);

    var amount = document.createElement("strong");
    amount.className = "verification-item-amount";
    amount.textContent = pi(payment.amount);

    card.appendChild(left);
    card.appendChild(amount);
    host.appendChild(card);
  });
   }

  function render(){
    var body=el("projectRows"); if(!body) return;
    body.replaceChildren();
    var ready=0,pending=0,total=0;
    rows.forEach(function(row){
      var project=row.project||{};
      var req=Number(row.required||0), ver=Number(row.verified||0);
      if(row.ready) ready++; else pending++;
      total += ver;
      var tr=document.createElement("tr");
      var td=document.createElement("td");
      var wrap=document.createElement("div"); wrap.className="project-cell";
      if(project.logo_url){ var img=document.createElement("img"); img.className="project-logo"; img.src=project.logo_url; img.alt=clean(project.name||"Project")+" logo"; img.loading="lazy"; wrap.appendChild(img); }
      else { var fallback=document.createElement("div"); fallback.className="project-logo-fallback"; fallback.textContent=(clean(project.name)||"P").charAt(0).toUpperCase(); wrap.appendChild(fallback); }
      var nw=document.createElement("div"); nw.className="project-name";
      var name=document.createElement("strong"); name.textContent=clean(project.name||project.project_code||"Project");
      var code=document.createElement("small"); code.textContent=clean(project.project_code||"—");
      nw.appendChild(name); nw.appendChild(code); wrap.appendChild(nw); td.appendChild(wrap); tr.appendChild(td);
      td=document.createElement("td"); td.className="metric"; td.textContent=pi(req); tr.appendChild(td);
      td=document.createElement("td"); td.className="metric"; td.textContent=pi(ver); tr.appendChild(td);
      td=document.createElement("td");
      var bar=document.createElement("div"); bar.className="coverage-bar";
      var fill=document.createElement("div"); fill.className="coverage-fill"; fill.style.width=Math.min(100,Math.max(0,Number(row.coverage||0)))+"%"; bar.appendChild(fill);
      var label=document.createElement("div"); label.className="coverage-label"; label.textContent=Number(row.coverage||0).toFixed(1)+"%";
      td.appendChild(bar); td.appendChild(label); tr.appendChild(td);
      td=document.createElement("td");
      var state=document.createElement("span"); state.className="state "+clean(row.code||"pending"); state.textContent=row.ready?"TESTNET READY":(ver>0?"LIQUIDITY PARTIAL":"LIQUIDITY PENDING"); td.appendChild(state);
      var action=document.createElement("button"); action.type="button"; action.className="row-action"; action.dataset.projectId=clean(project.id); action.dataset.mode=row.treasury?(row.ready?"recompute":"fund"):"initialize"; action.textContent=row.treasury?(row.ready?"Recompute":"Pay "+Math.max(0,req-ver).toFixed(2)+" Pi"):"Initialize 100 Pi"; td.appendChild(action); tr.appendChild(td);
      body.appendChild(tr);
    });
    el("approvedCount").textContent=String(rows.length);
    el("readyCount").textContent=String(ready);
    el("pendingCount").textContent=String(pending);
    el("verifiedTotal").textContent=pi(total);
    el("emptyState").hidden=rows.length>0;

    renderVerificationQueue();
  }

  async function load(){
    status("Loading Testnet liquidity status…");
    rows=await window.AlbukhrTestnetLiquidity.load();
    render();
    status(rows.length ? rows.length+" approved Testnet project"+(rows.length===1?"":"s")+" loaded. Minimum threshold: 100 Pi." : "No approved Testnet projects were returned.");
    return rows;
  }

  async function initializeProject(projectId){
    var row=rows.find(function(item){ return String(item.project && item.project.id)===String(projectId); });
    if(!row) throw new Error("PROJECT_NOT_FOUND");
    var wallet=window.prompt("Enter the Testnet treasury wallet for " + (row.project.name||row.project.project_code) + "", clean(row.treasury && row.treasury.treasury_wallet));
    if(wallet===null) return;
    wallet=clean(wallet);
    if(!wallet) throw new Error("TREASURY_WALLET_REQUIRED");
    var required=window.prompt("Required Testnet liquidity (minimum 100 Pi)", String(Math.max(100,Number(row.required||100))));
    if(required===null) return;
    await window.AlbukhrTestnetLiquidity.initialize(projectId,wallet,required);
    await load();
  }

  async function fundProject(projectId){
    var row=rows.find(function(item){ return String(item.project && item.project.id)===String(projectId); });
    if(!row) throw new Error("PROJECT_NOT_FOUND");
    if(!row.treasury) throw new Error("TREASURY_NOT_CONFIGURED");
    var remaining=Math.max(0,Number(row.required||100)-Number(row.verified||0));
    if(remaining<=0) throw new Error("PROJECT_LIQUIDITY_ALREADY_READY");
    if(!window.AlbukhrTestnetLiquidityPayment) throw new Error("TESTNET_LIQUIDITY_PAYMENT_UNAVAILABLE");
    status("Opening Pi Testnet payment for "+remaining.toFixed(2)+" Pi…");
    var result=await window.AlbukhrTestnetLiquidityPayment.startAdminPayment({
      projectId:clean(row.project && row.project.id),
      projectCode:clean(row.project && row.project.project_code),
      amount:remaining,
      memo:"ALBUKHR Testnet liquidity • "+clean(row.project && row.project.project_code)
    });
    var recordId=clean(result && result.record && result.record.id);
    if(recordId && el("paymentRecordId")) el("paymentRecordId").value=recordId;
    status(recordId ? "Pi payment completed. Verification is pending. Payment record ID has been placed below." : "Pi payment completed. Verification is pending.");
    await load();
  }

  async function handleRowAction(event){
    var button=event.target.closest("button.row-action");
    if(!button) return;
    var id=clean(button.dataset.projectId), mode=clean(button.dataset.mode);
    button.disabled=true;
    try{
      if(mode==="initialize") await initializeProject(id);
      else if(mode==="fund") await fundProject(id);
      else { await window.AlbukhrTestnetLiquidity.recompute(id); await load(); }
    }catch(error){
      console.error("[ALBUKHR TESTNET ADMIN]",error);
      status("Action failed: "+(error.message||error),true);
    }finally{ button.disabled=false; }
  }

  async function verifyPayment(){
  var button = el("verifyPaymentButton");

  try {
    button.disabled = true;

    status(
      "Checking pending Testnet payments against Pi Platform API…"
    );

    var result =
      await window.AlbukhrTestnetLiquidity.verifyPayment();

    await load();

    var considered = Number(result && result.considered || 0);
    var verified = Number(result && result.verified || 0);
    var pendingCount =
      Number(result && result.pending_or_failed || 0);

    if (considered === 0) {
      status(
        "No completed pending payment records were found. Nothing was changed."
      );
    } else if (verified > 0 && pendingCount === 0) {
      status(
        "Pi Platform verification succeeded for " +
        verified + " payment(s); Testnet liquidity was recomputed."
      );
    } else if (verified > 0) {
      status(
        "Verified " + verified + " payment(s); " +
        pendingCount +
        " remain pending because Pi Platform checks did not pass.",
        true
      );
    } else {
      status(
        "Checked " + considered +
        " payment(s); none passed all Pi Platform checks. " +
        "The records remain pending.",
        true
      );
    }
  } catch (error) {
    console.error(error);

    status(
      "Payment verification failed: " +
      (error.message || error),
      true
    );
  } finally {
    button.disabled = false;
  }
  }

  async function init(){
    if(initialized) return; initialized=true;
    try{
      var env=window.ALBukhrEnvironment;
      if(!env || !env.isKnown || !env.isTestnet || !env.isKnown() || !env.isTestnet() || env.getNetwork()!=="testnet") throw new Error("TESTNET_ADMIN_ENVIRONMENT_REQUIRED");
      if(!window.AlbukhrTestnetAdminAuth) throw new Error("TESTNET_ADMIN_AUTH_UNAVAILABLE");
      window.AlbukhrTestnetAdminAuth.init();
      var session=await window.AlbukhrTestnetAdminAuth.requireAdmin({redirectOnFailure:true});
      if(!session) return;
      el("adminEmail").textContent=clean(session.admin && session.admin.email) || "Authenticated admin";
      el("adminRoles").textContent=Array.isArray(session.admin && session.admin.roles) ? session.admin.roles.join(", ") : "—";
      setupOwnershipAccess(session);
      el("refreshButton").addEventListener("click",function(){
        el("refreshButton").disabled=true;
        load().catch(function(error){status("Unable to load Testnet liquidity status: "+(error.message||error),true);}).finally(function(){el("refreshButton").disabled=false;});
      });
      el("projectRows").addEventListener("click",handleRowAction);
      el("verifyPaymentButton").addEventListener("click",verifyPayment);
      el("logoutButton").addEventListener("click",function(){ window.AlbukhrTestnetAdminAuth.logout(); window.location.replace("index.html"); });
      await load();
    }catch(error){ console.error("[ALBUKHR TESTNET ADMIN]",error); status("Testnet admin dashboard error: "+(error.message||error),true); }
  }

  window.AlbukhrTestnetAdminDashboard=Object.freeze({init:init,load:load});
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init,{once:true}); else init();
})(window,document);
