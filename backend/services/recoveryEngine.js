function analyzeTransaction(txn) {
  let action = "review";
  let confidence = 0.5;
  let explanation = "Manual review required.";
  let autoExecute = false;

  if (txn.type === "payment" && txn.reason === "bank_timeout") {
    action = "retry";
    confidence = 0.94;
    explanation =
      "Temporary bank timeout detected. Retry is likely to succeed.";
    autoExecute = true;
  }

  else if (txn.type === "checkout" && txn.status === "abandoned") {
    action = "send_recovery_message";
    confidence = 0.88;
    explanation =
      "Checkout was abandoned. Send a personalized recovery reminder.";
    autoExecute = true;
  }

  else if (
    txn.type === "subscription" &&
    txn.reason === "insufficient_funds"
  ) {
    action = "send_payment_link";
    confidence = 0.82;
    explanation =
      "Subscription payment failed due to insufficient funds. Send a secure payment link instead of immediately retrying.";
    autoExecute = true;
  }

  else if (
    txn.retryCount >= 2 ||
    txn.amount >= 15000
  ) {
    action = "escalate";
    confidence = 0.91;
    explanation =
      "High-value transaction or retry limit reached. Human approval required.";
    autoExecute = false;
  }

  return {
    transactionId: txn.id,
    customer: txn.customer,
    amount: txn.amount,
    action,
    confidence,
    explanation,
    autoExecute
  };
}

module.exports = {
  analyzeTransaction
};