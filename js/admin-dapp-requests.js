alert("START");

fetch(
  "https://qexmnghilahsvethlxem.supabase.co/rest/v1/dapp_requests",
  {
    headers:{
      apikey:"sb_publishable_mSbWlhVKdmSjasKJC50QYw_5wzgRMe2",
      Authorization:"Bearer sb_publishable_mSbWlhVKdmSjasKJC50QYw_5wzgRMe2"
    }
  }
)
.then(r=>r.json())
.then(data=>{

  alert(
    "ROWS = " + data.length
  );

  document.getElementById("adminList").innerHTML =
    "<pre>" +
    JSON.stringify(data[0], null, 2) +
    "</pre>";

})
.catch(err=>{

  alert(
    "ERROR = " + err.message
  );

});
