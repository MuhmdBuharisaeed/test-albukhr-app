// =======================================
// ALBUKHR STAKING ENGINE (LOCAL FINAL)
// Pi SDK Ready • No API • Mobile Safe
// =======================================

const SUPABASE_URL = "https://qexmnghilahsvethlxem.supabase.co";
const SUPABASE_KEY = "sb_publishable_mSbWlhVKdmSjasKJC50QYw_5wzgRMe2";

const INTERNAL_KEY = "albukhr_stakes";

/* ======================================
   STORAGE
====================================== */
function _safeParse(key){
  try{
    const data = JSON.parse(localStorage.getItem(key));
    return Array.isArray(data) ? data : [];
  }catch{
    return [];
  }
}

function _save(key,data){
  if(Array.isArray(data)){
    localStorage.setItem(key, JSON.stringify(data));
  }
}

/* ======================================
   USER
====================================== */

function getCurrentUser(){

  if(window.Pi && Pi.getUser){
    try{
      const u = Pi.getUser();

      if(u?.uid){
        return {
          uid: u.uid,
          username: u.username
        };
      }

    }catch(e){
      console.warn("Pi user not ready yet");
    }
  }

  return null; // ❗ kar ka saka test123 a production
}

/* ======================================
PROJECT RULES
====================================== */
const PROJECT_RULES = {
Raheem:{minStake:10},
Hauwal:{minStake:10},
Barsh:{minStake:10},
Khairat:{minStake:10},
Urban:{minStake:10},
Labbaika:{minStake:10},
Azman:{minStake:10}
};

function getMinStake(project){
return PROJECT_RULES?.[project]?.minStake || 0;
}

/* ======================================
REWARD RATES
====================================== */
function getRate(project,duration){
const table = {
Raheem:{30:0.01,60:0.025,90:0.05},
Hauwal:{30:0.02,60:0.04,90:0.08},
Khairat:{30:0.025,60:0.05,90:0.09},
Barsh:{30:0.03,60:0.06,90:0.10},
Labbaika:{30:0.02,60:0.045,90:0.075},
Urban:{30:0.12,60:0.12,90:0.12},
Azman:{30:0.04,60:0.07,90:0.12}
};

return table?.[project]?.[Number(duration)] || 0;
}

/* ======================================
   ADD STAKE
====================================== */
let __stakingLock = false;

async function addStake({project,amount,duration}){

  if(__stakingLock){
    return {error:"Processing..."};
  }

  __stakingLock = true;

  let user = null;

try{

  user = await ensurePiAuth();

}catch(e){

  console.error("AUTH ERROR:", e);

}

if(!user?.uid){

  user = JSON.parse(
    localStorage.getItem("pi_user")
  );

}

if(!user?.uid){

  __stakingLock = false;

  alert(
    "Pi login required. Please reopen inside Pi Browser."
  );

  return {
    error:"Login required"
  };

}

  if(!user?.uid){
    __stakingLock = false;
    return {error:"User not logged in"};
  }

  /* 🔐 PI CHECK */
  if(typeof window.Pi === "undefined"){
    __stakingLock = false;
    return {error:"Pi SDK not ready"};
  }

  const safeAmount = Number(amount);
  const safeDuration = Number(duration);

  if(!project || safeAmount <= 0){
    __stakingLock = false;
    return {error:"Invalid input"};
  }

  if(safeAmount < getMinStake(project)){
    __stakingLock = false;
    return {error:"Minimum stake not reached"};
  }

  /* ===============================
     PI PAYMENT
  =============================== */
  let payment;

  try{

    payment = await startPiPayment({
  amount: safeAmount,
  memo: `Stake in ${project}`
});

  }catch(err){

  console.error("❌ REAL PAYMENT ERROR:", err);

  __stakingLock = false;

  alert(err.message || err);

  return {error:"Payment failed"};

  }

  console.log("PAYMENT RESULT:", payment);

if(!payment){
  __stakingLock = false;
  return {error:"Invalid payment"};
}

   /* SEND TO BACKEND */
try{

console.log("SAVING TO SUPABASE...");
   
  const res = await fetch("https://qexmnghilahsvethlxem.supabase.co/rest/v1/stakes",{
  method:"POST",
  headers:{
    "Content-Type":"application/json",
    "apikey":"sb_publishable_mSbWlhVKdmSjasKJC50QYw_5wzgRMe2",
    "Authorization":"Bearer sb_publishable_mSbWlhVKdmSjasKJC50QYw_5wzgRMe2"
  },
  body: JSON.stringify({
  userid:user.uid,
  project: project,
  amount:safeAmount,
  duration:safeDuration,
  txid: payment.txid || payment.paymentId || ("PI-"+Date.now()),
  reward: safeAmount * getRate(project, safeDuration),
  withdrawnReward:0,
  unlockTime: Date.now() + (safeDuration * 86400000),
  type:"stake"
})
});

  if(!res.ok){
  const err = await res.text();

console.error("❌ FULL SUPABASE ERROR:");
console.error(err);

alert(err);
  __stakingLock = false; // 🔥 VERY IMPORTANT

  return {error:"Database error"};
}

console.log("✅ Stake saved to Supabase");
   
}catch(e){

  console.error("❌ Supabase error", e);

  __stakingLock = false; // 🔥 ADD THIS

  return {
    error:"Network error"
  };

}

  /* ===============================
     RECORD TRANSACTION (FIX HISTORY)
  =============================== */

  if(typeof recordTx === "function"){
  recordTx({
    type:"stake",
    project,
    amount:safeAmount,
    timestamp:Date.now()
  });
}

__stakingLock = false;

return {
  success:true
};

} // 🔥 THIS LINE IS MISSING (rufe addStake)

