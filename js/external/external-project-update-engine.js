/* =========================================
   ALBUKHR EXTERNAL PROJECT UPDATE ENGINE
   v4 MAINNET READY
   PART 1
========================================= */

/*
TABLE:
external_project_updates

Future Ready:
- Supabase
- Offline Cache
- Mainnet
*/

/* =========================================
TABLE
========================================= */

const EXTERNAL_UPDATE_TABLE =
"external_project_updates";

/* =========================================
STATUS
========================================= */

const UPDATE_STATUS={

DRAFT:"draft",

PUBLISHED:"published",

ARCHIVED:"archived",

DELETED:"deleted"

};

/* =========================================
VISIBILITY
========================================= */

const UPDATE_VISIBILITY={

PUBLIC:"public",

INVESTORS:"investors",

TEAM:"team",

PRIVATE:"private"

};

/* =========================================
TYPE
========================================= */

const UPDATE_TYPE={

GENERAL:"general",

PROGRESS:"progress",

FINANCIAL:"financial",

MILESTONE:"milestone",

MEDIA:"media",

ANNOUNCEMENT:"announcement"

};

/* =========================================
HELPERS
========================================= */

function updateNow(){

return new Date().toISOString();

}

function updateUUID(){

return(

"UPD-"+

Date.now()+"-"+

Math.random()

.toString(36)

.substring(2,10)

);

}

function safeUpdateNumber(

v,

d=0

){

const n=Number(v);

return Number.isFinite(n)

?n

:d;

}

function safeUpdateString(

v,

d=""

){

if(

v===null||

v===undefined

){

return d;

}

return String(v);

}

/* =========================================
SUPABASE
========================================= */

function getUpdateSupabase(){

if(

typeof window

.getAlbukhrSupabaseClient

==="function"

){

return window

.getAlbukhrSupabaseClient();

}

if(window.albukhrSupabase){

return window

.albukhrSupabase;

}

return null;

}

/* =========================================
LOCAL STORAGE
========================================= */

const UPDATE_CACHE=

"albukhr_external_updates";

/* ========================================= */

function getLocalUpdates(){

try{

const rows=

JSON.parse(

localStorage.getItem(

UPDATE_CACHE

)

);

return Array.isArray(rows)

?rows

:[];

}catch{

return[];

}

}

/* ========================================= */

function saveLocalUpdates(rows){

localStorage.setItem(

UPDATE_CACHE,

JSON.stringify(rows)

);

}

/* =========================================
NORMALIZE
========================================= */

function normalizeUpdate(row={}){

return{

id:

row.id||

updateUUID(),

project_code:

safeUpdateString(

row.project_code

),

title:

safeUpdateString(

row.title

),

summary:

safeUpdateString(

row.summary

),

content:

safeUpdateString(

row.content

),

type:

safeUpdateString(

row.type,

UPDATE_TYPE.GENERAL

),

status:

safeUpdateString(

row.status,

UPDATE_STATUS.DRAFT

),

visibility:

safeUpdateString(

row.visibility,

UPDATE_VISIBILITY.PUBLIC

),

featured:

!!row.featured,

pinned:

!!row.pinned,

cover_image:

safeUpdateString(

row.cover_image

),

author_uid:

safeUpdateString(

row.author_uid

),

author_name:

safeUpdateString(

row.author_name

),

created_at:

row.created_at||

updateNow(),

updated_at:

row.updated_at||

updateNow(),

published_at:

row.published_at||

null,

raw:row

};

}

/* =========================================
GET ALL
========================================= */

async function getExternalUpdates(){

const supabase=

getUpdateSupabase();

if(!supabase){

return getLocalUpdates()

.map(

normalizeUpdate

);

}

try{

const{

data,

error

}=await supabase

.from(

EXTERNAL_UPDATE_TABLE

)

.select("*")

.order(

"created_at",

{

ascending:false

}

);

if(error)

throw error;

return(data||[])

.map(

normalizeUpdate

);

}catch(e){

console.warn(

e

);

return getLocalUpdates()

.map(

normalizeUpdate

);

}

}

/* =========================================
GET ONE
========================================= */

async function getExternalUpdate(id){

const rows=

await getExternalUpdates();

return(

rows.find(

r=>r.id===id

)

||

null

);

  }
/* =========================================
CREATE UPDATE
========================================= */

