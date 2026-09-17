(function(window){
"use strict";
if(window.ALBUKHR_SUPABASE)return;
const env=window.ALBukhrEnvironment;
if(!env||!env.isKnown()||env.getNetwork()!=="testnet"){
 console.error("[ALBUKHR TESTNET] Unknown or invalid environment.");
 return;
}
if(!window.supabase||typeof window.supabase.createClient!=="function"){
 console.error("[ALBUKHR TESTNET] Supabase SDK missing.");
 return;
}
const client=window.supabase.createClient(
  env.getSupabaseUrl(),
  "sb_publishable_5YNtKXSpO1xvPXbpLTo2Nw_mrxDp1qT"
);
const core={
 client,
 network:"testnet",
 url:env.getSupabaseUrl(),
 rpc:(name,args)=>client.rpc(name,args),
 from:(table)=>client.from(table),
 storage:client.storage
};
window.ALBUKHR_SUPABASE=Object.freeze(core);
window.getAlbukhrSupabaseClient=()=>client;
})(window);
