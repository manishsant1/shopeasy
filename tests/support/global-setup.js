import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Pool } from '@neondatabase/serverless';
import { PRODUCTS } from '../../server/seed.js';

// Runs once before the suite: refuses to touch the dev database, rebuilds the frontend,
// then resets the TEST database to a known state (no orders, seed stock levels).
export default async function globalSetup() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing: create .env.test');

  let devUrl;
  try {
    devUrl = readFileSync('.env', 'utf8').match(/^DATABASE_URL=(.+)$/m)?.[1].trim();
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  const host = (u) => u?.split('@')[1]?.split('/')[0];
  if (devUrl && host(devUrl) === host(url)) {
    throw new Error('.env.test points at the same database host as .env. Refusing to reset it.');
  }

  execSync('npm run build', { stdio: 'inherit' });

  // db.js reads DATABASE_URL at import time, so it must be imported after the check above.
  const db = await import('../../server/db.js');
  await db.init(); // creates tables and seeds a brand-new database
  const pool = new Pool({ connectionString: url });
  try {
    await pool.query('TRUNCATE orders, order_items CASCADE');
    for (const p of PRODUCTS) {
      await pool.query('UPDATE products SET stock = $1, price = $2 WHERE id = $3', [p.stock, p.price, p.id]);
    }
  } finally {
    await pool.end();
    await db.close();
  }
}
