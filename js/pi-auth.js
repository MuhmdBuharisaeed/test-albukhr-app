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

  /* 🔥 RETURN CACHED USER */
  if(__pi_user?.uid){
    return __pi_user;
  }

  /* 🔥 RETURN LOCAL USER */
  try{

    const saved =
      JSON.parse(localStorage.getItem("pi_user"));

    if(saved?.uid){

      __pi_user = saved;

      return saved;
    }

  }catch(e){
    console.warn("Local user parse failed");
  }

  /* 🔥 SDK CHECK */
  if(typeof Pi === "undefined"){
    console.error("❌ Pi SDK not loaded");
    return null;
  }

  try{

    const user = await Pi.authenticate(
      ["username","payments","wallet_address"],
      function(payment){
        console.log("Payment callback:", payment);
      }
    );

    if(user?.uid){

      __pi_user = user;

      localStorage.setItem(
        "pi_user",
        JSON.stringify(user)
      );

      console.log("✅ AUTH SUCCESS");

      return user;

    }

    return null;

  }catch(e){

    console.error("❌ AUTH FAILED:", e);

    return null;

  }

}
