/* ==========================================
   ALBUKHR ADMIN SESSION ENGINE
   Version 3.0
========================================== */

(function(window){

"use strict";

const TABLE = "admin_users";

/* ==========================================
   GET SUPABASE
========================================== */

function getClient(){

if(window.supabaseClient){

return window.supabaseClient;

}

throw new Error(
"Supabase client not initialized."
);

}

/* ==========================================
   GET CURRENT SESSION
========================================== */

async function getCurrentSession(){

const supabase = getClient();

const {

data:{session},
error

} = await supabase.auth.getSession();

if(error){

console.error(error);

return null;

}

return session;

}

/* ==========================================
   IS LOGGED IN
========================================== */

async function isAdminLoggedIn(){

const session =

await getCurrentSession();

return !!session;

}

/* ==========================================
   GET CURRENT ADMIN
========================================== */

async function getCurrentAdmin(){

try{

const supabase = getClient();

const session =

await getCurrentSession();

if(!session){

return null;

}

const user = session.user;

const {

data,
error

} = await supabase

.from(TABLE)

.select("*")

.eq(

"auth_user_id",

user.id

)

.eq(

"status",

"active"

)

.single();

if(error){

console.error(error);

return null;

}

return data;

}catch(error){

console.error(error);

return null;

}

}

/* ==========================================
   GET ROLE
========================================== */

async function getCurrentRole(){

const admin =

await getCurrentAdmin();

return admin

? admin.role_code

: null;

}

/* ==========================================
   REFRESH SESSION
========================================== */

async function refreshAdminSession(){

const supabase = getClient();

const {

data,
error

} = await supabase.auth.refreshSession();

if(error){

console.error(error);

return false;

}

return !!data.session;

}

/* ==========================================
   EXPORT
========================================== */

window.getCurrentSession =

getCurrentSession;

window.getCurrentAdmin =

getCurrentAdmin;

window.getCurrentRole =

getCurrentRole;

window.refreshAdminSession =

refreshAdminSession;

window.isAdminLoggedIn =

isAdminLoggedIn;

})(window);
