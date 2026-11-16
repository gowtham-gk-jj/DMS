# Enterprise Document Management SaaS Platform (DMS)
### High-Density Siemens DOConCD Catalogue Architecture & Enterprise Access Control

An enterprise-grade, full-stack Document Management System (DMS) designed for engineering repositories, technical catalogues, and industrial documentation archives. Inspired by **Siemens DOConCD (SINUMERIK / SINAMICS)**, **Linear**, and **Stripe**, the application enforces a strict, premium black-and-white design system with granular role-based and folder-level access control.

---

## 1. System Overview & Core Capabilities

- **Strict Black & White SaaS Design System**: Engineered with pure `#FFFFFF` background, `#111111` typography, `#E5E5E5` borders, `#FAFAFA` cards, and high-density information tables. No colorful themes, gradients, or excessive card bloat.
- **Siemens DOConCD Document Browser**: Recreates the classic DOConCD catalogue table-of-contents layout. Features in-table section category headers (*Operation, Programming, Commissioning, Functions, SIMATIC, Info / Training, Service & Diagnostics*), compact rows, and metadata columns: `System`, `Title`, `SW Version`, `Edition`, `Order No.`, `File Code`, and `Actions`.
- **Google OAuth 2.0 & Identity Verification**: Users authenticate securely with their Google identity. Google login alone **never** grants automatic repository access.
- **Two-Phase Access Request & Approval Workflow**:
  1. First login routes new applicants to an access submission form (*Organization, Department, Reason, Intended Purpose*).
  2. Submissions alert administrators via real-time dashboard queues and automated email notifications.
  3. Administrators review applicants, assign roles, configure folder entitlements, and toggle granular permissions (`READ`, `UPLOAD`, `DOWNLOAD`, `MANAGE`).
  4. Applicants receive HTML notifications with their granted status and login link.
- **Granular Backend-Enforced Permissions**:
  - `READ`: Browse catalogues and preview documents in the embedded viewer.
  - `UPLOAD`: Multi-file drag-and-drop upload with full DOConCD metadata tagging.
  - `DOWNLOAD`: Strictly verified at the server. Unauthorized download requests are rejected with `HTTP 403 Forbidden`. Authorized users receive secure signed Cloudinary URLs.
  - `MANAGE`: Create nested subfolders, modify catalogue metadata, move documents, or archive items.
- **In-App Multi-Format Document Viewer**:
  - **PDF**: Embedded reader with page navigation, zoom controls (50% to 250%), fit to width, and fullscreen mode.
  - **Images**: Responsive canvas with zoom in/out, 90° rotation, fit to screen, and pan.
  - **Plain Text / CSV**: Clean formatted code/text viewer.
  - **Video / Audio**: HTML5 media playback for MP4, WebM, MP3, WAV.
  - **Office / CAD / Binaries**: Technical metadata inspector and authorized download fallback.
- **Global Search Engine Across All Pages**:
  - Accessible on all pages with `Ctrl + K` / `Cmd + K`.
  - Debounced partial-match and case-insensitive search across folders, document titles, Siemens system platforms (`840D sl`, `S120`), order numbers (`6FC5398...`), document codes (`BHUsl`, `PGsl`), and tags.
- **Cloud Infrastructure**:
  - **Database**: MongoDB Atlas 3-Node Replica Set with Mongoose ODM.
  - **File Storage**: Cloudinary secure stream-upload with signed delivery URLs.
  - **Audit Logs**: Immutable tracking of logins, approvals, previews, uploads, downloads, and permission revisions.

---

## 2. Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite 8, Tailwind CSS v4, React Router 7, Axios, Lucide React, Google Identity Services (`@react-oauth/google`) |
| **Backend** | Node.js (v24 LTS), Express.js 5, Helmet, CORS, Express Rate Limit, Morgan, JWT, Multer |
| **Database** | MongoDB Atlas, Mongoose ODM |
| **Storage** | Cloudinary SDK (Direct stream upload, asset lifecycle management) |
| **Email** | Nodemailer (OAuth2 / SMTP delivery engine with automated fallback & MongoDB `EmailLogs`) |

---

## 3. Project Directory Structure

