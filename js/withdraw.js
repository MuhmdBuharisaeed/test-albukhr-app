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

  const existing = await db
  .from("withdraw_requests")
  .select("id,status")
  .eq("userid", user.uid)
  .in("status", ["pending","approved"]);

if(existing.data?.length){

  return {
    error:
      "You already have a pending or approved withdrawal request."
  };

}

  const fee =
  Number(amount) * 0.01;

const receive =
  Number(amount);

const result = await db
  .from("withdraw_requests")
  .insert([{
    userid: user.uid,
    project,
    amount,
    fee,
    receive,
    wallet,
    type,
    status: "pending"
  }]);

  if(result.error){
    return { error: result.error };
  }

  return { success: true };
};
