/* ==========================================
   ALBUKHR ADMIN DASHBOARD ENGINE
   Version 2.0
========================================== */

(function(window){

"use strict";

/* ==========================================
   ADMIN READY
========================================== */

document.addEventListener(

    "admin-ready",

    async(event)=>{

        try{

            const admin =

            event.detail.user;

            await initializeDashboard(

                admin

            );

        }catch(error){

            console.error(

                "[Dashboard Engine]",

                error

            );

        }

    }

);

/* ==========================================
   INITIALIZE
========================================== */

async function initializeDashboard(

    admin

){

    try{

        /* Header */

        if(

            window.AdminDashboardHeader &&

            typeof window.AdminDashboardHeader.init ===

            "function"

        ){

            window.AdminDashboardHeader.init(

                admin

            );

        }

        /* Navigation */

        if(

            window.AdminDashboardNavigation &&

            typeof window.AdminDashboardNavigation.init ===

            "function"

        ){

            window.AdminDashboardNavigation.init();

        }

        /* Widgets */

        if(

            window.AdminDashboardWidgets &&

            typeof window.AdminDashboardWidgets.init ===

            "function"

        ){

            await window.AdminDashboardWidgets.init(

                admin

            );

        }

        /* Alerts */

        if(

            window.AdminDashboardAlerts &&

            typeof window.AdminDashboardAlerts.init ===

            "function"

        ){

            await window.AdminDashboardAlerts.init();

        }

        /* Refresh */

        if(

            window.AdminDashboardRefresh &&

            typeof window.AdminDashboardRefresh.start ===

            "function"

        ){

            window.AdminDashboardRefresh.start();

        }

        console.log(

            "✅ Dashboard Ready"

        );

    }catch(error){

        console.error(

            "[Dashboard Engine]",

            error

        );

    }

}

/* ==========================================
   DESTROY
========================================== */

function destroyDashboard(){

    if(

        window.AdminDashboardRefresh &&

        typeof window.AdminDashboardRefresh.stop ===

        "function"

    ){

        window.AdminDashboardRefresh.stop();

    }

}

/* ==========================================
   EXPORT
========================================== */

window.AdminDashboardEngine = {

    initialize:

    initializeDashboard,

    destroy:

    destroyDashboard

};

})(window);
