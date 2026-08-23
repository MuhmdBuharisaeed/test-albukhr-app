/* ==========================================
   ALBUKHR ADMIN ALERTS v2

   PURPOSE:
   - Critical dashboard alerts
   - UI-only alert rendering
   - No persistence
========================================== */

(function(window){

  "use strict";

  function getElements(){

    const config =
      window.AdminDashboardConfig;

    return {
      banner:
        document.getElementById(
          config?.ALERTS?.BANNER ||
          "criticalAlert"
        ),

      sound:
        document.getElementById(
          config?.ALERTS?.SOUND ||
          "alertSound"
        )
    };
  }

  function setCriticalAlert(
    message,
    {
      visible = true,
      playSound = false
    } = {}
  ){

    const {
      banner,
      sound
    } = getElements();

    if(!banner) return;

    banner.textContent =
      String(message || "");

    banner.classList.toggle(
      "hidden",
      !visible
    );

    if(
      visible &&
      playSound &&
      sound
    ){
      try{
        sound.currentTime = 0;
        const promise = sound.play();
        if(promise?.catch){
          promise.catch(() => {});
        }
      }catch(e){
        console.warn(
          "Admin alert sound unavailable:",
          e
        );
      }
    }
  }

  function clearCriticalAlert(){
    setCriticalAlert("", {
      visible: false,
      playSound: false
    });
  }

  window.AlbukhrAdminAlerts = Object.freeze({
    setCriticalAlert,
    clearCriticalAlert
  });

})(window);
