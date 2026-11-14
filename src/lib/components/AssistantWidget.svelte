<script lang="ts">
  import { onMount, tick } from 'svelte';
  import AssistantPanel from './AssistantPanel.svelte';
  import AssistantAvatar from './AssistantAvatar.svelte';
  import { dialog } from '$lib/actions/dialog';
  let open = false;
  let expanded = false;
  let launcher: HTMLButtonElement;
  let visibleHeight = 0;
  let bottomOffset = 0;
  let keyboardOpen = false;
  function panelFocus(node: HTMLElement) {
    node.tabIndex = -1;
    const frame = requestAnimationFrame(() => {
      if (matchMedia('(max-width: 640px)').matches) node.focus({ preventScroll: true });
      else node.querySelector<HTMLTextAreaElement>('textarea:not(:disabled)')?.focus({ preventScroll: true });
    });
    return { destroy() { cancelAnimationFrame(frame); } };
  }
  function panelMode(node: HTMLElement, fullscreen: boolean) {
    let modal: ReturnType<typeof dialog> | undefined;
    function sync() {
      if (fullscreen && !modal) {
        modal = dialog(node);
        node.setAttribute('aria-label', 'Asisten VecMart');
      } else if (!fullscreen && modal) {
        modal.destroy(); modal = undefined;
        node.removeAttribute('role'); node.removeAttribute('aria-modal');
        node.tabIndex = -1;
      }
    }
    sync();
    return { update(value: boolean) { fullscreen = value; sync(); }, destroy() { modal?.destroy(); } };
  }
  async function close() { open = false; expanded = false; await tick(); launcher?.focus(); }
  onMount(() => {
    const viewport = window.visualViewport;
    function updateViewport() {
      visibleHeight = viewport?.height ?? window.innerHeight;
      bottomOffset = Math.max(0, window.innerHeight - visibleHeight - (viewport?.offsetTop ?? 0));
      keyboardOpen = (viewport?.scale ?? 1) === 1 && visibleHeight < window.innerHeight - 120;
    }
    updateViewport();
    window.addEventListener('resize', updateViewport);
    viewport?.addEventListener('resize', updateViewport);
    viewport?.addEventListener('scroll', updateViewport);
    if (new URL(location.href).searchParams.get('assistant') === 'open') open = true;
    return () => {
      window.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('scroll', updateViewport);
    };
  });
</script>
<svelte:window on:keydown={(event) => { if (open && event.key === 'Escape') { event.preventDefault(); close(); } }} />
{#if open}
  <section id="vecmart-assistant-panel" class="assistant-widget-panel" class:expanded class:keyboard-open={keyboardOpen} style={`--assistant-visible-height: ${visibleHeight}px; --assistant-bottom-offset: ${bottomOffset}px`} use:panelFocus use:panelMode={expanded} aria-label="Asisten VecMart"><AssistantPanel floating {close} {expanded} toggleExpanded={() => expanded = !expanded} /></section>
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
    .assistant-widget-panel { right: 12px; bottom: calc(120px + env(safe-area-inset-bottom)); width: min(420px, calc(100vw - 24px)); height: min(560px, 70dvh, calc(100dvh - 144px)); }
  }
  @media (max-height: 560px) {
    .assistant-widget-panel { right: 12px; bottom: 12px; width: min(440px, calc(100vw - 24px)); height: calc(100dvh - 24px); }
  }
  .assistant-widget-panel.keyboard-open { bottom: calc(var(--assistant-bottom-offset) + 12px); height: min(560px, calc(var(--assistant-visible-height) - 24px)); }
  .assistant-widget-panel.expanded { left: 0; right: 0; bottom: var(--assistant-bottom-offset); width: 100%; height: var(--assistant-visible-height); border: 0; border-radius: 0; box-shadow: none; }
  .assistant-widget-panel.expanded :global(.assistant-floating-header) { padding-top: max(10px,env(safe-area-inset-top)); }
  .assistant-widget-panel.expanded :global(.assistant-composer) { padding-bottom: max(8px,env(safe-area-inset-bottom)); }
  @media (prefers-reduced-motion: reduce) { .assistant-launcher { transition: none; } .assistant-widget-panel { animation: none; } }
</style>
