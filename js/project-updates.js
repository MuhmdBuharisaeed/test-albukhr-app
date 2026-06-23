/* =========================================
   ALBUKHR PROJECT UPDATES ENGINE FINAL PATCHED
   SUPABASE VERSION
   ------------------------------------------------
   TABLES:
   - public.project_updates
   - public.project_update_comments
   - public.project_update_reactions

   STORAGE BUCKET:
   - project-updates

   PURPOSE:
   - Transparency feed
   - Upload project updates from project dashboards
   - Like / dislike project updates
   - Comment on project updates
   - Read feed for core / internal / external projects

   SAFE NOTES:
   - Works with UUID update IDs
   - Compatible with patched dashboards
   - Compatible with transparency.html
   - Supports imageFile and file aliases
   - Provides normalized feed payloads for UI
   - SAFE with js/supabase-core.js
========================================= */

(function(){
  "use strict";

  /* =========================================
     CONFIG
  ========================================= */
  const PROJECT_UPDATES_BUCKET = "project-updates";
  const DEFAULT_FEED_LIMIT = 50;
  const DEFAULT_COMMENT_LIMIT = 50;

  /* =========================================
     SUPABASE GUARD
     IMPORTANT:
     - Never return window.supabase directly because
       that is usually the CDN SDK namespace, not a client.
     - Prefer ALBUKHR dedicated client from supabase-core.js
  ========================================= */
  function isValidSupabaseClient(candidate){
    return !!(
      candidate &&
      typeof candidate.from === "function" &&
      candidate.storage &&
      typeof candidate.storage.from === "function"
    );
  }

  function getSupabaseClient(){

    /* 1) Primary ALBUKHR dedicated client */
    if(isValidSupabaseClient(window.albukhrSupabase)){
      return window.albukhrSupabase;
    }

    /* 2) Getter exported by js/supabase-core.js */
    if(typeof window.getAlbukhrSupabaseClient === "function"){
      try{
        const client = window.getAlbukhrSupabaseClient();
        if(isValidSupabaseClient(client)){
          return client;
        }
      }catch(err){
        console.warn("getAlbukhrSupabaseClient() failed:", err);
      }
    }

    /* 3) Compatibility fallbacks if another page exposes a client */
    const fallbacks = [
      window.supabaseClient,
      window.sb,
      window.ALBUKHR_SUPABASE,
      window.supabase_instance,
      window.supabase_db,
      window.db
    ];

    for(const candidate of fallbacks){
      if(isValidSupabaseClient(candidate)){
        return candidate;
      }
    }

    throw new Error(
      "Valid Supabase client not found. Make sure js/supabase-core.js is loaded before js/project-updates.js."
    );
  }

  /* =========================================
     SAFE HELPERS
  ========================================= */
  function safeString(value, fallback = ""){
    if(value === null || value === undefined) return fallback;
    return String(value);
  }

  function safeNumber(value, fallback = 0){
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function safeArray(value){
    return Array.isArray(value) ? value : [];
  }

  function safeDateMs(value){
    const ms = new Date(value || Date.now()).getTime();
    return Number.isFinite(ms) ? ms : Date.now();
  }

  function normalizeProjectType(type){
    const t = safeString(type).trim().toLowerCase();

    if(t === "core") return "core";
    if(t === "internal") return "internal";
    if(t === "external") return "external";

    return "internal";
  }

  function normalizeRole(role){
    return safeString(role || "user").trim();
  }

  function sanitizeFileName(name = ""){
    return safeString(name)
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .toLowerCase();
  }

  function createStoragePath(projectType, projectCode, fileName){
    const type = normalizeProjectType(projectType);
    const code = safeString(projectCode || "unknown-project")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_-]/g, "_");

    const safeName = sanitizeFileName(fileName || "update-image");
    const stamp = Date.now();

    return `${type}/${code}/${stamp}-${safeName}`;
  }

  function buildPublicUrl(path){
    const supabase = getSupabaseClient();

    const { data } = supabase
      .storage
      .from(PROJECT_UPDATES_BUCKET)
      .getPublicUrl(path);

    return data?.publicUrl || "";
  }

  function isValidVoteType(voteType){
    const vote = safeString(voteType).trim().toLowerCase();
    return vote === "like" || vote === "dislike";
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
    if(t === "internal") return "internal-badge";
    if(t === "external") return "external-badge";
    return "internal-badge";
  }

  function dispatchFeedEvent(detail = {}){
    window.dispatchEvent(
      new CustomEvent("projectFeedUpdated", { detail })
    );
  }

  /* =========================================
     CURRENT VIEWER HELPERS
  ========================================= */
  function getTransparencyViewerMeta(){
    return {
      email:
        safeString(
          localStorage.getItem("albukhr_current_email") ||
          localStorage.getItem("currentUserEmail") ||
          ""
        ).trim(),

      name:
        safeString(
          localStorage.getItem("albukhr_current_username") ||
          localStorage.getItem("currentUserName") ||
          "ALBUKHR User"
        ).trim(),

      role:
        safeString(
          localStorage.getItem("albukhr_current_role") ||
          "user"
        ).trim()
    };
  }

  /* =========================================
     PROJECT META HELPERS
  ========================================= */
  async function resolveProjectMeta(projectCode){
    const code = safeString(projectCode).trim();

    if(!code){
      throw new Error("Project code is required");
    }

    if(typeof getProjectMeta !== "function"){
      return {
        project_code: code,
        project_name: code,
        project_type: "internal",
        status: "active"
      };
    }

    const meta = await getProjectMeta(code);

    if(!meta){
      return {
        project_code: code,
        project_name: code,
        project_type: "internal",
        status: "active"
      };
    }

    return {
      ...meta,
      project_code: safeString(meta.project_code || code),
      project_name: safeString(meta.project_name || meta.name || code),
      project_type: normalizeProjectType(meta.project_type || "internal"),
      status: safeString(meta.status || "active").toLowerCase()
    };
  }

  /* =========================================
     STORAGE: UPLOAD UPDATE IMAGE
  ========================================= */
  async function uploadProjectUpdateImage(file, {
    projectCode = "",
    projectType = "internal"
  } = {}){

    if(!file){
      throw new Error("Update image file is required");
    }

    const supabase = getSupabaseClient();

    const path = createStoragePath(
      projectType,
      projectCode,
      file.name || "project-update.jpg"
    );

    const { error: uploadError } = await supabase
      .storage
      .from(PROJECT_UPDATES_BUCKET)
      .upload(path, file, {
        upsert: false,
        cacheControl: "3600"
      });

    if(uploadError){
      throw new Error(uploadError.message || "Failed to upload update image");
    }

    const publicUrl = buildPublicUrl(path);

    return {
      path,
      publicUrl
    };
  }

  /* =========================================
     CREATE PROJECT UPDATE
  ========================================= */
  async function createProjectUpdate(payload = {}){
    const supabase = getSupabaseClient();

    const projectCode = safeString(payload.project_code).trim();
    const projectName = safeString(payload.project_name).trim();
    const projectType = normalizeProjectType(payload.project_type);

    if(!projectCode){
      throw new Error("project_code is required");
    }

    if(!projectName){
      throw new Error("project_name is required");
    }

    const insertPayload = {
      project_code: projectCode,
      project_name: projectName,
      project_type: projectType,
      title: safeString(payload.title).trim() || null,
      description: safeString(payload.description).trim(),
      image_url: safeString(payload.image_url).trim() || null,
      created_by_email: safeString(payload.created_by_email).trim() || null,
      created_by_name: safeString(payload.created_by_name).trim() || null,
      created_by_role: safeString(payload.created_by_role).trim() || null,
      is_visible: payload.is_visible === false ? false : true
    };

    const { data, error } = await supabase
      .from("project_updates")
      .insert(insertPayload)
      .select("*")
      .single();

    if(error){
      throw new Error(error.message || "Failed to create project update");
    }

    dispatchFeedEvent({
      type: "create",
      update: data
    });

    return data;
  }

  /* =========================================
     DASHBOARD HELPER:
     Supports file + imageFile
  ========================================= */
  async function uploadProjectUpdateToSupabase({
    projectCode = "",
    projectName = "",
    projectType = "internal",
    title = "",
    description = "",
    file = null,
    imageFile = null,
    createdByEmail = "",
    createdByName = "",
    createdByRole = ""
  } = {}){

    projectCode = safeString(projectCode).trim();
    projectName = safeString(projectName).trim();
    projectType = normalizeProjectType(projectType);

    const pickedFile = imageFile || file || null;

    if(!projectCode){
      throw new Error("Project code is required");
    }

    if(!projectName){
      throw new Error("Project name is required");
    }

    if(!pickedFile){
      throw new Error("Project update image is required");
    }

    const upload = await uploadProjectUpdateImage(pickedFile, {
      projectCode,
      projectType
    });

    const update = await createProjectUpdate({
      project_code: projectCode,
      project_name: projectName,
      project_type: projectType,
      title,
      description,
      image_url: upload.publicUrl,
      created_by_email: createdByEmail,
      created_by_name: createdByName,
      created_by_role: createdByRole,
      is_visible: true
    });

    return {
      update,
      image: upload
    };
  }

  /* =========================================
     FETCH PROJECT UPDATES
  ========================================= */
  async function fetchProjectUpdates({
    projectCode = "",
    projectType = "",
    visibleOnly = true,
    limit = DEFAULT_FEED_LIMIT
  } = {}){

    const supabase = getSupabaseClient();

    limit = safeNumber(limit, DEFAULT_FEED_LIMIT);
    if(limit <= 0) limit = DEFAULT_FEED_LIMIT;

    let query = supabase
      .from("project_updates")
      .select("*")
      .order("created_at", { ascending:false })
      .limit(limit);

    if(visibleOnly){
      query = query.eq("is_visible", true);
    }

    if(projectCode){
      query = query.eq("project_code", safeString(projectCode).trim());
    }

    if(projectType){
      query = query.eq("project_type", normalizeProjectType(projectType));
    }

    const { data, error } = await query;

    if(error){
      throw new Error(error.message || "Failed to fetch project updates");
    }

    return safeArray(data);
  }

  /* =========================================
     FETCH COMMENTS FOR ONE UPDATE
  ========================================= */
  async function fetchProjectUpdateComments(updateId, {
    visibleOnly = true,
    limit = DEFAULT_COMMENT_LIMIT
  } = {}){

    const supabase = getSupabaseClient();

    updateId = safeString(updateId).trim();
    if(!updateId){
      throw new Error("updateId is required");
    }

    limit = safeNumber(limit, DEFAULT_COMMENT_LIMIT);
    if(limit <= 0) limit = DEFAULT_COMMENT_LIMIT;

    let query = supabase
      .from("project_update_comments")
      .select("*")
      .eq("update_id", updateId)
      .order("created_at", { ascending:true })
      .limit(limit);

    if(visibleOnly){
      query = query.eq("is_visible", true);
    }

    const { data, error } = await query;

    if(error){
      throw new Error(error.message || "Failed to fetch update comments");
    }

    return safeArray(data);
  }

  /* =========================================
     FETCH COMMENTS FOR MANY UPDATES
  ========================================= */
  async function fetchCommentsMapForUpdates(updateIds = []){
    const supabase = getSupabaseClient();

    const ids = safeArray(updateIds)
      .map(id => safeString(id).trim())
      .filter(Boolean);

    if(!ids.length){
      return {};
    }

    const { data, error } = await supabase
      .from("project_update_comments")
      .select("*")
      .in("update_id", ids)
      .eq("is_visible", true)
      .order("created_at", { ascending:true });

    if(error){
      throw new Error(error.message || "Failed to fetch comments map");
    }

    const map = {};

    safeArray(data).forEach(comment => {
      const key = safeString(comment.update_id).trim();
      if(!map[key]) map[key] = [];
      map[key].push(comment);
    });

    return map;
  }

  /* =========================================
     FETCH REACTIONS FOR MANY UPDATES
  ========================================= */
  async function fetchReactionsMapForUpdates(updateIds = [], viewerEmail = ""){
    const supabase = getSupabaseClient();

    const ids = safeArray(updateIds)
      .map(id => safeString(id).trim())
      .filter(Boolean);

    if(!ids.length){
      return {
        counts:{},
        userVotes:{}
      };
    }

    const { data, error } = await supabase
      .from("project_update_reactions")
      .select("*")
      .in("update_id", ids);

    if(error){
      throw new Error(error.message || "Failed to fetch update reactions");
    }

    const counts = {};
    const userVotes = {};
    const viewer = safeString(viewerEmail).trim().toLowerCase();

    safeArray(data).forEach(row => {
      const updateId = safeString(row.update_id).trim();
      const vote = safeString(row.vote_type).trim().toLowerCase();

      if(!counts[updateId]){
        counts[updateId] = {
          like:0,
          dislike:0
        };
      }

      if(vote === "like"){
        counts[updateId].like += 1;
      }else if(vote === "dislike"){
        counts[updateId].dislike += 1;
      }

      if(
        viewer &&
        safeString(row.reactor_email).trim().toLowerCase() === viewer
      ){
        userVotes[updateId] = vote;
      }
    });

    return {
      counts,
      userVotes
    };
  }

  /* =========================================
     NORMALIZE COMMENT
  ========================================= */
  function normalizeCommentRow(comment = {}){
    return {
      ...comment,
      id: safeString(comment.id).trim(),
      update_id: safeString(comment.update_id).trim(),
      text: safeString(comment.comment_text).trim(),
      comment_text: safeString(comment.comment_text).trim(),
      commenter_name: safeString(comment.commenter_name).trim() || "User",
      commenter_role: safeString(comment.commenter_role).trim() || "user",
      created_at: comment.created_at || null,
      time_ms: safeDateMs(comment.created_at)
    };
  }

  /* =========================================
     NORMALIZE UPDATE FOR UI
  ========================================= */
  function normalizeUpdateRow(update = {}, {
    comments = [],
    likeCount = 0,
    dislikeCount = 0,
    userVote = null
  } = {}){

    const projectType = normalizeProjectType(update.project_type);
    const createdAt = update.created_at || null;
    const normalizedComments = safeArray(comments).map(normalizeCommentRow);

    return {
      ...update,

      id: safeString(update.id).trim(),
      project_code: safeString(update.project_code).trim(),
      project_name: safeString(update.project_name).trim(),
      project_type: projectType,
      project_type_label: formatProjectTypeLabel(projectType),

      title: safeString(update.title).trim(),
      description: safeString(update.description).trim(),
      image_url: safeString(update.image_url).trim(),

      created_by_email: safeString(update.created_by_email).trim(),
      created_by_name: safeString(update.created_by_name).trim(),
      created_by_role: safeString(update.created_by_role).trim(),

      created_at: createdAt,
      updated_at: update.updated_at || null,
      is_visible: !!update.is_visible,

      comments: normalizedComments,
      comments_count: normalizedComments.length,
      like_count: safeNumber(likeCount, 0),
      dislike_count: safeNumber(dislikeCount, 0),
      user_vote: userVote || null,

      type_badge_class: getTypeBadgeClass(projectType),
      time_ms: safeDateMs(createdAt),

      /* compatibility aliases */
      project: safeString(update.project_name).trim(),
      type: formatProjectTypeLabel(projectType),
      image: safeString(update.image_url).trim(),
      time: safeDateMs(createdAt)
    };
  }

  /* =========================================
     FETCH FULL TRANSPARENCY FEED
  ========================================= */
  async function fetchProjectUpdatesFeed({
    projectCode = "",
    projectType = "",
    visibleOnly = true,
    limit = DEFAULT_FEED_LIMIT,
    viewerEmail = ""
  } = {}){

    const updates = await fetchProjectUpdates({
      projectCode,
      projectType,
      visibleOnly,
      limit
    });

    const ids = updates
      .map(u => safeString(u.id).trim())
      .filter(Boolean);

    const [commentsMap, reactions] = await Promise.all([
      fetchCommentsMapForUpdates(ids),
      fetchReactionsMapForUpdates(ids, viewerEmail)
    ]);

    return updates.map(update => {
      const id = safeString(update.id).trim();
      const reactionCount = reactions.counts[id] || { like:0, dislike:0 };

      return normalizeUpdateRow(update, {
        comments: commentsMap[id] || [],
        likeCount: reactionCount.like,
        dislikeCount: reactionCount.dislike,
        userVote: reactions.userVotes[id] || null
      });
    });
  }

  /* =========================================
     TRANSPARENCY FEED HELPER
  ========================================= */
  async function fetchTransparencyFeed({
    projectCode = "",
    projectType = "",
    visibleOnly = true,
    limit = DEFAULT_FEED_LIMIT,
    viewerEmail = ""
  } = {}){

    let email = safeString(viewerEmail).trim();

    if(!email){
      email = getTransparencyViewerMeta().email;
    }

    return await fetchProjectUpdatesFeed({
      projectCode,
      projectType,
      visibleOnly,
      limit,
      viewerEmail: email
    });
  }

  /* =========================================
     ADD COMMENT
  ========================================= */
  async function addProjectUpdateComment({
    updateId = "",
    commentText = "",
    commenterEmail = "",
    commenterName = "",
    commenterRole = "user",
    isVisible = true
  } = {}){

    const supabase = getSupabaseClient();

    updateId = safeString(updateId).trim();
    commentText = safeString(commentText).trim();

    if(!updateId){
      throw new Error("updateId is required");
    }

    if(!commentText){
      throw new Error("Comment text is required");
    }

    const insertPayload = {
      update_id: updateId,
      comment_text: commentText,
      commenter_email: safeString(commenterEmail).trim() || null,
      commenter_name: safeString(commenterName).trim() || null,
      commenter_role: normalizeRole(commenterRole),
      is_visible: isVisible === false ? false : true
    };

    const { data, error } = await supabase
      .from("project_update_comments")
      .insert(insertPayload)
      .select("*")
      .single();

    if(error){
      throw new Error(error.message || "Failed to add comment");
    }

    dispatchFeedEvent({
      type:"comment",
      updateId,
      comment:data
    });

    return data;
  }

  /* =========================================
     TRANSPARENCY COMMENT HELPER
  ========================================= */
  async function postTransparencyComment(updateId, commentText, viewerMeta = null){
    const viewer = viewerMeta || getTransparencyViewerMeta();

    return await addProjectUpdateComment({
      updateId,
      commentText,
      commenterEmail: viewer.email,
      commenterName: viewer.name,
      commenterRole: viewer.role,
      isVisible: true
    });
  }

  /* =========================================
     GET USER VOTE FOR UPDATE
  ========================================= */
  async function getUserReactionForUpdate(updateId, reactorEmail){
    const supabase = getSupabaseClient();

    updateId = safeString(updateId).trim();
    reactorEmail = safeString(reactorEmail).trim().toLowerCase();

    if(!updateId || !reactorEmail){
      return null;
    }

    const { data, error } = await supabase
      .from("project_update_reactions")
      .select("*")
      .eq("update_id", updateId)
      .eq("reactor_email", reactorEmail)
      .maybeSingle();

    if(error){
      throw new Error(error.message || "Failed to fetch user reaction");
    }

    return data || null;
  }

  /* =========================================
     TOGGLE LIKE / DISLIKE
  ========================================= */
  async function toggleProjectUpdateReaction({
    updateId = "",
    reactorEmail = "",
    reactorName = "",
    reactorRole = "user",
    voteType = "like"
  } = {}){

    const supabase = getSupabaseClient();

    updateId = safeString(updateId).trim();
    reactorEmail = safeString(reactorEmail).trim().toLowerCase();
    reactorName = safeString(reactorName).trim();
    reactorRole = normalizeRole(reactorRole);
    voteType = safeString(voteType).trim().toLowerCase();

    if(!updateId){
      throw new Error("updateId is required");
    }

    if(!reactorEmail){
      throw new Error("reactorEmail is required");
    }

    if(!isValidVoteType(voteType)){
      throw new Error("voteType must be like or dislike");
    }

    const existing = await getUserReactionForUpdate(updateId, reactorEmail);

    if(existing && safeString(existing.vote_type).trim().toLowerCase() === voteType){
      const { error: deleteError } = await supabase
        .from("project_update_reactions")
        .delete()
        .eq("id", existing.id);

      if(deleteError){
        throw new Error(deleteError.message || "Failed to remove reaction");
      }

      dispatchFeedEvent({
        type:"reaction-remove",
        updateId,
        voteType
      });

      return {
        action:"removed",
        vote:null
      };
    }

    if(existing){
      const { data, error } = await supabase
        .from("project_update_reactions")
        .update({
          vote_type: voteType,
          reactor_name: reactorName || existing.reactor_name || null,
          reactor_role: reactorRole || existing.reactor_role || null
        })
        .eq("id", existing.id)
        .select("*")
        .single();

      if(error){
        throw new Error(error.message || "Failed to update reaction");
      }

      dispatchFeedEvent({
        type:"reaction-update",
        updateId,
        voteType,
        reaction:data
      });

      return {
        action:"updated",
        vote:voteType,
        reaction:data
      };
    }

    const { data, error } = await supabase
      .from("project_update_reactions")
      .insert({
        update_id: updateId,
        reactor_email: reactorEmail,
        reactor_name: reactorName || null,
        reactor_role: reactorRole || null,
        vote_type: voteType
      })
      .select("*")
      .single();

    if(error){
      throw new Error(error.message || "Failed to add reaction");
    }

    dispatchFeedEvent({
      type:"reaction-add",
      updateId,
      voteType,
      reaction:data
    });

    return {
      action:"added",
      vote:voteType,
      reaction:data
    };
  }

  /* =========================================
     TRANSPARENCY REACTION HELPER
  ========================================= */
  async function toggleTransparencyReaction(updateId, voteType, viewerMeta = null){
    const viewer = viewerMeta || getTransparencyViewerMeta();

    return await toggleProjectUpdateReaction({
      updateId,
      reactorEmail: viewer.email,
      reactorName: viewer.name,
      reactorRole: viewer.role,
      voteType
    });
  }

  /* =========================================
     GET UPDATE STATS
  ========================================= */
  async function getProjectUpdateStats(updateId){
    const supabase = getSupabaseClient();

    updateId = safeString(updateId).trim();
    if(!updateId){
      throw new Error("updateId is required");
    }

    const [reactionsRes, commentsRes] = await Promise.all([
      supabase
        .from("project_update_reactions")
        .select("vote_type")
        .eq("update_id", updateId),

      supabase
        .from("project_update_comments")
        .select("id")
        .eq("update_id", updateId)
        .eq("is_visible", true)
    ]);

    if(reactionsRes.error){
      throw new Error(reactionsRes.error.message || "Failed to fetch reactions stats");
    }

    if(commentsRes.error){
      throw new Error(commentsRes.error.message || "Failed to fetch comments stats");
    }

    let likes = 0;
    let dislikes = 0;

    safeArray(reactionsRes.data).forEach(row => {
      const vote = safeString(row.vote_type).trim().toLowerCase();
      if(vote === "like") likes += 1;
      if(vote === "dislike") dislikes += 1;
    });

    return {
      likes,
      dislikes,
      comments: safeArray(commentsRes.data).length
    };
  }

  /* =========================================
     DELETE UPDATE
  ========================================= */
  async function deleteProjectUpdate(updateId){
    const supabase = getSupabaseClient();

    updateId = safeString(updateId).trim();
    if(!updateId){
      throw new Error("updateId is required");
    }

    const { error } = await supabase
      .from("project_updates")
      .delete()
      .eq("id", updateId);

    if(error){
      throw new Error(error.message || "Failed to delete project update");
    }

    dispatchFeedEvent({
      type:"delete",
      updateId
    });

    return true;
  }

  /* =========================================
     SET VISIBILITY
  ========================================= */
  async function setProjectUpdateVisibility(updateId, isVisible = true){
    const supabase = getSupabaseClient();

    updateId = safeString(updateId).trim();
    if(!updateId){
      throw new Error("updateId is required");
    }

    const { data, error } = await supabase
      .from("project_updates")
      .update({
        is_visible: !!isVisible
      })
      .eq("id", updateId)
      .select("*")
      .single();

    if(error){
      throw new Error(error.message || "Failed to update visibility");
    }

    dispatchFeedEvent({
      type:"visibility",
      updateId,
      update:data
    });

    return data;
  }

  /* =========================================
     LEGACY FEED IMPORT HELPER
  ========================================= */
  async function migrateLegacyLocalProjectFeedToSupabase({
    createdByEmail = "",
    createdByName = "",
    createdByRole = "system"
  } = {}){

    const legacyFeed =
      JSON.parse(localStorage.getItem("albukhr_project_feed") || "[]");

    if(!Array.isArray(legacyFeed) || !legacyFeed.length){
      return {
        migrated:0,
        skipped:0
      };
    }

    let migrated = 0;
    let skipped = 0;

    for(const item of legacyFeed){
      try{
        const projectCode = safeString(item.project_code || item.project).trim();
        if(!projectCode){
          skipped += 1;
          continue;
        }

        const meta = await resolveProjectMeta(projectCode);

        await createProjectUpdate({
          project_code: meta.project_code,
          project_name: meta.project_name,
          project_type: meta.project_type,
          title: item.title || null,
          description: item.description || "",
          image_url: item.image || item.image_url || null,
          created_by_email: createdByEmail || null,
          created_by_name: createdByName || null,
          created_by_role: createdByRole || "system",
          is_visible: true
        });

        migrated += 1;

      }catch(err){
        console.warn("Legacy feed migrate skipped:", err);
        skipped += 1;
      }
    }

    return {
      migrated,
      skipped
    };
  }

  /* =========================================
     PUBLIC API EXPORT
  ========================================= */
  window.ALBUKHR_PROJECT_UPDATES = {
    bucket: PROJECT_UPDATES_BUCKET,

    getTransparencyViewerMeta,

    resolveProjectMeta,
    uploadProjectUpdateImage,
    createProjectUpdate,
    uploadProjectUpdateToSupabase,

    fetchProjectUpdates,
    fetchProjectUpdateComments,
    fetchCommentsMapForUpdates,
    fetchReactionsMapForUpdates,
    fetchProjectUpdatesFeed,
    fetchTransparencyFeed,

    addProjectUpdateComment,
    postTransparencyComment,

    getUserReactionForUpdate,
    toggleProjectUpdateReaction,
    toggleTransparencyReaction,

    getProjectUpdateStats,

    deleteProjectUpdate,
    setProjectUpdateVisibility,

    migrateLegacyLocalProjectFeedToSupabase,

    normalizeUpdateRow,
    normalizeCommentRow,
    formatProjectTypeLabel,
    getTypeBadgeClass
  };

  window.getTransparencyViewerMeta = getTransparencyViewerMeta;

  window.uploadProjectUpdateToSupabase = uploadProjectUpdateToSupabase;

  window.fetchProjectUpdatesFeed = fetchProjectUpdatesFeed;
  window.fetchTransparencyFeed = fetchTransparencyFeed;
  window.fetchProjectUpdates = fetchProjectUpdates;
  window.fetchProjectUpdateComments = fetchProjectUpdateComments;

  window.addProjectUpdateComment = addProjectUpdateComment;
  window.postTransparencyComment = postTransparencyComment;

  window.toggleProjectUpdateReaction = toggleProjectUpdateReaction;
  window.toggleTransparencyReaction = toggleTransparencyReaction;

  window.getProjectUpdateStats = getProjectUpdateStats;
  window.deleteProjectUpdate = deleteProjectUpdate;
  window.setProjectUpdateVisibility = setProjectUpdateVisibility;
  window.resolveProjectMeta = resolveProjectMeta;

})();
