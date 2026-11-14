<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/authStore';

  let isMounted = false;

  onMount(() => {
    isMounted = true;
    const unsubscribe = authStore.subscribe((user) => {
      const isPublicPage = $page.url.pathname === '/' || $page.url.pathname === '/login';
      if (!user && !isPublicPage) {
        goto('/login');
      }
    });
    return unsubscribe;
  });
</script>

<svelte:head>
  <title>VecMart</title>
  <meta property="og:title" content="VecMart" />
  <meta property="og:site_name" content="VecMart" />
  <meta property="og:type" content="website" />
  <meta property="og:description" content="Sistem kasir dan inventori minimarket." />
  <meta name="twitter:title" content="VecMart" />
  <meta name="twitter:description" content="Sistem kasir dan inventori minimarket." />
</svelte:head>

{#if isMounted || $page.url.pathname === '/'}
  <slot />
{:else}
  <div class="min-h-screen bg-slate-100 flex items-center justify-center">
    <div class="w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
  </div>
{/if}
