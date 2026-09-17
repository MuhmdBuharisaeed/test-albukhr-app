(function(window,document){
"use strict";
function clean(v){return String(v??"").trim();}
async function boot(){
 const params=new URLSearchParams(location.search);
 const identity=clean(params.get("project")||params.get("slug")||params.get("project_code")||params.get("project_id"));
 const title=document.getElementById("projectTitle"),about=document.getElementById("projectAbout"),logo=document.getElementById("projectLogo"),state=document.getElementById("projectState");
 try{
  await window.AlbukhrTestnetRegistry.load();
  const p=window.AlbukhrTestnetRegistry.resolve(identity);
  if(!p){
   if(title)title.textContent="Project not found";
   if(state)state.textContent="This project is not available in the Testnet registry.";
   return;
  }
  const name=clean(p.name)||clean(p.title)||"Project";
  if(title)title.textContent=name;
  document.title=name+" • ALBUKHR TESTNET";
  if(about)about.textContent=clean(p.description)||("Registered ALBUKHR Testnet project • "+clean(p.project_type));
  if(state)state.textContent="TESTNET • "+clean(p.status).toUpperCase();
  if(logo&&p.logo_url){logo.src=p.logo_url;logo.alt=name;logo.hidden=false;}
 }catch(e){
  console.error(e);
  if(state)state.textContent="Unable to load Testnet project data.";
 }
}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",boot,{once:true}):boot();
})(window);
