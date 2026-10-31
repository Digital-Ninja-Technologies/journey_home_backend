# ENDPOINTS DOCUMENTATION

## BASE URL:
`https://journey-home.onrender.com/api/v1`

## Auth

<details>
<summary><strong>PATCH /auth/notification-preferences — Update notification preferences</strong></summary>

- **Method:** `PATCH`
- **URL:** `/api/v1/auth/notification-preferences`
- **Auth:** Required

All four boolean fields are required: `paymentReminders`, `deficitAlerts`, `serviceRequestUpdates`, and `productNewsOffers`. Defaults enable the first three and disable product news and offers. Preferences control notification email delivery.

**Body:** `{"paymentReminders":true,"deficitAlerts":true,"serviceRequestUpdates":true,"productNewsOffers":false}`
</details>

<details>
<summary><strong>DELETE /auth/me — Delete my account</strong></summary>

- **Method:** `DELETE`
- **URL:** `/api/v1/auth/me`
- **Auth:** Required

Requires the current password: `{"password":"current-password"}`. Deletes the authenticated user account.
</details>

<details>
<summary><strong>POST /auth/signup</strong></summary>

- **Method:** `POST`
- **URL:** `/api/v1/auth/signup`
- **Auth:** Not required

Creates an unverified customer or covered-person account and sends a verification link. Login and protected routes require email verification. Signup does not return an access token; the user logs in after verifying.

**Body:**

```json
{
  "name": "Ada Okafor",
  "email": "ada@example.com",
  "password": "secure123",
  "role": "customer"
}
```

**Response (201):**

```json
{
  "success": true,
  "message": "Signup completed. Check your email to verify the account before logging in.",
  "data": {
    "message": "Signup completed. Check your email to verify the account before logging in.",
    "email": "ada@example.com"
  }
}
```

**Errors:** `400` validation error, `409` email already exists.

---

Only `customer` and `covered_person` roles can be selected at signup. Admin roles are created through the super-admin endpoint.

</details>

<details>
<summary><strong>POST /auth/login — User login</strong></summary>

- **Method:** `POST`
- **URL:** `/api/v1/auth/login`
- **Auth:** Not required

Logs in a verified account. Unverified accounts receive `401` until the email verification link is used.

**Body:**

```json
{
  "email": "ada@example.com",
  "password": "secure123"
}
```

**Response (200):** authenticated user profile and access token.

**Errors:** `400` validation error, `401` invalid credentials.

</details>

<details>
<summary><strong>POST verify email</strong></summary>

- **Method:** `POST`
- **URL:** `/auth/verify-email`
- **Auth:** Not required

**Body:**

```json
{ "token": "..." }
```
</details>

<details>
<summary><strong>POST Resend email verification email</strong></summary>

- **Method:** `POST`
- **URL:** `/auth/resend-verification`
- **Auth:** Not required

**Body:**

```json
{ "email": "ada@example.com" }
```
</details>

<details>
<summary><strong>POST Request password reset</strong></summary>

- **Method:** `POST`
- **URL:** `/auth/forgot-password`
- **Auth:** Not required

**Body:**

```json
{ "email": "ada@example.com" }
```

sends a one-time reset link when the account exists (one-hour expiry);
</details>

<details>
<summary><strong>POST reset password</strong></summary>

- **Method:** `POST`
- **URL:** `/auth/reset-password`
- **Auth:** Not required

**Body:**

```json
{ "token": "...", "newPassword": "a-longer-password" }
```
</details>

<details>
<summary><strong>GET Get user profile</strong></summary>

- **Method:** `POST`
- **URL:** `/auth/me`
- **Auth:** required

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

- **GET** `/api/v1/auth/customers?page=1&limit=20&search=ada&emailVerified=true` returns `{ items, pagination }`. Search matches name/email; `emailVerified` accepts `true` or `false`. Requires admin or super admin.
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
      "features": ["Half-day photography", "Digital gallery"],
      "amount": 1000000,
      "currency": "NGN",
      "billingInterval": "monthly",
      "isActive": true
    }
  ]
}
```

Package amounts in create/update requests use major currency units. For NGN, `10000` means ₦10,000. Responses expose the stored minor-unit amount (`1000000` for ₦10,000).
Only packages with a successfully created Paystack monthly plan are listed as available. Provider plan identifiers are kept internal and are not returned by package endpoints.

</details>

<details>
<summary><strong>GET /packages/admin — List all packages</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/packages/admin`
- **Auth:** Required
- **Role:** Admin or super admin

