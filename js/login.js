/* ALBUKHR LOGIN PAGE CONTROLLER */
(function(window){"use strict";
function el(id){return document.getElementById(id)}
function setStatus(message){const e=el("status");if(e)e.textContent=String(message||"")}
function setLoading(loading,text){const b=el("piLoginButton");if(!b)return;b.disabled=Boolean(loading);const t=b.querySelector(".pi-login-text");if(t&&typeof text==="string")t.textContent=text}
function checkDependencies(){
 if(!window.ALBukhrEnvironment||!window.ALBukhrEnvironment.isKnown())throw new Error("ALBUKHR environment is unavailable.");
 if(!window.ALBUKHR_SUPABASE)throw new Error("ALBUKHR Supabase Core is unavailable.");
 if(!window.AlbukhrPiAuth)throw new Error("ALBUKHR Pi Auth Core is unavailable.");
}
function getTarget(){const r=new URLSearchParams(location.search).get("returnTo");return r==="testnet"?"testnet":(r&&r.startsWith("/")&&!r.startsWith("//")?r:"index.html")}
async function login(){
 try{
  checkDependencies();setLoading(true,"Connecting to Pi...");setStatus("Initializing secure Pi authentication...");
  const user=await window.AlbukhrPiAuth.ensurePiAuth();
  if(!user||!user.pi_uid)throw new Error("Pi authentication returned an invalid user.");
  if(getTarget()==="testnet"){
   setStatus("Mainnet identity verified. Creating secure Testnet access...");setLoading(true,"Opening Testnet...");
   if(!window.AlbukhrTestnetHandoff)throw new Error("Testnet handoff module is unavailable.");
   await window.AlbukhrTestnetHandoff.handoffToTestnet();
   return;
  }
  setStatus("Login successful: "+user.username);setLoading(true,"Opening Dashboard...");
  window.setTimeout(()=>window.location.replace(getTarget()),600);
 }catch(error){
  console.error("[ALBUKHR LOGIN]",error);setLoading(false,"Login with Pi");
  setStatus(error&&error.message?"Login failed: "+error.message:"Login failed.");
 }
}
window.login=login;
function init(){try{checkDependencies();setStatus("Ready to login with Pi.");setLoading(false,"Login with Pi")}catch(error){console.error(error);setLoading(true,"Login unavailable");setStatus("Login system is unavailable.")}}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",init):init();
})(window);
