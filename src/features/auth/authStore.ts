/**
 * POC 账号体系（localStorage mock，上线替换为后端 API）
 * 手机号为唯一标识，微信/QQ 可绑定到同一账号。
 */

export interface User {
  phone: string
  password?: string
  wechatBound?: boolean
  qqBound?: boolean
  createdAt: number
}

const CURRENT_KEY = 'starrest_current_user'
const USERS_KEY = 'starrest_users'

export function getUsers(): Record<string, User> {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveUsers(users: Record<string, User>) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
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

/** 手机号+密码登录（账号不存在则自动注册） */
export function loginWithPhonePassword(
  phone: string,
  password: string,
): { user?: User; error?: string } {
  if (password.length < 6) return { error: '密码至少 6 位' }
  const users = getUsers()
  let user = users[phone]
  if (!user) {
    user = { phone, password, createdAt: Date.now() }
    users[phone] = user
    saveUsers(users)
  } else {
    if (user.password !== password) return { error: '密码错误' }
  }
  setCurrentUser(user)
  return { user }
}

/** mock 微信登录 */
export function loginWithWechat(): User {
  const phone = 'wechat_' + Math.random().toString(36).slice(2, 10)
  const user: User = { phone, wechatBound: true, createdAt: Date.now() }
  const users = getUsers()
  users[phone] = user
  saveUsers(users)
  setCurrentUser(user)
  return user
}

/** mock QQ 登录 */
export function loginWithQQ(): User {
  const phone = 'qq_' + Math.random().toString(36).slice(2, 10)
  const user: User = { phone, qqBound: true, createdAt: Date.now() }
  const users = getUsers()
  users[phone] = user
  saveUsers(users)
  setCurrentUser(user)
  return user
}

export function logout() {
  setCurrentUser(null)
}
