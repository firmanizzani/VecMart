<script lang="ts">
  import ProductImage from '$lib/components/ProductImage.svelte';
  import { dialog } from '$lib/actions/dialog';
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/authStore';
  import {
    cartItems,
    addToCart,
    updateQuantity,
    clearCart,
    holdCurrentCart,
    resumeCart,
    heldCartsStore,
    subtotal,
    discountTotal,
    grandTotal,
    shiftStore,
    appliedPromo,
    memberPointDiscount
  } from '$lib/stores/posStore';
  import ThermalReceipt from '$lib/components/ThermalReceipt.svelte';
  import {
    Search,
    Barcode,
    Plus,
    Minus,
    Trash2,
    PauseCircle,
    PlayCircle,
    CreditCard,
    DollarSign,
    QrCode,
    Printer,
    Clock,
    UserCheck,
    Tag,
    X,
    CheckCircle2,
    Coins,
    Package,
    ShoppingBag,
    ChevronRight
  } from 'lucide-svelte';

  let showMobileCart = false;
  let isLoadingProducts = true;
  let catalogError = '';
  let searchInput: HTMLInputElement;
  let barcodeField: HTMLInputElement;
  let holdName = '';
  let showHoldName = false;
  let searchQuery = '';
  let selectedCategory = 'All';
  let barcodeInput = '';
  let showPaymentModal = false;
  let showHoldModal = false;
  let showShiftModal = false;
  let showReceiptModal = false;
  let showSessionRequiredModal = false; // Modal blokir bayar jika sesi belum aktif


  let paidAmount = 0;
  let paymentMethod = 'CASH';
  let holdLabel = '';
  let promoInput = '';

  let lastCompletedTransaction: any = null;

  // Member & Loyalty State
  let members: any[] = [];
  let selectedMemberId: string = '';
  let redeemPointsInput: number = 0;
  let isUsingPointDiscount = false;
  let showAddMemberModal = false;
  let newMemberForm = { name: '', phone: '' };
  let isRegisteringMember = false;

  $: selectedMember = members.find((m) => m.id === selectedMemberId);

  // Perhitungan Poin: 0,5% dari total belanja = 5 Poin per Rp 1.000 belanja
  $: earnedPoints = $grandTotal > 0 ? Math.floor(($grandTotal * 0.005)) : 0;

  function toggleRedeemPoints() {
    if (!selectedMember) return;
    if (isUsingPointDiscount) {
      isUsingPointDiscount = false;
      redeemPointsInput = 0;
      memberPointDiscount.set(0);
    } else {
      if ((selectedMember.points || 0) <= 0) {
        alert('Member belum memiliki poin untuk ditukarkan!');
        return;
      }
      isUsingPointDiscount = true;
      // Max points to redeem is member's total points or subtotal amount
      redeemPointsInput = Math.min(selectedMember.points, $subtotal);
      memberPointDiscount.set(redeemPointsInput);
    }
  }

  function onRedeemPointsChange() {
    if (!selectedMember) return;
    const maxVal = Math.min(selectedMember.points || 0, $subtotal);
    if (redeemPointsInput > maxVal) {
      redeemPointsInput = maxVal;
    }
    if (redeemPointsInput < 0) redeemPointsInput = 0;
    memberPointDiscount.set(redeemPointsInput);
  }

  // Sync Active Shift from Backend for logged in user
  let activeSyncUserId = '';
  async function syncActiveShift(user: any) {
    if (!user || !user.id || activeSyncUserId === user.id) return;
    activeSyncUserId = user.id;
    try {
      const res = await fetch(`/api/cashier/shift/active?userId=${user.id}`).then(r => r.json());
      if (res?.success && res.data) {
        const s = res.data;
        shiftStore.set({
          isClockedIn: s.status === 'open',
          shiftId: s.id,
          cashierId: user.id,
          cashierName: user.name,
          startingCash: Number(s.startingCash || 0),
          salesCash: Number(s.salesCash || 0),
          withdrawalsTotal: Number(s.withdrawalsTotal || 0),
          withdrawalsHistory: s.withdrawalsHistory || [],
          clockInTime: s.clockIn
        });
      } else {
        shiftStore.set({
          isClockedIn: false,
          shiftId: null,
          cashierId: user.id,
          cashierName: user.name,
          startingCash: 0,
          salesCash: 0,
          withdrawalsTotal: 0,
          withdrawalsHistory: [],
          clockInTime: null
        });
      }
    } catch (e) {
      console.warn('Failed to sync active shift', e);
    }
  }

  $: if ($authStore) {
    syncActiveShift($authStore);
  }

  // Promo Code State
  let promos: any[] = [];

  // Shift & Cash Drawer State
  let clockOutActualCash: number | undefined = undefined;
  let isClockingOut = false;

  // Owner Cash Drop State
  let withdrawAmount: number | undefined = undefined;
  let withdrawNotes: string = '';
  let isWithdrawing = false;

  // Editable Starting Cash State
  let newStartingCashInput: number = 200000;
  let isEditingStartingCash = false;

  async function handleUpdateStartingCash() {
    if (newStartingCashInput < 0) {
      alert('Kas awal tidak boleh negatif!');
      return;
    }
    try {
      const res = await fetch('/api/cashier/shift/starting-cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId: $shiftStore.shiftId,
          startingCash: Number(newStartingCashInput)
        })
      }).then(r => r.json());

      if (res?.success) {
        shiftStore.update(s => ({ ...s, startingCash: Number(newStartingCashInput) }));
        isEditingStartingCash = false;
        alert(`Kas Awal Laci berhasil diperbarui menjadi ${formatRp(newStartingCashInput)}!`);
      } else {
        alert('Gagal memperbarui kas awal: ' + (res?.message || 'Error'));
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  }

  async function handleOwnerWithdrawal() {
    if (!withdrawAmount || withdrawAmount <= 0) {
      alert('Masukkan nominal uang fisik yang diambil owner!');
      return;
    }
    isWithdrawing = true;
    try {
      const res = await fetch('/api/cashier/shift/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId: $shiftStore.shiftId || 'shift-1002',
          amount: Number(withdrawAmount),
          notes: withdrawNotes || 'Diambil Owner',
          withdrawnBy: 'Owner'
        })
      }).then(r => r.json());

      if (res?.success) {
        shiftStore.update(s => ({
          ...s,
          withdrawalsTotal: res.data?.totalWithdrawals ?? ((s.withdrawalsTotal || 0) + Number(withdrawAmount)),
          withdrawalsHistory: res.data?.withdrawalsHistory ?? s.withdrawalsHistory
        }));
        alert(`Berhasil! Uang fisik yang diambil owner sebesar ${formatRp(withdrawAmount)} telah dicatat.\nEkspektasi fisik laci telah disesuaikan.`);
        withdrawAmount = undefined;
        withdrawNotes = '';
      } else {
        alert('Gagal mencatat pengambilan owner: ' + (res?.message || 'Error'));
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      isWithdrawing = false;
    }
  }

  async function handleCancelWithdrawal(withdrawalId: string, amount: number) {
    if (!confirm(`Batalkan pencatatan pengambilan uang fisik sebesar ${formatRp(amount)}?`)) return;

    try {
      const res = await fetch('/api/cashier/shift/withdraw/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId: $shiftStore.shiftId || 'shift-1002',
          withdrawalId
        })
      }).then(r => r.json());

      if (res?.success) {
        shiftStore.update(s => ({
          ...s,
          withdrawalsTotal: res.data?.totalWithdrawals ?? Math.max(0, (s.withdrawalsTotal || 0) - amount),
          withdrawalsHistory: res.data?.withdrawalsHistory ?? (s.withdrawalsHistory || []).filter(w => w.id !== withdrawalId)
        }));
        alert(`Berhasil membatalkan pengambilan owner sebesar ${formatRp(amount)}!`);
      } else {
        alert('Gagal membatalkan pengambilan: ' + (res?.message || 'Error'));
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  }

  let clockInStartingCashInput: number = 0;
  let isClockingIn = false;
  let lastCloseoutCash: number = 0;
  let isFetchingLastCash = false;

  async function fetchLastCloseoutCash() {
    isFetchingLastCash = true;
    try {
      const res = await fetch('/api/cashier/shifts').then(r => r.json());
      if (res?.success && Array.isArray(res.data)) {
        const closed = res.data.find((s: any) => s.status === 'closed');
        if (closed) {
          lastCloseoutCash = Number(closed.actualCash || closed.expectedCash || 0);
          clockInStartingCashInput = lastCloseoutCash;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch last closeout cash', e);
    } finally {
      isFetchingLastCash = false;
    }
  }

  async function handleClockIn() {
    isClockingIn = true;
    try {
      const res = await fetch('/api/cashier/shift/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cashierId: $authStore?.id || 'user-kasir-1',
          startingCash: Number(clockInStartingCashInput || 0)
        })
      }).then(r => r.json());

      if (res?.success && res.data) {
        const s = res.data;
        shiftStore.set({
          isClockedIn: true,
          shiftId: s.id,
          cashierId: s.userId,
          cashierName: s.cashierName || $authStore?.name || 'Kasir',
          startingCash: Number(s.startingCash || 0),
          salesCash: 0,
          withdrawalsTotal: 0,
          withdrawalsHistory: [],
          clockInTime: s.clockIn
        });
        alert(`Shift Berhasil Dimulai! (${s.id})\nKas Awal Laci: ${formatRp(Number(s.startingCash || 0))}`);
        showShiftModal = false;
      } else {
        alert('Gagal memulai shift: ' + (res?.message || 'Error'));
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      isClockingIn = false;
    }
  }

  async function handleClockOut() {
    if (!clockOutActualCash || clockOutActualCash < 0) {
      alert('Masukkan total nominal uang fisik di laci terlebih dahulu!');
      return;
    }
    isClockingOut = true;
    try {
      const res = await fetch('/api/cashier/shift/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId: $shiftStore.shiftId || 'shift-1001',
          startingCash: $shiftStore.startingCash,
          totalSalesCash: $shiftStore.salesCash || 0,
          totalWithdrawals: $shiftStore.withdrawalsTotal || 0,
          actualCash: Number(clockOutActualCash)
        })
      }).then(r => r.json());

      if (res?.success) {
        const diff = res.data?.difference ?? 0;
        const diffMsg = diff === 0 ? 'Uang Laci IMPAS (Pas 100%)' : (diff > 0 ? `Uang Laci LEBIH +${formatRp(diff)}` : `Uang Laci KURANG ${formatRp(diff)}`);
        
        // Reset shiftStore to unclocked state
        shiftStore.set({
          isClockedIn: false,
          shiftId: null,
          cashierId: null,
          cashierName: '',
          startingCash: 0,
          salesCash: 0,
          withdrawalsTotal: 0,
          withdrawalsHistory: [],
          clockInTime: null
        });

        alert(`Shift Berhasil Ditutup & Selesai! (CLOSED)\nRekap Audit: ${diffMsg}\n\nStatus: Shift telah dihentikan.`);
        clockOutActualCash = undefined;
        showShiftModal = false;
      } else {
        alert('Gagal menutup shift: ' + (res?.message || 'Error'));
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      isClockingOut = false;
    }
  }

  async function applyPromoCode() {
    if (!promoInput) return;
    const codeUpper = promoInput.trim().toUpperCase();

    let found = promos.find((p) => p.code.toUpperCase() === codeUpper && p.status === 'ACTIVE');

    if (!found) {
      try {
        const res = await fetch('/api/promos').then((r) => r.json());
        if (res?.success && Array.isArray(res.data)) {
          promos = res.data;
          found = promos.find((p: any) => p.code.toUpperCase() === codeUpper && p.status === 'ACTIVE');
        }
      } catch (e) {}
    }

    if (!found) {
      alert('Kode promo tidak valid atau tidak ditemukan!');
      return;
    }

    // Validasi Hari Khusus untuk promo JUMAT
    const isFridayPromo = found.code.includes('JUMAT') || found.title.toUpperCase().includes('JUMAT');
    const todayDay = new Date().getDay(); // 5 = Friday
    if (isFridayPromo && todayDay !== 5) {
      const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      alert(`Gagal! Kode promo "${found.code}" khusus berlaku di hari JUMAT.\nHari ini adalah hari ${dayNames[todayDay]}.`);
      return;
    }

    if ($subtotal < (found.minPurchase || 0)) {
      alert(`Minimal belanja untuk promo ini adalah ${formatRp(found.minPurchase)}`);
      return;
    }

    const isPercent = found.value.includes('%') || found.type === 'PERCENTAGE';
    const numericVal = Number(found.value.replace(/[^0-9]/g, '')) || 0;

    appliedPromo.set({
      code: found.code,
      title: found.title,
      type: isPercent ? 'percentage' : 'fixed',
      value: numericVal
    });

    promoInput = '';
  }

  function removePromo() {
    appliedPromo.set(null);
  }

  interface ProductItem {
    id: string;
    barcode: string;
    name: string;
    category: string;
    costPrice?: number;
    sellPrice: number;
    stock: number;
    image?: string;
    imageUrl?: string;
  }

  import { api } from '$lib/api/eden';

  // Minimarket Database (Fetched from API)
  let products: ProductItem[] = [];


  async function loadProducts() {
    isLoadingProducts = true;
    catalogError = '';
    try {
      const res = await fetch('/api/products').then(r => r.json());
      if (res?.success && Array.isArray(res.data)) {
        products = res.data.map((p: any) => ({
          id: p.id,
          barcode: p.barcode,
          name: p.name,
          category: p.categoryName || 'Lainnya',
          costPrice: Number(p.costPrice || 0),
          sellPrice: Number(p.sellPrice),
          stock: Number(p.stock),
          image: '',
          imageUrl: p.imageUrl
        }));
      } else { throw new Error('Produk tidak dapat dimuat.'); }
    } catch (e) {
      catalogError = 'Katalog belum dapat dimuat. Periksa koneksi lalu coba lagi.';
    } finally { isLoadingProducts = false; }
  }

  onMount(async () => {
    await loadProducts();
    try {
      const resM = await fetch('/api/members').then(r => r.json());
      if (resM?.success && Array.isArray(resM.data)) {
        members = resM.data;
      }
    } catch (e) {
      console.warn('Failed to load members', e);
    }

    try {
      const resP = await fetch('/api/promos').then(r => r.json());
      if (resP?.success && Array.isArray(resP.data)) {
        promos = resP.data;
      }
    } catch (e) {
      console.warn('Failed to load promos', e);
    }
  });

  async function registerQuickMember() {
    if (!newMemberForm.name || !newMemberForm.phone) {
      alert('Nama & No. HP wajib diisi!');
      return;
    }
    isRegisteringMember = true;
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMemberForm)
      }).then(r => r.json());

      if (res?.success && res.data) {
        members = [res.data, ...members];
        selectedMemberId = res.data.id;
        showAddMemberModal = false;
        newMemberForm = { name: '', phone: '' };
      } else {
        alert('Gagal mendaftar member: ' + (res?.message || 'Error'));
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      isRegisteringMember = false;
    }
  }

  const categories = [
    'All',
    'Mie & Makanan Instan',
    'Biskuit & Roti',
    'Camilan & Snack',
    'Air Mineral & Isotonik',
    'Minuman Kemasan & Susu',
    'Bumbu & Kebutuhan Dapur',
    'Sabun & Perawatan Tubuh',
    'Kebutuhan Kebersihan Rumah',
    'Kebutuhan Ibu & Bayi',
    'Perlengkapan Rumah Tangga'
  ];

  $: filteredProducts = products.filter((p) => {
    const matchCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchQuery = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode.includes(searchQuery);
    return matchCategory && matchQuery;
  });

  $: changeAmount = Math.max(0, paidAmount - $grandTotal);

  function handleBarcodeSubmit() {
    if (!barcodeInput) return;
    const target = products.find((p) => p.barcode === barcodeInput || p.id === barcodeInput);
    if (target) {
      addToCart(target);
      barcodeInput = '';
    } else {
      alert('Produk dengan barcode tersebut tidak ditemukan!');
    }
  }

  function handleQuickPay(amount: number) {
    paidAmount = amount;
  }

  async function processPayment() {
    if (paidAmount < $grandTotal) {
      alert('Jumlah pembayaran kurang dari total belanja!');
      return;
    }

    const trxEarnedPoints = selectedMember ? earnedPoints : 0;
    const trxRedeemedPoints = (selectedMember && isUsingPointDiscount) ? $memberPointDiscount : 0;

    // Kirim ke API untuk disimpan ke memoryStore / DB
    try {
      await fetch('/api/cashier/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId: $shiftStore.shiftId || 'shift-1002',
          cashierId: $authStore?.id || 'user-kasir-1',
          memberId: selectedMember?.id || null,
          promoCode: $appliedPromo?.code || null,
          items: $cartItems.map(i => ({
            id: i.id,
            name: i.name,
            sellPrice: i.sellPrice,
            costPrice: i.costPrice || 0,
            quantity: i.quantity,
            subtotal: i.sellPrice * i.quantity
          })),
          subtotal: $subtotal,
          discountTotal: $discountTotal,
          grandTotal: $grandTotal,
          paidAmount: paidAmount,
          paymentMethod: paymentMethod,
          earnedPoints: trxEarnedPoints,
          redeemedPoints: trxRedeemedPoints
        })
      });

      if (paymentMethod === 'CASH') {
        shiftStore.update(s => ({ ...s, salesCash: (s.salesCash || 0) + $grandTotal }));
      }

      // Update local members array points state
      if (selectedMember) {
        selectedMember.points = Math.max(0, (selectedMember.points || 0) + trxEarnedPoints - trxRedeemedPoints);
      }
    } catch (e) {
      console.warn('Gagal simpan transaksi ke API:', e);
    }

    lastCompletedTransaction = {
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      cashierName: $shiftStore.cashierName,
      memberName: selectedMember ? `${selectedMember.name} (${selectedMember.code})` : undefined,
      earnedPoints: trxEarnedPoints,
      redeemedPoints: trxRedeemedPoints,
      promoCode: $appliedPromo?.code,
      promoTitle: $appliedPromo?.title,
      items: [...$cartItems],
      subtotal: $subtotal,
      discount: $discountTotal,
      grandTotal: $grandTotal,
      paidAmount: paidAmount,
      changeAmount: changeAmount,
      paymentMethod: paymentMethod,
      timestamp: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })

    };

    showPaymentModal = false;
    showReceiptModal = true;
    clearCart();
    paidAmount = 0;
    selectedMemberId = '';
    isUsingPointDiscount = false;
    redeemPointsInput = 0;
    memberPointDiscount.set(0);
    removePromo();
  }

  function printReceipt() {
    window.print();
  }

  function formatRp(val: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  }
