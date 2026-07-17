/**
 * 星憩时刻 Service Worker
 * - HTML: Network-First（在线时取最新，离线用缓存，再降级到离线回退页）
 * - JS/CSS: Stale-While-Revalidate
 * - 其他静态资源: Cache-First
 * - 含缓存版本号，便于强制清理旧缓存
 */

const CACHE_VERSION = 'v7'
const CACHE_NAME = `starrest-${CACHE_VERSION}`

// 离线回退页面（内联，避免额外的网络请求）
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>星憩时刻 · 离线</title>
  <style>
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: #020617; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; }
    .box { text-align: center; padding: 2rem; }
    h1 { font-size: 1.25rem; margin: 0 0 .5rem; }
    p { color: rgba(255,255,255,.6); font-size: .875rem; margin: .25rem 0; }
    button { margin-top: 1rem; padding: .5rem 1.25rem; border: 0; border-radius: .75rem;
      background: #10b981; color: #fff; font-size: .875rem; }
  </style>
</head>
<body>
  <div class="box">
    <h1>当前处于离线状态</h1>
    <p>看护数据仍可在本地继续工作</p>
    <p>请检查网络后重试</p>
    <button onclick="location.reload()">重新连接</button>
  </div>
</body>
</html>`

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    // 缓存 App Shell；addAll 在任一请求失败时会整体失败，所以单独 put
    const scope = self.registration.scope
    const appShellUrls = [scope, scope + 'index.html', scope + 'manifest.json']
    await Promise.all(
      appShellUrls.map(async (url) => {
        try {
          const res = await fetch(url)
          if (res.ok) await cache.put(url, res.clone())
        } catch {
          /* 单个资源失败不阻塞 install */
        }
      }),
    )
    // 写入离线回退页面
    await cache.put(
      scope + 'offline.html',
      new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
    )
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(
      keys.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)),
    )
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const u = new URL(event.request.url)
  // 仅处理同源请求，第三方资源交给浏览器
  if (u.origin !== self.location.origin) return

  const scope = self.registration.scope
  const isHtml = event.request.mode === 'navigate' || u.pathname.endsWith('.html')
  const isJsCss = u.pathname.endsWith('.js') || u.pathname.endsWith('.css')

  // HTML: Network-First
  if (isHtml) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request)
        const cache = await caches.open(CACHE_NAME)
        cache.put(event.request, fresh.clone())
        return fresh
      } catch {
        const cached = await caches.match(event.request)
        if (cached) return cached
        // 最后兜底：离线回退页面
        const offline = await caches.match(scope + 'offline.html')
        if (offline) return offline
        return new Response('离线', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
      }
    })())
    return
  }

  // JS/CSS: Stale-While-Revalidate
  if (isJsCss) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME)
      const cached = await cache.match(event.request)
      const networkPromise = fetch(event.request)
        .then((fresh) => {
          if (fresh.ok && fresh.type === 'basic') {
            cache.put(event.request, fresh.clone())
          }
          return fresh
        })
        .catch(() => null)
      // 有缓存先返回缓存，否则等网络
      if (cached) {
        void networkPromise // 后台更新
        return cached
      }
      const fresh = await networkPromise
      if (fresh) return fresh
      // 网络失败且无缓存
      return new Response('', { status: 503 })
    })())
    return
  }

  // 其他静态资源: Cache-First
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME)
    const cached = await cache.match(event.request)
    if (cached) return cached
    try {
      const fresh = await fetch(event.request)
      if (fresh.ok && fresh.type === 'basic') {
        cache.put(event.request, fresh.clone())
      }
      return fresh
    } catch {
      return new Response('', { status: 503 })
    }
  })())
})
