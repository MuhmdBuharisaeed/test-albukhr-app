/* ALBUKHR ADMIN AUTH — CONSOLIDATED v3.0 */
(function(w){"use strict";

function c(){return w.requireAlbukhrAdminSupabaseClient()}
async function user(){const{data,error}=await c().auth.getUser();if(error)throw error;return data?.user||null}
async function logAdminAction({action,target=null,details={},ipAddress=null}={}){try{const u=await user();if(!u?.id)return{success:false,error:"No authenticated admin."};const{data,error}=await c().from("admin_activity_logs").insert({admin_id:u.id,action:String(action||"").trim(),target,details:details&&typeof details==="object"?details:{},ip_address:ipAddress}).select("*").maybeSingle();if(error)throw error;return{success:true,data:data||null}}catch(e){console.error("[ADMIN LOG]",e);return{success:false,error:e?.message||"Failed to write log."}}}
async function getAdminLogs(limit=100){try{const{data,error}=await c().from("admin_activity_logs").select("*").order("created_at",{ascending:false}).limit(Math.min(Math.max(Number(limit)||100,1),500));if(error)throw error;return data||[]}catch(e){console.error(e);return[]}}
async function getMyAdminLogs(limit=50){try{const u=await user();if(!u?.id)return[];const{data,error}=await c().from("admin_activity_logs").select("*").eq("admin_id",u.id).order("created_at",{ascending:false}).limit(Math.min(Math.max(Number(limit)||50,1),500));if(error)throw error;return data||[]}catch(e){console.error(e);return[]}}
async function getAdminLogsByAdmin(id,limit=100){try{if(!String(id||"").trim())return[];const{data,error}=await c().from("admin_activity_logs").select("*").eq("admin_id",String(id).trim()).order("created_at",{ascending:false}).limit(Math.min(Math.max(Number(limit)||100,1),500));if(error)throw error;return data||[]}catch(e){console.error(e);return[]}}
async function clearOldLogs(days=90){try{const d=new Date();d.setDate(d.getDate()-Number(days));const{error}=await c().from("admin_activity_logs").delete().lt("created_at",d.toISOString());if(error)throw error;return{success:true}}catch(e){return{success:false,error:e?.message||"Failed to clear logs."}}}
w.logAdminAction=logAdminAction;w.getAdminLogs=getAdminLogs;w.getMyAdminLogs=getMyAdminLogs;w.getAdminLogsByAdmin=getAdminLogsByAdmin;w.clearOldLogs=clearOldLogs;

})(window);
