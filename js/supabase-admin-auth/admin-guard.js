/* ALBUKHR ADMIN AUTH — CONSOLIDATED v3.0 */
(function(w){"use strict";

function deny(m){alert(m);w.location.replace("unified-admin-buttons.html")}
async function requireAdmin(){try{const a=await w.getCurrentAdmin();if(!a){w.location.replace("admin-login.html");return null}return a}catch(e){console.error(e);w.location.replace("admin-login.html");return null}}
async function requireGuardRole(r){const a=await requireAdmin();if(!a)return false;r=String(r||"").trim().toLowerCase();if(!r){deny("Invalid Admin role requirement.");return false}if(String(a.role_code||"").toLowerCase()!==r){deny("You are not authorized to access this Admin area.");return false}return true}
async function requireAnyRole(rs=[]){const a=await requireAdmin();if(!a)return false;if(!Array.isArray(rs))rs=[rs];const r=String(a.role_code||"").toLowerCase();if(!rs.map(x=>String(x||"").toLowerCase()).includes(r)){deny("You are not authorized to access this Admin area.");return false}return true}
async function requirePermission(p){const a=await requireAdmin();if(!a)return false;if(!p||!w.hasPermission||!(await w.hasPermission(p))){deny("You don't have permission to access this page.");return false}return true}
async function requirePermissions(ps=[]){const a=await requireAdmin();if(!a)return false;if(!Array.isArray(ps))ps=[ps];for(const p of ps)if(!w.hasPermission||!(await w.hasPermission(p))){deny("Required permission missing.");return false}return true}
async function requireAnyPermission(ps=[]){const a=await requireAdmin();if(!a)return false;if(w.hasAnyPermission&&await w.hasAnyPermission(ps))return true;deny("You don't have any of the required permissions.");return false}
async function requireSuperAdmin(){return requireGuardRole("super_admin")}
Object.assign(w,{requireAdmin,requireGuardRole,requireRole:requireGuardRole,requireAnyRole,requirePermission,requirePermissions,requireAnyPermission,requireSuperAdmin});

})(window);
