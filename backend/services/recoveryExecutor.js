const auditLogs = require("../data/auditLogs");

function executeRecovery(txn, decision) {
  const timestamp = new Date().toISOString();

  // Prevent the same transaction being processed twice
  if (txn.processed) {
    return null;
  }

  txn.processed = true;

  if (!decision.autoExecute) {
    const log = {
      transactionId: txn.id,
      customer: txn.customer,
      amount: txn.amount,
      action: decision.action,
      confidence: decision.confidence,
      explanation: decision.explanation,
      result: "blocked",
      recoveredAmount: 0,
      reason: "Human approval required",
      timestamp
    };

    auditLogs.push(log);
    return log;
  }

  let result = "failed";
  let recoveredAmount = 0;

  /*
    Deterministic simulated outcomes.

    Temporary bank failures recover successfully.

    Abandoned checkout recovery succeeds for
    selected transactions.

    Subscription payment links intentionally fail
    in this prototype to demonstrate graceful failure.
  */

  if (
    txn.type === "payment" &&
    txn.reason === "bank_timeout"
  ) {
    result = "recovered";
    recoveredAmount = txn.amount;
  }

  else if (
    txn.type === "checkout" &&
    txn.status === "abandoned"
  ) {
    const transactionNumber = Number(
      txn.id.replace("TXN", "")
    );

    if (transactionNumber % 2 === 0) {
      result = "recovered";
      recoveredAmount = txn.amount;
    }
  }

  else if (
    txn.type === "subscription" &&
    txn.reason === "insufficient_funds"
  ) {
    result = "failed";
    recoveredAmount = 0;
  }

  if (result === "recovered") {
    txn.status = "success";
    txn.recovered = true;
  }

  const log = {
    transactionId: txn.id,
    customer: txn.customer,
    amount: txn.amount,
    action: decision.action,
    confidence: decision.confidence,
    explanation: decision.explanation,
    result,
    recoveredAmount,
    timestamp
  };

  auditLogs.push(log);

  return log;
}

module.exports = {
  executeRecovery
};