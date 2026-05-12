/* =========================================
   ALBUKHR UNIFIED TRANSACTION ENGINE v2 (USER SAFE)
========================================= */

const TX_KEY = "albukhr_transactions";

/* =========================================
   CURRENT USER
========================================= */

function getCurrentUser(){
  try{
    return JSON.parse(localStorage.getItem("pi_user"));
  }catch{
    return null;
  }
}

/* =========================================
   STORAGE (USER FILTERED)
========================================= */

function getTransactions(){

  const currentUser = getCurrentUser();
  if(!currentUser) return [];

  try{

    const data =
      JSON.parse(localStorage.getItem(TX_KEY)) || [];

    if(!Array.isArray(data)) return [];

    return data.filter(
      tx => tx.userId === currentUser.uid   // 🔥 IMPORTANT
    );

  }catch{
    return [];
  }

}

function saveTransactions(list){

  const currentUser = getCurrentUser();
  if(!currentUser) return;

  const all =
    JSON.parse(localStorage.getItem(TX_KEY)) || [];

  /* keep other users */
  const others = all.filter(
    tx => tx.userId !== currentUser.uid
  );

  /* attach userId */
  const updated = list.map(tx=>({
    ...tx,
    userId: currentUser.uid
  }));

  localStorage.setItem(
    TX_KEY,
    JSON.stringify([...others, ...updated])
  );
}

/* =========================================
   RECORD TRANSACTION (USER SAFE)
========================================= */

function recordTx({
  type,
  project,
  amount,
  meta = {}
}){

  const currentUser = getCurrentUser();

  if(!currentUser){
    return {error:"User not logged in"};
  }

  const list = getTransactions();

  const tx = {
    id: "TX-" + Date.now(),
    userId: currentUser.uid,   // 🔥 CRITICAL
    type,                      // stake | reward | withdraw | capital
    project,
    amount: Number(amount) || 0,
    meta,
    status:"Successful",
    timestamp: Date.now()
  };

  list.push(tx);

  saveTransactions(list);

  return tx;
}

/* =========================================
   FILTER HELPERS
========================================= */

/* BY PROJECT */
function getTxByProject(project){
  return getTransactions()
    .filter(tx => tx.project === project);
}

/* BY TYPE */
function getTxByType(type){
  return getTransactions()
    .filter(tx => tx.type === type);
}

/* RECENT */
function getRecentTx(limit = 20){
  return getTransactions()
    .slice()
    .sort((a,b)=>b.timestamp - a.timestamp)
    .slice(0, limit);
}
