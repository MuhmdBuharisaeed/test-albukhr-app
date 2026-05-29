/* ==========================================
   ALBUKHR – SECURE ADMIN AUTH ENGINE v2
========================================== */

const ADMIN_SESSION_KEY = "albukhr_admin_session";
const ADMIN_LOG_KEY = "albukhr_admin_logs";
const SESSION_DURATION = 2 * 60 * 60 * 1000;

/* ==========================================
   ADMIN DATABASE
========================================== */

const ADMIN_USERS = {

super_admin:{
username:"admin",
secret:"ALBUKHR_SUPER_2026"
},

finance_admin:{
username:"finance",
secret:"ALBUKHR_FINANCE_2026"
},

review_admin:{
username:"review",
secret:"ALBUKHR_REVIEW_2026"
},

compliance_admin:{
username:"compliance",
secret:"ALBUKHR_COMPLIANCE_2026"
}

};

/* ==========================================
   LOGIN
========================================== */

function adminLogin(username, role, secret){

const admin = ADMIN_USERS[role];

if(!admin) return false;

if(
admin.username !== username ||
admin.secret !== secret
){
return false;
}

/* CREATE SESSION */

const session = {
username,
role,
loginTime: Date.now(),
expiresAt: Date.now() + SESSION_DURATION
};

localStorage.setItem(
ADMIN_SESSION_KEY,
JSON.stringify(session)
);

/* LOG LOGIN */

logAdminAction("login", username, role);

return true;

}

/* ==========================================
   GET SESSION
========================================== */

function getAdminSession(){

const raw =
localStorage.getItem(ADMIN_SESSION_KEY);

if(!raw) return null;

try{

const session = JSON.parse(raw);

/* Expiry */

if(Date.now() > session.expiresAt){

localStorage.removeItem(ADMIN_SESSION_KEY);
return null;

}

/* Auto Refresh */

session.expiresAt =
Date.now() + SESSION_DURATION;

localStorage.setItem(
ADMIN_SESSION_KEY,
JSON.stringify(session)
);

return session;

}catch{

localStorage.removeItem(ADMIN_SESSION_KEY);
return null;

}

}

/* ==========================================
   REQUIRE ROLE
========================================== */

function requireRole(allowedRoles){

const session = getAdminSession();

if(!session){

alert("Admin login required");
window.location.href = "admin-login.html";
return;

}

if(!allowedRoles.includes(session.role)){

alert("Access denied");
window.location.href =
"unified-admin-buttons.html";

return;

}

}

/* ==========================================
   LOGOUT
========================================== */

function adminLogout(){

const session = getAdminSession();

if(session){

logAdminAction(
"logout",
session.username,
session.role
);

}

localStorage.removeItem(ADMIN_SESSION_KEY);

window.location.href =
"admin-login.html";

}

/* ==========================================
   LOGGING
========================================== */

function logAdminAction(action,user,role){

const logs =
JSON.parse(
localStorage.getItem(ADMIN_LOG_KEY)
) || [];

logs.unshift({

action,
user,
role,
time: Date.now()

});

localStorage.setItem(
ADMIN_LOG_KEY,
JSON.stringify(logs.slice(0,100))
);

}

/* ==========================================
   HELPERS
========================================== */

function getAdminRole(){

const session =
getAdminSession();

return session
? session.role
: null;

}

function getAdmin(){

return getAdminSession();

}
