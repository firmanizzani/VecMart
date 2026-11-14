import { createHash } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { products, stockAdjustments } from '../db/schema.js';
import { readToken, signToken } from '../security/session.js';
import type { AssistantReply, StockChange } from '../../lib/ai/types.js';
import { AssistantError } from './errors.js';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type StockSelection = { operationId: string; productIds: string[]; quantity: number; unit: string; command: string };
type ChangeRecord = StockChange & { actorId: string; command: string };
export const operationId = (userId: string, requestId: string) => createHash('sha256').update(`${userId}:${requestId}`).digest('hex');
const auditId = (id: string) => `ai-${id}`;
const undoId = (id: string) => `ai-undo-${id}`;

function recordFromNotes(notes: string | null): ChangeRecord {
  try {
    const record = JSON.parse(notes || '').change as ChangeRecord;
    if (!record || typeof record.actorId !== 'string' || !Number.isInteger(record.quantity)) throw new Error();
    return record;
  } catch { throw new AssistantError(409, 'INVALID_AUDIT', 'Catatan perubahan stok belum dapat dibaca. Periksa halaman Stok opname.'); }
}

export async function previousChange(userId: string, id: string): Promise<AssistantReply | undefined> {
  const [audit] = await db.select().from(stockAdjustments).where(eq(stockAdjustments.id, auditId(id)));
  if (!audit) return;
  const change = recordFromNotes(audit.notes);
  if (change.actorId !== userId) throw new AssistantError(403, 'ADMIN_REQUIRED', 'Perubahan ini bukan milik sesi Anda.');
  const [undone] = await db.select({ id: stockAdjustments.id }).from(stockAdjustments).where(eq(stockAdjustments.id, undoId(id)));
  return changeReply(userId, change, !!undone);
}

function changeReply(userId: string, change: ChangeRecord, undone = false): AssistantReply {
  const { actorId: _actor, command: _command, ...visible } = change;
  return {
    kind: 'stock_changed', change: { ...visible, undone },
    text: undone ? `Penambahan ${change.quantity} ${change.unit} untuk ${change.productName} ini sudah dibatalkan.`
      : `Stok ${change.productName} berhasil ditambah ${change.quantity} ${change.unit}.`,
    undoToken: undone ? undefined : signToken('undo-stock', userId, { operationId: change.id }, 15 * 60)
  };
}

export function validateSelection(selection: StockSelection) {
  if (!/^[a-f0-9]{64}$/.test(selection.operationId) || !Array.isArray(selection.productIds) || !selection.productIds.length
    || selection.productIds.length > 8 || !Number.isInteger(selection.quantity) || selection.quantity < 1 || selection.quantity > 10000
    || typeof selection.command !== 'string' || selection.command.length > 1000 || typeof selection.unit !== 'string') {
    throw new AssistantError(422, 'INVALID_QUANTITY', 'Jumlah penambahan harus bilangan bulat antara 1 dan 10.000.');
  }
}

