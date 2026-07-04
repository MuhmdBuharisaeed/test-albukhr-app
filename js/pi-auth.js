let __pi_initialized = false;
let __pi_user = null;

/* ===============================
   INIT PI
=============================== */
async function initPi(){

  if(__pi_initialized) return;

  if(typeof Pi === "undefined"){
    console.error("❌ Pi SDK missing");
    return;
  }

  Pi.init({
    version: "2.0",
    sandbox: true
  });

  __pi_initialized = true;

  console.log("✅ Pi initialized");

}

/* ===============================
   AUTH
=============================== */
async function ensurePiAuth(){

try{

const scopes = [
  "username",
  "payments",
  "wallet_address"
];

const auth = await Pi.authenticate(
  scopes,
  function(payment){
    console.log("Payment callback:", payment);
  }
);

console.log("FULL AUTH:", auth);

// ✅ NORMALIZE USER
const user = {
  uid:
    auth?.uid ||
    auth?.user?.uid,

  username:
    auth?.username ||
    auth?.user?.username,

  wallet_address:
    auth?.wallet_address ||
    auth?.user?.wallet_address
};

if(!user.uid){
  throw new Error("UID missing");
}

__pi_user = user;

localStorage.setItem(
  "pi_user",
  JSON.stringify(user)
);

return user;

}catch(e){

console.error("❌ Auth failed:", e);

return null;

}

}
