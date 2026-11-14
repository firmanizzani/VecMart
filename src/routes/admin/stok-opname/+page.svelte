<script lang="ts">
  import LoadNotice from '$lib/components/LoadNotice.svelte';
  let loadingPage = true;
  let loadError = '';
  import { dialog } from '$lib/actions/dialog';
  import { onMount } from 'svelte';
  import { ClipboardCheck, Plus, X, Search } from 'lucide-svelte';

  let adjustments: any[] = [];
  let products: any[] = [];
  let showModal = false;
  let isSaving = false;
  let productSearch = '';

  let form = {
    productId: '',
    productName: '',
    reason: 'DAMAGED',
    qtyDiff: -1,
    notes: ''
  };

  const REASONS = [
    { value: 'DAMAGED',           label: 'Rusak / Bocor (Damaged)' },
    { value: 'EXPIRED',           label: 'Kedaluwarsa (Expired)' },
    { value: 'LOST',              label: 'Hilang (Lost)' },
    { value: 'AUDIT_CORRECTION',  label: 'Koreksi Audit (Audit Correction)' },
  ];

  const REASON_STYLES: Record<string, string> = {
    DAMAGED:          'bg-amber-50 text-amber-700 border-amber-200',
    EXPIRED:          'bg-red-50 text-red-700 border-red-200',
    LOST:             'bg-slate-100 text-slate-700 border-slate-300',
    AUDIT_CORRECTION: 'bg-sky-50 text-sky-700 border-sky-200',
  };

  // Filtered product list for dropdown search
  $: filteredProducts = productSearch.trim().length > 0
    ? products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.barcode?.includes(productSearch))
    : products.slice(0, 20);

  let showProductDropdown = false;

  function selectProduct(p: any) {
    form.productId = p.id;
    form.productName = p.name;
    productSearch = p.name;
    showProductDropdown = false;
  }

  function openModal() {
    form = { productId: '', productName: '', reason: 'DAMAGED', qtyDiff: -1, notes: '' };
    productSearch = '';
    showModal = true;
  }

  async function loadPage() {
    loadingPage = true; loadError = '';
    try {
      const [adjRes, prodRes] = await Promise.all([
        fetch('/api/stock-adjustments').then(r => r.json()),
        fetch('/api/products').then(r => r.json())
      ]);
      if (adjRes?.success && Array.isArray(adjRes.data)) {
        adjustments = adjRes.data;
      }
      if (prodRes?.success && Array.isArray(prodRes.data)) {
        products = prodRes.data;
      } else { throw new Error('Data tidak tersedia'); }
    } catch (e) {
      loadError = 'Data belum dapat dimuat. Periksa koneksi lalu coba lagi.';
    }
    loadingPage = false;
  }
  onMount(loadPage);

  async function createAdjustment() {
    if (!form.productName.trim()) {
      alert('Pilih atau ketik nama produk terlebih dahulu!');
      return;
    }
    if (!form.qtyDiff || form.qtyDiff === 0) {
      alert('Jumlah selisih tidak boleh 0!');
      return;
    }

    isSaving = true;
    try {
      const res = await fetch('/api/stock-adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: form.productName.trim(),
          reason: form.reason,
          qtyDiff: Number(form.qtyDiff),
          notes: form.notes.trim() || undefined
        })
      }).then(r => r.json());

      if (res?.success && res.data) {
        adjustments = [res.data, ...adjustments];

        // Update local product stock
        const idx = products.findIndex(p => p.id === form.productId || p.name === form.productName);
        if (idx !== -1) {
          products[idx] = { ...products[idx], stock: Math.max(0, products[idx].stock + Number(form.qtyDiff)) };
          products = [...products];
        }

        showModal = false;
        form = { productId: '', productName: '', reason: 'DAMAGED', qtyDiff: -1, notes: '' };
        productSearch = '';
      } else {
        alert('Gagal menyimpan: ' + (res?.message || 'Unknown error'));
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      isSaving = false;
    }
  }
</script>

<div class="page-content">
  <div class="flex justify-between items-center">
    <div>
      <h1 class="page-title">Stok opname</h1>
      <p class="text-xs text-slate-500 mt-1">Audit fisik toko, pencatatan barang rusak (Damaged) & kedaluwarsa (Expired)</p>
    </div>

    <button on:click={openModal} class="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl flex items-center space-x-2  ">
      <Plus class="w-4 h-4" />
      <span>Sesuaikan stok</span>
    </button>
  </div>
  <LoadNotice loading={loadingPage} error={loadError} retry={loadPage} />

  <div class="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 ">
    <h2 class="text-base font-semibold text-slate-900 flex items-center space-x-2">
      <ClipboardCheck class="w-5 h-5 text-amber-600" />
      <span>Riwayat Penyesuaian Stok</span>
    </h2>

    {#if adjustments.length === 0}
      <p class="text-center text-slate-500 text-xs py-8">Belum ada data penyesuaian stok.</p>
    {:else}
      <div class="data-table-scroll"><table class="w-full text-left text-xs text-slate-700">
        <thead>
          <tr>
            <th class="p-3">Produk</th>
            <th class="p-3">Alasan (Reason)</th>
            <th class="p-3 text-center">Selisih Stok</th>
            <th class="p-3">Disesuaikan Oleh</th>
            <th class="p-3 text-right">Tanggal</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each adjustments as adj}
            <tr class="hover:bg-slate-50">
              <td class="p-3 font-semibold text-slate-900">{adj.productName}</td>
              <td class="p-3">
                <span class="px-2.5 py-0.5 rounded-full font-semibold text-xs border {REASON_STYLES[adj.reason] || 'bg-slate-100 text-slate-600 border-slate-300'}">
                  {adj.reason}
                </span>
              </td>
              <td class="p-3 text-center tabular-nums font-semibold {Number(adj.qtyDiff) < 0 ? 'text-red-600' : 'text-emerald-600'}">
                {Number(adj.qtyDiff) > 0 ? '+' : ''}{adj.qtyDiff} pcs
              </td>
              <td class="p-3 text-slate-700">{adj.adjustedBy}</td>
              <td class="p-3 text-right text-slate-500 tabular-nums">{adj.date}</td>
            </tr>
          {:else}<tr><td colspan="12"><div class="data-empty">Belum ada data untuk ditampilkan.</div></td></tr>{/each}
        </tbody>
      </table></div>
    {/if}
  </div>
