const ALBUKHR_WALLET =
"GA6JI5N5HZIVG3VD5PM7W4U6DXPT73AZ5CHYURU2YJDPLPL77Q5KPCMD";

async function getWalletBalance(){

  try{

    const res = await fetch(
      `https://api.testnet.minepi.com/accounts/${ALBUKHR_WALLET}`
    );

    const data = await res.json();

    return Number(
      data?.balances?.[0]?.balance || 0
    );

  }catch(err){

    console.error(err);

    return 0;

  }

}
