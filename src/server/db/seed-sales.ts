import { mkdirSync, writeFileSync } from 'node:fs';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from './index.js';
import { cashierShifts, products, transactionItems, transactions, users } from './schema.js';

// Additive historical demo sales. Default: preview. --apply: insert atomically.
// Stable identifiers and a fixed random seed make subsequent runs safe to repeat.
const apply = process.argv.includes('--apply');
const batch = 'vecmart-sales-oct-nov-2026';
let state = 20261114;
function randomInt(min: number, max: number) {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return min + Math.floor((state / 4294967296) * (max - min + 1));
}

type SeedTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const recapNote = 'Rekap historis penjualan Oktober–November 2026';

async function syncShiftRecaps(tx: SeedTransaction, sales: (typeof transactions.$inferSelect)[]) {
  const existingShifts = await tx.select().from(cashierShifts);
  const byId = new Map(existingShifts.map(shift => [shift.id, shift]));
  let sequence = Math.max(1000, ...existingShifts.map(shift => Number(shift.id.match(/^shift-(\d+)$/)?.[1] || 0)));
  const groups = new Map<string, typeof sales>();
  for (const sale of [...sales].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))) {
    const date = new Date(sale.createdAt.getTime() + 25200000).toISOString().slice(0, 10);
    const key = `${date}|${sale.cashierId}`;
    groups.set(key, [...(groups.get(key) || []), sale]);
  }
  let created = 0;
  const recaps: { id: string; date: string; userId: string; transactions: number; startingCash: number; salesCash: number; expectedCash: number; actualCash: number; difference: number }[] = [];
  for (const [key, rows] of groups) {
    const [date, userId] = key.split('|');
    const linkedIds = [...new Set(rows.map(row => row.shiftId).filter((id): id is string => !!id))];
    if (linkedIds.length > 1) throw new Error('Historical sales are linked to multiple shifts; rolling back.');
    const current = linkedIds.length ? byId.get(linkedIds[0]) : undefined;
    if (linkedIds.length && (!current || current.notes !== recapNote || current.userId !== userId)) {
      throw new Error('Refusing to overwrite an unrelated cashier session.');
    }
    const id = current?.id || `shift-${++sequence}`;
    const startingCash = current ? Number(current.startingCash) : [100000, 150000, 200000][recaps.length % 3];
    const salesCash = rows.filter(row => row.paymentMethod.toLowerCase() === 'cash')
      .reduce((sum, row) => sum + Number(row.grandTotal), 0);
    const expectedCash = startingCash + salesCash;
    const recap = {
      userId, clockIn: new Date(`${date}T08:00:00+07:00`), clockOut: new Date(`${date}T21:00:00+07:00`),
      startingCash: String(startingCash), expectedCash: String(expectedCash), actualCash: String(expectedCash),
      status: 'closed', notes: recapNote
    };
    if (rows.some(row => row.createdAt < recap.clockIn || row.createdAt > recap.clockOut)) throw new Error('Sale is outside the session time.');
    if (current) await tx.update(cashierShifts).set(recap).where(eq(cashierShifts.id, id));
    else { await tx.insert(cashierShifts).values({ id, ...recap }); created += 1; }
    await tx.update(transactions).set({ shiftId: id }).where(inArray(transactions.id, rows.map(row => row.id)));
    recaps.push({ id, date, userId, transactions: rows.length, startingCash, salesCash, expectedCash, actualCash: expectedCash, difference: 0 });
  }
  const linked = await tx.select().from(transactions).where(inArray(transactions.id, sales.map(sale => sale.id)));
  if (linked.length !== 35 || linked.some(sale => !sale.shiftId || !recaps.some(recap => recap.id === sale.shiftId))) {
    throw new Error('Cashier session linkage verification failed; rolling back.');
  }
  return { created, total: recaps.length, linkedTransactions: linked.length,
    cashSales: recaps.reduce((sum, recap) => sum + recap.salesCash, 0),
    months: ['2026-10', '2026-11'].map(month => ({ month, sessions: recaps.filter(recap => recap.date.startsWith(month)).length })), recaps };
}

