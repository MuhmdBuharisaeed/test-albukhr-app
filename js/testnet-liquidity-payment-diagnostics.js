/* ALBUKHR TESTNET LIQUIDITY PAYMENT DIAGNOSTICS v2
 * Step 7 — Pi SDK callback/bridge instrumentation.
 *
 * Non-destructive: this file wraps the already-loaded Pi SDK methods only to
 * observe init/auth/payment callbacks. It does not change sandbox settings,
 * payment amounts, metadata, backend routes, ownership, treasury, or DB logic.
 *
 * Important:
 * - Keep Pi.init sandbox:false for the hosted Testnet app.
 * - Do not use this file as payment business logic.
 * - Remove/disable this diagnostic layer after the root cause is confirmed.
 */
(function (window, document) {
  "use strict";

  var PAYMENT_EVENT = "albukhr:testnet-liquidity-payment-error";
  var APPROVED_EVENT = "albukhr:testnet-liquidity-payment-approved";
  var COMPLETED_EVENT = "albukhr:testnet-liquidity-payment-completed";
  var CANCELLED_EVENT = "albukhr:testnet-liquidity-payment-cancelled";
  var DIAGNOSTIC_EVENT = "albukhr:testnet-liquidity-payment-diagnostic";
  var WATCHDOG_MS = 20000;

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function safeErrorMessage(error) {
    return clean(error && (error.message || error.name)) || "PI_PAYMENT_FAILED";
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function setStatus(message, type) {
    var node = byId("liquidityStatus");
    if (!node) return;
    node.textContent = clean(message);
    if (type) node.dataset.status = type;
    else delete node.dataset.status;
  }

  function emit(detail) {
    try {
      window.dispatchEvent(new CustomEvent(DIAGNOSTIC_EVENT, {
        detail: Object.assign({
          timestamp: new Date().toISOString()
        }, detail || {})
      }));
    } catch (_) {}
  }

  function paymentSummary(payment) {
    if (!payment) return null;
    var status = payment.status || {};
    var tx = payment.transaction || null;
    return {
      identifier: clean(payment.identifier || payment.id),
      amount: Number(payment.amount || 0),
      network: clean(payment.network),
      direction: clean(payment.direction),
      metadata: payment.metadata || null,
      developer_approved: status.developer_approved === true || status.developerApproved === true,
      transaction_verified: status.transaction_verified === true || status.transactionVerified === true || (tx && tx.verified === true),
      developer_completed: status.developer_completed === true || status.developerCompleted === true,
      cancelled: status.cancelled === true,
      user_cancelled: status.user_cancelled === true,
      has_transaction: !!tx,
      txid: clean(tx && tx.txid)
    };
  }

  function patchPi() {
    var Pi = window.Pi;
    if (!Pi) {
      emit({ stage: "pi_unavailable", message: "window.Pi is unavailable." });
      return;
    }

    if (Pi.__albukhrStep7Patched === true) return;

    if (typeof Pi.init === "function") {
      var originalInit = Pi.init;
      Pi.init = function (options) {
        emit({
          stage: "sdk_init_called",
          sandbox: options && Object.prototype.hasOwnProperty.call(options, "sandbox") ? options.sandbox : "default",
          version: clean(options && options.version)
        });
        try {
          var result = originalInit.apply(this, arguments);
          emit({ stage: "sdk_init_returned" });
          return result;
        } catch (error) {
          emit({ stage: "sdk_init_thrown", message: safeErrorMessage(error) });
          throw error;
        }
      };
    }

    if (typeof Pi.authenticate === "function") {
      var originalAuthenticate = Pi.authenticate;
      Pi.authenticate = function (scopes, onIncompletePaymentFound) {
        emit({
          stage: "authenticate_called",
          scopes: Array.isArray(scopes) ? scopes.slice() : []
        });

        var wrappedIncomplete = function (payment) {
          var summary = paymentSummary(payment);
          emit({
            stage: "incomplete_payment_found",
            payment: summary
          });

          setStatus(
            "Pi reported an incomplete payment. Resolving it before a new payment is allowed…",
            "error"
          );

          if (typeof onIncompletePaymentFound === "function") {
            return onIncompletePaymentFound.apply(this, arguments);
          }

          return undefined;
        };

        try {
          var result = originalAuthenticate.call(this, scopes, wrappedIncomplete);

          if (result && typeof result.then === "function") {
            return result.then(function (value) {
              emit({
                stage: "authenticate_resolved",
                has_access_token: !!(value && value.accessToken),
                username: clean(value && value.user && value.user.username),
                uid_present: !!(value && value.user && value.user.uid)
              });
              return value;
            }, function (error) {
              emit({
                stage: "authenticate_rejected",
                message: safeErrorMessage(error)
              });
              throw error;
            });
          }

          emit({ stage: "authenticate_returned_non_promise" });
          return result;
        } catch (error) {
          emit({ stage: "authenticate_thrown", message: safeErrorMessage(error) });
          throw error;
        }
      };
    }

    if (typeof Pi.createPayment === "function") {
      var originalCreatePayment = Pi.createPayment;

      Pi.createPayment = function (paymentData, callbacks) {
        var startedAt = Date.now();
        var callbackSeen = false;
        var data = paymentData || {};
        var originalCallbacks = callbacks || {};

        emit({
          stage: "create_payment_called",
          elapsed_ms: 0,
          amount: Number(data.amount || 0),
          memo: clean(data.memo),
          metadata: data.metadata || null
        });

        function mark(stage, extra) {
          callbackSeen = true;
          emit(Object.assign({
            stage: stage,
            elapsed_ms: Date.now() - startedAt
          }, extra || {}));
        }

        var wrappedCallbacks = Object.assign({}, originalCallbacks);

        if (typeof originalCallbacks.onReadyForServerApproval === "function") {
          wrappedCallbacks.onReadyForServerApproval = function (paymentId) {
            mark("payment_callback_approval", {
              payment_id: clean(paymentId)
            });
            setStatus("Pi created the payment. Waiting for server approval…");
            return originalCallbacks.onReadyForServerApproval.apply(this, arguments);
          };
        }

        if (typeof originalCallbacks.onReadyForServerCompletion === "function") {
          wrappedCallbacks.onReadyForServerCompletion = function (paymentId, txid) {
            mark("payment_callback_completion", {
              payment_id: clean(paymentId),
              txid: clean(txid)
            });
            setStatus("Pi submitted the Testnet transaction. Completing it on the ALBUKHR server…");
            return originalCallbacks.onReadyForServerCompletion.apply(this, arguments);
          };
        }

        if (typeof originalCallbacks.onCancel === "function") {
          wrappedCallbacks.onCancel = function (paymentId) {
            mark("payment_callback_cancel", {
              payment_id: clean(paymentId)
            });
            setStatus("Pi cancelled the payment flow.", "error");
            return originalCallbacks.onCancel.apply(this, arguments);
          };
        }

        if (typeof originalCallbacks.onError === "function") {
          wrappedCallbacks.onError = function (error, payment) {
            mark("payment_callback_error", {
              message: safeErrorMessage(error),
              payment: paymentSummary(payment)
            });
            setStatus(safeErrorMessage(error), "error");
            return originalCallbacks.onError.apply(this, arguments);
          };
        }

        window.setTimeout(function () {
          if (callbackSeen) return;
          emit({
            stage: "create_payment_no_callback_timeout",
            elapsed_ms: Date.now() - startedAt,
            message: "Pi.createPayment returned without any payment callback for 20 seconds."
          });

          setStatus(
            "Pi.createPayment was called, but no approval, completion, cancel, or error callback arrived within 20 seconds. This points to the Pi Browser/App payment bridge or Pi app configuration, not the ALBUKHR approval endpoint.",
            "error"
          );
        }, WATCHDOG_MS);

        try {
          var result = originalCreatePayment.call(this, paymentData, wrappedCallbacks);
          emit({
            stage: "create_payment_returned",
            elapsed_ms: Date.now() - startedAt,
            return_type: result === null ? "null" : typeof result
          });
          return result;
        } catch (error) {
          callbackSeen = true;
          emit({
            stage: "create_payment_thrown",
            elapsed_ms: Date.now() - startedAt,
            message: safeErrorMessage(error)
          });
          setStatus(safeErrorMessage(error), "error");
          throw error;
        }
      };
    }

    try {
      Pi.__albukhrStep7Patched = true;
    } catch (_) {}

    emit({ stage: "diagnostic_patch_installed" });
  }

  window.addEventListener(DIAGNOSTIC_EVENT, function (event) {
    var d = event && event.detail ? event.detail : {};
    if (!d || !d.stage) return;

    try {
      console.info("[ALBUKHR STEP7]", d);
    } catch (_) {}

    if (d.stage === "payment_callback_error") {
      setStatus(clean(d.message) || "PI_PAYMENT_ERROR", "error");
    }
  });

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

  function installWhenReady() {
    if (window.Pi) {
      patchPi();
      return;
    }

    window.setTimeout(installWhenReady, 250);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installWhenReady, { once: true });
  } else {
    installWhenReady();
  }
})(window, document);
