<script lang="ts">
  import { X } from 'lucide-svelte';
  import { dialog } from '$lib/actions/dialog';
  import { installState, closeInstallHelp, installApp } from '$lib/stores/installStore';
</script>

{#if $installState.help && !$installState.installed}
  <div class="install-overlay">
    <section class="install-help" use:dialog aria-describedby="install-description">
      <header><img src="/icons/vecmart-192.png" alt="" width="48" height="48" /><div><h2>Instal VecMart</h2><p>Buka toko langsung dari perangkat Anda.</p></div><button type="button" data-dialog-close on:click={closeInstallHelp} aria-label="Tutup dialog"><X size={20} /></button></header>
      <p id="install-description">VecMart akan memiliki ikon sendiri dan terbuka dalam jendela aplikasi. Akun dan data toko tetap sama.</p>
      {#if $installState.error}<p class="install-error" role="alert">{$installState.error}</p>{/if}
      {#if $installState.ios}
        <ol><li>Buka VecMart di <strong>Safari</strong>.</li><li>Ketuk tombol <strong>Bagikan</strong>, lalu pilih <strong>Tambahkan ke Layar Utama</strong>.</li><li>Aktifkan <strong>Buka sebagai app</strong> jika tersedia, lalu ketuk <strong>Tambah</strong>.</li></ol>
      {:else if $installState.safari}
        <ol><li>Buka VecMart di Safari pada Mac.</li><li>Pilih menu <strong>File</strong>, lalu <strong>Tambahkan ke Dock</strong> jika tersedia.</li><li>Pastikan namanya <strong>VecMart</strong>, lalu pilih <strong>Tambah</strong>.</li></ol>
      {:else}
        {#if !$installState.available}<p class="browser-explanation">Dialog instalasi belum tersedia di browser ini. Coba buka VecMart melalui Chrome atau Microsoft Edge, lalu pilih instal dari menu browser.</p>{/if}
      {/if}
      <p class="online-note">Koneksi internet tetap diperlukan untuk transaksi, stok, laporan, dan Asisten AI.</p>
      <footer>{#if $installState.available}<button type="button" class="install-primary" on:click={installApp} disabled={$installState.busy}>Instal sekarang</button>{/if}<button type="button" on:click={closeInstallHelp}>Mengerti</button></footer>
    </section>
  </div>
{/if}

<style>
  .install-overlay { position:fixed; inset:0; z-index:100; background:rgb(23 34 47 / .42); display:flex; align-items:center; justify-content:center; padding:20px; overflow:auto; }
  .install-help { width:100%; max-width:520px; max-height:calc(100dvh - 40px); overflow:auto; background:white; color:#203e60; border-radius:16px; padding:28px; box-shadow:0 20px 70px #182c4430; font-size:14px; line-height:1.65; }
  header { display:flex; align-items:center; gap:12px; margin-bottom:24px; } header img { border-radius:10px; } header div { flex:1; } h2 { font-size:22px; line-height:1.3; font-weight:600; } header p { margin-top:4px; color:#5d6978; font-size:13px; }
  button { min-height:44px; border:1px solid #cbddef; border-radius:8px; padding:10px 16px; color:#175da9; cursor:pointer; background:white; font-weight:500; } header button { align-self:flex-start; padding:10px; border:0; }
  button:hover { background:#eaf3ff; } button:focus-visible { outline:2px solid #1764bf; outline-offset:3px; } ol { list-style:decimal; padding-left:22px; margin:20px 0; } li { padding:5px 0 5px 4px; }
  .online-note { margin-top:20px; padding-top:18px; border-top:1px solid #dce6f1; color:#5d6978; } .install-error { color:#a02525; margin:12px 0; }
  .browser-explanation { margin-top:16px; }
  footer { display:flex; justify-content:flex-end; gap:10px; margin-top:24px; } .install-primary { background:#1764bf; color:white; border-color:#1764bf; }
  @media(max-width:480px) { .install-overlay { padding:16px; } .install-help { padding:20px; max-height:calc(100dvh - 32px); } header { gap:10px; margin-bottom:18px; } header img { width:40px; height:40px; } h2 { font-size:20px; } }
</style>
