import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { assistantActions, products, stockAdjustments } from '../db/schema.js';
import { readToken, signToken } from '../security/session.js';
import type { AssistantReply, ProductAction } from '../../lib/ai/types.js';
import { AssistantError } from './errors.js';
import { candidateProducts } from './stock.js';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type ProductCommand = { operationId: string; action: ProductAction; productIds: string[]; value: number; unit: string; command: string };
type Confirmation = ProductCommand & { productId: string; before: number; after: number };
type ActionRow = typeof assistantActions.$inferSelect;
const actions: ProductAction[] = ['increase_stock', 'decrease_stock', 'set_stock', 'update_price'];
const titles: Record<ProductAction, string> = { increase_stock: 'Tambah stok', decrease_stock: 'Kurangi stok', set_stock: 'Tetapkan stok hasil hitung', update_price: 'Ubah harga jual' };
const money = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 2 }).format(value);

export function validateProductCommand(message: string, action: ProductAction, value: number) {
  if (!actions.includes(action) || /\b(jangan|batal\w*|simulasi|contoh|bagaimana|gimana|apakah|bisakah|kalau|jika|hapus)\b|\?/i.test(message)) {
    throw new AssistantError(422, 'EXPLICIT_COMMAND_REQUIRED', 'Tulis satu perintah langsung beserta produk dan jumlahnya. Tidak ada perubahan yang disimpan.');
  }
  let match: RegExpMatchArray | null = null;
  if (action === 'increase_stock' || action === 'decrease_stock') {
    const verb = action === 'increase_stock' ? '(?:tambah(?:kan)?|bertambah|restok|masuk)' : '(?:kurangi|kurang(?:kan)?|berkurang)';
    if (!new RegExp(`\\b${verb}\\b`, 'i').test(message)) throw new AssistantError(422, 'EXPLICIT_COMMAND_REQUIRED', 'Sebutkan apakah stok ditambah atau dikurangi.');
    match = message.match(new RegExp(`\\b${verb}(?:\\s+(?:stok|stock|sebanyak|lagi))*\\s+(\\d+)(?=\\s|$)`, 'i')) || message.match(/\bsebanyak\s+(\d+)(?=\s|$)/i);
    if (/\b(?:tambah\w*|bertambah|restok|masuk)\b/i.test(message) && /\b(?:kurangi|kurang\w*|berkurang)\b/i.test(message)) throw new AssistantError(422, 'EXPLICIT_COMMAND_REQUIRED', 'Kirim penambahan dan pengurangan sebagai dua perintah terpisah.');
  } else {
    if (!/\b(set|atur|ubah|tetapkan|jadikan)\b/i.test(message)) throw new AssistantError(422, 'EXPLICIT_COMMAND_REQUIRED', 'Tulis “Set stok ... menjadi ...” atau “Ubah harga jual ... menjadi Rp ...”.');
    if (action === 'update_price' && (!/\bharga\s+jual\b/i.test(message) || /\b(beli|modal|hpp|diskon|persen)\b|%/i.test(message))) throw new AssistantError(422, 'PRICE_UNCLEAR', 'Sebutkan harga jual baru dalam rupiah, bukan harga modal, persentase, atau diskon.');
    if (action === 'set_stock' && !/\b(stok|stock)\b/i.test(message)) throw new AssistantError(422, 'EXPLICIT_COMMAND_REQUIRED', 'Sebutkan stok hasil hitung fisik yang akan ditetapkan.');
    match = message.match(/(?:\b(?:jadi|menjadi|sebesar|ke)\b|=)\s*(?:Rp\.?\s*)?(\d[\d.,]*)(?=\s|$)/i);
  }
  const raw = match?.[1];
  const parsed = raw && /^\d+$/.test(raw) ? Number(raw) : raw && /^\d{1,3}(\.\d{3})+$/.test(raw) ? Number(raw.replaceAll('.', '')) : NaN;
  const min = action === 'set_stock' ? 0 : 1, max = action === 'update_price' ? 9999999999 : 10000;
  if (!Number.isInteger(value) || value < min || value > max || parsed !== value || /\b(ribu|juta|miliar)\b|\d\s*[kK]\b|[-−]\s*\d|\d\s*%/.test(message)) {
    throw new AssistantError(422, 'QUANTITY_UNCLEAR', `Gunakan angka utuh yang jelas (${min}–${max.toLocaleString('id-ID')}). Contoh: “Kurangi stok Aqua 600ml sebanyak 2 pcs”, “Set stok Aqua 600ml menjadi 20 pcs”, atau “Ubah harga jual Aqua 600ml menjadi Rp 5.000”.`);
  }
  if (action !== 'update_price' && /\b(dus|kardus|karton|pack|pak|paket|lusin)\b/i.test(message)) throw new AssistantError(422, 'UNIT_UNCLEAR', 'Gunakan satuan stok produk. Konversi dus, pack, atau lusin belum tersedia.');
  if (action === 'decrease_stock' && /\b(terjual|dijual|penjualan|jualkan|checkout)\b/i.test(message)) throw new AssistantError(422, 'USE_CHECKOUT', 'Catat penjualan melalui kasir agar struk dan laporan tetap sesuai. Pengurangan lewat chat untuk barang rusak, hilang, atau koreksi stok.');
  // One request changes exactly one product field, never a batch of instructions.
  if (/\b(dan|lalu|kemudian|sekalian)\b|[;\n]/i.test(message)) throw new AssistantError(422, 'EXPLICIT_COMMAND_REQUIRED', 'Kirim satu perubahan produk per pesan.');
}

