<script lang="ts">
  import { Download } from 'lucide-svelte';
  import { installState, installApp } from '$lib/stores/installStore';
  export let compact = false;
</script>

{#if $installState.initialized && !$installState.installed}
  <button type="button" class="install-app-button" class:compact on:click={installApp} disabled={$installState.busy} aria-label="Instal VecMart" title="Instal VecMart">
    <Download size={17} aria-hidden="true" /><span>{$installState.busy ? 'Membuka…' : 'Instal VecMart'}</span>
  </button>
{/if}

<style>
  .install-app-button { display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:44px; max-width:100%; padding:10px 12px; border:1px solid #cbddef; border-radius:8px; color:#175da9; background:transparent; font-size:14px; font-weight:500; line-height:1.4; cursor:pointer; }
  .install-app-button:hover { background:#e4effc; } .install-app-button:disabled { opacity:.6; cursor:wait; }
  .install-app-button:focus-visible { outline:2px solid #1764bf; outline-offset:3px; }
  @media(max-width:767px) { .compact { width:44px; padding:10px; flex-shrink:0; } .compact span { display:none; } }
</style>
