/* =====================================
   ALBUKHR – PI dApp ENGINE V4
   SUPABASE REST
   SUBMIT LOCK + DUPLICATE PROTECTION
   IMAGE OPTIMIZATION
===================================== */

"use strict";


/* =====================================
   CONFIG
===================================== */

const SUPABASE_URL =
  "https://qexmnghilahsvethlxem.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_mSbWlhVKdmSjasKJC50QYw_5wzgRMe2";

const DAPP_REQUESTS_TABLE =
  "dapp_requests";

const REQUEST_TIMEOUT =
  30000;

const MAX_FILE_SIZE =
  2 * 1024 * 1024;

const SUBMIT_LOCK_KEY =
  "albukhr_dapp_submit_lock";

const SUBMIT_LOCK_DURATION =
  5 * 60 * 1000;


/* =====================================
   STATE
===================================== */

let __dappSubmitting = false;

let __pendingAlertShown = false;


/* =====================================
   DOM
===================================== */

function getEl(id){

  return document.getElementById(id);

}


/* =====================================
   GET CURRENT USER
===================================== */

async function getCurrentUser(){

  /* -----------------------------------
     1. LOCAL STORAGE
  ----------------------------------- */

  try{

    const local =
      localStorage.getItem("pi_user");


    if(local){

      const parsed =
        JSON.parse(local);


      if(parsed?.uid){

        return {

          uid:
            parsed.uid,

          username:
            parsed.username || ""

        };

      }

    }

  }catch(error){

    console.warn(
      "ALBUKHR pi_user parse failed:",
      error
    );

  }


  /* -----------------------------------
     2. PI GET USER
  ----------------------------------- */

  if(
    window.Pi &&
    typeof Pi.getUser === "function"
  ){

    try{

      const piUser =
        await Pi.getUser();


      if(piUser?.uid){

        const user = {

          uid:
            piUser.uid,

          username:
            piUser.username || ""

        };


        localStorage.setItem(
          "pi_user",
          JSON.stringify(user)
        );


        return user;

      }

    }catch(error){

      console.warn(
        "ALBUKHR Pi.getUser failed:",
        error
      );

    }

  }


  /* -----------------------------------
     3. SHARED PI AUTH
  ----------------------------------- */

  try{

    if(
      typeof window.ensurePiAuth ===
      "function"
    ){

      const authUser =
        await window.ensurePiAuth();


      if(authUser?.uid){

        const user = {

          uid:
            authUser.uid,

          username:
            authUser.username || ""

        };


        localStorage.setItem(
          "pi_user",
          JSON.stringify(user)
        );


        return user;

      }

    }

  }catch(error){

    console.warn(
      "ALBUKHR ensurePiAuth failed:",
      error
    );

  }


  return null;

}


/* =====================================
   SUPABASE FETCH WITH TIMEOUT
===================================== */

async function supabaseFetch(
  url,
  options = {},
  timeout = REQUEST_TIMEOUT
){

  const controller =
    new AbortController();


  const timer =
    setTimeout(
      () => controller.abort(),
      timeout
    );


  try{

    return await fetch(
      url,
      {
        ...options,
        signal:
          controller.signal
      }
    );

  }finally{

    clearTimeout(timer);

  }

}


/* =====================================
   CHECK EXISTING PENDING REQUEST
===================================== */

async function userHasPending(uid){

  try{

    const url =
      `${SUPABASE_URL}/rest/v1/${DAPP_REQUESTS_TABLE}` +
      `?select=id,status,created_at` +
      `&userid=eq.${encodeURIComponent(uid)}` +
      `&status=eq.pending` +
      `&limit=1`;


    const response =
      await supabaseFetch(

        url,

        {

          method:
            "GET",

          headers:{

            apikey:
              SUPABASE_KEY,

            Authorization:
              `Bearer ${SUPABASE_KEY}`,

            Accept:
              "application/json"

          }

        }

      );


    if(!response.ok){

      const text =
        await response.text();


      console.error(
        "userHasPending error:",
        response.status,
        text
      );


      return false;

    }


    const data =
      await response.json();


    return (
      Array.isArray(data) &&
      data.length > 0
    );

  }catch(error){

    console.error(
      "userHasPending network error:",
      error
    );


    return false;

  }

}


/* =====================================
   LOCAL SUBMIT LOCK
===================================== */

function hasSubmitLock(){

  try{

    const raw =
      localStorage.getItem(
        SUBMIT_LOCK_KEY
      );


    if(!raw){

      return false;

    }


    const lock =
      JSON.parse(raw);


    if(
      !lock?.timestamp
    ){

      localStorage.removeItem(
        SUBMIT_LOCK_KEY
      );

      return false;

    }


    const age =
      Date.now() -
      Number(lock.timestamp);


    if(
      age >
      SUBMIT_LOCK_DURATION
    ){

      localStorage.removeItem(
        SUBMIT_LOCK_KEY
      );

      return false;

    }


    return true;

  }catch(error){

    console.warn(
      "Submit lock read failed:",
      error
    );


    return false;

  }

}


