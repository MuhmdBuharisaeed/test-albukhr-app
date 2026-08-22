/* =========================================================
   ALBUKHR — PROJECT PAGE CONTROLLER
   =========================================================
   Architecture:
   - Project registry: Supabase / Projects Engine
   - Project media: logo_url / image_url / logo_path
   - Network: environment-switcher.js
   - Auth: pi-auth.js
   - Staking: staking.js
   - Withdrawals: withdraw.js
   - Transactions: unified-transactions.js
   - Alerts: app-alert.js

   IMPORTANT:
   - No hard-coded project config
   - No emoji project icons
   - No LocalStorage persistence
   - No direct Supabase client creation
   - No direct REST API
   - Mainnet/Testnet isolation is enforced through the network core
========================================================= */

"use strict";

/* =========================================================
   QUERY / PROJECT ID
========================================================= */

const params = new URLSearchParams(window.location.search);

const PROJECT_CODE =
  (params.get("project") || "Azman").trim();

/* =========================================================
   DOM
========================================================= */

const txTitle = document.getElementById("txTitle");
const projectHistory = document.getElementById("projectHistory");

const projectTitle = document.getElementById("projectTitle");
const projectDescription = document.getElementById("projectDescription");
const projectImage = document.getElementById("projectImage");

const infoTitle = document.getElementById("infoTitle");
const infoText = document.getElementById("infoText");

const stakeTitle = document.getElementById("stakeTitle");
const amountInput = document.getElementById("amountInput");
const minHint = document.getElementById("minHint");
const durationSelect = document.getElementById("durationSelect");

const stakeModal = document.getElementById("stakeModal");
const successModal = document.getElementById("successModal");
const successText = document.getElementById("successText");
const infoModal = document.getElementById("infoModal");

const withdrawModal = document.getElementById("withdrawModal");
const withdrawAmount = document.getElementById("withdrawAmount");
const availableBalance = document.getElementById("availableBalance");
const walletAddress = document.getElementById("walletAddress");

const capitalModal = document.getElementById("capitalModal");
const capitalWithdrawAmount =
  document.getElementById("capitalWithdrawAmount");
const capitalAvailable =
  document.getElementById("capitalAvailable");
const capitalWallet =
  document.getElementById("capitalWallet");

const aStake = document.getElementById("aStake");
const aReward = document.getElementById("aReward");
const stakeStatus = document.getElementById("stakeStatus");

/* =========================================================
   CORE ACCESS
========================================================= */

function getProjectNetwork() {
  if (typeof window.requireAlbukhrNetwork !== "function") {
    throw new Error("ALBUKHR Network Core is not available.");
  }

  return window.requireAlbukhrNetwork();
}

function getProjectDB() {
  if (typeof window.requireAlbukhrSupabaseClient !== "function") {
    throw new Error("ALBUKHR Supabase Core is not available.");
  }

  return window.requireAlbukhrSupabaseClient();
}

async function getCurrentPiUser() {
  if (typeof window.ensurePiAuth !== "function") {
    throw new Error("Pi authentication engine is not available.");
  }

  const user = await window.ensurePiAuth();

  if (!user?.uid) {
    throw new Error(
      "User authentication failed. Please log in again using Pi Browser."
    );
  }

  return user;
}

/* =========================================================
   PROJECT REGISTRY
   =========================================================
   Project data comes from Supabase through the canonical
   Projects Engine when available. No local project config.
========================================================= */

let CURRENT_PROJECT = null;

function normalizeProjectRecord(project) {
  if (!project || typeof project !== "object") {
    return null;
  }

  return {
    ...project,

    code: String(
      project.code ||
      project.project_code ||
      project.slug ||
      project.name ||
      ""
    ).trim(),

    title:
      project.title ||
      project.project_name ||
      project.name ||
      PROJECT_CODE,

    description:
      project.description ||
      project.desc ||
      "",

    info:
      project.info ||
      project.about ||
      project.details ||
      project.description ||
      "",

    durations:
      Array.isArray(project.durations)
        ? project.durations
            .map(Number)
            .filter(Number.isFinite)
        : [],

    logo_url:
      project.logo_url ||
      project.image_url ||
      project.logo ||
      project.image ||
      "",

    logo_path:
      project.logo_path ||
      "",

    logo_mime_type:
      project.logo_mime_type ||
      project.image_mime_type ||
      "",

    logo_present:
      project.logo_present === true ||
      Boolean(
        project.logo_url ||
        project.image_url ||
        project.logo ||
        project.image ||
        project.logo_path
      )
  };
}