function validate(command: ProductCommand) {
  if (!/^[a-f0-9]{64}$/.test(command.operationId) || !Array.isArray(command.productIds) || command.productIds.length < 1 || command.productIds.length > 8 || command.productIds.some(id => typeof id !== 'string') || typeof command.unit !== 'string' || typeof command.command !== 'string' || command.command.length > 1000) throw new AssistantError(422, 'INVALID_ACTION', 'Perintah tidak valid. Kirim ulang permintaan.');
  validateProductCommand(command.command, command.action, command.value);
}

function target(product: typeof products.$inferSelect, command: ProductCommand) {
  const isPrice = command.action === 'update_price';
  if (!isPrice) {
    const unit = command.unit.trim().toLowerCase(), base = product.unit.trim().toLowerCase();
    if (unit && unit !== base && !(base === 'pcs' && ['pcs', 'pc', 'buah', 'unit', 'satuan', 'botol', 'bungkus', 'sachet', 'kaleng'].includes(unit))) throw new AssistantError(422, 'UNIT_UNCLEAR', `Stok produk ini dicatat dalam ${product.unit}. Gunakan satuan tersebut.`);
  }
  const before = isPrice ? Number(product.sellPrice) : product.stock;
  const after = command.action === 'increase_stock' ? before + command.value : command.action === 'decrease_stock' ? before - command.value : command.value;
  if (!Number.isFinite(after) || after < 0 || (!isPrice && (!Number.isSafeInteger(after) || after > 2147483647))) throw new AssistantError(409, 'INSUFFICIENT_STOCK', 'Stok tidak mencukupi atau jumlah di luar batas. Tidak ada perubahan yang disimpan.');
  if (before === after) throw new AssistantError(422, 'NO_CHANGE', 'Nilai baru sama dengan nilai sekarang. Tidak perlu disimpan.');
  return { before, after, field: isPrice ? 'sellPrice' as const : 'stock' as const, unit: isPrice ? 'rupiah' : product.unit };
}

export async function prepareAction(userId: string, command: ProductCommand, productId: string): Promise<AssistantReply> {
  validate(command);
  if (!command.productIds.includes(productId)) throw new AssistantError(403, 'INVALID_PRODUCT', 'Produk bukan pilihan dari perintah ini.');
  const [product] = await db.select().from(products).where(and(eq(products.id, productId), eq(products.isActive, true)));
  if (!product) throw new AssistantError(404, 'PRODUCT_NOT_FOUND', 'Produk tidak tersedia.');
  const preview = target(product, command);
  if (command.action === 'increase_stock' || command.action === 'decrease_stock') {
    return db.transaction(tx => confirmInTransaction(tx, userId, { ...command, productId, before: preview.before, after: preview.after }));
  }
  return { kind: 'confirm_action', text: `${titles[command.action]} untuk ${product.name}. Periksa nilai sebelum dan sesudah, lalu konfirmasi. Belum ada data yang diubah.`,
    preview: { ...preview, productName: product.name }, confirmationToken: signToken('confirm-product', userId, { ...command, productId, before: preview.before, after: preview.after }, 5 * 60) };
}

