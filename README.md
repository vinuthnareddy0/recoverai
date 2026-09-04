\# RecoverAI



\*\*Autonomous Revenue Recovery Agent\*\*



RecoverAI is an autonomous revenue recovery platform that helps merchants recover money lost through failed payments, abandoned checkouts, and subscription payment failures.



It detects revenue at risk, diagnoses the reason for failure, selects an appropriate recovery action, verifies whether money was actually recovered, and escalates high-risk cases for human review.



\---



\## Problem



Merchants lose revenue every day because of failed payments, abandoned checkout sessions, subscription payment failures, temporary bank or network issues, insufficient funds, and repeated retry failures.



Most systems simply record these transactions as failures. RecoverAI turns them into a structured and auditable recovery workflow.



\---



\## Solution



RecoverAI analyzes each at-risk transaction and determines the most appropriate recovery action.



Depending on the transaction and failure reason, the system can:



\- Retry a failed payment

\- Send a recovery message

\- Generate a Razorpay payment link

\- Escalate the transaction for human review



The system then tracks the outcome and records every decision in an audit trail.



\---



\## Core Features



\- Revenue-at-risk detection

\- Failure diagnosis

\- Confidence-based recovery decisions

\- Automated recovery execution

\- Human review for high-risk cases

\- Razorpay Test Mode integration

\- Razorpay payment-link generation

\- Payment status verification

\- Recovery state persistence during runtime

\- Duplicate recovery protection

\- Live recovery activity feed

\- Search, filtering, and sorting

\- Transaction recovery timelines

\- Recovery metrics and analytics

\- Demo reset workflow

\- Complete audit logging



\---



\## How RecoverAI Works



```text

Transaction Failure

&#x20;       |

&#x20;       v

Detect Revenue At Risk

&#x20;       |

&#x20;       v

Diagnose Failure Reason

&#x20;       |

&#x20;       v

Choose Recovery Action

&#x20;       |

&#x20;       +--------------------+

&#x20;       |                    |

&#x20;       v                    v

Safe to Automate?       High-Risk Case?

&#x20;       |                    |

&#x20;      YES                  YES

&#x20;       |                    |

&#x20;       v                    v

Execute Recovery       Human Review

&#x20;       |                    |

&#x20;       |              Approve / Reject

&#x20;       v

Verify Result

&#x20;       |

&#x20;       v

Recovered / Failed

&#x20;       |

&#x20;       v

Update Metrics + Audit Trail

```



\---



\## Recovery Strategies



\### 1. Retry



Used for temporary failures such as bank timeouts where another payment attempt has a high probability of succeeding.



\### 2. Recovery Message



Used for abandoned checkouts where a reminder or recovery intervention may bring the customer back to complete the transaction.



\### 3. Razorpay Payment Link



Used for situations such as failed subscription payments where immediately retrying the original payment may not be appropriate.



RecoverAI generates a Razorpay Test Mode payment link and associates it with the affected transaction.



The payment can then be verified before the transaction is marked as recovered.



\### 4. Human Review



RecoverAI deliberately avoids automatically executing certain high-risk decisions.



Transactions that cross configured safety boundaries, such as high-value cases or retry-limit scenarios, are escalated to a human-review queue.



The operator can explicitly approve or reject the recovery action.



\---



\## Safety and Guardrails



RecoverAI is designed around bounded autonomy.



The system does not blindly execute every recovery decision.



Safety mechanisms include:



\- Confidence-based decision making

\- Retry limits

\- Human escalation

\- Explicit approval and rejection

\- Duplicate recovery protection

\- Payment verification before counting recovered revenue

\- Audit logging

\- Transaction-level recovery history



This allows automation to handle suitable recovery cases while keeping uncertain or risky decisions under human control.



\---



\## Razorpay Integration



RecoverAI integrates with Razorpay Test Mode to demonstrate real payment recovery.



The recovery process includes:



1\. Identifying an eligible failed transaction

2\. Creating a Razorpay payment link

3\. Associating the payment link with the RecoverAI transaction

4\. Monitoring the payment-link status

5\. Verifying successful payment

6\. Marking the transaction as recovered

7\. Updating recovered revenue

8\. Recording the recovery in the audit trail

9\. Preventing duplicate recovery counting



RecoverAI also implements a Razorpay webhook endpoint with HMAC-SHA256 signature verification.



During local development, payment-status verification is also used to reliably confirm Test Mode payments.



\---



\## Dashboard Metrics



RecoverAI provides a recovery intelligence dashboard containing metrics such as:



\- Total Revenue

\- Revenue Still At Risk

\- Recovered Revenue

\- Money Recovery Rate

\- Successful Recoveries

\- Failed Recoveries

\- Human Review Queue

\- Action Success Rate

\- Recovery Candidates

\- Processed Transactions



\---



\## Live Recovery Activity



The application includes a live recovery activity feed.



It displays events such as:



\- Revenue recovered

\- Recovery attempt failed

\- Transaction escalated

\- Human review decisions

\- Payment recovery events



This makes the agent's behavior visible rather than operating as a black box.



\---



\## Recovery Decisions



Every processed transaction includes information such as:



