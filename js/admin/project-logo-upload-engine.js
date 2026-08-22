/* =========================================================
   ALBUKHR PROJECT LOGO UPLOAD ENGINE
   NEW ARCHITECTURE

   File:
   js/admin/project-logo-upload-engine.js

   Responsibilities:
   - Exactly one current project logo
   - PNG / JPG / JPEG
   - Minimum 400 x 400 px
   - Maximum 1 MB
   - Network-aware Supabase Storage path
   - projects logo metadata update
   - Admin/dashboard compatible

   Architecture:
   - Uses shared ALBUKHR Supabase client
   - Uses shared ALBUKHR network resolver
   - Does not create a Supabase client
   - Contains no Supabase credentials
   - Contains no localStorage
   ========================================================= */

(function(window){
"use strict";

const BUCKET = "project-logos";
const MAX_BYTES = 1024 * 1024;
const MIN_WIDTH = 400;
const MIN_HEIGHT = 400;
const ALLOWED_MIME = ["image/png", "image/jpeg"];
const ALLOWED_EXT = ["png", "jpg", "jpeg"];

function getSupabaseClient(){
  if(typeof window.getAlbukhrSupabaseClient !== "function"){
    throw new Error("ALBUKHR Supabase Core is not loaded.");
  }
  const client = window.getAlbukhrSupabaseClient();
  if(!client) throw new Error("ALBUKHR Supabase client is unavailable.");
  return client;
}

function getNetwork(){
  if(typeof window.requireAlbukhrNetwork === "function"){
    const network = window.requireAlbukhrNetwork();
    if(network === "mainnet" || network === "testnet") return network;
  }

  if(typeof window.getAlbukhrNetwork === "function"){
    const network = window.getAlbukhrNetwork();
    if(network === "mainnet" || network === "testnet") return network;
  }

  const host = String(window.location.hostname || "").toLowerCase();
  if(host === "test.albukhr.com" || host.startsWith("test.")) return "testnet";
  if(host === "app.albukhr.com" || host.startsWith("app.")) return "mainnet";

  throw new Error("ALBUKHR network could not be determined.");
}

function safeString(value){
  return value == null ? "" : String(value).trim();
}

function getExtension(fileName){
  const name = safeString(fileName).toLowerCase();
  const index = name.lastIndexOf(".");
  return index === -1 ? "" : name.slice(index + 1);
}

function isAllowedMime(type){
  return ALLOWED_MIME.includes(safeString(type).toLowerCase());
}

function isAllowedExtension(name){
  return ALLOWED_EXT.includes(getExtension(name));
}

async function readImageDimensions(file){
  if(typeof createImageBitmap === "function"){
    try{
      const bitmap = await createImageBitmap(file);
      const result = {width: bitmap.width, height: bitmap.height};
      if(typeof bitmap.close === "function") bitmap.close();
      return result;
    }catch(_){}
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const result = {
        width: image.naturalWidth,
        height: image.naturalHeight
      };
      URL.revokeObjectURL(url);
      resolve(result);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The selected file is not a readable image."));
    };

    image.src = url;
  });
}

async function validateProjectLogoFile(file){
  if(!file) return {valid:false, error:"Please select a project logo."};
  if(typeof File !== "undefined" && !(file instanceof File)){
    return {valid:false, error:"Invalid file object."};
  }

  const mimeType = safeString(file.type).toLowerCase();
  const extension = getExtension(file.name);

  if(!isAllowedMime(mimeType)){
    return {valid:false, error:"Logo must be PNG or JPG/JPEG."};
  }

  if(!isAllowedExtension(file.name)){
    return {valid:false, error:"Logo filename must use PNG, JPG, or JPEG."};
  }

  if(file.size <= 0){
    return {valid:false, error:"Logo file is empty."};
  }

  if(file.size > MAX_BYTES){
    return {valid:false, error:"Logo must not exceed 1 MB."};
  }

  let dimensions;
  try{
    dimensions = await readImageDimensions(file);
  }catch(error){
    return {
      valid:false,
      error:error?.message || "Unable to read logo dimensions."
    };
  }

  if(dimensions.width < MIN_WIDTH || dimensions.height < MIN_HEIGHT){
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
    extension:extension === "jpeg" ? "jpg" : extension,
    size_bytes:file.size,
    width:dimensions.width,
    height:dimensions.height
  };
}

function sanitizeProjectCode(projectCode){
  const code = safeString(projectCode);
  if(!code) throw new Error("Project code is required.");

  if(!/^[A-Za-z0-9_-]+$/.test(code)){
    throw new Error(
      "Invalid project code. Only letters, numbers, underscore and hyphen are allowed."
    );
  }

  return code;
}

