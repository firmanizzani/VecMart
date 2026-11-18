<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { ChevronUp, Download, LogOut } from 'lucide-svelte';
  import { authStore } from '$lib/stores/authStore';
  import { installState, installApp } from '$lib/stores/installStore';
  export let logout: () => void;
  let expanded = false;
  let root: HTMLDivElement;
  let trigger: HTMLButtonElement;
  async function close(restoreFocus = false) {
    expanded = false;
    if (restoreFocus) { await tick(); trigger?.focus(); }
  }
  async function toggle() {
    expanded = !expanded;
    if (expanded) { await tick(); root.querySelector<HTMLButtonElement>('.account-options button')?.focus(); }
  }
  function install() {
    // Keep the native prompt inside the click's user activation and restore focus
    // to a visible control if the instructions dialog is needed instead.
    expanded = false;
    trigger.focus();
    installApp();
  }
  onMount(() => {
    const outside = (event: PointerEvent) => { if (!root.contains(event.target as Node)) close(); };
    document.addEventListener('pointerdown', outside);
    root.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('pointerdown', outside); root.removeEventListener('keydown', keydown); };
  });
  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && expanded) { event.preventDefault(); event.stopPropagation(); close(true); }
  }
</script>

<div class="account-menu" bind:this={root} role="group" aria-label="Akun administrator">
  {#if expanded}
    <div id="admin-account-options" class="account-options">
      {#if $installState.initialized && !$installState.installed}
        <button type="button" on:click={install} disabled={$installState.busy}><Download size={17} /><span>Instal VecMart</span></button>
      {:else if $installState.installed}<p>VecMart sudah terpasang.</p>{/if}
      <button type="button" on:click={logout}><LogOut size={17} /><span>Keluar dari akun</span></button>
    </div>
  {/if}
  <button type="button" class="account-trigger" bind:this={trigger} aria-expanded={expanded} aria-controls="admin-account-options" aria-label="Menu akun" on:click={toggle}>
    <span class="account-avatar">{($authStore?.name || 'A').slice(0, 1).toUpperCase()}</span><span class="account-identity"><strong>{$authStore?.name}</strong><span>Administrator</span></span><ChevronUp size={16} class={expanded ? 'is-open' : ''} />
  </button>
</div>

<style>
  .account-menu { position:relative; margin-top:14px; border-top:1px solid #ccdef3; padding-top:10px; }
  .account-trigger { display:flex; align-items:center; gap:9px; width:100%; min-height:52px; text-align:left; border:0; border-radius:8px; padding:7px 6px; color:#203e60; background:transparent; cursor:pointer; }
  .account-trigger:hover { background:#dceaff; } .account-avatar { display:grid; place-items:center; width:34px; height:34px; border-radius:50%; flex-shrink:0; background:#d3e6ff; color:#1764bf; font-size:14px; }
  .account-identity { flex:1; min-width:0; } .account-identity strong,.account-identity>span { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; } .account-identity strong { font-weight:600; } .account-identity>span { color:#5d6978; font-size:11px; margin-top:2px; }
  .account-trigger :global(svg) { flex-shrink:0; transition:transform .15s; } .account-trigger :global(.is-open) { transform:rotate(180deg); }
  .account-options { position:absolute; bottom:calc(100% + 4px); left:0; right:0; z-index:5; border-radius:12px; padding:6px; background:white; box-shadow:0 8px 28px #16365d26; }
  .account-options button { display:flex; align-items:center; gap:10px; width:100%; min-height:44px; padding:10px; border:0; border-radius:7px; text-align:left; font-size:13px; color:#203e60; background:white; cursor:pointer; } .account-options button:hover { background:#eaf3ff; } .account-options button:disabled { opacity:.6; }
  .account-options p { padding:10px; font-size:12px; color:#5d6978; line-height:1.5; }
  button:focus-visible { outline:2px solid #1764bf; outline-offset:2px; }
  @media(prefers-reduced-motion:reduce) { .account-trigger :global(svg) { transition:none; } }
</style>
