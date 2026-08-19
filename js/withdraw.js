/* =========================================
   ALBUKHR WITHDRAW ENGINE v2
   NETWORK-AWARE
   =========================================

   DEPENDS ON:
   - js/supabase-core.js
   - js/pi-auth.js

   PURPOSE:
   - Create reward/capital withdrawal requests
   - Use single ALBUKHR Supabase client
   - Enforce Mainnet/Testnet isolation
   - No RPC
   - No LocalStorage dependency for auth
========================================= */

(function(){

  "use strict";


  /* =========================================
     CREATE WITHDRAW REQUEST
  ========================================= */

  window.createWithdrawRequest =
    async function({
      project,
      amount,
      wallet,
      type
    }){

      try{

        /* =====================================
           VALIDATE SUPABASE CORE
        ===================================== */

        if(
          typeof window.requireAlbukhrSupabaseClient !==
          "function"
        ){

          return {
            error:
              "ALBUKHR Supabase Core is not available."
          };

        }


        if(
          typeof window.requireAlbukhrNetwork !==
          "function"
        ){

          return {
            error:
              "ALBUKHR network engine is not available."
          };

        }


        /* =====================================
           GET CURRENT NETWORK
        ===================================== */

        const network =
          window.requireAlbukhrNetwork();


        /* =====================================
           GET SUPABASE CLIENT
        ===================================== */

        const db =
          window.requireAlbukhrSupabaseClient();


        /* =====================================
           GET AUTH USER
           
           IMPORTANT:
           Do NOT read pi_user from LocalStorage.
        ===================================== */

        let user = null;


        if(
          typeof window.ensurePiAuth ===
          "function"
        ){

          user =
            await window.ensurePiAuth();

        }


        if(!user?.uid){

          return {
            error:
              "User not logged in. Please log in again using Pi Browser."
          };

        }


        /* =====================================
           VALIDATE INPUT
        ===================================== */

        const numericAmount =
          Number(amount);


        if(
          !Number.isFinite(numericAmount) ||
          numericAmount <= 0
        ){

          return {
            error:
              "Invalid withdrawal amount."
          };

        }


        if(!wallet || !String(wallet).trim()){

          return {
            error:
              "Wallet address is required."
          };

        }


        if(
          type !== "reward" &&
          type !== "capital"
        ){

          return {
            error:
              "Invalid withdrawal type."
          };

        }


        if(
          !project ||
          !String(project).trim()
        ){

          return {
            error:
              "Project is required."
          };

        }


        /* =====================================
           FEE
           
           1% of requested withdrawal amount.
        ===================================== */

        const fee =
          numericAmount * 0.01;


        /* =====================================
           WALLET RECEIVE
           
           IMPORTANT:
           
           User requests:
             Amount       = 1.00 Pi
             Fee          = 0.01 Pi
             Receive      = 1.00 Pi
             Total         = 1.01 Pi
           
           Therefore receive is the requested
           withdrawal amount, while fee is added
           to the deduction requirement.
        ===================================== */

        const receive =
          numericAmount;


        /* =====================================
           CHECK EXISTING REQUEST
           
           NETWORK ISOLATED
        ===================================== */

        const existing =
          await db
            .from("withdraw_requests")
            .select(
              "id,status,network"
            )
            .eq(
              "userid",
              user.uid
            )
            .eq(
              "network",
              network
            )
            .in(
              "status",
              [
                "pending",
                "approved"
              ]
            );


        if(existing.error){

          console.error(
            "WITHDRAW EXISTING CHECK ERROR:",
            existing.error
          );

          return {
            error:
              existing.error.message ||
              "Unable to check existing withdrawal requests."
          };

        }


        if(
          Array.isArray(existing.data) &&
          existing.data.length > 0
        ){

          return {
            error:
              "You already have a pending or approved withdrawal request."
          };

        }


        /* =====================================
           NETWORK-SAFE PAYLOAD
        ===================================== */

        const payload =
          window.withAlbukhrNetwork({

            userid:
              user.uid,

            project:
              String(project).trim(),

            amount:
              numericAmount,

            fee:
              fee,

            receive:
              receive,

            wallet:
              String(wallet).trim(),

            type:
              type,

            status:
              "pending"

          });


        /* =====================================
           FINAL NETWORK ASSERTION
        ===================================== */

        window.assertAlbukhrNetworkValue(
          payload.network
        );


        /* =====================================
           INSERT REQUEST
        ===================================== */

        const result =
          await db
            .from("withdraw_requests")
            .insert([
              payload
            ])
            .select(
              "id,userid,project,amount,fee,receive,wallet,type,status,created_at,network"
            )
            .single();


        if(result.error){

          console.error(
            "WITHDRAW INSERT ERROR:",
            result.error
          );

          return {
            error:
              result.error.message ||
              "Unable to submit withdrawal request."
          };

        }


        /* =====================================
           SUCCESS
        ===================================== */

        return {

          success:
            true,

          network:
            network,

          request:
            result.data

        };


      }catch(e){

        console.error(
          "WITHDRAW ENGINE ERROR:",
          e
        );

        return {
          error:
            e?.message ||
            "Withdrawal request failed."
        };

      }

    };


})();
