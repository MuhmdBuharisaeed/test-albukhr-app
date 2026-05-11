/* ======================================
   ALBUKHR NOTIFICATION SYSTEM
====================================== */

const NOTIF_KEY = "albukhr_notifications_read";

const notifications = [

{
id:1,
title:"Mainnet Migration Update",
date:"2026-02-10"
},

{
id:2,
title:"New KYC Phase Opened",
date:"2026-01-25"
}

];


/* ======================================
   COUNT UNREAD
====================================== */

function getUnreadCount(){

const read = JSON.parse(localStorage.getItem(NOTIF_KEY) || "[]");

const unread = notifications.filter(n => !read.includes(n.id));

return unread.length;

}


/* ======================================
   UPDATE BADGE
====================================== */

function updateNotificationBadge(){

const badge = document.getElementById("notifBadge");

if(!badge) return;

const count = getUnreadCount();

if(count <= 0){

badge.style.display="none";

}else{

badge.style.display="flex";
badge.textContent = count;

}

}


/* ======================================
   OPEN NOTIFICATIONS
====================================== */

function openNotifications(){

location.href="news.html";

}


/* ======================================
   MARK AS READ
====================================== */

function markNotificationsRead(){

const ids = notifications.map(n=>n.id);

localStorage.setItem(NOTIF_KEY, JSON.stringify(ids));

updateNotificationBadge();

}


document.addEventListener("DOMContentLoaded",updateNotificationBadge);
