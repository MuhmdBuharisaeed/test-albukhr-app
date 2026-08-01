/* =========================================
   ALBUKHR NEWS ENGINE
   PART 1
========================================= */

"use strict";

/* =========================================
   GLOBAL STATE
========================================= */

const NEWS = {

page:1,

limit:10,

activeTab:"all",

search:"",

loading:false,

hasMore:true,

official:[],

projects:[],

merged:[],

filtered:[]

};

/* =========================================
   DOM
========================================= */

const newsFeed =
document.getElementById("newsFeed");

const newsEmpty =
document.getElementById("newsEmpty");

const searchInput =
document.getElementById("newsSearch");

const refreshBtn =
document.getElementById("refreshNewsBtn");

const loadMoreBtn =
document.getElementById("loadMoreNews");

const officialCount =
document.getElementById("officialNewsCount");

const projectCount =
document.getElementById("projectNewsCount");

/* =========================================
   USER
========================================= */

let currentUser = null;

/* =========================================
   INIT
========================================= */

document.addEventListener(
"DOMContentLoaded",
async()=>{

await checkLogin();

loadUser();

bindEvents();

/* Part 2 */

await loadNews();

});

/* =========================================
   LOGIN CHECK
========================================= */

async function checkLogin(){

const user =
JSON.parse(
localStorage.getItem("pi_user")
);

if(!user){

location.href="login.html";

return;

}

currentUser=user;

}

/* =========================================
   LOAD USER
========================================= */

function loadUser(){

const el =
document.getElementById("piUser");

if(!el) return;

el.textContent =
currentUser.username || "";

}

/* =========================================
   EVENTS
========================================= */

function bindEvents(){

searchInput.addEventListener(

"input",

e=>{

NEWS.search =
e.target.value
.trim()
.toLowerCase();

filterNews();

}

);

refreshBtn.addEventListener(

"click",

()=>{

refreshNews();

}

);

loadMoreBtn.addEventListener(

"click",

()=>{

loadMoreNews();

}

);

document
.querySelectorAll(".news-tab")
.forEach(btn=>{

btn.onclick=()=>{

document
.querySelectorAll(".news-tab")
.forEach(b=>

b.classList.remove("active")

);

btn.classList.add("active");

NEWS.activeTab =
btn.dataset.tab;

filterNews();

};

});

}

/* =========================================
   REFRESH
========================================= */

async function refreshNews(){

NEWS.page=1;

NEWS.hasMore=true;

NEWS.official=[];

NEWS.projects=[];

NEWS.merged=[];

NEWS.filtered=[];

showLoading();

await loadNews();

}

/* =========================================
   LOAD MORE
========================================= */

async function loadMoreNews(){

if(NEWS.loading) return;

if(!NEWS.hasMore) return;

NEWS.page++;

await loadNews();

}

/* =========================================
   SHOW LOADING
========================================= */

function showLoading(){

newsFeed.innerHTML=`

<div class="loading-card">

Loading latest news...

</div>

`;

newsEmpty.style.display="none";

}

/* =========================================
   SHOW EMPTY
========================================= */

function showEmpty(){

newsFeed.innerHTML="";

newsEmpty.style.display="block";

}

/* =========================================
   HIDE EMPTY
========================================= */

function hideEmpty(){

newsEmpty.style.display="none";

}

/* =========================================
   FORMAT DATE
========================================= */

function formatDate(date){

return new Date(date)

.toLocaleString([],{

dateStyle:"medium",

timeStyle:"short"

});

}

/* =========================================
   SHORT TEXT
========================================= */

function shortText(

text,

length=180

){

if(!text) return "";

if(text.length<=length)

return text;

return text.substring(0,length)+"...";

}

/* =========================================
   ESCAPE HTML
========================================= */

function escapeHtml(text=""){

return text

.replaceAll("&","&amp;")

.replaceAll("<","&lt;")

.replaceAll(">","&gt;")

.replaceAll('"',"&quot;");

}

/* =========================================
   NEWS ENGINE
   PART 2
========================================= */

