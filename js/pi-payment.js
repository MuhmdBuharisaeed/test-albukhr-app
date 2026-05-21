// js/pi-payment.js

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
          await fetch("https://test-albukhr-api.onrender.com/approve",{
            method:"POST",
            headers:{
              "Content-Type":"application/json"
            },
            body: JSON.stringify({ paymentId })
          });
        }catch(e){
          console.error("APPROVE ERROR:", e);
          reject(e);
        }

      },

      onReadyForServerCompletion: async function(paymentId, txid){

        console.log("COMPLETING:", paymentId, txid);

        try{
          await fetch("https://test-albukhr-api.onrender.com/complete",{
            method:"POST",
            headers:{
              "Content-Type":"application/json"
            },
            body: JSON.stringify({ paymentId, txid })
          });

          // ✅ ONLY RETURN AFTER COMPLETE
          resolve({
            txid: txid,
            paymentId: paymentId
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

        // ===============================
        // SERVER APPROVAL
        // ===============================
        onReadyForServerApproval: async function (paymentId) {

          try {

            console.log("APPROVING:", paymentId);

            const res = await fetch(
              "https://test-albukhr-api.onrender.com/approve",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({ paymentId })
              }
            );

            const data = await res.json();

            if (!data.success) {
              throw new Error(data.error || "Approval failed");
            }

            console.log("APPROVED");

          } catch (err) {

            console.error("APPROVE ERROR:", err);
            reject(err);

          }
        },

        // ===============================
        // SERVER COMPLETE
        // ===============================
        onReadyForServerCompletion: async function (paymentId, txid) {

          try {

            console.log("COMPLETING:", paymentId);

            const res = await fetch(
              "https://test-albukhr-api.onrender.com/complete",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({ paymentId, txid })
              }
            );

            const data = await res.json();

            if (!data.success) {
              throw new Error(data.error || "Completion failed");
            }

            console.log("COMPLETED");

            resolve({
              paymentId,
              txid
            });

          } catch (err) {

            console.error("COMPLETE ERROR:", err);
            reject(err);

          }
        },

        // ===============================
        // CANCELLED
        // ===============================
        onCancel: function () {

          console.warn("User cancelled payment");
          reject(new Error("User cancelled"));

        },

        // ===============================
        // ERROR
        // ===============================
        onError: function (error) {

          console.error("Payment error:", error);
          reject(error);

        }

      }
    );

  });

}
