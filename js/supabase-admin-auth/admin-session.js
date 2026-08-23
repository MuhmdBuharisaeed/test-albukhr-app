/* ALBUKHR ADMIN AUTH — CONSOLIDATED v3.0 */
(function(w){"use strict";

function c(){if(typeof w.getAlbukhrAdminSupabaseClient!=="function")throw Error("Admin Auth Core not loaded.");const x=w.getAlbukhrAdminSupabaseClient();if(!x)throw Error("Admin client unavailable.");return x}
async function getCurrentSession(){const{data,error}=await c().auth.getSession();if(error)throw error;return data?.session||null}
async function getCurrentAdmin(){const s=await getCurrentSession();if(!s?.user?.id)return null;const{data,error}=await c().from("admin_users").select("*").eq("auth_user_id",s.user.id).eq("status","active").maybeSingle();if(error)throw error;return data||null}
async function getCurrentRole(){return(await getCurrentAdmin())?.role_code||null}
async function isAdminLoggedIn(){return !!(await getCurrentSession())?.user?.id}
async function refreshAdminSession(){const{data,error}=await c().auth.refreshSession();if(error)throw error;return!!data?.session?.user?.id}
async function requireAdminSession(){const a=await getCurrentAdmin();if(!a){w.location.replace("admin-login.html");return null}return a}
w.getCurrentSession=getCurrentSession;w.getCurrentAdmin=getCurrentAdmin;w.getCurrentRole=getCurrentRole;w.isAdminLoggedIn=isAdminLoggedIn;w.refreshAdminSession=refreshAdminSession;w.requireAdminSession=requireAdminSession;

})(window);
