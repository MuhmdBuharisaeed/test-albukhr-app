/* =========================================================
   ALBUKHR PI AUTH CORE v3
   File:
   js/core/pi-auth-core.js

   PURPOSE
   - Stable Pi SDK loading / initialization
   - Shared Pi authentication
   - Shared in-memory authenticated-user state
   - Mainnet/Testnet-aware Pi initialization
   - No LocalStorage authentication persistence
   - No Supabase credentials
   - No page-specific redirect logic

   NETWORK RULE
   - ALBUKHR Network Core is the canonical resolver.
   - This file does not create or overwrite a competing
     mainnet/testnet resolver.
   - Pi sandbox mode is derived from the resolved network.

   LOAD ORDER
   environment-switcher.js
        ↓
   js/core/pi-auth-core.js
        ↓
   page authentication controller
========================================================= */

"use strict";

(() => {

  const PI_SDK_VERSION = "2.0";
  const PI_SDK_URL =
    "https://sdk.minepi.com/pi-sdk.js";

  const SDK_WAIT_TIMEOUT_MS = 15000;
  const SDK_POLL_MS = 100;

  const AUTH_RETRIES = 2;
  const AUTH_RETRY_DELAY_MS = 700;

  let initialized = false;
  let initializedNetwork = null;

  let initializing = null;
  let authenticating = null;

  let currentUser = null;
  let sdkLoadPromise = null;

  /* =========================================
     NETWORK
  ========================================= */
  function normalizeNetwork(value){
    const network =
      String(value || "")
        .trim()
        .toLowerCase();

    if(network === "mainnet") return "mainnet";
    if(network === "testnet") return "testnet";

    return "";
  }

  function getEnvironment(){
    const resolvers = [
      "requireAlbukhrNetwork",
      "getAlbukhrNetwork",
      "getAlbukhrCurrentNetwork",
      "getCurrentAlbukhrNetwork"
    ];

    for(const name of resolvers){
      try{
        if(typeof window[name] === "function"){
          const resolved =
            normalizeNetwork(
              window[name]()
            );

          if(resolved){
            return resolved;
          }
        }
      }catch(error){
        console.warn(
          `ALBUKHR Pi Auth: ${name}() failed:`,
          error
        );
      }
    }

    throw new Error(
      "ALBUKHR Network Core is unavailable. " +
      "Load environment-switcher.js before pi-auth-core.js."
    );
  }

  function isSandboxEnvironment(){
    return getEnvironment() === "testnet";
  }

  /* =========================================
     PI SDK
  ========================================= */
  function getPiSDK(){
    if(typeof window === "undefined"){
      return null;
    }

    return (
      window.Pi &&
      typeof window.Pi === "object"
    )
      ? window.Pi
      : null;
  }

  function isPiSDKReady(){
    const Pi = getPiSDK();

    return !!(
      Pi &&
      typeof Pi.init === "function" &&
      typeof Pi.authenticate === "function"
    );
  }

  function requirePiSDK(){
    const Pi = getPiSDK();

    if(!Pi){
      throw new Error(
        "Pi SDK is unavailable. Open ALBUKHR inside Pi Browser."
      );
    }

    if(typeof Pi.init !== "function"){
      throw new Error(
        "Pi SDK initialization API is unavailable."
      );
    }

    if(typeof Pi.authenticate !== "function"){
      throw new Error(
        "Pi SDK authentication API is unavailable."
      );
    }

    return Pi;
  }

  function loadPiSDK(){
    if(isPiSDKReady()){
      return Promise.resolve(
        getPiSDK()
      );
    }

    if(sdkLoadPromise){
      return sdkLoadPromise;
    }

    sdkLoadPromise =
      new Promise((resolve, reject) => {
        let settled = false;

        const finishResolve = (Pi) => {
          if(settled) return;

          settled = true;
          resolve(Pi);
        };

        const finishReject = (error) => {
          if(settled) return;

          settled = true;

          reject(
            error instanceof Error
              ? error
              : new Error(
                  String(
                    error ||
                    "Unable to load Pi SDK."
                  )
                )
          );
        };

        const started = Date.now();

        const poll = () => {
          if(isPiSDKReady()){
            finishResolve(
              getPiSDK()
            );

            return;
          }

          if(
            Date.now() - started >=
            SDK_WAIT_TIMEOUT_MS
          ){
            finishReject(
              new Error(
                "Pi SDK did not become available within the expected time."
              )
            );

            return;
          }

          window.setTimeout(
            poll,
            SDK_POLL_MS
          );
        };

        poll();

        try{
          const existing =
            document.querySelector(
              'script[data-albukhr-pi-sdk="true"]'
            );

          if(existing){
            return;
          }

          const script =
            document.createElement(
              "script"
            );

          script.src = PI_SDK_URL;
          script.async = true;
          script.defer = true;

          script.dataset.albukhrPiSdk =
            "true";

          script.onload = () => {
            if(isPiSDKReady()){
              finishResolve(
                getPiSDK()
              );
            }
          };

          script.onerror = () => {
            console.warn(
              "ALBUKHR: Pi SDK script load reported an error; continuing to wait for Pi Browser SDK."
            );
          };

          (
            document.head ||
            document.documentElement
          ).appendChild(script);

        }catch(error){
          console.warn(
            "ALBUKHR: Pi SDK dynamic loader failed:",
            error
          );
        }
      })
      .finally(() => {
        sdkLoadPromise = null;
      });

    return sdkLoadPromise;
  }

  /* =========================================
     PI INITIALIZATION
  ========================================= */
  async function initPi(){
    const network =
      getEnvironment();

    if(
      initialized &&
      initializedNetwork === network &&
      isPiSDKReady()
    ){
      return true;
    }

    if(initializing){
      return initializing;
    }

    initializing =
      (async () => {
        try{
          const Pi =
            await loadPiSDK();

          if(!Pi){
            throw new Error(
              "Pi SDK object was not returned."
            );
          }

          const sandbox =
            network === "testnet";

          Pi.init({
            version:PI_SDK_VERSION,
            sandbox
          });

          initialized = true;
          initializedNetwork = network;

          console.log(
            "ALBUKHR Pi SDK initialized:",
            {
              version:PI_SDK_VERSION,
              network,
              sandbox
            }
          );

          return true;

        }catch(error){
          initialized = false;
          initializedNetwork = null;

          console.error(
            "ALBUKHR Pi initialization failed:",
            error
          );

          return false;

        }finally{
          initializing = null;
        }
      })();

    return initializing;
  }

  /* =========================================
     USER NORMALIZATION
  ========================================= */
  function normalizeUser(auth){
    if(!auth){
      return null;
    }

    const source =
      auth.user ||
      auth;

    const uid =
      source.uid ||
      auth.uid ||
      "";

    const username =
      source.username ||
      auth.username ||
      "";

    const walletAddress =
      source.wallet_address ||
      source.walletAddress ||
      auth.wallet_address ||
      auth.walletAddress ||
      "";

    if(!uid){
      return null;
    }

    return {
      uid:String(uid),

      username:
        username
          ? String(username)
          : "",

      wallet_address:
        walletAddress
          ? String(walletAddress)
          : ""
    };
  }

  function handleIncompletePayment(payment){
    console.log(
      "ALBUKHR Pi incomplete payment:",
      payment
    );

    try{
      window.dispatchEvent(
        new CustomEvent(
          "albukhrPiIncompletePayment",
          {
            detail:payment
          }
        )
      );
    }catch(error){
      console.warn(
        "ALBUKHR payment event dispatch failed:",
        error
      );
    }
  }

  /* =========================================
     AUTHENTICATION
  ========================================= */
  async function authenticateOnce(){
    const ready =
      await initPi();

    if(!ready){
      throw new Error(
        "Pi SDK initialization failed."
      );
    }

    const Pi =
      requirePiSDK();

    const scopes = [
      "username",
      "payments",
      "wallet_address"
    ];

    const auth =
      await Pi.authenticate(
        scopes,
        handleIncompletePayment
      );

    console.log(
      "ALBUKHR Pi authentication response:",
      auth
    );

    const user =
      normalizeUser(auth);

    if(!user?.uid){
      throw new Error(
        "Pi authentication returned no valid UID."
      );
    }

    return {
      ...user,

      network:
        getEnvironment(),

      /*
       * Kept in memory only.
       * It is never persisted to LocalStorage.
       */
      accessToken:
        auth?.accessToken || ""
    };
  }

  async function ensurePiAuth(){
    const network =
      getEnvironment();

    if(currentUser){
      if(
        currentUser.network ===
        network
      ){
        return currentUser;
      }

      currentUser = null;
    }

    if(authenticating){
      return authenticating;
    }

    authenticating =
      (async () => {
        let lastError = null;

        try{
          for(
            let attempt = 0;
            attempt <= AUTH_RETRIES;
            attempt++
          ){
            try{
              const user =
                await authenticateOnce();

              currentUser =
                Object.freeze(user);

              console.log(
                "ALBUKHR authenticated user:",
                currentUser
              );

              try{
                window.dispatchEvent(
                  new CustomEvent(
                    "albukhrAuthChanged",
                    {
                      detail:currentUser
                    }
                  )
                );
              }catch(eventError){
                console.warn(
                  "ALBUKHR auth event dispatch failed:",
                  eventError
                );
              }

              return currentUser;

            }catch(error){
              lastError = error;

              console.warn(
                `ALBUKHR authentication attempt ${attempt + 1} failed:`,
                error
              );

              if(
                attempt <
                AUTH_RETRIES
              ){
                await new Promise(
                  resolve => {
                    window.setTimeout(
                      resolve,
                      AUTH_RETRY_DELAY_MS
                    );
                  }
                );
              }
            }
          }

          currentUser = null;

          console.error(
            "ALBUKHR Pi authentication failed after retries:",
            lastError
          );

          try{
            window.dispatchEvent(
              new CustomEvent(
                "albukhrAuthFailed",
                {
                  detail:{
                    error:
                      lastError?.message ||
                      String(
                        lastError ||
                        "Pi authentication failed."
                      )
                  }
                }
              )
            );
          }catch(_){}

          return null;

        }finally{
          authenticating = null;
        }
      })();

    return authenticating;
  }

  /* =========================================
     AUTH STATE
  ========================================= */
  function getCurrentUser(){
    return currentUser;
  }

  function isAuthenticated(){
    return Boolean(
      currentUser?.uid
    );
  }

  async function requireAuth(
    options = {}
  ){
    /*
     * Redirect is opt-in.
     * Page controllers decide whether they need
     * navigation after authentication failure.
     */
    const redirect =
      options.redirect === true;

    if(isAuthenticated()){
      return currentUser;
    }

    const user =
      await ensurePiAuth();

    if(user){
      return user;
    }

    if(
      redirect &&
      typeof window !== "undefined"
    ){
      const loginPage =
        options.loginPage ||
        "login.html";

      window.location.replace(
        loginPage
      );
    }

    return null;
  }

  function clearAuth(){
    currentUser = null;

    try{
      window.dispatchEvent(
        new CustomEvent(
          "albukhrAuthChanged",
          {
            detail:null
          }
        )
      );
    }catch(_){}
  }

  async function logout(){
    clearAuth();
    return true;
  }

  function getNetwork(){
    return getEnvironment();
  }

  function isInitialized(){
    return initialized;
  }

  function getAuthStatus(){
    let currentNetwork = null;
    let networkError = null;

    try{
      currentNetwork =
        getEnvironment();
    }catch(error){
      networkError =
        error?.message ||
        "Network unavailable";
    }

    return {
      initialized,
      initializedNetwork,
      currentNetwork,

      network_error:
        networkError,

      sdkReady:
        isPiSDKReady(),

      authenticated:
        isAuthenticated(),

      uid:
        currentUser?.uid || null,

      username:
        currentUser?.username || null
    };
  }

  /* =========================================
     GLOBAL API
  ========================================= */
  window.AlbukhrPiAuth = {
    initPi,
    loadPiSDK,
    ensurePiAuth,

    getCurrentUser,
    isAuthenticated,
    requireAuth,

    clearAuth,
    logout,

    getNetwork,
    isInitialized,
    isPiSDKReady,
    getAuthStatus
  };

  window.initPi = initPi;
  window.ensurePiAuth = ensurePiAuth;
  window.getCurrentUser = getCurrentUser;
  window.isPiSDKReady = isPiSDKReady;
  window.getAlbukhrPiAuthStatus =
    getAuthStatus;

  /* =========================================
     SDK PREPARATION
  ========================================= */
  function preparePiSDK(){
    try{
      loadPiSDK()
        .then(() => initPi())
        .catch(error => {
          console.warn(
            "ALBUKHR Pi SDK preparation failed:",
            error
          );
        });
    }catch(error){
      console.warn(
        "ALBUKHR Pi SDK preparation skipped:",
        error
      );
    }
  }

  if(
    document.readyState ===
    "loading"
  ){
    document.addEventListener(
      "DOMContentLoaded",
      preparePiSDK,
      {once:true}
    );
  }else{
    preparePiSDK();
  }

})();
