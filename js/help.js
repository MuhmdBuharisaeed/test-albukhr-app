/* ==========================================
   ALBUKHR HELP CENTER
   Part 1 — Core
========================================== */

"use strict";

/* ==========================================
   DOM
========================================== */

const searchInput =
document.getElementById("helpSearch");

const faqCards =
document.querySelectorAll(".faq-card");

const categoryButtons =
document.querySelectorAll(".help-category");

/* ==========================================
   PAGE INIT
========================================== */

document.addEventListener(
    "DOMContentLoaded",
    initHelpPage
);

function initHelpPage(){

    initializeCategories();

    initializeFaq();

}

/* ==========================================
   CATEGORY BUTTONS
========================================== */

function initializeCategories(){

    categoryButtons.forEach(button=>{

        button.addEventListener(
            "click",
            ()=>{

                categoryButtons.forEach(btn=>{

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

function initializeFaq(){

    faqCards.forEach(card=>{

        const header =
        card.querySelector(".faq-header");

        if(!header) return;

        header.addEventListener(
            "click",
            ()=>{

                card.classList.toggle("open");

            }
        );

    });

}

/* ==========================================
   ALBUKHR HELP CENTER
   Part 2 — Search
========================================== */

/* ==========================================
   SEARCH
========================================== */

if(searchInput){

    searchInput.addEventListener(

        "input",

        searchHelp

    );

}

function searchHelp(){

    const keyword =

    searchInput.value

    .trim()

    .toLowerCase();

    let visible = 0;

    faqCards.forEach(card=>{

        const text =

        card.innerText.toLowerCase();

        if(

            text.includes(keyword)

        ){

            card.style.display="block";

            visible++;

        }else{

            card.style.display="none";

        }

    });

    toggleEmptyMessage(

        visible===0

    );

}

/* ==========================================
   EMPTY RESULT
========================================== */

function toggleEmptyMessage(show){

    let empty =

    document.getElementById(

        "helpEmpty"

    );

    if(!empty){

        empty =

        document.createElement("div");

        empty.id="helpEmpty";

        empty.className=

        "help-empty";

        empty.innerHTML=`

            <i class="fa-solid fa-circle-question"></i>

            <h3>

                No Results Found

            </h3>

            <p>

                Try another keyword.

            </p>

        `;

        const container =

        document.querySelector(

            ".faq-section"

        );

        if(container){

            container.appendChild(

                empty

            );

        }

    }

    empty.style.display=

    show ? "block":"none";

}

/* ==========================================
   CLEAR SEARCH
========================================== */

function clearSearch(){

    if(!searchInput) return;

    searchInput.value="";

    searchHelp();

}

/* ==========================================
   ALBUKHR HELP CENTER
   Part 3 — Final
========================================== */

/* ==========================================
   COMING SOON
========================================== */

function comingSoon(feature){

    if(typeof openAppAlert==="function"){

        openAppAlert(

            "Coming Soon",

            feature +
            " will be available in a future update."

        );

    }else{

        alert(

            feature +
            " will be available in a future update."

        );

    }

}

/* ==========================================
   CONTACT SUPPORT
========================================== */

function contactSupport(){

    comingSoon("Support Center");

}

function submitTicket(){

    comingSoon("Support Ticket");

}

function startLiveChat(){

    comingSoon("Live Chat");

}

/* ==========================================
   COPY SUPPORT EMAIL
========================================== */

function copySupportEmail(){

    const email =

    "support@albukhr.com";

    navigator.clipboard

    .writeText(email)

    .then(()=>{

        if(typeof openAppAlert==="function"){

            openAppAlert(

                "Copied",

                "Support email copied."

            );

        }

    });

}

/* ==========================================
   OPEN WEBSITE
========================================== */

function openWebsite(){

    window.open(

        "https://albukhr.com",

        "_blank"

    );

}

/* ==========================================
   EXPAND ALL FAQ
========================================== */

function expandAllFaq(){

    faqCards.forEach(card=>{

        card.classList.add("open");

    });

}

/* ==========================================
   COLLAPSE ALL FAQ
========================================== */

function collapseAllFaq(){

    faqCards.forEach(card=>{

        card.classList.remove("open");

    });

}

/* ==========================================
   SCROLL TO TOP
========================================== */

function scrollTopHelp(){

    window.scrollTo({

        top:0,

        behavior:"smooth"

    });

}

/* ==========================================
   PAGE READY
========================================== */

window.addEventListener(

    "load",

    ()=>{

        console.log(

            "ALBUKHR Help Center Ready."

        );

    }

);

/* ==========================================
   END OF FILE
========================================== */
