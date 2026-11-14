<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/authStore';
  import { summarizeCashiers, type CashierReport } from '$lib/cashier-report';
  const day = (date: Date) => new Date(+date + 7 * 3600000).toISOString().slice(0, 10);
  const today = day(new Date());
  let start = `${today.slice(0, 7)}-01`, end = today;
  let appliedStart = start, appliedEnd = end;
  let preset = 'month', cashier = '', error = '';
  let report: CashierReport = summarizeCashiers([]);
  let loading = true, loaded = false, requestNumber = 0;
  $: selected = summarizeCashiers(report.rows.filter(row => !cashier || row.id === cashier));
  $: periodLabel = `${dateLabel(appliedStart)} – ${dateLabel(appliedEnd)}`;
  const rp = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
  function dateLabel(value: string) {
    return new Date(`${value}T00:00:00+07:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' });
  }
  export async function refresh() {
    const current = ++requestNumber, from = start, to = end;
    loading = true; error = '';
    try {
      if (!from || !to || from > to) throw new Error('Pilih tanggal awal dan akhir yang valid.');
      const response = await fetch(`/api/cashier-reports?${new URLSearchParams({ start: from, end: to })}`, { headers: { authorization: `Bearer ${$authStore?.token || ''}` } });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.message || 'Laporan belum dapat dimuat.');
      if (current !== requestNumber) return;
      report = body.data;
      if (cashier && !report.rows.some(row => row.id === cashier)) cashier = '';
      appliedStart = from; appliedEnd = to; loaded = true;
    } catch (e) { if (current === requestNumber) error = e instanceof Error ? e.message : 'Laporan belum dapat dimuat. Silakan coba lagi.'; }
    finally { if (current === requestNumber) loading = false; }
  }
  function choosePeriod() {
    if (preset === 'custom') return;
    end = today;
    start = preset === 'today' ? today : preset === 'week' ? day(new Date(Date.parse(`${today}T00:00:00+07:00`) - 6 * 86400000)) : preset === 'year' ? `${today.slice(0, 4)}-01-01` : `${today.slice(0, 7)}-01`;
    refresh();
  }
  async function exportReport() {
    const XLSX = await import('xlsx');
    const rows = [['PENDAPATAN PER KASIR'], ['Periode (WIB)', periodLabel],
      ['Kasir', 'Transaksi', 'Tunai (Rp)', 'QRIS (Rp)', 'Debit (Rp)', 'Lainnya (Rp)', 'Total penjualan (Rp)'],
      ...selected.rows.map(r => [r.name, r.transactions, r.cash, r.qris, r.debit, r.other, r.total]),
      ['Total', selected.totals.transactions, selected.totals.cash, selected.totals.qris, selected.totals.debit, selected.totals.other, selected.totals.total]];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!cols'] = [{ wch: 28 }, ...Array.from({ length: 6 }, () => ({ wch: 23 }))];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Pendapatan kasir');
    XLSX.writeFile(book, `Pendapatan-kasir-${appliedStart}-${appliedEnd}.xlsx`);
  }
  onMount(refresh);
</script>

<section class="cashier-report" aria-label="Laporan pendapatan kasir" aria-busy={loading}>
  <div class="report-heading"><div><h2>Pendapatan per kasir</h2><p>Lihat hasil penjualan setiap kasir pada periode yang Anda pilih.</p></div><button on:click={exportReport} disabled={loading || !loaded || !!error}>Ekspor Excel</button></div>
  <form class="report-filters" class:custom-range={preset === 'custom'} on:submit|preventDefault={refresh}>
    <label>Periode<select bind:value={preset} on:change={choosePeriod}><option value="today">Hari ini</option><option value="week">7 hari terakhir</option><option value="month">Bulan ini</option><option value="year">Tahun ini</option><option value="custom">Pilih tanggal</option></select></label>
    <label class:custom={preset === 'custom'} class="date-filter">Dari tanggal<input type="date" required bind:value={start} on:input={() => preset = 'custom'} /></label>
    <label class:custom={preset === 'custom'} class="date-filter">Sampai tanggal<input type="date" required bind:value={end} min={start} on:input={() => preset = 'custom'} /></label>
    <label>Kasir<select bind:value={cashier}><option value="">Semua kasir</option>{#each report.rows as row}<option value={row.id}>{row.name}</option>{/each}</select></label>
    <button class="apply" type="submit" disabled={loading}>{loading ? 'Memuat…' : 'Tampilkan'}</button>
  </form>
  {#if error}<p role="alert" class="error">{error} Tekan Tampilkan untuk mencoba lagi.</p>{/if}
  {#if loaded && !error}
    <p class="period">{periodLabel} · WIB{loading ? ' · Memperbarui…' : ''}</p>
    <div class="report-totals">
      <div><span>Total penjualan</span><strong class="revenue">{rp(selected.totals.total)}</strong></div>
      <div><span>Penjualan tunai</span><strong>{rp(selected.totals.cash)}</strong></div>
      <div><span>Penjualan nontunai</span><strong>{rp(selected.totals.total - selected.totals.cash)}</strong></div>
      <div><span>Transaksi</span><strong>{selected.totals.transactions}<small> struk</small></strong></div>
    </div>
    <p class="explanation">Total penjualan sudah memperhitungkan diskon dan tidak termasuk kembalian. Saldo laci dan selisih uang tersedia di Rekap sesi kasir.</p>
    {#if selected.totals.transactions === 0}<p class="empty">Belum ada transaksi pada periode ini. Coba pilih periode lain.</p>{/if}
    <div class="desktop-report data-table-scroll"><table>
      <thead><tr><th>Kasir</th><th>Total penjualan</th><th>Transaksi</th><th>Tunai</th><th>QRIS</th><th>Debit</th>{#if selected.totals.other !== 0}<th>Lainnya</th>{/if}</tr></thead>
      <tbody>{#each selected.rows as row}<tr><th scope="row">{row.name}</th><td class="row-total">{rp(row.total)}</td><td>{row.transactions} struk</td><td>{rp(row.cash)}</td><td>{rp(row.qris)}</td><td>{rp(row.debit)}</td>{#if selected.totals.other !== 0}<td>{rp(row.other)}</td>{/if}</tr>{/each}</tbody>
      <tfoot><tr><th scope="row">Total periode</th><td class="row-total">{rp(selected.totals.total)}</td><td>{selected.totals.transactions} struk</td><td>{rp(selected.totals.cash)}</td><td>{rp(selected.totals.qris)}</td><td>{rp(selected.totals.debit)}</td>{#if selected.totals.other !== 0}<td>{rp(selected.totals.other)}</td>{/if}</tr></tfoot>
    </table></div>
    <div class="mobile-report">{#each selected.rows as row}<article>
      <div class="cashier-name"><h3>{row.name}</h3><span>{row.transactions} struk</span></div><strong class="row-total">{rp(row.total)}</strong>
      <dl><div><dt>Tunai</dt><dd>{rp(row.cash)}</dd></div><div><dt>QRIS</dt><dd>{rp(row.qris)}</dd></div><div><dt>Debit</dt><dd>{rp(row.debit)}</dd></div>{#if row.other !== 0}<div><dt>Lainnya</dt><dd>{rp(row.other)}</dd></div>{/if}</dl>
    </article>{/each}</div>
  {:else if loading}<p class="empty" role="status">Memuat laporan penjualan kasir…</p>{/if}
</section>

<style>
  .cashier-report { min-width:0; color:#203e60; padding-bottom:112px; }
  @media(min-width:1101px) { .cashier-report { margin-right:96px; padding-bottom:24px; } }
  .report-heading { display:flex; justify-content:space-between; gap:16px; align-items:center; margin:12px 0 24px; }
  h2 { font-size:21px; font-weight:600; } p { font-size:14px; line-height:1.6; } .report-heading p { color:#60758c; margin-top:6px; }
  button,select,input { min-height:44px; border:1px solid #cfdeed; border-radius:10px; padding:10px 12px; background:white; font-size:14px; max-width:100%; }
  button { font-weight:600; cursor:pointer; flex-shrink:0; } button:disabled { opacity:.55; cursor:wait; }
  .report-filters { display:grid; grid-template-columns:1fr 1.2fr auto; gap:12px; padding:20px; background:#f7faff; border:1px solid #dce6f1; border-radius:16px; align-items:end; }
  .report-filters.custom-range { grid-template-columns:1fr 1fr 1fr 1.2fr auto; }
  .date-filter { display:none; } .date-filter.custom { display:flex; }
  label { display:flex; flex-direction:column; gap:8px; font-size:13px; min-width:0; } input,select { width:100%; min-width:0; color:#203e60; } .apply { background:#1764bf; color:white; border-color:#1764bf; }
  .period { margin:24px 0 14px; font-weight:500; } .report-totals { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); border:1px solid #dce6f1; border-radius:16px; background:white; padding:24px 0; }
  .report-totals>div { padding:0 22px; border-right:1px solid #dce6f1; min-width:0; } .report-totals>div:last-child { border:0; } .report-totals span { display:block; font-size:13px; color:#60758c; margin-bottom:10px; }
  .report-totals strong { font-size:clamp(19px,1.65vw,28px); font-weight:600; overflow-wrap:anywhere; font-variant-numeric:tabular-nums; } .revenue,.row-total { color:#1764bf; } small { font-size:13px; font-weight:400; }
  .explanation { color:#60758c; font-size:13px; margin:14px 0 24px; max-width:850px; }
  .desktop-report { border:1px solid #dce6f1; border-radius:16px; background:white; } table { width:100%; font-size:14px; border-collapse:collapse; font-variant-numeric:tabular-nums; } th,td { padding:18px 16px; text-align:right; white-space:nowrap; } th:first-child { text-align:left; } thead { border-bottom:1px solid #dce6f1; color:#60758c; font-size:12px; } tbody tr+tr { border-top:1px solid #e8eef5; } tbody th { font-weight:500; } tfoot { border-top:1px solid #dce6f1; background:#f7faff; font-weight:600; } .row-total { font-weight:600; } .mobile-report { display:none; }
  .empty { padding:24px; text-align:center; background:#f2f7fd; border-radius:12px; margin-bottom:16px; } .error { color:#a02525; padding:16px; background:#fff1f1; margin-top:16px; border-radius:12px; }
  @media(max-width:1200px) { .report-filters,.report-filters.custom-range { grid-template-columns:repeat(2,minmax(0,1fr)); } .apply { grid-column:span 2; } .report-totals { grid-template-columns:repeat(2,minmax(0,1fr)); gap:24px 0; } .report-totals>div:nth-child(2) { border:0; } }
  @media(max-width:767px) {
    .report-heading { align-items:center; margin:0 0 16px; } .report-heading h2 { font-size:18px; } .report-heading p { display:none; } .report-heading button { font-size:12px; padding:8px; }
    .report-filters { padding:14px; } input,select { font-size:16px; padding:10px 8px; } .date-filter { display:none; } .date-filter.custom { display:flex; } .report-filters label:nth-child(4) { grid-column:2; grid-row:1; }
    .period { margin-top:18px; }
    .report-totals>div { padding:0 14px; } .report-totals strong { font-size:20px; } .desktop-report { display:none; } .mobile-report { display:grid; gap:12px; }
    article { background:white; border:1px solid #dce6f1; border-radius:14px; padding:18px; min-width:0; } .cashier-name { display:flex; justify-content:space-between; gap:12px; font-size:14px; margin-bottom:10px; } h3 { font-weight:600; overflow-wrap:anywhere; } .cashier-name span { white-space:nowrap; font-size:13px; color:#60758c; } article>strong { font-size:24px; } dl { border-top:1px solid #e8eef5; margin-top:16px; padding-top:12px; font-size:14px; } dl>div { display:flex; justify-content:space-between; gap:12px; padding:5px 0; } dt { color:#60758c; } dd { font-variant-numeric:tabular-nums; }
  }
</style>
