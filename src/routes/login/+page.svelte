<script lang="ts">
  import Brand from '$lib/components/Brand.svelte';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/authStore';
  import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-svelte';

  let email = '';
  let pinCode = '';
  let showPin = false;
  let isLoading = false;
  let errorMsg = '';

  onMount(() => {
    const unsubscribe = authStore.subscribe((user) => {
      if (user) {
        if (user.role === 'admin') {
          goto('/admin');
        } else {
          goto('/kasir');
        }
      }
    });
    return unsubscribe;
  });

  async function handleLogin() {
    errorMsg = '';
    if (!email || !pinCode) {
      errorMsg = 'Email dan PIN wajib diisi!';
      return;
    }

    isLoading = true;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pinCode })
      }).then((r) => r.json());

      if (res?.success && res.user) {
        authStore.login({
          id: res.user.id,
          name: res.user.name,
          email: res.user.email,
          role: res.user.role,
          token: res.token || `token-${Date.now()}`
        });

        if (res.user.role === 'admin') {
          goto('/admin');
        } else {
          goto('/kasir');
        }
      } else {
        errorMsg = res?.message || 'Email atau PIN salah. Silakan coba lagi.';
      }
    } catch (e: any) {
      errorMsg = 'Gagal terhubung ke server: ' + e.message;
    } finally {
      isLoading = false;
    }
  }
</script>


<div class="login-page">
  <section class="login-story" aria-label="VecMart">
    <Brand />
    <div class="login-message"><p class="login-statement">Toko tertata.<br /><span>Transaksi lancar.</span></p><p>Dari penjualan pertama hingga rekap akhir hari, kelola operasional toko Anda bersama VecMart.</p>
      <img class="login-illustration" src="/login-minimarket.png" alt="" width="1536" height="1024" fetchpriority="high" />
    </div>
    <div class="login-story-footer"><span>VecMart · Sistem kasir & inventori</span></div>
  </section>
  <main class="login-form-panel">
    <div class="login-mobile-brand"><Brand /></div>
    <div class="login-form-content">
      <div class="login-form-heading"><h1>Selamat datang kembali</h1><p>Masuk untuk mulai mengelola toko.</p></div>
      <form on:submit|preventDefault={handleLogin} class="login-form">
        <div class="field"><label for="email">Email akun</label><input id="email" type="email" bind:value={email} placeholder="nama@toko.com" autocomplete="email" required /></div>
        <div class="field"><label for="pin">PIN akun</label><div class="relative"><input id="pin" type={showPin ? 'text' : 'password'} bind:value={pinCode} placeholder="Masukkan 6 digit PIN" maxlength={6} minlength={6} inputmode="numeric" pattern={'[0-9]{6}'} autocomplete="current-password" aria-describedby="pin-help" required class="pin-input" /><button type="button" on:click={() => showPin = !showPin} class="pin-toggle" aria-label={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'} aria-pressed={showPin}>{#if showPin}<EyeOff size={18} />{:else}<Eye size={18} />{/if}</button></div><p id="pin-help" class="field-help">Gunakan PIN 6 digit yang terdaftar untuk akun Anda.</p></div>
        {#if errorMsg}<div class="form-error" role="alert"><AlertCircle size={18} /><span>{errorMsg}</span></div>{/if}
        <button type="submit" disabled={isLoading} class="primary-button login-submit">{#if isLoading}<Loader2 size={18} class="animate-spin" /><span>Memverifikasi…</span>{:else}<span>Masuk</span>{/if}</button>
      </form>
      <p class="login-note">Akses admin dan kasir mengikuti peran akun Anda.</p>
    </div>
    <footer class="login-bottom"><p>© {new Date().getFullYear()} VecMart. All rights reserved.</p></footer>
  </main>
</div>