async function createExternalUpdate(payload={}){

const row =
normalizeUpdate({

...payload,

id:updateUUID(),

status:
payload.status ||
UPDATE_STATUS.DRAFT,

created_at:updateNow(),

updated_at:updateNow()

});

const supabase =
getUpdateSupabase();

if(!supabase){

const rows =
getLocalUpdates();

rows.unshift(row);

saveLocalUpdates(rows);

return{
success:true,
data:row
};

}

try{

const{

data,

error

}=await supabase

.from(
EXTERNAL_UPDATE_TABLE
)

.insert(row)

.select()

.single();

if(error)
throw error;

return{

success:true,

data:
normalizeUpdate(data)

};

}catch(e){

console.warn(e);

const rows =
getLocalUpdates();

rows.unshift(row);

saveLocalUpdates(rows);

return{

success:true,

offline:true,

data:row

};

}

}

/* =========================================
UPDATE
========================================= */

async function updateExternalUpdate(

id,

patch={}

){

const supabase =
getUpdateSupabase();

patch.updated_at =
updateNow();

if(!supabase){

let rows =
getLocalUpdates();

rows = rows.map(r=>{

if(r.id!==id)
return r;

return{

...r,

...patch

};

});

saveLocalUpdates(rows);

return{

success:true

};

}

try{

const{

data,

error

}=await supabase

.from(

EXTERNAL_UPDATE_TABLE

)

.update(patch)

.eq("id",id)

.select()

.single();

if(error)
throw error;

return{

success:true,

data:
normalizeUpdate(data)

};

}catch(e){

console.warn(e);

let rows =
getLocalUpdates();

rows = rows.map(r=>{

if(r.id!==id)
return r;

return{

...r,

...patch

};

});

saveLocalUpdates(rows);

return{

success:true,

offline:true

};

}

}

/* =========================================
DELETE (SOFT)
========================================= */

async function deleteExternalUpdate(id){

return await updateExternalUpdate(

id,

{

status:
UPDATE_STATUS.DELETED

}

);

}

/* =========================================
RESTORE
========================================= */

async function restoreExternalUpdate(id){

return await updateExternalUpdate(

id,

{

status:
UPDATE_STATUS.DRAFT

}

);

}

/* =========================================
PUBLISH
========================================= */

async function publishExternalUpdate(id){

return await updateExternalUpdate(

id,

{

status:
UPDATE_STATUS.PUBLISHED,

published_at:
updateNow()

}

);

}

/* =========================================
UNPUBLISH
========================================= */

async function unpublishExternalUpdate(id){

return await updateExternalUpdate(

id,

{

status:
UPDATE_STATUS.DRAFT,

published_at:null

}

);

}

/* =========================================
ARCHIVE
========================================= */

async function archiveExternalUpdate(id){

return await updateExternalUpdate(

id,

{

status:
UPDATE_STATUS.ARCHIVED

}

);

}
/* =========================================
PIN UPDATE
========================================= */

async function pinExternalUpdate(id){

return await updateExternalUpdate(

id,

{

pinned:true

}

);

}

/* =========================================
UNPIN UPDATE
========================================= */

async function unpinExternalUpdate(id){

return await updateExternalUpdate(

id,

{

pinned:false

}

);

}

/* =========================================
FEATURE UPDATE
========================================= */

async function featureExternalUpdate(id){

return await updateExternalUpdate(

id,

{

featured:true

}

);

}

/* =========================================
UNFEATURE UPDATE
========================================= */

async function unfeatureExternalUpdate(id){

return await updateExternalUpdate(

id,

{

featured:false

}

);

}

/* =========================================
CHANGE VISIBILITY
========================================= */

async function changeUpdateVisibility(

id,

visibility

){

if(

!Object.values(

UPDATE_VISIBILITY

).includes(

visibility

)

){

return{

error:

"Invalid visibility"

};

}

return await updateExternalUpdate(

id,

{

visibility

}

);

}

/* =========================================
GET PROJECT UPDATES
========================================= */

async function getProjectUpdates(

projectCode

){

const rows =

await getExternalUpdates();

return rows.filter(r=>

r.project_code===

projectCode &&

r.status!==

UPDATE_STATUS.DELETED

);

}

/* =========================================
GET PUBLISHED UPDATES
========================================= */

async function getPublishedUpdates(){

const rows=

await getExternalUpdates();

return rows.filter(r=>

r.status===

UPDATE_STATUS.PUBLISHED

);

}

/* =========================================
GET FEATURED UPDATES
========================================= */

async function getFeaturedUpdates(){

const rows=

await getPublishedUpdates();

return rows.filter(r=>

r.featured===true

);

}

/* =========================================
GET PINNED UPDATES
========================================= */

async function getPinnedUpdates(){

const rows=

await getPublishedUpdates();

return rows.filter(r=>

r.pinned===true

);

}