/* ======================================
   GET ALL STAKES
====================================== */
async function getAllStakesMerged(){

  const user = JSON.parse(localStorage.getItem("pi_user"));

  if(!user?.uid){
    console.warn("No UID");
    return [];
  }

  try{

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/stakes?select=*&userid=eq.${user.uid}`,
      {
        headers:{
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if(!res.ok){
      const err = await res.text();
      console.error("❌ Fetch error:", err);
      return [];
    }

    const data = await res.json();

    console.log("📊 Supabase data:", data);

    return Array.isArray(data) ? data : [];

  }catch(e){

    console.error("❌ Network error:", e);
    return [];

  }

}
/* ======================================
   PROJECT TOTALS
====================================== */
async function getProjectTotals(project){

  const stakes = await getAllStakesMerged();

  const projectData = stakes.filter(s =>
  String(s.project).trim().toLowerCase() ===
String(project).trim().toLowerCase() &&
  (
    s.type === "stake" ||
    s.type === "withdraw" ||
    s.type === "capital"
  )
);
  let stake = 0;
  let reward = 0;

  projectData.forEach(s => {

    const amount = Number(s.amount);

    if(!Number.isFinite(amount)) return;

    // ✅ STAKE TOTAL
if(s.type === "stake"){
  stake += amount;
}

    // ✅ ONLY REAL STAKES FOR REWARD
    if(s.type === "stake"){

      const total = Number(s.reward) || 0;
      const withdrawn = Number(s.withdrawnReward) || 0;

      const remaining = Math.max(0, total - withdrawn);

      reward += remaining;

    }

  });

const user = JSON.parse(
  localStorage.getItem("pi_user")
);

if(user?.uid){

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/withdraw_requests?select=*&userid=eq.${user.uid}&project=eq.${project}&type=eq.capital&status=eq.paid`,
    {
      headers:{
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`
      }
    }
  );

  if(res.ok){

    const withdrawals = await res.json();

    withdrawals.forEach(w=>{

      stake -= Math.abs(
        Number(w.amount) || 0
      );

    });

  }

}
   
  return {
    stake,
    reward,
    stakes: projectData
  };

}

/* ======================================
   GET USER STAKE
====================================== */
async function getUserStakes(){

  const user = getCurrentUser();

  const res = await fetch(
  `${SUPABASE_URL}/rest/v1/stakes?select=*&userid=eq.${user.uid}`,
  {
    headers:{
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`
    }
  }
);
   
  const data = await res.json();

  return Array.isArray(data) ? data : [];
}

