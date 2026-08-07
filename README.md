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

**A full-stack, multi-role pharmaceutical B2B & B2C distribution platform** built with Next.js 16, PostgreSQL, and Prisma.  
MedHub connects wholesale drug distributors, retail pharmacies, doctor clinics, consumers, and a superadmin control center onto one secure, real-time audited network.

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
  - [Register Page & Partner Verification](#3-register-page--partner-verification--register)
  - [Wholesaler Dashboard & Management](#4-wholesaler-dashboard--management--wholesaler)
  - [Retailer Dashboard & B2C Management](#5-retailer-dashboard--b2c-management--retailer)
  - [Buy Medicine Portal (B2C Marketplace)](#6-buy-medicine-portal-b2c-marketplace--buy-medicine)
  - [Superadmin Matrix Control Center](#7-superadmin-matrix-control-center--superadminmatrix-dashboard)
- [API Documentation](#-api-documentation)
  - [Authentication & Verification APIs](#authentication--verification-apis)
  - [Superadmin Management APIs](#superadmin-management-apis)
  - [Wholesaler Portal APIs](#wholesaler-portal-apis)
  - [Retailer Portal APIs](#retailer-portal-apis)
  - [B2C Marketplace Consumer Server Actions](#b2c-marketplace-consumer-server-actions)
- [Database Schema](#-database-schema)
  - [Entity Relationship Overview](#entity-relationship-overview)
  - [Key Models](#key-models)
- [Environment Variables](#-environment-variables)
- [How to Run Locally](#-how-to-run-locally)
- [How to Deploy to Production](#-how-to-deploy-to-production)
- [Authentication & Security](#-authentication--security)
- [License](#-license)

---

## 🏥 Project Overview

MedHub is an **integrated pharmaceutical supply chain & retail execution system** designed to solve critical challenges in pharmaceutical distribution:

- 🔍 **Counterfeit & Expiry Traceability** — Batch-level inventory tracking from distributor to retail pharmacy with Code128 barcodes.
- 📜 **PAN / DDA / NMC Verification Safeguards** — Multi-tiered identity and license document verification (PAN/VAT IDs, DDA license numbers, and NMC doctor credentials).
- 📦 **Automated FIFO Inventory** — First-In-First-Out batch allocation preventing inventory write-offs and selling expired stock.
- 💳 **B2B Credit & Advance Ledger System** — Real-time double-entry credit ledger, payment settlements, and advance balance management.
- 🗺️ **Haversine Geo-Location Pharmacy Finder** — Radius-expanded pharmacy matching for consumers finding nearby medicine.
- 🩺 **Prescription Class-A Verification Engine** — Mandatory doctor prescription upload, NMC registration validation, and retailer verification flow for prescription drugs (`CLASS_A`).
- 🖨️ **POS Counter Billing** — Printable tax invoices with thermal/A4 preview modes for walk-in retail sales.
- ⚡ **WebSocket Real-time Synchronization** — Live order status and inventory updates across wholesaler and retailer dashboards without page reloads.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16.2.7 (App Router, Turbopack) |
| **Language** | TypeScript 5.x |
| **Database** | PostgreSQL 14+ |
| **ORM** | Prisma 5.22 |
| **Styling** | Vanilla CSS + TailwindCSS 4.x |
| **Authentication** | JWT (`medhub_session` cookie) + bcryptjs |
| **Real-Time Sync** | WebSocket Server (`ws`) + Custom Event Dispatcher |
| **Barcode Engine** | `bwip-js` (Code128 PNG rendering) |
| **Map & Geo** | Leaflet / React-Leaflet + Haversine Geo Calculation |
| **Icons & UI** | Lucide React, Framer Motion |

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         MEDHUB PLATFORM                         │
├───────────────────┬────────────────────────┬────────────────────┤
│   PUBLIC / B2C    │  RETAILER & WHOLESALER │  SUPERADMIN MATRIX │
│   /               │  /retailer/*           │  /superadmin/*     │
│   /login          │  /wholesaler/*         │  └─ User Audit &   │
│   /register       │  ├─ Inventory & POS    │     Verification   │
│   /buy-medicine   │  ├─ B2B/B2C Orders     │                    │
│                   │  └─ Ledger & Billing   │                    │
├───────────────────┴────────────────────────┴────────────────────┤
│           NEXT.JS API & SERVER ACTIONS (App Router)             │
│  /api/auth  /api/superadmin  /api/wholesaler  /api/retailer    │
├─────────────────────────────────────────────────────────────────┤
│                   WEBSOCKET & REALTIME LAYER                    │
│        Live Order Status · Stock Updates · Event Push           │
├─────────────────────────────────────────────────────────────────┤
│                    PRISMA ORM + POSTGRESQL                       │
│  Users · Profiles · Products · Batches · Orders · Audit Logs    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 👤 User Roles

| Role | Description | Access Scope |
|---|---|---|
| `SUPERADMIN` | Platform Controller | Full system audit, user approval/verification (PAN/DDA/NMC), package management |
| `WHOLESALER` | Wholesale Distributor | Product master catalog, batch ingestion, B2B order fulfillment, B2B credit ledger, staff management |
| `WHOLESALER_STAFF` | Distributor Employee | Feature-scoped access configured by wholesaler owner |
| `RETAILER` | Retail Pharmacy | B2B purchasing, retail POS billing, B2C consumer order fulfillment, prescription verification |
| `RETAILER_STAFF` | Pharmacy Employee | Feature-scoped access configured by pharmacy owner |
| `CLINIC` | Doctor Clinic | Direct clinic procurement & prescription portal (Coming Soon) |
| `CONSUMER` | End-User / Patient | Location-based medicine search, prescription upload, B2C checkout, live order tracking |

---

## 📱 Pages & UI Documentation

### 1. Landing Page — `/`
Modern landing page highlighting supply chain features, interactive sandbox tools (Geo-finder, Token generator, POS preview), and quick navigation to login/register portals.

### 2. Login Page — `/login`
Split-panel design supporting **Registered User** and **Staff Node** authentication, password recovery, and forced password reset workflows.

### 3. Register Page & Partner Verification — `/register`
Multi-step partner onboarding wizard:
- **Role Selection:** Wholesale Distributor, Retail Pharmacy, or Clinic.
- **Document Submission:** Collects company registration details, **PAN/VAT ID**, **DDA License Number**, address, phone, and optional document scans/images.
- **Verification Workflow:** Newly registered partners enter a `PENDING` verification status. Accounts must be reviewed and approved by `SUPERADMIN` before full feature access is granted.

### 4. Wholesaler Dashboard & Management — `/wholesaler/*`
- **Dashboard (`/wholesaler/dashboard`)**: Analytics charts, sales metrics, near-expiry alerts, and real-time WebSocket order notifications.
- **Inventory (`/wholesaler/inventory`)**: Product catalog management with custom tier pricing JSON, batch ingestion with expiry tracking, manufacturing costs, and Code128 barcode generation.
- **B2B Orders (`/wholesaler/orders`)**: Order processing pipeline (`PENDING` ➔ `PICKING` ➔ `DISPATCHED` ➔ `DELIVERED`), credit limit override logging, and cash settlement verification.
- **Billing & Ledger (`/wholesaler/billing`)**: Financial double-entry ledger, revenue vs cost analysis, printable tax invoices, and B2B settlement approval.
- **Staff & Profile (`/wholesaler/staff`, `/wholesaler/profile`)**: Staff permission management and business profile configuration.

### 5. Retailer Dashboard & B2C Management — `/retailer/*`
- **Dashboard (`/retailer/dashboard`)**: Interactive charts displaying B2C sales vs spend, active consumer order counts, and expiry alerts.
- **Inventory (`/retailer/inventory`)**: Stock level management, rack placement coordinates (e.g. `Rack A-4`), purchasing costs, selling price setup, and low stock warnings.
- **Orders (`/retailer/orders`)**: Dual-tab interface:
  - *B2B Orders*: Purchasing from wholesalers and receiving delivered inventory.
  - *B2C Orders*: Fulfillment of consumer orders (`PENDING` ➔ `SHIPPED` ➔ `DELIVERED`), custom delivery fee configuration, and **Prescription Verification**.
- **POS Terminal (`/retailer/pos`)**: Walk-in retail counter billing with receipt printing and instant stock deduction.

### 6. Buy Medicine Portal (B2C Marketplace) — `/buy-medicine`
Patient-centric medicine discovery portal:
- **Location Detection & Map Picker**: GPS coordinates or interactive Leaflet map pin selection.
- **Radial Distance Search Engine**: Expands search across nearest 10 ➔ 30 ➔ all pharmacies to find available stock.
- **Unit / Strip / Box Purchase Controls**: Dynamic price computation based on pack sizes.
- **Prescription Upload & Class-A Checks**: Mandatory prescription image upload and Doctor NMC license input for prescription medicines (`CLASS_A`).
- **Live Order Tracking**: Track order status (`PENDING`, `SHIPPED`, `DELIVERED`, `FAILED`) using unique tracking codes (e.g., `MH-XXXXXX`).

### 7. Superadmin Matrix Control Center — `/superadmin/matrix-dashboard`
Central command dashboard for platform administrators:
- **Account Verification Queue**: Review submitted partner details, PAN/VAT IDs, DDA license numbers, and uploaded verification documents. Approve or reject with custom feedback.
- **User Lease & Subscription Management**: Modify active status, extend subscription end dates, manage allowed feature strings, and issue temporary password resets.
- **Package Management**: Define global subscription packages and pricing tiers.
- **Platform Audit Log Feed**: Global activity log recording user logins, document verifications, credit overrides, and system changes.

---

## 📡 API Documentation

### Authentication & Verification APIs

#### `POST /api/auth/send-otp`
Generates a 6-digit verification code for partner registration.

#### `POST /api/auth/register`
Creates a partner account with initial `verificationStatus: "PENDING"`.

#### `POST /api/auth/login`
Authenticates credentials, checks subscription and verification status, and sets the `medhub_session` cookie.

---

### Superadmin Management APIs

#### `GET /api/superadmin/users`
Retrieves all system users, including verification statuses (`PENDING`, `VERIFIED`, `REJECTED`) and document links.

#### `PUT /api/superadmin/user/[id]`
Updates user subscription details, package assignments, active status, or verification status (`isVerified`, `verificationStatus`, `verificationRejectReason`).

#### `POST /api/superadmin/user/[id]`
Executes admin actions such as forcing a password reset.

---

### Wholesaler Portal APIs

#### `GET / POST /api/wholesaler/products`
Retrieves or creates product master catalog records with tiered box pricing.

#### `POST /api/wholesaler/batches`
Ingests a new product inventory batch with expiry date, cost breakdown, and barcode generation.

#### `GET /api/wholesaler/barcode?productId=<id>&batchNumber=<num>`
Generates a Code128 barcode PNG stream.

#### `POST /api/wholesaler/verify-settlement`
Confirms or rejects cash payment settlements submitted by retailers for B2B orders.

---

### Retailer Portal APIs

#### `GET / POST /api/retailer/inventory`
Manages retailer stock items, buying/selling prices, and rack storage locations.

#### `GET /api/retailer/analytics`
Provides monthly B2C sales vs spend performance data for dashboard charting.

#### `POST /api/retailer/returns/[id]/verify`
Processes B2B stock return requests back to wholesalers.

---

### B2C Marketplace Consumer Server Actions

Located in `src/app/actions/consumerActions.ts`:

- `fetchRetailersWithDistanceAction(buyerLat, buyerLng)`: Calculates pharmacy distances and custom delivery fees.
- `searchMedicinesExpandedAction(query, buyerLat, buyerLng)`: Searches nearby pharmacy stock using distance expansion.
- `placeConsumerOrderAction(data)`: Validates stock, prescription requirements, and creates a B2C consumer order with a tracking code (`MH-XXXXXX`).
- `updateConsumerOrderStatusAction(orderId, status)`: Transitions B2C orders:
  - `PENDING` ➔ `SHIPPED`: Deducts stock via FIFO transaction.
  - `SHIPPED` ➔ `FAILED`: Restores deducted stock to pharmacy inventory.
  - `SHIPPED` ➔ `DELIVERED`: Writes sale ledger entry.
- `verifyPrescriptionAction(orderId, action, rejectReason)`: Allows retailers to inspect uploaded prescription images and doctor NMC numbers, approving or rejecting the order prior to shipping.

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
                            ├── RetailerInventory
                            │
                            └── ConsumerOrder ─── ConsumerOrderItem
                            
User ──────────────── ClinicProfile

SystemAuditLog ────── User (nullable)
```

### Key Models

- **`User`**: System account record with role, authentication hashes, subscription lease timers, and verification flags (`isVerified`, `verificationStatus`, `verificationImagesJson`).
- **`WholesalerProfile`**: Distributor business profile storing PAN/tax ID, address, GPS coordinates, and staff relations.
- **`RetailerProfile`**: Retail pharmacy profile with drug license registration number, credit limit, delivery fee rules JSON, and inventory relations.
- **`Product`**: Medicine master record with SKU, tablets/strip, strips/box, medicine class (`CLASS_A` vs `CLASS_NORMAL`), and tier pricing JSON.
- **`InventoryBatch`**: Batch lot tracking total base units, remaining units, expiry date, manufacturing cost, and barcode URL.
- **`Order`**: B2B purchase order supporting FIFO allocations, credit limit checks, advance balance application, and settlement verification.
- **`ConsumerOrder`**: B2C online order record with buyer details, tracking code, prescription images, NMC doctor license number, prescription status (`PENDING`, `APPROVED`, `REJECTED`), and delivery status.

---

## 🔐 Environment Variables

Create a `.env` file in the root directory:

```env
# Database Connection
DATABASE_URL="postgresql://user:password@localhost:5432/medhub_db?schema=public"

# JWT Secret Key
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## 🚀 How to Run Locally

### 1. Prerequisites
- Node.js 18+
- PostgreSQL 14+
- `npm` or `pnpm`

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/your-username/major-project-code.git
cd major-project-code

# Install dependencies
npm install
```

### 3. Database Setup
```bash
# Generate Prisma Client
npx prisma generate

# Run Database Migrations
npx prisma migrate dev --name init

# (Optional) Seed Initial Data / Superadmin
npx prisma db seed
```

### 4. Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ☁️ How to Deploy to Production

1. **Database**: Provision a PostgreSQL instance (e.g. Neon, Supabase, AWS RDS, or Render).
2. **Environment**: Set `DATABASE_URL` and `JWT_SECRET` in your deployment server environment settings (Vercel / AWS / Docker).
3. **Build**:
```bash
npx prisma migrate deploy
npm run build
npm run start
```

---

## 🔒 Authentication & Security

- **HttpOnly Session Cookie**: Uses `medhub_session` JWT cookie to mitigate XSS risks.
- **Role-Based Middleware Guards**: Edge middleware validates JWT and enforces role access per path.
- **Verification Lock**: Partners with `PENDING` verification status are restricted until approved by Superadmin.
- **Row-Level Transaction Locking**: Critical inventory batch deductions use atomic database transactions to prevent double-spending stock.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.
