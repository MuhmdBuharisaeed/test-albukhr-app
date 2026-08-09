async function adminDeductReward(userId, project, amount){

  let remaining = Number(amount);

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/stakes?select=*&userid=eq.${userId}&project=eq.${project}`,
    {
      headers:{
        apikey: SUPABASE_KEY,
        Authorization:`Bearer ${SUPABASE_KEY}`
      }
    }
  );

  if(!res.ok){
    return { error:"Failed to fetch stakes" };
  }

  let stakes = await res.json();

  stakes = stakes.filter(s => s.type === "stake");

  for(const stake of stakes){

    const total = Number(stake.reward) || 0;
    const withdrawn = Number(stake.withdrawnReward) || 0;

    const available = total - withdrawn;

    if(available <= 0) continue;

    const take = Math.min(remaining, available);

    const patch = await fetch(
      `${SUPABASE_URL}/rest/v1/stakes?id=eq.${stake.id}`,
      {
        method:"PATCH",
        headers:{
          "Content-Type":"application/json",
          apikey: SUPABASE_KEY,
          Authorization:`Bearer ${SUPABASE_KEY}`
        },
        body: JSON.stringify({
          withdrawnReward: withdrawn + take
        })
      }
    );

    if(!patch.ok){
      return { error:"Reward update failed" };
    }

    remaining -= take;

    if(remaining <= 0) break;
  }

  return { success:true };
}
