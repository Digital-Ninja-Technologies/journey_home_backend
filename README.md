# ENDPOINTS DOCUMENTATION

## BASE URL:

`/api/v1`

## Auth

<details>
<summary><strong>POST /auth/signup</strong></summary>

- **Method:** `POST`
- **URL:** `/api/v1/auth/signup`
- **Auth:** Not required

Creates a customer account and returns a JWT. The server always assigns the `customer` role; clients cannot register themselves as admins.

**Body:**

```json
{
  "name": "Ada Okafor",
  "email": "ada@example.com",
  "password": "secure123",
  "role": "admin"
}
```

**Response (201):**

```json
{
  "success": true,
  "message": "Signup successful",
  "data": {
    "user": {
      "id": "66f...",
      "email": "ada@example.com",
      "name": "Ada Okafor",
      "role": "customer",
      "isSuperAdmin": false
    },
    "token": "jwt-token"
  }
}
```

**Errors:** `400` validation error, `409` email already exists.

---

## roles: "admin", super_admin, customer, covered_person

</details>

<details>
<summary><strong>POST /auth/login — User login</strong></summary>

- **Method:** `POST`
- **URL:** `/api/v1/auth/login`
- **Auth:** Not required

Logs in any existing user role.

**Body:**

```json
{
  "email": "ada@example.com",
  "password": "secure123"
}
```

**Response (200):** same shape as signup.

**Errors:** `400` validation error, `401` invalid credentials.

</details>

<details>
<summary><strong>POST /auth/admin/login — Admin login</strong></summary>

- **Method:** `POST`
- **URL:** `/api/v1/auth/admin/login`
- **Auth:** Not required

Logs in only `admin` or `super_admin` users.

**Body:**

```json
{
  "email": "admin@example.com",
  "password": "admin123"
}
```

</details>

<details>
<summary><strong>Admin auth endpoints</strong></summary>

- **POST** `/api/v1/auth/admin` — create admin. Auth required: super admin.
- **DELETE** `/api/v1/auth/admin/:id` — delete admin. Auth required: super admin.
- **GET** `/api/v1/auth/admins` — list admins. Auth required: super admin.
</details>

<details>
<summary><strong>change password</strong></summary>

- **PATCH** `/api/v1/auth/change-password` — reset
</details>

<details>
<summary><strong>Get all customers</strong></summary>

- **method**: **GET** `/api/v1/auth/customers`
</details>

---

## Packages

<details>
<summary><strong>GET /packages — List active packages</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/packages`
- **Auth:** Not required

Returns only active packages that customers may select for new plans.

**Response (200):**

```json
{
  "success": true,
  "message": "Packages retrieved successfully",
  "data": [
    {
      "_id": "66f...",
      "name": "Classic Memorial",
      "description": "Sample test fixture package",
      "photographyIncluded": true,
      "videographyIncluded": false,
      "coverageDetails": "Configured by admin",
      "deliverables": ["Album"],
      "monthlyContributionMinor": 1000000,
      "currency": "NGN",
      "isActive": true
    }
  ]
}
```

Money is stored in minor units. For NGN, `1000000` means ₦10,000.
Only packages with a successfully created Paystack monthly plan are listed as available. Provider plan identifiers are kept internal and are not returned by package endpoints.

</details>

<details>
<summary><strong>GET /packages/admin — List all packages</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/packages/admin`
- **Auth:** Required
- **Role:** Admin or super admin

Returns active and inactive packages for administration.

</details>

