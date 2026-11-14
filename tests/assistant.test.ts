import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { and, eq } from 'drizzle-orm';
import { db } from '../src/server/db/index.js';
import { assistantUsage, products, stockAdjustments, users } from '../src/server/db/schema.js';
import { readToken, signToken } from '../src/server/security/session.js';
import { validateStockCommand, storeReport } from '../src/server/ai/service.js';
import { consumeUsageInTransaction, quotaWindows } from '../src/server/ai/quota.js';
import { increaseInTransaction, undoInTransaction, operationId, candidateProducts } from '../src/server/ai/stock.js';
import { aiRoutes } from '../src/server/routes/ai.js';
import { authRoutes } from '../src/server/routes/auth.js';

after(async () => { await db.$client.end(); });
const isCode = (code: string) => (error: unknown) => !!error && typeof error === 'object' && 'code' in error && error.code === code;

test('signed sessions reject tampering, wrong purposes, and expired sessions', () => {
  const token = signToken('session', 'admin-test');
  assert.equal(readToken(token, 'session').sub, 'admin-test');
  assert.throws(() => readToken(`${token}x`, 'session'), isCode('SESSION_EXPIRED'));
  assert.throws(() => readToken(token, 'choose-stock'), isCode('ACTION_EXPIRED'));
  assert.throws(() => readToken(signToken('session', 'admin-test', {}, -1), 'session'), isCode('SESSION_EXPIRED'));
});

test('stock writes require an explicit positive quantity and base units', () => {
  const plan = { intent: 'increase_stock' as const, quantity: 50, productQuery: 'Aqua 600ml' };
  assert.doesNotThrow(() => validateStockCommand('Aqua 600ml stock bertambah 50', plan));
  assert.doesNotThrow(() => validateStockCommand('Tambah 50 pcs Aqua 600ml', plan));
  assert.throws(() => validateStockCommand('Jangan tambah 50 Aqua', plan), isCode('EXPLICIT_COMMAND_REQUIRED'));
  assert.throws(() => validateStockCommand('Aqua 600ml tambah -50', plan), isCode('QUANTITY_UNCLEAR'));
  assert.throws(() => validateStockCommand('Tambah 5 dus Aqua', { ...plan, quantity: 5 }), isCode('UNIT_UNCLEAR'));
  assert.throws(() => validateStockCommand('Tambah 50 Aqua', { ...plan, quantity: 600 }), isCode('QUANTITY_UNCLEAR'));
});

test('daily quota resets follow Pacific midnight in winter, summer and DST transitions', () => {
  assert.equal(quotaWindows(Date.parse('2026-11-14T12:00:00Z'))[0].resetsAt.toISOString(), '2026-11-15T08:00:00.000Z');
  assert.equal(quotaWindows(Date.parse('2026-07-14T12:00:00Z'))[0].resetsAt.toISOString(), '2026-07-15T07:00:00.000Z');
  assert.equal(quotaWindows(Date.parse('2026-03-08T12:00:00Z'))[0].resetsAt.toISOString(), '2026-03-09T07:00:00.000Z');
  assert.equal(quotaWindows(Date.parse('2026-11-01T12:00:00Z'))[0].resetsAt.toISOString(), '2026-11-02T08:00:00.000Z');
});

test('AI endpoints reject unauthenticated, forged legacy and cashier sessions', async () => {
  for (const authorization of ['', 'Bearer jwt-token-123', 'Bearer token-123']) {
    const response = await aiRoutes.handle(new Request('http://localhost/ai/status', { headers: { authorization } }));
    assert.equal(response.status, 401);
  }
  const [cashier] = await db.select({ id: users.id }).from(users).where(eq(users.role, 'cashier')).limit(1);
  assert.ok(cashier);
  const response = await aiRoutes.handle(new Request('http://localhost/ai/status', { headers: { authorization: `Bearer ${signToken('session', cashier.id)}` } }));
  assert.equal(response.status, 403);
});