</div>

<!-- Modal -->
{#if showModal}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="fixed inset-0 bg-slate-900/40  z-50 flex items-center justify-center p-4"
    on:click|self={() => showModal = false}>
    <div use:dialog class="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
      <div class="flex justify-between items-center border-b border-slate-200 pb-3">
        <h3 class="text-base font-semibold text-slate-900">Input Penyesuaian Stok</h3>
        <button aria-label="Tutup dialog" on:click={() => showModal = false} class="text-slate-500 hover:text-slate-700">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="space-y-4 text-xs">

        <!-- Produk (searchable dropdown) -->
        <div class="relative">
          <label for="prod-search" class="text-slate-600 font-semibold block mb-1">Produk</label>
          <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              id="prod-search"
              type="text"
              bind:value={productSearch}
              on:input={() => { showProductDropdown = true; form.productName = productSearch; form.productId = ''; }}
              on:focus={() => showProductDropdown = true}
              placeholder="Cari nama atau barcode produk..."
              class="w-full bg-white border border-slate-300 text-slate-900 rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:border-sky-500"
              autocomplete="off"
            />
          </div>

          {#if showProductDropdown && filteredProducts.length > 0}
            <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
            <div
              class="absolute z-10 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl  max-h-44 overflow-y-auto"
              on:mousedown|preventDefault
            >
              {#each filteredProducts as p}
                <button
                  type="button"
                  on:click={() => selectProduct(p)}
                  class="w-full text-left px-3 py-2 hover:bg-sky-50 text-xs border-b border-slate-100 last:border-0 flex justify-between items-center"
                >
                  <span class="font-semibold text-slate-800">{p.name}</span>
                  <span class="text-slate-500 tabular-nums text-xs">Stok: {p.stock} {p.unit || 'pcs'}</span>
                </button>
              {/each}
            </div>
          {/if}

          {#if form.productId}
            {@const selectedProd = products.find(p => p.id === form.productId)}
            {#if selectedProd}
              <p class="text-xs text-emerald-600 font-semibold mt-1">Dipilih — Stok saat ini: <span class="tabular-nums">{selectedProd.stock} {selectedProd.unit || 'pcs'}</span></p>
            {/if}
          {/if}
        </div>

        <!-- Alasan -->
        <div>
          <label for="reason-select" class="text-slate-600 font-semibold block mb-1">Alasan Penyesuaian</label>
          <select
            id="reason-select"
            bind:value={form.reason}
            class="w-full bg-white border border-slate-300 text-slate-900 rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500"
          >
            {#each REASONS as r}
              <option value={r.value}>{r.label}</option>
            {/each}
          </select>
        </div>

        <!-- Jumlah Selisih -->
        <div>
          <label for="qty-diff" class="text-slate-600 font-semibold block mb-1">
            Jumlah Selisih
            <span class="text-slate-500 font-normal">(negatif = berkurang, positif = tambah)</span>
          </label>
          <input
            id="qty-diff"
            type="number"
            bind:value={form.qtyDiff}
            placeholder="-1"
            class="w-full bg-white border border-slate-300 text-slate-900 rounded-xl px-3 py-2 tabular-nums focus:outline-none focus:border-sky-500"
          />
          {#if form.qtyDiff !== 0 && form.qtyDiff}
            <p class="text-xs mt-1 font-semibold {Number(form.qtyDiff) < 0 ? 'text-red-500' : 'text-emerald-600'}">
              {Number(form.qtyDiff) < 0 ? `Stok akan berkurang ${Math.abs(Number(form.qtyDiff))} pcs` : `Stok akan bertambah ${form.qtyDiff} pcs`}
            </p>
          {/if}
        </div>

        <!-- Notes (optional) -->
        <div>
          <label for="adj-notes" class="text-slate-600 font-semibold block mb-1">
            Catatan <span class="text-slate-500 font-normal">(Opsional)</span>
          </label>
          <textarea
            id="adj-notes"
            bind:value={form.notes}
            rows="2"
            placeholder="Contoh: Ditemukan saat audit mingguan..."
            class="w-full bg-white border border-slate-300 text-slate-900 rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-sky-500"
          ></textarea>
        </div>
      </div>

      <button
        on:click={createAdjustment}
        disabled={isSaving || !form.productName.trim()}
        class="w-full py-3 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-xs    "
      >
        {isSaving ? 'MENYIMPAN...' : 'SIMPAN STOK OPNAME'}
      </button>
    </div>
  </div>
{/if}
