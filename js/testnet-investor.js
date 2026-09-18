(function(window,document){
"use strict";
const clean=v=>String(v==null?"":v).trim();
const money=v=>Number.isFinite(Number(v))?Number(v).toFixed(2)+" Pi":"0.00 Pi";

function greeting(){
  const h=new Date().getHours();
  return h<12?"Good Morning":h<17?"Good Afternoon":"Good Evening";
}

function session(){
  return window.AlbukhrTestnetAuth?.getSession?.() || null;
}

function renderIdentity(){
  const s=session();
  const username=clean(s?.username)||"Investor";
  const greetingNode=document.getElementById("greetingText");
  const userNode=document.getElementById("heroUserName");
  if(greetingNode)greetingNode.textContent=greeting();
  if(userNode)userNode.textContent=username;
}

function renderProjects(projects){
  const list=document.getElementById("investments");
  const empty=document.getElementById("emptyInvestments");
  const total=document.getElementById("totalProjects");
  if(total)total.textContent=String(projects.length);
  if(!list)return;
  list.innerHTML="";
  if(!projects.length){
    if(empty)empty.hidden=false;
    return;
  }
  if(empty)empty.hidden=true;
  projects.forEach(p=>{
    const card=document.createElement("article");
    card.className="invest-card";
    const logo=clean(p.logo_url);
    const name=clean(p.name)||clean(p.title)||"Project";
    const code=clean(p.project_code)||clean(p.slug)||"";
    card.innerHTML='<div class="invest-top">'+
      (logo?'<img class="invest-logo" loading="lazy" decoding="async" alt="">':'<div class="invest-logo"></div>')+
      '<div><h3 class="invest-name"></h3><p class="invest-meta"></p></div>'+
      '<span class="invest-lock">LOCKED</span></div>';
    card.querySelector(".invest-name").textContent=name;
    card.querySelector(".invest-meta").textContent=(code?code+" • ":"")+"Approved Testnet project";
    if(logo){const img=card.querySelector("img");img.src=logo;img.alt=name;}
    card.addEventListener("click",()=>{
      const u=window.AlbukhrTestnetRegistry?.url?.(p);
      if(u)location.assign(u);
    });
    list.appendChild(card);
  });
}

async function boot(){
  if(!window.ALBukhrEnvironment?.isKnown?.() || window.ALBukhrEnvironment.getNetwork()!=="testnet"){
    console.error("[ALBUKHR TESTNET] Invalid environment.");
    return;
  }
  renderIdentity();
  try{
    if(window.AlbukhrTestnetAuth?.requireTestnetAuth) await window.AlbukhrTestnetAuth.requireTestnetAuth();
    renderIdentity();
    const projects=await window.AlbukhrTestnetRegistry.load();
    renderProjects(projects);
  }catch(error){
    console.error("[ALBUKHR TESTNET INVESTOR]",error);
    renderProjects([]);
  }
}

document.readyState==="loading"
 ? document.addEventListener("DOMContentLoaded",boot,{once:true})
 : boot();
})(window,document);