```text
document-management-system/
|
|-- backend/
|   |-- src/
|   |   |-- config/
|   |   |   |-- db.js               # MongoDB Atlas connection
|   |   |   |-- cloudinary.js       # Cloudinary SDK configuration
|   |   |   |-- constants.js        # Roles, statuses, categories
|   |   |-- controllers/
|   |   |   |-- authController.js   # Google OAuth, dev switcher, profile
|   |   |   |-- requestController.js# Access request submission & review
|   |   |   |-- adminController.js  # Approvals, permissions, dashboard stats
|   |   |   |-- folderController.js # Nested folder CRUD & breadcrumb builder
|   |   |   |-- documentController.js# DOConCD listings, uploads, signed downloads
|   |   |   |-- searchController.js # Global search across catalogues
|   |   |   |-- auditController.js  # Security audit trail queries
|   |   |-- middleware/
|   |   |   |-- auth.js             # JWT verification & role validation
|   |   |   |-- permission.js       # Folder and document level security checks
|   |   |   |-- upload.js           # Multer memory storage stream handler
|   |   |   |-- errorHandler.js     # Centralized JSON error formatting
|   |   |-- models/
|   |   |   |-- User.js             # User accounts & base permissions
|   |   |   |-- AccessRequest.js    # Access request records
|   |   |   |-- Folder.js           # Nested folders with virtual counters
|   |   |   |-- Document.js         # DOConCD catalogue entries & Cloudinary IDs
|   |   |   |-- Permission.js       # Folder-level user permission overrides
|   |   |   |-- AuditLog.js         # Immutable audit records
|   |   |   |-- EmailLog.js         # Dispatched notification log
|   |   |   |-- AppSettings.js      # Global system properties
|   |   |-- routes/                 # REST API endpoints
|   |   |-- seeds/
|   |   |   |-- seedData.js         # Seeds Siemens DOConCD folders & sample manuals
|   |   |-- services/
|   |   |   |-- auditService.js     # Audit logging utility
|   |   |   |-- cloudinaryService.js# Stream upload & signed URL generation
|   |   |   |-- emailService.js     # Professional HTML email templates
|   |   |-- tests/
|   |   |   |-- testSuite.js        # 18 end-to-end integration test scenarios
|   |   |-- server.js               # Express application entry point
|   |-- .env                        # Active backend environment variables
|   |-- .env.example                # Empty placeholder template
|   |-- package.json
|
|-- frontend/
|   |-- src/
|   |   |-- components/
|   |   |   |-- DOConCDTable.jsx    # Siemens DOConCD Table-of-Contents component
|   |   |   |-- DocumentViewer.jsx  # In-app viewer (PDF, image, text, video)
|   |   |   |-- GlobalSearch.jsx    # Debounced Ctrl+K global search bar
|   |   |   |-- Header.jsx          # Breadcrumbs, search, user pill
|   |   |   |-- Sidebar.jsx         # Minimal black & white navigation
|   |   |   |-- UploadModal.jsx     # DOConCD metadata upload dialog
|   |   |   |-- CreateFolderModal.jsx# Nested folder creation dialog
|   |   |-- context/
|   |   |   |-- AuthContext.jsx     # Live auth session & permission context
|   |   |-- layouts/
|   |   |   |-- AppLayout.jsx       # Authenticated shell layout
|   |   |-- pages/
|   |   |   |-- LoginPage.jsx       # Google login & dev evaluator switch
|   |   |   |-- AccessRequestPage.jsx# Access request submission form
|   |   |   |-- PendingApprovalPage.jsx# Status tracking screen
|   |   |   |-- RejectedPage.jsx    # Rejection notice with admin reason
|   |   |   |-- DashboardPage.jsx   # Metrics, recent docs, root repositories
|   |   |   |-- LibraryPage.jsx     # Nested folder tree & DOConCD browser
|   |   |   |-- SearchResultsPage.jsx# Comprehensive search result filters
|   |   |   |-- AccessInfoPage.jsx  # User permission matrix inspector
|   |   |   |-- SettingsPage.jsx    # Infrastructure diagnostics
|   |   |   |-- admin/
|   |   |       |-- AdminOverviewPage.jsx # Key metrics & pending queue
|   |   |       |-- AdminRequestsPage.jsx # Request review & permission modal
|   |   |       |-- AdminUsersPage.jsx    # Live user & permission editor
|   |   |       |-- AdminAuditLogsPage.jsx# Security audit trail
|   |   |       |-- AdminEmailLogsPage.jsx# Email notification history
|   |   |-- services/
|   |   |   |-- api.js              # Axios instance with Bearer token interceptor
|   |   |-- App.jsx                 # Route definitions & guards
|   |   |-- index.css               # Tailwind CSS v4 black & white theme
|   |   |-- main.jsx
|   |-- .env                        # Active frontend environment variables
|   |-- .env.example                # Empty placeholder template
|   |-- vite.config.js              # Vite server & proxy configuration
|   |-- package.json
|
|-- README.md
|-- .gitignore
```

---

## 4. Environment Variables Setup

### Backend Configuration (`backend/.env`)

```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/DMS?retryWrites=true&w=majority
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
SESSION_SECRET=your-session-secret
JWT_SECRET=your-jwt-secret-key
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-key
CLOUDINARY_API_SECRET=your-cloudinary-secret
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
ADMIN_EMAIL=admin@example.com
FRONTEND_URL=http://localhost:5173
```

### Frontend Configuration (`frontend/.env`)

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

---

## 5. Getting Started & Installation

### Prerequisites
- Node.js v18+ (tested on Node v24 LTS)
- npm v9+

### 1. Database Seeding
To initialize the root administrator user (`loganathan8754114450@gmail.com`), root Siemens DOConCD catalogues, nested subcategories, and authentic technical manuals:

