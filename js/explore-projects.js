/* ===============================
   RENDER INTERNAL
================================ */
function renderInternal(q){

  internalList.innerHTML = "";

  const list = Object.keys(PROJECT_CONFIG)
    .map(name => ({
      name,
      ...PROJECT_CONFIG[name]
    }))
    .filter(p =>
      p.title.toLowerCase().includes(q)
    );

  if(list.length === 0){
    internalList.innerHTML =
      "<div class='empty'>No internal projects found</div>";
    return;
  }

  list.forEach(p=>{

    internalList.innerHTML += `
      <div class="project-card"
           onclick="window.location.href='project.html?project=${p.name}'"
           style="cursor:pointer;">

        <div class="project-icon">${p.icon}</div>

        <div class="project-body">

          <div class="project-title">${p.title}</div>

          <div class="project-desc">${p.desc}</div>

          <div class="project-meta">
            Minimum stake: ${
              typeof getMinStake === "function"
              ? getMinStake(p.name)
              : "--"
            } Pi
          </div>

          <span class="project-tag">Core</span>

        </div>

      </div>
    `;

  });

}
/* ===============================
   RENDER EXTERNAL
================================ */
function renderExternal(q){
  externalList.innerHTML = "";

  if(typeof getApprovedExternalProjects !== "function"){
    externalList.innerHTML =
      "<div class='empty'>External projects unavailable</div>";
    return;
  }

  const projects = getApprovedExternalProjects()
    .filter(p =>
      (p.title || "").toLowerCase().includes(q)
    );

  if(projects.length === 0){
    externalList.innerHTML =
      "<div class='empty'>No verified external projects</div>";
    return;
  }

  projects.forEach(p=>{
    externalList.innerHTML += `
      <div class="project-card"
           onclick="window.location.href='external-project.html?id=${p.projectId}'"
           style="cursor:pointer;">
        <div class="project-icon">🌍</div>
        <div class="project-body">
          <div class="project-title">${p.title}</div>
          <div class="project-desc">
            ${p.description || "Verified external project under escrow."}
          </div>
          <div class="project-meta">
            Escrow status: Locked
          </div>
          <span class="project-tag external">External</span>
        </div>
      </div>
    `;
  });
              }

function renderAll(){
  const q = searchInput.value.toLowerCase();
  renderInternal(q);
  renderExternal(q);
}

searchInput.addEventListener("input", renderAll);
renderAll();
