/* ALBUKHR TESTNET GATEWAY AUTH
   Testnet only.
   - Redeems one-time access_code issued by Mainnet issuer.
   - Keeps the resulting session memory-only.
   - Never accepts or stores a Mainnet Pi access token.
*/
(function(window){
  "use strict";

  const GATEWAY_URL =
    "https://vhvkwvngmrlgyzwemttt.supabase.co/functions/v1/testnet-auth-gateway";

  const MAINNET_LOGIN =
    "https://app.albukhr.com/login.html?returnTo=testnet";

  let session = null;

  function clean(value){
    return String(value ?? "").trim();
  }

  async function redeem(code){
    const value = clean(code);
    if(!value) return null;

    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({action:"redeem", code:value})
    });

    let body = null;
    try { body = await response.json(); } catch (_) {}

    if(!response.ok || !body?.session){
      throw new Error(
        body?.error || "Testnet access code is invalid or expired."
      );
    }

    session = Object.freeze({
      token: body.session,
      expires_at: body.expires_at,
      network: "testnet",
      pi_uid: body.pi_uid,
      username: body.username,
      wallet_address: body.wallet_address || null
    });

    const url = new URL(location.href);
    url.searchParams.delete("access_code");
    history.replaceState(
      {},
      document.title,
      url.pathname + url.search + url.hash
    );

    window.dispatchEvent(new CustomEvent(
      "albukhr:testnet-auth-success",
      {detail:{session}}
    ));

    return session;
  }

  function getSession(){ return session; }
  function getSessionToken(){ return session?.token || null; }

  async function requireTestnetAuth(){
    const code = new URLSearchParams(location.search).get("access_code");

    if(code){
      try {
        return await redeem(code);
      } catch(error) {
        console.error("[ALBUKHR TESTNET AUTH]", error);
        window.location.replace(MAINNET_LOGIN);
        return null;
      }
    }

    if(session) return session;

    window.location.replace(MAINNET_LOGIN);
    return null;
  }

  function logout(){
    session = null;
    window.location.replace(MAINNET_LOGIN);
  }

  window.AlbukhrTestnetAuth = Object.freeze({
    redeem,
    requireTestnetAuth,
    getSession,
    getSessionToken,
    logout
  });
})(window);
