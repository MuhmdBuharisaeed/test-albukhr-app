/* ==========================================
   ALBUKHR AUTH CONFIG
   Version 4.0
========================================== */

(function(window){

"use strict";

/* ==========================================
   CONFIG
========================================== */

const CONFIG = {

    url:

    "https://qexmnghilahsvethlxem.supabase.co",

    anonKey:

    "sb_publishable_mSbWlhVKdmSjasKJC50QYw_5wzgRMe2",

    auth:{

        persistSession:true,

        autoRefreshToken:true,

        detectSessionInUrl:false

    }

};

/* ==========================================
   EXPORT
========================================== */

Object.freeze(CONFIG);

window.ALBUKHR_AUTH_CONFIG = CONFIG;

console.log(

    "✅ Auth Config Ready"

);

})(window);
