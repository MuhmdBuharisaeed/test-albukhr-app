(function(window){
"use strict";
const GATEWAY_URL="https://vhvkwvngmrlgyzwemttt.supabase.co/functions/v1/testnet-auth-gateway";
const MAINNET_LOGIN="https://app.albukhr.com/login.html?returnTo=testnet";
const SESSION_KEY="albukhr_testnet_session_v2";
let session=null;
function clean(v){return String(v??"").trim();}
function saveSession(v){session=Object.freeze(v);try{sessionStorage.setItem(SESSION_KEY,JSON.stringify(session));}catch(_){}return session;}
function loadStoredSession(){
 if(session)return session;
 try{
  const raw=sessionStorage.getItem(SESSION_KEY);if(!raw)return null;
  const v=JSON.parse(raw);
  if(!v||v.network!=="testnet"||!v.token)return null;
  if(v.expires_at&&new Date(v.expires_at).getTime()<=Date.now()){sessionStorage.removeItem(SESSION_KEY);return null;}
  session=Object.freeze(v);return session;
 }catch(_){return null;}
}
function clearSession(){session=null;try{sessionStorage.removeItem(SESSION_KEY);}catch(_){} }
async function call(action,payload){
 const r=await fetch(GATEWAY_URL,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.assign({action},payload||{}))});
 let b=null;try{b=await r.json();}catch(_){}
 if(!r.ok||!b?.ok)throw new Error(b?.error||"Testnet authentication request failed.");
 return b;
}
async function redeem(code){
 const value=clean(code);if(!value)return null;
 const b=await call("redeem",{code:value});const u=b.user||{};
 const s=saveSession({token:b.session,expires_at:b.expires_at,network:"testnet",pi_uid:u.uid||null,username:u.username||null,wallet_address:u.wallet_address||null});
 const url=new URL(location.href);url.searchParams.delete("access_code");history.replaceState({},document.title,url.pathname+url.search+url.hash);
 window.dispatchEvent(new CustomEvent("albukhr:testnet-auth-success",{detail:{session:s}}));return s;
}
async function restore(){try{const b=await call("restore");const u=b.user||{};return saveSession({token:b.session,expires_at:b.expires_at,network:"testnet",pi_uid:u.uid||null,username:u.username||null,wallet_address:u.wallet_address||null});}catch(_){clearSession();return null;}}
function getSession(){return loadStoredSession();}
function getSessionToken(){return loadStoredSession()?.token||null;}
async function requireTestnetAuth(){
 const c=new URLSearchParams(location.search).get("access_code");
 if(c){try{return await redeem(c);}catch(e){console.error("[ALBUKHR TESTNET AUTH]",e);location.replace(MAINNET_LOGIN);return null;}}
 const existing=loadStoredSession();if(existing)return existing;
 const restored=await restore();if(restored)return restored;
 location.replace(MAINNET_LOGIN);return null;
}
async function logout(){try{await call("logout");}catch(_){}clearSession();location.replace(MAINNET_LOGIN);}
window.AlbukhrTestnetAuth=Object.freeze({redeem,restore,requireTestnetAuth,getSession,getSessionToken,logout});
})(window);
