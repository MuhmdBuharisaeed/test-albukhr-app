/* =========================================================
   ALBUKHR CONTRIBUTOR ONBOARDING FINAL
   SUPABASE VERSION
========================================================= */

const els = {
  welcomeBanner: document.getElementById("welcomeBanner"),
  introCard: document.getElementById("introCard"),
  formArea: document.getElementById("formArea"),

  fullName: document.getElementById("fullName"),
  phone: document.getElementById("phone"),
  email: document.getElementById("email"),
  address: document.getElementById("address"),
  country: document.getElementById("country"),
  skills: document.getElementById("skills"),
  experience: document.getElementById("experience"),
  contribution: document.getElementById("contribution"),
  photo: document.getElementById("photo"),
  photoPreview: document.getElementById("photoPreview"),
  agree: document.getElementById("agree"),

  submitBtn: document.getElementById("submitBtn"),
  submitNotice: document.getElementById("submitNotice"),

  pendingNotice: document.getElementById("pendingNotice"),
  rejectedNotice: document.getElementById("rejectedNotice"),

  idBox: document.getElementById("idBox"),
  telegramBox: document.getElementById("telegramBox"),
  internalBox: document.getElementById("internalBox"),
  projectBox: document.getElementById("projectBox"),
  projectDashboardBox: document.getElementById("projectDashboardBox"),
  internalLink: document.getElementById("internalLink")
};

const contributorPageState = {
  inviteReady: false,
  inviteToken: "",
  currentContributor: null
};

