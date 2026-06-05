/* ===============================
   ALBUKHR WALLET TRACKER
=============================== */

const ALBUKHR_WALLET =
"GA6JI5N5HZIVG3VD5PM7W4U6DXPT73AZ5CHYURU2YJDPLPL77Q5KPCMD";

/* ===============================
   GET LIVE BALANCE
=============================== */
async function getWalletBalance(){

  try{

    const response = await fetch(
      `https://api.testnet.minepi.com/accounts/${ALBUKHR_WALLET}`
    );

    const data = await response.json();

    return Number(
      data?.balances?.[0]?.balance || 0
    );

  }catch(error){

    console.error(
      "Wallet Balance Error:",
      error
    );

    return 0;
  }

}

/* ===============================
   GET ACCOUNT INFO
=============================== */
async function getWalletInfo(){

  try{

    const response = await fetch(
      `https://api.testnet.minepi.com/accounts/${ALBUKHR_WALLET}`
    );

    return await response.json();

  }catch(error){

    console.error(
      "Wallet Info Error:",
      error
    );

    return null;
  }

}
