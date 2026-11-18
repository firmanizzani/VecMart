# VecMart - Minimarket POS & Store Management System

VecMart is a modern web application designed for managing daily minimarket operations. The system connects sales, inventory, cashier sessions, and store reports in one place, with dedicated interfaces for **Administrators (Admin)** and **Cashiers (Kasir)**. A Google Gemini-powered assistant helps administrators check store information and update existing products through natural-language commands.

## Features

- **Cashier & Checkout**: Product search and barcode input, cart management, held transactions, member and promotion support, cash, QRIS, and debit payments, and receipt printing.
- **Products & Inventory**: Product management with photos, categories, purchase and selling prices, stock levels, low-stock alerts, and stock opname adjustments.
- **Suppliers & Purchase Orders**: Supplier records and purchase-order tracking for store purchasing.
- **Members & Promotions**: Customer membership records, loyalty points, and promotions applied during checkout.
- **Sales Dashboard & Reports**: Revenue and profit charts, transaction counts, average purchase value, and best-selling products, with daily, weekly, monthly, yearly, and custom date filters.
- **Cashier Revenue Reports**: Sales totals per cashier for a selected period, with transaction counts, payment-method breakdowns, cashier filtering, and Excel exports. Sales revenue is reported separately from cash drawer balances.
- **Cashier Sessions & Reconciliation**: Shift opening and closing, starting cash, expected and actual drawer balances, and cash discrepancy recaps.
- **AI Store Assistant**: A floating, animated assistant for administrators to check stock and selling prices, find low-stock products, summarize sales, identify best sellers, and adjust stock or selling prices on existing products. Absolute stock counts and selling-price changes require confirmation; changes are audited and can be undone within 15 minutes.
- **Accounts & Login**: Email and six-digit PIN login with signed session tokens, account management, and separate Admin and Cashier interfaces. Assistant endpoints and cashier revenue reports require an authenticated administrator.
- **Responsive Interface & Landing Page**: A public landing page with product previews and interactive feature demos, plus layouts for desktop, tablet, and mobile. The mobile assistant supports floating and fullscreen modes.

## Tech Stack

- **Frontend**: Svelte 5, SvelteKit 2, TypeScript, Vite, Tailwind CSS, Lucide Svelte, and Chart.js.
- **Backend**: ElysiaJS integrated into SvelteKit server endpoints under `/api`, with Node.js for local development.
- **Database**: PostgreSQL hosted on Neon, accessed through Drizzle ORM and the `pg` driver.
- **AI**: Google Gemini through the `@google/genai` SDK, with a configurable model, server-side command validation, and database-backed application usage limits.
- **Authentication**: Custom HMAC-signed session tokens using Node.js `crypto` and a server-side `AUTH_SECRET`.
- **Storage**: Vercel Blob for uploaded product images, alongside bundled static assets.
- **Exports**: SheetJS (`xlsx`) for Excel report exports and browser printing for receipts.
- **Deployment**: Vercel, with the frontend and API deployed from the same SvelteKit project.
