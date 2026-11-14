import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { transactions, users } from '../db/schema.js';
import { summarizeCashiers } from '../../lib/cashier-report.js';

export function reportBounds(start: string, end: string) {
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!valid(start) || !valid(end)) throw new Error('Tanggal tidak valid.');
  const from = new Date(`${start}T00:00:00+07:00`);
  const until = new Date(Date.parse(`${end}T00:00:00+07:00`) + 86400000);
  if (until <= from) throw new Error('Tanggal akhir harus sama atau setelah tanggal awal.');
  if (+until - +from > 366 * 86400000) throw new Error('Pilih rentang maksimal 366 hari.');
  return { from, until };
}

export async function cashierRevenue(start: string, end: string, database: Pick<typeof db, 'select'> = db) {
  const { from, until } = reportBounds(start, end);
  // Group by account ID. Revenue uses the final receipt amount, excluding tendered change.
  const rows = await database.select({
    id: users.id, name: users.name, role: users.role,
    transactions: sql<number>`count(${transactions.id})::int`,
    total: sql<string>`coalesce(sum(${transactions.grandTotal}), 0)`,
    cash: sql<string>`coalesce(sum(case when lower(${transactions.paymentMethod}) = 'cash' then ${transactions.grandTotal} else 0 end), 0)`,
    qris: sql<string>`coalesce(sum(case when lower(${transactions.paymentMethod}) = 'qris' then ${transactions.grandTotal} else 0 end), 0)`,
    debit: sql<string>`coalesce(sum(case when lower(${transactions.paymentMethod}) = 'debit' then ${transactions.grandTotal} else 0 end), 0)`,
    other: sql<string>`coalesce(sum(case when lower(${transactions.paymentMethod}) not in ('cash', 'qris', 'debit') then ${transactions.grandTotal} else 0 end), 0)`,
  }).from(users).leftJoin(transactions, and(eq(transactions.cashierId, users.id), gte(transactions.createdAt, from), lt(transactions.createdAt, until)))
    .groupBy(users.id, users.name, users.role);
  return summarizeCashiers(rows.filter(r => r.role === 'cashier' || r.transactions > 0).map(r => ({
    id: r.id, name: r.name, transactions: r.transactions, total: Number(r.total),
    cash: Number(r.cash), qris: Number(r.qris), debit: Number(r.debit), other: Number(r.other),
  })).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'id')));
}
