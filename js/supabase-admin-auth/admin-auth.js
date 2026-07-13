/* ==========================================
   ALBUKHR SUPABASE ADMIN AUTH ENGINE
   Version 3.0
========================================== */

(function(window){

"use strict";

const TABLE = "admin_users";

/* ==========================================
   GET CLIENT
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
   LOGIN
========================================== */

async function adminLogin({

email,

accessKey

}){

try{

const supabase = getClient();

/* ---------- SIGN IN ---------- */

const {

data,

error

} = await supabase.auth.signInWithPassword({

email,

password:accessKey

});

if(error){

return{

error:error.message

};

}

const user = data.user;

/* ---------- ADMIN PROFILE ---------- */

const {

data:admin,

error:adminError

} = await supabase

.from(TABLE)

.select("*")

.eq("auth_user_id",user.id)

.eq("status","active")

.single();

if(adminError || !admin){

await supabase.auth.signOut();

return{

error:"Admin account not found."

};

}

/* ---------- UPDATE LOGIN ---------- */

await supabase

.from(TABLE)

.update({

last_login:new Date().toISOString()

})

.eq("id",admin.id);

/* ---------- LOG ---------- */

if(typeof logAdminAction==="function"){

await logAdminAction({

action:"login",

target:"admin_auth",

details:{

role:admin.role_code,

username:admin.username

}

});

}

return{

success:true,

admin

};

}catch(error){

return{

error:error.message

};

}

}

/* ==========================================
   LOGOUT
========================================== */

async function adminLogout(){

try{

const admin =

typeof getCurrentAdmin==="function"

? await getCurrentAdmin()

: null;

if(admin && typeof logAdminAction==="function"){

await logAdminAction({

action:"logout",

target:"admin_auth",

details:{

username:admin.username

}

});

}

const supabase = getClient();

await supabase.auth.signOut();

location.replace(

"admin-login.html"

);

}catch(error){

console.error(error);

}

}

/* ==========================================
   EXPORT
========================================== */

window.adminLogin = adminLogin;

window.adminLogout = adminLogout;

})(window);
