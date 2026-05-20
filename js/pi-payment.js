// js/pi-payment.js

async function startPiPayment({ amount, memo }) {

  const user = await ensurePiAuth();

  if (!user?.uid) {
    alert("Pi login required");
    return;
  }

  return new Promise((resolve, reject) => {

    Pi.createPayment(
      {
        amount: amount,
        memo: memo,
        metadata: {
          userId: user.uid
        }
      },

      // 🔥 PAYMENT CALLBACKS
      {

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
