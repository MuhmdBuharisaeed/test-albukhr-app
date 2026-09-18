(function(window,document){"use strict";
const RPC="get_public_project_registry";
function clean(v){return String(v??"").trim()}
function esc(v){return clean(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function load(){const s=window.ALBUKHR_SUPABASE;if(!s||typeof s.rpc!=="function")throw new Error("Testnet Supabase Core is unavailable.");
 const r=await s.rpc(RPC,{p_network:"testnet"});if(r.error)throw new Error(r.error.message||"Unable to load Testnet project registry.");
 return(Array.isArray(r.data)?r.data:[]).map(x=>({id:x.id,project_code:clean(x.project_code),slug:clean(x.slug),name:clean(x.name),project_type:clean(x.project_type),core_slot:x.core_slot,network:clean(x.network),status:clean(x.status),logo_url:clean(x.logo_url)})).filter(x=>x.network==="testnet")}
function render(c,ps){if(!c)return;if(!ps.length){c.innerHTML='<div class="notice"><strong>No approved projects found.</strong></div>';return}
 c.innerHTML=ps.map(p=>`<article class="project-card" tabindex="0" data-project-code="${esc(p.project_code)}" data-project-slug="${esc(p.slug)}"><div class="project-logo">${p.logo_url?`<img src="${esc(p.logo_url)}" alt="${esc(p.name)} logo" loading="lazy">`:`<div class="project-logo-fallback">${esc((p.name||"?").charAt(0))}</div>`}</div><div class="project-content"><span class="project-slot">CORE SLOT ${esc(p.core_slot)}</span><h3>${esc(p.name)}</h3><p>${esc(p.project_type||"Core project")}</p><span class="project-status">${esc(p.status)}</span></div></article>`).join("")}
window.AlbukhrTestnetRegistry=Object.freeze({load,render});
})(window,document);