export async function planProductAction(userId: string, command: Omit<ProductCommand, 'productIds'>, query: string): Promise<AssistantReply> {
  validateProductCommand(command.command, command.action, command.value);
  const matches = await candidateProducts(query);
  if (!matches.length) return { kind: 'message', text: `Produk “${query}” tidak ditemukan. Gunakan nama lengkap, barcode, atau SKU.` };
  if (matches.length > 8) return { kind: 'message', text: 'Ada terlalu banyak varian. Sebutkan ukuran, barcode, atau SKU yang lebih spesifik.' };
  const selection: ProductCommand = { ...command, productIds: matches.map(p => p.id) };
  if (matches.length === 1) return prepareAction(userId, selection, matches[0].id);
  const immediate = command.action === 'increase_stock' || command.action === 'decrease_stock';
  return { kind: 'choose_product', text: `Pilih produk untuk ${titles[command.action].toLowerCase()}. ${immediate ? `Setelah dipilih, stok langsung ${command.action === 'increase_stock' ? 'ditambah' : 'dikurangi'} ${command.value} ${command.unit || 'satuan stok'} dan dapat dibatalkan.` : 'Setelah itu Anda akan diminta mengonfirmasi perubahan.'}`, products: matches, selectionEndpoint: 'choose-action', selectionToken: signToken('choose-action', userId, selection, 5 * 60) };
}

export async function chooseAction(userId: string, token: string, productId: string) {
  const payload = readToken<ProductCommand>(token, 'choose-action');
  if (payload.sub !== userId) throw new AssistantError(403, 'ADMIN_REQUIRED', 'Pilihan bukan milik akun ini.');
  return prepareAction(userId, payload.data, productId);
}

function reply(userId: string, row: ActionRow): AssistantReply {
  const undone = !!row.undoneAt, field = row.action === 'update_price' ? 'sellPrice' : 'stock';
  const before = Number(undone ? row.undoBefore : row.before), after = Number(undone ? row.undoAfter : row.after);
  return { kind: undone ? 'product_undone' : 'product_changed', text: undone ? `Perubahan ${row.productName} sudah dibatalkan.` : `${titles[row.action as ProductAction]} untuk ${row.productName} berhasil: ${field === 'sellPrice' ? money(before) : before} → ${field === 'sellPrice' ? money(after) : after + ' ' + row.unit}.`,
    change: { id: row.id, productId: row.productId, productName: row.productName, before, after, unit: row.unit, quantity: after - before, field, undone },
    undoToken: undone ? undefined : signToken('undo-action', userId, { operationId: row.id }, Math.max(1, Math.floor((row.createdAt.getTime() + 15 * 60000 - Date.now()) / 1000))) };
}

export async function previousAction(userId: string, id: string, tx: Transaction | typeof db = db) {
  const [row] = await tx.select().from(assistantActions).where(eq(assistantActions.id, id));
  if (!row) return;
  if (row.actorId !== userId) throw new AssistantError(403, 'ADMIN_REQUIRED', 'Perubahan bukan milik akun ini.');
  return reply(userId, row);
}

