let lastScroll = 0;
let threshold = 10;

const dock =
document.querySelector(".dock-nav");

window.addEventListener("scroll",()=>{

const current =
window.pageYOffset;

if(Math.abs(current-lastScroll)<=threshold)
return;

if(current > lastScroll){

/* scroll down */
dock.classList.add("hide");

}else{

/* scroll up */
dock.classList.remove("hide");

}

lastScroll = current;

});


const current = location.pathname.split("/").pop();

document.querySelectorAll(".dock-item").forEach(link=>{

if(link.getAttribute("href") === current){

link.classList.add("active");

}

});