/* ======================================
   WITHDRAW PROJECT REWARD
====================================== */
async function withdrawProjectReward(project, amount){

  const user = await ensurePiAuth();

if(!user?.uid){
  __stakingLock = false;
  return {error:"Login required"};
}

  let remainingToTake = Number(amount);

  if(!Number.isFinite(remainingToTake) || remainingToTake <= 0){
    return {error:"Invalid amount"};
  }

  const res = await fetch(
  `${SUPABASE_URL}/rest/v1/stakes?select=*&userid=eq.${user.uid}`,
  {
    headers:{
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`
    }
  }
);
   
  if(!res.ok){
    const err = await res.text();
    console.error(err);
    return {error:"Network error"};
  }

  let stakes = await res.json();

  if(!Array.isArray(stakes) || !stakes.length){
    return {error:"No stakes"};
  }

  // 🔥 FIX: ONLY STAKES
  stakes = stakes.filter(s => s.type === "stake");

  for(const stake of stakes){

    const total = Number(stake.reward) || 0;
    const withdrawn = Number(stake.withdrawnReward) || 0;

    const remaining = total - withdrawn;

    if(!Number.isFinite(remaining) || remaining <= 0) continue;

    const take = Math.min(remainingToTake, remaining);

    if(!Number.isFinite(take)) continue;

    const updateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/stakes?id=eq.${stake.id}`,
      {
        method:"PATCH",
        headers:{
          "Content-Type":"application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`
        },
        body: JSON.stringify({
          withdrawnReward: withdrawn + take
        })
      }
    );

    if(!updateRes.ok){
      const err = await updateRes.text();
      console.error(err);
      return {error:"Update failed"};
    }

    remainingToTake -= take;

    if(remainingToTake <= 0) break;
  }

  if(remainingToTake > 0){
    return {error:"Insufficient reward"};
  }

  return {success:true, amount};
  }

/* ======================================
   LOAD DATA
====================================== */

async function loadData(){

  try{

    const stakes = await getAllStakesMerged();

    console.log("📊 STAKES:", stakes);

    // ❗ idan babu data, kada ka nuna error
    if(!Array.isArray(stakes)){
      console.warn("No data returned");
      return;
    }

    // OPTIONAL: update UI nan gaba

  }catch(e){

    console.error("❌ Load error:", e);

    // ❌ kar ka yi alert nan
  }

}

/* ======================================
   WITHDRAW CAPITAL (ENGINE)
====================================== */
async function withdrawCapital({project, amount}){

  const user = await ensurePiAuth();

if(!user?.uid){
  return {error:"Login required"};
}

  let remaining = Number(amount);

  if(!Number.isFinite(remaining) || remaining <= 0){
    return {error:"Invalid amount"};
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/stakes?project=eq.${project}&userid=eq.${user.uid}&order=created_at.asc`,
    {
      headers:{
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`
      }
    }
  );

  let stakes = await res.json();

  if(!Array.isArray(stakes)){
    return {error:"Invalid data"};
  }

  // ONLY REAL STAKES
stakes = stakes.filter(s => s.type === "stake");

const now = Date.now();

for(const s of stakes){

  if(remaining <= 0) break;

  // LOCK CHECK
  const unlockTime = Number(s.unlockTime) || 0;

  if(now < unlockTime){
    continue;
  }

  // AVAILABLE CAPITAL
  const available =
    (Number(s.amount) || 0) -
    (Number(s.withdrawnCapital) || 0);

  if(available <= 0){
    continue;
  }

  const take = Math.min(available, remaining);

  remaining -= take;
}

  if(remaining > 0){
    return {error:"Insufficient capital"};
  }

  return {success:true, amount};
}

/* ======================================
   HELPERS
====================================== */
function getStakes(){ return getAllStakesMerged(); }
function getInternalTotals(){ return getProjectTotals(); }
function getInternalProjectTotals(p){ return getProjectTotals(p); }
function addInternalStake(p){ return addStake(p); }
