/* ==========================================
   ALBUKHR SUPABASE ADMIN AUTH ENGINE
   Version 3.1
========================================== */

(function(window){

"use strict";

const TABLE = "admin_users";

/* ==========================================
   GET CLIENT
========================================== */

function getClient(){

    if(typeof window.getAlbukhrSupabaseClient === "function"){

        const client =
        window.getAlbukhrSupabaseClient();

        if(client){
            return client;
        }

    }

    throw new Error(
        "ALBUKHR Supabase Core not initialized."
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

error:"Admin account not found or inactive."

};

}

/* ---------- UPDATE LAST LOGIN ---------- */

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

username:admin.username,

role:admin.role_code

}

});

}

return{

success:true,

admin

};

}catch(error){

console.error(error);

return{

error:error.message ||

"Login failed."

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

username:admin.username,

role:admin.role_code

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
