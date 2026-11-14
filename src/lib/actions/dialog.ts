let openDialogs = 0;
let originalOverflow = '';

/** Keep keyboard focus in an open dialog and return it to its trigger on close. */
export function dialog(node: HTMLElement) {
  const previous = document.activeElement as HTMLElement | null;
  if (openDialogs === 0) originalOverflow = document.body.style.overflow;
  openDialogs += 1;
  document.body.style.overflow = 'hidden';
  node.setAttribute('role', 'dialog');
  node.setAttribute('aria-modal', 'true');
  node.setAttribute('aria-label', node.querySelector('h2,h3')?.textContent?.trim() || 'Dialog VecMart');
  node.tabIndex = -1;
  const focusable = () => Array.from(node.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled):not([type=hidden]),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')).filter(el => el.getClientRects().length > 0);
  const frame = requestAnimationFrame(() => (focusable()[0] || node).focus());
  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      node.querySelector<HTMLButtonElement>('button[aria-label="Tutup dialog"]')?.click();
    }
    if (event.key === 'Tab') {
      const elements = focusable();
      if (!elements.length) { event.preventDefault(); node.focus(); return; }
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === node)) { event.preventDefault(); first.focus(); }
    }
  }
  node.addEventListener('keydown', keydown);
  return { destroy() { cancelAnimationFrame(frame); node.removeEventListener('keydown', keydown); openDialogs -= 1; if (!openDialogs) document.body.style.overflow = originalOverflow; if (previous?.isConnected) previous.focus(); } };
}
