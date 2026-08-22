/* =========================================================
   ALBUKHR — DASHBOARD PROJECT LOGO MANAGER
   New Architecture
   File: js/admin/project-logo-manager.js

   Responsibilities:
   - Admin project-logo selection, validation and upload
   - Network-aware project lookup
   - Supabase Storage upload through shared Admin client
   - Project metadata update
   - Previous-logo cleanup
   - No LocalStorage
   - No Supabase credentials
   - No private/service-role key
   - No independent Supabase client
   - No project registration side effects
   ========================================================= */

"use strict";

(() => {
  const BUCKET = "project-logos";
  const MAX_SIZE_BYTES = 1024 * 1024;
  const MIN_WIDTH = 400;
  const MIN_HEIGHT = 400;
  const ALLOWED_MIME_TYPES = new Set([
    "image/png",
    "image/jpeg"
  ]);

  function cleanString(value, fallback = "") {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
  }

  function getAdminClient() {
    if (
      typeof window.getAlbukhrAdminSupabaseClient !== "function"
    ) {
      throw new Error(
        "ALBUKHR Admin Supabase Auth Core is not loaded."
      );
    }

    const client =
      window.getAlbukhrAdminSupabaseClient();

    if (!client || typeof client.from !== "function") {
      throw new Error(
        "ALBUKHR shared Admin Supabase client is unavailable."
      );
    }

    return client;
  }

  function getNetwork() {
    const candidates = [
      typeof window.getAlbukhrAdminEnvironment === "function"
        ? window.getAlbukhrAdminEnvironment()
        : null,
      typeof window.getAlbukhrNetwork === "function"
        ? window.getAlbukhrNetwork()
        : null,
      window.AlbukhrEnvironment?.current,
      window.AlbukhrEnvironment?.network,
      document.documentElement?.dataset?.network,
      document.body?.dataset?.network
    ];

    for (const value of candidates) {
      const network =
        cleanString(value).toLowerCase();

      if (network === "mainnet" || network === "testnet") {
        return network;
      }
    }

    const host =
      window.location.hostname.toLowerCase();

    if (
      host === "test.albukhr.com" ||
      host.startsWith("test.")
    ) {
      return "testnet";
    }

    if (
      host === "app.albukhr.com" ||
      host.startsWith("app.")
    ) {
      return "mainnet";
    }

    throw new Error(
      "ALBUKHR network could not be determined."
    );
  }

  function sanitizeProjectCode(projectCode) {
    const value = cleanString(projectCode);

    if (!value) {
      throw new Error("Project code is required.");
    }

    if (!/^[A-Za-z0-9_-]+$/.test(value)) {
      throw new Error(
        "Invalid project code. Only letters, numbers, underscore and hyphen are allowed."
      );
    }

    return value;
  }

  function getFileExtension(file) {
    if (file.type === "image/png") return "png";
    if (file.type === "image/jpeg") return "jpg";

    const name =
      cleanString(file.name).toLowerCase();

    if (name.endsWith(".png")) return "png";
    if (
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg")
    ) {
      return "jpg";
    }

    throw new Error(
      "Only PNG, JPG or JPEG images are allowed."
    );
  }

  function loadImageDimensions(file) {
    return new Promise((resolve, reject) => {
      const objectUrl =
        URL.createObjectURL(file);

      const image = new Image();

      image.onload = () => {
        const dimensions = {
          width: image.naturalWidth,
          height: image.naturalHeight
        };

        URL.revokeObjectURL(objectUrl);
        resolve(dimensions);
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

  async function validateProjectLogoFile(file) {
    if (!file) {
      throw new Error(
        "Please select a project logo."
      );
    }

    if (file.size <= 0) {
      throw new Error(
        "Project logo file is empty."
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      throw new Error(
        "Project logo must not exceed 1 MB."
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      throw new Error(
        "Only PNG or JPG/JPEG images are allowed."
      );
    }

    const extension =
      getFileExtension(file);

    const dimensions =
      await loadImageDimensions(file);

    if (
      dimensions.width < MIN_WIDTH ||
      dimensions.height < MIN_HEIGHT
    ) {
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

  async function getCurrentProject(projectCode) {
    const code =
      sanitizeProjectCode(projectCode);

    const network =
      getNetwork();

    const client =
      getAdminClient();

    /*
     * Network isolation is mandatory.
     * Never resolve a project by project_code alone.
     */
    const { data, error } =
      await client
        .from("projects")
        .select(
          "id,network,project_code,project_name,project_type,status," +
          "logo_url,logo_path,logo_mime_type,logo_size_bytes," +
          "logo_width,logo_height"
        )
        .eq("network", network)
        .eq("project_code", code)
        .maybeSingle();

    if (error) {
      throw new Error(
        error.message ||
        "Failed to load project."
      );
    }

    if (!data) {
      throw new Error(
        `Project "${code}" was not found on ${network}.`
      );
    }

    return data;
  }

  function createUniqueFileName(extension) {
    let uniqueId;

    if (
      window.crypto &&
      typeof window.crypto.randomUUID === "function"
    ) {
      uniqueId =
        window.crypto.randomUUID();
    } else {
      uniqueId =
        `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`;
    }

    return `${Date.now()}-${uniqueId}.${extension}`;
  }

  function buildStoragePath(
    network,
    projectCode,
    extension
  ) {
    const safeCode =
      sanitizeProjectCode(projectCode);

    return [
      network,
      safeCode,
      createUniqueFileName(extension)
    ].join("/");
  }

  async function uploadProjectLogo(
    projectCode,
    file
  ) {
    const validation =
      await validateProjectLogoFile(file);

    const network =
      getNetwork();

    const client =
      getAdminClient();

    const project =
      await getCurrentProject(projectCode);

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

    if (uploadError) {
      throw new Error(
        uploadError.message ||
        "Project logo upload failed."
      );
    }

    const { data: publicData } =
      client
        .storage
        .from(BUCKET)
        .getPublicUrl(storagePath);

    const logoUrl =
      publicData?.publicUrl || null;

    if (!logoUrl) {
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
          updated_at:
            new Date().toISOString()
        })
        .eq("id", project.id)
        .eq("network", network);

    if (updateError) {
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
     * The DB now points to the new object.
     * Only then remove the old object.
     */
    if (
      project.logo_path &&
      project.logo_path !== storagePath
    ) {
      const { error: cleanupError } =
        await client
          .storage
          .from(BUCKET)
          .remove([project.logo_path]);

      if (cleanupError) {
        console.warn(
          "[ALBUKHR PROJECT LOGO] Previous logo cleanup failed:",
          cleanupError
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
      previous_logo_path:
        project.logo_path || null
    };
  }

  async function removeProjectLogo(
    projectCode
  ) {
    const project =
      await getCurrentProject(projectCode);

    const client =
      getAdminClient();

    const network =
      getNetwork();

    if (!project.logo_path) {
      return {
        success: true,
        removed: false,
        network,
        project_code:
          project.project_code
      };
    }

    const { error: removeError } =
      await client
        .storage
        .from(BUCKET)
        .remove([project.logo_path]);

    if (removeError) {
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
          updated_at:
            new Date().toISOString()
        })
        .eq("id", project.id)
        .eq("network", network);

    if (updateError) {
      throw new Error(
        updateError.message ||
        "Project logo metadata cleanup failed."
      );
    }

    return {
      success: true,
      removed: true,
      network,
      project_code:
        project.project_code
    };
  }

  function createProjectLogoFileInput() {
    const input =
      document.createElement("input");

    input.type = "file";
    input.accept =
      "image/png,image/jpeg,.png,.jpg,.jpeg";
    input.multiple = false;

    return input;
  }

  async function selectAndUploadProjectLogo(
    projectCode
  ) {
    const input =
      createProjectLogoFileInput();

    return new Promise((resolve, reject) => {
      input.addEventListener(
        "change",
        async () => {
          try {
            const file =
              input.files?.[0] || null;

            if (!file) {
              reject(
                new Error(
                  "No project logo was selected."
                )
              );
              return;
            }

            resolve(
              await uploadProjectLogo(
                projectCode,
                file
              )
            );
          } catch (error) {
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
    max_size_bytes:
      MAX_SIZE_BYTES,
    max_size_mb: 1,
    min_width: MIN_WIDTH,
    min_height: MIN_HEIGHT,
    max_images: 1,
    allowed_mime_types: [
      "image/png",
      "image/jpeg"
    ]
  };

  window.AlbukhrProjectLogoManager = {
    getNetwork,
    getCurrentProject,
    validateProjectLogoFile,
    uploadProjectLogo,
    removeProjectLogo,
    createProjectLogoFileInput,
    selectAndUploadProjectLogo
  };

  /*
   * Backward-compatible global names.
   */
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
    "ALBUKHR Project Logo Manager — New Architecture ready."
  );
})();
