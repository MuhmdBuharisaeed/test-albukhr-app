/* =========================================================
   ALBUKHR CONTRIBUTOR ONBOARDING FINAL
   ARCHITECTURE-READY SUPABASE VERSION
========================================================= */

"use strict";

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

function safeText(v, fallback=""){
  return v == null ? fallback : String(v);
}

function escapeHtml(value){
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeEmail(value){
  return safeText(value).trim().toLowerCase();
}

function showNotice(message, type="info"){
  if(!els.submitNotice) return;
  els.submitNotice.className = "notice " + type;
  els.submitNotice.innerHTML = message;
  els.submitNotice.classList.remove("hidden");
}

function hideNotice(){
  if(!els.submitNotice) return;
  els.submitNotice.classList.add("hidden");
  els.submitNotice.innerHTML = "";
}

function setSubmitBusy(busy, text="Submitting..."){
  if(!els.submitBtn) return;
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
  [
    els.pendingNotice, els.rejectedNotice, els.idBox,
    els.telegramBox, els.internalBox, els.projectBox,
    els.projectDashboardBox
  ].forEach(el => el?.classList.add("hidden"));
}

function copyAlbukhrId(id){
  if(!id) return;
  navigator.clipboard?.writeText(String(id))
    .then(() => alert("Albukhr ID copied"))
    .catch(() => alert("Unable to copy Albukhr ID"));
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

function setFormDisabled(disabled){
  [
    els.fullName, els.phone, els.email, els.address, els.country,
    els.skills, els.experience, els.contribution, els.photo, els.agree
  ].forEach(el => { if(el) el.disabled = disabled; });
  if(els.submitBtn) els.submitBtn.disabled = disabled;
}

function renderApprovedState(access){
  hideAllAccessBoxes();

  const contributor = access?.contributor || {};
  const albukhrId = access?.albukhr_id || contributor.albukhr_id || "";

  if(albukhrId && els.idBox){
    els.idBox.classList.remove("hidden");
    els.idBox.innerHTML = `
      🆔 Your Albukhr ID<br>
      <span class="id-value">${escapeHtml(albukhrId)}</span>
      <button class="inline-btn" type="button">Copy</button>
    `;
    els.idBox.querySelector("button")?.addEventListener("click", () => copyAlbukhrId(albukhrId));
  }

  if((access?.has_telegram_access || access?.telegram_unlocked) && els.telegramBox)
    els.telegramBox.classList.remove("hidden");

  if((access?.has_internal_access || access?.internal_unlocked) && els.internalBox)
    els.internalBox.classList.remove("hidden");

  if((access?.has_project_builder_access || access?.project_creation_unlocked) && els.projectBox)
    els.projectBox.classList.remove("hidden");

  if((access?.access?.project_dashboard_unlocked || access?.access?.has_project_dashboard_access) && els.projectDashboardBox)
    els.projectDashboardBox.classList.remove("hidden");

  setFormDisabled(true);
  hideNotice();
}

function renderPendingState(contributor){
  hideAllAccessBoxes();
  fillFormFromContributor(contributor || {});
  els.pendingNotice?.classList.remove("hidden");
  setFormDisabled(true);
  hideNotice();
}

function renderRejectedState(contributor){
  hideAllAccessBoxes();
  fillFormFromContributor(contributor || {});
  els.rejectedNotice?.classList.remove("hidden");
  setFormDisabled(false);
  hideNotice();
}

function renderFreshFormState(){
  hideAllAccessBoxes();
  setFormDisabled(false);
}

async function openInternalRegistry(){
  try{
    const email = normalizeEmail(els.email.value || contributorPageState.currentContributor?.email || "");
    if(!email) throw new Error("Contributor email not found.");

    const engine = window.AlbukhrContributorEngine;
    if(!engine?.prepareInternalRegistryAccess)
      throw new Error("Contributor access engine is not available.");

    const result = await engine.prepareInternalRegistryAccess(email);
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

function bindPhotoPreview(){
  if(!els.photo || !els.photoPreview) return;
  els.photo.addEventListener("change", function(){
    const file = els.photo.files?.[0];
    if(!file){
      els.photoPreview.removeAttribute("src");
      els.photoPreview.style.display = "none";
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      els.photoPreview.src = e.target.result;
      els.photoPreview.style.display = "block";
    };
    reader.readAsDataURL(file);
  });
}

async function initInviteGuard(){
  const engine = window.AlbukhrContributorEngine;
  if(!engine?.ensureInviteSessionFromUrl)
    throw new Error("Contributor invite engine is not available.");

  const result = await engine.ensureInviteSessionFromUrl();

  if(!result?.valid){
    const reason = result?.reason || "Access Restricted";
    const messages = {
      invite_expired:"Invite expired",
      invite_used:"Invite already used",
      invite_revoked:"Invite revoked",
      missing_invite:"Invite required"
    };
    const message = messages[reason] || "Access Restricted";

    if(typeof engine.renderInviteBlockedScreen === "function"){
      engine.renderInviteBlockedScreen(message);
    }
    return false;
  }

  contributorPageState.inviteReady = true;
  contributorPageState.inviteToken = result.token || "";
  return true;
}

async function checkContributorStatus(){
  try{
    const email = normalizeEmail(els.email.value);
    if(!email){
      renderFreshFormState();
      return;
    }

    const engine = window.AlbukhrContributorEngine;
    if(!engine?.getContributorAccess)
      throw new Error("Contributor access engine is not available.");

    const access = await engine.getContributorAccess(email);
    const contributor = access?.contributor || null;

    if(!contributor){
      renderFreshFormState();
      return;
    }

    contributorPageState.currentContributor = contributor;
    fillFormFromContributor(contributor);

    if(contributor.status === "pending") return renderPendingState(contributor);
    if(contributor.status === "approved") return renderApprovedState(access);
    if(contributor.status === "rejected") return renderRejectedState(contributor);

    renderFreshFormState();
  }catch(err){
    console.error("Contributor status check error:", err);
  }
}

async function submitContributorForm(){
  try{
    hideNotice();

    if(!contributorPageState.inviteReady)
      throw new Error("Valid invite session not found.");

    const payload = {
      fullName: safeText(els.fullName.value).trim(),
      phone: safeText(els.phone.value).trim(),
      email: normalizeEmail(els.email.value),
      address: safeText(els.address.value).trim(),
      country: safeText(els.country.value).trim(),
      skills: safeText(els.skills.value).trim(),
      experience: safeText(els.experience.value).trim(),
      contribution: safeText(els.contribution.value).trim(),
      photoFile: els.photo.files?.[0] || null,
      inviteToken: contributorPageState.inviteToken
    };

    if(!payload.fullName || !payload.phone || !payload.email || !payload.address || !payload.skills || !payload.contribution)
      throw new Error("Please complete all required contributor fields.");

    if(!els.agree.checked)
      throw new Error("You must confirm the contributor policy agreement before submitting.");

    setSubmitBusy(true);

    const engine = window.AlbukhrContributorEngine;
    if(!engine?.submitContributorApplication)
      throw new Error("Contributor submission engine is not available.");

    const result = await engine.submitContributorApplication(payload);
    if(!result?.ok) throw new Error("Contributor submission failed.");

    contributorPageState.currentContributor = result.contributor || null;

    showNotice(
      "Contributor application submitted successfully. Your application is now under review by ALBUKHR admin.",
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

function bindEvents(){
  els.submitBtn?.addEventListener("click", submitContributorForm);
  els.email?.addEventListener("blur", checkContributorStatus);
  els.internalLink?.addEventListener("click", async e => {
    e.preventDefault();
    await openInternalRegistry();
  });
}

window.copyAlbukhrId = copyAlbukhrId;

document.addEventListener("DOMContentLoaded", async function(){
  try{
    if(!window.AlbukhrContributorEngine)
      throw new Error("js/contributors/contributor-engine.js failed to load.");

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
