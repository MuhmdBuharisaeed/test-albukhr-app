/* ALBUKHR TESTNET LIQUIDITY PAYMENT DIAGNOSTICS v1
 * Additive, non-destructive diagnostic/UX layer.
 * Does not change Pi SDK configuration, backend routes, ownership,
 * treasury, withdrawal logic, or existing payment callbacks.
 *
 * Purpose:
 * - Preserve the real payment error instead of allowing the owner page's
 *   refresh logic to immediately overwrite it with the ready-state message.
 * - Surface synchronous Pi.createPayment failures that previously became
 *   invisible to the user.
 * - Detect a payment-start call that produces no Pi callback for a short
 *   diagnostic window.
 */
(function (window, document) {
  "use strict";

  var PAYMENT_EVENT = "albukhr:testnet-liquidity-payment-error";
  var APPROVED_EVENT = "albukhr:testnet-liquidity-payment-approved";
  var COMPLETED_EVENT = "albukhr:testnet-liquidity-payment-completed";
  var CANCELLED_EVENT = "albukhr:testnet-liquidity-payment-cancelled";
  var DIAGNOSTIC_EVENT = "albukhr:testnet-liquidity-payment-diagnostic";
  var WAIT_MS = 15000;

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function safeErrorMessage(error) {
    return clean(error && (error.message || error.name)) || "PI_PAYMENT_FAILED";
  }

  function setStatus(message, type) {
    var node = document.getElementById("liquidityStatus");
    if (!node) return;
    node.textContent = clean(message);
    if (type) node.dataset.status = type;
    else delete node.dataset.status;
  }

  function emit(detail) {
    try {
      window.dispatchEvent(new CustomEvent(DIAGNOSTIC_EVENT, {
        detail: detail || {}
      }));
    } catch (_) {}
  }

  /*
   * Wrap the existing public payment method without touching the original
   * implementation. This catches errors thrown/rejected before the original
   * client's onError callback can run.
   */
  function wrapPaymentClient() {
    var original = window.AlbukhrTestnetLiquidityPayment;
    if (!original || typeof original.createLiquidityPayment !== "function") {
      emit({
        stage: "client_unavailable",
        message: "The Testnet Pi liquidity payment module is unavailable."
      });
      return;
    }

    if (original.__albukhrDiagnosticsWrapped === true) return;

    var wrapped = Object.assign({}, original);
    var originalCreate = original.createLiquidityPayment;

    wrapped.createLiquidityPayment = function (project, amount) {
      var startedAt = Date.now();
      var callbackSeen = false;

      var timer = window.setTimeout(function () {
        if (callbackSeen) return;

        setStatus(
          "Pi payment did not reach a Pi payment callback within 15 seconds. Check the Pi Browser payment flow and try again only after confirming no payment was created.",
          "error"
        );

        emit({
          stage: "no_callback_timeout",
          elapsed_ms: Date.now() - startedAt,
          message: "Pi.createPayment started without an observed payment callback."
        });
      }, WAIT_MS);

      try {
        var result = originalCreate.call(original, project, amount);

        /* The existing client returns a Promise. */
        if (result && typeof result.then === "function") {
          return result.then(function (value) {
            callbackSeen = true;
            window.clearTimeout(timer);
            return value;
          }, function (error) {
            callbackSeen = true;
            window.clearTimeout(timer);

            var message = safeErrorMessage(error);
            setStatus(message, "error");
            emit({
              stage: "payment_rejected",
              elapsed_ms: Date.now() - startedAt,
              message: message
            });

            throw error;
          });
        }

        return result;
      } catch (error) {
        callbackSeen = true;
        window.clearTimeout(timer);

        var message = safeErrorMessage(error);
        setStatus(message, "error");
        emit({
          stage: "payment_thrown",
          elapsed_ms: Date.now() - startedAt,
          message: message
        });

        throw error;
      }
    };

    wrapped.__albukhrDiagnosticsWrapped = true;

    try {
      window.AlbukhrTestnetLiquidityPayment = Object.freeze(wrapped);
    } catch (_) {
      window.AlbukhrTestnetLiquidityPayment = wrapped;
    }
  }

  /*
   * Existing payment client emits these events. Re-apply the final UI state
   * after the owner page's cleanup/finally block so a genuine error is not
   * immediately replaced by "Owner authorization verified".
   */
  window.addEventListener(PAYMENT_EVENT, function (event) {
    var detail = event && event.detail ? event.detail : {};
    var message = safeErrorMessage(detail.error);
    window.setTimeout(function () {
      setStatus(message, "error");
    }, 0);
  });

  window.addEventListener(APPROVED_EVENT, function () {
    setStatus("Pi payment created and approved by the ALBUKHR server. Continue in the Pi payment screen.");
  });

  window.addEventListener(COMPLETED_EVENT, function () {
    setStatus("Pi liquidity payment completed successfully. Refreshing project liquidity…", "success");
  });

  window.addEventListener(CANCELLED_EVENT, function () {
    setStatus("Pi payment was cancelled. No liquidity was recorded.", "error");
  });

  /* Defer one tick so the payment client script has definitely published its API. */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      window.setTimeout(wrapPaymentClient, 0);
    }, { once: true });
  } else {
    window.setTimeout(wrapPaymentClient, 0);
  }
})(window, document);
