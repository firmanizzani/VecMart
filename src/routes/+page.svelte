<script lang="ts">
  import Brand from '$lib/components/Brand.svelte';
  import LandingAssistantDemo from '$lib/components/LandingAssistantDemo.svelte';
  import { landingSales, landingSalesHours } from '$lib/data/landing-sales';
  import { onMount } from 'svelte';
  import { ArrowRight, ArrowUpRight, Check, ChevronDown, Minus, Plus, Signal, Wifi, BatteryFull } from 'lucide-svelte';
  import { authStore } from '$lib/stores/authStore';
  import '$lib/styles/landing.css';
  type Preview = 'kasir' | 'stok' | 'laporan';
  let preview: Preview = 'kasir';
  let quantity = 2;
  let navScrolled = false;
  const syncNavigation = () => { navScrolled = window.scrollY > 24; };
  function openAssistantAccess() {
    const details = document.getElementById('akses-asisten');
    if (details instanceof HTMLDetailsElement) {
      details.open = true;
      details.querySelector('summary')?.focus({preventScroll: true});
    }
  }
  const money = (value: number) => 'Rp ' + value.toLocaleString('id-ID');
  const products = [
    { name: 'Indomie Soto Mie', detail: '70 gr', image: '/landing/indomie-soto.png', price: 3400, stock: 126 },
    { name: 'Le Minerale', detail: '600 ml', image: '/landing/le-minerale.jpg', price: 3500, stock: 118 },
    { name: 'Ultra Milk Cokelat', detail: '250 ml', image: '/landing/ultra-milk.jpg', price: 6500, stock: 42 }
  ];
  const features: {id: Preview; title: string; description: string}[] = [
    {id:'kasir', title:'Transaksi di kasir', description:'Cari produk, atur keranjang, lalu selesaikan pembayaran.'},
    {id:'stok', title:'Persediaan terkendali', description:'Lihat stok dan harga produk, serta catat setiap penyesuaian.'},
    {id:'laporan', title:'Rekap yang terbaca', description:'Lihat omzet, laba, dan transaksi sesuai periode yang dipilih.'}
  ];
  const faq = [
    { question: 'Apa itu VecMart?', answer: 'VecMart adalah aplikasi kasir dan pengelolaan minimarket berbasis web. Penjualan, katalog produk, persediaan, member, dan laporan toko dapat dikelola dalam satu tempat.' },
    { question: 'Siapa yang bisa mengakses?', answer: 'Admin dan kasir masuk menggunakan email serta PIN akun yang sudah terdaftar. Kasir berfokus pada transaksi dan sesi kasir, sedangkan admin mengelola data serta laporan toko.' },
    { question: 'Bagaimana cara mengakses asisten?', answer: 'Masuk menggunakan akun admin, lalu klik ikon robot di kanan bawah halaman aplikasi. Anda bisa mencari stok, meminta ringkasan penjualan, dan menambah stok dengan perintah yang jelas. Penambahan dicatat dan bisa dibatalkan selama 15 menit. Asisten memerlukan konfigurasi Gemini oleh pengelola dan tidak tersedia pada akun kasir.' },
    { question: 'Apakah bisa dibuka di ponsel?', answer: 'Bisa. Tampilan VecMart menyesuaikan ukuran layar ponsel, tablet, dan desktop. Gunakan browser dengan koneksi internet untuk mengakses aplikasi.' },
    { question: 'Apakah stok otomatis berkurang setelah penjualan?', answer: 'Ya. Saat pembayaran transaksi berhasil disimpan, stok produk berkurang sesuai jumlah yang terjual. Admin dapat memantau persediaan melalui halaman produk dan menambahkan stok saat barang baru datang.' }
  ];
  $: appHref = $authStore?.role === 'admin' ? '/admin' : '/kasir';
  onMount(() => {
    syncNavigation();
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.matches) return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.add('landing-arrived');
        observer.unobserve(entry.target);
      }
    }, {threshold:.15});
    document.querySelectorAll('.landing-section-heading > *, .landing-feature-menu button, .landing-preview, .landing-day article, .landing-more, .landing-assistant > div, .landing-faq > *, .landing-cta > div > *, .landing-footer > *').forEach(element => observer.observe(element));
    const stopMotion = () => { if (motion.matches) observer.disconnect(); };
    motion.addEventListener('change', stopMotion);
    return () => { observer.disconnect(); motion.removeEventListener('change', stopMotion); };
  });
</script>

