/* ==========================================
   ALBUKHR ADMIN CORE
   Version 3.0
========================================== */

(function(window){

"use strict";

/* ==========================================
   START
========================================== */

window.addEventListener(

    "load",

    async ()=>{

        try{

            if(

                typeof initializeAdmin !==

                "function"

            ){

                throw new Error(

                    "initializeAdmin() not found."

                );

            }

            const ready =

            await initializeAdmin();

            if(!ready){

                return;

            }

            if(

                !window.Admin ||

                !window.Admin.ready

            ){

                return;

            }

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
