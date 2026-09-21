/* ALBUKHR TESTNET PROJECT PAGE v8 */

(function (window, document) {
  "use strict";

  /*
   * ALBUKHR TESTNET PROJECT PAGE
   *
   * Responsibilities:
   * - Resolve project identity from the URL.
   * - Read the approved Testnet project registry.
   * - Render project identity, metadata and logo.
   * - Keep staking creation locked.
   * - Cooperate with the Testnet withdrawal module.
   * - Provide information modal.
   * - Provide project registry refresh.
   * - Protect the page against duplicate legacy project panels.
   *
   * This file does NOT:
   * - create a Supabase client;
   * - access Mainnet;
   * - perform Pi payments;
   * - create stakes;
   * - create withdrawals;
   * - submit blockchain transactions.
   *
   * Withdrawal state is owned by:
   *   js/testnet-withdrawal.js
   */

  var initialized = false;
  var loadingPromise = null;
  var currentProject = null;

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function lower(value) {
    return clean(value).toLowerCase();
  }

  function element(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    var node = element(id);
    if (node) node.textContent = clean(value);
  }

  function getErrorMessage(error, fallback) {
    if (error && typeof error.message === "string" && error.message.trim()) {
      return error.message.trim();
    }
    return fallback || "Unable to load Testnet project.";
  }

  function numberValue(value) {
    var number = Number(value);
    if (typeof Number.isFinite === "function" && Number.isFinite(number)) {
      return number;
    }
    return isFinite(number) ? number : 0;
  }

  function formatPi(value) {
    return numberValue(value).toFixed(2) + " Pi";
  }

  function validateEnvironment() {
    var env = window.ALBukhrEnvironment;

    if (!env ||
        typeof env.isKnown !== "function" ||
        typeof env.isTestnet !== "function" ||
        typeof env.getNetwork !== "function") {
      throw new Error("ALBUKHR Testnet Environment Core is unavailable.");
    }

    if (!env.isKnown() || !env.isTestnet() || env.getNetwork() !== "testnet") {
      throw new Error("Invalid ALBUKHR Testnet environment.");
    }

    return env;
  }

  function getIdentity() {
    var params;
    try {
      params = new URLSearchParams(window.location.search);
    } catch (_) {
      return "";
    }

    return clean(
      params.get("project") ||
      params.get("project_code") ||
      params.get("slug") ||
      params.get("project_id")
    );
  }

  function hideLogo() {
    var image = element("projectLogo");
    var fallback = element("logoFallback");

    if (image) {
      image.hidden = true;
      image.removeAttribute("src");
    }

    if (fallback) {
      fallback.hidden = true;
      fallback.setAttribute("aria-hidden", "true");
    }
  }

  function renderLogo(project, name) {
    var image = element("projectLogo");
    var fallback = element("logoFallback");

    if (!image) return;

    var logo = clean(project && project.logo_url);

    if (!logo) {
      hideLogo();
      return;
    }

    image.hidden = true;
    image.alt = name + " logo";

    image.onload = function () {
      image.hidden = false;
      if (fallback) fallback.hidden = true;
    };

    image.onerror = function () {
      image.hidden = true;
      image.removeAttribute("src");
      if (fallback) fallback.hidden = true;
    };

    image.src = logo;
  }

  function notFound() {
    currentProject = null;

    setText("projectTitle", "Project not found");
    setText("projectState", "TESTNET • NOT FOUND");
    setText("projectMeta", "This project is not available in the Testnet registry.");
    setText("projectDescription", "The requested project could not be resolved against the approved Testnet project registry.");
    setText("projectCode", "—");
    setText("projectType", "—");
    setText("projectSlot", "—");
    setText("projectNetwork", "TESTNET");
    setText("aStake", "LOCKED");
    setText("aStakeNote", "No Testnet stake found");
    setText("aReward", "LOCKED");
    setText("aRewardNote", "No Testnet reward balance found");
    setText("investmentState", "LOCKED");

    hideLogo();

    document.title = "Project not found • ALBUKHR TESTNET";
    resetWithdrawalButtons("Unavailable");
  }

  function getWithdrawalButtons() {
    var reward = element("withdrawRewardsBtn");
    var capital = element("withdrawCapitalBtn");

    if (!reward || !capital) {
      var buttons = document.querySelectorAll(".action-grid .action-btn");

      for (var i = 0; i < buttons.length; i += 1) {
        var text = lower(buttons[i].textContent);

        if (!reward && text.indexOf("withdraw rewards") !== -1) {
          reward = buttons[i];
        }

        if (!capital && text.indexOf("withdraw capital") !== -1) {
          capital = buttons[i];
        }
      }
    }

    return { reward: reward, capital: capital };
  }

  function setButtonState(button, disabled, label) {
    if (!button) return;

    button.disabled = !!disabled;

    if (disabled) {
      button.setAttribute("aria-disabled", "true");
    } else {
      button.removeAttribute("aria-disabled");
    }

    var small = button.querySelector("small");
    if (small) small.textContent = clean(label);
  }

  function resetWithdrawalButtons(label) {
    var buttons = getWithdrawalButtons();

    setButtonState(buttons.reward, true, label || "Checking…");
    setButtonState(buttons.capital, true, label || "Checking…");
  }

  /*
   * DOM integrity protection.
   *
   * Current project.html contains exactly one controls panel and one
   * history panel. This guard is defensive for an older cached/deployed
   * DOM or a legacy script that may have appended another copy.
   *
   * It removes only duplicate panels after the first matching panel.
   * It does not touch Supabase, project data, staking, or withdrawals.
   */

  function removeDuplicatePanels() {
    var main = document.querySelector("main.project-page");
    if (!main) return;

    var controls = [];
    var history = [];

    var sections = main.querySelectorAll("section");

    for (var i = 0; i < sections.length; i += 1) {
      var section = sections[i];
      var heading = section.querySelector("h2");

      if (!heading) continue;

      var title = clean(heading.textContent).toLowerCase();

      if (title === "investment & withdrawal controls") {
        controls.push(section);
      }

      if (title === "transaction history") {
        history.push(section);
      }
    }

    function keepFirst(items, label) {
      if (items.length <= 1) return;

      for (var j = 1; j < items.length; j += 1) {
        var duplicate = items[j];

        if (duplicate && duplicate.parentNode) {
          duplicate.parentNode.removeChild(duplicate);
        }
      }

      console.warn(
        "[ALBUKHR TESTNET] Removed duplicate " +
        label +
        " panel(s): " +
        (items.length - 1)
      );
    }

    keepFirst(controls, "controls");
    keepFirst(history, "history");
  }

  function render(project) {
    if (!project) {
      notFound();
      return;
    }

    var network = lower(project.network);

    if (network !== "testnet") {
      throw new Error(
        "PROJECT_NETWORK_INVALID: resolved project is not a Testnet project."
      );
    }

    currentProject = project;

    var name =
      clean(project.name) ||
      clean(project.title) ||
      "Project";

    var code = clean(project.project_code) || "—";

    var type =
      clean(project.project_type).toUpperCase() ||
      "—";

    var slot =
      project.core_slot == null || project.core_slot === ""
        ? "—"
        : String(project.core_slot);

    var status =
      clean(project.status).toUpperCase() ||
      "APPROVED";

    setText("projectTitle", name);
    setText("projectState", "TESTNET • " + status);
    setText("projectMeta", type + " • Core Slot " + slot);
    setText(
      "projectDescription",
      clean(project.description) ||
      "Registered ALBUKHR project available for controlled Testnet exploration."
    );
    setText("projectCode", code);
    setText("projectType", type);
    setText("projectSlot", slot);
    setText("projectNetwork", "TESTNET");

    document.title = name + " • ALBUKHR TESTNET";

    renderLogo(project, name);

    setText("aStake", "LOCKED");
    setText("aStakeNote", "Testnet staking creation is not enabled");

    setText("investmentState", "LOCKED");

    var rewardNode = element("aReward");
    if (rewardNode && !rewardNode.dataset.liveState) {
      rewardNode.textContent = "CHECKING";
    }

    var rewardNote = element("aRewardNote");
    if (rewardNote && !rewardNote.dataset.liveState) {
      rewardNote.textContent = "Checking Testnet reward balance…";
    }

    var buttons = getWithdrawalButtons();

    if (buttons.reward && !buttons.reward.dataset.withdrawalOwner) {
      setButtonState(buttons.reward, true, "Checking…");
    }

    if (buttons.capital && !buttons.capital.dataset.withdrawalOwner) {
      setButtonState(buttons.capital, true, "Checking…");
    }

    try {
      window.dispatchEvent(
        new CustomEvent("albukhr:testnet-project-rendered", {
          detail: { project: project }
        })
      );
    } catch (_) {}
  }

  function renderInvestorState(payload) {
    if (!payload || !currentProject) return;

    var stakes = Array.isArray(payload.stakes) ? payload.stakes : [];
    var withdrawals = Array.isArray(payload.withdrawals) ? payload.withdrawals : [];

    var projectCode = lower(currentProject.project_code);
    var projectId = lower(currentProject.id);
    var projectSlug = lower(currentProject.slug);

    var matches = stakes.filter(function (stake) {
      if (!stake) return false;

      if (
        lower(stake.network) &&
        lower(stake.network) !== "testnet"
      ) {
        return false;
      }

      var stakeCode = lower(stake.project_code);
      var stakeId = lower(stake.project_id);
      var stakeSlug = lower(stake.slug);

      if (projectCode && stakeCode === projectCode) return true;
      if (projectId && stakeId === projectId) return true;
      if (projectSlug && stakeSlug === projectSlug) return true;

      return false;
    });

    if (!matches.length) {
      setText("aStake", "0.00 Pi");
      setText("aStakeNote", "No active Testnet stake");
      setText("aReward", "0.00 Pi");
      setText("aRewardNote", "No available Testnet reward");

      var rewardNodeEmpty = element("aReward");
      var rewardNoteEmpty = element("aRewardNote");

      if (rewardNodeEmpty) rewardNodeEmpty.dataset.liveState = "true";
      if (rewardNoteEmpty) rewardNoteEmpty.dataset.liveState = "true";

      return;
    }

    matches.sort(function (a, b) {
      return (
        Date.parse(b.created_at || "") -
        Date.parse(a.created_at || "")
      );
    });

    var stake = matches[0];

    var stakeAmount = numberValue(stake.amount);
    var rewardAmount = numberValue(stake.reward_amount);

    var usedReward = withdrawals
      .filter(function (row) {
        return (
          clean(row.stake_id) === clean(stake.id) &&
          lower(row.withdrawal_type) === "reward" &&
          [
            "pending",
            "processing",
            "approved",
            "completed"
          ].indexOf(lower(row.status)) !== -1
        );
      })
      .reduce(function (sum, row) {
        return (
          sum +
          numberValue(
            row.net_amount ||
            row.requested_amount
          )
        );
      }, 0);

    var availableReward = Math.max(
      0,
      rewardAmount - usedReward
    );

    setText("aStake", formatPi(stakeAmount));
    setText("aStakeNote", "Active Testnet stake");

    setText("aReward", formatPi(availableReward));
    setText(
      "aRewardNote",
      availableReward > 0
        ? "Available Testnet reward"
        : "No available Testnet reward"
    );

    var rewardNode = element("aReward");
    var rewardNote = element("aRewardNote");

    if (rewardNode) rewardNode.dataset.liveState = "true";
    if (rewardNote) rewardNote.dataset.liveState = "true";
  }

  async function load() {
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async function () {
      var identity = getIdentity();

      try {
        validateEnvironment();

        if (!window.ALBUKHR_SUPABASE) {
          throw new Error(
            "SUPABASE_CORE_MISSING: Testnet Supabase Core is unavailable."
          );
        }

        if (window.ALBUKHR_SUPABASE.network !== "testnet") {
          throw new Error(
            "SUPABASE_NETWORK_INVALID: Supabase Core is not configured for Testnet."
          );
        }

        if (
          !window.AlbukhrTestnetRegistry ||
          typeof window.AlbukhrTestnetRegistry.load !== "function" ||
          typeof window.AlbukhrTestnetRegistry.resolve !== "function"
        ) {
          throw new Error(
            "PROJECT_REGISTRY_MODULE_MISSING: Testnet Project Registry module is unavailable."
          );
        }

        if (!identity) {
          notFound();
          return null;
        }

        setText("projectState", "TESTNET • LOADING");
        setText("projectMeta", "Loading registered project…");

        var projects =
          await window.AlbukhrTestnetRegistry.load(true);

        if (!Array.isArray(projects)) {
          throw new Error(
            "PROJECT_REGISTRY_INVALID: registry returned an invalid response."
          );
        }

        var project =
          window.AlbukhrTestnetRegistry.resolve(identity);

        if (!project) {
          notFound();
          return null;
        }

        if (lower(project.network) !== "testnet") {
          throw new Error(
            "PROJECT_NETWORK_INVALID: resolved project is not a Testnet project."
          );
        }

        render(project);

        try {
          window.dispatchEvent(
            new CustomEvent(
              "albukhr:testnet-project-loaded",
              {
                detail: {
                  project: project,
                  identity: identity
                }
              }
            )
          );
        } catch (_) {}

        return project;

      } catch (error) {
        console.error(
          "[ALBUKHR TESTNET PROJECT]",
          error
        );

        currentProject = null;

        setText(
          "projectState",
          "TESTNET • UNAVAILABLE"
        );

        setText(
          "projectMeta",
          "Unable to load the Testnet project registry."
        );

        setText(
          "projectDescription",
          getErrorMessage(
            error,
            "The Testnet project data could not be loaded."
          )
        );

        if (identity) {
          setText("projectCode", identity);
        }

        setText("projectType", "—");
        setText("projectSlot", "—");
        setText("projectNetwork", "TESTNET");
        setText("aStake", "LOCKED");
        setText("aReward", "UNAVAILABLE");
        setText("aRewardNote", "Testnet project data unavailable");
        setText("investmentState", "LOCKED");

        hideLogo();
        resetWithdrawalButtons("Unavailable");

        document.title =
          "Project unavailable • ALBUKHR TESTNET";

        try {
          window.dispatchEvent(
            new CustomEvent(
              "albukhr:testnet-project-error",
              {
                detail: {
                  error: error,
                  identity: identity
                }
              }
            )
          );
        } catch (_) {}

        return null;

      } finally {
        loadingPromise = null;
      }
    })();

    return loadingPromise;
  }

  function initInfoModal() {
    var modal = element("infoModal");
    var infoButton = element("infoButton");
    var closeButton = element("closeInfo");
    var okButton = element("infoOk");

    function open() {
      if (!modal) return;

      modal.hidden = false;

      if (infoButton) {
        infoButton.setAttribute("aria-expanded", "true");
      }

      if (closeButton) {
        try { closeButton.focus(); } catch (_) {}
      }
    }

    function close() {
      if (!modal) return;

      modal.hidden = true;

      if (infoButton) {
        infoButton.setAttribute("aria-expanded", "false");
        try { infoButton.focus(); } catch (_) {}
      }
    }

    if (infoButton) infoButton.addEventListener("click", open);
    if (closeButton) closeButton.addEventListener("click", close);
    if (okButton) okButton.addEventListener("click", close);

    if (modal) {
      modal.addEventListener("click", function (event) {
        if (event.target === modal) close();
      });
    }

    document.addEventListener("keydown", function (event) {
      if (
        event.key === "Escape" &&
        modal &&
        !modal.hidden
      ) {
        close();
      }
    });

    return { open: open, close: close };
  }

  function initRefresh() {
    var refresh = element("refreshBtn");
    if (!refresh) return;

    refresh.addEventListener("click", async function () {
      if (refresh.disabled) return;

      refresh.disabled = true;
      refresh.setAttribute("aria-busy", "true");
      refresh.textContent = "↻ Loading…";

      try {
        await load();

        var withdrawal =
          window.AlbukhrTestnetWithdrawal;

        if (
          withdrawal &&
          typeof withdrawal.refresh === "function"
        ) {
          await withdrawal.refresh().catch(function () {});
        }

      } finally {
        refresh.disabled = false;
        refresh.removeAttribute("aria-busy");
        refresh.textContent = "↻ Refresh";
      }
    });
  }

  function initWithdrawalBridge() {
    window.addEventListener(
      "albukhr:testnet-investor-data-loaded",
      function (event) {
        if (event.detail && event.detail.payload) {
          renderInvestorState(event.detail.payload);
        }
      }
    );

    window.addEventListener(
      "albukhr:testnet-withdrawal-state",
      function (event) {
        if (!event.detail) return;

        if (event.detail.reward_available != null) {
          var reward =
            numberValue(event.detail.reward_available);

          setText("aReward", formatPi(reward));

          setText(
            "aRewardNote",
            reward > 0
              ? "Available Testnet reward"
              : "No available Testnet reward"
          );

          var rewardNode = element("aReward");
          var rewardNote = element("aRewardNote");

          if (rewardNode) {
            rewardNode.dataset.liveState = "true";
          }

          if (rewardNote) {
            rewardNote.dataset.liveState = "true";
          }
        }
      }
    );
  }

  function init() {
    if (initialized) return;

    initialized = true;

    /*
     * Remove duplicate legacy panels before any module starts using
     * the page. This is intentionally DOM-only.
     */
    removeDuplicatePanels();

    initInfoModal();
    initRefresh();
    initWithdrawalBridge();

    /*
     * Load project first.
     */
    load();

    /*
     * A delayed second pass catches legacy scripts that append a
     * duplicate panel during their own startup.
     */
    window.setTimeout(function () {
      removeDuplicatePanels();
    }, 500);
  }

  var api = {
    load: load,
    getProject: function () {
      return currentProject;
    },
    renderInvestorState: renderInvestorState
  };

  try {
    Object.freeze(api);
  } catch (_) {}

  window.AlbukhrTestnetProject = api;

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }

})(window, document);
