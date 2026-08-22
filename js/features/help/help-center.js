/* ==========================================
   ALBUKHR HELP CENTER ENGINE v2
   Feature: Help Center
   Architecture: Feature/UI Layer

   PURPOSE:
   - FAQ category interaction
   - FAQ search
   - Empty search state
   - Support action placeholders
   - Support email copy
   - Website navigation
   - FAQ expand/collapse controls

   IMPORTANT:
   - No Supabase client
   - No LocalStorage
   - No network/environment state
   - Does not modify other engines
   - Uses existing ALBUKHR UI APIs when available
========================================== */

(() => {

    "use strict";

    /* ==========================================
       DOM REFERENCES
    ========================================== */

    let searchInput = null;
    let faqCards = [];
    let categoryButtons = [];

    /* ==========================================
       DOM CACHE
    ========================================== */

    function cacheHelpDom() {

        searchInput =
            document.getElementById("helpSearch");

        faqCards =
            Array.from(
                document.querySelectorAll(".faq-card")
            );

        categoryButtons =
            Array.from(
                document.querySelectorAll(".help-category")
            );

    }

    /* ==========================================
       PAGE INIT
    ========================================== */

    function initHelpPage() {

        cacheHelpDom();

        initializeCategories();
        initializeFaq();
        initializeSearch();

    }

    /* ==========================================
       CATEGORY BUTTONS
    ========================================== */

    function initializeCategories() {

        categoryButtons.forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    categoryButtons.forEach(btn => {

                        btn.classList.remove("active");

                    });

                    button.classList.add("active");

                }
            );

        });

    }

    /* ==========================================
       FAQ COLLAPSE
    ========================================== */

    function initializeFaq() {

        faqCards.forEach(card => {

            const header =
                card.querySelector(".faq-header");

            if (!header) return;

            header.addEventListener(
                "click",
                () => {

                    card.classList.toggle("open");

                }
            );

        });

    }

    /* ==========================================
       SEARCH INIT
    ========================================== */

    function initializeSearch() {

        if (!searchInput) return;

        searchInput.addEventListener(
            "input",
            searchHelp
        );

    }

    /* ==========================================
       SEARCH
    ========================================== */

    function searchHelp() {

        if (!searchInput) return;

        const keyword =
            String(searchInput.value || "")
                .trim()
                .toLowerCase();

        let visible = 0;

        faqCards.forEach(card => {

            const text =
                String(card.innerText || "")
                    .toLowerCase();

            const match =
                !keyword ||
                text.includes(keyword);

            card.style.display =
                match ? "block" : "none";

            if (match) {
                visible++;
            }

        });

        toggleEmptyMessage(
            visible === 0
        );

    }

    /* ==========================================
       EMPTY RESULT
    ========================================== */

    function toggleEmptyMessage(show) {

        let empty =
            document.getElementById(
                "helpEmpty"
            );

        if (!empty) {

            empty =
                document.createElement("div");

            empty.id = "helpEmpty";

            empty.className =
                "help-empty";

            empty.innerHTML = `
                <i class="fa-solid fa-circle-question"></i>
                <h3>No Results Found</h3>
                <p>Try another keyword.</p>
            `;

            const container =
                document.querySelector(
                    ".faq-section"
                );

            if (container) {

                container.appendChild(empty);

            } else {

                return;

            }

        }

        empty.style.display =
            show ? "block" : "none";

    }

    /* ==========================================
       CLEAR SEARCH
    ========================================== */

    function clearSearch() {

        if (!searchInput) return;

        searchInput.value = "";

        searchHelp();

    }

    /* ==========================================
       COMING SOON
    ========================================== */

    function comingSoon(feature) {

        const message =
            String(feature || "This feature") +
            " will be available in a future update.";

        if (
            typeof window.openAppAlert ===
            "function"
        ) {

            window.openAppAlert(
                "Coming Soon",
                message
            );

            return;

        }

        window.alert(message);

    }

    /* ==========================================
       CONTACT SUPPORT
    ========================================== */

    function contactSupport() {

        comingSoon("Support Center");

    }

    function submitTicket() {

        comingSoon("Support Ticket");

    }

    function startLiveChat() {

        comingSoon("Live Chat");

    }

    /* ==========================================
       COPY SUPPORT EMAIL
    ========================================== */

    async function copySupportEmail() {

        const email =
            "support@albukhr.com";

        try {

            if (
                navigator.clipboard &&
                typeof navigator.clipboard.writeText ===
                "function"
            ) {

                await navigator.clipboard.writeText(email);

            } else {

                const textarea =
                    document.createElement("textarea");

                textarea.value = email;
                textarea.setAttribute(
                    "readonly",
                    ""
                );

                textarea.style.position = "fixed";
                textarea.style.opacity = "0";

                document.body.appendChild(textarea);

                textarea.select();

                document.execCommand("copy");

                textarea.remove();

            }

            if (
                typeof window.openAppAlert ===
                "function"
            ) {

                window.openAppAlert(
                    "Copied",
                    "Support email copied."
                );

            }

        } catch (error) {

            console.warn(
                "ALBUKHR Help Center: copy email failed.",
                error
            );

        }

    }

    /* ==========================================
       OPEN WEBSITE
    ========================================== */

    function openWebsite() {

        window.open(
            "https://albukhr.com",
            "_blank",
            "noopener,noreferrer"
        );

    }

    /* ==========================================
       EXPAND ALL FAQ
    ========================================== */

    function expandAllFaq() {

        faqCards.forEach(card => {

            card.classList.add("open");

        });

    }

    /* ==========================================
       COLLAPSE ALL FAQ
    ========================================== */

    function collapseAllFaq() {

        faqCards.forEach(card => {

            card.classList.remove("open");

        });

    }

    /* ==========================================
       SCROLL TO TOP
    ========================================== */

    function scrollTopHelp() {

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    }

    /* ==========================================
       GLOBAL PAGE ACTIONS
       Preserves existing inline HTML compatibility.
    ========================================== */

    window.clearSearch =
        clearSearch;

    window.comingSoon =
        comingSoon;

    window.contactSupport =
        contactSupport;

    window.submitTicket =
        submitTicket;

    window.startLiveChat =
        startLiveChat;

    window.copySupportEmail =
        copySupportEmail;

    window.openWebsite =
        openWebsite;

    window.expandAllFaq =
        expandAllFaq;

    window.collapseAllFaq =
        collapseAllFaq;

    window.scrollTopHelp =
        scrollTopHelp;

    /* ==========================================
       PAGE READY
    ========================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initHelpPage,
            { once: true }
        );

    } else {

        initHelpPage();

    }

    window.addEventListener(
        "load",
        () => {

            console.log(
                "ALBUKHR Help Center Ready."
            );

        },
        { once: true }
    );

})();
