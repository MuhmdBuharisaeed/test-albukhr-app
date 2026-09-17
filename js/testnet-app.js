(function(window,document){
"use strict";
async function boot(){
 const list=document.getElementById("projectList");
 const status=document.getElementById("registryStatus");
 try{
  const projects=await window.AlbukhrTestnetRegistry.load();
  window.AlbukhrTestnetRegistry.render(list,projects);
  if(status)status.textContent=projects.length+" approved project"+(projects.length===1?"":"s")+" available on Testnet.";
 }catch(e){
  console.error(e);
  if(status)status.textContent="Testnet project registry could not be loaded.";
 }
}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",boot,{once:true}):boot();
})(window);
