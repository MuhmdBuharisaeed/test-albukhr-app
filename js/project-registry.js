(function(window,document){
"use strict";
const RPC="get_public_project_registry";
let projects=[];
function clean(v){return String(v??"").trim();}
function esc(v){return clean(v).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function getCore(){if(!window.ALBUKHR_SUPABASE)throw new Error("Supabase Core unavailable.");return window.ALBUKHR_SUPABASE;}
async function load(force=false){
 if(projects.length&&!force)return projects.slice();
 const {data,error}=await getCore().rpc(RPC,{p_network:"testnet"});
 if(error)throw error;
 projects=Array.isArray(data)?data.filter(p=>clean(p.network).toLowerCase()==="testnet"):[];
 window.dispatchEvent(new CustomEvent("albukhr:testnet-registry-ready",{detail:{projects:projects.slice()}}));
 return projects.slice();
}
function resolve(identity){
 const q=clean(identity).toLowerCase();
 return projects.find(p=>[p.id,p.project_id,p.project_code,p.slug,p.name,p.title].some(v=>clean(v).toLowerCase()===q))||null;
}
function url(p){const key=clean(p?.project_code)||clean(p?.slug)||clean(p?.id);return key?"project.html?project="+encodeURIComponent(key):null;}
function render(container,list){
 if(!container)return;
 container.innerHTML="";
 list.forEach(p=>{
  const card=document.createElement("article");
  card.className="project-card";
  card.dataset.projectCode=clean(p.project_code);
  card.dataset.projectId=clean(p.id);
  const logo=clean(p.logo_url);
  card.innerHTML='<div class="project-logo-wrap">'+
   (logo?'<img class="project-logo" loading="lazy" decoding="async" alt="">':'<span class="project-logo-fallback">A</span>')+
   '</div><div class="project-body"><h3></h3><p></p><span class="status">TESTNET • '+esc(p.status)+'</span></div>';
  const name=clean(p.name)||clean(p.title)||"Project";
  card.querySelector("h3").textContent=name;
  card.querySelector("p").textContent=clean(p.project_type).toUpperCase()+" • Core Slot "+(p.core_slot??"—");
  if(logo){const img=card.querySelector("img");img.src=logo;img.alt=name;}
  card.addEventListener("click",()=>{const u=url(p);if(u)location.assign(u);});
  container.appendChild(card);
 });
}
window.AlbukhrTestnetRegistry=Object.freeze({load,resolve,url,render,getAll:()=>projects.slice()});
})(window,document);
