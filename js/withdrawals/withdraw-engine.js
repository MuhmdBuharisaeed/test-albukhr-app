/* =========================================
   ALBUKHR WITHDRAW ENGINE v3
   NETWORK-AWARE / SUPABASE CORE
   =========================================

   LOCATION:
   - js/withdrawals/withdraw-engine.js

   DEPENDS ON:
   - js/environment-switcher.js
   - js/supabase-core.js
   - js/pi-auth.js

   PURPOSE:
   - Create reward/capital withdrawal requests
   - Use the single ALBUKHR Supabase client
   - Enforce Mainnet/Testnet isolation
   - No RPC
   - No LocalStorage dependency for auth/application state
   - Prevent duplicate active withdrawal requests
========================================= */

(function(){

  "use strict";

  const ACTIVE_STATUSES = ["pending", "approved"];

  function getCore(){

    if(
      typeof window.requireAlbukhrSupabaseClient !== "function"
    ){
      throw new Error(
        "ALBUKHR Supabase Core is not available."
      );
    }

    if(
      typeof window.requireAlbukhrNetwork !== "function"
    ){
      throw new Error(
        "ALBUKHR network engine is not available."
      );
    }

    if(
      typeof window.withAlbukhrNetwork !== "function" ||
      typeof window.assertAlbukhrNetworkValue !== "function"
    ){
      throw new Error(
        "ALBUKHR network safety helpers are not available."
      );
    }

    return {
      db: window.requireAlbukhrSupabaseClient(),
      network: window.requireAlbukhrNetwork()
    };
  }

  async function getAuthenticatedUser(){

    if(typeof window.ensurePiAuth !== "function"){
      throw new Error(
        "Pi authentication engine is not available."
      );
    }

    const user = await window.ensurePiAuth();

    if(!user?.uid){
      throw new Error(
        "User not logged in. Please log in again using Pi Browser."
      );
    }

    return user;
  }

  function validateInput({
    project,
    amount,
    wallet,
    type
  }){

    const numericAmount = Number(amount);

    if(
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ){
      throw new Error(
        "Invalid withdrawal amount."
      );
    }

    const cleanProject = String(project || "").trim();

    if(!cleanProject){
      throw new Error(
        "Project is required."
      );
    }

    const cleanWallet = String(wallet || "").trim();

    if(!cleanWallet){
      throw new Error(
        "Wallet address is required."
      );
    }

    if(
      type !== "reward" &&
      type !== "capital"
    ){
      throw new Error(
        "Invalid withdrawal type."
      );
    }

    return {
      amount: numericAmount,
      project: cleanProject,
      wallet: cleanWallet,
      type
    };
  }

  async function hasActiveWithdrawal(
    db,
    userid,
    network
  ){

    const result = await db
      .from("withdraw_requests")
      .select("id,status,network")
      .eq("userid", userid)
      .eq("network", network)
      .in("status", ACTIVE_STATUSES)
      .limit(1);

    if(result.error){
      throw new Error(
        result.error.message ||
        "Unable to check existing withdrawal requests."
      );
    }

    return Array.isArray(result.data) &&
      result.data.length > 0;
  }

  function calculateWithdrawal(amount){

    const fee = amount * 0.01;
    const receive = amount;

    return {
      amount,
      fee,
      receive,
      total_deduction: amount + fee
    };
  }

  async function createWithdrawRequest({
    project,
    amount,
    wallet,
    type
  } = {}){

    try{

      const core = getCore();

      const user = await getAuthenticatedUser();

      const input = validateInput({
        project,
        amount,
        wallet,
        type
      });

      const calculation =
        calculateWithdrawal(input.amount);

      const duplicate =
        await hasActiveWithdrawal(
          core.db,
          user.uid,
          core.network
        );

      if(duplicate){
        return {
          success: false,
          network: core.network,
          error:
            "You already have a pending or approved withdrawal request."
        };
      }

      const payload =
        window.withAlbukhrNetwork({

          userid: user.uid,

          project: input.project,

          amount: calculation.amount,

          fee: calculation.fee,

          receive: calculation.receive,

          wallet: input.wallet,

          type: input.type,

          status: "pending"

        });

      window.assertAlbukhrNetworkValue(
        payload.network
      );

      const result =
        await core.db
          .from("withdraw_requests")
          .insert([payload])
          .select(
            "id,userid,project,amount,fee,receive,wallet,type,status,created_at,network"
          )
          .single();

      if(result.error){

        return {
          success: false,
          network: core.network,
          error:
            result.error.message ||
            "Unable to submit withdrawal request."
        };
      }

      return {
        success: true,
        network: core.network,
        request: result.data
      };

    }catch(error){

      console.error(
        "ALBUKHR WITHDRAW ENGINE ERROR:",
        error
      );

      return {
        success: false,
        error:
          error?.message ||
          "Withdrawal request failed."
      };
    }
  }

  async function getMyWithdrawRequests({
    status = null
  } = {}){

    try{

      const core = getCore();
      const user = await getAuthenticatedUser();

      let query = core.db
        .from("withdraw_requests")
        .select(
          "id,userid,project,amount,fee,receive,wallet,type,status,created_at,network"
        )
        .eq("userid", user.uid)
        .eq("network", core.network)
        .order("created_at", {
          ascending: false
        });

      if(status){
        query = query.eq("status", status);
      }

      const result = await query;

      if(result.error){
        throw new Error(
          result.error.message ||
          "Unable to load withdrawal requests."
        );
      }

      return {
        success: true,
        network: core.network,
        requests: Array.isArray(result.data)
          ? result.data
          : []
      };

    }catch(error){

      console.error(
        "GET WITHDRAW REQUESTS ERROR:",
        error
      );

      return {
        success: false,
        requests: [],
        error:
          error?.message ||
          "Unable to load withdrawal requests."
      };
    }
  }

  async function getWithdrawalRequest(id){

    try{

      if(!id){
        throw new Error(
          "Withdrawal request ID is required."
        );
      }

      const core = getCore();
      const user = await getAuthenticatedUser();

      const result = await core.db
        .from("withdraw_requests")
        .select(
          "id,userid,project,amount,fee,receive,wallet,type,status,created_at,network"
        )
        .eq("id", id)
        .eq("userid", user.uid)
        .eq("network", core.network)
        .maybeSingle();

      if(result.error){
        throw new Error(
          result.error.message ||
          "Unable to load withdrawal request."
        );
      }

      return {
        success: true,
        network: core.network,
        request: result.data || null
      };

    }catch(error){

      console.error(
        "GET WITHDRAW REQUEST ERROR:",
        error
      );

      return {
        success: false,
        request: null,
        error:
          error?.message ||
          "Unable to load withdrawal request."
      };
    }
  }

  window.AlbukhrWithdrawEngine = {
    createWithdrawRequest,
    getMyWithdrawRequests,
    getWithdrawalRequest,
    calculateWithdrawal
  };

  /* Backward compatibility */
  window.createWithdrawRequest =
    createWithdrawRequest;

  console.log(
    "ALBUKHR Withdraw Engine v3 loaded."
  );

})();
