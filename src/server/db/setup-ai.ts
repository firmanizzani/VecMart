import { readFileSync } from 'node:fs';
import { db } from './index.js';

// Existing installations may predate Drizzle migration tracking. Apply only the
// additive AI table here; fresh databases can continue using db:migrate.
try {
  const migration = readFileSync(new URL('../../../drizzle/0002_assistant_usage.sql', import.meta.url), 'utf8');
  await db.$client.query(migration.replace('CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS '));
  console.log('AI usage storage is ready.');
} catch { console.error('Could not prepare AI usage storage. Check database connectivity.'); process.exitCode = 1; }
finally { await db.$client.end(); }
