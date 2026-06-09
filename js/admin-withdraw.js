/* ===============================
   FETCH WITHDRAW REQUESTS
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
   RENDER PENDING REQUESTS
=============================== */
async function renderPendingRequests(){

  const box =
    document.getElementById("pendingRequests");

  box.innerHTML = "Loading...";

  try{

    const requests =
      await fetchWithdrawRequests();

    box.innerHTML =
      "<small>Requests Found: " +
      requests.length +
      "</small><hr>";

    if(!requests.length){

      box.innerHTML +=
        "<small>No pending requests</small>";

      return;
    }

    requests.forEach(req => {

      box.innerHTML += `
        <div class="tx">
          ${req.project}
          -
          ${req.amount} Pi
        </div>
      `;

    });

  }catch(error){

    box.innerHTML =
      `<small style="color:red">
        ${error.message}
      </small>`;

  }

}

/* ===============================
   APPROVE REQUEST
=============================== */
async function approveRequest(id){

  const { data, error } = await supabase
    .from("withdraw_requests")
    .select("*")
    .eq("id", id)
    .single();

  if(error || !data){

    alert("Request not found");

    return;
  }

  const { data: stakes } = await supabase
    .from("stakes")
    .select("*")
    .eq("userid", data.userid)
    .eq("project", data.project);

  let totalReward = 0;

  (stakes || []).forEach(s => {

    const remaining =
      (Number(s.reward) || 0) -
      (Number(s.withdrawnReward) || 0);

    totalReward += Math.max(0, remaining);

  });

  if(
    data.type === "reward" &&
    data.amount > totalReward
  ){
    alert("Fraud detected 🚨");
    return;
  }

  const fee =
    Number(data.amount) * 0.01;

  const receive =
    Number(data.amount) - fee;

  const { error: txError } =
    await supabase
      .from("transactions")
      .insert([{

        project: data.project,

        amount: receive,

        type:
          data.type === "reward"
          ? "withdraw"
          : "capital",

        fee: fee,

        wallet: data.wallet,

        created_at:
          new Date().toISOString()

      }]);

  if(txError){

    console.error(txError);

    alert("Transaction failed");

    return;
  }

  await supabase
    .from("withdraw_requests")
    .update({
      status: "approved"
    })
    .eq("id", id);

  alert("Approved ✅");

  renderPendingRequests();
  renderApprovedRequests();

}

/* ===============================
   REJECT REQUEST
=============================== */
async function rejectRequest(id){

  await supabase
    .from("withdraw_requests")
    .update({
      status: "rejected"
    })
    .eq("id", id);

  alert("Rejected");

  renderPendingRequests();

}

/* ===============================
   FETCH APPROVED
=============================== */
async function fetchApprovedRequests(){

  const { data, error } = await supabase
    .from("withdraw_requests")
    .select("*")
    .eq("status","approved")
    .order("created_at",{ascending:false});

  if(error){
    console.error(error);
    return [];
  }

  return data || [];

}

/* ===============================
   RENDER APPROVED
=============================== */
async function renderApprovedRequests(){

  const box =
    document.getElementById("approvedRequests");

  box.innerHTML = "Loading...";

  const requests =
    await fetchApprovedRequests();

  if(!requests.length){

    box.innerHTML =
      "<small>No approved requests</small>";

    return;
  }

  box.innerHTML = "";

  requests.forEach(req => {

    box.innerHTML += `
      <div class="tx">

        <strong>${req.project}</strong><br>

        Type: ${req.type}<br>

        Amount:
        ${Number(req.amount).toFixed(2)} Pi<br>

        Wallet:
        ${req.wallet}<br><br>

        <button
        onclick="markPaid('${req.id}')">

        💰 Mark Paid

        </button>

      </div>
    `;

  });

}

/* ===============================
   MARK PAID
=============================== */
async function markPaid(id){

  await supabase
    .from("withdraw_requests")
    .update({

      status: "paid",

      paid_at:
      new Date().toISOString()

    })
    .eq("id", id);

  alert("Marked as Paid");

  renderApprovedRequests();
  renderPaidRequests();

}

/* ===============================
   FETCH PAID
=============================== */
async function fetchPaidRequests(){

  const { data, error } = await supabase
    .from("withdraw_requests")
    .select("*")
    .eq("status","paid")
    .order("paid_at",{ascending:false});

  if(error){
    console.error(error);
    return [];
  }

  return data || [];

}

/* ===============================
   RENDER PAID
=============================== */
async function renderPaidRequests(){

  const box =
    document.getElementById("paidRequests");

  box.innerHTML = "Loading...";

  const requests =
    await fetchPaidRequests();

  if(!requests.length){

    box.innerHTML =
      "<small>No paid withdrawals</small>";

    return;
  }

  box.innerHTML = "";

  requests.forEach(req => {

    box.innerHTML += `
      <div class="tx">

        <strong>${req.project}</strong><br>

        Type: ${req.type}<br>

        Amount:
        ${Number(req.amount).toFixed(2)} Pi<br>

        Wallet:
        ${req.wallet}<br>

        <small>
        Paid:
        ${new Date(req.paid_at)
          .toLocaleString()}
        </small>

      </div>
    `;

  });

    }
