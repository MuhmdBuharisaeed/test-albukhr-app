/* ALBUKHR TESTNET PROJECT OWNER IDENTITY LINK ADMIN
 *
 * Purpose:
 * - Show pending Pi Sandbox identity-link requests to Testnet Super Admins.
 * - Link a Sandbox UID only to an existing approved Testnet project owner.
 * - Keep the canonical users.pi_uid unchanged.
 * - Delegate all writes and authorization to testnet-direct-auth.
 *
 * This file is additive. It does not alter ownership assignment or application review.
 */
(function (window, document) {
  "use strict";

  var DIRECT_AUTH_API =
    "https://vhvkwvngmrlgyzwemttt.supabase.co/functions/v1/testnet-direct-auth";
  var OWNER_ADMIN_API =
    "https://vhvkwvngmrlgyzwemttt.supabase.co/functions/v1/testnet-project-owner-admin";

  var host = document.getElementById("identityLinkQueue");
  var statusNode = document.getElementById("identityLinkStatus");
  var refreshButton = document.getElementById("refreshIdentityLinkQueue");
  var busy = false;
  var ownerCandidates = [];

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function setStatus(message, isError) {
    if (!statusNode) return;
    statusNode.textContent = clean(message);
    statusNode.className = "page-status" + (isError ? " error" : "");
  }

  function getAuthContext() {
    var auth = window.AlbukhrTestnetAdminAuth;
    if (!auth || typeof auth.getSessionToken !== "function" ||
        typeof auth.getSession !== "function") {
      throw new Error("TESTNET_ADMIN_AUTH_UNAVAILABLE");
    }

    var session = auth.getSession();
    var roles = session && session.admin && Array.isArray(session.admin.roles)
      ? session.admin.roles.map(clean)
      : [];

    if (!session || session.network !== "testnet") {
      throw new Error("TESTNET_ADMIN_SESSION_REQUIRED");
    }
    if (roles.indexOf("super_admin") === -1) {
      throw new Error("TESTNET_SUPER_ADMIN_REQUIRED");
    }

    var token = clean(auth.getSessionToken());
    if (!token) throw new Error("TESTNET_ADMIN_SESSION_REQUIRED");
    return token;
  }

  async function parseResponse(response, fallbackCode) {
    var data = await response.json().catch(function () { return null; });
    if (!response.ok || !data || data.ok !== true) {
      throw new Error(
        clean(data && (data.error || data.message)) || fallbackCode
      );
    }
    return data;
  }

  async function callDirectAuth(token, payload) {
    var response = await fetch(DIRECT_AUTH_API, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "x-testnet-admin-session": token
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      credentials: "omit"
    });
    return parseResponse(response, "IDENTITY_LINK_REQUEST_FAILED");
  }

  async function loadOwnerState(token) {
    var response = await fetch(OWNER_ADMIN_API, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Authorization": "Bearer " + token
      },
      cache: "no-store",
      credentials: "omit"
    });
    return parseResponse(response, "OWNER_ADMIN_STATE_LOAD_FAILED");
  }

  function buildOwnerCandidates(data) {
    var projects = Array.isArray(data && data.projects) ? data.projects : [];
    var users = Array.isArray(data && data.users) ? data.users : [];
    var byId = Object.create(null);

    projects.forEach(function (project) {
      var ownerId = clean(project && project.owner_user_id);
      if (!ownerId) return;

      var user = users.find(function (item) {
        return String(item.id) === ownerId;
      });
      if (!user || clean(user.network).toLowerCase() !== "testnet") return;

      if (!byId[ownerId]) {
        byId[ownerId] = {
          id: ownerId,
          pi_uid: clean(user.pi_uid),
          username: clean(user.username),
          testnet_pi_uid: clean(user.testnet_pi_uid),
          projects: []
        };
      }

      var projectName = clean(project.name || project.project_code || project.slug);
      if (projectName && byId[ownerId].projects.indexOf(projectName) === -1) {
        byId[ownerId].projects.push(projectName);
      }
    });

    return Object.keys(byId).map(function (id) { return byId[id]; })
      .filter(function (candidate) { return !!candidate.pi_uid; })
      .sort(function (a, b) {
        return (a.username || a.pi_uid).localeCompare(b.username || b.pi_uid);
      });
  }

  function makeNode(tag, className, value) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  }

  function candidateLabel(candidate) {
    var projectLabel = candidate.projects.length
      ? candidate.projects.join(", ")
      : "Approved Testnet project owner";
    var accountLabel = candidate.username || "Pi user";
    return accountLabel + " · Pi UID: " + candidate.pi_uid + " · " + projectLabel;
  }

  function eligibleCandidates(request) {
    var sandboxUid = clean(request && request.testnet_pi_uid);
    return ownerCandidates.filter(function (candidate) {
      return !candidate.testnet_pi_uid || candidate.testnet_pi_uid === sandboxUid;
    });
  }

  function renderRequest(request) {
    var card = makeNode("article", "identity-link-card");
    var top = makeNode("div", "identity-link-card-head");
    var identity = makeNode("div", "identity-link-identity");
    var title = makeNode("h3", "", clean(request.username) || "Pi Sandbox identity");
    var uid = makeNode("code", "identity-link-sandbox-uid", clean(request.testnet_pi_uid));
    var created = makeNode("small", "identity-link-created",
      request.created_at ? "Requested " + new Date(request.created_at).toLocaleString() : "Request date unavailable");
    var badge = makeNode("span", "identity-link-pending", "PENDING REVIEW");

    identity.appendChild(title);
    identity.appendChild(uid);
    identity.appendChild(created);
    top.appendChild(identity);
    top.appendChild(badge);
    card.appendChild(top);

    var label = makeNode("label", "identity-link-target-label", "Link to existing ALBUKHR project owner");
    var select = document.createElement("select");
    select.className = "identity-link-target-select";
    select.setAttribute("aria-label", "Select the existing ALBUKHR project owner");

    var placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select the correct owner account";
    select.appendChild(placeholder);

    var candidates = eligibleCandidates(request);
    candidates.forEach(function (candidate) {
      var option = document.createElement("option");
      option.value = candidate.id;
      option.textContent = candidateLabel(candidate);
      select.appendChild(option);
    });

    label.appendChild(select);
    card.appendChild(label);

    var note = makeNode("p", "identity-link-note",
      "Approval links this Sandbox UID to the selected owner's existing Testnet account. The canonical Pi UID is not changed. The Owner must sign out and sign in again after approval.");
    card.appendChild(note);

    var actions = makeNode("div", "identity-link-actions");
    var approve = makeNode("button", "owner-action-btn primary", "Approve identity link");
    approve.type = "button";
    approve.disabled = candidates.length === 0;
    approve.dataset.lockedDisabled = candidates.length === 0 ? "true" : "false";
    select.dataset.lockedDisabled = candidates.length === 0 ? "true" : "false";
    if (candidates.length === 0) {
      select.disabled = true;
      var noTargets = makeNode("p", "identity-link-no-targets",
        "No eligible approved Testnet project-owner account is available. Assign the correct owner first; this request cannot be linked to an unrelated user.");
      card.appendChild(noTargets);
    }

    approve.addEventListener("click", async function () {
      if (busy) return;
      var targetUserId = clean(select.value);
      if (!targetUserId) {
        setStatus("Select the correct existing project-owner account before approval.", true);
        select.focus();
        return;
      }

      var selected = candidates.find(function (item) { return item.id === targetUserId; });
      if (!selected) {
        setStatus("The selected owner account is not in the approved Testnet owner list.", true);
        return;
      }

      var prompt = "Approve this identity link?\n\nSandbox UID: " + clean(request.testnet_pi_uid) +
        "\nALBUKHR Pi UID: " + selected.pi_uid +
        "\nOwner: " + (selected.username || "Pi user") +
        "\nProjects: " + selected.projects.join(", ") +
        "\n\nThe canonical Pi UID will remain unchanged.";
      if (!window.confirm(prompt)) return;

      busy = true;
      setControlsDisabled(true);
      setStatus("Approving Sandbox identity link…");
      var succeeded = false;
      var successMessage = "Sandbox identity link approved. The Owner must sign out and sign in again.";

      try {
        var token = getAuthContext();
        await callDirectAuth(token, {
          action: "approve_link",
          request_id: clean(request.id),
          target_user_id: targetUserId
        });
        succeeded = true;
      } catch (error) {
        setStatus(clean(error && error.message) || "IDENTITY_LINK_APPROVAL_FAILED", true);
      } finally {
        busy = false;
        setControlsDisabled(false);
      }

      if (succeeded) {
        await loadQueue(successMessage);
      }
    });

    actions.appendChild(approve);
    card.appendChild(actions);
    return card;
  }

  function renderQueue(requests) {
    host.replaceChildren();
    if (!requests.length) {
      host.appendChild(makeNode("div", "identity-link-empty",
        "There are no pending Pi Sandbox identity-link requests."));
      return;
    }
    requests.forEach(function (request) {
      host.appendChild(renderRequest(request));
    });
  }

  function setControlsDisabled(disabled) {
    if (refreshButton) refreshButton.disabled = disabled;
    if (!host) return;
    host.querySelectorAll("button, select").forEach(function (control) {
      control.disabled = disabled || control.dataset.lockedDisabled === "true";
    });
  }

  async function loadQueue(finalMessage) {
    if (busy || !host || !refreshButton) return;

    if (!window.ALBukhrEnvironment ||
        typeof window.ALBukhrEnvironment.isTestnet !== "function" ||
        !window.ALBukhrEnvironment.isTestnet()) {
      setStatus("Identity-link review is available only in the Testnet environment.", true);
      host.replaceChildren();
      return;
    }

    busy = true;
    setControlsDisabled(true);
    setStatus("Loading pending Testnet identity links…");

    try {
      var token = getAuthContext();
      var results = await Promise.all([
        callDirectAuth(token, { action: "list_pending_links" }),
        loadOwnerState(token)
      ]);

      ownerCandidates = buildOwnerCandidates(results[1]);
      var requests = Array.isArray(results[0].requests) ? results[0].requests : [];
      renderQueue(requests);

      if (finalMessage) {
        setStatus(finalMessage);
      } else if (!requests.length) {
        setStatus("No pending identity-link requests. The queue is connected to Testnet.");
      } else {
        setStatus("Loaded " + requests.length + " pending request(s). Only existing approved Testnet project owners can be selected.");
      }
    } catch (error) {
      host.replaceChildren();
      setStatus(clean(error && error.message) || "IDENTITY_LINK_QUEUE_LOAD_FAILED", true);
    } finally {
      busy = false;
      setControlsDisabled(false);
    }
  }

  function init() {
    if (!host || !statusNode || !refreshButton) return;
    refreshButton.addEventListener("click", function () { loadQueue(); });

    /* The ownership page's existing controller owns admin-code redemption.
     * Wait for that controller to finish before this additive panel reads a token.
     */
    var attempts = 0;
    function waitForExistingSession() {
      var auth = window.AlbukhrTestnetAdminAuth;
      if (auth && typeof auth.getSessionToken === "function" &&
          clean(auth.getSessionToken())) {
        loadQueue();
        return;
      }
      attempts += 1;
      if (attempts >= 60) {
        setStatus("A valid Testnet Super Admin session is required to view identity-link requests.", true);
        return;
      }
      window.setTimeout(waitForExistingSession, 250);
    }
    waitForExistingSession();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})(window, document);
