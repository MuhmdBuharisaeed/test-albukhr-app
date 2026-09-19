/* ALBUKHR TESTNET APP — DIAGNOSTIC BOOT v4 */
(function(window,document){
"use strict";
function show(m,t){
 let n=document.getElementById("albukhrBootDiagnostic");
 if(!n){n=document.createElement("div");n.id="albukhrBootDiagnostic";n.style.cssText="position:fixed;top:12px;left:12px;right:12px;z-index:2147483646;padding:12px 14px;border-radius:12px;background:#fff8e1;color:#3f2d00;border:1px solid #e5c76b;font:14px/1.45 system-ui,sans-serif;";document.body.appendChild(n);}
 n.textContent=(t?"["+t+"] ":"")+m;
}
async function boot(){
 try{
  if(!window.AlbukhrTestnetAuth){show("Authentication module is unavailable.","AUTH_MODULE_MISSING");return;}
  const session=await window.AlbukhrTestnetAuth.requireTestnetAuth({redirectOnFailure:false});
  if(!session){show("Authentication did not complete. Check the diagnostic panel at the bottom.","AUTH_NOT_READY");return;}
  show("Testnet session verified. Continuing application boot.","AUTH_OK");
  window.dispatchEvent(new CustomEvent("albukhr:testnet-authenticated",{detail:{session}}));
 }catch(e){console.error("[ALBUKHR TESTNET DIAGNOSTIC BOOT]",e);show(e?.message||"Unexpected Testnet boot error.","BOOT_ERROR");}
}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",boot,{once:true}):boot();
})(window,document);
