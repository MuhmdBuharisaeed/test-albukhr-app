/* =========================================
   ALBUKHR PROJECT UPDATES ENGINE FINAL
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
   - Falls back safely where possible
   - Does not depend on legacy localStorage feed
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
  ========================================= */
  function getSupabaseClient(){
    if(typeof window.supabaseClient !== "undefined" && window.supabaseClient){
      return window.supabaseClient;
    }

    if(typeof window.supabase !== "undefined" && window.supabase){
      return window.supabase;
    }

    if(typeof window.sb !== "undefined" && window.sb){
      return window.sb;
    }

    throw new Error("Supabase client not found. Load js/supabase-core.js first.");
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

    window.dispatchEvent(
      new CustomEvent("projectFeedUpdated", {
        detail: {
          type: "create",
          update: data
        }
      })
    );

    return data;
  }

  /* =========================================
     DASHBOARD HELPER:
     UPLOAD PROJECT UPDATE TO SUPABASE
     ------------------------------------------------
     Usage:
     await uploadProjectUpdateToSupabase({
       projectCode,
       projectName,
       projectType,
       title,
       description,
       file,
       createdByEmail,
       createdByName,
       createdByRole
     });
  ========================================= */
  async function uploadProjectUpdateToSupabase({
    projectCode = "",
    projectName = "",
    projectType = "internal",
    title = "",
    description = "",
    file = null,
    createdByEmail = "",
    createdByName = "",
    createdByRole = ""
  } = {}){

    projectCode = safeString(projectCode).trim();
    projectName = safeString(projectName).trim();
    projectType = normalizeProjectType(projectType);

    if(!projectCode){
      throw new Error("Project code is required");
    }

    if(!projectName){
      throw new Error("Project name is required");
    }

    if(!file){
      throw new Error("Project update image is required");
    }

    const upload = await uploadProjectUpdateImage(file, {
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
     ------------------------------------------------
     filters:
     - projectCode
     - projectType
     - visibleOnly
     - limit
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
     returns map keyed by update_id
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
     returns:
     {
       counts: {
         [updateId]: { like: n, dislike: n }
       },
       userVotes: {
         [updateId]: "like" | "dislike"
       }
     }
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
     FETCH FULL TRANSPARENCY FEED
     ------------------------------------------------
     Returns each update with:
     - comments
     - reaction counts
     - current viewer vote
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

    const ids = updates.map(u => safeString(u.id).trim()).filter(Boolean);

    const [commentsMap, reactions] = await Promise.all([
      fetchCommentsMapForUpdates(ids),
      fetchReactionsMapForUpdates(ids, viewerEmail)
    ]);

    return updates.map(update => {
      const id = safeString(update.id).trim();
      const reactionCount = reactions.counts[id] || { like:0, dislike:0 };

      return {
        ...update,
        comments: commentsMap[id] || [],
        like_count: safeNumber(reactionCount.like, 0),
        dislike_count: safeNumber(reactionCount.dislike, 0),
        user_vote: reactions.userVotes[id] || null
      };
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

    window.dispatchEvent(
      new CustomEvent("projectFeedUpdated", {
        detail:{
          type:"comment",
          updateId,
          comment:data
        }
      })
    );

    return data;
  }

  /* =========================================
     GET USER VOTE FOR UPDATE
  ========================================= */
  async function getUserReactionForUpdate(updateId, reactorEmail){
    const supabase = getSupabaseClient();

    updateId = safeString(updateId).trim();
    reactorEmail = safeString(reactorEmail).trim();

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
     ------------------------------------------------
     Rules:
     - if same vote exists => remove it
     - if different vote exists => replace it
     - if no vote exists => insert it
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
    reactorEmail = safeString(reactorEmail).trim();
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

    /* same vote => remove vote */
    if(existing && safeString(existing.vote_type).trim().toLowerCase() === voteType){

      const { error: deleteError } = await supabase
        .from("project_update_reactions")
        .delete()
        .eq("id", existing.id);

      if(deleteError){
        throw new Error(deleteError.message || "Failed to remove reaction");
      }

      window.dispatchEvent(
        new CustomEvent("projectFeedUpdated", {
          detail:{
            type:"reaction-remove",
            updateId,
            voteType
          }
        })
      );

      return {
        action:"removed",
        vote:null
      };
    }

    /* different vote exists => update it */
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

      window.dispatchEvent(
        new CustomEvent("projectFeedUpdated", {
          detail:{
            type:"reaction-update",
            updateId,
            voteType,
            reaction:data
          }
        })
      );

      return {
        action:"updated",
        vote:voteType,
        reaction:data
      };
    }

    /* no vote => insert */
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

    window.dispatchEvent(
      new CustomEvent("projectFeedUpdated", {
        detail:{
          type:"reaction-add",
          updateId,
          voteType,
          reaction:data
        }
      })
    );

    return {
      action:"added",
      vote:voteType,
      reaction:data
    };
  }

  /* =========================================
     GET UPDATE STATS
     ------------------------------------------------
     Returns:
     {
       likes,
       dislikes,
       comments
     }
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
     ------------------------------------------------
     Optional admin utility
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

    window.dispatchEvent(
      new CustomEvent("projectFeedUpdated", {
        detail:{
          type:"delete",
          updateId
        }
      })
    );

    return true;
  }

  /* =========================================
     SET VISIBILITY
     ------------------------------------------------
     Optional admin utility
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

    window.dispatchEvent(
      new CustomEvent("projectFeedUpdated", {
        detail:{
          type:"visibility",
          updateId,
          update:data
        }
      })
    );

    return data;
  }

  /* =========================================
     LEGACY FEED IMPORT HELPER
     ------------------------------------------------
     Optional one-time migration helper
     Reads localStorage albukhr_project_feed and moves
     entries to Supabase.
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
          image_url: item.image || null,
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

    resolveProjectMeta,
    uploadProjectUpdateImage,
    createProjectUpdate,
    uploadProjectUpdateToSupabase,

    fetchProjectUpdates,
    fetchProjectUpdateComments,
    fetchCommentsMapForUpdates,
    fetchReactionsMapForUpdates,
    fetchProjectUpdatesFeed,

    addProjectUpdateComment,
    getUserReactionForUpdate,
    toggleProjectUpdateReaction,
    getProjectUpdateStats,

    deleteProjectUpdate,
    setProjectUpdateVisibility,

    migrateLegacyLocalProjectFeedToSupabase
  };

  window.uploadProjectUpdateToSupabase = uploadProjectUpdateToSupabase;
  window.fetchProjectUpdatesFeed = fetchProjectUpdatesFeed;
  window.fetchProjectUpdates = fetchProjectUpdates;
  window.fetchProjectUpdateComments = fetchProjectUpdateComments;
  window.addProjectUpdateComment = addProjectUpdateComment;
  window.toggleProjectUpdateReaction = toggleProjectUpdateReaction;
  window.getProjectUpdateStats = getProjectUpdateStats;
  window.deleteProjectUpdate = deleteProjectUpdate;
  window.setProjectUpdateVisibility = setProjectUpdateVisibility;
  window.resolveProjectMeta = resolveProjectMeta;

})();
