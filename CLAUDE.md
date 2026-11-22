# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
npm run dev      # dev server on http://localhost:3000 (API + Vite with HMR, one process)
npm run build    # build the frontend into dist/
npm start        # production: serves the API and dist/ on PORT (default 3000)
npm run test:e2e # Playwright UI + API tests (see "UI tests" below)
```

Run one test or file: `npx playwright test tests/e2e/checkout.spec.js` or `npx playwright test -g "happy path"`. Add `--headed` to watch, `--ui` to step through, `npx playwright show-report` for the last HTML report. Every run rebuilds `dist/` and resets the test database.

There is no linter or formatter configured. Verify changes with `npm run build`, `npm run test:e2e`, and by exercising the API with curl against a running server.

Requires Node >= 22.9 (uses `--env-file-if-exists` and the global `WebSocket` that Neon's Pool needs). `DATABASE_URL` (a Neon Postgres connection string) must be set in `.env` or the environment, otherwise the server exits on startup. See `.env.example`.

## Architecture

A single deployable package: one Express process serves both the JSON API and the React app. There is no separate frontend server and no CORS. The browser calls same-origin `/api/*`.

- `server/index.js` mounts the API at `/api`, then either runs Vite in middleware mode (dev) or serves `dist/` with an `index.html` fallback for client-side routes (prod, chosen with `--prod` or `NODE_ENV=production`). It runs `db.init()` before listening. Vite is a devDependency and is only imported in dev mode, so `npm prune --omit=dev` after building is safe.
- `server/dev.js` is the dev runner. It spawns `index.js` and restarts it when a `.js` file under `server/` or `shared/` changes. **Do not replace it with `node --watch` / `--watch-path`.** On Windows these react to Vite writing `node_modules/.vite/deps_temp_*` and get stuck in a restart loop. For the same reason, `index.js` imports `vite.config.js` itself and passes `configFile: false` to Vite, because Vite's own config loader writes a temporary `vite.config.js.timestamp-*.mjs` file.
- `server/db.js` is the only place with SQL. It uses `Pool` from `@neondatabase/serverless` (WebSocket, so interactive transactions work). The schema is idempotent `CREATE TABLE IF NOT EXISTS` run on every start, and the catalog in `server/seed.js` is inserted only when `products` is empty. There is no migration tool, so schema changes to existing tables need manual `ALTER`s. Postgres `numeric` columns come back as strings and are converted with `Number()` in `toProduct` / `toOrder`.
- `createOrder` is the core invariant. In one transaction it locks the requested product rows (`SELECT ... FOR UPDATE`), checks stock, reprices from the database, inserts `orders` + `order_items`, and decrements stock. The client sends only `{id, qty}`. Prices and totals sent by the client are ignored. `order_items` snapshot the name, emoji and price so past orders don't change when the catalog does.
- `server/routes.js` handles request validation, and `HttpError` (`server/errors.js`) becomes `{error, details}` JSON. Express 5 forwards async throws to the error handler, so handlers simply `throw`. `HttpError` may be thrown from inside `db.createOrder` (stock errors, 409), which also rolls back the transaction.
- `shared/` is imported by both the server and the browser, so the two can't disagree. `pricing.js` holds shipping and tax rules (`orderTotals`), and `validation.js` holds the checkout fields, payment methods and `validateShipping`. Keep this code dependency-free and runnable in both environments. The frontend imports it as `../../shared/...`.

### Observability

`server/telemetry.js` pushes OpenTelemetry metrics straight to Grafana Cloud over OTLP/HTTP (no agent). It is active only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set (see `.env.example`); otherwise all instruments are no-ops. `httpMetrics` middleware (mounted on `/api`) records request duration by route pattern; order counters are recorded in `routes.js`. The SDK swallows export errors, so set `OTEL_LOG_LEVEL=error` to debug. Neon can be slow to wake, so `db.init()` occasionally fails on the first start; just retry.

### Identity (no auth yet)

Each browser generates a random ID (`getClientId` in `src/api/api.js`, stored in localStorage) and sends it as the `X-Client-Id` header. `requireClientId` in `server/routes.js` uses it to scope orders. When authentication is added, those two functions are the integration points.

### Frontend (`src/`)

- `src/api/api.js` is the only module that calls the server. It throws `ApiError` with `status` and `details` (per-field errors that the Checkout form displays).
- `src/context/StoreContext.jsx` keeps the cart and wishlist in React state, persisted to localStorage through `src/api/storage.js` (keys prefixed `shopeasy:`). Cart lines store a full product snapshot `{product, qty}`, so stock can be stale on the client. The server is the authority at checkout.
- Routing uses react-router v6 (`src/App.jsx`). Styling is a single global `src/index.css` with CSS variables, with no CSS framework. Product images are emoji (`product.emoji`).

## Windows environment notes

- Stopping a background `npm run dev` can leave `node ... server\index.js` / `server/dev.js` processes holding port 3000 (and Vite's HMR port 24678). Kill them before restarting.
- PowerShell `Invoke-WebRequest` to `localhost` can hang on this machine. Use `curl` from Bash.

## UI tests (Playwright)

```
npm run test:e2e   # builds dist/, resets the TEST database, starts the app on :3100, runs tests/e2e
```

- Config: `playwright.config.js`. The test DB URL lives in `.env.test` (gitignored); `.env` is never loaded by the tests. `tests/support/global-setup.js` refuses to run if `.env.test` and `.env` point at the same DB host, then truncates `orders`/`order_items` and resets product stock and prices to `server/seed.js`.
- Each test gets a fresh browser context, so a new `X-Client-Id`, cart and wishlist. Tests that change stock use a product no other test uses (the Winter Jacket `p8` in the stock-conflict test), so keep that isolation when adding tests.
- The test DB is remote, so parallel checkouts queue on latency. `workers: 2`, generous timeouts and one retry are deliberate; 4 workers was flaky.
- Specs assume the seed catalog (20 products, `p4` out of stock). Report: `npx playwright show-report`.

## Azure deployment

Live at https://shopeasy-ecom-7k2.azurewebsites.net (App Service B1, Linux, Node 22, Always On; resource group `shopeasy-ecom-7k2-rg`, plan `shopeasy-ecom-7k2-plan`, region `centralindia` since `eastus` had no B1 quota). It uses the **same Neon database as `.env`** (the dev DB), and has the `OTEL_*` Grafana settings.

- Deployed with the `build-fullstack-azure` skill's `deploy-azure.mjs` (idempotent; re-run to redeploy). The stock script needs `BETTER_AUTH_SECRET` (this app has no auth) and breaks on the space in `C:\Program Files\...\az.cmd` and on `--startup-file npm start`. A patched copy was used; fix the skill before reusing it.
- The zip is built locally: `dist/`, `server/`, `shared/`, `package.json`, plus `npm ci --omit=dev` in a staging folder, and is sent with `az webapp deploy --type zip`. Do not rely on Azure's Oryx build (Vite is a devDependency).
- No `smoke` script exists here. After a deploy, check `/api/health`, `/api/products` and `/cart` (SPA fallback) with curl. Do not run the Playwright suite against it: it resets the database.
- The old host, if any, was not touched.

## Git and CI

- `.github/workflows/e2e.yml` runs the Playwright suite on pushes to `main` and on pull requests. It needs a repository secret `TEST_DATABASE_URL` (the Neon **test** database, never the dev/prod one). In CI there is no `.env.test`; `playwright.config.js` falls back to the `DATABASE_URL` environment variable.
- Ignored on purpose because they hold real credentials: `.env`, `.env.test`, `postgressconnectionstring.txt`, `agent creation and usage.txt`.
