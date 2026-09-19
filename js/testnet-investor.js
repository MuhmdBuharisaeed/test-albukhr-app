(function(window, document){
  "use strict";

  function clean(value){
    return String(value == null ? "" : value).trim();
  }

  function number(value){
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function pi(value){
    return number(value).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 7
    }) + " π";
  }

  function setText(id, value){
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function show(id, visible){
    const node = document.getElementById(id);
    if (node) node.hidden = !visible;
  }

  function projectMap(projects){
    const map = new Map();
    (projects || []).forEach(project => {
      const key = clean(project.project_code).toLowerCase();
      if (key) map.set(key, project);
    });
    return map;
  }

  function renderSummary(summary){
    setText("portfolioValue", pi(summary?.portfolio));
    setText("investedValue", pi(summary?.invested));
    setText("earningsValue", pi(summary?.earnings));
    setText("projectCount", String(summary?.active_projects ?? 0));
  }

  function renderUser(user){
    const username = clean(user?.username) || "Investor";
    setText("investorName", username);
    setText("investorUsername", "@" + username);
    setText(
      "walletAddress",
      clean(user?.wallet_address) || "Wallet verified through Testnet session"
    );
  }

  function renderInvestments(stakes, projects){
    const container = document.getElementById("investmentList");
    const empty = document.getElementById("investmentEmpty");
    if (!container) return;

    container.innerHTML = "";

    const map = projectMap(projects);
    const rows = Array.isArray(stakes) ? stakes : [];

    if (!rows.length) {
      if (empty) empty.hidden = false;
      return;
    }

    if (empty) empty.hidden = true;

    rows.forEach(stake => {
      const project = map.get(clean(stake.project_code).toLowerCase());
      const article = document.createElement("article");
      article.className = "investment-card";

      const name = clean(project?.name) ||
                   clean(stake.project_code) ||
                   "Testnet Project";

      const status = clean(stake.status).toUpperCase() || "UNKNOWN";
      const amount = pi(stake.amount);
      const reward = pi(stake.reward_amount);
      const duration = clean(stake.duration_days) || "—";

      article.innerHTML =
        '<div class="investment-main">' +
          '<div class="investment-logo">' +
            (project?.logo_url
              ? '<img loading="lazy" decoding="async" alt="">'
              : '<span>A</span>') +
          '</div>' +
          '<div class="investment-info">' +
            '<h3></h3>' +
            '<p class="investment-meta"></p>' +
          '</div>' +
        '</div>' +
        '<div class="investment-values">' +
          '<div><span>Invested</span><strong class="amount"></strong></div>' +
          '<div><span>Reward</span><strong class="reward"></strong></div>' +
          '<span class="investment-status"></span>' +
        '</div>';

      article.querySelector("h3").textContent = name;
      article.querySelector(".investment-meta").textContent =
        duration + " days • " + (number(stake.reward_rate) || 0) + "% reward";
      article.querySelector(".amount").textContent = amount;
      article.querySelector(".reward").textContent = reward;
      article.querySelector(".investment-status").textContent = status;

      const img = article.querySelector("img");
      if (img) {
        img.src = project.logo_url;
        img.alt = name;
      }

      container.appendChild(article);
    });
  }

  function renderHistory(withdrawals){
    const container = document.getElementById("historyList");
    const empty = document.getElementById("historyEmpty");
    if (!container) return;

    container.innerHTML = "";
    const rows = Array.isArray(withdrawals) ? withdrawals : [];

    if (!rows.length) {
      if (empty) empty.hidden = false;
      return;
    }

    if (empty) empty.hidden = true;

    rows.forEach(row => {
      const item = document.createElement("article");
      item.className = "history-card";

      const status = clean(row.status).toUpperCase() || "UNKNOWN";
      const amount = pi(row.net_amount ?? row.requested_amount);
      const date = row.created_at
        ? new Date(row.created_at).toLocaleString()
        : "—";

      item.innerHTML =
        '<div><strong class="history-project"></strong>' +
        '<span class="history-date"></span></div>' +
        '<div class="history-right"><strong class="history-amount"></strong>' +
        '<span class="history-status"></span></div>';

      item.querySelector(".history-project").textContent =
        clean(row.project_code) || "Withdrawal";
      item.querySelector(".history-date").textContent = date;
      item.querySelector(".history-amount").textContent = amount;
      item.querySelector(".history-status").textContent = status;

      container.appendChild(item);
    });
  }

  async function boot(){
    show("investorLoading", true);
    show("investorError", false);

    try {
      if (!window.AlbukhrTestnetAuth) {
        throw new Error("Testnet authentication module is unavailable.");
      }

      const session = await window.AlbukhrTestnetAuth.requireTestnetAuth();
      if (!session) return;

      if (!window.AlbukhrTestnetApi) {
        throw new Error("Testnet API client is unavailable.");
      }

      const payload = await window.AlbukhrTestnetApi.getInvestorData();

      if (clean(payload?.network).toLowerCase() !== "testnet") {
        throw new Error("Invalid Testnet API response.");
      }

      renderUser(payload.user);
      renderSummary(payload.summary);
      renderInvestments(payload.stakes, payload.projects);
      renderHistory(payload.withdrawals);

      setText("dataState", "CONNECTED • TESTNET");
      show("investorContent", true);
    } catch (error) {
      console.error("[ALBUKHR TESTNET INVESTOR]", error);

      const message =
        error?.status === 401 ||
        error?.code === "SESSION_INVALID" ||
        error?.code === "SESSION_EXPIRED" ||
        error?.code === "SESSION_REVOKED" ||
        error?.code === "TESTNET_SESSION_REQUIRED"
          ? "Testnet session expired. Please authenticate again."
          : (error?.message || "Unable to load Testnet investor data.");

      setText("investorErrorText", message);
      setText("dataState", "NOT CONNECTED");
      show("investorError", true);
    } finally {
      show("investorLoading", false);
    }
  }

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener("DOMContentLoaded", boot, {once:true});
  } else {
    boot();
  }
})(window, document);