export async function confirmInTransaction(tx: Transaction, userId: string, command: Confirmation) {
  validate(command);
  if (!command.productIds.includes(command.productId)) throw new AssistantError(403, 'INVALID_PRODUCT', 'Produk tidak sesuai perintah.');
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${command.operationId}))`);
  const existing = await previousAction(userId, command.operationId, tx);
  if (existing) return existing;
  const [product] = await tx.select().from(products).where(and(eq(products.id, command.productId), eq(products.isActive, true))).for('update');
  if (!product) throw new AssistantError(404, 'PRODUCT_NOT_FOUND', 'Produk tidak tersedia.');
  const next = target(product, command);
  if (next.before !== command.before || next.after !== command.after) throw new AssistantError(409, 'PRODUCT_CHANGED', 'Data produk berubah setelah pratinjau. Kirim ulang perintah agar nilai terbaru ditampilkan.');
  if (next.field === 'stock') {
    await tx.update(products).set({ stock: next.after, updatedAt: new Date() }).where(eq(products.id, product.id));
    await tx.insert(stockAdjustments).values({ id: `ai-action-${command.operationId}`, productId: product.id, adjustmentQty: next.after - next.before, adjustedBy: userId, reason: 'AUDIT_CORRECTION', notes: command.command });
  } else await tx.update(products).set({ sellPrice: String(next.after), updatedAt: new Date() }).where(eq(products.id, product.id));
  const [row] = await tx.insert(assistantActions).values({ id: command.operationId, actorId: userId, productId: product.id, action: command.action, command: command.command, productName: product.name, unit: next.unit, before: String(next.before), after: String(next.after) }).returning();
  return reply(userId, row);
}

export async function confirmAction(userId: string, token: string) {
  const payload = readToken<Confirmation>(token, 'confirm-product');
  if (payload.sub !== userId) throw new AssistantError(403, 'ADMIN_REQUIRED', 'Konfirmasi bukan milik akun ini.');
  return db.transaction(tx => confirmInTransaction(tx, userId, payload.data));
}

export async function undoActionInTransaction(tx: Transaction, userId: string, id: string) {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new AssistantError(422, 'INVALID_ACTION', 'Perubahan tidak dikenali.');
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${id}))`);
  const [row] = await tx.select().from(assistantActions).where(eq(assistantActions.id, id));
  if (!row || row.actorId !== userId) throw new AssistantError(404, 'CHANGE_NOT_FOUND', 'Perubahan tidak ditemukan untuk akun ini.');
  if (row.undoneAt) return reply(userId, row);
  if (Date.now() - row.createdAt.getTime() > 15 * 60000) throw new AssistantError(409, 'UNDO_EXPIRED', 'Batas pembatalan 15 menit sudah lewat.');
  const [product] = await tx.select().from(products).where(eq(products.id, row.productId)).for('update');
  if (!product || !product.isActive) throw new AssistantError(409, 'UNDO_CONFLICT', 'Produk tidak lagi tersedia untuk pembatalan.');
  const isPrice = row.action === 'update_price';
  const current = isPrice ? Number(product.sellPrice) : product.stock;
  if ((isPrice || row.action === 'set_stock') && current !== Number(row.after)) throw new AssistantError(409, 'UNDO_CONFLICT', 'Nilai produk sudah berubah lagi. Pembatalan ditolak agar tidak menimpa perubahan berikutnya.');
  const after = isPrice ? Number(row.before) : current - (Number(row.after) - Number(row.before));
  if (after < 0 || (!isPrice && (!Number.isSafeInteger(after) || after > 2147483647))) throw new AssistantError(409, 'UNDO_CONFLICT', 'Pembatalan membuat stok tidak valid. Periksa stok terbaru.');
  if (isPrice) await tx.update(products).set({ sellPrice: String(after), updatedAt: new Date() }).where(eq(products.id, product.id));
  else {
    await tx.update(products).set({ stock: after, updatedAt: new Date() }).where(eq(products.id, product.id));
    await tx.insert(stockAdjustments).values({ id: `ai-action-undo-${id}`, productId: product.id, adjustmentQty: after - current, adjustedBy: userId, reason: 'AUDIT_CORRECTION', notes: `Batalkan: ${row.command}` });
  }
  const [updated] = await tx.update(assistantActions).set({ undoneAt: new Date(), undoBefore: String(current), undoAfter: String(after) }).where(eq(assistantActions.id, id)).returning();
  return reply(userId, updated);
}

export async function undoAction(userId: string, token: string) {
  const payload = readToken<{ operationId: string }>(token, 'undo-action');
  if (payload.sub !== userId) throw new AssistantError(403, 'ADMIN_REQUIRED', 'Pembatalan bukan milik akun ini.');
  return db.transaction(tx => undoActionInTransaction(tx, userId, payload.data.operationId));
}
