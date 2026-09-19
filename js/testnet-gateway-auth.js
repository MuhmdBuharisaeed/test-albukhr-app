(function(window){
"use strict";

const GATEWAY_URL="https://vhvkwvngmrlgyzwemttt.supabase.co/functions/v1/testnet-auth-gateway";
const MAINNET_LOGIN="https://app.albukhr.com/login.html?returnTo=testnet";
const SESSION_KEY="albukhr_testnet_session_v3";

let session=null;

function clean(v){return String(v??"").trim();}

function saveSession(value){
  session=Object.freeze(value);
  try{
    sessionStorage.setItem(SESSION_KEY,JSON.stringify(session));
  }catch(_){}
  return session;
}

function loadStoredSession(){
  if(session)return session;

  try{
    const raw=sessionStorage.getItem(SESSION_KEY);
    if(!raw)return null;

    const value=JSON.parse(raw);

    if(!value || value.network!=="testnet" || !clean(value.token)){
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }

    if(value.expires_at &&
       new Date(value.expires_at).getTime() <= Date.now()){
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }

    session=Object.freeze(value);
    return session;
  }catch(_){
    return null;
  }
}

function clearSession(){
  session=null;
  try{sessionStorage.removeItem(SESSION_KEY);}catch(_){}
}

async function redeem(code){
  const value=clean(code);
  if(!value)return null;

  const response=await fetch(GATEWAY_URL,{
    method:"POST",
    credentials:"include",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      action:"redeem",
      code:value
    })
  });

  let body=null;
  try{body=await response.json();}catch(_){}

  if(!response.ok || !body?.ok || !body?.session){
    throw new Error(
      body?.error ||
      "Testnet access code redemption failed."
    );
  }

  const user=body.user||{};

  const saved=saveSession({
    token:clean(body.session),
    expires_at:body.expires_at||null,
    network:"testnet",
    pi_uid:user.uid||null,
    username:user.username||null,
    wallet_address:user.wallet_address||null
  });

  /*
   * Remove the one-time access code immediately.
   * The session token, not the code, is used for subsequent pages.
   */
  const url=new URL(window.location.href);
  url.searchParams.delete("access_code");
  history.replaceState(
    {},
    document.title,
    url.pathname+url.search+url.hash
  );

  window.dispatchEvent(
    new CustomEvent("albukhr:testnet-auth-success",{
      detail:{session:saved}
    })
  );

  return saved;
}

function getSession(){
  return loadStoredSession();
}

function getSessionToken(){
  return loadStoredSession()?.token||null;
}

async function requireTestnetAuth(){
  /*
   * 1. One-time Mainnet -> Testnet code.
   */
  const code=new URLSearchParams(location.search).get("access_code");

  if(code){
    try{
      return await redeem(code);
    }catch(error){
      console.error("[ALBUKHR TESTNET AUTH] redeem failed",error);
      clearSession();
      location.replace(MAINNET_LOGIN);
      return null;
    }
  }

  /*
   * 2. Existing short-lived Testnet session.
   *    This is the normal path when moving:
   *    index.html -> investor.html -> marketplace.html.
   */
  const existing=loadStoredSession();

  if(existing){
    return existing;
  }

  /*
   * 3. There is NO restore endpoint in live gateway v4.
   *    Therefore do not call a non-existent action.
   */
  clearSession();
  location.replace(MAINNET_LOGIN);
  return null;
}

function logout(){
  clearSession();
  location.replace(MAINNET_LOGIN);
}

window.AlbukhrTestnetAuth=Object.freeze({
  redeem,
  requireTestnetAuth,
  getSession,
  getSessionToken,
  logout
});

})(window);