<details>
<summary><strong>GET /packages/:id — Get package</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/packages/:id`
- **Auth:** Required

Customers can retrieve active packages. Admins can retrieve inactive packages too.

**Errors:** `400` invalid id, `404` package not found.

</details>

<details>
<summary><strong>POST /packages — Create package</strong></summary>

- **Method:** `POST`
- **URL:** `/api/v1/packages`
- **Auth:** Required
- **Role:** Admin or super admin

**Body:**

```json
{
  "name": "Classic Memorial",
  "description": "Configured commercial package terms",
  "features": [
    "Half-day photography",
    "Digital gallery",
    "Dedicated coordinator"
  ],
  "amount": 1000000,
  "currency": "NGN",
  "isActive": true
}
```

Customers cannot create packages or set package prices through plan endpoints.
Creating a package also creates its Paystack recurring plan. If Paystack setup fails, package creation fails and no subscription-ready package is stored. A price, currency, or interval change creates a new Paystack plan; existing burial plans keep their snapshot and existing subscriptions keep their original provider plan code. Old Paystack plans are retained for those subscriptions.

</details>

<details>
<summary><strong>PATCH /packages/:id — Update, activate, or deactivate package</strong></summary>

- **Method:** `PATCH`
- **URL:** `/api/v1/packages/:id`
- **Auth:** Required
- **Role:** Admin or super admin

Accepts editable package fields, including `isActive` and `billingInterval` (`monthly`). Commercial term changes create a new provider plan version. Existing plans keep their package snapshot and contribution amount.

**Errors:** `400` invalid id or protected field, `404` package not found.

</details>

<details>
<summary><strong>POST /packages/:id/sync-paystack — Create a Paystack plan for an existing package</strong></summary>

- **Method:** `POST`
- **URL:** `/api/v1/packages/:id/sync-paystack`
- **Auth:** Required
- **Role:** Admin or super admin

Creates a new Paystack plan using the package's current amount, currency, and interval, then stores the provider identifiers. Use this to prepare packages created before Paystack plan synchronization was added. A provider failure leaves the local package unchanged.

</details>

---

## Plans

<details>
<summary><strong>POST /plans — Create burial plan</strong></summary>

- **Method:** `POST`
- **URL:** `/api/v1/plans`
- **Auth:** Required
- **Role:** Customer, admin, or super admin

Creates a pending plan for the authenticated user. The owner is always derived from the JWT. 

**Body:**

```json
{
  "packageId": "66f...",
  "coveredPerson": {
    "fullName": "Chinedu Okafor",
    "dateOfBirth": "1958-04-10T00:00:00.000Z",
    "gender": "male",
    "relationship": "father",
    "address": "12 Market Road, Enugu",
    "phoneNumber": "08030000000"
  }
}
```

**Response (201):** plan with `status: "Pending"`, `coverageStatus: "Pending"`, `totalContributedMinor: 0`.

**Business rules:** plan activation requires a verified successful initial payment.

</details>

<details>
<summary><strong>GET /plans — List my plans</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/plans`
- **Auth:** Required

Returns only plans owned by the authenticated user.

</details>

<details>
<summary><strong>GET /plans/admin — List all plans</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/plans/admin`
- **Auth:** Required
- **Role:** Admin or super admin
</details>

<details>
<summary><strong>GET /plans/:id — Get plan</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/plans/:id`
- **Auth:** Required

Customers can retrieve only their own plans. Admins can retrieve any plan.

</details>

<details>
<summary><strong>PATCH /plans/:id/status — Admin status transition</strong></summary>

- **Method:** `PATCH`
- **URL:** `/api/v1/plans/:id/status`
- **Auth:** Required
- **Role:** Admin or super admin

**Body:**

```json
{
  "status": "Under_Review"
}
```

Only explicit state transitions are allowed. Customers cannot change protected lifecycle states.

</details>

---

## Payments and Paystack

<details>
<summary><strong>POST /payments/plans/:planId/initialize-initial — Initialize initial contribution checkout</strong></summary>

- **Method:** `POST`
- **URL:** `/api/v1/payments/plans/:planId/initialize-initial`
- **Auth:** Required
- **Paystack:** Initializes `/transaction/initialize` with the package's Paystack `plan_code`

Creates or reuses a pending initial payment attempt for a pending owned plan. The amount and currency come from the plan snapshot.

**Response (201):**

```json
{
  "success": true,
  "message": "Checkout initialized successfully",
  "data": {
    "paymentId": "66f...",
    "reference": "jh_init_...",
    "authorizationUrl": "https://checkout.paystack.com/...",
    "accessCode": "access_code"
  }
}
```

This creates a pending local subscription relationship, then starts Paystack checkout for the configured recurring plan. Paystack creates the recurring subscription only after the customer pays. The plan remains pending until server-side verification or a verified webhook confirms the first payment;

