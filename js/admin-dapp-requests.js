document.getElementById("adminList").innerHTML =
  "<h2 style='color:red'>JS STARTED</h2>";

alert("START");

const supabase = window.supabase.createClient(
  "https://qexmnghilahsvethlxem.supabase.co",
  "sb_publishable_mSbWlhVKdmSjasKJC50QYw_5wzgRMe2"
);

alert("CLIENT CREATED");

(async () => {

  const { data, error } = await supabase
    .from("dapp_requests")
    .select("*");

  alert(
    "DATA = " +
    JSON.stringify(data)
  );

  alert(
    "ERROR = " +
    JSON.stringify(error)
  );

})();
