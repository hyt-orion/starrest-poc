/**
 * 账号体系（后端 API + localStorage 降级）
 * 手机号为唯一标识。密码在后端 PBKDF2 哈希存储。
 * 后端不可达时自动降级到本地 localStorage 模式。
 */
import { apiLogin, apiRegister, apiGetMe, apiLogout, isLoggedIn } from '../../shared/apiClient'

export interface User {
  phone: string
  createdAt?: number
}

const CURRENT_KEY = 'starrest_current_user'
const LOCAL_USERS_KEY = 'starrest_local_users' // 降级模式的本地用户表

/** 本地降级：读取本地用户表 */
function getLocalUsers(): Record<string, { phone: string; password: string }> {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || '{}')
  } catch {
    return {}
  }
}

/** 本地降级：保存本地用户表 */
function saveLocalUsers(users: Record<string, { phone: string; password: string }>) {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users))
}

export function getCurrentUser(): User | null {
  try {
    const raw = localStorage.getItem(CURRENT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setCurrentUser(user: User | null) {
  if (user) localStorage.setItem(CURRENT_KEY, JSON.stringify(user))
  else localStorage.removeItem(CURRENT_KEY)
}

/** 手机号+密码登录（首次自动注册；后端不可达时降级到本地） */
export async function loginWithPhonePassword(
  phone: string,
  password: string,
): Promise<{ user?: User; error?: string }> {
  // 先尝试后端登录
  const loginRes = await apiLogin(phone, password)
  if (loginRes.data) {
    const user: User = { phone: loginRes.data.user.phone }
    setCurrentUser(user)
    return { user }
  }

  // 后端返回"账号不存在" → 尝试注册
  if (loginRes.error && loginRes.error.includes('不存在')) {
    const regRes = await apiRegister(phone, password)
    if (regRes.data) {
      const user: User = { phone: regRes.data.user.phone }
      setCurrentUser(user)
      return { user }
    }
    // 注册也失败（网络错误等） → 降级到本地
    if (regRes.error && isNetworkError(regRes.error)) {
      return localLogin(phone, password)
    }
    return { error: regRes.error || '注册失败' }
  }

  // 后端返回"密码错误"
  if (loginRes.error && loginRes.error.includes('密码错误')) {
    return { error: '密码错误' }
  }

  // 网络错误 → 降级到本地模式
  if (loginRes.error && isNetworkError(loginRes.error)) {
    return localLogin(phone, password)
  }

  return { error: loginRes.error || '登录失败' }
}

/** 判断是否为网络错误（不同浏览器文案不同） */
function isNetworkError(msg: string): boolean {
  const lower = msg.toLowerCase()
  return lower.includes('failed to fetch') ||
    lower.includes('network request failed') ||
    lower.includes('networkerror') ||
    lower.includes('load failed') ||
    lower.includes('fetch') ||
    lower.includes('network')
}

/** 本地降级登录/注册 */
function localLogin(phone: string, password: string): { user?: User; error?: string } {
  const users = getLocalUsers()
  const existing = users[phone]
  if (existing) {
    if (existing.password !== password) {
      return { error: '密码错误（本地模式）' }
    }
  } else {
    // 首次 → 自动注册
    users[phone] = { phone, password }
    saveLocalUsers(users)
  }
  const user: User = { phone, createdAt: Date.now() }
  setCurrentUser(user)
  return { user }
}

/** 验证当前登录态（从后端获取；后端不可达时检查本地） */
export async function verifyCurrentUser(): Promise<User | null> {
  const local = getCurrentUser()
  if (!isLoggedIn()) {
    // 本地降级模式：有本地用户就认为已登录
    return local
  }
  const res = await apiGetMe()
  if (res.data) {
    const user: User = { phone: res.data.user.phone }
    setCurrentUser(user)
    return user
  }
  // 后端不可达，但本地有用户 → 保持登录
  if (res.error && res.error.includes('fetch') && local) {
    return local
  }
  setCurrentUser(null)
  return null
}

export function logout() {
  apiLogout()
  setCurrentUser(null)
}
