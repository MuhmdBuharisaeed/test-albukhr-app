(function(window){
"use strict";
const CONFIG=Object.freeze({
  key:"testnet",
  name:"TESTNET",
  host:"test.albukhr.com",
  appUrl:"https://test.albukhr.com",
  supabaseUrl:"https://vhvkwvngmrlgyzwemttt.supabase.co",
  network:"testnet"
});
const host=String(window.location.hostname||"").toLowerCase().replace(/\.$/,"");
const known=host==="test.albukhr.com";
window.ALBukhrEnvironment=Object.freeze({
  current:known?CONFIG:null,
  environments:Object.freeze({testnet:CONFIG}),
  getKey:()=>known?"testnet":null,
  getName:()=>known?"TESTNET":null,
  getNetwork:()=>known?"testnet":null,
  getAppUrl:()=>known?CONFIG.appUrl:null,
  getSupabaseUrl:()=>known?CONFIG.supabaseUrl:null,
  getHostname:()=>host,
  isKnown:()=>known,
  isTestnet:()=>known,
  isMainnet:()=>false,
  getConfig:()=>known?CONFIG:null
});
})(window);
