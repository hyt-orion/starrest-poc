import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

/**
 * 计算两帧关键点的平均位移能量。
 * E_v = (1/N) * Σ ||p_i(t) - p_i(t-Δ)||
 */
export function computeDisplacement(
  curr: NormalizedLandmark[],
  prev: NormalizedLandmark[],
): number {
  let sum = 0
  const n = Math.min(curr.length, prev.length)
  for (let i = 0; i < n; i++) {
    const dx = curr[i].x - prev[i].x
    const dy = curr[i].y - prev[i].y
    sum += Math.sqrt(dx * dx + dy * dy)
  }
  return sum / Math.max(n, 1)
}

/**
 * 位移能量 → 0-100 活跃指数。
 * 经验阈值：0.001 ≈ 静止，0.05 ≈ 大幅运动。
 */
export function displacementToIndex(displacement: number): number {
  const raw = Math.min(displacement / 0.05, 1)
  return Math.round(raw * 100)
}
