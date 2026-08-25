/* =====================================================
   ALBUKHR USER PROFILE
   Part 1
   Core + Load User
===================================================== */

"use strict";

/* ==========================================
   SUPABASE
========================================== */

const db = window.supabaseClient;

/* ==========================================
   DOM
========================================== */

const UI = {

    fullName:
    document.getElementById("fullName"),

    email:
    document.getElementById("email"),

    contributorID:
    document.getElementById("contributorID"),

    accountStatus:
    document.getElementById("accountStatus"),

    kycStatus:
    document.getElementById("kycStatus"),

    membershipType:
    document.getElementById("membershipType"),

    walletLinked:
    document.getElementById("walletLinked"),

    totalReferrals:
    document.getElementById("totalReferrals"),

    referralBonus:
    document.getElementById("referralBonus"),

    availablePi:
    document.getElementById("availablePi"),

    stakedPi:
    document.getElementById("stakedPi"),

    rewardPi:
    document.getElementById("rewardPi"),

    totalAssets:
    document.getElementById("totalAssets"),

    profileFullName:
    document.getElementById("profileFullName"),

    profileUsername:
    document.getElementById("profileUsername"),

    profileEmail:
    document.getElementById("profileEmail"),

    profilePhone:
    document.getElementById("profilePhone"),

    profileCountry:
    document.getElementById("profileCountry"),

    profileState:
    document.getElementById("profileState"),

    profileCity:
    document.getElementById("profileCity"),

    joinedDate:
    document.getElementById("joinedDate"),

    walletAddress:
    document.getElementById("walletAddress"),

    walletStatus:
    document.getElementById("walletStatus"),

    walletVerification:
    document.getElementById("walletVerification")

};

/* ==========================================
   GLOBAL
========================================== */

let currentUser = null;
let profileData = null;

/* ==========================================
   FORMATTERS
========================================== */

function formatPi(value){

    return Number(value || 0).toFixed(2) + " Pi";

}

function shortWallet(wallet){

    if(!wallet) return "Not Connected";

    return wallet.slice(0,8) +
           "..." +
           wallet.slice(-6);

}

function formatDate(date){

    if(!date) return "-";

    return new Date(date)
        .toLocaleDateString();

}

/* ==========================================
   LOAD USER
========================================== */

async function loadCurrentUser(){

    const {

        data:{ user }

    } = await db.auth.getUser();

    if(!user){

        location.href="index.html";

        return;
    }

    currentUser = user;

    await loadProfile();

}

/* ==========================================
   LOAD PROFILE
========================================== */

async function loadProfile(){

    const {

        data,
        error

    } = await db

    .from("contributors")

    .select("*")

    .eq("id",currentUser.id)

    .single();

    if(error){

        console.error(error);

        return;
    }

    profileData = data;

    renderProfile();

}

/* ==========================================
   RENDER BASIC PROFILE
========================================== */

function renderProfile(){

    UI.fullName.textContent =
        profileData.full_name || "Contributor";

    UI.profileFullName.textContent =
        profileData.full_name || "-";

    UI.email.textContent =
        profileData.email || "-";

    UI.profileEmail.textContent =
        profileData.email || "-";

    UI.profileUsername.textContent =
        "@" + (profileData.username || "user");

    UI.profilePhone.textContent =
        profileData.phone || "Not Added";

    UI.profileCountry.textContent =
        profileData.country || "Nigeria";

    UI.profileState.textContent =
        profileData.state || "-";

    UI.profileCity.textContent =
        profileData.city || "-";

    UI.joinedDate.textContent =
        formatDate(profileData.created_at);

    UI.contributorID.textContent =
        profileData.contributor_id || "-";

}

/* ==========================================
   START
========================================== */

document.addEventListener(

    "DOMContentLoaded",

    loadCurrentUser

);
/* ==========================================
   ALBUKHR USER PROFILE
   PART 2
   Load Profile Data
========================================== */

