/* ALBUKHR PI PROJECT TREASURY PAYMENT ADAPTER v1
 * U2A: Pioneer -> ALBUKHR app
 * No LocalStorage. No direct treasury writes.
 */
(function(window){
"use strict";
const ENDPOINT="/api/pi-project-treasury-payment";
let busy=false;
function s(v,f=""){return v==null?f:String(v)}
function n(v,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function network(){
  if(typeof window.getAlbukhrNetwork==="function"){
    const x=window.getAlbukhrNetwork(); if(x==="mainnet"||x==="testnet")return x;
  }
  const h=s(location.hostname).toLowerCase();
  if(h==="test.albukhr.com"||h.startsWith("test."))return "testnet";
  if(h==="app.albukhr.com"||h.startsWith("app."))return "mainnet";
  throw new Error("ALBUKHR network could not be determined.");
}
function sdk(){
  if(!window.Pi||typeof Pi.authenticate!=="function"||typeof Pi.createPayment!=="function")
    throw new Error("Pi SDK is not available. Open ALBUKHR inside Pi Browser.");
}
async function adminToken(){
  if(typeof window.getAlbukhrAdminSupabaseClient!=="function")throw new Error("Admin Auth Core is not loaded.");
  const c=window.getAlbukhrAdminSupabaseClient();
  const {data,error}=await c.auth.getSession();
  if(error||!data?.session?.access_token)throw new Error("Administrator session has expired. Please sign in again.");
  return data.session.access_token;
}
async function post(body){
  const token=await adminToken();
  const r=await fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify(body)});
  const d=await r.json().catch(()=>null);
  if(!r.ok||!d?.success)throw new Error(d?.error||`Payment backend HTTP ${r.status}`);
  return d;
}
async function piAuth(){
  sdk();
  const auth=await Pi.authenticate(["username"],async payment=>{
    const id=payment?.identifier||payment?.paymentId;
    if(id){try{await post({action:"resolve_incomplete",paymentId:id,network:network()})}catch(e){console.warn("Incomplete payment check failed",e)}}
  });
  if(!auth?.accessToken||!auth?.user?.uid)throw new Error("Pi authentication failed.");
  return auth;
}
function createPayment({amount,memo,metadata,accessToken,net}){
  return new Promise((resolve,reject)=>{
    let done=false;
    const fail=e=>{if(done)return;done=true;busy=false;reject(e instanceof Error?e:new Error(s(e,"Pi payment failed.")))};
    const ok=v=>{if(done)return;done=true;busy=false;resolve(v)};
    try{
      Pi.createPayment({amount:n(amount),memo,metadata},{
        onReadyForServerApproval:async paymentId=>{
          try{await post({action:"approve",paymentId,accessToken,network:net,metadata})}
          catch(e){fail(e)}
        },
        onReadyForServerCompletion:async(paymentId,txid)=>{
          try{
            const r=await post({action:"complete",paymentId,txid,accessToken,network:net,metadata});
            ok({success:true,paymentId,txid,network:net,treasury:r.treasury,transaction:r.transaction,payment:r.payment});
          }catch(e){fail(e)}
        },
        onCancel:()=>fail(new Error("Pi payment was cancelled.")),
        onError:error=>fail(error?.message?new Error(error.message):new Error("Pi payment failed."))
      }).catch(fail);
    }catch(e){fail(e)}
  });
}
async function addProjectLiquidityWithPiPayment(ctx={}){
  if(busy)return {success:false,error:"Another Pi payment is already processing."};
  const amount=n(ctx.amount);
  const code=s(ctx.project_code).trim();
  if(amount<=0)return {success:false,error:"Invalid Pi liquidity amount."};
  if(!code)return {success:false,error:"Project code is required."};
  const net=network();
  if(ctx.network&&ctx.network!==net)return {success:false,error:`Network mismatch: current environment is ${net}.`};
  busy=true;
  try{
    const auth=await piAuth();
    const metadata={albukhr_version:"1.0.0",action:"add_liquidity",project_code:code,project_name:s(ctx.project_name||code),project_type:s(ctx.project_type||"core"),network:net,amount,source:s(ctx.source||"universal_project_dashboard")};
    return await createPayment({amount,memo:`ALBUKHR liquidity: ${code}`,metadata,accessToken:auth.accessToken,net});
  }catch(e){busy=false;return {success:false,error:e?.message||"Pi liquidity payment failed."}}
}
async function withdrawProjectLiquidityWithPiPayment(){return {success:false,error:"Pi treasury withdrawal adapter is not enabled yet."}}
function albukhrPiPaymentHealth(){let net=null,err=null;try{net=network()}catch(e){err=e.message}return {ready:!!(window.Pi&&typeof Pi.authenticate==="function"&&typeof Pi.createPayment==="function"),network:net,payment_busy:busy,endpoint:ENDPOINT,network_error:err}}
window.addProjectLiquidityWithPiPayment=addProjectLiquidityWithPiPayment;
window.withdrawProjectLiquidityWithPiPayment=withdrawProjectLiquidityWithPiPayment;
window.albukhrPiPaymentHealth=albukhrPiPaymentHealth;
})(window);
