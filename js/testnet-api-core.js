(function(window){
"use strict";
const base=String(window.ALBukhrTestnetApiBase||"/api").replace(/\/+$/,'');
function clean(v){return String(v==null?"":v).trim();}
async function request(path,options){
 const auth=window.AlbukhrTestnetAuth;if(!auth)throw new Error("Testnet authentication module is unavailable.");
 let token=clean(auth.getSessionToken?.());if(!token){await auth.restore?.();token=clean(auth.getSessionToken?.());}
 if(!token){const e=new Error("TESTNET_SESSION_REQUIRED");e.code="TESTNET_SESSION_REQUIRED";throw e;}
 const response=await fetch(base+path,{method:options?.method||"GET",credentials:"include",headers:Object.assign({"Accept":"application/json","Authorization":"Bearer "+token},options?.headers||{}),body:options?.body});
 let body=null;try{body=await response.json();}catch(_){}
 if(!response.ok){const e=new Error(clean(body?.message)||clean(body?.error)||("Testnet API request failed ("+response.status+")."));e.status=response.status;e.code=clean(body?.error);throw e;}
 return body;
}
async function getInvestorData(){return request("/investor-data",{method:"GET"});}
window.AlbukhrTestnetApi=Object.freeze({baseUrl:base,request,getInvestorData});
})(window);
