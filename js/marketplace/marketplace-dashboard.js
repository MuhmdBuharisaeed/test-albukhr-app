let CURRENT_PROJECT = null;
let MARKET = null;
let PROJECTS = [];
let FILTERED = [];
let REFRESHING = false;
const REFRESH_INTERVAL = 10000;

const projectList = document.getElementById("projectList");
const marketInsights = document.getElementById("marketInsights");
const discoverySection = document.getElementById("discoverySection");
const searchInput = document.getElementById("projectSearch");
const sortSelect = document.getElementById("sortProjects");

function escapeHTML(value){
  return String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

function getProjectByCode(code){
  return MARKET?.projects?.find(p => p.code === code) || null;
}

function projectIconMarkup(project){
  const icon = project?.icon;
  if(typeof icon === "string" && /^https?:\/\//i.test(icon)){
    return `<img src="${escapeHTML(icon)}" alt="" loading="lazy"
      onerror="this.style.display='none'">`;
  }
  return `<svg class="project-icon-fallback" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="3"></rect>
    <path d="M8 9h8M8 12h5M8 15h8"></path>
  </svg>`;
}

document.addEventListener("DOMContentLoaded", initializeMarketplace);

async function initializeMarketplace(){
  try{
    showLoading();
    if(!window.AlbukhrEcosystem || typeof AlbukhrEcosystem.marketplace !== "function")
      throw new Error("Marketplace engine is unavailable.");

    MARKET = await AlbukhrEcosystem.marketplace(true);
    PROJECTS = Array.isArray(MARKET?.projects) ? [...MARKET.projects] : [];
    FILTERED = [...PROJECTS];

    renderMarketplace();
    renderMarketInsights();
    renderFeaturedProject();
    attachMarketplaceEvents();
    startMarketplaceRefresh();
  }catch(error){
    console.error("Marketplace initialization error:",error);
    showMarketplaceError();
  }
}

function attachMarketplaceEvents(){
  searchInput?.addEventListener("input", filterMarketplace);
  sortSelect?.addEventListener("change", () => sortMarketplace());

  document.getElementById("investModal")?.addEventListener("click", e => {
    if(e.target.id === "investModal") closeInvestModal();
  });

  document.getElementById("appAlert")?.addEventListener("click", e => {
    if(e.target.id === "appAlert") window.closeAppAlert?.();
  });
}

function showLoading(){
  if(!projectList) return;
  projectList.innerHTML = `
    <div class="loading-card">
      <div class="skeleton" style="height:28px;width:60%"></div>
      <div class="skeleton"></div><div class="skeleton"></div>
      <div class="skeleton" style="width:80%"></div>
    </div>`;
}

function showMarketplaceError(){
  if(!projectList) return;
  projectList.innerHTML = `
    <div class="loading-card">
      <strong>Marketplace unavailable</strong>
      <p>Unable to load projects right now. Please try again.</p>
      <button type="button" class="invest-btn" onclick="initializeMarketplace()">Retry</button>
    </div>`;
}

function renderMarketplace(){
  if(!projectList) return;
  projectList.innerHTML = "";
  if(!FILTERED.length){
    projectList.innerHTML = `<div class="empty">No projects match your search.</div>`;
    return;
  }
  FILTERED.forEach(renderProjectCard);
}

function filterMarketplace(){
  const keyword = (searchInput?.value || "").trim().toLowerCase();
  FILTERED = PROJECTS.filter(p =>
    String(p?.title || "").toLowerCase().includes(keyword) ||
    String(p?.description || "").toLowerCase().includes(keyword) ||
    String(p?.category || "").toLowerCase().includes(keyword) ||
    String(p?.code || "").toLowerCase().includes(keyword)
  );
  sortMarketplace(false);
}

function sortMarketplace(render=true){
  const sort = sortSelect?.value || "";
  if(sort === "roi")
    FILTERED.sort((a,b)=>(Number(b?.roi)||0)-(Number(a?.roi)||0));
  else if(sort === "liquidity")
    FILTERED.sort((a,b)=>(Number(b?.liquidity)||0)-(Number(a?.liquidity)||0));
  else if(sort === "risk")
    FILTERED.sort((a,b)=>(Number(a?.risk?.score)||0)-(Number(b?.risk?.score)||0));
  else
    FILTERED.sort((a,b)=>(Number(a?.sortOrder)||9999)-(Number(b?.sortOrder)||9999));

  if(render) renderMarketplace();
}

function renderProjectCard(project){
  const card = document.createElement("article");
  card.className = "project-card";

  const code = String(project?.code || "");
  const liquidity = Number(project?.liquidity) || 0;
  const investors = Number(project?.investors) || 0;
  const roi = Number(project?.roi) || 0;
  const minimum = Number(project?.minimum) || 1;
  const target = Number(project?.target) || 1000;
  const funded = target > 0 ? Math.min(liquidity / target * 100,100) : 0;
  const risk = String(project?.risk?.risk || "LOW").toUpperCase();

  let badges = "";
  if(project?.type === "core") badges += `<span class="core-badge">CORE</span>`;
  if(investors >= 20) badges += `<span class="trend">TRENDING</span>`;
  if(roi >= 15) badges += `<span class="roi-badge">HIGH ROI</span>`;
  if(liquidity >= 1000) badges += `<span class="liquidity-badge">STRONG LIQUIDITY</span>`;
  badges += `<span class="risk-badge ${escapeHTML(risk.toLowerCase())}">RISK: ${escapeHTML(risk)}</span>`;

  card.innerHTML = `
    <div class="project-header">
      <div class="project-icon">${projectIconMarkup(project)}</div>
      <div style="flex:1;min-width:0">
        <div class="project-title">${escapeHTML(project?.title || "Unnamed Project")}</div>
        <div class="project-category">${escapeHTML(project?.category || "Investment Project")}</div>
        <div class="badge-group">${badges}</div>
      </div>
    </div>

    <div class="project-desc">${escapeHTML(project?.description || "No description available.")}</div>

    <div class="project-info">
      <div class="info-box"><span>ROI</span><b>${roi.toFixed(2)}%</b></div>
      <div class="info-box"><span>Liquidity</span><b>${liquidity.toFixed(2)} Pi</b></div>
      <div class="info-box"><span>Investors</span><b>${investors}</b></div>
      <div class="info-box"><span>Risk</span><b>${escapeHTML(risk)}</b></div>
    </div>

    <div class="project-progress">
      <div class="progress-label"><span>Funding Progress</span><span>${funded.toFixed(1)}%</span></div>
      <div class="progress"><div class="progress-bar" style="width:${funded}%"></div></div>
    </div>

    <div class="roi-box">
      <div class="roi-title">ROI Calculator</div>
      <input class="roi-input" type="number" min="${minimum}" step="0.01"
        inputmode="decimal" placeholder="Minimum ${minimum} Pi">
      <div class="roi-result"><span>Expected Return</span><b>0.00 Pi</b></div>
    </div>

    <button type="button" class="invest-btn" data-project-code="${escapeHTML(code)}">
      Invest Now
    </button>`;

  card.addEventListener("click", e => {
    if(e.target.closest(".invest-btn") || e.target.closest(".roi-input")) return;
    location.href = `project.html?project=${encodeURIComponent(code)}`;
  });

  const input = card.querySelector(".roi-input");
  input?.addEventListener("input", () => updateROI(input, roi));

  card.querySelector(".invest-btn")?.addEventListener("click", e => {
    e.stopPropagation();
    const selected = getProjectByCode(code);
    if(selected) openInvestModal(selected);
  });

  projectList.appendChild(card);
}

function updateROI(input, roi){
  const amount = Number(input?.value) || 0;
  const result = amount * (Number(roi)||0) / 100;
  const box = input?.nextElementSibling;
  if(box) box.innerHTML = `<span>Expected Return</span><b>${result.toFixed(2)} Pi</b>`;
}

function calculateROI(amount,roi){
  return ((Number(amount)||0)*(Number(roi)||0)/100).toFixed(2);
}

function renderMarketInsights(){
  if(!marketInsights || !MARKET) return;
  const hot = Array.isArray(MARKET.hotProjects) ? MARKET.hotProjects : [];
  const liquidity = Array.isArray(MARKET.liquidityLeaders) ? MARKET.liquidityLeaders : [];
  const investors = Array.isArray(MARKET.topInvestors) ? MARKET.topInvestors : [];

  marketInsights.innerHTML = `
    <div class="market-box"><h3>Hot Projects</h3>
      ${hot.length ? hot.map(p=>`<div class="market-item"><span>${escapeHTML(p?.title||"Project")}</span><b>${Number(p?.investors||0)} Investors</b></div>`).join("") : `<div class="market-item"><span>No data available</span></div>`}
    </div>
    <div class="market-box"><h3>Liquidity Leaders</h3>
      ${liquidity.length ? liquidity.map(p=>`<div class="market-item"><span>${escapeHTML(p?.title||"Project")}</span><b>${(Number(p?.liquidity)||0).toFixed(2)} Pi</b></div>`).join("") : `<div class="market-item"><span>No data available</span></div>`}
    </div>
    <div class="market-box"><h3>Top Investors</h3>
      ${investors.length ? investors.map(u=>`<div class="market-item"><span>${escapeHTML(u?.user||"Investor")}</span><b>${(Number(u?.amount)||0).toFixed(2)} Pi</b></div>`).join("") : `<div class="market-item"><span>No data available</span></div>`}
    </div>`;
}

function renderFeaturedProject(){
  if(!discoverySection || !MARKET) return;
  const project = MARKET.featured;
  if(!project){ discoverySection.innerHTML=""; return; }

  const liquidity = Number(project?.liquidity)||0;
  const target = Number(project?.target)||100;
  const funded = target > 0 ? Math.min(liquidity/target*100,100) : 0;

  discoverySection.innerHTML = `
    <div class="featured-project">
      <div class="featured-title">Featured Project</div>
      <div class="featured-name">${escapeHTML(project?.title||"Featured Project")}</div>
      <div class="featured-desc">${escapeHTML(project?.description||"No description available.")}</div>
      <div class="featured-stats">
        <div class="featured-stat"><span>ROI</span><b>${(Number(project?.roi)||0).toFixed(2)}%</b></div>
        <div class="featured-stat"><span>Liquidity</span><b>${liquidity.toFixed(2)} Pi</b></div>
        <div class="featured-stat"><span>Investors</span><b>${Number(project?.investors)||0}</b></div>
      </div>
      <div class="featured-progress"><div class="featured-progress-bar" style="width:${funded}%"></div></div>
      <div class="featured-funded">${funded.toFixed(1)}% Funded</div>
      <button type="button" class="featured-btn"
        onclick="location.href='project.html?project=${encodeURIComponent(String(project?.code||''))}'">
        Open Project
      </button>
    </div>`;
}

async function invest(projectCode){
  const project = getProjectByCode(projectCode);
  if(!project){ showAlert("Project Not Found","Unable to load project."); return; }

  const amountText = prompt(`Enter stake amount\n\nMinimum: ${project.minimum} Pi`);
  if(amountText === null) return;

  const amount = Number(amountText);
  if(!Number.isFinite(amount) || amount < Number(project.minimum)){
    showAlert("Invalid Amount",`Minimum stake is ${project.minimum} Pi`);
    return;
  }

  try{
    const result = await AlbukhrEcosystem.invest({
      project:project.code,
      amount,
      duration:Number(project?.durations?.[0]||30)
    });
    if(result?.error){ showAlert("Investment Failed",result.error); return; }
    showAlert("Investment Successful",`You invested ${amount} Pi in ${project.title}.`);
    await refreshMarketplace();
  }catch(error){
    console.error(error);
    showAlert("Marketplace Error",error?.message||"Unable to complete the investment.");
  }
}

function openInvestModal(project){
  if(!project) return;
  CURRENT_PROJECT = project;

  const name = document.getElementById("investProjectName");
  const amount = document.getElementById("investAmount");
  const modal = document.getElementById("investModal");

  if(name) name.innerHTML = `Project: <strong>${escapeHTML(project.title)}</strong><br>Minimum: ${Number(project.minimum)||1} Pi`;
  if(amount){ amount.value=""; amount.min=Number(project.minimum)||1; }
  modal?.classList.add("show");
  setTimeout(()=>amount?.focus(),100);
}

function closeInvestModal(){
  document.getElementById("investModal")?.classList.remove("show");
  CURRENT_PROJECT = null;
}

async function confirmInvestment(){
  if(!CURRENT_PROJECT) return;

  const project = CURRENT_PROJECT;
  const amount = Number(document.getElementById("investAmount")?.value);
  const minimum = Number(project.minimum)||1;

  if(!Number.isFinite(amount) || amount < minimum){
    showAlert("Invalid Amount",`Minimum investment is ${minimum} Pi`);
    return;
  }

  closeInvestModal();

  try{
    const result = await AlbukhrEcosystem.invest({
      project:project.code,
      amount,
      duration:Number(project?.durations?.[0]||30)
    });

    if(result?.error){ showAlert("Investment Failed",result.error); return; }

    showAlert("Investment Successful",`${amount} Pi invested in ${project.title}.`);
    await refreshMarketplace();
  }catch(error){
    console.error(error);
    showAlert("Investment Failed",error?.message||"Unable to complete the investment.");
  }
}

function showAlert(title,message){
  if(typeof window.openAppAlert === "function"){
    window.openAppAlert(title,message);
    return;
  }

  const box = document.getElementById("appAlert");
  const titleEl = document.getElementById("appAlertTitle");
  const textEl = document.getElementById("appAlertText");

  if(titleEl) titleEl.textContent = title;
  if(textEl) textEl.textContent = message;
  box?.classList.add("show");
}

async function refreshMarketplace(){
  if(REFRESHING) return;
  REFRESHING = true;

  try{
    MARKET = await AlbukhrEcosystem.marketplace(true);
    PROJECTS = Array.isArray(MARKET?.projects) ? [...MARKET.projects] : [];
    FILTERED = [...PROJECTS];
    filterMarketplace();
    renderMarketInsights();
    renderFeaturedProject();
  }catch(error){
    console.error("Marketplace refresh error:",error);
  }finally{
    REFRESHING = false;
  }
}

function startMarketplaceRefresh(){
  setInterval(refreshMarketplace,REFRESH_INTERVAL);
}

document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){
    closeInvestModal();
    window.closeAppAlert?.();
    document.getElementById("appAlert")?.classList.remove("show");
  }
});
