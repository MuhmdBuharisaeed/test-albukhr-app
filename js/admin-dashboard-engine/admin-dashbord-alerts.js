/* ==========================================
   ALBUKHR ADMIN DASHBOARD ALERTS
   Version 1.0
========================================== */

(function(window){

"use strict";

const Config =
window.AdminDashboardConfig;

const Utils =
window.AdminDashboardUtils;

/* ==========================================
   INIT
========================================== */

async function init(){

    await refresh();

}

/* ==========================================
   REFRESH
========================================== */

async function refresh(){

    const critical =
    await checkCriticalRisk();

    triggerCriticalAlert(

        critical

    );

}

/* ==========================================
   CHECK RISK
========================================== */

async function checkCriticalRisk(){

    try{

        if(

            window.DashboardService &&

            typeof window.DashboardService

            .hasCriticalRisk ===

            "function"

        ){

            return await

            window.DashboardService

            .hasCriticalRisk();

        }

        return false;

    }catch(error){

        console.error(

            "[Dashboard Alerts]",

            error

        );

        return false;

    }

}

/* ==========================================
   SHOW ALERT
========================================== */

function show(){

    Utils.show(

        Config.ALERTS.BANNER

    );

    Utils.play(

        Config.ALERTS.SOUND

    );

}

/* ==========================================
   HIDE ALERT
========================================== */

function hide(){

    Utils.hide(

        Config.ALERTS.BANNER

    );

    Utils.stop(

        Config.ALERTS.SOUND

    );

}

/* ==========================================
   TRIGGER
========================================== */

function triggerCriticalAlert(active){

    if(active){

        show();

    }else{

        hide();

    }

}

/* ==========================================
   EXPORT
========================================== */

window.AdminDashboardAlerts = {

    init,

    refresh,

    show,

    hide,

    checkCriticalRisk,

    triggerCriticalAlert

};

})(window);
