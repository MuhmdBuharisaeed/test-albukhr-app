/* ALBUKHR ADMIN AUTH — CONSOLIDATED v3.0 */
(function(w){"use strict";

let ready=false;
function onReady(e){const a=e?.detail||w.Admin;if(!a?.ready)return;ready=true;console.log("✅ ALBUKHR Admin Core Ready");document.dispatchEvent(new CustomEvent("albukhr-admin-core-ready",{detail:a}))}
document.addEventListener("admin-ready",onReady);
function check(){if(w.Admin?.ready)onReady({detail:w.Admin})}
function isAlbukhrAdminCoreReady(){return ready}
function getAlbukhrAdminCoreState(){return{ready,admin:w.Admin||null}}
w.isAlbukhrAdminCoreReady=isAlbukhrAdminCoreReady;w.getAlbukhrAdminCoreState=getAlbukhrAdminCoreState;
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",check,{once:true});else check();

})(window);
