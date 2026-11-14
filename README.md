# VecMart - Point of Sale Application

VecMart is a web application for managing retail store operations, point of sale transactions, inventory, and sales analytics, featuring dedicated roles for Admin and Cashier users.

## Features

- **Point of Sale (POS) Interface:** Fast checkout process for cashiers with barcode support, cart management, receipt printing, and member discounts.
- **Inventory & Stock Opname:** Product catalog management, category organization, supplier tracking, low stock alerts, and stock opname adjustments.
- **Transaction & Sales History:** Comprehensive record of sales transactions, daily cash register closing reports, and export capabilities.
- **Analytics & Reporting:** Sales performance dashboards, profit/loss tracking, top-selling products visualization, and revenue charts.
- **User & Role Management:** Secure authentication and role-based access control with distinct interfaces for Admin and Cashier roles.

## Tech Stack

- **Frontend:** SvelteKit, TypeScript, Vite, Tailwind CSS, Lucide Svelte, Chart.js
- **Backend:** ElysiaJS (served through SvelteKit), Drizzle ORM, PostgreSQL (Via NeonDB)
- **Deployment:** Vercel

## Running locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` if you do not already have one. Set `DATABASE_URL` to your PostgreSQL connection string. You can use Neon or a local PostgreSQL database.
3. Run `npm run dev` and open the local URL printed in the terminal (normally `http://localhost:5173`).

Frontend and backend run in the same process. SvelteKit serves the Elysia backend at `/api`; no separate server on port 3000 is required. Check `http://localhost:5173/api` for the API status. Database-backed endpoints also require a reachable database with the application's tables.

For a new, empty database, run `npm run db:migrate`, then `npm run db:seed` to populate demo data. Run the seed only against a development database; review `src/server/db/seed.ts` before using it with existing data.

If `/api` works but login or product requests fail, check `DATABASE_URL`, database connectivity, and whether migrations have been applied. Restart the dev server after changing `.env`.
