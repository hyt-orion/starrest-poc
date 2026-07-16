const C = 'starrest-v3'
self.addEventListener('install', () => { self.skipWaiting() })
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== C).map((n) => caches.delete(n)))))
  self.clients.claim()
})
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return
  const u = new URL(e.request.url)
  // HTML: Network-First（确保加载最新版本，不缓存旧代码）
  if (e.request.mode === 'navigate' || u.pathname.endsWith('.html')) {
    e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(C).then((cache) => cache.put(e.request, c)); return r }).catch(() => caches.match(e.request)))
    return
  }
  // 其他: Cache-First（快）
  e.respondWith(caches.match(e.request).then((cached) => cached || fetch(e.request).then((r) => { if (r.ok && r.type === 'basic') { const c = r.clone(); caches.open(C).then((cache) => cache.put(e.request, c)) } return r }).catch(() => cached)))
})