</script>


<svelte:window on:keydown={(e) => {
  if (e.key === 'Escape') { showMobileCart = false; showHoldName = false; }
  if (e.key === 'F2') { e.preventDefault(); searchInput?.focus(); }
  if (e.key === 'F4') { e.preventDefault(); barcodeField?.focus(); }
  if (e.key === 'F8' && $cartItems.length && !showPaymentModal && !showReceiptModal && !showHoldModal && !showShiftModal && !showAddMemberModal && !showSessionRequiredModal && !showHoldName) { e.preventDefault(); if (!$shiftStore.isClockedIn) { showSessionRequiredModal = true; return; } paidAmount = $grandTotal; showPaymentModal = true; }
}} />
<div class="pos-workspace">
  <section class="pos-catalog" aria-label="Katalog produk">
    <div class="catalog-heading"><div><h1>Kasir</h1><p>Pilih produk untuk memulai transaksi.</p></div><span class="catalog-count">{filteredProducts.length} produk</span></div>
    <div class="catalog-search-row">
      <div class="catalog-search"><Search size={18} /><input bind:this={searchInput} aria-label="Cari produk" type="search" bind:value={searchQuery} placeholder="Cari nama produk atau barcode…" /><kbd>F2</kbd></div>
      <form on:submit|preventDefault={handleBarcodeSubmit} class="barcode-search"><Barcode size={20} /><input bind:this={barcodeField} aria-label="Scan barcode lalu tekan Enter" type="text" bind:value={barcodeInput} placeholder="Scan barcode" /><kbd>F4</kbd></form>
    </div>
    <div class="catalog-categories" aria-label="Kategori produk">
      {#each categories as cat}<button on:click={() => selectedCategory = cat} class:chosen={selectedCategory === cat} aria-pressed={selectedCategory === cat}>{cat === 'All' ? 'Semua produk' : cat}</button>{/each}
    </div>
    <div class="catalog-results" aria-busy={isLoadingProducts}>
      {#if isLoadingProducts}<div class="catalog-empty" role="status"><span class="loading-wheel"></span><h2>Memuat katalog</h2><p>Menyiapkan produk toko Anda.</p></div>
      {:else if catalogError}<div class="catalog-empty" role="alert"><Package size={32} /><h2>Katalog belum tersedia</h2><p>{catalogError}</p><button class="primary-button" on:click={loadProducts}>Coba lagi</button></div>
      {:else if filteredProducts.length === 0}<div class="catalog-empty"><Search size={32} /><h2>{products.length ? 'Produk tidak ditemukan' : 'Katalog masih kosong'}</h2><p>{products.length ? 'Coba nama lain atau pilih kategori berbeda.' : 'Tambahkan produk melalui halaman admin untuk mulai berjualan.'}</p>{#if products.length}<button class="primary-button" on:click={() => { searchQuery = ''; selectedCategory = 'All'; }}>Tampilkan semua produk</button>{:else if $authStore?.role === 'admin'}<a href="/admin/produk" class="primary-button">Kelola produk</a>{/if}</div>
      {:else}<div class="product-grid">
        {#each filteredProducts as p}<button class="product-card" disabled={p.stock <= 0} on:click={() => addToCart(p)} aria-label={'Tambah ' + p.name + ', ' + formatRp(p.sellPrice)}>
          <div class="product-photo"><ProductImage src={p.imageUrl || ''} name={p.name} /><span class="product-stock" class:low={p.stock <= 5}>{p.stock <= 0 ? 'Habis' : 'Stok ' + p.stock}</span></div>
          <div class="product-info"><span class="product-category">{p.category}</span><h2>{p.name}</h2><div class="product-price"><strong>{formatRp(p.sellPrice)}</strong><span class="product-add"><Plus size={16} /></span></div></div>
        </button>{/each}
      </div>{/if}
    </div>
    <div class="catalog-footer"><span>Harga dalam rupiah</span><span class="hidden sm:inline">F2 Cari · F4 Barcode · F8 Bayar</span></div>
  </section>
  <aside class="pos-cart" class:mobile-cart-open={showMobileCart} aria-label="Keranjang transaksi">
    <div class="cart-heading"><div><h2>Transaksi berjalan</h2><span>{$cartItems.reduce((sum, item) => sum + item.quantity, 0)} barang · {$cartItems.length} jenis produk</span></div><button class="icon-button cart-close" aria-label="Tutup keranjang" on:click={() => showMobileCart = false}><X size={20} /></button></div>
    <div class="cart-tools"><button on:click={() => { showShiftModal = true; fetchLastCloseoutCash(); }}><Clock size={16} /><span>{$shiftStore.isClockedIn ? 'Kelola sesi' : 'Mulai sesi kasir'}</span><span class="tool-status" class:running={$shiftStore.isClockedIn}></span></button><button on:click={() => showHoldModal = true}><PauseCircle size={16} />Ditahan{#if $heldCartsStore.length}<span class="hold-count">{$heldCartsStore.length}</span>{/if}</button></div>
    <div class="cart-items">
      {#if !$cartItems.length}<div class="cart-empty"><ShoppingBag size={36} strokeWidth={1.25} /><h3>Belum ada belanjaan</h3><p>Pilih produk di katalog atau scan barcode untuk menambahkannya.</p></div>
      {:else}{#each $cartItems as item}<div class="cart-item"><div class="cart-item-name"><h3>{item.name}</h3><span>{formatRp(item.sellPrice)} / barang</span></div><div class="cart-item-bottom"><div class="quantity-control"><button aria-label={'Kurangi ' + item.name} on:click={() => updateQuantity(item.id, item.quantity - 1)}><Minus size={14} /></button><span>{item.quantity}</span><button aria-label={'Tambah ' + item.name} on:click={() => updateQuantity(item.id, item.quantity + 1)}><Plus size={14} /></button></div><strong>{formatRp(item.sellPrice * item.quantity)}</strong><button class="remove-item" aria-label={'Hapus ' + item.name} on:click={() => updateQuantity(item.id, 0)}><Trash2 size={15} /></button></div></div>{/each}{/if}
    </div>
    <div class="cart-checkout">
      <div class="cart-member">      <!-- Member Selector -->
      <div class="pt-2 border-t border-slate-200 space-y-1.5">
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-slate-700 flex items-center space-x-1">
            <UserCheck class="w-3.5 h-3.5 text-sky-600" />
            <span>Member Loyalitas</span>
          </p>
          <button on:click={() => showAddMemberModal = true} class="text-xs text-sky-600 font-semibold hover:underline flex items-center space-x-0.5">
            <Plus class="w-3 h-3" />
            <span>Member Baru</span>
          </button>
        </div>
        <select aria-label="Pilih member" bind:value={selectedMemberId} class="w-full bg-white border border-slate-300 text-slate-800 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-sky-600">
          <option value="">-- Non-Member (Umum) --</option>
          {#each members as m}
            <option value={m.id}>{m.name} ({m.code}) - {m.points} pts</option>
          {/each}
        </select>
        {#if selectedMember}
          <div class="space-y-1.5 bg-amber-50 border border-amber-200 rounded-xl p-2 text-xs text-amber-900">
            <div class="flex justify-between items-center font-medium">
              <span>Tier: <strong>{selectedMember.tier || 'BRONZE'}</strong> ({selectedMember.points || 0} pts)</span>
              <span class="text-emerald-700 font-semibold">+{earnedPoints} pts</span>
            </div>

            <!-- Point Redeem Box -->
            <div class="pt-1.5 border-t border-amber-200/70 flex items-center justify-between">
              <button
                type="button"
                on:click={toggleRedeemPoints}
                class="px-2 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors {isUsingPointDiscount ? 'bg-amber-600 text-white ' : 'bg-white border border-amber-300 text-amber-800 hover:bg-amber-100'}"
              >
                <Coins class="w-3 h-3" />
                <span>{isUsingPointDiscount ? 'Gunakan Poin (Aktif)' : 'Tukar Poin Diskon'}</span>
              </button>

              {#if isUsingPointDiscount}
                <div class="flex items-center space-x-1">
                  <input aria-label="Nilai"
                    type="number"
                    bind:value={redeemPointsInput}
                    on:input={onRedeemPointsChange}
                    max={Math.min(selectedMember.points || 0, $subtotal)}
                    min={0}
                    class="w-16 bg-white border border-amber-300 text-slate-900 text-right px-1.5 py-0.5 rounded text-xs tabular-nums font-semibold focus:outline-none"
                  />
                  <span class="text-xs text-amber-800 font-semibold">pts (-{formatRp($memberPointDiscount)})</span>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>

</div>
      <div class="cart-totals"><div><span>Subtotal</span><span>{formatRp($subtotal)}</span></div>{#if $discountTotal > 0}<div class="discount"><span>Diskon</span><span>−{formatRp($discountTotal)}</span></div>{/if}<div class="cart-grand-total"><span>Total bayar</span><strong>{formatRp($grandTotal)}</strong></div></div>
      <div class="checkout-actions"><button class="hold-button" disabled={!$cartItems.length} on:click={() => { holdName = ''; showHoldName = true; }} aria-label="Tahan transaksi"><PauseCircle size={19} /></button><button aria-label="Buka detail" class="primary-button pay-button" disabled={!$cartItems.length} on:click={() => { if (!$shiftStore.isClockedIn) { showSessionRequiredModal = true; return; } paidAmount = $grandTotal; showPaymentModal = true; }}><span>Bayar {formatRp($grandTotal)}</span><ChevronRight size={18} /></button></div>
    </div>
  </aside>
</div>
<button aria-label="Buka detail" class="mobile-cart-summary" on:click={() => showMobileCart = true}><span><ShoppingBag size={18} />{$cartItems.reduce((sum, item) => sum + item.quantity, 0)} barang</span><strong>{formatRp($grandTotal)}</strong><ChevronRight size={18} /></button>
{#if showHoldName}<div class="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4"><div use:dialog class="bg-white rounded-2xl p-6 w-full max-w-sm"><div class="flex items-center justify-between mb-5"><h2 class="text-lg font-semibold">Tahan transaksi</h2><button class="icon-button" aria-label="Tutup dialog" on:click={() => showHoldName = false}><X size={20} /></button></div><form on:submit|preventDefault={() => { if (holdName.trim()) { holdCurrentCart(holdName.trim()); showHoldName = false; showMobileCart = false; } }}><div class="field"><label for="hold-name">Nama atau catatan transaksi</label><input id="hold-name" bind:value={holdName} placeholder="Contoh: Belanja Bu Sari" required /></div><button class="primary-button w-full mt-5" type="submit">Simpan transaksi</button></form></div></div>{/if}
<!-- MODAL 1: PAYMENT MODAL (Light Theme) -->
{#if showPaymentModal}
  <div class="fixed inset-0 bg-slate-900/40  z-50 flex items-center justify-center p-4">
    <div use:dialog class="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 space-y-6 shadow-2xl">
      <div class="flex items-center justify-between border-b border-slate-200 pb-3">
        <h3 class="text-lg font-semibold text-slate-900 flex items-center space-x-2">
          <DollarSign class="w-5 h-5 text-emerald-600" />
          <span>Pembayaran Kasir</span>
        </h3>
        <button aria-label="Tutup dialog" on:click={() => (showPaymentModal = false)} class="text-slate-500 hover:text-slate-700">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center space-y-1">
        <span class="text-xs text-slate-500 font-semibold  ">Total Tagihan</span>
        <div class="text-3xl font-semibold text-sky-700">{formatRp($grandTotal)}</div>
        {#if $discountTotal > 0}
          <div class="text-xs text-amber-600 font-semibold mt-1">Diskon Promo: -{formatRp($discountTotal)} (Subtotal: {formatRp($subtotal)})</div>
        {/if}
      </div>

      <!-- Kode Promo Section -->
      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-slate-600 flex items-center space-x-1">
            <Tag class="w-3.5 h-3.5 text-amber-600" />
            <span>Kode Promo / Kupon Diskon</span>
          </p>
          {#if $appliedPromo}
            <button on:click={removePromo} class="text-xs text-red-600 font-semibold hover:underline">Hapus Promo</button>
          {/if}
        </div>
        {#if $appliedPromo}
          <div class="flex items-center justify-between bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-xs text-amber-900 font-semibold">
            <div class="flex items-center space-x-2">
              <Tag class="w-4 h-4 text-amber-600" />
              <span>{$appliedPromo.code} ({$appliedPromo.title})</span>
            </div>
            <span class="text-emerald-700 font-semibold">-{formatRp($discountTotal)}</span>
          </div>
        {:else}
          <div class="flex space-x-2">
            <input aria-label="Contoh: HEMAT10"
              type="text"
              bind:value={promoInput}
              placeholder="Contoh: HEMAT10"
              class="flex-1 bg-white border border-slate-300 text-slate-900 rounded-xl px-3 py-2 text-xs tabular-nums  focus:outline-none focus:border-sky-600"
            />
            <button on:click={applyPromoCode} class="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl ">
              PAKAI PROMO
            </button>
          </div>
        {/if}
      </div>

      <!-- Payment Method Selection -->
      <div class="space-y-2">
        <p class="text-xs font-semibold text-slate-600">Metode Pembayaran</p>
        <div class="grid grid-cols-3 gap-2">
          <button
            on:click={() => (paymentMethod = 'CASH')}
            class="py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-2 transition-colors {paymentMethod === 'CASH' ? 'bg-sky-600 border-sky-600 text-white ' : 'bg-slate-50 border-slate-200 text-slate-600'}"
          >
            <DollarSign class="w-4 h-4" />
            <span>TUNAI</span>
          </button>
          <button
            on:click={() => (paymentMethod = 'QRIS')}
            class="py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-2 transition-colors {paymentMethod === 'QRIS' ? 'bg-sky-600 border-sky-600 text-white ' : 'bg-slate-50 border-slate-200 text-slate-600'}"
          >
            <QrCode class="w-4 h-4" />
            <span>QRIS</span>
          </button>
          <button
            on:click={() => (paymentMethod = 'DEBIT')}
            class="py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-2 transition-colors {paymentMethod === 'DEBIT' ? 'bg-sky-600 border-sky-600 text-white ' : 'bg-slate-50 border-slate-200 text-slate-600'}"
          >
            <CreditCard class="w-4 h-4" />
            <span>DEBIT</span>
          </button>
        </div>
      </div>

      <!-- Quick Cash Buttons -->
      {#if paymentMethod === 'CASH'}
        <div class="space-y-2">
          <p class="text-xs font-semibold text-slate-600">Uang Pas & Quick Cash</p>
          <div class="grid grid-cols-4 gap-2">
            <button on:click={() => handleQuickPay($grandTotal)} class="py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl border border-emerald-200">Uang Pas</button>
            <button on:click={() => handleQuickPay(20000)} class="py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200">Rp 20.000</button>
            <button on:click={() => handleQuickPay(50000)} class="py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200">Rp 50.000</button>
            <button on:click={() => handleQuickPay(100000)} class="py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200">Rp 100.000</button>
          </div>

          <div class="pt-2">
            <label class="text-xs font-semibold text-slate-600" for="vm-field-1">Nominal Diterima (Rp)</label>
            <input id="vm-field-1"
              type="number"
              bind:value={paidAmount}
              class="w-full bg-white border border-slate-300 text-slate-900 text-lg tabular-nums font-semibold rounded-xl px-4 py-2.5 mt-1 focus:outline-none focus:border-sky-600 "
            />
          </div>

          <div class="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200 text-sm">
            <span class="text-slate-600 font-semibold">Kembalian</span>
            <span class="text-emerald-600 font-semibold text-lg">{formatRp(changeAmount)}</span>
          </div>
        </div>
      {:else if paymentMethod === 'QRIS'}
        <!-- Dynamic QRIS QR Code Display -->
        <div class="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center flex flex-col items-center justify-center space-y-3">
          <div class="bg-white p-3 rounded-2xl border border-slate-200 ">
            <img
              src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=00020101021126580014ID.GO.QRIS.WWW01189360091100000000005204581253033605802ID5913POS%20MINIMARKET6007JAKARTA6304ABCD"
              alt="QRIS Code"
              class="w-44 h-44 object-contain"
            />
          </div>
          <div>
            <span class="text-xs font-semibold text-slate-700   block">Scan QRIS Semua Pembayaran</span>
            <p class="text-xs text-slate-500 mt-0.5">Gopay, OVO, ShopeePay, DANA, BCA Mobile, Mandiri LIVIN, dll.</p>
          </div>
        </div>
      {:else if paymentMethod === 'DEBIT'}
        <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center space-y-2">
          <CreditCard class="w-10 h-10 text-sky-600 mx-auto" />
          <p class="text-xs font-semibold text-slate-700">Gesek / Dip Kartu pada Mesin EDC</p>
          <p class="text-xs text-slate-500">BCA, Mandiri, BRI, BNI, dll.</p>
        </div>
      {/if}

      <button
        on:click={processPayment}
        class="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl   transition-colors flex items-center justify-center space-x-2"
      >
        <CheckCircle2 class="w-5 h-5" />
        <span>KONFIRMASI TRANSAKSI</span>
      </button>
    </div>
  </div>
{/if}

<!-- MODAL 2: RECEIPT MODAL -->
{#if showReceiptModal && lastCompletedTransaction}
  <div class="fixed inset-0 bg-slate-900/50  z-50 flex items-center justify-center p-4">
    <div use:dialog class="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full space-y-4 text-center shadow-2xl">
      <div class="text-emerald-600 flex flex-col items-center space-y-1">
        <CheckCircle2 class="w-12 h-12" />
        <h3 class="text-lg font-semibold text-slate-900">Transaksi Berhasil!</h3>
      </div>

      <!-- Thermal Printable Receipt Preview -->
      <div class="flex justify-center my-4 overflow-hidden rounded-xl border border-slate-200 ">
        <ThermalReceipt
          invoiceNumber={lastCompletedTransaction.invoiceNumber}
          cashierName={lastCompletedTransaction.cashierName}
          memberName={lastCompletedTransaction.memberName}
          earnedPoints={lastCompletedTransaction.earnedPoints}
          promoCode={lastCompletedTransaction.promoCode}
          items={lastCompletedTransaction.items}
          subtotal={lastCompletedTransaction.subtotal}
          discount={lastCompletedTransaction.discount}
          grandTotal={lastCompletedTransaction.grandTotal}
          paidAmount={lastCompletedTransaction.paidAmount}
          changeAmount={lastCompletedTransaction.changeAmount}
          paymentMethod={lastCompletedTransaction.paymentMethod}
        />
      </div>

      <div class="grid grid-cols-2 gap-3 pt-2">
        <button on:click={printReceipt} class="py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl flex items-center justify-center space-x-2 ">
          <Printer class="w-4 h-4" />
          <span>Cetak struk</span>
        </button>
        <button aria-label="Tutup dialog" on:click={() => (showReceiptModal = false)} class="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl border border-slate-200">
          <span>Tutup</span>
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- MODAL 3: HOLD CARTS DRAWER -->
{#if showHoldModal}
  <div class="fixed inset-0 bg-slate-900/40  z-50 flex items-center justify-center p-4">
    <div use:dialog class="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
      <div class="flex justify-between items-center border-b border-slate-200 pb-3">
        <h3 class="text-lg font-semibold text-slate-900 flex items-center space-x-2">
          <PauseCircle class="w-5 h-5 text-amber-600" />
          <span>Daftar Transaksi Ditunda (Hold)</span>
        </h3>
        <button aria-label="Tutup dialog" on:click={() => (showHoldModal = false)} class="text-slate-500 hover:text-slate-700">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="space-y-2 max-h-96 overflow-y-auto">
        {#if $heldCartsStore.length === 0}
          <p class="text-sm text-slate-500 text-center py-6">Tidak ada keranjang yang ditunda.</p>
        {:else}
          {#each $heldCartsStore as hold}
            <div class="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between">
              <div>
                <h4 class="text-sm font-semibold text-slate-900">{hold.label}</h4>
                <p class="text-xs text-slate-500">{hold.timestamp} • {hold.items.length} item</p>
              </div>
              <button
                on:click={() => {
                  resumeCart(hold.id);
                  showHoldModal = false;
                }}
                class="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg flex items-center space-x-1"
              >
                <PlayCircle class="w-4 h-4" />
                <span>LANJUTKAN</span>
              </button>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- MODAL 4: CASHIER SHIFT MANAGEMENT -->
{#if showShiftModal}
  <div class="fixed inset-0 bg-slate-900/40  z-50 flex items-center justify-center p-4">
    <div use:dialog class="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
      
      <!-- Header -->
      <div class="flex justify-between items-center border-b border-slate-200 pb-3">
        <div>
          <h3 class="text-base font-semibold text-slate-900 flex items-center space-x-2">
            <Clock class="w-4 h-4 text-sky-600" />
            <span>Manajemen Shift Kasir</span>
          </h3>
          <p class="text-xs text-slate-500 mt-0.5">Kasir: <span class="font-semibold text-slate-700">{$authStore?.name || 'Kasir'}</span></p>
        </div>
        <button aria-label="Tutup dialog" on:click={() => (showShiftModal = false)} class="text-slate-500 hover:text-slate-700 p-1">
          <X class="w-5 h-5" />
        </button>
      </div>

      {#if !$shiftStore.isClockedIn}
        <!-- Form Mulai Shift Kasir -->
        <div class="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl space-y-3">
          <div class="flex items-center space-x-2 text-emerald-900 font-semibold text-sm">
            <PlayCircle class="w-5 h-5 text-emerald-600" />
            <span>Mulai Shift Kasir Baru</span>
          </div>

          <div class="bg-white border border-emerald-200 rounded-xl p-3 space-y-1">
            <p class="text-xs text-slate-500  font-semibold ">Kas Awal Laci (dari closeout terakhir)</p>
            {#if isFetchingLastCash}
              <p class="text-xs text-slate-500 ">Mengambil data closeout terakhir...</p>
            {:else}
              <p class="text-xl font-semibold text-emerald-700 tabular-nums">{formatRp(clockInStartingCashInput)}</p>
              {#if lastCloseoutCash > 0}
                <p class="text-xs text-slate-500">Otomatis dari saldo laci closeout terakhir</p>
              {:else}
                <p class="text-xs text-amber-500">Belum ada riwayat closeout — kas awal = Rp 0</p>
              {/if}
            {/if}
          </div>

          <div class="space-y-1">
            <label class="text-xs font-semibold text-slate-600" for="vm-field-2">Ubah manual jika perlu (opsional):</label>
            <input id="vm-field-2"
              type="number"
              bind:value={clockInStartingCashInput}
              placeholder="Masukkan Kas Awal"
              class="w-full bg-white border border-slate-300 text-slate-900 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-600 tabular-nums font-semibold "
            />
          </div>

          <button
            on:click={handleClockIn}
            disabled={isClockingIn}
            class="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs     transition-colors flex items-center justify-center space-x-2"
          >
            <PlayCircle class="w-4 h-4" />
            <span>{isClockingIn ? 'MEMULAI SHIFT...' : 'MULAI SHIFT SEKARANG'}</span>
          </button>
        </div>

      {:else}
        <!-- Ringkasan Shift Aktif -->
        <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 text-xs text-slate-700">
          <div class="flex justify-between items-center">
            <span class="text-slate-500 font-medium">Shift ID:</span>
            <div class="flex items-center space-x-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span class="font-semibold text-sky-800 tabular-nums px-2.5 py-1 bg-sky-100/80 border border-sky-200 rounded-xl shadow-xs">{$shiftStore.shiftId}</span>
            </div>
          </div>
          <div class="flex justify-between items-center border-t border-slate-200 pt-2">
            <span class="text-slate-500 font-medium">Kas Awal Laci:</span>
            <div class="flex items-center space-x-1">
              {#if isEditingStartingCash}
                <input aria-label="Nilai"
                  type="number"
                  bind:value={newStartingCashInput}
                  class="w-24 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs tabular-nums font-semibold focus:outline-none focus:border-sky-600"
                />
                <button on:click={handleUpdateStartingCash} class="px-2 py-1 bg-emerald-600 text-white font-semibold rounded-lg text-xs">Simpan</button>
              {:else}
                <span class="font-semibold text-emerald-700">{formatRp($shiftStore.startingCash)}</span>
                <button on:click={() => { newStartingCashInput = $shiftStore.startingCash; isEditingStartingCash = true; }} class="text-xs text-sky-600 font-semibold underline hover:text-sky-800 ml-1">Ubah</button>
              {/if}
            </div>
          </div>
          <div class="flex justify-between items-center border-t border-slate-200 pt-2">
            <span class="text-slate-500 font-medium">Penjualan Tunai (+):</span>
            <span class="font-semibold text-sky-700">{formatRp($shiftStore.salesCash || 0)}</span>
          </div>
          {#if ($shiftStore.withdrawalsTotal || 0) > 0}
          <div class="flex justify-between items-center border-t border-slate-200 pt-2">
            <span class="text-slate-500 font-medium">Diambil Owner (-):</span>
            <span class="font-semibold text-red-600">-{formatRp($shiftStore.withdrawalsTotal || 0)}</span>
          </div>
          {/if}
          <div class="flex justify-between items-center border-t-2 border-slate-300 pt-2">
            <span class="font-semibold text-slate-700">Ekspektasi Uang Laci:</span>
            <span class="font-extrabold text-slate-900 tabular-nums text-sm">{formatRp(($shiftStore.startingCash || 0) + ($shiftStore.salesCash || 0) - ($shiftStore.withdrawalsTotal || 0))}</span>
          </div>
        </div>

        <!-- Owner Withdrawal Section -->
        <div class="border border-amber-200 rounded-2xl overflow-hidden">
          <div class="bg-amber-50 px-4 py-2.5 flex items-center space-x-2 border-b border-amber-200">
            <Coins class="w-4 h-4 text-amber-600" />
            <span class="text-xs font-semibold text-amber-800">Penarikan Tunai oleh Owner</span>
          </div>
          <div class="p-3 space-y-2">
            <div class="flex space-x-2">
              <input aria-label="Nominal yang diambil (Rp)"
                type="number"
                bind:value={withdrawAmount}
                placeholder="Nominal yang diambil (Rp)"
                class="flex-1 bg-white border border-slate-300 text-slate-900 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500 tabular-nums font-semibold "
              />
            </div>
            <input aria-label="Catatan (opsional, contoh: Setoran harian)"
              type="text"
              bind:value={withdrawNotes}
              placeholder="Catatan (opsional, contoh: Setoran harian)"
              class="w-full bg-white border border-slate-300 text-slate-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500 "
            />
            <button
              on:click={handleOwnerWithdrawal}
              disabled={isWithdrawing || !withdrawAmount || withdrawAmount <= 0}
              class="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-semibold rounded-xl text-xs    transition-colors flex items-center justify-center space-x-2"
            >
              <Coins class="w-4 h-4" />
              <span>{isWithdrawing ? 'MENCATAT...' : 'CATAT PENGAMBILAN OWNER'}</span>
            </button>

            {#if ($shiftStore.withdrawalsHistory || []).length > 0}
              <div class="space-y-1 mt-1">
                <p class="text-xs font-semibold text-slate-500 ">Riwayat Penarikan:</p>
                {#each ($shiftStore.withdrawalsHistory || []) as w}
                  <div class="flex justify-between items-center bg-amber-50 px-3 py-1.5 rounded-lg text-xs">
                    <div>
                      <span class="font-semibold text-slate-800">{formatRp(w.amount)}</span>
                      <span class="text-slate-500 ml-1">— {w.notes || 'Diambil Owner'}</span>
                    </div>
                    <button on:click={() => handleCancelWithdrawal(w.id, w.amount)} class="text-red-500 hover:text-red-700 font-semibold text-xs">Batal</button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <!-- Clock-Out Section -->
        <div class="space-y-2 border-t border-slate-200 pt-3">
          <h4 class="text-xs font-semibold text-slate-700  ">Stop Shift & Rekap Laci</h4>
          <label class="text-xs text-slate-600 font-medium" for="vm-field-3">Hitung total uang fisik di laci saat ini:</label>
          <input id="vm-field-3"
            type="number"
            bind:value={clockOutActualCash}
            placeholder="Total uang fisik di laci (Rp)"
            class="w-full bg-white border border-slate-300 text-slate-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-400 tabular-nums font-semibold "
          />
          <button
            on:click={handleClockOut}
            disabled={isClockingOut}
            class="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs     transition-colors"
          >
            {isClockingOut ? 'PROSES CLOCK-OUT...' : 'STOP SHIFT & HENTIKAN KASIR'}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- MODAL 5: QUICK MEMBER REGISTRATION -->
{#if showAddMemberModal}
  <div class="fixed inset-0 bg-slate-900/40  z-50 flex items-center justify-center p-4">
    <div use:dialog class="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
      <div class="flex justify-between items-center border-b border-slate-200 pb-3">
        <h3 class="text-base font-semibold text-slate-900 flex items-center space-x-2">
          <UserCheck class="w-5 h-5 text-sky-600" />
          <span>Registrasi Member Baru</span>
        </h3>
        <button aria-label="Tutup dialog" on:click={() => showAddMemberModal = false} class="text-slate-500 hover:text-slate-700">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="space-y-3 text-xs">
        <div>
          <label class="text-slate-600 font-semibold" for="vm-field-4">Nama Lengkap Member</label>
          <input id="vm-field-4" type="text" bind:value={newMemberForm.name} placeholder="Contoh: Budi Santoso" class="w-full bg-white border border-slate-300 text-slate-900 rounded-xl px-3 py-2 mt-1 focus:outline-none focus:border-sky-600" />
        </div>
        <div>
          <label class="text-slate-600 font-semibold" for="vm-field-5">No. Telepon / WhatsApp</label>
          <input id="vm-field-5" type="text" bind:value={newMemberForm.phone} placeholder="081234567890" class="w-full bg-white border border-slate-300 text-slate-900 rounded-xl px-3 py-2 mt-1 tabular-nums focus:outline-none focus:border-sky-600" />
        </div>
      </div>

      <button on:click={registerQuickMember} disabled={isRegisteringMember} class="w-full py-3 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs    ">
        {isRegisteringMember ? 'MENDAFTARKAN...' : 'DAFTARKAN & PILIH MEMBER'}
      </button>
    </div>
  </div>
{/if}

<!-- MODAL 6: SESI BELUM AKTIF — Blokir Pembayaran -->
{#if showSessionRequiredModal}
  <div class="fixed inset-0 bg-slate-900/60  z-[60] flex items-center justify-center p-4">
    <div use:dialog class="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-6 space-y-5 shadow-2xl text-center">
      
      <!-- Icon & Judul -->
      <div class="flex flex-col items-center space-y-3">
        <div class="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center border-4 border-amber-200">
          <Clock class="w-8 h-8 text-amber-600" />
        </div>
        <div>
          <h3 class="text-lg font-semibold text-slate-900">Sesi Belum Aktif!</h3>
          <p class="text-xs text-slate-500 mt-1">Kasir tidak dapat memproses pembayaran sebelum mengaktifkan sesi shift.</p>
        </div>
      </div>

      <!-- Info Box -->
      <div class="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left space-y-2">
        <p class="text-xs font-semibold text-amber-800 flex items-center space-x-1.5">
          <span class="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
          <span>Kenapa perlu aktifkan sesi?</span>
        </p>
        <ul class="text-xs text-amber-700 space-y-1 ml-3.5 list-disc">
          <li>Setiap transaksi harus terikat ke shift kasir yang aktif</li>
          <li>Untuk keperluan audit & laporan keuangan harian</li>
          <li>Pastikan kas awal laci sudah disiapkan sebelum mulai</li>
        </ul>
      </div>

      <!-- Tombol Aksi -->
      <div class="space-y-2">
        <button
          on:click={() => {
            showSessionRequiredModal = false;
            showShiftModal = true;
            fetchLastCloseoutCash();
          }}
          class="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl text-sm   transition-colors flex items-center justify-center space-x-2"
        >
          <PlayCircle class="w-5 h-5" />
          <span>AKTIFKAN SESI SEKARANG</span>
        </button>

        <button
          aria-label="Tutup dialog" on:click={() => (showSessionRequiredModal = false)}
          class="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-xl text-sm border border-slate-200 transition-colors"
        >
          Batal
        </button>
      </div>

      <p class="text-xs text-slate-500">
        Hubungi supervisor jika ada kendala dalam memulai sesi
      </p>
    </div>
  </div>
{/if}
