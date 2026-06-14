/* ======================================
   ALBUKHR – UNIFIED TRANSACTION ENGINE v2
   SINGLE SOURCE OF TRUTH
====================================== */

function getAllTransactionsUnified(){

  let txs = [];

  /* ========= INTERNAL STAKES ========= */
  const internal = JSON.parse(
    localStorage.getItem("albukhr_stakes") || "[]"
  );

  internal.forEach(s=>{
    txs.push({
      source:"internal",
      project:s.project,
      amount:Number(s.amount) || 0,
      type:"stake",
      status:s.status || "Successful",
      timestamp:s.timestamp || Date.now()
    });
  });

  /* ========= EXTERNAL STAKES ========= */
  const external = JSON.parse(
    localStorage.getItem("albukhr_external_stakes") || "[]"
  );

  external.forEach(s=>{
    txs.push({
      source:"external",
      project:s.projectId,
      amount:Number(s.amount) || 0,
      type:"stake",
      status:s.status || "Successful",
      timestamp:s.timestamp || Date.now()
    });
  });

  /* ========= CORE TX ========= */
if(typeof getTransactions === "function"){

  getTransactions().forEach(t=>{

    const type =
      (t.type || "").toLowerCase();

    // Prevent duplicates
    if(
      type === "stake" ||
      type === "withdraw" ||
      type === "reward" ||
      type === "capital"
    ){
      return;
    }

    txs.push({
      source:"core",
      project:t.project,
      amount:Number(t.amount) || 0,
      type:t.type,
      status:t.status || "Successful",
      timestamp:t.timestamp || Date.now()
    });

  });

}

try{

  const user =
    JSON.parse(localStorage.getItem("pi_user"));

  if(user?.uid){

    const { data, error } =
      await supabase
        .from("withdraw_requests")
        .select("*")
        .eq("userid", user.uid);

    if(!error && data){

      data.forEach(w=>{

        txs.push({

          source:"withdraw",

          project:w.project,

          amount:Number(w.amount) || 0,

          type:w.type,

          status:w.status,

          wallet:w.wallet,

          txid:w.txid,

          timestamp:
            new Date(
              w.created_at
            ).getTime()

        });

      });

    }

  }

}catch(e){

  console.error(e);

}
