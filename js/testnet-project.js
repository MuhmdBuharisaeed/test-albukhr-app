/* ALBUKHR TESTNET PROJECT — DIAGNOSTIC BUILD v2 */
(function(window, document){
"use strict";

function clean(v){ return String(v == null ? "" : v).trim(); }
function el(id){ return document.getElementById(id); }
function set(id,v){ const n=el(id); if(n) n.textContent=clean(v); }

function identity(){
  const q=new URLSearchParams(location.search);
  return clean(q.get("project") || q.get("project_code") || q.get("slug") || q.get("project_id"));
}

function showDiagnostic(type,message,extra){
  let box=el("albukhrProjectDiagnostic");
  if(!box){
    box=document.createElement("section");
    box.id="albukhrProjectDiagnostic";
    box.style.cssText=
      "position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483647;" +
      "padding:14px 16px;border:1px solid #e5c76b;border-radius:14px;" +
      "background:#fff8e1;color:#3f2d00;box-shadow:0 12px 35px rgba(0,0,0,.18);" +
      "font:14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;";
    document.body.appendChild(box);
  }
  box.innerHTML=
    "<strong>ALBUKHR TESTNET PROJECT DIAGNOSTIC</strong>" +
    "<div style='margin-top:6px'><b>Stage:</b> "+escapeHtml(type)+"</div>" +
    "<div style='margin-top:4px'><b>Message:</b> "+escapeHtml(message)+"</div>" +
    (extra ? "<div style='margin-top:4px;word-break:break-word'><b>Details:</b> "+escapeHtml(extra)+"</div>" : "");
}

function escapeHtml(v){
  return String(v == null ? "" : v).replace(/[&<>"]/g,function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];
  });
}

function notFound(){
  set("projectTitle","Project not found");
  set("projectState","TESTNET • NOT FOUND");
  set("projectMeta","This project is not available in the Testnet registry.");
  set("projectDescription","The requested project could not be resolved against the approved Testnet project registry.");
  document.title="Project not found • ALBUKHR TESTNET";
}

function render(p){
  const name=clean(p.name)||clean(p.title)||"Project";
  const code=clean(p.project_code)||"—";
  const type=clean(p.project_type).toUpperCase()||"—";
  const slot=p.core_slot==null ? "—" : p.core_slot;
  const status=clean(p.status).toUpperCase()||"APPROVED";

  set("projectTitle",name);
  set("projectState","TESTNET • "+status);
  set("projectMeta",type+" • Core Slot "+slot);
  set("projectDescription",clean(p.description)||"Registered ALBUKHR project available for controlled Testnet exploration.");
  set("projectCode",code);
  set("projectType",type);
  set("projectSlot",slot);
  set("projectNetwork",clean(p.network).toUpperCase()||"TESTNET");
  document.title=name+" • ALBUKHR TESTNET";

  const img=el("projectLogo");
  const fb=el("logoFallback");
  const logo=clean(p.logo_url);

  if(img && logo){
    img.src=logo;
    img.alt=name;
    img.hidden=false;
    if(fb) fb.hidden=true;
    img.onerror=function(){
      img.hidden=true;
      if(fb) fb.hidden=false;
    };
  }else{
    if(img) img.hidden=true;
    if(fb) fb.hidden=false;
  }
}

async function load(){
  const id=identity();

  try{
    if(!window.AlbukhrEnvironment){
      throw new Error("Environment Core is unavailable.");
    }

    if(!window.AlbukhrEnvironment.isKnown()){
      throw new Error("Invalid ALBUKHR environment: current host is not recognized as Testnet.");
    }

    if(window.AlbukhrEnvironment.getNetwork()!=="testnet"){
      throw new Error("Invalid ALBUKHR network: expected testnet.");
    }

    if(!window.ALBUKHR_SUPABASE){
      throw new Error("Testnet Supabase Core is unavailable.");
    }

    if(!window.AlbukhrTestnetRegistry){
      throw new Error("Testnet Project Registry module is unavailable.");
    }

    if(!id){
      notFound();
      showDiagnostic("PROJECT_ID_MISSING","No project identity was supplied in the page URL.");
      return null;
    }

    set("projectState","TESTNET • LOADING");
    set("projectMeta","Loading registered project…");

    const projects=await window.AlbukhrTestnetRegistry.load(true);

    if(!Array.isArray(projects)){
      throw new Error("Project registry returned an invalid response.");
    }

    const p=window.AlbukhrTestnetRegistry.resolve(id);

    if(!p){
      notFound();
      showDiagnostic(
        "PROJECT_NOT_FOUND",
        "Registry loaded successfully, but the requested project was not found.",
        "Requested identity: "+id+"; registry count: "+projects.length
      );
      return null;
    }

    render(p);

    showDiagnostic(
      "PROJECT_OK",
      "Testnet project loaded successfully.",
      "project="+id+"; registry_count="+projects.length
    );

    return p;

  }catch(e){
    console.error("[ALBUKHR TESTNET PROJECT]",e);

    set("projectState","TESTNET • UNAVAILABLE");
    set("projectMeta","Unable to load the Testnet project registry.");
    set("projectDescription","The Testnet project data could not be loaded.");

    showDiagnostic(
      "PROJECT_REGISTRY_ERROR",
      e && e.message ? e.message : "Unknown project registry error.",
      "project="+(id||"missing")
    );

    return null;
  }
}

function init(){
  const modal=el("infoModal");
  const close=()=>{if(modal) modal.hidden=true;};
  const info=el("infoButton");

  if(info) info.onclick=()=>{if(modal) modal.hidden=false;};
  if(el("closeInfo")) el("closeInfo").onclick=close;
  if(el("infoOk")) el("infoOk").onclick=close;
  if(modal) modal.onclick=e=>{if(e.target===modal) close();};

  const refresh=el("refreshBtn");
  if(refresh){
    refresh.onclick=async function(){
      refresh.disabled=true;
      refresh.textContent="↻ Loading…";
      try{
        await load();
      }finally{
        refresh.disabled=false;
        refresh.textContent="↻ Refresh";
      }
    };
  }

  load();
}

window.AlbukhrTestnetProject=Object.freeze({
  load:load
});

document.readyState==="loading"
  ? document.addEventListener("DOMContentLoaded",init,{once:true})
  : init();

})(window,document);
