(function(window,document){"use strict";
function go(card){let k=card.dataset.projectCode||card.dataset.projectSlug||card.dataset.projectId||card.dataset.projectKey;if(!k){const n=card.querySelector("h3,.project-title,.project-name");k=n?String(n.textContent).trim():""}if(k)location.assign("project.html?project="+encodeURIComponent(k))}
function handle(e){const c=e.target.closest(".project-card,.popular-card,.asset-item");if(!c||e.target.closest("a,button,input,textarea,select"))return;e.preventDefault();go(c)}
document.addEventListener("click",handle,true);document.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.closest(".project-card,.popular-card,.asset-item")){e.preventDefault();go(e.target.closest(".project-card,.popular-card,.asset-item"))}});
window.AlbukhrProjectNavigation=Object.freeze({navigate:go});
})(window,document);
