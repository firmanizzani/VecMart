import { and, eq, gte, lte, sql, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { products, transactionItems, transactions } from '../db/schema.js';
import type { AssistantReply } from '../../lib/ai/types.js';
import { AssistantError } from './errors.js';
import { interpretRequest, type StorePlan } from './gemini.js';
import { consumeUsage } from './quota.js';
import { candidateProducts, operationId, previousChange } from './stock.js';
import { planProductAction, previousAction } from './product-actions.js';
import type { ProductAction } from '../../lib/ai/types.js';

const rupiah = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
const help = 'Saya dapat mengecek stok dan harga, menambah/mengurangi stok, menetapkan stok hasil hitung fisik, mengubah harga jual, serta merangkum penjualan dan produk terlaris. Contoh: “Kurangi stok Aqua 600ml sebanyak 2 pcs”, “Set stok Aqua 600ml menjadi 20 pcs”, atau “Ubah harga jual Aqua 600ml menjadi Rp 5.000”. Tambah/kurangi stok langsung dijalankan; set stok dan harga jual perlu dikonfirmasi. Perubahan dapat dibatalkan selama 15 menit. Pembuatan produk baru tetap melalui form Produk.';

export function validateStockCommand(message: string, plan: StorePlan) {
  if (/\b(jangan|batal|batalkan|hapus|kurangi|kurang|simulasi|contoh|bagaimana|gimana|apakah|bisakah|kalau|jika)\b/i.test(message)) {
    throw new AssistantError(422, 'EXPLICIT_COMMAND_REQUIRED', 'Untuk mengubah stok, tulis perintah langsung, misalnya “Tambah 50 pcs Aqua 600ml”. Untuk membatalkan perubahan sebelumnya, gunakan tombol Batalkan penambahan.');
  }
  const quantityMatch = message.match(/\b(?:tambah(?:kan)?|bertambah|restok|masuk)(?:\s+(?:stok|stock|sebanyak|lagi))*\s+(\d+)\b/i)
    || (/\b(?:tambah(?:kan)?|bertambah|restok|masuk)\b/i.test(message) ? message.match(/\bsebanyak\s+(\d+)\b/i) : null);
  if (!quantityMatch || Number(quantityMatch[1]) !== plan.quantity || !Number.isInteger(plan.quantity) || plan.quantity! < 1 || plan.quantity! > 10000) {
    throw new AssistantError(422, 'QUANTITY_UNCLEAR', 'Sebutkan jumlah setelah kata “tambah”, misalnya “Stok Aqua 600ml tambah 50 pcs”. Batas penambahan 1–10.000 satuan.');
  }
  if (/\b(dus|kardus|karton|pack|pak|paket|lusin)\b/i.test(message)) throw new AssistantError(422, 'UNIT_UNCLEAR', 'Sebutkan jumlah dalam satuan stok produk, misalnya 50 pcs. Konversi dus, pack, atau lusin belum tersedia.');
}

function reportRange(plan: StorePlan) {
  const validate = (value?: string) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new AssistantError(422, 'PERIOD_REQUIRED', 'Sebutkan periode laporan, misalnya “Penjualan Oktober 2026”.');
    const date = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new AssistantError(422, 'INVALID_PERIOD', 'Tanggal laporan tidak valid.');
    return value;
  };
  const from = validate(plan.dateFrom), to = validate(plan.dateTo);
  const start = new Date(`${from}T00:00:00+07:00`), end = new Date(`${to}T23:59:59.999+07:00`);
  if (end < start || end.getTime() - start.getTime() > 366 * 86400000 || from > new Date(Date.now() + 25200000).toISOString().slice(0, 10)) {
    throw new AssistantError(422, 'INVALID_PERIOD', 'Gunakan periode yang sudah dimulai, berurutan, dan tidak lebih dari 366 hari.');
  }
  return { from, to, start, end };
}

