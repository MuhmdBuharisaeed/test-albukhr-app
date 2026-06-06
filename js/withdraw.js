alert("createWithdrawRequest running");

window.createWithdrawRequest = async function({
  project,
  amount,
  wallet,
  type
}){

  const user = JSON.parse(localStorage.getItem("pi_user"));

  if(!user?.uid){
    return { error: "User not logged in" };
  }

  const { error } = await supabase
  .from("withdraw_requests")
  .insert([{
    userid: user.uid,
    project,
    amount,
    wallet,
    type,
    status: "pending"
  }]);

console.log("INSERT ERROR:", error);
  
  const { error } = await supabase
    .from("withdraw_requests")
    .insert([{
      userid: user.uid,
      project,
      amount,
      wallet,
      type,
      status: "pending"
    }]);

  if(error){
    console.error("Withdraw insert error:", error);
    return { error };
  }

  return { success: true };
};

