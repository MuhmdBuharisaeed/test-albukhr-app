(function(window,document){
"use strict";
function clean(v){return String(v==null?"":v).trim();}
function num(v){const n=Number(v);return Number.isFinite(n)?n:0;}
function pi(v){return num(v).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:7})+" π";}
function text(id,v){const n=document.getElementById(id);if(n)n.textContent=v;}
function renderUser(user){const name=clean(user?.username)||"Investor";text("heroUserName",name);text("walletAddress",clean(user?.wallet_address)||"Wallet verified through Testnet session");text("greetingText","Welcome");}
function renderSummary(s){text("totalPortfolio",pi(s?.portfolio));text("totalInvest",pi(s?.invested));text("totalEarn",pi(s?.earnings));text("totalProjects",String(s?.active_projects??0));text("heroPortfolio",pi(s?.portfolio));}
function renderInvestments(stakes,projects){
 const list=document.getElementById("investments"),empty=document.getElementById("emptyInvestments");if(!list)return;list.innerHTML="";
 const map=new Map((projects||[]).map(p=>[clean(p.project_code).toLowerCase(),p]));const rows=Array.isArray(stakes)?stakes:[];
 if(!rows.length){if(empty)empty.hidden=false;return;}if(empty)empty.hidden=true;
 rows.forEach(stake=>{const p=map.get(clean(stake.project_code).toLowerCase()),article=document.createElement("article");article.className="investment-card";const name=clean(p?.name)||clean(stake.project_code)||"Testnet Project";
 article.innerHTML='<div class="investment-main"><div class="investment-logo">'+(p?.logo_url?'<img loading="lazy" decoding="async" alt="">':'<span>A</span>')+'</div><div class="investment-info"><h3></h3><p class="investment-meta"></p></div></div><div class="investment-values"><div><span>Invested</span><strong class="amount"></strong></div><div><span>Reward</span><strong class="reward"></strong></div><span class="investment-status"></span></div>';
 article.querySelector("h3").textContent=name;article.querySelector(".investment-meta").textContent=(clean(stake.duration_days)||"—")+" days • "+num(stake.reward_rate)+"% reward";article.querySelector(".amount").textContent=pi(stake.amount);article.querySelector(".reward").textContent=pi(stake.reward_amount);article.querySelector(".investment-status").textContent=(clean(stake.status)||"UNKNOWN").toUpperCase();const img=article.querySelector("img");if(img){img.src=p.logo_url;img.alt=name;}list.appendChild(article);});
}
async function boot(){
 try{
  if(!window.AlbukhrTestnetAuth)throw new Error("Testnet authentication module is unavailable.");
  const session=await window.AlbukhrTestnetAuth.requireTestnetAuth();if(!session)return;
  if(!window.AlbukhrTestnetApi)throw new Error("Testnet API client is unavailable.");
  const payload=await window.AlbukhrTestnetApi.getInvestorData();if(clean(payload?.network).toLowerCase()!=="testnet")throw new Error("Invalid Testnet API response.");
  renderUser(payload.user);renderSummary(payload.summary);renderInvestments(payload.stakes,payload.projects);console.info("[ALBUKHR TESTNET INVESTOR] CONNECTED",payload.summary);
 }catch(error){console.error("[ALBUKHR TESTNET INVESTOR]",error);const node=document.getElementById("emptyInvestments");if(node){node.hidden=false;const p=node.querySelector("p");if(p)p.textContent=error?.message||"Unable to load Testnet investor data.";}}
}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",boot,{once:true}):boot();
})(window,document);
