const express = require("express");
const crypto = require("crypto");

const router = express.Router();

const transactions = require("../data/transactions");
const auditLogs = require("../data/auditLogs");

/* =========================================================
   VERIFY RAZORPAY WEBHOOK SIGNATURE
========================================================= */

function verifyWebhookSignature(
  rawBody,
  receivedSignature
) {
  const webhookSecret =
    process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error(
      "RAZORPAY_WEBHOOK_SECRET is missing"
    );
  }

  if (!receivedSignature) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac(
      "sha256",
      webhookSecret
    )
    .update(rawBody)
    .digest("hex");

  if (
    expectedSignature.length !==
    receivedSignature.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(receivedSignature)
  );
}

/* =========================================================
   CHECK IF WEBHOOK EVENT WAS ALREADY RECORDED
========================================================= */

function webhookEventAlreadyRecorded(
  transactionId,
  paymentLinkId,
  eventName
) {
  return auditLogs.some(
    (log) =>
      log.transactionId ===
        transactionId &&
      log.razorpayPaymentLinkId ===
        paymentLinkId &&
      log.webhookEvent ===
        eventName
  );
}

/* =========================================================
   RAZORPAY WEBHOOK
========================================================= */

router.post(
  "/razorpay",
  express.raw({
    type: "application/json"
  }),
  (req, res) => {
    try {
      const signature =
        req.headers[
          "x-razorpay-signature"
        ];

      const rawBody = req.body;

      /* -----------------------------------------
         SIGNATURE CHECK
      ----------------------------------------- */

      const isValid =
        verifyWebhookSignature(
          rawBody,
          signature
        );

      if (!isValid) {
        console.log(
          "Invalid Razorpay webhook signature"
        );

        return res.status(400).json({
          success: false,
          message:
            "Invalid webhook signature"
        });
      }

      /* -----------------------------------------
         PARSE EVENT
      ----------------------------------------- */

      const event = JSON.parse(
        rawBody.toString("utf8")
      );

      const eventName =
        event.event;

      console.log(
        "Razorpay webhook received:",
        eventName
      );

      const paymentLink =
        event?.payload
          ?.payment_link
          ?.entity;

      if (!paymentLink) {
        return res.json({
          success: true,
          ignored: true,
          message:
            "Webhook does not contain a payment link"
        });
      }

      const paymentLinkId =
        paymentLink.id;

      /* -----------------------------------------
         FIND RECOVERAI PAYMENT LINK
      ----------------------------------------- */

      const paymentLinkLog =
        [...auditLogs]
          .reverse()
          .find(
            (log) =>
              log
                .razorpayPaymentLinkId ===
              paymentLinkId
          );

      if (!paymentLinkLog) {
        console.log(
          "No RecoverAI transaction found for:",
          paymentLinkId
        );

        return res.json({
          success: true,
          ignored: true,
          message:
            "Payment link is not associated with RecoverAI"
        });
      }

      const transactionId =
        paymentLinkLog.transactionId;

      const txn =
        transactions.find(
          (item) =>
            item.id ===
            transactionId
        );

      if (!txn) {
        return res.json({
          success: true,
          ignored: true,
          message:
            "Transaction no longer exists"
        });
      }

      /* -----------------------------------------
         IDEMPOTENCY / DUPLICATE EVENT CHECK
      ----------------------------------------- */

      if (
        webhookEventAlreadyRecorded(
          transactionId,
          paymentLinkId,
          eventName
        )
      ) {
        console.log(
          `Duplicate Razorpay webhook ignored: ${eventName} for ${transactionId}`
        );

        return res.json({
          success: true,
          duplicate: true,
          event: eventName,
          transactionId
        });
      }

      /* =====================================================
         PAYMENT LINK PAID
      ===================================================== */

      if (
        eventName ===
        "payment_link.paid"
      ) {
        /*
          Extra protection:
          if another flow already recovered this
          transaction, don't count the revenue twice.
        */

        if (txn.recovered) {
          auditLogs.push({
            transactionId:
              txn.id,

            customer:
              txn.customer,

            amount:
              txn.amount,

            action:
              "razorpay_webhook",

            result:
              "duplicate_ignored",

            recoveredAmount:
              0,

            webhookEvent:
              eventName,

            razorpayPaymentLinkId:
              paymentLinkId,

            razorpayPaymentLinkStatus:
              "paid",

            explanation:
              "Razorpay reported payment_link.paid, but this transaction had already been recovered. No additional revenue was counted.",

            timestamp:
              new Date().toISOString()
          });

          console.log(
            `Payment already recovered for ${txn.id}. Duplicate paid event ignored.`
          );

          return res.json({
            success: true,
            duplicate: true,
            event:
              eventName,
            transactionId:
              txn.id,
            recoveredAmount:
              0
          });
        }

        txn.status =
          "success";

        txn.recovered =
          true;

        txn.processed =
          true;

        auditLogs.push({
          transactionId:
            txn.id,

          customer:
            txn.customer,

          amount:
            txn.amount,

          action:
            "razorpay_webhook",

          result:
            "recovered",

          recoveredAmount:
            txn.amount,

          webhookEvent:
            eventName,

          razorpayPaymentLinkId:
            paymentLinkId,

          razorpayPaymentLinkStatus:
            "paid",

          explanation:
            "Razorpay payment_link.paid webhook was verified successfully. Revenue was marked as recovered automatically.",

          timestamp:
            new Date().toISOString()
        });

        console.log(
          `Recovered ${txn.id}: ₹${txn.amount}`
        );

        return res.json({
          success: true,
          event:
            eventName,
          transactionId:
            txn.id,
          recoveredAmount:
            txn.amount
        });
      }

      /* =====================================================
         PAYMENT LINK CANCELLED
      ===================================================== */

      if (
        eventName ===
        "payment_link.cancelled"
      ) {
        auditLogs.push({
          transactionId:
            txn.id,

          customer:
            txn.customer,

          amount:
            txn.amount,

          action:
            "razorpay_webhook",

          result:
            "failed",

          recoveredAmount:
            0,

          webhookEvent:
            eventName,

          razorpayPaymentLinkId:
            paymentLinkId,

          razorpayPaymentLinkStatus:
            "cancelled",

          explanation:
            "Razorpay reported that the recovery payment link was cancelled. No revenue was recovered.",

          timestamp:
            new Date().toISOString()
        });

        console.log(
          `Recovery cancelled for ${txn.id}`
        );

        return res.json({
          success: true,
          event:
            eventName,
          transactionId:
            txn.id
        });
      }

      /* =====================================================
         PAYMENT LINK EXPIRED
      ===================================================== */

      if (
        eventName ===
        "payment_link.expired"
      ) {
        auditLogs.push({
          transactionId:
            txn.id,

          customer:
            txn.customer,

          amount:
            txn.amount,

          action:
            "razorpay_webhook",

          result:
            "failed",

          recoveredAmount:
            0,

          webhookEvent:
            eventName,

          razorpayPaymentLinkId:
            paymentLinkId,

          razorpayPaymentLinkStatus:
            "expired",

          explanation:
            "Razorpay reported that the recovery payment link expired before payment. No revenue was recovered.",

          timestamp:
            new Date().toISOString()
        });

        console.log(
          `Recovery payment link expired for ${txn.id}`
        );

        return res.json({
          success: true,
          event:
            eventName,
          transactionId:
            txn.id
        });
      }

      /* =====================================================
         UNSUPPORTED EVENT
      ===================================================== */

      console.log(
        `Ignored Razorpay event: ${eventName}`
      );

      return res.json({
        success: true,
        ignored: true,
        event:
          eventName
      });

    } catch (error) {
      console.error(
        "Webhook processing error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Webhook processing failed"
      });
    }
  }
);

module.exports = router;