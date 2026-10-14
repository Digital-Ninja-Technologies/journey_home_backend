# ENDPOINTS DOCUMENTATION

## BASE URL:

## Auth

<details>
<summary><strong> Login </strong></summary>

**Url**: /auth/login
**Body**:

```json
{
  "email": "gavikinaenergy@gmail.com",
  "password": "admin123"
}
```

</details>



## File Upload & Tigris Storage Integration

<details>
<summary><strong>POST /files/upload-url — Request presigned upload URL</strong></summary>

- **Method:** `POST`
- **URL:** `/api/v1/files/upload-url`
- **Auth:** Not required (Supports public forms like career CV uploads)

### Request Body

```json
{
  "fileName": "project-cover.jpg",
  "contentType": "image/jpeg",
  "size": 382912,
  "purpose": "PROJECT_IMAGE"
}
```

**Supported Purposes:**
- `PROJECT_IMAGE`: Max 5 MB. Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`.
- `CV`: Max 10 MB. Allowed MIME types: `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
- `PROFILE_IMAGE`: Max 5 MB. Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`.
- `DOCUMENT`: Max 10 MB.
- `OTHER`: Max 10 MB.

### Response (201)

```json
{
  "success": true,
  "message": "Presigned upload URL generated successfully",
  "data": {
    "fileId": "65f8a1b2c3d4e5f6g7h8i9c0",
    "uploadUrl": "https://nasas-empire-bucket.t3.storage.dev/projects/f47ac10b-58cc-4372-a567-0e02b2c3d479.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&...",
    "uploadToken": "b6a71e89-1234-4a22-98ab-8c9012345678",
    "storageKey": "projects/f47ac10b-58cc-4372-a567-0e02b2c3d479.jpg",
    "expiresIn": 3600
  }
}
```

### Error Responses

**400 — Unsupported content type or size limit exceeded**

```json
{
  "success": false,
  "message": "Invalid content type 'application/x-msdownload' for purpose 'PROJECT_IMAGE'. Allowed types: image/jpeg, image/png, image/webp"
}
```
</details>

<details>
<summary><strong>POST /files/:id/complete — Verify and complete file upload</strong></summary>

- **Method:** `POST`
- **URL:** `/api/v1/files/:id/complete`
- **Auth:** Not required (Requires `uploadToken` generated during upload-url request)

### Request Body

```json
{
  "uploadToken": "b6a71e89-1234-4a22-98ab-8c9012345678"
}
```

### Response (200)

```json
{
  "success": true,
  "message": "File upload verified and completed",
  "data": {
    "file": {
      "_id": "65f8a1b2c3d4e5f6g7h8i9c0",
      "originalName": "project-cover.jpg",
      "storageKey": "projects/f47ac10b-58cc-4372-a567-0e02b2c3d479.jpg",
      "mimeType": "image/jpeg",
      "size": 382912,
      "actualSize": 382912,
      "purpose": "PROJECT_IMAGE",
      "status": "UPLOADED",
      "uploadToken": "b6a71e89-1234-4a22-98ab-8c9012345678",
      "createdAt": "2026-09-03T16:00:00.000Z",
      "updatedAt": "2026-09-03T16:00:05.000Z"
    },
    "url": "https://nasas-empire-bucket.t3.storage.dev/projects/f47ac10b-58cc-4372-a567-0e02b2c3d479.jpg?X-Amz-Algorithm=..."
  }
}
```

</details>

<details>
<summary><strong>DELETE /files/:id — Delete a file</strong></summary>

- **Method:** `DELETE`
- **URL:** `/api/v1/files/:id`
- **Auth:** Required (Admin)

### Response (200)

```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

</details>

---

<details>
<summary><strong> Direct File Upload & Storage — Step-by-Step Test Instructions </strong></summary>

### Flow A: Project Image Upload & Creation

#### Step 1: Request Presigned Upload URL for Project Image
**Endpoint:** `POST /api/v1/files/upload-url`

**Request Body:**
```json
{
  "fileName": "solar-installation-cover.jpg",
  "contentType": "image/jpeg",
  "size": 450000,
  "purpose": "PROJECT_IMAGE"
}
```

**Response:**
Save the returned `fileId`, `uploadUrl`, and `uploadToken`.

#### Step 2: Upload Binary Image File Directly to Tigris
**Method:** `PUT`
**URL:** `<uploadUrl from Step 1>`
**Headers:**
`Content-Type: image/jpeg`
**Body:** Binary file content (select file in Postman/curl).

#### Step 3: Complete Upload Verification
**Endpoint:** `POST /api/v1/files/:fileId/complete`

**Request Body:**
```json
{
  "uploadToken": "<uploadToken from Step 1>"
}
```

#### Step 4: Create Project with Uploaded Image File ID
**Endpoint:** `POST /api/v1/projects` (Auth required)

**Request Body:**
```json
{
  "title": "50kVA Solar Microgrid for Commercial Complex",
  "location": "VGC, Lekki, Lagos",
  "systemSize": "50kVA",
  "category": "business",
  "description": "Full commercial solar microgrid installation with lithium storage.",
  "photos": ["<fileId from Step 1>"],
  "isCaseStudy": true
}
```

#### Step 5: Verify Public & Admin Project Retrieval Returns Presigned Image URL
**Endpoint:** `GET /api/v1/projects`

**What to check:**
`data[0].photos[0]` is a valid, active presigned URL (`https://nasas-empire-bucket.t3.storage.dev/...`) that can be rendered directly inside an HTML `<img src="..." />` tag.

---

### Flow B: Career CV Upload & Job Application Submission

#### Step 1: Request Presigned Upload URL for Candidate CV
**Endpoint:** `POST /api/v1/files/upload-url`

**Request Body:**
```json
{
  "fileName": "emeka-okonkwo-cv.pdf",
  "contentType": "application/pdf",
  "size": 1250000,
  "purpose": "CV"
}
```

**Response:**
Save the returned `fileId`, `uploadUrl`, and `uploadToken`.

#### Step 2: Upload PDF File Directly to Tigris
**Method:** `PUT`
**URL:** `<uploadUrl from Step 1>`
**Headers:**
`Content-Type: application/pdf`
**Body:** Binary PDF content.

#### Step 3: Complete Upload Verification
**Endpoint:** `POST /api/v1/files/:fileId/complete`

**Request Body:**
```json
{
  "uploadToken": "<uploadToken from Step 1>"
}
```

#### Step 4: Submit Career Job Application
**Endpoint:** `POST /api/v1/enquiries` (Public)

**Request Body:**
```json
{
  "type": "careers",
  "source": "careers_application",
  "name": "Emeka Okonkwo",
  "email": "emeka.okonkwo@example.com",
  "phone": "08023456789",
  "details": {
    "roleAppliedFor": "Senior Solar Systems Engineer",
    "experience": "5 years designing and deploying commercial solar and hybrid systems.",
    "cv": "<fileId from Step 1>",
    "location": "Lagos, Nigeria"
  }
}
```

#### Step 5: Admin Views Candidate Application & Generates Secure Presigned CV Link
**Endpoint:** `GET /api/v1/enquiries/:enquiryId` (Auth required)

**What to check:**
In `data.details`, `cvUrl` contains a temporary presigned download URL for the private CV file stored in Tigris. Unauthorized users cannot access or view the candidate CV without an admin token.

---
</details>

---