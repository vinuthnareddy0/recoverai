const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

/*
  CREATE RAZORPAY RECOVERY PAYMENT LINK
*/
async function createRecoveryPaymentLink(txn) {
  try {
    if (!txn) {
      throw new Error("Transaction is required");
    }

    if (!txn.id) {
      throw new Error("Transaction ID is missing");
    }

    if (!txn.amount || txn.amount <= 0) {
      throw new Error("Invalid transaction amount");
    }

    const paymentLink = await razorpay.paymentLink.create({
      amount: Math.round(txn.amount * 100),
      currency: "INR",

      reference_id: `RECOVER_${txn.id}_${Date.now()}`,

      description: `RecoverAI recovery payment for ${txn.id}`,

      notes: {
        transactionId: txn.id,
        customer: txn.customer || "Unknown",
        recoveryReason: txn.reason || "unknown",
        source: "RecoverAI"
      }
    });

    console.log(
      `Razorpay recovery link created for ${txn.id}: ${paymentLink.id}`
    );

    return {
      id: paymentLink.id,
      shortUrl: paymentLink.short_url,
      status: paymentLink.status,
      amount: paymentLink.amount,
      amountPaid: paymentLink.amount_paid || 0
    };
  } catch (error) {
    console.error(
      "Razorpay payment link creation failed:",
      error?.error?.description ||
        error?.message ||
        error
    );

    throw error;
  }
}

/*
  CHECK RAZORPAY PAYMENT LINK STATUS
*/
async function getPaymentLinkStatus(paymentLinkId) {
  try {
    if (!paymentLinkId) {
      throw new Error(
        "Cannot verify payment: Razorpay payment link ID is missing"
      );
    }

    console.log(
      `Checking Razorpay payment link: ${paymentLinkId}`
    );

    const paymentLink =
      await razorpay.paymentLink.fetch(paymentLinkId);

    if (!paymentLink) {
      throw new Error(
        `Razorpay returned no payment link for ${paymentLinkId}`
      );
    }

    console.log(
      `Razorpay payment link ${paymentLink.id} status: ${paymentLink.status}`
    );

    return {
      id: paymentLink.id,
      status: paymentLink.status,
      amount: paymentLink.amount || 0,
      amountPaid: paymentLink.amount_paid || 0,
      payments: paymentLink.payments || []
    };
  } catch (error) {
    console.error(
      `Failed to verify Razorpay payment link ${paymentLinkId}:`,
      error?.error?.description ||
        error?.description ||
        error?.message ||
        error
    );

    throw error;
  }
}

module.exports = {
  createRecoveryPaymentLink,
  getPaymentLinkStatus
};