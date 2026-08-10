/* ==========================================
   ALBUKHR ADMIN DASHBOARD REFRESH
   Version 1.0
========================================== */

(function(window){

"use strict";

const Config =
window.AdminDashboardConfig;

let timer = null;

/* ==========================================
   START
========================================== */

function start(){

    stop();

    timer = setInterval(

        refresh,

        Config.REFRESH.INTERVAL

    );

}

/* ==========================================
   STOP
========================================== */

function stop(){

    if(timer){

        clearInterval(

            timer

        );

        timer = null;

    }

}

/* ==========================================
   RESTART
========================================== */

function restart(){

    stop();

    start();

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

        if(

            window.AdminDashboardAlerts &&

            typeof window.AdminDashboardAlerts.refresh ===

            "function"

        ){

            await window.AdminDashboardAlerts.refresh();

        }

        if(

            window.AdminDashboardWidgets &&

            typeof window.AdminDashboardWidgets.refresh ===

            "function"

        ){

            await window.AdminDashboardWidgets.refresh();

        }

    }catch(error){

        console.error(

            "[Dashboard Refresh]",

            error

        );

    }

}

/* ==========================================
   EXPORT
========================================== */

window.AdminDashboardRefresh = {

    start,

    stop,

    restart,

    refresh

};

})(window);
