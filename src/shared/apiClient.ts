/**
 * Worker API 客户端
 * 封装所有后端 API 调用，自动携带 JWT token
 * 部署后替换 WORKER_URL 为实际 Worker 地址
 */

const WORKER_URL = 'https://starrest-api.starrest.workers.dev'

function getToken(): string | null {
  return localStorage.getItem('starrest_jwt')
}

function setToken(token: string | null) {
  if (token) localStorage.setItem('starrest_jwt', token)
  else localStorage.removeItem('starrest_jwt')
}

async function api<T = any>(
  path: string,
  options: { method?: string; body?: any; auth?: boolean } = {},
): Promise<{ data?: T; error?: string }> {
  const { method = 'GET', body, auth = true } = options
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }
  try {
    const res = await fetch(`${WORKER_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = await res.json()
    if (!res.ok) return { error: (json as any).error || '请求失败' }
    return { data: json as T }
  } catch (e) {
    return { error: String(e) }
  }
}

// ===== Auth =====

export async function apiRegister(phone: string, password: string) {
  const res = await api<{ token: string; user: { id: string; phone: string } }>(
    '/api/auth/register', { method: 'POST', body: { phone, password }, auth: false },
  )
  if (res.data?.token) setToken(res.data.token)
  return res
}

export async function apiLogin(phone: string, password: string) {
  const res = await api<{ token: string; user: { id: string; phone: string } }>(
    '/api/auth/login', { method: 'POST', body: { phone, password }, auth: false },
  )
  if (res.data?.token) setToken(res.data.token)
  return res
}

export async function apiGetMe() {
  return api<{ user: { id: string; phone: string } }>('/api/auth/me')
}

export function apiLogout() {
  setToken(null)
}

export function isLoggedIn(): boolean {
  return !!getToken()
}

// ===== Settings =====

export async function apiGetSettings() {
  return api<{ alertSensitivity: string; pushEnabled: boolean }>('/api/settings')
}

export async function apiSaveSettings(alertSensitivity: string, pushEnabled: boolean) {
  return api('/api/settings', { method: 'POST', body: { alertSensitivity, pushEnabled } })
}

// ===== Rewards =====

export async function apiGetRewards() {
  return api<{ totalSessions: number; streak: number; lastDate: string; unlockedRewards: any[] }>('/api/rewards')
}

export async function apiCompleteSession() {
  return api<{ state: any; newReward: any }>('/api/rewards/complete', { method: 'POST' })
}

// ===== Treehole =====

export async function apiGetTreehole() {
  return api<{ id: string; text: string; time: number }[]>('/api/treehole', { auth: false })
}

export async function apiPostTreehole(content: string) {
  return api('/api/treehole', { method: 'POST', body: { content } })
}

// ===== Baseline =====

export async function apiGetBaseline() {
  return api<{ timestamp: number; value: number }[]>('/api/baseline')
}

export async function apiSaveBaseline(value: number) {
  return api('/api/baseline', { method: 'POST', body: { value } })
}
