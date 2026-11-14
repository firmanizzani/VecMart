import { readFileSync } from 'node:fs';
import { db } from './index.js';

// Existing installations may predate Drizzle migration tracking. Apply only the
// additive AI tables here; fresh databases can continue using db:migrate.
const client = await db.$client.connect();
try {
  await client.query('BEGIN');
  const migration = readFileSync(new URL('../../../drizzle/0002_assistant_usage.sql', import.meta.url), 'utf8');
  await client.query(migration.replace('CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS '));
  const existing = await client.query("SELECT to_regclass('public.assistant_actions') AS name");
  if (!existing.rows[0].name) {
    const actions = readFileSync(new URL('../../../drizzle/0003_spooky_lily_hollister.sql', import.meta.url), 'utf8');
    await client.query(actions);
  }
  await client.query('COMMIT');
  console.log('AI usage and product action storage are ready.');
} catch { await client.query('ROLLBACK').catch(() => {}); console.error('Could not prepare AI storage. Check database connectivity.'); process.exitCode = 1; }
finally { client.release(); await db.$client.end(); }
