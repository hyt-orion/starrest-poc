import type { NormalizedPoint } from './moveNetDetector'

export type BehaviorType = 'normal' | 'arm_flapping' | 'head_banging' | 'spinning' | 'stillness'

export interface BehaviorResult {
  type: BehaviorType
  confidence: number
  message: string
}

// MoveNet 17 关键点索引：0=nose, 5=left_shoulder, 6=right_shoulder,
// 9=left_wrist, 10=right_wrist
const HISTORY_SIZE = 30 // 约 6 秒（5fps）
let keypointHistory: NormalizedPoint[][] = []

export function pushKeypoints(keypoints: NormalizedPoint[]) {
  keypointHistory.push([...keypoints])
  if (keypointHistory.length > HISTORY_SIZE) keypointHistory.shift()
}

export function resetBehaviorHistory() {
  keypointHistory = []
}

/**
 * 基于 MoveNet 关键点序列的行为分类器。
 * 检测 4 种自闭症相关行为：摆臂 / 撞头 / 旋转 / 长静默。
 * 方法：特征工程 + 阈值规则（不需要训练模型）。
 */
export function classifyBehavior(): BehaviorResult {
  if (keypointHistory.length < 10) {
    return { type: 'normal', confidence: 0, message: '收集数据中' }
  }

  // 1. 长静默：所有关键点平均位移极低
  let totalMovement = 0
  for (let i = 1; i < keypointHistory.length; i++) {
    for (let j = 0; j < keypointHistory[i].length; j++) {
      const dx = keypointHistory[i][j].x - keypointHistory[i - 1][j].x
      const dy = keypointHistory[i][j].y - keypointHistory[i - 1][j].y
      totalMovement += Math.sqrt(dx * dx + dy * dy)
    }
  }
  const avgMovement = totalMovement / (keypointHistory.length - 1) / 17
  if (avgMovement < 0.005) {
    return { type: 'stillness', confidence: 0.8, message: '长时间静止' }
  }

  // 2. 摆臂：手腕 y 坐标周期性振荡
  const lwY = keypointHistory.map((f) => f[9]?.y ?? 0.5)
  const rwY = keypointHistory.map((f) => f[10]?.y ?? 0.5)
  const flapScore = Math.max(detectOscillation(lwY), detectOscillation(rwY))
  if (flapScore > 0.5) {
    return { type: 'arm_flapping', confidence: flapScore, message: '疑似摆臂' }
  }

  // 3. 撞头：手腕靠近头部
  let headCount = 0
  for (const f of keypointHistory) {
    const nose = f[0]
    const lw = f[9]
    const rw = f[10]
    if (nose && lw && Math.hypot(nose.x - lw.x, nose.y - lw.y) < 0.12) headCount++
    if (nose && rw && Math.hypot(nose.x - rw.x, nose.y - rw.y) < 0.12) headCount++
  }
  const headRatio = headCount / keypointHistory.length
  if (headRatio > 0.3) {
    return { type: 'head_banging', confidence: headRatio, message: '疑似撞头' }
  }

  // 4. 旋转：左右肩 x 位置频繁交替
  let swapCount = 0
  for (let i = 1; i < keypointHistory.length; i++) {
    const pl = keypointHistory[i - 1][5]?.x ?? 0
    const pr = keypointHistory[i - 1][6]?.x ?? 0
    const cl = keypointHistory[i][5]?.x ?? 0
    const cr = keypointHistory[i][6]?.x ?? 0
    if ((pl < pr) !== (cl < cr)) swapCount++
  }
  const swapRatio = swapCount / keypointHistory.length
  if (swapRatio > 0.2) {
    return { type: 'spinning', confidence: swapRatio, message: '疑似旋转' }
  }

  return { type: 'normal', confidence: 0.9, message: '行为正常' }
}

/** 检测信号的周期性振荡（过零率 × 幅度） */
function detectOscillation(signal: number[]): number {
  if (signal.length < 5) return 0
  const mean = signal.reduce((a, b) => a + b, 0) / signal.length
  let crossings = 0
  let amplitude = 0
  for (let i = 1; i < signal.length; i++) {
    if ((signal[i - 1] < mean) !== (signal[i] < mean)) crossings++
    amplitude += Math.abs(signal[i] - mean)
  }
  amplitude /= signal.length
  const crossingRate = crossings / signal.length
  const ampScore = Math.min(amplitude / 0.03, 1)
  return Math.min(crossingRate * 2 * ampScore, 1)
}
