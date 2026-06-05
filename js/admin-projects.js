/* ===============================
   LOAD PROJECTS
=============================== */
async function loadProjects(){

  const { data, error } = await supabase
    .from("projects")
    .select("name");

  if(error){
    console.error(error);
    return;
  }

  const select =
    document.getElementById("adminProject");

  select.innerHTML =
    '<option value="">Select Project</option>';

  (data || []).forEach(project=>{

    select.innerHTML += `
      <option value="${project.name}">
        ${project.name}
      </option>
    `;

  });

}

/* ===============================
   ADMIN ADD WALLET
=============================== */
async function adminAddWallet(){

  if(isWalletLocked()){
    alert("Wallet locked");
    return;
  }

  const project =
    document.getElementById("adminProject").value;

  const amount =
    Number(
      document.getElementById("adminAmount").value
    );

  const type =
    document.getElementById("adminType").value;

  if(!project){
    alert("Select project");
    return;
  }

  if(!amount || amount <= 0){
    alert("Invalid amount");
    return;
  }

  const { error } = await supabase
    .from("transactions")
    .insert([{

      project,

      amount,

      type:
        type === "reward"
        ? "admin-credit"
        : type,

      fee: 0,

      wallet: "admin",

      created_at:
        new Date().toISOString()

    }]);

  if(error){

    console.error(error);

    alert("Insert failed");

    return;
  }

  alert("Wallet updated");

  refreshAdminWallet();

}
