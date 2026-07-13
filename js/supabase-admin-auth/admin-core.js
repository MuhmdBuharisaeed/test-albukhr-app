/* ==========================================
   ALBUKHR ADMIN CORE
   Version 2.0
========================================== */

(function(window){

"use strict";

/* ==========================================
   START
========================================== */

document.addEventListener(

    "DOMContentLoaded",

    async ()=>{

        try{

            if(typeof initializeAdmin !== "function"){

                throw new Error(
                    "initializeAdmin() not found."
                );

            }

            await initializeAdmin();

            console.log(
                "✅ ALBUKHR Admin Core Ready"
            );

        }catch(error){

            console.error(
                "[ADMIN CORE]",
                error
            );

        }

    }

);

})(window);
