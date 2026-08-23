/* ALBUKHR ADMIN AUTH — CONSOLIDATED v3.0 */
(function(w){"use strict";

const norm=x=>String(x??"").trim().toLowerCase();
async function admin(){try{return(await w.getCurrentAdmin?.())||null}catch(e){console.error(e);return null}}
async function getRolePermissions(role){role=norm(role);if(!role)return[];if(role==="super_admin")return["*"];try{const{data,error}=await w.requireAlbukhrAdminSupabaseClient().from("admin_permissions").select("permission").eq("role_code",role);if(error)throw error;return[...new Set((data||[]).map(x=>norm(x.permission)).filter(Boolean))]}catch(e){console.error(e);return[]}}
async function hasRole(r){const a=await admin();return!!a&&norm(a.role_code)===norm(r)}
async function hasAnyRole(rs=[]){const a=await admin();return!!a&&Array.isArray(rs)&&rs.some(r=>norm(r)===norm(a.role_code))}
async function hasPermission(p){p=norm(p);const a=await admin();if(!a||!p)return false;if(norm(a.role_code)==="super_admin")return true;const ps=await getRolePermissions(a.role_code);return ps.includes("*")||ps.includes(p)}
async function hasAnyPermission(ps=[]){const a=await admin();if(!a||!Array.isArray(ps)||!ps.length)return false;if(norm(a.role_code)==="super_admin")return true;const cur=await getRolePermissions(a.role_code);return cur.includes("*")||ps.map(norm).some(p=>cur.includes(p))}
async function hasAllPermissions(ps=[]){const a=await admin();if(!a||!Array.isArray(ps)||!ps.length)return false;if(norm(a.role_code)==="super_admin")return true;const cur=await getRolePermissions(a.role_code);return cur.includes("*")||ps.map(norm).every(p=>cur.includes(p))}
async function canManageFinance(){return hasPermission("finance.manage")}async function canManageProjects(){return hasPermission("projects.manage")}async function canManageUsers(){return hasPermission("users.manage")}async function canApprove(){return hasPermission("approvals.manage")}async function canManageSettings(){return hasPermission("settings.manage")}async function canManageRisk(){return hasPermission("risk.manage")}
async function getAdminPermissionRole(){return norm((await admin())?.role_code)||null}
async function getCurrentAdminPermissions(){const a=await admin();if(!a)return[];return norm(a.role_code)==="super_admin"?["*"]:getRolePermissions(a.role_code)}
Object.assign(w,{getRolePermissions,hasRole,hasAnyRole,hasPermission,hasAnyPermission,hasAllPermissions,canManageFinance,canManageProjects,canManageUsers,canApprove,canManageSettings,canManageRisk,getAdminPermissionRole,getCurrentAdminPermissions});

})(window);
