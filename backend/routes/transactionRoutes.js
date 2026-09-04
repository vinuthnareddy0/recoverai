const express = require("express");
const router = express.Router();

const transactions = require("../data/transactions");
const auditLogs = require("../data/auditLogs");

const {
  analyzeTransaction
} = require("../services/recoveryEngine");

const {
  executeRecovery
} = require("../services/recoveryExecutor");

const {
  createRecoveryPaymentLink,
  getPaymentLinkStatus
} = require("../services/razorpayService");


/* =========================================================
   GET ALL TRANSACTIONS
========================================================= */

router.get("/", (req, res) => {
  res.json({
    success: true,
    count: transactions.length,
    transactions
  });
});


/* =========================================================
   GET AT-RISK TRANSACTIONS
========================================================= */

router.get("/at-risk", (req, res) => {
  const atRisk = transactions.filter(
    (txn) =>
      txn.status === "failed" ||
      txn.status === "abandoned"
  );

  const revenueAtRisk = atRisk.reduce(
    (total, txn) => total + txn.amount,
    0
  );

  res.json({
    success: true,
    count: atRisk.length,
    revenueAtRisk,
    transactions: atRisk
  });
});


/* =========================================================
   GET RECOVERY PLAN
========================================================= */

router.get("/recovery-plan", (req, res) => {
  const atRisk = transactions.filter(
    (txn) =>
      txn.status === "failed" ||
      txn.status === "abandoned"
  );

  const recoveryPlan = atRisk.map((txn) =>
    analyzeTransaction(txn)
  );

  res.json({
    success: true,
    count: recoveryPlan.length,
    recoveryPlan
  });
});


/* =========================================================
   EXECUTE RECOVERY AGENT
========================================================= */

router.post("/execute-recovery", (req, res) => {
  const atRisk = transactions.filter(
    (txn) =>
      (
        txn.status === "failed" ||
        txn.status === "abandoned"
      ) &&
      !txn.recovered &&
      !txn.processed
  );

  const results = [];

  for (const txn of atRisk) {
    const decision = analyzeTransaction(txn);

    const execution = executeRecovery(
      txn,
      decision
    );

    if (execution) {
      results.push(execution);
    }
  }

  const totalRecovered = results.reduce(
    (sum, item) =>
      sum + (item.recoveredAmount || 0),
    0
  );

  res.json({
    success: true,
    processed: results.length,
    totalRecovered,
    results
  });
});


/* =========================================================
   GET AUDIT LOGS
========================================================= */

router.get("/audit-logs", (req, res) => {
  res.json({
    success: true,
    count: auditLogs.length,
    logs: auditLogs
  });
});


/* =========================================================
   METRICS
========================================================= */

router.get("/metrics", (req, res) => {
  const totalRevenue = transactions.reduce(
    (sum, txn) => sum + txn.amount,
    0
  );

  const atRiskTransactions = transactions.filter(
    (txn) =>
      txn.status === "failed" ||
      txn.status === "abandoned"
  );

  const revenueAtRisk = atRiskTransactions.reduce(
    (sum, txn) => sum + txn.amount,
    0
  );

  const recoveredRevenue = auditLogs.reduce(
    (sum, log) =>
      sum + (log.recoveredAmount || 0),
    0
  );

  const successfulRecoveries =
    auditLogs.filter(
      (log) => log.result === "recovered"
    ).length;

  const failedRecoveries =
    auditLogs.filter(
      (log) => log.result === "failed"
    ).length;

  const blockedRecoveries =
    auditLogs.filter(
      (log) => log.result === "blocked"
    ).length;

  const attemptedRecoveries =
    successfulRecoveries +
    failedRecoveries +
    blockedRecoveries;

  const recoveryRate =
    attemptedRecoveries > 0
      ? Number(
          (
            (
              successfulRecoveries /
              attemptedRecoveries
            ) * 100
          ).toFixed(1)
        )
      : 0;

  const originalAtRiskRevenue =
    revenueAtRisk + recoveredRevenue;

  const moneyRecoveryRate =
    originalAtRiskRevenue > 0
      ? Number(
          (
            (
              recoveredRevenue /
              originalAtRiskRevenue
            ) * 100
          ).toFixed(1)
        )
      : 0;

  const batchSize =
    transactions.length;

  const recoveryCandidates =
    transactions.filter(
      (txn) =>
        (
          txn.status === "failed" ||
          txn.status === "abandoned" ||
          txn.recovered
        )
    ).length;

  res.json({
    success: true,
    batchSize,
    recoveryCandidates,
    totalRevenue,
    revenueAtRisk,
    recoveredRevenue,
    successfulRecoveries,
    failedRecoveries,
    blockedRecoveries,
    attemptedRecoveries,
    recoveryRate,
    moneyRecoveryRate
  });
});


/* =========================================================
   HUMAN REVIEW
========================================================= */

router.post(
  "/review/:transactionId",
  (req, res) => {
    const { transactionId } = req.params;
    const { decision } = req.body;

    const txn = transactions.find(
      (item) =>
        item.id === transactionId
    );

    if (!txn) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found"
      });
    }

    const log = [...auditLogs]
      .reverse()
      .find(
        (item) =>
          item.transactionId ===
            transactionId &&
          item.result === "blocked"
      );

    if (!log) {
      return res.status(404).json({
        success: false,
        message:
          "No blocked recovery found for this transaction"
      });
    }

    if (
      !["approve", "reject"].includes(
        decision
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Decision must be approve or reject"
      });
    }

    if (decision === "approve") {
      log.result = "approved";
      log.reviewDecision = "approved";
      log.reviewedAt =
        new Date().toISOString();

      return res.json({
        success: true,
        message:
          "Recovery approved for manual execution",
        transactionId
      });
    }

    log.result = "rejected";
    log.reviewDecision = "rejected";
    log.reviewedAt =
      new Date().toISOString();

    return res.json({
      success: true,
      message: "Recovery rejected",
      transactionId
    });
  }
);