\- Transaction ID

\- Customer

\- Amount

\- Selected action

\- Confidence score

\- Recovery result

\- Recovered amount

\- Explanation

\- Recovery timeline



Users can also search, filter, and sort recovery decisions.



\---



\## Recovery Timeline



RecoverAI maintains a transaction-level timeline showing how a recovery case progressed.



Examples include:



```text

AI Decision

&#x20;   |

&#x20;   v

Recovery Action

&#x20;   |

&#x20;   v

Payment Verification

&#x20;   |

&#x20;   v

Revenue Recovered

```



For escalated transactions:



```text

AI Decision

&#x20;   |

&#x20;   v

Human Review Required

&#x20;   |

&#x20;   v

Approved / Rejected

```



This creates an auditable explanation of what the system did and why.



\---



\## Demo Dataset



The demo uses a deterministic set of 60 synthetic transactions.



The dataset contains multiple scenarios including:



\- Failed payments

\- Abandoned checkouts

\- Subscription failures

\- Bank timeouts

\- Network errors

\- Insufficient funds

\- Successful payments



This makes the demo reproducible rather than generating different transactions on every run.



\---



\## Demo Results



A typical complete demo run identifies 48 recovery candidates from the 60-transaction dataset.



Example result:



```text

Total Transactions: 60

Recovery Candidates: 48

Recovered Revenue: ₹144,016

Successful Recoveries: 18

Failed Recoveries: 18

Human Review: 12

```



The exact dashboard state may change after manual Razorpay recoveries or human-review actions.



\---



\## Technology Stack



\### Frontend



\- React

\- Vite

\- JavaScript

\- CSS



\### Backend



\- Node.js

\- Express.js

\- JavaScript



\### Payments



\- Razorpay Test Mode API



\### Development Tools



\- Git

\- GitHub

\- VS Code

\- PowerShell

\- zrok



\---



\## Project Structure



```text

recoverai/

|

├── backend/

│   |

│   ├── data/

│   │   ├── transactions.js

│   │   └── auditLogs.js

│   |

│   ├── routes/

│   │   ├── demoRoutes.js

│   │   ├── transactionRoutes.js

│   │   └── webhookRoutes.js

│   |

│   ├── services/

│   │   ├── razorpayService.js

│   │   ├── recoveryEngine.js

│   │   └── recoveryExecutor.js

│   |

│   ├── server.js

│   ├── package.json

│   └── package-lock.json

│

├── frontend/

│   |

│   ├── public/

│   |

│   ├── src/

│   │   ├── App.jsx

│   │   ├── App.css

│   │   ├── index.css

│   │   └── main.jsx

│   |

│   ├── index.html

│   ├── package.json

│   └── vite.config.js

│

├── .gitignore

└── README.md

```



\---



\# Running RecoverAI Locally



\## Prerequisites



Make sure you have:



\- Node.js

\- npm

\- Git

\- Razorpay Test Mode credentials



\---



\## 1. Clone the Repository



```bash

git clone https://github.com/vinuthnareddy0/recoverai.git

cd recoverai

```



\---



\## 2. Install Backend Dependencies



```bash

cd backend

npm install

```



\---



\## 3. Configure Environment Variables



Create:



```text

backend/.env

```



Add:



```env

RAZORPAY\_KEY\_ID=your\_test\_key\_id

RAZORPAY\_KEY\_SECRET=your\_test\_key\_secret

RAZORPAY\_WEBHOOK\_SECRET=your\_webhook\_secret

```



Never commit the `.env` file or real Razorpay credentials to GitHub.



\---



\## 4. Start the Backend



From the `backend` directory:



```bash

npm run dev

```



The backend runs at:



```text

http://localhost:5000

```



Example startup output:



```text

RecoverAI server running on http://localhost:5000

Razorpay webhook endpoint: /api/webhooks/razorpay

Demo reset endpoint: /api/demo/reset

Activity endpoint: /api/demo/activity

```



\---



\## 5. Install Frontend Dependencies



Open another terminal:



```bash

cd frontend

npm install

```



\---



\## 6. Start the Frontend



```bash

npm run dev

```



The Vite development server runs at:



```text

http://localhost:5173

```



Open this address in your browser to use RecoverAI.



\---



\# API



\## Transaction APIs



```text

GET /api/transactions/metrics



GET /api/transactions/audit-logs



POST /api/transactions/execute-recovery

```



\---



\## Razorpay Recovery



RecoverAI provides transaction recovery functionality for Razorpay payment links.



Example recovery-link route:



```text

POST /api/transactions/razorpay/recovery-link/:transactionId

```



The application can then verify the Razorpay payment status and synchronize it with the RecoverAI transaction state.



\---



\## Razorpay Webhook



```text

POST /api/webhooks/razorpay

```



The webhook implementation verifies the Razorpay signature using HMAC-SHA256 before processing the event.



Supported payment-link events include recovery-related states such as:



```text

payment\_link.paid

payment\_link.cancelled

payment\_link.expired

```



\---



\## Demo APIs



```text

POST /api/demo/reset



GET /api/demo/activity

```



These endpoints make it possible to reset and replay the RecoverAI demonstration.



