/* =========================================================
   ALBUKHR PROJECT LOGO UPLOAD ENGINE v1
   LOGO-FIRST PROJECT MIGRATION

   PURPOSE
   - Enforce exactly 1 project logo
   - PNG / JPG / JPEG only
   - Minimum 400 x 400 px
   - Maximum 1 MB
   - Upload to Supabase Storage bucket: project-logos
   - Store logo_path / logo_url + metadata in projects
   - Network-aware storage path
   - Admin/dashboard compatible

   DEPENDS ON
   - js/supabase-core.js
   - js/projects-engine-v3-logo-first.js
   - Supabase JS v2

   IMPORTANT
   - This engine does NOT create a second Supabase client.
   - RLS/storage policies remain the database security boundary.
   - The browser validates files for UX; server-side/storage policies
     must still enforce authorization.
========================================================= */

(function(window){
"use strict";

const BUCKET = "project-logos";
const MAX_BYTES = 1024 * 1024; // 1 MB
const MIN_WIDTH = 400;
const MIN_HEIGHT = 400;
const ALLOWED_MIME = ["image/png", "image/jpeg"];
const ALLOWED_EXT = ["png", "jpg", "jpeg"];

/* =========================================================
   CLIENT
========================================================= */

function getLogoSupabaseClient(){

  if(typeof window.getAlbukhrSupabaseClient !== "function"){
    throw new Error(
      "ALBUKHR Supabase Core is not loaded."
    );
  }

  const client = window.getAlbukhrSupabaseClient();

  if(!client){
    throw new Error(
      "ALBUKHR Supabase client is unavailable."
    );
  }

  return client;
}

/* =========================================================
   NETWORK
========================================================= */

function getLogoNetwork(){

  if(typeof window.requireAlbukhrNetwork === "function"){
    return window.requireAlbukhrNetwork();
  }

  if(typeof window.getAlbukhrNetwork === "function"){
    const network = window.getAlbukhrNetwork();

    if(network === "mainnet" || network === "testnet"){
      return network;
    }
  }

  throw new Error(
    "ALBUKHR network core is not available."
  );
}

/* =========================================================
   SAFE HELPERS
========================================================= */

function safeString(value){
  return value == null ? "" : String(value).trim();
}

function getExtension(fileName){

  const name = safeString(fileName).toLowerCase();
  const index = name.lastIndexOf(".");

  if(index === -1){
    return "";
  }

  return name.slice(index + 1);
}

function isAllowedMime(type){
  return ALLOWED_MIME.includes(
    safeString(type).toLowerCase()
  );
}

function isAllowedExtension(fileName){
  return ALLOWED_EXT.includes(
    getExtension(fileName)
  );
}

/* =========================================================
   IMAGE DIMENSION READER
========================================================= */

async function readImageDimensions(file){

  if(
    typeof createImageBitmap === "function"
  ){

    try{

      const bitmap =
        await createImageBitmap(file);

      const width = bitmap.width;
      const height = bitmap.height;

      if(typeof bitmap.close === "function"){
        bitmap.close();
      }

      return { width, height };

    }catch(e){

      /* Continue with Image fallback. */

    }

  }

  return await new Promise((resolve, reject)=>{

    const url =
      URL.createObjectURL(file);

    const image =
      new Image();

    image.onload = ()=>{

      const result = {
        width: image.naturalWidth,
        height: image.naturalHeight
      };

      URL.revokeObjectURL(url);
      resolve(result);

    };

    image.onerror = ()=>{

      URL.revokeObjectURL(url);

      reject(
        new Error(
          "The selected file is not a readable image."
        )
      );

    };

    image.src = url;

  });

}

/* =========================================================
   VALIDATE LOGO FILE
========================================================= */

async function validateProjectLogoFile(file){

  if(!file){

    return {
      valid:false,
      error:"Please select a project logo."
    };

  }

  if(!(file instanceof File)){

    return {
      valid:false,
      error:"Invalid file object."
    };

  }

  const mimeType =
    safeString(file.type).toLowerCase();

  const extension =
    getExtension(file.name);

  /* -----------------------------------------
     FORMAT
  ----------------------------------------- */

  if(!isAllowedMime(mimeType)){

    return {
      valid:false,
      error:"Logo must be PNG or JPG/JPEG."
    };

  }

  if(!isAllowedExtension(extension)){

    return {
      valid:false,
      error:"Logo filename must use PNG, JPG, or JPEG."
    };

  }

  /* -----------------------------------------
     SIZE
  ----------------------------------------- */

  if(file.size <= 0){

    return {
      valid:false,
      error:"Logo file is empty."
    };

  }

  if(file.size > MAX_BYTES){

    return {
      valid:false,
      error:"Logo must not exceed 1 MB."
    };

  }

  /* -----------------------------------------
     DIMENSIONS
  ----------------------------------------- */

  let dimensions;

  try{

    dimensions =
      await readImageDimensions(file);

  }catch(error){

    return {
      valid:false,
      error:
        error?.message ||
        "Unable to read logo dimensions."
    };

  }

  if(
    dimensions.width < MIN_WIDTH ||
    dimensions.height < MIN_HEIGHT
  ){

    return {
      valid:false,
      error:
        `Logo must be at least ${MIN_WIDTH}x${MIN_HEIGHT}px. ` +
        `Selected image is ${dimensions.width}x${dimensions.height}px.`
    };

  }

  return {

    valid:true,

    error:null,

    file,

    mime_type:mimeType,

    extension:
      extension === "jpeg" ? "jpg" : extension,

    size_bytes:file.size,

    width:dimensions.width,

    height:dimensions.height

  };

}

/* =========================================================
   STORAGE PATH
========================================================= */

function buildProjectLogoPath(
  projectCode,
  extension
){

  const code =
    safeString(projectCode);

  if(!code){

    throw new Error(
      "Project code is required."
    );

  }

  const network =
    getLogoNetwork();

  const cleanCode =
    code
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 100);

  const cleanExt =
    extension === "jpeg" ? "jpg" : extension;

  /*
     UUID prevents collisions while the DB record
     guarantees only one current logo for the project.
  */

  const unique =
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return (
    `${network}/` +
    `${cleanCode}/` +
    `${unique}.${cleanExt}`
  );

}

/* =========================================================
   PUBLIC URL
========================================================= */

function getPublicLogoUrl(
  supabase,
  path
){

  const result =
    supabase.storage
      .from(BUCKET)
      .getPublicUrl(path);

  return result?.data?.publicUrl || null;

}

/* =========================================================
   DELETE OLD LOGO
========================================================= */

async function removeStoredLogo(
  supabase,
  path
){

  const oldPath =
    safeString(path);

  if(!oldPath){
    return {
      success:true,
      skipped:true
    };
  }

  try{

    const { error } =
      await supabase.storage
        .from(BUCKET)
        .remove([oldPath]);

    if(error){

      console.warn(
        "[PROJECT LOGO] Old logo removal failed:",
        error
      );

      return {
        success:false,
        error:error.message || "Old logo removal failed"
      };

    }

    return {
      success:true,
      skipped:false
    };

  }catch(error){

    console.warn(
      "[PROJECT LOGO] Old logo removal exception:",
      error
    );

    return {
      success:false,
      error:error?.message || "Old logo removal failed"
    };

  }

}

/* =========================================================
   GET CURRENT PROJECT ROW
========================================================= */

async function getProjectLogoRow(
  projectCode
){

  const supabase =
    getLogoSupabaseClient();

  const code =
    safeString(projectCode);

  if(!code){
    throw new Error("Project code is required.");
  }

  const { data, error } =
    await supabase
      .from("projects")
      .select(
        "id,project_code,logo_url,logo_path," +
        "logo_mime_type,logo_size_bytes," +
        "logo_width,logo_height"
      )
      .eq("project_code", code)
      .maybeSingle();

  if(error){

    throw new Error(
      error.message ||
      "Unable to read project logo record."
    );

  }

  return data || null;

}

/* =========================================================
   UPLOAD PROJECT LOGO
========================================================= */

async function uploadProjectLogo(
  projectCode,
  file
){

  const code =
    safeString(projectCode);

  if(!code){

    return {
      success:false,
      error:"Project code is required."
    };

  }

  /* -----------------------------------------
     VALIDATE
  ----------------------------------------- */

  const validation =
    await validateProjectLogoFile(file);

  if(!validation.valid){

    return {
      success:false,
      error:validation.error,
      validation
    };

  }

  let supabase;

  try{

    supabase =
      getLogoSupabaseClient();

    /*
      Require the active network before creating
      the storage path.
    */

    const network =
      getLogoNetwork();

    const current =
      await getProjectLogoRow(code);

    if(!current){

      return {
        success:false,
        error:"Project was not found."
      };

    }

    const oldPath =
      safeString(current.logo_path);

    const path =
      buildProjectLogoPath(
        code,
        validation.extension
      );

    /* -----------------------------------------
       UPLOAD NEW FILE FIRST
    ----------------------------------------- */

    const { error:uploadError } =
      await supabase.storage
        .from(BUCKET)
        .upload(
          path,
          file,
          {
            cacheControl:"31536000",
            upsert:false,
            contentType:validation.mime_type
          }
        );

    if(uploadError){

      return {
        success:false,
        error:
          uploadError.message ||
          "Project logo upload failed."
      };

    }

    /* -----------------------------------------
       PUBLIC URL
    ----------------------------------------- */

    const logoUrl =
      getPublicLogoUrl(
        supabase,
        path
      );

    /*
      We require a usable URL for marketplace/
      public project rendering.
    */

    if(!logoUrl){

      await removeStoredLogo(
        supabase,
        path
      );

      return {
        success:false,
        error:
          "Logo uploaded, but a public logo URL could not be generated."
      };

    }

    /* -----------------------------------------
       DATABASE UPDATE
    ----------------------------------------- */

    const { data, error:updateError } =
      await supabase
        .from("projects")
        .update({

          logo_url:logoUrl,

          logo_path:path,

          logo_mime_type:
            validation.mime_type,

          logo_size_bytes:
            validation.size_bytes,

          logo_width:
            validation.width,

          logo_height:
            validation.height,

          updated_at:
            new Date().toISOString()

        })
        .eq(
          "project_code",
          code
        )
        .select(
          "id,project_code,project_name," +
          "logo_url,logo_path,logo_mime_type," +
          "logo_size_bytes,logo_width,logo_height"
        )
        .single();

    if(updateError){

      /*
        Roll back the newly uploaded object.
        The old logo remains untouched.
      */

      await removeStoredLogo(
        supabase,
        path
      );

      return {
        success:false,
        error:
          updateError.message ||
          "Project logo database update failed."
      };

    }

    /* -----------------------------------------
       REMOVE OLD LOGO
       Only after DB points to new logo.
    ----------------------------------------- */

    if(
      oldPath &&
      oldPath !== path
    ){

      await removeStoredLogo(
        supabase,
        oldPath
      );

    }

    /* -----------------------------------------
       REFRESH PROJECT CACHE
    ----------------------------------------- */

    try{

      if(
        typeof window.refreshProjectsCache ===
        "function"
      ){

        await window.refreshProjectsCache();

      }

    }catch(cacheError){

      console.warn(
        "[PROJECT LOGO] Cache refresh warning:",
        cacheError
      );

    }

    return {

      success:true,

      network,

      project:data,

      logo_url:logoUrl,

      logo_path:path,

      validation

    };

  }catch(error){

    return {

      success:false,

      error:
        error?.message ||
        "Project logo upload failed."

    };

  }

}

/* =========================================================
   DELETE PROJECT LOGO
========================================================= */

async function deleteProjectLogo(
  projectCode
){

  const code =
    safeString(projectCode);

  if(!code){

    return {
      success:false,
      error:"Project code is required."
    };

  }

  try{

    const supabase =
      getLogoSupabaseClient();

    getLogoNetwork();

    const current =
      await getProjectLogoRow(code);

    if(!current){

      return {
        success:false,
        error:"Project was not found."
      };

    }

    const oldPath =
      safeString(current.logo_path);

    if(oldPath){

      const { error:storageError } =
        await supabase.storage
          .from(BUCKET)
          .remove([oldPath]);

      if(storageError){

        return {
          success:false,
          error:
            storageError.message ||
            "Unable to remove stored logo."
        };

      }

    }

    const { error:updateError } =
      await supabase
        .from("projects")
        .update({

          logo_url:null,
          logo_path:null,
          logo_mime_type:null,
          logo_size_bytes:null,
          logo_width:null,
          logo_height:null,
          updated_at:
            new Date().toISOString()

        })
        .eq(
          "project_code",
          code
        );

    if(updateError){

      return {
        success:false,
        error:
          updateError.message ||
          "Unable to clear project logo metadata."
      };

    }

    try{

      if(
        typeof window.refreshProjectsCache ===
        "function"
      ){

        await window.refreshProjectsCache();

      }

    }catch(e){

      console.warn(
        "[PROJECT LOGO] Cache refresh warning:",
        e
      );

    }

    return {
      success:true,
      project_code:code
    };

  }catch(error){

    return {
      success:false,
      error:
        error?.message ||
        "Project logo deletion failed."
    };

  }

}

/* =========================================================
   LOGO VALIDATION SUMMARY
========================================================= */

function getProjectLogoRules(){

  return {

    bucket:BUCKET,

    min_width:MIN_WIDTH,

    min_height:MIN_HEIGHT,

    max_size_bytes:MAX_BYTES,

    max_size_mb:1,

    allowed_mime_types:[...ALLOWED_MIME],

    allowed_extensions:[...ALLOWED_EXT],

    max_images_per_project:1

  };

}

/* =========================================================
   HEALTH
========================================================= */

async function testProjectLogoStorage(){

  try{

    const supabase =
      getLogoSupabaseClient();

    const network =
      getLogoNetwork();

    const { data, error } =
      await supabase.storage
        .from(BUCKET)
        .list(
          network,
          {
            limit:1
          }
        );

    if(error){

      return {
        success:false,
        network,
        bucket:BUCKET,
        error:
          error.message ||
          "Project logo storage test failed."
      };

    }

    return {
      success:true,
      network,
      bucket:BUCKET,
      accessible:true,
      sample_count:
        Array.isArray(data) ? data.length : 0
    };

  }catch(error){

    return {
      success:false,
      network:null,
      bucket:BUCKET,
      accessible:false,
      error:
        error?.message ||
        "Project logo storage health check failed."
    };

  }

}

/* =========================================================
   EXPORTS
========================================================= */

window.PROJECT_LOGO_BUCKET =
  BUCKET;

window.validateProjectLogoFile =
  validateProjectLogoFile;

window.getProjectLogoRules =
  getProjectLogoRules;

window.buildProjectLogoPath =
  buildProjectLogoPath;

window.getProjectLogoRow =
  getProjectLogoRow;

window.uploadProjectLogo =
  uploadProjectLogo;

window.deleteProjectLogo =
  deleteProjectLogo;

window.testProjectLogoStorage =
  testProjectLogoStorage;

console.log(
  "ALBUKHR Project Logo Upload Engine v1 — Ready"
);

})(window);