**Errors:** `404` plan not found or not owned by the caller, `400` plan is not pending or package is not Paystack-ready, `409` another pending checkout for the same customer and package must be completed first (this keeps Paystack's subscription event unambiguous).

</details>

<details>
<summary><strong>POST /payments/verify/:reference — Verify payment</strong></summary>

- **Method:** `POST`
- **URL:** `/api/v1/payments/verify/:reference`
- **Auth:** Required
- **Paystack:** Calls `/transaction/verify/:reference`

Verifies Paystack status, reference, amount, currency, and internal association before applying the result. Successful initial payments activate the plan and count one contribution exactly once. Journey Home does not store reusable authorization codes; Paystack Subscriptions handles subsequent collection.

</details>

<details>
<summary><strong>POST /payments/webhooks/paystack — Paystack webhook</strong></summary>

- **Method:** `POST`
- **URL:** `/api/v1/payments/webhooks/paystack`
- **Auth:** Paystack signature required

Verifies `x-paystack-signature` against the raw request body using HMAC SHA512. Re-verifies `charge.success` transactions server-side, links `subscription.create` to the pending local subscription, and applies successful recurring charges once. Invoice events synchronize a provider-reported next payment date where present. Events are durably recorded; repeated or out-of-order events can be retried without double-counting a contribution.

**Idempotency:** provider events are deduplicated by event name plus provider transaction reference/id. Duplicate deliveries do not double-count contributions.

</details>

<details>
<summary><strong>GET /payments — List my payment history</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/payments`
- **Auth:** Required

Returns only payment records owned by the authenticated user. Authorization codes and provider secrets are not exposed.

</details>

<details>
<summary><strong>GET /payments/:id — Get payment detail</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/payments/:id`
- **Auth:** Required

Returns one owned payment record.

</details>

---

## Billing (legacy)

The `/billing` routes and old billing scheduler remain in the codebase for transition visibility. They are not part of the Paystack Subscriptions flow. Manual recurring charging is disabled in the payment service; keep `BILLING_SCHEDULER_ENABLED=false`. Do not use these routes to collect new contributions.

<details>
<summary><strong>GET /billing/policy — View billing policy</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/billing/policy`
- **Auth:** Required
- **Role:** Admin or super admin

Returns the legacy configured grace-period and retry policy. These settings do not govern Paystack Subscriptions.

</details>

<details>
<summary><strong>POST /billing/run-due — Run due billing batch</strong></summary>

- **Method:** `POST`
- **URL:** `/api/v1/billing/run-due`
- **Auth:** Required
- **Role:** Admin or super admin
- **Availability:** Legacy endpoint; manual charging is disabled.

The legacy route remains available, but scheduled manual charging is disabled in the payment service and this route must not be used to collect contributions. No retry, grace-period, or overdue policy is applied by the new flow.

</details>

---

## Subscriptions

<details>
<summary><strong>GET /subscriptions — List my subscriptions</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/subscriptions`
- **Auth:** Required

Returns the authenticated owner's local subscription records, including local status and expected next payment date. Provider subscription/plan identifiers are retained for reconciliation.

</details>

<details>
<summary><strong>GET /subscriptions/:id — Get subscription</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/subscriptions/:id`
- **Auth:** Required

Returns one subscription owned by the authenticated user. Other owners receive `404`.

</details>

Paystack collects recurring contributions. The subscription record tracks provider status independently from the burial plan; payment records track each transaction outcome.

---

## Notifications

<details>
<summary><strong>GET /notifications — List my notifications</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/notifications`
- **Auth:** Required

Returns durable notification records for the authenticated user. Notification records use a dedupe key so repeated webhooks or billing jobs do not send repeated emails for the same event.

</details>

The independent contribution reminder job sends email at 7 days and 3 days before the expected payment date reported by Paystack. It deduplicates by subscription, reminder interval, and due date. Failed reminder deliveries are retried daily while that due date is still current; the job sends emails only and never charges or retries a payment.

---

## Service Requests

<details>
<summary><strong>POST /service-requests — Submit burial service request</strong></summary>

- **Method:** `POST`
- **URL:** `/api/v1/service-requests`
- **Auth:** Required

Creates a service request for one of the authenticated user's plans. The plan must belong to the user and must be `Active`, `Payment_Due`, or `Overdue`. The covered-person details are snapshotted from the plan.

**Body:**

```json
{
  "planId": "66f...",
  "dateOfDeath": "2026-10-01T00:00:00.000Z",
  "burialLocation": "Nsukka, Enugu State",
  "expectedBurialDate": "2026-10-20T10:00:00.000Z",
  "contactPerson": "Ada Okafor",
  "contactPhone": "08030000000",
  "additionalInformation": "Family contact is available at the burial location."
}
```

**Response (201):** service request with `status: "Submitted"`.

**Business rules:** submitting a request moves the plan into `Service_Request`. Required document rules are configurable operationally; the implementation supports death certificate, valid identification, and other proof documents.

</details>

<details>
<summary><strong>GET /service-requests — List my service requests</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/service-requests`
- **Auth:** Required

Returns only service requests owned by the authenticated user.

</details>

<details>
<summary><strong>GET /service-requests/admin — List all service requests</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/service-requests/admin`
- **Auth:** Required
- **Role:** Admin or super admin
- **Query:** `status` optional; must be one of the service request statuses.

Returns service requests for operations review.

</details>

<details>
<summary><strong>GET /service-requests/:id — Get service request detail</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/service-requests/:id`
- **Auth:** Required

Customers can retrieve only their own requests. Admins can retrieve any request. The response includes the request and document records, but not public file URLs.

</details>

<details>
<summary><strong>POST /service-requests/:id/documents/upload-url — Request private document upload URL</strong></summary>

- **Method:** `POST`
- **URL:** `/api/v1/service-requests/:id/documents/upload-url`
- **Auth:** Required
- **Storage:** Tigris private object storage with presigned PUT URL

Creates a pending private file record and returns a signed upload URL. Supported MIME types for service documents are `application/pdf`, `image/jpeg`, and `image/png`; max size is 10 MB.

**Body:**

```json
{
  "documentType": "Death_Certificate",
  "fileName": "death-certificate.pdf",
  "contentType": "application/pdf",
  "size": 420000
}
```

**Response (201):**

```json
{
  "success": true,
  "message": "Service document upload URL generated successfully",
  "data": {
    "fileId": "66f...",
    "uploadUrl": "https://...",
    "uploadToken": "token",
    "storageKey": "service-requests/documents/uuid.pdf",
    "expiresIn": 3600
  }
}
```

The frontend uploads the binary file directly to `uploadUrl`, then calls the complete endpoint.

</details>

<details>
<summary><strong>POST /service-requests/:id/documents/complete — Complete document upload</strong></summary>

- **Method:** `POST`
- **URL:** `/api/v1/service-requests/:id/documents/complete`
- **Auth:** Required

Verifies the uploaded Tigris object with `HeadObject`, marks the file uploaded, creates a service document record, and returns it with `verificationStatus: "Pending"`.

**Body:**

```json
{
  "fileId": "66f...",
  "uploadToken": "token",
  "documentType": "Death_Certificate",
  "replacesDocumentId": "66f..."
}
```

`replacesDocumentId` is optional and is used for resubmission after a document was marked `Requires_Resubmission`.

</details>

<details>
<summary><strong>GET /service-requests/:id/documents/:documentId/download-url — Get private document URL</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/service-requests/:id/documents/:documentId/download-url`
- **Auth:** Required

Returns a short-lived signed Tigris download URL. Customers can access only their own service request documents. Admin access is audited.

**Response (200):**

```json
{
  "success": true,
  "message": "Service document download URL generated successfully",
  "data": {
    "document": {
      "_id": "66f...",
      "documentType": "Death_Certificate",
      "verificationStatus": "Pending"
    },
    "url": "https://...",
    "expiresIn": 900
  }
}
```

</details>

<details>
<summary><strong>POST /service-requests/:id/under-review — Mark request under review</strong></summary>

- **Method:** `POST`
- **URL:** `/api/v1/service-requests/:id/under-review`
- **Auth:** Required
- **Role:** Admin or super admin

Moves the service request to `Under_Review` and the linked plan to `Under_Review`.

</details>

<details>
<summary><strong>PATCH /service-requests/:id/documents/:documentId/verify — Verify document</strong></summary>

- **Method:** `PATCH`
- **URL:** `/api/v1/service-requests/:id/documents/:documentId/verify`
- **Auth:** Required
- **Role:** Admin or super admin

Approves a document or requests resubmission. A reason is required when requesting resubmission.

**Body:**

```json
{
  "verificationStatus": "Requires_Resubmission",
  "reason": "The uploaded document is unreadable."
}
```

If resubmission is required, the request moves to `More_Info_Required` and the customer can upload a replacement document.

</details>

<details>
<summary><strong>POST /service-requests/:id/docs-verified — Mark all documents verified</strong></summary>

- **Method:** `POST`
- **URL:** `/api/v1/service-requests/:id/docs-verified`
- **Auth:** Required
- **Role:** Admin or super admin

Requires at least one current document and all current documents must be `Approved`.

</details>

<details>
<summary><strong>POST /service-requests/:id/approve — Approve service request</strong></summary>

- **Method:** `POST`
- **URL:** `/api/v1/service-requests/:id/approve`
- **Auth:** Required
- **Role:** Admin or super admin

Approves the request after review or document verification and moves the linked plan to `Approved`. Provider assignment is a later phase.

</details>

<details>
<summary><strong>POST /service-requests/:id/reject — Reject service request</strong></summary>

- **Method:** `POST`
- **URL:** `/api/v1/service-requests/:id/reject`
- **Auth:** Required
- **Role:** Admin or super admin

Rejects the request. A rejection reason is required and is shown to the user.

**Body:**

```json
{
  "reason": "The submitted information does not match the registered covered person."
}
```

</details>

<details>
<summary><strong>POST /service-requests/:id/request-more-info — Request more information</strong></summary>

- **Method:** `POST`
- **URL:** `/api/v1/service-requests/:id/request-more-info`
- **Auth:** Required
- **Role:** Admin or super admin

Moves the request to `More_Info_Required` with a reason. The user can resubmit documents through the upload and complete endpoints.

**Body:**

```json
{
  "reason": "Please upload a clearer death certificate and valid ID."
}
```

</details>

---

## Environment Variables

```env
APP_PORT=2041
NODE_ENV=development
MONGODB_URI=mongodb+srv://...
JWT_SECRET=change-me
JWT_REFRESH_SECRET=change-me-too

PAYSTACK_SECRET_KEY=sk_test_xxx
PAYSTACK_BASE_URL=https://api.paystack.co
PAYSTACK_CALLBACK_URL=https://your-frontend.example.com/payments/callback

BILLING_SCHEDULER_ENABLED=false
BILLING_POLICY_CONFIGURED=false
BILLING_GRACE_PERIOD_DAYS=0
BILLING_RETRY_INTERVAL_DAYS=
BILLING_MAX_RETRY_ATTEMPTS=0
BILLING_LEASE_MINUTES=10
BILLING_CONTINUE_OVERDUE=false
CONTRIBUTION_REMINDERS_ENABLED=false

EMAIL_SERVICE_URL=https://email-service-one-alpha.vercel.app/api/mail/send
SUPER_ADMIN_EMAIL=admin@example.com
```

Production requires `PAYSTACK_SECRET_KEY`. Set `CONTRIBUTION_REMINDERS_ENABLED=true` to run the independent daily email reminder job at 9:00 AM Africa/Lagos. It sends reminders seven and three days before the expected contribution date, deduplicated by subscription, interval, and due date; failed email deliveries remain retryable. It never charges or retries payments. Keep the legacy `BILLING_SCHEDULER_ENABLED=false` while using subscriptions.

## Commands

```bash
npm install
npm run dev
npm run build
npm start
```

## Remaining Product Decisions

- Final package prices, deliverables, and provider costs must be configured by admins.
- Grace-period duration, retry intervals, max attempts, and overdue behavior require approval before production billing is enabled.
- Legal exceptions to the no-refund preference are not implemented as automatic refund rules.
- Detailed eligibility, fraud-prevention, service coverage, and claim rules remain outside this phase.
- Paystack plan creation, subscription creation after plan-code checkout, and webhook delivery should be confirmed in the merchant's test integration before production use.
