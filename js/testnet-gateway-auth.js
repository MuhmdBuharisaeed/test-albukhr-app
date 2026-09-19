/* ALBUKHR TESTNET AUTH — DIAGNOSTIC BUILD v4 */
(function(window,document){
"use strict";
const GATEWAY_URL="https://vhvkwvngmrlgyzwemttt.supabase.co/functions/v1/testnet-auth-gateway";
const MAINNET_LOGIN="https://app.albukhr.com/login.html?returnTo=testnet";
const SESSION_KEY="albukhr_testnet_session_v4_diagnostic";
let session=null;

function clean(v){return String(v==null?"":v).trim();}
function esc(v){return String(v==null?"":v).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}

function render(p){
 let box=document.getElementById("albukhrAuthDiagnostic");
 if(!box){
  box=document.createElement("section");
  box.id="albukhrAuthDiagnostic";
  box.style.cssText="position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483647;padding:14px 16px;border:1px solid #d1d5db;border-radius:14px;background:#fff;color:#111827;box-shadow:0 12px 35px rgba(0,0,0,.18);font:14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;";
  document.body.appendChild(box);
 }
 box.innerHTML='<div style="font-weight:800;margin-bottom:6px">ALBUKHR TESTNET AUTH DIAGNOSTIC</div>'+
 '<div><strong>Stage:</strong> '+esc(p.type||"UNKNOWN")+(p.status?" HTTP "+esc(p.status):"")+'</div>'+
 '<div style="margin-top:4px"><strong>Message:</strong> '+esc(p.message||"")+'</div>'+
 (p.url?'<div style="margin-top:4px;word-break:break-all"><strong>Gateway:</strong> '+esc(p.url)+'</div>':"")+
 (p.extra?'<div style="margin-top:4px;word-break:break-word"><strong>Details:</strong> '+esc(p.extra)+'</div>':"")+
 '<div style="display:flex;gap:8px;margin-top:10px"><button id="albukhrDiagMainnet" type="button" style="padding:8px 11px;border:0;border-radius:9px;background:#0f7a3d;color:#fff">Open Mainnet Login</button><button id="albukhrDiagReload" type="button" style="padding:8px 11px;border:1px solid #d1d5db;border-radius:9px;background:#fff">Reload</button></div>';
 const a=document.getElementById("albukhrDiagMainnet"),r=document.getElementById("albukhrDiagReload");
 if(a)a.onclick=()=>location.assign(MAINNET_LOGIN);
 if(r)r.onclick=()=>location.reload();
}

function emit(type,detail){
 const p=Object.assign({type,at:new Date().toISOString()},detail||{});
 console.info("[ALBUKHR TESTNET AUTH DIAGNOSTIC]",p);
 render(p);
 try{window.dispatchEvent(new CustomEvent("albukhr:testnet-auth-diagnostic",{detail:p}));}catch(_){}
}
function save(v){session=Object.freeze(v);try{sessionStorage.setItem(SESSION_KEY,JSON.stringify(session));}catch(_){}return session;}
function load(){
 if(session)return session;
 try{
  const raw=sessionStorage.getItem(SESSION_KEY);if(!raw)return null;
  const v=JSON.parse(raw);
  if(!v||v.network!=="testnet"||!clean(v.token)){sessionStorage.removeItem(SESSION_KEY);return null;}
  if(v.expires_at&&new Date(v.expires_at).getTime()<=Date.now()){sessionStorage.removeItem(SESSION_KEY);return null;}
  session=Object.freeze(v);return session;
 }catch(_){return null;}
}
function clear(){session=null;try{sessionStorage.removeItem(SESSION_KEY);}catch(_){}}

async function redeem(code){
 const value=clean(code);
 if(!value){emit("NO_ACCESS_CODE",{message:"No access_code is present in the Testnet URL.",url:GATEWAY_URL});return null;}
 emit("REDEEM_START",{message:"Sending the one-time access code to the Testnet gateway.",url:GATEWAY_URL});
 let response;
 try{
  response=await fetch(GATEWAY_URL,{method:"POST",mode:"cors",credentials:"include",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({action:"redeem",code:value})});
 }catch(error){
  emit("GATEWAY_UNREACHABLE",{message:error?.message||"Fetch failed before an HTTP response was received.",url:GATEWAY_URL,extra:"Network/CORS/DNS/browser/gateway availability problem."});
  throw error;
 }
 let raw="",body=null;
 try{raw=await response.text();try{body=raw?JSON.parse(raw):null;}catch(_){}}catch(error){
  emit("GATEWAY_RESPONSE_READ_FAILED",{status:response.status,message:error?.message||"Could not read gateway response.",url:GATEWAY_URL});throw error;
 }
 if(!response.ok||!body?.ok||!body?.session){
  const msg=clean(body?.error)||clean(body?.message)||("HTTP_"+response.status);
  emit("REDEEM_FAILED",{status:response.status,message:msg,url:GATEWAY_URL,extra:raw.slice(0,600)});
  const e=new Error(msg);e.status=response.status;e.body=body;e.code=msg;throw e;
 }
 const u=body.user||{};
 const saved=save({token:clean(body.session),expires_at:body.expires_at||null,network:"testnet",pi_uid:u.uid||null,username:u.username||null,wallet_address:u.wallet_address||null});
 const url=new URL(location.href);url.searchParams.delete("access_code");history.replaceState({},document.title,url.pathname+url.search+url.hash);
 emit("REDEEM_SUCCESS",{message:"Access code redeemed and Testnet session created.",extra:"username="+clean(u.username)+"; expires_at="+clean(body.expires_at)});
 window.dispatchEvent(new CustomEvent("albukhr:testnet-auth-success",{detail:{session:saved}}));
 return saved;
}

async function requireTestnetAuth(options){
 const opts=options||{},code=new URLSearchParams(location.search).get("access_code");
 if(code){try{return await redeem(code);}catch(e){clear();if(opts.redirectOnFailure===true)location.replace(MAINNET_LOGIN);return null;}}
 const existing=load();
 if(existing){emit("SESSION_FOUND",{message:"A valid Testnet session already exists.",extra:"expires_at="+clean(existing.expires_at)});return existing;}
 emit("SESSION_REQUIRED",{message:"No Testnet session exists. Start from Mainnet Login to obtain an access code.",url:MAINNET_LOGIN});
 if(opts.redirectOnFailure===true)location.replace(MAINNET_LOGIN);
 return null;
}
function logout(){clear();emit("LOGGED_OUT",{message:"Diagnostic session cleared."});}

window.AlbukhrTestnetAuth=Object.freeze({redeem,requireTestnetAuth,getSession:load,getSessionToken:()=>load()?.token||null,logout,gatewayUrl:GATEWAY_URL,mainnetLogin:MAINNET_LOGIN});
emit("AUTH_MODULE_READY",{message:"Diagnostic module loaded; failed redemption will NOT auto-redirect."});
})(window,document);
