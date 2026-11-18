/// <reference lib="webworker" />

const worker = self as unknown as ServiceWorkerGlobalScope;

// Never cache API responses, authenticated pages, or pending transactions.
// Only failed full-page navigations get a static, non-sensitive offline explanation.
worker.addEventListener('fetch', (event: FetchEvent) => {
  if (event.request.mode !== 'navigate' || event.request.method !== 'GET') return;
  if (new URL(event.request.url).pathname.startsWith('/api')) return;
  event.respondWith(fetch(event.request).catch(() => new Response(`<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>VecMart</title><meta name="theme-color" content="#1764bf"><style>
body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#eaf3ff;color:#203e60;font:16px/1.7 system-ui,sans-serif}main{max-width:420px;padding:32px}h1{font-size:28px;line-height:1.3}p{color:#5d6978}a{display:inline-block;margin-top:12px;padding:12px 20px;background:#1764bf;color:white;border-radius:8px;text-decoration:none}a:focus-visible{outline:2px solid #203e60;outline-offset:4px}
</style></head><body><main><strong>VecMart</strong><h1>Koneksi internet terputus</h1><p>Hubungkan kembali perangkat ke internet, lalu buka ulang VecMart untuk mengakses transaksi, stok, dan laporan.</p><p>Halaman ini tidak dapat menyimpan transaksi.</p><a href="">Coba lagi</a></main></body></html>`, {
    status: 503, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
  })));
});

export {};
