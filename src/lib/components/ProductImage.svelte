<script lang="ts">
  import { Package } from 'lucide-svelte';
  export let src = '';
  export let name = '';
  const localImages = import.meta.glob('/assets/*.{png,jpg,jpeg,webp}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
  let failed = false;
  $: resolved = localImages[src] || src;
  $: if (resolved) failed = false;
</script>
{#if resolved && !failed}
  <img src={resolved} alt={name} loading="lazy" decoding="async" on:error={() => failed = true} />
{:else}
  <Package size={28} strokeWidth={1.25} aria-label="Foto produk belum tersedia" />
{/if}
