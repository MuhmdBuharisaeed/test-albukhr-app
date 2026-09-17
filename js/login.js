/* ALBUKHR TESTNET LOGIN CONTROLLER
   Testnet never authenticates directly with Pi.
   It requests Mainnet Pi authentication and receives a one-time Testnet code.
*/
(function(window, document){
  "use strict";

  const MAINNET_LOGIN = "https://app.albukhr.com/login.html?returnTo=testnet";

  function el(id){ return document.getElementById(id); }

  function setStatus(message){
    const node = el("status");
    if(node) node.textContent = String(message || "");
  }

  function setLoading(loading, label){
    const button = el("testnetLoginButton");
    if(!button) return;
    button.disabled = Boolean(loading);
    const text = button.querySelector(".login-text");
    if(text && typeof label === "string") text.textContent = label;
  }

  function goMainnet(){
    window.location.replace(MAINNET_LOGIN);
  }

  async function start(){
    setLoading(true, "Opening Mainnet...");
    setStatus("Testnet uses secure Mainnet identity verification. No Pi access token is sent to Testnet.");
    window.setTimeout(goMainnet, 250);
  }

  function init(){
    setLoading(false, "Continue with Pi");
    setStatus("Continue to Mainnet to verify your Pi identity.");
  }

  window.login = start;
  window.AlbukhrTestnetLogin = Object.freeze({ start, goMainnet });

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init, {once:true})
    : init();
})(window, document);