export async function storeReport(plan: StorePlan): Promise<AssistantReply> {
  const range = reportRange(plan);
  const filter = and(gte(transactions.createdAt, range.start), lte(transactions.createdAt, range.end));
  if (plan.intent === 'top_products') {
    const rows = await db.select({ name: transactionItems.productName,
      quantity: sql<number>`SUM(${transactionItems.quantity})::int`, revenue: sql<string>`SUM(${transactionItems.subtotal})` })
      .from(transactionItems).innerJoin(transactions, eq(transactions.id, transactionItems.transactionId)).where(filter)
      .groupBy(transactionItems.productName).orderBy(desc(sql`SUM(${transactionItems.quantity})`)).limit(5);
    return { kind: 'report', text: rows.length ? `Produk terlaris pada ${range.from} sampai ${range.to}, berdasarkan jumlah barang terjual.` : `Belum ada penjualan pada ${range.from} sampai ${range.to}.`,
      topProducts: rows.map(row => ({ ...row, revenue: Number(row.revenue) })) };
  }
  const [[summary], [cost]] = await Promise.all([
    db.select({ count: sql<number>`COUNT(*)::int`, revenue: sql<string>`COALESCE(SUM(${transactions.grandTotal}), 0)` }).from(transactions).where(filter),
    db.select({ cost: sql<string>`COALESCE(SUM(COALESCE(NULLIF(${transactionItems.costPrice}, 0), NULLIF(${products.costPrice}, 0), ${transactionItems.sellPrice} * 0.8) * ${transactionItems.quantity}), 0)` })
      .from(transactionItems).innerJoin(transactions, eq(transactions.id, transactionItems.transactionId)).leftJoin(products, eq(products.id, transactionItems.productId)).where(filter)
  ]);
  const revenue = Number(summary.revenue), profit = revenue - Number(cost.cost);
  return { kind: 'report', text: `Ringkasan penjualan ${range.from} sampai ${range.to}. Angka dihitung dari transaksi tersimpan.`,
    report: { from: range.from, to: range.to, revenue, profit, transactions: summary.count, average: summary.count ? Math.round(revenue / summary.count) : 0 } };
}

export async function handleChat(userId: string, requestId: string, message: string, interpret = interpretRequest): Promise<AssistantReply> {
  const text = message.trim();
  if (!text || text.length > 1000) throw new AssistantError(422, 'MESSAGE_REQUIRED', 'Tulis pesan sepanjang 1–1.000 karakter.');
  const id = operationId(userId, requestId);
  const existing = await previousAction(userId, id) || await previousChange(userId, id);
  if (existing) return existing;
  if (!process.env.GEMINI_API_KEY?.trim()) throw new AssistantError(503, 'GEMINI_NOT_CONFIGURED', 'Gemini belum diaktifkan. Tambahkan GEMINI_API_KEY pada konfigurasi server.');
  await consumeUsage();
  const plan = await interpret(text);
  if (plan.intent === 'help') return { kind: 'message', text: help };
  if (plan.intent === 'clarify') return { kind: 'message', text: plan.question || 'Sebutkan satu produk dan perubahan yang diinginkan, atau periode laporan.' };
  if (['increase_stock', 'decrease_stock', 'set_stock', 'update_price'].includes(plan.intent)) {
    if (!plan.productQuery?.trim()) throw new AssistantError(422, 'PRODUCT_UNCLEAR', 'Sebutkan produk yang akan diubah.');
    return planProductAction(userId, { operationId: id, action: plan.intent as ProductAction, value: plan.intent === 'update_price' ? plan.price! : plan.quantity!, unit: plan.unit || '', command: text }, plan.productQuery);
  }
  if (['sales_report', 'top_products'].includes(plan.intent)) return storeReport(plan);
  if (plan.intent === 'low_stock') {
    const rows = await db.select({ id: products.id, name: products.name, barcode: products.barcode, stock: products.stock, unit: products.unit })
      .from(products).where(and(eq(products.isActive, true), lte(products.stock, products.minStockAlert))).orderBy(products.stock).limit(20);
    return { kind: 'products', text: rows.length ? 'Produk berikut berada pada atau di bawah batas minimum stok. Periksa kebutuhan sebelum melakukan restok.' : 'Tidak ada produk aktif pada atau di bawah batas minimum stok.', products: rows };
  }
  if (!plan.productQuery?.trim()) throw new AssistantError(422, 'PRODUCT_UNCLEAR', 'Sebutkan produk yang ingin dicari atau ditambah stoknya.');
  const matches = await candidateProducts(plan.productQuery);
  if (!matches.length) return { kind: 'message', text: `Produk “${plan.productQuery}” belum ditemukan. Coba nama lengkap, barcode, atau SKU produk.` };
  if (plan.intent === 'find_products') return { kind: 'products', text: `${matches.length} produk cocok dengan pencarian Anda.`, products: matches.slice(0, 20) };
  return { kind: 'message', text: 'Perintah belum didukung. Gunakan bantuan untuk melihat perintah yang tersedia.' };
}