// Called inside one DB transaction, including the audit and duplicate-request lock.
export async function increaseInTransaction(tx: Transaction, userId: string, selection: StockSelection, productId: string): Promise<AssistantReply> {
  validateSelection(selection);
  if (!selection.productIds.includes(productId)) throw new AssistantError(403, 'INVALID_PRODUCT', 'Produk tidak termasuk pilihan dari perintah ini.');
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${auditId(selection.operationId)}))`);
  const [existing] = await tx.select().from(stockAdjustments).where(eq(stockAdjustments.id, auditId(selection.operationId)));
  if (existing) {
    const change = recordFromNotes(existing.notes);
    if (change.actorId !== userId) throw new AssistantError(403, 'ADMIN_REQUIRED', 'Perubahan tidak dapat diakses.');
    const [undone] = await tx.select().from(stockAdjustments).where(eq(stockAdjustments.id, undoId(selection.operationId)));
    return changeReply(userId, change, !!undone);
  }
  const [product] = await tx.select().from(products).where(and(eq(products.id, productId), eq(products.isActive, true))).for('update');
  if (!product) throw new AssistantError(404, 'PRODUCT_NOT_FOUND', 'Produk tidak tersedia. Cari kembali produk yang ingin ditambahkan.');
  const unit = selection.unit.toLowerCase().trim();
  const base = product.unit.toLowerCase();
  const pieceAliases = ['pcs', 'pc', 'buah', 'unit', 'satuan', 'botol', 'bungkus', 'sachet', 'kaleng'];
  if (unit && unit !== base && !(base === 'pcs' && pieceAliases.includes(unit))) {
    throw new AssistantError(422, 'UNIT_UNCLEAR', `Stok ${product.name} dicatat dalam ${product.unit}. Sebutkan jumlah dalam ${product.unit}; konversi dus atau pack belum tersedia.`);
  }
  const after = product.stock + selection.quantity;
  if (!Number.isSafeInteger(after) || after > 2147483647) throw new AssistantError(422, 'INVALID_QUANTITY', 'Jumlah stok melampaui batas penyimpanan.');
  const change: ChangeRecord = { id: selection.operationId, actorId: userId, productId, productName: product.name,
    unit: product.unit, quantity: selection.quantity, before: product.stock, after, command: selection.command };
  await tx.update(products).set({ stock: after, updatedAt: new Date() }).where(eq(products.id, productId));
  await tx.insert(stockAdjustments).values({ id: auditId(selection.operationId), productId, adjustmentQty: selection.quantity,
    reason: 'AUDIT_CORRECTION', adjustedBy: userId, notes: JSON.stringify({ source: 'assistant', change }) });
  return changeReply(userId, change);
}

export async function chooseProduct(userId: string, token: string, productId: string) {
  const payload = readToken<StockSelection>(token, 'choose-stock');
  if (payload.sub !== userId) throw new AssistantError(403, 'ADMIN_REQUIRED', 'Pilihan produk tidak berlaku untuk akun ini.');
  return db.transaction(tx => increaseInTransaction(tx, userId, payload.data, productId));
}

export async function undoInTransaction(tx: Transaction, userId: string, id: string): Promise<AssistantReply> {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new AssistantError(422, 'INVALID_ACTION', 'Perubahan tidak dikenali.');
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${auditId(id)}))`);
  const [original] = await tx.select().from(stockAdjustments).where(eq(stockAdjustments.id, auditId(id)));
  if (!original || original.adjustedBy !== userId) throw new AssistantError(404, 'CHANGE_NOT_FOUND', 'Perubahan stok tidak ditemukan untuk akun ini.');
  const change = recordFromNotes(original.notes);
  const [existing] = await tx.select().from(stockAdjustments).where(eq(stockAdjustments.id, undoId(id)));
  if (existing) {
    const { actorId: _actor, command: _command, ...visible } = recordFromNotes(existing.notes);
    return { kind: 'stock_undone', text: 'Penambahan stok ini sudah dibatalkan.', change: { ...visible, undone: true } };
  }
  if (Date.now() - original.createdAt.getTime() > 15 * 60 * 1000) throw new AssistantError(409, 'UNDO_EXPIRED', 'Waktu pembatalan 15 menit sudah lewat. Gunakan halaman Stok opname untuk penyesuaian berikutnya.');
  const [product] = await tx.select().from(products).where(eq(products.id, change.productId)).for('update');
  if (!product || product.stock < change.quantity) throw new AssistantError(409, 'UNDO_CONFLICT', 'Stok sudah berkurang dan tidak mencukupi untuk pembatalan. Periksa stok melalui halaman Stok opname.');
  const reversal: ChangeRecord = { ...change, before: product.stock, after: product.stock - change.quantity };
  await tx.update(products).set({ stock: reversal.after, updatedAt: new Date() }).where(eq(products.id, product.id));
  await tx.insert(stockAdjustments).values({ id: undoId(id), productId: product.id, adjustmentQty: -change.quantity,
    reason: 'AUDIT_CORRECTION', adjustedBy: userId, notes: JSON.stringify({ source: 'assistant-undo', change: reversal }) });
  const { actorId: _actor, command: _command, ...visible } = reversal;
  return { kind: 'stock_undone', text: `Penambahan ${change.quantity} ${change.unit} untuk ${change.productName} sudah dibatalkan.`, change: { ...visible, undone: true } };
}

export async function undoChange(userId: string, token: string) {
  const payload = readToken<{ operationId: string }>(token, 'undo-stock');
  if (payload.sub !== userId) throw new AssistantError(403, 'ADMIN_REQUIRED', 'Pembatalan tidak berlaku untuk akun ini.');
  return db.transaction(tx => undoInTransaction(tx, userId, payload.data.operationId));
}

export async function candidateProducts(query: string) {
  const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');
  const tokens = query.toLowerCase().match(/[a-z]+|\d+/g) || [];
  if (!tokens.length || query.length > 150) throw new AssistantError(422, 'PRODUCT_UNCLEAR', 'Sebutkan nama, barcode, atau SKU produk.');
  const catalog = await db.select({ id: products.id, name: products.name, barcode: products.barcode, sku: products.sku, stock: products.stock, unit: products.unit })
    .from(products).where(eq(products.isActive, true)).orderBy(products.name);
  const exact = catalog.filter(product => [product.name, product.barcode, product.sku].some(value => normalize(value) === normalize(query)));
  const matches = exact.length ? exact : catalog.filter(product => tokens.every(token => normalize(`${product.name} ${product.barcode} ${product.sku}`).includes(token)));
  return matches.map(({ sku: _sku, ...product }) => product);
}
