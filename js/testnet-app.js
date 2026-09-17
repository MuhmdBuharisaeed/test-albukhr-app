(function(window, document){
"use strict";

async function boot(){
  const list = document.getElementById("projectList");
  const status = document.getElementById("registryStatus");

  try{
    if(!window.AlbukhrTestnetAuth){
      throw new Error("Testnet Auth Gateway is unavailable.");
    }

    const session = await window.AlbukhrTestnetAuth.requireTestnetAuth();
    if(!session) return;

    if(status){
      status.textContent = "Authenticated as " +
        (session.username || session.pi_uid || "Pi user") + ". Loading…";
    }

    if(!window.AlbukhrTestnetRegistry){
      throw new Error("Testnet project registry is unavailable.");
    }

    const projects = await window.AlbukhrTestnetRegistry.load();
    window.AlbukhrTestnetRegistry.render(list, projects);

    if(status){
      status.textContent =
        projects.length + " approved project" +
        (projects.length === 1 ? "" : "s") +
        " available on Testnet.";
    }
  }catch(error){
    console.error("[ALBUKHR TESTNET APP]", error);
    if(status) status.textContent = "Testnet access could not be initialized.";
  }
}

document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", boot, {once:true})
  : boot();

})(window, document);
