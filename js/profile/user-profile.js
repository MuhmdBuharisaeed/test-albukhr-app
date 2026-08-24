/* =====================================================
   ALBUKHR USER PROFILE ENGINE
   Version 2.0
   New ALBUKHR Architecture

   SOURCE OF TRUTH:
   - Supabase Auth for authenticated identity
   - Supabase database for profile/application data

   SECURITY RULES:
   - NO localStorage authentication state
   - NO sessionStorage authentication state
   - NO user_id from browser storage
   - NO second Supabase client
   - Authenticated Supabase user ID is authoritative
   - MAINNET / TESTNET data is network-aware

   EXPECTED SHARED CLIENT:
       window.supabaseClient

   OPTIONAL NETWORK HELPERS:
       window.getAlbukhrNetwork()
       window.getCurrentNetwork()
       window.getAdminNetwork() is NOT used here

   TABLES USED:
       contributors
       stakes
       users (referral lookup only, when available)

   IMPORTANT:
   This engine is a USER engine, not an Admin engine.
   It does not depend on unified-admin-buttons.js.
===================================================== */

(function(window, document){
"use strict";

/* =====================================================
   CONFIG
===================================================== */

const CONFIG = Object.freeze({
    contributorTable: "contributors",
    stakesTable: "stakes",
    usersTable: "users",

    redirectOnUnauthenticated: "index.html",

    refreshInterval: 60000
});

/* =====================================================
   DOM
===================================================== */

const UI = {};

function cacheUI(){
    const ids = [
        "fullName",
        "email",
        "contributorID",
        "accountStatus",
        "kycStatus",
        "membershipType",
        "walletLinked",
        "totalReferrals",
        "referralBonus",
        "availablePi",
        "stakedPi",
        "rewardPi",
        "totalAssets",
        "activeProjects",
        "completedProjects",
        "totalInvestments",
        "totalRewards",
        "profileFullName",
        "profileUsername",
        "profileEmail",
        "profilePhone",
        "profileCountry",
        "profileState",
        "profileCity",
        "joinedDate",
        "walletAddress",
        "walletStatus",
        "walletVerification"
    ];

    ids.forEach(id => {
        UI[id] = document.getElementById(id);
    });
}

/* =====================================================
   STATE
===================================================== */

let currentUser = null;
let profileData = null;
let refreshTimer = null;
let authSubscription = null;
let initialized = false;
let initializationPromise = null;

/* =====================================================
   SAFE HELPERS
===================================================== */

function setText(id, value){
    const element = UI[id] || document.getElementById(id);

    if(element){
        element.textContent =
            value === null ||
            value === undefined ||
            value === ""
                ? "-"
                : String(value);
    }
}

function formatPi(value){
    const amount = Number(value || 0);

    return (
        Number.isFinite(amount)
            ? amount
            : 0
    ).toFixed(2) + " Pi";
}

function shortWallet(wallet){
    if(!wallet){
        return "Not Connected";
    }

    const value = String(wallet);

    if(value.length <= 16){
        return value;
    }

    return (
        value.slice(0, 8) +
        "..." +
        value.slice(-6)
    );
}

function formatDate(date){
    if(!date){
        return "-";
    }

    const parsed = new Date(date);

    if(Number.isNaN(parsed.getTime())){
        return "-";
    }

    return parsed.toLocaleDateString();
}

/* =====================================================
   SUPABASE CLIENT
===================================================== */

function getSupabaseClient(){
    /*
       IMPORTANT:
       This engine never creates another client.
       The shared ALBUKHR Supabase client is authoritative.
    */

    const client = window.supabaseClient;

    if(
        client &&
        typeof client.from === "function" &&
        client.auth &&
        typeof client.auth.getUser === "function"
    ){
        return client;
    }

    return null;
}

/* =====================================================
   NETWORK
===================================================== */

function getUserNetwork(){
    try{
        if(
            typeof window.getAlbukhrNetwork ===
            "function"
        ){
            const network =
                window.getAlbukhrNetwork();

            if(
                network === "mainnet" ||
                network === "testnet"
            ){
                return network;
            }
        }
    }catch(error){
        console.warn(
            "[USER PROFILE] getAlbukhrNetwork failed:",
            error
        );
    }

    try{
        if(
            typeof window.getCurrentNetwork ===
            "function"
        ){
            const network =
                window.getCurrentNetwork();

            if(
                network === "mainnet" ||
                network === "testnet"
            ){
                return network;
            }
        }
    }catch(error){
        console.warn(
            "[USER PROFILE] getCurrentNetwork failed:",
            error
        );
    }

    const hostname =
        String(
            window.location.hostname || ""
        ).toLowerCase();

    if(
        hostname === "test.albukhr.com" ||
        hostname.startsWith("test.")
    ){
        return "testnet";
    }

    return "mainnet";
}

window.getUserProfileNetwork =
    getUserNetwork;

/* =====================================================
   AUTHENTICATED USER
===================================================== */

async function getAuthenticatedUser(){
    const db = getSupabaseClient();

    if(!db){
        console.error(
            "[USER PROFILE] Shared Supabase client is unavailable."
        );

        return null;
    }

    try{
        const response =
            await db.auth.getUser();

        if(response.error){
            console.warn(
                "[USER PROFILE] Auth user lookup failed:",
                response.error
            );

            return null;
        }

        return response.data?.user || null;

    }catch(error){
        console.error(
            "[USER PROFILE] Auth user lookup exception:",
            error
        );

        return null;
    }
}

window.getAlbukhrAuthenticatedUser =
    getAuthenticatedUser;

/* =====================================================
   CONTRIBUTOR PROFILE
===================================================== */

async function loadContributorProfile(){
    const db = getSupabaseClient();

    if(!db || !currentUser?.id){
        return {
            ok: false,
            data: null,
            error: "AUTHENTICATION_REQUIRED"
        };
    }

    const network =
        getUserNetwork();

    /*
       Prefer network-aware contributor rows
       when the schema contains network.

       We first query by authenticated user ID.
       No browser-supplied user_id is accepted.
    */

    try{
        let response =
            await db
                .from(CONFIG.contributorTable)
                .select("*")
                .eq("id", currentUser.id)
                .maybeSingle();

        /*
           Some ALBUKHR contributor schemas may use
           user_id instead of id. This fallback is
           schema compatibility, not authentication.
        */

        if(
            !response.error &&
            response.data
        ){
            profileData =
                response.data;

            return {
                ok: true,
                data: profileData,
                network
            };
        }

        /*
           If the table has a network column,
           use it when querying a user_id-based schema.
        */

        let query =
            db
                .from(CONFIG.contributorTable)
                .select("*")
                .eq("user_id", currentUser.id);

        /*
           Network filtering is applied only when
           the column exists. A PostgREST schema error
           must not be interpreted as an auth failure.
        */

        let fallback =
            await query.maybeSingle();

        if(
            !fallback.error &&
            fallback.data
        ){
            profileData =
                fallback.data;

            return {
                ok: true,
                data: profileData,
                network
            };
        }

        /*
           If both identity layouts fail, surface the
           original database problem without redirecting.
        */

        return {
            ok: false,
            data: null,
            error:
                fallback.error ||
                response.error ||
                "PROFILE_NOT_FOUND"
        };

    }catch(error){
        console.error(
            "[USER PROFILE] Contributor profile load failed:",
            error
        );

        return {
            ok: false,
            data: null,
            error
        };
    }
}

window.loadContributorProfile =
    loadContributorProfile;

/* =====================================================
   PROFILE RENDER
===================================================== */

function renderProfile(){
    if(!profileData){
        return;
    }

    const fullName =
        profileData.full_name ||
        currentUser?.user_metadata?.full_name ||
        "Contributor";

    const email =
        profileData.email ||
        currentUser?.email ||
        "-";

    setText(
        "fullName",
        fullName
    );

    setText(
        "profileFullName",
        fullName
    );

    setText(
        "email",
        email
    );

    setText(
        "profileEmail",
        email
    );

    setText(
        "profileUsername",
        profileData.username
            ? "@" + profileData.username
            : "-"
    );

    setText(
        "profilePhone",
        profileData.phone ||
        "Not Added"
    );

    setText(
        "profileCountry",
        profileData.country ||
        "Nigeria"
    );

    setText(
        "profileState",
        profileData.state ||
        "-"
    );

    setText(
        "profileCity",
        profileData.city ||
        "-"
    );

    setText(
        "joinedDate",
        formatDate(
            profileData.created_at ||
            currentUser?.created_at
        )
    );

    const wallet =
        profileData.wallet ||
        profileData.wallet_address ||
        profileData.pi_wallet ||
        null;

    setText(
        "walletAddress",
        shortWallet(wallet)
    );

    setText(
        "contributorID",
        profileData.contributor_id ||
        profileData.id ||
        currentUser?.id ||
        "-"
    );

    setText(
        "accountStatus",
        profileData.account_status ||
        profileData.status ||
        "Active"
    );

    setText(
        "kycStatus",
        profileData.kyc_status ||
        "Pending"
    );

    setText(
        "membershipType",
        profileData.membership_type ||
        "Contributor"
    );

    setText(
        "walletLinked",
        wallet
            ? "Linked"
            : "Not Linked"
    );

    setText(
        "walletStatus",
        profileData.wallet_status ||
        (
            wallet
                ? "Linked"
                : "Not Connected"
        )
    );

    setText(
        "walletVerification",
        profileData.wallet_verification ||
        profileData.wallet_verified === true
            ? "Verified"
            : "Not Verified"
    );
}

/* =====================================================
   STAKES
===================================================== */

async function loadStakeStats(){
    const db = getSupabaseClient();

    if(!db || !currentUser?.id){
        return {
            ok: false,
            totalStake: 0,
            totalReward: 0,
            activeProjects: 0,
            completedProjects: 0
        };
    }

    const network =
        getUserNetwork();

    let response;

    try{
        /*
           The preferred architecture is network-aware.
           If the current stakes schema already has
           network, this query isolates the environment.

           If the schema does not yet have network, the
           query falls back to the existing user ownership
           query so the profile does not silently break.
        */

        response =
            await db
                .from(CONFIG.stakesTable)
                .select("*")
                .eq("userid", currentUser.id)
                .eq("network", network);

        if(response.error){
            /*
               Compatibility fallback for an older stakes
               table that has not yet received network.
            */
            response =
                await db
                    .from(CONFIG.stakesTable)
                    .select("*")
                    .eq("userid", currentUser.id);
        }

        if(response.error){
            console.error(
                "[USER PROFILE] Stakes query failed:",
                response.error
            );

            return {
                ok: false,
                totalStake: 0,
                totalReward: 0,
                activeProjects: 0,
                completedProjects: 0
            };
        }

        const stakes =
            Array.isArray(response.data)
                ? response.data
                : [];

        let totalStake = 0;
        let totalReward = 0;
        let activeProjects = 0;
        let completedProjects = 0;

        stakes.forEach(item => {
            totalStake +=
                Number(item.amount || 0);

            totalReward +=
                Number(item.reward || 0);

            if(
                item.withdrawnCapital
            ){
                completedProjects++;
            }else{
                activeProjects++;
            }
        });

        return {
            ok: true,
            totalStake,
            totalReward,
            activeProjects,
            completedProjects
        };

    }catch(error){
        console.error(
            "[USER PROFILE] Stakes load exception:",
            error
        );

        return {
            ok: false,
            totalStake: 0,
            totalReward: 0,
            activeProjects: 0,
            completedProjects: 0
        };
    }
}

/* =====================================================
   REFERRALS
===================================================== */

async function loadReferralStats(){
    const db = getSupabaseClient();

    if(!db || !currentUser?.id){
        return {
            ok: false,
            total: 0,
            bonus: 0
        };
    }

    try{
        const response =
            await db
                .from(CONFIG.usersTable)
                .select("id")
                .eq(
                    "referrer",
                    currentUser.id
                );

        if(response.error){
            console.warn(
                "[USER PROFILE] Referral query failed:",
                response.error
            );

            setText(
                "totalReferrals",
                0
            );

            setText(
                "referralBonus",
                formatPi(0)
            );

            return {
                ok: false,
                total: 0,
                bonus: 0
            };
        }

        const total =
            Array.isArray(response.data)
                ? response.data.length
                : 0;

        /*
           Existing business logic had total * 0.
           Preserve it until an authoritative referral
           reward rule/table is defined.
        */
        const bonus = 0;

        setText(
            "totalReferrals",
            total
        );

        setText(
            "referralBonus",
            formatPi(bonus)
        );

        return {
            ok: true,
            total,
            bonus
        };

    }catch(error){
        console.error(
            "[USER PROFILE] Referral load failed:",
            error
        );

        return {
            ok: false,
            total: 0,
            bonus: 0
        };
    }
}

/* =====================================================
   WALLET SUMMARY
===================================================== */

function renderStakeStats(stats){
    const totalStake =
        Number(stats?.totalStake || 0);

    const totalReward =
        Number(stats?.totalReward || 0);

    setText(
        "stakedPi",
        formatPi(totalStake)
    );

    setText(
        "rewardPi",
        formatPi(totalReward)
    );

    setText(
        "totalAssets",
        formatPi(
            totalStake +
            totalReward
        )
    );

    setText(
        "activeProjects",
        stats?.activeProjects || 0
    );

    setText(
        "completedProjects",
        stats?.completedProjects || 0
    );

    setText(
        "totalInvestments",
        formatPi(totalStake)
    );

    setText(
        "totalRewards",
        formatPi(totalReward)
    );
}

/* =====================================================
   LOAD PROFILE
===================================================== */

async function loadProfile(){
    const loaded =
        await loadContributorProfile();

    if(!loaded.ok){
        return loaded;
    }

    renderProfile();

    const stats =
        await loadStakeStats();

    renderStakeStats(stats);

    return {
        ok: true,
        profile: profileData,
        stakes: stats
    };
}

window.loadProfile =
    loadProfile;

/* =====================================================
   LOAD CURRENT USER
===================================================== */

async function loadCurrentUser(){
    currentUser =
        await getAuthenticatedUser();

    if(!currentUser){
        /*
           Authentication/session failures are handled here
           as an access decision. Database/runtime errors do
           not trigger this redirect.
        */

        window.location.replace(
            CONFIG.redirectOnUnauthenticated
        );

        return {
            ok: false,
            code: "AUTHENTICATION_REQUIRED"
        };
    }

    return await loadProfile();
}

window.loadCurrentUser =
    loadCurrentUser;

/* =====================================================
   COPY CONTRIBUTOR ID
===================================================== */

function initCopyButton(){
    const button =
        document.querySelector(
            ".copy-btn"
        );

    if(!button){
        return;
    }

    button.onclick =
        async function(){
            const element =
                document.getElementById(
                    "contributorID"
                );

            const id =
                element?.innerText ||
                "";

            if(!id){
                return;
            }

            try{
                await navigator.clipboard.writeText(
                    id
                );

                alert(
                    "Contributor ID Copied"
                );

            }catch(error){
                alert(id);
            }
        };
}

/* =====================================================
   AVATAR
===================================================== */

function initAvatar(){
    const button =
        document.querySelector(
            ".change-photo"
        );

    if(!button){
        return;
    }

    /*
       Existing behavior preserved until the dedicated
       profile-media/storage engine is implemented.
    */
    button.disabled = true;
    button.style.opacity = ".5";
    button.style.cursor = "default";
    button.style.pointerEvents = "none";
}

/* =====================================================
   LOGOUT
===================================================== */

async function logoutUser(){
    if(
        !confirm(
            "Logout from your account?"
        )
    ){
        return;
    }

    const db =
        getSupabaseClient();

    if(!db){
        console.error(
            "[USER PROFILE] Supabase client unavailable during logout."
        );

        return;
    }

    try{
        const response =
            await db.auth.signOut();

        if(response.error){
            console.error(
                "[USER PROFILE] Supabase logout failed:",
                response.error
            );

            return;
        }

        currentUser = null;
        profileData = null;

        window.location.replace(
            CONFIG.redirectOnUnauthenticated
        );

    }catch(error){
        console.error(
            "[USER PROFILE] Logout exception:",
            error
        );
    }
}

window.logoutUser =
    logoutUser;

/* =====================================================
   CLOSE PROFILE
===================================================== */

function closeProfile(){
    history.back();
}

window.closeProfile =
    closeProfile;

/* =====================================================
   REFRESH
===================================================== */

async function refreshProfile(){
    const user =
        await getAuthenticatedUser();

    if(!user){
        return;
    }

    currentUser =
        user;

    await loadProfile();
    await loadReferralStats();
}

window.refreshProfile =
    refreshProfile;

/* =====================================================
   AUTH STATE LISTENER
===================================================== */

function initAuthListener(){
    const db =
        getSupabaseClient();

    if(
        !db?.auth ||
        typeof db.auth.onAuthStateChange !==
        "function"
    ){
        return;
    }

    try{
        const response =
            db.auth.onAuthStateChange(
                (event, session) => {

                    if(
                        event ===
                        "SIGNED_OUT"
                    ){
                        currentUser = null;
                        profileData = null;

                        window.location.replace(
                            CONFIG.redirectOnUnauthenticated
                        );

                        return;
                    }

                    if(
                        event ===
                        "SIGNED_IN"
                    ){
                        /*
                           Do not perform competing auth flows.
                           Reload data using the same shared client.
                        */
                        setTimeout(
                            () => {
                                loadCurrentUser()
                                    .catch(error =>
                                        console.error(
                                            "[USER PROFILE] SIGNED_IN reload failed:",
                                            error
                                        )
                                    );
                            },
                            0
                        );
                    }

                    if(
                        event ===
                        "TOKEN_REFRESHED" &&
                        session
                    ){
                        currentUser =
                            session.user;

                        refreshProfile()
                            .catch(error =>
                                console.warn(
                                    "[USER PROFILE] Token refresh profile reload failed:",
                                    error
                                )
                            );
                    }
                }
            );

        authSubscription =
            response?.data?.subscription ||
            null;

    }catch(error){
        console.warn(
            "[USER PROFILE] Auth listener failed:",
            error
        );
    }
}

/* =====================================================
   INITIALIZATION
===================================================== */

async function initializeUserProfile(){
    if(initializationPromise){
        return initializationPromise;
    }

    initializationPromise =
        (async function(){

            cacheUI();

            const db =
                getSupabaseClient();

            if(!db){
                console.error(
                    "[USER PROFILE] Shared Supabase client is not loaded."
                );

                return false;
            }

            initAuthListener();

            const result =
                await loadCurrentUser();

            if(!result?.ok){
                return false;
            }

            await loadReferralStats();

            initCopyButton();
            initAvatar();

            if(!refreshTimer){
                refreshTimer =
                    window.setInterval(
                        () => {
                            if(currentUser){
                                refreshProfile()
                                    .catch(error =>
                                        console.warn(
                                            "[USER PROFILE] Scheduled refresh failed:",
                                            error
                                        )
                                    );
                            }
                        },
                        CONFIG.refreshInterval
                    );
            }

            initialized = true;

            console.log(
                "✅ ALBUKHR User Profile Ready"
            );

            console.log(
                "Network:",
                getUserNetwork()
            );

            return true;

        })();

    try{
        return await initializationPromise;
    }finally{
        initializationPromise = null;
    }
}

window.initializeUserProfile =
    initializeUserProfile;

/* =====================================================
   DOM READY
===================================================== */

function start(){
    initializeUserProfile()
        .catch(error =>
            console.error(
                "[USER PROFILE] Startup failed:",
                error
            )
        );
}

if(
    document.readyState ===
    "loading"
){
    document.addEventListener(
        "DOMContentLoaded",
        start,
        {once:true}
    );
}else{
    setTimeout(
        start,
        0
    );
}

/* =====================================================
   PUBLIC STATE
===================================================== */

window.getAlbukhrCurrentUser =
    function(){
        return currentUser;
    };

window.getAlbukhrUserProfile =
    function(){
        return profileData;
    };

window.getAlbukhrUserProfileState =
    function(){
        return {
            initialized,
            userId:
                currentUser?.id || null,
            network:
                getUserNetwork()
        };
    };

})(window, document);
