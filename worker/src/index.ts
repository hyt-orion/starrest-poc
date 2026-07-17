import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { verifyJWT, hashPassword, verifyPassword, signJWT } from './auth'
import {
  type Env,
  createUser, getUserByPhone,
  getSettings, saveSettings,
  getRewards, completeRewardSession,
  getTreeholePosts, createTreeholePost,
  getBaseline, saveBaselineEntry,
} from './db'

const app = new Hono<{ Bindings: Env }>()

// CORS — 硬编码 origin，不依赖环境变量（避免部署时 vars 未设置导致 CORS 失败）
app.use('*', cors({
  origin: ['https://hyt-orion.github.io', 'http://localhost:5173'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// 健康检查
app.get('/', (c) => c.json({ ok: true, service: 'starrest-api' }))

// 全局错误捕获 — 防止未处理异常返回裸 500
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: '服务器内部错误', detail: String(err.message ?? err) }, 500)
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

export default app