/* =========================================
   LOAD NEWS
========================================= */

async function loadNews(){

try{

NEWS.loading=true;

showLoading();

/* Official */

await loadOfficialNews();

/* User Projects */

await loadProjectNews();

/* Merge */

mergeNews();

/* Filter */

filterNews();

updateCounters();

}catch(err){

console.error(

"NEWS ERROR",

err

);

showEmpty();

}finally{

NEWS.loading=false;

}

}

/* =========================================
   OFFICIAL NEWS
========================================= */

async function loadOfficialNews(){

const {

data,

error

}=await supabase

.from("ecosystem_news")

.select("*")

.eq("visible",true)

.order(

"created_at",

{

ascending:false

}

)

.range(

(NEWS.page-1)*NEWS.limit,

NEWS.page*NEWS.limit-1

);

if(error){

console.error(error);

return;

}

if(data.length<NEWS.limit){

NEWS.hasMore=false;

}

NEWS.official.push(...data);

}

/* =========================================
   USER STAKED PROJECTS
========================================= */

async function getUserProjects(){

const stakes=

await getAllStakesMerged();

const projects=[];

stakes.forEach(s=>{

if(

s.type==="stake" &&

!projects.includes(s.project)

){

projects.push(s.project);

}

});

return projects;

}

/* =========================================
   PROJECT NEWS
========================================= */

async function loadProjectNews(){

const projects=

await getUserProjects();

if(!projects.length){

return;

}

const {

data,

error

}=await supabase

.from("project_updates")

.select("*")

.in(

"project",

projects

)

.eq("visible",true)

.order(

"created_at",

{

ascending:false

}

);

if(error){

console.error(error);

return;

}

NEWS.projects.push(...data);

}

/* =========================================
   MERGE NEWS
========================================= */

function mergeNews(){

NEWS.merged=[];

NEWS.official.forEach(item=>{

NEWS.merged.push({

type:"official",

category:"Ecosystem",

...item

});

});

NEWS.projects.forEach(item=>{

NEWS.merged.push({

type:"project",

category:item.project,

...item

});

});

NEWS.merged.sort(

(a,b)=>

new Date(b.created_at)

-

new Date(a.created_at)

);

  }

/* =========================================
   NEWS ENGINE
   PART 3
========================================= */

/* =========================================
   FILTER NEWS
========================================= */

function filterNews(){

let list = [...NEWS.merged];

/* =========================
   CATEGORY FILTER
========================= */

if(NEWS.activeTab==="official"){

list = list.filter(

item=>item.type==="official"

);

}

if(NEWS.activeTab==="projects"){

list = list.filter(

item=>item.type==="project"

);

}

/* =========================
   SEARCH FILTER
========================= */

if(NEWS.search){

const keyword=

NEWS.search.toLowerCase();

list=list.filter(item=>{

return(

(item.title||"")

.toLowerCase()

.includes(keyword)

||

(item.description||"")

.toLowerCase()

.includes(keyword)

||

(item.category||"")

.toLowerCase()

.includes(keyword)

);

});

}

NEWS.filtered=list;

renderNews();

}

/* =========================================
   UPDATE COUNTERS
========================================= */

function updateCounters(){

officialCount.innerText=

NEWS.official.length;

projectCount.innerText=

NEWS.projects.length;

}

/* =========================================
   RENDER NEWS
========================================= */

function renderNews(){

newsFeed.innerHTML="";

if(!NEWS.filtered.length){

showEmpty();

return;

}

hideEmpty();

NEWS.filtered.forEach(item=>{

newsFeed.appendChild(

createNewsCard(item)

);

});

}

/* =========================================
   CREATE NEWS CARD
========================================= */

