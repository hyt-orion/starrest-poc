import { Hono } from 'hono'
import { verifyJWT, hashPassword, verifyPassword, signJWT } from './auth'
import {
  type Env,
  createUser, getUserByPhone,
  getSettings, saveSettings,
  getRewards, completeRewardSession,
  getTreeholePosts, createTreeholePost,
  getBaseline, saveBaselineEntry,
  cleanupOldRecords,
} from './db'

// 导出 Durable Object 类（Cloudflare Workers 运行时需要识别）
export { RoomDO } from './room'

const app = new Hono<{ Bindings: Env }>()

// CORS — 自定义实现，WebSocket 升级请求跳过（避免破坏 101 响应）
app.use('*', async (c, next) => {
  const upgrade = c.req.header('Upgrade')
  if (upgrade?.toLowerCase() === 'websocket') {
    return next()
  }
  if (c.req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': c.req.header('Origin') || '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }
  await next()
  const origin = c.req.header('Origin')
  if (origin) {
    try {
      c.res.headers.set('Access-Control-Allow-Origin', origin)
      c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    } catch {}
  }
})

// 健康检查
app.get('/', (c) => c.json({ ok: true, service: 'starrest-api' }))

// 全局错误捕获 — 防止未处理异常返回裸 500（手动加 CORS 头，确保浏览器能读取错误响应）
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  const origin = c.req.header('Origin') || '*'
  return c.json(
    { error: '服务器内部错误', detail: String(err.message ?? err) },
    500,
    {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  )
})

// 404 也加 CORS 头
app.notFound((c) => {
  const origin = c.req.header('Origin') || '*'
  return c.json({ error: 'Not Found' }, 404, {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  })
})

// ===== Auth =====

app.post('/api/auth/register', async (c) => {
  const { phone, password } = await c.req.json<{ phone: string; password: string }>()
  if (!phone || !password || password.length < 6) {
    return c.json({ error: '手机号或密码不合法' }, 400)
  }
  const existing = await getUserByPhone(c.env.DB, phone)
  if (existing) return c.json({ error: '该手机号已注册' }, 409)

  const hash = await hashPassword(password, c.env.JWT_SECRET)
  const user = await createUser(c.env.DB, phone, hash)
  const token = await signJWT(user.id, phone, c.env.JWT_SECRET)
  return c.json({ token, user: { id: user.id, phone: user.phone } })
})

app.post('/api/auth/login', async (c) => {
  const { phone, password } = await c.req.json<{ phone: string; password: string }>()
  if (!phone || !password) return c.json({ error: '参数缺失' }, 400)

  const user = await getUserByPhone(c.env.DB, phone)
  if (!user) return c.json({ error: '账号不存在，请先注册' }, 404)

  const ok = await verifyPassword(password, user.password_hash, c.env.JWT_SECRET)
  if (!ok) return c.json({ error: '密码错误' }, 401)

  const token = await signJWT(user.id, phone, c.env.JWT_SECRET)
  return c.json({ token, user: { id: user.id, phone: user.phone } })
})

app.get('/api/auth/me', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.json({ error: '未登录' }, 401)
  const payload = await verifyJWT(auth.slice(7), c.env.JWT_SECRET)
  if (!payload) return c.json({ error: 'token 无效' }, 401)
  return c.json({ user: { id: payload.userId, phone: payload.phone } })
})

// ===== Settings =====

async function authMiddleware(c: any) {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return verifyJWT(auth.slice(7), c.env.JWT_SECRET)
}

app.get('/api/settings', async (c) => {
  const payload = await authMiddleware(c)
  if (!payload) return c.json({ error: '未登录' }, 401)
  const settings = await getSettings(c.env.DB, payload.userId)
  return c.json(settings)
})

app.post('/api/settings', async (c) => {
  const payload = await authMiddleware(c)
  if (!payload) return c.json({ error: '未登录' }, 401)
  const { alertSensitivity, pushEnabled } = await c.req.json()
  await saveSettings(c.env.DB, payload.userId, alertSensitivity, pushEnabled)
  return c.json({ ok: true })
})

// ===== Rewards =====

app.get('/api/rewards', async (c) => {
  const payload = await authMiddleware(c)
  if (!payload) return c.json({ error: '未登录' }, 401)
  const rewards = await getRewards(c.env.DB, payload.userId)
  return c.json(rewards)
})

app.post('/api/rewards/complete', async (c) => {
  const payload = await authMiddleware(c)
  if (!payload) return c.json({ error: '未登录' }, 401)
  const result = await completeRewardSession(c.env.DB, payload.userId)
  return c.json(result)
})

// ===== Treehole =====

app.get('/api/treehole', async (c) => {
  const posts = await getTreeholePosts(c.env.DB)
  return c.json(posts)
})

