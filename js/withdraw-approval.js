/* ===============================
FETCH REQUESTS
=============================== */
async function fetchWithdrawRequests(){

  const { data, error } = await supabase
    .from("withdraw_requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending:false });

  if(error){
    console.error(error);
    return [];
  }

  return data || [];
}

/* ===============================
RENDER REQUESTS
=============================== */
async function renderPendingRequests(){

  const box = document.getElementById("pendingRequests");
  if(!box) return;

  box.innerHTML = "Loading...";

  const requests = await fetchWithdrawRequests();

  if(!requests.length){
    box.innerHTML = "<small>No pending requests</small>";
    return;
  }

  box.innerHTML = "";

  requests.forEach(req => {

    box.innerHTML += `
      <div class="tx">
        <strong>${req.project}</strong><br>

        Type: ${req.type}<br>
        Amount: ${Number(req.amount).toFixed(2)} Pi<br>

        Wallet:
        ${req.wallet}<br>

        <small>
        ${new Date(req.created_at).toLocaleString()}
        </small><br><br>

        <button onclick="approveRequest('${req.id}')">
          ✅ Approve
        </button>

        <button onclick="rejectRequest('${req.id}')">
          ❌ Reject
        </button>
      </div>
    `;

  });

}

/* ===============================
APPROVE REQUEST
=============================== */
async function approveRequest(id){

  // 1. GET REQUEST
  const { data, error } = await supabase
    .from("withdraw_requests")
    .select("*")
    .eq("id", id)
    .single();

  if(error || !data){
    alert("Request not found");
    return;
  }

  // 2. 🔒 VALIDATION (ANTI-FRAUD)
  const { data: stakes } = await supabase
    .from("stakes")
    .select("*")
    .eq("userid", data.userid)
    .eq("project", data.project);

  let totalReward = 0;

  stakes.forEach(s => {
    const remaining =
      (Number(s.reward)||0) -
      (Number(s.withdrawnReward)||0);

    totalReward += Math.max(0, remaining);
  });

  if(data.type === "reward" && data.amount > totalReward){
    alert("Fraud detected");
    return;
  }

  // 3. CALCULATE
  const fee = data.amount * 0.01;
  const receive = data.amount - fee;

  // 4. INSERT TRANSACTION
  const { error: txError } = await supabase
    .from("transactions")
    .insert([{
      project: data.project,
      amount: receive,
      type: data.type === "reward" ? "withdraw" : "capital",
      fee: fee,
      wallet: data.wallet,
      created_at: new Date().toISOString()
    }]);

  if(txError){
    console.error(txError);
    alert("Transaction failed");
    return;
  }

  // 5. UPDATE REQUEST
  await supabase
    .from("withdraw_requests")
    .update({ status: "approved" })
    .eq("id", id);

  alert("Approved ✅");

  renderPendingRequests();
}

/* ===============================
REJECT REQUEST
=============================== */
async function rejectRequest(id){

  await supabase
    .from("withdraw_requests")
    .update({ status: "rejected" })
    .eq("id", id);

  alert("Rejected ❌");

  renderPendingRequests();
}
