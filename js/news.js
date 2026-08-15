/* =========================================
   ALBUKHR NEWS ENGINE — CLEAN VERSION
   Compatible with simplified news.html

   Kept:
   - News feed
   - No News Available
   - Empty-state Refresh
   - Image preview
   - Full news modal
   - Share modal
   - Loading overlay

   Removed dependencies:
   - Hero refresh
   - Search
   - Tabs
   - Summary counters
   - Load More
========================================= */

"use strict";

const NEWS = {
  page: 1,
  limit: 10,
  loading: false,
  official: [],
  projects: [],
  merged: [],
  filtered: []
};

const newsFeed = document.getElementById("newsFeed");
const newsEmpty = document.getElementById("newsEmpty");
const refreshEmptyBtn = document.getElementById("refreshEmptyBtn");

let currentUser = null;

function safeParseUser(){
  try{
    const raw = localStorage.getItem("pi_user");
    if(!raw) return null;
    const user = JSON.parse(raw);
    return user && user.uid ? user : null;
  }catch(error){
    console.warn("ALBUKHR News: invalid pi_user:", error);
    return null;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if(!(await checkLogin())) return;
  loadUser();
  bindEvents();
  await loadNews();
});

async function checkLogin(){
  const user = safeParseUser();

  if(!user){
    window.location.replace("login.html");
    return false;
  }

  currentUser = user;
  return true;
}

function loadUser(){
  const el = document.getElementById("piUser");
  if(el) el.textContent = currentUser?.username || "";
}

function bindEvents(){
  refreshEmptyBtn?.addEventListener("click", refreshNews);
}

async function refreshNews(){
  if(NEWS.loading) return;

  NEWS.page = 1;
  NEWS.official = [];
  NEWS.projects = [];
  NEWS.merged = [];
  NEWS.filtered = [];

  showLoading();
  await loadNews();
}

function showLoading(){
  if(newsFeed){
    newsFeed.innerHTML = `
      <div class="loading-card">
        <div class="loading-spinner"></div>
        <h3>Loading News...</h3>
        <p>Please wait while we load the latest updates.</p>
      </div>
    `;
  }

  if(newsEmpty) newsEmpty.style.display = "none";
}

function showEmpty(){
  if(newsFeed) newsFeed.innerHTML = "";
  if(newsEmpty) newsEmpty.style.display = "block";
}

function hideEmpty(){
  if(newsEmpty) newsEmpty.style.display = "none";
}

