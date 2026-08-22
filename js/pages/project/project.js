/* =========================================
   ALBUKHR PROJECT PAGE CONTROLLER
   Architecture: js/pages/project/project.js
   Version: 3.0
   NETWORK-AWARE
   =========================================

   RESPONSIBILITY:
   - Project page UI/controller only
   - User stake/reward display
   - Network-aware transaction history
   - Reward withdrawal requests
   - Capital withdrawal requests

   DEPENDS ON:
   - js/core/environment-switcher.js
   - js/core/supabase-core.js
   - js/auth/pi-auth.js
   - js/features/project-config.js
   - js/features/staking.js
   - js/features/withdraw.js
   - js/features/unified-transactions.js
   - js/ui/app-alert.js

   ARCHITECTURE RULES:
   - No LocalStorage persistence
   - No direct REST API
   - No duplicate Supabase client
   - Network must always come from ALBUKHR Network Core
   - Supabase client must always come from ALBUKHR Supabase Core
   - Page controller must not create its own auth/database engines
========================================= */

"use strict";

/* =========================================
   PROJECT CONFIG
========================================= */

const params = new URLSearchParams(window.location.search);

const PROJECT_NAME =
  params.get("project") || "Azman";

const CONFIG =
  getProjectConfig(PROJECT_NAME);

/* =========================================
   DOM REFERENCES
========================================= */

const txTitle = document.getElementById("txTitle");
const projectHistory = document.getElementById("projectHistory");
const projectTitle = document.getElementById("projectTitle");
const projectDescription = document.getElementById("projectDescription");
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

/* =========================================
   DEPENDENCY GUARDS
========================================= */

function getProjectNetwork() {
  if (typeof window.requireAlbukhrNetwork !== "function") {
    throw new Error(
      "ALBUKHR Network Core is not available."
    );
  }

  return window.requireAlbukhrNetwork();
}

function getProjectDB() {
  if (
    typeof window.requireAlbukhrSupabaseClient !==
    "function"
  ) {
    throw new Error(
      "ALBUKHR Supabase Core is not available."
    );
  }

  return window.requireAlbukhrSupabaseClient();
}

async function getCurrentPiUser() {
  if (typeof window.ensurePiAuth !== "function") {
    throw new Error(
      "Pi authentication engine is not available."
    );
  }

  const user = await window.ensurePiAuth();

  if (!user?.uid) {
    throw new Error(
      "User authentication failed. Please log in again using Pi Browser."
    );
  }

  return user;
}

/* =========================================
   UI INITIALIZATION
========================================= */

function initializeProjectUI() {
  if (txTitle) {
    txTitle.innerText =
      `${CONFIG.title} Transactions`;
  }

  document.title =
    `${CONFIG.title} • ALBUKHR`;

  if (projectTitle) {
    projectTitle.innerText =
      `${CONFIG.icon} ${CONFIG.title}`;
  }

  if (projectDescription) {
    projectDescription.innerText =
      CONFIG.desc;
  }

  if (infoTitle) {
    infoTitle.innerText =
      `About ${CONFIG.title}`;
  }

  if (infoText) {
    infoText.innerText =
      CONFIG.info;
  }

  if (stakeTitle) {
    stakeTitle.innerText =
      `Stake in ${CONFIG.title}`;
  }
}

/* =========================================
   MODALS
========================================= */

