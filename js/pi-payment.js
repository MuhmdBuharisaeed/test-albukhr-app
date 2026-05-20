/* ======================================
   PI PAYMENT ENGINE (SEPARATED)
====================================== */

async function payWithPi({amount, memo, metadata}){

  if(typeof Pi === "undefined"){
    throw new Error("Open inside Pi Browser");
  }

  return new Promise((resolve, reject) => {

    Pi.createPayment({

      amount,
      memo,
      metadata

    }, {

      onReadyForServerApproval: async function(paymentId){

        try{

          console.log("APPROVE:", paymentId);

          const res = await fetch(
            "https://test-albukhr-api.onrender.com/approve-payment",
            {
              method:"POST",
              headers:{
                "Content-Type":"application/json"
              },
              body: JSON.stringify({ paymentId })
            }
          );

          const data = await res.json();

          if(!data.success){
            throw new Error(data.error || "Approval failed");
          }

        }catch(err){

          console.error("❌ APPROVAL ERROR:", err);
        }

      },

      onReadyForServerCompletion: async function(paymentId, txid){

        try{

          console.log("COMPLETE:", paymentId);

          const res = await fetch(
            "https://test-albukhr-api.onrender.com/complete-payment",
            {
              method:"POST",
              headers:{
                "Content-Type":"application/json"
              },
              body: JSON.stringify({ paymentId, txid })
            }
          );

          const data = await res.json();

          if(!data.success){
            throw new Error(data.error || "Completion failed");
          }

          resolve({ paymentId, txid });

        }catch(err){

          console.error("❌ COMPLETE ERROR:", err);
          reject(err);

        }

      },

      onCancel: function(paymentId){
        console.warn("User cancelled:", paymentId);
        reject(new Error("User cancelled"));
      },

      onError: function(error){
        console.error("PI ERROR:", error);
        reject(error);
      }

    });

  });

}
