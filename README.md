<div align="center">

<br />

```
███╗   ███╗███████╗██████╗ ██╗  ██╗██╗   ██╗██████╗
████╗ ████║██╔════╝██╔══██╗██║  ██║██║   ██║██╔══██╗
██╔████╔██║█████╗  ██║  ██║███████║██║   ██║██████╔╝
██║╚██╔╝██║██╔══╝  ██║  ██║██╔══██║██║   ██║██╔══██╗
██║ ╚═╝ ██║███████╗██████╔╝██║  ██║╚██████╔╝██████╔╝
╚═╝     ╚═╝╚══════╝╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═════╝
```

# MedHub — Connected Pharmaceutical Supply Chain Ledger

**A full-stack, multi-role pharmaceutical B2B distribution platform** built with Next.js 16, PostgreSQL, and Prisma.  
MedHub connects wholesale drug distributors, retail pharmacies, doctor clinics, and a superadmin control center onto one secure, audited network.

[![Next.js](https://img.shields.io/badge/Next.js-16.2.7-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-336791?logo=postgresql)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?logo=prisma)](https://www.prisma.io/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.x-06B6D4?logo=tailwind-css)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

</div>

---

## 📋 Table of Contents

- [Project Overview](#-project-overview)
- [Tech Stack](#-tech-stack)
- [System Architecture](#-system-architecture)
- [User Roles](#-user-roles)
- [Pages & UI Documentation](#-pages--ui-documentation)
  - [Landing Page](#1-landing-page--)
  - [Login Page](#2-login-page--login)
  - [Register Page](#3-register-page--register)
  - [Wholesaler Dashboard](#4-wholesaler-dashboard--wholesalerdashboard)
  - [Inventory Management](#5-inventory-management--wholesalerinventory)
  - [Orders Management](#6-orders-management--wholesalerorders)
  - [Billing & Profit Analyzer](#7-billing--profit-analyzer--wholesalerbilling)
  - [POS Terminal](#8-pos-terminal--wholesalerpos)
  - [Staff Management](#9-staff-management--wholesalerstaff)
  - [Settings & Profile](#10-settings--profile--wholesalersettings--wholesalerprofile)
  - [Audit Logs](#11-audit-logs--wholesalerlogs)
  - [Superadmin Matrix Dashboard](#12-superadmin-matrix-dashboard--superadminmatrix-dashboard)
  - [Subscription Expired Page](#13-subscription-expired-page--subscription-expired)
  - [Buy Medicine Portal](#14-buy-medicine-portal--buy-medicine)
  - [Retailer Dashboard](#15-retailer-dashboard--retailer-dashboard)
  - [Retailer Inventory](#16-retailer-inventory--retailer-inventory)
  - [Retailer Orders](#17-retailer-orders--retailer-orders)
  - [Retailer Billing & Ledger](#18-retailer-billing--ledger--retailer-billing)
- [API Documentation](#-api-documentation)
  - [Authentication APIs](#authentication-apis)
  - [Wholesaler APIs](#wholesaler-apis)
  - [Orders APIs](#orders-apis)
  - [Superadmin APIs](#superadmin-apis)
  - [B2C Marketplace Consumer Server Actions](#b2c-marketplace-consumer-server-actions)
  - [Retailer Custom Delivery Fee Server Actions](#retailer-custom-delivery-fee-server-actions)
- [Database Schema](#-database-schema)
  - [Entity Relationship Overview](#entity-relationship-overview)
  - [Models](#models)
- [Environment Variables](#-environment-variables)
- [How to Run Locally](#-how-to-run-locally)
- [How to Publish the Database Online](#-how-to-publish-the-database-online)
- [How to Deploy to Production](#-how-to-deploy-to-production)
- [Project Structure](#-project-structure)
- [Authentication & Security](#-authentication--security)
- [Business Logic](#-business-logic)
- [Contributing](#-contributing)

---

## 🏥 Project Overview

MedHub is a **decentralized pharmaceutical supply chain management system** designed to modernize drug distribution in Nepal and similar markets. It solves the critical problems of:

- 🔍 **Counterfeit drug traceability** — Every tablet batch is tracked from manufacturer to pharmacy
- 📦 **FIFO inventory management** — Automated First-In-First-Out batch allocation prevents stock write-offs
- 💳 **B2B credit safeguards** — Credit limits and overdue invoice checks protect wholesalers from bad debt
- 🗺️ **Geo-location pharmacy discovery** — PostGIS-ready retailer coordinates enable consumer pharmacy search
- 🖨️ **Walk-in POS billing** — A physical POS terminal with printable A4 tax invoices for counter sales
- 📊 **Multi-tier loyalty pricing** — Volume-based tiered pricing rewards repeat retailer customers

### Key Features at a Glance

| Feature | Description |
|---|---|
| Multi-role authentication | SUPERADMIN, WHOLESALER, WHOLESALER_STAFF, RETAILER, CLINIC |
| OTP-verified registration | 6-digit code verification before account activation |
| FIFO batch allocation | Row-locked, expiry-sorted database transactions |
| Tiered pricing engine | JSON-configured per-product quantity pricing tiers |
| Credit guard system | Automatic overdue invoice and credit limit enforcement |
| Loyalty tier discounts | Bronze / Silver / Gold retailer discount program |
| A4 invoice printing | Customizable printable tax invoices with terms & notes |
| Barcode generation | Code128 barcodes for every inventory batch via bwip-js |
| System audit logs | Every action is logged with user, timestamp, and details |
| Subscription management | Lease-based access controlled by the Superadmin |
| Staff access control | Feature-level permission management per staff member |
| Force password reset | Superadmin-initiated forced reset on next login |

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16.2.7 (App Router) |
| **Language** | TypeScript 5.x |
| **Database** | PostgreSQL 14+ |
| **ORM** | Prisma 5.22 |
| **Styling** | TailwindCSS 4.x + Inline CSS |
| **Authentication** | JWT (jsonwebtoken) + bcryptjs |
| **Session** | HttpOnly cookie (`medhub_session`) |
| **Barcode** | bwip-js (Code128 PNG generation) |
| **Animation** | Framer Motion + Three.js (NetworkCanvas) |
| **Icons** | Lucide React |
| **Middleware** | Next.js Edge Middleware (JWT decode) |

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         MEDHUB PLATFORM                         │
├───────────────────┬────────────────────────┬────────────────────┤
│   PUBLIC PAGES    │   WHOLESALER PORTAL    │  SUPERADMIN PANEL  │
│   /               │   /wholesaler/*        │  /superadmin/*     │
│   /login          │   ├─ /dashboard        │  └─ /matrix-dash.. │
│   /register       │   ├─ /inventory        │                    │
│   /sub-expired    │   ├─ /orders           │                    │
│                   │   ├─ /billing          │                    │
│                   │   ├─ /pos              │                    │
│                   │   ├─ /staff            │                    │
│                   │   ├─ /settings         │                    │
│                   │   ├─ /profile          │                    │
│                   │   └─ /logs             │                    │
├───────────────────┴────────────────────────┴────────────────────┤
│                      NEXT.JS API LAYER (App Router)              │
│   /api/auth/*   /api/wholesaler/*   /api/orders/*   /api/super..│
├─────────────────────────────────────────────────────────────────┤
│                    PRISMA ORM + POSTGRESQL                       │
│   Users · Products · Batches · Orders · Audit Logs              │
└─────────────────────────────────────────────────────────────────┘
```

### Middleware Flow

```
Request → Edge Middleware
            ↓
         Check pathname (exempt: /, /login, /register, /api/auth/*)
            ↓
         Read medhub_session cookie
            ↓
         Decode JWT (no node libs — pure base64url in Edge runtime)
            ↓
         Check subscriptionEnd → if expired → /subscription-expired
            ↓
         Role Guard → WHOLESALER paths → WHOLESALER/STAFF only
                    → RETAILER paths  → RETAILER only
                    → SUPERADMIN paths → SUPERADMIN only
            ↓
         Pass to Route Handler
```

---

## 👤 User Roles

| Role | Description | Default Redirect |
|---|---|---|
| `SUPERADMIN` | Platform administrator with full visibility | `/superadmin/matrix-dashboard` |
| `WHOLESALER` | Primary drug distributor / owner account | `/wholesaler/dashboard` |
| `WHOLESALER_STAFF` | Staff member under a wholesaler | `/wholesaler/dashboard` |
| `RETAILER` | Retail pharmacy that places B2B orders | `/retailer/dashboard` (future) |
| `CLINIC` | Doctor clinic user (planned) | `/` |
| `CONSUMER` | End consumer (planned) | `/` |

---

## 📱 Pages & UI Documentation

### 1. Landing Page — `/`

The public-facing marketing and demonstration page.

**Visual Design:** Light gradient background (`#EBF8FF → #ECFDF5`) with animated `NetworkCanvas` Three.js background, floating radial gradient blobs, and a subtle grid overlay. Font: Inter.

**Sections:**

| Section | Description |
|---|---|
| **Navbar** | Logo, "Matrix Control" link, Sign In, Register Partner buttons |
| **Hero** | H1 "Connected Pharmaceutical Supply Chain Ledger", stats row (12ms Latency, PostGIS Active, FIFO Auto), two CTA buttons |
| **Feature Cards** | 6-card grid: Traceability & Safety, FIFO Stock, Connected Onboarding, B2B Credit Guards, Walk-in POS, Geo-Location Network |
| **Interactive Sandbox** | Collapsible section with 3 live demos: Geolocation Finder (radius-filter pharmacy list), Digital Prescriptions (token generator), Pharmacy Checkout (barcode scanner simulation) |
| **Footer** | Status bar with latency, FIFO status, and encryption indicators |

**Key Interactions:**
- On load, clears any existing session by calling `GET /api/auth/logout`
- Geolocation demo calculates Haversine distance from a reference point (Kathmandu: `27.7172, 85.3240`)
- Prescription demo generates token `RX-TKN-XXXXX` on button click
- POS demo allows scanning SKU codes into a cart

---

### 2. Login Page — `/login`

Secure authentication gateway for all user roles.

**Visual Design:** Split-panel layout. Left dark panel (`#0F172A`) with feature highlights. Right white glassmorphism card with forms.

**Features:**
- **Mode Toggle:** Switch between "Registered User" and "Wholesaler Staff" login
- **Staff Login:** Requires additional `Wholesaler Shop Node ID` (UUID) field
- **Forgot Password:** Modal popup with email input → returns a temporary reset code
- **Force Reset View:** If `forceResetPassword` flag is set on the account, redirects to a new password form inline
- On page load, clears the active session via `GET /api/auth/logout`

**Login Flow:**
```
User submits → POST /api/auth/login
                    ↓
              Validate credentials
                    ↓
              Check subscriptionEnd (auto-deactivate if expired)
                    ↓
              Check isActive flag
                    ↓
              Check forceResetPassword → redirect to reset-force view
                    ↓
              Set JWT cookie (medhub_session)
                    ↓
              Redirect based on role
```

---

### 3. Register Page — `/register`

3-step partner onboarding wizard.

**Visual Design:** Centered card with glassmorphism, step progress bar at the top (3 nodes with connecting lines).

**Step 1 — Account Details:**
- Business role selector: **Medicine Distributor** (blue), **Retail Pharmacy** (green), **Doctor Clinic** (pink)
- Email & password credentials
- Role-specific fields:
  - **Wholesaler:** Company Name, PAN/VAT ID, Warehouse Address, Phone
  - **Retailer:** Pharmacy Name, Drug License No., Address, Phone, GPS (Lat/Lng)
  - **Clinic:** Clinic Name, Council License No., Address, Phone

**Step 2 — Plan Selection:**
- **Free Plan:** Rs. 0 / year — Full platform access for 365 days (evaluation)
- **Paid Plan:** Rs. 10,000 / year — Priority support (UI shown, greyed out in Sprint 1)
- Clicking any plan calls `POST /api/auth/send-otp` and advances to Step 3

**Step 3 — Email Verification:**
- 6-digit OTP displayed in a simulated inbox box (sandbox mode)
- User enters code → `POST /api/auth/register` activates the account

---

### 4. Wholesaler Dashboard — `/wholesaler/dashboard`

The main command center for the wholesaler.

**Visual Design:** Dark sidebar (`WholesalerLayout`) + light content area. Real-time KPI metric cards at the top.

**Metric Cards (8 KPIs):**

| KPI | Source |
|---|---|
| Total Products | `db.product.count` where `wholesalerId` |
| Active Batches | `db.inventoryBatch.count` where `availableBaseUnits > 0 AND expiryDate > now` |
| Pending Orders | `db.order.count` where `status = PENDING` |
| Dispatched Orders | `db.order.count` where `status = DISPATCHED` |
| Near Expiry (30d) | Batches expiring within 30 days |
| Total Revenue | Sum of `netAmount` for DELIVERED orders |
| Estimated Profit | Revenue minus `manufacturingCost × quantity` from batch allocations |
| Staff Count | Count of `WHOLESALER_STAFF` users under this profile |

**Sections:**
- Live KPI grid (8 cards)
- Revenue vs. Profit summary
- Location map pin (if lat/lng set on profile)
- Recent Audit Logs (last 6 actions by user and all staff)

**Access:** `WHOLESALER` and `WHOLESALER_STAFF` roles (staff see their employer's data).

---

### 5. Inventory Management — `/wholesaler/inventory`

**Tabs:**
1. **Products Catalog** — View, add, and manage product master records (name, SKU, tablets/strip, strips/box, tier pricing JSON)
2. **Inventory Batches** — Log incoming stock batches per product with expiry dates, costs, supplier info, and auto-generated barcodes

**Batch Ingestion Form Fields:**
- Product (linked to catalog)
- Batch Number (unique per product)
- Expiry Date
- Total Base Units (total tablets)
- Manufacturing Cost per unit
- Purchase Price per Box
- Selling Price per Box
- Supplier Name
- Manufacturer Name
- Invoice Data (Base64 file or URL)

**Barcode:** Auto-generated Code128 PNG at `/api/wholesaler/barcode?productId=&batchNumber=`. Cached for 24h.

**Tier Pricing JSON Format:**
```json
[
  { "minQty": 1, "maxQty": 49, "pricePerBox": 100 },
  { "minQty": 50, "maxQty": 199, "pricePerBox": 90 },
  { "minQty": 200, "maxQty": 9999, "pricePerBox": 80 }
]
```

---

### 6. Orders Management — `/wholesaler/orders`

B2B order management with full lifecycle tracking.

**Order Statuses:**

```
PENDING → PICKING → DISPATCHED → DELIVERED
```

**Features:**
- View all orders with retailer details, items, amounts
- Update order status (PICKING, DISPATCHED, DELIVERED)
- Credit Guard warning display with override reason log
- Loyalty tier badge shown per retailer (BRONZE / SILVER / GOLD)
- FIFO allocation detail per item (which batch, how many units)

**Credit Guard Logic (visual):**
- 🔴 Red banner if order amount exceeds retailer credit limit
- 🟡 Yellow banner if retailer has unpaid invoices older than 30 days
- Override requires a written justification, logged to audit trail

---

### 7. Billing & Profit Analyzer — `/wholesaler/billing`

Full financial ledger and invoice management.

**Metric Cards (4):**

| Card | Calculation |
|---|---|
| Completed Sales | Sum of `netAmount` for DELIVERED orders |
| Pending Payments | Sum of `netAmount` for non-DELIVERED orders |
| Gross Profits | Completed Sales – COGS (batch `manufacturingCost × units`) |
| Profit Margin % | (Gross Profit / Total Sales) × 100 |

**Transaction Ledger Table:**

| Column | Description |
|---|---|
| Billing Date | Order creation date |
| Invoice ID | `INV-` + first 8 chars of UUID |
| Customer Pharmacy | Retailer pharmacy name |
| Fulfillment Status | PENDING / DISPATCHED / DELIVERED badge |
| Net Payable | `order.netAmount` |
| Simulated Profits | `netAmount – COGS` (only for DELIVERED) |
| Invoice Actions | Print Bill, Send Bill, Alert Reminder |

**Custom Invoice Print Modal:**
- Left panel: Template controls (Invoice Title, Terms & Conditions, Memo Notes)
- Right panel: Live A4 preview with all order items, subtotals, authorized signature line
- Uses `window.print()` with CSS `@media print` for native browser printing

---

### 8. POS Terminal — `/wholesaler/pos`

Walk-in customer point-of-sale system.

**Visual Design:** Dark terminal aesthetic with an "Add to Basket" product search and receipt preview.

**How It Works:**
1. Staff selects products and quantity (in boxes) from a dropdown
2. System calculates total using tiered pricing
3. Checkout creates a DELIVERED order immediately (cash = no credit tracking)
4. A "Walk-in Customer" sentinel retailer (`walkin@medhub.com`) absorbs all POS orders
5. FIFO batch allocation deducts from inventory in real time
6. Prints a thermal-style receipt with customer name and phone

**Walk-in Retailer:** Auto-seeded on first POS checkout with `creditLimit: 9999999` and a 50-year subscription.

---

### 9. Staff Management — `/wholesaler/staff`

Manage employee accounts under the wholesaler profile.

**Features (Owner-only):**
- View all staff with email, name, status, and plain password (evaluation visibility)
- Create new staff accounts with chosen access permissions
- Edit staff details, password, and feature access
- Enable/Disable staff accounts
- Delete staff accounts

**Feature Permissions (comma-separated string):**
```
Dashboard, Medicines, Orders, Billing, POS, Profile, Logs
```
Staff see only the sidebar links corresponding to their granted features.

---

### 10. Settings & Profile — `/wholesaler/settings` / `/wholesaler/profile`

**Profile Settings (Owner-only):**
- Company Name, Tax/VAT ID, Warehouse Address, Phone
- Optional: Registration Number, Contact Person
- GPS Coordinates (Latitude/Longitude) for geo-map display
- Custom Fields JSON array for flexible metadata storage

**Settings:** General UI preferences and system configuration options.

---

### 11. Audit Logs — `/wholesaler/logs`

Chronological activity feed of all actions performed by the owner and all staff.

**Logged Events (examples):**

| Action Code | Description |
|---|---|
| `REGISTER_USER` | New partner account created |
| `LOGIN_SUBSCRIPTION_EXPIRY` | Login attempted on expired account |
| `CREATE_PRODUCT` | New product added to catalog |
| `BATCH_INGEST` | New inventory batch ingested |
| `CREDIT_LIMIT_OVERRIDE` | Wholesaler overrode credit block with justification |
| `POS_CHECKOUT` | Walk-in POS sale completed |
| `CREATE_STAFF` | New staff account created |
| `UPDATE_STAFF` | Staff settings modified |
| `DELETE_STAFF` | Staff account deleted |
| `UPDATE_PROFILE` | Wholesaler profile settings updated |
| `SEND_INVOICE` | Digital invoice dispatched |
| `SEND_REMINDER` | Payment reminder alert sent |
| `PRINT_INVOICE` | Invoice printed |
| `FORGOT_PASSWORD_REQUEST` | Password recovery initiated |
| `RESET_PASSWORD_COMPLETE` | Forced password reset completed |
| `SEND_OTP_ONBOARDING` | OTP generated for onboarding |

Each log entry shows: **Timestamp · Action Code · User Email (Role) · Details**

---

### 12. Superadmin Matrix Dashboard — `/superadmin/matrix-dashboard`

Full platform control panel with dark cyberpunk aesthetic.

> ⚠️ **Sprint 1 Note:** This page is **exempt from authentication middleware** for demo convenience. In production, enforce `SUPERADMIN` JWT guard.

**Visual Design:** Full dark background (`#0A0F1E → #0D1B3E`) with indigo/blue radial glows, monospace font styling.

**Top Stats Row (4 KPIs):**

| KPI | Value |
|---|---|
| Total Accounts | All users in the system |
| Distributors | Users with role `WHOLESALER` |
| Pharmacies | Users with role `RETAILER` |
| Active Leases | Users where `isActive = true` |

**User Management Table (SuperadminClient):**
- Lists ALL users across all roles
- Inline editing of:
  - Package Name (Free Plan / Paid Package)
  - Package Price (Rs.)
  - Subscription End Date
  - Active / Inactive toggle
  - Allowed Features
- **Reset Password button** → generates a temporary `MEDHUB-TEMP-XXXX` passcode, sets `forceResetPassword = true`
- Filter by role, search by email/name

**System Audit Log Feed:**
- Last 300 actions across the entire platform
- Searchable by action type and user email
- Color-coded by action category

---

### 13. Subscription Expired Page — `/subscription-expired`

Shown when a user's subscription has lapsed.

- Displays clear "Access Revoked" message with subscription end date
- Links to contact support / Superadmin
- Session cookie is deleted on redirect here
- DB `isActive` is set to `false` via `POST /api/auth/expire-subscription`

---

### 14. Buy Medicine Portal — `/buy-medicine`

A public/consumer-facing portal for searching and ordering medicines from nearby pharmacies.

**Key Features:**
- **Automatic Geolocation Detection**: Prompts for coordinate permission to find the user's location. Shows longitude and latitude.
- **Leaflet.js Map Picker**: If automatic coordinates are deselected, a button opens an interactive map modal to click and select a pin location.
- **Radial Distance Sorting**: Displays all available retail pharmacies sorted by distance from the buyer in kilometers.
- **Hierarchical Search Engine**:
  - Searches for medicine matching query in the nearest **10 pharmacies** first.
  - If not found, extends search to the next **30 nearest pharmacies**.
  - If still not found, searches across all retail pharmacy inventories.
- **Advanced Pricing Selector**: Shows the box price, calculated per-unit price, and per-strip price based on the product's unit/strip/box pack parameters. Includes purchase controls to order specifically by **Unit**, **Strip**, or **Box**.
- **Checkout Form**: Users fill in name, email, phone number, choose to deliver to current/custom map coordinates, and select **Cash on Delivery (COD)** (online payment option is currently disabled).
- **FIFO Reservation**: Ensures that the selected quantity is in stock across active batches before allowing the order.
- **Order Tracking**: Post-order tracking interface. Displays progress (PENDING, SHIPPED, DELIVERED, FAILED) and order details using a unique tracking code (e.g. `MH-XXXXXX`).

---

### 15. Retailer Dashboard — `/retailer/dashboard`

The primary summary center for retail pharmacy partners.

**Key Components:**
- **B2C Online Order Metrics**: Real-time counts of PENDING, SHIPPED, and DELIVERED consumer orders.
- **Key Financials**: Displays aggregated sales revenue incorporating both physical POS ledgers and completed online consumer orders.
- **Live Inventory Health**: Lists stock levels, low-stock warnings, and expiring retailer inventory items.

---

### 16. Retailer Inventory — `/retailer/inventory`

Stock level tracking for retail pharmacies.

**Key Components:**
- **In-stock Catalog**: Lists all medicines, SKUs, and categories currently held by the pharmacy.
- **Batch Details**: Displays batch numbers, expiries, rack numbers, buying prices, and selling prices (price per box).
- **Rack Location Support**: Displays rack numbers (e.g. `a-4`) to assist staff in quickly finding medicine packages.

---

### 17. Retailer Orders — `/retailer/orders`

B2B wholesale purchasing and B2C online order management.

**Tabs:**
1. **B2B Purchase Orders**: Place orders to wholesalers, track lifecycle (PENDING, PICKING, DISPATCHED, DELIVERED), and accept inventory into local stock upon delivery.
2. **B2C Consumer Orders**:
   - Lists all online consumer orders with tracking codes, buyer details, items ordered, and delivery addresses.
   - Update order status: transition from `PENDING` -> `SHIPPED` -> `DELIVERED` or `FAILED`.
   - **Delivery Fee Settings Configuration Panel**: Allows retailers to define custom delivery fee tiers by km radius (e.g., up to 5km = Rs. 50, up to 10km = Rs. 100).
   - Prevents return/refund actions after delivery is finalized.

---

### 18. Retailer Billing & Ledger — `/retailer/billing`

Comprehensive double-entry transaction record ledger.

**Key Components:**
- **Fiscal Audit Summary**: Lists completed POS sales alongside completed B2C consumer orders.
- **Revenue Breakdown**: Includes net payables and delivery fees collected from completed B2C orders.
- **Refund Controls**: Restricts returns on B2C online orders (no return button is visible on delivered consumer orders).

---

---

## 📡 API Documentation

All API routes return JSON. Authentication is via the `medhub_session` JWT cookie.

### Authentication APIs

#### `POST /api/auth/send-otp`

Generates a 6-digit OTP and stores a temporary inactive user record.

**Request Body:**
```json
{
  "email": "user@example.com",
  "role": "WHOLESALER"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Verification code sent (simulated).",
  "otpCode": "382947"
}
```

**Error Responses:**
| Code | Reason |
|---|---|
| 400 | `email` or `role` missing |
| 400 | Email already registered and active |
| 500 | Internal server error |

---

#### `POST /api/auth/register`

Activates an OTP-verified user and creates their role-specific profile.

**Request Body (Wholesaler):**
```json
{
  "email": "owner@company.com",
  "password": "securepass123",
  "role": "WHOLESALER",
  "otpCode": "382947",
  "companyName": "Kathmandu Distributors Pvt. Ltd.",
  "taxId": "PAN-9028347",
  "address": "Koteshwor, Kathmandu",
  "phone": "+977-1-440234"
}
```

**Request Body (Retailer):**
```json
{
  "email": "pharmacy@example.com",
  "password": "securepass123",
  "role": "RETAILER",
  "otpCode": "382947",
  "pharmacyName": "Kanti Pharmacy",
  "registrationNumber": "DDA-8923-KTM",
  "address": "Maharajgunj, Kathmandu",
  "phone": "+977-1-472093",
  "latitude": 27.7172,
  "longitude": 85.3240
}
```

**Request Body (Clinic):**
```json
{
  "email": "clinic@example.com",
  "password": "securepass123",
  "role": "CLINIC",
  "otpCode": "382947",
  "clinicName": "Metro Care Center",
  "licenseNumber": "NMC-7823-A",
  "address": "Lazimpat, Kathmandu",
  "phone": "+977-1-401984"
}
```

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "owner@company.com",
    "role": "WHOLESALER",
    "subscriptionStart": "2026-06-06T15:00:00.000Z",
    "subscriptionEnd": "2027-06-06T15:00:00.000Z"
  }
}
```

**Error Responses:**
| Code | Reason |
|---|---|
| 400 | Missing required fields |
| 400 | Invalid role enum value |
| 400 | OTP code not found (send-otp not called first) |
| 400 | OTP code already active |
| 400 | Invalid OTP code |
| 400 | OTP code expired (10-minute window) |
| 500 | Internal server error |

---

#### `POST /api/auth/login`

Authenticates user and sets the `medhub_session` JWT cookie.

**Request Body (Regular User):**
```json
{
  "email": "owner@company.com",
  "password": "securepass123",
  "isStaff": false
}
```

**Request Body (Staff Login):**
```json
{
  "email": "staff@company.com",
  "password": "staffpass123",
  "isStaff": true,
  "shopId": "wholesaler-profile-uuid"
}
```

**Response (200):**
```json
{
  "success": true,
  "role": "WHOLESALER",
  "redirectUrl": "/wholesaler/dashboard"
}
```

**Force Reset Response (200):**
```json
{
  "success": true,
  "forceResetPassword": true
}
```

**Error Responses:**
| Code | Reason |
|---|---|
| 400 | Missing email or password |
| 400 | Staff login missing shopId |
| 401 | Invalid credentials |
| 403 | Wrong role for staff login |
| 403 | Staff not associated with this shopId |
| 403 | Subscription expired (auto-deactivates account) |
| 403 | Account deactivated |
| 500 | Internal server error |

---

#### `GET /api/auth/logout`

Clears the session cookie.

**Response (200):**
```json
{ "success": true }
```

---

#### `POST /api/auth/forgot-password`

Generates a temporary `RESET-XXXXXX` password and sets `forceResetPassword = true`.

**Request Body:**
```json
{ "email": "user@example.com" }
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset link sent (simulated).",
  "tempPassword": "RESET-382947"
}
```

---

#### `PUT /api/auth/forgot-password`

Completes a forced password reset with the new password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "mynewpassword123"
}
```

**Response (200):**
```json
{ "success": true, "message": "Password updated successfully." }
```

---

#### `POST /api/auth/expire-subscription`

Called internally by the middleware when a subscription expires. Deactivates the user in the DB.

**Request Body:**
```json
{ "userId": "user-uuid" }
```

---

### Wholesaler APIs

> All routes below require a valid `medhub_session` cookie with role `WHOLESALER` or `WHOLESALER_STAFF` (unless noted).

---

#### `GET /api/wholesaler/products`

Returns all products in the wholesaler's catalog.

**Response (200):**
```json
{
  "success": true,
  "products": [
    {
      "id": "uuid",
      "wholesalerId": "uuid",
      "name": "Paracetamol 500mg",
      "sku": "PARA-500",
      "tabletsPerStrip": 10,
      "stripsPerBox": 10,
      "tierPricingJson": "[{\"minQty\":1,\"maxQty\":49,\"pricePerBox\":100}]",
      "createdAt": "2026-06-06T...",
      "updatedAt": "2026-06-06T..."
    }
  ]
}
```

---

#### `POST /api/wholesaler/products`

Creates a new product in the catalog.

**Request Body:**
```json
{
  "name": "Amoxicillin 250mg",
  "sku": "AMOX-250",
  "tabletsPerStrip": 10,
  "stripsPerBox": 10,
  "tierPricing": [
    { "minQty": 1, "maxQty": 49, "pricePerBox": 150 },
    { "minQty": 50, "maxQty": 9999, "pricePerBox": 135 }
  ]
}
```

**Response (200):**
```json
{ "success": true, "product": { ...product } }
```

**Error Responses:**
| Code | Reason |
|---|---|
| 401 | Unauthorized (wrong role) |
| 400 | Name or SKU missing |
| 400 | SKU already exists globally |
| 500 | Internal server error |

---

#### `POST /api/wholesaler/batches`

Ingests a new inventory batch for an existing product.

**Request Body:**
```json
{
  "productId": "product-uuid",
  "batchNumber": "BATCH-2026-001",
  "expiryDate": "2028-12-31",
  "totalBaseUnits": 10000,
  "manufacturingCost": 0.8,
  "purchasePricePerBox": 70,
  "sellingPricePerBox": 100,
  "supplierName": "ABC Pharma Ltd.",
  "manufacturerName": "XYZ Mfg. Corp.",
  "invoiceData": "base64encodedstring_or_url"
}
```

**Response (200):**
```json
{ "success": true, "batch": { ...batch } }
```

**Error Responses:**
| Code | Reason |
|---|---|
| 401 | Unauthorized |
| 400 | Missing required batch fields |
| 404 | Product not found or not owned by this wholesaler |
| 400 | Batch number already exists for this product |
| 500 | Internal server error |

---

#### `GET /api/wholesaler/batches?productId=<uuid>`

Returns inventory batches, optionally filtered by product.

**Query Parameters:**
| Param | Required | Description |
|---|---|---|
| `productId` | No | Filter batches by product UUID |

**Response (200):**
```json
{
  "success": true,
  "batches": [ { ...batch, product: {...} } ]
}
```

---

#### `GET /api/wholesaler/barcode?productId=<uuid>&batchNumber=<str>`

Returns a Code128 barcode PNG image for the given batch.

**Response:** `image/png` binary  
**Cache:** `public, max-age=86400` (24 hours)

**Barcode Text Format:** `{FIRST8CHARS_OF_PRODUCTID}-{BATCHNUMBER}` (uppercase)

---

#### `GET /api/wholesaler/staff`

Returns all staff under the wholesaler profile.

**Response (200):**
```json
{
  "success": true,
  "staff": [
    {
      "id": "uuid",
      "email": "staff@company.com",
      "fullName": "Ram Shrestha",
      "isActive": true,
      "plainPassword": "staffpass123",
      "allowedFeatures": "Dashboard,Medicines,Orders,Billing,POS,Profile,Logs",
      "createdAt": "2026-06-06T..."
    }
  ]
}
```

---

#### `POST /api/wholesaler/staff`

Creates a new staff account. **Owner-only** (`WHOLESALER` role).

**Request Body:**
```json
{
  "email": "newstaff@company.com",
  "password": "staffpass123",
  "fullName": "Sita Tamang",
  "allowedFeatures": ["Dashboard", "Orders", "POS"]
}
```

**Response (200):**
```json
{
  "success": true,
  "staff": { "id": "uuid", "email": "...", "fullName": "...", "isActive": true }
}
```

---

#### `PUT /api/wholesaler/staff/[id]`

Updates a staff account's details. **Owner-only**.

**Request Body (all optional, include only what to update):**
```json
{
  "email": "updated@company.com",
  "password": "newpassword",
  "fullName": "Updated Name",
  "allowedFeatures": ["Dashboard", "Medicines"],
  "isActive": false
}
```

---

#### `DELETE /api/wholesaler/staff/[id]`

Deletes a staff account. **Owner-only**.

**Response (200):**
```json
{ "success": true }
```

---

#### `POST /api/wholesaler/profile`

Updates the wholesaler's company profile. **Owner-only**.

**Request Body:**
```json
{
  "companyName": "Updated Distributors Pvt. Ltd.",
  "taxId": "PAN-9028347",
  "address": "Baneshwor, Kathmandu",
  "phone": "+977-1-440234",
  "registrationNumber": "REG-2024-001",
  "contactPerson": "Ramesh Shrestha",
  "latitude": 27.7172,
  "longitude": 85.3240,
  "customFieldsJson": [
    { "label": "Bank Account", "value": "NABIL-123456" }
  ]
}
```

---

#### `POST /api/wholesaler/audit-log`

Manually writes an audit log entry for the current user.

**Request Body:**
```json
{
  "action": "CUSTOM_ACTION",
  "details": "Description of what happened"
}
```

**Response (200):**
```json
{ "success": true, "auditLog": { ...log } }
```

---

#### `POST /api/wholesaler/pos`

Processes a walk-in POS sale. Immediately creates a DELIVERED order with FIFO batch allocation.

**Request Body:**
```json
{
  "items": [
    { "productId": "product-uuid", "qtyBoxes": 3 },
    { "productId": "product-uuid-2", "qtyBoxes": 1 }
  ],
  "customerName": "John Doe",
  "customerPhone": "9800000000"
}
```

**Response (200):**
```json
{
  "success": true,
  "order": {
    "id": "uuid",
    "status": "DELIVERED",
    "totalAmount": 450.00,
    "discountAmount": 0,
    "netAmount": 450.00,
    "items": [ { ...item, product: {...}, allocations: [{...batch}] } ]
  }
}
```

**Error Responses:**
| Code | Reason |
|---|---|
| 401 | Unauthorized |
| 400 | No items in basket |
| 400 | Product not in this wholesaler's catalog |
| 500 | Insufficient stock (FIFO exhausted) — transaction rolled back |

---

### Orders APIs

#### `POST /api/orders`

Creates a B2B order from a retailer to a wholesaler with FIFO allocation.

**Authentication:** Requires session (any role).

**Request Body:**
```json
{
  "retailerId": "retailer-profile-uuid",
  "wholesalerId": "wholesaler-profile-uuid",
  "items": [
    { "productId": "product-uuid", "qtyBoxes": 10 },
    { "productId": "product-uuid-2", "qtyBoxes": 5 }
  ],
  "overrideJustification": "Urgent seasonal stock needed — Credit limit temporarily extended"
}
```

> `overrideJustification` is **required** if credit limit is exceeded OR if retailer has overdue invoices older than 30 days. If omitted in such cases, a `CREDIT_BLOCKED` error is returned.

**Success Response (200):**
```json
{
  "success": true,
  "order": {
    "id": "uuid",
    "wholesalerId": "uuid",
    "retailerId": "uuid",
    "status": "PENDING",
    "totalAmount": 1500.00,
    "discountAmount": 75.00,
    "netAmount": 1425.00,
    "overrideJustification": null,
    "createdAt": "2026-06-06T..."
  }
}
```

**Credit Block Response (400):**
```json
{
  "error": "CREDIT_BLOCKED",
  "reason": "Order amount (Rs. 1425.00) exceeds retailer credit limit (Rs. 1000.00).",
  "isCreditLimitExceeded": true,
  "hasOverdueInvoices": false
}
```

**Pricing Engine:**
1. Converts box quantity → base units: `qtyBoxes × tabletsPerStrip × stripsPerBox`
2. Matches `qtyBoxes` against `tierPricingJson` to find applicable `pricePerBox`
3. Calculates `pricePerBaseUnit = pricePerBox / tabletsPerBox`
4. Applies loyalty discount (Bronze: 0%, Silver: 5%, Gold: 10%)

**FIFO Allocation:**
```sql
SELECT * FROM "InventoryBatch"
WHERE "productId" = $productId
  AND "expiryDate" > NOW()
  AND "availableBaseUnits" > 0
ORDER BY "expiryDate" ASC
FOR UPDATE
```
Allocates from earliest-expiring batches first. Rolls back entire transaction if any product is under-stocked.

---

#### `GET /api/orders?retailerId=<uuid>&wholesalerId=<uuid>`

Returns orders with full nested data.

**Query Parameters:**
| Param | Required | Description |
|---|---|---|
| `retailerId` | No | Filter by retailer profile ID |
| `wholesalerId` | No | Filter by wholesaler profile ID |

**Response (200):**
```json
{
  "success": true,
  "orders": [
    {
      "id": "uuid",
      "status": "PENDING",
      "totalAmount": 1500.00,
      "discountAmount": 75.00,
      "netAmount": 1425.00,
      "retailer": { ...retailerProfile },
      "wholesaler": { ...wholesalerProfile },
      "items": [
        {
          "id": "uuid",
          "productId": "uuid",
          "product": { ...product },
          "quantity": 100,
          "pricePerUnit": 1.0
        }
      ],
      "createdAt": "2026-06-06T..."
    }
  ]
}
```

---

### Superadmin APIs

#### `PUT /api/superadmin/user/[id]`

Updates a user's subscription package and access settings.

**Authentication:** `SUPERADMIN` role only.

**Request Body:**
```json
{
  "isActive": true,
  "packageName": "Paid Package",
  "packagePrice": 10000,
  "subscriptionEnd": "2027-06-06T00:00:00.000Z",
  "allowedFeatures": ["Dashboard", "Medicines", "Orders", "Billing", "POS", "Profile", "Logs"]
}
```

**Response (200):**
```json
{ "success": true, "user": { ...updatedUser } }
```

---

#### `POST /api/superadmin/user/[id]`

Performs admin actions on a user account.

**Authentication:** `SUPERADMIN` role only.

**Request Body:**
```json
{ "action": "reset-password" }
```

**Response (200):**
```json
{
  "success": true,
  "tempPassword": "MEDHUB-TEMP-4821",
  "user": { ...updatedUser }
}
```

---

### B2C Marketplace Consumer Server Actions

These are Next.js Server Actions used in B2C transactions located in `src/app/actions/consumerActions.ts`.

#### `fetchRetailersWithDistanceAction(buyerLat: number, buyerLng: number)`

Fetches all retail pharmacies, calculates their distance to the buyer via the Haversine formula, computes the applicable delivery fee based on the retailer's custom delivery fee tier rules, and sorts them ascending by distance.

**Returns:**
```json
{
  "success": true,
  "retailers": [
    {
      "id": "retailer-uuid",
      "pharmacyName": "Retailer Pharmacy",
      "address": "Kathmandu, Nepal",
      "phone": "98XXXXXXXX",
      "latitude": 27.7172,
      "longitude": 85.3240,
      "distance": 0.03,
      "deliveryFee": 50
    }
  ]
}
```

---

#### `searchMedicinesExpandedAction(query: string, buyerLat: number, buyerLng: number)`

Searches for matching medicine in the retailer inventories using a 3-level distance-expansion algorithm:
1. Searches the nearest **10 pharmacies** first.
2. If no results are found, searches the next **30 pharmacies**.
3. If still no results, searches all remaining pharmacies in the system.

**Returns:**
```json
{
  "success": true,
  "results": [
    {
      "id": "inventory-item-uuid",
      "productId": "product-uuid",
      "quantity": 100,
      "expiryDate": "2030-01-01T00:00:00.000Z",
      "buyingPrice": 40.0,
      "sellingPrice": 50.0,
      "rack": "a-4",
      "distance": 0.03,
      "deliveryFee": 50,
      "product": {
        "id": "product-uuid",
        "name": "Cetamol 500mg",
        "sku": "CETAMOL-500",
        "category": "Tablet",
        "tabletsPerStrip": 10,
        "stripsPerBox": 10
      },
      "retailer": {
        "id": "retailer-uuid",
        "pharmacyName": "Retailer Pharmacy"
      }
    }
  ]
}
```

---

#### `placeConsumerOrderAction(data)`

Places a new B2C order on Cash on Delivery. Validates that the pharmacy has sufficient inventory for all items in the request before creating records. Does **not** deduct inventory immediately (only reserves it).

**Request Parameters:**
- `retailerId` (string)
- `buyerName` (string)
- `buyerEmail` (string)
- `buyerPhone` (string)
- `deliveryAddress` (string)
- `latitude`? (number)
- `longitude`? (number)
- `deliveryFee`? (number)
- `items`: array of `{ productId: string, quantity: number, pricePerUnit: number }`

**Returns:**
```json
{
  "success": true,
  "order": {
    "id": "order-uuid",
    "trackingCode": "MH-A4B3C2",
    "buyerName": "John Doe",
    "totalAmount": 150.00,
    "status": "PENDING"
  }
}
```

---

#### `trackConsumerOrderAction(code: string)`

Retrieves details and status of an order using its unique tracking code.

**Returns:**
```json
{
  "success": true,
  "order": { ...orderDetailWithItems }
}
```

---

#### `cancelConsumerOrderAction(trackingCode: string)`

Cancels a B2C consumer order. Only permitted if the order status is currently `PENDING`. Updates status to `FAILED`.

**Returns:**
```json
{
  "success": true,
  "order": { "status": "FAILED", ... }
}
```

---

#### `updateConsumerOrderStatusAction(orderId: string, status: string)`

Transitions order statuses with transactional triggers:
- **`PENDING` ➔ `SHIPPED`**: Automatically performs FIFO stock deduction from the retailer's inventory batches. If stock is insufficient, rolls back and throws an error.
- **`SHIPPED` ➔ `FAILED`**: Automatically restores the deducted stock back to the retailer's inventory batch. If no batch is found, regenerates a restoration batch block.
- **`SHIPPED` ➔ `DELIVERED`**: Automatically records double-entry bookkeeping ledgers (`SALE` entry with credit value equal to the order total amount).
- Emails status updates to the buyer on every status change.

**Returns:**
```json
{
  "success": true,
  "order": { "status": "SHIPPED", ... }
}
```

---

### Retailer Custom Delivery Fee Server Actions

These actions manage the delivery fee rules configured by retailers.

#### `saveDeliveryFeeSettingsAction(retailerId: string, feesJson: string)`

Saves km-range-based custom delivery fee tiers in JSON format under the retailer's profile.

**Example payload for `feesJson`:**
```json
"[{\"maxKm\":5,\"fee\":50},{\"maxKm\":10,\"fee\":100},{\"maxKm\":20,\"fee\":200}]"
```

**Returns:**
```json
{ "success": true }
```

---

#### `getDeliveryFeeSettingsAction(retailerId: string)`

Gets the configured JSON string of delivery fee tiers for a retailer.

**Returns:**
```json
{ "success": true, "deliveryFeesJson": "[...]" }
```

---

## 🗄 Database Schema

### Entity Relationship Overview

```
User ──────────────── WholesalerProfile ─── Product ─── InventoryBatch
 │                         │                               │
 │ (WHOLESALER_STAFF)       │                               │
 └──── wholesalerId ────────┘                     OrderBatchAllocation
                                                            │
User ──────────────── RetailerProfile  ─── Order ──── OrderItem
                           │                  │           │
                           │                  │           └── OrderBatchAllocation
                           └── RetailerInventory
                           
User ──────────────── ClinicProfile

SystemAuditLog ────── User (nullable)
```

### Models

---

#### `User`

The central auth model. Every person on the platform is a User.

```prisma
model User {
  id                String             @id @default(uuid())
  email             String             @unique
  passwordHash      String
  role              Role               // SUPERADMIN | WHOLESALER | WHOLESALER_STAFF | RETAILER | CLINIC | CONSUMER
  subscriptionStart DateTime           @default(now())
  subscriptionEnd   DateTime
  isActive          Boolean            @default(true)
  wholesalerId      String?            // For WHOLESALER_STAFF → links to WholesalerProfile.id
  fullName          String?            // For WHOLESALER_STAFF
  plainPassword     String?            // Evaluation: visible to Superadmin
  allowedFeatures   String             @default("Dashboard,Medicines,Orders,Billing,POS,Profile,Logs")
  otpCode           String?            // Temporary OTP during onboarding
  otpExpiry         DateTime?          // 10-minute OTP window
  forceResetPassword  Boolean          @default(false)
  packageName       String             @default("Free Plan")
  packagePrice      Float              @default(0)
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt
}
```

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `email` | String (unique) | Login identifier |
| `passwordHash` | String | bcrypt hash (12 rounds) |
| `role` | Enum | User's system role |
| `subscriptionEnd` | DateTime | Account lease expiry |
| `isActive` | Boolean | Account enabled/disabled |
| `wholesalerId` | UUID? | Foreign key → `WholesalerProfile.id` (staff only) |
| `allowedFeatures` | String | Comma-separated feature list |
| `otpCode` | String? | Temporary OTP for registration |
| `forceResetPassword` | Boolean | Forces new password on next login |

---

#### `WholesalerProfile`

Business profile for a WHOLESALER user.

```prisma
model WholesalerProfile {
  id                 String   @id @default(uuid())
  userId             String   @unique    // → User.id
  companyName        String
  taxId              String              // VAT / PAN
  address            String
  phone              String
  registrationNumber String?
  contactPerson      String?
  latitude           Float?              // For geo display
  longitude          Float?
  customFieldsJson   String?  @default("[]")   // Flexible metadata
}
```

---

#### `RetailerProfile`

Business profile for a RETAILER user (pharmacy).

```prisma
model RetailerProfile {
  id                 String   @id @default(uuid())
  userId             String   @unique    // → User.id
  pharmacyName       String
  registrationNumber String              // Drug license number
  address            String
  phone              String
  latitude           Float               // PostGIS geo coordinates
  longitude          Float
  creditLimit        Float    @default(200000)   // Rs. 200,000 default
  lifetimeSpend      Float    @default(0)        // Used for loyalty tier
  deliveryFeesJson   String?  // JSON tiers of delivery fee rules
}
```

**Loyalty Tier Calculation:**

| Tier | Lifetime Spend | Discount |
|---|---|---|
| BRONZE | < Rs. 100,000 | 0% |
| SILVER | Rs. 100,000 – 499,999 | 5% |
| GOLD | ≥ Rs. 500,000 | 10% |

---

#### `ClinicProfile`

Business profile for a CLINIC user.

```prisma
model ClinicProfile {
  id            String   @id @default(uuid())
  userId        String   @unique
  clinicName    String
  licenseNumber String              // Medical council license
  address       String
  phone         String
}
```

---

#### `Product`

Master catalog entry for a medicine / drug product.

```prisma
model Product {
  id             String    @id @default(uuid())
  wholesalerId   String              // → WholesalerProfile.id
  name           String
  sku            String    @unique   // Global SKU uniqueness
  tabletsPerStrip Int      @default(10)
  stripsPerBox   Int       @default(10)
  tierPricingJson String   @default("[]")   // JSON pricing tiers
}
```

**`tierPricingJson` Schema:**
```typescript
type TierPricing = Array<{
  minQty: number;   // Min boxes for this tier
  maxQty: number;   // Max boxes (use 9999 for open-ended)
  pricePerBox: number; // Price in Rs.
}>
```

---

#### `InventoryBatch`

A physical shipment/lot of a product.

```prisma
model InventoryBatch {
  id                  String    @id @default(uuid())
  productId           String              // → Product.id
  batchNumber         String
  expiryDate          DateTime
  totalBaseUnits      Int                 // Total tablets ingested
  availableBaseUnits  Int                 // Remaining after allocations
  manufacturingCost   Float               // Cost per base unit (tablet)
  invoiceData         String              // Base64 or URL to purchase invoice
  barcodeUrl          String?             // Path to generated barcode
  purchasePricePerBox Float    @default(0)
  sellingPricePerBox  Float    @default(100)
  supplierName        String?
  manufacturerName    String?
  purchaseDate        DateTime @default(now())
  
  @@unique([productId, batchNumber])      // No duplicate batches per product
}
```

---

#### `Order`

A B2B purchase order or POS sale.

```prisma
model Order {
  id                    String        @id @default(uuid())
  wholesalerId          String        // → WholesalerProfile.id
  retailerId            String        // → RetailerProfile.id
  status                OrderStatus   @default(PENDING)
  totalAmount           Float         // Before loyalty discount
  discountAmount        Float         // Loyalty discount applied
  netAmount             Float         // Final payable (totalAmount - discountAmount)
  overrideJustification String?       // Logged when credit guard is bypassed
}
```

**`OrderStatus` Enum:** `PENDING → PICKING → DISPATCHED → DELIVERED`

---

#### `OrderItem`

Line item within an order.

```prisma
model OrderItem {
  id           String    @id @default(uuid())
  orderId      String    // → Order.id
  productId    String    // → Product.id
  quantity     Int       // In base units (tablets)
  pricePerUnit Float     // Price per base unit at time of order
}
```

---

#### `OrderBatchAllocation`

FIFO allocation record: which batch supplied how many units for an order item.

```prisma
model OrderBatchAllocation {
  id          String    @id @default(uuid())
  orderItemId String    // → OrderItem.id
  batchId     String    // → InventoryBatch.id
  quantity    Int       // Base units allocated from this batch
}
```

---

#### `InTransitLog`

Tracks product movement during the DISPATCHED status.

```prisma
model InTransitLog {
  id           String    @id @default(uuid())
  orderId      String
  productId    String
  batchId      String
  quantity     Int       // Base units in transit
  dispatchedAt DateTime  @default(now())
}
```

---

#### `RetailerInventory`

Tracks stock received by a retailer (post-delivery).

```prisma
model RetailerInventory {
  id           String    @id @default(uuid())
  retailerId   String
  productId    String
  batchNumber  String
  quantity     Int       // Base units received
  expiryDate   DateTime
  buyingPrice  Float     @default(0)
  sellingPrice Float     @default(0)
  rack         String?   // Rack placement coordinates/number

  @@unique([retailerId, productId, batchNumber])
}
```

---

#### `SystemAuditLog`

Immutable audit trail for all platform actions.

```prisma
model SystemAuditLog {
  id        String    @id @default(uuid())
  action    String    // Action code string
  userId    String?   // Nullable (system-level logs)
  details   String    // Human-readable description
  timestamp DateTime  @default(now())
}
```

---

#### `ConsumerOrder`

Tracks online B2C marketplace consumer orders.

```prisma
model ConsumerOrder {
  id              String              @id @default(uuid())
  trackingCode    String              @unique // Unique short code like MH-XXXXXX
  retailerId      String              // Retailer pharmacy ID
  buyerName       String
  buyerEmail      String
  buyerPhone      String
  deliveryAddress String
  latitude        Float?
  longitude       Float?
  paymentMethod   String              @default("COD")
  status          String              @default("PENDING") // PENDING, SHIPPED, DELIVERED, FAILED
  totalAmount     Float
  deliveryFee     Float               @default(0)
}
```

---

#### `ConsumerOrderItem`

Line item within a B2C consumer order.

```prisma
model ConsumerOrderItem {
  id              String        @id @default(uuid())
  consumerOrderId String        // → ConsumerOrder.id
  productId       String        // → Product.id
  quantity        Int           // Base units ordered
  pricePerUnit    Float         // Selling price per base unit at order time
}
```

---

## 🔐 Environment Variables

Create a `.env` file in the project root:

```env
# ─── PostgreSQL Database Connection ───────────────────────────────────
# Local development (macOS Homebrew PostgreSQL, current user as superuser)
DATABASE_URL="postgresql://<YOUR_USERNAME>@localhost:5432/medhub?schema=public"

# ─── JSON Web Token Secret ────────────────────────────────────────────
# Change this to a strong random secret in production!
JWT_SECRET="medhub_super_secret_key_change_in_production"

# ─── Nodemailer Email Configuration ───────────────────────────────────
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-specific-password"
```

> ⚠️ **Never commit your `.env` file to version control.** It is already in `.gitignore`.

### Environment Variable Reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ Yes | PostgreSQL connection string (Prisma format) |
| `JWT_SECRET` | ✅ Yes | Secret key for signing JWT session tokens |
| `EMAIL_USER` | ❌ No | Gmail or SMTP username for order verification & status update emails |
| `EMAIL_PASS` | ❌ No | App-specific password or SMTP credential for mailing |

---

## 🚀 How to Run Locally

### Prerequisites

- **Node.js** v20+ — [Download](https://nodejs.org/)
- **PostgreSQL** 14+ — [Download](https://www.postgresql.org/download/)
- **npm** or **pnpm**

---

### Step 1 — Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/medhub.git
cd medhub
```

---

### Step 2 — Install Dependencies

```bash
npm install
```

---

### Step 3 — Setup PostgreSQL Database

**macOS (Homebrew):**
```bash
brew install postgresql@14
brew services start postgresql@14

# Create the database
createdb medhub
```

**Ubuntu/Debian:**
```bash
sudo apt update && sudo apt install postgresql -y
sudo systemctl start postgresql

sudo -u postgres psql -c "CREATE DATABASE medhub;"
sudo -u postgres psql -c "CREATE USER medhubuser WITH PASSWORD 'yourpassword';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE medhub TO medhubuser;"
```

**Windows:**
Download and install PostgreSQL from https://www.postgresql.org/download/windows/  
Then use pgAdmin or psql to create the `medhub` database.

---

### Step 4 — Configure Environment

```bash
cp .env.example .env   # or create .env manually
```

Edit `.env` with your database credentials:
```env
DATABASE_URL="postgresql://YOUR_USERNAME@localhost:5432/medhub?schema=public"
JWT_SECRET="your_strong_secret_key_here"
```

---

### Step 5 — Run Prisma Migrations

```bash
# Push the schema to PostgreSQL (creates all tables)
npx prisma db push

# Generate Prisma client
npx prisma generate
```

> **Optional:** View your database with Prisma Studio
> ```bash
> npx prisma studio
> ```
> Opens a visual database browser at `http://localhost:5555`

---

### Step 6 — Seed the Superadmin Account

The Superadmin must be created directly in the database (not through registration).

```bash
npx prisma studio
```

Or via psql:
```sql
INSERT INTO "User" (
  id, email, "passwordHash", role,
  "subscriptionStart", "subscriptionEnd",
  "isActive", "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid(),
  'admin@medhub.com',
  -- bcrypt hash of 'admin123' with 12 rounds
  '$2b$12$YOUR_BCRYPT_HASH_HERE',
  'SUPERADMIN',
  NOW(),
  '2099-12-31 23:59:59',
  true,
  NOW(),
  NOW()
);
```

> To generate a bcrypt hash, run: `node -e "const b=require('bcryptjs');b.hash('yourpassword',12).then(console.log)"`

---

### Step 7 — Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

### Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server (hot reload) |
| `npm run build` | Build production bundle |
| `npm start` | Start production server (after build) |
| `npm run lint` | Run ESLint checks |

---

## ☁️ How to Publish the Database Online

Choose one of the following managed PostgreSQL providers:

---

### Option A — Neon (Recommended — Serverless PostgreSQL)

1. Go to [neon.tech](https://neon.tech) and create a free account
2. Create a new project → select PostgreSQL 16
3. Copy the connection string (looks like):
   ```
   postgresql://username:password@ep-xxxx.us-east-1.aws.neon.tech/medhub?sslmode=require
   ```
4. Update your `.env`:
   ```env
   DATABASE_URL="postgresql://username:password@ep-xxxx.us-east-1.aws.neon.tech/medhub?sslmode=require"
   ```
5. Run migrations:
   ```bash
   npx prisma db push
   ```

---

### Option B — Supabase (PostgreSQL + Auth extras)

1. Go to [supabase.com](https://supabase.com) → New Project
2. Under **Settings → Database**, copy the **Connection String (URI)**
3. Replace the password placeholder and add `?pgbouncer=true&connection_limit=1` for serverless
4. Update `.env` with the URI
5. Run `npx prisma db push`

---

### Option C — Railway

1. Go to [railway.app](https://railway.app) → New Project → Add PostgreSQL
2. Click on the PostgreSQL service → **Connect** → copy the `DATABASE_URL`
3. Update `.env` and run `npx prisma db push`

---

### Option D — Render

1. Go to [render.com](https://render.com) → New → PostgreSQL
2. Select the Free tier
3. Copy the **External Database URL**
4. Update `.env` and run `npx prisma db push`

---

### After Setting Up Online DB

Always run these commands after pointing to a new database:

```bash
npx prisma db push        # Apply schema
npx prisma generate       # Regenerate Prisma client
```

---

## 🌐 How to Deploy to Production

### Option A — Vercel (Recommended for Next.js)

1. **Push your code to GitHub**
2. Go to [vercel.com](https://vercel.com) → Import Repository
3. **Set Environment Variables** in the Vercel dashboard:
   - `DATABASE_URL` = your online PostgreSQL URL
   - `JWT_SECRET` = a strong random secret (use `openssl rand -base64 32`)
4. Click **Deploy**

**Important for Vercel + PostgreSQL:**
- Use Neon or PlanetScale (connection pooling required for serverless)
- Add `?pgbouncer=true&connection_limit=1` to your `DATABASE_URL` for Prisma connection pooling

```env
DATABASE_URL="postgresql://user:pass@host/medhub?pgbouncer=true&connection_limit=1&sslmode=require"
```

And add a `DIRECT_URL` for migrations:
```env
DIRECT_URL="postgresql://user:pass@host/medhub?sslmode=require"
```

Update `prisma/schema.prisma`:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

---

### Option B — Railway (Full-stack)

1. Go to [railway.app](https://railway.app) → New Project
2. Deploy from GitHub repo
3. Add a PostgreSQL service to the same project
4. Railway auto-injects `DATABASE_URL` — add `JWT_SECRET` manually
5. Set the start command: `npm run build && npm start`

---

### Option C — VPS / Ubuntu Server

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone repo
git clone https://github.com/YOUR_USERNAME/medhub.git /var/www/medhub
cd /var/www/medhub

# Install & build
npm install
npm run build

# Set environment variables
nano .env   # Add DATABASE_URL and JWT_SECRET

# Run migrations
npx prisma db push

# Start with PM2 (process manager)
npm install -g pm2
pm2 start npm --name "medhub" -- start
pm2 save
pm2 startup

# Nginx reverse proxy (optional)
sudo apt install nginx
# Configure /etc/nginx/sites-available/medhub to proxy to localhost:3000
```

---

### Production Checklist

- [ ] `JWT_SECRET` is a strong random value (`openssl rand -base64 32`)
- [ ] `DATABASE_URL` uses SSL (`?sslmode=require`)
- [ ] Remove `tempPassword` and `otpCode` from API responses (sandbox-only)
- [ ] Set `NODE_ENV=production`
- [ ] Configure HTTPS / TLS certificate (Let's Encrypt)
- [ ] Remove Superadmin middleware bypass in `src/middleware.ts` (line ~19-21)
- [ ] Set up database backups (pg_dump or provider snapshots)
- [ ] Add rate limiting to `/api/auth/*` routes

---

## 📁 Project Structure

```
medhub/
├── prisma/
│   └── schema.prisma              # Database schema (single source of truth)
│
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── layout.tsx             # Root layout (HTML, fonts, global styles)
│   │   ├── page.tsx               # Landing page (/)
│   │   ├── globals.css            # Global CSS with design tokens
│   │   │
│   │   ├── login/
│   │   │   └── page.tsx           # Login page (/login)
│   │   │
│   │   ├── register/
│   │   │   └── page.tsx           # Registration wizard (/register)
│   │   │
│   │   ├── subscription-expired/
│   │   │   └── page.tsx           # Expired subscription gate
│   │   │
│   │   ├── wholesaler/            # Wholesaler portal (protected)
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx       # Server component (data fetching)
│   │   │   │   └── DashboardClient.tsx  # Client component (UI)
│   │   │   ├── inventory/
│   │   │   ├── orders/
│   │   │   ├── billing/
│   │   │   │   └── BillingClient.tsx    # Billing UI + invoice printer
│   │   │   ├── pos/
│   │   │   ├── staff/
│   │   │   ├── settings/
│   │   │   ├── profile/
│   │   │   └── logs/
│   │   │
│   │   ├── superadmin/
│   │   │   └── matrix-dashboard/
│   │   │       ├── page.tsx             # Server component (data fetching)
│   │   │       └── SuperadminClient.tsx # Client component (user management)
│   │   │
│   │   └── api/                   # REST API routes
│   │       ├── auth/
│   │       │   ├── login/route.ts
│   │       │   ├── logout/route.ts
│   │       │   ├── register/route.ts
│   │       │   ├── send-otp/route.ts
│   │       │   ├── forgot-password/route.ts
│   │       │   └── expire-subscription/route.ts
│   │       ├── wholesaler/
│   │       │   ├── products/route.ts
│   │       │   ├── batches/route.ts
│   │       │   ├── barcode/route.ts
│   │       │   ├── staff/
│   │       │   │   ├── route.ts          # GET, POST
│   │       │   │   └── [id]/route.ts     # PUT, DELETE
│   │       │   ├── profile/route.ts
│   │       │   ├── pos/route.ts
│   │       │   └── audit-log/route.ts
│   │       ├── orders/
│   │       │   └── route.ts              # GET, POST
│   │       └── superadmin/
│   │           └── user/
│   │               └── [id]/route.ts     # PUT, POST (admin actions)
│   │
│   ├── components/
│   │   ├── WholesalerLayout.tsx   # Sidebar + top navigation layout
│   │   ├── Sidebar.tsx            # Navigation sidebar component
│   │   └── NetworkCanvas.tsx      # Three.js animated background
│   │
│   ├── lib/
│   │   ├── auth.ts                # JWT, bcrypt, session helpers
│   │   ├── db.ts                  # Prisma client singleton
│   │   └── uom.ts                 # Unit-of-measure conversion helpers
│   │
│   └── middleware.ts              # Edge JWT guard + subscription check
│
├── public/                        # Static assets (images, icons)
├── .env                           # Environment variables (gitignored)
├── next.config.ts                 # Next.js configuration
├── tsconfig.json                  # TypeScript configuration
├── package.json                   # Dependencies and scripts
└── README.md                      # This file
```

---

## 🔒 Authentication & Security

### JWT Session Flow

```
1. User logs in → POST /api/auth/login
2. Server validates credentials
3. Server creates JWT payload:
   { userId, email, role, subscriptionEnd, isActive }
4. JWT signed with JWT_SECRET (7-day expiry)
5. Stored as HttpOnly cookie: medhub_session
6. Edge Middleware decodes JWT on every request (no server call)
7. Middleware checks subscriptionEnd → auto-redirect if expired
8. API routes call getSessionUser() → verifies JWT signature
```

### Cookie Settings

| Property | Value | Reason |
|---|---|---|
| `httpOnly` | `true` | Prevents XSS JS access |
| `secure` | `true` in production | HTTPS only |
| `sameSite` | `strict` | CSRF protection |
| `maxAge` | 7 days | Auto-expiry |
| `path` | `/` | Available site-wide |

### Password Hashing

- bcrypt with **12 salt rounds** for all passwords
- Staff passwords stored in `plainPassword` (evaluation mode only — remove in production)

### Role-Based Access

- **API level:** Each route handler calls `getSessionUser()` and checks `user.role`
- **Middleware level:** Path prefix matching redirects unauthorized role access
- **UI level:** Staff see only features listed in their `allowedFeatures` string

---

## 📊 Business Logic

### FIFO Batch Allocation

When an order is placed, the system allocates stock using the FIFO strategy:

```typescript
// Selects batches ordered by earliest expiry, with row-level locking
const batches = await tx.$queryRaw<any[]>`
  SELECT * FROM "InventoryBatch"
  WHERE "productId" = ${item.productId}
    AND "expiryDate" > NOW()
    AND "availableBaseUnits" > 0
  ORDER BY "expiryDate" ASC
  FOR UPDATE
`;

// Decrement availableBaseUnits from each batch until order is filled
// If total stock is insufficient → entire transaction is rolled back
```

### Credit Guard System

Before creating a B2B order:
1. Check if `netAmount > retailer.creditLimit`
2. Check if retailer has any orders in PENDING/PICKING/DISPATCHED status older than 30 days
3. If either condition is true AND no `overrideJustification` → return `CREDIT_BLOCKED` error
4. If `overrideJustification` provided → log it to `SystemAuditLog` and proceed

### Loyalty Tier Discounts

```typescript
let discountPercent = 0;
if (retailer.lifetimeSpend >= 500000)      discountPercent = 0.10; // GOLD: 10%
else if (retailer.lifetimeSpend >= 100000) discountPercent = 0.05; // SILVER: 5%
// else BRONZE: 0%

const discountAmount = totalAmount * discountPercent;
const netAmount = totalAmount - discountAmount;
```

After every delivered order, `lifetimeSpend` is incremented by `netAmount`, potentially upgrading the retailer's tier for future orders.

### B2C Deferred Inventory Allocation

To ensure customer experience and handle COD order failure gracefully:
1. **Order Placement**: Placing an online consumer order only performs a stock check but does **not** lock or decrement stock from the retailer's inventory.
2. **FIFO Stock Deduction on Dispatch**: When the retailer updates the order status to `SHIPPED`, a transaction selects the retailer's inventory batches ordered by earliest expiry date first (FIFO) and decrements the quantity. If total stock is insufficient, the transition fails.
3. **Restoration on Failure**: If the order delivery is subsequently marked as `FAILED`, the deducted stock is fully restored to the retailer's inventory. If the original batch row was deleted or is missing, a fallback batch named `RESTORED-FAIL` is created to add the stock back.

### Geolocation & Delivery Fee Calculation

Distance between the buyer and a retailer is computed using the **Haversine formula**:

$$\text{distance} = 2 R \cdot \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \text{lat}}{2}\right) + \cos(\text{lat}_1)\cos(\text{lat}_2)\sin^2\left(\frac{\Delta \text{lon}}{2}\right)}\right)$$

Where $R = 6371\text{ km}$.

The retailer's JSON-configured custom delivery fee tiers are evaluated sequentially:
- Tiers are sorted ascending by `maxKm`.
- The first tier where $\text{distance} \leq \text{maxKm}$ determines the delivery fee.
- If the distance exceeds all tiers, the fee of the highest km tier is applied as a fallback.

### POS Ledger vs. Online B2C Ledger Entries

Double-entry bookkeeping distinguishes POS and B2C sales:
- **POS Sales**: Logged as immediate ledger entries under a global placeholder `Walk-in Customer` retailer profile account, since physical counter payments are resolved instantly.
- **B2C Online Orders**: Only logged as `SALE` ledger credit entries under the respective retailer profile account when transitioned to `DELIVERED` status. This prevents unearned revenue accrual on orders that are shipped but fail during final transit.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Run linting: `npm run lint`
5. Commit: `git commit -m "feat: add your feature description"`
6. Push: `git push origin feature/your-feature-name`
7. Open a Pull Request

### Commit Convention

```
feat:     New feature
fix:      Bug fix
docs:     Documentation changes
style:    UI/styling changes
refactor: Code refactoring
perf:     Performance improvements
chore:    Build/config changes
```

---

<div align="center">

**Built with ❤️ for transparent pharmaceutical supply chains**

MedHub Core Network · PostgreSQL Port 5432 · FIFO Active · End-to-End Encrypted

</div>
