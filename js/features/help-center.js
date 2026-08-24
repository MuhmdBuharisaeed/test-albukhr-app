/* ALBUKHR HELP CENTER ENGINE v3
   File: js/features/help-center.js
   Feature/UI layer
   - No LocalStorage
   - No Supabase
   - No auth/network implementation
   - No Dock Navigation changes
   - Preserves existing inline HTML APIs
*/

(() => {
"use strict";

let searchInput = null;
let faqCards = [];
let categoryButtons = [];
let initialized = false;

function cacheDom() {
  searchInput = document.getElementById("helpSearch");
  faqCards = Array.from(document.querySelectorAll(".faq-card"));
  categoryButtons = Array.from(document.querySelectorAll(".help-category"));
}

function alertApp(title, message) {
  if (typeof window.openAppAlert === "function") {
    window.openAppAlert(title, message);
    return true;
  }
  return false;
}

function toggleEmpty(show) {
  let empty = document.getElementById("helpEmpty");

  if (!empty) {
    empty = document.createElement("div");
    empty.id = "helpEmpty";
    empty.className = "help-empty";
    empty.innerHTML = `
      <i class="fa-solid fa-circle-question"></i>
      <h3>No Results Found</h3>
      <p>Try another keyword.</p>
    `;

    const container = document.querySelector(".faq-section");
    if (!container) return false;
    container.appendChild(empty);
  }

  empty.style.display = show ? "" : "none";
  return true;
}

function searchHelp() {
  if (!searchInput) return 0;

  const keyword = String(searchInput.value || "").trim().toLowerCase();
  let visible = 0;

  faqCards.forEach(card => {
    const text = String(card.innerText || "").toLowerCase();
    const match = !keyword || text.includes(keyword);
    card.style.display = match ? "" : "none";
    if (match) visible++;
  });

  toggleEmpty(visible === 0);
  return visible;
}

function initializeCategories() {
  categoryButtons.forEach(button => {
    if (button.dataset.helpCategoryBound === "true") return;

    button.addEventListener("click", () => {
      categoryButtons.forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      searchHelp();
    });

    button.dataset.helpCategoryBound = "true";
  });
}

function initializeFaq() {
  faqCards.forEach(card => {
    const header = card.querySelector(".faq-header");
    if (!header || header.dataset.helpFaqBound === "true") return;

    if (!header.hasAttribute("role")) header.setAttribute("role", "button");
    if (!header.hasAttribute("tabindex")) header.setAttribute("tabindex", "0");

    const sync = () => header.setAttribute(
      "aria-expanded",
      String(card.classList.contains("open"))
    );

    header.addEventListener("click", () => {
      card.classList.toggle("open");
      sync();
    });

    header.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      header.click();
    });

    sync();
    header.dataset.helpFaqBound = "true";
  });
}

function initializeSearch() {
  if (!searchInput || searchInput.dataset.helpSearchBound === "true") return;
  searchInput.addEventListener("input", searchHelp);
  searchInput.dataset.helpSearchBound = "true";
}

function clearSearch() {
  if (!searchInput) return;
  searchInput.value = "";
  searchHelp();
  try { searchInput.focus(); } catch (_) {}
}

function comingSoon(feature) {
  const name = String(feature || "This feature").trim();
  const message = `${name} will be available in a future update.`;
  if (!alertApp("Coming Soon", message)) window.alert(message);
}

function contactSupport() { comingSoon("Support Center"); }
function submitTicket() { comingSoon("Support Ticket"); }
function startLiveChat() { comingSoon("Live Chat"); }

async function copySupportEmail() {
  const email = "support@albukhr.com";

  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(email);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = email;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const copied = document.execCommand("copy");
      textarea.remove();
      if (!copied) throw new Error("Copy command failed.");
    }

    alertApp("Copied", "Support email copied.");
    return true;
  } catch (error) {
    console.warn("ALBUKHR Help Center: copy email failed.", error);
    return false;
  }
}

function openWebsite() {
  return Boolean(window.open(
    "https://albukhr.com",
    "_blank",
    "noopener,noreferrer"
  ));
}

function expandAllFaq() {
  faqCards.forEach(card => {
    card.classList.add("open");
    const header = card.querySelector(".faq-header");
    if (header) header.setAttribute("aria-expanded", "true");
  });
}

function collapseAllFaq() {
  faqCards.forEach(card => {
    card.classList.remove("open");
    const header = card.querySelector(".faq-header");
    if (header) header.setAttribute("aria-expanded", "false");
  });
}

function scrollTopHelp() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function initHelpPage() {
  if (initialized) return true;
  cacheDom();
  initializeCategories();
  initializeFaq();
  initializeSearch();
  initialized = true;
  return true;
}

window.AlbukhrHelpCenter = Object.freeze({
  init: initHelpPage,
  search: searchHelp,
  clearSearch,
  comingSoon,
  contactSupport,
  submitTicket,
  startLiveChat,
  copySupportEmail,
  openWebsite,
  expandAllFaq,
  collapseAllFaq,
  scrollTop: scrollTopHelp
});

/* Existing inline HTML compatibility */
window.clearSearch = clearSearch;
window.comingSoon = comingSoon;
window.contactSupport = contactSupport;
window.submitTicket = submitTicket;
window.startLiveChat = startLiveChat;
window.copySupportEmail = copySupportEmail;
window.openWebsite = openWebsite;
window.expandAllFaq = expandAllFaq;
window.collapseAllFaq = collapseAllFaq;
window.scrollTopHelp = scrollTopHelp;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHelpPage, { once: true });
} else {
  initHelpPage();
}

window.addEventListener("load", () => {
  console.log("ALBUKHR Help Center Ready.");
}, { once: true });

})();
