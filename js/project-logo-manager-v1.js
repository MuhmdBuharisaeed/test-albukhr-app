/* =========================================================
   ALBUKHR DASHBOARD PROJECT LOGO MANAGER v1
   =========================================================
   PURPOSE
   - Admin dashboard project-logo selection, validation, upload
     and projects-table metadata update.
   - Uses the existing Admin Supabase client.
   - Does NOT create another Supabase client.
   - Does NOT modify project registration automatically.
   - Does NOT trust file extension alone.
   - Enforces:
       * exactly one selected file
       * PNG/JPG/JPEG
       * <= 1 MB
       * >= 400x400 pixels
   - Upload path:
       <network>/<project_code>/<unique-file>
   - Updates:
       projects.logo_url
       projects.logo_path
       projects.logo_mime_type
       projects.logo_size_bytes
       projects.logo_width
       projects.logo_height
   ========================================================= */

(function(window){

  "use strict";

  const BUCKET = "project-logos";
  const MAX_SIZE = 1024 * 1024;
  const MIN_WIDTH = 400;
  const MIN_HEIGHT = 400;
  const ALLOWED_TYPES = new Set([
    "image/png",
    "image/jpeg"
  ]);

  function cleanString(value, fallback = ""){
    if(value === null || value === undefined) return fallback;
    return String(value).trim();
  }

  function requireAdminClient(){
    if(typeof window.getAlbukhrAdminSupabaseClient !== "function"){
      throw new Error(
        "ALBUKHR Admin Supabase Auth Core is not loaded."
      );
    }

    const client = window.getAlbukhrAdminSupabaseClient();

    if(!client){
      throw new Error(
        "ALBUKHR Admin Supabase client is unavailable."
      );
    }

    return client;
  }

  function getNetwork(){
    if(typeof window.getAlbukhrAdminEnvironment === "function"){
      const network = window.getAlbukhrAdminEnvironment();

      if(network === "mainnet" || network === "testnet"){
        return network;
      }
    }

    if(typeof window.getAlbukhrNetwork === "function"){
      const network = window.getAlbukhrNetwork();

      if(network === "mainnet" || network === "testnet"){
        return network;
      }
    }

    throw new Error(
      "ALBUKHR network could not be determined."
    );
  }

  function sanitizeProjectCode(projectCode){
    const value = cleanString(projectCode);

    if(!value){
      throw new Error("Project code is required.");
    }

    if(!/^[A-Za-z0-9_-]+$/.test(value)){
      throw new Error(
        "Invalid project code. Only letters, numbers, underscore and hyphen are allowed."
      );
    }

    return value;
  }

  function getExtension(file){
    if(file.type === "image/png") return "png";
    if(file.type === "image/jpeg") return "jpg";

    const name = cleanString(file.name).toLowerCase();

    if(name.endsWith(".png")) return "png";
    if(name.endsWith(".jpg") || name.endsWith(".jpeg")) return "jpg";

    throw new Error("Only PNG, JPG or JPEG images are allowed.");
  }

  function loadImageDimensions(file){
    return new Promise((resolve, reject) => {

      const objectUrl = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        const width = image.naturalWidth;
        const height = image.naturalHeight;

        URL.revokeObjectURL(objectUrl);

        resolve({ width, height });
      };

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(
          new Error(
            "The selected file is not a readable image."
          )
        );
      };

      image.src = objectUrl;
    });
  }

  async function validateProjectLogoFile(file){

    if(!file){
      throw new Error("Please select a project logo.");
    }

    if(file.size > MAX_SIZE){
      throw new Error(
        "Project logo must not exceed 1 MB."
      );
    }

    if(file.size <= 0){
      throw new Error(
        "Project logo file is empty."
      );
    }

    if(!ALLOWED_TYPES.has(file.type)){
      throw new Error(
        "Only PNG or JPG/JPEG images are allowed."
      );
    }

    const extension = getExtension(file);

    const dimensions =
      await loadImageDimensions(file);

    if(
      dimensions.width < MIN_WIDTH ||
      dimensions.height < MIN_HEIGHT
    ){
      throw new Error(
        `Project logo must be at least ${MIN_WIDTH}x${MIN_HEIGHT}px. ` +
        `Selected image is ${dimensions.width}x${dimensions.height}px.`
      );
    }

    return {
      valid: true,
      name: cleanString(file.name),
      type: file.type,
      extension,
      size: file.size,
      width: dimensions.width,
      height: dimensions.height
    };
  }

  async function getCurrentProject(projectCode){

    const code = sanitizeProjectCode(projectCode);
    const client = requireAdminClient();

    const { data, error } =
      await client
        .from("projects")
        .select(
          "id,project_code,project_name,project_type,status," +
          "logo_url,logo_path,logo_mime_type,logo_size_bytes," +
          "logo_width,logo_height"
        )
        .eq("project_code", code)
        .maybeSingle();

    if(error){
      throw new Error(
        error.message || "Failed to load project."
      );
    }

    if(!data){
      throw new Error(
        `Project "${code}" was not found.`
      );
    }

    return data;
  }

  function buildStoragePath(network, projectCode, extension){
    const safeCode = sanitizeProjectCode(projectCode);

    const unique =
      `${Date.now()}-${crypto.randomUUID()}.${extension}`;

    return `${network}/${safeCode}/${unique}`;
  }

  async function uploadProjectLogo(projectCode, file){

    const validation =
      await validateProjectLogoFile(file);

    const network = getNetwork();
    const client = requireAdminClient();
    const project = await getCurrentProject(projectCode);

    const storagePath =
      buildStoragePath(
        network,
        project.project_code,
        validation.extension
      );

    const { error: uploadError } =
      await client
        .storage
        .from(BUCKET)
        .upload(
          storagePath,
          file,
          {
            contentType: validation.type,
            upsert: false,
            cacheControl: "31536000"
          }
        );

    if(uploadError){
      throw new Error(
        uploadError.message ||
        "Project logo upload failed."
      );
    }

    const {
      data: publicData
    } =
      client
        .storage
        .from(BUCKET)
        .getPublicUrl(storagePath);

    const logoUrl =
      publicData?.publicUrl || null;

    if(!logoUrl){
      /*
        The upload succeeded. However, the projects row must
        not be updated with an empty URL.
      */
      await client
        .storage
        .from(BUCKET)
        .remove([storagePath]);

      throw new Error(
        "Logo uploaded but public URL could not be generated."
      );
    }

    const { error: updateError } =
      await client
        .from("projects")
        .update({
          logo_url: logoUrl,
          logo_path: storagePath,
          logo_mime_type: validation.type,
          logo_size_bytes: validation.size,
          logo_width: validation.width,
          logo_height: validation.height,
          updated_at: new Date().toISOString()
        })
        .eq("id", project.id);

    if(updateError){

      /*
        Compensating cleanup:
        if DB metadata update fails, remove the newly uploaded
        object so the Storage bucket does not accumulate orphan
        logos.
      */
      await client
        .storage
        .from(BUCKET)
        .remove([storagePath]);

      throw new Error(
        updateError.message ||
        "Project logo metadata update failed."
      );
    }

    /*
      Remove the previous logo only AFTER the database has
      successfully adopted the new logo.
    */
    if(
      project.logo_path &&
      project.logo_path !== storagePath
    ){
      const { error: removeError } =
        await client
          .storage
          .from(BUCKET)
          .remove([project.logo_path]);

      if(removeError){
        console.warn(
          "[PROJECT LOGO] Previous logo cleanup failed:",
          removeError
        );
      }
    }

    return {
      success: true,
      network,
      project_id: project.id,
      project_code: project.project_code,
      logo_url: logoUrl,
      logo_path: storagePath,
      logo_mime_type: validation.type,
      logo_size_bytes: validation.size,
      logo_width: validation.width,
      logo_height: validation.height,
      previous_logo_path: project.logo_path || null
    };
  }

  async function removeProjectLogo(projectCode){

    const project =
      await getCurrentProject(projectCode);

    const client =
      requireAdminClient();

    if(!project.logo_path){
      return {
        success: true,
        removed: false,
        project_code: project.project_code
      };
    }

    const { error: removeError } =
      await client
        .storage
        .from(BUCKET)
        .remove([project.logo_path]);

    if(removeError){
      throw new Error(
        removeError.message ||
        "Project logo removal failed."
      );
    }

    const { error: updateError } =
      await client
        .from("projects")
        .update({
          logo_url: null,
          logo_path: null,
          logo_mime_type: null,
          logo_size_bytes: null,
          logo_width: null,
          logo_height: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", project.id);

    if(updateError){
      throw new Error(
        updateError.message ||
        "Project logo metadata cleanup failed."
      );
    }

    return {
      success: true,
      removed: true,
      project_code: project.project_code
    };
  }

  function createProjectLogoFileInput(options = {}){
    const input = document.createElement("input");

    input.type = "file";
    input.accept = "image/png,image/jpeg,.png,.jpg,.jpeg";

    if(options.multiple === true){
      /*
        Logo policy allows one image only.
        Ignore accidental multiple=true.
      */
      input.multiple = false;
    }

    input.multiple = false;

    return input;
  }

  async function selectAndUploadProjectLogo(projectCode){

    const input =
      createProjectLogoFileInput();

    return new Promise((resolve, reject) => {

      input.addEventListener(
        "change",
        async () => {

          try{

            const file =
              input.files?.[0] || null;

            if(!file){
              reject(
                new Error(
                  "No project logo was selected."
                )
              );
              return;
            }

            const result =
              await uploadProjectLogo(
                projectCode,
                file
              );

            resolve(result);

          }catch(error){

            reject(error);

          }
        },
        { once: true }
      );

      input.click();
    });
  }

  window.ALBUKHR_PROJECT_LOGO_RULES = {
    bucket: BUCKET,
    max_size_bytes: MAX_SIZE,
    max_size_mb: 1,
    min_width: MIN_WIDTH,
    min_height: MIN_HEIGHT,
    max_images: 1,
    allowed_mime_types: [
      "image/png",
      "image/jpeg"
    ]
  };

  window.validateProjectLogoFile =
    validateProjectLogoFile;

  window.getCurrentProjectForLogo =
    getCurrentProject;

  window.uploadProjectLogo =
    uploadProjectLogo;

  window.removeProjectLogo =
    removeProjectLogo;

  window.createProjectLogoFileInput =
    createProjectLogoFileInput;

  window.selectAndUploadProjectLogo =
    selectAndUploadProjectLogo;

  console.log(
    "ALBUKHR Dashboard Project Logo Manager v1 ready"
  );

})(window);
