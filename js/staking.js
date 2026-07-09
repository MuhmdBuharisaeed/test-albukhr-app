// =======================================
// ALBUKHR TESTNET STAKING ENGINE v1
// Pi Testnet • Supabase
// =======================================

const SUPABASE_URL =
"https://qexmnghilahsvethlxem.supabase.co";

const SUPABASE_KEY =
"sb_publishable_mSbWlhVKdmSjasKJC50QYw_5wzgRMe2";

const INTERNAL_KEY =
"albukhr_testnet_stakes";

/* ======================================
   STORAGE
====================================== */

function _safeParse(key){

  try{

    const data =
      JSON.parse(
        localStorage.getItem(key)
      );

    return Array.isArray(data)
      ? data
      : [];

  }catch{

    return [];

  }

}

function _save(key,data){

  if(Array.isArray(data)){

    localStorage.setItem(
      key,
      JSON.stringify(data)
    );

  }

}

/* ======================================
   CURRENT USER
====================================== */

function getCurrentUser(){

  try{

    if(window.Pi && Pi.getUser){

      const user = Pi.getUser();

      if(user?.uid){

        return{

          uid:user.uid,

          username:user.username || "",

          wallet_address:
            user.wallet_address || ""

        };

      }

    }

  }catch(e){

    console.warn(
      "Pi user not ready",
      e
    );

  }

  try{

    const localUser =
      JSON.parse(
        localStorage.getItem("pi_user")
      );

    if(localUser?.uid){
      return localUser;
    }

  }catch(e){}

  return null;

}

/* ======================================
   PROJECT RULES
====================================== */

