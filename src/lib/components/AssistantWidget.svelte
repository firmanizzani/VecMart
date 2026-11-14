<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { Bot, X } from 'lucide-svelte';
  import AssistantPanel from './AssistantPanel.svelte';
  import AssistantAvatar from './AssistantAvatar.svelte';
  import { dialog } from '$lib/actions/dialog';
  let open = false;
  let launcher: HTMLButtonElement;
  function panelFocus(node: HTMLElement) {
    const media = matchMedia('(max-width: 640px)');
    let modal: ReturnType<typeof dialog> | undefined;
    function sync() {
      if (media.matches && !modal) modal = dialog(node);
      else if (!media.matches && modal) { modal.destroy(); modal = undefined; node.setAttribute('role', 'region'); node.removeAttribute('aria-modal'); }
    }
    sync(); media.addEventListener('change', sync);
    requestAnimationFrame(() => node.querySelector<HTMLTextAreaElement>('textarea:not(:disabled)')?.focus());
    return { destroy() { media.removeEventListener('change', sync); modal?.destroy(); } };
  }
  async function close() { open = false; await tick(); launcher?.focus(); }
  onMount(() => { if (new URL(location.href).searchParams.get('assistant') === 'open') open = true; });
</script>
<svelte:window on:keydown={(event) => { if (open && event.key === 'Escape') { event.preventDefault(); close(); } }} />
{#if open}
  <section id="vecmart-assistant-panel" class="assistant-widget-panel" use:panelFocus aria-label="Asisten VecMart"><AssistantPanel floating {close} /></section>
{/if}
<button class="assistant-launcher" bind:this={launcher} on:click={() => open ? close() : open = true} aria-label={open ? 'Tutup Asisten VecMart' : 'Buka Asisten VecMart'} aria-expanded={open} aria-controls="vecmart-assistant-panel"><AssistantAvatar size={96} mascot /><span class="assistant-launcher-label">{open ? 'Tutup asisten' : 'Asisten VecMart'}</span></button>

<style>
  .assistant-launcher { position: fixed; right: 16px; bottom: 14px; z-index: 55; display: grid; place-items: center; width: 96px; height: 96px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--vm-blue); }
  .assistant-launcher-label { position: absolute; right: calc(100% + 3px); top: 50%; transform: translateY(-50%); white-space: nowrap; font-size: 12px; padding: 6px 10px; background: #fff; color: #24598f; border: 1px solid #d4e4f6; border-radius: 7px; opacity: 0; visibility: hidden; transition: opacity .15s; }
  .assistant-launcher:hover .assistant-launcher-label, .assistant-launcher:focus-visible .assistant-launcher-label { opacity: 1; visibility: visible; }
  .assistant-widget-panel { position: fixed; right: 24px; bottom: 120px; width: 440px; height: min(720px, calc(100dvh - 144px)); z-index: 60; background: #fff; border: 1px solid #cddff5; border-radius: 16px; overflow: hidden; box-shadow: 0 18px 60px #16365d2b; animation: assistant-panel-enter 160ms ease-out; }
  @keyframes assistant-panel-enter { from { opacity: .7; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @media (max-width: 640px) {
    .assistant-launcher { right: 12px; bottom: max(12px,env(safe-area-inset-bottom)); }
    .assistant-widget-panel { inset: 0; width: 100%; height: 100dvh; border-radius: 0; border: 0; }
  }
  @media (prefers-reduced-motion: reduce) { .assistant-launcher { transition: none; } .assistant-widget-panel { animation: none; } }
</style>
