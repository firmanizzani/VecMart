<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/authStore';
  import { shiftStore } from '$lib/stores/posStore';
  import Brand from '$lib/components/Brand.svelte';
  import { LogOut } from 'lucide-svelte';
  onMount(() => authStore.subscribe(user => { if (!user || !['admin', 'cashier'].includes(user.role)) goto('/login'); }));
  function logout() { authStore.logout(); goto('/login'); }
</script>
<svelte:head><title>VecMart</title></svelte:head>
<div class="cashier-shell">
  <header class="cashier-header">
    <div class="flex items-center gap-5"><Brand /><span class="cashier-mode">Kasir</span></div>
    <div class="flex items-center gap-3 sm:gap-5">
      {#if $authStore?.role === 'admin'}<a class="cashier-link hidden sm:flex" href="/admin">Admin</a>{/if}
      <div class="cashier-session"><span class="session-dot" class:running={$shiftStore.isClockedIn}></span><div><strong>{$authStore?.name || 'Kasir'}</strong><span>{$shiftStore.isClockedIn ? 'Sesi kasir aktif' : 'Sesi belum dimulai'}</span></div></div>
      <button class="icon-button" aria-label="Keluar dari akun" title="Keluar" on:click={logout}><LogOut size={18} /></button>
    </div>
  </header>
  <main class="cashier-main"><slot /></main>
</div>
