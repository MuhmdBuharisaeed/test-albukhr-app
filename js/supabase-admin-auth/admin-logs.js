/* ==========================================
   ALBUKHR SUPABASE ADMIN LOG ENGINE
   Version 3.0
========================================== */

(function(window){

"use strict";

const TABLE = "admin_activity_logs";

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
   WRITE LOG
========================================== */

async function logAdminAction({

action,

target = null,

details = {},

ipAddress = null

}){

try{

const supabase = getClient();

/* Current User */

const {

data:{user},

error:userError

} = await supabase.auth.getUser();

if(userError){

throw userError;

}

if(!user){

return {
error:"No authenticated admin."
};

}

/* Insert */

const {error} = await supabase

.from(TABLE)

.insert({

admin_id:user.id,

action,

target,

details,

ip_address:ipAddress

});

if(error){

throw error;

}

return{

success:true

};

}catch(error){

console.error(

"[ADMIN LOG]",

error

);

return{

error:error.message

};

}

}

/* ==========================================
   GET LOGS
========================================== */

async function getAdminLogs(limit = 100){

try{

const supabase = getClient();

const {

data,

error

} = await supabase

.from(TABLE)

.select("*")

.order(

"created_at",

{ascending:false}

)

.limit(limit);

if(error){

throw error;

}

return data || [];

}catch(error){

console.error(error);

return [];

}

}

/* ==========================================
   GET MY LOGS
========================================== */

async function getMyAdminLogs(limit = 50){

try{

const supabase = getClient();

const {

data:{user}

} = await supabase.auth.getUser();

if(!user){

return [];

}

const {

data,

error

} = await supabase

.from(TABLE)

.select("*")

.eq(

"admin_id",

user.id

)

.order(

"created_at",

{ascending:false}

)

.limit(limit);

if(error){

throw error;

}

return data || [];

}catch(error){

console.error(error);

return [];

}

}

/* ==========================================
   EXPORT
========================================== */

window.logAdminAction =

logAdminAction;

window.getAdminLogs =

getAdminLogs;

window.getMyAdminLogs =

getMyAdminLogs;

})(window);
