/* =========================================
   ALBUKHR USER SECURITY SETTINGS ENGINE
   Version 2.0

   SOURCE OF TRUTH: Supabase
   CLIENT AUTHORITY: shared ALBUKHR Supabase client
   NO LocalStorage / SessionStorage security state
   NO new Supabase client is created here

   This engine manages SECURITY SETTINGS STATE.
   It does not pretend that a checkbox itself implements
   PIN, biometric, encryption, or transaction security.
   Those controls must be enforced by their own engines
   and, where applicable, server-side/RLS/RPC logic.
========================================= */
(function(window){
"use strict";

const TABLE = "user_security_settings";

const FEATURES = [
  {key:"app_lock", column:"app_lock_enabled", icon:"🔒",
   title:"App Lock", desc:"Secure your account with an additional app lock."},
  {key:"private_account", column:"private_account", icon:"🕵️",
   title:"Private Account", desc:"Hide your profile from public leaderboard."},
  {key:"biometric", column:"biometric_enabled", icon:"👆",
   title:"Biometric Unlock", desc:"Use fingerprint or face unlock through a supported passkey."},
  {key:"encrypt_data", column:"data_encryption_enabled", icon:"🛡️",
   title:"Data Encryption", desc:"Enable protection for supported sensitive account data."},
  {key:"tx_protection", column:"transaction_protection_enabled", icon:"💳",
   title:"Transaction Protection", desc:"Require additional verification before protected withdrawals."}
];

let state = null;
let initPromise = null;

function str(v,f=""){ return v==null ? f : String(v); }

function network(){
  try{
    if(typeof window.getAlbukhrNetwork==="function"){
      const n=window.getAlbukhrNetwork();
      if(n==="mainnet"||n==="testnet") return n;
    }
  }catch(e){ console.warn("[USER SECURITY] Network lookup failed:",e); }

  try{
    if(typeof window.getCurrentNetwork==="function"){
      const n=window.getCurrentNetwork();
      if(n==="mainnet"||n==="testnet") return n;
    }
  }catch(e){ console.warn("[USER SECURITY] Current network lookup failed:",e); }

  const h=str(window.location?.hostname).toLowerCase();
  return (h==="test.albukhr.com" || h.startsWith("test."))
    ? "testnet" : "mainnet";
}

window.getUserSecurityNetwork = network;

function client(){
  const candidates=[
    window.supabaseClient,
    window.ALBUKHR_SUPABASE,
    window.albukhrSupabase,
    window.sb
  ];

  for(const c of candidates){
    if(c && typeof c.from==="function" &&
       c.auth && typeof c.auth.getUser==="function") return c;
  }

  if(typeof window.getSupabaseClient==="function"){
    try{
      const c=window.getSupabaseClient();
      if(c && typeof c.from==="function" &&
         c.auth && typeof c.auth.getUser==="function") return c;
    }catch(e){ console.warn("[USER SECURITY] Client lookup failed:",e); }
  }

  return null;
}

window.getUserSecuritySupabase = client;

async function user(){
  const sb=client();
  if(!sb) return null;
  try{
    const r=await sb.auth.getUser();
    return r?.data?.user || null;
  }catch(e){
    console.error("[USER SECURITY] User lookup failed:",e);
    return null;
  }
}

window.getAuthenticatedSecurityUser = user;

function defaults(){
  return {
    app_lock_enabled:false,
    private_account:false,
    biometric_enabled:false,
    data_encryption_enabled:false,
    transaction_protection_enabled:false
  };
}

function normalize(row){
  return {
    ...defaults(),
    ...(row||{}),
    user_id:row?.user_id || null,
    network:(row?.network==="mainnet"||row?.network==="testnet")
      ? row.network : network()
  };
}

async function load(){
  const sb=client();
  if(!sb) return {ok:false,code:"SUPABASE_UNAVAILABLE"};

  const u=await user();
  if(!u?.id) return {ok:false,code:"AUTHENTICATION_REQUIRED"};

  const n=network();
  const columns=[
    "user_id","network","app_lock_enabled","private_account",
    "biometric_enabled","data_encryption_enabled",
    "transaction_protection_enabled","updated_at"
  ].join(",");

  try{
    let r=await sb.from(TABLE).select(columns)
      .eq("user_id",u.id).eq("network",n).maybeSingle();

    if(r.error) return {ok:false,code:"SETTINGS_QUERY_FAILED",error:r.error};

    if(!r.data){
      r=await sb.from(TABLE).insert({
        user_id:u.id, network:n, ...defaults()
      }).select(columns).single();

      if(r.error) return {ok:false,code:"SETTINGS_CREATE_FAILED",error:r.error};
    }

    state=normalize(r.data);
    window.ALBUKHR_USER_SECURITY=state;
    return {ok:true,code:"OK",state};
  }catch(error){
    console.error("[USER SECURITY] Load failed:",error);
    return {ok:false,code:"SETTINGS_LOAD_FAILED",error};
  }
}

window.loadUserSecuritySettings=load;

function feature(key){
  return FEATURES.find(x=>x.key===key) || null;
}

function enabled(key){
  const f=feature(key);
  return !!(f && state && state[f.column]===true);
}

window.isUserSecurityFeatureEnabled=enabled;

async function prerequisite(f,on){
  if(!on) return {ok:true};

  if(f.key==="biometric"){
    if(!(window.PublicKeyCredential &&
         navigator.credentials &&
         typeof navigator.credentials.create==="function")){
      return {ok:false,code:"BIOMETRIC_UNSUPPORTED"};
    }
  }

  if(typeof window.beforeSecurityFeatureToggle==="function"){
    try{
      const r=await window.beforeSecurityFeatureToggle(f.key,on);
      if(r===false) return {ok:false,code:"FEATURE_PREREQUISITE_DENIED"};
      if(r && r.ok===false) return r;
    }catch(error){
      return {ok:false,code:"FEATURE_PREREQUISITE_FAILED",error};
    }
  }

  return {ok:true};
}

async function setFeature(key,on){
  const f=feature(key);
  if(!f) return {ok:false,code:"UNKNOWN_FEATURE"};

  if(!state){
    const loaded=await load();
    if(!loaded.ok) return loaded;
  }

  const u=await user();
  if(!u?.id) return {ok:false,code:"AUTHENTICATION_REQUIRED"};

  const p=await prerequisite(f,on===true);
  if(!p.ok) return p;

  const sb=client();
  if(!sb) return {ok:false,code:"SUPABASE_UNAVAILABLE"};

  const n=network();
  const columns=[
    "user_id","network","app_lock_enabled","private_account",
    "biometric_enabled","data_encryption_enabled",
    "transaction_protection_enabled","updated_at"
  ].join(",");

  try{
    const r=await sb.from(TABLE).upsert({
      user_id:u.id, network:n, [f.column]:on===true,
      updated_at:new Date().toISOString()
    },{onConflict:"user_id,network"}).select(columns).single();

    if(r.error) return {ok:false,code:"FEATURE_UPDATE_FAILED",error:r.error};

    state=normalize(r.data);
    window.ALBUKHR_USER_SECURITY=state;

    if(typeof window.afterSecurityFeatureToggle==="function"){
      try{
        await window.afterSecurityFeatureToggle(f.key,on===true,state);
      }catch(e){
        console.warn("[USER SECURITY] Post-toggle handler failed:",e);
      }
    }

    return {ok:true,code:"OK",feature:key,enabled:on===true,state};
  }catch(error){
    return {ok:false,code:"FEATURE_UPDATE_EXCEPTION",error};
  }
}

window.setUserSecurityFeature=setFeature;

function message(text,type="info"){
  const el=document.getElementById("securityMessage");
  if(!el) return;
  el.textContent=str(text);
  el.dataset.type=type;
  el.style.display=text ? "block" : "none";
}

function errorText(r){
  switch(r?.code){
    case "AUTHENTICATION_REQUIRED": return "Please sign in before changing security settings.";
    case "SUPABASE_UNAVAILABLE": return "Security service is temporarily unavailable.";
    case "BIOMETRIC_UNSUPPORTED": return "This device/browser does not support biometric passkeys.";
    case "FEATURE_PREREQUISITE_DENIED":
    case "FEATURE_PREREQUISITE_FAILED": return "The required security setup was not completed.";
    default: return "Security setting could not be changed.";
  }
}

function render(){
  const box=document.getElementById("securityList");
  if(!box) return false;
  box.innerHTML="";

  FEATURES.forEach(f=>{
    const card=document.createElement("div");
    card.className="security-card";

    const left=document.createElement("div");
    left.className="security-left";

    const icon=document.createElement("div");
    icon.className="security-icon";
    icon.textContent=f.icon;

    const info=document.createElement("div");
    info.className="security-info";

    const h=document.createElement("h3");
    h.textContent=f.title;

    const p=document.createElement("p");
    p.textContent=f.desc;

    info.append(h,p);
    left.append(icon,info);

    const label=document.createElement("label");
    label.className="switch";

    const input=document.createElement("input");
    input.type="checkbox";
    input.checked=enabled(f.key);
    input.dataset.feature=f.key;

    const slider=document.createElement("span");
    slider.className="slider";

    input.addEventListener("change",async()=>{
      input.disabled=true;
      const requested=input.checked;
      const r=await setFeature(f.key,requested);

      if(!r.ok){
        input.checked=enabled(f.key);
        message(errorText(r),"error");
      }else{
        input.checked=enabled(f.key);
        message(`${f.title} ${input.checked?"enabled":"disabled"}.`,"success");
      }

      input.disabled=false;
    });

    label.append(input,slider);
    card.append(left,label);
    box.appendChild(card);
  });

  return true;
}

window.renderUserSecuritySettings=render;

async function initialize(){
  if(initPromise) return initPromise;

  initPromise=(async()=>{
    const r=await load();
    if(!r.ok){
      message(errorText(r),"error");
      return false;
    }

    render();
    message("");
    console.log("ALBUKHR User Security Settings Ready");
    console.log("Network:",network());
    return true;
  })();

  try{return await initPromise;}
  finally{initPromise=null;}
}

window.initializeUserSecuritySettings=initialize;

async function refresh(){
  state=null;
  const r=await load();
  if(r.ok) render();
  return r;
}

window.refreshUserSecuritySettings=refresh;

function authListener(){
  const sb=client();
  if(!sb?.auth || typeof sb.auth.onAuthStateChange!=="function") return;

  try{
    sb.auth.onAuthStateChange(event=>{
      if(event==="SIGNED_IN") initialize();
      if(event==="SIGNED_OUT"){
        state=null;
        window.ALBUKHR_USER_SECURITY=null;
        const box=document.getElementById("securityList");
        if(box) box.innerHTML="";
      }
    });
  }catch(e){ console.warn("[USER SECURITY] Auth listener failed:",e); }
}

function start(){
  authListener();
  initialize().catch(e=>console.error("[USER SECURITY] Startup failed:",e));
}

if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",start,{once:true});
}else{
  setTimeout(start,0);
}

window.ALBUKHR_USER_SECURITY_FEATURES=FEATURES.map(f=>({
  key:f.key,column:f.column,title:f.title
}));

})(window);
