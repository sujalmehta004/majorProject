# MedHub: Connected Pharmaceutical Supply Chain Ledger & B2C Marketplace

MedHub is a modern, decentralized pharmaceutical supply chain network and B2C patient marketplace. It bridges the gap between wholesale distributors, retail pharmacies, doctor clinics, and consumers on a unified secure platform. 

The application optimizes pharmaceutical logistics through automated FIFO batch dispatching, real-time geolocation-based pharmacy lookups, flexible pack pricing, unified ledger transactions, and automated notification alerts.

---

## Table of Contents
1. [Core Features](#core-features)
   - [1. Wholesaler Module](#1-wholesaler-module)
   - [2. Retailer Module](#2-retailer-module)
   - [3. Patient Portal / B2C Marketplace](#3-patient-portal--b2c-marketplace)
2. [Tech Stack](#tech-stack)
3. [Environment Configuration](#environment-configuration)
4. [Database & Prisma Setup](#database--prisma-setup)
5. [Local Development Guide](#local-development-guide)
6. [Directory & Page Structure](#directory--page-structure)
7. [API Documentation](#api-documentation)
8. [Hosting & Production Deployment](#hosting--production-deployment)

---

## Core Features

### 1. Wholesaler Module
* **Inventory & Batch Tracking**: Manage products by batch numbers, tracking manufacturing cost, expiration dates, available base units, and suppliers.
* **Tiered Pricing**: Configure price scaling based on order sizes (e.g., bulk discount rates per box).
* **Credit Safeguards**: Enforce strict credit limit guardrails and verification checks on purchasing retailers.
* **FIFO Dispatch System**: Automated FIFO batch selection prioritizing nearest expiry items during B2B order packing.
* **Settlements System**: Verify and confirm payments made by retailers for outstanding purchase orders.

### 2. Retailer Module
* **Purchase Orders**: Order products directly from wholesalers based on credit status.
* **Barcode-verified Intake**: Safely intake items into retail stock by verifying batch barcodes.
* **POS Walk-in Billing**: A quick-billing point-of-sale terminal to generate walk-in consumer invoices, with printing capabilities.
* **Online Order Management**: Manage consumer orders, change status (PENDING → SHIPPED → DELIVERED/FAILED), and track logistics.
* **Delivery Fee Rules Engine**: Define customizable delivery fee tiers based on radial km distances (e.g. 0-5km is free, 5-10km is Rs. 100).
* **Double-Entry Ledger**: Clear running balance sheets tracking credits, debits, payments, and sales.

### 3. Patient Portal / B2C Marketplace
* **Pharmacy Geolocation Lookup**: Automatically detect user coordinates or let them pick a location on an interactive **Leaflet.js map widget**. Displays nearby pharmacies sorted by distance.
* **Smart Stock Search**: Look up medicines across the nearest pharmacies first (tier 1: nearest 10, tier 2: nearest 30, tier 3: all others) to minimize wait times.
* **Advanced Pack Pricing**: Review per-unit (tablet), per-strip, and per-box prices, and place orders in any of these package modes.
* **Cash on Delivery Checkout**: Secure checkout with contact info, custom coordinates, and estimated delivery fee.
* **Order Tracking**: Track live delivery progress (PENDING, SHIPPED, DELIVERED, FAILED) with short code tracking IDs (`MH-XXXXXX`).

---

## Tech Stack
* **Framework**: Next.js 16.2 (using dynamic server routing and api handlers)
* **Frontend**: React 19, Vanilla CSS, TailwindCSS, Lucide Icons, Leaflet.js (loaded via CDN)
* **Database & ORM**: PostgreSQL, Prisma Client
* **Mailing**: Nodemailer (SMTP config)
* **State & Syncing**: BroadcastChannel API for real-time tab-to-tab page syncs

---

## Environment Configuration

Before running the project, create a `.env` file in the root directory. 

### `.env` File Template
```env
# Database Connection (PostgreSQL)
# Format: postgresql://[user]:[password]@[host]:[port]/[database_name]?schema=public
DATABASE_URL="postgresql://sujalmehta@localhost:5432/medhub?schema=public"

# JSON Web Token Secret (used for session authorization cookies)
JWT_SECRET="your_secure_random_jwt_secret_key"

# Nodemailer SMTP Configuration
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-smtp-app-password"
```

> [!NOTE]
> If using Gmail for Nodemailer SMTP, you must generate an **App Password** from your Google Account settings instead of using your raw account password.

---

## Database & Prisma Setup

MedHub uses Prisma ORM to connect to your PostgreSQL database.

1. **Verify Database is Running**: Ensure your local PostgreSQL instance is running on port `5432`.
2. **Push Schema Modifications**:
   Sync your database schema with the Prisma definition:
   ```bash
   npx prisma db push
   ```
3. **Generate Prisma Client**:
   Regenerate typescript types and client queries:
   ```bash
   npx prisma generate
   ```
4. **Prisma Studio (Optional)**:
   Launch the database editor UI:
   ```bash
   npx prisma studio
   ```

---

## Local Development Guide

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Apply Database Migration**:
   ```bash
   npx prisma db push
   ```
3. **Run Dev Server**:
   ```bash
   npm run dev
   ```
4. **Access the App**:
   Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## Directory & Page Structure

```text
├── prisma/
│   └── schema.prisma           # Prisma Database Schema definition
├── src/
│   ├── app/
│   │   ├── buy-medicine/       # Patient Portal (/buy-medicine)
│   │   ├── login/              # Login interface
│   │   ├── register/           # Registration portal
│   │   ├── retailer/           # Retailer pages (Dashboard, Orders, Billing, POS)
│   │   ├── wholesaler/         # Wholesaler pages (Dashboard, Orders, Inventory, POS)
│   │   ├── superadmin/         # System controls and analytics
│   │   └── api/                # Core HTTP endpoint routes
│   ├── components/             # Reusable UI components (Layouts, Canvas, Map)
│   └── lib/                    # Shared utilities (db, mailer, ledger, auth)
```

---

## API Documentation

### Authentication APIs
* `POST /api/auth/login`: Authenticate credentials, set session cookies.
* `POST /api/auth/logout`: Clear active session cookies.
* `POST /api/auth/register`: Create user and associate Wholesaler/Retailer profiles.
* `POST /api/auth/send-otp`: Sends recovery one-time pins via SMTP.

### Retailer APIs
* `GET /api/retailer/inventory`: Retrieve active retail stocks.
* `GET /api/retailer/orders`: Fetch B2B purchases and B2C online orders.
* `POST /api/retailer/pos`: Record physical walk-in B2C checkout sales.
* `GET /api/retailer/billing`: Query ledger sheets and return requests.

### Wholesaler APIs
* `GET /api/wholesaler/products`: Retrieve wholesaler catalog items.
* `POST /api/wholesaler/batches`: Ingest new batches with invoice details.
* `POST /api/wholesaler/verify-settlement`: Approve/reject payments from retailers.

---

## Hosting & Production Deployment

To run MedHub in production:

1. **Build Production Bundle**:
   ```bash
   npm run build
   ```
2. **Start Next.js Production Server**:
   ```bash
   npm run start
   ```

### Deploying to Platforms (Vercel, Render, AWS)
* **Vercel**: Seamlessly integrates with Next.js. Add your `.env` variables under Project Settings -> Environment Variables. Ensure your database (e.g. Supabase, Neon) has a public database connection string.
* **Docker Deployment**: You can build a standard multi-stage Docker image packaging the node runtime, copying Next.js static files, and running `npx prisma db push` during deployment hook cycles.
