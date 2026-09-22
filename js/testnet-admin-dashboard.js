/* ALBUKHR TESTNET ADMIN DASHBOARD v1 */
(function(window, document){
  "use strict";

  var initialized = false;

  function el(id){
    return document.getElementById(id);
  }

  function clean(value){
    return String(value == null ? "" : value).trim();
  }

  function setStatus(message, error){
    var node = el("pageStatus");
    if(!node) return;
    node.textContent = clean(message);
    node.className = "page-status" + (error ? " error" : "");
  }

  function formatPi(value){
    var n = Number(value);
    if(!Number.isFinite(n)) n = 0;
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }) + " Pi";
  }

  function escapeText(value){
    return clean(value);
  }

  function createProjectLogo(project){
    var url = clean(project && project.logo_url);
    if(url){
      var image = document.createElement("img");
      image.className = "project-logo";
      image.alt = clean(project.name || "Project") + " logo";
      image.loading = "lazy";
      image.decoding = "async";
      image.src = url;
      return image;
    }

    var fallback = document.createElement("div");
    fallback.className = "project-logo-fallback";
    fallback.setAttribute("aria-hidden", "true");
    fallback.textContent = (clean(project && project.name) || "P").charAt(0).toUpperCase();
    return fallback;
  }

  function render(rows){
    var body = el("projectRows");
    var empty = el("emptyState");

    if(!body) return;
    body.replaceChildren();

    var ready = 0;
    var pending = 0;
    var verifiedTotal = 0;

    rows.forEach(function(row){
      var project = row.project || {};
      var r = row.readiness || {};

      if(r.ready) ready += 1;
      else pending += 1;
      verifiedTotal += Number(r.verified || 0);

      var tr = document.createElement("tr");

      var projectCell = document.createElement("td");
      var projectWrap = document.createElement("div");
      projectWrap.className = "project-cell";
      projectWrap.appendChild(createProjectLogo(project));

      var nameWrap = document.createElement("div");
      nameWrap.className = "project-name";

      var name = document.createElement("strong");
      name.textContent = escapeText(project.name || project.project_code || "Project");

      var code = document.createElement("small");
      code.textContent = escapeText(project.project_code || "—");

      nameWrap.appendChild(name);
      nameWrap.appendChild(code);
      projectWrap.appendChild(nameWrap);
      projectCell.appendChild(projectWrap);
      tr.appendChild(projectCell);

      var requiredCell = document.createElement("td");
      requiredCell.className = "metric";
      requiredCell.textContent = formatPi(r.required);
      tr.appendChild(requiredCell);

      var verifiedCell = document.createElement("td");
      verifiedCell.className = "metric";
      verifiedCell.textContent = formatPi(r.verified);
      tr.appendChild(verifiedCell);

      var coverageCell = document.createElement("td");
      var bar = document.createElement("div");
      bar.className = "coverage-bar";
      var fill = document.createElement("div");
      fill.className = "coverage-fill";
      fill.style.width = Math.min(100, Math.max(0, Number(r.coverage || 0))) + "%";
      bar.appendChild(fill);

      var label = document.createElement("div");
      label.className = "coverage-label";
      label.textContent = Number(r.coverage || 0).toFixed(1) + "%";
      coverageCell.appendChild(bar);
      coverageCell.appendChild(label);
      tr.appendChild(coverageCell);

      var stateCell = document.createElement("td");
      var state = document.createElement("span");
      state.className = "state " + clean(r.code || "pending");
      state.textContent = clean(r.label || "LIQUIDITY PENDING");
      stateCell.appendChild(state);
      tr.appendChild(stateCell);

      body.appendChild(tr);
    });

    el("approvedCount").textContent = String(rows.length);
    el("readyCount").textContent = String(ready);
    el("pendingCount").textContent = String(pending);
    el("verifiedTotal").textContent = formatPi(verifiedTotal);

    if(empty){
      empty.hidden = rows.length > 0;
    }
  }

  async function load(){
    if(!window.AlbukhrTestnetLiquidity ||
       typeof window.AlbukhrTestnetLiquidity.load !== "function"){
      throw new Error("TESTNET_LIQUIDITY_MODULE_UNAVAILABLE");
    }

    setStatus("Loading Testnet projects and treasury status…");

    var rows = await window.AlbukhrTestnetLiquidity.load();
    render(rows);

    if(rows.length){
      setStatus(
        rows.length + " approved Testnet project" + (rows.length === 1 ? "" : "s") +
        " loaded. Minimum threshold: 100 Pi."
      );
    }else{
      setStatus("No approved Testnet projects were returned.");
    }

    return rows;
  }

  async function init(){
    if(initialized) return;
    initialized = true;

    try{
      var env = window.ALBukhrEnvironment;
      if(!env || !env.isKnown || !env.isTestnet || !env.getNetwork ||
         !env.isKnown() || !env.isTestnet() || env.getNetwork() !== "testnet"){
        throw new Error("This dashboard is available only on test.albukhr.com.");
      }

      var refresh = el("refreshButton");
      if(refresh){
        refresh.addEventListener("click", function(){
          refresh.disabled = true;
          load().catch(function(error){
            console.error("[ALBUKHR TESTNET ADMIN]", error);
            setStatus("Unable to load Testnet liquidity status: " + (error.message || error), true);
          }).finally(function(){
            refresh.disabled = false;
          });
        });
      }

      await load();
    }catch(error){
      console.error("[ALBUKHR TESTNET ADMIN]", error);
      setStatus("Testnet liquidity dashboard error: " + (error.message || error), true);
    }
  }

  window.AlbukhrTestnetAdminDashboard = Object.freeze({
    init: init,
    load: load
  });

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init, {once:true});
  }else{
    init();
  }
})(window, document);
