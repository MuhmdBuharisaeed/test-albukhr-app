/* =====================================
   ALBUKHR – PI dApp ENGINE
   NEW ARCHITECTURE
   Page Engine: js/pages/dapp-request.js

   Responsibilities:
   - dApp launch request submission
   - Shared ALBUKHR authentication
   - Shared ALBUKHR Supabase client
   - Mainnet/Testnet network isolation
   - Pending-request protection
   - In-memory submit lock
   - Receipt image optimization
   - Request verification after network failure

   Architecture rules:
   - No localStorage
   - No Supabase credentials
   - No own Supabase client
   - Uses shared ALBUKHR auth/session layer
   - Uses shared ALBUKHR Supabase client
   - Uses shared ALBUKHR environment/network layer
   - Does not modify Dock Navigation
===================================== */

"use strict";

(() => {
  /* =====================================
     CONFIG
  ===================================== */

  const REQUESTS_TABLE = "dapp_requests";
  const REQUEST_TIMEOUT = 30000;
  const MAX_FILE_SIZE = 2 * 1024 * 1024;

  /* =====================================
     STATE
  ===================================== */

  const STATE = {
    submitting: false,
    pending: false,
    currentUser: null,
    network: null,
    pendingAlertShown: false
  };

  /* =====================================
     DOM
  ===================================== */

  function getEl(id) {
    return document.getElementById(id);
  }

  /* =====================================
     SHARED SUPABASE CLIENT
  ===================================== */

  function getSupabaseClient() {
    const candidates = [
      window.AlbukhrSupabase?.client,
      window.AlbukhrSupabaseClient,
      window.supabaseClient,
      window.supabase
    ];

    const client = candidates.find(
      value => value && typeof value.from === "function"
    );

    if (!client) {
      throw new Error(
        "ALBUKHR shared Supabase client is unavailable."
      );
    }

    return client;
  }

  /* =====================================
     SHARED NETWORK RESOLUTION
  ===================================== */

  function getCurrentNetwork() {
    const candidates = [
      window.AlbukhrNetwork?.current,
      window.AlbukhrNetwork?.network,
      window.AlbukhrEnvironment?.current,
      window.AlbukhrEnvironment?.network,
      window.ALBUKHR_NETWORK,
      document.documentElement?.dataset?.network,
      document.body?.dataset?.network
    ];

    for (const value of candidates) {
      const normalized = String(value || "")
        .toLowerCase()
        .trim();

      if (normalized === "mainnet" || normalized === "testnet") {
        return normalized;
      }
    }

    const host = window.location.hostname.toLowerCase();

    if (
      host === "test.albukhr.com" ||
      host.startsWith("test.")
    ) {
      return "testnet";
    }

    return "mainnet";
  }

  /* =====================================
     SHARED AUTH RESOLUTION
  ===================================== */

  async function getCurrentUser() {
    const candidates = [
      window.AlbukhrAuth?.getCurrentUser,
      window.AlbukhrAuth?.currentUser,
      window.getCurrentUser,
      window.ensurePiAuth
    ];

    for (const resolver of candidates) {
      if (typeof resolver !== "function") continue;

      try {
        const result = await resolver();

        const user =
          result?.user ||
          result?.data?.user ||
          result;

        if (user?.uid || user?.id || user?.username) {
          return normalizeUser(user);
        }
      } catch (error) {
        console.warn(
          "ALBUKHR dApp auth resolver failed:",
          error
        );
      }
    }

    return null;
  }

  function normalizeUser(user) {
    return {
      uid: String(
        user?.uid ||
        user?.id ||
        user?.user_id ||
        ""
      ).trim(),

      username: String(
        user?.username ||
        user?.name ||
        ""
      ).trim(),

      wallet_address:
        user?.wallet_address ||
        user?.walletAddress ||
        ""
    };
  }

  /* =====================================
     SHARED FETCH WITH TIMEOUT
  ===================================== */

  async function requestWithTimeout(
    url,
    options = {},
    timeout = REQUEST_TIMEOUT
  ) {
    const controller = new AbortController();

    const timer = window.setTimeout(
      () => controller.abort(),
      timeout
    );

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal
      });
    } finally {
      window.clearTimeout(timer);
    }
  }

  /* =====================================
     ALERT
  ===================================== */

  function showAlert(title, message) {
    if (typeof window.openAppAlert === "function") {
      window.openAppAlert(title, message);
      return;
    }

    console.warn(`ALBUKHR: ${title} — ${message}`);
  }

  /* =====================================
     SUBMIT BUTTON
  ===================================== */

  function setSubmitButton(mode = "ready") {
    const btn = getEl("submitBtn");

    if (!btn) return;

    if (mode === "submitting") {
      btn.disabled = true;
      btn.classList.add("submitting");
      btn.innerHTML = `
        <span class="submit-spinner"></span>
        Submitting...
      `;
      btn.style.pointerEvents = "none";
      btn.style.opacity = "0.7";
      return;
    }

    if (mode === "pending") {
      btn.disabled = true;
      btn.classList.remove("submitting");
      btn.innerHTML = "Pending Review";
      btn.style.pointerEvents = "none";
      btn.style.opacity = "0.6";
      return;
    }

    btn.disabled = false;
    btn.classList.remove("submitting");
    btn.innerHTML = "Submit for Review";
    btn.style.pointerEvents = "auto";
    btn.style.opacity = "1";
  }

  /* =====================================
     PENDING UI
  ===================================== */

  function setPendingUI(isPending) {
    STATE.pending = Boolean(isPending);

    const viewBox = getEl("viewRequestBox");

    if (STATE.pending) {
      setSubmitButton("pending");
    } else if (!STATE.submitting) {
      setSubmitButton("ready");
    }

    if (viewBox) {
      viewBox.style.display = "block";
    }
  }

  /* =====================================
     IMAGE OPTIMIZER
  ===================================== */

  function optimizeReceiptImage(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(
          new Error("Receipt image is required.")
        );
        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        const img = new Image();

        img.onload = () => {
          const MAX_WIDTH = 1600;
          const MAX_HEIGHT = 1600;

          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            const ratio = MAX_WIDTH / width;
            width = MAX_WIDTH;
            height = Math.round(height * ratio);
          }

          if (height > MAX_HEIGHT) {
            const ratio = MAX_HEIGHT / height;
            height = MAX_HEIGHT;
            width = Math.round(width * ratio);
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");

          if (!ctx) {
            reject(
              new Error(
                "Unable to create image processing context."
              )
            );
            return;
          }

          ctx.drawImage(
            img,
            0,
            0,
            width,
            height
          );

          resolve(
            canvas.toDataURL(
              "image/jpeg",
              0.82
            )
          );
        };

        img.onerror = () => {
          reject(
            new Error(
              "Unable to read receipt image."
            )
          );
        };

        img.src = reader.result;
      };

      reader.onerror = () => {
        reject(
          new Error(
            "Unable to process receipt image."
          )
        );
      };

      reader.readAsDataURL(file);
    });
  }

  /* =====================================
     PENDING QUERY
  ===================================== */

  async function userHasPending(uid) {
    const client = getSupabaseClient();

    let query = client
      .from(REQUESTS_TABLE)
      .select("id,status,created_at")
      .eq("userid", uid)
      .eq("status", "pending")
      .order("created_at", {
        ascending: false
      })
      .limit(1);

    query = query.eq(
      "network",
      STATE.network
    );

    const { data, error } = await query;

    if (error) {
      console.error(
        "ALBUKHR dApp pending query error:",
        error
      );

      /*
       * Fail closed.
       * If the duplicate-protection query cannot
       * confirm that a request is absent, do not
       * permit a new submission.
       */
      throw error;
    }

    return Array.isArray(data) && data.length > 0;
  }

  /* =====================================
     VERIFY AFTER NETWORK FAILURE
  ===================================== */

  async function verifySubmittedRequest(uid) {
    try {
      const client = getSupabaseClient();

      let query = client
        .from(REQUESTS_TABLE)
        .select("id,status,created_at")
        .eq("userid", uid)
        .eq("status", "pending")
        .order("created_at", {
          ascending: false
        })
        .limit(1);

      query = query.eq(
        "network",
        STATE.network
      );

      const { data, error } = await query;

      if (error) {
        console.warn(
          "ALBUKHR dApp verification query failed:",
          error
        );
        return false;
      }

      return (
        Array.isArray(data) &&
        data.length > 0
      );
    } catch (error) {
      console.warn(
        "ALBUKHR dApp verification failed:",
        error
      );
      return false;
    }
  }

  /* =====================================
     FORM VALUES
  ===================================== */

  function getFormValues() {
    const piUserEl = getEl("piUser");
    const projectNameEl = getEl("projectName");
    const serviceTypeEl = getEl("serviceType");
    const descriptionEl = getEl("description");
    const receiptRefEl = getEl("receiptRef");
    const fileInput = getEl("receiptImg");
    const agreeEl = getEl("agree");

    return {
      piUser:
        piUserEl?.value?.trim() || "",

      projectName:
        projectNameEl?.value?.trim() || "",

      serviceType:
        serviceTypeEl?.value || "",

      description:
        descriptionEl?.value?.trim() || "",

      receiptRef:
        receiptRefEl?.value?.trim() || "",

      agree:
        Boolean(agreeEl?.checked),

      file:
        fileInput?.files?.[0] || null
    };
  }

  /* =====================================
     VALIDATION
  ===================================== */

  function validateForm(values) {
    if (
      !values.piUser ||
      !values.projectName ||
      !values.serviceType ||
      !values.description ||
      !values.receiptRef
    ) {
      return {
        ok: false,
        title: "Missing Information",
        message:
          "Please fill all required fields."
      };
    }

    if (!values.agree) {
      return {
        ok: false,
        title: "Agreement Required",
        message:
          "You must agree to the terms before submitting."
      };
    }

    if (!values.file) {
      return {
        ok: false,
        title: "Receipt Required",
        message:
          "Please upload your payment receipt image."
      };
    }

    if (values.file.size > MAX_FILE_SIZE) {
      return {
        ok: false,
        title: "Image Too Large",
        message:
          "Maximum allowed image size is 2 MB."
      };
    }

    return {
      ok: true
    };
  }

  /* =====================================
     RESET AFTER VALIDATION FAILURE
  ===================================== */

  function resetSubmissionState() {
    STATE.submitting = false;
    setSubmitButton(
      STATE.pending
        ? "pending"
        : "ready"
    );
  }

  /* =====================================
     SUBMIT REQUEST
  ===================================== */

  async function submitDappRequest() {
    /*
     * In-memory lock is intentionally used instead
     * of localStorage. Persistent state must remain
     * in Supabase under the new architecture.
     */
    if (STATE.submitting) {
      console.warn(
        "ALBUKHR: submission already in progress."
      );
      return;
    }

    if (STATE.pending) {
      showAlert(
        "Pending Request",
        "You already have a pending request under review."
      );
      return;
    }

    STATE.submitting = true;
    setSubmitButton("submitting");

    let user = null;

    try {
      STATE.network = getCurrentNetwork();

      user = await getCurrentUser();

      if (!user?.uid) {
        resetSubmissionState();

        showAlert(
          "Login Required",
          "Please login with Pi Browser."
        );

        return;
      }

      STATE.currentUser = user;

      const values = getFormValues();
      const validation = validateForm(values);

      if (!validation.ok) {
        resetSubmissionState();

        showAlert(
          validation.title,
          validation.message
        );

        return;
      }

      /*
       * Database is the authoritative duplicate
       * protection layer.
       */
      const pending =
        await userHasPending(user.uid);

      if (pending) {
        setPendingUI(true);

        STATE.submitting = false;

        showAlert(
          "Pending Request",
          "You already have a pending request under review."
        );

        return;
      }

      const receiptImage =
        await optimizeReceiptImage(
          values.file
        );

      const payload = {
        userid: user.uid,
        pi_user: values.piUser,
        project_name: values.projectName,
        service_type: values.serviceType,
        description: values.description,
        receipt_ref: values.receiptRef,
        receipt_image: receiptImage,
        status: "pending",
        admin_note: "",
        telegram_unlocked: false,
        network: STATE.network,
        created_at: new Date().toISOString()
      };

      /*
       * Use the shared Supabase client.
       * No URL, API key, or REST credentials are
       * embedded in this page engine.
       */
      const client = getSupabaseClient();

      const { data, error } = await client
        .from(REQUESTS_TABLE)
        .insert(payload)
        .select("id,status,created_at")
        .single();

      if (error) {
        console.error(
          "ALBUKHR dApp submit error:",
          error
        );

        /*
         * The insert may have reached Supabase even
         * when the browser did not receive a normal
         * response. Verify before allowing retry.
         */
        const alreadySubmitted =
          await verifySubmittedRequest(
            user.uid
          );

        if (alreadySubmitted) {
          setPendingUI(true);
          STATE.submitting = false;

          showAlert(
            "Request Submitted",
            "Your dApp request has been submitted successfully."
          );

          window.setTimeout(() => {
            window.location.href =
              "my-dapp-requests.html";
          }, 1200);

          return;
        }

        resetSubmissionState();

        showAlert(
          "Submission Failed",
          "Unable to save your request. Please try again."
        );

        return;
      }

      console.log(
        "ALBUKHR dApp request submitted:",
        data
      );

      setPendingUI(true);
      STATE.submitting = false;

      showAlert(
        "Request Submitted",
        "Your dApp launch request has been submitted successfully."
      );

      window.setTimeout(() => {
        window.location.href =
          "my-dapp-requests.html";
      }, 1200);

    } catch (error) {
      console.error(
        "ALBUKHR submitDappRequest error:",
        error
      );

      if (user?.uid) {
        const alreadySubmitted =
          await verifySubmittedRequest(
            user.uid
          );

        if (alreadySubmitted) {
          setPendingUI(true);
          STATE.submitting = false;

          showAlert(
            "Request Submitted",
            "Your dApp request has been submitted successfully."
          );

          window.setTimeout(() => {
            window.location.href =
              "my-dapp-requests.html";
          }, 1200);

          return;
        }
      }

      resetSubmissionState();

      if (error?.name === "AbortError") {
        showAlert(
          "Connection Timeout",
          "The server took too long to respond. Please check your connection and try again."
        );
        return;
      }

      /*
       * Database/authentication errors should not be
       * disguised as generic network errors.
       */
      showAlert(
        "Submission Error",
        error?.message ||
          "Unable to submit your request. Please try again."
      );
    }
  }

  /* =====================================
     PAGE INIT
  ===================================== */

  async function init() {
    STATE.network = getCurrentNetwork();

    const user = await getCurrentUser();

    if (!user?.uid) {
      setPendingUI(false);
      return;
    }

    STATE.currentUser = user;

    const piUserEl = getEl("piUser");

    /*
     * Only populate the current form field from
     * authenticated session data. No localStorage.
     */
    if (piUserEl && !piUserEl.value) {
      piUserEl.value =
        user.username || "";
    }

    try {
      const pending =
        await userHasPending(
          user.uid
        );

      if (pending) {
        setPendingUI(true);

        if (!STATE.pendingAlertShown) {
          STATE.pendingAlertShown = true;

          showAlert(
            "Pending Request",
            "You already have a pending request under review."
          );
        }
      } else {
        setPendingUI(false);
      }
    } catch (error) {
      /*
       * Fail closed when duplicate-protection state
       * cannot be checked.
       */
      console.error(
        "ALBUKHR dApp pending-state initialization failed:",
        error
      );

      setSubmitButton("pending");
    }
  }

  /* =====================================
     EVENTS
  ===================================== */

  function bindEvents() {
    const submitBtn = getEl("submitBtn");

    if (submitBtn) {
      submitBtn.addEventListener(
        "click",
        submitDappRequest
      );
    }

    window.addEventListener(
      "albukhrNetworkChanged",
      async () => {
        if (STATE.submitting) return;

        STATE.network = getCurrentNetwork();
        await init();
      }
    );
  }

  /* =====================================
     PAGE LEAVE PROTECTION
  ===================================== */

  function bindLeaveProtection() {
    window.addEventListener(
      "beforeunload",
      event => {
        if (!STATE.submitting) return;

        event.preventDefault();
        event.returnValue = "";
      }
    );
  }

  /* =====================================
     PUBLIC API
  ===================================== */

  window.AlbukhrDappRequestEngine = {
    state: STATE,
    init,
    submitDappRequest,
    getCurrentUser,
    getCurrentNetwork,
    userHasPending,
    verifySubmittedRequest,
    optimizeReceiptImage,
    setPendingUI
  };

  /*
   * Backward-compatible global handler for existing
   * HTML onclick="submitDappRequest()" markup.
   */
  window.submitDappRequest =
    submitDappRequest;

  /* =====================================
     INIT
  ===================================== */

  document.addEventListener(
    "DOMContentLoaded",
    async () => {
      bindEvents();
      bindLeaveProtection();
      await init();
    },
    { once: true }
  );
})();
