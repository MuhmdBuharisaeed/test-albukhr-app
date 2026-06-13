alert(typeof window.supabaseClient);

const listBox = document.getElementById("adminList");

async function loadRequests(){

  alert("START");

  const { data, error } =
  await window.supabaseClient
    .from("dapp_requests")
    .select("*");

  alert(
    "ERROR = " +
    JSON.stringify(error)
  );

  alert(
    "ROWS = " +
    (data ? data.length : 0)
  );

}

function render(data){

  alert("RENDER START");
  alert("ITEMS = " + data.length);

  listBox.innerHTML = `
    <div style="
      background:red;
      color:white;
      padding:20px;
      margin:20px;
    ">
      RENDER WORKING
    </div>
  `;

}

loadRequests();
