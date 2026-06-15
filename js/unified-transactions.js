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

      // 🔥 PREVENT DUPLICATE STAKE
      if(t.type === "stake") return;

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

  return txs.sort((a,b)=>b.timestamp - a.timestamp);
}
