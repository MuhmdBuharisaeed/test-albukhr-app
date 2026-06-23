/* =========================================
   ALBUKHR PROJECT UPDATES ENGINE FINAL
   Supabase-first Transparency / Project Updates
   ------------------------------------------------
   PURPOSE:
   - Upload project update image to Supabase Storage
   - Save project update into public.project_updates
   - Load updates for transparency feed / project pages
   - Manage comments/reactions if needed later

   REQUIRES:
   - supabase-core.js
   - projects-engine.js (optional helper use)
========================================= */

(function(){

  "use strict";

  /* =========================================
     CONFIG
  ========================================= */
  const PROJECT_UPDATES_TABLE = "project_updates";
  const PROJECT_UPDATE_COMMENTS_TABLE = "project_update_comments";
  const PROJECT_UPDATE_REACTIONS_TABLE = "project_update_reactions";

  const PROJECT_UPDATES_BUCKET = "project-updates";

  const DEFAULT_FETCH_LIMIT = 50;

  /* =========================================
     SAFE HELPERS
  ========================================= */
  function safeString(value, fallback = ""){
    if(value === null || value === undefined){
      return fallback;
    }
    return String(value);
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

  function normalizeProjectType(type){
    const t = safeString(type).trim().toLowerCase();

    if(t === "core" || t === "core project"){
      return "core";
    }

    if(t === "internal" || t === "internal project"){
      return "internal";
    }

    if(t === "external" || t === "external project"){
      return "external";
    }

    return "internal";
  }

  function formatProjectTypeLabel(type){
    const t = normalizeProjectType(type);

    if(t === "core") return "Core Project";
    if(t === "internal") return "Internal Project";
    if(t === "external") return "External Project";

    return "Project";
  }

  function getTypeBadgeClass(type){
    const t = normalizeProjectType(type);

    if(t === "core") return "core-badge";
    if(t === "external") return "external-badge";
    return "internal-badge";
  }

  function timeAgo(dateInput){
    if(!dateInput) return "Unknown time";

    const time = new Date(dateInput).getTime();
    if(!Number.isFinite(time)) return "Unknown time";

    const seconds = Math.floor((Date.now() - time) / 1000);

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

  function truncateComment(text, max = 60){
    text = safeString(text);
    max = safeNumber(max, 60);

    if(text.length > max){
      return text.slice(0, max) + "...";
    }

    return text;
  }

  function requireSupabase(){
    if(typeof supabase === "undefined"){
      throw new Error("Supabase client not found. Make sure supabase-core.js is loaded first.");
    }
  }

  function getCurrentUserEmail(){
    return (
      localStorage.getItem("albukhr_current_email") ||
      localStorage.getItem("currentUserEmail") ||
      localStorage.getItem("user_email") ||
      ""
    ).trim();
  }

  function getCurrentUsername(){
    return (
      localStorage.getItem("albukhr_current_username") ||
      localStorage.getItem("currentUsername") ||
      localStorage.getItem("user_name") ||
      "Albukhr User"
    ).trim();
  }

  function getCurrentAdminRole(){
    try{
      if(typeof getAdmin === "function"){
        const admin = getAdmin();
        if(admin && admin.role){
          return String(admin.role).trim();
        }
      }
    }catch(e){
      console.warn("getCurrentAdminRole warning:", e);
    }

    return "project_admin";
  }

  function buildStoragePath(projectCode, originalName = ""){
    const code =
      safeString(projectCode || "project")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-");

    const ext =
      originalName && originalName.includes(".")
        ? originalName.split(".").pop().toLowerCase()
        : "jpg";

    const rand = Math.random().toString(36).slice(2,10);

    return `${code}/${Date.now()}-${rand}.${ext}`;
  }

  /* =========================================
     PROJECT META HELPERS
  ========================================= */
  async function resolveProjectUpdateMeta(projectInput){

    /*
      projectInput can be:
      1) project code string
      2) project object { project_code, project_name, project_type }
    */

    if(!projectInput){
      throw new Error("Project is required");
    }

    if(typeof projectInput === "object" && projectInput !== null){
      const projectCode =
        safeString(
          projectInput.project_code ||
          projectInput.code
        ).trim();

      const projectName =
        safeString(
          projectInput.project_name ||
          projectInput.name ||
          projectCode
        ).trim();

      const projectType =
        normalizeProjectType(
          projectInput.project_type ||
          projectInput.type
        );

      if(!projectCode){
        throw new Error("Project code is required");
      }

      return {
        project_code: projectCode,
        project_name: projectName || projectCode,
        project_type: projectType
      };
    }

    const projectCode = safeString(projectInput).trim();

    if(!projectCode){
      throw new Error("Project code is required");
    }

    if(typeof getProjectUpdateMeta === "function"){
      const meta = await getProjectUpdateMeta(projectCode);

      return {
        project_code: safeString(meta.project_code).trim(),
        project_name: safeString(meta.project_name).trim(),
        project_type: normalizeProjectType(meta.project_type)
      };
    }

    if(typeof getProjectMeta === "function"){
      const project = await getProjectMeta(projectCode);

      if(!project){
        throw new Error(`Project not found: ${projectCode}`);
      }

      return {
        project_code: safeString(project.project_code).trim(),
        project_name: safeString(project.project_name || project.name || project.project_code).trim(),
        project_type: normalizeProjectType(project.project_type)
      };
    }

    throw new Error("Project meta resolver not found. Load projects-engine.js first.");
  }

  /* =========================================
     STORAGE UPLOAD
  ========================================= */
  async function uploadProjectUpdateImage(file, projectCode){
    requireSupabase();

    if(!file){
      return "";
    }

    const path = buildStoragePath(projectCode, file.name);

    const { error: uploadError } = await supabase
      .storage
      .from(PROJECT_UPDATES_BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false
      });

    if(uploadError){
      throw uploadError;
    }

    const { data } = supabase
      .storage
      .from(PROJECT_UPDATES_BUCKET)
      .getPublicUrl(path);

    return data?.publicUrl || "";
  }

  /* =========================================
     CREATE PROJECT UPDATE
  ========================================= */
  async function createProjectUpdate(payload = {}){
    requireSupabase();

    const meta = await resolveProjectUpdateMeta(
      payload.project || payload.project_code || payload.projectMeta
    );

    const title =
      safeString(payload.title).trim();

    const description =
      safeString(payload.description).trim();

    const imageFile =
      payload.image_file || payload.imageFile || null;

    const isVisible =
      payload.is_visible !== false;

    if(!description){
      throw new Error("Project update description is required");
    }

    let imageUrl = "";

    if(imageFile){
      imageUrl = await uploadProjectUpdateImage(
        imageFile,
        meta.project_code
      );
    }

    const insertPayload = {
      project_code: meta.project_code,
      project_name: meta.project_name,
      project_type: meta.project_type,

      title: title || null,
      description,
      image_url: imageUrl || null,

      created_by_email: getCurrentUserEmail() || null,
      created_by_name: getCurrentUsername() || "Albukhr User",
      created_by_role: getCurrentAdminRole() || "project_admin",

      is_visible: isVisible
    };

    const { data, error } = await supabase
      .from(PROJECT_UPDATES_TABLE)
      .insert(insertPayload)
      .select()
      .single();

    if(error){
      throw error;
    }

    window.dispatchEvent(new CustomEvent("albukhrProjectUpdateCreated", {
      detail: {
        update: data
      }
    }));

    return data;
  }

  /* =========================================
     UPDATE EXISTING PROJECT UPDATE
  ========================================= */
  async function updateProjectUpdate(updateId, patch = {}){
    requireSupabase();

    updateId = safeString(updateId).trim();

    if(!updateId){
      throw new Error("Update ID is required");
    }

    const updatePayload = {};

    if("title" in patch){
      updatePayload.title = safeString(patch.title).trim() || null;
    }

    if("description" in patch){
      const description = safeString(patch.description).trim();
      if(!description){
        throw new Error("Description cannot be empty");
      }
      updatePayload.description = description;
    }

    if("is_visible" in patch){
      updatePayload.is_visible = !!patch.is_visible;
    }

    if(patch.image_file){
      const currentProjectCode =
        safeString(patch.project_code || patch.projectCode || "project").trim();

      updatePayload.image_url =
        await uploadProjectUpdateImage(
          patch.image_file,
          currentProjectCode
        );
    }

    if(!Object.keys(updatePayload).length){
      throw new Error("Nothing to update");
    }

    const { data, error } = await supabase
      .from(PROJECT_UPDATES_TABLE)
      .update(updatePayload)
      .eq("id", updateId)
      .select()
      .single();

    if(error){
      throw error;
    }

    window.dispatchEvent(new CustomEvent("albukhrProjectUpdateEdited", {
      detail: {
        update: data
      }
    }));

    return data;
  }

  /* =========================================
     SOFT HIDE PROJECT UPDATE
  ========================================= */
  async function hideProjectUpdate(updateId){
    return await updateProjectUpdate(updateId, {
      is_visible: false
    });
  }

  /* =========================================
     DELETE PROJECT UPDATE HARD
     NOTE:
     Use only if you really want permanent delete.
  ========================================= */
  async function deleteProjectUpdate(updateId){
    requireSupabase();

    updateId = safeString(updateId).trim();

    if(!updateId){
      throw new Error("Update ID is required");
    }

    const { error } = await supabase
      .from(PROJECT_UPDATES_TABLE)
      .delete()
      .eq("id", updateId);

    if(error){
      throw error;
    }

    window.dispatchEvent(new CustomEvent("albukhrProjectUpdateDeleted", {
      detail: {
        updateId
      }
    }));

    return true;
  }

  /* =========================================
     FETCH PROJECT UPDATES
  ========================================= */
  async function fetchProjectUpdates(options = {}){
    requireSupabase();

    const projectCode =
      safeString(options.project_code || options.projectCode).trim();

    const projectType =
      safeString(options.project_type || options.projectType).trim().toLowerCase();

    const visibleOnly =
      options.visibleOnly !== false;

    let limit =
      safeNumber(options.limit, DEFAULT_FETCH_LIMIT);

    if(limit <= 0){
      limit = DEFAULT_FETCH_LIMIT;
    }

    let query = supabase
      .from(PROJECT_UPDATES_TABLE)
      .select(`
        id,
        project_code,
        project_name,
        project_type,
        title,
        description,
        image_url,
        created_by_email,
        created_by_name,
        created_by_role,
        is_visible,
        created_at,
        updated_at
      `)
      .order("created_at", { ascending:false })
      .limit(limit);

    if(visibleOnly){
      query = query.eq("is_visible", true);
    }

    if(projectCode){
      query = query.eq("project_code", projectCode);
    }

    if(projectType){
      query = query.eq("project_type", normalizeProjectType(projectType));
    }

    const { data, error } = await query;

    if(error){
      throw error;
    }

    return Array.isArray(data) ? data : [];
  }

  /* =========================================
     FETCH SINGLE UPDATE
  ========================================= */
  async function getProjectUpdate(updateId){
    requireSupabase();

    updateId = safeString(updateId).trim();

    if(!updateId){
      throw new Error("Update ID is required");
    }

    const { data, error } = await supabase
      .from(PROJECT_UPDATES_TABLE)
      .select("*")
      .eq("id", updateId)
      .single();

    if(error){
      throw error;
    }

    return data;
  }

  /* =========================================
     FETCH COMMENTS FOR ONE UPDATE
  ========================================= */
  async function fetchProjectUpdateComments(updateId, options = {}){
    requireSupabase();

    updateId = safeString(updateId).trim();

    if(!updateId){
      throw new Error("Update ID is required");
    }

    const visibleOnly =
      options.visibleOnly !== false;

    let query = supabase
      .from(PROJECT_UPDATE_COMMENTS_TABLE)
      .select(`
        id,
        update_id,
        commenter_email,
        commenter_name,
        comment_text,
        is_visible,
        created_at
      `)
      .eq("update_id", updateId)
      .order("created_at", { ascending:true });

    if(visibleOnly){
      query = query.eq("is_visible", true);
    }

    const { data, error } = await query;

    if(error){
      throw error;
    }

    return Array.isArray(data) ? data : [];
  }

  /* =========================================
     FETCH COMMENTS MAP FOR MANY UPDATES
  ========================================= */
  async function fetchProjectUpdateCommentsMap(updateIds = [], options = {}){
    requireSupabase();

    if(!Array.isArray(updateIds) || !updateIds.length){
      return {};
    }

    const visibleOnly =
      options.visibleOnly !== false;

    let query = supabase
      .from(PROJECT_UPDATE_COMMENTS_TABLE)
      .select(`
        id,
        update_id,
        commenter_email,
        commenter_name,
        comment_text,
        is_visible,
        created_at
      `)
      .in("update_id", updateIds)
      .order("created_at", { ascending:true });

    if(visibleOnly){
      query = query.eq("is_visible", true);
    }

    const { data, error } = await query;

    if(error){
      throw error;
    }

    const map = {};

    (data || []).forEach(row => {
      if(!map[row.update_id]){
        map[row.update_id] = [];
      }
      map[row.update_id].push(row);
    });

    return map;
  }

  /* =========================================
     ADD COMMENT
  ========================================= */
  async function addProjectUpdateComment(updateId, commentText){
    requireSupabase();

    updateId = safeString(updateId).trim();
    commentText = safeString(commentText).trim();

    if(!updateId){
      throw new Error("Update ID is required");
    }

    if(!commentText){
      throw new Error("Comment text is required");
    }

    const insertPayload = {
      update_id: updateId,
      commenter_email: getCurrentUserEmail() || null,
      commenter_name: getCurrentUsername() || "Albukhr User",
      comment_text: commentText,
      is_visible: true
    };

    const { data, error } = await supabase
      .from(PROJECT_UPDATE_COMMENTS_TABLE)
      .insert(insertPayload)
      .select()
      .single();

    if(error){
      throw error;
    }

    window.dispatchEvent(new CustomEvent("albukhrProjectUpdateCommentCreated", {
      detail: {
        comment: data,
        updateId
      }
    }));

    return data;
  }

  /* =========================================
     FETCH REACTIONS MAP
  ========================================= */
  async function fetchProjectUpdateReactionMap(updateIds = []){
    requireSupabase();

    if(!Array.isArray(updateIds) || !updateIds.length){
      return {
        likes: {},
        dislikes: {},
        userVotes: {}
      };
    }

    const viewerEmail =
      safeString(getCurrentUserEmail()).trim().toLowerCase();

    const { data, error } = await supabase
      .from(PROJECT_UPDATE_REACTIONS_TABLE)
      .select(`
        id,
        update_id,
        reactor_email,
        reaction_type
      `)
      .in("update_id", updateIds);

    if(error){
      throw error;
    }

    const likes = {};
    const dislikes = {};
    const userVotes = {};

    (data || []).forEach(row => {
      const updateId = row.update_id;
      const reactionType =
        safeString(row.reaction_type).trim().toLowerCase();

      const reactorEmail =
        safeString(row.reactor_email).trim().toLowerCase();

      if(reactionType === "like"){
        likes[updateId] = (likes[updateId] || 0) + 1;
      }else if(reactionType === "dislike"){
        dislikes[updateId] = (dislikes[updateId] || 0) + 1;
      }

      if(viewerEmail && reactorEmail === viewerEmail){
        userVotes[updateId] = reactionType;
      }
    });

    return {
      likes,
      dislikes,
      userVotes
    };
  }

  /* =========================================
     TOGGLE REACTION
     - if same reaction exists => remove it
     - if different reaction exists => update it
     - if no reaction exists => insert it
  ========================================= */
  async function setProjectUpdateReaction(updateId, reactionType){
    requireSupabase();

    updateId = safeString(updateId).trim();
    reactionType = safeString(reactionType).trim().toLowerCase();

    if(!updateId){
      throw new Error("Update ID is required");
    }

    if(!["like","dislike"].includes(reactionType)){
      throw new Error("Invalid reaction type");
    }

    const viewerEmail =
      safeString(getCurrentUserEmail()).trim().toLowerCase();

    if(!viewerEmail){
      throw new Error("User email not found. Please log in again.");
    }

    const { data: existing, error: existingError } = await supabase
      .from(PROJECT_UPDATE_REACTIONS_TABLE)
      .select("id, reaction_type")
      .eq("update_id", updateId)
      .eq("reactor_email", viewerEmail)
      .maybeSingle();

    if(existingError){
      throw existingError;
    }

    if(!existing){
      const { data, error } = await supabase
        .from(PROJECT_UPDATE_REACTIONS_TABLE)
        .insert({
          update_id: updateId,
          reactor_email: viewerEmail,
          reaction_type: reactionType
        })
        .select()
        .single();

      if(error){
        throw error;
      }

      return {
        action: "inserted",
        reactionType,
        data
      };
    }

    if(existing.reaction_type === reactionType){
      const { error } = await supabase
        .from(PROJECT_UPDATE_REACTIONS_TABLE)
        .delete()
        .eq("id", existing.id);

      if(error){
        throw error;
      }

      return {
        action: "removed",
        reactionType
      };
    }

    const { data, error } = await supabase
      .from(PROJECT_UPDATE_REACTIONS_TABLE)
      .update({
        reaction_type: reactionType
      })
      .eq("id", existing.id)
      .select()
      .single();

    if(error){
      throw error;
    }

    return {
      action: "updated",
      reactionType,
      data
    };
  }

  /* =========================================
     FULL FEED LOADER
     Good for transparency.html
  ========================================= */
  async function loadTransparencyFeedData(options = {}){
    const updates = await fetchProjectUpdates(options);
    const updateIds = updates.map(item => item.id);

    const [commentsMap, reactionMap] = await Promise.all([
      fetchProjectUpdateCommentsMap(updateIds),
      fetchProjectUpdateReactionMap(updateIds)
    ]);

    return {
      updates,
      commentsMap,
      likes: reactionMap.likes,
      dislikes: reactionMap.dislikes,
      userVotes: reactionMap.userVotes
    };
  }

  /* =========================================
     DASHBOARD UPLOAD HELPER
     This is the helper you can call directly from
     Albukhr-internal-project-dashbord.html
  ========================================= */
  async function uploadProjectUpdateFromDashboard(config = {}){
    const project =
      config.project ||
      null;

    const imageInput =
      config.imageInput ||
      document.getElementById("projectUpdateImage");

    const textInput =
      config.textInput ||
      document.getElementById("projectUpdateText");

    const titleInput =
      config.titleInput ||
      document.getElementById("projectUpdateTitle");

    if(!project){
      throw new Error("Project not loaded");
    }

    if(!textInput){
      throw new Error("Project update text input not found");
    }

    const description =
      safeString(textInput.value).trim();

    if(!description){
      throw new Error("Please write project update description.");
    }

    const title =
      titleInput
        ? safeString(titleInput.value).trim()
        : "";

    const file =
      imageInput && imageInput.files
        ? imageInput.files[0] || null
        : null;

    const created = await createProjectUpdate({
      project,
      title,
      description,
      image_file: file
    });

    if(imageInput){
      imageInput.value = "";
    }

    if(textInput){
      textInput.value = "";
    }

    if(titleInput){
      titleInput.value = "";
    }

    window.dispatchEvent(new CustomEvent("albukhrTransparencyUpdated", {
      detail: {
        update: created
      }
    }));

    return created;
  }

  /* =========================================
     SIMPLE RENDER HELPERS
     Optional: transparency page can use them
  ========================================= */
  function buildTransparencyCardHTML(item, options = {}){
    const likes = options.likes || {};
    const dislikes = options.dislikes || {};
    const userVotes = options.userVotes || {};
    const commentsMap = options.commentsMap || {};
    const openComments = options.openComments || {};

    const updateId = item.id;
    const comments = commentsMap[updateId] || [];

    const projectName =
      escapeHtml(item.project_name || item.project_code || "Project");

    const typeLabel =
      formatProjectTypeLabel(item.project_type);

    const typeClass =
      getTypeBadgeClass(item.project_type);

    const description =
      escapeHtml(item.description || "");

    const imageUrl =
      safeString(item.image_url);

    return `
      <div class="timeline-card">

        <div class="timeline-header">
          <div>
            <div class="timeline-project">
              ${projectName}
            </div>

            <div class="timeline-time-top">
              ${timeAgo(item.created_at)}
            </div>
          </div>

          <div class="timeline-type ${typeClass}">
            ${escapeHtml(typeLabel)}
          </div>
        </div>

        ${
          imageUrl
          ? `
            <div class="image-wrapper">
              <img
                src="${imageUrl}"
                class="timeline-image"
                alt="${projectName}"
              />
            </div>
          `
          : ""
        }

        <div class="timeline-desc collapsed" id="desc-${updateId}">
          ${description || "No update description provided."}
        </div>

        ${
          safeString(item.description).length > 120
          ? `
            <div class="read-more" id="read-${updateId}">
              Read more
            </div>
          `
          : ""
        }

        <div class="timeline-actions">
          <button class="${userVotes[updateId] === "like" ? "active" : ""}">
            👍 ${likes[updateId] || 0}
          </button>

          <button class="${userVotes[updateId] === "dislike" ? "active" : ""}">
            👎 ${dislikes[updateId] || 0}
          </button>

          <button>
            💬 ${comments.length}
          </button>
        </div>

        <div
          class="comment-box"
          style="display:${openComments[updateId] ? "flex" : "none"}"
          id="comments-${updateId}"
        >
          <input
            placeholder="Write comment..."
            id="comment-${updateId}"
          />
          <button>
            Post
          </button>
        </div>

        <div class="comment-list">
          ${
            comments.slice(0,3).map(c => `
              <div class="comment-preview">
                💬 ${escapeHtml(truncateComment(c.comment_text || ""))}
              </div>
            `).join("")
          }
        </div>

      </div>
    `;
  }

  /* =========================================
     PUBLIC API
  ========================================= */
  window.ALBUKHR_PROJECT_UPDATES = {
    /* config */
    PROJECT_UPDATES_TABLE,
    PROJECT_UPDATE_COMMENTS_TABLE,
    PROJECT_UPDATE_REACTIONS_TABLE,
    PROJECT_UPDATES_BUCKET,
    DEFAULT_FETCH_LIMIT,

    /* helpers */
    safeString,
    safeNumber,
    escapeHtml,
    normalizeProjectType,
    formatProjectTypeLabel,
    getTypeBadgeClass,
    timeAgo,
    truncateComment,
    resolveProjectUpdateMeta,

    /* create / edit / delete */
    uploadProjectUpdateImage,
    createProjectUpdate,
    updateProjectUpdate,
    hideProjectUpdate,
    deleteProjectUpdate,

    /* fetch */
    fetchProjectUpdates,
    getProjectUpdate,
    fetchProjectUpdateComments,
    fetchProjectUpdateCommentsMap,
    fetchProjectUpdateReactionMap,
    loadTransparencyFeedData,

    /* comments / reactions */
    addProjectUpdateComment,
    setProjectUpdateReaction,

    /* dashboard helper */
    uploadProjectUpdateFromDashboard,

    /* optional render helper */
    buildTransparencyCardHTML
  };

})();
