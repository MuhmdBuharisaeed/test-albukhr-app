/* ALBUKHR TESTNET INVESTOR v7 */

(function (window, document) {
  "use strict";

  var TESTNET_HOST = "test.albukhr.com";
  var TESTNET_NETWORK = "testnet";

  var initialized = false;
  var bootPromise = null;

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function num(value) {
    var number = Number(value);

    return Number.isFinite(number)
      ? number
      : 0;
  }

  function pi(value) {
    return (
      num(value).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 7
      }) + " π"
    );
  }

  function getElement(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    var node = getElement(id);

    if (node) {
      node.textContent = String(
        value == null ? "" : value
      );
    }

    return node;
  }

  function getEnvironment() {
    var env = window.ALBukhrEnvironment;

    if (
      !env ||
      typeof env.isKnown !== "function" ||
      typeof env.isTestnet !== "function" ||
      typeof env.getNetwork !== "function"
    ) {
      throw new Error(
        "Testnet environment module is unavailable."
      );
    }

    if (
      !env.isKnown() ||
      !env.isTestnet() ||
      env.getNetwork() !== TESTNET_NETWORK
    ) {
      throw new Error(
        "Invalid Testnet environment."
      );
    }

    var hostname = "";

    if (typeof env.getHostname === "function") {
      hostname = clean(
        env.getHostname()
      ).toLowerCase();
    } else {
      try {
        hostname = clean(
          window.location &&
          window.location.hostname
            ? window.location.hostname
            : ""
        ).toLowerCase();
      } catch (_) {
        hostname = "";
      }
    }

    if (hostname !== TESTNET_HOST) {
      throw new Error(
        "Testnet investor page is available only on test.albukhr.com."
      );
    }

    return env;
  }

  function getAuth() {
    var auth = window.AlbukhrTestnetAuth;

    if (
      !auth ||
      typeof auth.requireTestnetAuth !== "function"
    ) {
      throw new Error(
        "Testnet authentication module is unavailable."
      );
    }

    return auth;
  }

  function getApi() {
    var api = window.AlbukhrTestnetApi;

    if (
      !api ||
      typeof api.getInvestorData !== "function"
    ) {
      throw new Error(
        "Testnet API client is unavailable."
      );
    }

    return api;
  }

  function renderUser(user) {
    user = user || {};

    var name =
      clean(user.username) ||
      "Investor";

    setText(
      "heroUserName",
      name
    );

    setText(
      "walletAddress",
      clean(user.wallet_address) ||
      "Wallet verified through Testnet session"
    );

    setText(
      "greetingText",
      "Welcome"
    );
  }

  function renderSummary(summary) {
    summary = summary || {};

    setText(
      "totalPortfolio",
      pi(summary.portfolio)
    );

    setText(
      "totalInvest",
      pi(summary.invested)
    );

    setText(
      "totalEarn",
      pi(summary.earnings)
    );

    setText(
      "totalProjects",
      String(
        Number.isFinite(
          Number(summary.active_projects)
        )
          ? Number(summary.active_projects)
          : 0
      )
    );

    setText(
      "heroPortfolio",
      pi(summary.portfolio)
    );
  }

  function createLogo(project, name) {
    var wrapper = document.createElement("div");

    wrapper.className = "investment-logo";

    var logoUrl = clean(
      project &&
      project.logo_url
    );

    if (!logoUrl) {
      /*
       * No fallback icon/emoji.
       * Projects without logo remain without an image.
       */
      wrapper.hidden = true;
      return wrapper;
    }

    var image = document.createElement("img");

    image.loading = "lazy";
    image.decoding = "async";
    image.src = logoUrl;
    image.alt = name || "ALBUKHR Project";

    image.addEventListener(
      "error",
      function () {
        wrapper.hidden = true;
      },
      { once: true }
    );

    wrapper.appendChild(image);

    return wrapper;
  }

  function createInvestmentCard(stake, project) {
    stake = stake || {};
    project = project || null;

    var article = document.createElement("article");

    article.className =
      "investment-card";

    var main = document.createElement("div");

    main.className =
      "investment-main";

    var name =
      clean(project && project.name) ||
      clean(project && project.title) ||
      clean(stake.project_code) ||
      "Testnet Project";

    var logo = createLogo(
      project,
      name
    );

    var info = document.createElement("div");

    info.className =
      "investment-info";

    var heading = document.createElement("h3");

    heading.textContent = name;

    var meta = document.createElement("p");

    meta.className =
      "investment-meta";

    var duration =
      clean(stake.duration_days) ||
      "—";

    var rewardRate =
      num(stake.reward_rate);

    meta.textContent =
      duration +
      " days • " +
      rewardRate +
      "% reward";

    info.appendChild(
      heading
    );

    info.appendChild(
      meta
    );

    main.appendChild(
      logo
    );

    main.appendChild(
      info
    );

    var values = document.createElement("div");

    values.className =
      "investment-values";

    var investedBlock =
      document.createElement("div");

    var investedLabel =
      document.createElement("span");

    investedLabel.textContent =
      "Invested";

    var investedAmount =
      document.createElement("strong");

    investedAmount.className =
      "amount";

    investedAmount.textContent =
      pi(stake.amount);

    investedBlock.appendChild(
      investedLabel
    );

    investedBlock.appendChild(
      investedAmount
    );

    var rewardBlock =
      document.createElement("div");

    var rewardLabel =
      document.createElement("span");

    rewardLabel.textContent =
      "Reward";

    var rewardAmount =
      document.createElement("strong");

    rewardAmount.className =
      "reward";

    rewardAmount.textContent =
      pi(stake.reward_amount);

    rewardBlock.appendChild(
      rewardLabel
    );

    rewardBlock.appendChild(
      rewardAmount
    );

    var status =
      document.createElement("span");

    status.className =
      "investment-status";

    status.textContent =
      (
        clean(stake.status) ||
        "UNKNOWN"
      ).toUpperCase();

    values.appendChild(
      investedBlock
    );

    values.appendChild(
      rewardBlock
    );

    values.appendChild(
      status
    );

    article.appendChild(
      main
    );

    article.appendChild(
      values
    );

    /*
     * Keep useful identity available to existing
     * CSS/navigation/diagnostic code without
     * changing the visual structure.
     */
    var projectCode =
      clean(
        project &&
        project.project_code
      ) ||
      clean(
        stake.project_code
      );

    if (projectCode) {
      article.dataset.projectCode =
        projectCode;
    }

    var projectSlug =
      clean(
        project &&
        project.slug
      );

    if (projectSlug) {
      article.dataset.projectSlug =
        projectSlug;
    }

    return article;
  }

  function buildProjectMap(projects) {
    var map = new Map();

    if (!Array.isArray(projects)) {
      return map;
    }

    projects.forEach(function (project) {
      if (!project || typeof project !== "object") {
        return;
      }

      /*
       * Strict network isolation.
       */
      if (
        clean(project.network).toLowerCase() !==
        TESTNET_NETWORK
      ) {
        return;
      }

      var code =
        clean(project.project_code).toLowerCase();

      var slug =
        clean(project.slug).toLowerCase();

      var id =
        clean(project.id).toLowerCase();

      if (code) {
        map.set(
          "code:" + code,
          project
        );
      }

      if (slug) {
        map.set(
          "slug:" + slug,
          project
        );
      }

      if (id) {
        map.set(
          "id:" + id,
          project
        );
      }
    });

    return map;
  }

  function resolveProject(stake, map) {
    var code =
      clean(
        stake &&
        stake.project_code
      ).toLowerCase();

    var slug =
      clean(
        stake &&
        stake.slug
      ).toLowerCase();

    var id =
      clean(
        stake &&
        stake.project_id
      ).toLowerCase();

    if (
      code &&
      map.has("code:" + code)
    ) {
      return map.get(
        "code:" + code
      );
    }

    if (
      slug &&
      map.has("slug:" + slug)
    ) {
      return map.get(
        "slug:" + slug
      );
    }

    if (
      id &&
      map.has("id:" + id)
    ) {
      return map.get(
        "id:" + id
      );
    }

    return null;
  }

  function renderInvestments(stakes, projects) {
    var list =
      getElement("investments");

    var empty =
      getElement("emptyInvestments");

    if (!list) {
      return;
    }

    /*
     * Clear previous render using DOM APIs.
     */
    while (list.firstChild) {
      list.removeChild(
        list.firstChild
      );
    }

    var projectMap =
      buildProjectMap(projects);

    var rows =
      Array.isArray(stakes)
        ? stakes
        : [];

    /*
     * Never render a non-Testnet stake.
     */
    rows = rows.filter(
      function (stake) {
        if (
          !stake ||
          typeof stake !== "object"
        ) {
          return false;
        }

        var network =
          clean(stake.network).toLowerCase();

        /*
         * Some existing API payloads may omit network
         * because the endpoint itself is Testnet-scoped.
         * Therefore:
         *   - explicit non-testnet => reject
         *   - missing network      => allowed
         *   - explicit testnet     => allowed
         */
        return (
          !network ||
          network === TESTNET_NETWORK
        );
      }
    );

    if (!rows.length) {
      if (empty) {
        empty.hidden = false;
      }

      return;
    }

    if (empty) {
      empty.hidden = true;
    }

    rows.forEach(
      function (stake) {
        var project =
          resolveProject(
            stake,
            projectMap
          );

        /*
         * If a project identity exists but the project itself
         * is not in the Testnet registry, do not manufacture
         * a project object or logo.
         */
        if (project) {
          if (
            clean(project.network).toLowerCase() !==
            TESTNET_NETWORK
          ) {
            project = null;
          }
        }

        var card =
          createInvestmentCard(
            stake,
            project
          );

        list.appendChild(
          card
        );
      }
    );
  }

  function showInvestorError(error) {
    var empty =
      getElement("emptyInvestments");

    if (!empty) {
      return;
    }

    empty.hidden = false;

    var paragraph =
      empty.querySelector("p");

    if (!paragraph) {
      return;
    }

    var message =
      clean(
        error &&
        error.message
      );

    /*
     * Do not expose internal stack traces,
     * request URLs, or authentication tokens.
     */
    if (
      !message ||
      message.indexOf("Bearer ") !== -1
    ) {
      message =
        "Unable to load Testnet investor data.";
    }

    paragraph.textContent =
      message;
  }

  async function boot() {
    if (bootPromise) {
      return bootPromise;
    }

    bootPromise = (async function () {
      getEnvironment();

      var auth =
        getAuth();

      /*
       * Auth module owns the Mainnet → Testnet
       * authentication flow.
       */
      var session =
        await auth.requireTestnetAuth();

      if (!session) {
        return null;
      }

      var api =
        getApi();

      var payload =
        await api.getInvestorData();

      if (
        !payload ||
        typeof payload !== "object"
      ) {
        throw new Error(
          "Invalid Testnet investor response."
        );
      }

      /*
       * The API itself must explicitly identify
       * the response as Testnet.
       */
      if (
        clean(payload.network).toLowerCase() !==
        TESTNET_NETWORK
      ) {
        throw new Error(
          "Invalid Testnet API response."
        );
      }

      /*
       * Validate the user network when supplied.
       */
      if (
        payload.user &&
        clean(payload.user.network)
      ) {
        if (
          clean(
            payload.user.network
          ).toLowerCase() !==
          TESTNET_NETWORK
        ) {
          throw new Error(
            "Invalid Testnet investor identity."
          );
        }
      }

      renderUser(
        payload.user
      );

      renderSummary(
        payload.summary
      );

      renderInvestments(
        payload.stakes,
        payload.projects
      );

      console.info(
        "[ALBUKHR TESTNET INVESTOR] CONNECTED",
        payload.summary || {}
      );

      try {
        window.dispatchEvent(
          new CustomEvent(
            "albukhr:testnet-investor-loaded",
            {
              detail: {
                network:
                  TESTNET_NETWORK
              }
            }
          )
        );
      } catch (_) {}

      return payload;
    })();

    try {
      return await bootPromise;
    } catch (error) {
      console.error(
        "[ALBUKHR TESTNET INVESTOR]",
        error
      );

      showInvestorError(
        error
      );

      try {
        window.dispatchEvent(
          new CustomEvent(
            "albukhr:testnet-investor-error",
            {
              detail: {
                message:
                  clean(
                    error &&
                    error.message
                  )
              }
            }
          )
        );
      } catch (_) {}

      return null;
    } finally {
      bootPromise = null;
    }
  }

  var api = {
    boot: boot,
    renderUser: renderUser,
    renderSummary: renderSummary,
    renderInvestments: renderInvestments
  };

  try {
    Object.freeze(api);
  } catch (_) {}

  window.AlbukhrTestnetInvestor =
    api;

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      function () {
        initialized = true;
        boot();
      },
      { once: true }
    );
  } else {
    initialized = true;
    boot();
  }

})(window, document);
