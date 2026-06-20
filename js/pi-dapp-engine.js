/* =====================================
   ALBUKHR – PI dApp ENGINE (SUPABASE)
===================================== */

const SUPABASE_URL = "https://qexmnghilahsvethlxem.supabase.co";
const SUPABASE_KEY = "sb_publishable_mSbWlhVKdmSjasKJC50QYw_5wzgRMe2";

let __pendingAlertShown = false;

/* -------------------------------------
   GET CURRENT USER
   order:
   1) localStorage
   2) Pi.getUser()
   3) ensurePiAuth() only if needed
------------------------------------- */
async function getCurrentUser(){

  /* 1) localStorage first */
  try{
    const local = localStorage.getItem("pi_user");

    if(local){
      const parsed = JSON.parse(local);

      if(parsed?.uid){
        return {
          uid: parsed.uid,
          username: parsed.username || ""
        };
      }
    }
  }catch(e){
    console.warn("localStorage pi_user parse failed:", e);
  }

  /* 2) Pi.getUser */
  if(window.Pi && Pi.getUser){
    try{
      const u = await Pi.getUser();

      if(u?.uid){

        const user = {
          uid: u.uid,
          username: u.username || ""
        };

        localStorage.setItem(
          "pi_user",
          JSON.stringify(user)
        );

        return user;
      }
    }catch(e){
      console.warn("Pi.getUser failed:", e);
    }
  }

  /* 3) last fallback: ensurePiAuth */
  try{
    if(typeof ensurePiAuth === "function"){
      const authUser = await ensurePiAuth();

      if(authUser?.uid){
        return {
          uid: authUser.uid,
          username: authUser.username || ""
        };
      }
    }
  }catch(e){
    console.warn("ensurePiAuth failed:", e);
  }

  return null;
}

/* -------------------------------------
   CHECK PENDING REQUEST
------------------------------------- */
async function userHasPending(uid){

  try{

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/dapp_requests?select=id,status&userid=eq.${uid}&status=eq.pending`,
      {
        headers:{
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if(!res.ok){
      const errText = await res.text();
      console.error("userHasPending fetch error:", errText);
      return false;
    }

    const data = await res.json();
    return Array.isArray(data) && data.length > 0;

  }catch(e){
    console.error("userHasPending network error:", e);
    return false;
  }
}

/* -------------------------------------
   UI: SET PENDING MODE
------------------------------------- */
function setPendingUI(isPending){

  const btn = document.getElementById("submitBtn");
  const viewBox = document.getElementById("viewRequestBox");

  if(btn){
    if(isPending){
      btn.disabled = true;
      btn.innerText = "Pending Review";
      btn.style.opacity = "0.6";
      btn.style.pointerEvents = "none";
    }else{
      btn.disabled = false;
      btn.innerText = "Submit for Review";
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
    }
  }

  if(viewBox){
    viewBox.style.display = isPending ? "block" : "none";
  }
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

  const pending = await userHasPending(user.uid);

  if(pending){
    setPendingUI(true);

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
        console.error("submitDappRequest supabase error:", err);

        showAlert(
          "Submission Failed",
          "Unable to save request. Please try again."
        );
        return;
      }

      setPendingUI(true);

      showAlert(
        "Request Submitted",
        "Your dApp launch request has been submitted successfully."
      );

      setTimeout(()=>{
        window.location.href = "my-dapp-requests.html";
      }, 1500);

    }catch(e){

      console.error("submitDappRequest network error:", e);

      showAlert(
        "Network Error",
        "Unable to connect to the server. Please try again."
      );
    }
  };

  reader.readAsDataURL(file);
}

/* -------------------------------------
   INIT PAGE STATE
------------------------------------- */
window.addEventListener("DOMContentLoaded", async ()=>{

  const user = await getCurrentUser();

  /* idan ba a login ba, a bar form a bude */
  if(!user?.uid){
    setPendingUI(false);
    return;
  }

  const pending = await userHasPending(user.uid);

  if(pending){

    setPendingUI(true);

    if(!__pendingAlertShown){
      __pendingAlertShown = true;

      showAlert(
        "Pending Request",
        "You already have a pending request under review."
      );
    }

  }else{
    /* idan babu pending, ko approved/rejected ne */
    setPendingUI(false);
  }

});
