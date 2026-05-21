async function startPiPayment({amount, memo}){

  return new Promise((resolve, reject)=>{

    Pi.createPayment({
      amount: amount,
      memo: memo,
      metadata: {}
    }, {

      onReadyForServerApproval: async function(paymentId){

        console.log("APPROVING:", paymentId);

        try{
          const res = await fetch("https://test-albukhr-api.onrender.com/approve",{
            method:"POST",
            headers:{
              "Content-Type":"application/json"
            },
            body: JSON.stringify({ paymentId })
          });

          const data = await res.json();

          if(!data.success){
            throw new Error(data.error || "Approval failed");
          }

          console.log("APPROVED");

        }catch(e){
          console.error("APPROVE ERROR:", e);
          reject(e);
        }

      },

      onReadyForServerCompletion: async function(paymentId, txid){

        console.log("COMPLETING:", paymentId, txid);

        try{
          const res = await fetch("https://test-albukhr-api.onrender.com/complete",{
            method:"POST",
            headers:{
              "Content-Type":"application/json"
            },
            body: JSON.stringify({ paymentId, txid })
          });

          const data = await res.json();

          if(!data.success){
            throw new Error(data.error || "Completion failed");
          }

          console.log("COMPLETED");

          resolve({
            txid,
            paymentId
          });

        }catch(e){
          console.error("COMPLETE ERROR:", e);
          reject(e);
        }

      },

      onCancel: function(){
        reject("User cancelled");
      },

      onError: function(error){
        console.error("PI ERROR:", error);
        reject(error);
      }

    });

  });

}