```powershell
cd c:\Project\DMS\backend
npm run seed
```

### 2. Start Backend Server
```powershell
cd c:\Project\DMS\backend
npm start
# Server listens on http://localhost:5000
```

### 3. Start Frontend Development Server
```powershell
cd c:\Project\DMS\frontend
npm run dev
# Application accessible on http://localhost:5173
```

---

## 6. Comprehensive Verification & Automated Test Suite

A comprehensive test suite is provided to verify all 20 security, browsing, preview, and administrative scenarios specified in the master prompt:

```powershell
cd c:\Project\DMS\backend
node src/tests/testSuite.js
```

### Verified Test Cases:
1. `GET /api/health` -> System health & database connection verified.
2. Master Admin Google / Dev authentication & JWT signing.
3. Admin dashboard live statistics calculation.
4. New applicant registration with `PENDING_REQUEST` status.
5. **Security Check**: Unapproved applicant blocked from accessing document repository (`HTTP 403 Forbidden`).
6. User access request submission (*Organization, Department, Reason, Purpose*).
7. Admin retrieves pending requests queue.
8. Admin approves user with `READ=true, DOWNLOAD=false`.
9. Approved user browses root folders.
10. Approved user navigates nested folder hierarchy.
11. Retrieval of DOConCD table-of-contents records with section categories.
12. User opens document in integrated embedded viewer.
13. **Security Check**: User attempts file download without permission -> Server strictly rejects with `HTTP 403 Forbidden`.
14. Admin dynamically upgrades user permissions to grant `DOWNLOAD=true`.
15. User retries download -> Server issues signed Cloudinary attachment download URL.
16. Global search across "840D" returns matching documents and folders.
17. Immutable security audit logs verified.
18. Dispatched email notification logs verified.

---

## 7. REST API Documentation

### Authentication (`/api/auth`)
- `POST /api/auth/google`: Authenticate via Google ID token or OAuth access token.
- `POST /api/auth/dev-login`: Quick evaluation switcher for administrators and test applicants.
- `GET /api/auth/me`: Get current authenticated user profile, status, and permissions.
- `POST /api/auth/logout`: Invalidate session and record audit event.

### Access Requests (`/api/requests`)
- `POST /api/requests`: Submit a document library access request.
- `GET /api/requests/my`: Get current applicant's request status and administrator feedback.

### Document Library & Folders (`/api/folders`)
- `GET /api/folders?parentId=:id`: List folders or subcategories with document counters.
- `GET /api/folders/:id`: Get single folder details and full breadcrumb trail.
- `POST /api/folders`: Create new folder or subcategory (*Requires MANAGE permission*).
- `PUT /api/folders/:id`: Rename or update folder path.
- `DELETE /api/folders/:id`: Soft-delete/archive folder.

### DOConCD Documents (`/api/documents`)
- `GET /api/documents/folder/:folderId`: DOConCD table-of-contents catalogue list with category grouping.
- `GET /api/documents/:id/preview`: Verify read access and stream in-app preview URL.
- `GET /api/documents/:id/download`: Enforce download permissions and generate signed delivery URL.
- `POST /api/documents/folder/:folderId/upload`: Multi-file upload to Cloudinary with DOConCD metadata (*Requires UPLOAD permission*).
- `PUT /api/documents/:id`: Update document title, system, edition, order number, or tags.
- `DELETE /api/documents/:id`: Soft-delete document (*Requires MANAGE permission*).

### Global Search (`/api/search`)
- `GET /api/search?q=:query`: Case-insensitive search across titles, systems, codes, and order numbers filtered by user permissions.

### Administration Console (`/api/admin`)
- `GET /api/admin/stats`: High-level SaaS metrics (*Total Users, Pending, Approved, Storage*).
- `GET /api/admin/requests`: Filterable access requests queue.
- `POST /api/admin/requests/:id/approve`: Approve request, set roles, and allocate permissions.
- `POST /api/admin/requests/:id/reject`: Decline request and record rejection reason.
- `GET /api/admin/users`: User roster with search and filter controls.
- `PUT /api/admin/users/:id`: Dynamically toggle READ, UPLOAD, DOWNLOAD, MANAGE, or suspend users.
- `GET /api/audit`: Search and filter immutable security audit logs.
- `GET /api/admin/email-logs`: View all dispatched notification emails.

---

## 8. Siemens DOConCD Design Guide

The document browser adheres to the following UI principles:
- **Category Banners**: Full-width section dividers (*Operation, Programming, Commissioning, Functions, SIMATIC, Info / Training*).
- **Tabular Precision**: Compact height rows, clean grey borders (`#E5E5E5`), and monospace identifiers for `System`, `Order No.`, and `File Name`.
- **Integrated Preview**: Clicking any table row opens the document directly inside the website modal without redirecting to external sites.
- **Strict Black & White Aesthetic**: No colorful cards, gradients, or non-essential decorations. Clean, minimal, and enterprise-grade.
