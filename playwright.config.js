import { defineConfig, devices } from '@playwright/test';
import { loadEnvFile } from 'node:process';

// Test settings (incl. the TEST database URL) live in .env.test, never in .env.
// In CI there is no file: DATABASE_URL comes from the environment (a GitHub secret).
try {
  loadEnvFile('.env.test');
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}
const PORT = Number(process.env.PORT ?? 3100);

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/support/global-setup.js',
  fullyParallel: true,
  workers: 2, // the test DB is remote (Neon); more workers just queue on DB latency
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 20_000 }, // remote Neon DB: allow for occasional slow API responses
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Serves the prebuilt dist/ (global setup builds it). Run node directly so .env (dev DB,
    // Grafana) is never loaded; telemetry stays off because no OTLP endpoint is set.
    command: 'node server/index.js --prod',
    url: `http://localhost:${PORT}/api/health`,
    env: { DATABASE_URL: process.env.DATABASE_URL, PORT: String(PORT), OTEL_EXPORTER_OTLP_ENDPOINT: '' },
    reuseExistingServer: false,
    timeout: 120_000, // Neon can be slow to wake
  },
});
