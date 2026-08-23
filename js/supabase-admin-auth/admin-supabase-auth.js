/* ALBUKHR ADMIN AUTH — CONSOLIDATED v3.0 */
(function(w){"use strict";

const URL="https://qexmnghilahsvethlxem.supabase.co";
const KEY="sb_publishable_mSbWlhVKdmSjasKJC50QYw_5wzgRMe2";
const STORAGE="albukhr_admin_auth_session";
let client=null,initError=null;
function env(){
 const h=String(w.location.hostname||"").toLowerCase();
 if(h==="test.albukhr.com"||h.startsWith("test."))return"testnet";
 if(h==="app.albukhr.com"||h.startsWith("app."))return"mainnet";
 throw new Error("ALBUKHR Admin environment could not be determined.");
}
function net(){return env()}
function getClient(){
 if(client)return client;
 if(!w.supabase?.createClient){initError="Supabase SDK not loaded.";return null}
 try{
  env();
  client=w.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:STORAGE}});
  initError=null; return client;
 }catch(e){initError=e?.message||"Admin client initialization failed.";return null}
}
function requireClient(){const c=getClient();if(!c)throw new Error(initError||"Admin client unavailable.");return c}
function health(){let e=null,n=null;try{e=env();n=e}catch(x){n=x?.message||"environment unavailable"}const c=getClient();return{ready:!!c,has_sdk:!!w.supabase?.createClient,has_client:!!c,environment:e,network:e,environment_ready:!!e,url:URL,key_present:!!KEY,storage_key:STORAGE,persistent_session:true,init_error:initError||null,environment_error:typeof n==="string"&&n!==e?n:null}}
w.ALBUKHR_ADMIN_SUPABASE_URL=URL;w.ALBUKHR_ADMIN_SUPABASE_KEY=KEY;
w.getAlbukhrAdminEnvironment=env;w.getAlbukhrAdminNetwork=net;
w.assertAlbukhrAdminEnvironment=()=>{const e=env();return e==="mainnet"||e==="testnet"};
w.getAlbukhrAdminSupabaseClient=getClient;w.requireAlbukhrAdminSupabaseClient=requireClient;
w.isAlbukhrAdminSupabaseReady=()=>!!getClient();w.albukhrAdminSupabaseHealth=health;
w.verifyAlbukhrAdminAuthCore=()=>{const h=health();return !!h.ready&&!!h.environment_ready};

})(window);