function formatDate(date){
  if(!date) return "";

  const parsed = new Date(date);
  if(Number.isNaN(parsed.getTime())) return "";

  return parsed.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function shortText(text, length = 180){
  if(!text) return "";

  const value = String(text);
  return value.length <= length
    ? value
    : value.substring(0, length) + "...";
}

function escapeHtml(text = ""){
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(text = ""){
  return escapeHtml(text);
}

async function loadNews(){
  if(NEWS.loading) return;

  NEWS.loading = true;

  try{
    showLoading();

    await loadOfficialNews();
    await loadProjectNews();

    mergeNews();

    NEWS.filtered = [...NEWS.merged];

    renderNews();

  }catch(error){
    console.error("ALBUKHR NEWS ERROR:", error);
    showEmpty();

  }finally{
    NEWS.loading = false;
  }
}

async function loadOfficialNews(){
  if(typeof supabase === "undefined" || !supabase){
    console.error("ALBUKHR News: Supabase client not found.");
    return;
  }

  const { data, error } = await supabase
    .from("ecosystem_news")
    .select("*")
    .eq("visible", true)
    .order("created_at", { ascending: false })
    .range(0, NEWS.limit - 1);

  if(error){
    console.error("Official news error:", error);
    return;
  }

  NEWS.official = Array.isArray(data) ? data : [];
}

async function getUserProjects(){
  try{
    if(typeof getAllStakesMerged !== "function"){
      console.warn("ALBUKHR News: getAllStakesMerged() not found.");
      return [];
    }

    const stakes = await getAllStakesMerged();
    if(!Array.isArray(stakes)) return [];

    const projects = [];

    stakes.forEach(stake => {
      if(!stake) return;
      if(stake.type !== "stake") return;
      if(!stake.project) return;

      if(!projects.includes(stake.project)){
        projects.push(stake.project);
      }
    });

    return projects;

  }catch(error){
    console.error("ALBUKHR News getUserProjects error:", error);
    return [];
  }
}

async function loadProjectNews(){
  if(typeof supabase === "undefined" || !supabase){
    console.error("ALBUKHR News: Supabase client not found.");
    return;
  }

  const projects = await getUserProjects();

  if(!projects.length){
    NEWS.projects = [];
    return;
  }

  const { data, error } = await supabase
    .from("project_updates")
    .select("*")
    .in("project", projects)
    .eq("visible", true)
    .order("created_at", { ascending: false });

  if(error){
    console.error("Project news error:", error);
    NEWS.projects = [];
    return;
  }

  NEWS.projects = Array.isArray(data) ? data : [];
}

function mergeNews(){
  NEWS.merged = [];

  NEWS.official.forEach(item => {
    NEWS.merged.push({
      type: "official",
      category: "Ecosystem",
      ...item
    });
  });

  NEWS.projects.forEach(item => {
    NEWS.merged.push({
      type: "project",
      category: item.project || "Project",
      ...item
    });
  });

  NEWS.merged.sort((a, b) => {
    const dateA = new Date(a.created_at || 0).getTime();
    const dateB = new Date(b.created_at || 0).getTime();
    return dateB - dateA;
  });
}

function renderNews(){
  if(!newsFeed) return;

  newsFeed.innerHTML = "";

  if(!NEWS.filtered.length){
    showEmpty();
    return;
  }

  hideEmpty();

  NEWS.filtered.forEach(item => {
    newsFeed.appendChild(createNewsCard(item));
  });
}

function createNewsCard(item){
  const card = document.createElement("div");
  card.className = "news-card";

  const image = item.image || item.image_url || "";
  const desc = item.description || "";
  const preview = shortText(desc, 180);
  const id = escapeAttribute(String(item.id ?? ""));

  card.innerHTML = `
    <div class="news-card-header">
      <div class="news-category">
        ${escapeHtml(item.category || "")}
      </div>

      <div class="news-date">
        ${escapeHtml(formatDate(item.created_at))}
      </div>
    </div>

    <h3 class="news-title">
      ${escapeHtml(item.title || "Untitled News")}
    </h3>

    ${
      image
        ? `
          <img
            src="${escapeAttribute(image)}"
            class="news-image"
            alt="News image"
            loading="lazy"
            onclick="previewImage('${escapeAttribute(image)}')"
          >
        `
        : ""
    }

    <p class="news-description">
      ${escapeHtml(preview)}
    </p>

    <div class="news-card-actions">
      <button
        type="button"
        class="read-more-btn"
        onclick="openNewsModal('${id}')"
      >
        Read More
      </button>
    </div>
  `;

  return card;
}

function toggleReadMore(id){
  openNewsModal(id);
}

function previewImage(src){
  const modal = document.getElementById("imagePreviewModal");
  const image = document.getElementById("previewImage");

  if(!modal || !image) return;

  image.src = src;
  modal.classList.add("active");
}

function closeImagePreview(){
  const modal = document.getElementById("imagePreviewModal");
  const image = document.getElementById("previewImage");

  if(modal) modal.classList.remove("active");
  if(image) image.src = "";
}

function openNewsModal(id){
  const news = NEWS.filtered.find(
    item => String(item.id) === String(id)
  );

  if(!news) return;

  const modal = document.getElementById("newsModal");
  if(!modal) return;

  const title = document.getElementById("modalTitle");
  const category = document.getElementById("modalCategory");
  const date = document.getElementById("modalDate");
  const content = document.getElementById("modalContent");
  const img = document.getElementById("modalImage");
  const shareBtn = document.getElementById("shareNewsBtn");

  if(title) title.textContent = news.title || "Untitled News";
  if(category) category.textContent = news.category || "";
  if(date) date.textContent = formatDate(news.created_at);
  if(content) content.textContent = news.description || "";

  const image = news.image || news.image_url || "";

  if(img){
    if(image){
      img.src = image;
      img.alt = news.title || "News image";
      img.style.display = "block";
    }else{
      img.src = "";
      img.alt = "";
      img.style.display = "none";
    }
  }

  if(shareBtn){
    shareBtn.onclick = () => openShareModal(id);
  }

  modal.classList.add("active");
}

function closeNewsModal(){
  const modal = document.getElementById("newsModal");
  if(modal) modal.classList.remove("active");
}

function openShareModal(id){
  const modal = document.getElementById("shareModal");
  const input = document.getElementById("shareLink");

  if(!modal || !input) return;

  input.value =
    window.location.origin +
    window.location.pathname +
    "?news=" +
    encodeURIComponent(id);

  modal.classList.add("active");
}

function closeShareModal(){
  const modal = document.getElementById("shareModal");
  if(modal) modal.classList.remove("active");
}

async function copyShareLink(){
  const input = document.getElementById("shareLink");
  if(!input) return;

  const text = input.value;

  try{
    if(navigator.clipboard && window.isSecureContext){
      await navigator.clipboard.writeText(text);
    }else{
      input.select();
      input.setSelectionRange(0, 99999);
      document.execCommand("copy");
    }

    if(typeof openAppAlert === "function"){
      openAppAlert("Copied", "Share link copied.");
    }

  }catch(error){
    console.error("Copy share link failed:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const copyBtn = document.getElementById("copyShareLink");

  if(copyBtn){
    copyBtn.addEventListener("click", copyShareLink);
  }
});

function showLoadingOverlay(){
  const box = document.getElementById("newsLoading");
  if(box) box.style.display = "flex";
}

function hideLoadingOverlay(){
  const box = document.getElementById("newsLoading");
  if(box) box.style.display = "none";
}

setInterval(() => {
  if(document.visibilityState !== "visible") return;
  refreshNews();
}, 60000);

document.addEventListener("keydown", event => {
  if(event.key !== "Escape") return;

  closeNewsModal();
  closeShareModal();
  closeImagePreview();
});

/* =========================================
   END
========================================= */
