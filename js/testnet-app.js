(function(window, document) {
  "use strict";

  let stage = "START";

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function getStatus() {
    return document.getElementById("registryStatus");
  }

  function setStatus(text) {
    const el = getStatus();
    if (el) el.textContent = text;
  }

  function errorMessage(error) {
    if (!error) return "Unknown error.";
    const parts = [];
    if (error.message) parts.push(error.message);
    if (error.code && error.code !== error.message) parts.push("code=" + error.code);
    if (error.status) parts.push("status=" + error.status);
    if (error.details) parts.push("details=" + error.details);
    if (error.hint) parts.push("hint=" + error.hint);
    return parts.join(" | ") || String(error);
  }

  function fail(error) {
    const message = errorMessage(error);
    console.error("[ALBUKHR TESTNET DIAGNOSTIC]", { stage, error, message });
    setStatus("FAILED • " + stage + " • " + message);
  }

  async function boot() {
    try {
      stage = "AUTH";
      setStatus("AUTH • Checking Testnet session…");

      if (!window.AlbukhrTestnetAuth) {
        throw new Error("Testnet Auth module is unavailable.");
      }

      const session = await window.AlbukhrTestnetAuth.requireTestnetAuth();
      if (!session) return;

      setStatus("AUTH • OK • " + clean(session.username || session.pi_uid || "Pi user"));

      stage = "ENVIRONMENT";
      if (!window.ALBukhrEnvironment) {
        throw new Error("Environment Core is unavailable.");
      }

      if (
        !window.ALBukhrEnvironment.isKnown() ||
        window.ALBukhrEnvironment.getNetwork() !== "testnet"
      ) {
        throw new Error(
          "Invalid environment: expected testnet, got " +
          clean(window.ALBukhrEnvironment.getNetwork())
        );
      }

      setStatus("ENVIRONMENT • OK • TESTNET");

      stage = "SUPABASE";
      if (!window.supabase || typeof window.supabase.createClient !== "function") {
        throw new Error("Supabase JS SDK is unavailable.");
      }

      if (!window.ALBUKHR_SUPABASE) {
        throw new Error("Supabase Core is unavailable. Check js/core/supabase-core.js.");
      }

      setStatus("SUPABASE • OK");

      stage = "REGISTRY_MODULE";
      if (!window.AlbukhrTestnetRegistry) {
        throw new Error(
          "Testnet Project Registry module is unavailable. Check js/project-registry.js."
        );
      }

      setStatus("REGISTRY MODULE • OK");

      stage = "REGISTRY_RPC";
      setStatus("REGISTRY RPC • Loading approved Testnet projects…");

      const projects = await window.AlbukhrTestnetRegistry.load(true);

      if (!Array.isArray(projects)) {
        throw new Error("Registry RPC returned a non-array result.");
      }

      setStatus("REGISTRY RPC • OK • " + projects.length + " project(s)");

      stage = "RENDER";
      const list = document.getElementById("projectList");
      if (!list) throw new Error("Project list container #projectList is missing.");

      window.AlbukhrTestnetRegistry.render(list, projects);

      stage = "READY";
      setStatus(
        projects.length +
        " approved project" +
        (projects.length === 1 ? "" : "s") +
        " available on Testnet."
      );

      console.log("[ALBUKHR TESTNET DIAGNOSTIC] READY", {
        network: window.ALBukhrEnvironment.getNetwork(),
        projectCount: projects.length,
        projects
      });
    } catch (error) {
      fail(error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})(window, document);