async function getCurrentProject() {
  const network = getProjectNetwork();

  /*
    Prefer the canonical Projects Engine.
  */
  const resolverNames = [
    "getProjectByCode",
    "getProject",
    "getProjectByName",
    "getProjectBySlug"
  ];

  for (const name of resolverNames) {
    if (typeof window[name] === "function") {
      try {
        const result = await window[name](PROJECT_CODE, network);

        const candidate =
          result?.data ||
          result?.project ||
          result;

        const normalized =
          normalizeProjectRecord(candidate);

        if (normalized) {
          return normalized;
        }
      } catch (error) {
        console.warn(
          `PROJECT RESOLVER ${name} FAILED:`,
          error
        );
      }
    }
  }

  /*
    Direct Supabase read is only a registry read.
    It still uses the shared Supabase client and
    current network. No duplicate client is created.
  */
  const db = getProjectDB();

  const columns = [
    "*"
  ].join(",");

  const attempts = [
    ["code", PROJECT_CODE],
    ["project_code", PROJECT_CODE],
    ["slug", PROJECT_CODE],
    ["name", PROJECT_CODE],
    ["title", PROJECT_CODE]
  ];

  let lastError = null;

  for (const [column, value] of attempts) {
    try {
      const result = await db
        .from("projects")
        .select(columns)
        .eq("network", network)
        .eq(column, value)
        .limit(1);

      if (result.error) {
        lastError = result.error;
        continue;
      }

      if (Array.isArray(result.data) && result.data.length) {
        return normalizeProjectRecord(result.data[0]);
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    lastError?.message ||
    `Project "${PROJECT_CODE}" was not found on ${network}.`
  );
}

/* =========================================================
   PROJECT MEDIA
   ========================================================= */

function resolveProjectImage(project) {
  if (!project) {
    return "";
  }

  return String(
    project.logo_url ||
    project.image_url ||
    project.logo ||
    project.image ||
    ""
  ).trim();
}

function renderProjectMedia(project) {
  if (!projectImage) {
    return;
  }

  const src = resolveProjectImage(project);

  if (!src) {
    projectImage.removeAttribute("src");
    projectImage.style.display = "none";
    return;
  }

  projectImage.src = src;
  projectImage.alt =
    `${project.title || PROJECT_CODE} project image`;

  projectImage.style.display = "";
}

function clearProjectMedia() {
  if (!projectImage) {
    return;
  }

  projectImage.removeAttribute("src");
  projectImage.style.display = "none";
}

/* =========================================================
   PROJECT UI
========================================================= */

function renderProject(project) {
  const title =
    project.title || PROJECT_CODE;

  const description =
    project.description || "";

  const info =
    project.info || description;

  const durations =
    Array.isArray(project.durations)
      ? project.durations
      : [];

  if (txTitle) {
    txTitle.innerText =
      `${title} Transactions`;
  }

  document.title =
    `${title} • ALBUKHR`;

  if (projectTitle) {
    projectTitle.innerText =
      title;
  }

  if (projectDescription) {
    projectDescription.innerText =
      description;
  }

  if (infoTitle) {
    infoTitle.innerText =
      `About ${title}`;
  }

  if (infoText) {
    infoText.innerText =
      info;
  }

  if (stakeTitle) {
    stakeTitle.innerText =
      `Stake in ${title}`;
  }

  if (minHint) {
    minHint.innerText =
      `Minimum stake: ${getMinStake(PROJECT_CODE)} Pi`;
  }

  if (durationSelect) {
    durationSelect.innerHTML = "";

    durations.forEach((duration) => {
      const option =
        document.createElement("option");

      option.value = String(duration);
      option.innerText =
        `${duration} Days`;

      durationSelect.appendChild(option);
    });
  }

  renderProjectMedia(project);
}

/* =========================================================
   MODALS
========================================================= */

function openModal() {
  if (amountInput) {
    amountInput.value = "";
  }

  if (minHint) {
    minHint.innerText =
      `Minimum stake: ${getMinStake(PROJECT_CODE)} Pi`;
  }

  if (durationSelect && CURRENT_PROJECT) {
    durationSelect.innerHTML = "";

    const durations =
      Array.isArray(CURRENT_PROJECT.durations)
        ? CURRENT_PROJECT.durations
        : [];

    durations.forEach((duration) => {
      const option =
        document.createElement("option");

      option.value = String(duration);
      option.innerText =
        `${duration} Days`;

      durationSelect.appendChild(option);
    });
  }

  if (stakeModal) {
    stakeModal.style.display = "flex";
  }
}

function closeModal() {
  if (stakeModal) {
    stakeModal.style.display = "none";
  }
}

function closeSuccess() {
  if (successModal) {
    successModal.style.display = "none";
  }
}

function openInfo() {
  if (infoModal) {
    infoModal.style.display = "flex";
  }
}

function closeInfo() {
  if (infoModal) {
    infoModal.style.display = "none";
  }
}

/* =========================================================
   REWARD WITHDRAW MODAL
========================================================= */

async function openWithdrawModal() {
  try {
    const data =
      await getProjectTotals(PROJECT_CODE);

    let total = 0;

    if (Array.isArray(data?.stakes)) {
      data.stakes.forEach((stake) => {
        if (
          stake.type &&
          stake.type !== "stake"
        ) {
          return;
        }

        total += Math.max(
          0,
          (Number(stake.reward) || 0) -
          (Number(stake.withdrawnReward) || 0)
        );
      });
    }

    if (availableBalance) {
      availableBalance.innerText =
        `Available: ${total.toFixed(2)} Pi`;
    }

    if (withdrawAmount) {
      withdrawAmount.value = "";
    }

    if (walletAddress) {
      walletAddress.value = "";
    }

    updateRewardWithdrawalPreview();

    if (withdrawModal) {
      withdrawModal.style.display = "flex";
    }
  } catch (error) {
    console.error("OPEN WITHDRAW ERROR:", error);

    showAlert(
      "Unable to Open Withdrawal",
      error?.message ||
      "Unable to load your available reward."
    );
  }
}

function closeWithdraw() {
  if (withdrawModal) {
    withdrawModal.style.display = "none";
  }
}

/* =========================================================
   STAKE
========================================================= */

let stakeLock = false;

async function confirmStake() {
  if (stakeLock) {
    return;
  }

  const amount =
    Number(amountInput?.value);

  const duration =
    Number(durationSelect?.value);

  const min =
    getMinStake(PROJECT_CODE);

  if (
    !Number.isFinite(amount) ||
    amount < min
  ) {
    showAlert(
      "Minimum Stake Required",
      `The minimum stake for this project is ${min} Pi.`
    );

    return;
  }

  try {
    await getCurrentPiUser();
  } catch (error) {
    showAlert(
      "Login Failed",
      error?.message ||
      "Unable to verify your Pi account."
    );

    return;
  }

  stakeLock = true;

  const btn =
    document.querySelector(
      "#stakeModal .primary"
    );

  if (btn) {
    btn.innerText = "Processing...";
    btn.disabled = true;
  }

  try {
    const result =
      await addStake({
        project: PROJECT_CODE,
        amount,
        duration
      });

    if (result?.error) {
      throw new Error(
        typeof result.error === "string"
          ? result.error
          : "Unable to create stake."
      );
    }

    if (successText) {
      successText.innerText =
        `You staked ${amount} Pi in ${
          CURRENT_PROJECT?.title ||
          PROJECT_CODE
        }`;
    }

    closeModal();

    if (successModal) {
      successModal.style.display = "flex";
    }

    await load();
  } catch (error) {
    console.error("STAKE ERROR:", error);

    showAlert(
      "Stake Failed",
      error?.message ||
      "Unable to process your stake."
    );
  } finally {
    stakeLock = false;

    if (btn) {
      btn.innerText = "Confirm";
      btn.disabled = false;
    }
  }
}

/* =========================================================
   PAID CAPITAL
========================================================= */

async function getPaidCapitalAmount() {
  const user = await getCurrentPiUser();
  const network = getProjectNetwork();
  const db = getProjectDB();

  const result = await db
    .from("withdraw_requests")
    .select("amount,status,network")
    .eq("userid", user.uid)
    .eq("project", PROJECT_CODE)
    .eq("type", "capital")
    .eq("status", "paid")
    .eq("network", network);

  if (result.error) {
    throw new Error(
      result.error.message ||
      "Unable to verify paid capital withdrawals."
    );
  }

  return (
    Array.isArray(result.data)
      ? result.data.reduce(
          (sum, item) =>
            sum +
            Math.abs(Number(item.amount) || 0),
          0
        )
      : 0
  );
}

/* =========================================================
   LOAD PROJECT
========================================================= */

async function load() {
  try {
    const network =
      getProjectNetwork();

    CURRENT_PROJECT =
      await getCurrentProject();

    if (!CURRENT_PROJECT) {
      throw new Error(
        `Project "${PROJECT_CODE}" is unavailable on ${network}.`
      );
    }

    renderProject(CURRENT_PROJECT);

    const data =
      await getProjectTotals(PROJECT_CODE);

    if (!data) {
      throw new Error(
        "Project data unavailable."
      );
    }

    let totalStake = 0;
    let reward = 0;

    if (Array.isArray(data.stakes)) {
      data.stakes.forEach((stake) => {
        if (
          !stake.type ||
          stake.type === "stake"
        ) {
          totalStake +=
            Number(stake.amount) || 0;
        }

        reward += Math.max(
          0,
          (Number(stake.reward) || 0) -
          (Number(stake.withdrawnReward) || 0)
        );
      });
    }

    try {
      totalStake -=
        await getPaidCapitalAmount();
    } catch (error) {
      console.warn(
        "PAID CAPITAL CHECK FAILED:",
        error
      );
    }

    totalStake =
      Math.max(0, totalStake);

    if (aStake) {
      aStake.innerText =
        `${totalStake.toFixed(2)} Pi`;
    }

    if (aReward) {
      aReward.innerText =
        `${reward.toFixed(2)} Pi`;
    }

    await renderHistory();
    await updateStakeStatus();
    await updateCapitalAvailable();
  } catch (error) {
    console.error(
      "PROJECT LOAD ERROR:",
      error
    );

    clearProjectMedia();

    showAlert(
      "Load Failed",
      error?.message ||
      "Unable to load project data."
    );
  }
}

/* =========================================================
   MANUAL REFRESH
========================================================= */

window.manualRefresh = async function () {
  const btn =
    document.getElementById("refreshBtn");

  if (btn) {
    btn.disabled = true;
    btn.innerText = "⏳";
  }

  try {
    await load();
  } catch (error) {
    console.error(
      "MANUAL REFRESH ERROR:",
      error
    );
  } finally {
    if (btn) {
      btn.innerText = "🔄 Refresh";
      btn.disabled = false;
    }
  }
};

/* =========================================================
   WALLET
========================================================= */

function shortWallet(address) {
  if (!address) {
    return "";
  }

  const value = String(address);

  if (value.length <= 12) {
    return value;
  }

  return (
    value.slice(0, 6) +
    "..." +
    value.slice(-4)
  );
}

/* =========================================================
   WITHDRAWAL HISTORY
========================================================= */

async function getProjectWithdrawals() {
  const user =
    await getCurrentPiUser();

  const network =
    getProjectNetwork();

  const db =
    getProjectDB();

  const result =
    await db
      .from("withdraw_requests")
      .select(
        [
          "id",
          "userid",
          "project",
          "amount",
          "fee",
          "receive",
          "wallet",
          "type",
          "status",
          "txid",
          "created_at",
          "processed_at",
          "network"
        ].join(",")
      )
      .eq("userid", user.uid)
      .eq("network", network);

  if (result.error) {
    throw new Error(
      result.error.message ||
      "Unable to load withdrawal history."
    );
  }

  return Array.isArray(result.data)
    ? result.data
    : [];
}

/* =========================================================
   HISTORY
========================================================= */

async function renderHistory() {
  if (!projectHistory) {
    return;
  }

  projectHistory.innerHTML = "";

  let stakes = [];

  try {
    stakes =
      await getAllStakesMerged();
  } catch (error) {
    console.error(
      "STAKE HISTORY ERROR:",
      error
    );
  }

  const projectKey =
    PROJECT_CODE.trim().toLowerCase();

  const txs =
    (Array.isArray(stakes)
      ? stakes
      : []
    )
      .filter((tx) => {
        return (
          String(tx.project || "")
            .trim()
            .toLowerCase() ===
          projectKey
        );
      });

  let withdraws = [];

  try {
    const requests =
      await getProjectWithdrawals();

    withdraws =
      requests
        .filter((withdrawal) => {
          return (
            String(withdrawal.project || "")
              .trim()
              .toLowerCase() ===
            projectKey
          );
        })
        .map((withdrawal) => ({
          id: withdrawal.id,
          amount:
            Number(withdrawal.amount) || 0,
          fee:
            Number(withdrawal.fee) || 0,
          receive:
            Number(withdrawal.receive) || 0,
          type: withdrawal.type,
          status: withdrawal.status,
          wallet: withdrawal.wallet,
          txid: withdrawal.txid,
          created_at:
            withdrawal.created_at,
          processed_at:
            withdrawal.processed_at,
          network:
            withdrawal.network
        }));
  } catch (error) {
    console.error(
      "WITHDRAW HISTORY ERROR:",
      error
    );
  }

  const allTx =
    [...txs, ...withdraws]
      .sort((a, b) => {
        const timeA =
          new Date(
            a.created_at ||
            a.timestamp ||
            0
          ).getTime();

        const timeB =
          new Date(
            b.created_at ||
            b.timestamp ||
            0
          ).getTime();

        return timeB - timeA;
      });

  if (!allTx.length) {
    projectHistory.innerHTML = `
      <div style="
        text-align:center;
        padding:20px;
        color:#777
      ">
        No transactions yet
      </div>
    `;

    return;
  }

  allTx.forEach((tx) => {
    const txType =
      String(
        tx.type || "stake"
      ).toLowerCase();

    let label = "Stake";
    let sign = "+";
    let color = "success-status";

    if (
      txType === "withdraw" ||
      txType === "reward"
    ) {
      label = "Reward Withdrawal";
      sign = "-";
      color = "withdraw-status";
    }

    if (txType === "capital") {
      label = "Capital Withdrawal";
      sign = "-";
      color = "withdraw-status";
    }

    const div =
      document.createElement("div");

    div.className =
      "project-tx";

    let statusText = "";

    if (txType === "stake") {
      statusText =
        tx.status === "pending"
          ? "🟡 Pending"
          : tx.status === "paid"
          ? "✅ Successful"
          : tx.status === "rejected"
          ? "🔴 Failed"
          : "✅ Successful";
    } else {
      statusText =
        tx.status === "pending"
          ? "🟡 Pending"
          : tx.status === "approved"
          ? "🔵 Approved"
          : tx.status === "paid"
          ? "🟢 Paid"
          : tx.status === "rejected"
          ? "🔴 Rejected"
          : "";
    }

    const wallet =
      tx.meta?.wallet ||
      tx.wallet;

    div.innerHTML = `
      <div class="project-body">
        <div class="project-title">
          ${label}
        </div>

        ${
          wallet
            ? `
              <div style="
                font-size:11px;
                color:#666
              ">
                Wallet:
                ${shortWallet(wallet)}
              </div>
            `
            : ""
        }

        <div class="project-date">
          ${
            new Date(
              tx.created_at ||
              tx.timestamp ||
              Date.now()
            ).toLocaleString()
          }
        </div>

        ${
          statusText
            ? `
              <div style="
                font-size:11px;
                margin-top:4px;
                font-weight:600;
              ">
                ${statusText}
              </div>
            `
            : ""
        }
      </div>

      <div class="project-right">
        <div class="
          project-amount
          ${color}
        ">
          ${sign}${Math.abs(
            Number(tx.amount) || 0
          ).toFixed(2)} Pi
        </div>
      </div>
    `;

    projectHistory.appendChild(div);
  });
}

/* =========================================================
   WITHDRAWAL MODEL
========================================================= */

function calculateWithdrawal(amount) {
  const numericAmount =
    Number(amount);

  if (
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0
  ) {
    throw new Error(
      "Invalid withdrawal amount."
    );
  }

  const fee =
    numericAmount * 0.01;

  return {
    amount: numericAmount,
    fee,
    totalDeduction:
      numericAmount + fee,
    receive:
      numericAmount
  };
}

/* =========================================================
   REWARD WITHDRAWAL
========================================================= */

let withdrawLock = false;

async function confirmWithdraw() {
  if (withdrawLock) {
    return;
  }

  withdrawLock = true;

  try {
    const amount =
      Number(withdrawAmount?.value);

    const wallet =
      String(
        walletAddress?.value || ""
      ).trim();

    if (
      !Number.isFinite(amount) ||
      amount < 0.01
    ) {
      showAlert(
        "Minimum Withdrawal",
        "The minimum withdrawal amount is 0.01 Pi."
      );

      return;
    }

    if (!wallet) {
      showAlert(
        "Wallet Address Required",
        "Please enter your Pi wallet address."
      );

      return;
    }

    const data =
      await getProjectTotals(
        PROJECT_CODE
      );

    let availableReward = 0;

    if (Array.isArray(data?.stakes)) {
      data.stakes.forEach((stake) => {
        if (
          stake.type &&
          stake.type !== "stake"
        ) {
          return;
        }

        availableReward +=
          Math.max(
            0,
            (Number(stake.reward) || 0) -
            (Number(stake.withdrawnReward) || 0)
          );
      });
    }

    const withdrawal =
      calculateWithdrawal(amount);

    if (
      withdrawal.totalDeduction >
      availableReward
    ) {
      showAlert(
        "Insufficient Reward",
        `Available Reward: ${availableReward.toFixed(2)} Pi

Required (including fee): ${withdrawal.totalDeduction.toFixed(2)} Pi`
      );

      return;
    }

    const request =
      await createWithdrawRequest({
        project: PROJECT_CODE,
        amount:
          withdrawal.amount,
        wallet,
        type: "reward"
      });

    if (request?.error) {
      showAlert(
        "Withdrawal Blocked",
        typeof request.error === "string"
          ? request.error
          : "Unable to submit your withdrawal request."
      );

      return;
    }

    if (withdrawAmount) {
      withdrawAmount.value = "";
    }

    if (walletAddress) {
      walletAddress.value = "";
    }

    updateRewardWithdrawalPreview();
    closeWithdraw();

    showAlert(
      "Withdrawal Submitted",
      `Your reward withdrawal request has been submitted successfully.

Amount: ${withdrawal.amount.toFixed(2)} Pi
Fee: ${withdrawal.fee.toFixed(2)} Pi
Total Deduction: ${withdrawal.totalDeduction.toFixed(2)} Pi
Wallet Receive: ${withdrawal.receive.toFixed(2)} Pi`
    );

    await load();
  } catch (error) {
    console.error(
      "REWARD WITHDRAW ERROR:",
      error
    );

    showAlert(
      "Withdrawal Failed",
      error?.message ||
      "Unable to submit your withdrawal request."
    );
  } finally {
    withdrawLock = false;
  }
}

/* =========================================================
   REWARD PREVIEW
========================================================= */

function updateRewardWithdrawalPreview() {
  if (!withdrawAmount) {
    return;
  }

  const amount =
    Number(withdrawAmount.value) || 0;

  const fee =
    amount * 0.01;

  const totalDeduction =
    amount + fee;

  const feeEl =
    document.getElementById(
      "withdrawFee"
    );

  const totalEl =
    document.getElementById(
      "withdrawTotalDeduction"
    );

  const receiveEl =
    document.getElementById(
      "withdrawReceive"
    );

  if (feeEl) {
    feeEl.innerText =
      `${fee.toFixed(2)} Pi`;
  }

  if (totalEl) {
    totalEl.innerText =
      `${totalDeduction.toFixed(2)} Pi`;
  }

  if (receiveEl) {
    receiveEl.innerText =
      `${amount.toFixed(2)} Pi`;
  }
}

/* =========================================================
   CAPITAL MODAL
========================================================= */

function openCapitalModal() {
  updateCapitalAvailable();

  if (capitalWithdrawAmount) {
    capitalWithdrawAmount.value = "";
  }

  if (capitalWallet) {
    capitalWallet.value = "";
  }

  updateCapitalWithdrawalPreview();

  if (capitalModal) {
    capitalModal.style.display = "flex";
  }
}

function closeCapitalModal() {
  if (capitalModal) {
    capitalModal.style.display = "none";
  }
}

/* =========================================================
   CAPITAL BALANCE
========================================================= */

async function calculateAvailableCapital() {
  const data =
    await getProjectTotals(
      PROJECT_CODE
    );

  let total = 0;

  const now =
    Date.now();

  if (Array.isArray(data?.stakes)) {
    data.stakes.forEach((stake) => {
      const unlockTime =
        Number(stake.unlockTime) || 0;

      if (now >= unlockTime) {
        total += Math.max(
          0,
          (Number(stake.amount) || 0) -
          (Number(stake.withdrawnCapital) || 0)
        );
      }
    });
  }

  try {
    total -=
      await getPaidCapitalAmount();
  } catch (error) {
    console.warn(
      "CAPITAL PAID QUERY ERROR:",
      error
    );
  }

  return Math.max(0, total);
}

async function updateCapitalAvailable() {
  if (!capitalAvailable) {
    return;
  }

  try {
    const total =
      await calculateAvailableCapital();

    capitalAvailable.innerText =
      `Available: ${total.toFixed(2)} Pi`;
  } catch (error) {
    console.error(
      "CAPITAL AVAILABLE ERROR:",
      error
    );

    capitalAvailable.innerText =
      "Available: 0.00 Pi";
  }
}

/* =========================================================
   CAPITAL PREVIEW
========================================================= */

function updateCapitalWithdrawalPreview() {
  if (!capitalWithdrawAmount) {
    return;
  }

  const amount =
    Number(
      capitalWithdrawAmount.value
    ) || 0;

  const fee =
    amount * 0.01;

  const totalDeduction =
    amount + fee;

  const feeEl =
    document.getElementById(
      "capitalWithdrawFee"
    );

  const totalEl =
    document.getElementById(
      "capitalTotalDeduction"
    );

  const receiveEl =
    document.getElementById(
      "capitalWithdrawReceive"
    );

  if (feeEl) {
    feeEl.innerText =
      `${fee.toFixed(2)} Pi`;
  }

  if (totalEl) {
    totalEl.innerText =
      `${totalDeduction.toFixed(2)} Pi`;
  }

  if (receiveEl) {
    receiveEl.innerText =
      `${amount.toFixed(2)} Pi`;
  }
}

/* =========================================================
   CAPITAL WITHDRAWAL
========================================================= */

let capitalLock = false;

async function confirmCapitalWithdraw() {
  if (capitalLock) {
    return;
  }

  capitalLock = true;

  try {
    const amount =
      Number(
        capitalWithdrawAmount?.value
      );

    const wallet =
      String(
        capitalWallet?.value || ""
      ).trim();

    if (
      !Number.isFinite(amount) ||
      amount < 0.01
    ) {
      showAlert(
        "Minimum Withdrawal",
        "The minimum capital withdrawal amount is 0.01 Pi."
      );

      return;
    }

    if (!wallet) {
      showAlert(
        "Wallet Address Required",
        "Please enter your Pi wallet address to continue with the capital withdrawal."
      );

      return;
    }

    const availableCapital =
      await calculateAvailableCapital();

    const withdrawal =
      calculateWithdrawal(amount);

    if (
      withdrawal.totalDeduction >
      availableCapital
    ) {
      showAlert(
        "Insufficient Capital",
        `Available Capital: ${availableCapital.toFixed(2)} Pi

Required (including fee): ${withdrawal.totalDeduction.toFixed(2)} Pi`
      );

      return;
    }

    const request =
      await createWithdrawRequest({
        project: PROJECT_CODE,
        amount:
          withdrawal.amount,
        wallet,
        type: "capital"
      });

    if (request?.error) {
      showAlert(
        "Withdrawal Blocked",
        typeof request.error === "string"
          ? request.error
          : "Unable to submit your capital withdrawal request."
      );

      return;
    }

    if (capitalWithdrawAmount) {
      capitalWithdrawAmount.value = "";
    }

    if (capitalWallet) {
      capitalWallet.value = "";
    }

    updateCapitalWithdrawalPreview();
    closeCapitalModal();

    showAlert(
      "Capital Withdrawal Submitted",
      `Your capital withdrawal request has been submitted successfully.

Amount: ${withdrawal.amount.toFixed(2)} Pi
Fee: ${withdrawal.fee.toFixed(2)} Pi
Total Deduction: ${withdrawal.totalDeduction.toFixed(2)} Pi
Wallet Receive: ${withdrawal.receive.toFixed(2)} Pi`
    );

    await load();
  } catch (error) {
    console.error(
      "CAPITAL WITHDRAW ERROR:",
      error
    );

    showAlert(
      "Capital Withdrawal Failed",
      error?.message ||
      "Unable to submit your capital withdrawal request."
    );
  } finally {
    capitalLock = false;
  }
}

/* =========================================================
   STAKE STATUS
========================================================= */

async function updateStakeStatus() {
  if (!stakeStatus) {
    return;
  }

  try {
    const user =
      await getCurrentPiUser();

    const network =
      getProjectNetwork();

    const db =
      getProjectDB();

    const result =
      await db
        .from("stakes")
        .select("*")
        .eq("project", PROJECT_CODE)
        .eq("userid", user.uid)
        .eq("network", network);

    if (result.error) {
      console.error(
        "STAKE STATUS ERROR:",
        result.error
      );

      return;
    }

    let locked = 0;
    let unlocked = 0;

    const now =
      Date.now();

    (
      Array.isArray(result.data)
        ? result.data
        : []
    ).forEach((stake) => {
      const amount =
        Math.max(
          0,
          (Number(stake.amount) || 0) -
          (Number(stake.withdrawnCapital) || 0)
        );

      const unlockTime =
        Number(stake.unlockTime) || 0;

      if (now >= unlockTime) {
        unlocked += amount;
      } else {
        locked += amount;
      }
    });

    const parts = [];

    if (locked > 0) {
      parts.push(
        `Locked: ${locked.toFixed(2)} Pi`
      );
    }

    if (unlocked > 0) {
      parts.push(
        `Unlocked: ${unlocked.toFixed(2)} Pi`
      );
    }

    stakeStatus.innerText =
      parts.join(" • ");
  } catch (error) {
    console.error(
      "UPDATE STAKE STATUS ERROR:",
      error
    );
  }
}

/* =========================================================
   INPUT EVENTS
========================================================= */

if (withdrawAmount) {
  withdrawAmount.addEventListener(
    "input",
    updateRewardWithdrawalPreview
  );
}

if (capitalWithdrawAmount) {
  capitalWithdrawAmount.addEventListener(
    "input",
    updateCapitalWithdrawalPreview
  );
}

/* =========================================================
   DOM READY
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {
    try {
      await getCurrentPiUser();
      await load();
    } catch (error) {
      console.error(
        "PROJECT INIT ERROR:",
        error
      );

      showAlert(
        "Initialization Failed",
        error?.message ||
        "Unable to initialize the project."
      );
    }
  }
);

/* =========================================================
   AUTO UPDATE
========================================================= */

setInterval(
  () => updateStakeStatus(),
  5000
);

setInterval(
  () => updateCapitalAvailable(),
  5000
);
