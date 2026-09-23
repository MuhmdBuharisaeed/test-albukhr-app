/* ALBUKHR TESTNET ADMIN DASHBOARD v3 — OWNER INTEGRATION */
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
    var result=await window.AlbukhrTestnetLiquidityPayment.startPayment({
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
