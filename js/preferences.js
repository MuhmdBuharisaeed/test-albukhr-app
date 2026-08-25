/* ==========================================
   ALBUKHR PREFERENCES ENGINE
   Part 1
========================================== */

const DEFAULT_PREFERENCES = {

    theme: "green",

    accent: "green",

    language: "en",

    notifyProjects: true,

    notifyRewards: true,

    notifyTransactions: true,

    notifyMarketing: false,

    hideBalance: false,

    hideAssets: false,

    onlineStatus: true,

    biometric: true,

    twoFactor: true,

    country: "Nigeria",

    timezone: "GMT +1",

    currency: "Pi"

};

/* =========================
LOAD
========================= */

function loadPreferences(){

    const saved = JSON.parse(

        localStorage.getItem(

            "albukhr_preferences"

        ) || "{}"

    );

    const prefs = {

        ...DEFAULT_PREFERENCES,

        ...saved

    };

    setValue("themeSelect",prefs.theme);

    setValue("accentColor",prefs.accent);

    setValue("languageSelect",prefs.language);

    setValue("country",prefs.country);

    setValue("timezone",prefs.timezone);

    setValue("currency",prefs.currency);

    setChecked(

        "notifyProjects",

        prefs.notifyProjects

    );

    setChecked(

        "notifyRewards",

        prefs.notifyRewards

    );

    setChecked(

        "notifyTransactions",

        prefs.notifyTransactions

    );

    setChecked(

        "notifyMarketing",

        prefs.notifyMarketing

    );

    setChecked(

        "hideBalance",

        prefs.hideBalance

    );

    setChecked(

        "hideAssets",

        prefs.hideAssets

    );

    setChecked(

        "onlineStatus",

        prefs.onlineStatus

    );

    setChecked(

        "biometric",

        prefs.biometric

    );

    setChecked(

        "twoFactor",

        prefs.twoFactor

    );

}

/* =========================
HELPERS
========================= */

function setValue(id,value){

    const el=document.getElementById(id);

    if(el) el.value=value;

}

function setChecked(id,value){

    const el=document.getElementById(id);

    if(el) el.checked=value;

}

document.addEventListener(

    "DOMContentLoaded",

    loadPreferences

);
/* ==========================================
   SAVE PREFERENCES
========================================== */

function savePreferences(){

    const prefs={

        theme:getValue("themeSelect"),

        accent:getValue("accentColor"),

        language:getValue("languageSelect"),

        notifyProjects:getChecked("notifyProjects"),

        notifyRewards:getChecked("notifyRewards"),

        notifyTransactions:getChecked("notifyTransactions"),

        notifyMarketing:getChecked("notifyMarketing"),

        hideBalance:getChecked("hideBalance"),

        hideAssets:getChecked("hideAssets"),

        onlineStatus:getChecked("onlineStatus"),

        biometric:getChecked("biometric"),

        twoFactor:getChecked("twoFactor"),

        country:getValue("country"),

        timezone:getValue("timezone"),

        currency:getValue("currency")

    };

    localStorage.setItem(

        "albukhr_preferences",

        JSON.stringify(prefs)

    );

    showAppAlert(

        "Preferences Saved",

        "Your preferences have been updated successfully."

    );

}

/* =========================
HELPERS
========================= */

function getValue(id){

    const el=document.getElementById(id);

    return el ? el.value : "";

}

function getChecked(id){

    const el=document.getElementById(id);

    return el ? el.checked : false;

}

/* =========================
CLEAR CACHE
========================= */

function clearCache(){

    showAppAlert(

        "Coming Soon",

        "Clear Cache will be available in a future update."

    );

}

/* =========================
RESET
========================= */

function resetPreferences(){

    localStorage.removeItem(

        "albukhr_preferences"

    );

    loadPreferences();

    showAppAlert(

        "Preferences Reset",

        "All settings have been restored to default."

    );

}

/* =========================
APP ALERT WRAPPER
========================= */

function showAppAlert(title,message){

    if(typeof openAppAlert==="function"){

        openAppAlert(title,message);

        return;

    }

    if(typeof showAlert==="function"){

        showAlert(title,message);

        return;

    }

    alert(title + "\n\n" + message);

    }
/* ==========================================
   ALBUKHR PREFERENCES ENGINE
   Part 3
========================================== */

/* =========================
THEME ENGINE
========================= */

function applyTheme(){

    const theme = getValue("themeSelect");

    document.body.dataset.theme = theme;

}

/* =========================
ACCENT COLOR
========================= */

function applyAccent(){

    const accent = getValue("accentColor");

    document.documentElement.setAttribute(

        "data-accent",

        accent

    );

}

/* =========================
LANGUAGE
========================= */

function applyLanguage(){

    const lang = getValue("languageSelect");

    localStorage.setItem(

        "albukhr_language",

        lang

    );

}

/* =========================
AUTO SAVE
========================= */

document

.querySelectorAll(

"select,input"

)

.forEach(el=>{

    el.addEventListener(

        "change",

        ()=>{

            applyTheme();

            applyAccent();

            applyLanguage();

            savePreferences();

        }

    );

});

/* =========================
COMING SOON
========================= */

function comingSoon(feature){

    showAppAlert(

        "Coming Soon",

        feature +

        " will be available in a future update."

    );

}

/* =========================
INITIALIZE
========================= */

document.addEventListener(

    "DOMContentLoaded",

    ()=>{

        loadPreferences();

        applyTheme();

        applyAccent();

        applyLanguage();

    }

);

/* ==========================================
   END OF FILE
========================================== */