function buildProjectLogoPath(projectCode, extension){
  const code = sanitizeProjectCode(projectCode);
  const network = getNetwork();
  const cleanExt = extension === "jpeg" ? "jpg" : extension;

  const unique =
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${network}/${code}/${unique}.${cleanExt}`;
}

function getPublicLogoUrl(supabase, path){
  const result = supabase.storage.from(BUCKET).getPublicUrl(path);
  return result?.data?.publicUrl || null;
}

async function removeStoredLogo(supabase, path){
  const oldPath = safeString(path);
  if(!oldPath) return {success:true, skipped:true};

  try{
    const {error} = await supabase.storage.from(BUCKET).remove([oldPath]);

    if(error){
      console.warn("[PROJECT LOGO] Storage removal failed:", error);
      return {success:false, error:error.message || "Storage removal failed."};
    }

    return {success:true, skipped:false};
  }catch(error){
    console.warn("[PROJECT LOGO] Storage removal exception:", error);
    return {success:false, error:error?.message || "Storage removal failed."};
  }
}

async function getProjectLogoRow(projectCode){
  const supabase = getSupabaseClient();
  const code = sanitizeProjectCode(projectCode);
  const network = getNetwork();

  const {data, error} = await supabase
    .from("projects")
    .select(
      "id,project_code,project_name,network," +
      "logo_url,logo_path,logo_mime_type,logo_size_bytes,logo_width,logo_height"
    )
    .eq("project_code", code)
    .eq("network", network)
    .maybeSingle();

  if(error){
    throw new Error(error.message || "Unable to read project logo record.");
  }

  return data || null;
}

async function uploadProjectLogo(projectCode, file){
  const code = safeString(projectCode);
  if(!code) return {success:false, error:"Project code is required."};

  const validation = await validateProjectLogoFile(file);
  if(!validation.valid){
    return {success:false, error:validation.error, validation};
  }

  try{
    const supabase = getSupabaseClient();
    const network = getNetwork();
    const current = await getProjectLogoRow(code);

    if(!current){
      return {success:false, error:"Project was not found in the active network."};
    }

    const oldPath = safeString(current.logo_path);
    const path = buildProjectLogoPath(code, validation.extension);

    const {error:uploadError} = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        cacheControl:"31536000",
        upsert:false,
        contentType:validation.mime_type
      });

    if(uploadError){
      return {
        success:false,
        error:uploadError.message || "Project logo upload failed."
      };
    }

    const logoUrl = getPublicLogoUrl(supabase, path);

    if(!logoUrl){
      await removeStoredLogo(supabase, path);
      return {
        success:false,
        error:"Logo uploaded, but a public logo URL could not be generated."
      };
    }

    const {data, error:updateError} = await supabase
      .from("projects")
      .update({
        logo_url:logoUrl,
        logo_path:path,
        logo_mime_type:validation.mime_type,
        logo_size_bytes:validation.size_bytes,
        logo_width:validation.width,
        logo_height:validation.height,
        updated_at:new Date().toISOString()
      })
      .eq("id", current.id)
      .eq("network", network)
      .select(
        "id,project_code,project_name,network," +
        "logo_url,logo_path,logo_mime_type,logo_size_bytes,logo_width,logo_height"
      )
      .single();

    if(updateError){
      await removeStoredLogo(supabase, path);
      return {
        success:false,
        error:updateError.message || "Project logo database update failed."
      };
    }

    if(oldPath && oldPath !== path){
      await removeStoredLogo(supabase, oldPath);
    }

    if(typeof window.refreshProjectsCache === "function"){
      try{ await window.refreshProjectsCache(); }
      catch(error){ console.warn("[PROJECT LOGO] Cache refresh warning:", error); }
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
      error:error?.message || "Project logo upload failed."
    };
  }
}

async function deleteProjectLogo(projectCode){
  const code = safeString(projectCode);
  if(!code) return {success:false, error:"Project code is required."};

  try{
    const supabase = getSupabaseClient();
    const network = getNetwork();
    const current = await getProjectLogoRow(code);

    if(!current){
      return {success:false, error:"Project was not found in the active network."};
    }

    const oldPath = safeString(current.logo_path);

    /*
     * DB is the source of truth. Clear metadata first only if the
     * application accepts a temporary storage orphan. To avoid
     * deleting the only known object before DB succeeds, update
     * metadata first, then perform best-effort storage cleanup.
     */
    const {error:updateError} = await supabase
      .from("projects")
      .update({
        logo_url:null,
        logo_path:null,
        logo_mime_type:null,
        logo_size_bytes:null,
        logo_width:null,
        logo_height:null,
        updated_at:new Date().toISOString()
      })
      .eq("id", current.id)
      .eq("network", network);

    if(updateError){
      return {
        success:false,
        error:updateError.message || "Unable to clear project logo metadata."
      };
    }

    if(oldPath){
      const cleanup = await removeStoredLogo(supabase, oldPath);
      if(!cleanup.success){
        console.warn("[PROJECT LOGO] Orphan cleanup required:", cleanup.error);
      }
    }

    if(typeof window.refreshProjectsCache === "function"){
      try{ await window.refreshProjectsCache(); }
      catch(error){ console.warn("[PROJECT LOGO] Cache refresh warning:", error); }
    }

    return {success:true, project_code:code, network};

  }catch(error){
    return {
      success:false,
      error:error?.message || "Project logo deletion failed."
    };
  }
}

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

async function testProjectLogoStorage(){
  try{
    const supabase = getSupabaseClient();
    const network = getNetwork();

    const {data, error} = await supabase.storage
      .from(BUCKET)
      .list(network, {limit:1});

    if(error){
      return {
        success:false,
        network,
        bucket:BUCKET,
        error:error.message || "Project logo storage test failed."
      };
    }

    return {
      success:true,
      network,
      bucket:BUCKET,
      accessible:true,
      sample_count:Array.isArray(data) ? data.length : 0
    };
  }catch(error){
    return {
      success:false,
      network:null,
      bucket:BUCKET,
      accessible:false,
      error:error?.message || "Project logo storage health check failed."
    };
  }
}

window.ALBUKHR_PROJECT_LOGO_RULES = getProjectLogoRules();
window.validateProjectLogoFile = validateProjectLogoFile;
window.getProjectLogoRules = getProjectLogoRules;
window.buildProjectLogoPath = buildProjectLogoPath;
window.getProjectLogoRow = getProjectLogoRow;
window.uploadProjectLogo = uploadProjectLogo;
window.deleteProjectLogo = deleteProjectLogo;
window.testProjectLogoStorage = testProjectLogoStorage;

console.log("ALBUKHR Project Logo Upload Engine — New Architecture Ready");

})(window);