/* =========================================================
   HELPERS
========================================================= */
function safeText(v, fallback=""){
  if(v === null || v === undefined) return fallback;
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

function normalizeEmail(value){
  return safeText(value).trim().toLowerCase();
}

function showNotice(message, type="info"){
  els.submitNotice.className = "notice " + type;
  els.submitNotice.innerHTML = message;
  els.submitNotice.classList.remove("hidden");
}

function hideNotice(){
  els.submitNotice.classList.add("hidden");
  els.submitNotice.innerHTML = "";
}

function setSubmitBusy(busy, text="Submitting..."){
  if(busy){
    if(!els.submitBtn.dataset.originalText){
      els.submitBtn.dataset.originalText = els.submitBtn.textContent;
    }
    els.submitBtn.disabled = true;
    els.submitBtn.textContent = text;
  }else{
    els.submitBtn.disabled = false;
    els.submitBtn.textContent = els.submitBtn.dataset.originalText || "Submit for Review";
  }
}

function hideAllAccessBoxes(){
  els.pendingNotice.classList.add("hidden");
  els.rejectedNotice.classList.add("hidden");
  els.idBox.classList.add("hidden");
  els.telegramBox.classList.add("hidden");
  els.internalBox.classList.add("hidden");
  els.projectBox.classList.add("hidden");
  els.projectDashboardBox.classList.add("hidden");
}

function copyAlbukhrId(id){
  if(!id) return;
  navigator.clipboard.writeText(id);
  alert("Albukhr ID copied");
}

function fillFormFromContributor(contributor){
  if(!contributor) return;

  if(contributor.full_name) els.fullName.value = contributor.full_name;
  if(contributor.phone) els.phone.value = contributor.phone;
  if(contributor.email) els.email.value = contributor.email;
  if(contributor.address) els.address.value = contributor.address;
  if(contributor.country) els.country.value = contributor.country;
  if(contributor.skills) els.skills.value = contributor.skills;
  if(contributor.experience) els.experience.value = contributor.experience;
  if(contributor.contribution) els.contribution.value = contributor.contribution;
}

function disableFormForLockedState(){
  const fields = [
    els.fullName, els.phone, els.email, els.address, els.country,
    els.skills, els.experience, els.contribution, els.photo, els.agree
  ];

  fields.forEach(el => {
    if(el) el.disabled = true;
  });

  els.submitBtn.disabled = true;
}

function enableForm(){
  const fields = [
    els.fullName, els.phone, els.email, els.address, els.country,
    els.skills, els.experience, els.contribution, els.photo, els.agree
  ];

  fields.forEach(el => {
    if(el) el.disabled = false;
  });

  els.submitBtn.disabled = false;
}

function renderApprovedState(access){
  hideAllAccessBoxes();

  const contributor = access?.contributor || {};
  const albukhrId = access?.albukhr_id || contributor?.albukhr_id || "";

  if(albukhrId){
    els.idBox.classList.remove("hidden");
    els.idBox.innerHTML = `
      🆔 Your Albukhr ID<br>
      <span class="id-value">${escapeHtml(albukhrId)}</span>
      <button class="inline-btn" onclick="copyAlbukhrId('${String(albukhrId).replace(/'/g, "\\'")}')">Copy</button>
    `;
  }

  if(access?.has_telegram_access || access?.telegram_unlocked){
    els.telegramBox.classList.remove("hidden");
  }

  if(access?.has_internal_access || access?.internal_unlocked){
    els.internalBox.classList.remove("hidden");
  }

  if(access?.has_project_builder_access || access?.project_creation_unlocked){
    els.projectBox.classList.remove("hidden");
  }

  const dashboardUnlockedKey =
    "albukhr_project_dashboard_unlocked_" + normalizeEmail(contributor?.email || "");
  if(localStorage.getItem(dashboardUnlockedKey)){
    els.projectDashboardBox.classList.remove("hidden");
  }

  disableFormForLockedState();
  hideNotice();
}

function renderPendingState(contributor){
  hideAllAccessBoxes();
  fillFormFromContributor(contributor || {});
  els.pendingNotice.classList.remove("hidden");
  disableFormForLockedState();
  hideNotice();
}

function renderRejectedState(contributor){
  hideAllAccessBoxes();
  fillFormFromContributor(contributor || {});
  els.rejectedNotice.classList.remove("hidden");
  enableForm();
  hideNotice();
}

function renderFreshFormState(){
  hideAllAccessBoxes();
  enableForm();
}

async function openInternalRegistry(){
  try{
    const email = normalizeEmail(els.email.value || contributorPageState.currentContributor?.email || "");
    if(!email){
      alert("Contributor email not found.");
      return;
    }

    if(
      !window.AlbukhrContributorEngine ||
      typeof window.AlbukhrContributorEngine.prepareInternalRegistryAccess !== "function"
    ){
      throw new Error("AlbukhrContributorEngine.prepareInternalRegistryAccess() not found.");
    }

    const result = await window.AlbukhrContributorEngine.prepareInternalRegistryAccess(email);

    if(!result?.allowed){
      alert("Internal access is not available for this contributor yet.");
      return;
    }

    window.location.href = "internal-registry-form.html";

  }catch(err){
    console.error("Internal registry access error:", err);
    alert(err?.message || "Unable to open internal registry.");
  }
}

/* =========================================================
   PHOTO PREVIEW
========================================================= */
function bindPhotoPreview(){
  els.photo.addEventListener("change", function(){
    const file = els.photo.files?.[0];
    if(!file){
      els.photoPreview.src = "";
      els.photoPreview.style.display = "none";
      return;
    }

    const reader = new FileReader();
    reader.onload = function(e){
      els.photoPreview.src = e.target.result;
      els.photoPreview.style.display = "block";
    };
    reader.readAsDataURL(file);
  });
}

/* =========================================================
   INVITE GUARD
========================================================= */
async function initInviteGuard(){
  if(
    !window.AlbukhrContributorEngine ||
    typeof window.AlbukhrContributorEngine.ensureInviteSessionFromUrl !== "function"
  ){
    throw new Error("AlbukhrContributorEngine.ensureInviteSessionFromUrl() not found.");
  }

  const result = await window.AlbukhrContributorEngine.ensureInviteSessionFromUrl();

  if(!result?.valid){
    const reason = result?.reason || "Access Restricted";
    let message = "Access Restricted";

    if(reason === "invite_expired"){
      message = "Invite expired";
    }else if(reason === "invite_used"){
      message = "Invite already used";
    }else if(reason === "invite_revoked"){
      message = "Invite revoked";
    }else if(reason === "missing_invite"){
      message = "Invite required";
    }

    if(typeof window.AlbukhrContributorEngine.renderInviteBlockedScreen === "function"){
      window.AlbukhrContributorEngine.renderInviteBlockedScreen(message);
      return false;
    }

    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;padding:24px;box-sizing:border-box;text-align:center;background:#f4f7f6">
        <div style="max-width:420px;background:#fff;padding:24px;border-radius:18px;box-shadow:0 10px 30px rgba(0,0,0,0.08)">
          <div style="font-size:46px;margin-bottom:10px">⛔</div>
          <h2 style="margin:0 0 12px;color:#b02a37;font-family:system-ui">${escapeHtml(message)}</h2>
          <p style="margin:0;color:#55625c;line-height:1.7;font-family:system-ui">
            This contributor page is invite-only. Please use a valid ALBUKHR invite link.
          </p>
        </div>
      </div>
    `;
    return false;
  }

  contributorPageState.inviteReady = true;
  contributorPageState.inviteToken = result.token || result.session?.token || "";

  return true;
}

/* =========================================================
   STATUS CHECK
========================================================= */
async function checkContributorStatus(){
  try{
    const email =
      normalizeEmail(els.email.value) ||
      normalizeEmail(
        window.AlbukhrContributorEngine?.getContributorSessionEmail?.() || ""
      );

    if(!email){
      renderFreshFormState();
      return;
    }

    if(
      !window.AlbukhrContributorEngine ||
      typeof window.AlbukhrContributorEngine.getContributorAccess !== "function"
    ){
      throw new Error("AlbukhrContributorEngine.getContributorAccess() not found.");
    }

    const access = await window.AlbukhrContributorEngine.getContributorAccess(email);
    const contributor = access?.contributor || null;

    if(!contributor){
      renderFreshFormState();
      return;
    }

    contributorPageState.currentContributor = contributor;
    fillFormFromContributor(contributor);

    if(contributor.status === "pending"){
      renderPendingState(contributor);
      return;
    }

    if(contributor.status === "approved"){
      renderApprovedState(access);
      return;
    }

    if(contributor.status === "rejected"){
      renderRejectedState(contributor);
      return;
    }

    renderFreshFormState();

  }catch(err){
    console.error("Contributor status check error:", err);
  }
}

/* =========================================================
   SUBMIT
========================================================= */
async function submitContributorForm(){
  try{
    hideNotice();

    if(!contributorPageState.inviteReady){
      throw new Error("Valid invite session not found.");
    }

    const fullName = safeText(els.fullName.value).trim();
    const phone = safeText(els.phone.value).trim();
    const email = normalizeEmail(els.email.value);
    const address = safeText(els.address.value).trim();
    const country = safeText(els.country.value).trim();
    const skills = safeText(els.skills.value).trim();
    const experience = safeText(els.experience.value).trim();
    const contribution = safeText(els.contribution.value).trim();
    const photoFile = els.photo.files?.[0] || null;

    if(!fullName || !phone || !email || !address || !skills || !contribution){
      throw new Error("Please complete all required contributor fields.");
    }

    if(!els.agree.checked){
      throw new Error("You must confirm the contributor policy agreement before submitting.");
    }

    setSubmitBusy(true, "Submitting...");

    if(
      !window.AlbukhrContributorEngine ||
      typeof window.AlbukhrContributorEngine.submitContributorApplication !== "function"
    ){
      throw new Error("AlbukhrContributorEngine.submitContributorApplication() not found.");
    }

    const result = await window.AlbukhrContributorEngine.submitContributorApplication({
      fullName,
      phone,
      email,
      address,
      country,
      skills,
      experience,
      contribution,
      photoFile,
      inviteToken: contributorPageState.inviteToken
    });

    if(!result?.ok){
      throw new Error("Contributor submission failed.");
    }

    contributorPageState.currentContributor = result.contributor || null;

    showNotice(
      "Contributor application submitted successfully. Your application is now under review by Albukhr admin.",
      "success"
    );

    await checkContributorStatus();

  }catch(err){
    console.error("Contributor submit error:", err);
    showNotice(err?.message || "Unable to submit contributor application.", "error");
  }finally{
    setSubmitBusy(false);
  }
}

/* =========================================================
   EVENT BINDING
========================================================= */
function bindEvents(){
  els.submitBtn.addEventListener("click", submitContributorForm);

  els.email.addEventListener("blur", checkContributorStatus);

  els.internalLink.addEventListener("click", async function(e){
    e.preventDefault();
    await openInternalRegistry();
  });
}

/* expose copy helper */
window.copyAlbukhrId = copyAlbukhrId;

/* =========================================================
   INIT
========================================================= */
document.addEventListener("DOMContentLoaded", async function(){
  try{
    if(!window.AlbukhrContributorEngine){
      throw new Error("js/contributor-engine.js failed to load.");
    }

    bindPhotoPreview();
    bindEvents();

    const ok = await initInviteGuard();
    if(!ok) return;

    await checkContributorStatus();

  }catch(err){
    console.error("Contributor page init error:", err);
    alert(err?.message || "Failed to initialize contributor onboarding page.");
  }
});