<svelte:head><title>VecMart</title><meta name="description" content="Kenali VecMart, aplikasi kasir dan inventori minimarket untuk transaksi, pengelolaan stok, sesi kasir, dan laporan penjualan dalam satu tempat." /></svelte:head>
<svelte:window on:scroll={syncNavigation} />
<div class="landing" id="beranda">
  <a class="skip-link" href="#kenali">Lewati ke konten</a>
  <div class="landing-opening">
    <div class="landing-nav-shell" class:scrolled={navScrolled}><header class="landing-header landing-width"><Brand /><nav aria-label="Navigasi utama"><a href="#beranda">Beranda</a><a href="#asisten">Asisten AI</a><a href="#fitur">Fitur</a><a href="#alur">Cara kerja</a><a href="#pertanyaan">FAQ</a></nav><a class="landing-login" href={$authStore ? appHref : '/login'}>{$authStore ? 'Buka aplikasi' : 'Masuk'}<ArrowUpRight size={18} aria-hidden="true" /></a></header></div>
    <main id="kenali">
      <div class="landing-intro">
      <div class="landing-top">
      <section class="landing-hero landing-width" aria-labelledby="hero-title">
        <div class="landing-hero-copy"><h1 id="hero-title">Toko tertata.<br />Kasir siap.</h1><p>Kasir dan inventori minimarket, dilengkapi asisten AI untuk cek stok dan membaca penjualan lewat percakapan.</p><a class="landing-button landing-button-white" href="#asisten">Coba demo Asisten AI<ArrowRight size={20} aria-hidden="true" /></a><a class="landing-explore" href="#fitur">Lihat fitur lainnya <ChevronDown size={16} aria-hidden="true" /></a></div>
        <div class="landing-hero-art landing-devices"><div class="landing-device-stage"><div class="landing-laptop"><div class="landing-laptop-screen"><span class="landing-laptop-camera" aria-hidden="true"></span><img src="/landing/admin-preview.jpg" alt="Dashboard admin VecMart: omzet, laba bersih, grafik pendapatan, dan stok produk dengan data contoh." width="1440" height="900" fetchpriority="high" /></div><div class="landing-laptop-base" aria-hidden="true"></div></div><div class="landing-phone"><div class="landing-phone-screen"><div class="landing-phone-status" data-ui aria-hidden="true"><span>9:41</span><div><Signal /><Wifi /><BatteryFull /></div></div><img src="/landing/ai-preview.jpg" alt="Asisten AI VecMart pada ponsel, memperlihatkan contoh penambahan stok dari 126 menjadi 176 pcs melalui percakapan." width="390" height="780" fetchpriority="high" /><span class="landing-phone-camera" aria-hidden="true"></span><span class="landing-phone-home" aria-hidden="true"></span></div></div></div></div>
      </section>
      </div>
      <div class="landing-seam"><div class="landing-width"><p>Dari transaksi pertama<br /><strong>sampai rekap akhir hari.</strong></p><p>Kasir, stok, dan laporan saling terhubung.<br />Anda bisa fokus menjalankan toko.</p></div></div>
      </div>
      <div class="landing-assistant-band"><section id="asisten" class="landing-assistant landing-section landing-width" aria-labelledby="assistant-title"><div><h2 id="assistant-title">Tanya langsung.<br />Lanjut bekerja.</h2><p>Asisten VecMart membantu admin mencari stok dan membaca penjualan melalui percakapan.</p><p>Perintah tambah stok yang jelas bisa langsung diproses, dengan catatan perubahan dan opsi batalkan selama 15 menit.</p><a href="#akses-asisten" on:click={openAssistantAccess}>Cara mengakses asisten <ArrowUpRight size={18} aria-hidden="true" /></a></div><LandingAssistantDemo /></section></div>
      <section id="fitur" class="landing-section landing-width" aria-labelledby="feature-title">
        <div class="landing-section-heading"><h2 id="feature-title">Kenali meja kerja Anda.</h2><p>Satu alur untuk melayani pelanggan dan menjaga toko tetap terpantau.</p></div>
        <div class="landing-showcase"><div class="landing-feature-menu" aria-label="Pilih pratinjau fitur">{#each features as feature}<button type="button" class:chosen={preview === feature.id} aria-pressed={preview === feature.id} aria-controls="feature-preview" on:click={() => preview = feature.id}><span>{feature.title}<ArrowUpRight size={20} aria-hidden="true" /></span><span>{feature.description}</span></button>{/each}</div>
          <div class="landing-preview" id="feature-preview" aria-label="Pratinjau aplikasi dengan data contoh" data-ui><div class="landing-preview-heading"><strong>VecMart<span>.</span></strong><span>Pratinjau</span></div>
            {#if preview === 'kasir'}
              <div class="landing-preview-content"><div class="landing-preview-title"><h3>Keranjang belanja</h3><span>Kasir</span></div>
                {#each products as product, i}<div class="landing-product"><img src={product.image} alt={product.name} width="64" height="64" loading="lazy" /><div><strong>{product.name}</strong><span>{product.detail} · {money(product.price)}</span></div><strong>{i === 0 ? quantity : 1}×</strong></div>{/each}
                <div class="landing-quantity"><span>Jumlah Indomie</span><div><button type="button" aria-label="Kurangi Indomie" disabled={quantity <= 1} on:click={() => quantity--}><Minus size={16} /></button><output aria-live="polite">{quantity}</output><button type="button" aria-label="Tambah Indomie" disabled={quantity >= 10} on:click={() => quantity++}><Plus size={16} /></button></div></div><div class="landing-total"><span>Total belanja</span><strong aria-live="polite">{money(quantity * 3400 + 10000)}</strong></div><p class="landing-preview-footnote">Coba ubah jumlah produk untuk melihat totalnya.</p>
              </div>
            {:else if preview === 'stok'}
              <div class="landing-preview-content"><div class="landing-preview-title"><h3>Persediaan produk</h3><span>Admin</span></div>{#each products as product}<div class="landing-product"><img src={product.image} alt={product.name} width="64" height="64" loading="lazy" /><div><strong>{product.name}</strong><span>{product.detail}</span></div><strong>{product.stock}<small>pcs</small></strong></div>{/each}<div class="landing-stock-note"><Check size={18} aria-hidden="true" /><p>Stok dan harga produk dapat ditinjau sebelum membuat penyesuaian.</p></div></div>
            {:else}
              <div class="landing-preview-content">
                <div class="landing-preview-title"><h3>Ringkasan penjualan</h3><span>Contoh satu hari</span></div>
                <p class="landing-report-label">Omzet penjualan</p><p class="landing-report-value">{money(landingSales.revenue)}</p>
                <div class="landing-report-chart" role="img" aria-label={'Omzet per jam: ' + landingSalesHours.map(bar => bar.hour + '.00 ' + money(bar.revenue)).join(', ')}>
                  {#each landingSalesHours as bar}<div><div style:height={`${bar.revenue / 1000 * 2.6}px`}></div><span>{bar.hour}.00</span></div>{/each}
                </div>
                <div class="landing-report-stats"><div><span>Laba bersih</span><strong>{money(landingSales.profit)}</strong></div><div><span>Transaksi</span><strong>{landingSales.transactions} struk</strong></div><div><span>Rata-rata belanja</span><strong>{money(landingSales.average)}</strong></div></div>
              </div>
            {/if}
          </div>
        </div>
      </section>
      <section id="alur" class="landing-workflow" aria-labelledby="workflow-title"><div class="landing-width"><div class="landing-section-heading"><h2 id="workflow-title">Satu hari bersama VecMart.</h2><p>Setiap peran punya ruang kerja yang sesuai.</p></div><div class="landing-day"><article><h3>Buka sesi.</h3><p>Kasir memulai sesi dan mencatat kas awal sebelum melayani pelanggan.</p><span>Awal giliran</span></article><article><h3>Layani pelanggan.</h3><p>Cari atau pindai produk, gunakan promo yang sesuai, lalu cetak struk transaksi.</p><span>Di meja kasir</span></article><article><h3>Tutup dengan jelas.</h3><p>Rekap penjualan dan cocokkan uang kas. Admin dapat meninjau laporan toko.</p><span>Akhir giliran</span></article></div><div class="landing-more"><span>Juga tersedia untuk toko Anda</span><p>Member & poin <span>·</span> Promo <span>·</span> Supplier <span>·</span> Purchase order</p></div></div></section>
      <section id="pertanyaan" class="landing-faq landing-width" aria-labelledby="faq-title"><h2 id="faq-title">Sebelum mulai.</h2><div>{#each faq as item, index}<details id={index === 2 ? 'akses-asisten' : undefined}><summary>{item.question}<Plus size={20} aria-hidden="true" /></summary><p>{item.answer}</p></details>{/each}</div></section>
      <section class="landing-cta landing-width" aria-labelledby="cta-title"><div><div><h2 id="cta-title">Mulai kelola toko Anda.</h2><p>Masuk untuk mengelola transaksi, stok, dan laporan.</p></div><a class="landing-button landing-button-white" href={$authStore ? appHref : '/login'}>{$authStore ? 'Buka aplikasi' : 'Masuk ke VecMart'}<ArrowRight size={20} aria-hidden="true" /></a></div></section>
    </main>
  </div>
  <footer class="landing-footer landing-width"><Brand /><p>Kasir & inventori minimarket.</p><span>© {new Date().getFullYear()} VecMart. All rights reserved.</span></footer>
</div>
