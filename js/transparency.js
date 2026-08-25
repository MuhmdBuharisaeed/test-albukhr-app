/* =========================================
   ALBUKHR TRANSPARENCY ENGINE v3 FINAL
   =========================================
   Universal Transparency feed
   Compatible with:
   - js/supabase-core.js
   - js/projects-engine.js
   - js/project-updates.js
   - projects table
   - project_updates / comments / reactions
   - project logo system

   ARCHITECTURE RULE
   -----------------
   Project identity MUST use logo/image metadata.
   Do NOT use emoji/icons as project identity.

   Supported project types:
   - core
   - internal
   - external

   Network isolation:
   - mainnet
   - testnet

   The active network is resolved from the ALBUKHR
   environment engine / Supabase core where available.
========================================= */

const transparencyState = {
  openComments: {},
  expandedDescriptions: {},
  loading: false,
  lastFeed: [],
  lastRequestId: 0,
  activeNetwork: null
};

const transparencyEls = {
  feed: document.getElementById("projectFeed"),
  filterProjectCode: document.getElementById("filterProjectCode"),
  filterProjectType: document.getElementById("filterProjectType"),
  filterSort: document.getElementById("filterSort"),
  refreshFeedBtn: document.getElementById("refreshFeedBtn")
};

/* =========================================
   SAFE HELPERS
========================================= */

function safeString(value, fallback = ""){
  if(value === null || value === undefined) return fallback;
  return String(value);
}

function safeArray(value){
  return Array.isArray(value) ? value : [];
}

