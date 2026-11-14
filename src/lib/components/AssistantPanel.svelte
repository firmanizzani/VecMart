<script lang="ts">
  import '$lib/styles/assistant.css';
  import AssistantAvatar from '$lib/components/AssistantAvatar.svelte';
  export let floating = false;
  export let close: () => void = () => {};
  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/authStore';
  import { ArrowUp, ArrowUpRight, Bot, Check, ChevronRight, CircleHelp, Clock3, Loader2, MessageSquare, PackagePlus, RefreshCw, RotateCcw, Trash2, TriangleAlert, X } from 'lucide-svelte';
  import type { AssistantReply } from '$lib/ai/types';

  type Entry = { id: string; role: 'user' | 'assistant'; text: string; reply?: AssistantReply; error?: boolean; resolved?: boolean; retry?: { requestId: string; message: string } };
  type Usage = { used: number; limit: number; resetsAt: string };
  let messages: Entry[] = [];
  let draft = '';
  let busy = false;
  let busyLabel = 'Memahami permintaan…';
  let statusLoading = true;
  let configured = false;
  let sessionExpired = false;
  let statusError = '';
  let usage: Usage | undefined;
  let conversation: HTMLDivElement;
  let input: HTMLTextAreaElement;
  const suggestions = [
    { text: 'Cek stok Aqua', icon: MessageSquare },
    { text: 'Produk apa yang stoknya menipis?', icon: PackagePlus },
    { text: 'Ringkas penjualan bulan ini', icon: MessageSquare },
    { text: 'Produk terlaris bulan ini', icon: PackagePlus }
  ];
  const rupiah = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
  const key = () => `vecmart-assistant-${$authStore?.id}`;
  $: canSend = configured && !sessionExpired && !statusLoading && !busy && !!draft.trim();
  $: resetLabel = usage ? new Date(usage.resetsAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' WIB' : '';

  onMount(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(key()) || '[]');
      if (Array.isArray(stored)) messages = stored.filter(item => item && typeof item.text === 'string' && ['user', 'assistant'].includes(item.role)).slice(-40);
    } catch { /* A malformed local conversation starts empty. */ }
    loadStatus();
    scrollConversation();
  });

  function save() { try { sessionStorage.setItem(key(), JSON.stringify(messages.slice(-40))); } catch { /* Storage may be unavailable. */ } }
  async function scrollConversation() { await tick(); if (conversation) conversation.scrollTop = conversation.scrollHeight; }
  function append(entry: Omit<Entry, 'id'>) {
    messages = [...messages, { id: crypto.randomUUID(), ...entry }].slice(-40); save(); scrollConversation();
    if (entry.reply && ['stock_changed', 'stock_undone'].includes(entry.reply.kind)) window.dispatchEvent(new CustomEvent('vecmart:stock-changed'));
  }
  async function api(path: string, body?: unknown) {
    const response = await fetch(`/api/ai/${path}`, {
      method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${$authStore?.token || ''}` },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    let result: any;
    try { result = await response.json(); } catch { throw new Error('Server belum dapat dihubungi. Silakan coba lagi.'); }
    if (!response.ok || !result.success) {
      if (response.status === 401) sessionExpired = true;
      throw new Error(result.message || 'Permintaan belum dapat diproses. Silakan coba lagi.');
    }
    if (result.usage) usage = result.usage;
    return result;
  }
  async function loadStatus() {
    statusLoading = true; statusError = '';
    try { const result = await api('status'); configured = result.data.configured; usage = result.data.usage; }
    catch (error) { statusError = error instanceof Error ? error.message : 'Status asisten belum tersedia.'; }
    finally { statusLoading = false; }
  }
  async function send(message = draft, retryId?: string) {
    const text = message.trim();
    if (!text || busy || !configured || sessionExpired) return;
    const requestId = retryId || crypto.randomUUID();
    if (!retryId) { append({ role: 'user', text }); draft = ''; }
    busy = true; busyLabel = 'Memahami permintaan…';
    try {
      const result = await api('chat', { requestId, message: text });
      append({ role: 'assistant', text: result.data.text, reply: result.data });
      messages = messages.map(entry => entry.retry?.requestId === requestId ? { ...entry, retry: undefined } : entry);
    } catch (error) {
      append({ role: 'assistant', text: error instanceof Error ? error.message : 'Permintaan gagal diproses.', error: true, retry: { requestId, message: text } });
      // Refresh the application quota even when a provider request failed.
      await loadStatus();
    } finally { busy = false; save(); scrollConversation(); await tick(); input?.focus(); }
  }
  async function choose(entry: Entry, productId: string) {
    if (busy || entry.resolved || !entry.reply?.selectionToken) return;
    busy = true; busyLabel = 'Menyimpan penambahan stok…';
    try {
      const result = await api('choose-product', { token: entry.reply.selectionToken, productId });
      messages = messages.map(item => item.id === entry.id ? { ...item, resolved: true } : item);
      append({ role: 'assistant', text: result.data.text, reply: result.data });
    } catch (error) { append({ role: 'assistant', text: error instanceof Error ? error.message : 'Stok belum dapat diperbarui.', error: true }); }
    finally { busy = false; save(); scrollConversation(); }
  }
  async function undo(entry: Entry) {
    if (busy || !entry.reply?.undoToken || entry.reply.change?.undone) return;
    busy = true; busyLabel = 'Membatalkan penambahan stok…';
    try {
      const result = await api('undo', { token: entry.reply.undoToken });
      messages = messages.map(item => {
        const reply = item.reply;
        if (!reply?.change || reply.change.id !== result.data.change?.id) return item;
        return { ...item, reply: { ...reply, change: { ...reply.change, undone: true }, undoToken: undefined } };
      });
      append({ role: 'assistant', text: result.data.text, reply: result.data });
    } catch (error) { append({ role: 'assistant', text: error instanceof Error ? error.message : 'Perubahan belum dapat dibatalkan.', error: true }); }
    finally { busy = false; save(); scrollConversation(); }
  }
  function signIn() { authStore.logout(); goto('/login'); }
  function clearConversation() { messages = []; save(); input?.focus(); }
  function useSuggestion(text: string) { draft = text; input?.focus(); }
  function inputKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); if (canSend) send(); }
  }
</script>

<div class="assistant-page" class:assistant-floating-content={floating}>
  {#if floating}
    <header class="assistant-floating-header"><div><AssistantAvatar size={26} /><h2>Asisten VecMart</h2></div><button class="icon-button" aria-label="Tutup asisten" data-dialog-close on:click={close}><X size={19} /></button><p><span class="assistant-connection"><span class:connected={configured && !sessionExpired && !statusError}></span>{statusLoading ? 'Menghubungkan…' : configured && !sessionExpired && !statusError ? 'Gemini terhubung' : 'Perlu pengaturan'}</span>{#if usage}<span>{usage.used}/{usage.limit} hari ini</span>{/if}</p>{#if usage}<small>Kuota VecMart reset {resetLabel}</small>{/if}</header>
  {:else}
  <div class="assistant-heading">
    <div><h1 class="page-title">Asisten VecMart</h1><p>Tanya laporan toko atau kelola stok melalui percakapan.</p></div>
    <div class="assistant-header-actions"><span class="assistant-connection"><span class:connected={configured && !sessionExpired && !statusError}></span>{statusLoading ? 'Menghubungkan…' : configured && !sessionExpired && !statusError ? 'Gemini terhubung' : 'Perlu pengaturan'}</span>{#if usage}<span class="assistant-compact-usage">{usage.used}/{usage.limit} hari ini</span>{/if}<button class="icon-button" on:click={loadStatus} disabled={busy || statusLoading} aria-label="Perbarui status asisten" title="Perbarui status"><RefreshCw size={17} class={statusLoading ? 'animate-spin' : ''} /></button></div>
  </div>

  {/if}
  {#if sessionExpired}
    <div class="assistant-notice"><TriangleAlert size={18} /><p>Masuk kembali untuk mengaktifkan sesi admin yang terverifikasi.</p><button on:click={signIn}>Masuk kembali <ArrowUpRight size={15} /></button></div>
  {:else if statusError}
    <div class="assistant-notice" role="alert"><TriangleAlert size={18} /><p>{statusError}</p><button on:click={loadStatus}>Coba lagi</button></div>
  {:else if !configured && !statusLoading}
    <div class="assistant-notice"><CircleHelp size={18} /><div><p>Gemini belum diaktifkan untuk toko ini.</p><span>Tambahkan GEMINI_API_KEY pada konfigurasi server, lalu muat ulang aplikasi.</span></div><a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Buka AI Studio <ArrowUpRight size={15} /></a></div>
  {/if}

  <div class="assistant-layout">
    <section class="assistant-chat" aria-label="Percakapan dengan Asisten VecMart">
      <div class="assistant-chat-bar"><div><MessageSquare size={16} /><span>Percakapan toko</span></div><button disabled={busy || !messages.length} on:click={clearConversation} title="Bersihkan percakapan" aria-label="Bersihkan percakapan"><Trash2 size={15} /><span>Bersihkan</span></button></div>
      <div class="assistant-conversation" bind:this={conversation} role="log" aria-live="polite" aria-relevant="additions" aria-label="Pesan percakapan">
        {#if !messages.length}
          <div class="assistant-welcome"><Bot size={34} strokeWidth={1.4} /><h2>Apa yang ingin Anda kerjakan?</h2><p>Cari tahu kondisi toko, atau tambahkan stok dengan menyebutkan produk dan jumlahnya.</p><div class="assistant-suggestions">{#each suggestions as suggestion}<button on:click={() => useSuggestion(suggestion.text)} disabled={busy || !configured || sessionExpired}><span>{suggestion.text}</span><ChevronRight size={15} /></button>{/each}</div></div>
        {/if}
        {#each messages as entry (entry.id)}
          <article class="assistant-entry" class:from-user={entry.role === 'user'} class:entry-error={entry.error}>
            {#if entry.role === 'assistant'}<span class="assistant-author"><Bot size={16} />VecMart</span>{/if}
            <div class="assistant-bubble"><p>{entry.text}</p>
              {#if entry.reply?.products?.length}
                <div class="assistant-product-list">{#each entry.reply.products as product}
                  {#if entry.reply.kind === 'choose_product'}
                    <button class="assistant-product-choice" disabled={busy || entry.resolved || sessionExpired} on:click={() => choose(entry, product.id)}><span><strong>{product.name}</strong><small>{product.barcode} · Stok {product.stock} {product.unit}</small></span>{#if entry.resolved}<Check size={16} />{:else}<ChevronRight size={17} />{/if}</button>
                  {:else}<a class="assistant-product-choice" href="/admin/produk"><span><strong>{product.name}</strong><small>{product.barcode}</small></span><span class="assistant-product-stock">{product.stock} {product.unit}</span></a>{/if}
                {/each}</div>
              {/if}
              {#if entry.reply?.change}
                <div class="assistant-change"><span class="assistant-change-mark">{#if entry.reply.change.undone}<RotateCcw size={18} />{:else}<Check size={18} />{/if}</span><div><strong>{entry.reply.change.productName}</strong><p><span>{entry.reply.change.before}</span><span aria-label="menjadi">→</span><b>{entry.reply.change.after} {entry.reply.change.unit}</b></p></div></div>
                {#if entry.reply.undoToken && !entry.reply.change.undone}<button class="assistant-undo" disabled={busy || sessionExpired} on:click={() => undo(entry)}><RotateCcw size={14} />Batalkan penambahan</button>{:else if entry.reply.change.undone}<span class="assistant-action-note">Penambahan telah dibatalkan</span>{/if}
              {/if}
              {#if entry.reply?.report}<dl class="assistant-report"><div><dt>Omzet</dt><dd>{rupiah(entry.reply.report.revenue)}</dd></div><div><dt>Laba bersih</dt><dd>{rupiah(entry.reply.report.profit)}</dd></div><div><dt>Transaksi</dt><dd>{entry.reply.report.transactions}</dd></div><div><dt>Rata-rata belanja</dt><dd>{rupiah(entry.reply.report.average)}</dd></div></dl><a class="assistant-report-link" href="/admin/transaksi">Buka riwayat transaksi <ArrowUpRight size={14} /></a>{/if}
              {#if entry.reply?.topProducts?.length}<ol class="assistant-ranking">{#each entry.reply.topProducts as product}<li><span>{product.name}<small>{product.quantity} barang terjual</small></span><strong>{rupiah(product.revenue)}</strong></li>{/each}</ol>{/if}
              {#if entry.error && entry.retry && !sessionExpired}<button class="assistant-retry" disabled={busy} on:click={() => send(entry.retry!.message, entry.retry!.requestId)}><RefreshCw size={14} />Coba lagi</button>{/if}
            </div>
          </article>
        {/each}
        {#if busy}<div class="assistant-working" role="status"><Loader2 size={16} class="animate-spin" />{busyLabel}</div>{/if}
      </div>
      <form class="assistant-composer" on:submit|preventDefault={() => send()}>
        <label for="assistant-message" class="sr-only">Pesan untuk Asisten VecMart</label>
        <div class="assistant-composer-input"><textarea id="assistant-message" bind:this={input} bind:value={draft} maxlength={1000} rows={2} on:keydown={inputKeydown} disabled={!configured || sessionExpired || statusLoading} placeholder="Contoh: Stok Aqua 600ml tambah 50 pcs"></textarea><button class="assistant-send" type="submit" disabled={!canSend} aria-label="Kirim pesan">{#if busy}<Loader2 size={19} class="animate-spin" />{:else}<ArrowUp size={21} />{/if}</button></div>
        <div class="assistant-composer-meta"><span>Enter untuk kirim · Shift + Enter untuk baris baru</span><span>{draft.length}/1.000</span></div>
      </form>
    </section>

    {#if !floating}<aside class="assistant-guide" aria-label="Panduan asisten">
      <section class="assistant-quota"><div class="assistant-guide-heading"><Clock3 size={17} /><h2>Pemakaian AI toko</h2></div>{#if usage}<p class="assistant-quota-number">{usage.used}<span> / {usage.limit} permintaan</span></p><progress value={usage.used} max={usage.limit} aria-label={`${usage.used} dari ${usage.limit} permintaan AI hari ini`}></progress><p>Reset {resetLabel}</p>{:else}<p>Kuota tersedia setelah sesi terhubung.</p>{/if}<small>Ini pemakaian dari VecMart. Kuota proyek Google dapat dipakai oleh aplikasi lain juga.</small><a href="https://aistudio.google.com/rate-limit" target="_blank" rel="noreferrer">Lihat kuota Google <ArrowUpRight size={13} /></a></section>
      <section><div class="assistant-guide-heading"><PackagePlus size={17} /><h2>Tambah stok lewat chat</h2></div><p>Sebutkan nama lengkap atau ukuran produk, lalu jumlah penambahannya.</p><button class="assistant-command-example" on:click={() => useSuggestion('Stok Aqua 600ml tambah 50 pcs')} disabled={!configured || busy || sessionExpired}>Stok Aqua 600ml tambah 50 pcs <ArrowUpRight size={14} /></button><p class="assistant-guide-note">Perintah yang jelas langsung mengubah stok. Nama yang memiliki beberapa varian akan ditanyakan terlebih dahulu.</p></section>
      <section><div class="assistant-guide-heading"><RotateCcw size={17} /><h2>Perubahan tercatat</h2></div><p>Hasil menampilkan stok sebelum dan sesudah. Penambahan dapat dibatalkan selama 15 menit.</p><a href="/admin/stok-opname">Lihat riwayat penyesuaian <ArrowUpRight size={13} /></a></section>
    </aside>{/if}
  </div>
</div>
