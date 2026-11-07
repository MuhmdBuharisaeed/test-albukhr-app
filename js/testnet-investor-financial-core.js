/* ALBUKHR TESTNET INVESTOR FINANCIAL CORE v1.1
 * Pure, deterministic calculations for the Testnet Investor dashboard.
 * No network, database, storage, payment, or DOM access.
 *
 * Accounting rules are intentionally aligned with the current Testnet SQL:
 * - A stake is created only after a verified Testnet Pi payment.
 * - reward_amount is the stored reward entitlement; do not recompute it from
 *   reward_rate or duration_days in the browser.
 * - A completed withdrawal is settled only when its row is completed and has
 *   a txid. requested_amount is the stake/reward deduction at settlement.
 * - pending/processing/approved withdrawals reserve requested_amount plus
 *   fee_amount but do not reduce the settled portfolio until completed.
 * - Failed/rejected/cancelled withdrawal requests do not reduce balances.
 * - Capital is withdrawable only after unlock_at and only for active/completed
 *   stakes. Reward withdrawal has no unlock_at check in current SQL.
 * - Missing network fields are accepted only because the caller is the
 *   Testnet-scoped investor endpoint. An explicit non-Testnet network is
 *   excluded and triggers reconciliation review.
 * - The response identity (piUid), stake owner, and withdrawal owner must agree.
 * - Withdrawal project ID/code must match its parent stake before any balance
 *   is changed. Missing or mismatched identities trigger reconciliation review.
 */
