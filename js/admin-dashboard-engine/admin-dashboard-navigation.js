/* ==========================================
   ALBUKHR ADMIN DASHBOARD NAVIGATION
   Version 1.0
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
   BUTTONS
========================================== */

function bindButtons(){

    document

    .querySelectorAll(

        ".admin-btn[data-page]"

    )

    .forEach(button=>{

        button.addEventListener(

            "click",

            ()=>{

                navigate(

                    button.dataset.page

                );

            }

        );

    });

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

            if(

                typeof adminLogout ===

                "function"

            ){

                await adminLogout();

            }

        }

    );

}

/* ==========================================
   NAVIGATE
========================================== */

function navigate(page){

    if(

        !window.Admin ||

        !window.Admin.ready

    ){

        location.replace(

            Config.PAGES.LOGIN

        );

        return;

    }

    location.href = page;

}

/* ==========================================
   SUPER ADMIN
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
   SHOW BUTTON
========================================== */

function show(id){

    Utils.show(id);

}

/* ==========================================
   HIDE BUTTON
========================================== */

function hide(id){

    Utils.hide(id);

}

/* ==========================================
   EXPORT
========================================== */

window.AdminDashboardNavigation = {

    init,

    navigate,

    updateRoleButtons,

    show,

    hide

};

})(window);
