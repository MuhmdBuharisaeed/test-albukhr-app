(function(window){"use strict";
const GATEWAY_URL="https://vhvkwvngmrlgyzwemttt.supabase.co/functions/v1/testnet-auth-gateway";
const MAINNET_LOGIN="https://app.albukhr.com/login.html?returnTo=testnet";
let session=null;
function clean(v){return String(v??"").trim();}
async function redeem(code){
 const value=clean(code); if(!value)return null;
 const r=await fetch(GATEWAY_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"redeem",code:value})});
 let b=null; try{b=await r.json()}catch(_){}
 if(!r.ok||!b?.session)throw new Error(b?.error||"Testnet access code is invalid or expired.");
 const u=b.user||{};
 session=Object.freeze({
  token:b.session,
  expires_at:b.expires_at,
  network:"testnet",
  pi_uid:u.uid||null,
  username:u.username||null,
  wallet_address:u.wallet_address||null
 });
 const url=new URL(location.href);
 url.searchParams.delete("access_code");
 history.replaceState({},document.title,url.pathname+url.search+url.hash);
 window.dispatchEvent(new CustomEvent("albukhr:testnet-auth-success",{detail:{session}}));
 return session;
}
function getSession(){return session}
function getSessionToken(){return session?.token||null}
async function requireTestnetAuth(){
 const c=new URLSearchParams(location.search).get("access_code");
 if(c){try{return await redeem(c)}catch(e){console.error("[ALBUKHR TESTNET AUTH]",e);location.replace(MAINNET_LOGIN);return null}}
 if(session)return session;
 location.replace(MAINNET_LOGIN);return null;
}
function logout(){session=null;location.replace(MAINNET_LOGIN)}
window.AlbukhrTestnetAuth=Object.freeze({redeem,requireTestnetAuth,getSession,getSessionToken,logout});
})(window);
