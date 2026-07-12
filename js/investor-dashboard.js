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