function openModal() {
  if (amountInput) {
    amountInput.value = "";
  }

  if (minHint) {
    minHint.innerText =
      `Minimum stake: ${getMinStake(PROJECT_NAME)} Pi`;
  }

  if (durationSelect) {
    durationSelect.innerHTML = "";

    CONFIG.durations.forEach((duration) => {
      const opt = document.createElement("option");

      opt.value = duration;
      opt.innerText = `${duration} Days`;

      durationSelect.appendChild(opt);
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

/* =========================================
   REWARD WITHDRAW MODAL
========================================= */

async function openWithdrawModal() {
  try {
    const data =
      await getProjectTotals(PROJECT_NAME);

    let total = 0;

    if (Array.isArray(data?.stakes)) {
      data.stakes.forEach((stake) => {
        if (
          stake.type &&
          stake.type !== "stake"
        ) {
          return;
        }

        const remaining =
          (Number(stake.reward) || 0) -
          (Number(stake.withdrawnReward) || 0);

        total += Math.max(0, remaining);
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
    console.error(
      "OPEN WITHDRAW ERROR:",
      error
    );

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

/* =========================================
   STAKE
========================================= */

let __stakeLock = false;

async function confirmStake() {
  if (__stakeLock) {
    return;
  }

  __stakeLock = true;

  const amount =
    Number(amountInput?.value);

  const duration =
    Number(durationSelect?.value);

  const min =
    getMinStake(PROJECT_NAME);

  if (
    !Number.isFinite(amount) ||
    amount < min
  ) {
    showAlert(
      "Minimum Stake Required",
      `The minimum stake for this project is ${min} Pi.`
    );

    __stakeLock = false;
    return;
  }

  const btn =
    document.querySelector(
      "#stakeModal .primary"
    );

  try {
    await getCurrentPiUser();

    if (btn) {
      btn.innerText = "Processing...";
      btn.disabled = true;
    }

    const result =
      await addStake({
        project: PROJECT_NAME,
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
        `You staked ${amount} Pi in ${CONFIG.title}`;
    }

    closeModal();

    if (successModal) {
      successModal.style.display = "flex";
    }

    await load();
  } catch (error) {
    console.error(
      "STAKE ERROR:",
      error
    );

    showAlert(
      "Stake Failed",
      error?.message ||
      "Unable to process your stake."
    );
  } finally {
    if (btn) {
      btn.innerText = "Confirm";
      btn.disabled = false;
    }

    __stakeLock = false;
  }
}

/* =========================================
   LOAD PROJECT
========================================= */

async function load() {
  console.log(
    "ALBUKHR PROJECT LOADING:",
    PROJECT_NAME
  );

  try {
    const network =
      getProjectNetwork();

    console.log(
      `ALBUKHR PROJECT NETWORK: ${network.toUpperCase()}`
    );

    const data =
      await getProjectTotals(PROJECT_NAME);

    if (!data) {
      throw new Error(
        "Project data unavailable."
      );
    }

    let totalStake = 0;

    if (Array.isArray(data.stakes)) {
      data.stakes.forEach((stake) => {
        const amount =
          Number(stake.amount) || 0;

        if (
          !stake.type ||
          stake.type === "stake"
        ) {
          totalStake += amount;
        }
      });
    }

    /*
      Capital withdrawals are subtracted only
      when their status is PAID and they belong
      to the current user/project/network.
    */

    try {
      const user =
        await getCurrentPiUser();

      const db =
        getProjectDB();

      const paidCapital =
        await db
          .from("withdraw_requests")
          .select("amount,status,network")
          .eq("userid", user.uid)
          .eq("project", PROJECT_NAME)
          .eq("type", "capital")
          .eq("status", "paid")
          .eq("network", network);

      if (paidCapital.error) {
        console.error(
          "PAID CAPITAL QUERY ERROR:",
          paidCapital.error
        );
      } else if (
        Array.isArray(paidCapital.data)
      ) {
        paidCapital.data.forEach(
          (withdrawal) => {
            totalStake -= Math.abs(
              Number(withdrawal.amount) || 0
            );
          }
        );
      }
    } catch (error) {
      console.warn(
        "PAID CAPITAL CHECK SKIPPED:",
        error
      );
    }

    totalStake =
      Math.max(0, totalStake);

    let reward = 0;

    if (Array.isArray(data.stakes)) {
      data.stakes.forEach((stake) => {
        const totalReward =
          Number(stake.reward) || 0;

        const withdrawnReward =
          Number(stake.withdrawnReward) || 0;

        reward += Math.max(
          0,
          totalReward - withdrawnReward
        );
      });
    }

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

    showAlert(
      "Load Failed",
      error?.message ||
      "Unable to load project data."
    );
  }
}

/* =========================================
   MANUAL REFRESH
========================================= */

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

/* =========================================
   HELPERS
========================================= */

function shortWallet(address) {
  if (!address) {
    return "";
  }

  const value =
    String(address);

  if (value.length <= 12) {
    return value;
  }

  return (
    value.slice(0, 6) +
    "..." +
    value.slice(-4)
  );
}

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
    receive: numericAmount
  };
}

/* =========================================
   NETWORK-AWARE WITHDRAWALS
========================================= */

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
      .select([
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
      ].join(","))
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

/* =========================================
   HISTORY
========================================= */

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

  const txs =
    (Array.isArray(stakes) ? stakes : [])
      .filter(
        (tx) =>
          tx.project === PROJECT_NAME
      )
      .sort(
        (a, b) =>
          new Date(
            b.created_at ||
            b.timestamp ||
            0
          ) -
          new Date(
            a.created_at ||
            a.timestamp ||
            0
          )
      );

  let withdraws = [];

  try {
    const requests =
      await getProjectWithdrawals();

    withdraws =
      requests
        .filter((withdrawal) => {
          const a =
            String(
              withdrawal.project || ""
            )
              .trim()
              .toLowerCase();

          const b =
            String(PROJECT_NAME || "")
              .trim()
              .toLowerCase();

          const c =
            String(CONFIG.title || "")
              .trim()
              .toLowerCase();

          return (
            a === b ||
            a === c ||
            c.includes(a) ||
            a.includes(c)
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
    [...txs, ...withdraws].sort(
      (a, b) => {
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
      }
    );

  if (!allTx.length) {
    projectHistory.innerHTML = `
      <div style="
        text-align:center;
        padding:20px;
        color:#777
      ">
        ${CONFIG.icon}
        <br><br>
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

    let icon =
      CONFIG.icon;

    let label =
      "Stake";

    let sign =
      "+";

    let color =
      "success-status";

    if (
      txType === "withdraw" ||
      txType === "reward"
    ) {
      icon = "💸";
      label = "Reward Withdrawal";
      sign = "-";
      color = "withdraw-status";
    }

    if (txType === "capital") {
      icon = "🏦";
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
      <div class="project-icon">
        ${icon}
      </div>

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

/* =========================================
   REWARD WITHDRAWAL
========================================= */

let __withdrawLock = false;

async function confirmWithdraw() {
  if (__withdrawLock) {
    return;
  }

  __withdrawLock = true;

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
        PROJECT_NAME
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

        const total =
          Number(stake.reward) || 0;

        const withdrawn =
          Number(
            stake.withdrawnReward
          ) || 0;

        availableReward += Math.max(
          0,
          total - withdrawn
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
        project: PROJECT_NAME,
        amount: withdrawal.amount,
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
    __withdrawLock = false;
  }
}

function updateRewardWithdrawalPreview() {
  if (!withdrawAmount) {
    return;
  }

  const amount =
    Number(
      withdrawAmount.value
    ) || 0;

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

/* =========================================
   CAPITAL WITHDRAWAL MODAL
========================================= */

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

/* =========================================
   CAPITAL AVAILABLE
========================================= */

async function getAvailableCapital() {
  const data =
    await getProjectTotals(
      PROJECT_NAME
    );

  let total = 0;

  const now =
    Date.now();

  if (Array.isArray(data?.stakes)) {
    data.stakes.forEach((stake) => {
      const unlockTime =
        Number(
          stake.unlockTime
        ) || 0;

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
    const user =
      await getCurrentPiUser();

    const network =
      getProjectNetwork();

    const db =
      getProjectDB();

    const result =
      await db
        .from("withdraw_requests")
        .select("amount,status,network")
        .eq("userid", user.uid)
        .eq("project", PROJECT_NAME)
        .eq("type", "capital")
        .eq("status", "paid")
        .eq("network", network);

    if (
      !result.error &&
      Array.isArray(result.data)
    ) {
      result.data.forEach(
        (withdrawal) => {
          total -= Math.abs(
            Number(withdrawal.amount) || 0
          );
        }
      );
    }
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
      await getAvailableCapital();

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

/* =========================================
   CAPITAL WITHDRAWAL
========================================= */

let __capitalLock = false;

async function confirmCapitalWithdraw() {
  if (__capitalLock) {
    return;
  }

  __capitalLock = true;

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
      await getAvailableCapital();

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
        project: PROJECT_NAME,
        amount: withdrawal.amount,
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
    __capitalLock = false;
  }
}

/* =========================================
   STAKE STATUS
========================================= */

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
        .eq("project", PROJECT_NAME)
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
        Number(
          stake.unlockTime
        ) || 0;

      if (now >= unlockTime) {
        unlocked += amount;
      } else {
        locked += amount;
      }
    });

    let text = "";

    if (locked > 0) {
      text +=
        `Locked: ${locked.toFixed(2)} Pi`;
    }

    if (unlocked > 0) {
      if (text) {
        text += " • ";
      }

      text +=
        `Unlocked: ${unlocked.toFixed(2)} Pi`;
    }

    stakeStatus.innerText = text;
  } catch (error) {
    console.error(
      "UPDATE STAKE STATUS ERROR:",
      error
    );
  }
}

/* =========================================
   INPUT EVENTS
========================================= */

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

/* =========================================
   DOM READY
========================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {
    initializeProjectUI();

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

/* =========================================
   AUTO UPDATE
========================================= */

setInterval(
  () => updateStakeStatus(),
  5000
);

setInterval(
  () => updateCapitalAvailable(),
  5000
);
