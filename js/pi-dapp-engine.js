/* =========================================
   ALBUKHR – PI dApp REQUESTS v4
   USER SUBMISSION ENGINE
========================================= */

(() => {

  "use strict";

  /* =========================================
     CONFIG
  ========================================== */

  const TABLE = "dapp_requests";
  const MAX_RECEIPT_SIZE = 2 * 1024 * 1024;

  let pendingAlertShown = false;
  let submitting = false;


  /* =========================================
     DOM HELPERS
  ========================================= */

  function $(id) {
    return document.getElementById(id);
  }


  /* =========================================
     ALERT
  ========================================= */

  function notify(title, message) {

    if (typeof window.showAlert === "function") {
      window.showAlert(title, message);
      return;
    }

    alert(`${title}\n\n${message}`);
  }


  /* =========================================
     SUPABASE CLIENT
  ========================================= */

  function getSupabase() {

    const client = window.albukhrSupabase;

    if (
      !client ||
      typeof client.from !== "function"
    ) {

      console.error(
        "ALBUKHR Supabase client is not available."
      );

      return null;
    }

    return client;
  }


  /* =========================================
     GET CURRENT PI USER
     SINGLE AUTHORITY:
     ensurePiAuth()
  ========================================= */

  async function getCurrentUser() {

    /* ---------------------------------------
       1. Existing local session
    --------------------------------------- */

    try {

      const stored =
        localStorage.getItem("pi_user");

      if (stored) {

        const user =
          JSON.parse(stored);

        if (user?.uid) {

          return {
            uid: user.uid,
            username: user.username || "",
            wallet_address:
              user.wallet_address || ""
          };

        }

      }

    } catch (error) {

      console.warn(
        "Stored Pi user could not be read:",
        error
      );

    }


    /* ---------------------------------------
       2. Shared Pi authentication
    --------------------------------------- */

    if (
      typeof window.ensurePiAuth !== "function"
    ) {

      console.error(
        "ensurePiAuth() is not available."
      );

      return null;
    }


    try {

      const user =
        await window.ensurePiAuth();

      if (!user?.uid) {

        return null;
      }


      return {
        uid: user.uid,
        username: user.username || "",
        wallet_address:
          user.wallet_address || ""
      };

    } catch (error) {

      console.error(
        "Pi authentication failed:",
        error
      );

      return null;
    }

  }


  /* =========================================
     GET FORM DATA
  ========================================= */

  function getFormData() {

    return {

      piUser:
        $("piUser")?.value.trim() || "",

      projectName:
        $("projectName")?.value.trim() || "",

      serviceType:
        $("serviceType")?.value || "",

      description:
        $("description")?.value.trim() || "",

      receiptRef:
        $("receiptRef")?.value.trim() || "",

      fileInput:
        $("receiptImg"),

      agree:
        $("agree")?.checked === true

    };

  }


  /* =========================================
     VALIDATE FORM
  ========================================= */

  function validateForm(form) {

    if (!form.piUser) {

      notify(
        "Missing Information",
        "Please enter your Pi username."
      );

      return false;
    }


    if (!form.projectName) {

      notify(
        "Missing Information",
        "Please enter your project name."
      );

      return false;
    }


    if (!form.serviceType) {

      notify(
        "Missing Information",
        "Please select a service type."
      );

      return false;
    }


    if (!form.description) {

      notify(
        "Missing Information",
        "Please describe your dApp."
      );

      return false;
    }


    if (!form.receiptRef) {

      notify(
        "Missing Information",
        "Please enter your transaction reference."
      );

      return false;
    }


    if (!form.agree) {

      notify(
        "Agreement Required",
        "You must agree to the terms before submitting."
      );

      return false;
    }


    if (
      !form.fileInput ||
      !form.fileInput.files ||
      !form.fileInput.files.length
    ) {

      notify(
        "Receipt Required",
        "Please upload your payment receipt image."
      );

      return false;
    }


    const file =
      form.fileInput.files[0];


    if (file.size > MAX_RECEIPT_SIZE) {

      notify(
        "Image Too Large",
        "Maximum allowed image size is 2 MB."
      );

      return false;
    }


    if (
      !file.type ||
      !file.type.startsWith("image/")
    ) {

      notify(
        "Invalid Receipt",
        "Please upload a valid receipt image."
      );

      return false;
    }


    return true;

  }


  /* =========================================
     CHECK PENDING REQUEST
  ========================================= */

  async function userHasPending(uid) {

    const supabase =
      getSupabase();

    if (!supabase) {

      throw new Error(
        "Supabase client is not available."
      );

    }


    const {

      data,
      error

    } = await supabase

      .from(TABLE)

      .select("id,status")

      .eq("userid", uid)

      .eq("status", "pending");


    if (error) {

      console.error(
        "Pending request query failed:",
        error
      );

      throw error;
    }


    return (
      Array.isArray(data) &&
      data.length > 0
    );

  }


  /* =========================================
     SET SUBMIT UI
  ========================================= */

  function setSubmitState(
    processing
  ) {

    const button =
      $("submitBtn");

    if (!button) return;


    if (processing) {

      button.disabled = true;

      button.dataset.originalText =
        button.dataset.originalText ||
        button.innerText;

      button.innerText =
        "Submitting...";

      button.classList.add(
        "is-processing"
      );

      return;
    }


    button.disabled = false;

    button.innerText =
      button.dataset.originalText ||
      "Submit for Review";

    button.classList.remove(
      "is-processing"
    );

  }


  /* =========================================
     SET PENDING UI
  ========================================= */

  function setPendingUI(
    pending
  ) {

    const button =
      $("submitBtn");

    const viewBox =
      $("viewRequestBox");


    if (button) {

      button.disabled =
        pending;

      button.innerText =
        pending
          ? "Pending Review"
          : "Submit for Review";

      button.classList.toggle(
        "is-pending",
        pending
      );

    }


    if (viewBox) {

      viewBox.style.display =
        pending
          ? "block"
          : "none";

    }

  }


  /* =========================================
     FILE → BASE64
  ========================================= */

  function fileToDataURL(file) {

    return new Promise(
      (resolve, reject) => {

        const reader =
          new FileReader();


        reader.onload = () => {

          resolve(
            reader.result
          );

        };


        reader.onerror = () => {

          reject(
            new Error(
              "Unable to read receipt image."
            )
          );

        };


        reader.readAsDataURL(file);

      }
    );

  }


  /* =========================================
     SUBMIT REQUEST
  ========================================= */

  async function submitDappRequest() {

    if (submitting) {
      return;
    }


    submitting = true;


    try {

      setSubmitState(true);


      /* -------------------------------------
         USER
      ------------------------------------- */

      const user =
        await getCurrentUser();


      if (!user?.uid) {

        notify(
          "Login Required",
          "Please login with Pi Browser."
        );

        return;
      }


      /* -------------------------------------
         FORM
      ------------------------------------- */

      const form =
        getFormData();


      if (!validateForm(form)) {
        return;
      }


      /* -------------------------------------
         PENDING
      ------------------------------------- */

      const pending =
        await userHasPending(
          user.uid
        );


      if (pending) {

        setPendingUI(true);

        notify(
          "Pending Request",
          "You already have a pending request under review."
        );

        return;
      }


      /* -------------------------------------
         RECEIPT
      ------------------------------------- */

      const file =
        form.fileInput.files[0];


      const receiptImage =
        await fileToDataURL(file);


      /* -------------------------------------
         PAYLOAD
         SAME DATABASE MAPPING
      ------------------------------------- */

      const payload = {

        userid:
          user.uid,

        pi_user:
          form.piUser,

        project_name:
          form.projectName,

        service_type:
          form.serviceType,

        description:
          form.description,

        receipt_ref:
          form.receiptRef,

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


      console.log(
        "Submitting dApp request:",
        {
          ...payload,
          receipt_image:
            "[base64 image omitted]"
        }
      );


      /* -------------------------------------
         SUPABASE
      ------------------------------------- */

      const supabase =
        getSupabase();


      if (!supabase) {

        throw new Error(
          "Supabase client is not ready."
        );

      }


      const {

        data,
        error

      } = await supabase

        .from(TABLE)

        .insert(payload)

        .select();


      if (error) {

        console.error(
          "dApp request insert failed:",
          error
        );

        throw error;
      }


      console.log(
        "dApp request inserted:",
        data
      );


      /* -------------------------------------
         SUCCESS
      ------------------------------------- */

      setPendingUI(true);


      notify(
        "Request Submitted",
        "Your dApp launch request has been submitted successfully."
      );


      setTimeout(() => {

        window.location.href =
          "my-dapp-requests.html";

      }, 1500);


    } catch (error) {

      console.error(
        "submitDappRequest error:",
        error
      );


      notify(
        "Submission Failed",
        error?.message ||
        "Unable to save your request. Please try again."
      );


    } finally {

      submitting = false;

      if (
        !$("submitBtn")?.classList.contains(
          "is-pending"
        )
      ) {

        setSubmitState(false);

      }

    }

  }


  /* =========================================
     SERVICE TYPE
  ========================================= */

  function initServiceType() {

    const select =
      $("serviceType");

    const paymentBox =
      $("paymentBox");


    if (!select || !paymentBox) {
      return;
    }


    function updatePaymentVisibility() {

      paymentBox.style.display =
        select.value
          ? "block"
          : "none";

    }


    select.addEventListener(
      "change",
      updatePaymentVisibility
    );


    updatePaymentVisibility();

  }


  /* =========================================
     PI USER UI
  ========================================= */

  async function initPiUserUI() {

    const input =
      $("piUser");

    if (!input) return;


    try {

      const user =
        await getCurrentUser();


      if (user?.username) {

        input.value =
          user.username;

        input.readOnly =
          true;

        input.classList.add(
          "is-readonly"
        );

      }

    } catch (error) {

      console.warn(
        "Unable to initialize Pi username:",
        error
      );

    }

  }


  /* =========================================
     INITIAL PAGE STATE
  ========================================= */

  async function initPage() {

    initServiceType();

    await initPiUserUI();


    const user =
      await getCurrentUser();


    if (!user?.uid) {

      setPendingUI(false);

      return;
    }


    try {

      const pending =
        await userHasPending(
          user.uid
        );


      setPendingUI(
        pending
      );


      if (
        pending &&
        !pendingAlertShown
      ) {

        pendingAlertShown =
          true;


        notify(
          "Pending Request",
          "You already have a pending request under review."
        );

      }

    } catch (error) {

      console.error(
        "Initial pending check failed:",
        error
      );

      /*
       * IMPORTANT:
       * Kada mu hana user form saboda
       * query error.
       *
       * User zai iya ganin form,
       * amma submission zai sake tabbatar da
       * pending status.
       */

      setPendingUI(false);

    }

  }


  /* =========================================
     GLOBAL EXPORT
  ========================================= */

  window.submitDappRequest =
    submitDappRequest;


  /* =========================================
     START
  ========================================= */

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      initPage
    );

  } else {

    initPage();

  }

})();
