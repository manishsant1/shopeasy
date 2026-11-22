// Single entry point: serves the API and the React app from one process.
//   development  (npm run dev):   Vite runs inside Express with hot reload.
//   production   (npm start):     Express serves the prebuilt files in dist/.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import apiRouter from './routes.js';
import * as db from './db.js';
import { httpMetrics, shutdownTelemetry } from './telemetry.js';

const isProd = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');
const PORT = Number(process.env.PORT ?? 3000);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const app = express();
app.disable('x-powered-by');
// Record request metrics for every route (auth and static files included).
app.use(httpMetrics);
app.use('/api', express.json({ limit: '100kb' }), apiRouter);

if (isProd) {
  const dist = path.join(ROOT, 'dist');
  app.use(express.static(dist, { index: false }));
  // Any other GET is a client-side route (e.g. /cart), so send the app and let React Router handle it.
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
} else {
  // Vite is a dev dependency and is only loaded here, so production installs don't need it.
  const { createServer } = await import('vite');
  // Import the config ourselves instead of letting Vite load it: Vite bundles the config into
  // a temporary file next to it, which `node --watch` sees as a change, causing a restart loop.
  const { default: viteConfig } = await import('../vite.config.js');
  const vite = await createServer({
    ...viteConfig,
    configFile: false,
    root: ROOT,
    appType: 'spa',
    server: { middlewareMode: true, watch: { ignored: ['**/data/**', '**/server/**'] } },
  });
  app.use(vite.middlewares);
}

try {
  await db.init();
} catch (err) {
  console.error('Could not connect to the database:', err.message);
  process.exit(1);
}

const server = app.listen(PORT, () => {
  console.log(`ShopEasy (${isProd ? 'production' : 'development'}) running at http://localhost:${PORT}`);
});

// Close database connections cleanly when the platform stops the app.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close();
    Promise.allSettled([db.close(), shutdownTelemetry()]).finally(() => process.exit(0));
  });
}
