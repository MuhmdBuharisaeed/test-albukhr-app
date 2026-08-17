/* =========================================================
   ALBUKHR PI PROJECT TREASURY PAYMENT ENGINE v1

   PURPOSE:
   - Real Pi payment bridge for Universal Project Dashboard
   - Add Liquidity through Pi SDK
   - Verify payment through ALBUKHR payment server
   - Settle treasury only after blockchain completion
   - Withdraw through ALBUKHR withdrawal pipeline

   DEPENDS ON:
   - Pi SDK
   - js/smart-liquidity-engine.js
   - js/project-treasury.js
   - ALBUKHR payment server

   IMPORTANT:
   - NEVER place Pi API key here
   - NEVER place WALLET_PRIVATE_SEED here
   - NEVER trust client-side txid as proof
   - Treasury mutation happens only after server verification
========================================================= */

(function(){

  "use strict";


  /* =======================================================
     CONFIG
  ======================================================= */

  const CONFIG = {

    /*
      Change this to your actual payment server URL.

      Example:
      https://api.albukhr.com

      DO NOT put a trailing slash.
    */
    PAYMENT_SERVER_URL:
      window.ALBUKHR_PAYMENT_SERVER_URL ||
      "https://YOUR-PAYMENT-SERVER-DOMAIN",

    MEMO_PREFIX:
      "ALBUKHR PROJECT LIQUIDITY",

    PAYMENT_TIMEOUT:
      180000
  };


  /* =======================================================
     HELPERS
  ======================================================= */

  function safeString(value, fallback = ""){

    if(
      value === null ||
      value === undefined
    ){
      return fallback;
    }

    return String(value);

  }


  function safeNumber(value, fallback = 0){

    const n = Number(value);

    return Number.isFinite(n)
      ? n
      : fallback;

  }


  function getPaymentServerUrl(){

    const base =
      safeString(
        CONFIG.PAYMENT_SERVER_URL
      ).trim();

    if(
      !base ||
      base.includes("YOUR-PAYMENT-SERVER-DOMAIN")
    ){

      throw new Error(
        "ALBUKHR payment server URL has not been configured."
      );

    }

    return base.replace(/\/+$/, "");

  }


  async function postServer(path, payload = {}){

    const url =
      `${getPaymentServerUrl()}${path}`;

    const controller =
      new AbortController();

    const timer =
      setTimeout(
        () => controller.abort(),
        CONFIG.PAYMENT_TIMEOUT
      );

    try{

      const response =
        await fetch(
          url,
          {
            method:"POST",

            headers:{
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify(payload),

            signal:
              controller.signal
          }
        );


      let data = null;

      try{

        data =
          await response.json();

      }catch(_){

        data = null;

      }


      if(!response.ok){

        throw new Error(
          data?.error ||
          data?.message ||
          `Payment server error: ${response.status}`
        );

      }


      return data;

    }finally{

      clearTimeout(timer);

    }

  }


  function assertPiSdk(){

    if(
      typeof window.Pi === "undefined"
    ){

      throw new Error(
        "Pi SDK is not available. Open ALBUKHR inside Pi Browser."
      );

    }


    if(
      typeof window.Pi.createPayment !==
      "function"
    ){

      throw new Error(
        "Pi SDK payment function is not available."
      );

    }

  }


  /* =======================================================
     PAYMENT APPROVAL
  ======================================================= */

  async function approvePiPayment(paymentId){

    if(!paymentId){

      throw new Error(
        "Missing Pi payment ID."
      );

    }


    console.log(
      "[ALBUKHR PI] Approving:",
      paymentId
    );


    return await postServer(
      "/approve",
      {
        paymentId
      }
    );

  }


  /* =======================================================
     PAYMENT COMPLETION
  ======================================================= */

  async function completePiPayment(
    paymentId,
    txid
  ){

    if(!paymentId){

      throw new Error(
        "Missing payment ID."
      );

    }


    if(!txid){

      throw new Error(
        "Missing blockchain transaction ID."
      );

    }


    console.log(
      "[ALBUKHR PI] Completing:",
      {
        paymentId,
        txid
      }
    );


    return await postServer(
      "/complete",
      {
        paymentId,
        txid
      }
    );

  }


  /* =======================================================
     CREATE REAL PI PAYMENT
  ======================================================= */

  async function createPiPayment({

    amount,
    memo,
    metadata = {}

  } = {}){

    assertPiSdk();


    amount =
      safeNumber(
        amount,
        0
      );


    if(amount <= 0){

      throw new Error(
        "Invalid Pi payment amount."
      );

    }


    return await new Promise(
      (resolve, reject) => {

        let finished = false;


        function success(result){

          if(finished) return;

          finished = true;

          resolve(result);

        }


        function failure(error){

          if(finished) return;

          finished = true;

          reject(
            error instanceof Error
              ? error
              : new Error(
                  safeString(
                    error?.message ||
                    error ||
                    "Pi payment failed."
                  )
                )
          );

        }


        try{

          const paymentData = {

            amount,

            memo:
              safeString(
                memo ||
                CONFIG.MEMO_PREFIX
              ),

            metadata

          };


          console.log(
            "[ALBUKHR PI] Creating payment:",
            paymentData
          );


          window.Pi.createPayment(

            paymentData,

            {

              /* =====================================
                 PI SERVER APPROVAL
              ===================================== */

              onReadyForServerApproval:
                async function(paymentId){

                  try{

                    await approvePiPayment(
                      paymentId
                    );

                    console.log(
                      "[ALBUKHR PI] Server approval complete:",
                      paymentId
                    );

                  }catch(error){

                    console.error(
                      "[ALBUKHR PI] Approval failed:",
                      error
                    );

                    failure(error);

                  }

                },


              /* =====================================
                 PI SERVER COMPLETION
              ===================================== */

              onReadyForServerCompletion:
                async function(
                  paymentId,
                  txid
                ){

                  try{

                    const completed =
                      await completePiPayment(
                        paymentId,
                        txid
                      );


                    console.log(
                      "[ALBUKHR PI] Server completion:",
                      completed
                    );


                    success({

                      success:true,

                      paymentId,

                      txid,

                      server:
                        completed

                    });


                  }catch(error){

                    console.error(
                      "[ALBUKHR PI] Completion failed:",
                      error
                    );

                    failure(error);

                  }

                },


              /* =====================================
                 USER CANCEL
              ===================================== */

              onCancel:
                function(paymentId){

                  console.warn(
                    "[ALBUKHR PI] Payment cancelled:",
                    paymentId
                  );


                  failure(
                    new Error(
                      "Pi payment was cancelled."
                    )
                  );

                },


              /* =====================================
                 ERROR
              ===================================== */

              onError:
                function(error){

                  console.error(
                    "[ALBUKHR PI] SDK error:",
                    error
                  );


                  failure(error);

                }

            }

          );

        }catch(error){

          failure(error);

        }

      }
    );

  }


  /* =======================================================
     ADD PROJECT LIQUIDITY WITH REAL PI
  ======================================================= */

  async function addProjectLiquidityWithPiPayment(
    context = {}
  ){

    const projectCode =
      safeString(
        context.project_code
      ).trim();


    const projectName =
      safeString(
        context.project_name ||
        projectCode
      ).trim();


    const projectType =
      safeString(
        context.project_type ||
        "core"
      ).trim().toLowerCase();


    const amount =
      safeNumber(
        context.amount,
        0
      );


    if(!projectCode){

      return {
        success:false,
        error:"Project code is required."
      };

    }


    if(amount <= 0){

      return {
        success:false,
        error:"Invalid Pi amount."
      };

    }


    try{

      /* =========================================
         START REAL PI PAYMENT
      ========================================= */

      const payment =
        await createPiPayment({

          amount,

          memo:
            `${CONFIG.MEMO_PREFIX} - ${projectCode}`,

          metadata:{

            project_code:
              projectCode,

            project_name:
              projectName,

            project_type:
              projectType,

            action:
              "add_liquidity"

          }

        });


      if(
        !payment ||
        !payment.success ||
        !payment.txid
      ){

        throw new Error(
          "Pi payment was not blockchain-verified."
        );

      }


      /* =========================================
         SERVER-SIDE TREASURY SETTLEMENT

         IMPORTANT:

         This is deliberately NOT calling
         addProjectLiquidity() directly from
         the browser.

         Server must verify the payment first.
      ========================================= */

      const settlement =
        await postServer(
          "/settle-project-liquidity",
          {

            paymentId:
              payment.paymentId,

            txid:
              payment.txid,

            projectCode,

            projectName,

            projectType,

            amount

          }
        );


      if(
        !settlement ||
        settlement.success !== true
      ){

        throw new Error(
          settlement?.error ||
          "Blockchain payment succeeded but treasury settlement failed."
        );

      }


      return {

        success:true,

        action:
          "add_liquidity",

        project_code:
          projectCode,

        amount,

        paymentId:
          payment.paymentId,

        txid:
          payment.txid,

        settlement

      };


    }catch(error){

      console.error(
        "[ALBUKHR PI] Add liquidity failed:",
        error
      );


      return {

        success:false,

        error:
          error?.message ||
          "Pi liquidity payment failed."

      };

    }

  }


  /* =======================================================
     WITHDRAW PROJECT LIQUIDITY
  ======================================================= */

  async function withdrawProjectLiquidityWithPiPayment(
    context = {}
  ){

    const projectCode =
      safeString(
        context.project_code
      ).trim();


    const projectName =
      safeString(
        context.project_name ||
        projectCode
      ).trim();


    const projectType =
      safeString(
        context.project_type ||
        "core"
      ).trim().toLowerCase();


    const amount =
      safeNumber(
        context.amount,
        0
      );


    if(!projectCode){

      return {
        success:false,
        error:"Project code is required."
      };

    }


    if(amount <= 0){

      return {
        success:false,
        error:"Invalid withdrawal amount."
      };

    }


    /* =========================================
       SMART LIQUIDITY GUARD
    ========================================= */

    if(
      typeof window.canUseLiquidity !==
      "function"
    ){

      return {

        success:false,

        error:
          "Smart Liquidity Engine is not available."

      };

    }


    const guard =
      await window.canUseLiquidity(
        projectCode,
        amount
      );


    if(
      !guard ||
      guard.allowed !== true
    ){

      return {

        success:false,

        error:
          guard?.reason ||
          "Withdrawal blocked by liquidity protection."

      };

    }


    try{

      /* =========================================
         CREATE WITHDRAWAL REQUEST
      ========================================= */

      const result =
        await postServer(
          "/create-project-withdrawal",
          {

            projectCode,

            projectName,

            projectType,

            amount,

            source:
              "universal_project_dashboard"

          }
        );


      if(
        !result ||
        result.success !== true
      ){

        throw new Error(
          result?.error ||
          "Withdrawal request could not be created."
        );

      }


      return {

        success:true,

        action:
          "withdraw_liquidity",

        project_code:
          projectCode,

        amount,

        requestId:
          result.requestId,

        status:
          result.status ||

          "pending",

        message:
          result.message ||

          "Withdrawal request submitted for approval."

      };


    }catch(error){

      console.error(
        "[ALBUKHR PI] Withdrawal request failed:",
        error
      );


      return {

        success:false,

        error:
          error?.message ||
          "Withdrawal request failed."

      };

    }

  }


  /* =======================================================
     EXPORTS
  ======================================================= */

  window.ALBUKHR_PI_PROJECT_TREASURY_PAYMENT = {

    config:
      CONFIG,

    approvePiPayment,

    completePiPayment,

    createPiPayment,

    addProjectLiquidityWithPiPayment,

    withdrawProjectLiquidityWithPiPayment

  };


  window.addProjectLiquidityWithPiPayment =
    addProjectLiquidityWithPiPayment;


  window.withdrawProjectLiquidityWithPiPayment =
    withdrawProjectLiquidityWithPiPayment;


})();
