/* ==========================================
   ALBUKHR ADMIN DASHBOARD UTILS
   Version 1.0
========================================== */

(function(window){

"use strict";

/* ==========================================
   GET ELEMENT
========================================== */

function get(id){

    return document.getElementById(id);

}

/* ==========================================
   SHOW
========================================== */

function show(id){

    const el = get(id);

    if(el){

        el.style.display = "";

    }

}

/* ==========================================
   HIDE
========================================== */

function hide(id){

    const el = get(id);

    if(el){

        el.style.display = "none";

    }

}

/* ==========================================
   SET TEXT
========================================== */

function text(id,value){

    const el = get(id);

    if(el){

        el.textContent =

        value ?? "";

    }

}

/* ==========================================
   SET HTML
========================================== */

function html(id,value){

    const el = get(id);

    if(el){

        el.innerHTML =

        value ?? "";

    }

}

/* ==========================================
   BADGE
========================================== */

function badge(id,value){

    const el = get(id);

    if(!el){

        return;

    }

    if(

        value === null ||

        value === undefined ||

        value === 0 ||

        value === ""

    ){

        el.style.display = "none";

        el.textContent = "";

        return;

    }

    el.style.display = "inline-block";

    el.textContent = value;

}

/* ==========================================
   SAFE NUMBER
========================================== */

function number(value){

    const n = Number(value);

    return Number.isFinite(n)

    ? n

    : 0;

}

/* ==========================================
   SAFE STRING
========================================== */

function string(value){

    if(

        value === null ||

        value === undefined

    ){

        return "";

    }

    return String(value);

}

/* ==========================================
   FORMAT DATE
========================================== */

function formatDate(value){

    if(!value){

        return "";

    }

    return new Date(value)

    .toLocaleString();

}

/* ==========================================
   PLAY SOUND
========================================== */

function play(id){

    const audio = get(id);

    if(audio){

        audio.play().catch(()=>{});

    }

}

/* ==========================================
   STOP SOUND
========================================== */

function stop(id){

    const audio = get(id);

    if(audio){

        audio.pause();

        audio.currentTime = 0;

    }

}

/* ==========================================
   EXPORT
========================================== */

window.AdminDashboardUtils = {

    get,

    show,

    hide,

    text,

    html,

    badge,

    number,

    string,

    formatDate,

    play,

    stop

};

})(window);