/* =====================================
   CREATE SUBMIT LOCK
===================================== */

function createSubmitLock(uid){

  try{

    localStorage.setItem(

      SUBMIT_LOCK_KEY,

      JSON.stringify({

        uid:
          uid,

        timestamp:
          Date.now()

      })

    );

  }catch(error){

    console.warn(
      "Submit lock create failed:",
      error
    );

  }

}


/* =====================================
   RELEASE SUBMIT LOCK
===================================== */

function releaseSubmitLock(){

  try{

    localStorage.removeItem(
      SUBMIT_LOCK_KEY
    );

  }catch(error){

    console.warn(
      "Submit lock release failed:",
      error
    );

  }

}


/* =====================================
   SUBMIT BUTTON UI
===================================== */

function setSubmitButton(
  mode = "ready"
){

  const btn =
    getEl("submitBtn");


  if(!btn){

    return;

  }


  if(mode === "submitting"){

    btn.disabled =
      true;

    btn.classList.add(
      "submitting"
    );

    btn.innerHTML = `

      <span class="submit-spinner"></span>

      Submitting...

    `;

    btn.style.pointerEvents =
      "none";

    btn.style.opacity =
      "0.7";


    return;

  }


  if(mode === "pending"){

    btn.disabled =
      true;

    btn.classList.remove(
      "submitting"
    );

    btn.innerHTML =
      "Pending Review";

    btn.style.pointerEvents =
      "none";

    btn.style.opacity =
      "0.6";


    return;

  }


  btn.disabled =
    false;

  btn.classList.remove(
    "submitting"
  );

  btn.innerHTML =
    "Submit for Review";

  btn.style.pointerEvents =
    "auto";

  btn.style.opacity =
    "1";

}


/* =====================================
   PENDING UI
===================================== */

function setPendingUI(
  isPending
){

  const viewBox =
    getEl("viewRequestBox");


  if(isPending){

    setSubmitButton(
      "pending"
    );

  }else{

    if(!__dappSubmitting){

      setSubmitButton(
        "ready"
      );

    }

  }


  if(viewBox){

  viewBox.style.display = "block";

  }

}


/* =====================================
   IMAGE OPTIMIZER
===================================== */

function optimizeReceiptImage(
  file
){

  return new Promise(
    (resolve, reject)=>{

      const reader =
        new FileReader();


      reader.onload =
        function(){

          const img =
            new Image();


          img.onload =
            function(){

              const MAX_WIDTH =
                1600;

              const MAX_HEIGHT =
                1600;


              let width =
                img.width;

              let height =
                img.height;


              if(
                width >
                MAX_WIDTH
              ){

                const ratio =
                  MAX_WIDTH /
                  width;

                width =
                  MAX_WIDTH;

                height =
                  Math.round(
                    height *
                    ratio
                  );

              }


              if(
                height >
                MAX_HEIGHT
              ){

                const ratio =
                  MAX_HEIGHT /
                  height;

                height =
                  MAX_HEIGHT;

                width =
                  Math.round(
                    width *
                    ratio
                  );

              }


              const canvas =
                document.createElement(
                  "canvas"
                );


              canvas.width =
                width;

              canvas.height =
                height;


              const ctx =
                canvas.getContext(
                  "2d"
                );


              ctx.drawImage(
                img,
                0,
                0,
                width,
                height
              );


              /*
               * JPEG compression
               * makes the request much
               * smaller than raw Base64.
               */

              const compressed =
                canvas.toDataURL(
                  "image/jpeg",
                  0.82
                );


              resolve(
                compressed
              );

            };


          img.onerror =
            function(){

              reject(
                new Error(
                  "Unable to read receipt image."
                )
              );

            };


          img.src =
            reader.result;

        };


      reader.onerror =
        function(){

          reject(
            new Error(
              "Unable to process receipt image."
            )
          );

        };


      reader.readAsDataURL(
        file
      );

    }
  );

}


/* =====================================
   VERIFY REQUEST AFTER NETWORK ISSUE
===================================== */

async function verifySubmittedRequest(
  uid
){

  try{

    const url =
      `${SUPABASE_URL}/rest/v1/${DAPP_REQUESTS_TABLE}` +
      `?select=id,status,created_at` +
      `&userid=eq.${encodeURIComponent(uid)}` +
      `&status=eq.pending` +
      `&order=created_at.desc` +
      `&limit=1`;


    const response =
      await supabaseFetch(

        url,

        {

          method:
            "GET",

          headers:{

            apikey:
              SUPABASE_KEY,

            Authorization:
              `Bearer ${SUPABASE_KEY}`,

            Accept:
              "application/json"

          }

        }

      );


    if(!response.ok){

      return false;

    }


    const data =
      await response.json();


    return (
      Array.isArray(data) &&
      data.length > 0
    );

  }catch(error){

    console.warn(
      "Verification after submit failed:",
      error
    );


    return false;

  }

}