function safeNumber(value, fallback = 0){
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function escapeHtml(text = ""){
  return safeString(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showAlertMessage(title, text){
  if(typeof openAppAlert === "function"){
    openAppAlert(title, text);
    return;
  }

  alert(`${title}\n\n${text}`);
}

function safeOpenNotifications(){
  try{
    if(typeof openNotifications === "function"){
      openNotifications();
    }
  }catch(err){
    console.warn("openNotifications warning:", err);
  }
}

/* =========================================
   NETWORK RESOLUTION
========================================= */

function normalizeAlbukhrNetwork(value){
  const network = safeString(value).trim().toLowerCase();

  if(network === "mainnet") return "mainnet";
  if(network === "testnet") return "testnet";

  return "";
}

function getCurrentAlbukhrNetwork(){
  const candidates = [];

  try{
    if(typeof getAlbukhrCurrentNetwork === "function"){
      candidates.push(getAlbukhrCurrentNetwork());
    }
  }catch(e){
    console.warn("getAlbukhrCurrentNetwork warning:", e);
  }

  try{
    if(typeof window.getAlbukhrNetwork === "function"){
      candidates.push(window.getAlbukhrNetwork());
    }
  }catch(e){
    console.warn("getAlbukhrNetwork warning:", e);
  }

  try{
    if(typeof window.getCurrentNetwork === "function"){
      candidates.push(window.getCurrentNetwork());
    }
  }catch(e){
    console.warn("getCurrentNetwork warning:", e);
  }

  candidates.push(
    document.documentElement?.dataset?.network,
    document.body?.dataset?.network,
    window.ALBUKHR_NETWORK,
    window.albukhrNetwork
  );

  for(const value of candidates){
    const normalized = normalizeAlbukhrNetwork(value);
    if(normalized) return normalized;
  }

  const host = safeString(window.location?.hostname).toLowerCase();

  if(
    host === "test.albukhr.com" ||
    host.includes("test.")
  ){
    return "testnet";
  }

  if(
    host === "app.albukhr.com" ||
    host === "albukhr.com" ||
    host.endsWith(".albukhr.com")
  ){
    return "mainnet";
  }

  return "testnet";
}

function getTransparencyNetwork(){
  if(!transparencyState.activeNetwork){
    transparencyState.activeNetwork = getCurrentAlbukhrNetwork();
  }

  return transparencyState.activeNetwork;
}

function assertNetworkMatch(row, context = "project"){
  const expected = getTransparencyNetwork();

  if(!expected) return true;

  const actual = normalizeAlbukhrNetwork(
    row?.network ||
    row?.raw?.network
  );

  /*
    Older records may not have network metadata.
    We do not fabricate a network for them here.
    They are allowed through only when the upstream
    project-updates engine already performed network
    isolation.
  */
  if(!actual) return true;

  if(actual !== expected){
    console.warn(
      `Transparency network isolation: skipped ${context} ` +
      `because row network is ${actual}, active network is ${expected}.`
    );
    return false;
  }

  return true;
}

/* =========================================
   VIEWER
========================================= */

function getViewer(){
  if(typeof getTransparencyViewerMeta === "function"){
    try{
      return getTransparencyViewerMeta();
    }catch(e){
      console.warn("getTransparencyViewerMeta warning:", e);
    }
  }

  return {
    email:
      localStorage.getItem("albukhr_current_email") ||
      localStorage.getItem("currentUserEmail") ||
      "",
    name:
      localStorage.getItem("albukhr_current_username") ||
      localStorage.getItem("currentUserName") ||
      "ALBUKHR User",
    role:
      localStorage.getItem("albukhr_current_role") ||
      "user"
  };
}

/* =========================================
   FILTERS
========================================= */

function getFeedFilters(){
  return {
    projectCode:
      transparencyEls.filterProjectCode
        ? safeString(transparencyEls.filterProjectCode.value).trim()
        : "",

    projectType:
      transparencyEls.filterProjectType
        ? safeString(transparencyEls.filterProjectType.value).trim().toLowerCase()
        : "",

    sort:
      transparencyEls.filterSort
        ? safeString(transparencyEls.filterSort.value).trim() || "latest"
        : "latest"
  };
}

/* =========================================
   DATE HELPERS
========================================= */

function formatDisplayDate(value){
  if(!value) return "—";

  const d = new Date(value);

  if(Number.isNaN(d.getTime())) return "—";

  return d.toLocaleString();
}

function timeAgo(value){
  if(!value) return "Just now";

  const time = new Date(value).getTime();

  if(!Number.isFinite(time)) return "Just now";

  const seconds = Math.max(
    0,
    Math.floor((Date.now() - time) / 1000)
  );

  let interval = Math.floor(seconds / 31536000);

  if(interval >= 1){
    return interval + " year" + (interval > 1 ? "s" : "") + " ago";
  }

  interval = Math.floor(seconds / 2592000);

  if(interval >= 1){
    return interval + " month" + (interval > 1 ? "s" : "") + " ago";
  }

  interval = Math.floor(seconds / 86400);

  if(interval >= 1){
    return interval + " day" + (interval > 1 ? "s" : "") + " ago";
  }

  interval = Math.floor(seconds / 3600);

  if(interval >= 1){
    return interval + " hour" + (interval > 1 ? "s" : "") + " ago";
  }

  interval = Math.floor(seconds / 60);

  if(interval >= 1){
    return interval + " minute" + (interval > 1 ? "s" : "") + " ago";
  }

  return "Just now";
}

/* =========================================
   SORT
========================================= */

function sortFeed(feed = [], sort = "latest"){
  const copy = [...safeArray(feed)];

  copy.sort((a, b) => {
    const at = safeNumber(
      a.time_ms ||
      new Date(a.created_at || 0).getTime(),
      0
    );

    const bt = safeNumber(
      b.time_ms ||
      new Date(b.created_at || 0).getTime(),
      0
    );

    if(sort === "oldest"){
      return at - bt;
    }

    return bt - at;
  });

  return copy;
}

/* =========================================
   SUPABASE READINESS
========================================= */

function ensureSupabaseReady(){
  if(typeof window.isAlbukhrSupabaseReady === "function"){
    try{
      return !!window.isAlbukhrSupabaseReady();
    }catch(e){
      console.warn("isAlbukhrSupabaseReady warning:", e);
    }
  }

  if(typeof window.getAlbukhrSupabaseClient === "function"){
    try{
      return !!window.getAlbukhrSupabaseClient();
    }catch(e){
      console.warn("getAlbukhrSupabaseClient warning:", e);
    }
  }

  if(
    window.albukhrSupabase ||
    window.supabaseClient ||
    window.sb
  ){
    return true;
  }

  return false;
}

/* =========================================
   PROJECT LOGO SYSTEM
   =========================================
   IMPORTANT:
   No emoji/icon fallback is allowed.
========================================= */

function getProjectLogoUrl(project = {}){
  const candidates = [
    project.logo_url,
    project.logoUrl,
    project.logo_path,
    project.logoPath,
    project.cover_image,
    project.coverImage,
    project.raw?.logo_url,
    project.raw?.logo_path
  ];

  for(const candidate of candidates){
    const value = safeString(candidate).trim();

    if(value){
      return value;
    }
  }

  return "";
}

function getProjectLogoMarkup(project = {}, alt = "Project logo"){
  const logoUrl = getProjectLogoUrl(project);

  if(!logoUrl){
    return `
      <div class="project-logo project-logo-missing"
           aria-label="Project logo unavailable"
           title="Project logo unavailable">
        <span class="project-logo-placeholder">Project</span>
      </div>
    `;
  }

  return `
    <div class="project-logo">
      <img
        src="${escapeHtml(logoUrl)}"
        alt="${escapeHtml(alt)}"
        loading="lazy"
        decoding="async"
        onerror="this.closest('.project-logo')?.classList.add('logo-load-failed');"
      />
    </div>
  `;
}

/*
  Public helper for other page code if needed.
*/
window.getTransparencyProjectLogoUrl = getProjectLogoUrl;
window.getTransparencyProjectLogoMarkup = getProjectLogoMarkup;

/* =========================================
   PROJECT METADATA RESOLUTION
========================================= */

async function resolveTransparencyProject(item){
  const projectCode = safeString(
    item?.project_code ||
    item?.project ||
    ""
  ).trim();

  if(!projectCode){
    return null;
  }

  try{
    if(typeof getProjectByCode === "function"){
      const project = await getProjectByCode(projectCode);

      if(project){
        return project;
      }
    }
  }catch(e){
    console.warn(
      "Transparency project registry lookup warning:",
      e
    );
  }

  /*
    Use metadata already attached to the feed item only
    as a secondary representation. Do not fabricate
    project identity.
  */
  return {
    project_code: projectCode,
    project_name:
      safeString(
        item?.project_name ||
        item?.project ||
        projectCode
      ),

    project_type:
      safeString(item?.project_type || "internal")
        .trim()
        .toLowerCase(),

    network:
      normalizeAlbukhrNetwork(item?.network),

    logo_url:
      safeString(item?.logo_url || ""),

    logo_path:
      safeString(item?.logo_path || "")
  };
}

/* =========================================
   IMAGE MODAL
========================================= */

window.openImageModal = function(src){
  const modal = document.getElementById("imageModal");
  const img = document.getElementById("modalImg");

  if(!src || !modal || !img) return;

  img.src = src;
  modal.style.display = "flex";
};

window.closeImageModal = function(){
  const modal = document.getElementById("imageModal");
  const img = document.getElementById("modalImg");

  if(modal){
    modal.style.display = "none";
  }

  if(img){
    img.src = "";
  }
};

/* =========================================
   RENDER FEED
========================================= */

async function prepareTransparencyItems(items = []){
  const prepared = [];

  for(const item of safeArray(items)){
    if(!assertNetworkMatch(item, "transparency update")){
      continue;
    }

    const project = await resolveTransparencyProject(item);

    if(project && !assertNetworkMatch(project, "project")){
      continue;
    }

    prepared.push({
      item,
      project
    });
  }

  return prepared;
}

async function renderFeed(feed = []){
  const items = safeArray(feed);

  if(!transparencyEls.feed){
    console.warn("Transparency feed element #projectFeed was not found.");
    return;
  }

  if(!items.length){
    transparencyEls.feed.className = "empty-feed";
    transparencyEls.feed.innerHTML =
      "No project updates found.";
    return;
  }

  const prepared = await prepareTransparencyItems(items);

  if(!prepared.length){
    transparencyEls.feed.className = "empty-feed";
    transparencyEls.feed.innerHTML =
      "No project updates found for this network.";
    return;
  }

  const html = prepared.map(({ item, project }) => {

    const id = safeString(item.id).trim();

    const projectName = safeString(
      project?.project_name ||
      item.project_name ||
      item.project ||
      item.project_code ||
      "Project"
    );

    const projectCode = safeString(
      project?.project_code ||
      item.project_code ||
      ""
    );

    const projectType = safeString(
      project?.project_type ||
      item.project_type ||
      "internal"
    ).toLowerCase();

    const projectTypeLabel =
      safeString(
        item.project_type_label ||
        item.type ||
        (
          projectType === "core"
            ? "Core Project"
            : projectType === "external"
              ? "External Project"
              : "Internal Project"
        )
      );

    const badgeClass =
      safeString(
        item.type_badge_class ||
        (
          projectType === "core"
            ? "core-badge"
            : projectType === "external"
              ? "external-badge"
              : "internal-badge"
        )
      );

    const title = safeString(item.title || "");
    const description = safeString(item.description || "");

    const imageUrl = safeString(
      item.image_url ||
      item.image ||
      ""
    );

    const createdByName = safeString(
      item.created_by_name ||
      "ALBUKHR Team"
    );

    const createdByRole = safeString(
      item.created_by_role ||
      ""
    );

    const createdAt = item.created_at || "";

    const comments = safeArray(item.comments);

    const likeCount = safeNumber(
      item.like_count,
      0
    );

    const dislikeCount = safeNumber(
      item.dislike_count,
      0
    );

    const userVote = safeString(
      item.user_vote || ""
    );

    const isExpanded =
      !!transparencyState.expandedDescriptions[id];

    const commentsOpen =
      !!transparencyState.openComments[id];

    const needsReadMore =
      description.length > 220;

    const projectLogo =
      getProjectLogoMarkup(
        project,
        `${projectName} logo`
      );

    const network =
      normalizeAlbukhrNetwork(
        project?.network ||
        item.network
      );

    return `
      <div class="timeline-card"
           data-project-code="${escapeHtml(projectCode)}"
           data-project-type="${escapeHtml(projectType)}"
           data-network="${escapeHtml(network)}">

        <div class="timeline-header">

          <div class="timeline-left">

            <div class="timeline-project-row">

              ${projectLogo}

              <div class="timeline-project-info">

                <div class="timeline-project">
                  ${escapeHtml(projectName)}
                </div>

                <div class="timeline-meta">

                  <span>
                    ${escapeHtml(projectCode || "—")}
                  </span>

                  <span>•</span>

                  <span>
                    ${escapeHtml(createdByName)}
                  </span>

                  ${
                    createdByRole
                      ? `
                        <span>•</span>
                        <span>
                          ${escapeHtml(createdByRole)}
                        </span>
                      `
                      : ""
                  }

                  <span>•</span>

                  <span>
                    ${escapeHtml(timeAgo(createdAt))}
                  </span>

                </div>

              </div>

            </div>

          </div>

          <div class="timeline-type ${escapeHtml(badgeClass)}">
            ${escapeHtml(projectTypeLabel)}
          </div>

        </div>

        ${
          title
            ? `
              <div class="timeline-title">
                ${escapeHtml(title)}
              </div>
            `
            : ""
        }

        ${
          imageUrl
            ? `
              <div class="image-wrapper">

                <img
                  src="${escapeHtml(imageUrl)}"
                  class="timeline-image"
                  alt="Project update image"
                  loading="lazy"
                  decoding="async"
                  onclick="openImageModal(${JSON.stringify(imageUrl)})"
                />

              </div>
            `
            : ""
        }

        <div class="timeline-desc ${
          isExpanded ? "expanded" : "collapsed"
        }">

          ${escapeHtml(
            description ||
            "No description provided."
          )}

        </div>

        ${
          needsReadMore
            ? `
              <div
                class="read-more"
                onclick="toggleReadMore('${escapeHtml(id)}')"
              >
                ${
                  isExpanded
                    ? "Show less"
                    : "Read more"
                }
              </div>
            `
            : ""
        }

        <div class="timeline-actions">

          <button
            class="${userVote === "like" ? "active" : ""}"
            onclick="handleReaction('${escapeHtml(id)}','like')"
          >
            👍 ${likeCount}
          </button>

          <button
            class="${userVote === "dislike" ? "active" : ""}"
            onclick="handleReaction('${escapeHtml(id)}','dislike')"
          >
            👎 ${dislikeCount}
          </button>

          <button
            onclick="toggleComments('${escapeHtml(id)}')"
          >
            💬 ${comments.length}
          </button>

        </div>

        ${
          commentsOpen
            ? `
              <div class="comment-box">

                <input
                  type="text"
                  id="comment-input-${escapeHtml(id)}"
                  placeholder="Write comment..."
                  maxlength="2000"
                />

                <button
                  onclick="handleAddComment('${escapeHtml(id)}')"
                >
                  Post
                </button>

              </div>

              <div class="comment-list">

                ${
                  comments.length
                    ? comments.map(comment => `
                        <div class="comment-item">

                          <div class="comment-author">
                            ${escapeHtml(
                              comment.commenter_name ||
                              "User"
                            )}
                          </div>

                          <div>
                            ${escapeHtml(
                              comment.comment_text ||
                              comment.text ||
                              ""
                            )}
                          </div>

                          <div class="comment-time">
                            ${escapeHtml(
                              timeAgo(
                                comment.created_at ||
                                comment.time_ms
                              )
                            )}
                          </div>

                        </div>
                      `).join("")
                    : `
                      <div class="muted">
                        No comments yet.
                      </div>
                    `
                }

              </div>
            `
            : ""
        }

        <div class="timeline-time">
          Published:
          ${escapeHtml(
            formatDisplayDate(createdAt)
          )}
        </div>

      </div>
    `;
  }).join("");

  transparencyEls.feed.className = "timeline-feed";
  transparencyEls.feed.innerHTML = html;
}

/* =========================================
   LOAD FEED
========================================= */

async function loadTransparencyFeed(forceMessage = false){

  const requestId =
    ++transparencyState.lastRequestId;

  if(
    transparencyState.loading &&
    !forceMessage
  ){
    return;
  }

  transparencyState.loading = true;

  try{

    transparencyState.activeNetwork =
      getCurrentAlbukhrNetwork();

    if(forceMessage && transparencyEls.feed){
      transparencyEls.feed.className = "loading";
      transparencyEls.feed.innerHTML =
        "Loading project updates...";
    }

    if(!ensureSupabaseReady()){
      throw new Error(
        "Supabase client is not ready. " +
        "Check js/supabase-core.js"
      );
    }

    if(typeof fetchTransparencyFeed !== "function"){
      throw new Error(
        "fetchTransparencyFeed() is missing. " +
        "Load js/project-updates.js"
      );
    }

    const viewer = getViewer();
    const filters = getFeedFilters();

    const feed = await fetchTransparencyFeed({
      projectCode: filters.projectCode,
      projectType: filters.projectType,
      visibleOnly: true,
      limit: 100,
      viewerEmail: viewer.email,
      network: transparencyState.activeNetwork
    });

    if(requestId !== transparencyState.lastRequestId){
      return;
    }

    const networkFiltered = safeArray(feed)
      .filter(item =>
        assertNetworkMatch(
          item,
          "transparency update"
        )
      );

    transparencyState.lastFeed =
      sortFeed(
        networkFiltered,
        filters.sort
      );

    await renderFeed(
      transparencyState.lastFeed
    );

  }catch(err){

    console.error(
      "Transparency feed load error:",
      err
    );

    if(transparencyEls.feed){
      transparencyEls.feed.className =
        "error-box";

      transparencyEls.feed.innerHTML = `
        Failed to load project updates.<br>
        <span class="muted">
          ${escapeHtml(
            err?.message ||
            "Unknown error"
          )}
        </span>
      `;
    }

  }finally{

    transparencyState.loading = false;

  }
}

/* =========================================
   READ MORE
========================================= */

window.toggleReadMore = function(id){

  transparencyState.expandedDescriptions[id] =
    !transparencyState.expandedDescriptions[id];

  renderFeed(
    transparencyState.lastFeed
  );
};

/* =========================================
   COMMENTS
========================================= */

window.toggleComments = function(id){

  transparencyState.openComments[id] =
    !transparencyState.openComments[id];

  renderFeed(
    transparencyState.lastFeed
  );
};

/* =========================================
   ADD COMMENT
========================================= */

window.handleAddComment = async function(updateId){

  try{

    const input =
      document.getElementById(
        `comment-input-${updateId}`
      );

    if(!input) return;

    const commentText =
      safeString(input.value).trim();

    if(!commentText){
      showAlertMessage(
        "Comment required",
        "Please write a comment first."
      );
      return;
    }

    const viewer = getViewer();

    if(!viewer.email){
      showAlertMessage(
        "Login required",
        "Please sign in before posting a comment."
      );
      return;
    }

    const feedItem =
      transparencyState.lastFeed.find(
        item =>
          safeString(item.id) ===
          safeString(updateId)
      );

    if(
      feedItem &&
      !assertNetworkMatch(
        feedItem,
        "comment target"
      )
    ){
      showAlertMessage(
        "Network mismatch",
        "This project update does not belong to the active ALBUKHR network."
      );
      return;
    }

    if(typeof postTransparencyComment === "function"){

      await postTransparencyComment(
        updateId,
        commentText,
        {
          ...viewer,
          network: getTransparencyNetwork()
        }
      );

    }else if(
      typeof addProjectUpdateComment === "function"
    ){

      await addProjectUpdateComment({
        updateId,
        commentText,
        commenterEmail: viewer.email,
        commenterName: viewer.name,
        commenterRole: viewer.role,
        network: getTransparencyNetwork()
      });

    }else{

      throw new Error(
        "Comment engine is missing."
      );

    }

    input.value = "";

    transparencyState.openComments[updateId] =
      true;

    await loadTransparencyFeed(false);

  }catch(err){

    console.error(
      "Add comment error:",
      err
    );

    showAlertMessage(
      "Comment failed",
      err?.message ||
      "Unable to post comment."
    );
  }
};

/* =========================================
   LIKE / DISLIKE
========================================= */

window.handleReaction = async function(
  updateId,
  voteType
){

  try{

    const viewer = getViewer();

    if(!viewer.email){
      showAlertMessage(
        "Login required",
        "Please sign in before reacting to an update."
      );
      return;
    }

    if(
      voteType !== "like" &&
      voteType !== "dislike"
    ){
      throw new Error(
        "Invalid reaction type."
      );
    }

    const feedItem =
      transparencyState.lastFeed.find(
        item =>
          safeString(item.id) ===
          safeString(updateId)
      );

    if(
      feedItem &&
      !assertNetworkMatch(
        feedItem,
        "reaction target"
      )
    ){
      showAlertMessage(
        "Network mismatch",
        "This project update does not belong to the active ALBUKHR network."
      );
      return;
    }

    if(
      typeof toggleTransparencyReaction ===
      "function"
    ){

      await toggleTransparencyReaction(
        updateId,
        voteType,
        {
          ...viewer,
          network: getTransparencyNetwork()
        }
      );

    }else if(
      typeof toggleProjectUpdateReaction ===
      "function"
    ){

      await toggleProjectUpdateReaction({
        updateId,
        reactorEmail: viewer.email,
        reactorName: viewer.name,
        reactorRole: viewer.role,
        voteType,
        network: getTransparencyNetwork()
      });

    }else{

      throw new Error(
        "Reaction engine is missing."
      );

    }

    await loadTransparencyFeed(false);

  }catch(err){

    console.error(
      "Reaction error:",
      err
    );

    showAlertMessage(
      "Reaction failed",
      err?.message ||
      "Unable to submit reaction."
    );
  }
};

/* =========================================
   REFRESH
========================================= */

if(transparencyEls.refreshFeedBtn){

  transparencyEls.refreshFeedBtn.addEventListener(
    "click",
    async function(){
      await loadTransparencyFeed(true);
    }
  );

}

if(transparencyEls.filterProjectCode){

  transparencyEls.filterProjectCode.addEventListener(
    "keydown",
    async function(e){

      if(e.key === "Enter"){
        await loadTransparencyFeed(true);
      }

    }
  );

}

if(transparencyEls.filterProjectType){

  transparencyEls.filterProjectType.addEventListener(
    "change",
    async function(){
      await loadTransparencyFeed(true);
    }
  );

}

if(transparencyEls.filterSort){

  transparencyEls.filterSort.addEventListener(
    "change",
    async function(){

      transparencyState.lastFeed =
        sortFeed(
          transparencyState.lastFeed,
          getFeedFilters().sort
        );

      await renderFeed(
        transparencyState.lastFeed
      );

    }
  );

}

/* =========================================
   AUTO RELOAD WHEN FEED CHANGES
========================================= */

window.addEventListener(
  "projectFeedUpdated",
  async function(){

    await loadTransparencyFeed(false);

  }
);

/* =========================================
   ENVIRONMENT CHANGE SUPPORT
========================================= */

window.addEventListener(
  "albukhrEnvironmentChanged",
  async function(event){

    const newNetwork =
      normalizeAlbukhrNetwork(
        event?.detail?.network ||
        event?.detail?.environment
      );

    if(newNetwork){
      transparencyState.activeNetwork =
        newNetwork;
    }else{
      transparencyState.activeNetwork =
        getCurrentAlbukhrNetwork();
    }

    transparencyState.lastFeed = [];

    await loadTransparencyFeed(true);

  }
);

window.addEventListener(
  "networkChanged",
  async function(){

    transparencyState.activeNetwork =
      getCurrentAlbukhrNetwork();

    transparencyState.lastFeed = [];

    await loadTransparencyFeed(true);

  }
);

/* =========================================
   DOCK ACTIVE STATE
   DO NOT MODIFY DOCK STRUCTURE
========================================= */

(function markActiveDock(){

  const current =
    location.pathname
      .split("/")
      .pop();

  document
    .querySelectorAll(".dock-item")
    .forEach(link => {

      if(
        link.getAttribute("href") ===
        current
      ){
        link.classList.add("active");
      }

    });

})();

/* =========================================
   HIDE / SHOW DOCK ON SCROLL
========================================= */

(function dockScrollBehaviour(){

  let lastScroll = 0;
  const threshold = 10;

  const dock =
    document.querySelector(".dock-nav");

  if(!dock) return;

  window.addEventListener(
    "scroll",
    () => {

      const current =
        window.pageYOffset;

      if(
        Math.abs(current - lastScroll) <=
        threshold
      ){
        return;
      }

      if(current > lastScroll){
        dock.classList.add("hide");
      }else{
        dock.classList.remove("hide");
      }

      lastScroll = current;

    }
  );

})();

/* =========================================
   START
========================================= */

document.addEventListener(
  "DOMContentLoaded",
  async function(){

    transparencyState.activeNetwork =
      getCurrentAlbukhrNetwork();

    if(typeof loadProjects === "function"){

      try{

        await loadProjects(true);

      }catch(e){

        console.warn(
          "Transparency project preload warning:",
          e
        );

      }

    }

    await loadTransparencyFeed(true);

    setInterval(
      async () => {

        /*
          Re-resolve the network on every refresh
          so environment switching cannot leave
          stale project data on screen.
        */
        transparencyState.activeNetwork =
          getCurrentAlbukhrNetwork();

        await loadTransparencyFeed(false);

      },
      90000
    );

  }
);
