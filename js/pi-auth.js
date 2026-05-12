let __pi_initialized = false;

async function initPi(){

  if(__pi_initialized) return;

  if(typeof Pi === "undefined"){
    console.error("❌ Pi SDK not loaded");
    return;
  }

  Pi.init({
    version: "2.0",
    sandbox: true   // ✅ TESTNET
  });

  __pi_initialized = true;

  console.log("✅ Pi initialized");
}

async function ensurePiAuth(){

  try{

    const user = await Pi.authenticate(
      ["username", "payments", "wallet_address"],
      function(payment){
        console.log("Payment callback:", payment);
      }
    );

    localStorage.setItem("pi_user", JSON.stringify(user));

    return user;

  }catch(e){
    console.error("❌ Auth failed:", e);
    return null;
  }

}
