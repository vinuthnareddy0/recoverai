const customers = [
  "Arjun",
  "Meera",
  "Rahul",
  "Sneha",
  "Karan",
  "Aditi",
  "Vikram",
  "Priya",
  "Rohan",
  "Neha"
];

const scenarios = [
  {
    type: "payment",
    status: "failed",
    reason: "bank_timeout",
    retryCount: 0
  },
  {
    type: "checkout",
    status: "abandoned",
    reason: "checkout_exit",
    retryCount: 0
  },
  {
    type: "subscription",
    status: "failed",
    reason: "insufficient_funds",
    retryCount: 1
  },
  {
    type: "payment",
    status: "failed",
    reason: "network_error",
    retryCount: 2
  },
  {
    type: "payment",
    status: "success",
    reason: null,
    retryCount: 0
  }
];

/* =========================================================
   CREATE ORIGINAL SYNTHETIC DATASET
========================================================= */

function createInitialTransactions() {
  const batch = [];

  for (let i = 1; i <= 60; i++) {
    const scenario =
      scenarios[
        (i - 1) % scenarios.length
      ];

    batch.push({
      id: `TXN${String(i).padStart(
        3,
        "0"
      )}`,

      customer:
        customers[
          (i - 1) %
            customers.length
        ],

      // Deterministic range:
      // ₹500 – ₹17,999
      amount:
        500 +
        ((i * 1379) % 17500),

      type:
        scenario.type,

      status:
        scenario.status,

      reason:
        scenario.reason,

      retryCount:
        scenario.retryCount,

      recovered: false,
      processed: false
    });
  }

  return batch;
}

/* =========================================================
   SHARED TRANSACTION ARRAY
========================================================= */

const transactions =
  createInitialTransactions();

/* =========================================================
   RESET TRANSACTIONS

   IMPORTANT:
   We mutate the existing array instead of assigning
   a new array. This means every route/service that already
   imported transactions keeps the same reference.
========================================================= */

function resetTransactions() {
  const freshTransactions =
    createInitialTransactions();

  transactions.splice(
    0,
    transactions.length,
    ...freshTransactions
  );

  return transactions;
}

module.exports =
  transactions;

module.exports.resetTransactions =
  resetTransactions;

module.exports.createInitialTransactions =
  createInitialTransactions;