/* ALBUKHR TESTNET APP — BOOT + REGISTRY FIX v5 */
(function(window, document){
"use strict";

function show(message, type){
  let node = document.getElementById("albukhrBootDiagnostic");
  if(!node){
    node = document.createElement("div");
    node.id = "albukhrBootDiagnostic";
    node.style.cssText =
      "position:fixed;top:12px;left:12px;right:12px;z-index:2147483646;" +
      "padding:12px 14px;border-radius:12px;background:#fff8e1;color:#3f2d00;" +
      "border:1px solid #e5c76b;font:14px/1.45 system-ui,sans-serif;";
    document.body.appendChild(node);
  }
  node.textContent = (type ? "[" + type + "] " : "") + message;
}

function setRegistryStatus(message, type){
  const node = document.getElementById("registryStatus");
  if(node) node.textContent = message;

  try{
    window.dispatchEvent(new CustomEvent("albukhr:testnet-registry-status",{
      detail:{message:message,type:type||"INFO"}
    }));
  }catch(_){}
}

function setProjectCount(count){
  const node = document.getElementById("approvedProjectCount");
  if(node) node.textContent = String(count);
}

async function loadRegistry(){
  if(!window.AlbukhrTestnetRegistry){
    throw new Error("Testnet project registry module is unavailable.");
  }

  const container = document.getElementById("projectList");
  if(!container){
    throw new Error("Testnet project registry container is unavailable.");
  }

  setRegistryStatus("Loading approved Testnet projects…","LOADING");

  try{
    const projects = await window.AlbukhrTestnetRegistry.load();

    if(!Array.isArray(projects)){
      throw new Error("Testnet project registry returned an invalid response.");
    }

    setProjectCount(projects.length);
    window.AlbukhrTestnetRegistry.render(container, projects);

    if(projects.length){
      setRegistryStatus(
        "OK • " + projects.length + " project" +
        (projects.length === 1 ? "" : "s"),
        "OK"
      );
    }else{
      setRegistryStatus("No approved Testnet projects found.","EMPTY");
      container.innerHTML =
        '<div class="registry-empty">' +
        '<strong>No approved projects</strong>' +
        '<p>The Testnet registry returned no approved or active projects.</p>' +
        '</div>';
    }

    window.dispatchEvent(new CustomEvent("albukhr:testnet-registry-loaded",{
      detail:{projects:projects.slice()}
    }));

    return projects;
  }catch(error){
    console.error("[ALBUKHR TESTNET REGISTRY]",error);

    setProjectCount(0);
    setRegistryStatus(
      "Registry error • " + (error?.message || "Unable to load projects."),
      "ERROR"
    );

    if(container){
      container.innerHTML =
        '<div class="registry-empty">' +
        '<strong>Unable to load approved projects</strong>' +
        '<p>Authentication succeeded, but the Testnet project registry could not be loaded.</p>' +
        '</div>';
    }

    window.dispatchEvent(new CustomEvent("albukhr:testnet-registry-error",{
      detail:{error:error}
    }));

    throw error;
  }
}

async function boot(){
  try{
    if(!window.AlbukhrTestnetAuth){
      show("Authentication module is unavailable.","AUTH_MODULE_MISSING");
      return;
    }

    const session =
      await window.AlbukhrTestnetAuth.requireTestnetAuth({
        redirectOnFailure:false
      });

    if(!session){
      show(
        "Authentication did not complete. Check the diagnostic panel at the bottom.",
        "AUTH_NOT_READY"
      );
      return;
    }

    show(
      "Testnet session verified. Continuing application boot.",
      "AUTH_OK"
    );

    window.dispatchEvent(new CustomEvent("albukhr:testnet-authenticated",{
      detail:{session:session}
    }));

    /*
      Authentication is complete. The registry is intentionally loaded only
      after the Testnet session has been verified.
    */
    try{
      await loadRegistry();
    }catch(error){
      /*
        Keep the authenticated application boot alive so the UI can expose
        the registry-specific failure instead of incorrectly reporting an
        authentication failure.
      */
      console.error("[ALBUKHR TESTNET REGISTRY BOOT]",error);
    }

  }catch(error){
    console.error("[ALBUKHR TESTNET DIAGNOSTIC BOOT]",error);
    show(
      error?.message || "Unexpected Testnet boot error.",
      "BOOT_ERROR"
    );
  }
}

window.AlbukhrTestnetApp = Object.freeze({
  boot:boot,
  loadRegistry:loadRegistry
});

document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded",boot,{once:true})
  : boot();

})(window,document);