test('a signed admin session can read status without revealing keys', async () => {
  const [admin] = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin')).limit(1);
  assert.ok(admin);
  const response = await aiRoutes.handle(new Request('http://localhost/ai/status', { headers: { authorization: `Bearer ${signToken('session', admin.id)}` } }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.success, true);
  assert.ok(result.data.usage.limit > 0);
  assert.ok(!JSON.stringify(result).includes(process.env.GEMINI_API_KEY || 'NO_KEY_SENTINEL'));
});

test('normal email/PIN login issues a verifiable session and rejects a missing email', async () => {
  const [admin] = await db.select({ id: users.id, email: users.email, pinCode: users.pinCode }).from(users).where(eq(users.role, 'admin')).limit(1);
  const missing = await authRoutes.handle(new Request('http://localhost/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pinCode: admin.pinCode }) }));
  assert.equal(missing.status, 422);
  const response = await authRoutes.handle(new Request('http://localhost/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: admin.email, pinCode: admin.pinCode }) }));
  const result = await response.json(); assert.equal(result.success, true);
  assert.equal(readToken(result.token, 'session').sub, admin.id);
  const me = await authRoutes.handle(new Request('http://localhost/auth/me', { headers: { authorization: `Bearer ${result.token}` } }));
  assert.equal((await me.json()).user.id, admin.id);
});

test('addition, replay, intervening stock changes and undo reconcile atomically (rolled back)', async () => {
  const rollback = new Error('rollback test fixture');
  const productId = `ai-test-${randomUUID()}`;
  await assert.rejects(db.transaction(async tx => {
    const [admin] = await tx.select({ id: users.id }).from(users).where(eq(users.role, 'admin')).limit(1);
    const [product] = await tx.insert(products).values({ id: productId, name: 'AI integration test product', barcode: randomUUID(),
      sku: randomUUID().slice(0, 20), costPrice: '1000', sellPrice: '2000', stock: 100, unit: 'pcs' }).returning();
    const selection = { operationId: operationId(admin.id, randomUUID()), productIds: [product.id], quantity: 50, unit: 'pcs', command: 'Tambah 50 pcs produk uji' };
    const first = await increaseInTransaction(tx, admin.id, selection, product.id);
    assert.equal(first.change?.before, 100); assert.equal(first.change?.after, 150);
    const second = await increaseInTransaction(tx, admin.id, selection, product.id);
    assert.equal(second.change?.after, 150);
    let [saved] = await tx.select().from(products).where(eq(products.id, product.id)); assert.equal(saved.stock, 150);
    assert.equal((await tx.select().from(stockAdjustments).where(eq(stockAdjustments.id, `ai-${selection.operationId}`))).length, 1);
    await assert.rejects(increaseInTransaction(tx, admin.id, { ...selection, operationId: operationId(admin.id, randomUUID()), quantity: -1 }, product.id), isCode('INVALID_QUANTITY'));
    await assert.rejects(increaseInTransaction(tx, admin.id, selection, 'unapproved-product'), isCode('INVALID_PRODUCT'));
    await assert.rejects(increaseInTransaction(tx, admin.id, { ...selection, operationId: operationId(admin.id, randomUUID()), unit: 'dus' }, product.id), isCode('UNIT_UNCLEAR'));
    // A subsequent sale of 10 units must remain accounted for after undo.
    await tx.update(products).set({ stock: 140 }).where(eq(products.id, product.id));
    const undo = await undoInTransaction(tx, admin.id, selection.operationId);
    assert.equal(undo.change?.before, 140); assert.equal(undo.change?.after, 90);
    await undoInTransaction(tx, admin.id, selection.operationId);
    [saved] = await tx.select().from(products).where(eq(products.id, product.id)); assert.equal(saved.stock, 90);
    const replayAfterUndo = await increaseInTransaction(tx, admin.id, selection, product.id); assert.equal(replayAfterUndo.change?.undone, true);
    const expired = { ...selection, operationId: operationId(admin.id, randomUUID()), quantity: 1 };
    await increaseInTransaction(tx, admin.id, expired, product.id);
    await tx.update(stockAdjustments).set({ createdAt: new Date(Date.now() - 16 * 60000) }).where(eq(stockAdjustments.id, `ai-${expired.operationId}`));
    await assert.rejects(undoInTransaction(tx, admin.id, expired.operationId), isCode('UNDO_EXPIRED'));
    throw rollback;
  }), error => error === rollback);
  assert.equal((await db.select().from(products).where(eq(products.id, productId))).length, 0);
});

test('persisted caps block excess requests and renew on the next window (rolled back)', async () => {
  const rollback = new Error('rollback quota fixture');
  const oldDay = process.env.AI_DAILY_LIMIT, oldMinute = process.env.AI_MINUTE_LIMIT;
  process.env.AI_DAILY_LIMIT = '2'; process.env.AI_MINUTE_LIMIT = '1';
  const now = Date.parse('2032-01-15T12:00:00Z');
  try {
    await assert.rejects(db.transaction(async tx => {
      for (const window of [...quotaWindows(now), ...quotaWindows(now + 60000)]) await tx.delete(assistantUsage).where(eq(assistantUsage.id, window.id));
      assert.equal((await consumeUsageInTransaction(tx, now)).used, 1);
      await assert.rejects(consumeUsageInTransaction(tx, now), isCode('APP_QUOTA_EXCEEDED'));
      assert.equal((await consumeUsageInTransaction(tx, now + 60000)).used, 2);
      await assert.rejects(consumeUsageInTransaction(tx, now + 120000), isCode('APP_QUOTA_EXCEEDED'));
      throw rollback;
    }), error => error === rollback);
  } finally {
    if (oldDay === undefined) delete process.env.AI_DAILY_LIMIT; else process.env.AI_DAILY_LIMIT = oldDay;
    if (oldMinute === undefined) delete process.env.AI_MINUTE_LIMIT; else process.env.AI_MINUTE_LIMIT = oldMinute;
  }
});

test('ambiguous names remain separate variants; sales totals are database totals', async () => {
  const aqua = await candidateProducts('Aqua'); assert.ok(aqua.length >= 2);
  const specific = await candidateProducts('Aqua 600ml'); assert.equal(specific.length, 1);
  const report = await storeReport({ intent: 'sales_report', dateFrom: '2026-10-01', dateTo: '2026-10-31' });
  assert.equal(report.report?.transactions, 25); assert.equal(report.report?.revenue, 876800);
});
