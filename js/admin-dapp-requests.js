alert(typeof window.supabaseClient);

const listBox = document.getElementById("adminList");

async function loadRequests() {

  try {

    const { data, error } = await supabaseClient
      .from("dapp_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    render(data || []);

  } catch (err) {

    listBox.innerHTML =
      `<div class="empty">Failed to load requests</div>`;

    alert(err.message);
  }
}

function render(data) {

  listBox.innerHTML = "";

  if (data.length === 0) {

    listBox.innerHTML =
      `<div class="empty">No requests found</div>`;

    return;
  }

  data.forEach((r) => {

    const receipt =
      r.receipt_image
      ? `
        <img
          src="${r.receipt_image}"
          style="max-width:100%;border-radius:10px"
        >
      `
      : `<em>No receipt uploaded</em>`;

    listBox.innerHTML += `

      <div class="card">

        <h3>${r.project_name || "-"}</h3>

        <div class="meta">
          👤 ${r.pi_user || "-"}<br>
          🛠 ${r.service_type || "-"}<br>
          📌 ${r.status || "-"}
        </div>

        <div class="desc">
          ${r.description || "-"}
        </div>

        <div class="receipt-box">
          <strong>Receipt Ref:</strong>
          ${r.receipt_ref || "-"}
          <br><br>
          ${receipt}
        </div>

      </div>

    `;
  });
}

loadRequests();
