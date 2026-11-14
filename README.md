# VecMart — Minimarket POS & Store Management

VecMart is a full-stack web application for Indonesian minimarket operations, with dedicated Admin and Cashier interfaces. It brings checkout, product inventory, members, promotions, cashier sessions, sales reports, and a Gemini-powered store assistant into one application.

The responsive interface uses VecMart's light-blue identity, product photos, and a custom minimarket illustration on the login page. Frontend pages and backend APIs share one SvelteKit project and one build.

## Features

- **Cashier workspace:** Product search and barcode input, product photos, cart management, held transactions, member and promotion support, payment processing, and receipt printing.
- **Products & inventory:** Product catalogue with photos, categories, prices, stock levels, low-stock alerts, and stock opname adjustments.
- **Suppliers & purchase orders:** Supplier records and purchase-order tracking for store purchasing.
- **Members & promotions:** Member records, loyalty points, and promotional offers used during checkout.
- **Transactions & cashier sessions:** Sales history, shift opening and closing, cash reconciliation, and report exports.
- **Dashboard & reporting:** Revenue and profit charts with daily, weekly, monthly, yearly, and custom date filters; transaction totals, average purchase value, best sellers with product photos, and low-stock summaries.
- **Accounts & login:** Email and six-digit PIN login, signed session tokens using `AUTH_SECRET`, account management, and separate Admin and Cashier interfaces.
- **Asisten VecMart:** An admin assistant powered by Google Gemini for product and stock lookup, low-stock checks, sales summaries, best sellers, and explicit stock additions with an audit record and a 15-minute undo window. Requires server-side configuration; see [assistant setup](#asisten-vecmart-gemini).

## Tech Stack

- **Frontend:** Svelte 5, SvelteKit 2, TypeScript, Vite, Tailwind CSS, Lucide Svelte, and Chart.js.
- **Backend:** ElysiaJS mounted at `/api` through SvelteKit server endpoints; Node.js for local development.
- **Database:** PostgreSQL hosted on Neon, accessed with Drizzle ORM and `pg`; local PostgreSQL is also supported.
- **AI integration:** Google Gemini through the `@google/genai` SDK, with server-side request validation and database-backed usage limits.
- **Image uploads:** Vercel Blob for uploaded product images, alongside bundled product assets.
- **Exports:** SheetJS (`xlsx`) for spreadsheet exports.
- **Deployment:** Vercel, with frontend and API deployed from the same application.

## Project structure

```text
src/
  routes/           # SvelteKit pages: login, admin, and cashier
    api/            # Server endpoints forwarding requests to Elysia; image upload endpoint
  lib/              # Shared components, stores, and client utilities
  server/           # Elysia routes, database schema, session signing, and AI services
static/             # Public assets, fonts, favicon, and login illustration
assets/             # Bundled product images
drizzle/            # Database migrations
```

## Running locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` if you do not already have one. Set `DATABASE_URL` to your PostgreSQL connection string. You can use Neon or a local PostgreSQL database.
3. Run `npm run dev` and open the local URL printed in the terminal (normally `http://localhost:5173`).

Frontend and backend run in the same process. SvelteKit serves the Elysia backend at `/api`; no separate server on port 3000 is required. Check `http://localhost:5173/api` for the API status. Database-backed endpoints also require a reachable database with the application's tables.

For a new, empty database, run `npm run db:migrate`, then `npm run db:seed` to populate demo data. Run the seed only against a development database; review `src/server/db/seed.ts` before using it with existing data.

If `/api` works but login or product requests fail, check `DATABASE_URL`, database connectivity, and whether migrations have been applied. Restart the dev server after changing `.env`.

## Asisten VecMart (Gemini)

The robot in the bottom-right corner of admin pages opens the assistant. It can look up product stock, show low-stock products, summarize sales, list best sellers, and add stock from an explicit command such as `Stok Aqua 600ml tambah 50 pcs`. Multiple matching variants are presented as choices. Stock additions are recorded in Stock Opname and can be reversed for 15 minutes.

1. Install dependencies with `npm install`.
2. Set `GEMINI_API_KEY` and a random `AUTH_SECRET` of at least 32 characters in `.env`. Use `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` to generate the secret. Keep both values server-side. See `.env.example` for all settings.
3. For an existing database, run `npm run db:setup-ai` to add only the usage-counter table. New databases can use `npm run db:migrate` normally.
4. Restart the app and sign in again. Legacy browser tokens are not accepted by assistant endpoints. For Vercel, configure the same environment variables in the deployment settings and redeploy.

`GEMINI_MODEL` defaults to `gemini-3.5-flash-lite`. The default application caps are 500 model calls per day and 15 per minute, shared by the store and persisted in PostgreSQL. The daily window resets at midnight in `America/Los_Angeles` (14:00 or 15:00 WIB depending on daylight saving). Change `AI_DAILY_LIMIT` and `AI_MINUTE_LIMIT` to match the Google project's actual quota. The widget reports VecMart usage, not remaining quota for other applications sharing that Google project. Each new chat message uses one Gemini call; product selection and undo use the backend without another model request. Failed provider calls count toward the application cap.

Free API usage depends on the Google project's billing tier and current model availability. VecMart does not enable billing or switch providers/models automatically. Google quota errors are shown in the conversation. The model receives the user's message and the current date; product lookup and report calculations happen on the server. No product catalogue, customer contact data, PINs or server credentials are automatically sent to Gemini.

The assistant requires a signed, unexpired admin session, validates quantities and units, matches products against the catalogue, and writes stock plus its audit record in one transaction. Replayed stock requests cannot add stock twice. Undo subtracts the recorded addition from the current stock, preserving later changes, and refuses a reversal that would make stock negative. Existing unrelated API routes retain their previous authorization behavior.

Run `npm run test:ai` for assistant integration tests against the configured database. All write fixtures are rolled back; tests do not call Gemini. `npm run check` validates Svelte and TypeScript.
