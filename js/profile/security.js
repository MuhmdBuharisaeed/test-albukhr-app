const features = [

{
key:"app_lock",
icon:"🔒",
title:"App Lock",
desc:"Secure your account with a 6-digit PIN."
},

{
key:"private_account",
icon:"🕵️",
title:"Private Account",
desc:"Hide your profile from public leaderboard."
},

{
key:"biometric",
icon:"👆",
title:"Biometric Unlock",
desc:"Use fingerprint or face unlock for login."
},

{
key:"encrypt_data",
icon:"🛡️",
title:"Data Encryption",
desc:"Encrypt sensitive account and wallet data."
},

{
key:"tx_protection",
icon:"💳",
title:"Transaction Protection",
desc:"Extra verification before withdrawals."
}

];

function loadSecurity(){

const container =
document.getElementById("securityList");

container.innerHTML = "";

features.forEach(feature=>{

const enabled =
localStorage.getItem(feature.key) === "true";

const card =
document.createElement("div");

card.className = "security-card";

card.innerHTML = `

<div class="security-left">

<div class="security-icon">
${feature.icon}
</div>

<div class="security-info">

<h3>${feature.title}</h3>

<p>${feature.desc}</p>

</div>

</div>

<label class="switch">

<input
type="checkbox"
${enabled ? "checked" : ""}
onchange="toggleFeature('${feature.key}', this)"
>

<span class="slider"></span>

</label>

`;

container.appendChild(card);

});

}

function toggleFeature(key, el){

localStorage.setItem(
key,
el.checked
);

console.log(
key,
el.checked ? "enabled" : "disabled"
);

}

document.addEventListener(
"DOMContentLoaded",
loadSecurity
);