/* =========================================================
   CREATE RAZORPAY RECOVERY LINK
========================================================= */

router.post(
  "/razorpay/recovery-link/:transactionId",
  async (req, res) => {
    try {
      const { transactionId } =
        req.params;

      const txn = transactions.find(
        (item) =>
          item.id === transactionId
      );

      if (!txn) {
        return res.status(404).json({
          success: false,
          message: "Transaction not found"
        });
      }

      if (txn.type !== "subscription") {
        return res.status(403).json({
          success: false,
          message:
            "Only failed subscriptions are eligible for payment-link recovery"
        });
      }

      if (txn.status !== "failed") {
        return res.status(400).json({
          success: false,
          message:
            "Transaction is not currently failed"
        });
      }

      if (txn.recovered) {
        return res.status(400).json({
          success: false,
          message:
            "Transaction already recovered"
        });
      }

      const existingLink =
        [...auditLogs]
          .reverse()
          .find(
            (log) =>
              log.transactionId ===
                transactionId &&
              log.razorpayPaymentLinkId
          );

      if (existingLink) {
        return res.json({
          success: true,
          transactionId: txn.id,
          reused: true,
          paymentLink: {
            id:
              existingLink
                .razorpayPaymentLinkId,
            shortUrl:
              existingLink
                .razorpayPaymentLinkUrl,
            status:
              existingLink
                .razorpayPaymentLinkStatus ||
              "created",
            amount:
              txn.amount * 100
          }
        });
      }

      const paymentLink =
        await createRecoveryPaymentLink(
          txn
        );

      auditLogs.push({
        transactionId: txn.id,
        customer: txn.customer,
        amount: txn.amount,

        action:
          "create_razorpay_payment_link",

        result:
          "link_created",

        recoveredAmount: 0,

        razorpayPaymentLinkId:
          paymentLink.id,

        razorpayPaymentLinkUrl:
          paymentLink.shortUrl,

        razorpayPaymentLinkStatus:
          paymentLink.status,

        explanation:
          "Razorpay Test Mode recovery payment link created.",

        timestamp:
          new Date().toISOString()
      });

      res.json({
        success: true,
        transactionId: txn.id,
        paymentLink
      });

    } catch (error) {
      console.error(
        "Razorpay payment link error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to create Razorpay payment link",
        error:
          error?.error?.description ||
          error.message
      });
    }
  }
);


/* =========================================================
   VERIFY RAZORPAY PAYMENT
========================================================= */

router.post(
  "/razorpay/verify-payment/:transactionId",
  async (req, res) => {
    try {
      const { transactionId } =
        req.params;

      const txn = transactions.find(
        (item) =>
          item.id === transactionId
      );

      if (!txn) {
        return res.status(404).json({
          success: false,
          message: "Transaction not found"
        });
      }

      const paymentLinkLog =
        [...auditLogs]
          .reverse()
          .find(
            (log) =>
              log.transactionId ===
                transactionId &&
              log.razorpayPaymentLinkId
          );

      if (!paymentLinkLog) {
        return res.status(404).json({
          success: false,
          message:
            "No Razorpay payment link found for this transaction"
        });
      }

      // Idempotency protection:
      // do not count the same recovered payment twice.
      if (txn.recovered) {
        return res.json({
          success: true,
          recovered: true,
          alreadyVerified: true,
          transactionId: txn.id,
          recoveredAmount: txn.amount,
          paymentStatus: "paid",
          message:
            "Transaction has already been verified and recovered"
        });
      }

      const paymentStatus =
        await getPaymentLinkStatus(
          paymentLinkLog
            .razorpayPaymentLinkId
        );

      if (
        paymentStatus.status === "paid"
      ) {
        txn.status = "success";
        txn.recovered = true;
        txn.processed = true;

        auditLogs.push({
          transactionId:
            txn.id,
          customer:
            txn.customer,
          amount:
            txn.amount,

          action:
            "verify_razorpay_payment",

          result:
            "recovered",

          recoveredAmount:
            txn.amount,

          razorpayPaymentLinkId:
            paymentStatus.id,

          razorpayPaymentLinkStatus:
            paymentStatus.status,

          explanation:
            "Razorpay confirmed that the recovery payment was successfully completed.",

          timestamp:
            new Date().toISOString()
        });

        return res.json({
          success: true,
          recovered: true,
          alreadyVerified: false,
          transactionId:
            txn.id,
          recoveredAmount:
            txn.amount,
          paymentStatus:
            paymentStatus.status
        });
      }

      auditLogs.push({
        transactionId:
          txn.id,
        customer:
          txn.customer,
        amount:
          txn.amount,

        action:
          "verify_razorpay_payment",

        result:
          "pending",

        recoveredAmount: 0,

        razorpayPaymentLinkId:
          paymentStatus.id,

        razorpayPaymentLinkStatus:
          paymentStatus.status,

        explanation:
          `Razorpay payment is currently ${paymentStatus.status}. No revenue has been counted as recovered.`,

        timestamp:
          new Date().toISOString()
      });

      return res.json({
        success: true,
        recovered: false,
        alreadyVerified: false,
        transactionId:
          txn.id,
        recoveredAmount: 0,
        paymentStatus:
          paymentStatus.status
      });

    } catch (error) {
      console.error(
        "Razorpay verification error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to verify Razorpay payment",
        error:
          error?.error?.description ||
          error.message
      });
    }
  }
);


module.exports = router;