function createNewsCard(item){

const card=

document.createElement("div");

card.className="news-card";

const image=

item.image ||

item.image_url ||

"";

const desc=

item.description ||

"";

const preview=

shortText(desc,180);

card.innerHTML=`

<div class="news-card-header">

<div class="news-category">

${item.category}

</div>

<div class="news-date">

${formatDate(item.created_at)}

</div>

</div>

<h3 class="news-title">

${escapeHtml(item.title)}

</h3>

${

image ?

`

<img

src="${image}"

class="news-image"

onclick="previewImage('${image}')"

>

`

:""

}

<p
class="news-description"

id="desc-${item.id}"

data-full="${escapeHtml(desc)}"

data-short="${escapeHtml(preview)}"

>

${escapeHtml(preview)}

</p>

<button

class="read-more-btn"

onclick="toggleReadMore('${item.id}')"

>

Read More

</button>

`;

return card;

}

/* =========================================
   READ MORE
========================================= */

function toggleReadMore(id){

const desc=

document.getElementById(

`desc-${id}`

);

if(!desc) return;

const button=

desc.nextElementSibling;

const expanded=

button.dataset.expanded==="1";

if(expanded){

desc.innerHTML=

desc.dataset.short;

button.innerHTML=

"Read More";

button.dataset.expanded="0";

}else{

desc.innerHTML=

desc.dataset.full;

button.innerHTML=

"Show Less";

button.dataset.expanded="1";

}

  }

/* =========================================
   NEWS ENGINE
   PART 4
========================================= */

/* =========================================
   IMAGE PREVIEW
========================================= */

function previewImage(src){

const modal =
document.getElementById(
"imagePreviewModal"
);

const image =
document.getElementById(
"previewImage"
);

if(!modal || !image) return;

image.src = src;

modal.classList.add("active");

}

function closeImagePreview(){

document
.getElementById(
"imagePreviewModal"
)
.classList.remove("active");

}

/* =========================================
   FULL NEWS MODAL
========================================= */

function openNewsModal(id){

const news =
NEWS.filtered.find(

item=>String(item.id)===String(id)

);

if(!news) return;

document.getElementById(
"modalTitle"
).innerHTML =

escapeHtml(news.title);

document.getElementById(
"modalCategory"
).innerHTML =

escapeHtml(news.category);

document.getElementById(
"modalDate"
).innerHTML =

formatDate(news.created_at);

document.getElementById(
"modalContent"
).innerHTML =

escapeHtml(
news.description || ""
);

const img =
document.getElementById(
"modalImage"
);

if(news.image || news.image_url){

img.src =
news.image ||
news.image_url;

img.style.display="block";

}else{

img.style.display="none";

}

document
.getElementById(
"newsModal"
)
.classList.add("active");

/* Share */

document
.getElementById(
"shareNewsBtn"
)
.onclick=()=>{

openShareModal(id);

};

}

function closeNewsModal(){

document
.getElementById(
"newsModal"
)
.classList.remove("active");

}

/* =========================================
   SHARE
========================================= */

function openShareModal(id){

const modal =
document.getElementById(
"shareModal"
);

const input =
document.getElementById(
"shareLink"
);

const url =

location.origin +

location.pathname +

"?news="+id;

input.value=url;

modal.classList.add("active");

}

function closeShareModal(){

document
.getElementById(
"shareModal"
)
.classList.remove("active");

}

/* =========================================
   COPY LINK
========================================= */

document
.getElementById(
"copyShareLink"
)
?.addEventListener(

"click",

()=>{

const input=

document.getElementById(
"shareLink"
);

input.select();

document.execCommand(
"copy"
);

if(typeof openAppAlert==="function"){

openAppAlert(

"Copied",

"Share link copied."

);

}

}

);

/* =========================================
   LOADING
========================================= */

function showLoadingOverlay(){

const box =
document.getElementById(
"newsLoading"
);

if(box){

box.style.display="flex";

}

}

function hideLoadingOverlay(){

const box =
document.getElementById(
"newsLoading"
);

if(box){

box.style.display="none";

}

}

/* =========================================
   AUTO REFRESH
========================================= */

setInterval(()=>{

refreshNews();

},60000);

/* =========================================
   ESC CLOSE
========================================= */

document.addEventListener(

"keydown",

e=>{

if(e.key==="Escape"){

closeNewsModal();

closeShareModal();

closeImagePreview();

}

}

/* =========================================
   END
========================================= */
);
