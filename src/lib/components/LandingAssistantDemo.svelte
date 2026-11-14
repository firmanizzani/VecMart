<script lang="ts">
  import { ArrowRight, Check } from 'lucide-svelte';
  import { landingSales } from '$lib/data/landing-sales';
  const money = (value: number) => 'Rp ' + value.toLocaleString('id-ID');
  type Example = 'stok' | 'tambah' | 'laporan';
  let selected: Example = 'tambah';
  const examples: {id: Example; label: string; message: string}[] = [
    {id:'stok',label:'Cek stok',message:'Cek stok Indomie Soto Mie'},
    {id:'tambah',label:'Tambah stok',message:'Stok Indomie Soto Mie tambah 50 pcs'},
    {id:'laporan',label:'Ringkas penjualan',message:'Ringkas penjualan hari ini'}
  ];
  $: example = examples.find(item => item.id === selected)!;
</script>
<div class="landing-chat" data-ui aria-label="Demo Asisten VecMart dengan data contoh">
  <div class="landing-chat-title"><span class="landing-robot" aria-hidden="true"></span><strong>Asisten VecMart</strong><span>Demo AI</span></div>
  <div class="landing-ai-prompts" aria-label="Coba contoh perintah">{#each examples as item}<button type="button" class:active={selected === item.id} aria-pressed={selected === item.id} on:click={() => selected = item.id}>{item.label}</button>{/each}</div>
  {#key selected}
    <div class="landing-ai-example" aria-live="polite"><p class="landing-chat-user">{example.message}</p><div class="landing-chat-answer">
      {#if selected === 'tambah'}<strong>Stok berhasil ditambahkan.</strong><p>Indomie Soto Mie 70 gr</p><div><span>126 pcs</span><ArrowRight size={18} aria-hidden="true" /><strong>176 pcs</strong></div><span class="landing-chat-audit"><Check size={15} aria-hidden="true" />Perubahan tercatat di stok opname</span>
      {:else if selected === 'stok'}<strong>Stok produk ditemukan.</strong><p>Indomie Soto Mie 70 gr</p><div><strong>126 pcs</strong><span>tersedia</span></div><span class="landing-chat-audit"><Check size={15} aria-hidden="true" />Cek produk tanpa membuka tabel stok</span>
      {:else}<strong>Ini ringkasan penjualan Anda.</strong><p>Omzet penjualan</p><div><strong>{money(landingSales.revenue)}</strong></div><div class="landing-ai-profit"><span>Laba bersih</span><strong>{money(landingSales.profit)}</strong></div><span class="landing-chat-audit">{landingSales.transactions} transaksi · Rata-rata belanja {money(landingSales.average)}</span>{/if}
    </div></div>
  {/key}
</div>
