(function(window,document){"use strict";
const MAINNET_LOGIN="https://app.albukhr.com/login.html?returnTo=testnet";
function el(id){return document.getElementById(id)}
function setStatus(m){const n=el("status");if(n)n.textContent=String(m||"")}
function setLoading(on,label){const b=el("testnetLoginButton");if(!b)return;b.disabled=!!on;const t=b.querySelector(".login-text");if(t)t.textContent=label}
function start(){setLoading(true,"Opening Mainnet...");setStatus("Testnet uses secure Mainnet identity verification. No Pi access token is sent to Testnet.");setTimeout(()=>location.replace(MAINNET_LOGIN),250)}
function init(){setLoading(false,"Continue with Pi");setStatus("Continue to Mainnet to verify your Pi identity.")}
window.login=start;window.AlbukhrTestnetLogin=Object.freeze({start,goMainnet:()=>location.replace(MAINNET_LOGIN)});
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",init,{once:true}):init();
})(window,document);
