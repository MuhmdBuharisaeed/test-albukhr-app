const ALBUKHR_WALLET =
"GA6JI5N5HZIVG3VD5PM7W4U6DXPT73AZ5CHYURU2YJDPLPL77Q5KPCMD";

async function getWalletInfo(){

  const response = await fetch(
    `https://api.testnet.minepi.com/accounts/${ALBUKHR_WALLET}`
  );

  return await response.json();

}

async function getWalletBalance(){

  const data = await getWalletInfo();

  return Number(
    data?.balances?.[0]?.balance || 0
  );

}
