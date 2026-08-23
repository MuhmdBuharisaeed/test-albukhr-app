/* ALBUKHR ADMIN AUTH — CONSOLIDATED v3.0 */
(function(w){"use strict";

let busy=false;
function setBusy(x){const b=document.querySelector(".login-btn");if(!b)return;b.disabled=x;b.textContent=x?"Signing In...":"Access Control Center"}
async function login(){if(busy)return;const e=document.getElementById("email"),k=document.getElementById("key");if(!e||!k)return alert("Login form fields are missing.");const email=String(e.value||"").trim().toLowerCase(),accessKey=String(k.value||"").trim();if(!email)return alert("Administrator Email Required");if(!accessKey)return alert("Access Key Required");busy=true;setBusy(true);try{if(!w.adminLogin)throw Error("ALBUKHR Admin Authentication Engine is not loaded.");const r=await w.adminLogin({email,accessKey});if(!r?.success){alert(r?.error||"Administrator authentication failed.");return}if(!r.admin?.id||!r.session?.user?.id){alert("Administrator verification failed.");return}w.location.replace("unified-admin-buttons.html")}catch(e){console.error(e);alert(e?.message||"Administrator login failed.")}finally{busy=false;setBusy(false)}}
async function checkExistingAdminSession(){try{return!!(await w.getCurrentSession())?.user?.id}catch(e){return false}}
function initializeAdminLogin(){console.log("✅ ALBUKHR Admin Login Controller Ready");document.querySelectorAll("#email,#key").forEach(i=>i.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();login()}}))}
w.login=login;w.checkExistingAdminSession=checkExistingAdminSession;w.initializeAdminLogin=initializeAdminLogin;
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initializeAdminLogin,{once:true});else initializeAdminLogin();

})(window);
