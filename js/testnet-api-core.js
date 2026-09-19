(function(window){
"use strict";

const DEFAULT_BASE=
  "https://vhvkwvngmrlgyzwemttt.supabase.co/functions/v1/testnet-investor-data";

const base=String(
  window.ALBukhrTestnetInvestorApiBase||DEFAULT_BASE
).replace(/\/+$/,"");

function clean(v){return String(v==null?"":v).trim();}

async function request(path="",options={}){
  const auth=window.AlbukhrTestnetAuth;

  if(!auth || typeof auth.getSessionToken!=="function"){
    throw new Error("Testnet authentication module is unavailable.");
  }

  const token=clean(auth.getSessionToken());

  if(!token){
    const error=new Error("TESTNET_SESSION_REQUIRED");
    error.code="TESTNET_SESSION_REQUIRED";
    throw error;
  }

  const target=path
    ? base+"/"+String(path).replace(/^\/+/,"")
    : base;

  const response=await fetch(target,{
    method:options.method||"GET",
    headers:Object.assign({
      "Accept":"application/json",
      "Authorization":"Bearer "+token
    },options.headers||{}),
    credentials:"include",
    body:options.body
  });

  let body=null;
  try{body=await response.json();}catch(_){}

  if(!response.ok){
    const error=new Error(
      body?.error||
      body?.message||
      ("TESTNET_API_HTTP_"+response.status)
    );
    error.status=response.status;
    error.body=body;
    throw error;
  }

  return body;
}

async function getInvestorData(){
  return request("",{method:"GET"});
}

window.AlbukhrTestnetApi=Object.freeze({
  baseUrl:base,
  request,
  getInvestorData
});

})(window);
