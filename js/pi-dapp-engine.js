/* =====================================
   ALBUKHR – PI dApp ENGINE (SUPABASE)
===================================== */

const SUPABASE_URL = "https://qexmnghilahsvethlxem.supabase.co";
const SUPABASE_KEY = "sb_publishable_mSbWlhVKdmSjasKJC50QYw_5wzgRMe2";

/* -------------------------------------
   GET CURRENT USER (Pi SDK)
------------------------------------- */
async function getCurrentUser(){

  if(window.Pi && Pi.getUser){
    try{
      const u = await Pi.getUser();

      if(u?.uid){
        return {
          uid: u.uid,
          username: u.username || ""
        };
      }
    }catch(e){
      console.warn("Pi auth not ready", e);
    }
  }

  // fallback
  const local = localStorage.getItem("pi_user");
  if(local){
    try{
      return JSON.parse(local);
    }catch(e){}
  }

  return null;
}

/* -------------------------------------
   CHECK PENDING REQUEST
------------------------------------- */
async function userHasPending(uid){

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/dapp_requests?userid=eq.${uid}&status=eq.pending`,
    {
      headers:{
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    }
  );

  const data = await res.json();
  return Array.isArray(data) && data.length > 0;
}

/* -------------------------------------
   SUBMIT REQUEST
------------------------------------- */
async function submitDappRequest(){

  const user = await getCurrentUser();

  if(!user?.uid){
    showAlert(
  "Login Required",
  "Please login with Pi Browser."
);
    return;
  }

  const piUser = document.getElementById("piUser").value.trim();
  const projectName = document.getElementById("projectName").value.trim();
  const serviceType = document.getElementById("serviceType").value;
  const description = document.getElementById("description").value.trim();
  const receiptRef = document.getElementById("receiptRef").value.trim();
  const fileInput = document.getElementById("receiptImg");
  const agree = document.getElementById("agree").checked;

  if(!piUser || !projectName || !serviceType || !description || !receiptRef){
    showAlert(
  "Missing Information",
  "Please fill all required fields."
);
    return;
  }

  if(!agree){
    showAlert(
  "Agreement Required",
  "You must agree to the terms before submitting."
);
    return;
  }

  if(await userHasPending(user.uid)){
    showAlert(
  "Pending Request",
  "You already have a pending request under review."
);
    return;
  }

  if(!fileInput.files.length){
    showAlert(
  "Receipt Required",
  "Please upload your payment receipt image."
);
    return;
  }

  const file = fileInput.files[0];

  if(file.size > 2 * 1024 * 1024){
    showAlert(
  "Image Too Large",
  "Maximum allowed image size is 2 MB."
);
    return;
  }

  const reader = new FileReader();

  reader.onload = async function(){

    const payload = {
      userid: user.uid,
      pi_user: piUser,
      project_name: projectName,
      service_type: serviceType,
      description: description,
      receipt_ref: receiptRef,
      receipt_image: reader.result,
      status: "pending",
      admin_note: "",
      telegram_unlocked: false,
      created_at: new Date().toISOString()
    };

    try{

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/dapp_requests`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            Prefer: "return=representation"
          },
          body: JSON.stringify(payload)
        }
      );

      if(!res.ok){

  const err = await res.text();

  console.error(err);

  showAlert(
  "Submission Failed",
  "Unable to save request. Please try again."
);

console.error(err);

  return;
      }

      showAlert(
  "Request Submitted",
  "Your dApp launch request has been submitted successfully."
);

setTimeout(()=>{
  window.location.href =
  "my-dapp-requests.html";
},1500);

    }catch(e){

  console.error(e);

  showAlert(
    "Network Error",
    "Unable to connect to the server. Please try again."
  );
    }
  };

  reader.readAsDataURL(file);
}

/* -------------------------------------
   DISABLE UI IF PENDING
------------------------------------- */
window.addEventListener("DOMContentLoaded", async ()=>{

  const user = await getCurrentUser();
  if(!user?.uid) return;

  const pending = await userHasPending(user.uid);

  if(pending){

  const btn =
  document.getElementById("submitBtn");

  if(btn){

    btn.disabled = true;

    btn.innerText =
    "Pending Review";

    btn.style.opacity = "0.6";

  }

  const viewBox =
  document.getElementById(
    "viewRequestBox"
  );

  if(viewBox){

    viewBox.style.display =
    "block";

  }

  }

    showAlert(
  "Pending Request",
  "You already have a pending request under review."
);
  }
});