Returns active and inactive packages for administration.
Supports `page`, `limit` (maximum 100), `search`, and `isActive=true|false`; response data contains `items` and pagination metadata.

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
  "amount": 10000,
  "currency": "NGN",
  "billingInterval": "monthly",
  "isActive": true
}
```

Customers cannot create packages or set package prices through plan endpoints. The local package is committed in a database transaction before the Paystack API is called, so Paystack is never called if the database write fails. While provider setup is in progress the package is marked pending; on provider failure it remains locally recorded as failed and is excluded from customer selection until an admin synchronizes it. A price, currency, or interval change creates a new Paystack plan; existing plans keep their snapshot and existing subscriptions keep their original provider plan code. Old Paystack plans are retained for those subscriptions.

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

Creates a new Paystack plan using the package's current amount, currency, and interval, then stores the provider identifiers and marks the package ready. Use this to prepare packages created before Paystack plan synchronization was added. A provider failure leaves the local package unchanged.

</details>

---

## Plans

<details>
<summary><strong>GET /plans/dashboard — Get my dashboard summary</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/plans/dashboard`
- **Auth:** Required

Returns successful contributed amount in minor units, successful payment count for the current calendar month, active plan count, and the next future payment date across the authenticated owner's plans. For NGN, `1000000` means ₦10,000.
</details>

<details>
<summary><strong>POST /plans — Create plan</strong></summary>

- **Method:** `POST`
- **URL:** `/api/v1/plans`
- **Auth:** Required
- **Role:** Customer, admin, or super admin

Creates a pending plan for the authenticated user. The owner is always derived from the JWT. 

Package amounts are supplied in major currency units (for example, `10000` is ₦10,000); Paystack receives the corresponding minor-unit amount (`1000000`).

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

Returns only plans owned by the authenticated user. Supports `page`, `limit` (maximum 100), `name` (covered-person name), `status`, `from`, and `to` (creation date range). Response data contains `items` and pagination metadata.

</details>

<details>
<summary><strong>GET /plans/admin — List all plans</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/plans/admin`
- **Auth:** Required
- **Role:** Admin or super admin

Supports `page`, `limit` (maximum 100), `status`, `ownerId`, `packageId`, and `search` filters. `search` matches covered-person name. Response data contains `items` and pagination metadata.
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

Returns only payment records owned by the authenticated user. Supports `page`, `limit` (maximum 100), `status`, `purpose`, `planId`, `from`, and `to` filters. Authorization codes and provider secrets are not exposed. Response data contains `items` and pagination metadata.

</details>

<details>
<summary><strong>GET /payments/:id — Get payment detail</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/payments/:id`
- **Auth:** Required

Returns one owned payment record.

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

Paystack collects recurring contributions. The subscription record tracks provider status independently from the plan; payment records track each transaction outcome.

---

## Notifications

