# ShopEasy

A simple eCommerce app: React + Vite frontend and a Node.js + Express API, run as **one process from one package**, with data stored in **Neon serverless Postgres**.

## Run

1. Create a Neon project at https://console.neon.tech and copy its connection string (Connect button).
2. Copy `.env.example` to `.env` and set `DATABASE_URL` to that string.
3. Start the app:

```
npm install
npm run dev          # development: http://localhost:3000, with hot reload
```

On first start the server creates the tables and loads the product catalog.

For production:

```
npm run build        # builds the frontend into dist/
npm start            # serves the API and the built app on http://localhost:3000
```

## Deploy

Deploy the project folder as a single unit:

```
npm ci
npm run build
npm prune --omit=dev     # optional: removes Vite and other build-only packages
npm start
```

Environment variables:

| Variable       | Default | Purpose                                  |
|----------------|---------|------------------------------------------|
| `DATABASE_URL` | none (required) | Neon Postgres connection string |
| `PORT`         | `3000`  | HTTP port                                |

Set these in your hosting platform's settings. A `.env` file is also read if present. The app keeps no data on local disk, so any host that runs Node works.

Requires Node.js 22.9 or newer.

## How it fits together

```
server/
  index.js    Entry point. Mounts the API at /api; in dev runs Vite inside Express,
              in production serves dist/ (and index.html for client-side routes).
  dev.js      Dev runner: restarts index.js when server/ or shared/ code changes
  routes.js   API endpoints
  db.js       Postgres access (Neon driver): schema, queries, order transaction
  seed.js     Initial product catalog, loaded into an empty database
  errors.js   HttpError
shared/
  pricing.js      Shipping and tax rules, used by both browser and server
  validation.js   Checkout form rules, used by both browser and server
src/
  api/api.js      The only place the frontend calls the server
  context/        Cart and wishlist state
  pages/          Home, ProductDetail, Cart, Checkout, Orders, Wishlist
```

### API

| Method | Path                | Notes                                                          |
|--------|---------------------|----------------------------------------------------------------|
| GET    | `/api/health`       | Health check                                                   |
| GET    | `/api/categories`   |                                                                |
| GET    | `/api/products`     |                                                                |
| GET    | `/api/products/:id` | 404 if not found                                               |
| GET    | `/api/orders`       | Orders for the caller (needs the `X-Client-Id` header)         |
| POST   | `/api/orders`       | `{ items: [{ id, qty }], shipping: {...}, payment }`           |

The server ignores any prices sent by the browser. It looks up prices, checks stock, recalculates the total, and reduces stock, all in one database transaction that locks the products being bought.

### What is stored where

- **Postgres:** tables `categories`, `products`, `orders` and `order_items`, created automatically at startup.
- **Browser (`localStorage`):** cart, wishlist, the last shipping address, and an anonymous client ID.

There are no user accounts yet. Each browser generates a random ID and sends it as `X-Client-Id`, so it only sees its own orders. When authentication is added, replace this with the signed-in user's ID (`requireClientId` in `server/routes.js` and `getClientId` in `src/api/api.js`).

To reset the data, drop the four tables in the Neon SQL editor and restart the server, which recreates and reseeds them:

```sql
DROP TABLE order_items, orders, products, categories;
```