/* =========================================
SEARCH
========================================= */

async function searchExternalUpdates(

keyword

){

keyword=

safeUpdateString(

keyword

)

.toLowerCase()

.trim();

const rows=

await getExternalUpdates();

if(!keyword)

return rows;

return rows.filter(r=>{

return(

safeUpdateString(

r.title

)

.toLowerCase()

.includes(keyword)

||

safeUpdateString(

r.summary

)

.toLowerCase()

.includes(keyword)

||

safeUpdateString(

r.content

)

.toLowerCase()

.includes(keyword)

);

});

}

/* =========================================
FILTER BY TYPE
========================================= */

async function getUpdatesByType(

type

){

const rows=

await getExternalUpdates();

return rows.filter(r=>

r.type===type

);

}

/* =========================================
RECENT UPDATES
========================================= */

async function getRecentUpdates(

limit=10

){

const rows=

await getPublishedUpdates();

return rows

.sort((a,b)=>

new Date(

b.created_at

)-

new Date(

a.created_at

)

)

.slice(

0,

limit

);

}
/* =========================================
UPDATE STATISTICS
========================================= */

async function getExternalUpdateStats(){

const rows =
await getExternalUpdates();

return{

total:
rows.length,

published:
rows.filter(r=>

r.status===UPDATE_STATUS.PUBLISHED

).length,

draft:
rows.filter(r=>

r.status===UPDATE_STATUS.DRAFT

).length,

archived:
rows.filter(r=>

r.status===UPDATE_STATUS.ARCHIVED

).length,

deleted:
rows.filter(r=>

r.status===UPDATE_STATUS.DELETED

).length,

featured:
rows.filter(r=>

r.featured===true

).length,

pinned:
rows.filter(r=>

r.pinned===true

).length

};

}

/* =========================================
PROJECT UPDATE STATS
========================================= */

async function getProjectUpdateStats(

projectCode

){

const rows =
await getProjectUpdates(projectCode);

return{

project_code:
projectCode,

total:
rows.length,

published:
rows.filter(r=>

r.status===UPDATE_STATUS.PUBLISHED

).length,

draft:
rows.filter(r=>

r.status===UPDATE_STATUS.DRAFT

).length,

featured:
rows.filter(r=>

r.featured===true

).length,

pinned:
rows.filter(r=>

r.pinned===true

).length

};

}

/* =========================================
SYNC LOCAL -> SUPABASE
========================================= */

async function syncExternalUpdates(){

const supabase =
getUpdateSupabase();

if(!supabase){

return false;

}

const rows =
getLocalUpdates();

if(!rows.length){

return true;

}

for(const row of rows){

try{

await supabase

.from(
EXTERNAL_UPDATE_TABLE
)

.upsert(row);

}catch(e){

console.warn(

"Update Sync Error",

e

);

}

}

return true;

}

/* =========================================
INITIALIZE
========================================= */

async function initExternalUpdateEngine(){

await syncExternalUpdates();

return true;

}

/* =========================================
GLOBAL EXPORTS
========================================= */

window.createExternalUpdate =
createExternalUpdate;

window.updateExternalUpdate =
updateExternalUpdate;

window.deleteExternalUpdate =
deleteExternalUpdate;

window.restoreExternalUpdate =
restoreExternalUpdate;

window.publishExternalUpdate =
publishExternalUpdate;

window.unpublishExternalUpdate =
unpublishExternalUpdate;

window.archiveExternalUpdate =
archiveExternalUpdate;

window.pinExternalUpdate =
pinExternalUpdate;

window.unpinExternalUpdate =
unpinExternalUpdate;

window.featureExternalUpdate =
featureExternalUpdate;

window.unfeatureExternalUpdate =
unfeatureExternalUpdate;

window.changeUpdateVisibility =
changeUpdateVisibility;

window.getExternalUpdates =
getExternalUpdates;

window.getProjectUpdates =
getProjectUpdates;

window.getPublishedUpdates =
getPublishedUpdates;

window.getFeaturedUpdates =
getFeaturedUpdates;

window.getPinnedUpdates =
getPinnedUpdates;

window.searchExternalUpdates =
searchExternalUpdates;

window.getUpdatesByType =
getUpdatesByType;

window.getRecentUpdates =
getRecentUpdates;

window.getExternalUpdateStats =
getExternalUpdateStats;

window.getProjectUpdateStats =
getProjectUpdateStats;

window.syncExternalUpdates =
syncExternalUpdates;

window.initExternalUpdateEngine =
initExternalUpdateEngine;
