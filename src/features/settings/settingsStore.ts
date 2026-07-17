/**
 * 用户设置（后端 API + localStorage 缓存）
 */
import { apiGetSettings, apiSaveSettings } from '../../shared/apiClient'

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

export async function fetchSettingsFromServer(): Promise<Settings> {
  const res = await apiGetSettings()
  if (res.data) {
    const settings: Settings = {
      alertSensitivity: res.data.alertSensitivity as Sensitivity,
      pushEnabled: res.data.pushEnabled,
    }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    return settings
  }
  return getSettings()
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...getSettings(), ...patch }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  await apiSaveSettings(next.alertSensitivity, next.pushEnabled)
  return next
}

/** 清除全量本地数据 */
export function clearAllData() {
  localStorage.removeItem('starrest_current_user')
  localStorage.removeItem('starrest_onboarded')
  localStorage.removeItem('starrest_settings')
  localStorage.removeItem('starrest_rewards')
  localStorage.removeItem('starrest_privacy_confirmed')
  localStorage.removeItem('starrest_jwt')
}
