/* ==========================================
   ALBUKHR ADMIN DASHBOARD NAVIGATION
   Version 2.0
========================================== */

(function(window){

"use strict";

const Config = window.AdminDashboardConfig;
const Utils  = window.AdminDashboardUtils;

/* ==========================================
   INIT
========================================== */

function init(){

    bindButtons();

    bindLogout();

}

/* ==========================================
   BIND DASHBOARD BUTTONS
========================================== */

function bindButtons(){

    const buttons = document.querySelectorAll(

        ".admin-btn[data-page]"

    );

    buttons.forEach(button=>{

        button.addEventListener(

            "click",

            ()=>{

                const page =

                button.dataset.page;

                navigate(page);

            }

        );

    });

}

/* ==========================================
   NAVIGATE
========================================== */

function navigate(page){

    if(!page){

        console.warn(

            "[NAVIGATION] Page not defined."

        );

        return;

    }

    window.location.href = page;

}

/* ==========================================
   LOGOUT
========================================== */

function bindLogout(){

    const btn =

    Utils.get(

        Config.BUTTONS.LOGOUT

    );

    if(!btn){

        return;

    }

    btn.addEventListener(

        "click",

        async ()=>{

            try{

                if(

                    typeof adminLogout ===

                    "function"

                ){

                    await adminLogout();

                }

                else{

                    window.location.href =

                    Config.PAGES.LOGIN;

                }

            }

            catch(error){

                console.error(

                    "[LOGOUT]",

                    error

                );

            }

        }

    );

}

/* ==========================================
   ROLE BUTTONS
========================================== */

function updateRoleButtons(admin){

    const superBtn =

    Utils.get(

        Config.BUTTONS.SUPER_ADMIN

    );

    if(!superBtn){

        return;

    }

    if(

        admin &&

        admin.role_code ===

        "super_admin"

    ){

        superBtn.style.display = "";

    }

    else{

        superBtn.style.display = "none";

    }

}

/* ==========================================
   BUTTON VISIBILITY
========================================== */

function show(id){

    Utils.show(id);

}

function hide(id){

    Utils.hide(id);

}

/* ==========================================
   EXPORT
========================================== */

window.AdminDashboardNavigation = {

    init,

    bindButtons,

    bindLogout,

    navigate,

    updateRoleButtons,

    show,

    hide

};

document.addEventListener(

    "DOMContentLoaded",

    init

);

})(window);
