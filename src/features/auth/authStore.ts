/**
 * 账号体系（后端 API + localStorage 缓存）
 * 手机号为唯一标识。密码在后端 PBKDF2 哈希存储。
 */
import { apiLogin, apiRegister, apiGetMe, apiLogout, isLoggedIn } from '../../shared/apiClient'

export interface User {
  phone: string
  createdAt?: number
}

const CURRENT_KEY = 'starrest_current_user'

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

/** 手机号+密码登录（首次自动注册） */
export async function loginWithPhonePassword(
  phone: string,
  password: string,
): Promise<{ user?: User; error?: string }> {
  // 先尝试登录
  const loginRes = await apiLogin(phone, password)
  if (loginRes.data) {
    const user: User = { phone: loginRes.data.user.phone }
    setCurrentUser(user)
    return { user }
  }
  // 登录失败 → 尝试注册
  const regRes = await apiRegister(phone, password)
  if (regRes.data) {
    const user: User = { phone: regRes.data.user.phone }
    setCurrentUser(user)
    return { user }
  }
  return { error: loginRes.error || regRes.error || '登录失败' }
}

/** 验证当前登录态（从后端获取） */
export async function verifyCurrentUser(): Promise<User | null> {
  if (!isLoggedIn()) return null
  const res = await apiGetMe()
  if (res.data) {
    const user: User = { phone: res.data.user.phone }
    setCurrentUser(user)
    return user
  }
  setCurrentUser(null)
  return null
}

export function logout() {
  apiLogout()
  setCurrentUser(null)
}
