<script lang="ts">
  export let loading = false;
  export let error = '';
  export let retry: () => void;
</script>
{#if loading}<div class="load-notice" role="status"><span class="loading-wheel"></span>Memuat data toko…</div>
{:else if error}<div class="load-notice load-error" role="alert"><span>{error}</span><button on:click={retry}>Coba lagi</button></div>{/if}
