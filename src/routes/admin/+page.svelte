<script lang="ts">
  import ProductImage from '$lib/components/ProductImage.svelte';
  import LoadNotice from '$lib/components/LoadNotice.svelte';
  let analyticsError = '';
  let revenueError = '';
  async function refreshDashboard() { await Promise.all([fetchLatestAnalytics(), fetchRevenue()]); }
  import { onMount, onDestroy } from 'svelte';
  import {
    TrendingUp,
    DollarSign,
    ShoppingBag,
    Award,
    AlertTriangle,
    ArrowUpRight,
    Download,
    RefreshCw,
    Calendar,
    BarChart2
  } from 'lucide-svelte';

  export let data: any;

  let localAnalytics = data?.analytics;
  let revenueData: any = data?.revenueData || null;
  let isRefreshing = false;
  let intervalId: any;

  // ── Period filter state ──────────────────────────────────────────────
  type Period = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  let selectedPeriod: Period = 'monthly';

  // Default custom range = current month
  const todayStr = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  let customFrom = firstOfMonth;
  let customTo = todayStr;

  // Revenue analytics state
  let isLoadingRevenue = false;

  const PERIOD_LABELS: Record<Period, string> = {
    daily: 'Hari Ini',
    weekly: '7 Hari Terakhir',
    monthly: 'Bulan Ini',
    yearly: 'Tahun Ini',
    custom: 'Pilih tanggal'
  };

  $: analytics = localAnalytics || data?.analytics || {
    totalOmset: 0,
    netProfit: 0,
    totalTransactions: 0,
    averageOrderValue: 0,
    topProducts: [],
    lowStockAlerts: []
  };

  async function fetchLatestAnalytics() {
    isRefreshing = true; analyticsError = '';
    try {
      const res = await fetch('/api/analytics/dashboard').then(r => r.json());
      if (res?.success && res.data) {
        localAnalytics = res.data;
      }
    } catch (e) {
      analyticsError = 'Ringkasan toko belum dapat diperbarui.';
    } finally {
      isRefreshing = false;
    }
  }

  async function fetchRevenue() {
    isLoadingRevenue = true; revenueError = '';
    try {
      let url = `/api/analytics/revenue?period=${selectedPeriod}`;
      if (selectedPeriod === 'custom') {
        url += `&dateFrom=${customFrom}&dateTo=${customTo}`;
      }
      const res = await fetch(url).then(r => r.json());
      if (res?.success && res.data) {
        revenueData = res.data;
      }
    } catch (e) {
      revenueError = 'Pendapatan belum dapat dimuat. Silakan coba lagi.';
    } finally {
      isLoadingRevenue = false;
    }
  }

  function onPeriodChange(p: Period) {
    selectedPeriod = p;
    if (p !== 'custom') fetchRevenue();
  }

  function onCustomApply() {
    if (customFrom && customTo) fetchRevenue();
  }

  onMount(() => {
    fetchLatestAnalytics();
    fetchRevenue();
    intervalId = setInterval(fetchLatestAnalytics, 30000);
  });

  import { Chart, registerables } from 'chart.js';
  Chart.register(...registerables);

  let canvasEl: HTMLCanvasElement;
  let chartInstance: Chart | null = null;

  onDestroy(() => {
    if (intervalId) clearInterval(intervalId);
    if (chartInstance) chartInstance.destroy();
  });

  function formatRp(val: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  }

  function formatRpShort(val: number) {
    if (val >= 1_000_000_000) return `Rp ${(val / 1_000_000_000).toFixed(1)}M`;
    if (val >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(1)} Jt`;
    if (val >= 1_000) return `Rp ${(val / 1_000).toFixed(0)} Rb`;
    return `Rp ${val}`;
  }

  function shortDate(dateStr: string, totalPoints: number = 7) {
    if (!dateStr) return '';
    if (dateStr.includes(':')) return dateStr;
    if (/^\d{4}-\d{2}$/.test(dateStr)) {
      return new Date(`${dateStr}-01T00:00:00+07:00`).toLocaleDateString('id-ID', { month: 'short', timeZone: 'Asia/Jakarta' });
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    if (totalPoints <= 7) {
      return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
    } else if (totalPoints <= 31) {
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    } else {
      return d.toLocaleDateString('id-ID', { month: 'short', day: 'numeric' });
    }
  }

  $: chartPoints = revenueData?.chartData || [];

  $: if (canvasEl && chartPoints) {
    renderChart();
  }

  function renderChart() {
    if (!canvasEl) return;
    if (chartInstance) {
      chartInstance.destroy();
    }

    const labels = chartPoints.map((d: any) => shortDate(d.date, chartPoints.length));
    const omsetData = chartPoints.map((d: any) => d.omset);
    const profitData = chartPoints.map((d: any) => d.profit);

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    const isSinglePoint = chartPoints.length <= 1;
    const barThicknessVal = isSinglePoint ? 24 : (chartPoints.length <= 8 ? 14 : undefined);
    const maxBarThicknessVal = isSinglePoint ? 28 : 18;

    Chart.defaults.font.family = "'Public Sans', sans-serif";
    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Omset (Gross)',
            data: omsetData,
            backgroundColor: '#1764bf',
            borderRadius: 2,
            borderWidth: 0,
            borderSkipped: false,
            barThickness: barThicknessVal,
            maxBarThickness: maxBarThicknessVal,
            barPercentage: 0.65,
            categoryPercentage: 0.55
          },
          {
            label: 'Profit Bersih (Net)',
            data: profitData,
            backgroundColor: '#9babbd',
            borderRadius: 2,
            borderWidth: 0,
            borderSkipped: false,
            barThickness: barThicknessVal,
            maxBarThickness: maxBarThicknessVal,
            barPercentage: 0.65,
            categoryPercentage: 0.55
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: '#0f172a',
            titleFont: { size: 12, weight: 'bold' },
            bodyFont: { size: 12 },
            padding: 12,
            cornerRadius: 6,
            callbacks: {
              label: function (context) {
                const val = context.parsed.y || 0;
                return `  ${context.dataset.label}: ${formatRp(val)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 }, color: '#64748b', maxRotation: 0, minRotation: 0, autoSkip: true }
          },
          y: {
            grid: { color: '#f1f5f9' },
            ticks: {
              font: { size: 10 },
              color: '#64748b',
              callback: function (val) {
                return formatRpShort(Number(val));
              }
            },
            beginAtZero: true
          }
        }
      }
    });
  }

  async function exportDashboardReport() {
    const XLSX = await import('xlsx');
    const today = new Date().toISOString().slice(0, 10);

    const rows: (string | number)[][] = [
      ['LAPORAN RINGKASAN DASHBOARD MINIMARKET'],
      [`Tanggal Ekspor: ${today}`],
      [`Periode: ${revenueData ? `${revenueData.dateFrom} s/d ${revenueData.dateTo}` : 'Semua Waktu'}`],
      [],
      ['METRIK UTAMA'],
      ['Metrik', 'Nilai'],
      ['Total Omset (Gross)', revenueData?.totalOmset ?? analytics.totalOmset],
      ['Profit Bersih (Net)', revenueData?.netProfit ?? analytics.netProfit],
      ['Total Transaksi', revenueData?.totalTransactions ?? analytics.totalTransactions],
      ['Rata-rata Basket Size', revenueData?.averageOrderValue ?? analytics.averageOrderValue],
      [],
      ['TOP SELLING PRODUCTS (PRODUK TERLARIS)'],
      ['Nama Produk', 'Kategori', 'Jumlah Terjual (pcs)', 'Total Pendapatan (Rp)'],
      ...analytics.topProducts.map((tp: any) => [tp.name, tp.category, tp.soldQty, tp.revenue]),
      [],
      ['PERINGATAN STOK MENIPIS'],
      ['Nama Produk', 'Kategori', 'Sisa Stok (pcs)', 'Batas Alert Limit (pcs)'],
      ...analytics.lowStockAlerts.map((ls: any) => [ls.name, ls.category, ls.stock, ls.minAlert]),
      [],
      ...(revenueData?.chartData?.length ? [
        ['DETAIL PENDAPATAN HARIAN'],
        ['Tanggal', 'Omset (Rp)', 'Profit (Rp)', 'Jumlah Transaksi'],
        ...revenueData.chartData.map((d: any) => [d.date, d.omset, d.profit, d.transactions])
      ] : [])
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const colWidths: number[] = [];
    rows.forEach(row => {
      row.forEach((cell, colIdx) => {
        const len = String(cell ?? '').length;
        colWidths[colIdx] = Math.max(colWidths[colIdx] ?? 10, len + 2);
      });
    });
    ws['!cols'] = colWidths.map(w => ({ wch: Math.min(w, 50) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dashboard Analitik');
    XLSX.writeFile(wb, `Laporan_Analitik_Minimarket_${today}.xlsx`);
  }

  onMount(() => {
    const refreshStock = () => { fetchLatestAnalytics(); };
    window.addEventListener('vecmart:stock-changed', refreshStock);
    return () => window.removeEventListener('vecmart:stock-changed', refreshStock);
  });
</script>

<div class="page-content">
  <!-- Header & Period Filter (Compact Integrated Bar) -->
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-4 ">
    <div>
      <h1 class="page-title">Ringkasan toko</h1>
      <p class="text-xs text-slate-500 mt-0.5">Ringkasan performa penjualan, profit bersih, dan stok barang</p>
    </div>

    <!-- Period Filter Buttons & Action Buttons -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="dashboard-periods flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
        {#each (['daily', 'weekly', 'monthly', 'yearly', 'custom'] as Period[]) as p}
          <button
            on:click={() => onPeriodChange(p)}
            class="px-3 py-1 rounded-lg text-xs font-semibold transition-colors
              {selectedPeriod === p
                ? 'bg-sky-600 text-white '
                : 'text-slate-600 hover:text-slate-900'}"
          >
            {PERIOD_LABELS[p]}
          </button>
        {/each}
      </div>

      <button on:click={refreshDashboard} aria-label="Segarkan ringkasan" title="Segarkan" class="p-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl  transition-colors">
        <RefreshCw class="w-4 h-4 text-sky-600 {isRefreshing ? 'animate-spin' : ''}" />
      </button>

      <button on:click={exportDashboardReport} aria-label="Ekspor laporan Excel" class="px-3 py-2 bg-sky-50 border border-sky-200 hover:bg-sky-100 text-sky-700 text-xs font-semibold rounded-xl flex items-center space-x-1.5  transition-colors">
        <Download class="w-4 h-4 text-sky-600" />
        <span class="hidden sm:inline">{"Ekspor Excel"}</span>
      </button>
    </div>
  </div>

  <LoadNotice error={analyticsError || revenueError} retry={refreshDashboard} />

  <!-- Custom date range dropdown inline (shown only when selectedPeriod === 'custom') -->
  {#if selectedPeriod === 'custom'}
    <div class="bg-white border border-slate-200 rounded-2xl p-3  flex flex-wrap items-center gap-3">
      <div>
        <span class="text-xs text-slate-500 font-semibold  mr-1">Dari:</span>
        <input aria-label="Nilai" type="date" bind:value={customFrom} max={customTo}
          class="px-2.5 py-1 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white focus:outline-none focus:border-sky-500" />
      </div>
      <div>
        <span class="text-xs text-slate-500 font-semibold  mr-1">Sampai:</span>
        <input aria-label="Nilai" type="date" bind:value={customTo} min={customFrom} max={todayStr}
          class="px-2.5 py-1 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white focus:outline-none focus:border-sky-500" />
      </div>
      <button on:click={onCustomApply}
        class="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg ">
        Tampilkan
      </button>
    </div>
  {/if}

  <div class="dashboard-stats">
    <div class="dashboard-stat"><p>Omzet penjualan</p><strong>{formatRp(revenueData?.totalOmset ?? analytics.totalOmset)}</strong><span>{PERIOD_LABELS[selectedPeriod]}</span></div>
    <div class="dashboard-stat"><p>Laba bersih</p><strong>{formatRp(revenueData?.netProfit ?? analytics.netProfit)}</strong><span>{(revenueData?.totalOmset ?? analytics.totalOmset) > 0 ? (((revenueData?.netProfit ?? analytics.netProfit) / (revenueData?.totalOmset ?? analytics.totalOmset)) * 100).toFixed(1) : 0}% margin penjualan</span></div>
    <div class="dashboard-stat"><p>Transaksi</p><strong>{revenueData?.totalTransactions ?? analytics.totalTransactions}</strong><span>Struk penjualan</span></div>
    <div class="dashboard-stat"><p>Rata-rata belanja</p><strong>{formatRp(revenueData?.averageOrderValue ?? analytics.averageOrderValue)}</strong><span>Per transaksi</span></div>
  </div>
  <div class="dashboard-chart"><div class="dashboard-chart-heading"><div><h2>Pendapatan toko</h2><p>{PERIOD_LABELS[selectedPeriod]} · Omzet dan laba bersih</p></div><div class="dashboard-legend"><span><i></i>Omzet</span><span><i></i>Laba bersih</span></div></div>
    {#if isLoadingRevenue}
      <div class="flex items-center justify-center h-52 text-slate-500 text-xs font-medium">Memuat grafik pendapatan...</div>
    {:else if chartPoints.length === 0}
      <div class="flex items-center justify-center h-52 text-slate-500 text-xs font-medium">Tidak ada transaksi di periode ini</div>
    {:else}
      <div class="relative w-full h-44 sm:h-48">
        <canvas bind:this={canvasEl}></canvas>
      </div>

    {/if}
  </div>

  <div class="dashboard-lower">
    <section><div class="section-heading"><h2>Produk terlaris</h2><a href="/admin/produk">Lihat produk →</a></div>
      {#if analytics.topProducts.length}<div class="overflow-x-auto"><div class="data-table-scroll"><table><thead><tr><th class="text-left">Produk</th><th class="text-right">Terjual</th><th class="text-right">Pendapatan</th></tr></thead><tbody>{#each analytics.topProducts.slice(0,5) as tp}<tr class="border-b border-slate-100"><td class="pr-4"><div class="flex items-center gap-3"><div class="top-product-photo"><ProductImage src={tp.imageUrl || ''} name={tp.name} /></div><div><span class="font-medium">{tp.name}</span><span class="block text-xs text-slate-500 mt-1">{tp.category}</span></div></div></td><td class="text-right whitespace-nowrap">{tp.soldQty} pcs</td><td class="text-right whitespace-nowrap">{formatRp(tp.revenue)}</td></tr>{:else}<tr><td colspan="12"><div class="data-empty">Belum ada data yang sesuai untuk ditampilkan.</div></td></tr>{/each}</tbody></table></div></div>{:else}<div class="data-empty">Produk terlaris akan muncul setelah ada penjualan.</div>{/if}
    </section>
    <section><div class="section-heading"><h2>Stok perlu perhatian</h2><a href="/admin/produk">Kelola stok →</a></div>
      {#if analytics.lowStockAlerts.length}{#each analytics.lowStockAlerts.slice(0,5) as ls}<div class="stock-row"><div><h3>{ls.name}</h3><p>Batas minimum {ls.minAlert} pcs</p></div><span>Sisa {ls.stock} pcs</span></div>{/each}{:else}<div class="data-empty">Tidak ada produk di bawah batas minimum stok.</div>{/if}
    </section>
  </div>
</div>