const PROJECT_RULES={

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
   STAKING LOCK
====================================== */

let __stakingLock = false;

/* ======================================
   REWARD RATES
====================================== */

function getRate(project,duration){

const table={

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
   CREATE PENDING STAKE
====================================== */

async function createPendingStake({

user,

project,

amount,

duration

}){

const reward =
Number(amount) *
getRate(project,Number(duration));

const res = await fetch(

`${SUPABASE_URL}/rest/v1/stakes`,

{

method:"POST",

headers:{

"Content-Type":"application/json",

"apikey":SUPABASE_KEY,

"Authorization":
`Bearer ${SUPABASE_KEY}`,

"Prefer":"return=representation"

},

body:JSON.stringify({

userid:user.uid,

wallet:
user.wallet_address || "",

project,

amount:Number(amount),

duration:Number(duration),

reward,

withdrawnReward:0,

withdrawnCapital:0,

unlockTime:
Date.now() +
(Number(duration) * 86400000),

type:"stake",

status:"pending",

network:"testnet",

payment_id:null,

txid:null

})

}

);

if(!res.ok){

throw new Error(
await res.text()
);

}

const rows =
await res.json();

return rows[0];

}

/* ======================================
   UPDATE PENDING STAKE
====================================== */

async function updatePendingStake(
id,
values
){

const res = await fetch(

`${SUPABASE_URL}/rest/v1/stakes?id=eq.${id}&network=eq.testnet`,

{

method:"PATCH",

headers:{

"Content-Type":"application/json",

"apikey":SUPABASE_KEY,

"Authorization":
`Bearer ${SUPABASE_KEY}`

},

body:JSON.stringify(values)

}

);

if(!res.ok){

throw new Error(
await res.text()
);

}

return true;

   }

/* ======================================
   ADD STAKE (TESTNET)
====================================== */

async function addStake({

project,

amount,

duration

}){

if(__stakingLock){

return{
error:"Processing..."
};

}

__stakingLock = true;

try{

/* ===============================
GET USER
=============================== */

let user = null;

try{

user = await ensurePiAuth();

}catch(e){

console.warn(e);

}

if(!user?.uid){

user = getCurrentUser();

}

if(!user?.uid){

__stakingLock = false;

return{
error:"Login required"
};

}

/* ===============================
VALIDATION
=============================== */

const safeAmount =
Number(amount);

const safeDuration =
Number(duration);

if(!project){

__stakingLock = false;

return{
error:"Invalid project"
};

}

if(
!Number.isFinite(safeAmount) ||
safeAmount<=0
){

__stakingLock = false;

return{
error:"Invalid amount"
};

}

if(
safeAmount <
getMinStake(project)
){

__stakingLock = false;

return{
error:"Minimum stake not reached"
};

}

/* ===============================
CREATE PENDING
=============================== */

const pending =
await createPendingStake({

user,

project,

amount:safeAmount,

duration:safeDuration

});

/* ===============================
PI PAYMENT
=============================== */

let payment;

try{

payment =
await startPiPayment({

amount:safeAmount,

memo:
`Stake in ${project}`,

stakeId:
pending.id

});

}catch(error){

await updatePendingStake(

pending.id,

{

status:"cancelled"

}

);

__stakingLock=false;

return{

error:
error.message ||
"Payment cancelled"

};

}

/* ===============================
VERIFY PAYMENT
=============================== */

if(!payment){

await updatePendingStake(

pending.id,

{

status:"cancelled"

}

);

__stakingLock=false;

return{

error:"Payment failed"

};

}

/* ===============================
SUCCESS
=============================== */

await updatePendingStake(

pending.id,

{

payment_id:
payment.paymentId ||

payment.identifier ||

null,

txid:
payment.txid ||

payment.transaction?.txid ||

payment.paymentId ||

null,

status:"paid",

network:"testnet"

}

);

/* ===============================
TRANSACTION HISTORY
=============================== */

if(typeof recordTx==="function"){

recordTx({

type:"stake",

project,

amount:safeAmount,

timestamp:Date.now(),

network:"testnet"

});

}

__stakingLock=false;

return{

success:true,

payment

};

}catch(error){

console.error(error);

__stakingLock=false;

return{

error:
error.message ||
"Unknown staking error"

};

}

}

/* ======================================
   GET ALL STAKES (TESTNET)
====================================== */

async function getAllStakesMerged(){

const user = getCurrentUser();

if(!user?.uid){

return [];

}

try{

const res = await fetch(

`${SUPABASE_URL}/rest/v1/stakes?select=*&userid=eq.${user.uid}&network=eq.testnet&order=created_at.desc`,

{

headers:{

"apikey":SUPABASE_KEY,

"Authorization":
`Bearer ${SUPABASE_KEY}`

}

}

);

if(!res.ok){

throw new Error(
await res.text()
);

}

const data =
await res.json();

return Array.isArray(data)

? data.filter(s=>

s.status==="paid"

)

:[];

}catch(error){

console.error(

"GET STAKES:",

error

);

return [];

}

}

/* ======================================
   GLOBAL STAKES (TESTNET)
====================================== */

async function getGlobalStakes(){

try{

const res = await fetch(

`${SUPABASE_URL}/rest/v1/stakes?select=*&network=eq.testnet&status=eq.paid`,

{

headers:{

"apikey":SUPABASE_KEY,

"Authorization":
`Bearer ${SUPABASE_KEY}`

}

}

);

if(!res.ok){

throw new Error(
await res.text()
);

}

const data =
await res.json();

return Array.isArray(data)

?data

:[];

}catch(error){

console.error(

"GLOBAL:",

error

);

return[];

}

   }

/* ======================================
   USER STAKES (TESTNET)
====================================== */

async function getUserStakes(){

const user =
getCurrentUser();

if(!user?.uid){

return [];

}

try{

const res =
await fetch(

`${SUPABASE_URL}/rest/v1/stakes?select=*&userid=eq.${user.uid}&network=eq.testnet&status=eq.paid&order=created_at.desc`,

{

headers:{

apikey:SUPABASE_KEY,

Authorization:
`Bearer ${SUPABASE_KEY}`

}

}

);

if(!res.ok){

throw new Error(
await res.text()
);

}

const data =
await res.json();

return Array.isArray(data)

?data

:[];

}catch(e){

console.error(e);

return[];

}

}

/* ======================================
   WITHDRAW PROJECT REWARD (TESTNET)
====================================== */

async function withdrawProjectReward(
project,
amount
){

const user =
await ensurePiAuth();

if(!user?.uid){

return{
error:"Login required"
};

}

let remaining =
Number(amount);

if(
!Number.isFinite(remaining) ||
remaining<=0
){

return{
error:"Invalid amount"
};

}

try{

const res =
await fetch(

`${SUPABASE_URL}/rest/v1/stakes?select=*&userid=eq.${user.uid}&project=eq.${project}&network=eq.testnet&status=eq.paid&order=created_at.asc`,

{

headers:{

apikey:SUPABASE_KEY,

Authorization:
`Bearer ${SUPABASE_KEY}`

}

}

);

if(!res.ok){

throw new Error(
await res.text()
);

}

const stakes =
await res.json();

for(const stake of stakes){

const reward =
Number(stake.reward)||0;

const withdrawn =
Number(stake.withdrawnReward)||0;

const available =
reward-withdrawn;

if(available<=0){

continue;

}

const take =
Math.min(
available,
remaining
);

const update =
await fetch(

`${SUPABASE_URL}/rest/v1/stakes?id=eq.${stake.id}`,

{

method:"PATCH",

headers:{

"Content-Type":"application/json",

apikey:SUPABASE_KEY,

Authorization:
`Bearer ${SUPABASE_KEY}`

},

body:JSON.stringify({

withdrawnReward:
withdrawn+take

})

}

);

if(!update.ok){

throw new Error(
await update.text()
);

}

remaining -= take;

if(remaining<=0){

break;

}

}

if(remaining>0){

return{

error:
"Insufficient reward"

};

}

return{

success:true,

amount

};

}catch(e){

console.error(e);

return{

error:e.message

};

}

   }

/* ======================================
   WITHDRAW CAPITAL (TESTNET)
====================================== */

async function withdrawCapital({

project,

amount

}){

const user =
await ensurePiAuth();

if(!user?.uid){

return{

error:"Login required"

};

}

let remaining =
Number(amount);

if(
!Number.isFinite(remaining) ||
remaining<=0
){

return{

error:"Invalid amount"

};

}

try{

const res =
await fetch(

`${SUPABASE_URL}/rest/v1/stakes?select=*&userid=eq.${user.uid}&project=eq.${project}&network=eq.testnet&status=eq.paid&order=created_at.asc`,

{

headers:{

apikey:SUPABASE_KEY,

Authorization:
`Bearer ${SUPABASE_KEY}`

}

}

);

if(!res.ok){

throw new Error(
await res.text()
);

}

const stakes =
await res.json();

const now =
Date.now();

for(const stake of stakes){

if(remaining<=0){

break;

}

/* LOCK CHECK */

const unlockTime =
Number(stake.unlockTime)||0;

if(now<unlockTime){

continue;

}

/* AVAILABLE CAPITAL */

const available =

(Number(stake.amount)||0)

-

(Number(stake.withdrawnCapital)||0);

if(available<=0){

continue;

}

const take =
Math.min(
available,
remaining
);

const update =
await fetch(

`${SUPABASE_URL}/rest/v1/stakes?id=eq.${stake.id}`,

{

method:"PATCH",

headers:{

"Content-Type":"application/json",

apikey:SUPABASE_KEY,

Authorization:
`Bearer ${SUPABASE_KEY}`

},

body:JSON.stringify({

withdrawnCapital:

(Number(stake.withdrawnCapital)||0)

+

take

})

}

);

if(!update.ok){

throw new Error(
await update.text()
);

}

remaining -= take;

}

if(remaining>0){

return{

error:
"Insufficient unlocked capital"

};

}

return{

success:true,

amount

};

}catch(e){

console.error(e);

return{

error:e.message

};

}

   }

/* ======================================
   LOAD DATA
====================================== */

async function loadData(){

try{

const stakes =
await getAllStakesMerged();

console.log(
"TESTNET STAKES:",
stakes
);

return stakes;

}catch(error){

console.error(
"LOAD DATA:",
error
);

return[];

}

}

/* ======================================
   HELPERS
====================================== */

function getStakes(){

return getAllStakesMerged();

}

function getInternalTotals(){

return getProjectTotals();

}

function getInternalProjectTotals(project){

return getProjectTotals(project);

}

function addInternalStake(data){

return addStake(data);

}
