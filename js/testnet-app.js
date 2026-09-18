(function(window,document){"use strict";
async function boot(){const list=document.getElementById("projectList"),status=document.getElementById("registryStatus");
 try{if(!window.AlbukhrTestnetAuth)throw Error("Testnet Auth Gateway is unavailable.");const s=await window.AlbukhrTestnetAuth.requireTestnetAuth();if(!s)return;
 if(status)status.textContent="Authenticated as "+(s.username||s.pi_uid||"Pi user")+". Loading…";if(!window.AlbukhrTestnetRegistry)throw Error("Testnet project registry is unavailable.");
 const p=await window.AlbukhrTestnetRegistry.load();window.AlbukhrTestnetRegistry.render(list,p);if(status)status.textContent=p.length+" approved project"+(p.length===1?"":"s")+" available on Testnet."
 }catch(e){console.error("[ALBUKHR TESTNET APP]",e);if(status)status.textContent="Testnet access could not be initialized."}}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",boot,{once:true}):boot();
})(window,document);
