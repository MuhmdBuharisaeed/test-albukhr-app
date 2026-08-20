/* =========================================================
   ALBUKHR INTERNAL REGISTRY FORM
   PRODUCTION-CONSOLIDATED SUPABASE VERSION
========================================================= */

(function(){
  "use strict";

  const els = {
    pageWrap: document.getElementById("pageWrap"),
    identityBox: document.getElementById("identityBox"),
    identityName: document.getElementById("identityName"),
    identityMeta: document.getElementById("identityMeta"),
    lockBox: document.getElementById("lockBox"),
    submitBtn: document.getElementById("submitBtn"),
    submitNotice: document.getElementById("submitNotice"),

    projectName: document.getElementById("projectName"),
    category: document.getElementById("category"),
    stage: document.getElementById("stage"),

    creatorName: document.getElementById("creatorName"),
    role: document.getElementById("role"),
    internalId: document.getElementById("internalId"),
    email: document.getElementById("email"),

    summary: document.getElementById("summary"),
    problem: document.getElementById("problem"),
    solution: document.getElementById("solution"),
    impact: document.getElementById("impact"),

    funding: document.getElementById("funding"),
    risk: document.getElementById("risk"),
    confidentiality: document.getElementById("confidentiality"),

    roi: document.getElementById("roi"),
    liquidity: document.getElementById("liquidity"),
    agree: document.getElementById("agree")
  };

  let PAGE_STATE = {
    contributor: null,
    access: null,
    session: null,
    locked: false,
    lockReason: "",
    lockMeta: null,
    submitting: false
  };

  /* =========================================================
     HELPERS
  ========================================================= */

  function safeText(v, fallback = ""){
    if(v === null || v === undefined){
      return fallback;
    }

    return String(v);
  }

  function escapeHtml(value){
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function showNotice(message, type = "info"){
    if(!els.submitNotice){
      return;
    }

    els.submitNotice.className =
      "notice " + type;

    els.submitNotice.innerHTML =
      message;

    els.submitNotice.classList.remove(
      "hidden"
    );
  }

  function hideNotice(){
    if(!els.submitNotice){
      return;
    }

    els.submitNotice.className =
      "notice hidden";

    els.submitNotice.innerHTML = "";
  }

  function setSubmitBusy(
    busy,
    text = "Submitting..."
  ){
    if(!els.submitBtn){
      return;
    }

    if(busy){
      if(
        !els.submitBtn.dataset.originalText
      ){
        els.submitBtn.dataset.originalText =
          els.submitBtn.innerHTML;
      }

      els.submitBtn.disabled = true;

      els.submitBtn.setAttribute(
        "aria-disabled",
        "true"
      );

      els.submitBtn.classList.add(
        "is-disabled"
      );

      els.submitBtn.innerHTML =
        escapeHtml(text);

      PAGE_STATE.submitting = true;

      return;
    }

    PAGE_STATE.submitting = false;

    els.submitBtn.disabled =
      PAGE_STATE.locked;

    if(PAGE_STATE.locked){
      els.submitBtn.setAttribute(
        "aria-disabled",
        "true"
      );
    }else{
      els.submitBtn.removeAttribute(
        "aria-disabled"
      );
    }

    els.submitBtn.classList.toggle(
      "is-disabled",
      PAGE_STATE.locked
    );

    els.submitBtn.innerHTML =
      els.submitBtn.dataset.originalText ||
      "Register Internal Project";
  }

  function setFormDisabled(disabled){
    const fields = [
      els.projectName,
      els.category,
      els.stage,
      els.creatorName,
      els.role,
      els.internalId,
      els.email,
      els.summary,
      els.problem,
      els.solution,
      els.impact,
      els.funding,
      els.risk,
      els.confidentiality,
      els.roi,
      els.liquidity,
      els.agree
    ];

    fields.forEach(el => {
      if(el){
        el.disabled = !!disabled;
      }
    });

    if(els.submitBtn){
      els.submitBtn.disabled =
        !!disabled ||
        PAGE_STATE.submitting;
    }
  }

  function renderBlockedScreen(
    title = "Access Denied",
    message =
      "You do not have permission to open this page."
  ){
    document.body.innerHTML = `
      <div class="block-screen">
        <div class="block-card">
          <div class="block-icon">⛔</div>
          <h2 class="block-title">
            ${escapeHtml(title)}
          </h2>
          <p class="block-text">
            ${escapeHtml(message)}
          </p>
        </div>
      </div>
    `;
  }

  function renderContributorIdentity(
    contributor
  ){
    if(!contributor){
      return;
    }

    if(els.identityName){
      els.identityName.textContent =
        contributor.full_name ||
        "ALBUKHR Contributor";
    }

    const parts = [
      contributor.email
        ? `📧 ${contributor.email}`
        : "",

      contributor.albukhr_id
        ? `🆔 ${contributor.albukhr_id}`
        : "",

      contributor.country
        ? `🌍 ${contributor.country}`
        : ""
    ].filter(Boolean);

    if(els.identityMeta){
      els.identityMeta.innerHTML =
        parts
          .map(escapeHtml)
          .join("<br>");
    }

    if(els.identityBox){
      els.identityBox.classList.remove(
        "hidden"
      );
    }
  }

  function fillContributorFields(
    contributor
  ){
    if(!contributor){
      return;
    }

    if(
      els.creatorName &&
      !els.creatorName.value &&
      contributor.full_name
    ){
      els.creatorName.value =
        contributor.full_name;
    }

    if(
      els.internalId &&
      !els.internalId.value &&
      contributor.albukhr_id
    ){
      els.internalId.value =
        contributor.albukhr_id;
    }

    if(
      els.email &&
      !els.email.value &&
      contributor.email
    ){
      els.email.value =
        contributor.email;
    }

    if(
      els.creatorName
    ){
      els.creatorName.setAttribute(
        "data-autofilled",
        "true"
      );
    }
  }

  function showLock(message){
    if(!els.lockBox){
      return;
    }

    els.lockBox.innerHTML =
      message;

    els.lockBox.classList.remove(
      "hidden"
    );
  }

  function hideLock(){
    if(!els.lockBox){
      return;
    }

    els.lockBox.innerHTML = "";

    els.lockBox.classList.add(
      "hidden"
    );
  }

  function collectFormMap(){
    return {
      projectName:
        els.projectName,

      category:
        els.category,

      stage:
        els.stage,

      creatorName:
        els.creatorName,

      role:
        els.role,

      internalId:
        els.internalId,

      email:
        els.email,

      phone:
        document.getElementById("phone"),

      summary:
        els.summary,

      problem:
        els.problem,

      solution:
        els.solution,

      impact:
        els.impact,

      funding:
        els.funding,

      risk:
        els.risk,

      confidentiality:
        els.confidentiality,

      roi:
        els.roi,

      liquidity:
        els.liquidity
    };
  }

  function validateAgreement(){
    if(
      !els.agree ||
      !els.agree.checked
    ){
      throw new Error(
        "You must confirm the Internal Governance Policy before submitting."
      );
    }
  }

  function getInternalEngine(){
    const engine =
      window.AlbukhrInternalRegistryEngine;

    if(!engine){
      throw new Error(
        "AlbukhrInternalRegistryEngine not found. Load js/internal-registry-engine.js first."
      );
    }

    return engine;
  }

  /* =========================================================
     LOCK UI
  ========================================================= */

  function applyLockState(lock){
    if(!lock?.locked){
      PAGE_STATE.locked = false;
      PAGE_STATE.lockReason = "";
      PAGE_STATE.lockMeta = null;

      hideLock();

      if(!PAGE_STATE.submitting){
        setFormDisabled(false);
      }

      return;
    }

    PAGE_STATE.locked = true;

    PAGE_STATE.lockReason =
      lock.reason || "";

    PAGE_STATE.lockMeta =
      lock || null;

    setFormDisabled(true);

    if(
      lock.reason ===
      "internal_pending_exists"
    ){
      showLock(`
        <b>⏳ Submission locked</b><br>
        Your previous internal project is still under review. You cannot submit another internal project until the current review is completed.
      `);

      return;
    }

    if(
      lock.reason ===
      "approval_cooldown_active"
    ){
      const unlockText =
        lock.unlock_at
          ? new Date(
              lock.unlock_at
            ).toLocaleString()
          : "after 7 days";

      showLock(`
        <b>🔒 Submission temporarily locked</b><br>
        Your previous internal project was approved recently. You can submit another internal project again after:
        <b>${escapeHtml(unlockText)}</b>
      `);

      return;
    }

    showLock(`
      <b>🔒 Submission locked</b><br>
      ${escapeHtml(
        lock.message ||
        "Internal project submission is temporarily unavailable."
      )}
    `);
  }

  /* =========================================================
     ACCESS ERROR NORMALIZATION
  ========================================================= */

  function renderAccessDenied(
    reason
  ){
    switch(reason){

      case "missing_internal_session":
      case "missing_session":
        renderBlockedScreen(
          "Direct access not allowed",
          "This internal registry page can only be opened through approved contributor access."
        );
        return;

      case "contributor_not_found":
        renderBlockedScreen(
          "Contributor not found",
          "No contributor profile was found for this internal registry session."
        );
        return;

      case "not_approved":
      case "contributor_not_approved":
        renderBlockedScreen(
          "Access denied",
          "Only approved ALBUKHR contributors can access the internal project registry."
        );
        return;

      case "internal_locked":
      case "internal_access_locked":
        renderBlockedScreen(
          "Internal access locked",
          "Your contributor account has not been granted internal registry access yet."
        );
        return;

      default:
        renderBlockedScreen(
          "Access denied",
          "You do not have permission to open this page."
        );
    }
  }

  /* =========================================================
     BOOTSTRAP
  ========================================================= */

  async function bootstrapPage(){
    const internalEngine =
      getInternalEngine();

    const boot =
      await internalEngine
        .bootstrapInternalRegistryPage();

    if(!boot?.allowed){
      renderAccessDenied(
        safeText(boot?.reason)
      );

      return false;
    }

    PAGE_STATE.contributor =
      boot.contributor || null;

    PAGE_STATE.access =
      boot.access || null;

    PAGE_STATE.session =
      boot.session || null;

    if(PAGE_STATE.contributor){
      renderContributorIdentity(
        PAGE_STATE.contributor
      );

      fillContributorFields(
        PAGE_STATE.contributor
      );
    }

    applyLockState(
      boot.lock || null
    );

    return true;
  }

  /* =========================================================
     SUBMIT
  ========================================================= */

  async function handleSubmit(){
    if(PAGE_STATE.submitting){
      return;
    }

    try{
      hideNotice();

      if(PAGE_STATE.locked){
        throw new Error(
          "Internal project submission is currently locked for this contributor."
        );
      }

      if(
        !PAGE_STATE.contributor?.email
      ){
        throw new Error(
          "Contributor session not found."
        );
      }

      validateAgreement();

      setSubmitBusy(
        true,
        "Submitting..."
      );

      const internalEngine =
        getInternalEngine();

      const result =
        await internalEngine
          .submitInternalProjectFromForm(
            collectFormMap()
          );

      if(!result?.ok){
        throw new Error(
          result?.message ||
          "Failed to submit internal project."
        );
      }

      showNotice(
        "Internal project submitted successfully. Your project is now under review by ALBUKHR admin.",
        "success"
      );

      const refreshed =
        await internalEngine
          .bootstrapInternalRegistryPage();

      if(refreshed?.allowed){
        applyLockState(
          refreshed.lock || null
        );
      }

    }catch(err){
      console.error(
        "Internal project submit error:",
        err
      );

      const msg =
        safeText(
          err?.message ||
          "Unable to submit internal project."
        );

      if(
        msg.includes("under review") ||
        msg.includes(
          "Previous project under review"
        ) ||
        msg.includes(
          "previous internal project"
        )
      ){
        PAGE_STATE.locked = true;

        setFormDisabled(true);

        showLock(`
          <b>⏳ Submission locked</b><br>
          Your previous internal project is still under review. You cannot submit another internal project until the current review is completed.
        `);

        showNotice(
          "Previous project under review.",
          "warn"
        );

        return;
      }

      if(
        msg.includes("7 days") ||
        msg.includes(
          "cooldown"
        ) ||
        msg.includes(
          "approved recently"
        )
      ){
        PAGE_STATE.locked = true;

        setFormDisabled(true);

        showLock(`
          <b>🔒 Submission temporarily locked</b><br>
          Your previous internal project was approved recently. You must wait before submitting another internal project.
        `);

        showNotice(
          "You can submit another internal project after the cooldown period.",
          "warn"
        );

        return;
      }

      showNotice(
        escapeHtml(msg),
        "error"
      );

    }finally{
      setSubmitBusy(
        false
      );
    }
  }

  /* =========================================================
     INIT
  ========================================================= */

  async function init(){
    try{
      hideNotice();

      if(!els.submitBtn){
        throw new Error(
          "Internal registry submit button (#submitBtn) was not found."
        );
      }

      const allowed =
        await bootstrapPage();

      if(!allowed){
        return;
      }

      els.submitBtn.addEventListener(
        "click",
        handleSubmit
      );

    }catch(err){
      console.error(
        "Internal registry init error:",
        err
      );

      renderBlockedScreen(
        "Internal registry error",
        err?.message ||
        "Failed to initialize internal project registry."
      );
    }
  }

  if(
    document.readyState ===
    "loading"
  ){
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  }else{
    init();
  }

})();
