(function(window,document){
"use strict";
document.addEventListener("click",e=>{
 const card=e.target.closest(".project-card,.popular-card,.asset-item");
 if(!card||e.target.closest("a,button,input,textarea,select"))return;
 const key=card.dataset.projectCode||card.dataset.projectKey||card.dataset.projectSlug||card.dataset.projectId;
 if(key){e.preventDefault();location.assign("project.html?project="+encodeURIComponent(key));}
},true);
})(window,document);
