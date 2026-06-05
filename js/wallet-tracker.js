/* ===============================
   ALBUKHR WALLET TRACKER
=============================== */

const ALBUKHR_WALLET =
"GA6JI5N5HZIVG3VD5PM7W4U6DXPT73AZ5CHYURU2YJDPLPL77Q5KPCMD";

/* ===============================
   ACCOUNT DATA
=============================== */
async function getWalletInfo(){

  const res = await fetch(
    `https://api.testnet.minepi.com/accounts/${ALBUKHR_WALLET}`
  );

  return await res.json();

}

/* ===============================
   LIVE BALANCE
=============================== */
async function getWalletBalance(){

  const data = await getWalletInfo();

  return Number(
    data?.balances?.[0]?.balance || 0
  );

}

/* ===============================
   TRANSACTIONS
=============================== */
async function getTransactions(){

  const res = await fetch(
    `https://api.testnet.minepi.com/accounts/${ALBUKHR_WALLET}/payments?limit=20&order=desc`
  );

  return await res.json();

}