async function main() {
  const catalog = await db.select().from(products)
    .where(and(eq(products.isActive, true), sql`${products.sellPrice} > 0 AND ${products.sellPrice} <= 25000`))
    .orderBy(asc(products.id));
  const cashiers = await db.select({ id: users.id }).from(users)
    .where(eq(users.role, 'cashier')).orderBy(asc(users.id));
  if (catalog.length < 3 || !cashiers.length) throw new Error('At least 3 active affordable products and 1 cashier are required.');
  const currentSales = await db.select({ id: transactions.id, invoice: transactions.invoiceNumber, createdAt: transactions.createdAt }).from(transactions);
  const currentById = new Map(currentSales.map(sale => [sale.id, sale]));
  const usedInvoices = new Set(currentSales.map(sale => sale.invoice));
  let nextInvoiceNumber = Math.max(0, ...currentSales.map(sale => Number(sale.invoice.match(/^INV-\d{8}-(\d+)$/)?.[1] || 0)));

  const sales: (typeof transactions.$inferInsert)[] = [];
  const items: (typeof transactionItems.$inferInsert)[] = [];
  // Only past November dates, so historical sample data never appears as future sales.
  const periods = [
    { month: '10', name: 'october', count: 25, days: 31 },
    { month: '11', name: 'november', count: 10, days: 13 }
  ];
  for (const period of periods) {
    const dates = Array.from({ length: period.count }, () => {
      const day = String(randomInt(1, period.days)).padStart(2, '0');
      const hour = String(randomInt(8, 20)).padStart(2, '0');
      const minute = String(randomInt(0, 59)).padStart(2, '0');
      return new Date(`2026-${period.month}-${day}T${hour}:${minute}:00+07:00`);
    }).sort((a, b) => a.getTime() - b.getTime());

    for (const [index, createdAt] of dates.entries()) {
      // Letter-only IDs avoid inflating the existing checkout's numeric ID counter.
      const id = `dummy-sale-${period.name}-${String.fromCharCode(97 + index)}`;
      const count = randomInt(1, 3);
      const selected: typeof catalog = [];
      while (selected.length < count) {
        const product = catalog[randomInt(0, catalog.length - 1)];
        if (!selected.some(p => p.id === product.id)) selected.push(product);
      }
      const cart = selected.map((product, itemIndex) => {
        const quantity = randomInt(1, 2);
        return {
          id: `${id}-item-${itemIndex + 1}`, transactionId: id,
          productId: product.id, productName: product.name,
          costPrice: product.costPrice, sellPrice: product.sellPrice,
          quantity, subtotal: String(Number(product.sellPrice) * quantity)
        };
      });
      // Limit purchases to 5 physical items and Rp90,000 per receipt.
      while (cart.reduce((sum, item) => sum + item.quantity, 0) > 5 || cart.reduce((sum, item) => sum + Number(item.subtotal), 0) > 90000) {
        const reducible = cart.find(item => item.quantity > 1);
        if (!reducible) throw new Error('Cart limits cannot be satisfied.');
        reducible.quantity -= 1;
        reducible.subtotal = String(Number(reducible.sellPrice) * reducible.quantity);
      }
      const subtotal = cart.reduce((sum, item) => sum + Number(item.subtotal), 0);
      const roll = randomInt(1, 100);
      const paymentMethod = roll <= 65 ? 'cash' : roll <= 90 ? 'qris' : 'debit';
      const paidAmount = paymentMethod === 'cash' ? Math.ceil(subtotal / 5000) * 5000 : subtotal;
      const current = currentById.get(id);
      const invoiceDate = new Date((current?.createdAt || createdAt).getTime() + 7 * 60 * 60 * 1000)
        .toISOString().slice(0, 10).replaceAll('-', '');
      let invoiceNumber = current?.invoice.startsWith('INV-') ? current.invoice : '';
      if (!invoiceNumber) {
        do { invoiceNumber = `INV-${invoiceDate}-${String(++nextInvoiceNumber).padStart(3, '0')}`; }
        while (usedInvoices.has(invoiceNumber));
        usedInvoices.add(invoiceNumber);
      }
      sales.push({
        id, invoiceNumber,
        cashierId: cashiers[randomInt(0, cashiers.length - 1)].id,
        shiftId: null, memberId: null, promoId: null,
        subtotal: String(subtotal), discountTotal: '0', grandTotal: String(subtotal),
        paidAmount: String(paidAmount), changeAmount: String(paidAmount - subtotal),
        paymentMethod, earnedPoints: 0, createdAt
      });
      items.push(...cart);
    }
  }

  const ids = sales.map(s => s.id);
  const existing = await db.select({ id: transactions.id, invoice: transactions.invoiceNumber })
    .from(transactions).where(inArray(transactions.id, ids));
  const summary = periods.map(period => {
    const rows = sales.filter(s => s.id.startsWith(`dummy-sale-${period.name}-`));
    const amounts = rows.map(s => Number(s.grandTotal));
    return { month: `2026-${period.month}`, transactions: rows.length,
      revenue: amounts.reduce((sum, value) => sum + value, 0),
      minReceipt: Math.min(...amounts), maxReceipt: Math.max(...amounts) };
  });
  mkdirSync('.taste-skill', { recursive: true });
  writeFileSync('.taste-skill/dummy-sales-2026.json', JSON.stringify({ batch, summary, sales, items }, null, 2));

  let inserted = 0;
  let renamed = 0;
  let shiftSummary: Awaited<ReturnType<typeof syncShiftRecaps>> | undefined;
  if (apply) {
    await db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${batch}))`);
      // Insert each header and its complete receipt in the same database transaction.
      for (const sale of sales) {
        const [current] = await tx.select({ invoice: transactions.invoiceNumber }).from(transactions).where(eq(transactions.id, sale.id));
        if (current) {
          if (current.invoice !== sale.invoiceNumber) {
            if (!current.invoice.startsWith('DUMMY-')) throw new Error('Existing invoice changed; regenerate the preview before retrying.');
            await tx.update(transactions).set({ invoiceNumber: sale.invoiceNumber }).where(eq(transactions.id, sale.id));
            renamed += 1;
          }
          continue;
        }
        const saved = await tx.insert(transactions).values(sale)
          .onConflictDoNothing({ target: transactions.invoiceNumber }).returning({ id: transactions.id });
        if (!saved.length) continue;
        await tx.insert(transactionItems).values(items.filter(item => item.transactionId === sale.id));
        inserted += 1;
      }
      const persisted = await tx.select().from(transactions).where(inArray(transactions.id, ids));
      const persistedItems = await tx.select().from(transactionItems).where(inArray(transactionItems.transactionId, ids));
      if (persisted.length !== 35 || persistedItems.length !== items.length) throw new Error('Dummy batch count mismatch; rolling back.');
      for (const sale of persisted) {
        if (sale.invoiceNumber !== sales.find(planned => planned.id === sale.id)?.invoiceNumber) throw new Error('Invoice verification failed; rolling back.');
        const receipt = persistedItems.filter(item => item.transactionId === sale.id);
        const total = receipt.reduce((sum, item) => sum + Number(item.sellPrice) * item.quantity, 0);
        if (!receipt.length || receipt.some(item => Number(item.subtotal) !== Number(item.sellPrice) * item.quantity)
          || total !== Number(sale.subtotal) || total !== Number(sale.grandTotal)
          || Number(sale.paidAmount) - Number(sale.changeAmount) !== total) {
          throw new Error(`Receipt does not reconcile: ${sale.invoiceNumber}; rolling back.`);
        }
      }
      shiftSummary = await syncShiftRecaps(tx, persisted);
    });
  }
  console.log(JSON.stringify({ mode: apply ? 'applied' : 'preview', batch, summary,
    receiptLines: items.length, existing: existing.length, inserted, renamed,
    shiftSummary,
    invoiceExamples: sales.slice(0, 3).map(sale => sale.invoiceNumber),
    paymentMethods: Object.fromEntries(['cash', 'qris', 'debit'].map(method => [method, sales.filter(s => s.paymentMethod === method).length])) }, null, 2));
}

try { await main(); }
catch (error) { console.error(error instanceof Error ? error.message : 'Dummy sales seed failed.'); process.exitCode = 1; }
finally { await db.$client.end(); }
