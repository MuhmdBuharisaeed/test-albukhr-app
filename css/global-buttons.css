/* ======================================
   ALBUKHR GLOBAL BOTTOM NAV
====================================== */
:root{
  --albukhr-gold:#d4af37;
  --albukhr-gold-light:#f6d776;
  --albukhr-gold-dark:#b8962e;
}

.dock-nav{
  position:fixed;
  bottom:20px;
  left:50%;
  transform:translateX(-50%);
  width:92%;
  max-width:520px;
  height:70px;

  display:flex;
  justify-content:space-around;
  align-items:center;

  border-radius:40px;

  background:linear-gradient(
    135deg,
    rgba(15,122,61,0.85),
    rgba(20,157,82,0.85)
  );

  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);

  box-shadow:
    0 14px 40px rgba(0,0,0,0.28),
    inset 0 2px 6px rgba(255,255,255,0.15);

  z-index:1000;
}

/* nav item */

.dock-item{
  flex:1;
  text-align:center;
  text-decoration:none;

  font-size:10px;
  color:#e6f5ec;

  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;

  position:relative;

  transition:.25s ease;
}

/* icon */

.dock-icon{
  width:26px;
  height:26px;
  stroke:#e6f5ec;
  stroke-width:2;
  margin-bottom:4px;
  transition:.25s ease;
}

/* active */

.dock-item.active{
  color:#fff;
  font-weight:600;
}

.dock-item.active .dock-icon{
  stroke:var(--albukhr-gold);

  transform:
    translateY(-4px)
    scale(1.15);

  filter:
    drop-shadow(0 0 6px rgba(212,175,55,.8))
    drop-shadow(0 0 12px rgba(212,175,55,.5));

  transition:all .25s ease;
}

.dock-item{
  transition:all .25s ease;
}

.dock-item:active{
  transform:scale(.92);
}

.dock-item:hover .dock-icon{
  transform:translateY(-2px) scale(1.08);
   }

/* active bubble */

.dock-item.active::before{
  content:"";
  position:absolute;

  top:-6px;
  bottom:-6px;
  left:50%;
  transform:translateX(-50%);

  width:70%;

  background:linear-gradient(
    180deg,
    rgba(212,175,55,0.25),
    rgba(212,175,55,0.08)
  );

  border-radius:20px;
  z-index:-1;
                }

/* active indicator */

.dock-item.active::after{
  content:"";
  position:absolute;

  bottom:-6px;
  left:50%;
  transform:translateX(-50%);

  width:6px;
  height:6px;

  background:var(--albukhr-gold);

  border-radius:50%;

  box-shadow:
    0 0 6px rgba(212,175,55,0.9),
    0 0 12px rgba(212,175,55,0.6);
}

/* tap animation */

.dock-item:active .dock-icon{
  transform:scale(.9);
}

@keyframes goldGlow{
  0%{filter:drop-shadow(0 0 3px rgba(212,175,55,.6))}
  50%{filter:drop-shadow(0 0 8px rgba(212,175,55,.9))}
  100%{filter:drop-shadow(0 0 3px rgba(212,175,55,.6))}
}

.dock-item.active .dock-icon{
  animation:goldGlow 2s ease-in-out infinite;
}
