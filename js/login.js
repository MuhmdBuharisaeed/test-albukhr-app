// ✅ STATUS UPDATE
function setStatus(msg){
  document.getElementById("status").innerText = msg;
  console.log(msg);
}

// 🔐 LOGIN FUNCTION
async function login(){

  try{

    if(typeof window.Pi === "undefined"){
      setStatus("❌ Open inside Pi Browser");
      return;
    }

    setStatus("🔄 Initializing Pi...");

    await Pi.init({
  version:"2.0",
  sandbox:false
});

    setStatus("🔐 Authenticating...");

    const scopes = [
  "username",
  "payments",
  "wallet_address"
];

function onIncompletePaymentFound(payment){
  console.log(payment);
}

const { user: piUser, accessToken } =
await Pi.authenticate(
  scopes,
  onIncompletePaymentFound
);

console.log("AUTH:", piUser);

const user = {
  uid: piUser?.uid,
  username: piUser?.username,
  wallet_address: piUser?.wallet_address,
  accessToken
};

    if(!user.uid){
      throw new Error("Invalid user");
    }

    // ✅ SAVE USER
    localStorage.setItem("pi_user", JSON.stringify(user));

    setStatus("✅ Login success: " + user.username);

    // 🚀 REDIRECT AFTER 1s
    setTimeout(()=>{
      window.location.href = "index.html";
    },1000);

  }catch(err){

    console.error("LOGIN ERROR:", err);

    setStatus("❌ Login failed");

  }

}

// 🔁 AUTO LOGIN CHECK
document.addEventListener("DOMContentLoaded", ()=>{

  const saved = JSON.parse(localStorage.getItem("pi_user"));

  if(saved && saved.uid){
    window.location.href = "index.html";
  }

});
