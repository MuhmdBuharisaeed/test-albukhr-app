const listBox = document.getElementById("adminList");

async function loadRequests(){

  try{

    const res = await fetch(
      "https://qexmnghilahsvethlxem.supabase.co/rest/v1/dapp_requests?order=created_at.desc",
      {
        headers:{
          apikey:"sb_publishable_mSbWlhVKdmSjasKJC50QYw_5wzgRMe2",
          Authorization:"Bearer sb_publishable_mSbWlhVKdmSjasKJC50QYw_5wzgRMe2"
        }
      }
    );

    const data = await res.json();

    if(!Array.isArray(data)){
      listBox.innerHTML =
        "<h3>Invalid response</h3>";
      return;
    }

    render(data);

  }catch(err){

    listBox.innerHTML =
      "<h3>Failed to load requests</h3>";

    alert(err.message);
  }
}

function render(data){

  listBox.innerHTML = "";

  if(data.length === 0){

    listBox.innerHTML =
      "<h3>No requests found</h3>";

    return;
  }

  data.forEach(r=>{

    const receipt =
      r.receipt_image
      ? `<img src="${r.receipt_image}"
           style="max-width:100%;border-radius:10px">`
      : "No receipt";

    listBox.innerHTML += `

      <div class="card">

        <h3>${r.project_name || "-"}</h3>

        <p>
          <b>User:</b>
          ${r.pi_user || "-"}
        </p>

        <p>
          <b>Service:</b>
          ${r.service_type || "-"}
        </p>

        <p>
          <b>Status:</b>
          ${r.status || "-"}
        </p>

        <p>
          <b>Description:</b><br>
          ${r.description || "-"}
        </p>

        <p>
          <b>Receipt Ref:</b>
          ${r.receipt_ref || "-"}
        </p>

        ${receipt}

      </div>

    `;
  });

}

loadRequests();
