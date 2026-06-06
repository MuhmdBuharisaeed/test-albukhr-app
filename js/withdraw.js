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

  if(error){
    alert(JSON.stringify(error));
    return { error };
  }

  return { success: true };
};
