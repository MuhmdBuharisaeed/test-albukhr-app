/* =========================================================
   ALBUKHR TRANSPARENCY PAGE ENGINE v2
   Architecture:
   - js/core/supabase-core.js
   - js/projects/project-updates.js
   - js/projects/projects-engine.js
   - js/pages/transparency.js

   RULES:
   - UI/page layer only
   - No Supabase credentials
   - No direct Supabase REST calls
   - No LocalStorage persistence
   - Network identity comes from ALBUKHR Supabase Core
   - Data access is delegated to project-updates.js
========================================================= */

(function(){
  "use strict";

  const transparencyState = {
    openComments: {},
    expandedDescriptions: {},
    loading: false,
    lastFeed: [],
    lastRequestId: 0
  };

  const transparencyEls = {};

  function cacheElements(){
    transparencyEls.feed =
      document.getElementById("projectFeed");
    transparencyEls.filterProjectCode =
      document.getElementById("filterProjectCode");
    transparencyEls.filterProjectType =
      document.getElementById("filterProjectType");
    transparencyEls.filterSort =
      document.getElementById("filterSort");
    transparencyEls.refreshFeedBtn =
      document.getElementById("refreshFeedBtn");
  }

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
    if(typeof window.openAppAlert === "function"){
      window.openAppAlert(title, text);
      return;
    }
    window.alert(`${title}\n\n${text}`);
  }

  function getViewer(){
    /*
      IMPORTANT:
      Viewer identity is delegated to the shared authentication/session
      layer. This page deliberately does NOT read LocalStorage.
    */
    if(typeof window.getAlbukhrCurrentUser === "function"){
      return window.getAlbukhrCurrentUser() || null;
    }

    if(typeof window.getCurrentUser === "function"){
      return window.getCurrentUser() || null;
    }

    if(typeof window.getContributorSessionUser === "function"){
      return window.getContributorSessionUser() || null;
    }

    return null;
  }

  function getViewerEmail(){
    const viewer = getViewer() || {};
    return safeString(
      viewer.email ||
      viewer.email_address ||
      viewer.username_email ||
      ""
    ).trim().toLowerCase();
  }

  function getViewerName(){
    const viewer = getViewer() || {};
    return safeString(
      viewer.name ||
      viewer.full_name ||
      viewer.username ||
      "ALBUKHR User"
    );
  }

  function getViewerRole(){
    const viewer = getViewer() || {};
    return safeString(
      viewer.role ||
      viewer.user_role ||
      "user"
    );
  }

  function getFeedFilters(){
    return {
      projectCode:
        safeString(
          transparencyEls.filterProjectCode?.value
        ).trim(),

      projectType:
        safeString(
          transparencyEls.filterProjectType?.value
        ).trim(),

      sort:
        safeString(
          transparencyEls.filterSort?.value
        ).trim() || "latest"
    };
  }

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

    const seconds =
      Math.floor((Date.now() - time) / 1000);

    let interval =
      Math.floor(seconds / 31536000);

    if(interval >= 1){
      return interval +
        " year" +
        (interval > 1 ? "s" : "") +
        " ago";
    }

    interval =
      Math.floor(seconds / 2592000);

    if(interval >= 1){
      return interval +
        " month" +
        (interval > 1 ? "s" : "") +
        " ago";
    }

    interval =
      Math.floor(seconds / 86400);

    if(interval >= 1){
      return interval +
        " day" +
        (interval > 1 ? "s" : "") +
        " ago";
    }

    interval =
      Math.floor(seconds / 3600);

    if(interval >= 1){
      return interval +
        " hour" +
        (interval > 1 ? "s" : "") +
        " ago";
    }

    interval =
      Math.floor(seconds / 60);

    if(interval >= 1){
      return interval +
        " minute" +
        (interval > 1 ? "s" : "") +
        " ago";
    }

    return "Just now";
  }

  function sortFeed(feed = [], sort = "latest"){
    const copy = [...safeArray(feed)];

    copy.sort((a, b) => {
      const at =
        safeNumber(
          a.time_ms ||
          new Date(a.created_at || 0).getTime(),
          0
        );

      const bt =
        safeNumber(
          b.time_ms ||
          new Date(b.created_at || 0).getTime(),
          0
        );

      return sort === "oldest"
        ? at - bt
        : bt - at;
    });

    return copy;
  }

  function ensureArchitectureReady(){
    if(
      typeof window.getAlbukhrSupabaseClient !==
      "function"
    ){
      throw new Error(
        "js/core/supabase-core.js is not loaded."
      );
    }

    if(
      typeof window.getAlbukhrNetwork !==
      "function"
    ){
      throw new Error(
        "ALBUKHR network core is not available."
      );
    }

    if(
      typeof window.fetchTransparencyFeed !==
      "function"
    ){
      throw new Error(
        "js/projects/project-updates.js is not loaded."
      );
    }

    /*
      Force network resolution before loading data.
      This prevents a page from silently operating without
      Mainnet/Testnet identity.
    */
    window.getAlbukhrNetwork();

    return true;
  }

  window.openImageModal = function(src){
    const modal =
      document.getElementById("imageModal");

    const img =
      document.getElementById("modalImg");

    if(!src || !modal || !img) return;

    img.src = src;
    modal.style.display = "flex";
  };

  window.closeImageModal = function(){
    const modal =
      document.getElementById("imageModal");

    const img =
      document.getElementById("modalImg");

    if(modal){
      modal.style.display = "none";
    }

    if(img){
      img.src = "";
    }
  };

  function renderFeed(feed = []){
    if(!transparencyEls.feed) return;

    const items = safeArray(feed);

    if(!items.length){
      transparencyEls.feed.className = "empty-feed";
      transparencyEls.feed.innerHTML =
        "No project updates found.";
      return;
    }

    const html = items.map(item => {
      const id =
        safeString(item.id).trim();

      const projectName =
        safeString(
          item.project_name ||
          item.project ||
          item.project_code ||
          "Project"
        );

      const projectCode =
        safeString(item.project_code || "");

      const projectType =
        safeString(
          item.project_type || "internal"
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

      const title =
        safeString(item.title || "");

      const description =
        safeString(item.description || "");

      const imageUrl =
        safeString(
          item.image_url ||
          item.image ||
          ""
        );

      const createdByName =
        safeString(
          item.created_by_name ||
          "ALBUKHR Team"
        );

      const createdByRole =
        safeString(
          item.created_by_role || ""
        );

      const createdAt =
        item.created_at || "";

      const comments =
        safeArray(item.comments);

      const likeCount =
        safeNumber(item.like_count, 0);

      const dislikeCount =
        safeNumber(item.dislike_count, 0);

      const userVote =
        safeString(item.user_vote || "");

      const isExpanded =
        !!transparencyState
          .expandedDescriptions[id];

      const commentsOpen =
        !!transparencyState
          .openComments[id];

      const needsReadMore =
        description.length > 220;

      return `
        <div class="timeline-card">

          <div class="timeline-header">
            <div class="timeline-left">

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
                    onclick="openImageModal(${JSON.stringify(imageUrl)})"
                  />
                </div>
              `
              : ""
          }

          <div class="timeline-desc ${isExpanded ? "expanded" : "collapsed"}">
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
                  ${isExpanded ? "Show less" : "Read more"}
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

    transparencyEls.feed.className =
      "timeline-feed";

    transparencyEls.feed.innerHTML = html;
  }

  async function loadTransparencyFeed(
    forceMessage = false
  ){
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
      if(forceMessage && transparencyEls.feed){
        transparencyEls.feed.className =
          "loading";

        transparencyEls.feed.innerHTML =
          "Loading project updates...";
      }

      ensureArchitectureReady();

      const viewerEmail =
        getViewerEmail();

      const filters =
        getFeedFilters();

      const feed =
        await window.fetchTransparencyFeed({
          projectCode:
            filters.projectCode,

          projectType:
            filters.projectType,

          visibleOnly:true,

          limit:100,

          viewerEmail
        });

      if(
        requestId !==
        transparencyState.lastRequestId
      ){
        return;
      }

      transparencyState.lastFeed =
        sortFeed(
          feed,
          filters.sort
        );

      renderFeed(
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

  window.toggleReadMore = function(id){
    transparencyState
      .expandedDescriptions[id] =
        !transparencyState
          .expandedDescriptions[id];

    renderFeed(
      transparencyState.lastFeed
    );
  };

  window.toggleComments = function(id){
    transparencyState
      .openComments[id] =
        !transparencyState
          .openComments[id];

    renderFeed(
      transparencyState.lastFeed
    );
  };

  window.handleAddComment =
    async function(updateId){
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

        const viewer =
          getViewer();

        const viewerEmail =
          getViewerEmail();

        if(!viewerEmail){
          showAlertMessage(
            "Login required",
            "Please sign in before posting a comment."
          );
          return;
        }

        if(
          typeof window.postTransparencyComment ===
          "function"
        ){
          await window.postTransparencyComment(
            updateId,
            commentText,
            viewer
          );

        }else if(
          typeof window.addProjectUpdateComment ===
          "function"
        ){
          await window.addProjectUpdateComment({
            updateId,
            commentText,
            commenterEmail:
              viewerEmail,
            commenterName:
              getViewerName(),
            commenterRole:
              getViewerRole()
          });

        }else{
          throw new Error(
            "Comment engine is missing."
          );
        }

        input.value = "";

        transparencyState
          .openComments[updateId] = true;

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

  window.handleReaction =
    async function(updateId, voteType){
      try{
        const viewer =
          getViewer();

        const viewerEmail =
          getViewerEmail();

        if(!viewerEmail){
          showAlertMessage(
            "Login required",
            "Please sign in before reacting to an update."
          );
          return;
        }

        if(
          typeof window.toggleTransparencyReaction ===
          "function"
        ){
          await window.toggleTransparencyReaction(
            updateId,
            voteType,
            viewer
          );

        }else if(
          typeof window.toggleProjectUpdateReaction ===
          "function"
        ){
          await window.toggleProjectUpdateReaction({
            updateId,
            reactorEmail:
              viewerEmail,
            reactorName:
              getViewerName(),
            reactorRole:
              getViewerRole(),
            voteType
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

  function bindEvents(){
    if(transparencyEls.refreshFeedBtn){
      transparencyEls
        .refreshFeedBtn
        .addEventListener(
          "click",
          async function(){
            await loadTransparencyFeed(true);
          }
        );
    }

    if(transparencyEls.filterProjectCode){
      transparencyEls
        .filterProjectCode
        .addEventListener(
          "keydown",
          async function(e){
            if(e.key === "Enter"){
              await loadTransparencyFeed(true);
            }
          }
        );
    }

    if(transparencyEls.filterProjectType){
      transparencyEls
        .filterProjectType
        .addEventListener(
          "change",
          async function(){
            await loadTransparencyFeed(true);
          }
        );
    }

    if(transparencyEls.filterSort){
      transparencyEls
        .filterSort
        .addEventListener(
          "change",
          function(){
            transparencyState.lastFeed =
              sortFeed(
                transparencyState.lastFeed,
                getFeedFilters().sort
              );

            renderFeed(
              transparencyState.lastFeed
            );
          }
        );
    }

    window.addEventListener(
      "projectFeedUpdated",
      async function(){
        await loadTransparencyFeed(false);
      }
    );
  }

  function markActiveDock(){
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
  }

  function dockScrollBehaviour(){
    let lastScroll = 0;
    const threshold = 10;

    const dock =
      document.querySelector(
        ".dock-nav"
      );

    if(!dock) return;

    window.addEventListener(
      "scroll",
      () => {
        const current =
          window.pageYOffset;

        if(
          Math.abs(
            current - lastScroll
          ) <= threshold
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
  }

  async function init(){
    cacheElements();

    if(!transparencyEls.feed){
      console.warn(
        "ALBUKHR Transparency: #projectFeed not found."
      );
    }

    bindEvents();
    markActiveDock();
    dockScrollBehaviour();

    try{
      ensureArchitectureReady();

      if(
        typeof window.loadProjects ===
        "function"
      ){
        try{
          await window.loadProjects(true);
        }catch(e){
          console.warn(
            "Transparency project preload warning:",
            e
          );
        }
      }

      await loadTransparencyFeed(true);

      /*
        Refresh remains page-level behaviour.
        Data access remains in project-updates.js.
      */
      window.setInterval(
        async function(){
          await loadTransparencyFeed(false);
        },
        90000
      );

    }catch(err){
      console.error(
        "Transparency initialization error:",
        err
      );

      if(transparencyEls.feed){
        transparencyEls.feed.className =
          "error-box";

        transparencyEls.feed.innerHTML = `
          Transparency page could not initialize.<br>
          <span class="muted">
            ${escapeHtml(
              err?.message ||
              "Architecture dependency unavailable."
            )}
          </span>
        `;
      }
    }
  }

  if(
    document.readyState ===
    "loading"
  ){
    document.addEventListener(
      "DOMContentLoaded",
      init,
      {once:true}
    );
  }else{
    init();
  }

  window.AlbukhrTransparencyPage = {
    state: transparencyState,
    load: loadTransparencyFeed,
    render: renderFeed
  };

})();