/* =====================================
   SUBMIT REQUEST
===================================== */

async function submitDappRequest(){

  /*
   * CRITICAL:
   * LOCK BEFORE ANY AWAIT.
   *
   * This prevents:
   *
   * Click 1
   * Click 2
   *
   * from running two submit processes.
   */

  if(__dappSubmitting){

    console.warn(
      "ALBUKHR: submission already in progress."
    );

    return;

  }


  if(hasSubmitLock()){

    showAlert(
      "Submission In Progress",
      "Your dApp request is already being submitted. Please wait."
    );

    return;

  }


  __dappSubmitting =
    true;


  /*
   * IMMEDIATE BUTTON LOCK
   */

  setSubmitButton(
    "submitting"
  );


  let user = null;


  try{

    /* ---------------------------------
       USER
    --------------------------------- */

    user =
      await getCurrentUser();


    if(!user?.uid){

      __dappSubmitting =
        false;

      setSubmitButton(
        "ready"
      );

      showAlert(
        "Login Required",
        "Please login with Pi Browser."
      );

      return;

    }


    /*
     * CREATE LOCK IMMEDIATELY
     */

    createSubmitLock(
      user.uid
    );


    /* ---------------------------------
       FORM VALUES
    --------------------------------- */

    const piUserEl =
      getEl("piUser");

    const projectNameEl =
      getEl("projectName");

    const serviceTypeEl =
      getEl("serviceType");

    const descriptionEl =
      getEl("description");

    const receiptRefEl =
      getEl("receiptRef");

    const fileInput =
      getEl("receiptImg");

    const agreeEl =
      getEl("agree");


    const piUser =
      piUserEl
        ? piUserEl.value.trim()
        : "";


    const projectName =
      projectNameEl
        ? projectNameEl.value.trim()
        : "";


    const serviceType =
      serviceTypeEl
        ? serviceTypeEl.value
        : "";


    const description =
      descriptionEl
        ? descriptionEl.value.trim()
        : "";


    const receiptRef =
      receiptRefEl
        ? receiptRefEl.value.trim()
        : "";


    const agree =
      agreeEl
        ? agreeEl.checked
        : false;


    const hasFile =
      fileInput &&
      fileInput.files &&
      fileInput.files.length > 0;


    /* ---------------------------------
       VALIDATION
    --------------------------------- */

    if(
      !piUser ||
      !projectName ||
      !serviceType ||
      !description ||
      !receiptRef
    ){

      releaseSubmitLock();

      __dappSubmitting =
        false;

      setSubmitButton(
        "ready"
      );

      showAlert(
        "Missing Information",
        "Please fill all required fields."
      );

      return;

    }


    if(!agree){

      releaseSubmitLock();

      __dappSubmitting =
        false;

      setSubmitButton(
        "ready"
      );

      showAlert(
        "Agreement Required",
        "You must agree to the terms before submitting."
      );

      return;

    }


    /* ---------------------------------
       RECEIPT CHECK
    --------------------------------- */

    if(!hasFile){

      releaseSubmitLock();

      __dappSubmitting =
        false;

      setSubmitButton(
        "ready"
      );

      showAlert(
        "Receipt Required",
        "Please upload your payment receipt image."
      );

      return;

    }


    const file =
      fileInput.files[0];


    if(
      file.size >
      MAX_FILE_SIZE
    ){

      releaseSubmitLock();

      __dappSubmitting =
        false;

      setSubmitButton(
        "ready"
      );

      showAlert(
        "Image Too Large",
        "Maximum allowed image size is 2 MB."
      );

      return;

    }


    /* ---------------------------------
       PENDING CHECK
    --------------------------------- */

    const pending =
      await userHasPending(
        user.uid
      );


    if(pending){

      setPendingUI(
        true
      );


      releaseSubmitLock();

      __dappSubmitting =
        false;


      showAlert(
        "Pending Request",
        "You already have a pending request under review."
      );


      return;

    }


    /* ---------------------------------
       IMAGE OPTIMIZATION
    --------------------------------- */

    setSubmitButton(
      "submitting"
    );


    let receiptImage;


    try{

      receiptImage =
        await optimizeReceiptImage(
          file
        );

    }catch(error){

      console.error(
        "Receipt optimization failed:",
        error
      );


      releaseSubmitLock();

      __dappSubmitting =
        false;

      setSubmitButton(
        "ready"
      );


      showAlert(
        "Receipt Error",
        "Unable to process the receipt image. Please choose another image."
      );


      return;

    }


    /* ---------------------------------
       PAYLOAD
    --------------------------------- */

    const payload = {

      userid:
        user.uid,

      pi_user:
        piUser,

      project_name:
        projectName,

      service_type:
        serviceType,

      description:
        description,

      receipt_ref:
        receiptRef,

      receipt_image:
        receiptImage,

      status:
        "pending",

      admin_note:
        "",

      telegram_unlocked:
        false,

      created_at:
        new Date().toISOString()

    };


    /* ---------------------------------
       SUPABASE INSERT
    --------------------------------- */

    const response =
      await supabaseFetch(

        `${SUPABASE_URL}/rest/v1/${DAPP_REQUESTS_TABLE}`,

        {

          method:
            "POST",

          headers:{

            "Content-Type":
              "application/json",

            apikey:
              SUPABASE_KEY,

            Authorization:
              `Bearer ${SUPABASE_KEY}`,

            Prefer:
              "return=representation"

          },

          body:
            JSON.stringify(
              payload
            )

        },

        REQUEST_TIMEOUT

      );


    /* ---------------------------------
       SUPABASE ERROR
    --------------------------------- */

    if(!response.ok){

      const errorText =
        await response.text();


      console.error(
        "ALBUKHR dApp submit error:",
        response.status,
        errorText
      );


      /*
       * IMPORTANT:
       * Sometimes the server receives
       * the INSERT but the response
       * does not reach the browser.
       *
       * Check Supabase before declaring
       * failure.
       */

      const alreadySubmitted =
        await verifySubmittedRequest(
          user.uid
        );


      if(alreadySubmitted){

        setPendingUI(
          true
        );


        __dappSubmitting =
          false;


        showAlert(
          "Request Submitted",
          "Your dApp request has been submitted successfully."
        );


        setTimeout(
          ()=>{
            window.location.href =
              "my-dapp-requests.html";
          },
          1200
        );


        return;

      }


      releaseSubmitLock();

      __dappSubmitting =
        false;

      setSubmitButton(
        "ready"
      );


      showAlert(
        "Submission Failed",
        "Unable to save your request. Please try again."
      );


      return;

    }


    /* ---------------------------------
       SUCCESS
    --------------------------------- */

    setPendingUI(
      true
    );


    __dappSubmitting =
      false;


    showAlert(
      "Request Submitted",
      "Your dApp launch request has been submitted successfully."
    );


    /*
     * DO NOT release the local
     * submission lock here.
     *
     * Keeping it prevents a second
     * submission while redirecting.
     */

    setTimeout(
      ()=>{

        window.location.href =
          "my-dapp-requests.html";

      },
      1200
    );


  }catch(error){

    console.error(
      "ALBUKHR submitDappRequest error:",
      error
    );


    /*
     * Network timeout / connection
     * failure can happen AFTER Supabase
     * has already inserted the record.
     *
     * Verify before allowing retry.
     */

    if(user?.uid){

      const alreadySubmitted =
        await verifySubmittedRequest(
          user.uid
        );


      if(alreadySubmitted){

        setPendingUI(
          true
        );


        __dappSubmitting =
          false;


        showAlert(
          "Request Submitted",
          "Your dApp request has been submitted successfully."
        );


        setTimeout(
          ()=>{

            window.location.href =
              "my-dapp-requests.html";

          },
          1200
        );


        return;

      }

    }


    releaseSubmitLock();

    __dappSubmitting =
      false;

    setSubmitButton(
      "ready"
    );


    if(
      error?.name ===
      "AbortError"
    ){

      showAlert(
        "Connection Timeout",
        "The server took too long to respond. Please check your connection and try again."
      );


      return;

    }


    showAlert(
      "Network Error",
      "Unable to connect to the server. Please try again."
    );

  }

}


/* =====================================
   INIT PAGE STATE
===================================== */

window.addEventListener(
  "DOMContentLoaded",
  async ()=>{

    const user =
      await getCurrentUser();


    if(!user?.uid){

      setPendingUI(
        false
      );

      return;

    }


    const pending =
      await userHasPending(
        user.uid
      );


    if(pending){

      setPendingUI(
        true
      );


      if(!__pendingAlertShown){

        __pendingAlertShown =
          true;


        showAlert(
          "Pending Request",
          "You already have a pending request under review."
        );

      }

    }else{

      /*
       * Do not allow an old/stale
       * submission lock to permanently
       * disable the form.
       */

      if(!__dappSubmitting){

        setPendingUI(
          false
        );

      }

    }

  }
);


/* =====================================
   PAGE LEAVE PROTECTION
===================================== */

window.addEventListener(
  "beforeunload",
  (event)=>{

    if(__dappSubmitting){

      event.preventDefault();

      event.returnValue =
        "";

    }

  }
);
