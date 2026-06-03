const supabase = window.supabase.createClient(
  "https://qexmnghilahsvethlxem.supabase.co",
  "sb_publishable_mSbWlhVKdmSjasKJC50QYw_5wzgRMe2"
);

const box = document.getElementById("list");

async function loadMyRequests(){

  let user = null;

  if(window.Pi && Pi.getUser){
    try{
      user = Pi.getUser();
    }catch(e){}
  }

  if(!user?.uid){

    box.innerHTML = `
      <div class="empty">
        Please login with Pi Browser.
      </div>
    `;

    return;
  }

  const { data, error } = await supabase
    .from("dapp_requests")
    .select("*")
    .eq("userid", user.uid)
    .order("created_at",{ascending:false});

  if(error){

    console.error(error);

    box.innerHTML = `
      <div class="empty">
        Failed to load requests.
      </div>
    `;

    return;
  }

  if(!data || !data.length){

    box.innerHTML = `
      <div class="empty">
        You have not submitted any dApp request yet.
      </div>
    `;

    return;
  }

  box.innerHTML = "";

  data.forEach(r=>{

    let telegram = "";
    let adminNote = "";

    if(r.status === "approved" && r.telegram_unlocked){

      telegram = `
        <a class="btn"
          href="https://t.me/+7A6IMz9PutMzZjVk"
          target="_blank">
          🔓 Join Private Telegram Group
        </a>
      `;
    }

    if(r.admin_note){

      adminNote = `
        <div class="notice">
          <strong>📝 Admin Note:</strong><br>
          ${r.admin_note}
        </div>
      `;
    }

    box.innerHTML += `
      <div class="card">

        <strong>${r.project_name}</strong>

        <div class="meta">
          🛠 ${r.service_type}<br>
          👤 ${r.pi_user}
        </div>

        <div class="status ${r.status}">
          Status: ${r.status.toUpperCase()}
        </div>

        <div class="desc">
          <strong>Description:</strong><br>
          ${r.description || "—"}
        </div>

        <div class="receipt">
          <strong>Payment Receipt:</strong><br>

          ${
            r.receipt_image
            ? `<img src="${r.receipt_image}" alt="Receipt">`
            : `<em>No receipt image</em>`
          }

          ${
            r.receipt_ref
            ? `<div style="font-size:12px;color:#666">
                Ref: ${r.receipt_ref}
              </div>`
            : ""
          }
        </div>

        ${adminNote}
        ${telegram}

      </div>
    `;
  });

}

loadMyRequests();
