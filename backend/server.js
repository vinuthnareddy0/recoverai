const express =
  require("express");

const cors =
  require("cors");

require("dotenv").config();

const transactionRoutes =
  require(
    "./routes/transactionRoutes"
  );

const webhookRoutes =
  require(
    "./routes/webhookRoutes"
  );

const demoRoutes =
  require(
    "./routes/demoRoutes"
  );

const app =
  express();

/* =========================================================
   RAZORPAY WEBHOOK

   MUST remain before express.json()
   because signature verification requires
   Razorpay's original raw request body.
========================================================= */

app.use(
  "/api/webhooks",
  webhookRoutes
);

/* =========================================================
   NORMAL MIDDLEWARE
========================================================= */

app.use(
  cors()
);

app.use(
  express.json()
);

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get(
  "/",
  (req, res) => {
    res.json({
      success: true,

      message:
        "RecoverAI backend is running"
    });
  }
);

/* =========================================================
   TRANSACTIONS
========================================================= */

app.use(
  "/api/transactions",
  transactionRoutes
);

/* =========================================================
   DEMO CONTROL
========================================================= */

app.use(
  "/api/demo",
  demoRoutes
);

/* =========================================================
   START SERVER
========================================================= */

const PORT =
  process.env.PORT ||
  5000;

app.listen(
  PORT,
  () => {
    console.log(
      `RecoverAI server running on http://localhost:${PORT}`
    );

    console.log(
      "Razorpay webhook endpoint: /api/webhooks/razorpay"
    );

    console.log(
      "Demo reset endpoint: /api/demo/reset"
    );

    console.log(
      "Activity endpoint: /api/demo/activity"
    );
  }
);