app.post('/api/treehole', async (c) => {
  const { content } = await c.req.json<{ content: string }>()
  if (!content?.trim()) return c.json({ error: '内容不能为空' }, 400)
  const post = await createTreeholePost(c.env.DB, content.trim())
  return c.json(post)
})

// ===== Baseline =====

app.get('/api/baseline', async (c) => {
  const payload = await authMiddleware(c)
  if (!payload) return c.json({ error: '未登录' }, 401)
  const data = await getBaseline(c.env.DB, payload.userId)
  return c.json(data)
})

app.post('/api/baseline', async (c) => {
  const payload = await authMiddleware(c)
  if (!payload) return c.json({ error: '未登录' }, 401)
  const { value } = await c.req.json<{ value: number }>()
  await saveBaselineEntry(c.env.DB, payload.userId, value)
  return c.json({ ok: true })
})

// ===== Room（WebSocket 实时通信） =====

/** 验证 4 位数字房间码 */
function isValidRoomCode(code: string): boolean {
  return /^\d{4}$/.test(code)
}

/** 创建房间，返回 4 位房间码 */
app.post('/api/room/create', async (c) => {
  const code = String(Math.floor(1000 + Math.random() * 9000))
  // 触发 DO 实例化（不创建连接，仅注册房间）
  const id = c.env.ROOM.idFromName(code)
  const stub = c.env.ROOM.get(id)
  try {
    await stub.fetch(`https://room-do/${code}/info`)
  } catch (e) {
    console.error('Init room failed:', e)
  }
  return c.json({ code })
})

/** 获取房间在线信息 */
app.get('/api/room/:code/info', async (c) => {
  const code = c.req.param('code')
  if (!isValidRoomCode(code)) return c.json({ error: '房间码不合法' }, 400)
  const id = c.env.ROOM.idFromName(code)
  const stub = c.env.ROOM.get(id)
  const resp = await stub.fetch(`https://room-do/${code}/info`)
  return new Response(resp.body, { status: resp.status, headers: resp.headers })
})

/** 星宝端推送帧数据（POST） */
app.post('/api/room/:code/frame', async (c) => {
  const code = c.req.param('code')
  if (!isValidRoomCode(code)) return c.json({ error: '房间码不合法' }, 400)
  const body = await c.req.text()
  const id = c.env.ROOM.idFromName(code)
  const stub = c.env.ROOM.get(id)
  const resp = await stub.fetch(new Request(`https://room-do/${code}/frame`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }))
  return new Response(resp.body, { status: resp.status, headers: resp.headers })
})

/** 家长端拉取帧数据（GET） */
app.get('/api/room/:code/frame', async (c) => {
  const code = c.req.param('code')
  if (!isValidRoomCode(code)) return c.json({ error: '房间码不合法' }, 400)
  const id = c.env.ROOM.idFromName(code)
  const stub = c.env.ROOM.get(id)
  const resp = await stub.fetch(`https://room-do/${code}/frame`)
  return new Response(resp.body, { status: resp.status, headers: resp.headers })
})

/** WebSocket 升级路由 */
app.get('/api/room/:code/ws', (c) => {
  const code = c.req.param('code')
  if (!isValidRoomCode(code)) return c.json({ error: '房间码不合法' }, 400)
  const upgradeHeader = c.req.header('Upgrade')
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
    return c.json({ error: 'Expected websocket' }, 426)
  }
  const role = c.req.query('role') === 'broadcaster' ? 'broadcaster' : 'subscriber'
  const id = c.env.ROOM.idFromName(code)
  const stub = c.env.ROOM.get(id)
  // 转发原始请求到 DO（必须保留 Upgrade 头，否则 DO 无法升级 WebSocket）
  return stub.fetch(c.req.raw)
})

// ===== 定时清理（Cron Trigger） =====

async function runScheduledCleanup(env: Env) {
  try {
    const result = await cleanupOldRecords(env.DB, 7)
    console.log('[scheduled] cleanup done:', JSON.stringify(result))
  } catch (e) {
    console.error('[scheduled] cleanup failed:', e)
  }
}

// Module Worker 导出：WebSocket 在 Hono 之前拦截，避免框架干扰 101 升级
export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // WebSocket 升级请求：直接转发原始 request 给 DO，绕过 Hono
    const url = new URL(request.url)
    const wsMatch = url.pathname.match(/^\/api\/room\/(\d{4})\/ws$/)
    if (wsMatch && request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      const code = wsMatch[1]
      const id = env.ROOM.idFromName(code)
      const stub = env.ROOM.get(id)
      return stub.fetch(request)
    }
    return app.fetch(request, env, ctx)
  },
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runScheduledCleanup(env))
  },
}
