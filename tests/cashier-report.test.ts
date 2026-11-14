import 'dotenv/config';
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../src/server/db/index.js';
import { users, transactions } from '../src/server/db/schema.js';
import { cashierRevenue, reportBounds } from '../src/server/reports/cashiers.js';
import { cashierReportRoutes } from '../src/server/routes/cashier-reports.js';
import { signToken } from '../src/server/security/session.js';
import { eq } from 'drizzle-orm';

after(() => db.$client.end());
test('WIB boundaries include the entire last day and validate real dates', () => {
  const { from, until } = reportBounds('2026-10-01', '2026-10-31');
  assert.equal(from.toISOString(), '2026-09-30T17:00:00.000Z');
  assert.equal(until.toISOString(), '2026-10-31T17:00:00.000Z');
  for (const pair of [['2026-02-30','2026-03-01'], ['2026-11-02','2026-11-01'], ['2025-01-01','2026-12-31'], ['bad','2026-01-01']]) {
    assert.throws(() => reportBounds(pair[0], pair[1]));
  }
});
test('report requires signed admin authentication', async () => {
  const url = 'http://localhost/cashier-reports?start=2026-10-01&end=2026-10-31';
  assert.equal((await cashierReportRoutes.handle(new Request(url))).status, 401);
  const [cashier] = await db.select({ id: users.id }).from(users).where(eq(users.role, 'cashier')).limit(1);
  assert.ok(cashier);
  assert.equal((await cashierReportRoutes.handle(new Request(url, { headers: { authorization: `Bearer ${signToken('session', cashier.id)}` } }))).status, 403);
  const [admin] = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin')).limit(1);
  const invalid = await cashierReportRoutes.handle(new Request(url.replace('2026-10-31','2026-02-30'), { headers: { authorization: `Bearer ${signToken('session', admin.id)}` } }));
  assert.equal(invalid.status, 400);
});
test('revenue separates account IDs, payment methods and WIB dates without counting change', async () => {
  const rollback = new Error('rollback fixtures');
  await assert.rejects(db.transaction(async tx => {
    const ids = Array.from({length:4}, () => randomUUID());
    await tx.insert(users).values(ids.map((id, i) => ({ id, name: 'Kasir uji sama', email: `${id}@example.test`, role: i === 3 ? 'admin' : 'cashier' })));
    const add = async (index: number, amount: string, method: string, date: string) => tx.insert(transactions).values({
      id: randomUUID(), invoiceNumber: randomUUID(), cashierId: ids[index], subtotal: '100000', discountTotal: '1000',
      grandTotal: amount, paidAmount: '100000', changeAmount: '99000', paymentMethod: method, createdAt: new Date(date)
    });
    await add(0, '9000', 'CASH', '2090-09-30T17:00:00Z');
    await add(0, '3000', 'qris', '2090-10-31T16:59:59.999Z');
    await add(0, '99999', 'cash', '2090-10-31T17:00:00Z'); // next WIB month: excluded
    await add(1, '4000', 'debit', '2090-10-15T00:00:00Z');
    await add(1, '2000', 'transfer', '2090-10-15T00:00:00Z');
    await add(3, '1000', 'cash', '2090-10-15T00:00:00Z');
    const report = await cashierRevenue('2090-10-01','2090-10-31', tx);
    assert.equal(report.totals.total, 19000);
    assert.equal(report.totals.transactions, 5);
    assert.equal(report.totals.cash, 10000);
    assert.equal(report.totals.qris, 3000);
    assert.equal(report.totals.debit, 4000);
    assert.equal(report.totals.other, 2000);
    assert.equal(report.rows.find(r => r.id === ids[0])?.total, 12000);
    assert.equal(report.rows.find(r => r.id === ids[1])?.total, 6000);
    assert.equal(report.rows.find(r => r.id === ids[2])?.transactions, 0);
    assert.equal(report.rows.find(r => r.id === ids[3])?.total, 1000);
    assert.equal((await cashierRevenue('2091-01-01','2091-01-01', tx)).totals.total, 0);
    throw rollback;
  }), error => error === rollback);
});
