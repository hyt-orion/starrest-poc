/**
 * 用户设置持久化（localStorage）
 * 上线替换为后端 API
 */

export type Sensitivity = 'low' | 'normal' | 'high'

export interface Settings {
  alertSensitivity: Sensitivity
  pushEnabled: boolean
}

const SETTINGS_KEY = 'starrest_settings'

const DEFAULTS: Settings = {
  alertSensitivity: 'normal',
  pushEnabled: true,
}

export function getSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  return next
}

/** 清除全量本地数据（用户表 + 登录态 + 引导 + 设置） */
export function clearAllData() {
  localStorage.removeItem('starrest_users')
  localStorage.removeItem('starrest_current_user')
  localStorage.removeItem('starrest_onboarded')
  localStorage.removeItem('starrest_settings')
}
