<script lang="ts">
  import ProductImage from '$lib/components/ProductImage.svelte';
  import LoadNotice from '$lib/components/LoadNotice.svelte';
  let loadingPage = true;
  let loadError = '';
  import { dialog } from '$lib/actions/dialog';
  import { onMount } from 'svelte';
  import { Package, Plus, Search, Edit3, Trash2, Barcode, X, Upload } from 'lucide-svelte';

  let products: any[] = [];

  const categories = [
    { id: 'cat-1',  code: 'MIE',  name: 'Mie & Makanan Instan' },
    { id: 'cat-2',  code: 'BSK',  name: 'Biskuit & Roti' },
    { id: 'cat-3',  code: 'SNK',  name: 'Camilan & Snack' },
    { id: 'cat-4',  code: 'AIR',  name: 'Air Mineral & Isotonik' },
    { id: 'cat-5',  code: 'MIN',  name: 'Minuman Kemasan & Susu' },
    { id: 'cat-6',  code: 'DPR',  name: 'Bumbu & Kebutuhan Dapur' },
    { id: 'cat-7',  code: 'SBN',  name: 'Sabun & Perawatan Tubuh' },
    { id: 'cat-8',  code: 'KBR',  name: 'Kebutuhan Kebersihan Rumah' },
    { id: 'cat-9',  code: 'BAY',  name: 'Kebutuhan Ibu & Bayi' },
    { id: 'cat-10', code: 'RMH',  name: 'Perlengkapan Rumah Tangga' },
  ];

  async function loadPage() {
    loadingPage = true; loadError = '';
    try {
      const res = await fetch('/api/products').then(r => r.json());
      if (res?.success && Array.isArray(res.data)) {
        products = res.data.map((p: any) => ({
          id: p.id,
          barcode: p.barcode,
          sku: p.sku,
          name: p.name,
          category: p.categoryName || 'Lainnya',
          categoryId: p.categoryId,
          costPrice: Number(p.costPrice),
          sellPrice: Number(p.sellPrice),
          stock: Number(p.stock),
          minStockAlert: p.minStockAlert !== undefined ? Number(p.minStockAlert) : 5,
          unit: p.unit || 'pcs',
          imageUrl: p.imageUrl || ''
        }));
      } else { throw new Error('Data tidak tersedia'); }
    } catch (e) {
      loadError = 'Data belum dapat dimuat. Periksa koneksi lalu coba lagi.';
    }
    loadingPage = false;
  }
  onMount(loadPage);

  let searchQuery = '';
  let showModal = false;
  let editingId: string | null = null;
  let isUploading = false;
  let isSaving = false;
  let uploadError = '';

  let form = {
    barcode: '',
    sku: '',
    name: '',
    category: 'Mie & Makanan Instan',
    categoryId: 'cat-1',
    costPrice: 0,
    sellPrice: 0,
    stock: 0,
    minStockAlert: 5,
    unit: 'pcs',
    imageUrl: ''
  };

  $: filtered = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.barcode || '').includes(searchQuery) || (p.sku || '').toLowerCase().includes(searchQuery.toLowerCase()));

  let isSkuTouched = false;

  function getCategoryCode(categoryId: string) {
    return categories.find(c => c.id === categoryId)?.code || 'PRD';
  }

  function generateSku() {
    if (isSkuTouched) return;
    form.sku = form.name
      .toUpperCase()
      .replace(/(?<=\d)(ML|G|KG|L|CL|PCS|PACK|GR|GRAM)\b/gi, '')
      .replace(/[^A-Z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .join('-')
      .slice(0, 20);
  }

  function handleNameInput() {
    if (!editingId) generateSku();
  }

  function handleCategoryChange() {
    // Kategori berubah tidak mengubah SKU jika user menginginkan SKU murni dari nama produk
  }

  function openCreateModal() {
    editingId = null;
    uploadError = '';
    isSkuTouched = false;

    // Cari barcode terbesar yang berformat angka / 899...
    let maxBarcode = 899100000000;
    const barcodeNums = products
      .map(p => parseInt(p.barcode, 10))
      .filter(n => !isNaN(n));
    if (barcodeNums.length > 0) {
      maxBarcode = Math.max(...barcodeNums);
    }
    const nextBarcode = (maxBarcode + 1).toString();

    form = {
      barcode: nextBarcode,
      sku: '',
      name: '',
      category: 'Mie & Makanan Instan',
      categoryId: 'cat-1',
      costPrice: 0,
      sellPrice: 0,
      stock: 0,
      minStockAlert: 5,
      unit: 'pcs',
      imageUrl: ''
    };
    showModal = true;
  }

  async function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    uploadError = '';
    isUploading = true;

    try {
      const fd = new FormData();
      fd.append('file', file);
      if (form.name) {
        fd.append('productName', form.name);
      }
      const res = await fetch('/api/upload', { method: 'POST', body: fd }).then(r => r.json());
      if (res.success && res.url) {
        form = { ...form, imageUrl: res.url };
      } else {
        uploadError = res.message || 'Gagal upload gambar';
      }
    } catch (e: any) {
      uploadError = 'Gagal upload: ' + e.message;
    } finally {
      isUploading = false;
      input.value = '';
    }
  }

  async function saveProduct() {
    if (!form.name || !form.barcode) {
      alert('Nama produk & barcode wajib diisi!');
      return;
    }

    const finalSku = form.sku ? form.sku.toUpperCase().slice(0, 20) : (
      form.name
        .toUpperCase()
        .replace(/(?<=\d)(ML|G|KG|L|CL|PCS|PACK|GR|GRAM)\b/gi, '')
        .replace(/[^A-Z0-9\s]/g, '')
        .trim()
        .split(/\s+/)
        .join('-')
        .slice(0, 20) || `SKU-${Date.now()}`
    );

    isSaving = true;
    try {
      if (editingId) {
        const res = await fetch(`/api/products/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            barcode: form.barcode,
            sku: finalSku,
            name: form.name,
            categoryId: form.categoryId || null,
            costPrice: Number(form.costPrice),
            sellPrice: Number(form.sellPrice),
            stock: Number(form.stock),
            minStockAlert: Number(form.minStockAlert ?? 5),
            unit: form.unit,
            imageUrl: form.imageUrl || null
          })
        }).then(r => r.json());

        if (res.success) {
          const updatedImageUrl = res.data?.imageUrl !== undefined ? (res.data.imageUrl || '') : form.imageUrl;
          const catName = categories.find(c => c.id === form.categoryId)?.name || form.category;
          products = products.map(p => p.id === editingId ? { ...p, ...form, sku: finalSku, category: catName, imageUrl: updatedImageUrl } : p);
        } else {
          alert('Gagal mengupdate produk: ' + (res.message || 'Unknown error'));
          return;
        }
      } else {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            barcode: form.barcode,
            sku: finalSku,
            name: form.name,
            categoryId: form.categoryId || null,
            costPrice: Number(form.costPrice),
            sellPrice: Number(form.sellPrice),
            stock: Number(form.stock),
            minStockAlert: Number(form.minStockAlert ?? 5),
            unit: form.unit,
            imageUrl: form.imageUrl || null
          })
        }).then(r => r.json());

        if (res.success) {
          const catName = categories.find(c => c.id === form.categoryId)?.name || form.category;
          const newProductData = {
            id: res.data?.id || `prod-${Date.now()}`,
            ...form,
            sku: res.data?.sku || finalSku,
            category: catName,
            imageUrl: res.data?.imageUrl || form.imageUrl || ''
          };
          products = [...products, newProductData];
        } else {
          alert('Gagal menyimpan produk: ' + (res.message || 'Unknown error'));
          return;
        }
      }
      showModal = false;
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      isSaving = false;
    }
  }

  async function deleteProduct(id: string) {
    if (confirm('Yakin ingin menghapus produk ini?')) {
      try {
        const res = await fetch(`/api/products/${id}`, { method: 'DELETE' }).then(r => r.json());
        if (res.success) {
          products = products.filter(p => p.id !== id);
        } else {
          alert('Gagal menghapus produk: ' + res.message);
        }
      } catch (e: any) {
        alert('Error hapus produk: ' + e.message);
      }
    }
  }

  function formatRp(val: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  }
</script>

<div class="page-content">
  <div class="flex justify-between items-center">
    <div>
      <h1 class="page-title">Produk</h1>
      <p class="text-xs text-slate-500 mt-1">Kelola katalog barang, foto, barcode & HPP modal</p>
    </div>

    <button on:click={openCreateModal} class="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl flex items-center space-x-2  ">
      <Plus class="w-4 h-4" />
      <span>Tambah produk</span>
    </button>
  </div>
  <LoadNotice loading={loadingPage} error={loadError} retry={loadPage} />

  <!-- Search & Filters -->
  <div class="product-search-toolbar">
    <Search class="w-5 h-5 text-slate-500 shrink-0" />
    <input aria-label="Cari nama produk, SKU, atau scan barcode..." type="text" bind:value={searchQuery} placeholder="Cari nama produk, SKU, atau scan barcode..." class="bg-transparent text-slate-900 text-sm focus:outline-none w-full placeholder:text-slate-500" />
  </div>

  <!-- Products Table -->
  <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden ">
    <div class="data-table-scroll"><table class="w-full text-left text-xs text-slate-700">
      <thead>
        <tr>
          <th class="p-3.5">Produk</th>
          <th class="p-3.5">Barcode / SKU</th>
          <th class="p-3.5">Kategori</th>
          <th class="p-3.5 text-right">Modal (HPP)</th>
          <th class="p-3.5 text-right">Harga Jual</th>
          <th class="p-3.5 text-center">Stok</th>
          <th class="p-3.5 text-center">Aksi</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        {#each filtered as p}
          <tr class="hover:bg-slate-50">
            <td class="p-3.5 font-semibold text-slate-900 product-identity">
              <div class="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center border border-slate-200">
                <ProductImage src={p.imageUrl || ''} name={p.name} />
              </div>
              <div>
                <p class="font-semibold text-slate-900">{p.name}</p>
                <span class="text-xs text-slate-500 tabular-nums">{p.unit}</span>
              </div>
            </td>
            <td class="p-3.5 tabular-nums text-slate-700">
              <div class="flex items-center space-x-1 text-sky-700 font-semibold">
                <Barcode class="w-4 h-4" />
                <span>{p.barcode}</span>
              </div>
              <span class="text-xs text-slate-500">{p.sku}</span>
            </td>
            <td class="p-3.5"><span class="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full tabular-nums text-xs border border-slate-200">{p.category}</span></td>
            <td class="p-3.5 text-right tabular-nums text-slate-500">{formatRp(p.costPrice)}</td>
            <td class="p-3.5 text-right tabular-nums text-emerald-700 font-semibold">{formatRp(p.sellPrice)}</td>
            <td class="p-3.5 text-center font-semibold tabular-nums"><span class="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 border border-sky-100">{p.stock}</span></td>
            <td class="p-3.5 text-center space-x-2">
              <button aria-label="Edit data" on:click={() => { editingId = p.id; form = { ...p, minStockAlert: p.minStockAlert ?? 5 }; showModal = true; }} class="p-1.5 bg-slate-100 hover:bg-slate-200 text-sky-700 rounded-lg border border-slate-200">
                <Edit3 class="w-4 h-4" />
              </button>
              <button aria-label="Hapus data" on:click={() => deleteProduct(p.id)} class="p-1.5 bg-slate-100 hover:bg-slate-200 text-red-600 rounded-lg border border-slate-200">
                <Trash2 class="w-4 h-4" />
              </button>
            </td>
          </tr>
        {:else}<tr><td colspan="12"><div class="data-empty">Belum ada data yang sesuai untuk ditampilkan.</div></td></tr>{/each}
      </tbody>
    </table></div>
  </div>
</div>

<!-- Modal Form Create/Edit -->
{#if showModal}
  <div class="fixed inset-0 bg-slate-900/40  z-50 flex items-center justify-center p-4">
    <div use:dialog class="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
      <div class="flex justify-between items-center border-b border-slate-200 pb-3">
        <h3 class="text-base font-semibold text-slate-900">{editingId ? 'Edit Produk' : 'Tambah Produk Baru'}</h3>
        <button aria-label="Tutup dialog" on:click={() => showModal = false} class="text-slate-500 hover:text-slate-700"><X class="w-5 h-5" /></button>
      </div>

      <div class="space-y-3 text-xs">
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-slate-600 font-semibold" for="vm-field-1">Barcode</label>
            <input id="vm-field-1" type="text" bind:value={form.barcode} class="w-full bg-white border border-slate-300 text-slate-900 rounded-xl px-3 py-2 mt-1 tabular-nums" />
          </div>
          <div>
            <label class="text-slate-600 font-semibold" for="vm-field-2">Kode SKU</label>
            <input id="vm-field-2" type="text" bind:value={form.sku} on:input={() => isSkuTouched = true} placeholder="Otomatis dari nama produk" class="w-full bg-white border border-slate-300 text-slate-900 rounded-xl px-3 py-2 mt-1 tabular-nums " />
          </div>
        </div>
        <div>
          <label class="text-slate-600 font-semibold" for="vm-field-3">Nama Produk</label>
          <input id="vm-field-3" type="text" bind:value={form.name} on:input={handleNameInput} placeholder="Contoh: Indomie Goreng Spesial 85g" class="w-full bg-white border border-slate-300 text-slate-900 rounded-xl px-3 py-2 mt-1" />
        </div>
        <div>
          <label class="text-slate-600 font-semibold" for="vm-field-4">Kategori</label>
          <select id="vm-field-4" bind:value={form.categoryId} on:change={handleCategoryChange} class="w-full bg-white border border-slate-300 text-slate-900 rounded-xl px-3 py-2 mt-1">
            {#each categories as cat}
              <option value={cat.id}>{cat.code} — {cat.name}</option>
            {/each}
          </select>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-slate-600 font-semibold" for="vm-field-5">Harga Modal (HPP)</label>
            <input id="vm-field-5" type="number" bind:value={form.costPrice} class="w-full bg-white border border-slate-300 text-slate-900 rounded-xl px-3 py-2 mt-1" />
          </div>
          <div>
            <label class="text-slate-600 font-semibold" for="vm-field-6">Harga Jual</label>
            <input id="vm-field-6" type="number" bind:value={form.sellPrice} class="w-full bg-white border border-slate-300 text-slate-900 rounded-xl px-3 py-2 mt-1" />
          </div>
        </div>
        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="text-slate-600 font-semibold" for="vm-field-7">Stok Awal</label>
            <input id="vm-field-7" type="number" bind:value={form.stock} class="w-full bg-white border border-slate-300 text-slate-900 rounded-xl px-3 py-2 mt-1" />
          </div>
          <div>
            <label class="text-slate-600 font-semibold" for="vm-field-8">Satuan (Unit)</label>
            <input id="vm-field-8" type="text" bind:value={form.unit} class="w-full bg-white border border-slate-300 text-slate-900 rounded-xl px-3 py-2 mt-1" />
          </div>
          <div>
            <label class="text-slate-600 font-semibold" for="vm-field-9">Alert Stok Min</label>
            <input id="vm-field-9" type="number" bind:value={form.minStockAlert} placeholder="5" class="w-full bg-white border border-slate-300 text-slate-900 rounded-xl px-3 py-2 mt-1" />
          </div>
        </div>
        <div>
          <p class="text-slate-600 font-semibold">Foto Produk (Opsional)</p>
          <div class="mt-1 flex items-center gap-3">
            <!-- Preview -->
            <div class="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0">
              {#if form.imageUrl}
                <img src={form.imageUrl} alt="preview" class="w-full h-full object-cover" />
              {:else}
                <Package class="w-6 h-6 text-slate-300" />
              {/if}
            </div>
            <!-- Upload button -->
            <div class="flex-1">
              <label class="cursor-pointer flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-slate-300 hover:border-sky-400 rounded-xl text-slate-500 hover:text-sky-600 transition-colors {isUploading ? 'opacity-50 pointer-events-none' : ''}">
                {#if isUploading}
                  <span class="inline-block w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></span>
                  <span class="text-xs">Mengupload...</span>
                {:else}
                  <Upload class="w-4 h-4" />
                  <span class="text-xs font-semibold">{form.imageUrl ? 'Ganti Foto' : 'Upload Foto'}</span>
                {/if}
                <input type="file" accept="image/jpeg,image/png,image/webp" class="hidden" on:change={handleFileSelect} />
              </label>
              <p class="text-xs text-slate-500 mt-1">JPG, PNG, WEBP · Maks. 2MB</p>
              {#if uploadError}
                <p class="text-xs text-red-500 mt-1">{uploadError}</p>
              {/if}
              {#if form.imageUrl}
                <button type="button" on:click={() => form.imageUrl = ''} class="text-xs text-red-400 hover:text-red-600 mt-1">Hapus foto</button>
              {/if}
            </div>
          </div>
        </div>
      </div>

      <button on:click={saveProduct} disabled={isSaving || isUploading} class="w-full py-3 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-xs    ">
        {isSaving ? 'MENYIMPAN...' : 'SIMPAN PRODUK'}
      </button>
    </div>
  </div>
{/if}
