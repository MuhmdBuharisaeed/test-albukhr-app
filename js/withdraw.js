window.createWithdrawRequest = async function({
  project,
  amount,
  wallet,
  type
}){

  alert("step 1");

  const user = JSON.parse(localStorage.getItem("pi_user"));

  alert("step 2");

  if(!user?.uid){
    alert("User not logged in");
    return { error: "User not logged in" };
  }

  alert("step 3");

  try{

    const result = await supabase
      .from("withdraw_requests")
      .insert([{
        userid: user.uid,
        project,
        amount,
        wallet,
        type,
        status: "pending"
      }]);

    alert("step 4");

    alert(JSON.stringify(result));

    if(result.error){
      alert(JSON.stringify(result.error));
      return { error: result.error };
    }

    alert("step 5");

    return { success: true };

  }catch(e){

    alert("CATCH ERROR");
    alert(e.message);

    return { error: e.message };

  }
};
