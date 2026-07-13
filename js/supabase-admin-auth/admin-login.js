/* ==========================================
   ALBUKHR ADMIN LOGIN CONTROLLER
   Version 3.0
========================================== */

(function(window){

"use strict";

/* ==========================================
   AUTO SESSION REDIRECT
========================================== */

document.addEventListener(

"DOMContentLoaded",

async ()=>{

try{

const admin =
await getCurrentAdmin();

if(admin){

location.replace(
"unified-admin-buttons.html"
);

}

}catch(error){

console.error(error);

}

});

/* ==========================================
   LOGIN
========================================== */

async function login(){

const btn =
document.querySelector(".login-btn");

const email =
document
.getElementById("email")
.value
.trim()
.toLowerCase();

const key =
document
.getElementById("key")
.value
.trim();

if(!email){

alert(
"Administrator Email Required"
);

return;

}

if(!key){

alert(
"Access Key Required"
);

return;

}

btn.disabled = true;

btn.textContent =
"Signing In...";

try{

const result =
await adminLogin({

email,

accessKey:key

});

if(result.error){

alert(result.error);

return;

}

location.replace(
"unified-admin-buttons.html"
);

}catch(error){

console.error(error);

alert(

error.message ||

"Login failed."

);

}finally{

btn.disabled = false;

btn.textContent =
"Access Control Center";

}

}

/* ==========================================
   EXPORT
========================================== */

window.login = login;

})(window);
