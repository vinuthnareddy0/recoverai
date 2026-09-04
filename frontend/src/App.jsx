import { useEffect, useRef, useState } from "react";
import axios from "axios";
import "./App.css";

const API = "http://localhost:5000/api/transactions";
const DEMO_API = "http://localhost:5000/api/demo";

function App() {
  const [metrics, setMetrics] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState(null);
  const [creatingLink, setCreatingLink] = useState(null);
  const [paymentStates, setPaymentStates] = useState({});

  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [activity, setActivity] = useState([]);
  const [resetting, setResetting] = useState(false);
  const [activityLoading, setActivityLoading] = useState(true);

  const pollingTimers = useRef({});

  /* =========================================================
     GROUP AUDIT LOGS BY TRANSACTION
  ========================================================= */

  const groupLogsByTransaction = (auditLogs) => {
    const grouped = {};

    for (const log of auditLogs) {
      if (!grouped[log.transactionId]) {
        grouped[log.transactionId] = [];
      }

      grouped[log.transactionId].push(log);
    }

    return Object.entries(grouped).map(
      ([transactionId, transactionLogs]) => {
        const latestLog =
          transactionLogs[transactionLogs.length - 1];

        const originalDecision =
          transactionLogs.find(
            (log) =>
              log.action === "retry" ||
              log.action === "send_recovery_message" ||
              log.action === "send_payment_link" ||
              log.action === "escalate"
          ) || transactionLogs[0];

        const linkLog = [...transactionLogs]
          .reverse()
          .find(
            (log) =>
              log.razorpayPaymentLinkId &&
              log.razorpayPaymentLinkUrl
          );

        const recoveredLog = [...transactionLogs]
          .reverse()
          .find(
            (log) =>
              log.result === "recovered"
          );

        const blockedLog = [...transactionLogs]
          .reverse()
          .find(
            (log) =>
              log.result === "blocked"
          );

        const approvedLog = [...transactionLogs]
          .reverse()
          .find(
            (log) =>
              log.result === "approved"
          );

        const rejectedLog = [...transactionLogs]
          .reverse()
          .find(
            (log) =>
              log.result === "rejected"
          );

        const failedWebhookLog = [...transactionLogs]
          .reverse()
          .find(
            (log) =>
              log.action === "razorpay_webhook" &&
              log.result === "failed"
          );

        let finalStatus =
          originalDecision?.result || "unknown";

        if (recoveredLog) {
          finalStatus = "recovered";
        } else if (approvedLog) {
          finalStatus = "approved";
        } else if (rejectedLog) {
          finalStatus = "rejected";
        } else if (failedWebhookLog) {
          finalStatus = "failed";
        } else if (linkLog) {
          finalStatus = "payment_pending";
        } else if (blockedLog) {
          finalStatus = "blocked";
        }

        return {
          transactionId,
          logs: transactionLogs,
          originalDecision,
          latestLog,
          linkLog,
          recoveredLog,
          blockedLog,
          approvedLog,
          rejectedLog,
          failedWebhookLog,
          finalStatus
        };
      }
    );
  };



  /* =========================================================
     RECOVERY TIMELINE HELPERS
  ========================================================= */

  const formatTimelineTime = (timestamp) => {
    if (!timestamp) {
      return "";
    }

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const buildRecoveryTimeline = (
    transaction,
    state,
    recoveredAmount
  ) => {
    const timeline = [];

    const decision =
      transaction.originalDecision;

    const action =
      decision?.action || "";

    const actionLabel =
      action.replaceAll("_", " ");

    timeline.push({
      key: "decision",
      title: "AI decision",
      description:
        actionLabel
          ? `RecoverAI selected ${actionLabel}.`
          : "RecoverAI evaluated the transaction and selected a recovery path.",
      time: formatTimelineTime(
        decision?.timestamp
      ),
      status: "complete"
    });

    /*
      Show the execution step that actually happened.
      This keeps non-Razorpay recoveries accurate.
    */

    if (
      action === "retry" &&
      state.recovered
    ) {
      timeline.push({
        key: "retry-executed",
        title: "Retry executed",
        description:
          "RecoverAI executed the bounded retry after identifying a temporary payment failure.",
        time: formatTimelineTime(
          transaction.recoveredLog?.timestamp ||
            decision?.timestamp
        ),
        status: "complete"
      });
    }

    if (
      action === "send_recovery_message" &&
      state.recovered
    ) {
      timeline.push({
        key: "message-sent",
        title: "Recovery message sent",
        description:
          "RecoverAI executed the approved checkout-recovery intervention for the customer.",
        time: formatTimelineTime(
          transaction.recoveredLog?.timestamp ||
            decision?.timestamp
        ),
        status: "complete"
      });
    }

    if (
      transaction.blockedLog &&
      !transaction.approvedLog &&
      !transaction.rejectedLog
    ) {
      timeline.push({
        key: "review",
        title: "Human review required",
        description:
          "The action crossed the automatic execution boundary and was held for approval.",
        time: formatTimelineTime(
          transaction.blockedLog?.timestamp
        ),
        status: "current"
      });
    }

    if (transaction.approvedLog) {
      timeline.push({
        key: "approved",
        title: "Human approved",
        description:
          "The recovery action was approved for controlled execution.",
        time: formatTimelineTime(
          transaction.approvedLog?.reviewedAt ||
            transaction.approvedLog?.timestamp
        ),
        status: "complete"
      });
    }

    if (transaction.rejectedLog) {
      timeline.push({
        key: "rejected",
        title: "Human rejected",
        description:
          "The recovery action was stopped by human review.",
        time: formatTimelineTime(
          transaction.rejectedLog?.reviewedAt ||
            transaction.rejectedLog?.timestamp
        ),
        status: "failed"
      });
    }

    if (transaction.linkLog) {
      timeline.push({
        key: "link",
        title: "Razorpay link created",
        description:
          "A bounded Razorpay Test Mode recovery payment link was created for this transaction.",
        time: formatTimelineTime(
          transaction.linkLog?.timestamp
        ),
        status: "complete"
      });
    }

    if (
      transaction.linkLog &&
      !state.recovered &&
      !state.paymentFailed
    ) {
      timeline.push({
        key: "waiting",
        title: "Waiting for payment",
        description:
          "RecoverAI is monitoring Razorpay for a confirmed payment result.",
        time: "Live",
        status: "current"
      });
    }

    if (state.paymentFailed) {
      timeline.push({
        key: "failed",
        title:
          transaction.linkLog
            ? "Recovery payment failed"
            : "Recovery attempt failed",
        description:
          transaction.failedWebhookLog?.explanation ||
          (
            transaction.linkLog
              ? "Razorpay reported that the recovery payment could not be completed."
              : "The selected recovery intervention did not recover the transaction."
          ),
        time: formatTimelineTime(
          transaction.failedWebhookLog?.timestamp ||
            transaction.latestLog?.timestamp
        ),
        status: "failed"
      });
    }

    if (state.recovered) {
      const razorpayRecovery =
        Boolean(transaction.linkLog) ||
        transaction.recoveredLog?.action ===
          "verify_razorpay_payment" ||
        transaction.recoveredLog?.action ===
          "razorpay_webhook";

      let recoveryDescription =
        `₹${(
          recoveredAmount || 0
        ).toLocaleString()} was recovered.`;

      if (razorpayRecovery) {
        recoveryDescription =
          `Razorpay confirmed the recovery payment. ₹${(
            recoveredAmount || 0
          ).toLocaleString()} was recovered.`;
      } else if (action === "retry") {
        recoveryDescription =
          `The controlled retry succeeded. ₹${(
            recoveredAmount || 0
          ).toLocaleString()} was recovered.`;
      } else if (
        action === "send_recovery_message"
      ) {
        recoveryDescription =
          `The checkout-recovery intervention succeeded. ₹${(
            recoveredAmount || 0
          ).toLocaleString()} was recovered.`;
      }

      timeline.push({
        key: "recovered",
        title: "Revenue recovered",
        description:
          recoveryDescription,
        time: formatTimelineTime(
          transaction.recoveredLog?.timestamp
        ),
        status: "success"
      });
    }

    return timeline;
  };

  /* =========================================================
     STOP POLLING
  ========================================================= */

  const stopPolling = (transactionId) => {
    const timer =
      pollingTimers.current[transactionId];

    if (timer) {
      clearInterval(timer);

      delete pollingTimers.current[
        transactionId
      ];
    }
  };

  /* =========================================================
     CHECK PAYMENT STATUS
  ========================================================= */

  const checkPaymentStatus = async (
    transactionId
  ) => {
    try {
      const response = await axios.post(
        `${API}/razorpay/verify-payment/${transactionId}`
      );

      const data = response.data;

      if (data.recovered) {
        setPaymentStates(
          (previous) => ({
            ...previous,

            [transactionId]: {
              status: "success",
              recoveredAmount:
                data.recoveredAmount || 0
            }
          })
        );

        stopPolling(transactionId);

        await fetchData(false);

        return;
      }

      if (
        data.paymentStatus === "expired" ||
        data.paymentStatus === "cancelled"
      ) {
        setPaymentStates(
          (previous) => ({
            ...previous,

            [transactionId]: {
              status: "failed",
              recoveredAmount: 0
            }
          })
        );

        stopPolling(transactionId);

        await fetchData(false);

        return;
      }

      setPaymentStates(
        (previous) => ({
          ...previous,

          [transactionId]: {
            status: "pending",
            recoveredAmount: 0
          }
        })
      );
    } catch (error) {
      console.error(
        `Payment status check failed for ${transactionId}:`,
        error
      );
    }
  };

  /* =========================================================
     START PAYMENT POLLING
  ========================================================= */

  const startPaymentPolling = (
    transactionId
  ) => {
    if (
      pollingTimers.current[
        transactionId
      ]
    ) {
      return;
    }

    setPaymentStates(
      (previous) => ({
        ...previous,

        [transactionId]: {
          status:
            previous[
              transactionId
            ]?.status || "pending",

          recoveredAmount:
            previous[
              transactionId
            ]?.recoveredAmount || 0
        }
      })
    );

    checkPaymentStatus(
      transactionId
    );

    pollingTimers.current[
      transactionId
    ] = setInterval(() => {
      checkPaymentStatus(
        transactionId
      );
    }, 5000);
  };

  /* =========================================================
     RESTORE PAYMENT STATE AFTER REFRESH
  ========================================================= */

  const restorePaymentState = (
    auditLogs
  ) => {
    const grouped =
      groupLogsByTransaction(
        auditLogs
      );

    const restored = {};

    for (const transaction of grouped) {
      const {
        transactionId,
        recoveredLog,
        linkLog,
        failedWebhookLog
      } = transaction;

      if (recoveredLog) {
        restored[
          transactionId
        ] = {
          status: "success",

          recoveredAmount:
            recoveredLog
              .recoveredAmount || 0
        };

        stopPolling(
          transactionId
        );

        continue;
      }

      if (failedWebhookLog) {
        restored[
          transactionId
        ] = {
          status: "failed",
          recoveredAmount: 0
        };

        stopPolling(
          transactionId
        );

        continue;
      }

      if (linkLog) {
        restored[
          transactionId
        ] = {
          status: "pending",
          recoveredAmount: 0
        };
      }
    }

    setPaymentStates(
      (previous) => ({
        ...previous,
        ...restored
      })
    );

    for (const transaction of grouped) {
      const {
        transactionId,
        recoveredLog,
        linkLog,
        failedWebhookLog
      } = transaction;

      if (
        linkLog &&
        !recoveredLog &&
        !failedWebhookLog
      ) {
        startPaymentPolling(
          transactionId
        );
      }
    }
  };

  /* =========================================================
     FETCH DASHBOARD DATA
  ========================================================= */

  const fetchData = async (
    restorePayments = true
  ) => {
    try {
      const [
        metricsResponse,
        logsResponse
      ] = await Promise.all([
        axios.get(
          `${API}/metrics`
        ),

        axios.get(
          `${API}/audit-logs`
        )
      ]);

      const auditLogs =
        logsResponse.data.logs || [];

      setMetrics(
        metricsResponse.data
      );

      setLogs(
        auditLogs
      );

      if (restorePayments) {
        restorePaymentState(
          auditLogs
        );
      }
    } catch (error) {
      console.error(
        "Dashboard fetch failed:",
        error
      );
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     RUN RECOVERY AGENT
  ========================================================= */

  const runRecoveryAgent = async () => {
    try {
      setRunning(true);

      const response =
        await axios.post(
          `${API}/execute-recovery`
        );

      setLastRun(
        response.data
      );

      await Promise.all([fetchData(), fetchActivity()]);
    } catch (error) {
      console.error(
        "Recovery agent failed:",
        error
      );

      alert(
        error?.response?.data?.message ||
          "Recovery agent failed."
      );
    } finally {
      setRunning(false);
    }
  };

  /* =========================================================
     HUMAN REVIEW
  ========================================================= */

  const reviewTransaction = async (
    transactionId,
    decision
  ) => {
    try {
      await axios.post(
        `${API}/review/${transactionId}`,
        {
          decision
        }
      );

      await Promise.all([fetchData(), fetchActivity()]);
    } catch (error) {
      console.error(
        "Review failed:",
        error
      );

      alert(
        error?.response?.data?.message ||
          "Review failed."
      );
    }
  };

  /* =========================================================
     CREATE RAZORPAY LINK
  ========================================================= */

  const createRazorpayLink = async (
    transactionId
  ) => {
    try {
      setCreatingLink(
        transactionId
      );

      const response =
        await axios.post(
          `${API}/razorpay/recovery-link/${transactionId}`
        );

      const paymentUrl =
        response.data
          ?.paymentLink
          ?.shortUrl;

      if (!paymentUrl) {
        throw new Error(
          "Payment URL not received."
        );
      }

      setPaymentStates(
        (previous) => ({
          ...previous,

          [transactionId]: {
            status: "pending",
            recoveredAmount: 0
          }
        })
      );

      await fetchData(false);

      window.open(
        paymentUrl,
        "_blank",
        "noopener,noreferrer"
      );

      startPaymentPolling(
        transactionId
      );
    } catch (error) {
      console.error(
        "Razorpay recovery failed:",
        error
      );

      alert(
        error?.response?.data?.message ||
          error.message ||
          "Failed to create Razorpay recovery link."
      );
    } finally {
      setCreatingLink(null);
    }
  };

  /* =========================================================
     OPEN EXISTING PAYMENT
  ========================================================= */

  const openExistingPayment = (
    transactionId,
    url
  ) => {
    if (!url) {
      return;
    }

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );

    startPaymentPolling(
      transactionId
    );
  };

  /* =========================================================
     LIVE ACTIVITY
  ========================================================= */

  const fetchActivity = async () => {
    try {
      const response = await axios.get(
        `${DEMO_API}/activity?limit=12`
      );

      setActivity(
        response.data.activity || []
      );
    } catch (error) {
      console.error(
        "Activity feed fetch failed:",
        error
      );
    } finally {
      setActivityLoading(false);
    }
  };

  const formatActivityTime = (timestamp) => {
    if (!timestamp) {
      return "—";
    }

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  /* =========================================================
     RESET DEMO
  ========================================================= */

  const resetDemo = async () => {
    const confirmed = window.confirm(
      "Reset RecoverAI? This will restore the original 60 demo transactions and clear the RecoverAI audit trail."
    );

    if (!confirmed) {
      return;
    }

    try {
      setResetting(true);

      Object.values(
        pollingTimers.current
      ).forEach((timer) => {
        clearInterval(timer);
      });

      pollingTimers.current = {};

      await axios.post(
        `${DEMO_API}/reset`
      );

      setPaymentStates({});
      setLastRun(null);
      setActiveFilter("all");
      setSearchQuery("");
      setSortBy("newest");

      await Promise.all([
        fetchData(false),
        fetchActivity()
      ]);
    } catch (error) {
      console.error(
        "Demo reset failed:",
        error
      );

      alert(
        error?.response?.data?.message ||
          "Failed to reset RecoverAI demo."
      );
    } finally {
      setResetting(false);
    }
  };

  /* =========================================================
     INITIAL LOAD
  ========================================================= */

  useEffect(() => {
    fetchData(true);
    fetchActivity();

    const activityTimer =
      setInterval(() => {
        fetchActivity();
      }, 4000);

    return () => {
      clearInterval(
        activityTimer
      );

      Object.values(
        pollingTimers.current
      ).forEach(
        (timer) => {
          clearInterval(timer);
        }
      );

      pollingTimers.current = {};
    };
  }, []);

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <div className="loading">
        Loading RecoverAI...
      </div>
    );
  }

  /* =========================================================
     BUILD TRANSACTION LIST
  ========================================================= */

  const groupedTransactions =
    groupLogsByTransaction(
      logs
    );

  /* =========================================================
     DETERMINE CURRENT STATUS
  ========================================================= */

  const getTransactionState = (
    transaction
  ) => {
    const payment =
      paymentStates[
        transaction.transactionId
      ];

    const recovered =
      Boolean(
        transaction.recoveredLog
      ) ||
      payment?.status ===
        "success";

    const paymentFailed =
      Boolean(
        transaction.failedWebhookLog
      ) ||
      payment?.status ===
        "failed";

    const humanReview =
      transaction.finalStatus ===
      "blocked";

    const pendingPayment =
      Boolean(
        transaction.linkLog
      ) &&
      !recovered &&
      !paymentFailed;

    const failed =
      paymentFailed ||
      (
        transaction.originalDecision
          ?.result === "failed" &&
        !transaction.linkLog &&
        !recovered
      );

    const atRisk =
      !recovered &&
      !humanReview &&
      (
        pendingPayment ||
        failed
      );

    return {
      recovered,
      paymentFailed,
      humanReview,
      pendingPayment,
      failed,
      atRisk
    };
  };

  /* =========================================================
     FILTER COUNTS
  ========================================================= */

  const filterCounts = {
    all:
      groupedTransactions.length,

    recovered:
      groupedTransactions.filter(
        (transaction) =>
          getTransactionState(
            transaction
          ).recovered
      ).length,

    atRisk:
      groupedTransactions.filter(
        (transaction) =>
          getTransactionState(
            transaction
          ).atRisk
      ).length,

    review:
      groupedTransactions.filter(
        (transaction) =>
          getTransactionState(
            transaction
          ).humanReview
      ).length,

    failed:
      groupedTransactions.filter(
        (transaction) =>
          getTransactionState(
            transaction
          ).failed
      ).length
  };

  /* =========================================================
     APPLY FILTER
  ========================================================= */

  const filteredTransactions =
    groupedTransactions.filter(
      (transaction) => {
        const state =
          getTransactionState(
            transaction
          );

        if (
          activeFilter ===
          "all"
        ) {
          return true;
        }

        if (
          activeFilter ===
          "recovered"
        ) {
          return state.recovered;
        }

        if (
          activeFilter ===
          "at-risk"
        ) {
          return state.atRisk;
        }

        if (
          activeFilter ===
          "review"
        ) {
          return state.humanReview;
        }

        if (
          activeFilter ===
          "failed"
        ) {
          return state.failed;
        }

        return true;
      }
    );

  /* =========================================================
     SEARCH + SORT
  ========================================================= */

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const searchedTransactions = filteredTransactions.filter(
    (transaction) => {
      if (!normalizedSearch) {
        return true;
      }

      const customer =
        transaction.originalDecision?.customer || "";

      const action =
        transaction.originalDecision?.action || "";

      const haystack = [
        transaction.transactionId,
        customer,
        action.replaceAll("_", " ")
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    }
  );

  const getTransactionTimestamp = (transaction) => {
    const timestamps = transaction.logs
      .map((log) => Date.parse(log.timestamp || ""))
      .filter((value) => Number.isFinite(value));

    return timestamps.length
      ? Math.max(...timestamps)
      : 0;
  };

  const displayedTransactions = [...searchedTransactions].sort(
    (a, b) => {
      if (sortBy === "oldest") {
        return (
          getTransactionTimestamp(a) -
          getTransactionTimestamp(b)
        );
      }

      if (sortBy === "amount-high") {
        return (
          (b.originalDecision?.amount || 0) -
          (a.originalDecision?.amount || 0)
        );
      }

      if (sortBy === "confidence-high") {
        return (
          (b.originalDecision?.confidence || 0) -
          (a.originalDecision?.confidence || 0)
        );
      }

      if (sortBy === "recovered-high") {
        const aState = paymentStates[a.transactionId];
        const bState = paymentStates[b.transactionId];

        const aRecovered =
          a.recoveredLog?.recoveredAmount ||
          aState?.recoveredAmount ||
          0;

        const bRecovered =
          b.recoveredLog?.recoveredAmount ||
          bState?.recoveredAmount ||
          0;

        return bRecovered - aRecovered;
      }

      return (
        getTransactionTimestamp(b) -
        getTransactionTimestamp(a)
      );
    }
  );

  return (
    <div className="app">

      {/* =====================================================
          HEADER
      ====================================================== */}

      <header className="topbar">

        <div>
          <h1>
            RecoverAI
          </h1>

          <p>
            Autonomous Revenue
            Recovery Agent
          </p>
        </div>

        <div className="header-actions">

          <div className="status-badge">
            ● AGENT ONLINE
          </div>

          <button
            className="reset-button"
            onClick={resetDemo}
            disabled={
              resetting || running
            }
          >
            {resetting
              ? "Resetting..."
              : "Reset Demo"}
          </button>

          <button
            className="run-button"
            onClick={
              runRecoveryAgent
            }
            disabled={
              running
            }
          >
            {running
              ? "Analyzing..."
              : "Run Recovery Agent"}
          </button>

        </div>

      </header>

      {/* =====================================================
          LAST RUN
      ====================================================== */}

      {lastRun && (
        <div className="run-result">

          <span>
            Recovery run completed
          </span>

          <strong>
            ₹
            {(
              lastRun.totalRecovered ||
              0
            ).toLocaleString()}{" "}
            recovered
          </strong>

          <span>
            {lastRun.processed || 0}{" "}
            transactions processed
          </span>

        </div>
      )}

      {/* =====================================================
          HERO
      ====================================================== */}

      <section className="hero">

        <div>

          <p className="eyebrow">
            REVENUE RECOVERY
            INTELLIGENCE
          </p>

          <h2>
            Recover revenue before
            it disappears.
          </h2>

          <p className="hero-text">
            RecoverAI detects
            revenue at risk,
            diagnoses the cause,
            chooses the safest
            action and tracks
            every decision.
          </p>

        </div>

      </section>

      {/* =====================================================
          METRICS
      ====================================================== */}

      <section className="metrics-grid">

        <div className="metric-card">

          <p>
            Total Revenue
          </p>

          <h3>
            ₹
            {(
              metrics?.totalRevenue ||
              0
            ).toLocaleString()}
          </h3>

        </div>

        <div className="metric-card risk">

          <p>
            Revenue Still At Risk
          </p>

          <h3>
            ₹
            {(
              metrics?.revenueAtRisk ||
              0
            ).toLocaleString()}
          </h3>

        </div>

        <div className="metric-card highlight">

          <p>
            Recovered Revenue
          </p>

          <h3>
            ₹
            {(
              metrics?.recoveredRevenue ||
              0
            ).toLocaleString()}
          </h3>

        </div>

        <div className="metric-card">

          <p>
            Money Recovery Rate
          </p>

          <h3>
            {metrics?.moneyRecoveryRate ||
              0}
            %
          </h3>

        </div>

        <div className="metric-card">

          <p>
            Successful Recoveries
          </p>

          <h3>
            {metrics?.successfulRecoveries ||
              0}
          </h3>

        </div>

        <div className="metric-card">

          <p>
            Failed Recoveries
          </p>

          <h3>
            {metrics?.failedRecoveries ||
              0}
          </h3>

        </div>

        <div className="metric-card">

          <p>
            Human Review Queue
          </p>

          <h3>
            {metrics?.blockedRecoveries ||
              0}
          </h3>

        </div>

        <div className="metric-card">

          <p>
            Action Success Rate
          </p>

          <h3>
            {metrics?.recoveryRate ||
              0}
            %
          </h3>

        </div>

      </section>

      {/* =====================================================
          RECOVERY SUMMARY
      ====================================================== */}

      <section className="recovery-summary">

        <div>
          <span>
            Batch Size
          </span>

          <strong>
            {metrics?.batchSize || 60}
          </strong>
        </div>

        <div>
          <span>
            Recovery Candidates
          </span>

          <strong>
            {metrics?.recoveryCandidates ||
              groupedTransactions.length}
          </strong>
        </div>

        <div>
          <span>
            Recovered
          </span>

          <strong>
            {filterCounts.recovered}
          </strong>
        </div>

        <div>
          <span>
            Human Review
          </span>

          <strong>
            {filterCounts.review}
          </strong>
        </div>

        <div>
          <span>
            Revenue Recovered
          </span>

          <strong>
            ₹
            {(
              metrics?.recoveredRevenue ||
              0
            ).toLocaleString()}
          </strong>
        </div>

      </section>

      {/* =====================================================
          LIVE RECOVERY ACTIVITY
      ====================================================== */}

      <section className="activity-section">
        <div className="activity-header">
          <div>
            <p className="eyebrow">
              LIVE RECOVERY ACTIVITY
            </p>

            <h2>
              Agent Activity
            </h2>
          </div>

          <span className="live-indicator">
            LIVE
          </span>
        </div>

        <div className="activity-list">
          {activityLoading && (
            <div className="activity-empty">
              Loading activity...
            </div>
          )}

          {!activityLoading &&
            activity.length === 0 && (
              <div className="activity-empty">
                No recovery activity yet. Run the recovery agent to begin.
              </div>
            )}

          {!activityLoading &&
            activity.map(
              (item, index) => (
                <div
                  className={`activity-item ${item.type || "info"}`}
                  key={`${item.transactionId || "activity"}-${item.timestamp || index}-${index}`}
                >
                  <span className="activity-time">
                    {formatActivityTime(
                      item.timestamp
                    )}
                  </span>

                  <span className="activity-txn">
                    {item.transactionId ||
                      "SYSTEM"}
                  </span>

                  <span className="activity-title">
                    {item.title}
                  </span>
                </div>
              )
            )}
        </div>
      </section>

      {/* =====================================================
          AUDIT TRAIL
      ====================================================== */}

      <section className="audit-section">

        <div className="section-header">

          <p className="eyebrow">
            RECOVERY QUEUE
          </p>

          <h2>
            Recovery Decisions
          </h2>

          <p className="section-description">
            Track every AI decision,
            payment intervention and
            human escalation.
          </p>

        </div>

        {/* FILTERS */}

        <div className="filter-bar">

          <button
            className={
              activeFilter === "all"
                ? "filter-button active"
                : "filter-button"
            }
            onClick={() =>
              setActiveFilter("all")
            }
          >
            All
            <span>
              {filterCounts.all}
            </span>
          </button>

          <button
            className={
              activeFilter === "at-risk"
                ? "filter-button active"
                : "filter-button"
            }
            onClick={() =>
              setActiveFilter("at-risk")
            }
          >
            At Risk
            <span>
              {filterCounts.atRisk}
            </span>
          </button>

          <button
            className={
              activeFilter === "recovered"
                ? "filter-button active"
                : "filter-button"
            }
            onClick={() =>
              setActiveFilter("recovered")
            }
          >
            Recovered
            <span>
              {filterCounts.recovered}
            </span>
          </button>

          <button
            className={
              activeFilter === "review"
                ? "filter-button active"
                : "filter-button"
            }
            onClick={() =>
              setActiveFilter("review")
            }
          >
            Human Review
            <span>
              {filterCounts.review}
            </span>
          </button>

          <button
            className={
              activeFilter === "failed"
                ? "filter-button active"
                : "filter-button"
            }
            onClick={() =>
              setActiveFilter("failed")
            }
          >
            Failed
            <span>
              {filterCounts.failed}
            </span>
          </button>

        </div>

        {/* SEARCH + SORT */}

        <div className="queue-toolbar">
          <input
            className="queue-search"
            type="text"
            value={searchQuery}
            onChange={(event) =>
              setSearchQuery(event.target.value)
            }
            placeholder="Search transaction, customer or action..."
          />

          <select
            className="queue-sort"
            value={sortBy}
            onChange={(event) =>
              setSortBy(event.target.value)
            }
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="amount-high">Highest amount</option>
            <option value="confidence-high">Highest confidence</option>
            <option value="recovered-high">Highest recovered</option>
          </select>

          <span className="queue-result-count">
            {displayedTransactions.length} shown
          </span>
        </div>

        {/* TRANSACTION CARDS */}

        <div className="audit-list">

          {displayedTransactions.length ===
            0 && (
            <div className="audit-card empty-state">

              <h3>
                No transactions found
              </h3>

              <p>
                There are currently no
                transactions matching this
                filter.
              </p>

            </div>
          )}

          {displayedTransactions.map(
            (transaction) => {
              const {
                transactionId,
                originalDecision,
                linkLog,
                recoveredLog,
                failedWebhookLog,
                finalStatus
              } = transaction;

              const state =
                getTransactionState(
                  transaction
                );

              const payment =
                paymentStates[
                  transactionId
                ];

              const recoveredAmount =
                recoveredLog
                  ?.recoveredAmount ||
                payment
                  ?.recoveredAmount ||
                0;

              const timeline =
                buildRecoveryTimeline(
                  transaction,
                  state,
                  recoveredAmount
                );

              return (
                <div
                  className="audit-card"
                  key={
                    transactionId
                  }
                >

                  {/* CARD HEADER */}

                  <div className="audit-top">

                    <div>

                      <h3>
                        {
                          transactionId
                        }
                      </h3>

                      <p>
                        {
                          originalDecision
                            ?.customer
                        }
                      </p>

                    </div>

                    <span
                      className={`result ${
                        state.recovered
                          ? "recovered"
                          : state.paymentFailed
                          ? "failed"
                          : finalStatus
                      }`}
                    >
                      {state.recovered
                        ? "RECOVERED"
                        : state.paymentFailed
                        ? "FAILED"
                        : finalStatus
                            ?.replaceAll(
                              "_",
                              " "
                            )
                            .toUpperCase()}
                    </span>

                  </div>

                  {/* DETAILS */}

                  <div className="audit-details">

                    <div>

                      <span>
                        Amount
                      </span>

                      <strong>
                        ₹
                        {(
                          originalDecision
                            ?.amount ||
                          0
                        ).toLocaleString()}
                      </strong>

                    </div>

                    <div>

                      <span>
                        Action
                      </span>

                      <strong>
                        {
                          originalDecision
                            ?.action
                            ?.replaceAll(
                              "_",
                              " "
                            )
                        }
                      </strong>

                    </div>

                    <div>

                      <span>
                        Confidence
                      </span>

                      <strong>
                        {originalDecision
                          ?.confidence !=
                        null
                          ? `${Math.round(
                              originalDecision
                                .confidence *
                                100
                            )}%`
                          : "—"}
                      </strong>

                    </div>

                    <div>

                      <span>
                        Recovered
                      </span>

                      <strong>
                        ₹
                        {recoveredAmount
                          .toLocaleString()}
                      </strong>

                    </div>

                  </div>

                  {/* EXPLANATION */}

                  <div className="explanation">
                    {
                      originalDecision
                        ?.explanation ||
                      originalDecision
                        ?.reason ||
                      "No explanation available."
                    }
                  </div>

                  {/* RECOVERY TIMELINE */}

                  <div className="recovery-timeline">
                    <div className="timeline-heading">
                      <span>RECOVERY TIMELINE</span>
                      <small>
                        {timeline.length} stage
                        {timeline.length === 1 ? "" : "s"}
                      </small>
                    </div>

                    <div className="timeline-list">
                      {timeline.map((step, stepIndex) => (
                        <div
                          className={`timeline-step ${step.status}`}
                          key={step.key}
                        >
                          <div className="timeline-rail">
                            <span className="timeline-dot">
                              {step.status === "success"
                                ? "✓"
                                : step.status === "failed"
                                ? "×"
                                : step.status === "current"
                                ? "•"
                                : "✓"}
                            </span>

                            {stepIndex < timeline.length - 1 && (
                              <span className="timeline-line" />
                            )}
                          </div>

                          <div className="timeline-content">
                            <div className="timeline-title-row">
                              <strong>{step.title}</strong>
                              {step.time && (
                                <time>{step.time}</time>
                              )}
                            </div>

                            <p>{step.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* PAYMENT SUCCESS */}

                  {state.recovered && (
                    <div className="razorpay-actions">

                      <button
                        className="payment-status-button payment-success"
                        disabled
                      >
                        ✓ PAYMENT SUCCESSFUL
                        — ₹
                        {recoveredAmount.toLocaleString()}{" "}
                        RECOVERED
                      </button>

                    </div>
                  )}

                  {/* PAYMENT FAILURE */}

                  {!state.recovered &&
                    state.paymentFailed && (
                    <div className="razorpay-actions">

                      <button
                        className="payment-status-button payment-failed"
                        disabled
                      >
                        ✕ PAYMENT FAILED
                      </button>

                    </div>
                  )}

                  {/* PAYMENT PENDING */}

                  {!state.recovered &&
                    !state.paymentFailed &&
                    linkLog && (
                    <div className="razorpay-actions">

                      <button
                        className="payment-status-button payment-pending"
                        disabled
                      >
                        ⏳ PAYMENT PENDING
                      </button>

                      <button
                        className="razorpay-button"
                        onClick={() =>
                          openExistingPayment(
                            transactionId,
                            linkLog
                              .razorpayPaymentLinkUrl
                          )
                        }
                      >
                        Open Payment
                      </button>

                    </div>
                  )}

                  {/* CREATE PAYMENT */}

                  {!state.recovered &&
                    !state.paymentFailed &&
                    !linkLog &&
                    originalDecision
                      ?.action ===
                      "send_payment_link" &&
                    originalDecision
                      ?.result ===
                      "failed" && (
                    <div className="razorpay-actions">

                      <button
                        className="razorpay-button"
                        onClick={() =>
                          createRazorpayLink(
                            transactionId
                          )
                        }
                        disabled={
                          creatingLink ===
                          transactionId
                        }
                      >
                        {creatingLink ===
                        transactionId
                          ? "Creating Payment..."
                          : "Recover with Razorpay"}
                      </button>

                    </div>
                  )}

                  {/* HUMAN REVIEW */}

                  {!state.recovered &&
                    !state.paymentFailed &&
                    finalStatus ===
                      "blocked" && (
                    <div className="review-actions">

                      <button
                        className="approve-button"
                        onClick={() =>
                          reviewTransaction(
                            transactionId,
                            "approve"
                          )
                        }
                      >
                        Approve
                      </button>

                      <button
                        className="reject-button"
                        onClick={() =>
                          reviewTransaction(
                            transactionId,
                            "reject"
                          )
                        }
                      >
                        Reject
                      </button>

                    </div>
                  )}

                </div>
              );
            }
          )}

        </div>

      </section>

    </div>
  );
}

export default App;