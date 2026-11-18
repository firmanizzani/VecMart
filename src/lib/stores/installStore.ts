import { writable, get } from 'svelte/store';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
export const installState = writable({ initialized: false, installed: false, available: false, busy: false, help: false, ios: false, safari: false, error: '' });
let pending: InstallPrompt | null = null;

/** Register once from the root layout, so prompt availability survives route changes. */
export function setupInstallation() {
  const standalone = matchMedia('(display-mode: standalone)');
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR/.test(navigator.userAgent);
  const sync = () => installState.update(s => ({ ...s, installed: standalone.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true }));
  installState.update(s => ({ ...s, initialized: true, ios, safari }));
  sync();
  const beforeInstall = (event: Event) => {
    event.preventDefault();
    pending = event as InstallPrompt;
    installState.update(s => ({ ...s, available: true, error: '' }));
  };
  const installed = () => {
    pending = null;
    installState.update(s => ({ ...s, installed: true, available: false, busy: false, help: false }));
  };
  window.addEventListener('beforeinstallprompt', beforeInstall);
  window.addEventListener('appinstalled', installed);
  standalone.addEventListener('change', sync);
  return () => {
    window.removeEventListener('beforeinstallprompt', beforeInstall);
    window.removeEventListener('appinstalled', installed);
    standalone.removeEventListener('change', sync);
    pending = null;
  };
}

export function closeInstallHelp() { installState.update(s => ({ ...s, help: false, error: '' })); }
export async function installApp() {
  const state = get(installState);
  if (state.busy || state.installed) return;
  if (!pending) { installState.update(s => ({ ...s, help: true, error: '' })); return; }
  const prompt = pending;
  pending = null;
  installState.update(s => ({ ...s, busy: true, available: false, error: '' }));
  try {
    // Call within the click handler's user activation. Each event may be used only once.
    await prompt.prompt();
    await prompt.userChoice;
  } catch {
    installState.update(s => ({ ...s, help: true, error: 'Dialog instalasi belum dapat dibuka. Gunakan menu browser dengan petunjuk di bawah.' }));
  } finally { installState.update(s => ({ ...s, busy: false })); }
}
