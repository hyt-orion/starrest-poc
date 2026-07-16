/** 四级预警：常规 / 关注 / 预警 / 干预 */
export type AlertLevel = 'calm' | 'watch' | 'alert' | 'act'

export interface AlertState {
  level: AlertLevel
  z: number
  message: string
}

import type { Sensitivity } from '../settings/settingsStore'

/** 灵敏度 → 基础 k 值：低=2.5(宽容) 标准=2.0 高=1.5(敏感) */
const K_MAP: Record<Sensitivity, number> = {
  low: 2.5,
  normal: 2.0,
  high: 1.5,
}

/**
 * z-score → 四级分级。
 * 以 k 值为基准：|z| ≤ k 常规 | ≤ k+1 关注 | ≤ k+2 预警 | > k+2 干预
 * 仅干预级触发强提醒（悬浮球脉冲）。
 */
export function classifyAlert(z: number, index: number, sensitivity: Sensitivity = 'normal'): AlertState {
  const k = K_MAP[sensitivity]
  const az = Math.abs(z)
  if (az <= k) return { level: 'calm', z, message: `活跃指数 ${index}，状态平稳` }
  if (az <= k + 1) return { level: 'watch', z, message: `活跃指数 ${index}，略有波动` }
  if (az <= k + 2) return { level: 'alert', z, message: `活跃指数 ${index}，建议关注` }
  return { level: 'act', z, message: `活跃指数 ${index}，需要查看` }
}

export const LEVEL_COLORS: Record<AlertLevel, string> = {
  calm: '#22c55e',
  watch: '#eab308',
  alert: '#f97316',
  act: '#ef4444',
}

export const LEVEL_LABELS: Record<AlertLevel, string> = {
  calm: '常规',
  watch: '关注',
  alert: '预警',
  act: '干预',
}
