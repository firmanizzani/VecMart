<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/authStore';
  import Brand from '$lib/components/Brand.svelte';
  import AssistantWidget from '$lib/components/AssistantWidget.svelte';
  import { LayoutDashboard, FileText, Package, Truck, ClipboardCheck, Users, Percent, LogOut, UserCog, Menu, X, ArrowUpRight } from 'lucide-svelte';
  const groups = [
    { label: 'Penjualan', links: [
      { href: '/admin', label: 'Ringkasan', icon: LayoutDashboard },
      { href: '/admin/transaksi', label: 'Transaksi & sesi kasir', icon: FileText }
    ] },
    { label: 'Inventori', links: [
      { href: '/admin/produk', label: 'Produk', icon: Package },
      { href: '/admin/supplier', label: 'Supplier', icon: Truck },
      { href: '/admin/stok-opname', label: 'Stok opname', icon: ClipboardCheck }
    ] },
    { label: 'Pelanggan', links: [
      { href: '/admin/member', label: 'Member & poin', icon: Users },
      { href: '/admin/promo', label: 'Promo', icon: Percent }
    ] }
  ];
  let isAuthReady = false;
  let isMobileMenuOpen = false;
  $: activeLabel = [...groups.flatMap(g => g.links), { href: '/admin/akun', label: 'Manajemen akun' }].find(l => l.href === $page.url.pathname)?.label || 'Admin';
  onMount(() => authStore.subscribe(user => {
    if (!user) goto('/login');
    else if (user.role !== 'admin') goto('/kasir');
    else isAuthReady = true;
  }));
  function logout() { authStore.logout(); goto('/login'); }
</script>
<svelte:head><title>{activeLabel} · VecMart</title></svelte:head>
<svelte:window on:keydown={(e) => { if (e.key === 'Escape') isMobileMenuOpen = false; }} />
{#if isAuthReady}
<div class="admin-shell">
  <a class="skip-link" href="#main-content">Langsung ke konten</a>
  {#if isMobileMenuOpen}<button class="nav-backdrop" aria-label="Tutup navigasi" on:click={() => isMobileMenuOpen = false}></button>{/if}
  <aside class="admin-sidebar" class:nav-open={isMobileMenuOpen} aria-label="Navigasi admin">
    <div class="sidebar-brand"><Brand /><button class="icon-button mobile-only" aria-label="Tutup navigasi" on:click={() => isMobileMenuOpen = false}><X size={20} /></button></div>
    <div class="workspace-label"><span class="workspace-dot"></span><span>Operasional toko</span><span class="scope-tag">Admin</span></div>
    <nav>
      {#each groups as group}
        <div class="nav-group"><p class="nav-group-label">{group.label}</p>
          {#each group.links as link}
            <a href={link.href} class:active={$page.url.pathname === link.href} aria-current={$page.url.pathname === link.href ? 'page' : undefined} on:click={() => isMobileMenuOpen = false}><svelte:component this={link.icon} size={18} strokeWidth={1.7} /><span>{link.label}</span></a>
          {/each}
        </div>
      {/each}
    </nav>
    <div class="sidebar-bottom">
      <a class="settings-link" class:active={$page.url.pathname === '/admin/akun'} href="/admin/akun" on:click={() => isMobileMenuOpen = false}><UserCog size={18} />Manajemen akun</a>
      <div class="sidebar-user"><span class="user-avatar">{($authStore?.name || 'A').slice(0, 1).toUpperCase()}</span><div><strong>{$authStore?.name}</strong><span>Administrator</span></div><button class="icon-button" aria-label="Keluar dari akun" title="Keluar" on:click={logout}><LogOut size={18} /></button></div>
    </div>
  </aside>
  <div class="admin-workspace">
    <header class="workspace-header"><div class="flex items-center gap-3"><button class="icon-button mobile-only" aria-label="Buka navigasi" aria-expanded={isMobileMenuOpen} on:click={() => isMobileMenuOpen = true}><Menu size={20} /></button><span class="text-slate-500">VecMart</span><span class="breadcrumb-slash">/</span><span>{activeLabel}</span></div><a href="/kasir" class="cashier-link">Buka kasir <ArrowUpRight size={16} /></a></header>
    <main id="main-content" class="admin-canvas"><slot /></main>
  </div>
  <AssistantWidget />
</div>
{/if}