async function loadProfile() {

    try {

        const userId =
            localStorage.getItem("user_id");

        if (!userId) return;

        /* ===========================
           USER TABLE
        =========================== */

        const {
            data: user,
            error
        } = await supabase
            .from("users")
            .select("*")
            .eq("id", userId)
            .single();

        if (error || !user) return;

        /* ========= HERO ========= */

        setText("fullName",
            user.full_name || "Contributor");

        setText("profileFullName",
            user.full_name || "-");

        setText("profileUsername",
            user.username
            ? "@" + user.username
            : "-");

        setText("email",
            user.email || "-");

        setText("profileEmail",
            user.email || "-");

        setText("profilePhone",
            user.phone || "Not Added");

        setText("profileCountry",
            user.country || "Nigeria");

        setText("profileState",
            user.state || "-");

        setText("profileCity",
            user.city || "-");

        setText("joinedDate",
            formatDate(user.created_at));

        setText("walletAddress",
            shortWallet(user.wallet));

        setText("contributorID",
            user.contributor_id ||
            ("ALB-" + user.id));

        /* ===========================
           STAKES
        =========================== */

        const {
            data: stakes
        } = await supabase
            .from("stakes")
            .select("*")
            .eq("userid", userId);

        let totalStake = 0;
        let totalReward = 0;
        let activeProjects = 0;
        let completed = 0;

        if (stakes) {

            stakes.forEach(item => {

                totalStake +=
                    Number(item.amount || 0);

                totalReward +=
                    Number(item.reward || 0);

                if (
                    !item.withdrawnCapital
                ) {

                    activeProjects++;

                } else {

                    completed++;

                }

            });

        }

        /* ===========================
           WALLET SUMMARY
        =========================== */

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
                totalStake + totalReward
            )
        );

        /* ===========================
           INVESTMENT STATS
        =========================== */

        setText(
            "activeProjects",
            activeProjects
        );

        setText(
            "completedProjects",
            completed
        );

        setText(
            "totalInvestments",
            formatPi(totalStake)
        );

        setText(
            "totalRewards",
            formatPi(totalReward)
        );

    } catch (err) {

        console.error(
            "Profile Load Error:",
            err
        );

    }

}
/* ==========================================
   ALBUKHR USER PROFILE
   PART 3
   Events & Initialization
========================================== */

/* ===========================
   LOAD REFERRALS
=========================== */

async function loadReferralStats() {

    try {

        const userId =
            localStorage.getItem("user_id");

        if (!userId) return;

        const {
            data
        } = await supabase
            .from("users")
            .select("id")
            .eq("referrer", userId);

        const total =
            data ? data.length : 0;

        setText(
            "totalReferrals",
            total
        );

        setText(
            "referralBonus",
            formatPi(total * 0)
        );

    } catch (e) {

        console.error(e);

    }

}

/* ===========================
   COPY CONTRIBUTOR ID
=========================== */

function initCopyButton() {

    const btn =
        document.querySelector(".copy-btn");

    if (!btn) return;

    btn.onclick = async () => {

        const id =
            document
            .getElementById("contributorID")
            .innerText;

        try {

            await navigator.clipboard.writeText(id);

            alert("Contributor ID Copied");

        } catch {

            alert(id);

        }

    };

}

/* ===========================
   CHANGE PHOTO
=========================== */

function initAvatar(){

    const button =
        document.querySelector(".change-photo");

    if(!button) return;

    button.disabled = true;
    button.style.opacity = ".5";
    button.style.cursor = "default";
    button.style.pointerEvents = "none";

}

/* ===========================
   LOGOUT
=========================== */

function logoutUser() {

    if (
        !confirm(
            "Logout from your account?"
        )
    ) return;

    localStorage.clear();
    sessionStorage.clear();

    location.replace("index.html");

}

/* ===========================
   CLOSE PROFILE
=========================== */

function closeProfile() {

    history.back();

}

/* ===========================
   REFRESH
=========================== */

function refreshProfile() {

    loadProfile();
    loadReferralStats();

}

/* ===========================
   INITIALIZE
=========================== */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await loadProfile();

        await loadReferralStats();

        initCopyButton();

        initAvatar();

        /* refresh every minute */

        setInterval(
            refreshProfile,
            60000
        );

    }
);

/* ==========================================
   END OF USER PROFILE.JS
========================================== */
