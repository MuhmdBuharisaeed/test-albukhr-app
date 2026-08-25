function showAlert(title, message){

  document.getElementById("appAlertTitle")
    .innerText = title;

  document.getElementById("appAlertText")
    .innerText = message;

  document.getElementById("appAlert")
    .style.display = "flex";
}

function closeAppAlert(){

  document.getElementById("appAlert")
    .style.display = "none";
}
