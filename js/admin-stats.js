/* ===============================
   REQUEST STATS
=============================== */
async function loadRequestStats(){

  const today =
    new Date()
    .toISOString()
    .split("T")[0];

  // Pending

  const { count: pending } =
    await supabase
      .from("withdraw_requests")
      .select("*",{
        count:"exact",
        head:true
      })
      .eq("status","pending");

  // Approved

  const { count: approved } =
    await supabase
      .from("withdraw_requests")
      .select("*",{
        count:"exact",
        head:true
      })
      .eq("status","approved");

  // Rejected

  const { data: rejectedRows } =
    await supabase
      .from("withdraw_requests")
      .select("*")
      .eq("status","rejected");

  let rejectedToday = 0;

  (rejectedRows || []).forEach(row=>{

    if(
      row.updated_at &&
      row.updated_at.startsWith(today)
    ){
      rejectedToday++;
    }

  });

  // Paid Today

  const { data: txs } =
    await supabase
      .from("transactions")
      .select("*");

  let paidToday = 0;

  (txs || []).forEach(tx=>{

    if(
      (
        tx.type === "withdraw" ||
        tx.type === "capital"
      )
      &&
      tx.created_at?.startsWith(today)
    ){
      paidToday += Number(tx.amount) || 0;
    }

  });

  document.getElementById("pendingCount")
    .innerText = pending || 0;

  document.getElementById("approvedCount")
    .innerText = approved || 0;

  document.getElementById("paidToday")
    .innerText =
      paidToday.toFixed(2) + " Pi";

  document.getElementById("rejectedToday")
    .innerText =
      rejectedToday;

}