<details>
<summary><strong>GET /notifications — List my notifications</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/notifications`
- **Auth:** Required

Returns the authenticated user's in-app notifications, newest first. Supports `page`, `limit` (maximum 100), `title` (case-insensitive contains match), `isRead=true|false`, `from`, and `to` (ISO date-times). `counts.totalNotifications` and `counts.totalUnreadNotifications` are the user's overall counts; pagination `total` is the number matching the filters.

**Example:** `GET /api/v1/notifications?page=1&limit=20&isRead=false&title=payment&from=2026-10-01T00:00:00.000Z`
</details>

<details>
<summary><strong>PATCH /notifications/:id/read — Mark notification as read</strong></summary>

- **Method:** `PATCH`
- **URL:** `/api/v1/notifications/:id/read`
- **Auth:** Required

Marks one notification owned by the authenticated user as read. Other users' notifications are not accessible.
</details>

<details>
<summary><strong>DELETE /notifications/:id — Delete notification</strong></summary>

- **Method:** `DELETE`
- **URL:** `/api/v1/notifications/:id`
- **Auth:** Required

Deletes one notification owned by the authenticated user. Other users' notifications are not accessible.
</details>

## Service Requests

<details>
<summary><strong>POST /service-requests — Submit service request</strong></summary>

- **Method:** `POST`
- **URL:** `/api/v1/service-requests`
- **Auth:** Required

Creates a service request for one of the authenticated user's plans. The plan must belong to the user and must be `Active`, `Payment_Due`, or `Overdue`. The covered-person details are snapshotted from the plan.

**Body:**

```json
{
  "planId": "66f...",
  "dateOfDeath": "2026-10-01T00:00:00.000Z",
  "serviceLocation": "Nsukka, Enugu State",
  "expectedServiceDate": "2026-10-20T10:00:00.000Z",
  "contactPerson": "Ada Okafor",
  "contactPhone": "08030000000",
  "additionalInformation": "Family contact is available at the location."
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

```valid document status
Requires_Resubmission
Pending
Approved
```


When all current documents are approved, the request moves to `Docs_Verified` automatically and can then be approved. If resubmission is required, the request moves to `More_Info_Required` and the customer can upload a replacement document.

</details>

<details>
<summary><strong>PATCH /service-requests/:id/status — Update service request status</strong></summary>

- **Method:** `PATCH`
- **URL:** `/api/v1/service-requests/:id/status`
- **Auth:** Required
- **Role:** Admin or super admin

All administrative request status changes use this endpoint. `reason` is optional for every status; include it when rejecting or requesting more information so the customer receives useful context.

```json
{ "status": "Under_Review" }
```

**Mark documents verified:** requires at least one current document and all current documents approved.

```json
{ "status": "Docs_Verified" }
```

**Approve:**

```json
{ "status": "Approved" }
```

**Reject, with optional reason:**

```json
{ "status": "Rejected", "reason": "The submitted information does not match the registered covered person." }
```

**Request more information, with optional reason:**

```json
{ "status": "More_Info_Required", "reason": "Please upload a clearer death certificate and valid ID." }
```

**Cancel:**

```json
{ "status": "Cancelled" }
```

</details>

---

## Admin endpoints

All endpoints in this section require a bearer token and an admin or super-admin role. Monetary values are stored and returned in minor units (`1500000` means ₦15,000).

<details>
<summary><strong>GET /admin/overview — Operations dashboard overview</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/admin/overview`
- **Auth:** Required
- **Authorization:** Admin or super admin
- **Query Parameters:** Optional `startDate` and `endDate` (`YYYY-MM-DD`) to show successful contributions for a selected period. User new-this-month and monthly commitment figures remain calendar-month values.

Returns aggregate user, plan, contribution, and service-request totals plus up to five most recent service requests needing staff review. Active plans means plans in `Active` status. Total contributed counts successful payments only. Monthly commitments sum active plans' monthly amounts. Average per plan is total contributed divided by active plans (zero when there are no active plans). Pending verification is the count of submitted, under-review, and documents-verified service requests.

### Example

`GET /api/v1/admin/overview`

### Example with date range

`GET /api/v1/admin/overview?startDate=2026-10-01&endDate=2026-10-26`
</details>

<details>
<summary><strong>GET /admin/users — Admin users list</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/admin/users`
- **Auth:** Required
- **Authorization:** Admin or super admin
- **Query Parameters:** Optional `search`, `page`, and `limit` (maximum 100)

Lists customer accounts with plan count, total saved, active plan count, and derived status (`Request_Pending`, `Active_Plan`, or `No_Active_Plan`). A request-pending status takes precedence when the customer has a submitted, under-review, or documents-verified service request.

### Example

`GET /api/v1/admin/users?page=1&limit=20`

### Example with search

`GET /api/v1/admin/users?search=Chidi&page=1&limit=20`
</details>


<details>
<summary><strong>GET /plans/admin — Admin plans list</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/plans/admin`
- **Auth:** Required
- **Authorization:** Admin or super admin
- **Query Parameters:** Optional `search`, `status`, `ownerId`, `packageId`, `page`, and `limit` (maximum 100)

`search` matches covered-person name and plan owner's name or email. Plan records include the owner name and email. `totalContributedAmount` is the amount paid to date and supplies the plans-page Balance column. Valid statuses are `Pending`, `Active`, `Payment_Due`, `Overdue`, `Paused`, `Service_Request`, `Under_Review`, `Approved`, `Service_Scheduled`, `Completed`, `Cancelled`, and `Expired`.

### Example

`GET /api/v1/plans/admin?status=Active&page=1&limit=20`

### Example with search

`GET /api/v1/plans/admin?search=Chidi&page=1&limit=20`

### Combined query example

`GET /api/v1/plans/admin?search=Adebayo&status=Active&packageId=66f...&page=1&limit=20`
</details>

<details>
<summary><strong>GET /service-requests/admin — Admin service request queue</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/service-requests/admin`
- **Auth:** Required
- **Authorization:** Admin or super admin
- **Query Parameters:** Optional `search`, `status`, `ownerId`, `planId`, `from`, `to`, `page`, and `limit` (maximum 100)

`search` matches covered-person name, location, or owner's name/email. Dates filter request creation time. Statuses include `Submitted`, `Under_Review`, `More_Info_Required`, `Docs_Verified`, `Approved`, `Rejected`, `Cancelled`, and `Closed`.

### Example

`GET /api/v1/service-requests/admin?status=Under_Review&page=1&limit=20`

### Example with date range

`GET /api/v1/service-requests/admin?from=2026-10-01&to=2026-10-26&page=1&limit=50`

### Example with search

`GET /api/v1/service-requests/admin?search=Adebayo&page=1&limit=20`

### Combined query example

`GET /api/v1/service-requests/admin?search=Ikoyi&status=Submitted&from=2026-10-01&to=2026-10-26&page=1&limit=20`
</details>

<details>
<summary><strong>PATCH /service-requests/:id/status — Review a service request</strong></summary>

- **Method:** `PATCH`
- **URL:** `/api/v1/service-requests/:id/status`
- **Auth:** Required
- **Authorization:** Admin or super admin

Admin approval remains the explicit `Approved` transition. `Closed` is set by photographer assignment and is not a manual status option.

### Example

`PATCH /api/v1/service-requests/66f.../status` with body `{"status":"Approved"}`
</details>

<details>
<summary><strong>PATCH /service-requests/:id/assign-photographer — Assign photographer and close request</strong></summary>

- **Method:** `PATCH`
- **URL:** `/api/v1/service-requests/:id/assign-photographer`
- **Auth:** Required
- **Authorization:** Admin or super admin

May be used after a request is approved. Records the assigned photographer and assignment time, changes the request status to `Closed`, and notifies the customer.

### Example

`PATCH /api/v1/service-requests/66f.../assign-photographer` with body `{"photographerName":"Adebayo Johnson"}`
</details>

<details>
<summary><strong>GET /payments/admin — Admin payment transactions</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/payments/admin`
- **Auth:** Required
- **Authorization:** Admin or super admin
- **Query Parameters:** Optional `search`, `status`, `purpose`, `from`, `to`, `page`, and `limit` (maximum 100)

`search` matches customer name/email, payment reference, or covered-person name. The response includes paginated transactions and status totals for the selected date range. Valid statuses are `Successful`, `Pending`, `Processing`, `Failed`, and `Cancelled`; the business does not issue refunds.

### Example

`GET /api/v1/payments/admin?page=1&limit=20`

### Example with status filter

`GET /api/v1/payments/admin?status=Successful&page=1&limit=50`

### Example with date range

`GET /api/v1/payments/admin?from=2026-10-01&to=2026-10-26&page=1&limit=50`

### Example with search

`GET /api/v1/payments/admin?search=jh_init_82300&page=1&limit=20`

### Combined query example

`GET /api/v1/payments/admin?search=Chidi&status=Successful&purpose=recurring_contribution&from=2026-10-01&to=2026-10-26&page=1&limit=20`
</details>

### Combined admin dashboard data request

The overview endpoint supplies the dashboard cards and service-request preview. Load it with the sidebar's own paginated list endpoint when the relevant page is opened:

```text
GET /api/v1/admin/overview?startDate=2026-10-01&endDate=2026-10-26
GET /api/v1/admin/users?search=Chidi&page=1&limit=20
GET /api/v1/plans/admin?search=Adebayo&status=Active&page=1&limit=20
GET /api/v1/service-requests/admin?status=Under_Review&page=1&limit=20
GET /api/v1/payments/admin?status=Successful&from=2026-10-01&to=2026-10-26&page=1&limit=20
```

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
FRONTEND_URL=https://your-frontend.example.com

EMAIL_SERVICE_URL=https://email-service-one-alpha.vercel.app/api/mail/send
SUPER_ADMIN_EMAIL=admin@example.com
```

## Commands

```bash
npm install
npm run dev
npm run build
npm start
```
