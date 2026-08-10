/* ==========================================
   ALBUKHR ADMIN DASHBOARD WIDGETS
   Version 1.0
========================================== */

(function(window){

"use strict";

/* ==========================================
   INIT
========================================== */

async function init(admin){

    try{

        if(

            window.AdminDashboardHeader &&

            typeof window.AdminDashboardHeader.init ===

            "function"

        ){

            window.AdminDashboardHeader.init(

                admin

            );

        }

        if(

            window.AdminDashboardNavigation &&

            typeof window.AdminDashboardNavigation

            .updateRoleButtons ===

            "function"

        ){

            window.AdminDashboardNavigation

            .updateRoleButtons(

                admin

            );

        }

        if(

            window.AdminDashboardBadges &&

            typeof window.AdminDashboardBadges.init ===

            "function"

        ){

            await window.AdminDashboardBadges.init();

        }

    }catch(error){

        console.error(

            "[Dashboard Widgets]",

            error

        );

    }

}

/* ==========================================
   REFRESH
========================================== */

async function refresh(){

    try{

        if(

            window.AdminDashboardBadges &&

            typeof window.AdminDashboardBadges.refresh ===

            "function"

        ){

            await window.AdminDashboardBadges.refresh();

        }

    }catch(error){

        console.error(

            "[Dashboard Widgets]",

            error

        );

    }

}

/* ==========================================
   EXPORT
========================================== */

window.AdminDashboardWidgets = {

    init,

    refresh

};

})(window);
