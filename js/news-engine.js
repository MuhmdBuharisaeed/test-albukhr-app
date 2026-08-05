/* =========================================
   ALBUKHR NEWS ENGINE
   news.js
========================================= */

/* =========================================
   GLOBAL STATE
========================================= */

const NewsState = {

    allNews: [],
    filteredNews: [],

    page: 1,
    limit: 10,

    currentTab: "all",

    loading: false,

    hasMore: true

};


/* =========================================
   DOM REFERENCES
========================================= */

const newsFeed =
document.getElementById("newsFeed");

const newsEmpty =
document.getElementById("newsEmpty");

const newsLoading =
document.getElementById("newsLoading");

const refreshNewsBtn =
document.getElementById("refreshNewsBtn");

const loadMoreNews =
document.getElementById("loadMoreNews");

const searchInput =
document.getElementById("newsSearch");

const officialCount =
document.getElementById("officialNewsCount");

const projectCount =
document.getElementById("projectNewsCount");

const tabAll =
document.getElementById("tabAll");

const tabOfficial =
document.getElementById("tabOfficial");

const tabProjects =
document.getElementById("tabProjects");


/* =========================================
   CURRENT USER
========================================= */

let currentUser = null;


/* =========================================
   LOAD USER
========================================= */

function loadCurrentUser(){

    try{

        currentUser = JSON.parse(
            localStorage.getItem("pi_user")
        );

        if(!currentUser){

            location.href = "login.html";
            return;

        }

        const userLabel =
        document.getElementById("piUser");

        if(userLabel){

            userLabel.innerText =
            currentUser.username || "";

        }

    }catch(e){

        console.error(e);

        location.href="login.html";

    }

}


/* =========================================
   SHOW LOADING
========================================= */

function showLoading(){

    NewsState.loading = true;

    if(newsLoading){

        newsLoading.style.display="flex";

    }

}


/* =========================================
   HIDE LOADING
========================================= */

function hideLoading(){

    NewsState.loading = false;

    if(newsLoading){

        newsLoading.style.display="none";

    }

}


/* =========================================
   UPDATE COUNTERS
========================================= */

function updateCounters(){

    let official =
    NewsState.allNews.filter(x=>

        x.category==="official"

    ).length;

    let projects =
    NewsState.allNews.filter(x=>

        x.category==="project"

    ).length;

    officialCount.innerText =
    official;

    projectCount.innerText =
    projects;

}


/* =========================================
   CLEAR ACTIVE TAB
========================================= */

function clearTabs(){

    tabAll.classList.remove("active");
    tabOfficial.classList.remove("active");
    tabProjects.classList.remove("active");

}


/* =========================================
   CHANGE TAB
========================================= */

function selectTab(tab){

    NewsState.currentTab = tab;

    clearTabs();

    if(tab==="all"){

        tabAll.classList.add("active");

    }

    if(tab==="official"){

        tabOfficial.classList.add("active");

    }

    if(tab==="projects"){

        tabProjects.classList.add("active");

    }

    filterNews();

}


/* =========================================
   TAB EVENTS
========================================= */

tabAll.onclick=()=>{

    selectTab("all");

};

tabOfficial.onclick=()=>{

    selectTab("official");

};

tabProjects.onclick=()=>{

    selectTab("projects");

};


/* =========================================
   SEARCH
========================================= */

searchInput.addEventListener(

"input",

function(){

    filterNews();

}

);


/* =========================================
   REFRESH
========================================= */

refreshNewsBtn.onclick=function(){

    loadNews(true);

};


/* =========================================
   LOAD MORE
========================================= */

loadMoreNews.onclick=function(){

    NewsState.page++;

    renderNews();

};


/* =========================================
   PAGE INIT
========================================= */

document.addEventListener(

"DOMContentLoaded",

async ()=>{

    loadCurrentUser();

    await loadNews(true);

}

);
/* =========================================
   NEWS ENGINE
   PART 2
========================================= */

/* =========================================
   LOAD NEWS FEED
========================================= */

async function loadNewsFeed(){

try{

const official =
await getOfficialNews();

const projects =
await getMyProjectNews();

const merged = [

...official,

...projects

];

/* Latest First */

merged.sort((a,b)=>

new Date(b.created_at) -

new Date(a.created_at)

);

return merged;

}catch(err){

console.error(

"NEWS ENGINE",

err

);

return [];

}

}

/* =========================================
   OFFICIAL NEWS
========================================= */

async function getOfficialNews(){

const { data,error } =

await supabase

.from("ecosystem_news")

.select("*")

.eq("visible",true)

.order(

"created_at",

{

ascending:false

}

);

if(error){

console.error(error);

return [];

}

return (data||[]).map(item=>({

id:item.id,

type:"official",

category:"official",

title:item.title,

description:item.description,

image:item.image_url,

created_at:item.created_at,

project:null

}));

}

/* =========================================
   USER PROJECT NEWS
========================================= */

