/* ==========================================
   ALBUKHR PREFERENCES ENGINE
   New Architecture
   File: js/pages/preferences.js

   Responsibilities:
   - Load/save user preferences
   - Supabase-backed persistence
   - Shared ALBUKHR auth/session
   - Mainnet/Testnet network isolation
   - Theme / accent / language application
   - Notification/privacy/security preferences
   - Reset preferences
   - No LocalStorage persistence
   - No Supabase credentials
   - No independent Supabase client
   - Does not modify Dock Navigation
========================================== */

"use strict";

(() => {

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

    const STATE = {
        user: null,
        network: null,
        loading: false,
        saving: false,
        preferences: { ...DEFAULT_PREFERENCES }
    };

    const TABLE = "user_preferences";

    function getEl(id) {
        return document.getElementById(id);
    }

    function getSupabaseClient() {
        const client =
            window.AlbukhrSupabase?.client ||
            window.AlbukhrSupabaseClient ||
            window.supabaseClient ||
            window.supabase;

        if (!client || typeof client.from !== "function") {
            throw new Error(
                "ALBUKHR shared Supabase client is unavailable."
            );
        }

        return client;
    }

    function getNetwork() {
        const candidates = [
            window.AlbukhrNetwork?.current,
            window.AlbukhrEnvironment?.current,
            window.AlbukhrEnvironment?.network,
            window.ALBUKHR_NETWORK,
            document.documentElement?.dataset?.network,
            document.body?.dataset?.network
        ];

        for (const value of candidates) {
            const normalized = String(value || "")
                .toLowerCase()
                .trim();

            if (
                normalized === "mainnet" ||
                normalized === "testnet"
            ) {
                return normalized;
            }
        }

        const host =
            window.location.hostname.toLowerCase();

        if (
            host === "test.albukhr.com" ||
            host.startsWith("test.")
        ) {
            return "testnet";
        }

        return "mainnet";
    }

    async function getAuthenticatedUser() {
        const candidates = [
            window.AlbukhrAuth?.getCurrentUser,
            window.AlbukhrAuth?.currentUser,
            window.getCurrentUser,
            window.ensurePiAuth
        ];

        for (const resolver of candidates) {
            if (typeof resolver !== "function") {
                continue;
            }

            try {
                const result = await resolver();

                const user =
                    result?.user ||
                    result?.data?.user ||
                    result;

                if (
                    user?.uid ||
                    user?.id ||
                    user?.username
                ) {
                    return user;
                }
            } catch (error) {
                console.warn(
                    "ALBUKHR Preferences auth resolver failed:",
                    error
                );
            }
        }

        return null;
    }

    function getUserId(user = STATE.user) {
        return String(
            user?.uid ||
            user?.id ||
            ""
        ).trim();
    }

    function setValue(id, value) {
        const el = getEl(id);
        if (el) el.value = value;
    }

    function setChecked(id, value) {
        const el = getEl(id);
        if (el) el.checked = Boolean(value);
    }

    function getValue(id) {
        const el = getEl(id);
        return el ? el.value : "";
    }

    function getChecked(id) {
        const el = getEl(id);
        return el ? el.checked : false;
    }

    function normalizePreferences(input = {}) {
        return {
            ...DEFAULT_PREFERENCES,
            ...(input || {})
        };
    }

    function readFormPreferences() {
        return normalizePreferences({
            theme: getValue("themeSelect"),
            accent: getValue("accentColor"),
            language: getValue("languageSelect"),

            notifyProjects:
                getChecked("notifyProjects"),
            notifyRewards:
                getChecked("notifyRewards"),
            notifyTransactions:
                getChecked("notifyTransactions"),
            notifyMarketing:
                getChecked("notifyMarketing"),

            hideBalance:
                getChecked("hideBalance"),
            hideAssets:
                getChecked("hideAssets"),
            onlineStatus:
                getChecked("onlineStatus"),

            biometric:
                getChecked("biometric"),
            twoFactor:
                getChecked("twoFactor"),

            country:
                getValue("country"),
            timezone:
                getValue("timezone"),
            currency:
                getValue("currency")
        });
    }

    function applyForm(preferences) {
        const prefs =
            normalizePreferences(preferences);

        setValue(
            "themeSelect",
            prefs.theme
        );

        setValue(
            "accentColor",
            prefs.accent
        );

        setValue(
            "languageSelect",
            prefs.language
        );

        setValue(
            "country",
            prefs.country
        );

        setValue(
            "timezone",
            prefs.timezone
        );

        setValue(
            "currency",
            prefs.currency
        );

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

    function applyTheme() {
        const theme =
            getValue("themeSelect") ||
            STATE.preferences.theme ||
            DEFAULT_PREFERENCES.theme;

        document.body.dataset.theme = theme;
        document.documentElement.dataset.theme = theme;
    }

    function applyAccent() {
        const accent =
            getValue("accentColor") ||
            STATE.preferences.accent ||
            DEFAULT_PREFERENCES.accent;

        document.documentElement.setAttribute(
            "data-accent",
            accent
        );
    }

    function applyLanguage() {
        const language =
            getValue("languageSelect") ||
            STATE.preferences.language ||
            DEFAULT_PREFERENCES.language;

        document.documentElement.setAttribute(
            "lang",
            language
        );

        document.documentElement.dataset.language =
            language;

        window.dispatchEvent(
            new CustomEvent(
                "albukhrLanguageChanged",
                {
                    detail: {
                        language
                    }
                }
            )
        );
    }

    function applyPreferences() {
        applyTheme();
        applyAccent();
        applyLanguage();

        window.dispatchEvent(
            new CustomEvent(
                "albukhrPreferencesApplied",
                {
                    detail: {
                        preferences: {
                            ...STATE.preferences
                        }
                    }
                }
            )
        );
    }

    async function loadPreferences() {
        if (STATE.loading) return;

        const uid =
            getUserId();

        if (!uid) {
            throw new Error(
                "Authenticated user is required."
            );
        }

        STATE.loading = true;

        try {
            const client =
                getSupabaseClient();

            STATE.network =
                getNetwork();

            const { data, error } =
                await client
                    .from(TABLE)
                    .select("*")
                    .eq("userid", uid)
                    .eq(
                        "network",
                        STATE.network
                    )
                    .maybeSingle();

            if (error) {
                throw error;
            }

            STATE.preferences =
                normalizePreferences(
                    data?.preferences || data || {}
                );

            /*
             * If the table row contains the
             * preference fields directly,
             * use those fields instead.
             */
            if (data) {
                const direct =
                    Object.keys(
                        DEFAULT_PREFERENCES
                    ).some(
                        key =>
                            Object.prototype
                                .hasOwnProperty
                                .call(data, key)
                    );

                if (direct) {
                    STATE.preferences =
                        normalizePreferences(data);
                }
            }

            applyForm(
                STATE.preferences
            );

            applyPreferences();

            return {
                ...STATE.preferences
            };

        } finally {
            STATE.loading = false;
        }
    }

    async function savePreferences(showMessage = true) {
        if (STATE.saving) return;

        const uid =
            getUserId();

        if (!uid) {
            showAppAlert(
                "Login Required",
                "Please sign in before saving your preferences."
            );
            return;
        }

        STATE.saving = true;

        try {
            const client =
                getSupabaseClient();

            STATE.network =
                getNetwork();

            const preferences =
                readFormPreferences();

            const payload = {
                userid: uid,
                network: STATE.network,
                preferences,
                updated_at:
                    new Date().toISOString()
            };

            const { error } =
                await client
                    .from(TABLE)
                    .upsert(
                        payload,
                        {
                            onConflict:
                                "userid,network"
                        }
                    );

            if (error) {
                throw error;
            }

            STATE.preferences =
                preferences;

            applyPreferences();

            if (showMessage) {
                showAppAlert(
                    "Preferences Saved",
                    "Your preferences have been updated successfully."
                );
            }

            return {
                success: true,
                preferences: {
                    ...preferences
                }
            };

        } catch (error) {
            console.error(
                "ALBUKHR Preferences save error:",
                error
            );

            showAppAlert(
                "Save Failed",
                "Unable to save your preferences. Please try again."
            );

            return {
                success: false,
                error:
                    error?.message ||
                    "Preference save failed."
            };

        } finally {
            STATE.saving = false;
        }
    }

    async function resetPreferences() {
        const uid =
            getUserId();

        if (!uid) {
            showAppAlert(
                "Login Required",
                "Please sign in before resetting preferences."
            );
            return;
        }

        try {
            const client =
                getSupabaseClient();

            STATE.network =
                getNetwork();

            const { error } =
                await client
                    .from(TABLE)
                    .delete()
                    .eq("userid", uid)
                    .eq(
                        "network",
                        STATE.network
                    );

            if (error) {
                throw error;
            }

            STATE.preferences = {
                ...DEFAULT_PREFERENCES
            };

            applyForm(
                STATE.preferences
            );

            applyPreferences();

            showAppAlert(
                "Preferences Reset",
                "All settings have been restored to default."
            );

            return {
                success: true
            };

        } catch (error) {
            console.error(
                "ALBUKHR Preferences reset error:",
                error
            );

            showAppAlert(
                "Reset Failed",
                "Unable to reset your preferences. Please try again."
            );

            return {
                success: false,
                error:
                    error?.message ||
                    "Preference reset failed."
            };
        }
    }

    function clearCache() {
        showAppAlert(
            "Coming Soon",
            "Clear Cache will be available in a future update."
        );
    }

    function comingSoon(feature) {
        showAppAlert(
            "Coming Soon",
            `${feature} will be available in a future update.`
        );
    }

    function showAppAlert(title, message) {
        if (
            typeof window.openAppAlert ===
            "function"
        ) {
            window.openAppAlert(
                title,
                message
            );
            return;
        }

        if (
            typeof window.showAlert ===
            "function"
        ) {
            window.showAlert(
                title,
                message
            );
            return;
        }

        window.alert(
            `${title}\n\n${message}`
        );
    }

    function bindEvents() {
        document
            .querySelectorAll(
                "select,input"
            )
            .forEach(el => {
                el.addEventListener(
                    "change",
                    async () => {
                        STATE.preferences =
                            readFormPreferences();

                        applyPreferences();

                        /*
                         * Preferences are persisted
                         * through Supabase only.
                         */
                        await savePreferences(
                            false
                        );
                    }
                );
            });

        const saveBtn =
            getEl("savePreferencesBtn");

        if (saveBtn) {
            saveBtn.addEventListener(
                "click",
                () => savePreferences(true)
            );
        }

        const resetBtn =
            getEl("resetPreferencesBtn");

        if (resetBtn) {
            resetBtn.addEventListener(
                "click",
                resetPreferences
            );
        }

        const clearCacheBtn =
            getEl("clearCacheBtn");

        if (clearCacheBtn) {
            clearCacheBtn.addEventListener(
                "click",
                clearCache
            );
        }

        window.addEventListener(
            "albukhrNetworkChanged",
            async () => {
                try {
                    await loadPreferences();
                } catch (error) {
                    console.error(
                        "Network preference reload failed:",
                        error
                    );
                }
            }
        );
    }

    async function init() {
        try {
            STATE.user =
                await getAuthenticatedUser();

            if (!getUserId()) {
                window.location.replace(
                    "login.html"
                );
                return;
            }

            await loadPreferences();
            bindEvents();

        } catch (error) {
            console.error(
                "ALBUKHR Preferences initialization failed:",
                error
            );

            /*
             * Keep defaults visible if the
             * remote preference record cannot
             * be loaded.
             */
            STATE.preferences = {
                ...DEFAULT_PREFERENCES
            };

            applyForm(
                STATE.preferences
            );

            applyPreferences();

            showAppAlert(
                "Preferences Unavailable",
                "Your saved preferences could not be loaded from the server."
            );
        }
    }

    window.AlbukhrPreferencesEngine = {
        state: STATE,
        defaults: {
            ...DEFAULT_PREFERENCES
        },
        loadPreferences,
        savePreferences,
        resetPreferences,
        clearCache,
        applyPreferences,
        applyTheme,
        applyAccent,
        applyLanguage,
        readFormPreferences
    };

    window.loadPreferences =
        loadPreferences;

    window.savePreferences =
        savePreferences;

    window.resetPreferences =
        resetPreferences;

    window.clearCache =
        clearCache;

    window.comingSoon =
        comingSoon;

    document.addEventListener(
        "DOMContentLoaded",
        init,
        { once: true }
    );

})();
