import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { assistantUsage } from '../db/schema.js';
import { AssistantError } from './errors.js';

const setting = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};
export function quotaWindows(now = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = (part: string) => parts.find(p => p.type === part)!.value;
  const day = `${value('year')}-${value('month')}-${value('day')}`;
  const nextMidnightUTC = Date.UTC(Number(value('year')), Number(value('month')) - 1, Number(value('day')) + 1);
  let reset = nextMidnightUTC + 8 * 60 * 60 * 1000;
  // Resolve Pacific midnight with the offset on that date, including DST changes.
  for (let i = 0; i < 3; i++) {
    const zone = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', timeZoneName: 'longOffset' })
      .formatToParts(reset).find(p => p.type === 'timeZoneName')!.value;
    const offset = zone.match(/GMT([+-])(\d{2}):(\d{2})/);
    if (!offset) throw new Error('Pacific timezone offset is unavailable.');
    const minutes = (Number(offset[2]) * 60 + Number(offset[3])) * (offset[1] === '-' ? -1 : 1);
    reset = nextMidnightUTC - minutes * 60000;
  }
  return [
    { id: `day:${day}`, limit: setting('AI_DAILY_LIMIT', 500), resetsAt: new Date(reset) },
    { id: `minute:${Math.floor(now / 60000)}`, limit: setting('AI_MINUTE_LIMIT', 15), resetsAt: new Date(Math.floor(now / 60000) * 60000 + 60000) }
  ];
}

export async function getUsage() {
  const [day] = quotaWindows();
  const [row] = await db.select().from(assistantUsage).where(eq(assistantUsage.id, day.id));
  return { used: row?.requests || 0, limit: day.limit, resetsAt: day.resetsAt.toISOString() };
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function consumeUsageInTransaction(tx: Transaction, now = Date.now()) {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('vecmart-ai-quota'))`);
    const windows = quotaWindows(now);
    const counts = [];
    for (const window of windows) {
      const [row] = await tx.select().from(assistantUsage).where(eq(assistantUsage.id, window.id));
      const used = row?.requests || 0;
      if (used >= window.limit) {
        const retry = Math.max(1, Math.ceil((window.resetsAt.getTime() - Date.now()) / 1000));
        throw new AssistantError(429, 'APP_QUOTA_EXCEEDED', window.id.startsWith('day:')
          ? `Batas ${window.limit} permintaan AI hari ini sudah tercapai. Kuota kembali tersedia pukul ${window.resetsAt.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })} WIB.`
          : `Terlalu banyak permintaan. Tunggu ${retry} detik lalu coba lagi.`, retry);
      }
      counts.push({ ...window, used });
    }
    for (const window of counts) await tx.insert(assistantUsage).values({ id: window.id, requests: window.used + 1, resetsAt: window.resetsAt })
      .onConflictDoUpdate({ target: assistantUsage.id, set: { requests: window.used + 1 } });
    // Expired minute counters need not accumulate indefinitely.
    await tx.delete(assistantUsage).where(sql`${assistantUsage.resetsAt} < NOW() - INTERVAL '2 days'`);
    return { used: counts[0].used + 1, limit: counts[0].limit, resetsAt: counts[0].resetsAt.toISOString() };
}

export async function consumeUsage() { return db.transaction(tx => consumeUsageInTransaction(tx)); }
