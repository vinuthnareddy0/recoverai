const express =
  require("express");

const router =
  express.Router();

const transactions =
  require("../data/transactions");

const auditLogs =
  require("../data/auditLogs");

/* =========================================================
   FORMAT ACTIVITY EVENT
========================================================= */

function formatActivity(log) {
  let title =
    "Recovery activity";

  let type =
    "info";

  /* -----------------------------
     RECOVERED
  ----------------------------- */

  if (
    log.result ===
    "recovered"
  ) {
    title =
      `Revenue recovered ₹${(
        log.recoveredAmount || 0
      ).toLocaleString("en-IN")}`;

    type =
      "success";
  }

  /* -----------------------------
     BLOCKED
  ----------------------------- */

  else if (
    log.result ===
    "blocked"
  ) {
    title =
      "Escalated for human review";

    type =
      "warning";
  }

  /* -----------------------------
     APPROVED
  ----------------------------- */

  else if (
    log.result ===
    "approved"
  ) {
    title =
      "Recovery approved by reviewer";

    type =
      "success";
  }

  /* -----------------------------
     REJECTED
  ----------------------------- */

  else if (
    log.result ===
    "rejected"
  ) {
    title =
      "Recovery rejected by reviewer";

    type =
      "failed";
  }

  /* -----------------------------
     PAYMENT LINK
  ----------------------------- */

  else if (
    log.result ===
    "link_created"
  ) {
    title =
      "Razorpay recovery link created";

    type =
      "payment";
  }

  /* -----------------------------
     FAILED
  ----------------------------- */

  else if (
    log.result ===
    "failed"
  ) {
    title =
      "Recovery attempt failed";

    type =
      "failed";
  }

  /* -----------------------------
     PENDING
  ----------------------------- */

  else if (
    log.result ===
    "pending"
  ) {
    title =
      "Waiting for payment";

    type =
      "pending";
  }

  /* -----------------------------
     DUPLICATE
  ----------------------------- */

  else if (
    log.result ===
    "duplicate_ignored"
  ) {
    title =
      "Duplicate payment event ignored";

    type =
      "info";
  }

  /* -----------------------------
     GENERAL AI ACTION
  ----------------------------- */

  else if (log.action) {
    title =
      log.action
        .replaceAll(
          "_",
          " "
        )
        .replace(
          /\b\w/g,
          (letter) =>
            letter.toUpperCase()
        );
  }

  return {
    transactionId:
      log.transactionId,

    customer:
      log.customer || null,

    amount:
      log.amount || 0,

    recoveredAmount:
      log.recoveredAmount || 0,

    action:
      log.action || null,

    result:
      log.result || null,

    title,

    type,

    explanation:
      log.explanation ||
      log.reason ||
      null,

    timestamp:
      log.timestamp ||
      null
  };
}

/* =========================================================
   GET LIVE ACTIVITY FEED
========================================================= */

router.get(
  "/activity",
  (req, res) => {
    const requestedLimit =
      Number(
        req.query.limit
      );

    const limit =
      Number.isFinite(
        requestedLimit
      ) &&
      requestedLimit > 0
        ? Math.min(
            requestedLimit,
            50
          )
        : 12;

    const activity =
      [...auditLogs]
        .reverse()
        .slice(
          0,
          limit
        )
        .map(
          formatActivity
        );

    return res.json({
      success: true,

      count:
        activity.length,

      activity
    });
  }
);

/* =========================================================
   GET DEMO STATE
========================================================= */

router.get(
  "/state",
  (req, res) => {
    const recovered =
      transactions.filter(
        (txn) =>
          txn.recovered
      ).length;

    const processed =
      transactions.filter(
        (txn) =>
          txn.processed
      ).length;

    return res.json({
      success: true,

      transactions:
        transactions.length,

      auditLogs:
        auditLogs.length,

      recovered,

      processed
    });
  }
);

/* =========================================================
   RESET DEMO
========================================================= */

router.post(
  "/reset",
  (req, res) => {
    try {
      /*
        Restore original 60 synthetic
        transactions.
      */

      transactions.resetTransactions();

      /*
        Clear all audit history.
      */

      auditLogs.resetAuditLogs();

      console.log(
        "RecoverAI demo reset completed"
      );

      console.log(
        "60 transactions restored"
      );

      console.log(
        "Audit trail cleared"
      );

      return res.json({
        success: true,

        message:
          "RecoverAI demo reset successfully",

        transactions:
          transactions.length,

        auditLogs:
          auditLogs.length,

        recovered:
          0,

        processed:
          0
      });
    } catch (error) {
      console.error(
        "Demo reset failed:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to reset RecoverAI demo"
        });
    }
  }
);

module.exports =
  router;