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

  const html = `
    <div style="
      background:red;
      color:white;
      padding:20px;
      margin:20px;
      border-radius:10px;
    ">
      REQUESTS FOUND: ${data.length}
    </div>
  `;

  document.getElementById("adminList").innerHTML = html;

  alert("RENDER DONE");
}

loadRequests();
