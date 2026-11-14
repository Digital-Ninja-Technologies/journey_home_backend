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

**Response (200):**

```json
{
  "success": true,
  "message": "Notification preferences updated successfully",
  "data": {
    "paymentReminders": true,
    "deficitAlerts": true,
    "serviceRequestUpdates": true,
    "productNewsOffers": false
  }
}
```
</details>

<details>
<summary><strong>DELETE /auth/me — Delete my account</strong></summary>

- **Method:** `DELETE`
- **URL:** `/api/v1/auth/me`
- **Auth:** Required

Requires the current password: `{"password":"current-password"}`. Deletes the authenticated user account.

**Response (200):**

```json
{
  "success": true,
  "message": "Account deleted successfully",
  "data": { "message": "Account deleted successfully" }
}
```
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

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "674a1b2c3d4e5f6789012345",
      "email": "ada@example.com",
      "name": "Ada Okafor",
      "role": "customer",
      "isSuperAdmin": false
    },
    "token": "<access-token>"
  }
}
```

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

**Response (200):**

```json
{
  "success": true,
  "message": "Email verified successfully",
  "data": { "message": "Email verified successfully" }
}
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

**Response (200):**

```json
{
  "success": true,
  "message": "Verification email request processed",
  "data": { "message": "If the account needs verification, a new link has been sent" }
}
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

**Response (200):**

```json
{
  "success": true,
  "message": "Password reset request processed",
  "data": { "message": "If an account exists for that email, password reset instructions have been sent" }
}
```
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

**Response (200):**

```json
{
  "success": true,
  "message": "Password reset successfully",
  "data": { "message": "Password reset successfully" }
}
```
</details>

<details>
<summary><strong>GET Get user profile</strong></summary>

- **Method:** `POST`
- **URL:** `/auth/me`
- **Auth:** required

**Response (200):**

```json
{
  "success": true,
  "message": "User profile retrieved successfully",
  "data": {
    "id": "674a1b2c3d4e5f6789012345",
    "email": "ada@example.com",
    "name": "Ada Okafor",
    "role": "customer",
    "isSuperAdmin": false,
    "isEmailVerified": true,
    "createdAt": "2026-10-01T12:00:00.000Z",
    "updatedAt": "2026-10-01T12:00:00.000Z",
    "notificationPreferences": {
      "paymentReminders": true,
      "deficitAlerts": true,
      "serviceRequestUpdates": true,
      "productNewsOffers": false
    }
  }
}
```

</details>

<details>
<summary><strong>Admin auth endpoints</strong></summary>

- **POST** `/api/v1/auth/admin` — create admin. Auth required: super admin.

- **DELETE** `/api/v1/auth/admin/:id` — delete admin. Auth required: super admin.

- **GET** `/api/v1/auth/admins` — list admins. Auth required: super admin.

Admin creation returns `201` with `{ "success": true, "message": "Admin added successfully", "data": { "id": "674a1b2c3d4e5f6789012345", "email": "admin@example.com", "name": "Admin", "role": "admin", "isSuperAdmin": false, "createdAt": "2026-10-01T12:00:00.000Z" } }`.

Admin deletion returns `200` with `{ "success": true, "message": "Admin deleted successfully", "data": { "id": "674a1b2c3d4e5f6789012345", "email": "admin@example.com" } }`.

Listing admins returns `200` with `{ "success": true, "message": "Admins retrieved successfully", "data": [{ "id": "674a1b2c3d4e5f6789012345", "email": "admin@example.com", "name": "Admin", "role": "admin", "isSuperAdmin": false, "createdAt": "2026-10-01T12:00:00.000Z" }] }`.
</details>

<details>
<summary><strong>change password</strong></summary>

- **PATCH** `/api/v1/auth/change-password` — reset

The controller returns `200` with `{ "success": true, "message": "Password changed successfully", "data": { "message": "Password changed successfully" } }` when the current password matches.
</details>

<details>
<summary><strong>Get all customers</strong></summary>

- **GET** `/api/v1/auth/customers?page=1&limit=20&search=ada&emailVerified=true` returns `{ items, pagination }`. Search matches name/email; `emailVerified` accepts `true` or `false`. Requires admin or super admin.

**Response (200):**

```json
{
  "success": true,
  "message": "Customers retrieved successfully",
  "data": {
    "items": [
      {
        "_id": "674a1b2c3d4e5f6789012345",
        "email": "ada@example.com",
        "name": "Ada Okafor",
        "role": "customer",
        "isSuperAdmin": false,
        "isEmailVerified": true,
        "createdAt": "2026-10-01T12:00:00.000Z",
        "updatedAt": "2026-10-01T12:00:00.000Z",
        "notificationPreferences": {
          "paymentReminders": true,
          "deficitAlerts": true,
          "serviceRequestUpdates": true,
          "productNewsOffers": false
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPreviousPage": false
    }
  }
}
```
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
            "_id": "6aedbcef0a487be5942304f0",
            "name": "Basic.",
            "description": "Photography + videography",
            "features": [
                "Full-day photography & video",
                "Edited keepsake film",
                "Printed album, 40 pages",
                "Digital gallery for family abroad"
            ],
            "amount": 100000000,
            "currency": "NGN",
            "billingInterval": "monthly",
            "isActive": true,
            "createdBy": "6aedb9f80a487be5942304ef",
            "updatedBy": "6aedb9f80a487be5942304ef",
            "createdAt": "2026-11-06T11:41:35.492Z",
            "updatedAt": "2026-11-06T11:41:35.955Z",
            "__v": 0
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

**Response (200):**
```json
{
    "success": true,
    "message": "Packages retrieved successfully",
    "data": {
        "items": [
            {
                "_id": "6aedbcef0a487be5942304f0",
                "name": "Basic.",
                "description": "Photography + videography",
                "features": [
                    "Full-day photography & video",
                    "Edited keepsake film",
                    "Printed album, 40 pages",
                    "Digital gallery for family abroad"
                ],
                "amount": 100000000,
                "currency": "NGN",
                "billingInterval": "monthly",
                "isActive": true,
                "createdBy": "6aedb9f80a487be5942304ef",
                "updatedBy": "6aedb9f80a487be5942304ef",
                "createdAt": "2026-11-06T11:41:35.492Z",
                "updatedAt": "2026-11-06T11:41:35.955Z",
                "__v": 0
            }
        ],
        "pagination": {
            "page": 1,
            "limit": 20,
            "total": 1,
            "totalPages": 1,
            "hasNextPage": false,
            "hasPreviousPage": false
        }
    }
}
```

</details>

<details>
<summary><strong>GET /packages/:id — Get package</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/packages/:id`
- **Auth:** Required

Customers can retrieve active packages. Admins can retrieve inactive packages too.

**Errors:** `400` invalid id, `404` package not found.

**Response (200):**

```json
{
  "success": true,
  "message": "Package retrieved successfully",
  "data": {
    "_id": "66f123456789012345678901",
    "name": "Classic Memorial",
    "description": "Configured commercial package terms",
    "features": ["Half-day photography", "Digital gallery"],
    "amount": 1000000,
    "currency": "NGN",
    "billingInterval": "monthly",
    "isActive": true,
    "createdBy": "66f123456789012345678902",
    "updatedBy": "66f123456789012345678902",
    "createdAt": "2026-10-01T12:00:00.000Z",
    "updatedAt": "2026-10-01T12:00:00.000Z",
    "__v": 0
  }
}
```

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

**Response (201):**

```json
{
    "success": true,
    "message": "Package created successfully",
    "data": {
        "_id": "6aedbcef0a487be5942304f0",
        "name": "Basic.",
        "description": "Photography + videography",
        "features": [
            "Full-day photography & video",
            "Edited keepsake film",
            "Printed album, 40 pages",
            "Digital gallery for family abroad"
        ],
        "amount": 100000000,
        "currency": "NGN",
        "billingInterval": "monthly",
        "isActive": true,
        "createdBy": "6aedb9f80a487be5942304ef",
        "updatedBy": "6aedb9f80a487be5942304ef",
        "createdAt": "2026-11-06T11:41:35.492Z",
        "updatedAt": "2026-11-06T11:41:35.955Z",
        "__v": 0
    }
}
```

</details>

<details>
<summary><strong>PATCH /packages/:id — Update, activate, or deactivate package</strong></summary>

- **Method:** `PATCH`
- **URL:** `/api/v1/packages/:id`
- **Auth:** Required
- **Role:** Admin or super admin

Accepts editable package fields, including `isActive` and `billingInterval` (`monthly`). Commercial term changes create a new provider plan version. Existing plans keep their package snapshot and contribution amount.

**Errors:** `400` invalid id or protected field, `404` package not found.

**Response (200):**

```json
{
  "success": true,
  "message": "Package updated successfully",
  "data": {
    "_id": "66f123456789012345678901",
    "name": "Classic Memorial",
    "description": "Configured commercial package terms",
    "features": ["Half-day photography", "Digital gallery"],
    "amount": 1000000,
    "currency": "NGN",
    "billingInterval": "monthly",
    "isActive": true,
    "createdBy": "66f123456789012345678902",
    "updatedBy": "66f123456789012345678902",
    "createdAt": "2026-10-01T12:00:00.000Z",
    "updatedAt": "2026-10-02T12:00:00.000Z",
    "__v": 0
  }
}
```

</details>
---

## Plans

<details>
<summary><strong>GET /plans/dashboard — Get my dashboard summary</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/plans/dashboard`
- **Auth:** Required

Returns successful contributed amount in minor units, successful payment count for the current calendar month, active plan count, and the next future payment date across the authenticated owner's plans. For NGN, `1000000` means ₦10,000.

**Response (200):**

```json
{
  "success": true,
  "message": "Dashboard summary retrieved successfully",
  "data": {
    "totalContributed": 1000000,
    "paymentCount": 2,
    "activePlans": 1,
    "nextPaymentDate": "2026-12-01T00:00:00.000Z"
  }
}
```
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

**Response (201):**

```json
{
  "success": true,
  "message": "Plan created successfully",
  "data": {
    "_id": "66f123456789012345678901",
    "owner": "66f123456789012345678902",
    "package": "66f123456789012345678903",
    "packageDetails": {
      "packageId": "66f123456789012345678903",
      "name": "Classic Memorial",
      "description": "Configured commercial package terms",
      "features": ["Half-day photography", "Digital gallery"],
      "amount": 1000000,
      "currency": "NGN"
    },
    "coveredPerson": {
      "fullName": "Chinedu Okafor",
      "dateOfBirth": "1958-04-10T00:00:00.000Z",
      "gender": "male",
      "relationship": "father",
      "address": "12 Market Road, Enugu",
      "phoneNumber": "08030000000"
    },
    "amount": 1000000,
    "currency": "NGN",
    "billingInterval": "monthly",
    "startDate": "2026-11-04T12:00:00.000Z",
    "totalContributedAmount": 0,
    "status": "Pending",
    "coverageStatus": "Pending",
    "createdAt": "2026-11-04T12:00:00.000Z",
    "updatedAt": "2026-11-04T12:00:00.000Z",
    "__v": 0
  }
}
```

**Business rules:** plan activation requires a verified successful initial payment.

</details>

<details>
<summary><strong>GET /plans — List my plans</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/plans`
- **Auth:** Required

Returns only plans owned by the authenticated user. Supports `page`, `limit` (maximum 100), `name` (covered-person name), `status`, `from`, and `to` (creation date range). Response data contains `items` and pagination metadata.

**Response (200):**

```json
{
  "success": true,
  "message": "Plans retrieved successfully",
  "data": {
    "items": [{
      "_id": "66f123456789012345678901",
      "owner": "66f123456789012345678902",
      "package": "66f123456789012345678903",
      "packageDetails": {
        "packageId": "66f123456789012345678903",
        "name": "Classic Memorial",
        "description": "Configured commercial package terms",
        "features": ["Half-day photography", "Digital gallery"],
        "amount": 1000000,
        "currency": "NGN"
      },
      "coveredPerson": {
        "fullName": "Chinedu Okafor",
        "dateOfBirth": "1958-04-10T00:00:00.000Z",
        "gender": "male",
        "relationship": "father",
        "address": "12 Market Road, Enugu",
        "phoneNumber": "08030000000"
      },
      "amount": 1000000,
      "currency": "NGN",
      "billingInterval": "monthly",
      "startDate": "2026-11-04T12:00:00.000Z",
      "totalContributedAmount": 0,
      "status": "Pending",
      "coverageStatus": "Pending",
      "createdAt": "2026-11-04T12:00:00.000Z",
      "updatedAt": "2026-11-04T12:00:00.000Z",
      "__v": 0
    }],
    "pagination": {"page": 1, "limit": 20, "total": 1, "totalPages": 1, "hasNextPage": false, "hasPreviousPage": false}
  }
}
```

</details>

<details>
<summary><strong>GET /plans/admin — List all plans</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/plans/admin`
- **Auth:** Required
- **Role:** Admin or super admin

Supports `page`, `limit` (maximum 100), `status`, `ownerId`, `packageId`, and `search` filters. `search` matches covered-person name. Response data contains `items` and pagination metadata.

**Response (200):** same plan fields and pagination structure as `GET /plans`; each plan's `owner` is populated with the owner's `_id`, `name`, and `email`.

```json
{
  "success": true,
  "message": "Plans retrieved successfully",
  "data": {
    "items": [{
      "_id": "66f123456789012345678901",
      "owner": {"_id": "66f123456789012345678902", "name": "Ada Okafor", "email": "ada@example.com"},
      "package": "66f123456789012345678903",
      "packageDetails": {"packageId": "66f123456789012345678903", "name": "Classic Memorial", "description": "Configured commercial package terms", "features": ["Half-day photography", "Digital gallery"], "amount": 1000000, "currency": "NGN"},
      "coveredPerson": {"fullName": "Chinedu Okafor", "dateOfBirth": "1958-04-10T00:00:00.000Z", "gender": "male", "relationship": "father", "address": "12 Market Road, Enugu", "phoneNumber": "08030000000"},
      "amount": 1000000,
      "currency": "NGN",
      "billingInterval": "monthly",
      "startDate": "2026-11-04T12:00:00.000Z",
      "totalContributedAmount": 0,
      "status": "Pending",
      "coverageStatus": "Pending",
      "createdAt": "2026-11-04T12:00:00.000Z",
      "updatedAt": "2026-11-04T12:00:00.000Z",
      "__v": 0
    }],
    "pagination": {"page": 1, "limit": 20, "total": 1, "totalPages": 1, "hasNextPage": false, "hasPreviousPage": false}
  }
}
```
</details>

<details>
<summary><strong>GET /plans/:id — Get plan</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/plans/:id`
- **Auth:** Required

Customers can retrieve only their own plans. Admins can retrieve any plan.

**Response (200):** returns the plan object shown in the `POST /plans` response, including its package snapshot and covered-person details.

```json
{
  "success": true,
  "message": "Plan retrieved successfully",
  "data": {
    "_id": "66f123456789012345678901",
    "owner": "66f123456789012345678902",
    "package": "66f123456789012345678903",
    "packageDetails": {"packageId": "66f123456789012345678903", "name": "Classic Memorial", "description": "Configured commercial package terms", "features": ["Half-day photography", "Digital gallery"], "amount": 1000000, "currency": "NGN"},
    "coveredPerson": {"fullName": "Chinedu Okafor", "dateOfBirth": "1958-04-10T00:00:00.000Z", "gender": "male", "relationship": "father", "address": "12 Market Road, Enugu", "phoneNumber": "08030000000"},
    "amount": 1000000,
    "currency": "NGN",
    "billingInterval": "monthly",
    "startDate": "2026-11-04T12:00:00.000Z",
    "totalContributedAmount": 0,
    "status": "Pending",
    "coverageStatus": "Pending",
    "createdAt": "2026-11-04T12:00:00.000Z",
    "updatedAt": "2026-11-04T12:00:00.000Z",
    "__v": 0
  }
}
```

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

**Response (200):**

```json
{
  "success": true,
  "message": "Plan status updated successfully",
  "data": {
    "_id": "66f123456789012345678901",
    "owner": "66f123456789012345678902",
    "package": "66f123456789012345678903",
    "packageDetails": {"packageId": "66f123456789012345678903", "name": "Classic Memorial", "description": "Configured commercial package terms", "features": ["Half-day photography", "Digital gallery"], "amount": 1000000, "currency": "NGN"},
    "coveredPerson": {"fullName": "Chinedu Okafor", "dateOfBirth": "1958-04-10T00:00:00.000Z", "gender": "male", "relationship": "father", "address": "12 Market Road, Enugu", "phoneNumber": "08030000000"},
    "amount": 1000000,
    "currency": "NGN",
    "billingInterval": "monthly",
    "startDate": "2026-11-04T12:00:00.000Z",
    "totalContributedAmount": 0,
    "status": "Under_Review",
    "coverageStatus": "Pending",
    "createdAt": "2026-11-04T12:00:00.000Z",
    "updatedAt": "2026-11-04T12:10:00.000Z",
    "__v": 1
  }
}
```

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

**Response (200):**

```json
{
  "success": true,
  "message": "Payment verified successfully",
  "data": {
    "_id": "66f123456789012345678904",
    "owner": "66f123456789012345678902",
    "plan": "66f123456789012345678901",
    "amount": 1000000,
    "currency": "NGN",
    "reference": "jh_init_example-reference",
    "providerReference": "jh_init_example-reference",
    "provider": "paystack",
    "purpose": "initial_contribution",
    "status": "Successful",
    "providerTransactionId": "123456789",
    "processedAt": "2026-11-04T12:05:00.000Z",
    "metadata": {"providerStatus": "success"},
    "createdAt": "2026-11-04T12:00:00.000Z",
    "updatedAt": "2026-11-04T12:05:00.000Z",
    "__v": 0
  }
}
```

</details>

<details>
<summary><strong>POST /payments/webhooks/paystack — Paystack webhook</strong></summary>

- **Method:** `POST`
- **URL:** `/api/v1/payments/webhooks/paystack`
- **Auth:** Paystack signature required

Verifies `x-paystack-signature` against the raw request body using HMAC SHA512. Re-verifies `charge.success` transactions server-side, links `subscription.create` to the pending local subscription, and applies successful recurring charges once. Invoice events synchronize a provider-reported next payment date where present. Events are durably recorded; repeated or out-of-order events can be retried without double-counting a contribution.

**Idempotency:** provider events are deduplicated by event name plus provider transaction reference/id. Duplicate deliveries do not double-count contributions.

**Response (200):**

```json
{
  "success": true,
  "message": "Webhook processed",
  "data": { "status": "Processed" }
}
```

For an event already processed or ignored, `data.status` is `"duplicate"`.

</details>

<details>
<summary><strong>GET /payments — List my payment history</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/payments`
- **Auth:** Required

Returns only payment records owned by the authenticated user. Supports `page`, `limit` (maximum 100), `status`, `purpose`, `planId`, `from`, and `to` filters. Authorization codes and provider secrets are not exposed. Response data contains `items` and pagination metadata.

**Response (200):**

```json
{
  "success": true,
  "message": "Payments retrieved successfully",
  "data": {
    "items": [{
      "_id": "66f123456789012345678904",
      "owner": "66f123456789012345678902",
      "plan": "66f123456789012345678901",
      "amount": 1000000,
      "currency": "NGN",
      "reference": "jh_init_example-reference",
      "providerReference": "jh_init_example-reference",
      "provider": "paystack",
      "purpose": "initial_contribution",
      "status": "Successful",
      "createdAt": "2026-11-04T12:00:00.000Z",
      "updatedAt": "2026-11-04T12:05:00.000Z",
      "__v": 0
    }],
    "pagination": {"page": 1, "limit": 20, "total": 1, "totalPages": 1, "hasNextPage": false, "hasPreviousPage": false}
  }
}
```

</details>

<details>
<summary><strong>GET /payments/:id — Get payment detail</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/payments/:id`
- **Auth:** Required

Returns one owned payment record.

**Response (200):**

```json
{
  "success": true,
  "message": "Payment retrieved successfully",
  "data": {
    "_id": "66f123456789012345678904",
    "owner": "66f123456789012345678902",
    "plan": "66f123456789012345678901",
    "amount": 1000000,
    "currency": "NGN",
    "reference": "jh_init_example-reference",
    "providerReference": "jh_init_example-reference",
    "provider": "paystack",
    "purpose": "initial_contribution",
    "status": "Successful",
    "providerTransactionId": "123456789",
    "processedAt": "2026-11-04T12:05:00.000Z",
    "metadata": {"providerStatus": "success"},
    "createdAt": "2026-11-04T12:00:00.000Z",
    "updatedAt": "2026-11-04T12:05:00.000Z",
    "__v": 0
  }
}
```

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

**Response (200):**

```json
{
  "success": true,
  "message": "Notifications retrieved successfully",
  "data": {
    "items": [{
      "_id": "66f123456789012345678901",
      "userId": "66f123456789012345678902",
      "title": "Contribution received",
      "message": "Your scheduled plan contribution was received successfully.",
      "event": "RecurringPaymentSuccess",
      "dedupeKey": "66f123456789012345678904:RecurringPaymentSuccess",
      "channel": "in_app",
      "isRead": false,
      "createdAt": "2026-11-04T12:00:00.000Z",
      "__v": 0
    }],
    "pagination": {"page": 1, "limit": 20, "total": 1, "totalPages": 1, "hasNextPage": false, "hasPreviousPage": false},
    "counts": {"totalNotifications": 5, "totalUnreadNotifications": 2}
  }
}
```
</details>

<details>
<summary><strong>PATCH /notifications/:id/read — Mark notification as read</strong></summary>

- **Method:** `PATCH`
- **URL:** `/api/v1/notifications/:id/read`
- **Auth:** Required

Marks one notification owned by the authenticated user as read. Other users' notifications are not accessible.

**Response (200):**

```json
{
  "success": true,
  "message": "Notification marked as read",
  "data": {
    "_id": "66f123456789012345678901",
    "userId": "66f123456789012345678902",
    "title": "Contribution received",
    "message": "Your scheduled plan contribution was received successfully.",
    "event": "RecurringPaymentSuccess",
    "dedupeKey": "66f123456789012345678904:RecurringPaymentSuccess",
    "channel": "in_app",
    "isRead": true,
    "createdAt": "2026-11-04T12:00:00.000Z",
    "__v": 0
  }
}
```
</details>

<details>
<summary><strong>DELETE /notifications/:id — Delete notification</strong></summary>

- **Method:** `DELETE`
- **URL:** `/api/v1/notifications/:id`
- **Auth:** Required

Deletes one notification owned by the authenticated user. Other users' notifications are not accessible.

**Response (200):**

```json
{
  "success": true,
  "message": "Notification deleted successfully",
  "data": {
    "_id": "66f123456789012345678901",
    "userId": "66f123456789012345678902",
    "title": "Contribution received",
    "message": "Your scheduled plan contribution was received successfully.",
    "event": "RecurringPaymentSuccess",
    "dedupeKey": "66f123456789012345678904:RecurringPaymentSuccess",
    "channel": "in_app",
    "isRead": false,
    "createdAt": "2026-11-04T12:00:00.000Z",
    "__v": 0
  }
}
```
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

**Response (201):**

```json
{
  "success": true,
  "message": "Service request submitted successfully",
  "data": {
    "_id": "66f123456789012345678901",
    "owner": "66f123456789012345678902",
    "plan": "66f123456789012345678903",
    "coveredPersonSnapshot": {
      "fullName": "Chinedu Okafor",
      "dateOfBirth": "1958-04-10T00:00:00.000Z",
      "gender": "male",
      "relationship": "father",
      "address": "12 Market Road, Enugu",
      "phoneNumber": "08030000000"
    },
    "dateOfDeath": "2026-10-01T00:00:00.000Z",
    "serviceLocation": "Nsukka, Enugu State",
    "expectedServiceDate": "2026-10-20T10:00:00.000Z",
    "contactPerson": "Ada Okafor",
    "contactPhone": "08030000000",
    "additionalInformation": "Family contact is available at the location.",
    "status": "Submitted",
    "createdAt": "2026-11-04T12:00:00.000Z",
    "updatedAt": "2026-11-04T12:00:00.000Z",
    "__v": 0
  }
}
```

**Business rules:** submitting a request moves the plan into `Service_Request`. Required document rules are configurable operationally; the implementation supports death certificate, valid identification, and other proof documents.

</details>

<details>
<summary><strong>GET /service-requests — List my service requests</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/service-requests`
- **Auth:** Required

Returns only service requests owned by the authenticated user. Each request includes its `documents` array; each document includes a temporary `url` (valid for 900 seconds) for downloading the associated file.

**Response (200):**

```json
{
  "success": true,
  "message": "Service requests retrieved successfully",
  "data": [{
    "_id": "66f123456789012345678901",
    "owner": "66f123456789012345678902",
    "plan": "66f123456789012345678903",
    "coveredPersonSnapshot": {"fullName": "Chinedu Okafor", "dateOfBirth": "1958-04-10T00:00:00.000Z", "gender": "male", "relationship": "father", "address": "12 Market Road, Enugu", "phoneNumber": "08030000000"},
    "dateOfDeath": "2026-10-01T00:00:00.000Z",
    "serviceLocation": "Nsukka, Enugu State",
    "expectedServiceDate": "2026-10-20T10:00:00.000Z",
    "contactPerson": "Ada Okafor",
    "contactPhone": "08030000000",
    "additionalInformation": "Family contact is available at the location.",
    "status": "Submitted",
    "documents": [],
    "createdAt": "2026-11-04T12:00:00.000Z",
    "updatedAt": "2026-11-04T12:00:00.000Z",
    "__v": 0
  }]
}
```

</details>

<details>
<summary><strong>GET /service-requests/:id — Get service request detail</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/service-requests/:id`
- **Auth:** Required

Customers can retrieve only their own requests. Admins can retrieve any request. The response includes the request and its document records. Documents appear in the request's `documents` array and in the existing top-level `documents` field; each includes a temporary `url` (valid for 900 seconds).

**Response (200):**

```json
{
  "success": true,
  "message": "Service request retrieved successfully",
  "data": {
    "request": {
      "_id": "66f123456789012345678901",
      "owner": "66f123456789012345678902",
      "plan": "66f123456789012345678903",
      "coveredPersonSnapshot": {"fullName": "Chinedu Okafor", "dateOfBirth": "1958-04-10T00:00:00.000Z", "gender": "male", "relationship": "father", "address": "12 Market Road, Enugu", "phoneNumber": "08030000000"},
      "dateOfDeath": "2026-10-01T00:00:00.000Z",
      "serviceLocation": "Nsukka, Enugu State",
      "expectedServiceDate": "2026-10-20T10:00:00.000Z",
      "contactPerson": "Ada Okafor",
      "contactPhone": "08030000000",
      "additionalInformation": "Family contact is available at the location.",
      "status": "Submitted",
      "documents": [],
      "createdAt": "2026-11-04T12:00:00.000Z",
      "updatedAt": "2026-11-04T12:00:00.000Z",
      "__v": 0
    },
    "documents": []
  }
}
```

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

**Response (201):**

```json
{
  "success": true,
  "message": "Service document upload completed successfully",
  "data": {
    "_id": "66f123456789012345678905",
    "serviceRequest": "66f123456789012345678901",
    "owner": "66f123456789012345678902",
    "plan": "66f123456789012345678903",
    "file": "66f123456789012345678906",
    "documentType": "Death_Certificate",
    "verificationStatus": "Pending",
    "uploadedAt": "2026-11-04T12:05:00.000Z",
    "createdAt": "2026-11-04T12:05:00.000Z",
    "updatedAt": "2026-11-04T12:05:00.000Z",
    "__v": 0
  }
}
```

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

**Response (200):**

```json
{
  "success": true,
  "message": "Service document verification updated",
  "data": {
    "_id": "66f123456789012345678905",
    "serviceRequest": "66f123456789012345678901",
    "owner": "66f123456789012345678902",
    "plan": "66f123456789012345678903",
    "file": "66f123456789012345678906",
    "documentType": "Death_Certificate",
    "verificationStatus": "Approved",
    "uploadedAt": "2026-11-04T12:05:00.000Z",
    "verifiedAt": "2026-11-04T12:10:00.000Z",
    "verifiedBy": "66f123456789012345678907",
    "createdAt": "2026-11-04T12:05:00.000Z",
    "updatedAt": "2026-11-04T12:10:00.000Z",
    "__v": 0
  }
}
```

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

**Response (200):**

```json
{
  "success": true,
  "message": "Service request status updated",
  "data": {
    "_id": "66f123456789012345678901",
    "owner": "66f123456789012345678902",
    "plan": "66f123456789012345678903",
    "coveredPersonSnapshot": {"fullName": "Chinedu Okafor", "dateOfBirth": "1958-04-10T00:00:00.000Z", "gender": "male", "relationship": "father", "address": "12 Market Road, Enugu", "phoneNumber": "08030000000"},
    "dateOfDeath": "2026-10-01T00:00:00.000Z",
    "serviceLocation": "Nsukka, Enugu State",
    "expectedServiceDate": "2026-10-20T10:00:00.000Z",
    "contactPerson": "Ada Okafor",
    "contactPhone": "08030000000",
    "additionalInformation": "Family contact is available at the location.",
    "status": "Under_Review",
    "reviewedBy": "66f123456789012345678907",
    "createdAt": "2026-11-04T12:00:00.000Z",
    "updatedAt": "2026-11-04T12:10:00.000Z",
    "__v": 0
  }
}
```

</details>

---

## Contact

<details>
<summary><strong>POST /contact — Submit a contact message</strong></summary>

- **Method:** `POST`
- **URL:** `/api/v1/contact`
- **Auth:** Not required

Stores a message from the website contact form. All fields are required. `topic` must be one of `Starting a plan`, `An existing plan`, `Photographer network`, or `Something else`.

```json
{
  "name": "Adebayo Okafor",
  "phone": "+2348012345678",
  "email": "adebayo@example.com",
  "topic": "An existing plan",
  "message": "I have a question about my monthly contribution."
}
```

**Response (201):**

```json
{
  "success": true,
  "message": "Your message has been sent successfully",
  "data": {
    "_id": "66f123456789012345678901",
    "name": "Adebayo Okafor",
    "phone": "+2348012345678",
    "email": "adebayo@example.com",
    "topic": "An existing plan",
    "message": "I have a question about my monthly contribution.",
    "createdAt": "2026-11-04T12:00:00.000Z",
    "updatedAt": "2026-11-04T12:00:00.000Z",
    "__v": 0
  }
}
```

</details>

<details>
<summary><strong>GET /contact/admin — List contact messages</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/contact/admin`
- **Auth:** Required
- **Authorization:** Admin or super admin
- **Query Parameters:** Optional `page`, `limit` (maximum 100), and `search`

Returns contact submissions newest first with pagination metadata. `search` matches the submitter's name or email address, case-insensitively.

```text
GET /api/v1/contact/admin?search=adebayo&page=1&limit=20
```

**Response (200):**

```json
{
  "success": true,
  "message": "Contact messages retrieved successfully",
  "data": {
    "items": [{"_id": "66f123456789012345678901", "name": "Adebayo Okafor", "phone": "+2348012345678", "email": "adebayo@example.com", "topic": "An existing plan", "message": "I have a question about my monthly contribution.", "createdAt": "2026-11-04T12:00:00.000Z", "updatedAt": "2026-11-04T12:00:00.000Z", "__v": 0}],
    "pagination": {"page": 1, "limit": 20, "total": 1, "totalPages": 1, "hasNextPage": false, "hasPreviousPage": false}
  }
}
```

</details>

<details>
<summary><strong>GET /contact/admin/:id — Get one contact message</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/contact/admin/:id`
- **Auth:** Required
- **Authorization:** Admin or super admin

Returns a single contact submission. An invalid ID returns `400`; a valid ID with no matching submission returns `404`.

**Response (200):**

```json
{
  "success": true,
  "message": "Contact message retrieved successfully",
  "data": {
    "_id": "66f123456789012345678901",
    "name": "Adebayo Okafor",
    "phone": "+2348012345678",
    "email": "adebayo@example.com",
    "topic": "An existing plan",
    "message": "I have a question about my monthly contribution.",
    "createdAt": "2026-11-04T12:00:00.000Z",
    "updatedAt": "2026-11-04T12:00:00.000Z",
    "__v": 0
  }
}
```

</details>

---

## Audit Log

All endpoints in this section require a bearer token and admin authorization (Admin or Super Admin).

<details>
<summary><strong>GET /audit-logs — List audit logs</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/audit-logs`
- **Auth:** Required
- **Authorization:** Admin or super admin
- **Query Parameters:**
  - `page`: Page number (optional, default: `1`)
  - `limit`: Number of records per page (optional, default: `20`, maximum: `100`)
  - `startDate` or `from`: Filter logs created on or after date (`YYYY-MM-DD` or ISO date-time string)
  - `endDate` or `to`: Filter logs created on or before date (`YYYY-MM-DD` or ISO date-time string)
  - `action`: Filter by action name (optional)
  - `resourceType`: Filter by resource type (optional)
  - `resourceId`: Filter by target resource ID (optional)

Returns a paginated list of system audit logs sorted newest first. Populates the `actor` with `name`, `email`, and `role`.

### Example

```text
GET /api/v1/audit-logs?page=1&limit=20
```

### Example with date range filter

```text
GET /api/v1/audit-logs?startDate=2026-10-01&endDate=2026-10-31&page=1&limit=20
```

**Response (200):**

```json
{
  "success": true,
  "message": "Audit logs retrieved successfully",
  "data": {
    "items": [
      {
        "_id": "66f123456789012345678901",
        "actor": {
          "_id": "66f123456789012345678902",
          "name": "Jane Admin",
          "email": "admin@example.com",
          "role": "Admin"
        },
        "action": "service_request.approved",
        "resourceType": "ServiceRequest",
        "resourceId": "66f123456789012345678903",
        "metadata": {
          "reason": "All documents verified"
        },
        "createdAt": "2026-11-04T12:00:00.000Z",
        "updatedAt": "2026-11-04T12:00:00.000Z",
        "__v": 0
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPreviousPage": false
    }
  }
}
```

</details>

<details>
<summary><strong>GET /audit-logs/:id — Get one audit log</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/audit-logs/:id`
- **Auth:** Required
- **Authorization:** Admin or super admin

Returns a single audit log by its ID. Populates the `actor` with `name`, `email`, and `role`. An invalid ID returns `400`; a valid ID with no matching log returns `404`.

### Example

```text
GET /api/v1/audit-logs/66f123456789012345678901
```

**Response (200):**

```json
{
  "success": true,
  "message": "Audit log retrieved successfully",
  "data": {
    "_id": "66f123456789012345678901",
    "actor": {
      "_id": "66f123456789012345678902",
      "name": "Jane Admin",
      "email": "admin@example.com",
      "role": "Admin"
    },
    "action": "service_request.approved",
    "resourceType": "ServiceRequest",
    "resourceId": "66f123456789012345678903",
    "metadata": {
      "reason": "All documents verified"
    },
    "createdAt": "2026-11-04T12:00:00.000Z",
    "updatedAt": "2026-11-04T12:00:00.000Z",
    "__v": 0
  }
}
```

</details>

<details>
<summary><strong>DELETE /audit-logs/:id — Delete an audit log</strong></summary>

- **Method:** `DELETE`
- **URL:** `/api/v1/audit-logs/:id`
- **Auth:** Required
- **Authorization:** Admin or super admin

Permanently removes an audit log record by its ID. An invalid ID returns `400`; a valid ID with no matching log returns `404`.

### Example

```text
DELETE /api/v1/audit-logs/66f123456789012345678901
```

**Response (200):**

```json
{
  "success": true,
  "message": "Audit log deleted successfully",
  "data": {
    "_id": "66f123456789012345678901",
    "actor": "66f123456789012345678902",
    "action": "service_request.approved",
    "resourceType": "ServiceRequest",
    "resourceId": "66f123456789012345678903",
    "metadata": {
      "reason": "All documents verified"
    },
    "createdAt": "2026-11-04T12:00:00.000Z",
    "updatedAt": "2026-11-04T12:00:00.000Z",
    "__v": 0
  }
}
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

**Response (200):**

```json
{
  "success": true,
  "message": "Admin dashboard overview retrieved successfully",
  "data": {
    "users": {"total": 120, "newThisMonth": 8},
    "plans": {"active": 45, "overdue": 3, "pendingFirstPayment": 6, "completed": 12},
    "contributions": {"totalContributed": 150000000, "selectedPeriodContributed": 12000000, "monthlyContributed": 22000000, "monthlyCommitments": 45000000, "averagePerActivePlan": 3333333, "activePlanCount": 45},
    "serviceRequests": {"new": 2, "inReview": 4, "awaitingCustomer": 1, "approved": 3, "closed": 5, "pendingVerification": 6},
    "needsReview": [],
    "period": {"startDate": "2026-10-01T00:00:00.000Z", "endDate": "2026-10-26T23:59:59.999Z"}
  }
}
```
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

**Response (200):**

```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": {
    "items": [{"_id": "66f123456789012345678901", "name": "Ada Okafor", "email": "ada@example.com", "createdAt": "2026-10-01T12:00:00.000Z", "planCount": 2, "totalSaved": 1500000, "activePlanCount": 1, "status": "Active_Plan"}],
    "pagination": {"page": 1, "limit": 20, "total": 1, "totalPages": 1, "hasNextPage": false, "hasPreviousPage": false}
  }
}
```
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

The response shape and sample are documented under `GET /plans/admin` in the `## Plans` section.
</details>

<details>
<summary><strong>GET /service-requests/admin — Admin service request queue</strong></summary>

- **Method:** `GET`
- **URL:** `/api/v1/service-requests/admin`
- **Auth:** Required
- **Authorization:** Admin or super admin
- **Query Parameters:** Optional `search`, `status`, `ownerId`, `planId`, `from`, `to`, `page`, and `limit` (maximum 100)

`search` matches covered-person name, location, or owner's name/email. Dates filter request creation time. Statuses include `Submitted`, `Under_Review`, `More_Info_Required`, `Docs_Verified`, `Approved`, `Rejected`, `Cancelled`, and `Closed`.

Each request includes its `documents` array; each document includes a temporary `url` (valid for 900 seconds) for downloading the associated file.

### Example

`GET /api/v1/service-requests/admin?status=Under_Review&page=1&limit=20`

### Example with date range

`GET /api/v1/service-requests/admin?from=2026-10-01&to=2026-10-26&page=1&limit=50`

### Example with search

`GET /api/v1/service-requests/admin?search=Adebayo&page=1&limit=20`

### Combined query example

`GET /api/v1/service-requests/admin?search=Ikoyi&status=Submitted&from=2026-10-01&to=2026-10-26&page=1&limit=20`

**Response (200):**

```json
{
  "success": true,
  "message": "Service requests retrieved successfully",
  "data": {
    "items": [{
      "_id": "66f123456789012345678901",
      "owner": {"_id": "66f123456789012345678902", "name": "Ada Okafor", "email": "ada@example.com"},
      "plan": {"_id": "66f123456789012345678903", "packageDetails": {"name": "Classic Memorial"}},
      "coveredPersonSnapshot": {"fullName": "Chinedu Okafor", "dateOfBirth": "1958-04-10T00:00:00.000Z", "gender": "male", "relationship": "father", "address": "12 Market Road, Enugu", "phoneNumber": "08030000000"},
      "dateOfDeath": "2026-10-01T00:00:00.000Z",
      "serviceLocation": "Nsukka, Enugu State",
      "expectedServiceDate": "2026-10-20T10:00:00.000Z",
      "contactPerson": "Ada Okafor",
      "contactPhone": "08030000000",
      "status": "Under_Review",
      "documents": [],
      "createdAt": "2026-11-04T12:00:00.000Z",
      "updatedAt": "2026-11-04T12:00:00.000Z",
      "__v": 0
    }],
    "pagination": {"page": 1, "limit": 20, "total": 1, "totalPages": 1, "hasNextPage": false, "hasPreviousPage": false}
  }
}
```
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

**Response (200):**

```json
{
  "success": true,
  "message": "Service request status updated",
  "data": {
    "_id": "66f123456789012345678901",
    "owner": "66f123456789012345678902",
    "plan": "66f123456789012345678903",
    "coveredPersonSnapshot": {"fullName": "Chinedu Okafor", "dateOfBirth": "1958-04-10T00:00:00.000Z", "gender": "male", "relationship": "father", "address": "12 Market Road, Enugu", "phoneNumber": "08030000000"},
    "dateOfDeath": "2026-10-01T00:00:00.000Z",
    "serviceLocation": "Nsukka, Enugu State",
    "expectedServiceDate": "2026-10-20T10:00:00.000Z",
    "contactPerson": "Ada Okafor",
    "contactPhone": "08030000000",
    "status": "Approved",
    "approvedAt": "2026-11-04T12:10:00.000Z",
    "reviewedBy": "66f123456789012345678907",
    "createdAt": "2026-11-04T12:00:00.000Z",
    "updatedAt": "2026-11-04T12:10:00.000Z",
    "__v": 0
  }
}
```
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

**Response (200):**

```json
{
  "success": true,
  "message": "Photographer assigned and service request closed",
  "data": {
    "_id": "66f123456789012345678901",
    "owner": "66f123456789012345678902",
    "plan": "66f123456789012345678903",
    "coveredPersonSnapshot": {"fullName": "Chinedu Okafor", "dateOfBirth": "1958-04-10T00:00:00.000Z", "gender": "male", "relationship": "father", "address": "12 Market Road, Enugu", "phoneNumber": "08030000000"},
    "dateOfDeath": "2026-10-01T00:00:00.000Z",
    "serviceLocation": "Nsukka, Enugu State",
    "expectedServiceDate": "2026-10-20T10:00:00.000Z",
    "contactPerson": "Ada Okafor",
    "contactPhone": "08030000000",
    "status": "Closed",
    "photographerName": "Adebayo Johnson",
    "photographerAssignedAt": "2026-11-04T12:10:00.000Z",
    "reviewedBy": "66f123456789012345678907",
    "createdAt": "2026-11-04T12:00:00.000Z",
    "updatedAt": "2026-11-04T12:10:00.000Z",
    "__v": 0
  }
}
```
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

**Response (200):**

```json
{
  "success": true,
  "message": "Payments retrieved successfully",
  "data": {
    "items": [{
      "_id": "66f123456789012345678904",
      "owner": {"_id": "66f123456789012345678902", "name": "Ada Okafor", "email": "ada@example.com"},
      "plan": {"_id": "66f123456789012345678903", "coveredPerson": {"fullName": "Chinedu Okafor", "relationship": "father"}, "packageDetails": {"name": "Classic Memorial", "amount": 1000000, "currency": "NGN"}},
      "reference": "jh_init_example-reference",
      "amount": 1000000,
      "currency": "NGN",
      "purpose": "initial_contribution",
      "status": "Successful",
      "createdAt": "2026-11-04T12:00:00.000Z"
    }],
    "pagination": {"page": 1, "limit": 20, "total": 1, "totalPages": 1, "hasNextPage": false, "hasPreviousPage": false},
    "summary": {"Successful": {"amount": 1000000, "count": 1}, "Failed": {"amount": 0, "count": 0}}
  }
}
```
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
# Timestamped webhook signing secrets from Paystack. Supports key rotation:
# whk_current=whsec_current,whk_previous=whsec_previous
PAYSTACK_WEBHOOK_SECRETS=
PAYSTACK_WEBHOOK_TOLERANCE_SECONDS=300
PAYSTACK_BASE_URL=https://api.paystack.co
PAYSTACK_CALLBACK_URL=https://your-frontend.example.com/payments/callback
FRONTEND_URL=https://your-frontend.example.com

EMAIL_SERVICE_URL=https://email-service-one-alpha.vercel.app/api/mail/send
SUPER_ADMIN_EMAIL=admin@example.com
```

The Paystack webhook endpoint accepts both the legacy `x-paystack-signature` HMAC and the timestamped `Paystack-Signature` format. Configure `PAYSTACK_WEBHOOK_SECRETS` for the timestamped format; the value is a comma-separated list of secrets, optionally keyed by the webhook key ID (`whk_id=secret`) to support rotation. The endpoint acknowledges only after the sanitized event is durably stored. A MongoDB lease allows one backend instance to run the worker; it polls every 30 seconds and processes stored events with leases and retry backoff.

At startup, the service creates/verifies the unique Paystack event, payment provider-reference, and in-app notification deduplication indexes and initializes the outbox and worker lease collections. Existing duplicate payment provider references or notification dedupe keys must be reconciled before deployment because their unique indexes cannot be created while duplicates remain. Completed webhook and notification outbox records expire after 90 days; failed and exhausted records are retained. Webhook events exhaust after 20 attempts, and payment notification delivery exhausts after 10 attempts; exhausted records are logged for review. An abandoned initial checkout remains pending and can reuse its saved checkout URL.

## Commands

```bash
npm install
npm run dev
npm run build
npm start
```
