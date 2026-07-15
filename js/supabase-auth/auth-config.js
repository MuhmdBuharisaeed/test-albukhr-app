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
   FREEZE CONFIG
========================================== */

Object.freeze(CONFIG.auth);
Object.freeze(CONFIG);

/* ==========================================
   EXPORT
========================================== */

window.ALBUKHR_AUTH_CONFIG = CONFIG;

console.log(
    "✅ ALBUKHR Auth Config Ready"
);

})(window);
