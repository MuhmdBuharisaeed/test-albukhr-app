const db = window.supabase.createClient(
  "https://qexmnghilahsvethlxem.supabase.co",
  "sb_publishable_mSbWlhVKdmSjasKJC50QYw_5wzgRMe2"
);

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

  const result = await db
    .from("withdraw_requests")
    .insert([{
      userid: user.uid,
      project,
      amount,
      wallet,
      type,
      status: "pending"
    }]);

  if(result.error){
    return { error: result.error };
  }

  return { success: true };
};
