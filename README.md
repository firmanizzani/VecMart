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
- **Asisten VecMart:** An admin assistant powered by Google Gemini for stock and selling-price lookup, low-stock checks, sales summaries, best sellers, stock additions/reductions, stock-count corrections, and selling-price changes on existing products. Changes are audited and can be undone within 15 minutes. Requires server-side configuration; see [assistant setup](#asisten-vecmart-gemini).

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

The robot in the bottom-right corner of admin pages opens the assistant. It works with existing products; creating products remains in the Products form. Read-only requests return immediately. Stock additions/reductions execute once the product is unambiguous; multiple matching variants must be selected first. Absolute stock counts and selling-price changes show before/after values and require confirmation within five minutes.

| Example command | Behavior |
| --- | --- |
| `Cek stok dan harga Aqua 600ml` | Shows current stock and selling price. |
| `Tambah 50 pcs Aqua 600ml` | Adds 50 units directly. |
| `Kurangi stok Le Minerale 600ml sebanyak 2 buah` | Removes 2 units directly, refusing negative stock. |
| `Set stok Aqua 600ml menjadi 20 pcs` | Previews an absolute stock count; confirmation required. |
| `Ubah harga jual Aqua 600ml menjadi Rp 5.000` | Previews the new selling price; confirmation required. |
| `Ringkas penjualan bulan ini` | Shows stored sales totals. |
| `Produk terlaris bulan ini` | Shows best sellers for the period. |

Use one product change per message and quantities in the product's stock unit. Box/pack conversions, batch edits, product creation/deletion, and cost-price changes are not supported. Record sales through the cashier flow so receipts and revenue remain consistent; chat stock reductions are for corrections, damage, or loss.

Stock changes are recorded in Stock Opname; confirmed product actions, including selling-price changes, are stored in `assistant_actions`. Undo is available for 15 minutes. Relative stock undo preserves subsequent stock movements and refuses a negative result. Absolute-stock and price undo refuse to overwrite a value that has since changed. Replaying the same action never applies it twice. Confirmation also refuses a preview whose product value has changed.

1. Install dependencies with `npm install`.
2. Set `GEMINI_API_KEY` and a random `AUTH_SECRET` of at least 32 characters in `.env`. Use `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` to generate the secret. Keep both values server-side. See `.env.example` for all settings.
3. For an existing database, run `npm run db:setup-ai` to prepare the additive usage-counter and product-action audit tables. Run it again when upgrading an older assistant installation. New databases can use `npm run db:migrate` normally.
4. Restart the app and sign in again. Legacy browser tokens are not accepted by assistant endpoints. For Vercel, configure the same environment variables in the deployment settings and redeploy.

`GEMINI_MODEL` defaults to `gemini-3.5-flash-lite`. The default application caps are 500 model calls per day and 15 per minute, shared by the store and persisted in PostgreSQL. The daily window resets at midnight in `America/Los_Angeles` (14:00 or 15:00 WIB depending on daylight saving). Change `AI_DAILY_LIMIT` and `AI_MINUTE_LIMIT` to match the Google project's actual quota. The widget reports VecMart usage, not remaining quota for other applications sharing that Google project. Each new chat message uses one Gemini call; product selection, confirmation, and undo use the backend without another model request. Failed provider calls count toward the application cap.

Free API usage depends on the Google project's billing tier and current model availability. VecMart does not enable billing or switch providers/models automatically. Google quota errors are shown in the conversation. The model receives the user's message and the current date; product lookup and report calculations happen on the server. No product catalogue, customer contact data, PINs or server credentials are automatically sent to Gemini.

The assistant requires a signed, unexpired admin session, validates explicit values against the original command, matches products against the catalogue, and writes each change plus its audit record in one transaction. Selection and confirmation tokens are bound to the admin and product. Existing unrelated API routes retain their previous authorization behavior.

To extend the assistant, add an intent and tool schema in `src/server/ai/gemini.ts`, dispatch it from `service.ts`, and implement server-side validation and execution. Product mutations live in `product-actions.ts`; shared reply types and UI states live in `src/lib/ai/types.ts` and `AssistantPanel.svelte`. Add integration tests for authorization, replay, ambiguity, and undo before enabling a new mutation. Updating the model prompt alone does not grant a new capability.

Run `npm run test:ai` for assistant integration tests against the configured database. All write fixtures are rolled back; tests do not call Gemini. `npm run check` validates Svelte and TypeScript.