(function (root, factory) {
  "use strict";

  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.AlbukhrTestnetFinancialCore = api;
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  var NETWORK = "testnet";
  var SCALE = 10000000n;
  var SCALE_DIGITS = 7;
  var STAKE_STATUSES = ["active", "completed", "withdrawn", "cancelled"];
  var OPEN_WITHDRAWAL_STATUSES = ["pending", "processing", "approved"];
  var CLOSED_WITHDRAWAL_STATUSES = ["failed", "rejected", "cancelled"];
  var WITHDRAWAL_TYPES = ["capital", "reward"];

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function decimalUnits(value, fieldName, allowZero) {
    if (value == null || clean(value) === "") {
      throw new Error("MISSING_" + fieldName.toUpperCase());
    }

    var source;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        throw new Error("INVALID_" + fieldName.toUpperCase());
      }
      source = value.toFixed(SCALE_DIGITS);
    } else {
      source = clean(value);
    }

    var match = /^(\+?)(\d+)(?:\.(\d{1,7}))?$/.exec(source);
    if (!match) {
      throw new Error("INVALID_" + fieldName.toUpperCase());
    }

    var whole = BigInt(match[2]);
    var fractional = BigInt(((match[3] || "") + "0000000").slice(0, 7));
    var units = whole * SCALE + fractional;

    if (!allowZero && units <= 0n) {
      throw new Error("NON_POSITIVE_" + fieldName.toUpperCase());
    }
    return units;
  }

  function formatUnits(units) {
    var negative = units < 0n;
    var absolute = negative ? -units : units;
    var whole = (absolute / SCALE).toString();
    var fraction = (absolute % SCALE).toString().padStart(SCALE_DIGITS, "0");
    fraction = fraction.replace(/0+$/, "");
    return (negative ? "-" : "") + whole + (fraction ? "." + fraction : "");
  }

  function maxZero(value) {
    return value > 0n ? value : 0n;
  }

  function parseAsOf(value) {
    if (value == null) return Date.now();
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number" && Number.isFinite(value)) return value;
    var parsed = Date.parse(String(value));
    if (!Number.isFinite(parsed)) throw new Error("INVALID_AS_OF_DATE");
    return parsed;
  }

  function addWarning(warnings, code, rowId) {
    var suffix = rowId ? ":" + clean(rowId) : "";
    var warning = code + suffix;
    if (warnings.indexOf(warning) === -1) warnings.push(warning);
  }

  function asArray(value, name, warnings) {
    if (Array.isArray(value)) return value;
    addWarning(warnings, "INVALID_" + name.toUpperCase() + "_COLLECTION");
    return [];
  }

  function calculate(input) {
    input = input || {};
    var warnings = [];
    var expectedPiUid = clean(input.piUid);
    if (!expectedPiUid) addWarning(warnings, "INVESTOR_IDENTITY_MISSING");

    var asOfMs = parseAsOf(input.asOf);
    var asOf = new Date(asOfMs).toISOString();
    var stakes = asArray(input.stakes, "stakes", warnings);
    var withdrawals = asArray(input.withdrawals, "withdrawals", warnings);
    var stakeMap = new Map();
    var withdrawalIds = new Set();

    stakes.forEach(function (row) {
      if (!row || typeof row !== "object") {
        addWarning(warnings, "INVALID_STAKE_ROW");
        return;
      }

      var rowId = clean(row.id);
      var rowNetwork = clean(row.network).toLowerCase();
      if (rowNetwork && rowNetwork !== NETWORK) {
        addWarning(warnings, "NON_TESTNET_STAKE_EXCLUDED", rowId);
        return;
      }
      if (!rowId) {
        addWarning(warnings, "STAKE_ID_MISSING");
        return;
      }
      if (stakeMap.has(rowId)) {
        addWarning(warnings, "DUPLICATE_STAKE_ID", rowId);
        return;
      }

      var stakePiUid = clean(row.pi_uid);
      if (!stakePiUid) {
        addWarning(warnings, "STAKE_OWNER_IDENTITY_MISSING", rowId);
        return;
      }
      if (expectedPiUid && stakePiUid !== expectedPiUid) {
        addWarning(warnings, "STAKE_OWNER_IDENTITY_MISMATCH", rowId);
        return;
      }
      if (!clean(row.project_id) || !clean(row.project_code)) {
        addWarning(warnings, "STAKE_PROJECT_IDENTITY_MISSING", rowId);
        return;
      }

      var status = clean(row.status).toLowerCase();
      if (STAKE_STATUSES.indexOf(status) === -1) {
        addWarning(warnings, "UNKNOWN_STAKE_STATUS", rowId);
        return;
      }
      if (status === "cancelled") {
        addWarning(warnings, "CANCELLED_STAKE_REQUIRES_RECONCILIATION", rowId);
        return;
      }

      var amount;
      var reward;
      try {
        amount = decimalUnits(row.amount, "stake_amount", false);
        reward = decimalUnits(row.reward_amount, "reward_amount", true);
      } catch (error) {
        addWarning(warnings, error.message || "INVALID_STAKE_FINANCIAL_VALUE", rowId);
        return;
      }

      var unlockAt = Date.parse(clean(row.unlock_at));
      var unlockValid = Number.isFinite(unlockAt);
      if (!unlockValid) addWarning(warnings, "STAKE_UNLOCK_DATE_INVALID", rowId);

      var position = {
        stake: row,
        id: rowId,
        status: status,
        amount: amount,
        reward: reward,
        unlockAt: unlockValid ? unlockAt : null,
        matured: unlockValid && unlockAt <= asOfMs,
        capitalPaid: 0n,
        rewardPaid: 0n,
        capitalPending: 0n,
        rewardPending: 0n
      };
      stakeMap.set(rowId, position);
    });

    var capitalPaidTotal = 0n;
    var rewardPaidTotal = 0n;
    var capitalPendingTotal = 0n;
    var rewardPendingTotal = 0n;
    var completedWithdrawalCount = 0;
    var openWithdrawalCount = 0;

    withdrawals.forEach(function (row) {
      if (!row || typeof row !== "object") {
        addWarning(warnings, "INVALID_WITHDRAWAL_ROW");
        return;
      }

      var rowId = clean(row.id);
      var rowNetwork = clean(row.network).toLowerCase();
      if (rowNetwork && rowNetwork !== NETWORK) {
        addWarning(warnings, "NON_TESTNET_WITHDRAWAL_EXCLUDED", rowId);
        return;
      }
      if (!rowId) {
        addWarning(warnings, "WITHDRAWAL_ID_MISSING");
        return;
      }
      if (withdrawalIds.has(rowId)) {
        addWarning(warnings, "DUPLICATE_WITHDRAWAL_ID", rowId);
        return;
      }
      withdrawalIds.add(rowId);

      var status = clean(row.status).toLowerCase();
      var type = clean(row.withdrawal_type).toLowerCase();
      if (WITHDRAWAL_TYPES.indexOf(type) === -1) {
        addWarning(warnings, "UNKNOWN_WITHDRAWAL_TYPE", rowId);
        return;
      }
      if (OPEN_WITHDRAWAL_STATUSES.indexOf(status) === -1 &&
          CLOSED_WITHDRAWAL_STATUSES.indexOf(status) === -1 &&
          status !== "completed") {
        addWarning(warnings, "UNKNOWN_WITHDRAWAL_STATUS", rowId);
        return;
      }
      var stakeId = clean(row.stake_id);
      var position = stakeMap.get(stakeId);
      if (!position) {
        addWarning(warnings, "WITHDRAWAL_STAKE_NOT_IN_PORTFOLIO", rowId);
        return;
      }

      var withdrawalPiUid = clean(row.pi_uid);
      var stakePiUidForWithdrawal = clean(position.stake.pi_uid);
      if (!withdrawalPiUid || !stakePiUidForWithdrawal) {
        addWarning(warnings, "WITHDRAWAL_OWNER_IDENTITY_MISSING", rowId);
        return;
      }
      if (
        withdrawalPiUid !== stakePiUidForWithdrawal ||
        (expectedPiUid && withdrawalPiUid !== expectedPiUid)
      ) {
        addWarning(warnings, "WITHDRAWAL_OWNER_IDENTITY_MISMATCH", rowId);
        return;
      }

      var withdrawalProjectId = clean(row.project_id);
      var withdrawalProjectCode = clean(row.project_code);
      if (!withdrawalProjectId || !withdrawalProjectCode) {
        addWarning(warnings, "WITHDRAWAL_PROJECT_IDENTITY_MISSING", rowId);
        return;
      }
      if (
        withdrawalProjectId !== clean(position.stake.project_id) ||
        withdrawalProjectCode !== clean(position.stake.project_code)
      ) {
        addWarning(warnings, "WITHDRAWAL_PROJECT_IDENTITY_MISMATCH", rowId);
        return;
      }

      // Closed requests do not affect balances, but their ownership and project
      // links are still checked so historical integrity errors are not hidden.
      if (CLOSED_WITHDRAWAL_STATUSES.indexOf(status) !== -1) return;

      var requested;
      var fee;
      try {
        requested = decimalUnits(row.requested_amount, "withdrawal_amount", false);
        fee = row.fee_amount == null || clean(row.fee_amount) === ""
          ? 0n
          : decimalUnits(row.fee_amount, "withdrawal_fee", true);
      } catch (error) {
        addWarning(warnings, error.message || "INVALID_WITHDRAWAL_FINANCIAL_VALUE", rowId);
        return;
      }

      if (status === "completed") {
        if (!clean(row.txid)) {
          addWarning(warnings, "COMPLETED_WITHDRAWAL_MISSING_TXID", rowId);
          if (type === "capital") {
            position.capitalPending += requested + fee;
            capitalPendingTotal += requested + fee;
          } else {
            position.rewardPending += requested + fee;
            rewardPendingTotal += requested + fee;
          }
          openWithdrawalCount += 1;
          return;
        }
        if (fee !== 0n) addWarning(warnings, "COMPLETED_WITHDRAWAL_FEE_NOT_ZERO", rowId);
        if (type === "capital") {
          position.capitalPaid += requested;
          capitalPaidTotal += requested;
        } else {
          position.rewardPaid += requested;
          rewardPaidTotal += requested;
        }
        completedWithdrawalCount += 1;
        return;
      }

      var reserved = requested + fee;
      if (type === "capital") {
        position.capitalPending += reserved;
        capitalPendingTotal += reserved;
      } else {
        position.rewardPending += reserved;
        rewardPendingTotal += reserved;
      }
      openWithdrawalCount += 1;
    });

    var grossCapital = 0n;
    var outstandingCapital = 0n;
    var outstandingRewards = 0n;
    var lockedCapital = 0n;
    var maturedCapital = 0n;
    var availableCapital = 0n;
    var availableRewards = 0n;
    var activeProjects = new Set();
    var positions = [];

    stakeMap.forEach(function (position) {
      var capBalance = position.amount - position.capitalPaid;
      var rewardBalance = position.reward - position.rewardPaid;

      if (capBalance < 0n) {
        addWarning(warnings, "CAPITAL_WITHDRAWALS_EXCEED_STAKE", position.id);
        capBalance = 0n;
      }
      if (rewardBalance < 0n) {
        addWarning(warnings, "REWARD_WITHDRAWALS_EXCEED_ENTITLEMENT", position.id);
        rewardBalance = 0n;
      }
      if (position.capitalPending > capBalance) {
        addWarning(warnings, "PENDING_CAPITAL_WITHDRAWAL_EXCEEDS_BALANCE", position.id);
      }
      if (position.rewardPending > rewardBalance) {
        addWarning(warnings, "PENDING_REWARD_WITHDRAWAL_EXCEEDS_BALANCE", position.id);
      }
      if (position.status === "withdrawn" && capBalance > 0n) {
        addWarning(warnings, "WITHDRAWN_STAKE_HAS_REMAINING_CAPITAL", position.id);
      }
      if (position.status === "withdrawn" && rewardBalance > 0n) {
        addWarning(warnings, "WITHDRAWN_STAKE_HAS_REMAINING_REWARDS", position.id);
      }

      var canWithdraw = position.status === "active" || position.status === "completed";
      var capAfterPending = maxZero(capBalance - position.capitalPending);
      var rewardAfterPending = maxZero(rewardBalance - position.rewardPending);
      var capAvailable = canWithdraw && position.matured ? capAfterPending : 0n;
      var rewardAvailable = canWithdraw ? rewardAfterPending : 0n;

      grossCapital += position.amount;
      outstandingCapital += capBalance;
      outstandingRewards += rewardBalance;
      if (position.matured) maturedCapital += capBalance;
      else lockedCapital += capBalance;
      availableCapital += capAvailable;
      availableRewards += rewardAvailable;

      if (position.status === "active" && clean(position.stake.project_code)) {
        activeProjects.add(clean(position.stake.project_code));
      }

      positions.push(Object.assign({}, position.stake, {
        network: NETWORK,
        capital_remaining: formatUnits(capBalance),
        reward_remaining: formatUnits(rewardBalance),
        capital_pending_withdrawal: formatUnits(position.capitalPending),
        reward_pending_withdrawal: formatUnits(position.rewardPending),
        capital_available: formatUnits(capAvailable),
        reward_available: formatUnits(rewardAvailable),
        capital_matured: position.matured,
        capital_locked: !position.matured,
        financial_status: position.status
      }));
    });

    positions.sort(function (a, b) {
      var aDate = Date.parse(clean(a.created_at)) || 0;
      var bDate = Date.parse(clean(b.created_at)) || 0;
      return bDate - aDate;
    });

    var portfolio = outstandingCapital + outstandingRewards;
    var reconciled = warnings.length === 0;

    return {
      ok: reconciled,
      network: NETWORK,
      as_of: asOf,
      warnings: warnings,
      positions: positions,
      summary: {
        network: NETWORK,
        as_of: asOf,
        reconciled: reconciled,
        warnings: warnings,
        portfolio: formatUnits(portfolio),
        invested: formatUnits(outstandingCapital),
        earnings: formatUnits(outstandingRewards),
        gross_invested: formatUnits(grossCapital),
        capital_returned: formatUnits(capitalPaidTotal),
        rewards_paid: formatUnits(rewardPaidTotal),
        capital_remaining: formatUnits(outstandingCapital),
        rewards_remaining: formatUnits(outstandingRewards),
        capital_locked: formatUnits(lockedCapital),
        capital_matured: formatUnits(maturedCapital),
        capital_pending_withdrawal: formatUnits(capitalPendingTotal),
        reward_pending_withdrawal: formatUnits(rewardPendingTotal),
        available_capital: formatUnits(availableCapital),
        available_rewards: formatUnits(availableRewards),
        available_total: formatUnits(availableCapital + availableRewards),
        active_projects: activeProjects.size,
        stake_count: stakeMap.size,
        completed_withdrawal_count: completedWithdrawalCount,
        pending_withdrawal_count: openWithdrawalCount
      }
    };
  }

  return Object.freeze({
    network: NETWORK,
    scale: SCALE_DIGITS,
    calculate: calculate,
    formatUnits: formatUnits
  });
});