\---



\# Build Challenges \& Technical Obstacles



The largest technical challenge was building a reliable end-to-end payment recovery lifecycle rather than simply simulating successful recoveries.



Integrating Razorpay required handling payment-link creation, asynchronous payment status changes, webhook signature verification, and synchronization between Razorpay and RecoverAI's internal transaction state.



During development, payment verification initially produced an error while retrieving the payment-link status. The payment service and verification flow were isolated and corrected so RecoverAI could reliably retrieve the current Razorpay payment-link state.



Another challenge involved receiving Razorpay webhooks while the backend was running locally.



A public zrok tunnel was used to expose the local Express backend. During development, the tunnel experienced DNS and session failures involving the underlying network endpoint. The tunnel configuration was diagnosed and a working public endpoint was re-established.



The project also needed to maintain consistent state between the backend and frontend. A payment could not simply appear successful in the interface; RecoverAI needed to update the underlying transaction, recovered amount, metrics, activity feed, and audit trail.



The recovery workflow was therefore structured around backend transaction state and audit records rather than relying only on temporary frontend state.



Duplicate payment events were another important consideration. Payment systems can deliver the same event more than once, so the recovery flow includes protection against counting the same recovered transaction multiple times.



Finally, not every recovery decision should be autonomous. High-value transactions and cases that cross retry boundaries are escalated to human review rather than automatically executed.



This provided a clear safety boundary between autonomous recovery and human-controlled decisions.



\---



\# Failure Recovery



RecoverAI was designed to handle different failure scenarios safely.



Examples include:



\- Temporary bank failures can be retried

\- Abandoned checkouts can receive a recovery intervention

\- Failed subscription payments can receive a secure payment link

\- High-risk transactions can be blocked for human review

\- Cancelled payment links can be recorded as unsuccessful

\- Expired payment links can be recorded as unsuccessful

\- Duplicate successful events do not recover the same transaction twice

\- Failed recovery actions remain visible in the audit history



The goal is not to make every recovery succeed.



The goal is to make safe recovery decisions, accurately measure the outcome, and preserve a clear explanation of what happened.



\---



\# Testing



Before submission, the main end-to-end flows were tested.



These included:



\- Demo reset

\- Recovery agent execution

\- Revenue-at-risk processing

\- Automated successful recovery

\- Failed recovery

\- Human escalation

\- Human approval

\- Human rejection

\- Razorpay Test Mode payment-link creation

\- Successful Razorpay payment

\- Payment-status verification

\- Browser refresh behavior

\- Duplicate recovery protection

\- Dashboard metric updates

\- Recovery filters

\- Search

\- Sorting

\- Activity feed

\- Recovery timeline



The final recovery workflow was tested from the dashboard through payment recovery and state verification.



\---



\# Engineering Decisions



\## Why not automate everything?



Automating every transaction would create unnecessary risk.



RecoverAI uses human review when a transaction crosses the automatic execution boundary.



This allows the system to automate suitable cases without pretending that every decision should be made without human involvement.



\---



\## Why verify payments?



Creating a payment link does not mean revenue has been recovered.



RecoverAI only counts the transaction as recovered after payment confirmation.



This keeps recovery metrics tied to actual payment state rather than attempted recovery actions.



\---



\## Why keep an audit trail?



Autonomous systems should be explainable.



RecoverAI records the action, confidence, result, amount, explanation, and timestamp so that recovery decisions can be inspected later.



\---



\## Why use deterministic demo data?



A deterministic dataset makes the demonstration reproducible.



The same transaction scenarios can be replayed, reset, inspected, and compared without random data changing the behavior of the application on every run.



\---



\# Future Improvements



A production version of RecoverAI could add:



\- Persistent database storage

\- Merchant authentication

\- Multiple merchant accounts

\- Production Razorpay integration

\- Durable background job queues

\- Retry scheduling

\- Email, SMS, and WhatsApp recovery providers

\- Real transaction ingestion

\- Merchant-configurable recovery policies

\- Advanced risk scoring

\- Recovery experimentation

\- More detailed analytics

\- Multi-merchant data isolation

\- Cloud deployment

\- Monitoring and alerting

\- Production-grade webhook processing



\---



\# Security



Sensitive configuration is stored using environment variables.



The repository's `.gitignore` excludes:



```text

.env

.env.\*

backend/.env

backend/.env.\*

frontend/.env

frontend/.env.\*

node\_modules/

```



Razorpay credentials should never be committed to source control.



Webhook requests are verified before trusted payment events are processed.



\---



\# Project Objective



RecoverAI demonstrates how an autonomous agent can be used for a concrete merchant problem: recovering revenue that would otherwise be lost.



Instead of simply detecting a failed transaction, RecoverAI closes the loop:



\*\*Detect → Diagnose → Decide → Act → Verify → Audit\*\*



The system combines autonomous recovery with explicit safety boundaries, payment verification, human review, and transparent decision tracking.



\---



\## RecoverAI



\*\*Recover revenue before it disappears.\*\*



Autonomous, controlled and auditable revenue recovery.



\*\*GitHub:\*\* https://github.com/vinuthnareddy0/recoverai