async function getMyProjectNews(){

const projects =

await getUserProjects();

if(!projects.length){

return [];

}

const { data,error } =

await supabase

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

return [];

}

return (data||[]).map(item=>({

id:item.id,

type:"project",

category:"project",

title:item.title,

description:item.description,

image:item.image_url,

created_at:item.created_at,

project:item.project

}));

}
/* =========================================
   NEWS ENGINE
   PART 3
========================================= */

/* =========================================
   GET USER PROJECTS
========================================= */

async function getUserProjects(){

try{

/* Get merged stakes */

const stakes =
await getAllStakesMerged();

if(!Array.isArray(stakes)){

return [];

}

/* Only active stake records */

const active =

stakes.filter(item=>

item &&

item.type==="stake" &&

Number(item.amount)>0 &&

item.project

);

/* Remove duplicates */

const unique =

[

...new Set(

active.map(

item=>item.project

)

)

];

return unique;

}catch(err){

console.error(

"getUserProjects",

err

);

return [];

}

}

/* =========================================
   FIND NEWS BY ID
========================================= */

function getNewsById(id){

return NEWS.all.find(

item=>String(item.id)===String(id)

);

}

/* =========================================
   SHORT TEXT
========================================= */

function shortText(

text="",

limit=180

){

if(text.length<=limit){

return text;

}

return text.substring(

0,

limit

)+"...";

}

/* =========================================
   FORMAT DATE
========================================= */

function formatDate(date){

if(!date){

return "";

}

return new Date(date)

.toLocaleString([],{

dateStyle:"medium",

timeStyle:"short"

});

}

/* =========================================
   ESCAPE HTML
========================================= */

function escapeHtml(text=""){

const div=

document.createElement("div");

div.innerText=text;

return div.innerHTML;

}

/* =========================================
   SHOW EMPTY
========================================= */

function showEmpty(){

newsFeed.style.display="none";

newsEmpty.style.display="block";

loadMoreNews.style.display="none";

}

/* =========================================
   HIDE EMPTY
========================================= */

function hideEmpty(){

newsFeed.style.display="block";

newsEmpty.style.display="none";

loadMoreNews.style.display="inline-flex";

}

/* =========================================
   END OF PART 3
========================================= */

/* =========================================
   NEWS ENGINE
   PART 4
========================================= */

/* =========================================
   FILTER NEWS
========================================= */

function filterNews(){

const keyword =
(
searchInput.value || ""
)
.toLowerCase()
.trim();

let list = [...NewsState.allNews];

/* TAB FILTER */

if(
NewsState.currentTab==="official"
){

list = list.filter(

item=>

item.category==="official"

);

}

if(
NewsState.currentTab==="projects"
){

list = list.filter(

item=>

item.category==="project"

);

}

/* SEARCH */

if(keyword){

list = list.filter(item=>{

return (

(item.title||"")
.toLowerCase()
.includes(keyword)

||

(item.description||"")
.toLowerCase()
.includes(keyword)

||

(item.project||"")
.toLowerCase()
.includes(keyword)

);

});

}

NewsState.filteredNews = list;

NewsState.page = 1;

renderNews();

}

/* =========================================
   RENDER NEWS
========================================= */

function renderNews(){

const end =
NewsState.page *
NewsState.limit;

const list =
NewsState.filteredNews
.slice(0,end);

newsFeed.innerHTML="";

if(!list.length){

showEmpty();

return;

}

hideEmpty();

list.forEach(item=>{

const card =
createNewsCard(item);

newsFeed.appendChild(card);

});

/* LOAD MORE */

if(
end >=
NewsState.filteredNews.length
){

loadMoreNews.style.display="none";

}else{

loadMoreNews.style.display=
"inline-flex";

}

}

/* =========================================
   LOAD NEWS
========================================= */

async function loadNews(refresh=false){

try{

showLoading();

const data =
await loadNewsFeed();

NewsState.allNews = data;

updateCounters();

filterNews();

}catch(err){

console.error(

"loadNews",

err

);

newsFeed.innerHTML=

`
<div class="loading-card">

Unable to load news.

</div>
`;

}finally{

hideLoading();

}

}

/* =========================================
   AUTO REFRESH
========================================= */

setInterval(

()=>{

loadNews();

},

60000

);

/* =========================================
   MANUAL REFRESH
========================================= */

window.refreshNews =
function(){

loadNews(true);

};

/* =========================================
   RELOAD AFTER
PROJECT UPDATE
========================================= */

window.addEventListener(

"projectFeedUpdated",

()=>{

loadNews();

}

);

/* =========================================
   RELOAD AFTER
OFFICIAL NEWS
========================================= */

window.addEventListener(

"officialNewsUpdated",

()=>{

loadNews();

}

);

/* =========================================
   EXPORT
========================================= */

window.NewsEngine={

loadNews,

loadNewsFeed,

filterNews,

renderNews,

getOfficialNews,

getMyProjectNews,

getUserProjects

};

/* =========================================
   END
========================================= */
